// Default preferences for the ZotWatch Zotero plugin.
// All keys live under the "extensions.zotwatch." branch and are read through
// content/config.js. Values here are the out-of-the-box defaults.

// ── ① Embedding (vector) service ───────────────────────────────────────────
pref("extensions.zotwatch.embeddingProvider", "voyage");   // voyage | dashscope
pref("extensions.zotwatch.embeddingModel", "voyage-3.5");
pref("extensions.zotwatch.voyageApiKey", "");
pref("extensions.zotwatch.dashscopeApiKey", "");

// ── ② LLM service (summaries / Q&A) ────────────────────────────────────────
pref("extensions.zotwatch.llmProvider", "deepseek");       // deepseek | openrouter | kimi
pref("extensions.zotwatch.llmModel", "deepseek-chat");
pref("extensions.zotwatch.llmApiKey", "");

// ── ③ Followed journals (JSON array of {title, issn}) ──────────────────────
pref("extensions.zotwatch.followedJournals", "[]");

// ── ④ Fetch ────────────────────────────────────────────────────────────────
pref("extensions.zotwatch.recentDays", 7);                 // 1–180
pref("extensions.zotwatch.sourceArxiv", false);
pref("extensions.zotwatch.requireAbstract", true);
pref("extensions.zotwatch.dailyCache", true);

// ── ⑤ Ranking ──────────────────────────────────────────────────────────────
pref("extensions.zotwatch.simMethod", "knn");              // knn | centroid
pref("extensions.zotwatch.knnK", 8);
pref("extensions.zotwatch.wSimilarity", "0.6");            // weights (auto-normalized)
pref("extensions.zotwatch.wRecency", "0.2");
pref("extensions.zotwatch.wImpact", "0.2");
pref("extensions.zotwatch.recencyHalflife", 30);           // days
pref("extensions.zotwatch.thresholdMode", "fixed");        // fixed | dynamic
pref("extensions.zotwatch.mustReadThreshold", "0.75");
pref("extensions.zotwatch.considerThreshold", "0.55");
pref("extensions.zotwatch.journalWhitelist", "{}");        // JSON {issn: impactFactor}

// ── ⑥ Summary & translation ────────────────────────────────────────────────
pref("extensions.zotwatch.autoSummary", "ondemand");       // off | ondemand | all
pref("extensions.zotwatch.summaryLang", "zh");             // zh | en
pref("extensions.zotwatch.translateProvider", "google");
pref("extensions.zotwatch.translateTarget", "zh");

// ── ⑦ UI & behavior ────────────────────────────────────────────────────────
pref("extensions.zotwatch.listLimit", 8);
pref("extensions.zotwatch.uiMode", "badge");               // badge | tab | both
pref("extensions.zotwatch.autoRefresh", true);
pref("extensions.zotwatch.uiLocale", "zh");                // zh | en
