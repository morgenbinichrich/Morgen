/// <reference types="../CTAutocomplete" />

import './src/imports';
import Settings from './utils/config';

// ─── Load message ─────────────────────────────────────────────

const PREFIX = ChatLib.addColor(Settings.chatPrefix);

ChatLib.chat(PREFIX + ChatLib.addColor("&aLoaded &6Morgen &av1.0.0"));
ChatLib.chat(PREFIX + ChatLib.addColor("&7Type &f/morgen &7to open settings."));

// ─── Commands ────────────────────────────────────────────────

// /morgen or /mm — opens Vigilance GUI
register("command", () => {
    Settings.openGUI();
}).setName("morgen").setAliases(["mm"]);

// ─── Keybind ─────────────────────────────────────────────────

register("tick", () => {
    if (Settings.openMenuKey && Settings.openMenuKey.isPressed()) {
        Settings.openGUI();
    }
});

// ─── World load/unload hooks ──────────────────────────────────

