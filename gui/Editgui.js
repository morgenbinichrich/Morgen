// ============================================================
//  Morgen — gui/EditGUI.js  v1
//  /mm edit  — In-Game Item Editor (Name, Lore, Stats, NBT)
//  Reads held item NBT → editable panels → save as .mig
// ============================================================

import { msg, cleanLore, stripColor, requireCreative } from "../utils/utils";
import { snapshotHeld } from "../src/undoHistory";
import Settings from "../utils/config";

var gui = new Gui();
var guiOpen = false;

// ─── Editor state ─────────────────────────────────────────────

var state = {
    itemId:    "minecraft:stone",
    damage:    0,
    count:     1,
    name:      "",
    lore:      [],    // array of strings (raw & codes)
    unbreak:   false,
    glow:      false,
    hideFlags: 63,
    hex:       "",
    texture:   ""
};

var activeSection = "name";  // "name" | "lore" | "stats" | "meta"
var editingField  = null;    // null | "name" | "hex" | "loreN" | "hideFlags"
var editBuffer    = "";
var lorePage      = 0;
var LORE_PER_PAGE = 8;
var hoverBtn      = null;
var savePath      = "";
var savePathEditing = false;
var statusMsg     = null;
var statusFlash   = 0;

// ─── Load held item into state ────────────────────────────────

function loadFromHeld() {
    try {
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item to edit!"); return false; }
        var nbtObj = item.getNBT ? item.getNBT().toObject() : {};
        var tag    = nbtObj.tag || {};
        var disp   = tag.display || {};

        state.itemId    = "" + item.getRegistryName();
        state.damage    = item.getMetadata ? item.getMetadata() : 0;
        state.count     = item.getStackSize() || 1;
        state.name      = disp.Name
            ? ("" + disp.Name).replace(/\u00a7/g, "&")
            : stripColor("" + item.getName());
        state.unbreak   = !!tag.Unbreakable;
        state.glow      = !!(tag.ench && tag.ench.some(function(e){return e.id===0&&e.lvl===1;}));
        state.hideFlags = tag.HideFlags || 63;
        state.hex       = (disp.color !== undefined)
            ? "#" + ((disp.color>>>0)&0xFFFFFF).toString(16).padStart(6,"0").toUpperCase()
            : "";
        // Lore — strip §r artifacts
        var rawLore = cleanLore(item.getLore()).slice(1);
        state.lore = rawLore.map(function(l){return (""+l).replace(/\u00a7/g,"&");});

        // Save path default
        var safeName = stripColor(state.name).replace(/[^a-zA-Z0-9_\-]/g,"_").substring(0,24)||"item";
        savePath = safeName;
        setStatus("&aLoaded: &f" + stripColor(state.name));
        return true;
    } catch(e) {
        msg("&cLoad error: " + e);
        console.log("[EditGUI] loadFromHeld: " + e);
        return false;
    }
}

// ─── Apply state to held item ─────────────────────────────────

