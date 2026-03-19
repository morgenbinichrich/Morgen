import Settings from "./config";

var C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
var ItemStack = Java.type("net.minecraft.item.ItemStack");
var JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
var ItemReg   = Java.type("net.minecraft.item.Item");

export function msg(text) {
    ChatLib.chat(ChatLib.addColor(Settings.chatPrefix + text));
}

export function requireCreative() {
    try {
        if (Player.asPlayerMP().player.field_71075_bZ.field_75098_d) return true;
    } catch (_) {}
    msg("&cYou must be in Creative Mode!");
    return false;
}

export function getNextEmptySlot(start) {
    const inv = Player.getInventory();
    if (!inv) return -1;

    // CT inventory slot indices:
    //   0-8  = hotbar (same items as packet slots 36-44)
    //   9-35 = main inventory
    // C10 creative packet slot indices:
    //   36-44 = hotbar
    //   9-35  = main inventory

    if (Settings.spawnIntoHotbar) {
        // Search hotbar: read CT index 0-8, return packet slot 36-44
        const baseIndex = (Settings.hotbarSlot || 1) - 1; // 0-based
        for (let offset = 0; offset < 9; offset++) {
            const ctIndex    = (baseIndex + offset) % 9;   // CT read index
            const packetSlot = 36 + ctIndex;               // C10 packet slot
            try {
                const s = inv.getStackInSlot(ctIndex);
                if (!s || s.getID() === 0) return packetSlot;
            } catch (_) {}
        }
        // All hotbar slots occupied — fall through to inventory
    }

    const lo = (start !== undefined && start > 9) ? start : 9;
    for (let i = lo; i <= 35; i++) {
        try { const s = inv.getStackInSlot(i); if (!s || s.getID() === 0) return i; } catch (_) {}
    }
    for (let i = 9; i < lo; i++) {
        try { const s = inv.getStackInSlot(i); if (!s || s.getID() === 0) return i; } catch (_) {}
    }
    // Hotbar fallback (when not in hotbar mode and inventory is full)
    for (let i = 0; i <= 8; i++) {
        try { const s = inv.getStackInSlot(i); if (!s || s.getID() === 0) return 36 + i; } catch (_) {}
    }
    return -1;
}

// Detect numeric-keyed objects produced by CT's NBT.toObject() for MC lists
// e.g. {"0":{Value:"..."},"1":{Value:"..."}}  →  [0:{Value:"..."},1:{Value:"..."}]
function _isNumericKeyedObj(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    var keys = Object.keys(obj);
    return keys.length > 0 && keys.every(function(k) { return /^\d+$/.test(k); });
}

