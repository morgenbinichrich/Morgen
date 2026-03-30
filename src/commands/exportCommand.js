import { decToHex, cleanLore, stripColor, msg, requireCreative } from "../../utils/utils";
import { openMigBrowser }                from "../../gui/MigBrowserGUI";
import { handleAiCommand }               from "./aiCommand";
import { togglePreview, openPreviewDrag }from "../../gui/ItemPreviewGUI";
import { openInventoryGui, openSymbolPicker } from "../../gui/Inventorygui";
import { handleQsCommand }                    from "../../gui/QuickSpawnGUI";
import { openEditGui, setEditLoreClipboard }  from "../../gui/Editgui";
import { snapshotHeld, undoLast, listHistory } from "../../src/undoHistory";
import { validateAndReport, trackRecent }from "./giveCommand";
import Settings                          from "../../utils/config";
import { handleChestExport }             from "../chestExport";

const FLAG_NAMES = {
    1: "Enchantments", 2: "AttributeModifiers", 4: "Unbreakable",
    8: "CanDestroy", 16: "CanPlaceOn", 32: "Miscellaneous"
};

function decodeHideFlags(n) {
    if (!n) return "None";
    return Object.entries(FLAG_NAMES)
        .filter(([bit]) => (n & parseInt(bit)) !== 0)
        .map(([, name]) => name).join(", ") || "None";
}

const ENCH_NAMES = {
    0: "Protection", 1: "Fire Protection", 2: "Feather Falling", 3: "Blast Protection",
    4: "Projectile Prot.", 5: "Respiration", 6: "Aqua Affinity", 7: "Thorns",
    16: "Sharpness", 17: "Smite", 18: "Bane of Arthropods", 19: "Knockback",
    20: "Fire Aspect", 21: "Looting", 32: "Efficiency", 33: "Silk Touch",
    34: "Unbreaking", 35: "Fortune", 48: "Power", 49: "Punch", 50: "Flame",
    51: "Infinity", 61: "Luck of the Sea", 62: "Lure"
};

function enchName(id) { return ENCH_NAMES[id] || "ench_" + id; }

var TYPE_RULES = [
    { keys: ["sword"],                                                          type: "Weapon",     icon: "⚔" },
    { keys: ["bow"],                                                            type: "Weapon",     icon: "⚔" },
    { keys: ["helmet", "chestplate", "leggings", "boots"],                     type: "Armor",      icon: "🛡" },
    { keys: ["pickaxe", "shovel", "hoe", "axe"],                               type: "Tool",       icon: "⛏" },
    { keys: ["skull", "head"],                                                  type: "Head",       icon: "💀" },
    { keys: ["banner"],                                                         type: "Decoration", icon: "⚑" },
    { keys: ["chest", "furnace", "dispenser", "dropper", "hopper"],            type: "Container",  icon: "📦" },
    { keys: ["log", "planks", "stone", "cobblestone", "brick", "glass",
              "sand", "gravel", "dirt", "grass"],                               type: "Block",      icon: "🧱" },
    { keys: ["ore"],                                                            type: "Block",      icon: "🧱" },
    { keys: ["enchanted_book", "written_book", "book"],                        type: "Book",       icon: "📖" },
    { keys: ["potion", "splash_potion"],                                       type: "Consumable", icon: "🧪" },
    { keys: ["apple", "bread", "fish", "carrot", "potato", "melon",
              "beef", "chicken", "pork", "cookie", "cake"],                     type: "Food",       icon: "🍖" },
    { keys: ["arrow"],                                                          type: "Ammo",       icon: "➶" },
    { keys: ["diamond", "emerald", "ingot", "nugget", "gem", "shard",
              "crystal", "dust", "powder", "nether_star", "blaze",
              "ender", "ghast", "slime", "string", "feather", "leather",
              "stick", "paper"],                                                type: "Material",   icon: "💎" },
];

function detectItemType(registryName) {
    var id = ("" + registryName).replace("minecraft:", "").toLowerCase();
    for (var i = 0; i < TYPE_RULES.length; i++) {
        var rule = TYPE_RULES[i];
        for (var j = 0; j < rule.keys.length; j++) {
            if (id.indexOf(rule.keys[j]) !== -1)
                return { type: rule.type, icon: rule.icon };
        }
    }
    return { type: "Misc", icon: "◆" };
}

var loreClipboard = null;

// FIX: Safe folder opener — java.awt.Desktop not available on iOS/headless systems
function openImportsFolder() {
    try {
        var d = new java.io.File(new java.io.File(".").getCanonicalPath()
            + "/config/ChatTriggers/modules/Morgen/imports");
        if (!d.exists()) d.mkdirs();
        if (java.awt.Desktop.isDesktopSupported()) {
            java.awt.Desktop.getDesktop().open(d);
            msg("&aOpened imports folder.");
        } else {
            msg("&cCannot open folder: Desktop not supported on this system.");
        }
    } catch (e) { msg("&cCould not open folder: " + e); }
}

