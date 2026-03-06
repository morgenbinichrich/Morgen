// ============================================================
//  Morgen — utils/config.js
//  Save this file as:  Morgen/utils/config.js
// ============================================================

import {
    @Vigilant,
    @SliderProperty,
    @SwitchProperty,
    @TextProperty,
    @ButtonProperty
} from "Vigilance";

function openImportsFolder() {
    try {
        const base       = new java.io.File(".").getCanonicalPath();
        const importsDir = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports");
        if (!importsDir.exists()) importsDir.mkdirs();
        java.awt.Desktop.getDesktop().open(importsDir);
        ChatLib.chat(ChatLib.addColor("&8[&6Morgen&8] &aOpened imports folder."));
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

    // ═══════════════════════════
    //  GENERAL
    // ═══════════════════════════

    @TextProperty({
        name: "Default Config File",
        description: "Used by /mg when no filename is given. Supports subfolders e.g. weapons/sword",
        category: "General",
        placeholder: "items"
    })
    defaultConfigFile = "items";

    @SwitchProperty({
        name: "Quiet Mode",
        description: "Suppress the item placed in slot message when spawning items.",
        category: "General"
    })
    quietMode = false;

    @TextProperty({
        name: "Chat Prefix",
        description: "The prefix shown before all Morgen chat messages.",
        category: "General",
        placeholder: "&8[&6Morgen&8] &f"
    })
    chatPrefix = "&8[&6Morgen&8] &f";

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

    // ═══════════════════════════
    //  ITEM LOGIC
    // ═══════════════════════════

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

    // ═══════════════════════════
    //  FORMATTING
    // ═══════════════════════════

    @SliderProperty({
        name: "Decimal Precision",
        description: "Decimal places for stat values. 1 = show 1.5, 2 = show 1.52 etc.",
        category: "Formatting",
        min: 1,
        max: 4
    })
    decimalPlaces = 1;

    @SwitchProperty({
        name: "Use & Colour Codes",
        description: "ON = use & codes in exported files. OFF = use section sign codes.",
        category: "Formatting"
    })
    useAmpersandCodes = true;

    get colorChar() { return this.useAmpersandCodes ? "&" : "\u00a7"; }

    @SwitchProperty({
        name: "Strip Colour on Export",
        description: "Remove colour codes from lore lines when exporting.",
        category: "Formatting"
    })
    stripColorOnExport = false;

    // ═══════════════════════════
    //  EXPORT
    // ═══════════════════════════

    @SwitchProperty({
        name: "Lore as list()",
        description: "ON = write lore as list(...). OFF = write one quoted line each.",
        category: "Export"
    })
    loreAsList = true;

    get loreFormatStr() { return this.loreAsList ? "list" : "lines"; }

    @SwitchProperty({
        name: "Name as list()",
        description: "ON = write name as list(...). Supports multiple names for batch items.",
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

    // ═══════════════════════════
    //  AI  (Google Gemini)
    // ═══════════════════════════

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
        description: "Which Gemini model to use. gemini-2.5-flash-lite | gemini-2.0-flash | gemini-1.5-pro",
        category: "AI",
        placeholder: "gemini-2.5-flash-lite"
    })
    geminiModel = "gemini-2.5-flash-lite";

    @SliderProperty({
        name: "Name Count",
        description: "How many item names to generate with /mm ai names.",
        category: "AI",
        min: 1,
        max: 20
    })
    aiNameCount = 8;

    @SliderProperty({
        name: "Item Count",
        description: "Default number of item tiers to generate with /mm ai set.",
        category: "AI",
        min: 1,
        max: 20
    })
    aiItemCount = 5;

    // ═══════════════════════════
    //  ADVANCED
    // ═══════════════════════════

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
        description: "Add a 1-tick delay between items when batch-spawning. Enable if items go missing.",
        category: "Advanced"
    })
    batchDelay = false;

    // ═══════════════════════════
    //  CREDITS
    // ═══════════════════════════

    @ButtonProperty({
        name: "About Morgen",
        description: "Morgen v1.0.0 — Custom item manager for ChatTriggers 1.8.9. Built by [ITV] & MorgenBinIchRich.",
        category: "Credits",
        placeholder: "v1.0.0"
    })
    credits() {}

    @ButtonProperty({
        name: "Open GitHub",
        description: "Open the Morgen GitHub repository in your browser.",
        category: "Credits",
        placeholder: "Open"
    })
    openGithub() {
        try {
            java.awt.Desktop.getDesktop().browse(new java.net.URI("https://github.com"));
        } catch (_) {}
    }

    @ButtonProperty({
        name: "Open Imports Folder",
        description: "Opens the imports folder in your file explorer.",
        category: "Credits",
        placeholder: "Open"
    })
    openFolderCredits() {
        openImportsFolder();
    }
}

export default new Settings();