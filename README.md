# zotwatch-bot

一个轻量的 **QQ 机器人**,让你能交互式地驱动
[ZotWatch](https://github.com/CrazyHalfDay/AIZotWatch):在每日推送之外,直接在 QQ 里
聊天来查询、检索、触发抓取、收藏和总结论文。

它基于 **QQ 开放平台官方机器人**(q.qq.com)和官方 Python SDK
[`botpy`](https://github.com/tencent-connect/botpy):用 AppID + AppSecret 连官方
WebSocket 网关,**不用扫码、不逆向协议、不碰个人号风控**。机器人本体只是一个跑在
ZotWatch 旁边的小 Python 进程。

```
QQ(群@ / 私聊)  <->  zotwatch-bot(botpy 网关 + 指令路由)  <->  zotwatch
```

## 指令

在群里 **@机器人** 或 **私聊机器人**发送:

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

传输层(`qqbot.py`)与业务层(`actions.py` / `router.py` / `render.py`)解耦:业务层
完全平台无关,所以换 IM 平台只需替换传输层。仓库里仍保留一份微信/iLink 传输
(`ilink.py`)作为备选,但 **QQ 是默认且受支持的方式**。

## 安装

机器人**与一套已有的 ZotWatch 一起运行**,复用它的 `config/config.yaml`、
`data/*.sqlite`、`data/faiss.index` 以及 `.env` 凭据。

### 1. 在 QQ 开放平台建一个机器人

去 https://q.qq.com 创建一个 **QQ 机器人**,拿到 **AppID** 和 **AppSecret**;开通群
消息 / C2C 私聊消息能力。开发阶段用「沙箱 / 测试名单」即可测试(机器人未上线也能用)。

### 2. 建好 ZotWatch 数据

如果还没建过 profile:

```bash
cd /path/to/AIZotWatch
uv run zotwatch profile --full   # 一次性,生成 data/ 下的产物
uv run zotwatch watch            # 生成"今天"能读的推荐
```

### 3. 跑机器人

```bash
cd zotwatch-bot
uv sync                          # 安装 zotwatch(git)+ qq-botpy + 其余依赖
cp examples/.env.example .env    # 填 QQ_BOT_APPID / QQ_BOT_SECRET,设 ZOTWATCH_DIR
uv run zotwatch-bot
```

启动后在群里 @机器人 或私聊它发 `帮助` 验证。

### 配置

机器人自身的设置都是环境变量(见 `examples/.env.example`):

- `QQ_BOT_APPID` / `QQ_BOT_SECRET` —— QQ 开放平台机器人凭据(必填)。
- `ZOTWATCH_DIR` —— ZotWatch 项目路径(含 `config/config.yaml`)。
- `QQ_BOT_ALLOWED_USERS` —— 可选,逗号分隔的 QQ openid 白名单。
- `ZOTWATCH_BOT_LIST_LIMIT` —— 每个列表显示几篇(默认 8)。

> ⚠️ 机器人从**当前工作目录**加载自己的 `.env`(即 `uv run zotwatch-bot` 所在目录,
> 或 Docker 里通过 `env_file` 注入)。ZotWatch 自己的凭据(`ZOTERO_API_KEY`、
> embedding / LLM 的 key)则从 `ZOTWATCH_DIR/.env` 读取。

## 部署

**最省事的方式是用 Docker**(免装环境、免 systemd):见
[`deploy/docker.md`](deploy/docker.md) —— 装好 Docker 后,以后就是几条
`docker compose` 命令。

`deploy/` 里也提供了 systemd 单元文件和引导脚本,适合直接在 VPS 上裸跑。

### 关于慢操作 / 被动回复

QQ 的回复是**被动**的(绑定用户消息的 `msg_id`,且有时间窗)。`抓取` 跑完若超过这个
窗口,结果可能推不出来——遇到这种情况直接再发 `今天` 查看即可。机器人对快指令同步
回复,对 `抓取` 先回「处理中…」再尝试推送结果。

> **风控提醒:** 机器人出站连 `api.sgroup.qq.com`(官方 WebSocket 网关)。海外 VPS
> 能否连上仍需实测;若连不上,换国内机器。

## 状态

iLink(微信)字段名沿用社区实现、需实测;QQ 路径基于官方 SDK,无需逆向。

### 参考

- QQ 机器人官方文档:<https://bot.q.qq.com/wiki/>
- 官方 Python SDK(botpy):<https://github.com/tencent-connect/botpy>
