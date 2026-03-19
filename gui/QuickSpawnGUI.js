import { msg } from "../utils/utils";

var gui = new Gui(), guiOpen = false;
var slots = [], hovered = -1;
var SAVE = "Morgen/config", FILE = "quickslots.json";

function loadSlots() {
    try { var r = FileLib.read(SAVE, FILE); if (r) slots = JSON.parse(r); } catch(_) {}
    if (!Array.isArray(slots)) slots = [];
    while (slots.length < 9) slots.push(null);
    slots = slots.slice(0, 9);
}

function saveSlots() {
    try {
        var b = new java.io.File(".").getCanonicalPath();
        new java.io.File(b + "/config/ChatTriggers/modules/Morgen/config").mkdirs();
        FileLib.write(SAVE, FILE, JSON.stringify(slots));
    } catch(_) {}
}
loadSlots();

export function openQuickSpawn() { guiOpen = true; gui.open(); }

var TIER_COLS = [
    Renderer.color(100,100,100,200), Renderer.color(80,130,80,200),
    Renderer.color(70,90,160,200),   Renderer.color(140,80,180,200),
    Renderer.color(190,140,30,200),  Renderer.color(200,60,60,200),
    Renderer.color(40,180,200,200),  Renderer.color(220,100,30,200),
    Renderer.color(220,220,220,200)
];

var SW = 60, SH = 74, PAD = 8, HDR = 30, HINT = 18;

function getL() {
    var sw = Renderer.screen.getWidth(), sh = Renderer.screen.getHeight();
    var w  = 9 * SW + 2 * PAD, h = HDR + SH + PAD + HINT;
    return { x: Math.floor(sw/2-w/2), y: Math.floor(sh-h-24), w: w, h: h, sw: sw, sh: sh };
}

function border1(x, y, w, h, col, t) {
    t = t || 1;
    Renderer.drawRect(col,x,y,w,t); Renderer.drawRect(col,x,y+h-t,w,t);
    Renderer.drawRect(col,x,y,t,h); Renderer.drawRect(col,x+w-t,y,t,h);
}

gui.registerDraw(function(mx, my) {
    var L    = getL();
    hovered  = -1;
    var GOLD  = Renderer.color(198,148,32,255);
    var PANEL = Renderer.color(13,14,21,245);
    var DARK  = Renderer.color(0,0,0,85);

    Renderer.drawRect(DARK, L.x+5, L.y+5, L.w, L.h);
    Renderer.drawRect(PANEL, L.x, L.y, L.w, L.h);
    Renderer.drawRect(GOLD, L.x, L.y, 2, L.h);
    border1(L.x, L.y, L.w, L.h, Renderer.color(52,55,82,220));

    Renderer.drawRect(Renderer.color(18,20,34,255), L.x+2, L.y, L.w-2, HDR);
    Renderer.drawRect(Renderer.color(198,148,32,65), L.x+2, L.y+HDR-1, L.w-2, 1);
    Renderer.drawRect(GOLD, L.x+9, L.y+13, 4, 4);
    Renderer.drawRect(Renderer.color(255,200,60,255), L.x+10, L.y+14, 2, 2);
    Renderer.drawString("&6Quick Spawn  &8—  &7left-click spawn  &8·  &7right-click clear",
        L.x+18, L.y+10, true);

    for (var i = 0; i < 9; i++) {
        var sx   = L.x + PAD + i * SW, sy = L.y + HDR + PAD;
        var slot = slots[i];
        var isHov = mx >= sx && mx <= sx+SW-3 && my >= sy && my <= sy+SH-3;
        if (isHov) hovered = i;

        var bg = isHov
            ? Renderer.color(36,40,62,240)
            : (slot ? Renderer.color(24,28,46,225) : Renderer.color(18,20,34,215));
        Renderer.drawRect(bg, sx, sy, SW-3, SH-3);
        border1(sx, sy, SW-3, SH-3, isHov ? GOLD : (slot ? TIER_COLS[i] : Renderer.color(42,45,68,180)));

        Renderer.drawRect(TIER_COLS[i], sx, sy, 16, 14);
        border1(sx, sy, 16, 14, Renderer.color(0,0,0,80));
        Renderer.drawString("&f&l" + (i+1), sx+3, sy+2, true);

        if (slot) {
            Renderer.drawRect(Renderer.color(80,220,100,220), sx+SW-8, sy+2, 5, 5);
            var lbl = slot.label || "?";
            Renderer.drawString("&f" + lbl.substring(0, 8), sx+3, sy+18, true);
            if (lbl.length > 8) Renderer.drawString("&f" + lbl.substring(8, 14) + (lbl.length > 14 ? "\u2026" : ""), sx+3, sy+28, true);
            var short = slot.path.split("/").slice(-2).join("/");
            if (short.length > 10) short = "\u2026" + short.slice(-9);
            Renderer.drawString("&8" + short, sx+2, sy+SH-16, true);
            Renderer.drawString("&7\u2192 " + (i+1), sx+2, sy+38, true);
            if (isHov) {
                var tip = slot.path;
                var tw  = Renderer.getStringWidth(tip) + 10;
                var tx  = Math.max(L.x+2, Math.min(sx, L.x+L.w-tw-2));
                Renderer.drawRect(Renderer.color(10,11,18,235), tx, sy-20, tw, 16);
                border1(tx, sy-20, tw, 16, Renderer.color(52,55,82,200));
                Renderer.drawString("&7" + tip, tx+4, sy-16, true);
            }
        } else {
            Renderer.drawString("&8empty",       sx+3, sy+22, true);
            Renderer.drawString("&8/mm qs set",  sx+1, sy+36, true);
            Renderer.drawString("&8" + (i+1) + " <path>", sx+3, sy+46, true);
        }
    }

    var hy = L.y + L.h - HINT;
    Renderer.drawRect(Renderer.color(15,17,27,235), L.x+2, hy, L.w-2, HINT);
    Renderer.drawString("&8/mm qs set <1-9> <path>   ·   spawns into hotbar slot   ·   ESC close",
        L.x+PAD+2, hy+5, true);
});