export function buildNBTString(obj) {
    if (obj === null || obj === undefined) return "{}";
    if (typeof obj === "boolean")  return obj ? "1b" : "0b";
    if (typeof obj === "number")   return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    if (typeof obj === "string" || (obj && obj.getClass)) {
        var s = "" + obj;
        return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    // Native JS array
    if (Array.isArray(obj)) return "[" + obj.map(function(v, i) { return i + ":" + buildNBTString(v); }).join(",") + "]";
    if (typeof obj === "object") {
        // Minecraft NBT list deserialized as numeric-keyed object
        if (_isNumericKeyedObj(obj)) {
            var maxIdx = Math.max.apply(null, Object.keys(obj).map(Number));
            var parts = [];
            for (var i = 0; i <= maxIdx; i++) {
                var val = obj[i] !== undefined ? obj[i] : (obj["" + i] !== undefined ? obj["" + i] : null);
                parts.push(i + ":" + buildNBTString(val));
            }
            return "[" + parts.join(",") + "]";
        }
        const pairs = Object.entries(obj).map(([k, v]) => k + ":" + buildNBTString(v));
        return "{" + pairs.join(",") + "}";
    }
    return "" + obj;
}

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
        // New: full SkullOwner compound (from SkullOwnerJSON field) and ExtraAttributes
        const skullOwner      = data.skullOwner      || null;
        const extraAttributes = data.extraAttributes || null;

        let hideFlags = data.hideFlags !== undefined ? data.hideFlags : Settings.defaultHideFlags;
        if (Settings.autoHideFlags && unbreakable) hideFlags = hideFlags | 4;

        if (Settings.safeMode) {
            const check = ItemReg.func_111206_d(id);
            if (!check) { msg("&cInvalid item ID: &e" + id); return; }
        }

        const finalSlot = (typeof slot === "number" && slot >= 0 && slot <= 44)
            ? slot : getNextEmptySlot();
        if (finalSlot === -1) { msg("&cNo empty slot available!"); return; }

        // ── Build display compound ─────────────────────────────────────────
        const tagObj = {};
        const isLeather = id.toLowerCase().includes("leather");
        if (name || (lore && lore.length > 0) || (hex && isLeather)) {
            tagObj.display = {};
            if (name)                tagObj.display.Name  = String(name);
            if (lore && lore.length) tagObj.display.Lore  = lore.map(function(l) { return String(l); });
            if (hex && isLeather)    tagObj.display.color = parseInt(hex.replace("#", ""), 16);
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

        if (Settings.debugMode) {
            console.log("[createItem] tagObj.display.Name raw: " + JSON.stringify(tagObj.display && tagObj.display.Name));
        }

        // ── Build NBT string ───────────────────────────────────────────────
        var nbtStr = buildNBTString(tagObj);

        // ── SkullOwner injection ───────────────────────────────────────────
        // Priority: full skullOwner compound > bare texture string
        if (id.toLowerCase().includes("skull")) {
            var skullNbt = "";
            if (skullOwner) {
                // Serialise the full compound using buildNBTString so numeric-keyed
                // texture arrays become [0:{Value:"..."}] as required by MC 1.8.9
                skullNbt = "SkullOwner:" + buildNBTString(skullOwner);
            } else if (texture) {
                var uuid = "" + java.util.UUID.randomUUID();
                skullNbt = 'SkullOwner:{Id:"' + uuid + '",Properties:{textures:[{Value:"' + texture + '"}]}}';
            }
            if (skullNbt) {
                nbtStr = nbtStr.slice(0, -1) + (nbtStr.length > 2 ? "," : "") + skullNbt + "}";
            }
        }

        // ── ExtraAttributes injection ──────────────────────────────────────
        if (extraAttributes) {
            var eaNbt = "ExtraAttributes:" + buildNBTString(extraAttributes);
            nbtStr = nbtStr.slice(0, -1) + (nbtStr.length > 2 ? "," : "") + eaNbt + "}";
        }

        if (Settings.debugMode) console.log("[createItem] NBT: " + nbtStr);

        const tagNBT = JsonToNBT.func_180713_a(nbtStr);
        const mcItem = ItemReg.func_111206_d(id);
        const stack  = new ItemStack(mcItem, Math.max(1, count), damage);
        stack.func_77982_d(tagNBT);

        Client.sendPacket(new C10Packet(finalSlot, stack));

    } catch (err) {
        console.log("[createItem] fatal: " + err + "\n" + err.stack);
        msg("&cItem creation failed — see console.");
    }
}

export function formatStat(num) {
    const dp = Settings.decimalPlaces;
    if (dp === 0) return String(Math.round(num));
    return parseFloat(num.toFixed(dp)).toString();
}

export function decToHex(dec) {
    return "#" + ((dec >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
}

export function stripColor(str) {
    return String(str).replace(/[§&][0-9a-fk-or]/gi, "");
}

export function colorize(str) {
    var result = "" + ChatLib.addColor(String(str));
    if (result.startsWith("\u00a7r")) result = result.slice(2);
    return result;
}

var _HOUSING_INJECTED = [
    /^lshift\s+for\s+more\s+options$/i,
    /^for\s+more\s+options$/i,
    /^nbt:\s*\d+\s*tag\(s\)$/i,
    /^minecraft:[a-z0-9_]+$/,
    /^.+\s*\(#\d{3,}\)\s*$/,
];

export function cleanLore(loreArray) {
    if (!loreArray) return [];
    let lines = loreArray.map(l => String(l));

    var keepTrimming = true;
    while (keepTrimming && lines.length > 0) {
        keepTrimming = false;
        var last = stripColor(lines[lines.length - 1]).trim();
        for (var i = 0; i < _HOUSING_INJECTED.length; i++) {
            if (_HOUSING_INJECTED[i].test(last)) {
                lines.pop();
                keepTrimming = true;
                break;
            }
        }
    }

    lines = lines.filter(function(l) {
        var stripped = stripColor(l).trim();
        if (stripped.length === 0) return true;
        for (var i = 0; i < _HOUSING_INJECTED.length; i++) {
            if (_HOUSING_INJECTED[i].test(stripped)) return false;
        }
        return true;
    });

    if (lines.length > 0 && lines[0].replace(/^\s*/, "").indexOf("\u00a7o") === 0) {
        lines.shift();
    }

    const result = [];
    let prevBlank = false;
    for (const l of lines) {
        const blank = stripColor(l).trim().length === 0;
        if (blank && prevBlank) continue;
        result.push(l);
        prevBlank = blank;
    }
    while (result.length && stripColor(result[0]).trim() === "")               result.shift();
    while (result.length && stripColor(result[result.length-1]).trim() === "") result.pop();
    return result;
}