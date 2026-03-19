import { msg } from "../utils/utils";
import Settings from "../utils/config";

var A = "config/ChatTriggers/modules/Morgen/assets/";
function loadImg(n) { try { return new Image(A + n); } catch(_) { return null; } }
var I_FOLDER = loadImg("folder.png"), I_MIG = loadImg("paper.png");
var I_JSON   = loadImg("item.png"), I_TRASH = loadImg("bin_closed.png"), I_TRASH_OPEN = loadImg("bin.png");

function drawFallback(x, y, isDir, isJson, isTrash, isTrashOpen) {
    if (isTrash) {
        // Open bin — lid lifted
        if (isTrashOpen) {
            Renderer.drawRect(Renderer.color(220,80,80,240), x+2, y+5, 12, 10);   // body
            Renderer.drawRect(Renderer.color(255,120,120,220), x+1, y+2, 14, 2);  // open lid
            Renderer.drawRect(Renderer.color(255,120,120,220), x+5, y+1, 6, 2);   // handle
        } else {
            Renderer.drawRect(Renderer.color(200,50,50,220), x+2, y+5, 12, 10);   // body
            Renderer.drawRect(Renderer.color(220,70,70,220), x+1, y+3, 14, 3);    // closed lid
            Renderer.drawRect(Renderer.color(220,70,70,200), x+5, y+1, 6, 2);     // handle
        }
    } else if (isDir) {
        Renderer.drawRect(Renderer.color(230,180,40,220), x+1, y+5, 14, 9);
        Renderer.drawRect(Renderer.color(230,180,40,220), x+1, y+3, 7, 4);
    } else if (isJson) {
        Renderer.drawRect(Renderer.color(60,180,90,220), x+2, y+1, 12, 14);
        Renderer.drawRect(Renderer.color(100,220,130,180), x+3, y+4, 5, 2);
        Renderer.drawRect(Renderer.color(100,220,130,180), x+3, y+7, 7, 2);
        Renderer.drawRect(Renderer.color(100,220,130,180), x+3, y+10, 4, 2);
    } else {
        Renderer.drawRect(Renderer.color(70,120,220,220), x+2, y+1, 12, 14);
        Renderer.drawRect(Renderer.color(140,180,255,180), x+3, y+4, 6, 2);
        Renderer.drawRect(Renderer.color(140,180,255,180), x+3, y+7, 8, 2);
        Renderer.drawRect(Renderer.color(140,180,255,180), x+3, y+10, 5, 2);
    }
}

function drawImg(img, x, y, w, h, isDir, isJson, isTrash, isTrashOpen) {
    if (img) { try { Renderer.drawImage(img, x, y, w, h); return; } catch(_) {} }
    drawFallback(x, y, isDir, isJson, isTrash, isTrashOpen);
}

var sndC, sndP;
try { sndC = new Sound({ source: "click.ogg", category: "master" }); } catch(_) {}
try { sndP = new Sound({ source: "paper.ogg", category: "master" }); } catch(_) {}
function playClick() { try { sndC.rewind(); sndC.play(); } catch(_) { World.playSound("random.click", 0.5, 1); } }
function playPaper() { try { sndP.rewind(); sndP.play(); } catch(_) { World.playSound("random.click", 0.3, 0.8); } }

var kOpen   = new KeyBind("Open .mig Browser",    Keyboard.KEY_M, "Morgen");
var kRef    = new KeyBind("Refresh File List",     Keyboard.KEY_R, "Morgen");
var kLast   = new KeyBind("Spawn Last Item",       Keyboard.KEY_L, "Morgen");
var kFolder = new KeyBind("Open Imports Folder",   Keyboard.KEY_O, "Morgen");
var lastPath = null;

register("tick", function() {
    if (kOpen.isPressed())   openMigBrowser();
    if (kFolder.isPressed()) openFolder();
    if (kRef.isPressed() && open2) { refresh(); msg("&aRefreshed."); }
    if (kLast.isPressed() && lastPath) ChatLib.command("mm import " + lastPath, true);
});

var gui = new Gui(), open2 = false;
var allFiles = [], files = [], filtered = [];
var subDir = "", scrollTop = 0, hoverIdx = -1;
var searchText = "", searchActive = false, searchMode = false;
var perPage = 10;
var dragging = false, dOX = 0, dOY = 0, pOX = 0, pOY = 0;
var guiScale = 1.0;
var resizeMode = false;
var previewCache = {}, previewEntry = null;

var BASE = "./config/ChatTriggers/modules/Morgen/imports/";

