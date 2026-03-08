// ============================================================
//  Morgen — src/undoHistory.js
//  In-Memory Undo cache (last 5 item states)
//  Tracks: rename, addlore, clearlore, ai-apply, paste
// ============================================================

var MAX_UNDO = 5;
var history  = [];  // [{action, slot, itemId, damage, count, tag, timestamp}]

// ─── Snapshot current held item ──────────────────────────────

export function snapshotHeld(actionLabel) {
    try {
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) return;
        var nbtObj = item.getNBT ? item.getNBT().toObject() : {};
        var snap = {
            action:    actionLabel || "unknown",
            slot:      Player.getHeldItemIndex() + 36,
            itemId:    "" + item.getRegistryName(),
            damage:    item.getMetadata ? item.getMetadata() : 0,
            count:     item.getStackSize() || 1,
            tag:       JSON.parse(JSON.stringify(nbtObj.tag || {})),
            timestamp: Date.now()
        };
        history.push(snap);
        if (history.length > MAX_UNDO) history = history.slice(history.length - MAX_UNDO);
        return snap;
    } catch (e) {
        console.log("[undoHistory] snapshotHeld: " + e);
    }
}

// ─── Restore last snapshot ────────────────────────────────────

export function undoLast(msg) {
    if (history.length === 0) {
        msg("&cNothing to undo.");
        return;
    }

    var snap = history.pop();

    try {
        var C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
        var ItemStack = Java.type("net.minecraft.item.ItemStack");
        var JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
        var ItemReg   = Java.type("net.minecraft.item.Item");

        function buildNBT(obj) {
            if (obj === null || obj === undefined) return "{}";
            if (typeof obj === "boolean") return obj ? "1b" : "0b";
            if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
            if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
            if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
            return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
        }

        var mcItem = ItemReg.func_111206_d(snap.itemId);
        if (!mcItem) { msg("&cUndo failed: unknown item ID."); return; }

        var stack = new ItemStack(mcItem, snap.count, snap.damage);
        var nbtStr = buildNBT(snap.tag);
        if (nbtStr !== "{}") {
            stack.func_77982_d(JsonToNBT.func_180713_a(nbtStr));
        }

        Client.sendPacket(new C10Packet(snap.slot, stack));

        var ago = Math.round((Date.now() - snap.timestamp) / 1000);
        msg("&aUndo: restored &8\"&f" + snap.action + "&8\" &7from &e" + ago + "s ago  &8(" + history.length + " more in stack)");

    } catch (e) {
        msg("&cUndo error: " + e);
        console.log("[undoHistory] undoLast: " + e);
    }
}

// ─── Peek at history list ─────────────────────────────────────

export function listHistory(msg) {
    if (history.length === 0) { msg("&7Undo history is empty."); return; }
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    msg("&6&lUndo History &8(" + history.length + "/" + MAX_UNDO + ")");
    for (var i = history.length - 1; i >= 0; i--) {
        var h = history[i];
        var ago = Math.round((Date.now() - h.timestamp) / 1000);
        msg("  &8" + (history.length - i) + ". &f" + h.action + " &8— &7" + h.itemId.replace("minecraft:","") + " &8(" + ago + "s ago)");
    }
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
}