function ensureDir(dir) {
    try {
        var d = new java.io.File(new java.io.File(".").getCanonicalPath()
            + "/config/ChatTriggers/modules/" + dir);
        if (!d.exists()) d.mkdirs();
    } catch (_) {}
}

function resolvePath(pathArg) {
    var clean = ("" + pathArg).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    var parts = clean.split("/").filter(function(p) { return p.length > 0; });
    if (parts.length === 0) parts = ["items"];
    var fileName = parts.pop();
    var subPath = parts.length > 0 ? parts.join("/") : "";
    return {
        dir:     subPath.length > 0 ? "Morgen/imports/" + subPath : "Morgen/imports",
        file:    fileName + ".mig",
        display: pathArg + ".mig"
    };
}

function timeSince(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    return Math.floor(s / 3600) + "h ago";
}

function nbtLoreToLines(rawLoreArray) {
    if (!rawLoreArray || !rawLoreArray.length) return [];
    return rawLoreArray.map(function(line) {
        return ("" + line).replace(/\u00a7/g, "&");
    });
}

function isNumericKeyedObject(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    var keys = Object.keys(obj);
    if (keys.length === 0) return false;
    return keys.every(function(k) { return /^\d+$/.test(k); });
}

function buildNbtValue(obj) {
    if (obj === null || obj === undefined) return "{}";
    if (typeof obj === "boolean") return obj ? "1b" : "0b";
    if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    if (typeof obj === "string")  return '"' + ("" + obj).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

    if (Array.isArray(obj)) {
        var items = obj.map(function(v, i) { return i + ":" + buildNbtValue(v); });
        return "[" + items.join(",") + "]";
    }

    if (typeof obj === "object") {
        if (isNumericKeyedObject(obj)) {
            var maxIdx = Math.max.apply(null, Object.keys(obj).map(Number));
            var parts = [];
            for (var i = 0; i <= maxIdx; i++) {
                var val = obj[i] !== undefined ? obj[i] : (obj["" + i] !== undefined ? obj["" + i] : null);
                parts.push(i + ":" + buildNbtValue(val));
            }
            return "[" + parts.join(",") + "]";
        }
        var pairs = Object.keys(obj).map(function(k) {
            return k + ":" + buildNbtValue(obj[k]);
        });
        return "{" + pairs.join(",") + "}";
    }
    return "" + obj;
}

function buildGiveCommandFromRawTag(d) {
    var tag = d.rawTag || {};

    var nbtObj = {};

    if (d.hideFlags)   nbtObj.HideFlags   = d.hideFlags;
    if (d.unbreakable) nbtObj.Unbreakable = 1;

    var dispObj = {};
    if (d.name) dispObj.Name = ("" + d.name).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    if (d.lore && d.lore.length > 0) {
        var loreObj = {};
        d.lore.forEach(function(l, i) {
            loreObj[i] = ("" + l).replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
        });
        dispObj.Lore = loreObj;
    }
    if (d.hex && d.itemId.indexOf("leather") !== -1)
        dispObj.color = parseInt(d.hex.replace("#", ""), 16);
    if (Object.keys(dispObj).length > 0) nbtObj.display = dispObj;

    var enchArr = (d.enchants || []).map(function(e) { return { id: e.id, lvl: e.lvl }; });
    if (d.glow) enchArr.push({ id: 0, lvl: 1 });
    if (enchArr.length > 0) {
        var enchObj = {};
        enchArr.forEach(function(e, i) { enchObj[i] = e; });
        nbtObj.ench = enchObj;
    }

    if (d.itemModel) nbtObj.ItemModel = d.itemModel;

    if (d.itemId.indexOf("skull") !== -1 && tag.SkullOwner) {
        nbtObj.SkullOwner = tag.SkullOwner;
    }

    if (tag.ExtraAttributes) nbtObj.ExtraAttributes = tag.ExtraAttributes;

    var handled = { HideFlags:1, Unbreakable:1, display:1, ench:1, ItemModel:1, SkullOwner:1, ExtraAttributes:1 };
    Object.keys(tag).forEach(function(k) {
        if (!handled[k]) nbtObj[k] = tag[k];
    });

    return "/give @p " + d.itemId + " " + d.count + " " + d.damage + " " + buildNbtValue(nbtObj);
}

