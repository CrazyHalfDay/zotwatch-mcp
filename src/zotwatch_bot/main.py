"""Entry point: start the QQ bot.

The QQ official-bot SDK (botpy) owns the event loop, websocket connection and
reconnection. We just wire its message handlers to the ZotWatch router (see
:mod:`zotwatch_bot.qqbot`) and call ``run``.
"""

from __future__ import annotations

import logging

from dotenv import load_dotenv

from . import qqbot
from .actions import Actions
from .config import BotConfig
from .router import Router

logger = logging.getLogger(__name__)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def serve(config: BotConfig | None = None) -> None:
    """Build the bot and run it until interrupted."""
    config = config or BotConfig.from_env()

    if not config.appid or not config.secret:
        raise SystemExit(
            "缺少 QQ 机器人凭据:请设置 QQ_BOT_APPID 和 QQ_BOT_SECRET"
            "(在 q.qq.com 开放平台创建机器人后获取)。"
        )

    # Load ZotWatch credentials (Zotero / embedding / LLM keys) from the project's
    # .env before building settings — env-var expansion reads os.environ.
    load_dotenv(config.base_dir / ".env")

    logger.info("ZotWatch QQ bot starting (project: %s)", config.base_dir)
    actions = Actions(config.base_dir)
    router = Router(actions, list_limit=config.list_limit)

    qqbot.run(config, router)


def main() -> None:
    """Console-script entry point."""
    _setup_logging()
    # Load the bot's own .env (QQ_BOT_APPID/SECRET, ZOTWATCH_DIR …) from the
    # working dir before reading those variables.
    load_dotenv()
    serve()


if __name__ == "__main__":
    main()
