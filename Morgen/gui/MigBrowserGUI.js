// ============================================================
//  Morgen — gui/MigBrowserGUI.js
//  .mig file browser GUI
//  /mm gui  or  keybind
// ============================================================

import { msg } from "../utils/utils";
import Settings from "../utils/config";

// ─── Assets ───────────────────────────────────────────────────

function loadImg(name) {
    try {
        return new Image(javax.imageio.ImageIO.read(
            new java.io.File("./config/ChatTriggers/modules/Morgen/assets/" + name)
        ));
    } catch (e) { return null; }
}

var folderIcon    = loadImg("folder.png");
var migIcon       = loadImg("htsl.png");
var trashIcon     = loadImg("bin_closed.png");
var trashOpenIcon = loadImg("bin.png");

// ─── Sounds ───────────────────────────────────────────────────

var clickSound, paperSound;
try { clickSound = new Sound({ source: "click.ogg", category: "master" }); } catch (_) {}
try { paperSound = new Sound({ source: "paper.ogg", category: "master" }); } catch (_) {}

function playClick() { try { clickSound.rewind(); clickSound.play(); } catch (_) { World.playSound("random.click", 0.5, 1); } }
function playPaper() { try { paperSound.rewind(); paperSound.play(); } catch (_) { World.playSound("random.click", 0.3, 0.8); } }

// ─── Keybinds ─────────────────────────────────────────────────

var keyOpenGui    = new KeyBind("Open .mig Browser",   Keyboard.KEY_M,        "Morgen");
var keyRefresh    = new KeyBind("Refresh File List",   Keyboard.KEY_R,        "Morgen");
var keySpawnLast  = new KeyBind("Spawn Last Item",     Keyboard.KEY_L,        "Morgen");
var keyOpenFolder = new KeyBind("Open Imports Folder", Keyboard.KEY_O,        "Morgen");

var lastSpawnedPath = null;

register("tick", function() {
    if (keyOpenGui.isPressed())    openMigBrowser();
    if (keyOpenFolder.isPressed()) openImportsFolder();
    if (keyRefresh.isPressed() && guiOpen) {
        refresh();
        msg("&aRefreshed.");
    }
    if (keySpawnLast.isPressed()) {
        if (lastSpawnedPath) {
            ChatLib.command("mg " + lastSpawnedPath, true);
            msg("&aSpawned last: &e" + lastSpawnedPath);
        } else {
            msg("&cNo item spawned yet this session.");
        }
    }
});

// ─── State ────────────────────────────────────────────────────

var gui          = new Gui();
var guiOpen      = false;
var allFiles     = [];   // flat list of ALL files recursively (for search)
var files        = [];   // files in current dir only
var filtered     = [];   // current display list (search or dir)
var subDir       = "";
var page         = 0;
var hoverIdx     = -1;
var searchText   = "";
var searchActive = false;
var isSearchMode = false; // true = showing recursive results
var linesPerPage = 10;

// drag state
var dragging     = false;
var dragOffX     = 0;
var dragOffY     = 0;
var panelOffX    = 0;  // user-dragged offset from center
var panelOffY    = 0;

// layout (recalculated each frame)
var L = {};

// ─── File reading ─────────────────────────────────────────────

var IMPORTS_BASE = "./config/ChatTriggers/modules/Morgen/imports/";

// Read only direct children of path
function readDirShallow(path) {
    var result = [];
    try {
        var dir = new java.io.File(path);
        if (!dir.exists()) { dir.mkdirs(); return result; }
        var entries = dir.listFiles();
        if (!entries) return result;
        for (var i = 0; i < entries.length; i++) {
            var f = entries[i];
            if (f.isDirectory()) {
                result.push({ name: f.getName(), isDir: true, relPath: "" });
            } else if (f.getName().endsWith(".mig")) {
                result.push({ name: f.getName(), isDir: false, relPath: "" });
            }
        }
        result.sort(function(a, b) {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });
    } catch (e) { console.log("[MigBrowser] readDirShallow: " + e); }
    return result;
}

