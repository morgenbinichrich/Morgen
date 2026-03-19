import { msg, cleanLore, stripColor, requireCreative } from "../utils/utils";
import { snapshotHeld } from "../src/undoHistory";
import Settings from "../utils/config";

var _externalLoreClipboard = null;

export function setEditLoreClipboard(lines) {
    _externalLoreClipboard = lines;
}

var gui     = new Gui();
var guiOpen = false;

var state = {
    itemId:          "minecraft:stone",
    itemType:        "Misc",
    damage:          0,
    count:           1,
    name:            "",
    lore:            [],
    unbreak:         false,
    glow:            false,
    hideFlags:       63,
    hex:             "",
    texture:         "",
    itemModel:       "",
    enchants:        [],
    stats:           {},
    extraAttributes: null
};

var activeSection   = "name";
var editingField    = null;
var editBuffer      = "";
var lorePage        = 0;
var LORE_PER_PAGE   = 7;
var savePath        = "";
var savePathEditing = false;
var statusMsg       = null;
var statusFlash     = 0;
var lastSavedPath   = null;

var modelPickerOpen   = false;
var modelPickerScroll = 0;
var modelSearch       = "";
var modelSearchActive = false;
var MODEL_PER_PAGE    = 12;

var VANILLA_MODELS = [
    "minecraft:bamboo","minecraft:barrel","minecraft:bell","minecraft:blast_furnace",
    "minecraft:bone_meal","minecraft:bundle","minecraft:campfire","minecraft:chain",
    "minecraft:charcoal","minecraft:chorus_fruit","minecraft:copper_ingot",
    "minecraft:crossbow","minecraft:dried_kelp","minecraft:echo_shard",
    "minecraft:elytra","minecraft:end_crystal","minecraft:goat_horn",
    "minecraft:heart_of_the_sea","minecraft:honey_bottle","minecraft:honeycomb",
    "minecraft:kelp","minecraft:lantern","minecraft:mace","minecraft:nautilus_shell",
    "minecraft:netherite_axe","minecraft:netherite_boots","minecraft:netherite_chestplate",
    "minecraft:netherite_helmet","minecraft:netherite_hoe","minecraft:netherite_ingot",
    "minecraft:netherite_leggings","minecraft:netherite_pickaxe","minecraft:netherite_scrap",
    "minecraft:netherite_shovel","minecraft:netherite_sword","minecraft:phantom_membrane",
    "minecraft:raw_copper","minecraft:raw_gold","minecraft:raw_iron",
    "minecraft:recovery_compass","minecraft:scute","minecraft:shield",
    "minecraft:shulker_shell","minecraft:smithing_template","minecraft:soul_lantern",
    "minecraft:spectral_arrow","minecraft:suspicious_stew","minecraft:sweet_berries",
    "minecraft:tipped_arrow","minecraft:totem_of_undying","minecraft:trident",
    "minecraft:turtle_helmet","minecraft:warped_fungus_on_a_stick","minecraft:wind_charge"
];

var SECTIONS = [
    { id: "name",  label: "Name"  },
    { id: "lore",  label: "Lore"  },
    { id: "meta",  label: "Meta"  },
    { id: "save",  label: "Save"  }
];

var PAD   = 8;
var HDR   = 28;
var SEC_W = 80;
var CNT_W = 270;
var PRV_W = 160;

function getLayout() {
    var sw = Renderer.screen.getWidth(), sh = Renderer.screen.getHeight();
    var pW = SEC_W + CNT_W + PRV_W + PAD * 4;
    var pH = Math.min(sh - 20, 440);
    var pX = Math.floor(sw/2 - pW/2);
    var pY = Math.floor(sh/2 - pH/2);
    var cntX = pX + PAD + SEC_W + PAD;
    var prvX = cntX + CNT_W + PAD;
    return {
        pX: pX, pY: pY, pW: pW, pH: pH,
        secX: pX + PAD, secY: pY + HDR + PAD,
        secW: SEC_W, secH: pH - HDR - PAD * 2 - 26,
        cntX: cntX, cntY: pY + HDR + PAD,
        cntW: CNT_W, cntH: pH - HDR - PAD * 2 - 26,
        prvX: prvX, prvY: pY + HDR + PAD,
        prvW: PRV_W, prvH: pH - HDR - PAD * 2 - 26,
        fY: pY + pH - 24
    };
}

var GOLD   = Renderer.color(198, 148, 32, 255);
var PANEL  = Renderer.color(13, 14, 21, 252);
var BORDER = Renderer.color(52, 55, 82, 220);
var HDR_C  = Renderer.color(18, 20, 34, 255);
var DARK   = Renderer.color(0, 0, 0, 90);

function border1(x, y, w, h, col, t) {
    t = t || 1;
    Renderer.drawRect(col, x, y, w, t);
    Renderer.drawRect(col, x, y+h-t, w, t);
    Renderer.drawRect(col, x, y, t, h);
    Renderer.drawRect(col, x+w-t, y, t, h);
}

function drawField(label, val, x, y, w, active, hint) {
    var h = 20;
    Renderer.drawRect(active ? Renderer.color(28,32,56,255) : Renderer.color(18,20,36,230), x, y, w, h);
    border1(x, y, w, h, active ? GOLD : BORDER);
    var labelStr = label + ": ";
    var labelW   = Renderer.getStringWidth(labelStr);
    Renderer.drawString("\u00a78" + labelStr, x+4, y+4, true);
    var maxW  = w - labelW - 14;
    var valX  = x + 4 + labelW;

    if (active) {
        var raw = "" + val;
        while (raw.length > 0 && Renderer.getStringWidth(raw) > maxW) raw = raw.slice(0, -1);
        if (raw === "" && hint) {
            Renderer.drawString("\u00a78" + hint, valX, y+4, true);
        } else {
            Renderer.drawString(raw, valX, y+4, false);
        }
        if ((Date.now()%900) < 450) {
            Renderer.drawRect(GOLD, valX + Renderer.getStringWidth(raw), y+3, 1, 13);
        }
    } else {
        var colored = val !== "" ? (""+val).replace(/&([0-9a-fk-or])/gi, "\u00a7$1") : (hint ? "\u00a78" + hint : "");
        while (colored.length > 1 && Renderer.getStringWidth(colored.replace(/\u00a7./g,"")) > maxW)
            colored = colored.slice(0, -1);
        Renderer.drawString(colored, valX, y+4, true);
    }
}

