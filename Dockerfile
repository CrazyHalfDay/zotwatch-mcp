# ZotWatch WeChat bot — container image.
#
# Uses Astral's combined python+uv image so the build is just "git + uv sync".
# The bot reuses an existing ZotWatch project mounted at /zotwatch (see
# docker-compose.yml), so no project data is baked into the image.

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# git is needed to install the zotwatch package from its git URL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN uv sync --no-dev

# `uv run <cmd>` so both the bot and one-off zotwatch commands work:
#   docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch profile --full
ENTRYPOINT ["uv", "run"]
CMD ["zotwatch-bot"]
