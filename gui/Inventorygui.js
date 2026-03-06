// ============================================================
//  Morgen — gui/InventoryGUI.js  v5
//  FIXES:
//   - No Armor/Inventory/Hotbar section labels
//   - Symbol picker: proper scroll clamp, bigger (28px) buttons
//   - Click slot → opens EditGUI for that item
//   - Right panel: item preview (Minecraft tooltip-style with
//     colored name + all lore lines exactly like in-game)
// ============================================================

import { msg, cleanLore, stripColor } from "../utils/utils";
import { openEditGui } from "./Editgui";

var gui = new Gui();
var guiOpen = false;
var searchText = "", searchActive = false;
var hoverSlot = -1;
var snap = [];
var activeTab = "inventory"; // "inventory" | "symbols"

// ─── Symbol categories ────────────────────────────────────────

var SYMBOL_CATS = {
    "Hearts":   ["♥","♡","❤","❥","❣","❦","❧"],
    "Skyblock": ["❁","❤","❈","❂","✦","✎","☣","☠","⚔","⫽","✯","♣","α","๑","⸕","✧","☘","⸎","ʬ","♨","᠅","≈","❣","✆","✪","☀","☽","⏣","✌","♲","⚠","✿","♪","♫","▲","⁍","⚚","✖","✔","➜","﴾","﴿","☬","☄","⚑","Ⓑ","☺","♞","✷","⦾"],
    "Stars":    ["★","☆","✡","✦","✧","✩","✪","✫","✬","✭","✮","✯","✰","⁎","⁑","✢","✣","✤","✥","✱","✲","✳","✴","✵","✶","✷","✸","✹","✺","✻","✼","✽","✾","✿","❀","❁","❃","❇","❈","❉","❊","❋","❄","⋆","⭒","⍟","⭐"],
    "Arrows":   ["↕","↖","↗","↘","↙","↪","↩","↺","↻","▶","➜","➨","➡","➠","➟","➩","➪","➫","➬","➭","➮","➯","➱","➲","➥","➦","➛","➘","➙","➚","➔","⇪","⇩","⇨","⇧","⇦","↷","↶","↟","↠","⇫","⇳","⬄","⬀","⬁","⬂","⬃","⬅","⬆","⬇","⬈","⬉","⬊","⬋","⥀","◀","←","→","➤"],
    "Circles":  ["◉","○","◌","◍","◎","●","◐","◑","◒","◓","◔","◕","◖","◗","❂","☢","⊗","⊙","◯","〇","⚫","⬤","◦","⦿","❍","⊛","⊚","⊕","⊖","•","∙"],
    "Blocks":   ["❏","❐","❑","❒","▀","▁","▂","▃","▄","▅","▆","▇","▉","▊","▋","█","▌","▐","▍","▎","▏","▒","░","▓","■","▢"],
    "Hands":    ["☝","☞","☜","☟","✌","✍","☛","☚"],
    "Coins":    ["⛀","⛁","⛃","⛂"],
    "Checks":   ["✓","✔","✗","✘"],
    "Faces":    ["☺","☻","ツ","㋡","☹","⍨","☠","⍤","⍢"],
    "Misc":     ["♂","♀","☂","☼","❆","ϟ","❅","☄","★","☆","☽","☾","☀","☁","☃","❄"],
    "Brackets": ["︻","︼","︺","︹","〉","〈","《","》","⦘","⦗","⟬","⟭","〉","〈","⎡","⎦","❵","❴","﹝","﹞","﹈","﹇"],
    "Bullets":  ["∙","•","●","○","⬤","⚪","➤","▶","▹","➥","◆","➣","‣","⌾"],
    "Box":      ["─","━","│","┃","┄","┅","┆","┇","┈","┉","┊","┋","┌","┍","┎","┏","┐","┑","┒","┓","└","┕","┖","┗","┘","┙","┚","┛","├","┝","┞","┟","┠","┡","┢","┣","┤","┥","┦","┧","┨","┩","┪","┫","┬","┭","┮","┯","┰","┱","┲","┳","┴","┵","┶","┷","┸","┹","┺","┻","┼","┽","┾","┿","╀","╁","╂","╃","╄","╅","╆","╇","╈","╉","╊","╋","╌","╍","╎","╏","═","║","╒","╓","╔","╕","╖","╗","╘","╙","╚","╛","╜","╝","╞","╟","╠","╡","╢","╣","╤","╥","╦","╧","╨","╩","╪","╫","╬","╭","╮","╯","╰","╴","╵","╶","╷","╸","╹","╺","╻","╼","╽","╾","╿"]
};

