import "./src/commands/exportCommand";
import "./src/commands/giveCommand";
import Settings from "./utils/config";

let load = register("worldLoad", () => {
    const version = JSON.parse(FileLib.read("Morgen", "./metadata.json")).version;
    ChatLib.chat(ChatLib.addColor(Settings.chatPrefix + "&aLoaded &6Morgen &av" + version));
    ChatLib.chat(ChatLib.addColor(Settings.chatPrefix + "&7Type &f/mm &7for commands  &8|  &f/mm gui &7to browse files"));
    load.unregister();
});

register("command", function() {
    Settings.openGUI();
}).setName("morgen");