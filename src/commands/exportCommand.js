// ============================================================
//  Morgen — src/commands/exportCommand.js  (/mm)
// ============================================================

import { decToHex, cleanLore, stripColor, msg, requireCreative } from "../../utils/utils";
import { openMigBrowser }      from "../../gui/MigBrowserGUI";
import { handleAiCommand }      from "./aiCommand";
import { togglePreview, openPreviewDrag } from "../../gui/ItemPreviewGUI";
import { openInventoryGui, openSymbolPicker } from "../../gui/Inventorygui";
import { openQuickSpawn, handleQsCommand } from "../../gui/QuickSpawnGUI";
import { openEditGui }   from "../../gui/Editgui";
import { snapshotHeld, undoLast, listHistory } from "../../src/undoHistory";
import { validateAndReport } from "../../src/migValidator";
import Settings from "../../utils/config";
import { handleChestExport } from "../chestExport";
// ─── HideFlags / Enchant lookups ─────────────────────────────

const FLAG_NAMES = {
    1:"Enchantments", 2:"AttributeModifiers", 4:"Unbreakable",
    8:"CanDestroy", 16:"CanPlaceOn", 32:"Miscellaneous"
};
function decodeHideFlags(n) {
    if (!n) return "None";
    return Object.entries(FLAG_NAMES)
        .filter(([bit]) => (n & parseInt(bit)) !== 0)
        .map(([, name]) => name).join(", ") || "None";
}
const ENCH_NAMES = {
    0:"Protection",1:"Fire Protection",2:"Feather Falling",3:"Blast Protection",
    4:"Projectile Prot.",5:"Respiration",6:"Aqua Affinity",7:"Thorns",16:"Sharpness",
    17:"Smite",18:"Bane of Arthropods",19:"Knockback",20:"Fire Aspect",21:"Looting",
    32:"Efficiency",33:"Silk Touch",34:"Unbreaking",35:"Fortune",48:"Power",
    49:"Punch",50:"Flame",51:"Infinity",61:"Luck of the Sea",62:"Lure"
};
function enchName(id) { return ENCH_NAMES[id] || "ench_" + id; }

// ─── Lore clipboard ───────────────────────────────────────────

var loreClipboard = null;

// ─── Recent items history (last 10) ──────────────────────────

var recentItems = [];   // [{ name, path, time }]
var MAX_RECENT  = 10;

function pushRecent(name, path) {
    recentItems = recentItems.filter(function(r) { return r.path !== path; });
    recentItems.unshift({ name: name, path: path, time: Date.now() });
    if (recentItems.length > MAX_RECENT) recentItems = recentItems.slice(0, MAX_RECENT);
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var dir  = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/config");
        if (!dir.exists()) dir.mkdirs();
        FileLib.write("Morgen/config", "recent.json", JSON.stringify(recentItems));
    } catch (_) {}
}

function loadRecent() {
    try {
        var raw = FileLib.read("Morgen/config", "recent.json");
        if (raw) recentItems = JSON.parse(raw);
    } catch (_) {}
}
loadRecent();

// ─── Folder helpers ───────────────────────────────────────────

function openImportsFolder() {
    try {
        const base       = new java.io.File(".").getCanonicalPath();
        const importsDir = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports");
        if (!importsDir.exists()) importsDir.mkdirs();
        java.awt.Desktop.getDesktop().open(importsDir);
        msg("&aOpened imports folder.");
    } catch (e) { msg("&cCould not open folder: " + e); }
}

function ensureDir(dir) {
    try {
        const base      = new java.io.File(".").getCanonicalPath();
        const targetDir = new java.io.File(base + "/config/ChatTriggers/modules/" + dir);
        if (!targetDir.exists()) targetDir.mkdirs();
    } catch (_) {}
}

function resolvePath(pathArg) {
    // FIX: CT FileLib bug — always ensure a proper subdirectory exists
    // to prevent the "rf" prefix on filenames.
    var clean = ("" + pathArg).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    var parts = clean.split("/").filter(function(p) { return p.length > 0; });
    if (parts.length === 0) parts = ["items"];
    var fileName = parts.pop();
    var subPath  = parts.length > 0 ? parts.join("/") : "";
    var dir  = subPath.length > 0
        ? "Morgen/imports/" + subPath
        : "Morgen/imports";
    var file = fileName + ".mig";
    return { dir: dir, file: file, display: pathArg + ".mig" };
}

// ─── /mm command ─────────────────────────────────────────────