function applyToHeld() {
    try {
        if (!requireCreative()) return;
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }

        snapshotHeld("edit-apply");

        var C10 = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
        var IS  = Java.type("net.minecraft.item.ItemStack");
        var NBT = Java.type("net.minecraft.nbt.JsonToNBT");
        var IR  = Java.type("net.minecraft.item.Item");

        var tagObj = {};
        var disp   = {};
        if (state.name) disp.Name = (""+state.name).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
        var loreConverted = state.lore.map(function(l){
            return (""+l).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
        });
        if (loreConverted.length) disp.Lore = loreConverted;
        if (state.hex && state.itemId.toLowerCase().includes("leather"))
            disp.color = parseInt(state.hex.replace("#",""),16);
        if (Object.keys(disp).length) tagObj.display = disp;
        if (state.unbreak) tagObj.Unbreakable = 1;
        if (state.hideFlags > 0) tagObj.HideFlags = state.hideFlags;
        if (state.glow) tagObj.ench = [{id:0,lvl:1}];

        function buildNBT(obj) {
            if (obj===null||obj===undefined) return "{}";
            if (typeof obj==="boolean") return obj?"1b":"0b";
            if (typeof obj==="number") return Number.isInteger(obj)?String(obj):obj.toFixed(4)+"f";
            if (typeof obj==="string") return '"'+obj.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
            if (Array.isArray(obj)) return "["+obj.map(buildNBT).join(",")+"]";
            return "{"+Object.keys(obj).map(function(k){return k+":"+buildNBT(obj[k]);}).join(",")+"}";
        }

        var mcItem = IR.func_111206_d(state.itemId);
        var stack  = new IS(mcItem, state.count, state.damage);
        var nbtStr = buildNBT(tagObj);
        if (nbtStr !== "{}") stack.func_77982_d(NBT.func_180713_a(nbtStr));
        Client.sendPacket(new C10(Player.getHeldItemIndex()+36, stack));
        setStatus("&a✔ Applied to held item!");
    } catch(e) {
        setStatus("&cApply error: " + e);
        console.log("[EditGUI] applyToHeld: " + e);
    }
}

// ─── Save as .mig ─────────────────────────────────────────────