gui.registerClicked(function(mx, my, b) {
    if (hovered < 0 || hovered > 8) { if (b === 1 || b === 0) gui.close(); return; }
    if (b === 1) { slots[hovered] = null; saveSlots(); msg("&7Cleared slot &e" + (hovered+1)); return; }
    if (b !== 0) return;
    var s = slots[hovered];
    if (!s) { msg("&7Slot &e" + (hovered+1) + " &7is empty — use &f/mm qs set " + (hovered+1) + " <path>"); return; }
    var target = hovered;
    gui.close();
    setTimeout(function() {
        Player.setHeldItemIndex(target);
        setTimeout(function() { ChatLib.command("mmimport " + s.path, true); }, 60);
    }, 80);
});

gui.registerKeyTyped(function(c, code) { if (code === 1) gui.close(); });
register("guiClosed", function() { guiOpen = false; });

export function handleQsCommand(args) {
    var sub = ("" + (args[0] || "")).toLowerCase();
    if (!sub) { openQuickSpawn(); return; }
    if (sub === "help") {
        msg("&6/mm qs &8— &fQuick Spawn:");
        msg("  &f/mm qs               &8— &7open GUI");
        msg("  &f/mm qs <1-9>         &8— &7spawn slot from chat");
        msg("  &f/mm qs set <1-9> <path>  &8— &7assign path to slot");
        msg("  &f/mm qs clear [1-9]   &8— &7clear slot");
        msg("  &f/mm qs list          &8— &7list all slots");
        return;
    }
    var direct = parseInt(sub);
    if (!isNaN(direct) && direct >= 1 && direct <= 9) {
        var s = slots[direct-1];
        if (!s) { msg("&7Slot &e" + direct + " &7is empty."); return; }
        Player.setHeldItemIndex(direct-1);
        setTimeout(function() { ChatLib.command("mmimport " + s.path, true); }, 60);
        return;
    }
    if (sub === "set") {
        var n = parseInt(args[1]);
        if (isNaN(n) || n < 1 || n > 9) { msg("&cUsage: &f/mm qs set &e<1-9> <path>"); return; }
        var path = args.slice(2).join(" ");
        if (!path) { msg("&cProvide a .mig path."); return; }
        slots[n-1] = { path: path, label: path.split("/").pop() };
        saveSlots(); msg("&aSlot &e" + n + " &8— &f" + path);
        return;
    }
    if (sub === "clear") {
        var n = parseInt(args[1]);
        if (!isNaN(n) && n >= 1 && n <= 9) { slots[n-1] = null; saveSlots(); msg("&7Cleared slot &e" + n); }
        else { slots = new Array(9).fill(null); saveSlots(); msg("&7Cleared all slots."); }
        return;
    }
    if (sub === "list") {
        msg("&6Quick Spawn slots:");
        for (var i = 0; i < 9; i++) {
            var s = slots[i];
            msg("  &e" + (i+1) + " &8— " + (s ? "&f" + s.path : "&8empty"));
        }
        return;
    }
    openQuickSpawn();
}