// Read ALL .mig files recursively, storing relative path from imports root
function readDirRecursive(path, relBase) {
    var result = [];
    try {
        var dir = new java.io.File(path);
        if (!dir.exists()) return result;
        var entries = dir.listFiles();
        if (!entries) return result;
        for (var i = 0; i < entries.length; i++) {
            var f = entries[i];
            if (f.isDirectory()) {
                var sub = readDirRecursive(path + f.getName() + "/", relBase + f.getName() + "/");
                for (var j = 0; j < sub.length; j++) result.push(sub[j]);
            } else if (f.getName().endsWith(".mig")) {
                result.push({
                    name: f.getName(),
                    isDir: false,
                    relPath: relBase   // folder path relative to imports root
                });
            }
        }
        result.sort(function(a, b) {
            var pa = a.relPath + a.name, pb = b.relPath + b.name;
            return pa.toLowerCase() < pb.toLowerCase() ? -1 : 1;
        });
    } catch (e) { console.log("[MigBrowser] readDirRecursive: " + e); }
    return result;
}

function refresh() {
    page     = 0;
    hoverIdx = -1;
    files    = readDirShallow(IMPORTS_BASE + subDir);
    allFiles = readDirRecursive(IMPORTS_BASE, "");
    applyFilter();
}

function applyFilter() {
    page = 0;
    if (!searchText || searchText === "") {
        isSearchMode = false;
        filtered = files.slice();
    } else {
        isSearchMode = true;
        // Search across ALL files recursively
        var q = searchText.toLowerCase();
        filtered = allFiles.filter(function(f) {
            return (f.relPath + f.name).toLowerCase().indexOf(q) !== -1;
        });
    }
}

// ─── Layout ───────────────────────────────────────────────────

function calcLayout() {
    var sw = Renderer.screen.getWidth();
    var sh = Renderer.screen.getHeight();
    var panelW = Math.min(270, Math.max(200, Math.floor(sw * 0.32)));
    var panelH = Math.floor(sh * 0.78);
    var panelX = Math.floor(sw / 2 - panelW / 2) + panelOffX;
    var panelY = Math.floor(sh / 2 - panelH / 2) + panelOffY;
    // clamp to screen
    panelX = Math.max(0, Math.min(panelX, sw - panelW));
    panelY = Math.max(0, Math.min(panelY, sh - panelH));

    var headerH  = 22;
    var searchH  = 18;
    var footerH  = 24;
    var listY    = panelY + headerH + searchH + 8;
    var listH    = panelH - headerH - searchH - footerH - 12;
    linesPerPage = Math.max(1, Math.floor(listH / 20));

    L = {
        sw: sw, sh: sh,
        panelX: panelX, panelY: panelY,
        panelW: panelW, panelH: panelH,
        headerH: headerH, searchH: searchH,
        listY: listY, listH: listH,
        listX: panelX + 6, listW: panelW - 12,
        footerY: panelY + panelH - footerH,
        searchX: panelX + 6, searchY: panelY + headerH + 3,
        searchW: panelW - 12,
    };
}

// ─── Draw ─────────────────────────────────────────────────────

