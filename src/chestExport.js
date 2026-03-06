// ============================================================
//  Morgen — src/chestExport.js
//
//  Renders an "[⬤ Export All →.mig]" overlay button whenever
//  a chest-type GUI is open (vanilla GuiChest — works for all
//  Hypixel Housing coded chest menus, 1-6 row chests).
//
//  Click → reads every non-empty slot from the open container,
//  builds one .mig file with a separate ITEM block per item,
//  and saves it to  imports/housing/<title>_HHMMSS.mig
//
//  SLOT RANGE:
//   ContainerChest has (chestRows × 9) chest slots + 36 player
//   slots.  We export chest slots 0 … (chestRows×9 - 1).
//   The last row of the chest (slots chestRows×9-9 … -1) is
//   skipped by default because Housing GUIs put navigation /
//   decoration items there.  Toggle via Settings.
//
//  Also exported as  /mm chestexport  for keyboard users.
// ============================================================

import { msg, cleanLore, stripColor } from "../utils/utils";
import Settings from "../utils/config";

// ─── Overlay state ────────────────────────────────────────────

var overlayOn    = false;   // true while a chest GUI is open
var btnX = 0, btnY = 0, btnW = 116, btnH = 20;
var btnHovered   = false;
var flashMsg     = null;    // status shown after export
var flashUntil   = 0;

// ─── Helpers ──────────────────────────────────────────────────