function saveAsMig() {
    try {
        var path = savePath.replace(/\.mig$/, "");
        var parts = path.replace(/\\/g, "/").split("/");
        var file  = parts.pop() + ".mig";
        var dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");

        var cc  = "&";
        var mig = 'ITEM "' + state.itemId + '" {\n\n';
        mig += '    Name: "' + state.name.replace(/\u00a7/g,cc).replace(/"/g,'\\"') + '"\n';
        mig += "    Amount: 1\n";
        mig += "    Count: " + state.count + "\n\n";
        mig += "    Damage: " + state.damage + "\n";
        mig += "    Unbreakable: " + state.unbreak + "\n";
        mig += "    Glow: " + state.glow + "\n";
        mig += "    HideFlags: " + state.hideFlags + "\n";
        if (state.hex) mig += '    Hex: "' + state.hex + '"\n';
        mig += "\n";
        mig += "    Lore: [\n";
        state.lore.forEach(function(l){
            mig += '        "' + l.replace(/"/g,'\\"') + '"\n';
        });
        mig += "    ]\n\n}\n";

        // Ensure dir
        try {
            var base = new java.io.File(".").getCanonicalPath();
            var d    = new java.io.File(base + "/config/ChatTriggers/modules/" + dir);
            if (!d.exists()) d.mkdirs();
        } catch(_) {}

        FileLib.write(dir, file, mig);
        setStatus("&a✔ Saved to &e" + path + ".mig");
    } catch(e) {
        setStatus("&cSave error: " + e);
    }
}

function setStatus(s) { statusMsg = s; statusFlash = Date.now() + 2500; }

// ─── Layout ───────────────────────────────────────────────────

var PAD = 8, HDR = 28;
var SECTION_W = 84, MIN_CONTENT_W = 290;

function getLayout() {
    var sw = Renderer.screen.getWidth(), sh = Renderer.screen.getHeight();
    var pW = SECTION_W + MIN_CONTENT_W + PAD * 3;
    var pH = Math.min(sh - 20, 400);
    var pX = Math.floor(sw/2 - pW/2);
    var pY = Math.floor(sh/2 - pH/2);
    return { sw:sw, sh:sh, pX:pX, pY:pY, pW:pW, pH:pH,
             secX: pX+PAD, secY: pY+HDR+PAD, secW: SECTION_W, secH: pH-HDR-PAD*2-26,
             cntX: pX+PAD+SECTION_W+PAD, cntY: pY+HDR+PAD,
             cntW: pW-SECTION_W-PAD*3, cntH: pH-HDR-PAD*2-26,
             fY: pY+pH-24 };
}

var GOLD   = Renderer.color(198,148,32,255);
var GOLD2  = Renderer.color(255,200,60,255);
var PANEL  = Renderer.color(13,14,21,248);
var BORDER = Renderer.color(52,55,82,220);
var HDR_BG = Renderer.color(18,20,34,255);
var DARK   = Renderer.color(0,0,0,90);

function border1(x,y,w,h,col,t){
    t=t||1;
    Renderer.drawRect(col,x,y,w,t);Renderer.drawRect(col,x,y+h-t,w,t);
    Renderer.drawRect(col,x,y,t,h);Renderer.drawRect(col,x+w-t,y,t,h);
}

function drawField(label, val, x, y, w, active, hint) {
    var h = 20;
    Renderer.drawRect(active ? Renderer.color(28,32,52,255) : Renderer.color(18,20,36,230), x, y, w, h);
    border1(x, y, w, h, active ? GOLD : BORDER);
    Renderer.drawString("&8" + label + ":", x + 3, y + 3, true);
    var dispVal = val || (hint ? "\u00a78" + hint : "");
    var maxW = w - Renderer.getStringWidth(label+": ") - 10;
    var dv = "" + dispVal;
    // Truncate display
    while (dv.length > 1 && Renderer.getStringWidth(dv.replace(/\u00a7./g,"")) > maxW) dv = dv.slice(0,-1);
    Renderer.drawString(dv, x + Renderer.getStringWidth(label + ": ") + 3, y + 3, true);
    if (active && (Date.now()%900)<450)
        Renderer.drawRect(GOLD, x + Renderer.getStringWidth(label+": "+val.replace(/&[0-9a-fk-or]/gi,""))+4, y+3, 1, 12);
}

function drawToggle(label, val, x, y, w) {
    var h = 18;
    Renderer.drawRect(Renderer.color(18,20,36,225), x, y, w, h);
    border1(x, y, w, h, BORDER);
    Renderer.drawString("&7" + label, x+3, y+3, true);
    var pill = val ? "&a■ ON" : "&c■ OFF";
    var pw = Renderer.getStringWidth(val ? "■ ON" : "■ OFF") + 4;
    Renderer.drawString(pill, x + w - pw - 3, y + 3, true);
}

function drawBtn(label, x, y, w, h, mx, my, col) {
    var hov = mx>=x&&mx<=x+w&&my>=y&&my<=y+h;
    Renderer.drawRect(hov?(col||Renderer.color(70,76,115,230)):Renderer.color(28,32,52,215), x, y, w, h);
    border1(x, y, w, h, hov ? GOLD : BORDER);
    var lw = Renderer.getStringWidth(label);
    Renderer.drawString("&f"+label, x+Math.floor((w-lw)/2), y+Math.floor(h/2)-3, true);
    return hov;
}

// ─── Section nav ──────────────────────────────────────────────

var SECTIONS = [
    { id:"name",  label:"✎ Name",  col:"&f" },
    { id:"lore",  label:"≡ Lore",  col:"&7" },
    { id:"meta",  label:"⚙ Meta",  col:"&8" },
    { id:"save",  label:"⬤ Save",  col:"&a" }
];

// ─── Draw content panels ──────────────────────────────────────

function drawNamePanel(L, mx, my) {
    var y = L.cntY;
    var x = L.cntX, w = L.cntW;

    Renderer.drawString("&6&lItem Name", x, y, true); y += 14;
    drawField("Name", state.name, x, y, w, editingField==="name", "Enter display name");
    y += 24;

    // Color code quick-insert strip
    Renderer.drawString("&8Quick color:", x, y, true); y += 12;
    var colors = ["&0","&1","&2","&3","&4","&5","&6","&7","&8","&9","&a","&b","&c","&d","&e","&f"];
    var formats = ["&l","&o","&n","&m","&k","&r"];
    var cs = 14;
    for (var ci = 0; ci < colors.length; ci++) {
        var cx2 = x + ci * (cs+1), cy2 = y;
        var isHovC = mx>=cx2&&mx<=cx2+cs&&my>=cy2&&my<=cy2+cs;
        Renderer.drawRect(Renderer.color(22,24,40,220), cx2, cy2, cs, cs);
        border1(cx2, cy2, cs, cs, isHovC ? GOLD : BORDER);
        Renderer.drawString(colors[ci]+"█", cx2+1, cy2+1, true);
    }
    y += cs + 3;
    for (var fi = 0; fi < formats.length; fi++) {
        var fx = x + fi * (cs+1), fy = y;
        var fHov = mx>=fx&&mx<=fx+cs&&my>=fy&&my<=fy+cs;
        Renderer.drawRect(Renderer.color(22,24,40,220), fx, fy, cs, cs);
        border1(fx, fy, cs, cs, fHov ? GOLD : BORDER);
        Renderer.drawString(formats[fi]+"A", fx+1, fy+1, true);
    }
    y += cs + 6;

    // Preview
    Renderer.drawString("&7Preview:", x, y, true); y += 12;
    var prevStr = (""+state.name).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
    Renderer.drawRect(Renderer.color(10,11,18,220), x, y, w, 18);
    border1(x, y, w, 18, BORDER);
    Renderer.drawString(prevStr, x+5, y+4, true); y += 22;
}

function drawLorePanel(L, mx, my) {
    var y = L.cntY, x = L.cntX, w = L.cntW;
    Renderer.drawString("&6&lLore Lines &8(" + state.lore.length + ")", x, y, true); y += 14;

    var start = lorePage * LORE_PER_PAGE;
    var end   = Math.min(start + LORE_PER_PAGE, state.lore.length);

    for (var li = start; li <= end; li++) {
        var isEditingLine = editingField === ("lore" + li);
        if (li < state.lore.length) {
            // Existing line — leave room for move + delete buttons on right
            var lineY = y + (li - start) * 22;
            var lineW = w - 56; // space for 3 buttons: ↑ ↓ ✖
            Renderer.drawRect(isEditingLine ? Renderer.color(28,32,52,255) : Renderer.color(18,20,36,220), x, lineY, lineW, 18);
            border1(x, lineY, lineW, 18, isEditingLine ? GOLD : BORDER);
            Renderer.drawString("&8"+(li+1)+".", x+2, lineY+3, true);
            var dispL = (""+state.lore[li]).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
            var lw2 = Renderer.getStringWidth(dispL);
            var maxLW = lineW - 24;
            if (lw2 > maxLW) dispL = dispL.substring(0, Math.floor(dispL.length*(maxLW/lw2)));
            Renderer.drawString(dispL, x+16, lineY+3, true);
            if (isEditingLine && (Date.now()%900)<450)
                Renderer.drawRect(GOLD, x+16+Renderer.getStringWidth((""+state.lore[li]).replace(/&[0-9a-fk-or]/gi,""))+1, lineY+3, 1, 11);

            // Move Up button
            var upX = x + lineW + 2;
            var upHov = mx>=upX&&mx<=upX+16&&my>=lineY&&my<=lineY+8;
            Renderer.drawRect(upHov?Renderer.color(60,80,140,230):Renderer.color(30,35,60,200), upX, lineY, 16, 8);
            border1(upX, lineY, 16, 8, upHov?GOLD:BORDER);
            Renderer.drawString("&7\u25b2", upX+4, lineY, true);

            // Move Down button
            var dnX = upX;
            var dnHov = mx>=dnX&&mx<=dnX+16&&my>=lineY+9&&my<=lineY+17;
            Renderer.drawRect(dnHov?Renderer.color(60,80,140,230):Renderer.color(30,35,60,200), dnX, lineY+9, 16, 9);
            border1(dnX, lineY+9, 16, 9, dnHov?GOLD:BORDER);
            Renderer.drawString("&7\u25bc", dnX+4, lineY+9, true);

            // Delete button
            var dx = x + lineW + 20;
            var dHov = mx>=dx&&mx<=dx+16&&my>=lineY&&my<=lineY+18;
            Renderer.drawRect(dHov?Renderer.color(160,40,40,230):Renderer.color(80,25,25,200), dx, lineY, 16, 18);
            border1(dx, lineY, 16, 18, dHov?Renderer.color(220,60,60,255):BORDER);
            Renderer.drawString("&c\u2716", dx+3, lineY+3, true);
        } else if (li === state.lore.length) {
            // Add new line button
            var addY = y + (li - start) * 22;
            var addHov = mx>=x&&mx<=x+w&&my>=addY&&my<=addY+18;
            Renderer.drawRect(addHov?Renderer.color(30,50,30,230):Renderer.color(18,28,18,200), x, addY, w, 18);
            border1(x, addY, w, 18, addHov?Renderer.color(80,180,80,255):BORDER);
            Renderer.drawString("&8+ Add new lore line", x+3, addY+3, true);
        }
    }

    y += (end - start + 1) * 22 + 4;
    // Pagination
    if (state.lore.length > LORE_PER_PAGE) {
        var totalPages = Math.ceil(state.lore.length / LORE_PER_PAGE);
        drawBtn("<", x, y, 20, 16, mx, my); 
        Renderer.drawString("&7" + (lorePage+1) + "/" + totalPages, x+24, y+2, true);
        drawBtn(">", x+60, y, 20, 16, mx, my);
    }
}

function drawMetaPanel(L, mx, my) {
    var y = L.cntY, x = L.cntX, w = L.cntW;
    Renderer.drawString("&6&lItem Meta", x, y, true); y += 14;

    // Item ID (read-only display)
    Renderer.drawRect(Renderer.color(14,16,26,220), x, y, w, 18);
    border1(x, y, w, 18, BORDER);
    Renderer.drawString("&8ID: &7" + state.itemId, x+3, y+3, true); y += 22;

    // Damage
    drawField("Damage", ""+state.damage, x, y, w, editingField==="damage", "0"); y += 24;

    // Count
    drawField("Count", ""+state.count, x, y, w, editingField==="count", "1"); y += 24;

    // HideFlags
    drawField("Flags", ""+state.hideFlags, x, y, w, editingField==="hideFlags", "63"); y += 24;

    // Hex (leather only)
    if (state.itemId.toLowerCase().includes("leather")) {
        drawField("Hex", state.hex, x, y, w, editingField==="hex", "#RRGGBB"); y += 24;
    }

    // Toggles
    drawToggle("Unbreakable", state.unbreak, x, y, w); y += 22;
    drawToggle("Glow (fake enchant)", state.glow, x, y, w); y += 22;
}

function drawSavePanel(L, mx, my) {
    var y = L.cntY, x = L.cntX, w = L.cntW;
    Renderer.drawString("&6&lSave / Apply", x, y, true); y += 14;

    // Save path field
    drawField("Path", savePath, x, y, w, savePathEditing, "e.g. weapons/sword"); y += 24;
    Renderer.drawString("&8Saved to: Morgen/imports/<path>.mig", x, y, true); y += 16;

    // Buttons
    var bH = 22, bW = Math.floor((w-4)/2);
    var applyHov = drawBtn("Apply to Item", x, y, bW, bH, mx, my, Renderer.color(40,100,40,230));
    var saveHov  = drawBtn("Save as .mig",  x+bW+4, y, bW, bH, mx, my, Renderer.color(40,60,120,230));
    y += bH + 6;

    var reloadHov = drawBtn("Reload from Held", x, y, w, bH, mx, my, Renderer.color(80,60,20,230));
    y += bH + 10;

    // Status
    if (statusMsg && Date.now() < statusFlash) {
        Renderer.drawRect(Renderer.color(16,20,16,220), x, y, w, 18);
        border1(x, y, w, 18, Renderer.color(60,120,60,200));
        Renderer.drawString(statusMsg, x+5, y+3, true);
    }
}

// ─── Main draw ────────────────────────────────────────────────

gui.registerDraw(function(mx, my) {
    var L = getLayout();
    hoverBtn = null;

    // Shadow + Panel
    Renderer.drawRect(DARK, L.pX+5, L.pY+5, L.pW, L.pH);
    Renderer.drawRect(PANEL, L.pX, L.pY, L.pW, L.pH);
    Renderer.drawRect(GOLD, L.pX, L.pY, 2, L.pH);
    border1(L.pX, L.pY, L.pW, L.pH, BORDER);

    // Header
    Renderer.drawRect(HDR_BG, L.pX+2, L.pY, L.pW-2, HDR);
    Renderer.drawRect(Renderer.color(198,148,32,65), L.pX+2, L.pY+HDR-1, L.pW-2, 1);
    Renderer.drawRect(GOLD, L.pX+9, L.pY+10, 4, 4);
    var hName = stripColor(state.name) || state.itemId.replace("minecraft:","");
    Renderer.drawString("&6&l✎ Item Editor &8\u2014 &7" + hName, L.pX+18, L.pY+8, true);

    // Separator between sections and content
    Renderer.drawRect(Renderer.color(52,55,82,150), L.secX+SECTION_W+3, L.secY, 1, L.secH);

    // Section nav
    for (var si = 0; si < SECTIONS.length; si++) {
        var sec = SECTIONS[si];
        var sy2 = L.secY + si * 32;
        var isSel = activeSection === sec.id;
        var isHovSec = mx>=L.secX&&mx<=L.secX+SECTION_W&&my>=sy2&&my<=sy2+28;
        Renderer.drawRect(
            isSel ? Renderer.color(30,34,54,255) : (isHovSec ? Renderer.color(22,26,42,230) : Renderer.color(16,18,30,210)),
            L.secX, sy2, SECTION_W, 28
        );
        if (isSel) Renderer.drawRect(GOLD, L.secX+SECTION_W-2, sy2, 2, 28);
        border1(L.secX, sy2, SECTION_W, 28, isSel ? GOLD : BORDER);
        Renderer.drawString((isSel?"&f":"&8") + sec.label, L.secX+6, sy2+8, true);
    }

    // Content panel
    Renderer.drawRect(Renderer.color(16,18,30,180), L.cntX, L.cntY, L.cntW, L.cntH);
    border1(L.cntX, L.cntY, L.cntW, L.cntH, BORDER);

    // Draw active section
    if      (activeSection === "name")  drawNamePanel(L, mx, my);
    else if (activeSection === "lore")  drawLorePanel(L, mx, my);
    else if (activeSection === "meta")  drawMetaPanel(L, mx, my);
    else if (activeSection === "save")  drawSavePanel(L, mx, my);

    // Footer
    Renderer.drawRect(Renderer.color(14,16,26,240), L.pX+2, L.fY, L.pW-2, 22);
    Renderer.drawRect(Renderer.color(198,148,32,55), L.pX+2, L.fY, L.pW-2, 1);
    Renderer.drawString("&8ESC close  \u00b7  Click fields to edit  \u00b7  Enter to confirm", L.pX+PAD, L.fY+5, true);
});

// ─── Input handlers ───────────────────────────────────────────

gui.registerClicked(function(mx, my, btn) {
    var L = getLayout();

    // Section nav click
    for (var si = 0; si < SECTIONS.length; si++) {
        var sy2 = L.secY + si * 32;
        if (mx>=L.secX&&mx<=L.secX+SECTION_W&&my>=sy2&&my<=sy2+28) {
            activeSection = SECTIONS[si].id;
            editingField = null;
            return;
        }
    }

    // Content clicks
    if (activeSection === "name") handleNameClick(L, mx, my, btn);
    else if (activeSection === "lore") handleLoreClick(L, mx, my, btn);
    else if (activeSection === "meta") handleMetaClick(L, mx, my, btn);
    else if (activeSection === "save") handleSaveClick(L, mx, my, btn);
});

function handleNameClick(L, mx, my, btn) {
    var y = L.cntY + 14, x = L.cntX, w = L.cntW;
    // Name field
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField = "name"; editBuffer = state.name; return; }
    y += 24;
    // Color strip — row 1
    var cs = 14;
    var colors = ["&0","&1","&2","&3","&4","&5","&6","&7","&8","&9","&a","&b","&c","&d","&e","&f"];
    y += 12;
    for (var ci = 0; ci < colors.length; ci++) {
        var cx2 = x + ci*(cs+1);
        if (mx>=cx2&&mx<=cx2+cs&&my>=y&&my<=y+cs) {
            if (editingField === "name") state.name += colors[ci];
            return;
        }
    }
    y += cs + 3;
    var formats = ["&l","&o","&n","&m","&k","&r"];
    for (var fi = 0; fi < formats.length; fi++) {
        var fx = x + fi*(cs+1);
        if (mx>=fx&&mx<=fx+cs&&my>=y&&my<=y+cs) {
            if (editingField === "name") state.name += formats[fi];
            return;
        }
    }
    editingField = null;
}

function handleLoreClick(L, mx, my, btn) {
    var y = L.cntY + 14, x = L.cntX, w = L.cntW;
    var start = lorePage * LORE_PER_PAGE;
    var end   = Math.min(start + LORE_PER_PAGE, state.lore.length);

    for (var li = start; li <= end; li++) {
        var lineY = y + (li - start) * 22;
        if (li < state.lore.length) {
            var lineW = w - 56;
            // Move Up
            var upX = x + lineW + 2;
            if (mx>=upX&&mx<=upX+16&&my>=lineY&&my<=lineY+8) {
                if (li > 0) { var tmp=state.lore[li]; state.lore[li]=state.lore[li-1]; state.lore[li-1]=tmp; editingField=null; }
                return;
            }
            // Move Down
            if (mx>=upX&&mx<=upX+16&&my>=lineY+9&&my<=lineY+17) {
                if (li < state.lore.length-1) { var tmp2=state.lore[li]; state.lore[li]=state.lore[li+1]; state.lore[li+1]=tmp2; editingField=null; }
                return;
            }
            // Delete button
            var dx = x + lineW + 20;
            if (mx>=dx&&mx<=dx+16&&my>=lineY&&my<=lineY+18) {
                state.lore.splice(li, 1); editingField = null; return;
            }
            // Edit line
            if (mx>=x&&mx<=x+lineW&&my>=lineY&&my<=lineY+18) {
                editingField = "lore"+li; editBuffer = state.lore[li]; return;
            }
        } else if (li === state.lore.length) {
            // Add new line
            if (mx>=x&&mx<=x+w&&my>=lineY&&my<=lineY+18) {
                state.lore.push(""); editingField = "lore"+state.lore.length-1; editBuffer = ""; return;
            }
        }
    }

    // Pagination
    if (state.lore.length > LORE_PER_PAGE) {
        var pY2 = y + (end - start + 1) * 22 + 4;
        if (mx>=x&&mx<=x+20&&my>=pY2&&my<=pY2+16&&lorePage>0) { lorePage--; editingField=null; }
        if (mx>=x+60&&mx<=x+80&&my>=pY2&&my<=pY2+16) { lorePage++; editingField=null; }
    }
}

function handleMetaClick(L, mx, my, btn) {
    var y = L.cntY + 14, x = L.cntX, w = L.cntW;
    y += 22; // skip ID row
    // Damage
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="damage"; editBuffer=""+state.damage; return; } y+=24;
    // Count
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="count"; editBuffer=""+state.count; return; } y+=24;
    // HideFlags
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="hideFlags"; editBuffer=""+state.hideFlags; return; } y+=24;
    // Hex
    if (state.itemId.toLowerCase().includes("leather")) {
        if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="hex"; editBuffer=state.hex; return; } y+=24;
    }
    // Unbreakable toggle
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+18) { state.unbreak=!state.unbreak; return; } y+=22;
    // Glow toggle
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+18) { state.glow=!state.glow; return; } y+=22;
    editingField = null;
}

