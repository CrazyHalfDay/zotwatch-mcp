"""Bot capabilities — thin wrappers over the ``zotwatch`` package.

Each method maps one chat command to an existing ZotWatch component, so there is
no duplicated pipeline logic. Everything is normalized to ``RankedWork`` so the
router can keep a single "last shown list" for index-based 收藏/总结 commands.

Kept as plain functions/methods (no WeChat coupling) so a future MCP wrapper
could reuse the exact same action layer.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import numpy as np

from zotwatch.config import Settings, load_settings
from zotwatch.core.models import RankedWork, ZoteroItem
from zotwatch.infrastructure.embedding import (
    CachingEmbeddingProvider,
    EmbeddingCache,
    FaissIndex,
    create_embedding_provider,
)
from zotwatch.infrastructure.storage import ArchiveStorage, ProfileStorage
from zotwatch.llm import PaperSummarizer, create_llm_client
from zotwatch.output.push import ZoteroPusher
from zotwatch.pipeline import WatchConfig, WatchPipeline, WatchResult

logger = logging.getLogger(__name__)


class ActionError(Exception):
    """User-facing error raised by an action (message is shown in chat)."""


@dataclass
class SearchHit:
    """A search result: a RankedWork plus where it came from."""

    work: RankedWork
    origin: str  # "library" or "candidate"


class Actions:
    """Lazy-loaded wrappers over ZotWatch components.

    Heavy resources (FAISS index, embedding provider, LLM client) are created on
    first use, so cheap commands like ``today`` stay fast.
    """

    def __init__(self, base_dir: Path, settings: Settings | None = None):
        self.base_dir = Path(base_dir)
        self.settings = settings or load_settings(self.base_dir)

        self._data = self.base_dir / "data"
        # Lazy singletons.
        self._llm = None
        self._embedding_cache: EmbeddingCache | None = None
        self._vectorizer: CachingEmbeddingProvider | None = None
        self._faiss: FaissIndex | None = None
        self._library_items: list[ZoteroItem] | None = None

    # ----- lazy resources -------------------------------------------------

    def _get_llm(self):
        if not self.settings.llm.enabled:
            raise ActionError("AI 功能未启用（config 中 llm.enabled=false）。")
        if self._llm is None:
            self._llm = create_llm_client(self.settings.llm)
        return self._llm

    def _get_embedding_cache(self) -> EmbeddingCache:
        if self._embedding_cache is None:
            self._embedding_cache = EmbeddingCache(self._data / "embeddings.sqlite")
        return self._embedding_cache

    def _get_vectorizer(self) -> CachingEmbeddingProvider:
        if self._vectorizer is None:
            self._vectorizer = CachingEmbeddingProvider(
                provider=create_embedding_provider(self.settings.embedding),
                cache=self._get_embedding_cache(),
                source_type="candidate",
                ttl_days=self.settings.embedding.candidate_ttl_days,
            )
        return self._vectorizer

    def _get_faiss(self) -> FaissIndex:
        if self._faiss is None:
            path = self._data / "faiss.index"
            if not path.exists():
                raise ActionError("尚未构建 profile（缺少 faiss.index）。先跑一次 zotwatch profile。")
            self._faiss = FaissIndex.load(path)
        return self._faiss

    def _get_library_items(self) -> list[ZoteroItem]:
        """Library items in FAISS row order (matches ProfileBuilder's order)."""
        if self._library_items is None:
            storage = ProfileStorage(self._data / "profile.sqlite")
            storage.initialize()
            try:
                # ProfileBuilder indexes get_items_with_abstract() in order.
                self._library_items = storage.get_items_with_abstract()
            finally:
                storage.close()
        return self._library_items

    # ----- capabilities ---------------------------------------------------

    def today(self, limit: int = 8) -> list[RankedWork]:
        """Today's recommendations: the latest archived watch run."""
        archive_db = self._data / "archive.sqlite"
        if not archive_db.exists():
            raise ActionError("还没有任何推荐记录，先发“抓取”跑一次 watch。")

        with ArchiveStorage(archive_db) as archive:
            stats = archive.get_stats(days=30)
            latest = stats.get("latest")
            if not latest:
                return []
            works = archive.get_by_date(date.fromisoformat(latest))
        return works[:limit]

    def trigger(self, on_progress: Callable[[str, str], None] | None = None) -> WatchResult:
        """Run a fresh watch pipeline (slow). Returns the full result."""
        config = WatchConfig(
            top_k=self.settings.watch.top_k,
            recent_days=self.settings.watch.recent_days,
            max_preprint_ratio=self.settings.watch.max_preprint_ratio,
            require_abstract=self.settings.watch.require_abstract,
            generate_summaries=self.settings.llm.enabled,
            translate_titles=False,
        )
        pipeline = WatchPipeline(
            self.base_dir, self.settings, config, self._get_embedding_cache()
        )
        result = pipeline.run(on_progress=on_progress)

        # Persist to the archive so "今天" reflects this run.
        archive_db = self._data / "archive.sqlite"
        with ArchiveStorage(archive_db) as archive:
            archive.save_batch(result.ranked_works)
            if result.followed_works:
                archive.save_batch(result.followed_works)
            if result.flagship_works:
                archive.save_batch(result.flagship_works)
        return result

    def search(self, query: str, limit: int = 8) -> list[SearchHit]:
        """Semantic search over the library (FAISS) and recent candidates."""
        query = query.strip()
        if not query:
            raise ActionError("用法：搜 <关键词或一句话>")

        vectorizer = self._get_vectorizer()
        qvec = np.asarray(vectorizer.encode_query([query])[0], dtype=np.float32)
        qvec = qvec / (np.linalg.norm(qvec) + 1e-9)

        hits = self._search_library(qvec, limit) + self._search_candidates(qvec, query, limit)

        # De-duplicate by DOI/title, keep best score, sort.
        best: dict[str, SearchHit] = {}
        for hit in hits:
            key = (hit.work.doi or hit.work.title or hit.work.identifier).lower().strip()
            if key not in best or hit.work.similarity > best[key].work.similarity:
                best[key] = hit
        ranked = sorted(best.values(), key=lambda h: h.work.similarity, reverse=True)
        return ranked[:limit]

    def _search_library(self, qvec: np.ndarray, limit: int) -> list[SearchHit]:
        items = self._get_library_items()
        if not items:
            return []
        try:
            faiss = self._get_faiss()
        except ActionError:
            return []
        distances, indices = faiss.search(qvec.reshape(1, -1), top_k=min(limit, len(items)))
        hits: list[SearchHit] = []
        for score, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(items):
                continue
            hits.append(SearchHit(work=_item_to_work(items[idx], float(score)), origin="library"))
        return hits

    def _search_candidates(self, qvec: np.ndarray, query: str, limit: int) -> list[SearchHit]:
        """Semantic re-rank of recent archived candidates against the query."""
        archive_db = self._data / "archive.sqlite"
        if not archive_db.exists():
            return []
        with ArchiveStorage(archive_db) as archive:
            works = archive.get_all(days=120)
        works = [w for w in works if w.abstract][:400]  # cap embedding work
        if not works:
            return []

        vectorizer = self._get_vectorizer()
        vectors = vectorizer.encode([w.content_for_embedding() for w in works])
        vectors = np.asarray(vectors, dtype=np.float32)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-9
        vectors = vectors / norms
        sims = vectors @ qvec

        order = np.argsort(-sims)[:limit]
        hits: list[SearchHit] = []
        for idx in order:
            work = works[int(idx)]
            work.similarity = float(sims[int(idx)])
            hits.append(SearchHit(work=work, origin="candidate"))
        return hits

    def favorite(self, work: RankedWork) -> str:
        """Favorite a candidate paper by pushing a note to Zotero."""
        if work.label == "library" or work.source == "zotero":
            return f"《{work.title[:40]}》已在你的 Zotero 库中。"
        ZoteroPusher(self.settings).push([work])
        return f"已收藏到 Zotero（AI Suggested）：{work.title[:40]}"

    def summarize(self, work: RankedWork) -> str:
        """Generate (and cache) an AI summary for a paper."""
        llm = self._get_llm()
        storage = ProfileStorage(self._data / "profile.sqlite")
        storage.initialize()
        try:
            summarizer = PaperSummarizer(llm, storage, model=self.settings.llm.model)
            summary = summarizer.summarize(work)
        finally:
            storage.close()

        b = summary.bullets
        parts = [
            f"📄 {work.title}",
            "",
            f"❓ 问题：{b.research_question}",
            f"🔬 方法：{b.methodology}",
            f"💡 发现：{b.key_findings}",
            f"✨ 创新：{b.innovation}",
        ]
        if b.relevance_note:
            parts.append(f"🔗 相关：{b.relevance_note}")
        link = _work_link(work)
        if link:
            parts += ["", link]
        return "\n".join(parts)

    def ask(self, question: str) -> str:
        """Free-form Q&A fallback using the configured LLM."""
        llm = self._get_llm()
        prompt = (
            "你是 ZotWatch 的学术助手，请用简洁的中文回答用户的问题。"
            "如果涉及具体论文细节而你不确定，请说明。\n\n"
            f"用户：{question}\n助手："
        )
        resp = llm.complete(prompt, model=self.settings.llm.model, max_tokens=800)
        return (resp.content or "").strip() or "（没有得到回答，请重试）"


def _item_to_work(item: ZoteroItem, similarity: float) -> RankedWork:
    """Wrap a library ZoteroItem as a RankedWork for uniform handling."""
    published = datetime(item.year, 1, 1) if item.year else None
    return RankedWork(
        source="zotero",
        identifier=item.key,
        title=item.title,
        abstract=item.abstract,
        authors=item.creators,
        doi=item.doi,
        url=item.url,
        published=published,
        venue=None,
        score=similarity,
        similarity=similarity,
        label="library",
    )


def _work_link(work: RankedWork) -> str:
    if work.url:
        return work.url
    if work.doi:
        return f"https://doi.org/{work.doi}"
    return ""


__all__ = ["Actions", "ActionError", "SearchHit"]
