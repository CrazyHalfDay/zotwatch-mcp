// Central configuration accessor for ZotWatch.
//
// Every module reads settings through ZWConfig (never touches Zotero.Prefs
// directly), mirroring ZotWatch's `Settings` object. Keys are the suffix after
// the "extensions.zotwatch." branch (e.g. "recentDays").

var ZWConfig = {
  PREFIX: "extensions.zotwatch.",

  // Resolve Zotero at call time. Zotero 8/9 preference panes run in their own
  // global scope; do NOT declare a local `var Zotero` (it would hoist to
  // undefined and shadow the real global, breaking the whole pane).
  _Z() {
    return (
      (typeof Zotero !== "undefined" && Zotero) ||
      (typeof window !== "undefined" && window.Zotero) ||
      (typeof globalThis !== "undefined" && globalThis.Zotero)
    );
  },

  _full(key) {
    return this.PREFIX + key;
  },

  /** Raw get. `true` => treat as a global (fully-qualified) pref key. */
  get(key, fallback = undefined) {
    const v = this._Z().Prefs.get(this._full(key), true);
    return v === undefined || v === null ? fallback : v;
  },

  set(key, value) {
    this._Z().Prefs.set(this._full(key), value, true);
  },

  clear(key) {
    this._Z().Prefs.clear(this._full(key), true);
  },

  getString(key, d = "") {
    const v = this.get(key, d);
    return v == null ? d : String(v);
  },

  getInt(key, d = 0) {
    const n = parseInt(this.get(key, d), 10);
    return Number.isNaN(n) ? d : n;
  },

  getFloat(key, d = 0) {
    const n = parseFloat(this.get(key, d));
    return Number.isNaN(n) ? d : n;
  },

  getBool(key, d = false) {
    const v = this.get(key, d);
    return v === true || v === "true";
  },

  getJSON(key, d) {
    try {
      const raw = this.getString(key, "");
      if (!raw) return d;
      const parsed = JSON.parse(raw);
      return parsed == null ? d : parsed;
    } catch (e) {
      Zotero.debug(`ZotWatch: bad JSON pref ${key}: ${e}`);
      return d;
    }
  },

  setJSON(key, obj) {
    this.set(key, JSON.stringify(obj));
  },

  // ── Convenience composites ────────────────────────────────────────────────

  /** API key for the active embedding provider. */
  embeddingApiKey() {
    return this.getString(
      this.getString("embeddingProvider") === "dashscope"
        ? "dashscopeApiKey"
        : "voyageApiKey"
    );
  },

  /** Ranking weights, normalized so they sum to 1. */
  weights() {
    let s = this.getFloat("wSimilarity", 0.6);
    let r = this.getFloat("wRecency", 0.2);
    let i = this.getFloat("wImpact", 0.2);
    const total = s + r + i || 1;
    return { similarity: s / total, recency: r / total, impact: i / total };
  },

  followedJournals() {
    return this.getJSON("followedJournals", []);
  },

  /** True only if the minimum required keys are present. */
  isReady() {
    return Boolean(this.embeddingApiKey() && this.getString("llmApiKey"));
  },
};

if (typeof module !== "undefined") {
  module.exports = { ZWConfig };
}
