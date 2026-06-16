// ZotWatch preferences pane logic.
//
// Loads/saves every field manually through ZWConfig (config.js), plus:
//   • show/hide rows that depend on a provider / threshold mode
//   • "test connection" buttons for the embedding and LLM providers
//   • followed-journal search (Crossref) + list editor
//   • journal-IF whitelist CSV import
//   • profile / cache maintenance actions
//
// This is a first draft meant to be iterated on; network endpoints are marked
// where they may need confirmation.

/* global Zotero, ZWConfig, document, window */

var ZWPrefs = {
  // id -> { key, t } where t is text | int | bool | menu
  FIELDS: [
    { id: "zw-embeddingProvider", key: "embeddingProvider", t: "menu" },
    { id: "zw-embeddingModel", key: "embeddingModel", t: "text" },
    { id: "zw-voyageApiKey", key: "voyageApiKey", t: "text" },
    { id: "zw-dashscopeApiKey", key: "dashscopeApiKey", t: "text" },
    { id: "zw-llmProvider", key: "llmProvider", t: "menu" },
    { id: "zw-llmModel", key: "llmModel", t: "text" },
    { id: "zw-llmApiKey", key: "llmApiKey", t: "text" },
    { id: "zw-recentDays", key: "recentDays", t: "int" },
    { id: "zw-sourceArxiv", key: "sourceArxiv", t: "bool" },
    { id: "zw-requireAbstract", key: "requireAbstract", t: "bool" },
    { id: "zw-dailyCache", key: "dailyCache", t: "bool" },
    { id: "zw-simMethod", key: "simMethod", t: "menu" },
    { id: "zw-knnK", key: "knnK", t: "int" },
    { id: "zw-wSimilarity", key: "wSimilarity", t: "text" },
    { id: "zw-wRecency", key: "wRecency", t: "text" },
    { id: "zw-wImpact", key: "wImpact", t: "text" },
    { id: "zw-recencyHalflife", key: "recencyHalflife", t: "int" },
    { id: "zw-thresholdMode", key: "thresholdMode", t: "menu" },
    { id: "zw-mustReadThreshold", key: "mustReadThreshold", t: "text" },
    { id: "zw-considerThreshold", key: "considerThreshold", t: "text" },
    { id: "zw-autoSummary", key: "autoSummary", t: "menu" },
    { id: "zw-summaryLang", key: "summaryLang", t: "menu" },
    { id: "zw-translateProvider", key: "translateProvider", t: "menu" },
    { id: "zw-translateTarget", key: "translateTarget", t: "menu" },
    { id: "zw-listLimit", key: "listLimit", t: "int" },
    { id: "zw-uiMode", key: "uiMode", t: "menu" },
    { id: "zw-autoRefresh", key: "autoRefresh", t: "bool" },
    { id: "zw-uiLocale", key: "uiLocale", t: "menu" },
  ],

  $(id) {
    return document.getElementById(id);
  },

  init() {
    // Zotero 8/9: make sure the Fluent strings are injected into this pane.
    try {
      window.MozXULElement.insertFTLIfNeeded("zotwatch.ftl");
    } catch (e) {
      /* older Zotero registers via the <linkset> in the XHTML */
    }
    this.loadAll();
    this.bindAll();
    this.bindActions();
    this.applyConditionalVisibility();
    this.renderJournalList();
    this.refreshStatus();
  },

  // ── load / save ────────────────────────────────────────────────────────

  loadAll() {
    for (const f of this.FIELDS) {
      const el = this.$(f.id);
      if (!el) continue;
      switch (f.t) {
        case "bool":
          el.checked = ZWConfig.getBool(f.key);
          break;
        case "int":
          el.value = String(ZWConfig.getInt(f.key));
          break;
        default:
          el.value = ZWConfig.getString(f.key);
      }
    }
  },

  bindAll() {
    for (const f of this.FIELDS) {
      const el = this.$(f.id);
      if (!el) continue;
      const evt = f.t === "bool" || f.t === "menu" ? "command" : "change";
      el.addEventListener(evt, () => this.saveField(f));
    }
  },

  saveField(f) {
    const el = this.$(f.id);
    if (!el) return;
    switch (f.t) {
      case "bool":
        ZWConfig.set(f.key, !!el.checked);
        break;
      case "int": {
        const n = parseInt(el.value, 10);
        ZWConfig.set(f.key, Number.isNaN(n) ? 0 : n);
        break;
      }
      default:
        ZWConfig.set(f.key, el.value);
    }
    // Re-evaluate dependent UI on provider / threshold changes.
    if (f.key === "embeddingProvider" || f.key === "thresholdMode") {
      this.applyConditionalVisibility();
    }
  },

  applyConditionalVisibility() {
    const emb = this.$("zw-embeddingProvider").value;
    this.$("zw-row-voyageKey").hidden = emb !== "voyage";
    this.$("zw-row-dashscopeKey").hidden = emb !== "dashscope";
    this.$("zw-row-thresholds").hidden =
      this.$("zw-thresholdMode").value !== "fixed";
  },

  // ── actions ────────────────────────────────────────────────────────────

  _on(id, fn) {
    const el = this.$(id);
    if (el) el.addEventListener("command", fn);
  },

  bindActions() {
    this._on("zw-test-embedding", () => this.testEmbedding());
    this._on("zw-test-llm", () => this.testLLM());
    this._on("zw-journal-search-btn", () => this.searchJournals());
    this._on("zw-import-whitelist", () => this.importWhitelist());
    this._on("zw-profile-incremental", () => this.runMaintenance("incremental"));
    this._on("zw-profile-rebuild", () => this.runMaintenance("rebuild"));
    this._on("zw-clear-cache", () => this.clearCache());
  },

  async _http(method, url, headers, body) {
    return Zotero.HTTP.request(method, url, {
      headers,
      body: body ? JSON.stringify(body) : undefined,
      responseType: "json",
      timeout: 20000,
    });
  },

  // ── test connection ────────────────────────────────────────────────────

  async testEmbedding() {
    const out = this.$("zw-test-embedding-result");
    out.textContent = "…";
    try {
      const provider = this.$("zw-embeddingProvider").value;
      const model = this.$("zw-embeddingModel").value;
      if (provider === "voyage") {
        const key = this.$("zw-voyageApiKey").value;
        const r = await this._http(
          "POST",
          "https://api.voyageai.com/v1/embeddings",
          { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          { input: ["hello"], model }
        );
        const ok = r.status === 200 && r.response && r.response.data;
        out.textContent = ok ? "✓ OK" : `✗ HTTP ${r.status}`;
      } else {
        // TODO: confirm DashScope text-embedding endpoint/payload.
        out.textContent = "DashScope 测试待接入";
      }
    } catch (e) {
      out.textContent = `✗ ${e.status || ""} ${e.message || e}`;
    }
  },

  async testLLM() {
    const out = this.$("zw-test-llm-result");
    out.textContent = "…";
    const bases = {
      deepseek: "https://api.deepseek.com/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      kimi: "https://api.moonshot.cn/v1/chat/completions",
    };
    try {
      const provider = this.$("zw-llmProvider").value;
      const key = this.$("zw-llmApiKey").value;
      const model = this.$("zw-llmModel").value;
      const r = await this._http(
        "POST",
        bases[provider],
        { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        { model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }
      );
      out.textContent =
        r.status === 200 && r.response ? "✓ OK" : `✗ HTTP ${r.status}`;
    } catch (e) {
      out.textContent = `✗ ${e.status || ""} ${e.message || e}`;
    }
  },

  // ── followed journals ──────────────────────────────────────────────────

  async searchJournals() {
    const q = this.$("zw-journal-search").value.trim();
    const box = this.$("zw-journal-results");
    box.replaceChildren();
    if (!q) return;
    try {
      const r = await this._http(
        "GET",
        `https://api.crossref.org/journals?query=${encodeURIComponent(q)}&rows=6`
      );
      const items = (r.response && r.response.message && r.response.message.items) || [];
      for (const it of items) {
        const issn = (it.ISSN && it.ISSN[0]) || "";
        if (!issn) continue;
        box.appendChild(this._resultRow(it.title, issn));
      }
      if (!box.childNodes.length) box.textContent = "（无结果）";
    } catch (e) {
      box.textContent = `✗ ${e.message || e}`;
    }
  },

  _resultRow(title, issn) {
    const row = document.createXULElement("hbox");
    row.setAttribute("align", "center");
    const label = document.createXULElement("label");
    label.setAttribute("flex", "1");
    label.setAttribute("value", `${title}  ·  ${issn}`);
    const add = document.createXULElement("button");
    add.setAttribute("label", "+");
    add.addEventListener("command", () => this.addJournal(title, issn));
    row.append(label, add);
    return row;
  },

  addJournal(title, issn) {
    const list = ZWConfig.followedJournals();
    if (list.some((j) => j.issn === issn)) return;
    list.push({ title, issn });
    ZWConfig.setJSON("followedJournals", list);
    this.renderJournalList();
  },

  removeJournal(issn) {
    const list = ZWConfig.followedJournals().filter((j) => j.issn !== issn);
    ZWConfig.setJSON("followedJournals", list);
    this.renderJournalList();
  },

  renderJournalList() {
    const box = this.$("zw-journal-list");
    box.replaceChildren();
    const list = ZWConfig.followedJournals();
    if (!list.length) {
      box.textContent = "（尚未关注任何期刊）";
      return;
    }
    for (const j of list) {
      const row = document.createXULElement("hbox");
      row.setAttribute("align", "center");
      const label = document.createXULElement("label");
      label.setAttribute("flex", "1");
      label.setAttribute("value", `${j.title}  ·  ${j.issn}`);
      const del = document.createXULElement("button");
      del.setAttribute("label", "×");
      del.addEventListener("command", () => this.removeJournal(j.issn));
      row.append(label, del);
      box.appendChild(row);
    }
  },

  // ── journal-IF whitelist (CSV: issn,impactFactor) ──────────────────────

  async importWhitelist() {
    const status = this.$("zw-whitelist-status");
    try {
      const fp = new Zotero.FilePicker();
      fp.init(window, "Import journal IF CSV", fp.modeOpen);
      fp.appendFilter("CSV", "*.csv");
      const rv = await fp.show();
      if (rv !== fp.returnOK) return;
      const text = await Zotero.File.getContentsAsync(fp.file);
      const map = {};
      for (const line of text.split(/\r?\n/)) {
        const [issn, impact] = line.split(",").map((s) => (s || "").trim());
        if (issn && impact && !Number.isNaN(parseFloat(impact))) {
          map[issn] = parseFloat(impact);
        }
      }
      ZWConfig.setJSON("journalWhitelist", map);
      status.textContent = `已导入 ${Object.keys(map).length} 条`;
    } catch (e) {
      status.textContent = `✗ ${e.message || e}`;
    }
  },

  // ── maintenance (hooks into the core modules once they exist) ──────────

  _core() {
    return typeof Zotero !== "undefined" ? Zotero.ZotWatch : null;
  },

  async runMaintenance(mode) {
    const status = this.$("zw-profile-status");
    const core = this._core();
    if (!core || !core.profile) {
      status.textContent = "核心模块未加载";
      return;
    }
    status.textContent = mode === "rebuild" ? "全量重建中…" : "增量更新中…";
    try {
      const items = await core.profile.getLibraryItems();
      await core.profile.build(items, { full: mode === "rebuild" });
      await this.refreshStatus();
    } catch (e) {
      status.textContent = `✗ ${e.message || e}`;
    }
  },

  async clearCache() {
    const core = this._core();
    if (core && core.storage && core.storage.clearCaches) {
      await core.storage.clearCaches();
    }
    await this.refreshStatus();
  },

  async refreshStatus() {
    const core = this._core();
    const pStatus = this.$("zw-profile-status");
    const cStatus = this.$("zw-cache-status");
    if (!pStatus) return;
    if (core && core.storage && core.storage.stats) {
      try {
        const s = await core.storage.stats();
        pStatus.textContent = `已向量化 ${s.embedded}/${s.total} 条 · 上次更新 ${s.updatedAt || "—"}`;
        if (cStatus) cStatus.textContent = `缓存:向量 ${s.vectorSize || "—"} · 摘要 ${s.summarySize || "—"}`;
        return;
      } catch (e) {
        /* fall through */
      }
    }
    pStatus.textContent = "画像状态:核心模块未加载";
    if (cStatus) cStatus.textContent = "";
  },
};

// Init is triggered by the pane root's onload (see preferences.xhtml). Do NOT
// run at top level: Zotero injects the pane DOM lazily, so elements aren't in
// the document when this script first executes.
globalThis.ZWPrefs = ZWPrefs;
