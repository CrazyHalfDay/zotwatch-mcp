# 用 Docker 部署 QQ 机器人(免 apt / 免 systemd)

装好 Docker 后,全程只有几条 `docker` 命令,在你**现有的那台 VPS** 上跑。

> QQ 机器人用 AppID + AppSecret 连官方网关,**不用扫码**。但官方网关也是腾讯的:
> 你的 VPS 出站连 `api.sgroup.qq.com`(WebSocket),海外机能不能连仍需实测
> ——通常比逆向微信宽松。

---

## 0. 在 QQ 开放平台注册机器人(一次性,在网页上做)

1. 打开 https://q.qq.com,登录,创建一个 **QQ 机器人**(不是「频道机器人」)。
2. 在「开发设置」里拿到 **AppID** 和 **AppSecret**(记下来,下面要填)。
3. 开通**群消息**和**C2C 私聊消息**相关能力;开发阶段把你自己的 QQ / 测试群加进
   「沙箱 / 测试名单」,这样机器人没正式上线也能测。
4. 等你想让别人也能用时,再走「发布上线」审核。

> 平台菜单偶尔会改,以页面向导为准:核心就是拿到 AppID/AppSecret + 允许群和私聊消息。

## 1. 装 Docker(一次性)

```bash
curl -fsSL https://get.docker.com | sh
docker version
```

## 2. 准备 ZotWatch 本体(配置 + key)

```bash
git clone https://github.com/CrazyHalfDay/AIZotWatch.git ~/AIZotWatch
cat > ~/AIZotWatch/.env <<'EOF'
ZOTERO_API_KEY=你的_zotero_key
ZOTERO_USER_ID=你的_zotero_user_id
VOYAGE_API_KEY=你的_voyage_key
DEEPSEEK_API_KEY=你的_deepseek_key
EOF
```

(建议)编辑 `~/AIZotWatch/config/config.yaml`,把 `sources.scraper.enabled` 改成
`false`,省得容器拉浏览器。

## 3. 拿机器人 + 填 QQ 凭据 + 指好挂载路径

```bash
git clone https://github.com/CrazyHalfDay/zotwatch-mcp.git ~/zotwatch-mcp
cd ~/zotwatch-mcp

cat > .env <<'EOF'
QQ_BOT_APPID=你的_appid
QQ_BOT_SECRET=你的_appsecret
EOF
```

打开 `docker-compose.yml`,把这一行左边改成你的 AIZotWatch **绝对路径**:

```yaml
    volumes:
      - /root/AIZotWatch:/zotwatch     # ← 左边换成你的路径,右边保持 /zotwatch
```

## 4. 构建镜像 + 建数据(一次性)

```bash
docker compose build
docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch profile --full
docker compose run --rm zotwatch-bot zotwatch --base-dir /zotwatch watch
```

跑完不报错,就说明 key 都对、数据通了(`~/AIZotWatch/data/` 里会有
`profile.sqlite` `faiss.index` `archive.sqlite` 等)。

## 5. 设成常驻后台

```bash
docker compose up -d
docker compose logs -f      # 看日志,出现 "QQ bot starting" 和连接成功即 OK
```

完事。现在去测:

- **群里**:把机器人拉进群,**@机器人 今天** / **@机器人 搜 soil moisture**。
- **私聊**:直接私聊机器人发 `今天`、`搜 ...`、`帮助`。
  (私聊需要在开放平台开通 C2C 能力;开发期用沙箱/测试名单。)

---

## 日常运维

```bash
docker compose logs -f                       # 实时日志
docker compose ps                            # 是否在跑
docker compose restart                       # 改配置后重启
docker compose down                          # 停掉
git pull && docker compose up -d --build     # 更新代码后重建重启
```