function drawToggle(label, val, x, y, w, mx, my) {
    var hov = mx >= x && mx <= x+w && my >= y && my <= y+18;
    Renderer.drawRect(hov ? Renderer.color(28,32,52,240) : Renderer.color(18,20,36,220), x, y, w, 18);
    border1(x, y, w, 18, hov ? Renderer.color(80,90,130,220) : BORDER);
    Renderer.drawString("&7" + label, x+4, y+4, true);
    var pill = val ? "&a■ ON" : "&c■ OFF";
    var pw   = Renderer.getStringWidth(val ? "■ ON" : "■ OFF") + 4;
    Renderer.drawString(pill, x+w-pw-4, y+4, true);
}

function drawBtn(label, x, y, w, h, mx, my, col) {
    var hov = mx >= x && mx <= x+w && my >= y && my <= y+h;
    Renderer.drawRect(hov ? (col || Renderer.color(70,76,115,235)) : Renderer.color(26,30,50,215), x, y, w, h);
    border1(x, y, w, h, hov ? GOLD : BORDER);
    var lw = Renderer.getStringWidth(label);
    Renderer.drawString("&f"+label, x+Math.floor((w-lw)/2), y+Math.floor(h/2)-3, true);
    return hov;
}

function getFilteredModels() {
    if (!modelSearch) return VANILLA_MODELS;
    var q = modelSearch.toLowerCase();
    return VANILLA_MODELS.filter(function(m) { return m.indexOf(q) !== -1; });
}

function drawPreviewPanel(L, mx, my) {
    var x = L.prvX, y = L.prvY, w = L.prvW, h = L.prvH;

    Renderer.drawRect(Renderer.color(10,11,20,215), x, y, w, h);
    Renderer.drawRect(Renderer.color(198,148,32,255), x, y, 2, h);
    border1(x, y, w, h, Renderer.color(40,44,70,200));

    var iy = y + 14;

    try {
        var heldItem = Player.getHeldItem();
        if (heldItem && heldItem.getID() !== 0) {
            var cx = x + Math.floor(w / 2) - 16;
            heldItem.draw(cx, iy, 2);
            iy += 40;
        } else {
            Renderer.drawString("\u00a78no item held", x + Math.floor(w/2) - Renderer.getStringWidth("no item held")/2, iy + 10, true);
            iy += 30;
        }
    } catch(_) { iy += 40; }

    var nameStr = (""+state.name).replace(/&([0-9a-fk-or])/gi, "\u00a7$1") || "\u00a78unnamed";
    var nRaw    = nameStr.replace(/\u00a7./g, "");
    if (Renderer.getStringWidth(nRaw) > w - 12) {
        var raw = stripColor(state.name);
        while (raw.length > 1 && Renderer.getStringWidth(raw + "\u2026") > w - 12) raw = raw.slice(0, -1);
        nameStr = "\u00a7f" + raw + "\u2026";
    }
    var nameX = x + Math.floor((w - Renderer.getStringWidth(nameStr.replace(/\u00a7./g,"")))/2);
    Renderer.drawString(nameStr, nameX, iy, true);
    iy += 14;

    if (state.itemModel) {
        var ms = state.itemModel.replace("minecraft:","");
        var msW = Renderer.getStringWidth(ms) + 10;
        var msX = x + Math.floor((w - msW) / 2);
        Renderer.drawRect(Renderer.color(30,40,65,200), msX, iy, msW, 13);
        border1(msX, iy, msW, 13, Renderer.color(60,80,140,200));
        Renderer.drawString("\u00a7b" + ms, msX + 4, iy + 2, true);
        iy += 18;
    }

    Renderer.drawRect(Renderer.color(52,55,82,80), x+8, iy+2, w-16, 1);
    iy += 8;

    if (state.lore.length === 0) {
        Renderer.drawString("\u00a78\u2014  no lore  \u2014", x + Math.floor((w - Renderer.getStringWidth("\u2014  no lore  \u2014"))/2), iy, true);
    } else {
        var maxLines = Math.floor((y + h - iy - 8) / 11);
        state.lore.slice(0, maxLines).forEach(function(l) {
            var lStr = (""+l).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
            if (lStr.charAt(0) !== "\u00a7") lStr = "\u00a79" + lStr;
            var lRaw = lStr.replace(/\u00a7./g,"");
            while (lRaw.length > 1 && Renderer.getStringWidth(lRaw) > w - 14) {
                lStr = lStr.slice(0, -1);
                lRaw = lStr.replace(/\u00a7./g,"");
            }
            Renderer.drawString(lStr, x+7, iy, true);
            iy += 11;
        });
        if (state.lore.length > maxLines)
            Renderer.drawString("\u00a78+" + (state.lore.length - maxLines) + " lines", x+7, iy, true);
    }
}