gui.registerDraw(function(mx, my) {
    calcLayout();

    // drag logic — header drag area
    if (dragging) {
        panelOffX = mx - dragOffX - Math.floor(L.sw / 2 - L.panelW / 2);
        panelOffY = my - dragOffY - Math.floor(L.sh / 2 - L.panelH / 2);
        calcLayout(); // recalc with new offset
    }

    // panel bg
    Renderer.drawRect(Renderer.color(18, 18, 22, 235), L.panelX, L.panelY, L.panelW, L.panelH);
    // outer border
    drawBorder(L.panelX, L.panelY, L.panelW, L.panelH, Renderer.color(70, 70, 90, 255), 1);

    // ── Header ────────────────────────────────────────────────
    Renderer.drawRect(Renderer.color(35, 35, 50, 255), L.panelX, L.panelY, L.panelW, L.headerH);
    var titlePath = isSearchMode
        ? "&8[search] &7" + searchText
        : (subDir === "" ? "&6Morgen &7— &fImports" : "&8/ &e" + subDir.replace(/\/$/, ""));
    Renderer.drawString(titlePath, L.panelX + 7, L.panelY + 7, true);
    // drag hint
    Renderer.drawString("&8⠿", L.panelX + L.panelW - 12, L.panelY + 7, true);

    // ── Search bar ────────────────────────────────────────────
    var sActive = searchActive;
    Renderer.drawRect(
        sActive ? Renderer.color(40, 40, 60, 255) : Renderer.color(28, 28, 36, 255),
        L.searchX, L.searchY, L.searchW, L.searchH);
    drawBorder(L.searchX, L.searchY, L.searchW, L.searchH,
        sActive ? Renderer.color(100, 100, 160, 200) : Renderer.color(55, 55, 70, 200), 1);
    var searchDisplay = searchText === "" ? "&8\uD83D\uDD0D Search all files..." : "&f" + searchText;
    Renderer.drawString(searchDisplay, L.searchX + 4, L.searchY + 4, true);
    // blinking cursor
    if (sActive && (Date.now() % 900) < 450) {
        var cx = L.searchX + 4 + Renderer.getStringWidth(searchText);
        Renderer.drawRect(Renderer.color(180, 180, 220, 210), cx, L.searchY + 2, 1, 13);
    }

    // ── Separator ─────────────────────────────────────────────
    Renderer.drawRect(Renderer.color(55, 55, 75, 200), L.panelX + 4, L.listY - 3, L.panelW - 8, 1);

    // ── File list ─────────────────────────────────────────────
    hoverIdx = -1;
    var start = page * linesPerPage;
    var end   = Math.min(start + linesPerPage, filtered.length);

    if (filtered.length === 0) {
        var emptyMsg = isSearchMode ? "&8No results for &7\"" + searchText + "&7\"" : "&8No .mig files here.";
        Renderer.drawString(emptyMsg, L.listX + 4, L.listY + 6, true);
    }

    for (var i = start; i < end; i++) {
        var entry  = filtered[i];
        var rowY   = L.listY + (i - start) * 20;
        var isHov  = (mx >= L.listX && mx <= L.listX + L.listW && my >= rowY && my <= rowY + 18);
        if (isHov) hoverIdx = i;

        // hover bg
        if (isHov) Renderer.drawRect(Renderer.color(50, 50, 70, 200), L.listX, rowY, L.listW, 19);

        // icon
        var icon = entry.isDir ? folderIcon : migIcon;
        if (icon) Renderer.drawImage(icon, L.listX + 1, rowY + 1, 16, 16);

        // label
        var displayLabel = buildLabel(entry);
        Renderer.drawString(displayLabel, L.listX + 21, rowY + 4, true);

        // in search mode: show folder path in grey
        if (isSearchMode && entry.relPath) {
            var pathStr = "&8" + entry.relPath.replace(/\/$/, "");
            var pathW   = Renderer.getStringWidth(entry.relPath);
            Renderer.drawString(pathStr,
                L.listX + L.listW - pathW - 22, rowY + 4, true);
        }

        // trash icon on hover (files only)
        if (isHov && !entry.isDir) {
            var tx = L.listX + L.listW - 18;
            var onT = mx >= tx && mx <= tx + 16;
            var ti  = onT ? trashOpenIcon : trashIcon;
            if (ti) Renderer.drawImage(ti, tx, rowY + 1, 16, 16);
        }
    }

    // ── Footer ────────────────────────────────────────────────
    Renderer.drawRect(Renderer.color(30, 30, 40, 255), L.panelX, L.footerY, L.panelW, 24);
    Renderer.drawRect(Renderer.color(55, 55, 75, 200), L.panelX + 4, L.footerY, L.panelW - 8, 1);

    // Back button
    if (!isSearchMode && subDir !== "") {
        drawTextBtn("\u21AA Back", L.panelX + 6, L.footerY + 4, 55, 16, mx, my);
    }
    if (isSearchMode) {
        drawTextBtn("\u2715 Clear", L.panelX + 6, L.footerY + 4, 55, 16, mx, my);
    }

    // Refresh button
    drawTextBtn("\u27F3", L.panelX + L.panelW - 22, L.footerY + 4, 16, 16, mx, my);

    // Pagination
    var totalPages = Math.max(1, Math.ceil(filtered.length / linesPerPage));
    var cx = L.panelX + L.panelW / 2;
    var pageStr = "&7" + (page + 1) + "&8/&7" + totalPages;
    Renderer.drawString(pageStr, cx - Renderer.getStringWidth((page+1) + "/" + totalPages) / 2, L.footerY + 7, true);
    if (page > 0)              drawTextBtn("<", cx - 22, L.footerY + 4, 16, 16, mx, my);
    if (page + 1 < totalPages) drawTextBtn(">", cx + 6,  L.footerY + 4, 16, 16, mx, my);

    // file count
    var cnt = "&8" + filtered.length + (isSearchMode ? " result" : " file") + (filtered.length !== 1 ? "s" : "");
    Renderer.drawString(cnt, L.panelX + L.panelW - Renderer.getStringWidth(filtered.length + " results") - 26, L.footerY + 7, true);
});

