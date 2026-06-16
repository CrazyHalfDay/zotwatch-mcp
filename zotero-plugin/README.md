# ZotWatch (Zotero 插件版)

把 [ZotWatch](https://github.com/CrazyHalfDay/AIZotWatch) 的"个性化文献推荐"重做成一个
**原生 Zotero 插件(兼容 7 / 8 / 9)**:按你关注的期刊抓取最新文章(JournalLens 思路),用**你的
Zotero 文库**做个性化相关度排序,并出 AI 摘要 —— 全程在 Zotero 窗口内,**无需服务器、
无需 Python、无需任何部署**。

## 它做什么

- 关注期刊(按刊名/ISSN,经 Crossref)→ 抓最近 N 天的新文章
- 用你的文库向量化后的"画像",给每篇候选算**相关度**并排序、打标签(必读/可读/一般)
- 一键 **AI 摘要**(DeepSeek/OpenRouter/Kimi)
- 一键**导入 Zotero**
- 所有 API、期刊、权重、阈值在**一个设置页**里配齐

## 安装

```bash
bash build.sh          # 生成 build/zotwatch.xpi
```
然后在 Zotero 7:**工具 → 插件 →(右上齿轮)→ Install Plugin From File…** 选这个 .xpi。

装好后:
1. **编辑 → 设置 → ZotWatch**:填 Voyage(embedding)和 LLM 的 API Key,添加关注期刊。
2. **工具 → ZotWatch 推荐…**:打开推荐窗口,点「刷新」。

## 模块一览

| 文件 | 角色 |
|---|---|
| `content/config.js` | 统一配置入口(对应 ZotWatch 的 Settings) |
| `content/storage.js` | 本地缓存:库画像 / 向量 / 摘要 / 每日抓取 |
| `content/embedding.js` | 向量服务(Voyage;DashScope 部分) |
| `content/llm.js` | LLM(OpenAI 兼容) |
| `content/profile.js` | 库画像:embedding + 质心 |
| `content/fetch.js` | 按 ISSN 抓 Crossref + 摘要回补(Europe PMC) |
| `content/dedupe.js` | 与文库去重 |
| `content/rank.js` | 相似度 + 时效 + 期刊 IF → 评分/标签 |
| `content/summarize.js` | AI 摘要(按 DOI 缓存) |
| `content/importer.js` | 按元数据建条目入库 |
| `content/orchestrator.js` | 刷新流程编排 |
| `content/feed.{xhtml,js,css}` | 推荐窗口 UI |
| `content/preferences.{xhtml,js,css}` | 设置页 |
| `bootstrap.js` / `manifest.json` | 插件入口 |

详见 [`SETTINGS.md`](SETTINGS.md)。

## 状态:MVP,可迭代

已实现完整主流程(配置 → 抓取 → 去重 → 打分 → 摘要 → 导入)。已知待打磨点:

- **Fluent 文案注册**按 Zotero 7 实测可能需微调(`bootstrap.js::registerFluent`,见 SETTINGS.md 兜底)。
- **DashScope embedding** 的端点是占位(`embedding.js`),Voyage 已完整。
- UI 目前是独立窗口(工具菜单打开);后续可改成嵌入 JournalLens 式的库内面板。
- 库向量存在 `profile.json` 里,超大文库(上万条)体积偏大,后续可优化为按需加载。
- 未做"每日自动推送"(插件只在 Zotero 打开时运行)——这是插件形态的固有取舍。
