"""ZotWatch QQ bot.

A lightweight two-way QQ bot (built on the official ``botpy`` SDK) that drives
the ``zotwatch`` package interactively: query today's recommendations, trigger a
fresh watch, semantic-search the library, favorite papers back to Zotero, and
get AI summaries / Q&A — all from a QQ group @mention or private chat.

The bot is intentionally thin: every capability in :mod:`zotwatch_bot.actions`
is a small wrapper over an existing ``zotwatch`` component, so there is no
duplicated pipeline logic to keep in sync. The transport layer
(:mod:`zotwatch_bot.qqbot`) is decoupled from the business layer; a legacy
WeChat/iLink transport (:mod:`zotwatch_bot.ilink`) is kept as an alternative.
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
