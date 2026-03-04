<div align="center">

# 🗡️ Morgen

**A ChatTriggers 1.8.9 module for creating and managing custom Minecraft items using simple `.mig` config files.**

![Minecraft](https://img.shields.io/badge/Minecraft-1.8.9-green?style=flat-square)
![ChatTriggers](https://img.shields.io/badge/ChatTriggers-1.8.9-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-orange?style=flat-square)

</div>

---

## 📖 Overview

Morgen lets you define custom items in `.mig` text files and spawn them directly into your inventory — no NBT editors, no commands, no hassle. Export any held item to a `.mig` file, edit it, and reimport it instantly. Perfect for server developers, map makers, and anyone building custom item systems on top of ChatTriggers.

---

## 📦 Requirements

| Dependency | Version |
|---|---|
| Minecraft | 1.8.9 |
| ChatTriggers | 1.8.9 |
| Vigilance | Latest |

> You must be in **Creative Mode** to spawn items.

---

## 🚀 Installation

1. Download and place the `Morgen` folder into:
   ```
   .minecraft/config/ChatTriggers/modules/
   ```
2. Install [Vigilance](https://github.com/EssentialGG/Vigilance) if you haven't already
3. Run `/ct load` in-game to load the module
4. You should see:
   ```
   [Morgen] Loaded Morgen v1.0.0
   [Morgen] Type /morgen to open settings.
   ```

---

## 📁 Folder Structure

```
Morgen/
├── index.js                   ← Module entry point
├── utils/
│   ├── utils.js               ← Core item creation + helpers
│   └── config.js              ← Vigilance settings
└── src/
    ├── imports.js
    └── commands/
        ├── giveCommand.js     ← /mg command
        └── exportCommand.js   ← /mm command
```

Your item files live in:
```
Morgen/imports/
├── mysword.mig
├── weapons/
│   ├── sword.mig
│   └── bow.mig
└── armor/
    └── chestplate.mig
```

---

## ⌨️ Commands

### `/mg <file>`
Spawns item(s) from a `.mig` file into your inventory.

```
/mg mysword
/mg weapons/sword
/mg armor/chestplate
```

- Supports subfolders with `/`
- If no filename is given, uses the **Default Config File** from settings
- Items are placed into the first available hotbar slot, then inventory

---

### `/mm export <file>`
Exports the item you are currently holding to a `.mig` file.

```
/mm export mysword
/mm export weapons/sword
```

- Creates subfolders automatically if they don't exist
- Captures name, lore, HideFlags, enchantments, skull texture, leather colour
- Generates a ready-to-edit `.mig` file with Stats and Lore blocks

---

### `/mm info`
Prints details about the item you are holding to chat.

```
Name:    §6Dragon Blade
ID:      minecraft:diamond_sword
Damage:  0
Stack:   1
Flags:   Enchantments, Unbreakable (5)
Enchs:   Sharpness 5
Lore:
  §8Weapon
  §c+25 Damage
```

---

### `/mm nbt`
Dumps the raw NBT string of the held item to chat. Useful for debugging.

---

### `/mm open`
Opens the `Morgen/imports/` folder in your system file explorer.

---

### `/mm settings` or `/morgen`
Opens the Vigilance settings GUI.

---

## 📄 The .mig Format

A `.mig` file describes a single item (or batch of items). Lines starting with `#` are comments.

### Full Example

```
ITEM "minecraft:diamond_sword" {

    Name: list("&6Dragon Blade")
    Amount: 1           # how many items to spawn
    Count: 1            # stack size of each item
    Damage: 0           # item meta / damage value
    Unbreakable: true
    Glow: false         # fake enchant glow
    HideFlags: 63       # hide all tooltip flags

    Stats {
        damage: static(25)
        speed:  linear(1.0, 0.5)
    }

    Lore: [list(
        "&8Weapon",
        "&7",
        "&c+{damage} &7Damage",
        "&7Speed: &e{speed}",
        "&7",
        "&7&lRare"
    )]

}
```

---

### Fields Reference

| Field | Type | Description |
|---|---|---|
| `ITEM "id"` | string | Minecraft registry name e.g. `minecraft:stick` |
| `Name` | list / string | Display name. Supports `list(...)` for batch names |
| `Amount` | int | Number of item stacks to generate (default: 1) |
| `Count` | int | Stack size of each item (default: 1) |
| `Damage` | int | Item damage / meta value (default: 0) |
| `Unbreakable` | bool | Makes the item unbreakable |
| `Glow` | bool | Adds fake enchantment glint |
| `HideFlags` | int | Bitmask to hide tooltip sections (see below) |
| `Hex` | string | Leather armour colour e.g. `"#FF0000"` |
| `Texture` | string | Skull base64 texture value |
| `ItemModel` | string | Custom `ItemModel` NBT tag |
| `Enchants` | JSON array | Real enchantments e.g. `[{"id":16,"lvl":5}]` |
| `Stats { }` | block | Named stat expressions (see Stats section) |
| `Lore: [...]` | block | Lore lines, supports `list(...)` format |

---

### HideFlags Bitmask

Add the values together for the flags you want to hide.

| Value | Hides |
|---|---|
| 1 | Enchantments |
| 2 | Attribute Modifiers |
| 4 | Unbreakable tag |
| 8 | Can Destroy |
| 16 | Can Place On |
| 32 | Miscellaneous |
| **63** | **Everything** |

---

### Stats Block

Stats are named expressions evaluated per item index `i` (0-based). The result can be inserted into lore lines using `{statName}`.

```
Stats {
    damage: static(25)
    speed:  linear(1.0, 0.5)
    power:  exp(2, 1.5)
    tier:   list(Common, Rare, Epic, Legendary)
    dps:    round(linear(10, 2.5), 1)
}
```

| Expression | Formula | Example (i=2) |
|---|---|---|
| `static(v)` | Always `v` | `static(10)` → `10` |
| `linear(base, step)` | `base + step * i` | `linear(5, 2.5)` → `10` |
| `exp(base, factor)` | `base * factor^i` | `exp(2, 1.5)` → `4.5` |
| `list(a, b, c, ...)` | `args[i]` (clamped to last) | `list(10,20,30)` → `30` |
| `round(expr, n)` | Rounds result to `n` decimals | `round(linear(1,0.3), 1)` → `1.6` |

---

### Lore Placeholders

Inside lore lines you can use:

| Placeholder | Replaced with |
|---|---|
| `{statName}` | The evaluated stat value for this item |
| `{i}` | Item index (0-based) |
| `{i+1}` | Item index (1-based) |

---

### Lore Format

Two formats are supported:

**list() format** (recommended — supports per-item lore):
```
Lore: [list(
    "&8Weapon",
    "&7",
    "&c+{damage} &7Damage"
)]
```

**Plain lines format:**
```
Lore: [
    "&8Weapon"
    "&7"
    "&c+{damage} &7Damage"
]
```

---

### Batch Items

Set `Amount` greater than 1 to spawn multiple items. Each item gets its stats evaluated at index `i`.

```
ITEM "minecraft:stick" {

    Name: list("&7Tier I", "&eTier II", "&6Tier III")
    Amount: 3

    Stats {
        damage: linear(5, 5)
        tier:   list(Common, Uncommon, Rare)
    }

    Lore: [list(
        "&8{tier} Weapon",
        "&7",
        "&c+{damage} &7Damage",
        "&7Item {i+1} of 3"
    )]

}
```

This spawns 3 items:
- Tier I — 5 damage — Common
- Tier II — 10 damage — Uncommon
- Tier III — 15 damage — Rare

---

### Special Items

**Skull with custom texture:**
```
ITEM "minecraft:skull" {
    Name: list("&6Custom Head")
    Damage: 3
    Texture: "eyJ0ZXh0dXJlcy..."
    HideFlags: 63
    Lore: [list("&8Decorative")]
}
```

**Coloured leather armour:**
```
ITEM "minecraft:leather_chestplate" {
    Name: list("&cRed Chestplate")
    Hex: "#FF0000"
    Unbreakable: true
    HideFlags: 63
    Lore: [list("&8Armour")]
}
```

**Item with real enchantments:**
```
ITEM "minecraft:diamond_sword" {
    Name: list("&5Enchanted Blade")
    Enchants: [{"id":16,"lvl":5},{"id":20,"lvl":2}]
    HideFlags: 1
    Lore: [list("&8Enchanted Weapon")]
}
```

---

## ⚙️ Settings

Open with `/mm settings` or `/morgen`. All settings persist across sessions.

### General
| Setting | Default | Description |
|---|---|---|
| Default Config File | `items` | File used by `/mg` when no argument is given |
| Quiet Mode | Off | Suppress "Item placed in slot X" messages |
| Chat Prefix | `[Morgen]` | Prefix shown in all module messages |
| Open Imports Folder | Button | Opens `imports/` in your file explorer |
| Reload Settings | Button | Reloads settings from disk |

### Item Logic
| Setting | Default | Description |
|---|---|---|
| Smart HideFlags | On | Auto-sets HideFlags bit 4 when Unbreakable is true |
| Default HideFlags | 63 | Used when `.mig` file has no HideFlags field |
| Auto-Glow | Off | Add fake glow to all items by default |
| Auto Unbreakable | Off | Make all items unbreakable by default |
| Default Stack Size | 1 | Used when `.mig` file has no Count field |

### Formatting
| Setting | Default | Description |
|---|---|---|
| Decimal Precision | 1 | Decimal places for stat values |
| Use & Colour Codes | On | On = `&6`, Off = `§6` in exported files |
| Strip Colour on Export | Off | Remove colour codes from lore on export |

### Export
| Setting | Default | Description |
|---|---|---|
| Lore as list() | On | Write lore as `list(...)` format |
| Name as list() | On | Write name as `list(...)` format |
| Add Stats Placeholder | On | Include commented Stats block on export |
| Auto-Open After Export | Off | Open imports folder after `/mm export` |
| Export Enchantments | On | Include enchantments in exported file |
| Export Skull Texture | On | Include skull texture in exported file |

### Advanced
| Setting | Default | Description |
|---|---|---|
| Debug Logging | Off | Print debug info to CT console |
| Safe Mode | On | Validate item IDs before spawning |
| Batch Delay | Off | Add 1-tick delay between batch items |

---

## 🎨 VS Code Extension

A `.vsix` extension is included for editing `.mig` files in VS Code.

**Install:**
1. Open VS Code
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select `morgen-mig.vsix`

**Features:**
- Syntax highlighting for all `.mig` keywords, stat functions, colour codes and placeholders
- Snippets — type a prefix and press `Tab`:

| Prefix | Inserts |
|---|---|
| `item` | Full blank item template |
| `sword` | Diamond sword template |
| `skull` | Custom skull template |
| `leather` | Leather armour template |
| `batch` | 3-tier batch item template |
| `stats` | Stats block |
| `lore` | Lore block |
| `linear` | `linear(base, step)` |
| `exp` | `exp(base, factor)` |
| `static` | `static(value)` |
| `round` | `round(expr, decimals)` |
| `liststat` | `list(a, b, c)` |
| `hideall` | `HideFlags: 63` |
| `namelist` | Multi-name list |

---

## 📝 Colour Codes

Both `&` and `§` codes are supported in `.mig` files.

| Code | Colour | Code | Format |
|---|---|---|---|
| `&0` | Black | `&k` | Obfuscated |
| `&1` | Dark Blue | `&l` | **Bold** |
| `&2` | Dark Green | `&m` | ~~Strikethrough~~ |
| `&3` | Dark Aqua | `&n` | Underline |
| `&4` | Dark Red | `&o` | *Italic* |
| `&5` | Dark Purple | `&r` | Reset |
| `&6` | Gold | | |
| `&7` | Gray | | |
| `&8` | Dark Gray | | |
| `&9` | Blue | | |
| `&a` | Green | | |
| `&b` | Aqua | | |
| `&c` | Red | | |
| `&d` | Light Purple | | |
| `&e` | Yellow | | |
| `&f` | White | | |

---

## 🐛 Troubleshooting

**`[Morgen] File not found`**
- Check the file exists in `Morgen/imports/`
- Make sure you don't include `.mig` in the command — use `/mg sword` not `/mg sword.mig`

**Item spawns with no name or lore**
- Make sure you are in Creative Mode
- Check the CT console (`/ct console`) for parse errors
- Enable Debug Logging in settings for detailed output

**`You must be in Creative Mode`**
- Morgen uses the creative inventory packet — you must be in creative mode

**Settings GUI crashes on a category**
- Make sure you have the latest version of Vigilance installed

**Items go missing in batch mode**
- Enable **Batch Delay** in Advanced settings to add a 1-tick gap between items

---

## 📜 License

MIT — free to use, modify and distribute.

---

<div align="center">
Made for the Minecraft Housing community.
  
   By MorgenBinIchRich
</div>