function drawModelPicker(L, mx, my) {
    var x = L.cntX, y = L.cntY, w = L.cntW;

    Renderer.drawRect(Renderer.color(12,13,22,252), x-2, y-2, w+4, L.cntH+4);
    border1(x-2, y-2, w+4, L.cntH+4, GOLD);

    Renderer.drawString("&6ItemModel Picker", x, y, true);
    var closeHov = mx >= x+w-52 && mx <= x+w && my >= y-2 && my <= y+12;
    Renderer.drawRect(closeHov ? Renderer.color(140,35,35,230) : Renderer.color(60,20,20,200), x+w-52, y-1, 52, 13);
    border1(x+w-52, y-1, 52, 13, closeHov ? Renderer.color(220,60,60,255) : BORDER);
    Renderer.drawString("&c✖ Close", x+w-49, y+1, true);
    y += 16;

    var sActive = modelSearchActive;
    Renderer.drawRect(sActive ? Renderer.color(28,32,56,255) : Renderer.color(18,20,36,230), x, y, w, 18);
    border1(x, y, w, 18, sActive ? GOLD : BORDER);
    Renderer.drawString("&8» &f" + (modelSearch || "") + (sActive && (Date.now()%900)<450 ? "|" : ""), x+4, y+4, true);
    if (!modelSearch) Renderer.drawString("&8search...", x+12, y+4, true);
    y += 22;

    var models    = getFilteredModels();
    var maxScroll = Math.max(0, models.length - MODEL_PER_PAGE);
    if (modelPickerScroll > maxScroll) modelPickerScroll = maxScroll;

    var rowH  = 22;
    var iconW = 18;
    for (var i = modelPickerScroll; i < Math.min(modelPickerScroll + MODEL_PER_PAGE, models.length); i++) {
        var m      = models[i];
        var short  = m.replace("minecraft:", "");
        var isSel  = state.itemModel === m;
        var rowHov = mx >= x && mx <= x+w && my >= y && my <= y+rowH-1;
        Renderer.drawRect(
            isSel  ? Renderer.color(30,55,30,240) :
            rowHov ? Renderer.color(26,30,52,225) :
                     Renderer.color(16,18,30,190),
            x, y, w, rowH-1
        );
        if (isSel) Renderer.drawRect(Renderer.color(80,200,80,210), x, y, 2, rowH-1);
        else if (rowHov) Renderer.drawRect(GOLD, x, y, 2, rowH-1);

        Renderer.drawString((isSel ? "&a" : (rowHov ? "&f" : "&7")) + short, x+6, y+6, true);

        try {
            var mcReg = Java.type("net.minecraft.item.Item").func_111206_d(m);
            if (mcReg) {
                var mcStack = new (Java.type("net.minecraft.item.ItemStack"))(mcReg, 1, 0);
                var ctItem  = new Item(mcStack);
                if (ctItem && ctItem.getID() !== 0) ctItem.draw(x + w - iconW - 2, y + 2, 1);
            }
        } catch(_) {}

        y += rowH;
    }

    var showing = Math.min(modelPickerScroll + MODEL_PER_PAGE, models.length);
    Renderer.drawString(
        "&8" + (modelPickerScroll+1) + "–" + showing + " / " + models.length,
        x, y+4, true
    );
}

function drawNamePanel(L, mx, my) {
    var x = L.cntX, y = L.cntY, w = L.cntW;
    Renderer.drawString("&f&lItem Name", x, y, true); y += 16;
    drawField("Name", state.name, x, y, w, editingField === "name", "Enter display name");
    y += 26;

    Renderer.drawString("&8Colors:", x, y, true); y += 12;
    var colors  = ["&0","&1","&2","&3","&4","&5","&6","&7","&8","&9","&a","&b","&c","&d","&e","&f"];
    var formats = ["&l","&o","&n","&m","&k","&r"];
    var cs = 14;
    for (var ci = 0; ci < colors.length; ci++) {
        var cx = x + ci*(cs+1), cy = y;
        var hov = mx >= cx && mx <= cx+cs && my >= cy && my <= cy+cs;
        Renderer.drawRect(hov ? Renderer.color(50,54,80,240) : Renderer.color(22,24,40,210), cx, cy, cs, cs);
        border1(cx, cy, cs, cs, hov ? GOLD : BORDER);
        Renderer.drawString(colors[ci]+"█", cx+1, cy+2, true);
    }
    y += cs+3;
    for (var fi = 0; fi < formats.length; fi++) {
        var fx = x+fi*(cs+1), fy = y;
        var fhov = mx >= fx && mx <= fx+cs && my >= fy && my <= fy+cs;
        Renderer.drawRect(fhov ? Renderer.color(50,54,80,240) : Renderer.color(22,24,40,210), fx, fy, cs, cs);
        border1(fx, fy, cs, cs, fhov ? GOLD : BORDER);
        Renderer.drawString(formats[fi]+"A", fx+1, fy+2, true);
    }
}