function readShallow(path) {
    var r = [];
    try {
        var d = new java.io.File(path);
        if (!d.exists()) { d.mkdirs(); return r; }
        var e = d.listFiles(); if (!e) return r;
        for (var i = 0; i < e.length; i++) {
            var f = e[i], n = f.getName();
            if (f.isDirectory())         r.push({ name: n, isDir: true,  isJson: false, rel: "" });
            else if (n.endsWith(".mig"))  r.push({ name: n, isDir: false, isJson: false, rel: "" });
            else if (n.endsWith(".json")) r.push({ name: n, isDir: false, isJson: true,  rel: "" });
        }
        r.sort(function(a, b) {
            if (a.isDir && !b.isDir) return -1; if (!a.isDir && b.isDir) return 1;
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });
    } catch(e) {}
    return r;
}

function readRecursive(path, base) {
    var r = [];
    try {
        var d = new java.io.File(path); if (!d.exists()) return r;
        var e = d.listFiles(); if (!e) return r;
        for (var i = 0; i < e.length; i++) {
            var f = e[i], n = f.getName();
            if (f.isDirectory()) {
                var s = readRecursive(path + n + "/", base + n + "/");
                for (var j = 0; j < s.length; j++) r.push(s[j]);
            } else if (n.endsWith(".mig") || n.endsWith(".json")) {
                r.push({ name: n, isDir: false, isJson: n.endsWith(".json"), rel: base });
            }
        }
    } catch(e) {}
    return r;
}

function refresh() {
    scrollTop = 0; hoverIdx = -1; previewEntry = null;
    files    = readShallow(BASE + subDir);
    allFiles = readRecursive(BASE, "");
    filter();
}

function filter() {
    scrollTop = 0;
    if (!searchText) { searchMode = false; filtered = files.slice(); return; }
    searchMode = true;
    var q = searchText.toLowerCase();
    filtered = allFiles.filter(function(f) { return (f.rel + f.name).toLowerCase().indexOf(q) !== -1; });
}