register("command", function() {
    var args   = Array.prototype.slice.call(arguments);
    var action = (args[0] || "").toLowerCase();

    // ── import (was /mg) ─────────────────────────────────────
    if (action === "import") {
        if (!args[1]) { msg("&cUsage: &f/mm import &e[folder/]name"); return; }
        args.shift();
        ChatLib.command("mmimport " + args.join(" "), true);
        return;
    }


    if (action === "chestexport") { handleChestExport(); return; } 

    // ── export ────────────────────────────────────────────────
    if (action === "export") {
        if (!args[1]) { msg("&cUsage: &f/mm export &e[folder/]name"); return; }
        exportItem(args[1]);
        return;
    }

    // ── info ──────────────────────────────────────────────────
    if (action === "info") {
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        const tag  = (item.getNBT().toObject().tag) || {};
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        msg("&6&lItem Info &8— &7" + item.getName());
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        msg("  &7ID      &e" + item.getRegistryName());
        msg("  &7Damage  &e" + (item.getMetadata ? item.getMetadata() : 0));
        msg("  &7Stack   &e" + item.getStackSize());
        if (tag.HideFlags !== undefined) msg("  &7Flags   &e" + tag.HideFlags + " &8(" + decodeHideFlags(tag.HideFlags) + ")");
        if (tag.Unbreakable) msg("  &7Unbreak &atrue");
        if (tag.ench) msg("  &7Enchs   &d" + tag.ench.map(e => enchName(e.id) + " " + e.lvl).join(", "));
        const lore = cleanLore(item.getLore()).slice(1);
        if (lore.length) {
            msg("  &7Lore:");
            lore.forEach(l => ChatLib.chat(ChatLib.addColor("    &8| &7" + l)));
        }
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        msg("  &7by &7[&bITV&7] &8& &6MorgenBinIchRich");
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        return;
    }

    // ── nbt ───────────────────────────────────────────────────
    if (action === "nbt") {
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        const raw = item.getNBT ? item.getNBT().toString() : "{}";
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        msg("&6&lRaw NBT &8— &7" + item.getName());
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        for (let i = 0; i < raw.length; i += 200) ChatLib.chat("&f" + raw.slice(i, i + 200));
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        return;
    }

    // ── copy ──────────────────────────────────────────────────
    if (action === "copy") {
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        const rawLore = cleanLore(item.getLore()).slice(1);
        if (rawLore.length === 0) { msg("&cThis item has no lore."); return; }
        loreClipboard = rawLore;
        msg("&aCopied &e" + rawLore.length + " &alore line" + (rawLore.length !== 1 ? "s" : "") + ".");
        rawLore.forEach(function(l, i) {
            ChatLib.chat(ChatLib.addColor("  &8" + (i + 1) + ". &7" + l));
        });
        return;
    }

    // ── paste ─────────────────────────────────────────────────
    if (action === "paste") {
        if (!loreClipboard || loreClipboard.length === 0) {
            msg("&cClipboard empty — use &f/mm copy &cfirst."); return;
        }
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        if (!requireCreative()) return;
        snapshotHeld("paste-lore");
        pasteLoreOnto(item, loreClipboard);
        msg("&aPasted &e" + loreClipboard.length + " &alore line" + (loreClipboard.length !== 1 ? "s" : "") + " onto &f" + item.getName() + "&a.");
        return;
    }

    // ── inventory ─────────────────────────────────────────────
    if (action === "inventory") {
        exportInventory();
        return;
    }

    // ── recent ────────────────────────────────────────────────
    if (action === "recent") {
        if (recentItems.length === 0) { msg("&7No recent imports yet."); return; }
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        msg("&6&lRecent Imports");
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        recentItems.forEach(function(r, idx) {
            var timeStr = timeSince(r.time);
            var clickable = new TextComponent(ChatLib.addColor(
                "  &7" + (idx + 1) + ". &f" + r.name + " &8— &7" + r.path + " &8(" + timeStr + ") &e[Import]"
            ));
            clickable.setClick("run_command", "/mm import " + r.path);
            clickable.setHover("show_text", ChatLib.addColor("&eClick to import: &f" + r.path));
            ChatLib.chat(new Message(clickable));
        });
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
        return;
    }

    // ── compare ───────────────────────────────────────────────
    if (action === "compare") {
        compareHeldItems();
        return;
    }

    // ── rename ────────────────────────────────────────────────
    if (action === "rename") {
        if (!args[1]) { msg("&cUsage: &f/mm rename &e<new name>"); return; }
        args.shift();
        var newName = args.join(" ");
        snapshotHeld("rename");
        renameHeldItem(newName);
        return;
    }

    // ── addlore ───────────────────────────────────────────────
    if (action === "addlore") {
        if (!args[1]) { msg("&cUsage: &f/mm addlore &e<line>"); return; }
        args.shift();
        snapshotHeld("addlore");
        addLoreToHeld(args.join(" "));
        return;
    }

    // ── clearlore ─────────────────────────────────────────────
    if (action === "clearlore") {
        snapshotHeld("clearlore");
        clearLoreOnHeld();
        return;
    }

    // ── dupe ──────────────────────────────────────────────────
    if (action === "dupe") {
        dupeHeldItem(parseInt(args[1]) || 1);
        return;
    }


    // ── tojson ────────────────────────────────────────────────
    // Converts a .mig file to a .json (NBT snapshot of held item saved from the file)
    // Usage: /mm tojson <path>   (reads the .mig, spawns it, user must then /mm savejson <path>)
    // Simpler approach: convert file content directly without spawning
    if (action === "tojson") {
        if (!args[1]) { msg("&cUsage: &f/mm tojson &e[folder/]name"); return; }
        args.shift();
        migToJson(args.join(" "));
        return;
    }

    // ── tomig ─────────────────────────────────────────────────
    // Converts a .json file back to a .mig file
    if (action === "tomig") {
        if (!args[1]) { msg("&cUsage: &f/mm tomig &e[folder/]name"); return; }
        args.shift();
        jsonToMig(args.join(" "));
        return;
    }

    // ── ai ────────────────────────────────────────────────────
    if (action === "ai") {
        args.shift();
        handleAiCommand(args);
        return;
    }

    // ── invgui ───────────────────────────────────────────────
    // FIX: scheduleTask delays open 1 tick — prevents Minecraft chat-GUI conflict
    if (action === "invgui") {
        Client.scheduleTask(function() { openInventoryGui(); });
        return;
    }

    // ── symbols ───────────────────────────────────────────────
    if (action === "symbols" || action === "sym") {
        Client.scheduleTask(function() { openSymbolPicker(); });
        return;
    }

    // ── edit ──────────────────────────────────────────────────
    if (action === "edit") {
        Client.scheduleTask(function() { openEditGui(); });
        return;
    }

    // ── undo ──────────────────────────────────────────────────
    if (action === "undo") {
        var undoSub = (args[1] || "").toLowerCase();
        if (undoSub === "list" || undoSub === "history") { listHistory(msg); return; }
        undoLast(msg);
        return;
    }

    // ── validate ──────────────────────────────────────────────
    if (action === "validate" || action === "check") {
        if (!args[1]) { msg("&cUsage: &f/mm validate &e[folder/]name"); return; }
        args.shift();
        validateAndReport(args.join(" "), msg);
        return;
    }

    // ── preview ──────────────────────────────────────────────
    if (action === "preview") {
        if ((args[1]||"").toLowerCase() === "drag") { openPreviewDrag(); return; }
        togglePreview();
        return;
    }

    // ── qs (quick spawn) ─────────────────────────────────────
    if (action === "qs") {
        args.shift();
        handleQsCommand(args);
        return;
    }

    // ── gui ───────────────────────────────────────────────────
    if (action === "gui") {
        openMigBrowser();
        return;
    }

    // ── open ──────────────────────────────────────────────────
    if (action === "open") {
        openImportsFolder();
        return;
    }

    // ── settings ──────────────────────────────────────────────
    if (action === "settings") {
        Settings.openGUI();
        return;
    }

    // ── help ──────────────────────────────────────────────────
    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));;
    msg("  &6&l✦ Morgen &8— &7by &7[&bITV&7] &8& &6MorgenBinIchRich");
    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));;
    msg("  &e/mm import  &7<n>   &8— &fspawn item from .mig");
    msg("  &e/mm export  &7<n>   &8— &fexport held item to .mig");
    msg("  &e/mm gui            &8— &fopen file browser");
    msg("  &e/mm recent         &8— &fshow recently imported items");
    msg("  &e/mm inventory      &8— &fexport all inventory items");
    msg("  &e/mm copy           &8— &fcopy lore to clipboard");
    msg("  &e/mm paste          &8— &fpaste lore onto held item");
    msg("  &e/mm rename  &7<n>   &8— &frename held item");
    msg("  &e/mm addlore &7<l>   &8— &fadd a lore line to held item");
    msg("  &e/mm clearlore      &8— &fclear all lore from held item");
    msg("  &e/mm dupe    &7[n]   &8— &fduplicate held item n times");
    msg("  &e/mm ai      &7...   &8— &f&bAI &fnames &8+ &fset generator &8(&bGemini&8)");
    msg("  &e/mm edit            &8— &f&6★&f in-game item editor GUI");
    msg("  &e/mm invgui         &8— &fvisual inventory viewer");
    msg("  &e/mm symbols        &8— &f&6★&f symbol picker (copy special chars)");
    msg("  &e/mm validate &7<n>  &8— &f&6★&f validate .mig before import");
    msg("  &e/mm undo    &7[list] &8— &f&6★&f restore last item change");
    msg("  &e/mm qs      &7[1-9] &8— &fquick-spawn slots  &8(/mm qs for help)");
    msg("  &e/mm tojson  &7<n>   &8— &fconvert .mig to .json");
    msg("  &e/mm tomig   &7<n>   &8— &fconvert .json to .mig");
    msg("  &e/mm info           &8— &fdetailed item info");
    msg("  &e/mm nbt            &8— &fraw NBT dump");
    msg("  &e/mm open           &8— &fopen imports folder");
    msg("  &e/mm settings       &8— &fopen settings GUI");
    ChatLib.chat(ChatLib.addColor("&8&m════════════════════════════════"));;

}).setName("mm");