function drawLorePanel(L, mx, my) {
    var x = L.cntX, y = L.cntY, w = L.cntW;

    Renderer.drawString("&f&lLore &8(" + state.lore.length + " lines)", x, y, true);

    var hasClip  = _externalLoreClipboard && _externalLoreClipboard.length > 0;
    var pasteW   = Renderer.getStringWidth("Paste " + (hasClip ? "("+_externalLoreClipboard.length+")" : "")) + 10;
    var pasteX   = x + w - pasteW;
    var pasteHov = hasClip && mx >= pasteX && mx <= pasteX+pasteW && my >= y-1 && my <= y+11;
    Renderer.drawRect(
        !hasClip ? Renderer.color(22,24,38,160) : (pasteHov ? Renderer.color(50,80,140,240) : Renderer.color(28,36,70,210)),
        pasteX, y-1, pasteW, 12
    );
    border1(pasteX, y-1, pasteW, 12, hasClip ? (pasteHov ? GOLD : Renderer.color(60,100,200,200)) : BORDER);
    Renderer.drawString(
        (!hasClip ? "&8" : (pasteHov ? "&f" : "&b")) + "Paste" + (hasClip ? " &8("+_externalLoreClipboard.length+")" : ""),
        pasteX+4, y+1, true
    );

    y += 16;

    var start = lorePage * LORE_PER_PAGE;
    var end   = Math.min(start + LORE_PER_PAGE, state.lore.length);

    for (var li = start; li <= end; li++) {
        var lineY = y + (li - start) * 22;
        if (li < state.lore.length) {
            var isEdit = editingField === ("lore"+li);
            var lineW  = w - 56;
            Renderer.drawRect(isEdit ? Renderer.color(28,32,56,255) : Renderer.color(18,20,36,215), x, lineY, lineW, 18);
            border1(x, lineY, lineW, 18, isEdit ? GOLD : BORDER);
            Renderer.drawString("&8"+(li+1)+".", x+3, lineY+3, true);
            var rawLine = ""+state.lore[li];
            if (isEdit) {
                var truncLine = rawLine;
                var maxLW = lineW - 22;
                while (truncLine.length > 0 && Renderer.getStringWidth(truncLine) > maxLW)
                    truncLine = truncLine.slice(0, -1);
                Renderer.drawString(truncLine, x+16, lineY+3, false);
                if ((Date.now()%900)<450)
                    Renderer.drawRect(GOLD, x+16+Renderer.getStringWidth(truncLine)+1, lineY+3, 1, 10);
            } else {
                var dispL = rawLine.replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
                if (dispL.charAt(0) !== "\u00a7") dispL = "\u00a79" + dispL;
                Renderer.drawString(dispL, x+16, lineY+3, true);
            }

            var upX  = x+lineW+2;
            var upH  = mx >= upX && mx <= upX+16 && my >= lineY && my <= lineY+8;
            var dnH  = mx >= upX && mx <= upX+16 && my >= lineY+9 && my <= lineY+18;
            var delX = x+lineW+20;
            var delH = mx >= delX && mx <= delX+16 && my >= lineY && my <= lineY+18;
            Renderer.drawRect(upH  ? Renderer.color(60,80,140,235) : Renderer.color(28,32,56,200), upX, lineY, 16, 8);
            border1(upX, lineY, 16, 8, upH ? GOLD : BORDER);
            Renderer.drawString("&7▲", upX+3, lineY, true);
            Renderer.drawRect(dnH  ? Renderer.color(60,80,140,235) : Renderer.color(28,32,56,200), upX, lineY+9, 16, 9);
            border1(upX, lineY+9, 16, 9, dnH ? GOLD : BORDER);
            Renderer.drawString("&7▼", upX+3, lineY+9, true);
            Renderer.drawRect(delH ? Renderer.color(160,40,40,235) : Renderer.color(80,24,24,200), delX, lineY, 16, 18);
            border1(delX, lineY, 16, 18, delH ? Renderer.color(220,60,60,255) : BORDER);
            Renderer.drawString("&c✖", delX+2, lineY+3, true);
        } else if (li === state.lore.length) {
            var addHov = mx >= x && mx <= x+w && my >= lineY && my <= lineY+18;
            Renderer.drawRect(addHov ? Renderer.color(28,50,28,235) : Renderer.color(16,28,16,210), x, lineY, w, 18);
            border1(x, lineY, w, 18, addHov ? Renderer.color(80,180,80,255) : BORDER);
            Renderer.drawString("&8+ Add line", x+4, lineY+3, true);
        }
    }

    if (state.lore.length > LORE_PER_PAGE) {
        var pY2 = y + (end - start + 1) * 22 + 4;
        var tot = Math.ceil(state.lore.length / LORE_PER_PAGE);
        drawBtn("<", x, pY2, 22, 16, mx, my);
        Renderer.drawString("&7"+(lorePage+1)+"/"+tot, x+26, pY2+2, true);
        drawBtn(">", x+62, pY2, 22, 16, mx, my);
    }
}

function drawMetaPanel(L, mx, my) {
    var x = L.cntX, y = L.cntY, w = L.cntW;
    Renderer.drawString("&f&lItem Meta", x, y, true); y += 16;

    Renderer.drawRect(Renderer.color(14,16,26,215), x, y, w, 18);
    border1(x, y, w, 18, BORDER);
    Renderer.drawString("&8ID: &7" + state.itemId, x+4, y+3, true);
    y += 22;

    Renderer.drawRect(Renderer.color(14,16,26,215), x, y, w, 18);
    border1(x, y, w, 18, BORDER);
    Renderer.drawString("&8Type: &b" + state.itemType, x+4, y+3, true);
    y += 22;

    drawField("Damage", ""+state.damage,    x, y, w, editingField==="damage",    "0");   y += 22;
    drawField("Count",  ""+state.count,     x, y, w, editingField==="count",     "1");   y += 22;
    drawField("Flags",  ""+state.hideFlags, x, y, w, editingField==="hideFlags", "63");  y += 22;

    if (state.itemId.indexOf("leather") !== -1) {
        drawField("Hex", state.hex, x, y, w, editingField==="hex", "#RRGGBB"); y += 22;
    }

    var modelBtnHov = mx >= x && mx <= x+w && my >= y && my <= y+20;
    var modelLabel  = state.itemModel ? "&7"+state.itemModel.replace("minecraft:","") : "&8click to pick...";
    Renderer.drawRect(modelBtnHov ? Renderer.color(30,38,60,240) : Renderer.color(18,20,36,220), x, y, w, 20);
    border1(x, y, w, 20, modelBtnHov ? GOLD : BORDER);
    Renderer.drawString("&8Model: " + modelLabel, x+4, y+4, true);
    var pickW = Renderer.getStringWidth("Pick") + 10;
    Renderer.drawRect(Renderer.color(40,50,90,220), x+w-pickW-2, y+2, pickW, 16);
    border1(x+w-pickW-2, y+2, pickW, 16, Renderer.color(70,100,180,200));
    Renderer.drawString("&bPick", x+w-pickW+1, y+5, true);
    if (state.itemModel) {
        var clearW = Renderer.getStringWidth("✖") + 8;
        var clrX   = x+w-pickW-clearW-4;
        var clrHov = mx >= clrX && mx <= clrX+clearW && my >= y+2 && my <= y+18;
        Renderer.drawRect(clrHov ? Renderer.color(140,35,35,230) : Renderer.color(70,20,20,200), clrX, y+2, clearW, 16);
        border1(clrX, y+2, clearW, 16, clrHov ? Renderer.color(220,60,60,255) : BORDER);
        Renderer.drawString("&c✖", clrX+3, y+5, true);
    }
    y += 24;

    drawToggle("Unbreakable", state.unbreak, x, y, w, mx, my); y += 22;
    drawToggle("Glow",        state.glow,    x, y, w, mx, my); y += 22;

    if (state.enchants.length > 0) {
        Renderer.drawString("&8Enchants: &d" + state.enchants.map(function(e){
            return "id:"+e.id+" lvl:"+e.lvl;
        }).join(", "), x, y, true);
    }
}