function collectItemData(item) {
    try {
        var nbt  = item.getNBT().toObject();
        var tag  = nbt.tag || {};
        var disp = tag.display || {};
        var id   = "" + item.getRegistryName();
        var ti   = detectItemType(id);

        var name = disp.Name
            ? ("" + disp.Name).replace(/\u00a7/g, "&")
            : ("" + item.getName()).replace(/\u00a7/g, "&");

        var lore;
        if (disp.Lore) {
            var loreRaw = Array.isArray(disp.Lore)
                ? disp.Lore
                : Object.keys(disp.Lore)
                    .sort(function(a,b){ return parseInt(a)-parseInt(b); })
                    .map(function(k){ return disp.Lore[k]; });
            lore = loreRaw.map(function(l) {
                return Settings.stripColorOnExport
                    ? stripColor(("" + l).replace(/\u00a7/g, "&"))
                    : ("" + l).replace(/\u00a7/g, "&");
            });
        } else {
            lore = cleanLore(item.getLore()).slice(1).map(function(l) {
                return Settings.stripColorOnExport ? stripColor(l) : ("" + l).replace(/\u00a7/g, "&");
            });
        }

        var allEnch = [];
        if (tag.ench) {
            allEnch = Array.isArray(tag.ench)
                ? tag.ench
                : Object.keys(tag.ench)
                    .sort(function(a,b){ return parseInt(a)-parseInt(b); })
                    .map(function(k){ return tag.ench[k]; });
        }
        var hasGlow  = allEnch.some(function(e) { return e.id === 0 && e.lvl === 1; });
        var realEnch = allEnch.filter(function(e) { return !(e.id === 0 && e.lvl === 1); });

        var texture = null;
        if (id.indexOf("skull") !== -1 && tag.SkullOwner) {
            try {
                var texList = tag.SkullOwner.Properties.textures;
                var firstTex = Array.isArray(texList) ? texList[0]
                    : (texList[0] !== undefined ? texList[0] : texList["0"]);
                if (firstTex) texture = "" + firstTex.Value;
            } catch (_) {}
        }

        var hex = null;
        if (id.indexOf("leather") !== -1 && disp.color !== undefined)
            hex = decToHex(disp.color);

        var hideFlags = tag.HideFlags !== undefined ? tag.HideFlags : Settings.defaultHideFlags;

        return {
            itemId:      id,
            itemType:    ti.type,
            itemIcon:    ti.icon,
            name:        name,
            amount:      1,
            count:       item.getStackSize() || 1,
            damage:      item.getMetadata ? item.getMetadata() : 0,
            unbreakable: tag.Unbreakable === 1,
            glow:        hasGlow,
            hideFlags:   hideFlags,
            hex:         hex,
            texture:     texture,
            itemModel:   tag.ItemModel ? ("" + tag.ItemModel) : null,
            enchants:    realEnch.map(function(e) { return { id: e.id, lvl: e.lvl, name: enchName(e.id) }; }),
            lore:        lore,
            stats:       {},
            rawTag:      tag
        };
    } catch (e) {
        msg("&cFailed to read item data: " + e);
        console.log("[exportCommand] collectItemData: " + e);
        return null;
    }
}