// ─── NBT paste helper ────────────────────────────────────────

function pasteLoreOnto(item, lore) {
    const C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
    const ItemStack = Java.type("net.minecraft.item.ItemStack");
    const JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
    const ItemReg   = Java.type("net.minecraft.item.Item");

    const id     = item.getRegistryName();
    const count  = item.getStackSize() || 1;
    const damage = item.getMetadata ? item.getMetadata() : 0;
    const tag    = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    tag.display.Lore = lore.map(function(l) { return "" + l; });

    function buildNBT(obj) {
        if (obj === null || obj === undefined) return "{}";
        if (typeof obj === "boolean") return obj ? "1b" : "0b";
        if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
        if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
        return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
    }

    const nbtStr = buildNBT(tag);
    const tagNBT = JsonToNBT.func_180713_a(nbtStr);
    const mcItem = ItemReg.func_111206_d(id);
    const slot   = Player.getHeldItemIndex() + 36;
    const stack  = new ItemStack(mcItem, count, damage);
    stack.func_77982_d(tagNBT);
    Client.sendPacket(new C10Packet(slot, stack));
}

// ─── Rename held item ────────────────────────────────────────

function renameHeldItem(newName) {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    const tag = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    tag.display.Name = newName.replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aRenamed to &f" + newName);
}

