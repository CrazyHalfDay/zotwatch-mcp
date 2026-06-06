# 用 Docker 部署(免 apt / 免 systemd)

适合「不想在 VPS 上折腾环境」的人。装好 Docker 之后,全程只有几条 `docker` 命令。
仍在你**现有的那台 VPS** 上跑,不换平台。

> 注意:跨境风控问题不变 —— 长轮询还是从这台 VPS 出站连微信。海外机连不上的话,
> 换国内机器是唯一解,和用不用 Docker 无关。

---

## 0. 装 Docker(一次性)

```bash
curl -fsSL https://get.docker.com | sh
docker version    # 能打印版本就 OK
```

## 1. 准备 ZotWatch 本体(配置 + key)

```bash
cd ~
git clone https://github.com/CrazyHalfDay/AIZotWatch.git
```

在 `~/AIZotWatch/.env` 填入你的 key(右边换成自己的;种类要和
`~/AIZotWatch/config/config.yaml` 里的 `embedding.provider` / `llm.provider` 对上):

```bash
cat > ~/AIZotWatch/.env <<'EOF'
ZOTERO_API_KEY=你的_zotero_key
ZOTERO_USER_ID=你的_zotero_user_id
VOYAGE_API_KEY=你的_voyage_key
DEEPSEEK_API_KEY=你的_deepseek_key
EOF
```

(建议)编辑 `~/AIZotWatch/config/config.yaml`,把 `sources.scraper.enabled` 改成
`false`,省得容器去拉浏览器。

## 2. 拿机器人 + 指好挂载路径

```bash
cd ~
git clone https://github.com/CrazyHalfDay/zotwatch-mcp.git
cd ~/zotwatch-mcp
```

打开 `docker-compose.yml`,把这一行左边改成你的 AIZotWatch **绝对路径**
(`echo ~/AIZotWatch` 看到的就是):

```yaml
    volumes:
      - /root/AIZotWatch:/zotwatch     # ← 左边换成你的路径,右边保持 /zotwatch
```

## 3. 构建镜像(一次性,慢一点)

```bash
cd ~/zotwatch-mcp
docker compose build
```

## 4. 建数据(一次性)

```bash
docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch profile --full
docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch watch
```

这两条会照你的 Zotero 库算好向量、生成「今天」能读的推荐,落到
`~/AIZotWatch/data/`。跑完不报错,就说明 key 都对、数据通了。

## 5. 扫码登录(一次性)

```bash
docker compose run --rm zotwatch-bot
```

终端会打出二维码,用要当机器人的微信扫、手机确认。看到 `iLink login confirmed`
就成功,按 `Ctrl-C` 退出。token 会存到 `~/AIZotWatch/data/ilink_token.json`,
之后重启不再需要扫。

## 6. 设成常驻后台

```bash
docker compose up -d
```

完事。在微信里发 `帮助` / `今天` / `搜 soil moisture` 验证。

---

## 日常运维

```bash
docker compose logs -f                 # 看实时日志(Ctrl-C 退出不影响运行)
docker compose ps                      # 看是否在跑
docker compose restart                 # 改了配置后重启
docker compose down                    # 停掉
git pull && docker compose up -d --build   # 更新代码后重建并重启
```

更新数据(等同手动跑一次抓取,一般直接在微信发「抓取」即可):

```bash
docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch watch
```