function buildCleanMig(d) {
    var out  = "";
    var type = d.itemType || "Misc";
    var tag  = d.rawTag   || {};

    out += 'ITEM "' + d.itemId + '" {\n\n';

    if (Settings.nameFormatStr === "list") {
        out += '    Name:   list("' + d.name + '")\n';
    } else {
        out += '    Name:   "' + d.name + '"\n';
    }
    out += "    Amount: " + d.amount + "\n";
    out += "    Count:  " + d.count  + "\n\n";

    out += '    ItemType:    "' + type + '"\n';
    out += "    Damage:      " + d.damage      + "\n";
    out += "    Unbreakable: " + d.unbreakable + "\n";
    out += "    Glow:        " + d.glow        + "\n";
    out += "    HideFlags:   " + d.hideFlags   + "  # " + decodeHideFlags(d.hideFlags) + "\n";

    if (type === "Weapon" || type === "Tool" || type === "Armor"
        || type === "Consumable" || type === "Food") {
        out += "\n    Stats {\n";
        if (d.stats && Object.keys(d.stats).length > 0) {
            Object.keys(d.stats).forEach(function(k) { out += "        " + k + ": " + d.stats[k] + "\n"; });
        } else if (type === "Weapon") {
            out += "        # damage:    static(10)\n        # crit:      static(5)\n";
            out += "        # speed:     linear(1.0, 0.5)\n        # lifesteal: static(0)\n";
        } else if (type === "Tool") {
            out += "        # efficiency: static(5)\n        # fortune:    static(0)\n        # silk_touch: static(0)\n";
        } else if (type === "Armor") {
            out += "        # defense:   static(10)\n        # health:    static(50)\n        # toughness: static(0)\n";
        } else if (type === "Consumable" || type === "Food") {
            out += "        # heal:        static(4)\n        # saturation:  static(2)\n";
        }
        out += "    }\n";
    } else if (Settings.addStatsPlaceholder) {
        out += "\n    Stats {\n        # value: static(1)\n    }\n";
    }

    if (type === "Armor" && d.hex) {
        out += '\n    Hex: "' + d.hex + '"\n';
        out += '    # Hex list example: Hex: list("#FF0000","#00FF00","#0000FF")\n';
    }

    if (type === "Head" && d.texture) {
        out += '\n    Texture: "' + d.texture + '"\n';
    }

    if (d.enchants && d.enchants.length > 0) {
        var simple = d.enchants.map(function(e) { return { id: e.id, lvl: e.lvl }; });
        out += "\n    Enchants: " + JSON.stringify(simple) + "\n";
    }

    if (d.itemModel) {
        out += '\n    ItemModel: "' + d.itemModel + '"\n';
    }

    if (d.itemId.indexOf("skull") !== -1 && tag.SkullOwner) {
        try { out += "\n    SkullOwnerJSON: " + JSON.stringify(tag.SkullOwner) + "\n"; } catch(_) {}
    }

    if (tag.ExtraAttributes && Object.keys(tag.ExtraAttributes).length > 0) {
        try { out += "\n    ExtraAttributesJSON: " + JSON.stringify(tag.ExtraAttributes) + "\n"; } catch(_) {}
    }

    out += "\n    Lore: [\n";
    (d.lore || []).forEach(function(line) { out += '        "' + line.replace(/"/g, '\\"') + '"\n'; });
    out += "    ]\n\n}\n";
    return out;
}

function tryParse(str) { try { return JSON.parse(str); } catch(_) { return null; } }

// FIX: Safe file opener
function openMigFile(pathArg) {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var full = base + "/config/ChatTriggers/modules/Morgen/imports/" + pathArg + ".mig";
        var file = new java.io.File(full);
        if (!file.exists()) { msg("&cFile not found: " + pathArg + ".mig"); return; }
        if (java.awt.Desktop.isDesktopSupported()) {
            java.awt.Desktop.getDesktop().open(file);
            msg("&aOpened in external editor.");
        } else {
            msg("&cCannot open file: Desktop not supported on this system.");
        }
    } catch (e) { msg("&cCould not open file: " + e); }
}

function exportItem(pathArg) {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    var data = collectItemData(item);
    if (!data) return;
    var mig = buildCleanMig(data);
    if (!mig) return;
    var resolved = resolvePath(pathArg);
    try { ensureDir(resolved.dir); FileLib.write(resolved.dir, resolved.file, mig); }
    catch (e) { msg("&cWrite failed: " + e); return; }
    var giveCmd  = buildGiveCommandFromRawTag(data);
    var giveFile = resolved.file.replace(/\.mig$/, ".give");
    try { FileLib.write(resolved.dir, giveFile, giveCmd + "\n"); } catch (_) {}
    ChatLib.chat(ChatLib.addColor("&8─────────────────────────────────────"));
    msg("&a✔ Exported  &8[" + data.itemIcon + " " + data.itemType + "]");
    msg("  &7Item   &f" + item.getName());
    msg("  &7MIG    " + resolved.display);
    msg("  &7Give   " + resolved.dir + "/" + giveFile);
    var _ic = new TextComponent(ChatLib.addColor("  &7       "));
    var _b1 = new TextComponent(ChatLib.addColor("&a[ ▶ Import ] "));
    _b1.setClick("run_command", "/mm import " + pathArg);
    _b1.setHover("show_text", ChatLib.addColor("&7Spawn item back\n&8/mm import " + pathArg));
    var _b2 = new TextComponent(ChatLib.addColor("&b[ ✎ Open in Editor ]"));
    _b2.setClick("run_command", "/mm openfile " + pathArg);
    _b2.setHover("show_text", ChatLib.addColor("&7Open the .mig file in your system editor"));
    ChatLib.chat(new Message(_ic, _b1, _b2));
    ChatLib.chat(ChatLib.addColor("&8─────────────────────────────────────"));
    if (Settings.autoOpenAfterExport) openImportsFolder();
}

function exportInventory() {
    if (!requireCreative()) return;
    var inv = Player.getInventory();
    if (!inv) { msg("&cNo inventory found."); return; }
    var now  = new Date();
    var pad  = function(n) { return ("" + n).length < 2 ? "0" + n : "" + n; };
    var stamp = now.getFullYear() + "-" + pad(now.getMonth()+1) + "-" + pad(now.getDate())
              + "_" + pad(now.getHours()) + "-" + pad(now.getMinutes());
    var folder = "inventory/" + stamp;
    var base   = "Morgen/imports/" + folder;
    ensureDir(base);
    var exported = 0, skipped = 0;
    for (var i = 0; i <= 39; i++) {
        var item;
        try { item = inv.getStackInSlot(i); } catch (_) { continue; }
        if (!item || item.getID() === 0) { skipped++; continue; }
        var safeName = stripColor(item.getName()).replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 32) || "item";
        var fname = "slot_" + pad(i) + "_" + safeName + ".mig";
        var data  = collectItemData(item);
        if (!data) { skipped++; continue; }
        var mig = buildCleanMig(data);
        if (!mig) { skipped++; continue; }
        try {
            FileLib.write(base, fname, mig);
            FileLib.write(base, fname.replace(/\.mig$/, ".give"), buildGiveCommandFromRawTag(data) + "\n");
            exported++;
        } catch (_) { skipped++; }
    }
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    msg("&6&lInventory Export");
    msg("  &7Folder   " + folder);
    msg("  &7Exported &a" + exported + " &7items");
    if (skipped > 0) msg("  &7Skipped  &8" + skipped);
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    if (Settings.autoOpenAfterExport) openImportsFolder();
}

// ─── getRecentItems helper (used in /mm recent) ───────────────────────────────
function getRecentItems() {
    try {
        var r = FileLib.read("Morgen/config", "recent.json");
        if (r) return JSON.parse(r);
    } catch (_) {}
    return [];
}

register("command", function() {
    var args   = Array.prototype.slice.call(arguments);
    var action = (args[0] || "").toLowerCase();

    if (action === "import") {
        if (!args[1]) { msg("&cUsage: &f/mm import &e[folder/]name"); return; }
        ChatLib.command("mmimport " + args.slice(1).join(" "), true); return;
    }
    if (action === "continue") {
        var giveCmd = require("./giveCommand");
        if (giveCmd && giveCmd.runContinue) giveCmd.runContinue();
        else msg("&cNo pending import to continue."); return;
    }
    if (action === "chestexport") { handleChestExport(); return; }
    if (action === "openfile") {
        if (!args[1]) { msg("&cUsage: &f/mm openfile &e[folder/]name"); return; }
        openMigFile(args.slice(1).join(" ")); return;
    }
    if (action === "export") {
        if (!args[1]) { msg("&cUsage: &f/mm export &e[folder/]name"); return; }
        exportItem(args.slice(1).join(" ")); return;
    }
    if (action === "info") {
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        var data = collectItemData(item);
        if (!data) return;
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("&6&lItem Info &8— &7" + item.getName());
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("  &7ID        &e" + data.itemId);
        msg("  &7Type      &b" + data.itemIcon + " " + data.itemType);
        msg("  &7Damage    &e" + data.damage);
        msg("  &7Stack     &e" + data.count);
        msg("  &7Unbreak   " + (data.unbreakable ? "&aYes" : "&8No"));
        msg("  &7Glow      " + (data.glow ? "&dYes" : "&8No"));
        msg("  &7HideFlags &e" + data.hideFlags + " &8(" + decodeHideFlags(data.hideFlags) + ")");
        if (data.hex)       msg("  &7HexColor  " + data.hex);
        if (data.texture)   msg("  &7Texture   &8<skull base64>");
        if (data.itemModel) msg("  &7ItemModel " + data.itemModel);
        if (data.enchants.length > 0)
            msg("  &7Enchants  &d" + data.enchants.map(function(e) { return e.name + " " + e.lvl; }).join(", "));
        var ea = (data.rawTag || {}).ExtraAttributes;
        if (ea) msg("  &7ExtraAttr &8" + JSON.stringify(ea).substring(0, 80));
        if (data.lore.length > 0) {
            msg("  &7Lore &8(" + data.lore.length + " lines):");
            data.lore.slice(0, 6).forEach(function(l) { ChatLib.chat(ChatLib.addColor("    &8│ " + l)); });
            if (data.lore.length > 6) msg("    &8... +" + (data.lore.length - 6) + " more");
        }
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        return;
    }
    if (action === "nbt") {
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        var raw = item.getNBT ? item.getNBT().toString() : "{}";
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("&6&lRaw NBT &8— &7" + item.getName());
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        for (var i = 0; i < raw.length; i += 200) ChatLib.chat("&f" + raw.slice(i, i + 200));
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        return;
    }
    if (action === "copy") {
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        var nbt  = item.getNBT().toObject();
        var disp = (nbt.tag || {}).display || {};
        var rawLore;
        if (disp.Lore) {
            var lr = Array.isArray(disp.Lore) ? disp.Lore
                : Object.keys(disp.Lore).sort(function(a,b){return parseInt(a)-parseInt(b);}).map(function(k){return disp.Lore[k];});
            rawLore = lr.map(function(l){ return (""+l).replace(/\u00a7/g,"&"); });
        } else {
            rawLore = cleanLore(item.getLore()).slice(1).map(function(l){ return (""+l).replace(/\u00a7/g,"&"); });
        }
        if (rawLore.length === 0) { msg("&cThis item has no lore."); return; }
        loreClipboard = rawLore;
        setEditLoreClipboard(rawLore);
        msg("&aCopied " + rawLore.length + " &7lore line" + (rawLore.length !== 1 ? "s" : "") + " &8— use Paste in /mm edit");
        rawLore.forEach(function(l, i) { ChatLib.chat(ChatLib.addColor("  &8" + (i+1) + ". &7" + l)); });
        return;
    }
    if (action === "paste") {
        if (!loreClipboard || loreClipboard.length === 0) { msg("&cClipboard empty — use &f/mm copy &7first."); return; }
        var item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        if (!requireCreative()) return;
        snapshotHeld("paste-lore");
        pasteLoreOnto(item, loreClipboard);
        msg("&aPasted " + loreClipboard.length + " &7lore lines onto &f" + item.getName() + "&a.");
        return;
    }
    if (action === "inventory") { exportInventory(); return; }
    if (action === "recent") {
        var recentItems = getRecentItems();
        if (recentItems.length === 0) { msg("&7No recent imports yet."); return; }
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("&6&lRecent Imports");
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        recentItems.forEach(function(r, idx) {
            var c = new TextComponent(ChatLib.addColor("  &7" + (idx+1) + ". &f" + r.name + " &8— &7" + r.path + " &8(" + timeSince(r.time) + ") &e[Import]"));
            c.setClick("run_command", "/mm import " + r.path);
            c.setHover("show_text", ChatLib.addColor("&eClick to import: &f" + r.path));
            ChatLib.chat(new Message(c));
        });
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        return;
    }
    if (action === "compare")   { compareHeldItems(); return; }
    if (action === "rename") {
        if (!args[1]) { msg("&cUsage: &f/mm rename &e<new name>"); return; }
        args.shift(); snapshotHeld("rename"); renameHeldItem(args.join(" ")); return;
    }
    if (action === "addlore") {
        if (!args[1]) { msg("&cUsage: &f/mm addlore &e<line>"); return; }
        args.shift(); snapshotHeld("addlore"); addLoreToHeld(args.join(" ")); return;
    }
    if (action === "clearlore") { snapshotHeld("clearlore"); clearLoreOnHeld(); return; }
    if (action === "dupe")      { dupeHeldItem(parseInt(args[1]) || 1); return; }
    if (action === "tojson") {
        if (!args[1]) { msg("&cUsage: &f/mm tojson [folder/]name"); return; }
        args.shift(); migToJson(args.join(" ")); return;
    }
    if (action === "tomig") {
        if (!args[1]) { msg("&cUsage: &f/mm tomig [folder/]name"); return; }
        args.shift(); jsonToMig(args.join(" ")); return;
    }
    if (action === "ai")        { args.shift(); handleAiCommand(args); return; }
    if (action === "invgui")    { Client.scheduleTask(function() { openInventoryGui(); }); return; }
    if (action === "symbols" || action === "sym") { Client.scheduleTask(function() { openSymbolPicker(); }); return; }
    if (action === "edit")      { Client.scheduleTask(function() { openEditGui(); }); return; }
    if (action === "undo") {
        var s = (args[1] || "").toLowerCase();
        if (s === "list" || s === "history") { listHistory(msg); return; }
        undoLast(msg); return;
    }
    if (action === "validate" || action === "check") {
        if (!args[1]) { msg("&cUsage: &f/mm validate &e[folder/]name"); return; }
        args.shift(); validateAndReport(args.join(" "), msg); return;
    }
    if (action === "preview") {
        if ((args[1] || "").toLowerCase() === "drag") { openPreviewDrag(); return; }
        togglePreview(); return;
    }
    if (action === "qs")       { args.shift(); handleQsCommand(args); return; }
    if (action === "gui")      { openMigBrowser(); return; }
    if (action === "open")     { openImportsFolder(); return; }
    if (action === "settings") { Settings.openGUI(); return; }

    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));
    msg("  &6&l✦ Morgen &8— &7by &7[&bITV&7] &8& &6MorgenBinIchRich");
    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));
    msg("  &e/mm export   &7<n>   &8— &7export held item to .mig");
    msg("  &e/mm import   &7<n>   &8— &7spawn item from .mig");
    msg("  &e/mm gui             &8— &7open file browser");
    msg("  &e/mm recent          &8— &7show recently imported items");
    msg("  &e/mm inventory       &8— &7export all inventory items");
    msg("  &e/mm copy            &8— &7copy lore to clipboard");
    msg("  &e/mm paste           &8— &7paste lore onto held item");
    msg("  &e/mm rename  &7<n>   &8— &7rename held item");
    msg("  &e/mm addlore &7<l>   &8— &7add a lore line");
    msg("  &e/mm clearlore       &8— &7clear all lore");
    msg("  &e/mm dupe    &7[n]   &8— &7duplicate held item n times");
    msg("  &e/mm ai      &7...   &8— &7AI names and set generator");
    msg("  &e/mm edit            &8— &7in-game item editor GUI");
    msg("  &e/mm invgui          &8— &7visual inventory viewer");
    msg("  &e/mm symbols         &8— &7symbol picker");
    msg("  &e/mm validate &7<n>  &8— &7validate .mig before import");
    msg("  &e/mm undo    &7[list] &8— &7restore last item change");
    msg("  &e/mm qs      &7[1-9] &8— &7quick-spawn slots");
    msg("  &e/mm tojson  &7<n>   &8— &7convert .mig to .json");
    msg("  &e/mm tomig   &7<n>   &8— &7convert .json to .mig");
    msg("  &e/mm info            &8— &7detailed item info");
    msg("  &e/mm nbt             &8— &7raw NBT dump");
    msg("  &e/mm open            &8— &7open imports folder");
    msg("  &e/mm settings        &8— &7open settings GUI");
    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));
}).setName("mm");

