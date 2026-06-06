"""Plain-text rendering of results for WeChat messages.

iLink text items are plain text, so we keep formatting simple and compact:
numbered lists that map 1:1 onto the index used by 收藏/总结 commands.
"""

from __future__ import annotations

from zotwatch.core.models import RankedWork

from .actions import SearchHit


def _link(work: RankedWork) -> str:
    if work.url:
        return work.url
    if work.doi:
        return f"https://doi.org/{work.doi}"
    return ""


def _meta(work: RankedWork) -> str:
    bits: list[str] = []
    if work.label not in ("library", "ignore", ""):
        bits.append(work.label)
    if work.venue:
        bits.append(work.venue)
    if work.score:
        bits.append(f"{work.score:.2f}")
    return " · ".join(bits)


def render_work_list(works: list[RankedWork], *, header: str) -> str:
    """Render a numbered list of works for chat display."""
    if not works:
        return f"{header}\n（暂无结果）"

    lines = [header, ""]
    for i, work in enumerate(works, start=1):
        title = work.translated_title or work.title
        lines.append(f"{i}. {title}")
        meta = _meta(work)
        if meta:
            lines.append(f"   {meta}")
        link = _link(work)
        if link:
            lines.append(f"   {link}")
    lines += ["", "回复「总结 序号」看 AI 摘要，「收藏 序号」存入 Zotero。"]
    return "\n".join(lines)


def render_search_hits(hits: list[SearchHit], *, query: str) -> str:
    """Render search hits, tagging library vs candidate origin."""
    if not hits:
        return f"没搜到和「{query}」相关的内容。"

    lines = [f"🔎 「{query}」相关 {len(hits)} 条：", ""]
    for i, hit in enumerate(hits, start=1):
        tag = "📚库" if hit.origin == "library" else "🆕新"
        title = hit.work.translated_title or hit.work.title
        lines.append(f"{i}. [{tag}] {title}")
        link = _link(hit.work)
        sim = hit.work.similarity
        meta_bits = [f"相似度 {sim:.2f}"]
        if hit.work.venue:
            meta_bits.append(hit.work.venue)
        lines.append(f"   {' · '.join(meta_bits)}")
        if link:
            lines.append(f"   {link}")
    lines += ["", "回复「总结 序号」看 AI 摘要，「收藏 序号」存入 Zotero。"]
    return "\n".join(lines)


def render_watch_result(result, *, top: int = 5) -> str:
    """Render a fresh watch run summary."""
    ranked = result.ranked_works or []
    flagship = result.flagship_works or []
    followed = result.followed_works or []
    total = len(ranked) + len(flagship) + len(followed)
    if total == 0:
        return "本次抓取没有新的推荐。"

    lines = [f"✅ 抓取完成，共 {total} 篇（推荐 {len(ranked)}"]
    if flagship:
        lines[0] += f"，顶刊 {len(flagship)}"
    if followed:
        lines[0] += f"，关注作者 {len(followed)}"
    lines[0] += "）。"
    lines.append("")

    for i, work in enumerate(ranked[:top], start=1):
        title = work.translated_title or work.title
        lines.append(f"{i}. {title}")
        meta = _meta(work)
        if meta:
            lines.append(f"   {meta}")
    lines += ["", "回复「今天」查看完整列表。"]
    return "\n".join(lines)


__all__ = [
    "render_work_list",
    "render_search_hits",
    "render_watch_result",
]
