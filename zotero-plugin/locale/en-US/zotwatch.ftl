# ZotWatch settings — English
# Binding: XUL <label>/<description> use .value; <button>/<checkbox>/<menuitem>
# use .label; <html:h2> plain text; <html:input> placeholder uses .placeholder.

# Section titles (html:h2, plain text)
zw-sec-embedding = ① Embedding service
zw-sec-llm = ② LLM (summaries / Q&A)
zw-sec-journals = ③ Followed journals
zw-sec-fetch = ④ Fetch
zw-sec-ranking = ⑤ Ranking
zw-sec-summary = ⑥ Summary & translation
zw-sec-ui = ⑦ UI & behavior
zw-sec-maintenance = ⑧ Profile / maintenance

# ① Embedding
zw-embedding-provider =
    .value = Provider
zw-embedding-model =
    .value = Model
zw-voyage-key =
    .value = Voyage API Key
zw-dashscope-key =
    .value = DashScope API Key

# ② LLM
zw-llm-provider =
    .value = Provider
zw-llm-model =
    .value = Model
zw-llm-key =
    .value = LLM API Key
zw-no-zotero-key =
    .value = ℹ No Zotero API key needed — the plugin reads your library directly

# ③ Followed journals
zw-journal-search =
    .placeholder = Search journal name / ISSN (Crossref)
zw-journal-followed =
    .value = Followed

# ④ Fetch
zw-recent-days =
    .value = Time window (days)
zw-sources =
    .value = Sources
zw-source-journals =
    .label = Followed journals
zw-source-arxiv =
    .label = arXiv
zw-require-abstract =
    .label = Keep only papers with an abstract
zw-daily-cache =
    .label = Reuse daily cache

# ⑤ Ranking
zw-sim-method =
    .value = Similarity
zw-sim-knn =
    .label = kNN mean
zw-sim-centroid =
    .label = Library centroid
zw-weights =
    .value = Weights
zw-halflife =
    .value = Recency half-life (days)
zw-threshold-mode =
    .value = Threshold mode
zw-threshold-fixed =
    .label = Fixed
zw-threshold-dynamic =
    .label = Dynamic
zw-journal-whitelist =
    .value = Journal IF / whitelist

# ⑥ Summary & translation
zw-auto-summary =
    .value = Auto summary
zw-summary-off =
    .label = Off
zw-summary-ondemand =
    .label = On demand
zw-summary-all =
    .label = All
zw-summary-lang =
    .value = Summary language
zw-translate-provider =
    .value = Translator
zw-translate-target =
    .value = Target language

# ⑦ UI & behavior
zw-list-limit =
    .value = Items per list
zw-ui-mode =
    .value = UI mode
zw-ui-badge =
    .label = Overlay relevance badge
zw-ui-tab =
    .label = Separate "For you" tab
zw-ui-both =
    .label = Both
zw-auto-refresh =
    .label = Auto-refresh on startup
zw-ui-locale =
    .value = Display language

# ⑧ Maintenance
zw-profile-incremental =
    .label = Incremental update
zw-profile-rebuild =
    .label = Full rebuild
zw-clear-cache =
    .label = Clear cache

# Menu
zw-menu-open =
    .label = ZotWatch Feed…

# Common buttons
zw-test =
    .label = Test
zw-search =
    .label = Search
zw-import-csv =
    .label = Import CSV…