// ─── Add lore line ───────────────────────────────────────────

function addLoreToHeld(line) {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    const tag = (item.getNBT().toObject().tag) || {};
    if (!tag.display) tag.display = {};
    if (!tag.display.Lore) tag.display.Lore = [];
    tag.display.Lore.push(line.replace(/&([0-9a-fk-or])/gi, "\u00a7$1"));
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aAdded lore line &7\"&f" + line + "&7\"");
}

// ─── Clear lore ───────────────────────────────────────────────

function clearLoreOnHeld() {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    const tag = (item.getNBT().toObject().tag) || {};
    if (tag.display) tag.display.Lore = [];
    rebuildItem(item, tag, Player.getHeldItemIndex() + 36);
    msg("&aCleared lore from &f" + item.getName());
}

// ─── Dupe held item ──────────────────────────────────────────

function dupeHeldItem(times) {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!requireCreative()) return;
    times = Math.max(1, Math.min(times, 36));
    const nbtStr = item.getNBT().toString();
    const tag    = (item.getNBT().toObject().tag) || {};

    const C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
    const ItemStack = Java.type("net.minecraft.item.ItemStack");
    const JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
    const ItemReg   = Java.type("net.minecraft.item.Item");

    const mcItem = ItemReg.func_111206_d(item.getRegistryName());
    let placed = 0;

    const inv = Player.getInventory();
    for (let s = 9; s <= 44 && placed < times; s++) {
        try {
            const slot = inv.getStackInSlot(s);
            if (slot && slot.getID() !== 0) continue;
            const stack = new ItemStack(mcItem, item.getStackSize(), item.getMetadata ? item.getMetadata() : 0);
            if (nbtStr && nbtStr !== "{}") {
                const tagNBT = JsonToNBT.func_180713_a(nbtStr.replace(/^1s:/, ""));
                if (tag && Object.keys(tag).length > 0) {
                    function buildNBT(obj) {
                        if (obj === null || obj === undefined) return "{}";
                        if (typeof obj === "boolean") return obj ? "1b" : "0b";
                        if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
                        if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
                        if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
                        return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
                    }
                    stack.func_77982_d(JsonToNBT.func_180713_a(buildNBT(tag)));
                }
            }
            Client.sendPacket(new C10Packet(s, stack));
            placed++;
            if (Settings.batchDelay) {
                const delay = placed; // closure capture
                setTimeout(function() {}, 50 * delay);
            }
        } catch (e) { console.log("[dupe] slot " + s + ": " + e); }
    }
    msg("&aDuped &e" + placed + "&a copy" + (placed !== 1 ? "ies" : "y") + " of &f" + item.getName());
}

