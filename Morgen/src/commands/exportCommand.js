// ============================================================
//  Morgen — exportCommand.js   (/mm)
//  Usage:
//    /mm export [folder/]name
//    /mm info
//    /mm nbt
//    /mm open
//    /mm settings   → opens Vigilance GUI
// ============================================================

import { decToHex, cleanLore, stripColor, msg } from "../../utils/utils";
import { openMigBrowser } from "../../gui/MigBrowserGUI";
import Settings from "../../utils/config";

// ─── HideFlags ────────────────────────────────────────────────

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

// ─── Ench names ───────────────────────────────────────────────

const ENCH_NAMES = {
    0:"Protection",1:"Fire Protection",2:"Feather Falling",3:"Blast Protection",
    4:"Projectile Prot.",5:"Respiration",6:"Aqua Affinity",7:"Thorns",16:"Sharpness",
    17:"Smite",18:"Bane of Arthropods",19:"Knockback",20:"Fire Aspect",21:"Looting",
    32:"Efficiency",33:"Silk Touch",34:"Unbreaking",35:"Fortune",48:"Power",
    49:"Punch",50:"Flame",51:"Infinity",61:"Luck of the Sea",62:"Lure"
};
function enchName(id) { return ENCH_NAMES[id] || "ench_" + id; }

// ─── Open folder ──────────────────────────────────────────────

function openImportsFolder() {
    try {
        const base       = new java.io.File(".").getCanonicalPath();
        const importsDir = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports");
        if (!importsDir.exists()) importsDir.mkdirs();
        java.awt.Desktop.getDesktop().open(importsDir);
        msg("&aOpened imports folder.");
    } catch (e) {
        msg("&cCould not open folder: " + e);
    }
}

// ─── Path resolver ────────────────────────────────────────────

function resolvePath(pathArg) {
    const parts = pathArg.replace(/\\/g, "/").split("/");
    const file  = parts.pop() + ".mig";
    const dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    return { dir, file, display: pathArg + ".mig" };
}

// ─── /mm command ─────────────────────────────────────────────

register("command", function() {
    var args = Array.prototype.slice.call(arguments);
    const action = (args[0] || "").toLowerCase();

    if (action === "info") {
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        const tag = (item.getNBT().toObject().tag) || {};
        msg("&8&m─────────────────────────────");
        msg("&6Name:    &f" + item.getName());
        msg("&6ID:      &e" + item.getRegistryName());
        msg("&6Damage:  &e" + (item.getMetadata ? item.getMetadata() : 0));
        msg("&6Stack:   &e" + item.getStackSize());
        if (tag.HideFlags !== undefined) msg("&6Flags:   &7" + decodeHideFlags(tag.HideFlags) + " &8(" + tag.HideFlags + ")");
        if (tag.Unbreakable) msg("&6Unbreak: &atrue");
        if (tag.ench) msg("&6Enchs:   &d" + tag.ench.map(e => enchName(e.id) + " " + e.lvl).join(", "));
        const lore = cleanLore(item.getLore()).slice(1);
        if (lore.length) { msg("&6Lore:"); lore.forEach(l => ChatLib.chat("  &7" + l)); }
        msg("&8&m─────────────────────────────");
        return;
    }

    if (action === "nbt") {
        const item = Player.getHeldItem();
        if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }
        const raw = item.getNBT ? item.getNBT().toString() : "{}";
        msg("&7Raw NBT:");
        for (let i = 0; i < raw.length; i += 200) ChatLib.chat("&f" + raw.slice(i, i + 200));
        return;
    }

    if (action === "export") {
        if (!args[1]) { msg("&cUsage: &f/mm export &e[folder/]name"); return; }
        exportItem(args[1]);
        return;
    }

    if (action === "gui") {
        openMigBrowser();
        return;
    }

    if (action === "open") {
        openImportsFolder();
        return;
    }

    // /mm settings — open Vigilance GUI
    if (action === "settings") {
        Settings.openGUI();
        return;
    }

    // Help
    msg("&8&m══════════════════════════════");
    msg("&6&lMorgen &8— &7/mm commands");
    msg("  &f/mm export &e[folder/]name  &7export held item");
    msg("  &f/mm info                   &7item details");
    msg("  &f/mm nbt                    &7raw NBT dump");
    msg("  &f/mm open                   &7open imports folder");
    msg("  &f/mm gui                    &7open .mig file browser");
    msg("  &f/mm settings               &7open settings GUI");
    msg("&8&m══════════════════════════════");

}).setName("mm");

// ─── Export logic ─────────────────────────────────────────────

function exportItem(pathArg) {
    const item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item!"); return; }

    const { dir, file, display } = resolvePath(pathArg);
    const nbt       = item.getNBT().toObject();
    const tag       = nbt.tag || {};
    const dispTag   = tag.display || {};
    const isLeather = item.getRegistryName().toLowerCase().includes("leather");
    const isSkull   = item.getRegistryName().toLowerCase().includes("skull");
    const isUnbreak = tag.Unbreakable === 1;
    const hasGlow   = !!(tag.ench && tag.ench.some(e => e.id === 0 && e.lvl === 1));
    const hideFlags = tag.HideFlags !== undefined ? tag.HideFlags : Settings.defaultHideFlags;
    const cc        = Settings.colorChar; // & or §

    // Lore
    let loreLines = cleanLore(item.getLore());
    if (loreLines.length > 0 &&
        stripColor(loreLines[0]).trim() === stripColor(item.getName()).trim()) {
        loreLines = loreLines.slice(1);
    }
    loreLines = loreLines.map(l =>
        Settings.stripColorOnExport ? stripColor(l) : l.replace(/§/g, cc)
    );

    // Enchants
    let enchantStr = null;
    if (Settings.exportEnchants && tag.ench) {
        const real = tag.ench.filter(e => !(e.id === 0 && e.lvl === 1));
        if (real.length > 0) enchantStr = JSON.stringify(real.map(e => ({ id: e.id, lvl: e.lvl })));
    }

    // Skull texture
    let textureValue = null;
    if (Settings.exportSkullTexture) {
        try { textureValue = tag.SkullOwner.Properties.textures[0].Value; } catch (_) {}
    }

    const exportName = item.getName().replace(/§/g, cc);
    const fmt = Settings.loreFormatStr;
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
    if (isSkull && textureValue)                   mig += '    Texture: "' + textureValue + '"\n';

    if (tag.ItemModel) mig += '    ItemModel: "' + tag.ItemModel + '"\n';
    else               mig += '    # ItemModel: "none"\n';

    if (enchantStr) mig += "    Enchants: " + enchantStr + "\n";

    mig += "\n";

    if (Settings.addStatsPlaceholder) {
        mig += "    Stats {\n";
        mig += "        # damage: static(10)\n";
        mig += "        # speed:  linear(1, 0.5)\n";
        mig += "    }\n\n";
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

    try {
        // Ensure the directory exists — FileLib.write won't create missing folders
        var base       = new java.io.File(".").getCanonicalPath();
        var moduleBase = base + "/config/ChatTriggers/modules/";
        var targetDir  = new java.io.File(moduleBase + dir);
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }
        FileLib.write(dir, file, mig);
        msg("&aExported to &e" + display);
        msg("&7Import with: &f/mg &e" + pathArg);
        if (Settings.autoOpenAfterExport) openImportsFolder();
    } catch (e) {
        msg("&cWrite failed: " + e);
    }
}