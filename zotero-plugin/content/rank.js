// M7 — rank candidates by similarity + recency + journal impact.

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.rank = {
  get cfg() {
    return Zotero.ZotWatch.config;
  },
  get util() {
    return Zotero.ZotWatch.util;
  },

  _similarity(vec, profile) {
    if (!vec) return 0;
    const method = this.cfg.getString("simMethod", "knn");
    if (method === "centroid") {
      return Math.max(0, this.util.cosine(vec, profile.centroid));
    }
    // kNN-mean: average of the top-k cosine similarities to library vectors.
    const k = this.cfg.getInt("knnK", 8);
    const sims = [];
    for (const it of profile.items) {
      if (it.vector) sims.push(this.util.cosine(vec, it.vector));
    }
    sims.sort((a, b) => b - a);
    const top = sims.slice(0, k);
    const mean = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
    return Math.max(0, mean);
  },

  _impact(issn) {
    const wl = this.cfg.getJSON("journalWhitelist", {});
    const ifv = wl[issn];
    return ifv ? Math.min(1, ifv / 10) : 0;
  },

  _percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  },

  async rank(candidates, profile) {
    if (!candidates.length) return [];
    const texts = candidates.map((c) => this.util.contentForEmbedding(c.title, c.abstract));
    const vecs = await Zotero.ZotWatch.embedding.embedCached(texts);

    const w = this.cfg.weights();
    const halflife = this.cfg.getInt("recencyHalflife", 30);

    const scored = candidates.map((c, i) => {
      const similarity = this._similarity(vecs[i], profile);
      const recency = this.util.recencyScore(c.published, halflife);
      const impact = this._impact(c.issn);
      const score = w.similarity * similarity + w.recency * recency + w.impact * impact;
      return { ...c, similarity, recency, impact, score, label: "ignore" };
    });

    // Thresholds → labels.
    let mustRead, consider;
    if (this.cfg.getString("thresholdMode", "fixed") === "dynamic") {
      const sorted = scored.map((s) => s.score).sort((a, b) => a - b);
      mustRead = Math.max(0.6, this._percentile(sorted, 95));
      consider = Math.max(0.4, this._percentile(sorted, 70));
    } else {
      mustRead = this.cfg.getFloat("mustReadThreshold", 0.75);
      consider = this.cfg.getFloat("considerThreshold", 0.55);
    }
    for (const s of scored) {
      s.label = s.score >= mustRead ? "must_read" : s.score >= consider ? "consider" : "ignore";
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  },
};
