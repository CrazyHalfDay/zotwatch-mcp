// M0 — storage / cache.
//
// Persists JSON files under <Zotero data dir>/zotwatch/:
//   profile.json     library embeddings + centroid
//   embeddings.json  candidate vector cache  { "<model>:<hash>": [...] }
//   summaries.json   AI summaries            { "<doi>": {...} }
//   journals.json    daily fetch cache       { "<issn>:<date>": [papers] }

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.storage = {
  _dirPath: null,

  async dir() {
    if (!this._dirPath) {
      this._dirPath = PathUtils.join(Zotero.DataDirectory.dir, "zotwatch");
      await IOUtils.makeDirectory(this._dirPath, { ignoreExisting: true });
    }
    return this._dirPath;
  },

  async _path(name) {
    return PathUtils.join(await this.dir(), name);
  },

  async readJSON(name, fallback) {
    try {
      const p = await this._path(name);
      if (!(await IOUtils.exists(p))) return fallback;
      return JSON.parse(await IOUtils.readUTF8(p));
    } catch (e) {
      Zotero.debug(`ZotWatch storage read ${name} failed: ${e}`);
      return fallback;
    }
  },

  async writeJSON(name, obj) {
    const p = await this._path(name);
    await IOUtils.writeUTF8(p, JSON.stringify(obj));
  },

  // ── profile ──────────────────────────────────────────────────────────
  async getProfile() {
    return this.readJSON("profile.json", null);
  },
  async saveProfile(profile) {
    return this.writeJSON("profile.json", profile);
  },

  // ── embedding cache ──────────────────────────────────────────────────
  async getEmbeddingCache() {
    return this.readJSON("embeddings.json", {});
  },
  async saveEmbeddingCache(map) {
    return this.writeJSON("embeddings.json", map);
  },

  // ── summary cache ────────────────────────────────────────────────────
  async getSummary(doi) {
    const all = await this.readJSON("summaries.json", {});
    return all[doi] || null;
  },
  async putSummary(doi, summary) {
    const all = await this.readJSON("summaries.json", {});
    all[doi] = summary;
    return this.writeJSON("summaries.json", all);
  },

  // ── journal daily cache ──────────────────────────────────────────────
  async getJournalCache(key) {
    const all = await this.readJSON("journals.json", {});
    return all[key] || null;
  },
  async putJournalCache(key, papers) {
    const all = await this.readJSON("journals.json", {});
    all[key] = papers;
    return this.writeJSON("journals.json", all);
  },

  // ── maintenance ──────────────────────────────────────────────────────
  async stats() {
    const profile = await this.getProfile();
    const emb = await this.getEmbeddingCache();
    const sum = await this.readJSON("summaries.json", {});
    return {
      total: profile ? profile.items.length : 0,
      embedded: profile ? profile.items.filter((i) => i.vector).length : 0,
      updatedAt: profile ? profile.updatedAt : null,
      vectorSize: `${Object.keys(emb).length} 条`,
      summarySize: `${Object.keys(sum).length} 条`,
    };
  },

  async clearCaches() {
    for (const f of ["embeddings.json", "summaries.json", "journals.json"]) {
      const p = await this._path(f);
      if (await IOUtils.exists(p)) await IOUtils.remove(p);
    }
  },
};
