import {
    @Vigilant,
    @SwitchProperty,
    @SliderProperty,
    @TextProperty,
    @ButtonProperty
} from "Vigilance";

// FIX: Safe folder opener — java.awt.Desktop crashes on iOS/headless systems.
// Always check isDesktopSupported() before calling Desktop APIs.
function openImportsFolder() {
    try {
        const base       = new java.io.File(".").getCanonicalPath();
        const importsDir = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports");
        if (!importsDir.exists()) importsDir.mkdirs();
        if (java.awt.Desktop.isDesktopSupported()) {
            java.awt.Desktop.getDesktop().open(importsDir);
            ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &aOpened imports folder."));
        } else {
            ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &cCannot open folder: Desktop not supported on this system."));
        }
    } catch (e) {
        ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &cCould not open folder: " + e));
    }
}

@Vigilant("Morgen", "Morgen Settings", {
    getCategoryComparator: () => (a, b) => {
        const order = ["General", "Item Logic", "Formatting", "Export", "AI", "Advanced", "Credits"];
        const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
})
class Settings {
    constructor() {
        this.initialize(this);
    }

    @TextProperty({
        name: "Default Config File",
        description: "Used by /mmimport when no filename is given. Supports subfolders e.g. weapons/sword",
        category: "General",
        placeholder: "items"
    })
    defaultConfigFile = "items";

    @TextProperty({
        name: "Chat Prefix",
        description: "The prefix shown before all Morgen chat messages.",
        category: "General",
        placeholder: "&8[&6Morgen&8] &f"
    })
    chatPrefix = "&8[&6Morgen&8] &f";

    @SwitchProperty({
        name: "Save Search History",
        description: "Remember your last search in the .mig browser when reopening it.",
        category: "General"
    })
    saveSearchHistory = false;

    @ButtonProperty({
        name: "Open Imports Folder",
        description: "Opens the Morgen/imports directory in your file explorer.",
        category: "General",
        placeholder: "Open"
    })
    openFolder() {
        openImportsFolder();
    }

    @ButtonProperty({
        name: "Reload Settings",
        description: "Re-initializes settings from disk.",
        category: "General",
        placeholder: "Reload"
    })
    reloadSettings() {
        this.initialize(this);
        ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &aSettings reloaded."));
    }

    @SwitchProperty({
        name: "Smart HideFlags",
        description: "When Unbreakable is true, automatically set HideFlags bit 4 to hide the tag.",
        category: "Item Logic"
    })
    autoHideFlags = true;

    @SliderProperty({
        name: "Default HideFlags",
        description: "HideFlags applied when the .mig file does not specify one. 63 hides all.",
        category: "Item Logic",
        min: 1,
        max: 63
    })
    defaultHideFlags = 63;

    @SwitchProperty({
        name: "Auto-Glow",
        description: "Add fake enchantment glint to all spawned items by default.",
        category: "Item Logic"
    })
    defaultGlow = false;

    @SwitchProperty({
        name: "Auto Unbreakable",
        description: "Mark all spawned items as Unbreakable by default.",
        category: "Item Logic"
    })
    defaultUnbreakable = false;

    @SliderProperty({
        name: "Default Stack Size",
        description: "Default Count when not specified in the .mig file.",
        category: "Item Logic",
        min: 1,
        max: 64
    })
    defaultCount = 1;

    @SwitchProperty({
        name: "Spawn into Hotbar",
        description: "Place spawned items directly into your hotbar slots instead of the inventory.",
        category: "Item Logic"
    })
    spawnIntoHotbar = false;

    @SliderProperty({
        name: "Hotbar Slot",
        description: "Which hotbar slot to use when Spawn into Hotbar is enabled (1-9).",
        category: "Item Logic",
        min: 1,
        max: 9
    })
    hotbarSlot = 1;

    @SliderProperty({
        name: "Decimal Precision",
        description: "Decimal places for stat values.",
        category: "Formatting",
        min: 1,
        max: 4
    })
    decimalPlaces = 1;

    @SwitchProperty({
        name: "Strip Colour on Export",
        description: "Remove colour codes from lore lines when exporting.",
        category: "Formatting"
    })
    stripColorOnExport = false;

    @SwitchProperty({
        name: "Export All Button",
        description: "Show the Export All overlay button when a chest GUI is open.",
        category: "Export"
    })
    chestExportOverlay = true;

    @SwitchProperty({
        name: "Lore as list()",
        description: "ON = write lore as list(...). OFF = write one quoted line each.",
        category: "Export"
    })
    loreAsList = true;

    get loreFormatStr() { return this.loreAsList ? "list" : "lines"; }

    @SwitchProperty({
        name: "Name as list()",
        description: "ON = write name as list(...).",
        category: "Export"
    })
    nameAsList = true;

    get nameFormatStr() { return this.nameAsList ? "list" : "plain"; }

    @SwitchProperty({
        name: "Add Stats Placeholder",
        description: "Include a commented Stats block in exported files.",
        category: "Export"
    })
    addStatsPlaceholder = true;

    @SwitchProperty({
        name: "Auto-Open After Export",
        description: "Open the imports folder automatically after /mm export.",
        category: "Export"
    })
    autoOpenAfterExport = false;

    @SwitchProperty({
        name: "Export Enchantments",
        description: "Include real enchantments in the Enchants field when exporting.",
        category: "Export"
    })
    exportEnchants = true;

    @SwitchProperty({
        name: "Export Skull Texture",
        description: "Include the skull base64 texture when exporting skull items.",
        category: "Export"
    })
    exportSkullTexture = true;

    @TextProperty({
        name: "Gemini API Key",
        description: "Your Google Gemini API key. Get one free at https://aistudio.google.com",
        category: "AI",
        placeholder: "paste-your-key-here",
        protected: true
    })
    geminiApiKey = "";

    @TextProperty({
        name: "Gemini Model",
        description: "Which Gemini model to use.",
        category: "AI",
        placeholder: "gemini-2.5-flash-lite"
    })
    geminiModel = "gemini-2.5-flash-lite";

    @SliderProperty({
        name: "Default Name Count",
        description: "How many names /mm ai names generates when no amount is specified.",
        category: "AI",
        min: 1,
        max: 20
    })
    aiNameCount = 8;

    @SliderProperty({
        name: "Default Item Count",
        description: "How many items /mm ai mig generates when no amount is specified.",
        category: "AI",
        min: 1,
        max: 20
    })
    aiItemCount = 5;

    @SwitchProperty({
        name: "Debug Logging",
        description: "Print detailed debug info to the CT console during item creation.",
        category: "Advanced"
    })
    debugMode = false;

    @SwitchProperty({
        name: "Safe Mode",
        description: "Validate item IDs before sending the creative packet.",
        category: "Advanced"
    })
    safeMode = true;

    @SwitchProperty({
        name: "Batch Delay",
        description: "Add a small delay between items when batch-spawning.",
        category: "Advanced"
    })
    batchDelay = false;

    @TextProperty({
        name: "Mod",
        description: "Name and version of this module.",
        category: "Credits"
    })
    creditMod = "Morgen v1.0.0";

    @ButtonProperty({
        name: "Open GitHub",
        description: "View the source code and report issues on GitHub.",
        category: "Credits",
        placeholder: "Open"
    })
    openGithub() {
        // FIX: Safe Desktop browse — check support before calling
        try {
            if (java.awt.Desktop.isDesktopSupported()) {
                java.awt.Desktop.getDesktop().browse(new java.net.URI("https://github.com/morgenbinichrich/Morgen"));
            } else {
                ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &7GitHub: &fhttps://github.com/morgenbinichrich/Morgen"));
            }
        } catch(_) {
            ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &7GitHub: &fhttps://github.com/morgenbinichrich/Morgen"));
        }
    }

    @ButtonProperty({
        name: "Open Imports Folder",
        description: "Opens the Morgen/imports directory in your file explorer.",
        category: "Credits",
        placeholder: "Open"
    })
    openFolderCredits() {
        openImportsFolder();
    }
}

export default new Settings();