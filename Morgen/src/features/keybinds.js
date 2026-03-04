import { Keybind } from "KeybindFix"

let keybindCooldown = 0;

new Keybind("//pos1", Keyboard.KEY_NONE, "HousingHelper").registerKeyPress(() => {
    if (Date.now() - keybindCooldown < 500) return;
    keybindCooldown = Date.now();
    ChatLib.say("//pos1");
});