// ─── Item manipulation helpers ────────────────────────────────────────────────

function buildNBT(obj) {
    if (obj === null || obj === undefined) return "{}";
    if (typeof obj === "boolean") return obj ? "1b" : "0b";
    if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
    if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
    if (isNumericKeyedObject(obj)) {
        var maxIdx = Math.max.apply(null, Object.keys(obj).map(Number));
        var parts  = [];
        for (var i = 0; i <= maxIdx; i++) {
            var v = obj[i] !== undefined ? obj[i] : (obj["" + i] !== undefined ? obj["" + i] : null);
            parts.push(i + ":" + buildNBT(v));
        }
        return "[" + parts.join(",") + "]";
    }
    return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
}

function rebuildItem(item, tag, slot) {
    var C10 = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
    var IS  = Java.type("net.minecraft.item.ItemStack");
    var NBT = Java.type("net.minecraft.nbt.JsonToNBT");
    var IR  = Java.type("net.minecraft.item.Item");
    var mc  = IR.func_111206_d(item.getRegistryName());
    var stk = new IS(mc, item.getStackSize() || 1, item.getMetadata ? item.getMetadata() : 0);
    stk.func_77982_d(NBT.func_180713_a(buildNBT(tag)));
    Client.sendPacket(new C10(slot, stk));
}