function handleSaveClick(L, mx, my, btn) {
    var y = L.cntY + 14, x = L.cntX, w = L.cntW;
    // Save path field
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { savePathEditing=true; editBuffer=savePath; editingField="savePath"; return; }
    y += 40;
    var bH = 22, bW = Math.floor((w-4)/2);
    // Apply button
    if (mx>=x&&mx<=x+bW&&my>=y&&my<=y+bH) { applyToHeld(); return; }
    // Save button
    if (mx>=x+bW+4&&mx<=x+w&&my>=y&&my<=y+bH) { saveAsMig(); return; }
    y += bH + 6;
    // Reload
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+bH) { loadFromHeld(); return; }
    editingField = null; savePathEditing = false;
}

gui.registerKeyTyped(function(ch, code) {
    if (code === 1) {  // ESC
        if (editingField) { editingField = null; savePathEditing = false; return; }
        gui.close(); return;
    }
    if (code === 28 || code === 156) {  // Enter
        commitEdit(); return;
    }
    if (code === 14) {  // Backspace
        if (editingField === "name")     { state.name = state.name.slice(0,-1); return; }
        if (editingField === "savePath") { savePath   = savePath.slice(0,-1); return; }
        if (editingField === "damage")   { editBuffer = editBuffer.slice(0,-1); state.damage = parseInt(editBuffer)||0; return; }
        if (editingField === "count")    { editBuffer = editBuffer.slice(0,-1); state.count  = Math.max(1,parseInt(editBuffer)||1); return; }
        if (editingField === "hideFlags"){ editBuffer = editBuffer.slice(0,-1); state.hideFlags = parseInt(editBuffer)||0; return; }
        if (editingField === "hex")      { state.hex = state.hex.slice(0,-1); return; }
        var loreMatch = editingField && editingField.match(/^lore(\d+)$/);
        if (loreMatch) {
            var li2 = parseInt(loreMatch[1]);
            if (li2 < state.lore.length) state.lore[li2] = state.lore[li2].slice(0,-1);
        }
        return;
    }
    if (!ch || ch === "\u0000") return;

    // Route character to active field
    if (editingField === "name")     { state.name += ch; return; }
    if (editingField === "savePath") { savePath   += ch; return; }
    if (editingField === "hex")      { state.hex  += ch; return; }
    if (editingField === "damage" && /[\d\-]/.test(ch))    { editBuffer+=ch; state.damage = parseInt(editBuffer)||0; return; }
    if (editingField === "count"  && /[\d]/.test(ch))       { editBuffer+=ch; state.count = Math.max(1,parseInt(editBuffer)||1); return; }
    if (editingField === "hideFlags" && /[\d]/.test(ch))    { editBuffer+=ch; state.hideFlags = Math.min(63,parseInt(editBuffer)||0); return; }
    var lm = editingField && editingField.match(/^lore(\d+)$/);
    if (lm) {
        var li3 = parseInt(lm[1]);
        if (li3 < state.lore.length) state.lore[li3] += ch;
    }
});

function commitEdit() {
    editingField = null; savePathEditing = false;
}

register("guiClosed", function() { guiOpen = false; editingField = null; });

export function openEditGui() {
    if (!loadFromHeld()) return;
    guiOpen = true;
    gui.open();
}
