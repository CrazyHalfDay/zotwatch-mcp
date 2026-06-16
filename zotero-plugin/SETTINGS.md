# 设置页:如何接入插件

设置页本身已经完成,这里说明把它挂到 Zotero 7 插件上需要的接线(等我们 fork
JournalLens 后,这些大多已经有现成骨架,只需加注册项)。

## 文件清单

```
prefs.js                       # 默认偏好值(extensions.zotwatch.*)
content/config.js              # ZWConfig:所有模块统一读配置的入口
content/preferences.xhtml      # 设置页 UI(8 个分区)
content/preferences.js         # 加载/保存、测试连接、期刊搜索、维护动作
content/preferences.css        # 简单布局
locale/zh-CN/preferences.ftl   # 中文文案
locale/en-US/preferences.ftl   # 英文文案
```

## 1. 在 bootstrap.js 的 startup 里注册偏好面板与 Fluent 资源

```js
async function startup({ id, version, rootURI }) {
  // 注册 Fluent 命名空间 "zotwatch"(对应 XHTML 里的 href="zotwatch/preferences.ftl")
  Services.scriptloader.loadSubScript(rootURI + "content/config.js");
  if (Zotero.PreferencePanes && Zotero.PreferencePanes.register) {
    Zotero.PreferencePanes.register({
      pluginID: id,
      src: rootURI + "content/preferences.xhtml",
      scripts: [rootURI + "content/config.js", rootURI + "content/preferences.js"],
      stylesheets: [rootURI + "content/preferences.css"],
      label: "ZotWatch",
      image: rootURI + "icons/icon.png",
      // Fluent:把 locale/<locale>/preferences.ftl 注册到 "zotwatch" 命名空间。
      // Zotero 7 会按当前界面语言挑 zh-CN / en-US。
      l10nFiles: ["preferences.ftl"], // 见下方说明
    });
  }
}
```

> ⚠️ **Fluent 注册是 Zotero 7 里最容易按版本不同而需要微调的一环。** 不同 7.x
> 小版本注册 ftl 的写法略有差异(有的用 `Zotero.PreferencePanes.register` 的
> 选项,有的需 `L10nRegistry` 手动注册源)。如果设置页打开后标签显示成
> `zw-sec-embedding` 这样的原始 id,就是 Fluent 没接上 —— 先查这里。
> 临时兜底:可把文案直接写进 `preferences.xhtml` 的 `value=` / `label=`,跳过
> Fluent。

## 2. manifest.json 里声明默认偏好

```json
{
  "manifest_version": 2,
  "name": "ZotWatch",
  "version": "0.1.0",
  "applications": { "zotero": { "id": "zotwatch@example.com", "update_url": "..." } },
  "default_locale": "zh-CN"
}
```

`prefs.js` 通过 bootstrap 的 `Zotero.PreferencePanes` / `pref()` 机制在安装时写入
默认值(沿用 JournalLens 现有的 `prefs.js` 加载方式即可)。

## 3. 业务模块怎么读配置

所有模块都经 `ZWConfig`(`content/config.js`),不直接碰 `Zotero.Prefs`:

```js
const days   = ZWConfig.getInt("recentDays", 7);
const w      = ZWConfig.weights();              // 已归一化 {similarity, recency, impact}
const jrnls  = ZWConfig.followedJournals();     // [{title, issn}, ...]
const ready  = ZWConfig.isReady();              // 关键 key 是否都填了
```

## 4. 维护区与核心模块的对接点(待 M5/M0 实现)

`preferences.js` 里 `runMaintenance()` / `clearCache()` / `refreshStatus()` 通过
`window.ZotWatch` 调用核心模块,目前是安全降级(模块没加载时显示提示)。等实现
M5(库画像)/M0(存储)后,挂上:

```js
window.ZotWatch = {
  profile: { build({ full }) { /* M5 */ } },
  storage: {
    stats() { return { embedded, total, updatedAt, vectorSize, summarySize }; },
    clearCaches() { /* M0 */ },
  },
};
```

## 待办 / 已知粗糙点(留待迭代)

- Fluent 资源注册按实际 Zotero 7 版本核对(见 §1 警告)。
- DashScope 的 embedding「测试连接」端点未填(`preferences.js::testEmbedding`)。
- 期刊 IF 白名单目前是 `issn,impactFactor` 两列 CSV;ZotWatch 原版还有 category。
- 维护区状态依赖核心模块,尚未实现。
