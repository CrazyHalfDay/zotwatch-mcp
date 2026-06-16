// Shared helpers. Attached to Zotero.ZotWatch.util by bootstrap load order.

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.util = {
  /** cyrb53 string hash -> hex. Stable content key for caching. */
  hashContent(str) {
    let h1 = 0xdeadbeef ^ 0,
      h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  },

  dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  },

  norm(a) {
    return Math.sqrt(this.dot(a, a)) || 1e-9;
  },

  /** L2-normalize a vector in place; returns it. */
  normalize(a) {
    const n = this.norm(a);
    for (let i = 0; i < a.length; i++) a[i] /= n;
    return a;
  },

  /** Cosine of two (not necessarily normalized) vectors. */
  cosine(a, b) {
    return this.dot(a, b) / (this.norm(a) * this.norm(b));
  },

  /** Lowercased, punctuation-stripped title for dedupe/exact match. */
  normalizeTitle(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9一-鿿]+/g, " ").trim();
  },

  /** Strip JATS/HTML tags from a Crossref abstract. */
  stripTags(s) {
    if (!s) return "";
    return s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  /** Exponential recency score in [0,1] from an ISO date and a half-life. */
  recencyScore(publishedISO, halflifeDays) {
    if (!publishedISO) return 0;
    const days = (Date.now() - new Date(publishedISO).getTime()) / 86400000;
    if (!Number.isFinite(days) || days < 0) return 1;
    return Math.pow(0.5, days / Math.max(halflifeDays, 1));
  },

  /** Build the embedding text for a paper (matches ZotWatch's format). */
  contentForEmbedding(title, abstract) {
    return `Title: ${title || ""}\nAbstract: ${abstract || ""}`;
  },
};