function drawSavePanel(L, mx, my) {
    var x = L.cntX, y = L.cntY, w = L.cntW;
    Renderer.drawString("&f&lSave / Apply", x, y, true); y += 16;
    drawField("Path", savePath, x, y, w, savePathEditing, "e.g. weapons/sword"); y += 22;
    Renderer.drawString("&8Morgen/imports/<path>.mig", x, y, true); y += 18;
    var bH = 22, bW = Math.floor((w-4)/2);
    drawBtn("Apply to Item",    x,        y, bW, bH, mx, my, Renderer.color(30,90,35,230));
    drawBtn("Save .mig",        x+bW+4,   y, bW, bH, mx, my, Renderer.color(30,55,110,230));
    y += bH+6;
    drawBtn("Reload from Held", x,        y, bW, bH, mx, my, Renderer.color(75,55,18,230));
    if (lastSavedPath) drawBtn("Open in Editor", x+bW+4, y, bW, bH, mx, my, Renderer.color(55,30,90,230));
    y += bH+10;
    if (statusMsg && Date.now() < statusFlash) {
        Renderer.drawRect(Renderer.color(16,20,16,200), x, y, w, 18);
        border1(x, y, w, 18, Renderer.color(60,120,60,180));
        Renderer.drawString(statusMsg, x+5, y+3, true);
    }
}

gui.registerDraw(function(mx, my) {
    var L = getLayout();

    Renderer.drawRect(DARK, L.pX+5, L.pY+5, L.pW, L.pH);
    Renderer.drawRect(PANEL, L.pX, L.pY, L.pW, L.pH);
    Renderer.drawRect(GOLD, L.pX, L.pY, 2, L.pH);
    border1(L.pX, L.pY, L.pW, L.pH, BORDER);

    Renderer.drawRect(HDR_C, L.pX+2, L.pY, L.pW-2, HDR);
    Renderer.drawRect(Renderer.color(198,148,32,60), L.pX+2, L.pY+HDR-1, L.pW-2, 1);
    var hName = stripColor(state.name) || state.itemId.replace("minecraft:","");
    Renderer.drawString("&6Item Editor &8— &7" + hName + " &8[" + state.itemType + "]", L.pX+10, L.pY+8, true);

    Renderer.drawRect(Renderer.color(52,55,82,140), L.secX+SEC_W+3, L.secY, 1, L.secH);
    Renderer.drawRect(Renderer.color(52,55,82,140), L.cntX+CNT_W+3, L.cntY, 1, L.prvH);

    for (var si = 0; si < SECTIONS.length; si++) {
        var sec  = SECTIONS[si];
        var sy   = L.secY + si*34;
        var isSel = activeSection === sec.id;
        var isHov = mx >= L.secX && mx <= L.secX+SEC_W && my >= sy && my <= sy+30;
        Renderer.drawRect(
            isSel ? Renderer.color(30,34,58,255) : (isHov ? Renderer.color(22,26,44,230) : Renderer.color(16,18,30,210)),
            L.secX, sy, SEC_W, 30
        );
        if (isSel) Renderer.drawRect(GOLD, L.secX+SEC_W-2, sy, 2, 30);
        border1(L.secX, sy, SEC_W, 30, isSel ? GOLD : BORDER);
        Renderer.drawString((isSel?"&f":"&8")+sec.label, L.secX+8, sy+9, true);
    }

    Renderer.drawRect(Renderer.color(16,18,30,180), L.cntX, L.cntY, L.cntW, L.cntH);
    border1(L.cntX, L.cntY, L.cntW, L.cntH, BORDER);

    if (modelPickerOpen) {
        drawModelPicker(L, mx, my);
    } else {
        if      (activeSection === "name") drawNamePanel(L, mx, my);
        else if (activeSection === "lore") drawLorePanel(L, mx, my);
        else if (activeSection === "meta") drawMetaPanel(L, mx, my);
        else if (activeSection === "save") drawSavePanel(L, mx, my);
    }

    drawPreviewPanel(L, mx, my);

    Renderer.drawRect(Renderer.color(14,16,26,245), L.pX+2, L.fY, L.pW-2, 22);
    Renderer.drawRect(Renderer.color(198,148,32,50), L.pX+2, L.fY, L.pW-2, 1);
    Renderer.drawString("&8ESC close  ·  Enter confirm  ·  Click fields to edit", L.pX+PAD, L.fY+5, true);
});

gui.registerScrolled(function(mx, my, dir) {
    if (modelPickerOpen) {
        var models = getFilteredModels();
        modelPickerScroll = Math.max(0, Math.min(models.length - MODEL_PER_PAGE, modelPickerScroll - dir));
    }
});

gui.registerClicked(function(mx, my, btn) {
    var L = getLayout();

    if (modelPickerOpen) {
        var closeX = L.cntX + L.cntW - 50;
        if (mx >= closeX && mx <= closeX+50 && my >= L.cntY && my <= L.cntY+14) {
            modelPickerOpen = false; return;
        }
        if (mx >= L.cntX && mx <= L.cntX+L.cntW && my >= L.cntY+38 && my <= L.cntY+38+MODEL_PER_PAGE*17) {
            var rowIdx = Math.floor((my - (L.cntY+38)) / 17) + modelPickerScroll;
            var models = getFilteredModels();
            if (rowIdx >= 0 && rowIdx < models.length) {
                state.itemModel  = models[rowIdx];
                modelPickerOpen  = false;
                modelSearch      = "";
                modelSearchActive = false;
                setStatus("&aModel set: &e" + models[rowIdx].replace("minecraft:",""));
            }
            return;
        }
        if (mx >= L.cntX && mx <= L.cntX+L.cntW && my >= L.cntY+16 && my <= L.cntY+34) {
            modelSearchActive = true; return;
        }
        modelPickerOpen = false; return;
    }

    for (var si = 0; si < SECTIONS.length; si++) {
        var sy = L.secY + si*34;
        if (mx >= L.secX && mx <= L.secX+SEC_W && my >= sy && my <= sy+30) {
            activeSection = SECTIONS[si].id; editingField = null; return;
        }
    }

    if      (activeSection === "name") handleNameClick(L, mx, my, btn);
    else if (activeSection === "lore") handleLoreClick(L, mx, my, btn);
    else if (activeSection === "meta") handleMetaClick(L, mx, my, btn);
    else if (activeSection === "save") handleSaveClick(L, mx, my, btn);
});

