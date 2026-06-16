// M5 — library profile (embeddings + centroid).

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.profile = {
  get util() {
    return Zotero.ZotWatch.util;
  },
  get embedding() {
    return Zotero.ZotWatch.embedding;
  },
  get storage() {
    return Zotero.ZotWatch.storage;
  },

  /** Read top-level regular items from the user library. */
  async getLibraryItems() {
    const libID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libID, true);
    const out = [];
    for (const it of items) {
      if (!it.isRegularItem || !it.isRegularItem()) continue;
      const title = it.getField("title");
      if (!title) continue;
      const abstract = it.getField("abstractNote") || "";
      out.push({
        key: it.key,
        doi: (it.getField("DOI") || "").toLowerCase().trim(),
        title,
        abstract,
        contentHash: this.util.hashContent(this.util.contentForEmbedding(title, abstract)),
      });
    }
    return out;
  },

  /** Signature of library state — changes when items are added/removed/edited. */
  signature(items) {
    const parts = items.map((i) => i.contentHash).sort();
    return this.util.hashContent(`${parts.length}|${parts.join(",")}`);
  },

  /** Return a valid cached profile, or (re)build it. */
  async ensure(items, onProgress) {
    const sig = this.signature(items);
    const model = this.embedding.model();
    const cached = await this.storage.getProfile();
    if (cached && cached.signature === sig && cached.model === model) {
      return cached;
    }
    return this.build(items, { onProgress });
  },

  async build(items, { full = false, onProgress = null } = {}) {
    if (onProgress) onProgress("profile", `向量化 ${items.length} 条文献…`);
    const texts = items.map((i) => this.util.contentForEmbedding(i.title, i.abstract));

    // embedCached already skips items already embedded for this model; `full`
    // is honored implicitly because the cache key includes the model.
    const vectors = await this.embedding.embedCached(texts);

    const dim = vectors[0] ? vectors[0].length : 0;
    const centroid = new Array(dim).fill(0);
    let n = 0;
    for (const v of vectors) {
      if (!v) continue;
      const nv = this.util.normalize(v.slice());
      for (let i = 0; i < dim; i++) centroid[i] += nv[i];
      n++;
    }
    if (n) for (let i = 0; i < dim; i++) centroid[i] /= n;
    this.util.normalize(centroid);

    const profile = {
      signature: this.signature(items),
      model: this.embedding.model(),
      centroid,
      items: items.map((it, i) => ({
        key: it.key,
        doi: it.doi,
        title: it.title,
        contentHash: it.contentHash,
        vector: vectors[i] || null,
      })),
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    await this.storage.saveProfile(profile);
    if (onProgress) onProgress("profile", `画像就绪(${n} 条向量)`);
    return profile;
  },
};