function cc(str) { return ("" + str).replace(/\u00a7/g, Settings.colorChar || "&"); }
function noColor(str) { return ("" + str).replace(/[§&][0-9a-fk-or]/gi, ""); }
function decToHex(dec) {
    return "#" + ((dec >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
}
function pad2(n) { return ("" + n).length < 2 ? "0" + n : "" + n; }

function buildNBT(obj) {
    if (obj === null || obj === undefined) return "{}";
    if (typeof obj === "boolean") return obj ? "1b" : "0b";
    if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
    return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
}

// ─── Read all items from the open container (CT API) ─────────
//
//  CT's Player.getContainer() wraps the currently open
//  ContainerChest.  .getSize() = chestSlots + 36 player slots.
//  .getStackInSlot(i) returns a CT Item (or null).

function readOpenContainer() {
    try {
        var container = Player.getContainer();
        if (!container) return null;

        var totalSize = container.getSize();
        var chestSize = totalSize - 36;   // strip player inventory
        if (chestSize <= 0) return null;

        // Title: CT container.getName() — available in CT 1.8.9
        var title = "chest";
        try {
            var rawTitle = container.getName ? container.getName() : null;
            if (rawTitle) title = noColor("" + rawTitle).trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "").substring(0, 28);
            if (!title) title = "chest";
        } catch(_) {}

        // Decide how many rows to export
        // chestSize is always a multiple of 9 (9, 18, 27, 36, 45, 54)
        var skipLast = (Settings.chestExportSkipLastRow !== false); // default true
        var endSlot  = skipLast ? chestSize - 0 : chestSize;
        if (endSlot <= 0) endSlot = chestSize; // single-row chest: export all

        var items = [];
        for (var i = 0; i < endSlot; i++) {
            try {
                var item = container.getStackInSlot(i);
                if (!item || item.getID() === 0) continue;

                var nbtObj = {};
                try { nbtObj = item.getNBT().toObject(); } catch(_) {}
                var tag    = nbtObj.tag || {};

                items.push({
                    slot:   i,
                    itemId: "" + item.getRegistryName(),
                    name:   "" + item.getName(),
                    damage: item.getMetadata ? item.getMetadata() : 0,
                    count:  item.getStackSize() || 1,
                    tag:    tag
                });
            } catch(se) {
                console.log("[chestExport] slot " + i + ": " + se);
            }
        }

        return { items: items, chestSize: chestSize, title: title };
    } catch(e) {
        console.log("[chestExport] readOpenContainer: " + e);
        return null;
    }
}

// ─── Count non-empty chest slots (for badge) ─────────────────

function countChestItems() {
    try {
        var container = Player.getContainer();
        if (!container) return 0;
        var chestSize = container.getSize() - 36;
        if (chestSize <= 0) return 0;
        var skipLast = (Settings.chestExportSkipLastRow !== false);
        var endSlot  = skipLast ? chestSize - 9 : chestSize;
        if (endSlot <= 0) endSlot = chestSize;
        var n = 0;
        for (var i = 0; i < endSlot; i++) {
            try { var it = container.getStackInSlot(i); if (it && it.getID() !== 0) n++; } catch(_) {}
        }
        return n;
    } catch(_) { return 0; }
}

// ─── Build multi-ITEM .mig string ────────────────────────────

function buildMultiMig(data) {
    var items = data.items;
    if (items.length === 0) return null;

    var colorChar = Settings.colorChar || "&";
    var now       = new Date();

    var mig = "// Morgen chest export\n";
    mig += "// Source GUI: " + data.title.replace(/_/g, " ") + "\n";
    mig += "// Date: " + now.getFullYear() + "-" + pad2(now.getMonth()+1) + "-" + pad2(now.getDate())
         + "  " + pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + "\n";
    mig += "// Items: " + items.length + "\n\n";

    items.forEach(function(item) {
        var tag      = item.tag || {};
        var disp     = tag.display || {};
        var isUnbreak = tag.Unbreakable === 1;
        var hasGlow   = !!(tag.ench && tag.ench.some(function(e){ return e.id===0&&e.lvl===1; }));
        var hideFlags = tag.HideFlags !== undefined ? tag.HideFlags : 63;
        var isLeather = item.itemId.toLowerCase().indexOf("leather") !== -1;
        var isSkull   = item.itemId.toLowerCase().indexOf("skull")   !== -1;

        // Export name with & color codes
        var exportName = (disp.Name || item.name || item.itemId)
            .replace(/\u00a7/g, colorChar);

        // Lore lines
        var loreLines = [];
        if (disp.Lore && disp.Lore.length) {
            loreLines = disp.Lore.map(function(l) {
                return ("" + l).replace(/\u00a7/g, colorChar);
            });
            // Drop first line if it's just the item name repeated
            if (loreLines.length > 0 &&
                noColor(loreLines[0]).trim() === noColor(exportName).trim()) {
                loreLines = loreLines.slice(1);
            }
        }

        // Skull texture
        var texture = null;
        if (isSkull && tag.SkullOwner) {
            try { texture = tag.SkullOwner.Properties.textures[0].Value; } catch(_) {}
        }

        // Leather color
        var hexColor = null;
        if (isLeather && disp.color !== undefined) hexColor = decToHex(disp.color);

        // Enchants (real, not glow-only)
        var enchStr = null;
        if (tag.ench) {
            var real = tag.ench.filter(function(e){ return !(e.id===0&&e.lvl===1); });
            if (real.length > 0)
                enchStr = JSON.stringify(real.map(function(e){ return {id:e.id, lvl:e.lvl}; }));
        }

        mig += 'ITEM "' + item.itemId + '" {\n\n';
        mig += '    Name: "' + exportName.replace(/"/g, '\\"') + '"\n';
        mig += '    Amount: 1\n';
        mig += '    Count: ' + item.count + '\n\n';
        mig += '    Damage: ' + item.damage + '\n';
        mig += '    Unbreakable: ' + isUnbreak + '\n';
        mig += '    Glow: ' + hasGlow + '\n';
        mig += '    HideFlags: ' + hideFlags + '\n';
        if (hexColor) mig += '    Hex: "' + hexColor + '"\n';
        if (texture)  mig += '    Texture: "' + texture + '"\n';
        if (enchStr)  mig += '    Enchants: ' + enchStr + '\n';
        mig += '\n';
        mig += '    Lore: [\n';
        loreLines.forEach(function(l) {
            mig += '        "' + l.replace(/"/g, '\\"') + '"\n';
        });
        mig += '    ]\n\n';
        mig += '}\n\n';
    });

    return mig;
}

// ─── Perform the export ───────────────────────────────────────

function doExport() {
    var data = readOpenContainer();
    if (!data) {
        msg("&cNo open chest GUI detected.");
        return;
    }
    if (data.items.length === 0) {
        var skipHint = (Settings.chestExportSkipLastRow !== false)
            ? " &8(last row skipped)" : "";
        msg("&cNo items found in the open chest" + skipHint + ".");
        return;
    }

    var migContent = buildMultiMig(data);
    if (!migContent) { msg("&cFailed to build .mig."); return; }

    // Save path:  imports/housing/<title>_HHMMSS.mig
    var now      = new Date();
    var stamp    = pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
    var subDir   = "housing";
    var fileName = data.title + "_" + stamp;
    var dir      = "Morgen/imports/" + subDir;
    var file     = fileName + ".mig";
    var importPath = subDir + "/" + fileName;

    try {
        var base = new java.io.File(".").getCanonicalPath();
        var d    = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports/" + subDir);
        if (!d.exists()) d.mkdirs();
        FileLib.write(dir, file, migContent);
    } catch(e) {
        msg("&cWrite failed: " + e);
        console.log("[chestExport] write: " + e);
        return;
    }

    // Success feedback
    flashMsg   = "&a\u2714 Exported &e" + data.items.length + "&a items";
    flashUntil = Date.now() + 3500;
    msg(flashMsg + " \u2192 &fimports/" + importPath + ".mig");
    msg("  &7Import: &f/mm import &e" + importPath);

    // Clickable chat button
    var comp = new TextComponent(ChatLib.addColor("  &e[\u25b6 Import now]"));
    comp.setClick("run_command", "/mm import " + importPath);
    comp.setHover("show_text", ChatLib.addColor("&eSpawn all " + data.items.length + " items\n&8/mm import " + importPath));
    ChatLib.chat(new Message(comp));
}

// ─── Detect whether chest GUI is open ────────────────────────
//
//  CT doesn't expose the GUI class name directly.
//  We check if Player.getContainer() returns a non-null container
//  with chestSize > 0.  This fires for any ContainerChest.
//  We re-check every tick via renderOverlay guard.

register("renderOverlay", function() {
    try {
        var container = Player.getContainer();
        var chestSize = 0;
        if (container) {
            try { chestSize = container.getSize() - 36; } catch(_) {}
        }
        overlayOn = chestSize > 0;
        if (!overlayOn) return;

        var sw  = Renderer.screen.getWidth();
        var sh  = Renderer.screen.getHeight();
        var mx  = Client.getMouseX();
        var my  = Client.getMouseY();

        // Position: bottom-right corner, above the hotbar area
        btnW = 120; btnH = 20;
        btnX = sw - btnW - 10;
        btnY = sh - btnH - 32;

        btnHovered = mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;

        // Colors
        var cBg   = btnHovered ? Renderer.color(34,120,48,235) : Renderer.color(18,65,28,215);
        var cBord = btnHovered ? Renderer.color(70,210,90,255) : Renderer.color(40,130,55,200);
        var cStrp = Renderer.color(70,210,90,200);

        // Drop shadow
        Renderer.drawRect(Renderer.color(0,0,0,100), btnX+3, btnY+3, btnW, btnH);
        // Button body
        Renderer.drawRect(cBg, btnX, btnY, btnW, btnH);
        // Border
        Renderer.drawRect(cBord, btnX,          btnY,          btnW, 1);
        Renderer.drawRect(cBord, btnX,          btnY+btnH-1,   btnW, 1);
        Renderer.drawRect(cBord, btnX,          btnY,          1,    btnH);
        Renderer.drawRect(cBord, btnX+btnW-1,   btnY,          1,    btnH);
        // Left accent stripe
        Renderer.drawRect(cStrp, btnX, btnY, 3, btnH);

        // Label
        var label = "\u2b24 Export All \u2192 .mig";
        var lw    = Renderer.getStringWidth(label);
        Renderer.drawString("&a" + label, btnX + 3 + Math.floor((btnW - 3 - lw) / 2), btnY + 6, true);

        // Item count badge (top-right of button)
        var itemCount = countChestItems();
        if (itemCount > 0) {
            var badge  = "" + itemCount;
            var bw     = Renderer.getStringWidth(badge) + 6;
            var bx     = btnX + btnW - bw - 1;
            var by     = btnY - 10;
            Renderer.drawRect(Renderer.color(34,120,48,220), bx, by, bw, 11);
            Renderer.drawRect(cBord, bx, by, bw, 11);
            Renderer.drawString("&f" + badge, bx + 3, by + 2, true);
        }

        // Flash success message
        if (flashMsg && Date.now() < flashUntil) {
            var age   = Date.now() - (flashUntil - 3500);
            var faded = age > 2500;
            var fw    = Renderer.getStringWidth(noColor(flashMsg)) + 14;
            var fx    = btnX - fw - 4;
            var fy    = btnY;
            if (fx < 0) { fx = 4; fy = btnY - 16; }
            Renderer.drawRect(Renderer.color(10,28,14, faded?120:200), fx, fy, fw, 14);
            Renderer.drawRect(Renderer.color(50,160,65,faded?80:180), fx, fy, 2, 14);
            Renderer.drawString(flashMsg, fx + 6, fy + 3, true);
        }

        // Tooltip on hover
        if (btnHovered) {
            var skipLast = (Settings.chestExportSkipLastRow !== false);
            var tip1 = "&7Click to export chest items to &f.mig";
            var tip2 = "&8Last row " + (skipLast ? "skipped (nav buttons)" : "included");
            var tw   = Math.max(
                Renderer.getStringWidth(noColor(tip1)),
                Renderer.getStringWidth(noColor(tip2))
            ) + 14;
            var tx = btnX - tw - 4;
            var ty = btnY;
            if (tx < 2) { tx = btnX + btnW + 4; }
            Renderer.drawRect(Renderer.color(10,14,20,225), tx, ty, tw, 28);
            Renderer.drawRect(Renderer.color(40,130,55,200), tx, ty, 2, 28);
            Renderer.drawRect(Renderer.color(40,55,42,180), tx, ty, tw, 1);
            Renderer.drawRect(Renderer.color(40,55,42,180), tx, ty+27, tw, 1);
            Renderer.drawString(tip1, tx+8, ty+4,  true);
            Renderer.drawString(tip2, tx+8, ty+15, true);
        }
    } catch(e) {
        // Silently ignore render errors
    }
});

// ─── Click detection ──────────────────────────────────────────
//
//  guiMouseClick fires for clicks inside any open GUI screen.
//  We check whether the click coords land on our overlay button.

register("guiMouseClick", function(mx, my, btn) {
    if (!overlayOn || btn !== 0) return;
    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
        doExport();
    }
});

// ─── Manual command export ────────────────────────────────────

export function handleChestExport() {
    doExport();
}