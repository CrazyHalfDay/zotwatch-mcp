// LLM service — OpenAI-compatible chat completions (DeepSeek / OpenRouter / Kimi).

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.llm = {
  BASES: {
    deepseek: "https://api.deepseek.com/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    kimi: "https://api.moonshot.cn/v1/chat/completions",
  },

  get cfg() {
    return Zotero.ZotWatch.config;
  },

  /** Return the assistant text for a single-prompt completion. */
  async complete(prompt, { maxTokens = 1024, temperature = 0.3 } = {}) {
    const provider = this.cfg.getString("llmProvider", "deepseek");
    const key = this.cfg.getString("llmApiKey");
    const model = this.cfg.getString("llmModel", "deepseek-chat");
    if (!key) throw new Error("LLM API key 未设置");
    const url = this.BASES[provider];
    if (!url) throw new Error(`Unknown LLM provider: ${provider}`);

    const r = await Zotero.HTTP.request("POST", url, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
      responseType: "json",
      timeout: 120000,
    });
    if (r.status !== 200) throw new Error(`LLM HTTP ${r.status}`);
    return (r.response.choices?.[0]?.message?.content || "").trim();
  },
};