function pasteLoreOnto(item, lore) {
    var tag = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    var loreObj = {};
    lore.forEach(function(l, i) { loreObj[i] = ("" + l).replace(/&([0-9a-fk-or])/gi, "\u00a7$1"); });
    tag.display.Lore = loreObj;
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
}

function renameHeldItem(newName) {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    var tag = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    tag.display.Name = newName.replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aRenamed to &f" + newName);
}

function addLoreToHeld(line) {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    var tag = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    var existingLore = {};
    if (tag.display.Lore) {
        var raw = tag.display.Lore;
        if (Array.isArray(raw)) { raw.forEach(function(v, i) { existingLore[i] = v; }); }
        else { Object.keys(raw).forEach(function(k) { existingLore[parseInt(k)] = raw[k]; }); }
    }
    existingLore[Object.keys(existingLore).length] = line.replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    tag.display.Lore = existingLore;
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aAdded lore line &7\"&f" + line + "&7\"");
}

function clearLoreOnHeld() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    var tag = (item.getNBT().toObject().tag) || {};
    if (tag.display) tag.display.Lore = {};
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aCleared lore from &f" + item.getName());
}

function dupeHeldItem(times) {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    times = Math.max(1, Math.min(times, 36));
    var tag = (item.getNBT().toObject().tag) || {};
    var C10 = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
    var IS  = Java.type("net.minecraft.item.ItemStack");
    var NBT = Java.type("net.minecraft.nbt.JsonToNBT");
    var IR  = Java.type("net.minecraft.item.Item");
    var mc  = IR.func_111206_d(item.getRegistryName());
    var inv = Player.getInventory();
    var placed = 0;
    for (var s = 9; s <= 44 && placed < times; s++) {
        try {
            var slot = inv.getStackInSlot(s);
            if (slot && slot.getID() !== 0) continue;
            var stk = new IS(mc, item.getStackSize(), item.getMetadata ? item.getMetadata() : 0);
            if (Object.keys(tag).length > 0) stk.func_77982_d(NBT.func_180713_a(buildNBT(tag)));
            Client.sendPacket(new C10(s, stk));
            placed++;
        } catch (e) { console.log("[dupe] slot " + s + ": " + e); }
    }
    msg("&aDuped " + placed + "&a cop" + (placed !== 1 ? "ies" : "y") + " of &f" + item.getName());
}

