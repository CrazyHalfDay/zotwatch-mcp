"""Bot configuration, loaded from environment variables.

The bot reuses the ZotWatch project on disk (its ``config/config.yaml``, the
``data/*.sqlite`` artifacts and ``data/faiss.index``). The only bot-specific
settings are where that project lives and where to cache the iLink login token.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _default_base_dir() -> Path:
    """Locate the ZotWatch project root (the dir containing config/config.yaml)."""
    env = os.environ.get("ZOTWATCH_DIR")
    if env:
        return Path(env).expanduser().resolve()

    cwd = Path.cwd()
    if (cwd / "config" / "config.yaml").exists():
        return cwd
    for parent in cwd.parents:
        if (parent / "config" / "config.yaml").exists():
            return parent
    return cwd


@dataclass
class BotConfig:
    """Runtime configuration for the WeChat bot."""

    # ZotWatch project root (holds config/config.yaml and data/).
    base_dir: Path = field(default_factory=_default_base_dir)

    # Where to persist the iLink bot token between restarts so we only scan the
    # QR code once. Defaults to ~/.zotwatch_bot/ilink_token.json.
    token_file: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "ILINK_TOKEN_FILE",
                str(Path.home() / ".zotwatch_bot" / "ilink_token.json"),
            )
        ).expanduser()
    )

    # Optional whitelist of WeChat user ids allowed to use the bot. Empty means
    # everyone who can message the linked account. Comma-separated env var.
    allowed_users: frozenset[str] = field(default_factory=frozenset)

    # Max papers shown per list (today / search). Indexable for 收藏/总结.
    list_limit: int = 8

    @classmethod
    def from_env(cls) -> "BotConfig":
        """Build configuration from environment variables."""
        allowed_raw = os.environ.get("ILINK_ALLOWED_USERS", "")
        allowed = frozenset(u.strip() for u in allowed_raw.split(",") if u.strip())

        list_limit = int(os.environ.get("ZOTWATCH_BOT_LIST_LIMIT", "8"))

        return cls(
            base_dir=_default_base_dir(),
            allowed_users=allowed,
            list_limit=list_limit,
        )

    def is_allowed(self, user_id: str) -> bool:
        """Whether a given WeChat user id may use the bot."""
        if not self.allowed_users:
            return True
        return user_id in self.allowed_users


__all__ = ["BotConfig"]