// ─── Compare two items ────────────────────────────────────────

var compareSlot1 = null;

function compareHeldItems() {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    if (!compareSlot1) {
        compareSlot1 = item;
        msg("&aItem 1 saved: &f" + item.getName() + " &7— now hold item 2 and run &f/mm compare &7again.");
        return;
    }
    const a = compareSlot1;
    const b = item;
    compareSlot1 = null;

    const aTag = (a.getNBT().toObject().tag) || {};
    const bTag = (b.getNBT().toObject().tag) || {};

    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));;
    msg("  &6&l⚖ Item Compare");
    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));;
    msg("  &7A: &f" + a.getName() + "  &8vs  &7B: &f" + b.getName());
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
    printCompareRow("ID",       a.getRegistryName(), b.getRegistryName());
    printCompareRow("Damage",   a.getMetadata ? a.getMetadata() : 0, b.getMetadata ? b.getMetadata() : 0);
    printCompareRow("Stack",    a.getStackSize(), b.getStackSize());
    printCompareRow("Unbreak",  !!aTag.Unbreakable, !!bTag.Unbreakable);
    printCompareRow("HideFlags",aTag.HideFlags || 0, bTag.HideFlags || 0);
    printCompareRow("Glow",
        !!(aTag.ench && aTag.ench.some(e => e.id === 0 && e.lvl === 1)),
        !!(bTag.ench && bTag.ench.some(e => e.id === 0 && e.lvl === 1)));

    // Lore diff
    const aLore = cleanLore(a.getLore()).slice(1);
    const bLore = cleanLore(b.getLore()).slice(1);
    if (aLore.length !== bLore.length || aLore.join("|") !== bLore.join("|")) {
        msg("  &7Lore &8A: &f" + aLore.length + " lines  &8B: &f" + bLore.length + " lines &c(differs)");
    } else {
        msg("  &7Lore &8— &asame (" + aLore.length + " lines)");
    }
    ChatLib.chat(ChatLib.addColor("&8&m══════════════════════════════"));;
}

function printCompareRow(label, a, b) {
    var same = String(a) === String(b);
    var col  = same ? "&a" : "&e";
    msg("  &7" + label.padEnd(9) + " &8A:&f" + a + "  &8B:" + col + b + (same ? "" : " &c◄"));
}

// ─── Rebuild item (generic helper) ────────────────────────────

function rebuildItem(item, tag, slot) {
    const C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
    const ItemStack = Java.type("net.minecraft.item.ItemStack");
    const JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
    const ItemReg   = Java.type("net.minecraft.item.Item");

    function buildNBT(obj) {
        if (obj === null || obj === undefined) return "{}";
        if (typeof obj === "boolean") return obj ? "1b" : "0b";
        if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
        if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
        return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
    }

    const mcItem = ItemReg.func_111206_d(item.getRegistryName());
    const stack  = new ItemStack(mcItem, item.getStackSize() || 1, item.getMetadata ? item.getMetadata() : 0);
    stack.func_77982_d(JsonToNBT.func_180713_a(buildNBT(tag)));
    Client.sendPacket(new C10Packet(slot, stack));
}

// ─── Export single item ───────────────────────────────────────

function exportItem(pathArg) {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
    const mig = buildMigString(item);
    if (!mig) return;
    const { dir, file, display } = resolvePath(pathArg);
    try {
        ensureDir(dir);
        FileLib.write(dir, file, mig);
        msg("&aExported &f" + item.getName() + " &ato &e" + display);
        msg("  &7Import with: &f/mm import &e" + pathArg);
        if (Settings.autoOpenAfterExport) openImportsFolder();
    } catch (e) { msg("&cWrite failed: " + e); }
}

// ─── Export inventory ────────────────────────────────────────