var symCatKeys = Object.keys(SYMBOL_CATS);
var selectedCat = symCatKeys[0];
var symHoverIdx = -1;
var copiedSym = null;
var copiedFlash = 0;
var symScrollY = 0;

// ─── Snapshot ─────────────────────────────────────────────────

function doSnapshot() {
    snap = [];
    var inv = Player.getInventory();
    if (!inv) { for (var i = 0; i < 40; i++) snap.push(null); return; }
    for (var i = 0; i < 40; i++) {
        try {
            var item = inv.getStackInSlot(i);
            if (!item || item.getID() === 0) { snap.push(null); continue; }
            var name = "" + item.getName();
            var rawLore;
            try { rawLore = item.getLore(); } catch (_) { rawLore = []; }
            var loreArr = cleanLore(rawLore);
            if (loreArr.length > 0 && stripColor(loreArr[0]).trim() === stripColor(name).trim())
                loreArr = loreArr.slice(1);
            var damage = 0;
            try { var nbtObj = item.getNBT ? item.getNBT().toObject() : {}; damage = nbtObj.Damage || 0; } catch (_) {}
            snap.push({
                slot: i, name: name,
                nameLow: stripColor(name).toLowerCase(),
                lore: loreArr,
                loreLow: loreArr.map(function(l){ return stripColor(l).toLowerCase(); }).join(" "),
                id: "" + item.getRegistryName(),
                count: item.getStackSize() || 1, damage: damage
            });
        } catch (e) { snap.push(null); }
    }
}

// ─── Layout ───────────────────────────────────────────────────
// PREVIEW_W: right panel for item preview (Minecraft tooltip style)

var PAD = 10, HDR = 30, SBAR = 20, FBAR = 20, AGAP = 6;
var TAB_H = 22;
var CELL = 34;
var PREVIEW_W = 180; // right preview panel

function getLayout() {
    var sw = Renderer.screen.getWidth(), sh = Renderer.screen.getHeight();
    var mainW = 9 * CELL;
    var hotY  = 3 * CELL + 5;
    var gridH = hotY + CELL;
    // left panel: armor col + main grid
    var invW  = PAD + CELL + AGAP + mainW + PAD;
    var pW    = invW + PREVIEW_W + PAD;  // total with preview panel
    var pH    = HDR + TAB_H + SBAR + 6 + gridH + FBAR + PAD;
    var pX    = Math.floor(sw / 2 - pW / 2);
    var pY    = Math.floor(sh / 2 - pH / 2);
    var tabY  = pY + HDR;
    var aX    = pX + PAD;
    var aY    = pY + HDR + TAB_H + SBAR + 6;
    var mX    = aX + CELL + AGAP;
    var mY    = aY;
    var hX    = mX, hY = mY + hotY;
    var pvX   = pX + invW;  // preview panel x
    var pvY   = pY + HDR + TAB_H + 3;
    var pvH   = pH - HDR - TAB_H - 3 - FBAR;
    return {
        sw: sw, sh: sh, CELL: CELL,
        pX: pX, pY: pY, pW: pW, pH: pH,
        tabY: tabY, tabH: TAB_H,
        aX: aX, aY: aY, mX: mX, mY: mY, hX: hX, hY: hY,
        mainW: mainW, gridH: gridH, invW: invW,
        sX: pX + PAD, sY: pY + HDR + TAB_H + 3, sW: invW - 2 * PAD,
        fY: pY + pH - FBAR,
        pvX: pvX, pvY: pvY, pvW: PREVIEW_W, pvH: pvH
    };
}

function slotXY(idx, L) {
    var C = L.CELL;
    if (idx >= 36 && idx <= 39) return { x: L.aX, y: L.aY + (idx - 36) * C };
    if (idx >= 9  && idx <= 35) {
        var mi = idx - 9;
        return { x: L.mX + (mi % 9) * C, y: L.mY + Math.floor(mi / 9) * C };
    }
    if (idx >= 0  && idx <= 8)  return { x: L.hX + idx * C, y: L.hY };
    return null;
}

