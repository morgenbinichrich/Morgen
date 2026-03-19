import { msg, cleanLore, stripColor } from "../utils/utils";

var overlayOn  = false;
var panelOffX  = 0, panelOffY = 0;
var dragging   = false;
var dragOffX   = 0, dragOffY = 0;

export function togglePreview() {
    overlayOn = !overlayOn;
    msg(overlayOn ? "&aItem Preview overlay ON &7(drag to move)" : "&7Item Preview overlay OFF");
}

export function isPreviewOn() { return overlayOn; }

function parseHeld() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) return null;
    var tag  = (item.getNBT().toObject().tag) || {};
    var disp = tag.display || {};

    var lore;
    if (disp.Lore && disp.Lore.length > 0) {
        lore = disp.Lore.map(function(l) { return (""+l).replace(/\u00a7/g, "&"); });
    } else {
        lore = cleanLore(item.getLore()).slice(1);
    }

    var allEnch = tag.ench || [];
    var ENCH = {
        0:"Protection",1:"Fire Prot",2:"Feather Fall",3:"Blast Prot",
        16:"Sharpness",17:"Smite",18:"Bane",19:"Knockback",20:"Fire Aspect",
        21:"Looting",32:"Efficiency",33:"Silk Touch",34:"Unbreaking",35:"Fortune",
        48:"Power",49:"Punch",50:"Flame",51:"Infinity"
    };

    return {
        name:      (""+item.getName()).replace(/\u00a7/g, "&"),
        id:        item.getRegistryName(),
        damage:    item.getMetadata ? item.getMetadata() : 0,
        count:     item.getStackSize(),
        lore:      lore,
        enchs:     allEnch.filter(function(e){return !(e.id===0&&e.lvl===1);})
                         .map(function(e){return (ENCH[e.id]||"ench_"+e.id)+" "+e.lvl;}),
        unbreak:   !!tag.Unbreakable,
        glow:      allEnch.some(function(e){return e.id===0&&e.lvl===1;}),
        hideFlags: tag.HideFlags || 0,
        skull:     !!(tag.SkullOwner),
        leather:   !!(disp.color !== undefined),
        itemModel: tag.ItemModel ? (""+tag.ItemModel) : null
    };
}

register("renderOverlay", function() {
    if (!overlayOn || !Player.getPlayer()) return;
    var parsed = parseHeld();
    var x = 6 + panelOffX;
    var y = 6 + panelOffY;
    var w = 200;

    if (!parsed) {
        Renderer.drawRect(Renderer.color(18,18,22,200), x, y, w, 20);
        Renderer.drawRect(Renderer.color(52,55,82,200), x, y, w, 1);
        Renderer.drawRect(Renderer.color(52,55,82,200), x, y+19, w, 1);
        Renderer.drawRect(Renderer.color(52,55,82,200), x, y, 1, 20);
        Renderer.drawRect(Renderer.color(52,55,82,200), x+w-1, y, 1, 20);
        Renderer.drawString("&8Hold an item to preview", x + 8, y + 5, true);
        return;
    }

    var rows = [];
    rows.push({ label: "&7Name",    val: parsed.name });
    rows.push({ label: "&7ID",      val: "&8" + (""+parsed.id).replace("minecraft:","") });
    rows.push({ label: "&7Damage",  val: "&e" + parsed.damage });
    rows.push({ label: "&7Stack",   val: "&f" + parsed.count });
    if (parsed.unbreak) rows.push({ label: "&7Unbreak",  val: "&aYes" });
    if (parsed.glow)    rows.push({ label: "&7Glow",     val: "&dYes" });
    if (parsed.skull)   rows.push({ label: "&7Skull",    val: "&bYes" });
    if (parsed.leather) rows.push({ label: "&7Leather",  val: "&6Yes" });
    if (parsed.itemModel) rows.push({ label: "&7Model",  val: "&7" + parsed.itemModel });
    parsed.enchs.forEach(function(e) { rows.push({ label: "&5Ench", val: "&d" + e }); });
    if (parsed.hideFlags) rows.push({ label: "&7Flags",  val: "&8" + parsed.hideFlags });

    if (parsed.lore.length > 0) {
        rows.push({ sep: true });
        parsed.lore.slice(0, 10).forEach(function(l) { rows.push({ lore: true, val: l }); });
        if (parsed.lore.length > 10) rows.push({ lore: true, val: "&8+ " + (parsed.lore.length-10) + " more lines" });
    }

    var rowH   = 11;
    var titleH = 18;
    var h      = titleH + rows.length * rowH + 8;

    Renderer.drawRect(Renderer.color(13,14,20,225), x, y, w, h);
    Renderer.drawRect(Renderer.color(198,148,32,255), x, y, 2, h);
    Renderer.drawRect(Renderer.color(30,32,50,255), x, y, w, titleH);
    Renderer.drawRect(Renderer.color(198,148,32,60), x, y+titleH-1, w, 1);
    Renderer.drawRect(Renderer.color(52,55,82,200), x, y, w, 1);
    Renderer.drawRect(Renderer.color(52,55,82,200), x, y+h-1, w, 1);
    Renderer.drawRect(Renderer.color(52,55,82,200), x+w-1, y, 1, h);
    Renderer.drawString("&6Item Preview &8— &7drag to move", x + 6, y + 4, true);

    Renderer.drawRect(Renderer.color(52,55,80,180), x+4, y+titleH, w-8, 1);

    for (var i = 0; i < rows.length; i++) {
        var r  = rows[i];
        var ry = y + titleH + 3 + i * rowH;
        if (r.sep) { Renderer.drawRect(Renderer.color(45,45,60,180), x+4, ry+4, w-8, 1); continue; }
        if (r.lore) {
            var lStr = (""+r.val).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
            if (lStr.charAt(0) !== "\u00a7") lStr = "\u00a79" + lStr;
            Renderer.drawString(lStr, x + 7, ry + 1, true);
        } else {
            Renderer.drawString(r.label, x + 6, ry + 1, true);
            Renderer.drawString(r.val,   x + 72, ry + 1, true);
        }
    }
});

var dragGui = new Gui();

dragGui.registerDraw(function(mx, my) {
    if (dragging) { panelOffX = mx - dragOffX; panelOffY = my - dragOffY; }
    if (!overlayOn) dragGui.close();
});

dragGui.registerClicked(function(mx, my, btn) {
    if (btn !== 0) { dragging = false; dragGui.close(); return; }
    dragging = true;
    dragOffX = mx - panelOffX;
    dragOffY = my - panelOffY;
});

register("guiMouseRelease", function() { dragging = false; });

try {
    var raw = FileLib.read("Morgen/config", "previewPos.json");
    if (raw) { var p = JSON.parse(raw); panelOffX = p.x || 0; panelOffY = p.y || 0; }
} catch(_) {}

register("guiClosed", function() {
    if (!dragging) {
        try {
            var b = new java.io.File(".").getCanonicalPath();
            new java.io.File(b + "/config/ChatTriggers/modules/Morgen/config").mkdirs();
            FileLib.write("Morgen/config", "previewPos.json", JSON.stringify({ x: panelOffX, y: panelOffY }));
        } catch(_) {}
    }
});

export function openPreviewDrag() { dragGui.open(); }