function exportInventory() {
    if (!requireCreative()) return;
    const inv = Player.getInventory();
    if (!inv) { msg("&cNo inventory found."); return; }

    const now    = new Date();
    const pad    = function(n) { return ("" + n).length < 2 ? "0" + n : "" + n; };
    const stamp  = now.getFullYear() + "-" + pad(now.getMonth()+1) + "-" + pad(now.getDate())
                 + "_" + pad(now.getHours()) + "-" + pad(now.getMinutes());
    const folder = "inventory/" + stamp;
    const base   = "Morgen/imports/" + folder;
    ensureDir(base);

    let exported = 0, skipped = 0;
    for (let i = 0; i <= 39; i++) {
        let item;
        try { item = inv.getStackInSlot(i); } catch (_) { continue; }
        if (!item || item.getID() === 0) { skipped++; continue; }
        const name  = stripColor(item.getName()).replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 32) || "item";
        const file  = "slot_" + pad(i) + "_" + name + ".mig";
        const mig   = buildMigString(item);
        if (!mig) { skipped++; continue; }
        try { FileLib.write(base, file, mig); exported++; } catch (_) { skipped++; }
    }

    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
    msg("&6&lInventory Export");
    msg("  &7Folder   &e" + folder);
    msg("  &7Exported &a" + exported + " &7items");
    if (skipped > 0) msg("  &7Skipped  &8" + skipped + " &7empty slots");
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));;
    if (Settings.autoOpenAfterExport) openImportsFolder();
}

// ─── Build .mig string ────────────────────────────────────────