function handleNameClick(L, mx, my, btn) {
    var x = L.cntX, y = L.cntY+16, w = L.cntW;
    if (mx >= x && mx <= x+w && my >= y && my <= y+20) { editingField = "name"; return; }
    y += 26+12;
    var cs     = 14;
    var colors = ["&0","&1","&2","&3","&4","&5","&6","&7","&8","&9","&a","&b","&c","&d","&e","&f"];
    for (var ci = 0; ci < colors.length; ci++) {
        var cx = x+ci*(cs+1);
        if (mx >= cx && mx <= cx+cs && my >= y && my <= y+cs) {
            if (editingField === "name") state.name += colors[ci]; return;
        }
    }
    y += cs+3;
    var formats = ["&l","&o","&n","&m","&k","&r"];
    for (var fi = 0; fi < formats.length; fi++) {
        var fx = x+fi*(cs+1);
        if (mx >= fx && mx <= fx+cs && my >= y && my <= y+cs) {
            if (editingField === "name") state.name += formats[fi]; return;
        }
    }
    editingField = null;
}

function handleLoreClick(L, mx, my, btn) {
    var x = L.cntX, y = L.cntY, w = L.cntW;

    var hasClip = _externalLoreClipboard && _externalLoreClipboard.length > 0;
    var pasteW  = Renderer.getStringWidth("Paste " + (hasClip ? "("+_externalLoreClipboard.length+")" : "")) + 10;
    var pasteX  = x + w - pasteW;
    if (hasClip && mx >= pasteX && mx <= pasteX+pasteW && my >= y-1 && my <= y+11) {
        _externalLoreClipboard.forEach(function(l) { state.lore.push(l); });
        setStatus("&aPasted &e" + _externalLoreClipboard.length + " &7lines");
        _externalLoreClipboard = null;
        return;
    }

    y += 16;
    var start = lorePage * LORE_PER_PAGE;
    var end   = Math.min(start+LORE_PER_PAGE, state.lore.length);
    for (var li = start; li <= end; li++) {
        var lineY = y+(li-start)*22;
        if (li < state.lore.length) {
            var lineW = w-56, upX = x+lineW+2, delX = x+lineW+20;
            if (mx >= upX && mx <= upX+16 && my >= lineY && my <= lineY+8) {
                if (li > 0) { var t1=state.lore[li]; state.lore[li]=state.lore[li-1]; state.lore[li-1]=t1; editingField=null; } return;
            }
            if (mx >= upX && mx <= upX+16 && my >= lineY+9 && my <= lineY+18) {
                if (li < state.lore.length-1) { var t2=state.lore[li]; state.lore[li]=state.lore[li+1]; state.lore[li+1]=t2; editingField=null; } return;
            }
            if (mx >= delX && mx <= delX+16 && my >= lineY && my <= lineY+18) {
                state.lore.splice(li,1); editingField=null; return;
            }
            if (mx >= x && mx <= x+lineW && my >= lineY && my <= lineY+18) {
                editingField = "lore"+li; return;
            }
        } else if (li === state.lore.length) {
            if (mx >= x && mx <= x+w && my >= lineY && my <= lineY+18) {
                state.lore.push(""); editingField = "lore"+(state.lore.length-1); return;
            }
        }
    }
    if (state.lore.length > LORE_PER_PAGE) {
        var pY2 = y+(end-start+1)*22+4;
        if (mx >= L.cntX && mx <= L.cntX+22 && my >= pY2 && my <= pY2+16 && lorePage > 0) { lorePage--; editingField=null; }
        if (mx >= L.cntX+62 && mx <= L.cntX+84 && my >= pY2 && my <= pY2+16) { lorePage++; editingField=null; }
    }
}

function handleMetaClick(L, mx, my, btn) {
    var x = L.cntX, y = L.cntY+16, w = L.cntW;
    y += 22; y += 22;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="damage";    editBuffer=""+state.damage;    return; } y+=22;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="count";     editBuffer=""+state.count;     return; } y+=22;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="hideFlags"; editBuffer=""+state.hideFlags; return; } y+=22;
    if (state.itemId.indexOf("leather") !== -1) {
        if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { editingField="hex"; return; } y+=22;
    }
    var pickW   = Renderer.getStringWidth("Pick")+10;
    var clearW  = Renderer.getStringWidth("✖")+8;
    var pickX   = x+w-pickW-2;
    var clearX  = x+w-pickW-clearW-4;
    if (mx>=pickX&&mx<=pickX+pickW&&my>=y+2&&my<=y+18) {
        modelPickerOpen=true; modelSearch=""; modelPickerScroll=0; modelSearchActive=false; editingField=null; return;
    }
    if (state.itemModel && mx>=clearX&&mx<=clearX+clearW&&my>=y+2&&my<=y+18) {
        state.itemModel=""; return;
    }
    y+=24;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+18) { state.unbreak=!state.unbreak; return; } y+=22;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+18) { state.glow=!state.glow; return; } y+=22;
    editingField=null;
}

function handleSaveClick(L, mx, my, btn) {
    var x = L.cntX, y = L.cntY+16, w = L.cntW;
    if (mx>=x&&mx<=x+w&&my>=y&&my<=y+20) { savePathEditing=true; editingField="savePath"; return; }
    y+=40;
    var bH=22, bW=Math.floor((w-4)/2);
    if (mx>=x&&mx<=x+bW&&my>=y&&my<=y+bH)           { applyToHeld(); return; }
    if (mx>=x+bW+4&&mx<=x+w&&my>=y&&my<=y+bH)       { saveAsMig(); return; }
    y+=bH+6;
    if (mx>=x&&mx<=x+bW&&my>=y&&my<=y+bH)            { loadFromHeld(); return; }
    if (lastSavedPath&&mx>=x+bW+4&&mx<=x+w&&my>=y&&my<=y+bH) { openInEditor(lastSavedPath); return; }
    editingField=null; savePathEditing=false;
}