var compareSlot1 = null;

function compareHeldItems() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!compareSlot1) {
        compareSlot1 = item;
        msg("&aItem 1: &f" + item.getName() + " &7— hold item 2 and run &f/mm compare &7again.");
        return;
    }
    var a = compareSlot1, b = item; compareSlot1 = null;
    var aTag = (a.getNBT().toObject().tag) || {}, bTag = (b.getNBT().toObject().tag) || {};
    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));
    msg("  &6&l⚖ Item Compare");
    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));
    msg("  &7A: &f" + a.getName() + "  &8vs  &7B: &f" + b.getName());
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    printCompareRow("ID",      a.getRegistryName(), b.getRegistryName());
    printCompareRow("Type",    detectItemType(a.getRegistryName()).type, detectItemType(b.getRegistryName()).type);
    printCompareRow("Damage",  a.getMetadata ? a.getMetadata() : 0, b.getMetadata ? b.getMetadata() : 0);
    printCompareRow("Stack",   a.getStackSize(), b.getStackSize());
    printCompareRow("Unbreak", !!aTag.Unbreakable, !!bTag.Unbreakable);
    printCompareRow("Glow",
        !!(aTag.ench && (Array.isArray(aTag.ench)?aTag.ench:Object.values(aTag.ench)).some(function(e){return e.id===0&&e.lvl===1;})),
        !!(bTag.ench && (Array.isArray(bTag.ench)?bTag.ench:Object.values(bTag.ench)).some(function(e){return e.id===0&&e.lvl===1;})));
    var aDisp = aTag.display||{}, bDisp = bTag.display||{};
    function normLore(d, item) {
        if (d.Lore) return nbtLoreToLines(Array.isArray(d.Lore)?d.Lore:Object.values(d.Lore));
        return cleanLore(item.getLore()).slice(1);
    }
    var aLore = normLore(aDisp, a), bLore = normLore(bDisp, b);
    msg(aLore.join("|")!==bLore.join("|")
        ? "  &7Lore   &8A:&f"+aLore.length+" B:&f"+bLore.length+" &c(differs)"
        : "  &7Lore   &8— &asame ("+aLore.length+" lines)");
    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));
}