// ─── Draw helpers ─────────────────────────────────────────────

function drawBorder(x, y, w, h, color, t) {
    Renderer.drawRect(color, x, y, w, t);
    Renderer.drawRect(color, x, y + h - t, w, t);
    Renderer.drawRect(color, x, y, t, h);
    Renderer.drawRect(color, x + w - t, y, t, h);
}

function drawTextBtn(label, x, y, w, h, mx, my) {
    var hov = mx >= x && mx <= x + w && my >= y && my <= y + h;
    Renderer.drawRect(hov ? Renderer.color(70, 70, 100, 220) : Renderer.color(45, 45, 60, 200), x, y, w, h);
    drawBorder(x, y, w, h, Renderer.color(80, 80, 110, 180), 1);
    var lw = Renderer.getStringWidth(label);
    Renderer.drawString("&f" + label, x + w / 2 - lw / 2, y + h / 2 - 3, true);
}

function buildLabel(entry) {
    var name = entry.name;
    var q    = searchText.toLowerCase();
    if (entry.isDir) return "&e" + name + "&8/";
    var base = name.replace(/\.mig$/, "");
    if (searchText === "") return "&f" + base + "&8.mig";
    // highlight match
    var full = (entry.relPath || "") + name;
    var idx  = full.toLowerCase().indexOf(q);
    if (idx === -1) return "&f" + base + "&8.mig";
    // highlight within the name portion only
    var nameIdx = name.toLowerCase().indexOf(q);
    if (nameIdx === -1) return "&f" + base + "&8.mig";
    var pre   = name.substring(0, nameIdx);
    var match = name.substring(nameIdx, nameIdx + searchText.length);
    var post  = name.substring(nameIdx + searchText.length).replace(/\.mig$/, "");
    return "&f" + pre + "&e&n" + match + "&r&f" + post + "&8.mig";
}

// ─── Mouse events ─────────────────────────────────────────────

