/// <reference types="../CTAutocomplete" />

import './src/imports';
import Settings from './utils/config';

const PREFIX = ChatLib.addColor(Settings.chatPrefix);

ChatLib.chat(PREFIX + ChatLib.addColor("&aLoaded &6Morgen &av1.0.0"));
ChatLib.chat(PREFIX + ChatLib.addColor("&7Type &f/mm &7for commands  &8|  &f/mm gui &7to browse files"));

register("command", function() {
    Settings.openGUI();
}).setName("morgen");

