"""Command parsing and dispatch, with per-chat "last shown list" state.

Maps WeChat text to :class:`zotwatch_bot.actions.Actions` calls. Slow commands
(``抓取``) return an immediate acknowledgement plus a ``followup`` callable that
the main loop runs off the polling thread and whose result is sent as a second
message.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from zotwatch.core.models import RankedWork

from .actions import Actions, ActionError
from .render import render_search_hits, render_watch_result, render_work_list

logger = logging.getLogger(__name__)

HELP_TEXT = (
    "📚 ZotWatch 助手指令：\n"
    "• 今天 — 查看最新一轮推荐\n"
    "• 抓取 — 立即跑一次 watch（较慢）\n"
    "• 搜 <关键词> — 在库内和近期候选里语义检索\n"
    "• 总结 <序号> — 对列表中某篇出 AI 摘要\n"
    "• 收藏 <序号> — 把某篇存回 Zotero\n"
    "• 其他任意提问 — AI 直接回答\n"
    "（先用「今天」或「搜」拿到带序号的列表，再用序号收藏/总结）"
)

# Command keyword sets (exact-match, no argument).
_HELP = {"help", "帮助", "菜单", "?", "？", "/help"}
_TODAY = {"今天", "今日", "today", "/today"}
_TRIGGER = {"抓取", "更新", "刷新", "trigger", "fetch", "/fetch", "watch"}

# Prefix commands that take an argument.
_SEARCH_PREFIXES = ("搜索", "搜", "search", "/s", "s ")
_FAVORITE_PREFIXES = ("收藏", "收", "favorite", "fav", "star")
_SUMMARIZE_PREFIXES = ("总结", "摘要", "summary", "summarize")


@dataclass
class Reply:
    """A response to send. ``followup`` (if set) runs after ``text`` is sent."""

    text: str
    followup: Callable[[], str] | None = None


class Router:
    """Stateful command router (one instance per bot process)."""

    def __init__(self, actions: Actions, list_limit: int = 8):
        self.actions = actions
        self.list_limit = list_limit
        # Per-user last shown list, for index-based 收藏/总结.
        self._last_list: dict[str, list[RankedWork]] = {}

    def handle(self, user_id: str, text: str) -> Reply:
        """Parse and dispatch a message, never raising to the caller."""
        try:
            return self._dispatch(user_id, text.strip())
        except ActionError as exc:
            return Reply(str(exc))
        except Exception as exc:  # noqa: BLE001 - surface a friendly error
            logger.exception("Command failed: %s", text)
            return Reply(f"出错了：{exc}")

    # ----- dispatch -------------------------------------------------------

    def _dispatch(self, user_id: str, text: str) -> Reply:
        lowered = text.lower()

        if lowered in _HELP or not text:
            return Reply(HELP_TEXT)

        if lowered in _TODAY:
            return self._cmd_today(user_id)

        if lowered in _TRIGGER:
            return self._cmd_trigger(user_id)

        arg = _match_prefix(text, _SEARCH_PREFIXES)
        if arg is not None:
            return self._cmd_search(user_id, arg)

        # Index commands only fire when the argument is a number, so natural
        # phrases like "总结一下我的研究方向" still fall through to Q&A.
        idx = _match_index(text, _SUMMARIZE_PREFIXES)
        if idx is not None:
            return self._cmd_summarize(user_id, idx)

        idx = _match_index(text, _FAVORITE_PREFIXES)
        if idx is not None:
            return self._cmd_favorite(user_id, idx)

        # Bare integer -> summarize that index.
        if text.isdigit():
            return self._cmd_summarize(user_id, text)

        # Anything else: LLM Q&A.
        return Reply(self.actions.ask(text))

    # ----- commands -------------------------------------------------------

    def _cmd_today(self, user_id: str) -> Reply:
        works = self.actions.today(limit=self.list_limit)
        self._last_list[user_id] = works
        return Reply(render_work_list(works, header=f"📅 今日推荐（{len(works)} 篇）"))

    def _cmd_trigger(self, user_id: str) -> Reply:
        def run() -> str:
            result = self.actions.trigger()
            # Refresh the user's indexable list with the fresh recommendations.
            self._last_list[user_id] = (result.ranked_works or [])[: self.list_limit]
            return render_watch_result(result)

        return Reply("⏳ 正在抓取最新文献，可能要几分钟，完成后推送结果…", followup=run)

    def _cmd_search(self, user_id: str, query: str) -> Reply:
        hits = self.actions.search(query, limit=self.list_limit)
        self._last_list[user_id] = [h.work for h in hits]
        return Reply(render_search_hits(hits, query=query))

    def _cmd_summarize(self, user_id: str, arg: str) -> Reply:
        work = self._resolve_index(user_id, arg)
        return Reply(self.actions.summarize(work))

    def _cmd_favorite(self, user_id: str, arg: str) -> Reply:
        work = self._resolve_index(user_id, arg)
        return Reply(self.actions.favorite(work))

    # ----- helpers --------------------------------------------------------

    def _resolve_index(self, user_id: str, arg: str) -> RankedWork:
        works = self._last_list.get(user_id)
        if not works:
            raise ActionError("请先用「今天」或「搜 ...」获取带序号的列表。")
        arg = arg.strip()
        if not arg.isdigit():
            raise ActionError("用法：总结/收藏 <序号>，例如「总结 2」。")
        idx = int(arg)
        if idx < 1 or idx > len(works):
            raise ActionError(f"序号超出范围（1-{len(works)}）。")
        return works[idx - 1]


def _match_prefix(text: str, prefixes: tuple[str, ...]) -> str | None:
    """If text starts with any prefix, return the trailing argument (maybe '')."""
    lowered = text.lower()
    for prefix in prefixes:
        if lowered.startswith(prefix):
            return text[len(prefix):].strip()
    return None


def _match_index(text: str, prefixes: tuple[str, ...]) -> str | None:
    """Match "<prefix> <number>"; return the number string, else None.

    Returns the digits when the argument is numeric so non-numeric remainders
    (e.g. "总结一下…") fall through to the Q&A fallback instead of erroring.
    """
    arg = _match_prefix(text, prefixes)
    if arg is not None and arg.isdigit():
        return arg
    return None


__all__ = ["Router", "Reply", "HELP_TEXT"]
