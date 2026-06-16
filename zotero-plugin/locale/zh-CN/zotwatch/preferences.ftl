# ZotWatch 设置 — 简体中文
# 绑定说明:XUL <label>/<description> 用 .value;<button>/<checkbox>/<menuitem>
# 用 .label;<html:h2> 用纯文本;<html:input> 占位符用 .placeholder。
# 这是初版,个别元素的绑定属性可能在 Zotero 实测时需微调。

# 区标题(html:h2,纯文本)
zw-sec-embedding = ① 向量服务(Embedding)
zw-sec-llm = ② 大模型(摘要 / 问答)
zw-sec-journals = ③ 关注期刊
zw-sec-fetch = ④ 抓取
zw-sec-ranking = ⑤ 排序与打分
zw-sec-summary = ⑥ 摘要与翻译
zw-sec-ui = ⑦ 界面与行为
zw-sec-maintenance = ⑧ 库画像 / 维护

# ① 向量服务
zw-embedding-provider =
    .value = 服务商
zw-embedding-model =
    .value = 模型
zw-voyage-key =
    .value = Voyage API Key
zw-dashscope-key =
    .value = DashScope API Key

# ② 大模型
zw-llm-provider =
    .value = 服务商
zw-llm-model =
    .value = 模型
zw-llm-key =
    .value = LLM API Key
zw-no-zotero-key =
    .value = ℹ Zotero 库无需 API Key —— 插件直接读取本地库

# ③ 关注期刊
zw-journal-search =
    .placeholder = 搜索期刊名 / ISSN(Crossref)
zw-journal-followed =
    .value = 已关注

# ④ 抓取
zw-recent-days =
    .value = 时间窗(天)
zw-sources =
    .value = 来源
zw-source-journals =
    .label = 关注期刊
zw-source-arxiv =
    .label = arXiv
zw-require-abstract =
    .label = 仅保留有摘要的文章
zw-daily-cache =
    .label = 每日缓存复用

# ⑤ 排序与打分
zw-sim-method =
    .value = 相似度算法
zw-sim-knn =
    .label = kNN 均值
zw-sim-centroid =
    .label = 库质心
zw-weights =
    .value = 权重
zw-halflife =
    .value = 时效半衰期(天)
zw-threshold-mode =
    .value = 阈值模式
zw-threshold-fixed =
    .label = 固定
zw-threshold-dynamic =
    .label = 动态
zw-journal-whitelist =
    .value = 期刊 IF / 白名单

# ⑥ 摘要与翻译
zw-auto-summary =
    .value = 自动摘要
zw-summary-off =
    .label = 关闭
zw-summary-ondemand =
    .label = 按需
zw-summary-all =
    .label = 全部
zw-summary-lang =
    .value = 摘要语言
zw-translate-provider =
    .value = 翻译服务
zw-translate-target =
    .value = 目标语言

# ⑦ 界面与行为
zw-list-limit =
    .value = 每页条数
zw-ui-mode =
    .value = UI 形态
zw-ui-badge =
    .label = 叠加相关度徽标
zw-ui-tab =
    .label = 独立"为你推荐"标签页
zw-ui-both =
    .label = 两者都要
zw-auto-refresh =
    .label = 启动时自动刷新
zw-ui-locale =
    .value = 显示语言

# ⑧ 维护
zw-profile-incremental =
    .label = 立即增量更新
zw-profile-rebuild =
    .label = 全量重建画像
zw-clear-cache =
    .label = 清空缓存

# 通用按钮
zw-test =
    .label = 测试连接
zw-search =
    .label = 搜索
zw-import-csv =
    .label = 导入 CSV…
