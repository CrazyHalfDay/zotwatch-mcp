// M6 — candidate fetch (followed journals via Crossref) + abstract recovery.

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.fetch = {
  get cfg() {
    return Zotero.ZotWatch.config;
  },
  get util() {
    return Zotero.ZotWatch.util;
  },
  get storage() {
    return Zotero.ZotWatch.storage;
  },

  _issuedToISO(issued) {
    const dp = issued && issued["date-parts"] && issued["date-parts"][0];
    if (!dp || !dp[0]) return null;
    const [y, m = 1, d = 1] = dp;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  },

  _mapWork(it, issn) {
    return {
      doi: (it.DOI || "").toLowerCase(),
      title: (it.title && it.title[0]) || "",
      abstract: this.util.stripTags(it.abstract || ""),
      authors: (it.author || []).map((a) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean),
      venue: (it["container-title"] && it["container-title"][0]) || "",
      issn,
      published: this._issuedToISO(it.issued),
    };
  },

  async _recoverAbstract(doi) {
    try {
      const url =
        "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" +
        `query=DOI:${encodeURIComponent(doi)}&resultType=core&format=json`;
      const r = await Zotero.HTTP.request("GET", url, { responseType: "json", timeout: 20000 });
      const res = r.response?.resultList?.result?.[0];
      return this.util.stripTags(res?.abstractText || "");
    } catch (e) {
      return "";
    }
  },

  async fetchCandidates(onProgress) {
    const journals = this.cfg.followedJournals();
    if (!journals.length) {
      if (onProgress) onProgress("fetch", "未配置关注期刊");
      return [];
    }
    const days = this.cfg.getInt("recentDays", 7);
    const requireAbstract = this.cfg.getBool("requireAbstract", true);
    const useCache = this.cfg.getBool("dailyCache", true);
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const all = [];
    for (const j of journals) {
      if (onProgress) onProgress("fetch", `抓取 ${j.title}…`);
      const cacheKey = `${j.issn}:${today}`;
      let papers = useCache ? await this.storage.getJournalCache(cacheKey) : null;

      if (!papers) {
        try {
          const url =
            `https://api.crossref.org/journals/${encodeURIComponent(j.issn)}/works` +
            `?filter=from-pub-date:${fromDate}&rows=60&sort=published&order=desc` +
            `&select=DOI,title,abstract,author,container-title,issued,ISSN`;
          const r = await Zotero.HTTP.request("GET", url, { responseType: "json", timeout: 30000 });
          const items = r.response?.message?.items || [];
          papers = items.map((it) => this._mapWork(it, j.issn));
          if (useCache) await this.storage.putJournalCache(cacheKey, papers);
        } catch (e) {
          if (onProgress) onProgress("fetch", `${j.title} 抓取失败: ${e.message || e}`);
          papers = [];
        }
      }
      all.push(...papers);
    }

    // Abstract recovery + optional require-abstract filter.
    const out = [];
    for (const p of all) {
      if (!p.abstract && p.doi) p.abstract = await this._recoverAbstract(p.doi);
      if (requireAbstract && !p.abstract) continue;
      out.push(p);
    }
    if (onProgress) onProgress("fetch", `候选 ${out.length} 篇`);
    return out;
  },
};
