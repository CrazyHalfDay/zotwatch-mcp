// ZotWatch — Zotero 7 bootstrap entry.
// Loads the core modules onto Zotero.ZotWatch, registers the preferences pane
// and Fluent locales, and adds a Tools-menu item that opens the feed dialog.

var ZotWatch_rootURI;

// Core module files, loaded in dependency-safe order (cross-refs are lazy).
const ZW_MODULES = [
  "util",
  "storage",
  "embedding",
  "llm",
  "profile",
  "fetch",
  "dedupe",
  "rank",
  "summarize",
  "importer",
  "orchestrator",
];

function log(msg) {
  Zotero.debug("ZotWatch: " + msg);
}

function registerFluent(rootURI) {
  // Best-effort Fluent registration. If this fails, the prefs pane still works
  // but shows raw l10n ids (see SETTINGS.md for the fallback).
  try {
    const { L10nFileSource, L10nRegistry } = ChromeUtils.importESModule(
      "resource://gre/modules/L10nRegistry.sys.mjs"
    );
    const reg = L10nRegistry.getInstance();
    const source = new L10nFileSource(
      "zotwatch",
      "app",
      ["zh-CN", "en-US"],
      rootURI + "locale/{locale}/"
    );
    reg.registerSources([source]);
  } catch (e) {
    log("Fluent registration failed: " + e);
  }
}

function addToWindow(win) {
  const doc = win.document;
  if (doc.getElementById("zotwatch-menuitem")) return;
  const item = doc.createXULElement("menuitem");
  item.id = "zotwatch-menuitem";
  item.setAttribute("label", "ZotWatch 推荐…");
  item.addEventListener("command", () => {
    win.openDialog(
      ZotWatch_rootURI + "content/feed.xhtml",
      "zotwatch-feed",
      "chrome,resizable,centerscreen,width=920,height=720"
    );
  });
  const toolsPopup = doc.getElementById("menu_ToolsPopup");
  if (toolsPopup) toolsPopup.appendChild(item);
}

function removeFromWindow(win) {
  const item = win.document.getElementById("zotwatch-menuitem");
  if (item) item.remove();
}

// ── Bootstrap lifecycle ─────────────────────────────────────────────────────

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;
  ZotWatch_rootURI = rootURI;

  Zotero.ZotWatch = Zotero.ZotWatch || {};
  Zotero.ZotWatch.rootURI = rootURI;

  // config.js defines ZWConfig in this scope; expose it on the namespace.
  Services.scriptloader.loadSubScript(rootURI + "content/config.js");
  Zotero.ZotWatch.config = ZWConfig;

  for (const m of ZW_MODULES) {
    Services.scriptloader.loadSubScript(rootURI + `content/${m}.js`);
  }

  registerFluent(rootURI);

  Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "content/preferences.xhtml",
    scripts: [rootURI + "content/config.js", rootURI + "content/preferences.js"],
    stylesheets: [rootURI + "content/preferences.css"],
    label: "ZotWatch",
  });

  for (const win of Zotero.getMainWindows()) addToWindow(win);
  log("started v" + version);
}

function onMainWindowLoad({ window }) {
  addToWindow(window);
}

function onMainWindowUnload({ window }) {
  removeFromWindow(window);
}

function shutdown() {
  for (const win of Zotero.getMainWindows()) removeFromWindow(win);
  if (typeof Zotero !== "undefined") Zotero.ZotWatch = undefined;
}

function install() {}
function uninstall() {}
