// ============================================================
//  Morgen — utils.js
// ============================================================

import Settings from "./config";

var C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
var ItemStack = Java.type("net.minecraft.item.ItemStack");
var JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
var ItemReg   = Java.type("net.minecraft.item.Item");

// ─── Chat helper ──────────────────────────────────────────────

export function msg(text) {
    ChatLib.chat(ChatLib.addColor(Settings.chatPrefix + text));
}

// ─── Creative mode guard ──────────────────────────────────────

export function requireCreative() {
    try {
        if (Player.asPlayerMP().player.field_71075_bZ.field_75098_d) return true;
    } catch (_) {}
    msg("&cYou must be in Creative Mode!");
    return false;
}

// ─── Inventory helpers ────────────────────────────────────────

export function getNextEmptySlot(start = 36) {
    const inv = Player.getInventory();
    if (!inv) return -1;
    for (let i = start; i <= 44; i++) {
        try { if (!inv.getStackInSlot(i) || inv.getStackInSlot(i).isEmpty()) return i; } catch (_) {}
    }
    for (let i = 9; i <= 35; i++) {
        try { if (!inv.getStackInSlot(i) || inv.getStackInSlot(i).isEmpty()) return i; } catch (_) {}
    }
    return -1;
}

export function countEmptySlots() {
    const inv = Player.getInventory();
    if (!inv) return 0;
    let n = 0;
    for (let i = 9; i <= 44; i++) {
        try { if (!inv.getStackInSlot(i) || inv.getStackInSlot(i).isEmpty()) n++; } catch (_) {}
    }
    return n;
}

// ─── NBT string serializer ────────────────────────────────────