function printCompareRow(label, a, b) {
    var same = String(a) === String(b);
    msg("  &7" + label.padEnd(9) + " &8A:&f" + a + "  &8B:" + (same ? "&a" : "&e") + b + (same ? "" : " &c◄"));
}

function migToJson(pathArg) {
    var p = pathArg.replace(/\.mig$/, "");
    var parts = p.replace(/\\/g, "/").split("/"), file = parts.pop();
    var dir = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    var raw;
    try { raw = FileLib.read(dir, file + ".mig"); } catch(e) { msg("&cCould not read: " + p + ".mig"); return; }
    if (!raw) { msg("&cFile not found: " + p + ".mig"); return; }
    var idM   = raw.match(/ITEM\s+"([^"]+)"/);
    var nameM = raw.match(/^\s*Name:\s*(?:list\()?["']?([^"'\n\)]+)/m);
    var damM  = raw.match(/^\s*Damage:\s*(\d+)/m);
    var cntM  = raw.match(/^\s*Count:\s*(\d+)/m);
    var texM  = raw.match(/^\s*Texture:\s*"([^"]+)"/m);
    var hexM  = raw.match(/^\s*Hex:\s*"([^"]+)"/m);
    var unbrM = raw.match(/^\s*Unbreakable:\s*(true|false)/im);
    var hfM   = raw.match(/^\s*HideFlags:\s*(\d+)/m);
    var glowM = raw.match(/^\s*Glow:\s*(true|false)/im);
    var mdlM  = raw.match(/^\s*ItemModel:\s*"([^"]+)"/m);
    var soM   = raw.match(/^\s*SkullOwnerJSON:\s*(\{.+\})\s*$/m);
    var eaM   = raw.match(/^\s*ExtraAttributesJSON:\s*(\{.+\})\s*$/m);
    if (!idM) { msg("&cCould not parse ITEM id."); return; }
    var lore = [], ls = raw.indexOf("Lore:");
    if (ls !== -1) {
        var ms = raw.slice(ls).match(/"((?:[^"\\]|\\.)*)"/g);
        if (ms) lore = ms.slice(0, 100).map(function(s) { return s.slice(1,-1).replace(/\\"/g,'"'); });
    }
    var id = idM[1], ti = detectItemType(id);
    var obj = {
        itemId: id, itemType: ti.type, itemIcon: ti.icon,
        name:   nameM ? nameM[1].trim().replace(/["']/g,"") : "",
        amount: 1, count: cntM?parseInt(cntM[1]):1, damage: damM?parseInt(damM[1]):0,
        unbreakable: unbrM?unbrM[1]==="true":false, glow: glowM?glowM[1]==="true":false,
        hideFlags: hfM?parseInt(hfM[1]):63,
        hex: hexM?hexM[1]:null, texture: texM?texM[1]:null, itemModel: mdlM?mdlM[1]:null,
        enchants: [], lore: lore, stats: {},
        skullOwner:      soM ? tryParse(soM[1]) : null,
        extraAttributes: eaM ? tryParse(eaM[1]) : null
    };
    try { ensureDir(dir); FileLib.write(dir, file+".json", JSON.stringify(obj,null,2)); msg("&a.mig → .json: "+p+".json"); }
    catch(e) { msg("&cWrite failed: "+e); }
}

function jsonToMig(pathArg) {
    var p = pathArg.replace(/\.json$/, "");
    var parts = p.replace(/\\/g, "/").split("/"), file = parts.pop();
    var dir = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    var raw;
    try { raw = FileLib.read(dir, file + ".json"); } catch(e) { msg("&cCould not read: "+p+".json"); return; }
    if (!raw) { msg("&cFile not found: "+p+".json"); return; }
    var d; try { d = JSON.parse(raw); } catch(e) { msg("&cInvalid JSON: "+e); return; }
    if (!d.itemId) { msg("&cNo 'itemId' field — not a Morgen JSON."); return; }
    var ti = detectItemType(d.itemId);
    if (!d.itemType) d.itemType = ti.type;
    if (!d.itemIcon) d.itemIcon = ti.icon;
    if (!d.lore)     d.lore     = [];
    if (!d.stats)    d.stats    = {};
    if (d.amount === undefined) d.amount = 1;
    if (!d.enchants) d.enchants = [];
    d.rawTag = {};
    if (d.skullOwner)      d.rawTag.SkullOwner      = d.skullOwner;
    if (d.extraAttributes) d.rawTag.ExtraAttributes = d.extraAttributes;
    if (d.texture && !d.rawTag.SkullOwner)
        d.rawTag.SkullOwner = { Id:"00000000-0000-0000-0000-000000000000", Properties:{ textures:{ 0:{ Value:d.texture } } } };
    var mig = buildCleanMig(d);
    if (!mig) return;
    try { ensureDir(dir); FileLib.write(dir, file+".mig", mig); msg("&a.json → .mig: &e"+p+".mig"); msg("  &7Import: &f/mm import "+p); }
    catch(e) { msg("&cWrite failed: "+e); }
}