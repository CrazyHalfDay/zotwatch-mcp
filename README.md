# zotwatch-bot

一个轻量的**微信(腾讯 iLink）机器人**,让你能交互式地驱动
[ZotWatch](https://github.com/CrazyHalfDay/AIZotWatch):在每日推送之外,直接在微信里
聊天来查询、检索、触发抓取、收藏和总结论文。

它直接讲腾讯 iLink "ClawBot" 协议(纯 HTTP/JSON + Bearer token + 长轮询),所以
**不需要 OpenClaw 网关、不需要 Node 运行时、也不需要常驻的 4 GB 智能体** —— 只是
一个跑在 ZotWatch 旁边的小 Python 进程。

```
微信 ClawBot  <->  zotwatch-bot(iLink 长轮询 + 指令路由)  <->  zotwatch
```

## 指令

对绑定的微信账号发送以下消息:

| 指令 | 说明 |
| --- | --- |
| `今天` / `today` | 最新一轮 watch 的推荐列表 |
| `抓取` / `trigger` | 立即跑一次 watch(较慢,完成后推送结果) |
| `搜 <关键词>` | 在 Zotero 库 + 近期候选里做语义检索 |
| `总结 <序号>` / `<序号>` | 对列表里某篇生成 AI 摘要 |
| `收藏 <序号>` | 把某篇存回 Zotero 的 `AI Suggested` 合集 |
| `帮助` / `help` | 指令菜单 |
| 其他任意提问 | 交给配置的 LLM 直接回答 |

序号来自最近一次 `今天` 或 `搜` 给出的带编号列表(每个用户分别记忆)。

## 工作原理

每个能力都是对现有 ZotWatch 组件的**薄封装**,没有重复的流水线逻辑:

- `今天` —— 读 `ArchiveStorage`(归档里最新的一轮)。
- `抓取` —— 跑 `WatchPipeline`,并把结果写回归档。
- `搜` —— 把查询向量化,检索库内 `FaissIndex`,再对近期归档候选做一次语义重排
  (复用 embedding 缓存)。
- `收藏` —— 通过 `ZoteroPusher` 推送一条笔记。
- `总结` —— 用 `PaperSummarizer`(结果缓存在 `profile.sqlite`)。
- 自由提问 —— 调用配置好的 LLM 客户端。

动作层(`actions.py`)刻意与微信解耦,将来要做 MCP 封装可以原样复用。

## 安装

机器人**与一套已有的 ZotWatch 一起运行**,复用它的 `config/config.yaml`、
`data/*.sqlite`、`data/faiss.index` 以及 `.env` 凭据。如果还没建过 profile,先建:

```bash
cd /path/to/AIZotWatch
uv run zotwatch profile --full   # 一次性,生成 data/ 下的产物
```

然后安装并运行机器人:

```bash
cd zotwatch-bot
uv sync                          # 安装 zotwatch(git)+ 机器人依赖
cp examples/.env.example .env    # 把 ZOTWATCH_DIR 设成你的 AIZotWatch 路径
uv run zotwatch-bot
```

首次启动时,机器人会在终端打印一个**登录二维码**。用要托管机器人的微信账号扫码,
并在手机上确认。拿到的 token 会被缓存(默认 `~/.zotwatch_bot/ilink_token.json`),
之后重启不再需要扫码。

### 配置

机器人自身的设置都是环境变量(见 `examples/.env.example`):

- `ZOTWATCH_DIR` —— ZotWatch 项目路径(即包含 `config/config.yaml` 的目录)。
- `ILINK_TOKEN_FILE` —— 登录 token 的缓存位置。
- `ILINK_ALLOWED_USERS` —— 可选,逗号分隔的微信 id 白名单。
- `ZOTWATCH_BOT_LIST_LIMIT` —— 每个列表显示几篇(默认 8)。

> ⚠️ 机器人会从**当前工作目录**加载自己的 `.env`(即 `uv run zotwatch-bot` 所在
> 目录,或 systemd 里的 `WorkingDirectory`)。所以 `.env` 必须放在 `zotwatch-bot`
> 目录下才会生效。

ZotWatch 自己的凭据(`ZOTERO_API_KEY`、embedding / LLM 的 key 等)则从 ZotWatch
项目自己的 `.env` 读取,通常不必在这里重复填写。

## 部署(Phase 2)

整体只需要 Python + 一条 iLink 连接,所以一台小 VPS(1–2 GB 内存)就够了。VPS 上
需要 ZotWatch 的 `data/` 产物和各项 API key。

**最省事的方式是用 Docker**(免装环境、免 systemd):见
[`deploy/docker.md`](deploy/docker.md) —— 装好 Docker 后,以后就是几条
`docker compose` 命令。

如果你更习惯直接在 VPS 上裸跑,`deploy/` 里也提供了引导脚本和 systemd 单元文件:

```bash
cd zotwatch-mcp
bash deploy/setup.sh          # uv sync、准备 .env、可选安装 systemd 服务
uv run zotwatch-bot           # 先前台跑一次扫码登录(缓存 token)
sudo systemctl enable --now zotwatch-bot
journalctl -u zotwatch-bot -f
```

> 在启用 systemd 服务**之前**,务必先用 `uv run zotwatch-bot` 在终端扫一次码,把
> token 缓存好。无头服务只能把二维码打到日志里,不便扫描。

### 保持轻量:在 VPS 上关掉 scraper

ZotWatch 的摘要补全 scraper 用到 `camoufox`(一个无头 Firefox)。机器人启动时**不会**
导入它 —— 只有 `抓取` 过程中 scraper 真正运行时才会拉起。为了让 VPS 足够小,在
ZotWatch 的 `config/config.yaml` 里设:

```yaml
sources:
  scraper:
    enabled: false
```

这样 camoufox 浏览器内核永远不会被需要,`抓取` 会直接跳过摘要补全。

### 数据

机器人复用一套已有 ZotWatch 的产物。最省的做法是在你自己的机器上建好 profile,把
`data/` 整体拷过去一次:

```bash
rsync -av ~/AIZotWatch/data/ vps:<ZOTWATCH_DIR>/data/
```

之后 `抓取` 只做增量更新并复用 embedding 缓存(省 Voyage 费用和时间)。也可以直接在
VPS 上用 `uv run zotwatch profile --full` 现建。

### Token 过期 / 重新登录

登录 token 会被缓存复用。如果之后 iLink 拒绝了它(HTTP 401/403),机器人会记录失败
并**自动重跑扫码登录**。无头服务下二维码会打到日志(`journalctl`),同时也会打印原始
二维码内容;最简单的恢复方式是再到终端 `uv run zotwatch-bot` 扫一次。

> **风控提醒:** 关键连接是*出站*的(VPS → `ilinkai.weixin.qq.com` 长轮询)。微信全球
> 可达,但跨境 IP(手机在国内、**机器人在海外**)有可能被微信风控拒绝。如果轮询持续
> 失败,机器人会在重试几次后打一条明确的 ERROR 日志指向这里。这一点只有真正部署后才
> 能验证;若失败,就把机器人放到国内的机器上。

## 状态

Phase 1(本仓库)。iLink 的字段名沿用下方社区协议实现,需在 Phase 2 接真实链接时
核对一遍。

### 参考

- 协议文档:<https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md>
- 社区实现(不依赖 OpenClaw):<https://github.com/SiverKing/weixin-ClawBot-API>