// ─── Colors ───────────────────────────────────────────────────

var GOLD   = Renderer.color(198, 148, 32, 255);
var GOLD2  = Renderer.color(255, 200, 60, 255);
var PANEL  = Renderer.color(13, 14, 21, 248);
var BORDER = Renderer.color(52, 55, 82, 220);
var DARK   = Renderer.color(0, 0, 0, 90);
var HDR_BG = Renderer.color(18, 20, 34, 255);

function border1(x, y, w, h, col, t) {
    t = t || 1;
    Renderer.drawRect(col, x, y, w, t); Renderer.drawRect(col, x, y + h - t, w, t);
    Renderer.drawRect(col, x, y, t, h); Renderer.drawRect(col, x + w - t, y, t, h);
}

// ─── Item Preview Panel ───────────────────────────────────────
// Draws a Minecraft-style tooltip in the right panel:
//  - Dark purple-ish background (vanilla tooltip style)
//  - Colored item name on top
//  - All lore lines exactly as they appear in-game
//  - Item ID, damage, stack size at bottom in grey

function drawItemPreview(s, L) {
    var x  = L.pvX + 4;
    var y  = L.pvY + 4;
    var w  = L.pvW - 8;
    var h  = L.pvH - 8;

    // Panel background — Minecraft-like tooltip dark bg
    Renderer.drawRect(Renderer.color(16, 0, 16, 200), L.pvX, L.pvY, L.pvW, L.pvH);
    Renderer.drawRect(Renderer.color(40, 0, 40, 220), L.pvX + 1, L.pvY + 1, L.pvW - 2, L.pvH - 2);
    // Left purple border (vanilla tooltip style)
    Renderer.drawRect(Renderer.color(100, 0, 100, 255), L.pvX + 1, L.pvY + 1, 2, L.pvH - 2);
    // Outer border
    border1(L.pvX, L.pvY, L.pvW, L.pvH, Renderer.color(80, 0, 80, 255));

    if (!s) {
        Renderer.drawString("&8Hover a slot", x + 4, y + 8, true);
        Renderer.drawString("&8to preview item", x + 4, y + 20, true);
        return;
    }

    var LH = 11; // line height
    var cy = y + 4;

    // Item name (colored, exact as in-game)
    var nameStr = ("" + s.name).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    Renderer.drawString(nameStr, x + 4, cy, true);
    cy += LH + 3;

    // Divider
    Renderer.drawRect(Renderer.color(100, 0, 100, 180), x, cy, w, 1);
    cy += 4;

    // All lore lines — colored exactly as in-game
    for (var i = 0; i < s.lore.length; i++) {
        if (cy + LH > L.pvY + L.pvH - 20) {
            Renderer.drawString("&8+" + (s.lore.length - i) + " more...", x + 4, cy, true);
            break;
        }
        var lLine = s.lore[i];
        if (!lLine || lLine === "") {
            cy += Math.floor(LH / 2);
            continue;
        }
        // Lore lines in vanilla are dark purple by default — apply if no color code
        var lStr = ("" + lLine).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
        // If no color code at start, prepend vanilla lore purple
        if (lStr.charAt(0) !== "\u00a7") lStr = "\u00a79" + lStr;
        Renderer.drawString(lStr, x + 4, cy, true);
        cy += LH;
    }

    // Bottom info bar
    var botY = L.pvY + L.pvH - 18;
    Renderer.drawRect(Renderer.color(0, 0, 0, 120), L.pvX + 1, botY, L.pvW - 2, 17);
    var idShort = s.id.replace("minecraft:", "");
    var infoStr = "&8" + idShort;
    if (s.damage > 0) infoStr += " &8dmg:" + s.damage;
    if (s.count  > 1) infoStr += " &8\u00d7" + s.count;
    Renderer.drawString(infoStr, x + 2, botY + 4, true);
}

// ─── Symbol tab draw ──────────────────────────────────────────
// FIX: symScrollY is now clamped to valid range
// FIX: 28px buttons, category tabs use compact multi-row layout

function getSymMaxScroll(L, SYM_SZ, cols) {
    var gridY   = L.aY + 22 * Math.ceil(symCatKeys.length / Math.max(1, Math.floor((L.invW - 2 * PAD) / 52))) + 6;
    var syms    = SYMBOL_CATS[selectedCat];
    var rows    = Math.ceil(syms.length / cols);
    var gridH2  = rows * SYM_SZ;
    var visible = L.fY - gridY - 4;
    return Math.max(0, gridH2 - visible);
}

