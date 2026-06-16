// M2 — import a candidate paper into the Zotero library.

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.importer = {
  _creators(authors) {
    return (authors || []).map((name) => {
      const parts = name.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts.pop() : name;
      const firstName = parts.join(" ");
      return { creatorType: "author", firstName, lastName };
    });
  },

  /** Create a journalArticle item from a candidate; returns the saved item. */
  async importPaper(paper) {
    const item = new Zotero.Item("journalArticle");
    item.setField("title", paper.title || "");
    if (paper.abstract) item.setField("abstractNote", paper.abstract);
    if (paper.doi) item.setField("DOI", paper.doi);
    if (paper.venue) item.setField("publicationTitle", paper.venue);
    if (paper.published) item.setField("date", paper.published);
    if (paper.issn) item.setField("ISSN", paper.issn);
    if (paper.authors && paper.authors.length) item.setCreators(this._creators(paper.authors));
    item.addTag("ZotWatch");
    await item.saveTx();
    return item;
  },
};
