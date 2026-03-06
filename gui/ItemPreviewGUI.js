// ============================================================
//  Morgen — gui/ItemPreviewGUI.js
//  /mm preview  — live item stat viewer with HUD overlay
//  Shows held item's full NBT-parsed stats in a floating panel
//  while you're in-game (not a screen GUI, an overlay)
// ============================================================

import { msg, cleanLore, stripColor } from "../utils/utils";
import Settings from "../utils/config";

var overlayOn   = false;
var panelOffX   = 0;
var panelOffY   = 0;
var dragging    = false;
var dragOffX    = 0;
var dragOffY    = 0;
var lastItem    = null;
var lastParsed  = null;

// ─── Toggle ───────────────────────────────────────────────────

export function togglePreview() {
    overlayOn = !overlayOn;
    msg(overlayOn ? "&aItem Preview overlay &aON &7(drag to move)" : "&7Item Preview overlay &cOFF");
}

export function isPreviewOn() { return overlayOn; }

// ─── Parse held item ─────────────────────────────────────────

function parseHeld() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) return null;
    var tag     = (item.getNBT().toObject().tag) || {};
    var disp    = tag.display || {};
    var lore    = cleanLore(item.getLore()).slice(1);
    var enchs   = tag.ench ? tag.ench.filter(function(e) {
        return !(e.id===0&&e.lvl===1);
    }) : [];
    var ENCH = {0:"Protection",1:"Fire Prot",2:"Feather Fall",3:"Blast Prot",
                16:"Sharpness",17:"Smite",18:"Bane",19:"Knockback",20:"Fire Aspect",
                21:"Looting",32:"Efficiency",33:"Silk Touch",34:"Unbreaking",35:"Fortune",
                48:"Power",49:"Punch",50:"Flame",51:"Infinity"};
    return {
        name:      item.getName(),
        id:        item.getRegistryName(),
        damage:    item.getMetadata ? item.getMetadata() : 0,
        count:     item.getStackSize(),
        lore:      lore,
        enchs:     enchs.map(function(e){ return (ENCH[e.id]||"ench_"+e.id)+" "+e.lvl; }),
        unbreak:   !!tag.Unbreakable,
        glow:      !!(tag.ench && tag.ench.some(function(e){return e.id===0&&e.lvl===1;})),
        hideFlags: tag.HideFlags || 0,
        skull:     !!(tag.SkullOwner),
        leather:   !!(disp.color !== undefined),
    };
}

// ─── Overlay draw ─────────────────────────────────────────────

register("renderOverlay", function() {
    if (!overlayOn || !Player.getPlayer()) return;
    var parsed = parseHeld();
    if (!parsed) {
        var sw=Renderer.screen.getWidth(), sh=Renderer.screen.getHeight();
        Renderer.drawRect(Renderer.color(18,18,22,200), 6+panelOffX, 6+panelOffY, 160, 20);
        Renderer.drawString("&8Hold an item to preview", 10+panelOffX, 12+panelOffY, true);
        return;
    }

    var x = 6 + panelOffX;
    var y = 6 + panelOffY;
    var w = 190;

    // Build rows
    var rows = [];
    rows.push({ label:"&7Name",    val: parsed.name });
    rows.push({ label:"&7ID",      val: "&8"+parsed.id });
    rows.push({ label:"&7Damage",  val: "&e"+parsed.damage });
    rows.push({ label:"&7Count",   val: "&f"+parsed.count });
    if (parsed.unbreak) rows.push({ label:"&7Unbreak", val: "&aYes" });
    if (parsed.glow)    rows.push({ label:"&7Glow",    val: "&dYes" });
    if (parsed.skull)   rows.push({ label:"&7Skull",   val: "&bYes" });
    if (parsed.enchs.length > 0) {
        parsed.enchs.forEach(function(e) {
            rows.push({ label:"&5Ench", val: "&d"+e });
        });
    }
    if (parsed.hideFlags) rows.push({ label:"&7Flags", val: "&8"+parsed.hideFlags });
    // Lore
    if (parsed.lore.length > 0) {
        rows.push({ label:"&8----", val:"&8----", sep: true });
        parsed.lore.slice(0, 8).forEach(function(l) {
            rows.push({ label:"", val: l, lore: true });
        });
        if (parsed.lore.length > 8)
            rows.push({ label:"", val: "&8+ "+(parsed.lore.length-8)+" more lines", lore:true });
    }

    var rowH   = 11;
    var titleH = 16;
    var h      = titleH + rows.length * rowH + 8;

    // Panel bg
    Renderer.drawRect(Renderer.color(15,15,20,220), x, y, w, h);
    // Header
    Renderer.drawRect(Renderer.color(30,30,46,255), x, y, w, titleH);
    Renderer.drawString("&6&lItem Preview &8\u2014 &7drag to move", x+5, y+4, true);
    // Separator
    Renderer.drawRect(Renderer.color(55,55,80,200), x+3, y+titleH, w-6, 1);
    // Rows
    for (var i = 0; i < rows.length; i++) {
        var r  = rows[i];
        var ry = y + titleH + 3 + i * rowH;
        if (r.sep) {
            Renderer.drawRect(Renderer.color(45,45,60,180), x+3, ry+4, w-6, 1);
            continue;
        }
        if (r.lore) {
            Renderer.drawString(r.val, x+6, ry+1, true);
        } else {
            Renderer.drawString(r.label, x+5, ry+1, true);
            Renderer.drawString(r.val, x+70, ry+1, true);
        }
    }
    // Border
    Renderer.drawRect(Renderer.color(60,60,85,255), x, y,   w, 1);
    Renderer.drawRect(Renderer.color(60,60,85,255), x, y+h-1, w, 1);
    Renderer.drawRect(Renderer.color(60,60,85,255), x, y,   1, h);
    Renderer.drawRect(Renderer.color(60,60,85,255), x+w-1,y, 1, h);
});

// ─── Drag via renderOverlay mouse (uses world mouse events) ───
// We use a separate gui just for drag — only opened when
// player holds shift+clicks the overlay area

var dragGui = new Gui();

dragGui.registerDraw(function(mx, my) {
    if (dragging) {
        panelOffX = mx - dragOffX;
        panelOffY = my - dragOffY;
    }
    // draw a transparent overlay so the gui stays open
    // but keep mc rendering behind it
    if (!overlayOn) dragGui.close();
});

dragGui.registerClicked(function(mx, my, btn) {
    if (btn !== 0) { dragging=false; dragGui.close(); return; }
    dragging  = true;
    dragOffX  = mx - panelOffX;
    dragOffY  = my - panelOffY;
});

register("guiMouseRelease", function() { dragging=false; });

export function openPreviewDrag() {
    dragGui.open();
}

// Load saved position
try {
    var raw = FileLib.read("Morgen/config","previewPos.json");
    if (raw) { var p=JSON.parse(raw); panelOffX=p.x||0; panelOffY=p.y||0; }
} catch(_) {}

register("guiClosed", function() {
    if (!dragging) {
        try {
            var b=new java.io.File(".").getCanonicalPath();
            var d=new java.io.File(b+"/config/ChatTriggers/modules/Morgen/config");
            if (!d.exists()) d.mkdirs();
            FileLib.write("Morgen/config","previewPos.json",JSON.stringify({x:panelOffX,y:panelOffY}));
        } catch(_) {}
    }
});