function buildMigString(item) {
    try {
        const tag      = (item.getNBT().toObject().tag) || {};
        const dispTag  = tag.display || {};
        const isLeather = item.getRegistryName().toLowerCase().includes("leather");
        const isSkull  = item.getRegistryName().toLowerCase().includes("skull");
        const isUnbreak = tag.Unbreakable === 1;
        const hasGlow  = !!(tag.ench && tag.ench.some(e => e.id === 0 && e.lvl === 1));
        const hideFlags = tag.HideFlags !== undefined ? tag.HideFlags : Settings.defaultHideFlags;
        const cc       = Settings.colorChar;

        let loreLines = cleanLore(item.getLore());
        if (loreLines.length > 0 &&
            stripColor(loreLines[0]).trim() === stripColor(item.getName()).trim()) {
            loreLines = loreLines.slice(1);
        }
        loreLines = loreLines.map(l =>
            Settings.stripColorOnExport ? stripColor(l) : l.replace(/\u00a7/g, cc)
        );

        let enchantStr = null;
        if (Settings.exportEnchants && tag.ench) {
            const real = tag.ench.filter(e => !(e.id === 0 && e.lvl === 1));
            if (real.length > 0) enchantStr = JSON.stringify(real.map(e => ({ id: e.id, lvl: e.lvl })));
        }

        let textureValue = null;
        if (Settings.exportSkullTexture && isSkull) {
            try { textureValue = tag.SkullOwner.Properties.textures[0].Value; } catch (_) {}
        }

        const exportName = item.getName().replace(/\u00a7/g, cc);
        const fmt     = Settings.loreFormatStr;
        const nameFmt = Settings.nameFormatStr;

        let mig = 'ITEM "' + item.getRegistryName() + '" {\n\n';
        mig += nameFmt === "list"
            ? '    Name: list("' + exportName + '")\n'
            : '    Name: "' + exportName + '"\n';
        mig += "    Amount: 1\n";
        mig += "    Count: " + (item.getStackSize() || 1) + "\n\n";
        mig += "    Damage: " + (item.getMetadata ? item.getMetadata() : 0) + "\n";
        mig += "    Unbreakable: " + isUnbreak + "\n";
        mig += "    Glow: " + hasGlow + "\n";
        mig += "    HideFlags: " + hideFlags + "  # " + decodeHideFlags(hideFlags) + "\n";
        if (isLeather && dispTag.color !== undefined) mig += '    Hex: "' + decToHex(dispTag.color) + '"\n';
        if (isSkull && textureValue)                  mig += '    Texture: "' + textureValue + '"\n';
        mig += tag.ItemModel ? '    ItemModel: "' + tag.ItemModel + '"\n' : '    # ItemModel: "none"\n';
        if (enchantStr) mig += "    Enchants: " + enchantStr + "\n";
        mig += "\n";
        if (Settings.addStatsPlaceholder) {
            mig += "    Stats {\n        # damage: static(10)\n        # speed:  linear(1, 0.5)\n    }\n\n";
        }
        if (fmt === "list") {
            mig += "    Lore: [list(\n";
            loreLines.forEach((line, idx) => {
                mig += '        "' + line.replace(/"/g, '\\"') + '"' + (idx < loreLines.length - 1 ? "," : "") + "\n";
            });
            mig += "    )]\n\n";
        } else {
            mig += "    Lore: [\n";
            loreLines.forEach(line => { mig += '        "' + line.replace(/"/g, '\\"') + '"\n'; });
            mig += "    ]\n\n";
        }
        mig += "}\n";
        return mig;
    } catch (e) {
        msg("&cBuild failed: " + e);
        console.log("[mm export] " + e);
        return null;
    }
}


// ─── .mig → .json conversion ─────────────────────────────────
// Reads the .mig, extracts Name/ID/Lore/NBT fields and writes a JSON
// with the raw NBT string. Since we can't actually execute the .mig
// parser here, we parse the key fields manually and build the NBT.

function migToJson(pathArg) {
    var migPath = pathArg.replace(/\.mig$/, "");
    var parts   = migPath.replace(/\\/g, "/").split("/");
    var file    = parts.pop();
    var dir     = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    var raw;
    try {
        raw = FileLib.read(dir, file + ".mig");
    } catch (e) { msg("&cCould not read: &e" + migPath + ".mig"); return; }
    if (!raw) { msg("&cFile not found: &e" + migPath + ".mig"); return; }

    // Extract key fields from .mig
    var idMatch    = raw.match(/ITEM\s+"([^"]+)"/);
    var nameMatch  = raw.match(/Name:\s*(?:list\()?["']([^"']+)["']/);
    var damageMatch = raw.match(/Damage:\s*(\d+)/);
    var countMatch  = raw.match(/Count:\s*(\d+)/);
    var texMatch    = raw.match(/Texture:\s*"([^"]+)"/);
    var hexMatch    = raw.match(/Hex:\s*"([^"]+)"/);
    var unbreakMatch = raw.match(/Unbreakable:\s*(true|false)/);
    var hideMatch   = raw.match(/HideFlags:\s*(\d+)/);
    var glowMatch   = raw.match(/Glow:\s*(true|false)/);

    if (!idMatch) { msg("&cCould not parse ITEM id from &e" + migPath + ".mig"); return; }

    var id      = idMatch[1];
    var name    = nameMatch ? nameMatch[1] : "";
    var damage  = damageMatch ? parseInt(damageMatch[1]) : 0;
    var count   = countMatch  ? parseInt(countMatch[1])  : 1;
    var texture = texMatch    ? texMatch[1]               : null;
    var hex     = hexMatch    ? hexMatch[1]               : null;
    var unbreak = unbreakMatch ? unbreakMatch[1] === "true" : false;
    var hf      = hideMatch   ? parseInt(hideMatch[1])   : 0;
    var glow    = glowMatch   ? glowMatch[1] === "true"  : false;

    // Parse lore block
    var loreLines = [];
    var loreBlock = raw.match(/Lore:\s*\[(?:list\()?([\s\S]*?)(?:\))?\]/);
    if (loreBlock) {
        var loreRaw = loreBlock[1];
        var loreMatches = loreRaw.match(/"((?:[^"\\]|\\.)*)"/g);
        if (loreMatches) {
            loreLines = loreMatches.map(function(s) {
                return s.slice(1, -1).replace(/\\"/g, '"').replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
            });
        }
    }

    // Build NBT tag object
    var tagObj = {};
    var display = {};
    if (name)           display.Name = name.replace(/&([0-9a-fk-or])/gi, "\u00a7$1");
    if (loreLines.length) display.Lore = loreLines;
    if (hex) {
        var hexInt = parseInt(hex.replace("#",""), 16);
        display.color = hexInt;
    }
    if (Object.keys(display).length) tagObj.display = display;
    if (unbreak)  tagObj.Unbreakable = 1;
    if (hf > 0)   tagObj.HideFlags   = hf;
    if (glow)     tagObj.ench         = [{id:0, lvl:1}];
    if (texture) {
        tagObj.SkullOwner = {
            Id: "00000000-0000-0000-0000-000000000000",
            Properties: { textures: [{ Value: texture }] }
        };
    }

    function buildNBT(obj) {
        if (obj === null || obj === undefined) return "{}";
        if (typeof obj === "boolean") return obj ? "1b" : "0b";
        if (typeof obj === "number")  return Number.isInteger(obj) ? String(obj) : obj.toFixed(4) + "f";
        if (typeof obj === "string")  return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        if (Array.isArray(obj))       return "[" + obj.map(buildNBT).join(",") + "]";
        return "{" + Object.keys(obj).map(function(k) { return k + ":" + buildNBT(obj[k]); }).join(",") + "}";
    }

    var nbtStr = '{id:"' + id + '",Count:' + count + 'b,tag:' + buildNBT(tagObj) + ',Damage:' + damage + 's}';
    var json   = JSON.stringify({ item: nbtStr.replace(/"/g, '\\"').replace(/^"|"$/g, "") }, null, 2);
    // Actually build the json correctly
    var jsonOut = '{"item": "' + nbtStr.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"}';

    try {
        ensureDir(dir);
        FileLib.write(dir, file + ".json", jsonOut);
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("&a.mig converted to .json");
        msg("  &7Source: &e" + migPath + ".mig");
        msg("  &7Output: &e" + migPath + ".json");
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    } catch (e) { msg("&cWrite failed: " + e); }
}

// ─── .json → .mig conversion ─────────────────────────────────

function jsonToMig(pathArg) {
    var jsonPath = pathArg.replace(/\.json$/, "");
    var parts    = jsonPath.replace(/\\/g, "/").split("/");
    var file     = parts.pop();
    var dir      = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    var raw;
    try {
        raw = FileLib.read(dir, file + ".json");
    } catch (e) { msg("&cCould not read: &e" + jsonPath + ".json"); return; }
    if (!raw) { msg("&cFile not found: &e" + jsonPath + ".json"); return; }

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { msg("&cInvalid JSON: " + e); return; }
    var nbtStr = parsed.item;
    if (!nbtStr) { msg("&cNo item key in JSON."); return; }

    // Parse NBT string for fields
    var idM    = nbtStr.match(/id:\"([^"\\]+)\"/);
    if (!idM) idM = nbtStr.match(/id:"([^"]+)"/);
    var countM = nbtStr.match(/Count:(\d+)/);
    var damM   = nbtStr.match(/Damage:(\d+)/);
    var nameM  = nbtStr.match(/Name:\"([^"\\]*)\"/);
    if (!nameM) nameM = nbtStr.match(/Name:"([^"]*)"/);
    var texM   = nbtStr.match(/Value:\"([^"\\]{10,})\"/);
    if (!texM)  texM  = nbtStr.match(/Value:"([^"]{10,})"/);
    var hfM    = nbtStr.match(/HideFlags:(\d+)/);
    var colM   = nbtStr.match(/color:(\d+)/);

    var id      = idM    ? idM[1]              : "minecraft:stone";
    var count   = countM ? parseInt(countM[1]) : 1;
    var damage  = damM   ? parseInt(damM[1])   : 0;
    var name    = nameM  ? nameM[1].replace(/\u00a7/g, "&").replace(/\\u00a7/g, "&") : id;
    var texture = texM   ? texM[1]             : null;
    var hf      = hfM    ? parseInt(hfM[1])    : 63;
    var hex     = null;
    if (colM) {
        var colInt = parseInt(colM[1]);
        hex = "#" + colInt.toString(16).toUpperCase().padStart(6, "0");
    }

    // Parse lore
    var loreLines = [];
    var loreM = nbtStr.match(/Lore:\[([^\]]*)\]/);
    if (loreM) {
        var lRaw = loreM[1];
        var lMatches = lRaw.match(/\d+:\"((?:[^"\\]|\\.)*?)\"/g);
        if (!lMatches) lMatches = lRaw.match(/\d+:"((?:[^"\\]|\\.)*?)"/g);
        if (lMatches) {
            loreLines = lMatches.map(function(s) {
                return s.replace(/^\d+:\"?|\?"?$/g, "")
                        .replace(/\\u00a7/g, "&")
                        .replace(/\u00a7/g, "&");
            });
        }
    }

    var isLeather = id.toLowerCase().includes("leather");
    var isSkull   = id.toLowerCase().includes("skull");
    var cc = Settings.colorChar;

    var mig = 'ITEM "' + id + '" {\n\n';
    mig += '    Name: "' + name.replace(/\u00a7|§/g, cc) + '"\n';
    mig += "    Amount: 1\n";
    mig += "    Count: " + count + "\n\n";
    mig += "    Damage: " + damage + "\n";
    mig += "    Unbreakable: false\n";
    mig += "    Glow: false\n";
    mig += "    HideFlags: " + hf + "\n";
    if (isLeather && hex)    mig += '    Hex: "' + hex + '"\n';
    if (isSkull && texture)  mig += '    Texture: "' + texture + '"\n';
    mig += "\n";
    mig += "    Lore: [\n";
    loreLines.forEach(function(l) {
        mig += '        "' + l.replace(/"/g, '\\"') + '"\n';
    });
    mig += "    ]\n\n}\n";

    try {
        ensureDir(dir);
        FileLib.write(dir, file + ".mig", mig);
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
        msg("&a.json converted to .mig");
        msg("  &7Source: &e" + jsonPath + ".json");
        msg("  &7Output: &e" + jsonPath + ".mig");
        msg("  &7Import: &f/mm import &e" + jsonPath);
        ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    } catch (e) { msg("&cWrite failed: " + e); }
}

// ─── Helpers ──────────────────────────────────────────────────

function timeSince(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    return Math.floor(s / 3600) + "h ago";
}

export function trackRecent(name, path) {
    pushRecent(name, path);
}