function parseMigPreview(raw) {
    if (!raw) return null;
    try {
        var clean = raw.split("\n").map(function(l) {
            var inQ = false;
            for (var i = 0; i < l.length; i++) {
                if (l[i] === '"') inQ = !inQ;
                if (!inQ && l[i] === '#') return l.slice(0, i);
            }
            return l;
        }).join("\n");

        var idM    = clean.match(/ITEM\s+"([^"]+)"/);
        var nameM  = clean.match(/^\s*Name:\s*(?:list\()?["']?([^"'\n\)]+)/m);
        var amtM   = clean.match(/^\s*Amount:\s*(\d+)/m);
        var dmgM   = clean.match(/^\s*Damage:\s*(\d+)/m);
        var cntM   = clean.match(/^\s*Count:\s*(\d+)/m);
        var glowM  = clean.match(/^\s*Glow:\s*(true|false)/im);
        var unbrM  = clean.match(/^\s*Unbreakable:\s*(true|false)/im);
        var typeM  = clean.match(/^\s*ItemType:\s*"([^"]+)"/im);

        var lore = [];
        var ls = clean.indexOf("Lore:");
        if (ls !== -1) {
            var ms = clean.slice(ls).match(/"((?:[^"\\]|\\.)*)"/g);
            if (ms) lore = ms.slice(0, 12).map(function(s) {
                return s.slice(1, -1).replace(/\\"/g, '"').replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
            });
        }

        var names = [];
        if (nameM) {
            var nv = nameM[0].replace(/^\s*Name:\s*/, "").trim();
            if (nv.indexOf("list(") !== -1) {
                var inner = nv.slice(nv.indexOf("(") + 1);
                names = inner.split(",").map(function(p) {
                    return p.trim().replace(/^["']|["']\)?$/g, "");
                }).filter(function(p) { return p.length > 0; });
            } else {
                var q2 = nv.replace(/^["']|["']$/g, "");
                if (q2) names = [q2];
            }
        }

        // Texture: first try Texture field, then SkullOwnerJSON
        var texture = null;
        var texM2 = clean.match(/^\s*Texture:\s*"([^"]+)"/m);
        if (texM2) {
            texture = texM2[1];
        } else {
            var soM = clean.match(/^\s*SkullOwnerJSON:\s*(\{[\s\S]+?\})\s*$/m);
            if (soM) {
                try {
                    var so = JSON.parse(soM[1]);
                    var texList = so.Properties && so.Properties.textures;
                    if (texList) {
                        var first = Array.isArray(texList) ? texList[0]
                            : (texList[0] !== undefined ? texList[0] : texList["0"]);
                        if (first) texture = "" + first.Value;
                    }
                } catch(_) {}
            }
        }

        return {
            id:      idM   ? idM[1]              : "minecraft:stone",
            names:   names.length > 0 ? names : ["Item"],
            amount:  amtM  ? parseInt(amtM[1])   : 1,
            damage:  dmgM  ? parseInt(dmgM[1])   : 0,
            count:   cntM  ? parseInt(cntM[1])   : 1,
            glow:    glowM  ? glowM[1] === "true" : false,
            unbreak: unbrM  ? unbrM[1] === "true" : false,
            type:    typeM  ? typeM[1]             : null,
            texture: texture,
            lore:    lore
        };
    } catch(e) { return null; }
}

function getPreview(entry) {
    if (!entry || entry.isDir) return null;
    var key = (entry.rel || "") + entry.name;
    if (previewCache[key]) return previewCache[key];
    try {
        var raw = FileLib.read(BASE + key);
        if (!raw) return null;
        var data;
        if (entry.isJson) {
            var parsed = JSON.parse(raw);
            var tex = parsed.texture || null;
            if (!tex && parsed.skullOwner) {
                try {
                    var texList = parsed.skullOwner.Properties.textures;
                    var first = Array.isArray(texList) ? texList[0]
                        : (texList[0] !== undefined ? texList[0] : texList["0"]);
                    if (first) tex = "" + first.Value;
                } catch(_) {}
            }
            data = {
                id: parsed.itemId || "json", names: [parsed.name || entry.name.replace(/\.json$/, "")],
                amount: 1, lore: parsed.lore || [], damage: parsed.damage || 0,
                count: parsed.count || 1, glow: parsed.glow || false, unbreak: parsed.unbreakable || false,
                type: parsed.itemType || null, texture: tex
            };
        } else {
            data = parseMigPreview(raw);
        }
        if (data) previewCache[key] = data;
        return data;
    } catch(e) { return null; }
}

var L = {};

function layout() {
    var sw = Renderer.screen.getWidth(), sh = Renderer.screen.getHeight();
    var baseW = Math.min(260, Math.max(200, Math.floor(sw * 0.28)));
    var baseH = Math.floor(sh * 0.8);
    var pW = Math.floor(baseW * guiScale);
    var pH = Math.floor(baseH * (1.0 + (guiScale - 1.0) * 0.25));
    pH = Math.max(180, Math.min(sh - 20, pH));
    var pX = Math.max(0, Math.min(Math.floor(sw/2 - pW/2) + pOX, sw - pW));
    var pY = Math.max(0, Math.min(Math.floor(sh/2 - pH/2) + pOY, sh - pH));
    var hH = 28, sH = 20, fH = 26;
    var lY = pY + hH + sH + 10, lH = pH - hH - sH - fH - 14;
    perPage = Math.max(1, Math.floor(lH / 27));
    var pvW = 145, pvX = pX + pW + 6;
    if (pvX + pvW > sw) pvX = pX - pvW - 6;
    L = {
        sw: sw, sh: sh, pX: pX, pY: pY, pW: pW, pH: pH,
        hH: hH, sH: sH, fH: fH,
        lX: pX+7, lW: pW-14, lY: lY, lH: lH,
        fY: pY + pH - fH,
        sX: pX+7, sY: pY + hH + 4, sW: pW-14,
        fbX: pX + pW - 23, fbY: pY + 6, fbW: 17, fbH: 15,
        pvX: pvX, pvY: pY, pvW: pvW
    };
}

// ─── Recalculate which row index + which button the mouse is on ───────────────
// This is called both in Draw (for visual hover) AND in Click (for correct hit).
// Returns { idx, onTrash, onEdit, rowY } or null if no row hit.
function hitTestRows(mx, my) {
    var start = scrollTop, end = Math.min(start + perPage, filtered.length);
    var rowY  = L.lY;
    for (var i = start; i < end; i++) {
        var e    = filtered[i];
        var rowH = searchMode && e.rel ? 26 : 21;
        if (my >= rowY && my <= rowY + rowH - 1) {
            // row hit — now check sub-buttons
            var tx    = L.lX + L.lW - 36;
            var ex    = L.lX + L.lW - 18;
            var btnY  = rowY + Math.floor((rowH - 15) / 2);
            var onT   = !e.isDir && mx >= tx && mx <= tx + 15 && my >= btnY && my <= btnY + 15;
            var onE   = !e.isDir && mx >= ex && mx <= ex + 15 && my >= btnY && my <= btnY + 15;
            return { idx: i, entry: e, onTrash: onT, onEdit: onE, rowY: rowY, rowH: rowH };
        }
        rowY += rowH + 1;
    }
    return null;
}

var GOLD   = Renderer.color(198, 148, 32, 255);
var GOLD2  = Renderer.color(255, 200, 60, 255);
var PANEL  = Renderer.color(13, 14, 21, 248);
var BORDER = Renderer.color(52, 55, 82, 220);
var HDR_C  = Renderer.color(18, 20, 34, 255);
var DARK   = Renderer.color(0, 0, 0, 90);

function border1(x, y, w, h, col, t) {
    t = t || 1;
    Renderer.drawRect(col, x, y, w, t); Renderer.drawRect(col, x, y+h-t, w, t);
    Renderer.drawRect(col, x, y, t, h); Renderer.drawRect(col, x+w-t, y, t, h);
}

function drawBtn(lbl, x, y, w, h, mx, my, hovCol) {
    var hov = mx >= x && mx <= x+w && my >= y && my <= y+h;
    Renderer.drawRect(hov ? (hovCol || Renderer.color(70,76,115,230)) : Renderer.color(32,35,54,215), x, y, w, h);
    border1(x, y, w, h, hov ? GOLD : BORDER);
    var lw = Renderer.getStringWidth(lbl);
    Renderer.drawString("&f" + lbl, x + Math.floor((w-lw)/2), y + Math.floor(h/2)-3, true);
}

// ─── Skull rendering ──────────────────────────────────────────────────────────
function drawSkullWithTexture(texture, x, y, scale) {
    try {
        var IS2  = Java.type("net.minecraft.item.ItemStack");
        var IR2  = Java.type("net.minecraft.item.Item");
        var NBT2 = Java.type("net.minecraft.nbt.JsonToNBT");
        var mc   = IR2.func_111206_d("minecraft:skull");
        var stk  = new IS2(mc, 1, 3); // damage:3 = player skull
        if (texture) {
            var nbt = '{SkullOwner:{Id:"00000000-0000-0000-0000-000000000001",'
                    + 'Properties:{textures:[0:{Value:"' + texture + '"}]}}}';
            stk.func_77982_d(NBT2.func_180713_a(nbt));
        }
        new Item(stk).draw(x, y, scale || 1);
        return true;
    } catch(_) { return false; }
}

function drawPreviewPanel(mx, my) {
    var hit = hitTestRows(mx, my);
    var entry = hit ? hit.entry : null;
    if (!entry || entry.isDir) { previewEntry = null; return; }
    previewEntry = entry;
    var pv = getPreview(entry);
    if (!pv) return;

    var lineH = 11, rows = [];
    pv.names.slice(0, 3).forEach(function(n) { rows.push({ text: n.replace(/&([0-9a-fk-or])/gi, "\u00a7$1") }); });
    if (pv.names.length > 3) rows.push({ text: "\u00a78+" + (pv.names.length-3) + " names" });
    var meta = "\u00a78" + pv.id.replace("minecraft:", "") + " · dmg:" + pv.damage;
    if (pv.amount > 1) meta += " · x" + pv.amount;
    if (pv.type) meta += " · " + pv.type;
    rows.push({ text: meta });
    rows.push({ sep: true });
    if (pv.lore.length === 0) {
        rows.push({ text: "\u00a78(no lore)" });
    } else {
        pv.lore.slice(0, 14).forEach(function(l) { rows.push({ text: l === "" ? "\u00a78·" : l }); });
        if (pv.lore.length > 14) rows.push({ text: "\u00a78+" + (pv.lore.length-14) + " more" });
    }
    var flags = [];
    if (pv.glow)    flags.push("\u00a7dGlow");
    if (pv.unbreak) flags.push("\u00a7aUnbreak");
    if (flags.length) { rows.push({ sep: true }); rows.push({ text: flags.join("  ") }); }

    var minW = 120, maxW = 200, pvW = minW;
    rows.forEach(function(r) {
        if (!r.sep) { var rw = Renderer.getStringWidth(r.text.replace(/\u00a7./g,"")) + 20; if (rw > pvW) pvW = rw; }
    });
    pvW = Math.min(maxW, Math.max(minW, pvW));
    var pvH = 24 + rows.length * lineH + 8;
    var pvX = L.pvX, pvY = Math.min(L.pvY + 4, L.sh - pvH - 4);

    Renderer.drawRect(DARK, pvX+4, pvY+4, pvW, pvH);
    Renderer.drawRect(Renderer.color(13,14,21,242), pvX, pvY, pvW, pvH);
    Renderer.drawRect(GOLD, pvX, pvY, 2, pvH);
    border1(pvX, pvY, pvW, pvH, BORDER);
    Renderer.drawRect(HDR_C, pvX+2, pvY, pvW-2, 20);
    Renderer.drawRect(Renderer.color(198,148,32,60), pvX+2, pvY+19, pvW-2, 1);

    var isSkull = pv.id && pv.id.indexOf("skull") !== -1;
    var drewIcon = false;
    if (isSkull) drewIcon = drawSkullWithTexture(pv.texture || null, pvX+4, pvY+2, 1);
    if (!drewIcon) {
        try {
            var mcReg2 = Java.type("net.minecraft.item.Item").func_111206_d(pv.id);
            if (mcReg2) {
                var mcStk2 = new (Java.type("net.minecraft.item.ItemStack"))(mcReg2, 1, pv.damage || 0);
                var ctItem2 = new Item(mcStk2);
                if (ctItem2 && ctItem2.getID() !== 0) { ctItem2.draw(pvX+4, pvY+2, 1); drewIcon = true; }
            }
        } catch(_) {}
    }
    if (!drewIcon) drawImg(entry.isJson ? I_JSON : I_MIG, pvX+5, pvY+2, 15, 15, false, entry.isJson);

    var fname = entry.name.replace(/\.(mig|json)$/, "");
    var fnameMax = pvW - 30;
    while (fname.length > 1 && Renderer.getStringWidth(fname) > fnameMax) fname = fname.slice(0,-1);
    if (entry.name.replace(/\.(mig|json)$/,"").length > fname.length) fname += "\u2026";
    Renderer.drawString("\u00a7f" + fname + (entry.isJson ? "\u00a78.json" : "\u00a78.mig"), pvX+23, pvY+5, true);

    var ry = pvY + 23;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.sep) { Renderer.drawRect(Renderer.color(52,55,82,150), pvX+6, ry+3, pvW-12, 1); ry += 8; continue; }
        Renderer.drawString(row.text, pvX+8, ry, true);
        ry += lineH;
    }
}

gui.registerScrolled(function(mx, my, dir) {
    if (resizeMode) {
        guiScale = Math.round(Math.max(0.5, Math.min(2.0, guiScale + dir * 0.05)) * 20) / 20;
    } else {
        scrollTop = Math.max(0, Math.min(Math.max(0, filtered.length - perPage), scrollTop - dir));
    }
});

gui.registerDraw(function(mx, my) {
    layout();
    if (dragging) { pOX = mx - dOX - Math.floor(L.sw/2 - L.pW/2); pOY = my - dOY - Math.floor(L.sh/2 - L.pH/2); layout(); }

    Renderer.drawRect(DARK, L.pX+5, L.pY+5, L.pW, L.pH);
    Renderer.drawRect(PANEL, L.pX, L.pY, L.pW, L.pH);
    Renderer.drawRect(GOLD, L.pX, L.pY, 2, L.pH);
    border1(L.pX, L.pY, L.pW, L.pH, BORDER);

    Renderer.drawRect(HDR_C, L.pX+2, L.pY, L.pW-2, L.hH);
    Renderer.drawRect(Renderer.color(198,148,32,70), L.pX+2, L.pY+L.hH-1, L.pW-2, 1);
    Renderer.drawRect(GOLD, L.pX+9, L.pY+11, 4, 4);
    Renderer.drawRect(GOLD2, L.pX+10, L.pY+12, 2, 2);
    var title = searchMode
        ? "&8[search] &f" + searchText
        : (subDir === "" ? "&6Morgen &8» &7Imports" : "&8» &e" + subDir.replace(/\/$/, ""));
    Renderer.drawString(title, L.pX+18, L.pY+9, true);

    var onFb = mx >= L.fbX && mx <= L.fbX+L.fbW && my >= L.fbY && my <= L.fbY+L.fbH;
    Renderer.drawRect(onFb ? Renderer.color(198,148,32,190) : Renderer.color(32,35,50,200), L.fbX, L.fbY, L.fbW, L.fbH);
    border1(L.fbX, L.fbY, L.fbW, L.fbH, onFb ? GOLD : BORDER);
    drawImg(I_FOLDER, L.fbX+1, L.fbY, 15, 14, true, false);

    var sBg = searchActive ? Renderer.color(22,25,42,255) : Renderer.color(18,20,32,240);
    Renderer.drawRect(sBg, L.sX, L.sY, L.sW, L.sH);
    border1(L.sX, L.sY, L.sW, L.sH, searchActive ? GOLD : BORDER);
    Renderer.drawString("&8»", L.sX+4, L.sY+5, true);
    Renderer.drawString(searchText === "" ? "&8Search files..." : "&f" + searchText, L.sX+14, L.sY+5, true);
    if (searchActive && (Date.now() % 900) < 450)
        Renderer.drawRect(GOLD, L.sX+14+Renderer.getStringWidth(searchText), L.sY+3, 1, 12);

    Renderer.drawRect(Renderer.color(198,148,32,55), L.pX+2, L.lY-4, L.pW-2, 1);

    // Use hitTestRows to get current hover info for visual feedback
    var hit = hitTestRows(mx, my);
    hoverIdx = hit ? hit.idx : -1;

    var start = scrollTop, end = Math.min(start + perPage, filtered.length);
    if (filtered.length === 0)
        Renderer.drawString(searchMode ? "&8No results for \"&7" + searchText + "&8\"" : "&8No files here.", L.lX+4, L.lY+7, true);

    var rowY = L.lY;
    for (var i = start; i < end; i++) {
        var e    = filtered[i];
        var rowH = searchMode && e.rel ? 26 : 21;
        var isHovRow = (hoverIdx === i);

        if (isHovRow) {
            Renderer.drawRect(Renderer.color(26,30,50,200), L.lX, rowY, L.lW, rowH);
            Renderer.drawRect(GOLD, L.lX, rowY, 2, rowH);
        }

        var rowPv    = !e.isDir ? getPreview(e) : null;
        var drewItem = false;

        if (rowPv && rowPv.id) {
            try {
                var isSkullRow = rowPv.id.indexOf("skull") !== -1;
                if (isSkullRow) {
                    drewItem = drawSkullWithTexture(rowPv.texture || null, L.lX+4, rowY+(searchMode&&e.rel?3:1), 1);
                } else {
                    var mcRegRow = Java.type("net.minecraft.item.Item").func_111206_d(rowPv.id);
                    if (mcRegRow) {
                        var mcStkRow = new (Java.type("net.minecraft.item.ItemStack"))(mcRegRow, 1, rowPv.damage || 0);
                        var ctRow    = new Item(mcStkRow);
                        if (ctRow && ctRow.getID() !== 0) { ctRow.draw(L.lX+4, rowY+(searchMode&&e.rel?3:1), 1); drewItem = true; }
                    }
                }
            } catch(_) {}
        }
        if (!drewItem)
            drawImg(e.isDir ? I_FOLDER : (e.isJson ? I_JSON : I_MIG), L.lX+4, rowY+(searchMode&&e.rel?5:2), 15, 15, e.isDir, e.isJson);

        Renderer.drawString(buildLabel(e), L.lX+23, rowY+(searchMode&&e.rel?3:5), true);
        if (searchMode && e.rel)
            Renderer.drawString("&8» &7" + e.rel.replace(/\/$/, ""), L.lX+23, rowY+13, true);

        // Draw trash + edit buttons only when this row is hovered
        if (isHovRow && !e.isDir) {
            var tx   = L.lX + L.lW - 36;
            var ex   = L.lX + L.lW - 18;
            var btnY = rowY + Math.floor((rowH - 15) / 2);

            var onT = hit && hit.onTrash;
            var onE = hit && hit.onEdit;

            // Trash button — open/closed visual
            Renderer.drawRect(onT ? Renderer.color(200,50,50,240) : Renderer.color(120,30,30,200), tx, btnY, 15, 15);
            border1(tx, btnY, 15, 15, onT ? Renderer.color(255,80,80,255) : Renderer.color(180,50,50,200));
            drawImg(onT ? I_TRASH_OPEN : I_TRASH, tx, btnY, 15, 15, false, false, true, onT);

            // Edit button
            Renderer.drawRect(onE ? Renderer.color(60,40,100,230) : Renderer.color(30,22,55,180), ex, btnY, 15, 15);
            border1(ex, btnY, 15, 15, onE ? Renderer.color(120,80,200,255) : Renderer.color(80,55,140,180));
            Renderer.drawString(onE ? "&b\u270e" : "&8\u270e", ex+3, btnY+3, true);
        }

        rowY += rowH + 1;
    }

    Renderer.drawRect(Renderer.color(16,18,30,255), L.pX+2, L.fY, L.pW-2, L.fH);
    Renderer.drawRect(Renderer.color(198,148,32,55), L.pX+2, L.fY, L.pW-2, 1);
    if (!searchMode && subDir !== "") drawBtn("\u2190", L.pX+8, L.fY+4, 28, 18, mx, my, Renderer.color(198,148,32,180));
    if (searchMode)                   drawBtn("\u00d7", L.pX+8, L.fY+4, 28, 18, mx, my, Renderer.color(160,55,55,200));
    drawBtn("\u27F3", L.pX+L.pW-26, L.fY+4, 20, 18, mx, my, Renderer.color(198,148,32,180));

    var scaleLbl    = Math.round(guiScale * 100) + "%";
    var scaleBtnW   = Renderer.getStringWidth(scaleLbl) + 14;
    var scaleBtnX   = L.pX + 42;
    var scaleBtnHov = mx >= scaleBtnX && mx <= scaleBtnX+scaleBtnW && my >= L.fY+4 && my <= L.fY+22;
    Renderer.drawRect(
        resizeMode ? Renderer.color(198,148,32,200) : (scaleBtnHov ? Renderer.color(50,53,80,230) : Renderer.color(28,30,50,200)),
        scaleBtnX, L.fY+4, scaleBtnW, 18
    );
    border1(scaleBtnX, L.fY+4, scaleBtnW, 18, resizeMode ? GOLD : BORDER);
    Renderer.drawString("&f" + scaleLbl, scaleBtnX+7, L.fY+8, true);
    if (resizeMode) Renderer.drawString("&6scroll to resize", scaleBtnX+scaleBtnW+4, L.fY+8, true);

    var visEnd = Math.min(scrollTop + perPage, filtered.length);
    var pStr   = filtered.length === 0 ? "&80" : "&7"+(scrollTop+1)+"&8\u2013&7"+visEnd+"&8/&7"+filtered.length;
    var pRaw   = filtered.length === 0 ? "0" : (scrollTop+1)+"-"+visEnd+"/"+filtered.length;
    var pStrX  = Math.floor(L.pX + L.pW/2) - Math.floor(Renderer.getStringWidth(pRaw)/2);
    Renderer.drawString(pStr, pStrX, L.fY+8, true);

    drawPreviewPanel(mx, my);
});

function buildLabel(e) {
    if (e.isDir) return "&e" + e.name + "&8/";
    var ext  = e.isJson ? ".json" : ".mig";
    var extC = e.isJson ? "&2" : "&8";
    var base = e.name.replace(/\.(mig|json)$/, "");
    if (!searchText) return "&f" + base + extC + ext;
    var qi = e.name.toLowerCase().indexOf(searchText.toLowerCase());
    if (qi === -1) return "&f" + base + extC + ext;
    return "&f" + e.name.substring(0, qi) + "&6" + e.name.substring(qi, qi+searchText.length)
         + "&r&f" + e.name.substring(qi+searchText.length).replace(/\.(mig|json)$/,"") + extC + ext;
}

gui.registerClicked(function(mx, my, btn) {
    layout();
    if (btn === 1) {
        if (searchMode) { searchText = ""; searchActive = false; filter(); }
        else if (subDir !== "") goUp();
        return;
    }
    if (btn !== 0) return;

    if (mx >= L.fbX && mx <= L.fbX+L.fbW && my >= L.fbY && my <= L.fbY+L.fbH) { openFolder(); playClick(); return; }
    if (mx >= L.pX+2 && mx <= L.pX+L.pW && my >= L.pY && my <= L.pY+L.hH) {
        dragging = true; dOX = mx-(Math.floor(L.sw/2-L.pW/2)+pOX); dOY = my-(Math.floor(L.sh/2-L.pH/2)+pOY); return;
    }
    if (mx >= L.sX && mx <= L.sX+L.sW && my >= L.sY && my <= L.sY+L.sH) { searchActive = true; return; }
    searchActive = false;
    if (mx >= L.pX+L.pW-26 && mx <= L.pX+L.pW-6 && my >= L.fY+4 && my <= L.fY+22) { refresh(); playClick(); return; }
    if (mx >= L.pX+8 && mx <= L.pX+36 && my >= L.fY+4 && my <= L.fY+22) {
        if (searchMode) { searchText = ""; searchActive = false; scrollTop = 0; filter(); }
        else goUp();
        playClick(); return;
    }
    var _scaleLbl  = Math.round(guiScale * 100) + "%";
    var _scaleBtnW = Renderer.getStringWidth(_scaleLbl) + 14;
    var _scaleBtnX = L.pX + 42;
    if (mx >= _scaleBtnX && mx <= _scaleBtnX+_scaleBtnW && my >= L.fY+4 && my <= L.fY+22) {
        resizeMode = !resizeMode; playClick(); return;
    }

    // ── Row click — recalculate hit precisely at click coordinates ──────────
    var hit = hitTestRows(mx, my);
    if (!hit) return;

    var e = hit.entry;
    if (e.isDir) {
        subDir += e.name + "/"; previewCache = {}; refresh(); playClick();
        return;
    }

    if (hit.onTrash) {
        delFile(e); return;
    }
    if (hit.onEdit) {
        openFileInEditor((e.rel || subDir) + e.name); return;
    }
    // Click on the row body — load the file
    e.isJson ? loadJson(e) : loadMig(e);
});

register("guiMouseRelease", function() { dragging = false; });

gui.registerKeyTyped(function(ch, code) {
    if (code === 1)  { gui.close(); return; }
    if (code === 14) {
        if (searchText.length > 0) { searchText = searchText.slice(0,-1); filter(); }
        else { if (searchMode) { searchActive = false; filter(); } else if (subDir !== "") goUp(); }
        return;
    }
    if (code === 15 || code === 29 || code === 157 || code === 42 || code === 54 || code === 56) return;
    if (!ch || ch === "\u0000") return;
    searchText += ch; searchActive = true; filter();
});

function loadMig(e) {
    var path = (e.rel || subDir) + e.name.replace(/\.mig$/, "");
    lastPath = path; gui.close();
    setTimeout(function() { ChatLib.command("mm import " + path, true); }, 80);
}

function loadJson(e) {
    var path = (e.rel || subDir) + e.name.replace(/\.json$/, "");
    lastPath = path; gui.close();
    setTimeout(function() { ChatLib.command("mm import " + path + ".json", true); }, 80);
}

function openFileInEditor(path) {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var f    = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports/" + path);
        if (f.exists()) {
            if (java.awt.Desktop.isDesktopSupported()) { java.awt.Desktop.getDesktop().open(f); msg("&aOpened in external editor."); }
            else msg("&cDesktop not supported on this OS.");
        } else msg("&cFile not found: &e" + path);
    } catch(e) { msg("&cCould not open file: " + e); }
}

