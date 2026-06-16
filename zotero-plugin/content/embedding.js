// M4 — embedding service (Voyage; DashScope partial).
//
// Content-hash caching mirrors ZotWatch's CachingEmbeddingProvider: cache key is
// "<model>:<hash>", so switching model invalidates automatically.

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.embedding = {
  get cfg() {
    return Zotero.ZotWatch.config;
  },
  get util() {
    return Zotero.ZotWatch.util;
  },

  model() {
    return this.cfg.getString("embeddingModel", "voyage-3.5");
  },

  /** Embed an array of texts via the configured provider (no cache). */
  async _embedRaw(texts) {
    const provider = this.cfg.getString("embeddingProvider", "voyage");
    if (provider === "voyage") return this._voyage(texts);
    if (provider === "dashscope") return this._dashscope(texts);
    throw new Error(`Unknown embedding provider: ${provider}`);
  },

  async _voyage(texts) {
    const key = this.cfg.getString("voyageApiKey");
    if (!key) throw new Error("Voyage API key 未设置");
    const out = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const r = await Zotero.HTTP.request("POST", "https://api.voyageai.com/v1/embeddings", {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: batch, model: this.model() }),
        responseType: "json",
        timeout: 60000,
      });
      if (r.status !== 200) throw new Error(`Voyage HTTP ${r.status}`);
      for (const d of r.response.data) out.push(d.embedding);
    }
    return out;
  },

  async _dashscope(texts) {
    // TODO: confirm DashScope text-embedding endpoint/payload before relying on it.
    const key = this.cfg.getString("dashscopeApiKey");
    if (!key) throw new Error("DashScope API key 未设置");
    const out = [];
    for (let i = 0; i < texts.length; i += 25) {
      const batch = texts.slice(i, i + 25);
      const r = await Zotero.HTTP.request(
        "POST",
        "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
        {
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.model(), input: { texts: batch } }),
          responseType: "json",
          timeout: 60000,
        }
      );
      if (r.status !== 200) throw new Error(`DashScope HTTP ${r.status}`);
      for (const e of r.response.output.embeddings) out.push(e.embedding);
    }
    return out;
  },

  /** Embed with caching. Returns vectors aligned to `texts`. */
  async embedCached(texts) {
    const cache = await Zotero.ZotWatch.storage.getEmbeddingCache();
    const model = this.model();
    const results = new Array(texts.length).fill(null);
    const missIdx = [];
    const missTexts = [];

    texts.forEach((t, i) => {
      const k = `${model}:${this.util.hashContent(t)}`;
      if (cache[k]) results[i] = cache[k];
      else {
        missIdx.push(i);
        missTexts.push(t);
      }
    });

    if (missTexts.length) {
      const fresh = await this._embedRaw(missTexts);
      fresh.forEach((vec, j) => {
        const i = missIdx[j];
        results[i] = vec;
        cache[`${model}:${this.util.hashContent(texts[i])}`] = vec;
      });
      await Zotero.ZotWatch.storage.saveEmbeddingCache(cache);
    }
    return results;
  },

  /** Embed a single query text (no cache). */
  async embedOne(text) {
    const [v] = await this._embedRaw([text]);
    return v;
  },
};