function drawSymbolTab(L, mx, my) {
    var catX     = L.pX + PAD;
    var catY     = L.aY;
    var catW     = L.invW - 2 * PAD;
    var catH     = 22;
    var CAT_W    = 52;
    var catPerRow= Math.max(1, Math.floor(catW / CAT_W));
    var catRows  = Math.ceil(symCatKeys.length / catPerRow);
    var catAreaH = catRows * catH;

    // Category buttons
    for (var ci = 0; ci < symCatKeys.length; ci++) {
        var col2 = ci % catPerRow;
        var row2 = Math.floor(ci / catPerRow);
        var cx   = catX + col2 * CAT_W;
        var cy   = catY + row2 * catH;
        var bw   = (col2 === catPerRow - 1) ? catW - col2 * CAT_W : CAT_W - 2;
        var isSel = symCatKeys[ci] === selectedCat;
        var isHov = mx >= cx && mx <= cx + bw && my >= cy && my <= cy + catH - 2;
        Renderer.drawRect(
            isSel ? Renderer.color(40, 44, 68, 245) : (isHov ? Renderer.color(30, 34, 54, 220) : Renderer.color(20, 22, 38, 210)),
            cx, cy, bw, catH - 2
        );
        border1(cx, cy, bw, catH - 2, isSel ? GOLD : BORDER);
        var lbl  = symCatKeys[ci];
        var lw   = Renderer.getStringWidth(lbl);
        Renderer.drawString((isSel ? "&f" : "&8") + lbl, cx + Math.floor((bw - lw) / 2), cy + 5, true);
    }

    // Symbol grid — 28px buttons
    var SYM_SZ = 28;
    var gridX  = catX;
    var gridY  = catY + catAreaH + 6;
    var gridW  = catW;
    var cols   = Math.max(1, Math.floor(gridW / SYM_SZ));
    var syms   = SYMBOL_CATS[selectedCat];

    // Clamp scroll
    var maxScroll = getSymMaxScroll(L, SYM_SZ, cols);
    if (symScrollY > maxScroll) symScrollY = maxScroll;
    if (symScrollY < 0) symScrollY = 0;

    var startRow = Math.floor(symScrollY / SYM_SZ);
    var maxVis   = Math.ceil((L.fY - gridY - 4) / SYM_SZ) + 1;

    symHoverIdx = -1;
    for (var si = startRow * cols; si < syms.length; si++) {
        var scol = si % cols;
        var srow = Math.floor(si / cols) - startRow;
        if (srow >= maxVis) break;

        var sx2 = gridX + scol * SYM_SZ;
        var sy3 = gridY + srow * SYM_SZ;
        if (sy3 + SYM_SZ > L.fY - 2) continue;

        var isHovSym = mx >= sx2 && mx <= sx2 + SYM_SZ - 2 && my >= sy3 && my <= sy3 + SYM_SZ - 2;
        if (isHovSym) symHoverIdx = si;

        Renderer.drawRect(
            isHovSym ? Renderer.color(60, 64, 98, 245) : Renderer.color(22, 24, 40, 200),
            sx2, sy3, SYM_SZ - 2, SYM_SZ - 2
        );
        if (isHovSym) border1(sx2, sy3, SYM_SZ - 2, SYM_SZ - 2, GOLD);

        // Center symbol in button
        var sw2 = Renderer.getStringWidth(syms[si]);
        Renderer.drawString("&f" + syms[si],
            sx2 + Math.floor((SYM_SZ - 2 - sw2) / 2),
            sy3 + Math.floor((SYM_SZ - 2 - 8) / 2),
            true);
    }

    // Scroll indicator
    var totalRows  = Math.ceil(syms.length / cols);
    var currentRow = Math.floor(symScrollY / SYM_SZ) + 1;
    Renderer.drawString("&8Row " + currentRow + "/" + totalRows + "  ·  " + syms.length + " symbols  ·  scroll to browse",
        catX, L.fY - 14, true);

    // Copied flash
    if (copiedSym && Date.now() < copiedFlash) {
        Renderer.drawRect(Renderer.color(60, 200, 80, 230), catX, L.fY - 28, catW, 16);
        border1(catX, L.fY - 28, catW, 16, Renderer.color(80, 220, 100, 255));
        Renderer.drawString("&a\u2714 Copied: &f" + copiedSym + " &8— Ctrl+V to paste", catX + 4, L.fY - 25, true);
    }

    // Hover tooltip
    if (symHoverIdx >= 0 && syms[symHoverIdx]) {
        var ts  = syms[symHoverIdx];
        var tw2 = Renderer.getStringWidth(ts) + 20;
        Renderer.drawRect(Renderer.color(10, 11, 18, 235), mx + 8, my - 18, tw2, 16);
        border1(mx + 8, my - 18, tw2, 16, BORDER);
        Renderer.drawString("&f" + ts, mx + 12, my - 14, true);
    }
}

