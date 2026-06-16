// M12 — ties the refresh flow together (ZotWatch's watch pipeline equivalent).

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.orchestrator = {
  /**
   * Full refresh: ensure profile -> fetch -> dedupe -> rank.
   * Returns the ranked candidate list (also cached to last.json).
   */
  async refresh({ onProgress } = {}) {
    const zw = Zotero.ZotWatch;
    const progress = onProgress || (() => {});

    if (!zw.config.isReady()) {
      throw new Error("请先在设置里填好 Embedding 和 LLM 的 API Key。");
    }

    progress("profile", "读取库…");
    const libItems = await zw.profile.getLibraryItems();
    const profile = await zw.profile.ensure(libItems, progress);

    const candidates = await zw.fetch.fetchCandidates(progress);

    progress("dedupe", "去重…");
    const fresh = zw.dedupe.filter(candidates, libItems);

    progress("rank", `打分 ${fresh.length} 篇…`);
    const ranked = await zw.rank.rank(fresh, profile);

    await zw.storage.writeJSON("last.json", {
      updatedAt: new Date().toISOString(),
      items: ranked,
    });
    progress("done", `完成,共 ${ranked.length} 篇`);
    return ranked;
  },

  /** Last cached results, for reopening the feed without re-fetching. */
  async getLast() {
    return Zotero.ZotWatch.storage.readJSON("last.json", { items: [] });
  },
};
