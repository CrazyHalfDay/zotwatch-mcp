// Feed dialog controller. Reaches the core via window.opener.Zotero.ZotWatch.

/* global window, document */

var ZWFeed = {
  HTML: "http://www.w3.org/1999/xhtml",
  LABELS: { must_read: "必读", consider: "可读", ignore: "一般" },

  get Z() {
    return window.opener ? window.opener.Zotero : Zotero;
  },
  get ZW() {
    return this.Z.ZotWatch;
  },

  init() {
    document.getElementById("zw-refresh").addEventListener("command", () => this.refresh());
    this.loadLast();
  },

  status(t) {
    document.getElementById("zw-status").textContent = t;
  },

  async loadLast() {
    try {
      const last = await this.ZW.orchestrator.getLast();
      const items = last.items || [];
      this.render(items);
      this.status(items.length ? `上次结果 ${items.length} 篇` : "点击「刷新」获取推荐");
    } catch (e) {
      this.status("点击「刷新」获取推荐");
    }
  },

  async refresh() {
    try {
      this.status("处理中…");
      const items = await this.ZW.orchestrator.refresh({
        onProgress: (s, m) => this.status(`[${s}] ${m}`),
      });
      this.render(items);
      this.status(`完成,共 ${items.length} 篇`);
    } catch (e) {
      this.status(`✗ ${e.message || e}`);
    }
  },

  render(items) {
    const list = document.getElementById("zw-feed-list");
    list.replaceChildren();
    if (!items.length) return;
    items.forEach((p, i) => list.appendChild(this.card(p, i + 1)));
  },

  _h(tag, props = {}, text) {
    const el = document.createElementNS(this.HTML, tag);
    Object.assign(el, props);
    if (text != null) el.textContent = text;
    return el;
  },

  card(p, idx) {
    const card = document.createXULElement("vbox");
    card.className = `zw-card zw-label-${p.label}`;

    const head = this._h("div", { className: "zw-card-title" }, `${idx}. ${p.title}`);
    const meta = this._h(
      "div",
      { className: "zw-card-meta" },
      `${this.LABELS[p.label] || p.label} · 相关度 ${(p.similarity || 0).toFixed(2)} · 评分 ${(p.score || 0).toFixed(2)}` +
        `${p.venue ? " · " + p.venue : ""}${p.published ? " · " + p.published : ""}`
    );

    const btns = document.createXULElement("hbox");
    btns.className = "zw-card-btns";
    const bSum = document.createXULElement("button");
    bSum.setAttribute("label", "AI 摘要");
    const bImp = document.createXULElement("button");
    bImp.setAttribute("label", "导入");
    const bOpen = document.createXULElement("button");
    bOpen.setAttribute("label", "打开");
    btns.append(bSum, bImp, bOpen);

    const summaryBox = this._h("div", { className: "zw-card-summary", hidden: true });

    bSum.addEventListener("command", async () => {
      summaryBox.hidden = false;
      summaryBox.textContent = "生成中…";
      try {
        const s = await this.ZW.summarize.summarize(p);
        summaryBox.textContent =
          `❓ ${s.research_question || ""}\n🔬 ${s.methodology || ""}\n` +
          `💡 ${s.key_findings || ""}\n✨ ${s.innovation || ""}`;
      } catch (e) {
        summaryBox.textContent = `✗ ${e.message || e}`;
      }
    });

    bImp.addEventListener("command", async () => {
      bImp.disabled = true;
      try {
        await this.ZW.importer.importPaper(p);
        bImp.setAttribute("label", "已导入");
      } catch (e) {
        bImp.disabled = false;
        this.status(`导入失败: ${e.message || e}`);
      }
    });

    bOpen.addEventListener("command", () => {
      const url = p.doi ? `https://doi.org/${p.doi}` : "";
      if (url) this.Z.launchURL(url);
    });

    card.append(head, meta, btns, summaryBox);
    return card;
  },
};
