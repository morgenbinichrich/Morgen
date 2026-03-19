# Morgen
**Minecraft 1.8.9 ChatTriggers mod — Hypixel Housing item manager**

Import, export, and AI-generate Housing items using `.mig` files.

---

## Requirements
- Minecraft 1.8.9 + Forge
- [ChatTriggers](https://www.chattriggers.com/) mod installed
- Creative mode (for item spawning)

---

## Installation
1. Put the `Morgen` folder into:
   ```
   .minecraft/config/ChatTriggers/modules/
   ```
2. In-game: `/ct load`
3. Optional AI setup: `/mm ai key YOUR_GEMINI_KEY`

---

## Commands

| Command | What it does |
|---|---|
| `/mm import <path>` | Spawn item(s) from a `.mig` file |
| `/mm export <path>` | Export held item to `.mig` + `.give` |
| `/mm gui` | Open the file browser |
| `/mm edit` | Open the item editor |
| `/mm copy` | Copy held item's lore |
| `/mm paste` | Paste lore onto held item |
| `/mm rename <name>` | Rename held item |
| `/mm addlore <line>` | Add a lore line |
| `/mm clearlore` | Clear all lore |
| `/mm dupe [n]` | Duplicate held item |
| `/mm undo` | Undo last item change |
| `/mm validate <path>` | Check a `.mig` file for errors |
| `/mm inventory` | Export all inventory items |
| `/mm qs` | Quick spawn slots (1–9) |
| `/mm ai names <n> <theme>` | AI-generate item names |
| `/mm ai mig <n> <theme>` | AI-generate a full `.mig` file |
| `/mm settings` | Open settings |

---

## .mig Format

```
ITEM "minecraft:diamond_sword" {

    Name:   "&6Infernal Blade"
    Amount: 1
    Count:  1

    ItemType:    "Weapon"
    Damage:      0
    Unbreakable: true
    Glow:        false
    HideFlags:   63

    Stats {
        damage: linear(10, 5)
        speed:  static(1.2)
    }

    Lore: [
        "&7A blade forged in the Nether"
        "&8Ancient power flows within"
    ]

}
```

**Multiple names / tiers:**
```
Name: list("&7Iron Edge", "&eSilver Fang", "&6Infernal Blade")
Amount: 3
```

**Multiple leather colors:**
```
Hex: list("#FF0000", "#00FF00", "#0000FF")
```

**Skull with texture:**
```
ITEM "minecraft:skull" {
    Name: "&bCustom Head"
    Damage: 3
    Texture: "eyJ0ZXh0dXJlcy..."
    ...
}
```

---

## AI (Google Gemini)

Get a free API key at [aistudio.google.com](https://aistudio.google.com)

```
/mm ai key YOUR_KEY
/mm ai names 6 nether swords
/mm ai mig 5 ocean armor set
```

Use `/mm ai ref1` while holding an item to set a style reference.

---

## Credits
Built by **[ITV]** & **MorgenBinIchRich**