function delFile(e) {
    var key = (e.rel || subDir) + e.name;
    delete previewCache[key];
    try { new java.io.File(BASE + (e.rel || subDir) + e.name).delete(); playPaper(); refresh(); }
    catch(err) { msg("&cDelete failed: " + err); }
}

function goUp() {
    var s = subDir.replace(/\/$/, ""), l = s.lastIndexOf("/");
    subDir = l === -1 ? "" : s.substring(0, l+1);
    scrollTop = 0; previewCache = {}; refresh();
}

function openFolder() {
    try {
        var d = new java.io.File(new java.io.File(".").getCanonicalPath() + "/config/ChatTriggers/modules/Morgen/imports");
        if (!d.exists()) d.mkdirs();
        java.awt.Desktop.getDesktop().open(d);
        msg("&aOpened imports folder.");
    } catch(e) { msg("&cFailed: " + e); }
}

function loadPos() {
    try {
        var r = FileLib.read("Morgen/config", "guiPos.json");
        if (!r) return;
        var p = JSON.parse(r);
        pOX = p.x || 0; pOY = p.y || 0; guiScale = p.scale || 1.0;
        if (Settings.saveSearchHistory && p.lastSearch) { searchText = p.lastSearch; filter(); }
    } catch(_) {}
}

function savePos() {
    try {
        var b = new java.io.File(".").getCanonicalPath();
        new java.io.File(b + "/config/ChatTriggers/modules/Morgen/config").mkdirs();
        var data = { x: pOX, y: pOY, scale: guiScale };
        if (Settings.saveSearchHistory) data.lastSearch = searchText;
        FileLib.write("Morgen/config", "guiPos.json", JSON.stringify(data));
    } catch(_) {}
}

register("guiClosed", function() {
    if (open2) savePos();
    open2 = false; dragging = false; previewEntry = null; resizeMode = false;
});

export function openMigBrowser() {
    subDir = ""; searchActive = false; searchMode = false;
    scrollTop = 0; dragging = false; previewCache = {};
    loadPos();
    if (!Settings.saveSearchHistory) { searchText = ""; filter(); }
    refresh(); open2 = true; gui.open();
}

export { openFileInEditor };