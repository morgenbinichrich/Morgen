import { msg, cleanLore, stripColor } from "../utils/utils";
import Settings from "../utils/config";

var overlayOn   = false;
var btnX = 0, btnY = 0, btnW = 120, btnH = 20;
var btnHovered  = false;
var flashMsg    = null;
var flashUntil  = 0;

var btnMoving   = false;
var btnDragging = false;
var btnDragOX   = 0, btnDragOY = 0;
var btnOffX     = 0, btnOffY   = 0;

function loadBtnPos() {
    try {
        var r = FileLib.read("Morgen/config", "btnPos.json");
        if (r) { var p = JSON.parse(r); btnOffX = p.x || 0; btnOffY = p.y || 0; }
    } catch(_) {}
}

function saveBtnPos() {
    try {
        var b = new java.io.File(".").getCanonicalPath();
        new java.io.File(b + "/config/ChatTriggers/modules/Morgen/config").mkdirs();
        FileLib.write("Morgen/config", "btnPos.json", JSON.stringify({ x: btnOffX, y: btnOffY }));
    } catch(_) {}
}
loadBtnPos();

function noColor(str) { return ("" + str).replace(/[§&][0-9a-fk-or]/gi, ""); }

function decToHex(dec) {
    return "#" + ((dec >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
}

function pad2(n) { return ("" + n).length < 2 ? "0" + n : "" + n; }

function readOpenContainer() {
    try {
        var container = Player.getContainer();
        if (!container) return null;
        var totalSize = container.getSize();
        var chestSize = totalSize - 36;
        if (chestSize <= 0) return null;

        var title = "chest";
        try {
            var rawTitle = container.getName ? container.getName() : null;
            if (rawTitle) title = noColor("" + rawTitle).trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "").substring(0, 28);
            if (!title) title = "chest";
        } catch(_) {}

        var skipLast = (Settings.chestExportSkipLastRow !== false);
        var endSlot  = skipLast ? chestSize - 9 : chestSize;
        if (endSlot <= 0) endSlot = chestSize;

        var items = [];
        for (var i = 0; i < endSlot; i++) {
            try {
                var item = container.getStackInSlot(i);
                if (!item || item.getID() === 0) continue;
                var nbtObj = {};
                try { nbtObj = item.getNBT().toObject(); } catch(_) {}
                items.push({
                    slot:   i,
                    itemId: "" + item.getRegistryName(),
                    name:   "" + item.getName(),
                    damage: item.getMetadata ? item.getMetadata() : 0,
                    count:  item.getStackSize() || 1,
                    tag:    nbtObj.tag || {}
                });
            } catch(se) { console.log("[chestExport] slot " + i + ": " + se); }
        }
        return { items: items, chestSize: chestSize, title: title };
    } catch(e) {
        console.log("[chestExport] readOpenContainer: " + e);
        return null;
    }
}

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

function buildMultiMig(data) {
    var items = data.items;
    if (items.length === 0) return null;
    var colorChar = "&";
    var now = new Date();

    var mig = "";
    mig += 'ITEM "chest_export" {\n\n';
    mig += "    // Source: " + data.title.replace(/_/g, " ") + "\n";
    mig += "    // Date: " + now.getFullYear() + "-" + pad2(now.getMonth()+1) + "-" + pad2(now.getDate()) + "\n";
    mig += "    // Items: " + items.length + "\n\n";
    mig += "}\n\n";

    items.forEach(function(item) {
        var tag      = item.tag || {};
        var disp     = tag.display || {};
        var isUnbreak = tag.Unbreakable === 1;
        var hasGlow   = !!(tag.ench && tag.ench.some(function(e){ return e.id===0&&e.lvl===1; }));
        var hideFlags = tag.HideFlags !== undefined ? tag.HideFlags : 63;
        var isLeather = item.itemId.toLowerCase().indexOf("leather") !== -1;
        var isSkull   = item.itemId.toLowerCase().indexOf("skull")   !== -1;

        var exportName = (disp.Name || item.name || item.itemId).replace(/\u00a7/g, colorChar);

        var loreLines = [];
        if (disp.Lore && disp.Lore.length) {
            loreLines = disp.Lore.map(function(l) { return ("" + l).replace(/\u00a7/g, colorChar); });
            if (loreLines.length > 0 && noColor(loreLines[0]).trim() === noColor(exportName).trim())
                loreLines = loreLines.slice(1);
        }

        var texture = null;
        if (isSkull && tag.SkullOwner) {
            try { texture = tag.SkullOwner.Properties.textures[0].Value; } catch(_) {}
        }
        var hexColor = null;
        if (isLeather && disp.color !== undefined) hexColor = decToHex(disp.color);

        var enchStr = null;
        if (tag.ench) {
            var real = tag.ench.filter(function(e){ return !(e.id===0&&e.lvl===1); });
            if (real.length > 0) enchStr = JSON.stringify(real.map(function(e){ return {id:e.id, lvl:e.lvl}; }));
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
        mig += '\n    Lore: [\n';
        loreLines.forEach(function(l) { mig += '        "' + l.replace(/"/g, '\\"') + '"\n'; });
        mig += '    ]\n\n}\n\n';
    });

    return mig;
}

var _lastExportTime = 0;

function doExport() {
    var _now = Date.now();
    if (_now - _lastExportTime < 500) return;
    _lastExportTime = _now;

    var data = readOpenContainer();
    if (!data) { msg("&cNo open chest GUI detected."); return; }
    if (data.items.length === 0) {
        msg("&cNo items found in the open chest."); return;
    }

    var migContent = buildMultiMig(data);
    if (!migContent) { msg("&cFailed to build .mig."); return; }

    var now      = new Date();
    var stamp    = pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
    var subDir   = "housing";
    var fileName = data.title + "_" + stamp;
    var dir      = "Morgen/imports/" + subDir;
    var file     = fileName + ".mig";
    var importPath = subDir + "/" + fileName;

    try {
        var base = new java.io.File(".").getCanonicalPath();
        var d = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports/" + subDir);
        if (!d.exists()) d.mkdirs();
        FileLib.write(dir, file, migContent);
    } catch(e) {
        msg("&cWrite failed: " + e);
        return;
    }

    flashMsg   = "&a✔ Exported &e" + data.items.length + "&a items";
    flashUntil = Date.now() + 3500;
    ChatLib.chat(ChatLib.addColor("&8──────────────────────────────"));
    msg("&a✔ Export Complete");
    msg("  &7Items   &f" + data.items.length + " item" + (data.items.length !== 1 ? "s" : "") + " saved");
    msg("  &7File    &e" + importPath + ".mig");
    var importComp = new TextComponent(ChatLib.addColor("  &7Action  "));
    var btnComp = new TextComponent(ChatLib.addColor("&a[ ▶ Import Now ]"));
    btnComp.setClick("run_command", "/mm import " + importPath);
    btnComp.setHover("show_text", ChatLib.addColor("&7Click to spawn all &e" + data.items.length + " &7items\n&8/mm import " + importPath));
    ChatLib.chat(new Message(importComp, btnComp));
    ChatLib.chat(ChatLib.addColor("&8──────────────────────────────"));
}

var _prevMouseDown = false;

register("guiRender", function() {
    try {
        if (Settings.chestExportOverlay === false) return;

        var container = Player.getContainer();
        var chestSize = 0, isRealChest = false;
        if (container) {
            try { chestSize = container.getSize() - 36; isRealChest = chestSize > 0 && chestSize % 9 === 0; } catch(_) {}
        }
        var guiScreen = null;
        try { guiScreen = Client.currentGui.get(); } catch(_) {}
        overlayOn = isRealChest && guiScreen !== null;
        if (!overlayOn) {
            if (btnDragging) { btnDragging = false; saveBtnPos(); }
            _prevMouseDown = false;
            return;
        }

        var sw = Renderer.screen.getWidth();
        var sh = Renderer.screen.getHeight();
        var mx = Client.getMouseX();
        var my = Client.getMouseY();

        var mouseDown = false;
        try { mouseDown = Java.type("org.lwjgl.input.Mouse").isButtonDown(0); } catch(_) {}

        var justPressed  = mouseDown && !_prevMouseDown;
        var justReleased = !mouseDown && _prevMouseDown;
        _prevMouseDown = mouseDown;

        btnX = sw - btnW - 10 + btnOffX;
        btnY = sh - btnH - 32 + btnOffY;

        var lockX = btnX - 18, lockY = btnY + 2;
        var overLock = mx >= lockX && mx <= lockX + 14 && my >= lockY && my <= lockY + 14;
        var overBtn  = mx >= btnX && mx <= btnX + btnW  && my >= btnY  && my <= btnY + btnH;

        if (justPressed) {
            if (overLock) {
                btnMoving = !btnMoving;
                if (!btnMoving) { saveBtnPos(); btnDragging = false; }
            } else if (btnMoving && overBtn) {
                btnDragging = true;
                btnDragOX = mx - btnX;
                btnDragOY = my - btnY;
            } else if (!btnMoving && overBtn) {
                doExport();
            }
        }

        if (justReleased && btnDragging) {
            btnDragging = false;
            saveBtnPos();
        }

        if (btnDragging && mouseDown) {
            var newBtnX = mx - btnDragOX;
            var newBtnY = my - btnDragOY;
            btnOffX = newBtnX - (sw - btnW - 10);
            btnOffY = newBtnY - (sh - btnH - 32);
            btnX = sw - btnW - 10 + btnOffX;
            btnY = sh - btnH - 32 + btnOffY;
        }

        btnHovered = !btnMoving && overBtn;

        var cBg   = btnHovered ? Renderer.color(34,120,48,235) : Renderer.color(18,65,28,215);
        var cBord = btnHovered ? Renderer.color(70,210,90,255) : Renderer.color(40,130,55,200);
        var cStrp = Renderer.color(70,210,90,200);

        Renderer.drawRect(Renderer.color(0,0,0,100), btnX+3, btnY+3, btnW, btnH);
        Renderer.drawRect(cBg,   btnX, btnY, btnW, btnH);
        Renderer.drawRect(cBord, btnX, btnY, btnW, 1);
        Renderer.drawRect(cBord, btnX, btnY+btnH-1, btnW, 1);
        Renderer.drawRect(cBord, btnX, btnY, 1, btnH);
        Renderer.drawRect(cBord, btnX+btnW-1, btnY, 1, btnH);
        Renderer.drawRect(cStrp, btnX, btnY, 3, btnH);

        var lockX2 = btnX - 16, lockY2 = btnY + 5;
        Renderer.drawRect(btnMoving ? Renderer.color(80,60,0,200) : Renderer.color(20,20,20,140), lockX2-2, lockY2-3, 14, 14);
        Renderer.drawString(btnMoving ? "&6⚿" : "&8⚿", lockX2, lockY2, true);

        var label = (btnMoving ? "Move  " : "") + "Export All to .mig";
        var lw    = Renderer.getStringWidth(label);
        Renderer.drawString("&a" + label, btnX + 3 + Math.floor((btnW - 3 - lw) / 2), btnY + 6, true);

        var itemCount = countChestItems();
        if (itemCount > 0) {
            var badge = "" + itemCount;
            var bw = Renderer.getStringWidth(badge) + 6;
            var bx = btnX + btnW - bw - 1, by = btnY - 10;
            Renderer.drawRect(Renderer.color(34,120,48,220), bx, by, bw, 11);
            Renderer.drawRect(cBord, bx, by, bw, 11);
            Renderer.drawString("&f" + badge, bx + 3, by + 2, true);
        }

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

        if (btnHovered && !btnMoving) {
            var tip1 = "&7Click to export chest items to .mig";
            var tw   = Renderer.getStringWidth(noColor(tip1)) + 14;
            var tx   = btnX - tw - 4;
            var ty   = btnY;
            if (tx < 2) tx = btnX + btnW + 4;
            Renderer.drawRect(Renderer.color(10,14,20,225), tx, ty, tw, 14);
            Renderer.drawRect(Renderer.color(40,130,55,200), tx, ty, 2, 14);
            Renderer.drawRect(Renderer.color(40,55,42,180), tx, ty, tw, 1);
            Renderer.drawRect(Renderer.color(40,55,42,180), tx, ty+13, tw, 1);
            Renderer.drawString(tip1, tx+8, ty+4, true);
        }
    } catch(e) {}
});

register("guiClosed", function() {
    if (btnDragging) { btnDragging = false; saveBtnPos(); }
    btnMoving = false;
});

export function handleChestExport() {
    doExport();
}