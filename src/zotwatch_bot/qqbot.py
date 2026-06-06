"""QQ official-bot transport (q.qq.com), built on the botpy SDK.

Replaces the legacy WeChat/iLink transport. The business layer
(:mod:`zotwatch_bot.router` / :mod:`zotwatch_bot.actions`) is transport-agnostic,
so this adapter only bridges botpy's async event handlers to the synchronous
router.

botpy is asyncio-based; the router/actions are synchronous and may block for a
long time (e.g. ``抓取`` runs the whole watch pipeline). Every router call is
therefore offloaded with :func:`asyncio.to_thread` so the websocket event loop
keeps running.

Reply model: QQ replies are *passive* — tied to the user's ``msg_id`` and only
valid within a short window, with each reply needing a distinct ``msg_seq``. We
send the immediate reply as seq 1 and any slow follow-up as seq 2; if the window
has closed the follow-up send just fails (logged), and the user can fall back to
``今天``.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

import botpy
from botpy.message import C2CMessage, GroupMessage

from .config import BotConfig
from .router import Router

logger = logging.getLogger(__name__)

# A sender sends one reply: (content, msg_seq) -> awaitable.
Sender = Callable[[str, int], Awaitable[object]]


class QQBotClient(botpy.Client):
    """Routes QQ group-@ and C2C messages through the ZotWatch router."""

    def __init__(self, router: Router, config: BotConfig, **kwargs):
        super().__init__(**kwargs)
        self.router = router
        self.config = config

    async def on_group_at_message_create(self, message: GroupMessage) -> None:
        """A user @-mentioned the bot in a group."""
        await self._dispatch(
            user_key=message.author.member_openid,
            text=message.content,
            sender=lambda content, seq: message._api.post_group_message(
                group_openid=message.group_openid,
                msg_type=0,
                msg_id=message.id,
                msg_seq=seq,
                content=content,
            ),
        )

    async def on_c2c_message_create(self, message: C2CMessage) -> None:
        """A user sent the bot a private (C2C) message."""
        await self._dispatch(
            user_key=message.author.user_openid,
            text=message.content,
            sender=lambda content, seq: message._api.post_c2c_message(
                openid=message.author.user_openid,
                msg_type=0,
                msg_id=message.id,
                msg_seq=seq,
                content=content,
            ),
        )

    async def _dispatch(self, user_key: str, text: str, sender: Sender) -> None:
        text = (text or "").strip()
        if not self.config.is_allowed(user_key):
            logger.info("Ignoring message from non-allowed user %s", user_key)
            return

        logger.info("Message from %s: %s", user_key, text)

        # Run the (blocking) router off the event loop.
        reply = await asyncio.to_thread(self.router.handle, user_key, text)

        if not await self._send(sender, reply.text, seq=1):
            return

        if reply.followup is not None:
            try:
                result = await asyncio.to_thread(reply.followup)
            except Exception as exc:  # noqa: BLE001 - report failure to the user
                logger.exception("Follow-up task failed")
                result = f"任务失败:{exc}"
            await self._send(sender, result, seq=2)

    async def _send(self, sender: Sender, content: str, *, seq: int) -> bool:
        try:
            await sender(content, seq)
            return True
        except Exception:  # noqa: BLE001 - passive window may have closed
            logger.exception(
                "Failed to send reply (seq=%d); the passive-reply window may "
                "have closed",
                seq,
            )
            return False


def run(config: BotConfig, router: Router) -> None:
    """Start the QQ bot (blocks; botpy manages the asyncio loop and reconnects)."""
    intents = botpy.Intents(public_messages=True)
    client = QQBotClient(router, config, intents=intents)
    client.run(appid=config.appid, secret=config.secret)


__all__ = ["QQBotClient", "run"]