export function buildNBTString(obj) {
    if (obj === null || obj === undefined) return "{}";
    // Force primitive JS types — Java objects (e.g. from ChatLib.addColor)
    // must be coerced to JS string first or they serialize with extra quotes
    if (typeof obj === "boolean")  return obj ? "1b" : "0b";
    if (typeof obj === "number")   return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    // Coerce to primitive string always — handles Java String objects too
    if (typeof obj === "string" || (obj && obj.getClass)) {
        var s = "" + obj; // force JS primitive string via concatenation
        return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    if (Array.isArray(obj))        return "[" + obj.map(buildNBTString).join(",") + "]";
    if (typeof obj === "object") {
        const pairs = Object.entries(obj).map(([k, v]) => k + ":" + buildNBTString(v));
        return "{" + pairs.join(",") + "}";
    }
    return "" + obj;
}

// ─── Main item creator ────────────────────────────────────────

/**
 * Creates and places a custom item into the player's inventory.
 *
 * @param {object} data
 *   id          {string}    Registry name e.g. "minecraft:stick"
 *   name        {string}    Display name  (§ colour codes)
 *   lore        {string[]}  Lore lines
 *   damage      {number}    Item damage/meta (default 0)
 *   slot        {number}    Target slot 0-44 (auto if omitted)
 *   count       {number}    Stack size (default: Settings.defaultCount)
 *   unbreakable {boolean}   (default: Settings.defaultUnbreakable)
 *   glow        {boolean}   Fake enchant glow (default: Settings.defaultGlow)
 *   hideFlags   {number}    (default: Settings.defaultHideFlags)
 *   hex         {string}    Leather colour "#RRGGBB"
 *   texture     {string}    Skull base64 texture
 *   itemModel   {string}    Custom ItemModel tag
 *   enchants    {Array}     [{id, lvl}]
 */
export function createItem(data) {
    if (Settings.debugMode) console.log("[createItem] id=" + data.id);
    try {
        if (!requireCreative()) return;

        const id          = data.id;
        const name        = data.name;
        const lore        = data.lore;
        const damage      = data.damage  !== undefined ? data.damage  : 0;
        const slot        = data.slot;
        const count       = data.count   !== undefined ? data.count   : Settings.defaultCount;
        const unbreakable = data.unbreakable !== undefined ? data.unbreakable : Settings.defaultUnbreakable;
        const glow        = data.glow    !== undefined ? data.glow    : Settings.defaultGlow;
        const hex         = data.hex;
        const texture     = data.texture;
        const itemModel   = data.itemModel;
        const enchants    = data.enchants;

        // Resolve HideFlags — respect autoHideFlags setting
        let hideFlags = data.hideFlags !== undefined ? data.hideFlags : Settings.defaultHideFlags;
        if (Settings.autoHideFlags && unbreakable) hideFlags = hideFlags | 4;

        // Validate item ID in safe mode
        if (Settings.safeMode) {
            const check = ItemReg.func_111206_d(id);
            if (!check) { msg("&cInvalid item ID: &e" + id); return; }
        }

        // Resolve target slot
        const finalSlot = (typeof slot === "number" && slot >= 0 && slot <= 44)
            ? slot : getNextEmptySlot();
        if (finalSlot === -1) { msg("&cNo empty slot available!"); return; }

        // Build tag as plain JS object
        const tagObj = {};

        const isLeather = id.toLowerCase().includes("leather");
        if (name || (lore && lore.length > 0) || (hex && isLeather)) {
            tagObj.display = {};
            // Force JS string — colorize() can return a Java String object
            // which buildNBTString/JSON.stringify would double-quote
            if (name)                tagObj.display.Name  = String(name);
            if (lore && lore.length) tagObj.display.Lore  = lore.map(function(l) { return String(l); });
            if (hex && isLeather)    tagObj.display.color = parseInt(hex.replace("#", ""), 16);
        }

        if (id.toLowerCase().includes("skull") && texture) {
            tagObj.SkullOwner = {
                Id: java.util.UUID.randomUUID().toString(),
                Properties: { textures: [{ Value: texture }] }
            };
        }

        if (unbreakable)                                       tagObj.Unbreakable = 1;
        if (typeof hideFlags === "number" && hideFlags > 0)    tagObj.HideFlags   = hideFlags;
        if (typeof itemModel === "string" && itemModel.length) tagObj.ItemModel   = itemModel;

        if (enchants && enchants.length > 0) {
            tagObj.ench = enchants.map(e => ({ id: e.id || 0, lvl: e.lvl || 1 }));
        }
        if (glow && !tagObj.ench) {
            tagObj.ench = [{ id: 0, lvl: 1 }];
        }

        // Serialize → parse NBT → build ItemStack
        if (Settings.debugMode) {
            console.log("[createItem] tagObj.display.Name raw: " + JSON.stringify(tagObj.display && tagObj.display.Name));
        }
        const nbtStr   = buildNBTString(tagObj);
        if (Settings.debugMode) console.log("[createItem] NBT: " + nbtStr);

        const tagNBT   = JsonToNBT.func_180713_a(nbtStr);
        const mcItem   = ItemReg.func_111206_d(id);
        const stack    = new ItemStack(mcItem, Math.max(1, count), damage);
        stack.func_77982_d(tagNBT); // setTagCompound (obfuscated)

        Client.sendPacket(new C10Packet(finalSlot, stack));

        if (!Settings.quietMode) {
            msg("&aItem placed in slot &e" + finalSlot);
        }

    } catch (err) {
        console.log("[createItem] fatal: " + err + "\n" + err.stack);
        msg("&cItem creation failed — see console.");
    }
}

// ─── Batch creator ────────────────────────────────────────────

export function createItems(dataArray) {
    if (!requireCreative()) return 0;
    let placed = 0, nextSlot = 36;
    for (let i = 0; i < dataArray.length; i++) {
        const slot = getNextEmptySlot(nextSlot);
        if (slot === -1) { msg("&cInventory full, stopped at " + placed); break; }
        try {
            if (Settings.batchDelay && i > 0) {
                // Schedule with delay
                setTimeout(() => {
                    createItem(Object.assign({}, dataArray[i], { slot }));
                }, 50);
            } else {
                createItem(Object.assign({}, dataArray[i], { slot }));
            }
            nextSlot = slot + 1;
            placed++;
        } catch (e) { console.log("[createItems] error on item " + placed + ": " + e); }
    }
    return placed;
}

// ─── Stat formatting ──────────────────────────────────────────

/**
 * Formats a number according to Settings.decimalPlaces.
 * Strips trailing zeros: 1.50 → 1.5, 1.00 → 1
 */
export function formatStat(num) {
    const dp = Settings.decimalPlaces;
    if (dp === 0) return String(Math.round(num));
    return parseFloat(num.toFixed(dp)).toString();
}

// ─── Colour utilities ─────────────────────────────────────────

export function decToHex(dec) {
    return "#" + ((dec >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
}
export function hexToDec(hex) {
    return parseInt(String(hex).replace("#", ""), 16);
}

// ─── Text helpers ─────────────────────────────────────────────

export function stripColor(str) {
    return String(str).replace(/§./g, "");
}
export function colorize(str) {
    var result = "" + ChatLib.addColor(String(str));
    // ChatLib.addColor prepends §r — strip it
    return result.replace(/^§r/, "");
}

export function cleanLore(loreArray) {
    if (!loreArray) return [];
    let lines = loreArray.map(l => String(l));
    if (lines.length > 0) {
        const last = stripColor(lines[lines.length - 1]).trim();
        if (last.includes("LSHIFT") || last.includes("for more options")) lines.pop();
    }
    const result = [];
    let prevBlank = false;
    for (const l of lines) {
        const blank = stripColor(l).trim().length === 0;
        if (blank && prevBlank) continue;
        result.push(l);
        prevBlank = blank;
    }
    while (result.length && stripColor(result[0]).trim() === "")                result.shift();
    while (result.length && stripColor(result[result.length-1]).trim() === "")  result.pop();
    return result;
}