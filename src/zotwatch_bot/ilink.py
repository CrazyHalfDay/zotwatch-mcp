"""Tencent iLink (WeChat ClawBot) long-poll client.

The WeChat "ClawBot" link is just Tencent's iLink protocol: plain HTTP/JSON over
``https://ilinkai.weixin.qq.com`` with a Bearer bot token, a long-poll
``getupdates`` endpoint and a ``sendmessage`` endpoint. No OpenClaw gateway or
Node runtime is needed — this small client speaks it directly.

Protocol reference:
- https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md
- https://github.com/SiverKing/weixin-ClawBot-API (community no-OpenClaw impl)

Auth is obtained once via a QR-code login flow (scan with the WeChat account that
should host the bot); the resulting ``bot_token`` is cached on disk so restarts
do not re-prompt.

NOTE: the exact field names below follow the community implementations and are
expected to be verified against a live link during Phase 2 deployment.
"""

from __future__ import annotations

import base64
import json
import logging
import random
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://ilinkai.weixin.qq.com"

# iLink channel/client version advertised on every request. Bump if the link
# starts rejecting the version (the protocol gates some behaviour on it).
CHANNEL_VERSION = "2.4.3"
_CLIENT_VERSION_INT = str((2 << 16) | (4 << 8) | 3)  # encodes 2.4.3

# How long the server holds a long-poll before returning empty (seconds).
LONG_POLL_TIMEOUT = 40


@dataclass
class InboundMessage:
    """A single inbound text message from a WeChat user."""

    from_user_id: str
    context_token: str
    text: str
    raw: dict


