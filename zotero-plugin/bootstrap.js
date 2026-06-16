// ZotWatch — Zotero 7/8/9 bootstrap entry.
// Loads the core modules onto Zotero.ZotWatch, registers the preferences pane,
// and adds a Tools-menu item that opens the feed dialog.

var ZotWatch_rootURI;
var ZotWatch_menuID = null; // returned by Zotero.MenuManager.registerMenu (8/9)

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

function openFeed() {
  const win = Zotero.getMainWindow();
  if (!win) return;
  win.openDialog(
    ZotWatch_rootURI + "content/feed.xhtml",
    "zotwatch-feed",
    "chrome,resizable,centerscreen,width=920,height=720"
  );
}

// Preferred path on Zotero 8/9: register a menu item once via MenuManager.
function registerMenu(id) {
  if (!Zotero.MenuManager || !Zotero.MenuManager.registerMenu) return false;
  try {
    ZotWatch_menuID = Zotero.MenuManager.registerMenu({
      menuID: "zotwatch-tools",
      pluginID: id,
      target: "main/menubar/tools",
      menus: [
        {
          menuType: "menuitem",
          l10nID: "zw-menu-open",
          onCommand: () => openFeed(),
        },
      ],
    });
    return true;
  } catch (e) {
    log("MenuManager.registerMenu failed: " + e);
    return false;
  }
}

// Fallback for older Zotero: inject a menuitem into each main window.
function addToWindow(win) {
  const doc = win.document;
  if (doc.getElementById("zotwatch-menuitem")) return;
  const item = doc.createXULElement("menuitem");
  item.id = "zotwatch-menuitem";
  item.setAttribute("label", "ZotWatch 推荐…");
  item.addEventListener("command", () => openFeed());
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

  // Zotero 8/9 auto-registers locale/<locale>/*.ftl by file name, so no manual
  // Fluent registration is needed.

  try {
    await Zotero.PreferencePanes.register({
      pluginID: id,
      src: rootURI + "content/preferences.xhtml",
      scripts: [rootURI + "content/config.js", rootURI + "content/preferences.js"],
      stylesheets: [rootURI + "content/preferences.css"],
      label: "ZotWatch",
    });
  } catch (e) {
    log("PreferencePanes.register failed: " + e);
  }

  // Menu: prefer the MenuManager API; fall back to manual DOM injection.
  if (!registerMenu(id)) {
    for (const win of Zotero.getMainWindows()) addToWindow(win);
  }
  log("started v" + version);
}

function onMainWindowLoad({ window }) {
  if (!ZotWatch_menuID) addToWindow(window);
}

function onMainWindowUnload({ window }) {
  removeFromWindow(window);
}

function shutdown() {
  try {
    if (ZotWatch_menuID && Zotero.MenuManager && Zotero.MenuManager.unregisterMenu) {
      Zotero.MenuManager.unregisterMenu(ZotWatch_menuID);
    }
  } catch (e) {
    /* ignore */
  }
  for (const win of Zotero.getMainWindows()) removeFromWindow(win);
  if (typeof Zotero !== "undefined") Zotero.ZotWatch = undefined;
}

function install() {}
function uninstall() {}
