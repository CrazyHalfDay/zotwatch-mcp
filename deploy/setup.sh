#!/usr/bin/env bash
# Bootstrap the ZotWatch WeChat bot on a fresh VPS.
#
# Idempotent and non-destructive: it installs dependencies, prepares the bot's
# .env, and (optionally) installs the systemd service. It never overwrites an
# existing .env or data/ directory.
#
# Usage:  cd zotwatch-mcp && bash deploy/setup.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }

# --- 1. Toolchain checks -----------------------------------------------------
if ! command -v uv >/dev/null 2>&1; then
  warn "uv not found. Install it with:"
  echo "    curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi
UV_BIN="$(command -v uv)"
say "uv: $UV_BIN"

# zotwatch needs Python >= 3.13; uv will fetch it if missing.
say "Syncing dependencies (this installs zotwatch from git)..."
uv sync

# --- 2. Bot .env -------------------------------------------------------------
if [[ ! -f .env ]]; then
  cp examples/.env.example .env
  warn "Created .env from the example. Edit it now and set at least:"
  echo "    ZOTWATCH_DIR=/absolute/path/to/AIZotWatch"
else
  say ".env already exists, leaving it untouched."
fi

# --- 3. Reminders ------------------------------------------------------------
cat <<'EOF'

Next, on the ZotWatch project pointed to by ZOTWATCH_DIR:
  • Put your data artifacts in <ZOTWATCH_DIR>/data/
      profile.sqlite  faiss.index  embeddings.sqlite  archive.sqlite
    (copy from your working machine, e.g.
       rsync -av ~/AIZotWatch/data/ vps:<ZOTWATCH_DIR>/data/ )
    or build them once with:  uv run zotwatch profile --full
  • Fill <ZOTWATCH_DIR>/.env with ZOTERO / embedding / LLM API keys.
  • In <ZOTWATCH_DIR>/config/config.yaml set:
       sources:
         scraper:
           enabled: false        # avoids pulling up the camoufox browser on the VPS

EOF

# --- 4. First login ----------------------------------------------------------
say "Run the bot once on this terminal to scan the login QR:"
echo "    uv run zotwatch-bot"
echo "  (the token is cached to ~/.zotwatch_bot/ilink_token.json afterwards)"

# --- 5. Optional systemd install --------------------------------------------
read -r -p $'\nInstall the systemd service now? [y/N] ' ans
if [[ "${ans,,}" == "y" ]]; then
  if ! command -v systemctl >/dev/null 2>&1; then
    warn "systemctl not available; skipping."
    exit 0
  fi
  unit="/etc/systemd/system/zotwatch-bot.service"
  sed -e "s#__USER__#$(id -un)#" \
      -e "s#__DIR__#${REPO_DIR}#" \
      -e "s#__UV__#${UV_BIN}#" \
      deploy/zotwatch-bot.service | sudo tee "$unit" >/dev/null
  sudo systemctl daemon-reload
  say "Installed $unit. Enable it AFTER you've scanned the QR once:"
  echo "    sudo systemctl enable --now zotwatch-bot"
  echo "    journalctl -u zotwatch-bot -f"
fi

say "Done."
