// M8 — drop candidates already in the library (by DOI or normalized title).

Zotero.ZotWatch = Zotero.ZotWatch || {};

Zotero.ZotWatch.dedupe = {
  filter(candidates, libraryItems) {
    const util = Zotero.ZotWatch.util;
    const dois = new Set();
    const titles = new Set();
    for (const it of libraryItems) {
      if (it.doi) dois.add(it.doi);
      titles.add(util.normalizeTitle(it.title));
    }
    return candidates.filter((c) => {
      if (c.doi && dois.has(c.doi)) return false;
      if (titles.has(util.normalizeTitle(c.title))) return false;
      return true;
    });
  },
};