// ─── Draw ─────────────────────────────────────────────────────

gui.registerDraw(function(mx, my) {
    var L    = getLayout();
    var C    = L.CELL;
    hoverSlot = -1;

    // Shadow + Panel
    Renderer.drawRect(DARK, L.pX + 5, L.pY + 5, L.pW, L.pH);
    Renderer.drawRect(PANEL, L.pX, L.pY, L.pW, L.pH);
    Renderer.drawRect(GOLD, L.pX, L.pY, 2, L.pH);
    border1(L.pX, L.pY, L.pW, L.pH, BORDER);

    // Preview panel divider
    Renderer.drawRect(Renderer.color(52, 55, 82, 180), L.pvX, L.pY + HDR, 1, L.pH - HDR);

    // Header
    Renderer.drawRect(HDR_BG, L.pX + 2, L.pY, L.pW - 2, HDR);
    Renderer.drawRect(Renderer.color(198, 148, 32, 65), L.pX + 2, L.pY + HDR - 1, L.pW - 2, 1);
    Renderer.drawRect(GOLD, L.pX + 9, L.pY + 12, 4, 4);
    Renderer.drawRect(GOLD2, L.pX + 10, L.pY + 13, 2, 2);
    Renderer.drawString("&6&lMorgen &8\u00bb &7" + (activeTab === "inventory" ? "Inventory View" : "Symbol Picker"),
        L.pX + 18, L.pY + 10, true);

    // Tabs (only over the left panel width)
    var tabW = Math.floor(L.invW / 2);
    var tabs = [{ id: "inventory", label: "\u2b24 Inventory" }, { id: "symbols", label: "\u2605 Symbols" }];
    for (var ti = 0; ti < tabs.length; ti++) {
        var tx2 = L.pX + ti * tabW;
        var tw3 = (ti === tabs.length - 1) ? L.invW - tabW : tabW;
        var isSel = tabs[ti].id === activeTab;
        var isHov = mx >= tx2 && mx <= tx2 + tw3 && my >= L.tabY && my <= L.tabY + TAB_H;
        Renderer.drawRect(
            isSel ? Renderer.color(30, 34, 54, 255) : (isHov ? Renderer.color(22, 26, 42, 235) : Renderer.color(16, 18, 30, 220)),
            tx2 + 1, L.tabY, tw3 - 1, TAB_H
        );
        if (isSel) Renderer.drawRect(GOLD, tx2 + 1, L.tabY + TAB_H - 2, tw3 - 1, 2);
        border1(tx2 + 1, L.tabY, tw3 - 1, TAB_H, isSel ? GOLD : BORDER);
        var lw2 = Renderer.getStringWidth(tabs[ti].label);
        Renderer.drawString((isSel ? "&f" : "&8") + tabs[ti].label,
            tx2 + Math.floor((tw3 - lw2) / 2), L.tabY + 5, true);
    }

    if (activeTab === "inventory") {
        // Search bar
        var q = searchText.toLowerCase();
        var view = snap.map(function(s) {
            if (!s) return null;
            if (!searchText) return s;
            return (s.nameLow.indexOf(q) !== -1 || s.loreLow.indexOf(q) !== -1) ? s : "dim";
        });

        var sBg = searchActive ? Renderer.color(22, 25, 42, 255) : Renderer.color(18, 20, 32, 240);
        Renderer.drawRect(sBg, L.sX, L.sY, L.sW, SBAR);
        border1(L.sX, L.sY, L.sW, SBAR, searchActive ? GOLD : BORDER);
        Renderer.drawString("&8\u25ba", L.sX + 4, L.sY + 5, true);
        var sd = searchText === "" ? "&8Search by name or lore..." : "&f" + searchText;
        Renderer.drawString(sd, L.sX + 14, L.sY + 5, true);
        if (searchActive && (Date.now() % 900) < 450)
            Renderer.drawRect(GOLD, L.sX + 14 + Renderer.getStringWidth(searchText), L.sY + 3, 1, 12);

        // NO section labels (removed as requested)
        // Divider line between armor and inventory
        Renderer.drawRect(Renderer.color(52, 55, 82, 120), L.aX + C + 2, L.aY - 2, 1, L.gridH + 2);
        // Gold line above hotbar
        Renderer.drawRect(GOLD, L.hX, L.hY - 2, 9 * C - 2, 1);

        var ARMOR_LABELS = ["H", "C", "L", "B"];
        for (var idx = 0; idx < 40; idx++) {
            var pos = slotXY(idx, L);
            if (!pos) continue;
            var sx = pos.x, sy = pos.y;
            var entry = view[idx], raw = snap[idx];
            var isHov2 = mx >= sx && mx <= sx + C - 2 && my >= sy && my <= sy + C - 2;
            if (isHov2 && raw) hoverSlot = idx;
            var isDim  = entry === "dim", isFull = entry && entry !== "dim";
            var slotBg = isHov2 && raw ? Renderer.color(40, 44, 68, 235) : (isFull ? Renderer.color(22, 26, 42, 220) : Renderer.color(14, 16, 24, 205));
            Renderer.drawRect(slotBg, sx, sy, C - 2, C - 2);
            var bc = isHov2 && raw ? GOLD : (isFull ? Renderer.color(50, 54, 78, 200) : Renderer.color(28, 30, 44, 140));
            border1(sx, sy, C - 2, C - 2, bc);
            if (isDim) Renderer.drawRect(Renderer.color(0, 0, 0, 110), sx, sy, C - 2, C - 2);
            if (raw) {
                if (raw.lore.length > 0) Renderer.drawRect(GOLD, sx + C - 7, sy + 3, 4, 4);
                if (raw.count > 1) {
                    var cs2 = "" + raw.count, cw2 = Renderer.getStringWidth(cs2);
                    Renderer.drawRect(Renderer.color(0, 0, 0, 170), sx + C - 4 - cw2, sy + C - 14, cw2 + 4, 11);
                    Renderer.drawString("&f&l" + cs2, sx + C - 3 - cw2, sy + C - 13, true);
                }
                var label = stripColor(raw.name);
                if (label.length > 5) label = label.substring(0, 4) + "\u2026";
                Renderer.drawString("&f" + label, sx + 2, sy + C - 16, true);
            } else if (idx >= 36 && idx <= 39) {
                Renderer.drawString("&8" + ARMOR_LABELS[idx - 36],
                    sx + Math.floor(C / 2) - 4, sy + Math.floor(C / 2) - 5, true);
            }
        }

        // Footer
        Renderer.drawRect(Renderer.color(16, 18, 30, 255), L.pX + 2, L.fY, L.pW - 2, FBAR);
        Renderer.drawRect(Renderer.color(198, 148, 32, 55), L.pX + 2, L.fY, L.pW - 2, 1);
        Renderer.drawString("&8[R] refresh  \u00b7  Click slot to edit  \u00b7  ESC close",
            L.pX + PAD, L.fY + 5, true);
        if (searchText) {
            var matchCount = view.filter(function(v){ return v && v !== "dim"; }).length;
            Renderer.drawString("&7" + matchCount + " match" + (matchCount !== 1 ? "es" : ""),
                L.pX + L.invW - Renderer.getStringWidth(matchCount + " matches") - PAD, L.fY + 5, true);
        }

        // Right preview panel — show hovered slot
        drawItemPreview(hoverSlot >= 0 ? snap[hoverSlot] : null, L);

    } else {
        drawSymbolTab(L, mx, my);
        // Symbol preview stays on right
        drawItemPreview(null, L);

        Renderer.drawRect(Renderer.color(16, 18, 30, 255), L.pX + 2, L.fY, L.pW - 2, FBAR);
        Renderer.drawRect(Renderer.color(198, 148, 32, 55), L.pX + 2, L.fY, L.pW - 2, 1);
        Renderer.drawString("&8Click symbol to copy  \u00b7  Scroll to browse  \u00b7  ESC close",
            L.pX + PAD, L.fY + 5, true);
    }
});

