"""Entry point: poll iLink -> route -> reply.

A single long-poll loop. Fast commands reply synchronously; slow ones (``抓取``)
reply with an acknowledgement immediately and push the result from a worker
thread so polling never stalls.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from dotenv import load_dotenv

from .actions import Actions
from .config import BotConfig
from .ilink import ILinkClient, InboundMessage
from .router import Reply, Router

logger = logging.getLogger(__name__)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _run_followup(
    client: ILinkClient, msg: InboundMessage, reply: Reply
) -> None:
    """Run a deferred action and push its result as a second message."""
    try:
        text = reply.followup()  # type: ignore[misc]
    except Exception as exc:  # noqa: BLE001 - report failure back to the user
        logger.exception("Follow-up task failed")
        text = f"任务失败：{exc}"
    try:
        client.send_text(msg.from_user_id, msg.context_token, text)
    except Exception:  # noqa: BLE001 - nothing more we can do
        logger.exception("Failed to send follow-up result")


def serve(config: BotConfig | None = None) -> None:
    """Run the bot loop until interrupted."""
    config = config or BotConfig.from_env()

    # Load API keys etc. from the ZotWatch project's .env before building
    # settings (env-var expansion reads os.environ at load time).
    load_dotenv(config.base_dir / ".env")

    logger.info("ZotWatch bot starting (project: %s)", config.base_dir)
    actions = Actions(config.base_dir)
    router = Router(actions, list_limit=config.list_limit)
    client = ILinkClient(config.token_file)
    client.ensure_login()

    executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="zotwatch-bot")
    backoff = 1.0

    try:
        while True:
            try:
                messages = client.poll()
                backoff = 1.0  # reset after a successful poll
            except (requests.RequestException, ValueError) as exc:
                logger.warning("Poll failed (%s); retrying in %.0fs", exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
                continue

            for msg in messages:
                if not config.is_allowed(msg.from_user_id):
                    logger.info("Ignoring message from non-allowed user %s", msg.from_user_id)
                    continue

                logger.info("Message from %s: %s", msg.from_user_id, msg.text)
                reply = router.handle(msg.from_user_id, msg.text)

                try:
                    client.send_text(msg.from_user_id, msg.context_token, reply.text)
                except Exception:  # noqa: BLE001 - log and keep serving
                    logger.exception("Failed to send reply")
                    continue

                if reply.followup is not None:
                    executor.submit(_run_followup, client, msg, reply)
    except KeyboardInterrupt:
        logger.info("Shutting down (keyboard interrupt)")
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def main() -> None:
    """Console-script entry point."""
    _setup_logging()
    serve()


if __name__ == "__main__":
    main()
