"""ZotWatch WeChat bot.

A lightweight two-way WeChat (Tencent iLink) bot that drives the ``zotwatch``
package interactively: query today's recommendations, trigger a fresh watch,
semantic-search the library, favorite papers back to Zotero, and get AI
summaries / Q&A — all from a WeChat chat.

The bot is intentionally thin: every capability in :mod:`zotwatch_bot.actions`
is a small wrapper over an existing ``zotwatch`` component, so there is no
duplicated pipeline logic to keep in sync.
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
