# zotwatch-bot

A lightweight **WeChat (Tencent iLink) bot** that drives
[ZotWatch](https://github.com/CrazyHalfDay/AIZotWatch) interactively — beyond the
daily push, you can chat with the bot to query, search, trigger, favorite and
summarize papers.

It speaks Tencent's iLink "ClawBot" protocol directly (plain HTTP/JSON +
Bearer token + long-poll), so there is **no OpenClaw gateway, no Node runtime,
and no 4 GB always-on agent** — just a small Python process next to your
ZotWatch install.

```
WeChat ClawBot  <->  zotwatch-bot (iLink long-poll + router)  <->  zotwatch
```

## Commands

Chat these to the linked WeChat account:

| 指令 | 说明 |
| --- | --- |
| `今天` / `today` | 最新一轮 watch 的推荐列表 |
| `抓取` / `trigger` | 立即跑一次 watch（较慢，完成后推送结果） |
| `搜 <关键词>` | 在 Zotero 库 + 近期候选里做语义检索 |
| `总结 <序号>` / `<序号>` | 对列表里某篇生成 AI 摘要 |
| `收藏 <序号>` | 把某篇存回 Zotero 的 `AI Suggested` 合集 |
| `帮助` / `help` | 指令菜单 |
| 其他任意提问 | 交给配置的 LLM 直接回答 |

序号来自最近一次 `今天` 或 `搜` 给出的带编号列表（按用户分别记忆）。

## How it works

Every capability is a thin wrapper over an existing ZotWatch component — there
is no duplicated pipeline logic:

- `今天` reads `ArchiveStorage` (the latest archived run).
- `抓取` runs `WatchPipeline` and saves the result to the archive.
- `搜` embeds the query and searches the library `FaissIndex` plus a semantic
  re-rank of recent archived candidates (reusing the embedding cache).
- `收藏` pushes a note via `ZoteroPusher`.
- `总结` uses `PaperSummarizer` (cached in `profile.sqlite`).
- Free-form questions call the configured LLM client.

The action layer (`actions.py`) is deliberately WeChat-agnostic, so a future MCP
wrapper could reuse it unchanged.

## Setup

The bot runs **alongside an existing ZotWatch install** and reuses its
`config/config.yaml`, `data/*.sqlite`, `data/faiss.index` and `.env`
credentials. Build the profile first if you haven't:

```bash
cd /path/to/AIZotWatch
uv run zotwatch profile --full   # one-time, builds data/ artifacts
```

Then install and run the bot:

```bash
cd zotwatch-bot
uv sync                          # installs zotwatch (git) + bot deps
cp examples/.env.example .env    # set ZOTWATCH_DIR to your AIZotWatch path
uv run zotwatch-bot
```

On first start the bot prints a **login QR code** in the terminal. Scan it with
the WeChat account that should host the bot and confirm on your phone. The
resulting token is cached (default `~/.zotwatch_bot/ilink_token.json`) so
restarts don't re-prompt.

### Configuration

All bot settings are environment variables (see `examples/.env.example`):

- `ZOTWATCH_DIR` — path to the ZotWatch project (holds `config/config.yaml`).
- `ILINK_TOKEN_FILE` — where to cache the login token.
- `ILINK_ALLOWED_USERS` — optional comma-separated WeChat-id whitelist.
- `ZOTWATCH_BOT_LIST_LIMIT` — papers per list (default 8).

ZotWatch's own credentials (`ZOTERO_API_KEY`, embedding/LLM keys, …) are read
from the ZotWatch project's `.env`.

## Deployment (Phase 2)

The footprint is just Python + the iLink connection, so a tiny VPS (1–2 GB RAM)
is enough. The VPS needs the ZotWatch `data/` artifacts and API keys.

A bootstrap script and a systemd unit live in [`deploy/`](deploy/):

```bash
cd zotwatch-mcp
bash deploy/setup.sh          # uv sync, prepare .env, optionally install systemd
uv run zotwatch-bot           # run once to scan the login QR (caches the token)
sudo systemctl enable --now zotwatch-bot
journalctl -u zotwatch-bot -f
```

### Keep it light: disable the scraper on the VPS

ZotWatch's abstract-enrichment scraper uses `camoufox` (a headless Firefox). The
bot never imports it at startup — it is only launched if the scraper runs during
`抓取`. To keep the VPS small, set this in the ZotWatch `config/config.yaml`:

```yaml
sources:
  scraper:
    enabled: false
```

Then the camoufox browser binary is never needed and `抓取` simply skips
enrichment.

### Data

The bot reuses an existing ZotWatch install's artifacts. The cheapest path is to
build the profile on your working machine and copy `data/` over once
(`rsync -av ~/AIZotWatch/data/ vps:<ZOTWATCH_DIR>/data/`); `抓取` then only does
incremental updates and reuses the embedding cache. Alternatively build it on the
VPS with `uv run zotwatch profile --full`.

### Token expiry / re-login

The login token is cached and reused. If iLink rejects it later (HTTP 401/403),
the bot logs the failure and re-runs the QR login automatically. On a headless
service the QR is printed to the logs (`journalctl`), along with the raw payload;
the simplest recovery is to run `uv run zotwatch-bot` on a terminal once to
re-scan.

> **风控 caveat:** the relevant link is *outbound* (VPS → `ilinkai.weixin.qq.com`
> long-poll). WeChat is globally reachable, but a cross-border IP (phone in CN,
> **bot overseas**) may be rejected by WeChat risk control. If polling keeps
> failing, the bot logs an explicit error pointing here after a few retries.
> This is only verifiable once deployed; if it fails, host the bot on a
> CN-located machine.

## Status

Phase 1 (this repo). The iLink field names follow the community protocol
implementations referenced below and should be verified against a live link
during Phase 2.

### References

- Protocol doc: <https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md>
- Community lib (no OpenClaw): <https://github.com/SiverKing/weixin-ClawBot-API>