// ─── Input ────────────────────────────────────────────────────

gui.registerClicked(function(mx, my, btn) {
    var L = getLayout();
    var C = L.CELL;

    // Tab switching
    var tabW = Math.floor(L.invW / 2);
    if (my >= L.tabY && my <= L.tabY + TAB_H) {
        if (mx >= L.pX && mx <= L.pX + tabW)          { activeTab = "inventory"; return; }
        if (mx >= L.pX + tabW && mx <= L.pX + L.invW) { activeTab = "symbols"; symScrollY = 0; return; }
    }

    if (activeTab === "inventory") {
        // Search bar click
        if (mx >= L.sX && mx <= L.sX + L.sW && my >= L.sY && my <= L.sY + SBAR) {
            searchActive = true; return;
        }
        searchActive = false;

        // Slot click → open EditGUI for that item
        for (var idx = 0; idx < 40; idx++) {
            var pos = slotXY(idx, L);
            if (!pos) continue;
            if (mx >= pos.x && mx <= pos.x + C - 2 && my >= pos.y && my <= pos.y + C - 2) {
                if (snap[idx]) {
                    gui.close();
                    // Switch to the held slot if it's a hotbar slot (0-8)
                    var targetSlot = snap[idx].slot;
                    if (targetSlot >= 0 && targetSlot <= 8) {
                        Player.setHeldItemIndex(targetSlot);
                    }
                    // Small delay so the GUI close registers before EditGUI opens
                    Client.scheduleTask(function() {
                        setTimeout(function() { openEditGui(); }, 80);
                    });
                }
                return;
            }
        }

    } else {
        // Category button click
        var catX     = L.pX + PAD;
        var catY     = L.aY;
        var catW     = L.invW - 2 * PAD;
        var catH     = 22;
        var CAT_W    = 52;
        var catPerRow = Math.max(1, Math.floor(catW / CAT_W));
        var catRows   = Math.ceil(symCatKeys.length / catPerRow);
        var catAreaH  = catRows * catH;
        if (my >= catY && my <= catY + catAreaH) {
            var col2  = Math.floor((mx - catX) / CAT_W);
            var row22 = Math.floor((my - catY) / catH);
            var ci2   = row22 * catPerRow + col2;
            if (ci2 >= 0 && ci2 < symCatKeys.length) {
                selectedCat = symCatKeys[ci2]; symScrollY = 0; symHoverIdx = -1; return;
            }
        }

        // Symbol click → copy
        if (symHoverIdx >= 0) {
            var sym = SYMBOL_CATS[selectedCat][symHoverIdx];
            try {
                var sel = Java.type("java.awt.datatransfer.StringSelection");
                Java.type("java.awt.Toolkit").getDefaultToolkit()
                    .getSystemClipboard().setContents(new sel(sym), null);
                copiedSym = sym; copiedFlash = Date.now() + 1800;
                msg("&aCopied &f" + sym + " &ato clipboard!");
            } catch(e) { msg("&cClipboard error: " + e); }
        }
    }
});

gui.registerScrolled(function(mx, my, dir) {
    if (activeTab === "symbols") {
        symScrollY = Math.max(0, symScrollY - dir * 28);
    }
});

gui.registerKeyTyped(function(ch, code) {
    if (code === 1) { gui.close(); return; }
    if (activeTab === "inventory") {
        if (code === 19) { doSnapshot(); return; }
        if (code === 14) { if (searchText.length > 0) searchText = searchText.slice(0, -1); return; }
        if (ch && ch !== "\u0000") { searchText += ch; searchActive = true; }
    }
});

register("guiClosed", function() { guiOpen = false; searchActive = false; });

export function openInventoryGui() {
    searchText = ""; searchActive = false; hoverSlot = -1;
    activeTab = "inventory"; symScrollY = 0;
    doSnapshot();
    guiOpen = true;
    gui.open();
}

export function openSymbolPicker() {
    activeTab = "symbols"; symScrollY = 0;
    doSnapshot();
    guiOpen = true;
    gui.open();
}