@dataclass
class _Session:
    """Persisted iLink session (cached to disk after QR login)."""

    bot_token: str
    baseurl: str = BASE_URL
    ilink_bot_id: str = ""
    ilink_user_id: str = ""

    def to_dict(self) -> dict:
        return {
            "bot_token": self.bot_token,
            "baseurl": self.baseurl,
            "ilink_bot_id": self.ilink_bot_id,
            "ilink_user_id": self.ilink_user_id,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "_Session":
        return cls(
            bot_token=data["bot_token"],
            baseurl=data.get("baseurl") or BASE_URL,
            ilink_bot_id=data.get("ilink_bot_id", ""),
            ilink_user_id=data.get("ilink_user_id", ""),
        )


def _base_info() -> dict:
    return {"channel_version": CHANNEL_VERSION}


class ILinkClient:
    """Minimal iLink client: QR login, long-poll receive, send text."""

    def __init__(self, token_file: Path):
        self.token_file = Path(token_file)
        self.session: _Session | None = None
        self._http = requests.Session()
        self._cursor: str = ""  # get_updates_buf, threaded across polls

    # ----- auth -----------------------------------------------------------

    def _headers(self) -> dict:
        uin = str(random.getrandbits(32))
        headers = {
            "Content-Type": "application/json",
            "AuthorizationType": "ilink_bot_token",
            "X-WECHAT-UIN": base64.b64encode(uin.encode()).decode(),
            "iLink-App-Id": "bot",
            "iLink-App-ClientVersion": _CLIENT_VERSION_INT,
        }
        if self.session and self.session.bot_token:
            headers["Authorization"] = f"Bearer {self.session.bot_token}"
        return headers

    def _url(self, path: str) -> str:
        base = (self.session.baseurl if self.session else BASE_URL).rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    def _post(self, path: str, body: dict, *, timeout: float) -> dict:
        resp = self._http.post(
            self._url(path), headers=self._headers(), json=body, timeout=timeout
        )
        resp.raise_for_status()
        return resp.json()

    def _get(self, path: str, *, timeout: float) -> dict:
        resp = self._http.get(self._url(path), headers=self._headers(), timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    def ensure_login(self) -> None:
        """Load a cached session, or run the QR login flow and cache it."""
        if self.session is not None:
            return
        if self.token_file.exists():
            try:
                data = json.loads(self.token_file.read_text("utf-8"))
                self.session = _Session.from_dict(data)
                logger.info("Loaded cached iLink session from %s", self.token_file)
                return
            except (json.JSONDecodeError, KeyError, OSError) as exc:
                logger.warning("Cached session unusable (%s); re-running QR login", exc)
        self._qr_login()

    def _save_session(self) -> None:
        assert self.session is not None
        self.token_file.parent.mkdir(parents=True, exist_ok=True)
        self.token_file.write_text(
            json.dumps(self.session.to_dict(), ensure_ascii=False, indent=2), "utf-8"
        )
        logger.info("Saved iLink session to %s", self.token_file)

    def _qr_login(self) -> None:
        """Fetch a login QR code, render it, and poll until confirmed."""
        logger.info("Requesting iLink login QR code...")
        result = self._post(
            "ilink/bot/get_bot_qrcode?bot_type=3",
            {"local_token_list": []},
            timeout=30,
        )
        qrcode = result.get("qrcode") or result.get("qr_code") or ""
        verify_code = result.get("verify_code", "")
        if not qrcode:
            raise RuntimeError(f"iLink did not return a QR code: {result}")

        _render_qr(qrcode)
        print(
            "\nScan the QR code above with the WeChat account that should host "
            "the bot, then confirm on your phone.\n"
        )

        deadline = time.time() + 300  # 5 minutes to scan
        while time.time() < deadline:
            status = self._get(
                f"ilink/bot/get_qrcode_status?qrcode={quote(qrcode, safe='')}"
                f"&verify_code={quote(str(verify_code), safe='')}",
                timeout=30,
            )
            token = status.get("bot_token")
            if token:
                self.session = _Session(
                    bot_token=token,
                    baseurl=status.get("baseurl") or BASE_URL,
                    ilink_bot_id=status.get("ilink_bot_id", ""),
                    ilink_user_id=status.get("ilink_user_id", ""),
                )
                self._save_session()
                logger.info("iLink login confirmed")
                return
            time.sleep(2)

        raise TimeoutError("QR login was not confirmed within 5 minutes")

    # ----- receive / send -------------------------------------------------

    def poll(self) -> list[InboundMessage]:
        """Long-poll once and return any inbound text messages.

        Returns an empty list when the poll times out with no new messages.
        The server cursor (``get_updates_buf``) is threaded automatically.
        """
        self.ensure_login()
        body = {"get_updates_buf": self._cursor, "base_info": _base_info()}
        # Allow a little slack over the server-side hold time.
        result = self._post("ilink/bot/getupdates", body, timeout=LONG_POLL_TIMEOUT + 10)

        # Advance the cursor even on empty results.
        self._cursor = result.get("get_updates_buf") or self._cursor

        messages: list[InboundMessage] = []
        for msg in result.get("msgs") or []:
            parsed = _parse_inbound(msg)
            if parsed is not None:
                messages.append(parsed)
        return messages

    def send_text(self, to_user_id: str, context_token: str, text: str) -> None:
        """Send a plain-text reply to a user within their conversation window.

        ``context_token`` must be the one from the inbound message, otherwise the
        reply is not associated with the right conversation.
        """
        self.ensure_login()
        body = {
            "msg": {
                "from_user_id": "",
                "to_user_id": to_user_id,
                "client_id": f"zotwatch-bot-{random.randint(0, 0xFFFFFFFF):08x}",
                "message_type": 2,
                "message_state": 2,
                "context_token": context_token,
                "item_list": [{"type": 1, "text_item": {"text": text}}],
            },
            "base_info": _base_info(),
        }
        self._post("ilink/bot/sendmessage", body, timeout=30)


def _parse_inbound(msg: dict) -> InboundMessage | None:
    """Extract a text message from a raw getupdates entry, or None if not text."""
    from_user_id = msg.get("from_user_id") or ""
    context_token = msg.get("context_token") or ""
    if not from_user_id or not context_token:
        return None

    # Only react to messages from real users (not the bot's own echoes).
    if "@im.bot" in from_user_id:
        return None

    text = ""
    for item in msg.get("item_list") or []:
        if item.get("type") == 1:
            text = (item.get("text_item") or {}).get("text", "")
            break

    text = (text or "").strip()
    if not text:
        return None

    return InboundMessage(
        from_user_id=from_user_id,
        context_token=context_token,
        text=text,
        raw=msg,
    )


def _render_qr(data: str) -> None:
    """Render the login QR code in the terminal (best-effort)."""
    try:
        import qrcode  # noqa: PLC0415 - optional dependency

        qr = qrcode.QRCode(border=1)
        qr.add_data(data)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
    except Exception as exc:  # noqa: BLE001 - rendering is best-effort
        logger.warning("Could not render QR (%s); open this URL/string to scan:", exc)
    print(f"\niLink QR payload: {data}")


__all__ = ["ILinkClient", "InboundMessage", "BASE_URL"]