gui.registerClicked(function(mx, my, btn) {
    calcLayout();

    // Right-click anywhere = go up / clear search
    if (btn === 1) {
        if (isSearchMode) { searchText = ""; searchActive = false; applyFilter(); }
        else if (subDir !== "") goUp();
        return;
    }
    if (btn !== 0) return;

    // Header drag start
    if (mx >= L.panelX && mx <= L.panelX + L.panelW &&
        my >= L.panelY && my <= L.panelY + L.headerH) {
        dragging = true;
        dragOffX = mx - (Math.floor(L.sw / 2 - L.panelW / 2) + panelOffX);
        dragOffY = my - (Math.floor(L.sh / 2 - L.panelH / 2) + panelOffY);
        return;
    }

    // Search bar
    if (mx >= L.searchX && mx <= L.searchX + L.searchW &&
        my >= L.searchY && my <= L.searchY + L.searchH) {
        searchActive = true;
        return;
    }
    searchActive = false;

    // Footer buttons
    var cx = L.panelX + L.panelW / 2;
    var totalPages = Math.max(1, Math.ceil(filtered.length / linesPerPage));

    // Refresh
    if (hitArea(mx, my, L.panelX + L.panelW - 22, L.footerY + 4, 16, 16)) {
        refresh(); playClick(); return;
    }
    // Back / Clear
    if (hitArea(mx, my, L.panelX + 6, L.footerY + 4, 55, 16)) {
        if (isSearchMode) { searchText = ""; searchActive = false; applyFilter(); }
        else { goUp(); }
        playClick(); return;
    }
    // Page prev
    if (page > 0 && hitArea(mx, my, cx - 22, L.footerY + 4, 16, 16)) {
        page--; playClick(); return;
    }
    // Page next
    if (page + 1 < totalPages && hitArea(mx, my, cx + 6, L.footerY + 4, 16, 16)) {
        page++; playClick(); return;
    }

    // File list
    if (hoverIdx >= 0 && hoverIdx < filtered.length) {
        var entry = filtered[hoverIdx];
        if (!entry.isDir) {
            var tx = L.listX + L.listW - 18;
            if (mx >= tx && mx <= tx + 16) { deleteFile(entry); return; }
            loadMig(entry);
        } else {
            subDir += entry.name + "/";
            refresh(); playClick();
        }
    }
});

gui.registerMouseDragged(function(mx, my, btn) {
    // dragging is handled in draw loop
});

register("guiMouseRelease", function(mx, my, btn) {
    dragging = false;
});

// ─── Keyboard ─────────────────────────────────────────────────

gui.registerKeyTyped(function(char, code) {
    if (code === 1) { gui.close(); return; } // ESC

    // Even when search not "active", typing anything opens search
    if (code === 14) { // Backspace
        if (searchText.length > 0) {
            searchText = searchText.substring(0, searchText.length - 1);
            applyFilter();
        } else {
            // backspace on empty search = go up
            if (isSearchMode) { searchActive = false; applyFilter(); }
            else if (subDir !== "") goUp();
        }
        return;
    }

    if (char && char !== "\u0000") {
        searchText += char;
        searchActive = true;
        applyFilter();
    }
});

// ─── Actions ──────────────────────────────────────────────────

function loadMig(entry) {
    // relPath is the folder, name is the filename — strip .mig
    var path = (entry.relPath || subDir) + entry.name.replace(/\.mig$/, "");
    lastSpawnedPath = path;
    gui.close();
    setTimeout(function() {
        ChatLib.command("mg " + path, true);
    }, 80);
}

function deleteFile(entry) {
    var relPath = (entry.relPath || subDir) + entry.name;
    try {
        var f = new java.io.File(IMPORTS_BASE + relPath);
        f.delete();
        playPaper();
        refresh();
        msg("&aDeleted &e" + relPath);
    } catch (e) {
        msg("&cDelete failed: " + e);
    }
}

function goUp() {
    var s = subDir.replace(/\/$/, "");
    var last = s.lastIndexOf("/");
    subDir = last === -1 ? "" : s.substring(0, last + 1);
    refresh();
}

function openImportsFolder() {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var dir  = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports");
        if (!dir.exists()) dir.mkdirs();
        java.awt.Desktop.getDesktop().open(dir);
        msg("&aOpened imports folder.");
    } catch (e) { msg("&cCould not open folder: " + e); }
}

function hitArea(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

// ─── GUI lifecycle ────────────────────────────────────────────

register("guiClosed", function() {
    guiOpen  = false;
    dragging = false;
});

export function openMigBrowser() {
    subDir       = "";
    searchText   = "";
    searchActive = false;
    isSearchMode = false;
    page         = 0;
    panelOffX    = 0;
    panelOffY    = 0;
    dragging     = false;
    refresh();
    guiOpen = true;
    gui.open();
}