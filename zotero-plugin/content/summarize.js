// M9 — AI summaries (cached by DOI).

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.summarize = {
  get cfg() {
    return Zotero.ZotWatch.config;
  },

  _prompt(paper) {
    const lang = this.cfg.getString("summaryLang", "zh") === "en" ? "English" : "中文";
    return (
      `请阅读以下论文,用${lang}输出一个 JSON,字段为 ` +
      `research_question, methodology, key_findings, innovation(各 1-2 句)。` +
      `只输出 JSON,不要其它文字。\n\n` +
      `标题: ${paper.title}\n` +
      `期刊: ${paper.venue || ""}\n` +
      `摘要: ${paper.abstract || "(无摘要)"}\n`
    );
  },

  _parse(text) {
    let t = (text || "").trim();
    if (t.startsWith("```")) t = t.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      return {
        research_question: "",
        methodology: "",
        key_findings: t.slice(0, 300),
        innovation: "",
      };
    }
  },

  async summarize(paper, { force = false } = {}) {
    if (paper.doi && !force) {
      const cached = await Zotero.ZotWatch.storage.getSummary(paper.doi);
      if (cached) return cached;
    }
    const text = await Zotero.ZotWatch.llm.complete(this._prompt(paper), { maxTokens: 800 });
    const summary = this._parse(text);
    if (paper.doi) await Zotero.ZotWatch.storage.putSummary(paper.doi, summary);
    return summary;
  },
};