gui.registerKeyTyped(function(ch, code) {
    if (modelPickerOpen && modelSearchActive) {
        if (code===1)  { modelPickerOpen=false; modelSearchActive=false; return; }
        if (code===28) { modelSearchActive=false; return; }
        if (code===14) { modelSearch=modelSearch.slice(0,-1); modelPickerScroll=0; return; }
        if (ch && ch!=="\u0000") { modelSearch+=ch; modelPickerScroll=0; return; }
        return;
    }
    if (code===1) {
        if (modelPickerOpen) { modelPickerOpen=false; return; }
        if (editingField) { editingField=null; savePathEditing=false; return; }
        gui.close(); return;
    }
    if (code===28||code===156) { editingField=null; savePathEditing=false; return; }
    if (code===14) {
        if (editingField==="name")       { state.name=state.name.slice(0,-1);           return; }
        if (editingField==="savePath")   { savePath=savePath.slice(0,-1);               return; }
        if (editingField==="itemModel")  { state.itemModel=state.itemModel.slice(0,-1); return; }
        if (editingField==="hex")        { state.hex=state.hex.slice(0,-1);             return; }
        if (editingField==="damage")     { editBuffer=editBuffer.slice(0,-1); state.damage=parseInt(editBuffer)||0;               return; }
        if (editingField==="count")      { editBuffer=editBuffer.slice(0,-1); state.count=Math.max(1,parseInt(editBuffer)||1);    return; }
        if (editingField==="hideFlags")  { editBuffer=editBuffer.slice(0,-1); state.hideFlags=Math.min(63,parseInt(editBuffer)||0); return; }
        var lm = editingField&&editingField.match(/^lore(\d+)$/);
        if (lm) { var li=parseInt(lm[1]); if (li<state.lore.length) state.lore[li]=state.lore[li].slice(0,-1); }
        return;
    }
    if (code === 15 || code === 29 || code === 157 || code === 42 || code === 54 || code === 56) return;
    if (!ch||ch==="\u0000") return;
    if (editingField==="name")       { state.name+=ch;       return; }
    if (editingField==="savePath")   { savePath+=ch;          return; }
    if (editingField==="itemModel")  { state.itemModel+=ch;   return; }
    if (editingField==="hex")        { state.hex+=ch;         return; }
    if (editingField==="damage"    && /[\d\-]/.test(ch)) { editBuffer+=ch; state.damage=parseInt(editBuffer)||0;               return; }
    if (editingField==="count"     && /\d/.test(ch))     { editBuffer+=ch; state.count=Math.max(1,parseInt(editBuffer)||1);   return; }
    if (editingField==="hideFlags" && /\d/.test(ch))     { editBuffer+=ch; state.hideFlags=Math.min(63,parseInt(editBuffer)||0); return; }
    var lm2 = editingField&&editingField.match(/^lore(\d+)$/);
    if (lm2) { var li2=parseInt(lm2[1]); if (li2<state.lore.length) state.lore[li2]+=ch; }
});

function detectType(id) {
    id = (""+id).replace("minecraft:","").toLowerCase();
    if (id.indexOf("sword")!=-1||id.indexOf("bow")!=-1)           return "Weapon";
    if (id.indexOf("helmet")!=-1||id.indexOf("chestplate")!=-1||
        id.indexOf("leggings")!=-1||id.indexOf("boots")!=-1)      return "Armor";
    if (id.indexOf("pickaxe")!=-1||id.indexOf("shovel")!=-1||
        id.indexOf("hoe")!=-1||id.indexOf("axe")!=-1)             return "Tool";
    if (id.indexOf("skull")!=-1||id.indexOf("head")!=-1)          return "Head";
    return "Misc";
}

function loadFromHeld() {
    try {
        var item = Player.getHeldItem();
        if (!item||item.getID()===0) { msg("&cHold an item to edit!"); return false; }
        var nbt  = item.getNBT ? item.getNBT().toObject() : {};
        var tag  = nbt.tag||{};
        var disp = tag.display||{};

        state.itemId    = ""+item.getRegistryName();
        state.damage    = item.getMetadata ? item.getMetadata() : 0;
        state.count     = item.getStackSize()||1;
        state.unbreak   = !!tag.Unbreakable;
        state.hideFlags = tag.HideFlags||63;
        state.itemModel = tag.ItemModel ? (""+tag.ItemModel) : "";
        state.name      = disp.Name ? (""+disp.Name).replace(/\u00a7/g,"&") : stripColor(""+item.getName());

        if (disp.Lore && disp.Lore.length > 0) {
            state.lore = disp.Lore.map(function(l) { return (""+l).replace(/\u00a7/g,"&"); });
        } else {
            state.lore = cleanLore(item.getLore()).slice(1).map(function(l) { return (""+l).replace(/\u00a7/g,"&"); });
        }

        var allEnch  = tag.ench||[];
        state.glow   = allEnch.some(function(e){return e.id===0&&e.lvl===1;});
        state.enchants = allEnch.filter(function(e){return !(e.id===0&&e.lvl===1);});
        state.hex    = (disp.color!==undefined) ? "#"+((disp.color>>>0)&0xFFFFFF).toString(16).padStart(6,"0").toUpperCase() : "";
        try { state.texture = tag.SkullOwner.Properties.textures[0].Value; } catch(_) { state.texture=""; }
        state.itemType = detectType(state.itemId);
        try { state.extraAttributes = tag.ExtraAttributes || null; } catch(_) { state.extraAttributes = null; }
        savePath       = stripColor(state.name).replace(/[^a-zA-Z0-9_\-]/g,"_").substring(0,24)||"item";
        setStatus("&aLoaded: &f"+stripColor(state.name));
        return true;
    } catch(e) { msg("&cLoad error: "+e); return false; }
}

function applyToHeld() {
    try {
        if (!requireCreative()) return;
        var item = Player.getHeldItem();
        if (!item||item.getID()===0) { msg("&cHold an item!"); return; }
        snapshotHeld("edit-apply");
        var C10=Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
        var IS=Java.type("net.minecraft.item.ItemStack");
        var NBT=Java.type("net.minecraft.nbt.JsonToNBT");
        var IR=Java.type("net.minecraft.item.Item");
        var tagObj={}, disp={};
        if (state.name) disp.Name=(""+state.name).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
        var loreConv=state.lore.map(function(l){return (""+l).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");});
        if (loreConv.length) disp.Lore=loreConv;
        if (state.hex&&state.itemId.indexOf("leather")!==-1) disp.color=parseInt(state.hex.replace("#",""),16);
        if (Object.keys(disp).length) tagObj.display=disp;
        if (state.unbreak) tagObj.Unbreakable=1;
        if (state.hideFlags>0) tagObj.HideFlags=state.hideFlags;
        if (state.itemModel) tagObj.ItemModel=state.itemModel;
        var ench=state.enchants.slice();
        if (state.glow) ench.push({id:0,lvl:1});
        if (ench.length>0) tagObj.ench=ench;
        function buildNBT(obj){
            if(obj===null||obj===undefined)return"{}";
            if(typeof obj==="boolean")return obj?"1b":"0b";
            if(typeof obj==="number")return Number.isInteger(obj)?String(obj):obj.toFixed(4)+"f";
            if(typeof obj==="string")return'"'+obj.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
            if(Array.isArray(obj))return"["+obj.map(buildNBT).join(",")+"]";
            return"{"+Object.keys(obj).map(function(k){return k+":"+buildNBT(obj[k]);}).join(",")+"}";
        }
        var mc=IR.func_111206_d(state.itemId);
        var stk=new IS(mc,state.count,state.damage);
        var nbt=buildNBT(tagObj);
        if(nbt!=="{}") stk.func_77982_d(NBT.func_180713_a(nbt));
        Client.sendPacket(new C10(Player.getHeldItemIndex()+36,stk));
        setStatus("&a✔ Applied to held item!");
    } catch(e){ setStatus("&cApply error: "+e); }
}

function buildNbtValueEdit(obj) {
    if (obj === null || obj === undefined) return "{}";
    if (typeof obj === "boolean") return obj ? "1b" : "0b";
    if (typeof obj === "number") return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    if (typeof obj === "string") return '"' + (""+obj).replace(/\\/g,"\\\\").replace(/"/g,'\\"') + '"';
    if (Array.isArray(obj)) {
        return "[" + obj.map(function(v,i){ return i+":"+buildNbtValueEdit(v); }).join(",") + "]";
    }
    if (typeof obj === "object") {
        return "{" + Object.keys(obj).map(function(k){ return k+":"+buildNbtValueEdit(obj[k]); }).join(",") + "}";
    }
    return ""+obj;
}

function saveAsMig() {
    try {
        var path=savePath.replace(/\.mig$/,"");
        var parts=path.replace(/\\/g,"/").split("/");
        var file=parts.pop()+".mig";
        var dir="Morgen/imports"+(parts.length?"/"+parts.join("/"):"");
        try{new java.io.File(new java.io.File(".").getCanonicalPath()+"/config/ChatTriggers/modules/"+dir).mkdirs();}catch(_){}

        var out='ITEM "'+state.itemId+'" {\n\n';
        out+='    Name:   "'+state.name+'"\n';
        out+="    Amount: 1\n    Count:  "+state.count+"\n\n";
        out+='    ItemType:    "'+state.itemType+'"\n';
        out+="    Damage:      "+state.damage+"\n";
        out+="    Unbreakable: "+state.unbreak+"\n";
        out+="    Glow:        "+state.glow+"\n";
        out+="    HideFlags:   "+state.hideFlags+"\n";
        if(state.hex&&state.itemId.indexOf("leather")!==-1) out+='    Hex: "'+state.hex+'"\n';
        if(state.texture&&state.itemId.indexOf("skull")!==-1) out+='    Texture: "'+state.texture+'"\n';
        if(state.itemModel) out+='    ItemModel: "'+state.itemModel+'"\n';
        if(state.enchants.length>0) out+="    Enchants: "+JSON.stringify(state.enchants.map(function(e){return{id:e.id,lvl:e.lvl};}))+"\n";
        out+="\n    Lore: [\n";
        state.lore.forEach(function(l){out+='        "'+l.replace(/"/g,'\\"')+'"\n';});
        out+="    ]\n\n}\n";
        FileLib.write(dir, file, out);

        var nbtObj = {};
        if (state.hideFlags) nbtObj.HideFlags = state.hideFlags;
        if (state.unbreak)   nbtObj.Unbreakable = 1;
        var dispObj = {};
        if (state.name) dispObj.Name = (""+state.name).replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
        if (state.lore.length > 0) dispObj.Lore = state.lore.map(function(l){ return (""+l).replace(/&([0-9a-fk-or])/gi,"\u00a7$1"); });
        if (state.hex && state.itemId.indexOf("leather")!==-1) dispObj.color = parseInt(state.hex.replace("#",""),16);
        if (Object.keys(dispObj).length > 0) nbtObj.display = dispObj;
        var enchArr = state.enchants.slice();
        if (state.glow) enchArr.push({id:0,lvl:1});
        if (enchArr.length > 0) nbtObj.ench = enchArr;
        if (state.itemModel) nbtObj.ItemModel = state.itemModel;
        if (state.extraAttributes) nbtObj.ExtraAttributes = state.extraAttributes;
        var giveCmd = "/give @p " + state.itemId + " " + state.count + " " + state.damage + " " + buildNbtValueEdit(nbtObj);
        FileLib.write(dir, file.replace(/\.mig$/, ".give"), giveCmd + "\n");

        lastSavedPath = path;
        setStatus("&a✔ Saved — .mig & .give");
    } catch(e){ setStatus("&cSave error: "+e); }
}

function openInEditor(path) {
    try {
        var f=new java.io.File(new java.io.File(".").getCanonicalPath()+"/config/ChatTriggers/modules/Morgen/imports/"+path+".mig");
        if(f.exists()&&java.awt.Desktop.isDesktopSupported()){ java.awt.Desktop.getDesktop().open(f); setStatus("&aOpened in editor."); }
        else setStatus("&cFile not found.");
    } catch(e){ setStatus("&cCould not open: "+e); }
}

function setStatus(s) { statusMsg=s; statusFlash=Date.now()+3000; }

register("guiClosed", function(){ guiOpen=false; editingField=null; modelPickerOpen=false; });

export function openEditGui() {
    if (!loadFromHeld()) return;
    lorePage=0; modelPickerOpen=false; modelSearch="";
    guiOpen=true; gui.open();
}