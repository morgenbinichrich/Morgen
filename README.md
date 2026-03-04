<div align="center">

<img src="assets/htsl.png" width="64" height="64" alt="Morgen Icon">

# Morgen

**A ChatTriggers 1.8.9 module for creating, managing, and AI-generating custom Minecraft items using simple `.mig` config files.**

![Minecraft](https://img.shields.io/badge/Minecraft-1.8.9-brightgreen?style=flat-square&logo=minecraft)
![ChatTriggers](https://img.shields.io/badge/ChatTriggers-1.8.9-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

*by* ***[ITV]*** *&* ***MorgenBinIchRich***

</div>

---

## What is Morgen?

Morgen lets you define custom Minecraft items in plain text `.mig` files and instantly spawn them into your inventory. Export any held item to a `.mig` file, edit it, and reimport it — no NBT editors, no external tools. It also includes a visual file browser GUI, a quick-spawn favourites hotbar, an in-game item stat overlay, and a Google Gemini AI integration that generates lore and names for your items.

---

## Requirements

| Dependency | Version |
|---|---|
| Minecraft | 1.8.9 |
| ChatTriggers | 1.8.9 |
| Vigilance | Latest |

> You must be in **Creative Mode** to spawn items.

---

## Installation

1. Download the `Morgen` folder and place it in:
   ```
   .minecraft/config/ChatTriggers/modules/Morgen/
   ```
2. Install [Vigilance](https://github.com/EssentialGG/Vigilance) if you haven't already
3. Run `/ct load` in-game
4. You'll see:
   ```
   [Morgen] Loaded Morgen v1.0.0
   [Morgen] Type /mm for commands | /mm gui to open the browser
   ```

---

## Folder Structure

```
Morgen/
├── index.js
├── assets/
│   ├── folder.png
│   ├── htsl.png
│   ├── bin.png
│   ├── bin_closed.png
│   ├── click.ogg
│   └── paper.ogg
├── utils/
│   ├── utils.js           ← Item creation, NBT helpers
│   └── config.js          ← Vigilance settings
├── gui/
│   ├── MigBrowserGUI.js   ← /mm gui — file browser
│   ├── ItemPreviewGUI.js  ← /mm preview — overlay
│   └── QuickSpawnGUI.js   ← /mm qs — favourites hotbar
└── src/
    ├── imports.js
    └── commands/
        ├── giveCommand.js     ← internal /mmimport
        ├── exportCommand.js   ← /mm
        └── aiCommand.js       ← /mm ai
```

Your item files live in:
```
Morgen/imports/
├── sword.mig
├── weapons/
│   ├── longsword.mig
│   └── bow.mig
├── armor/
│   └── helmet.mig
└── skulls/
    └── custom_head.json
```

---

## Commands Overview

| Command | Description |
|---|---|
| `/mm import <path>` | Spawn item(s) from a `.mig` or `.json` file |
| `/mm export <path>` | Export held item to a `.mig` file |
| `/mm gui` | Open the visual file browser |
| `/mm preview` | Toggle in-game item stat overlay |
| `/mm qs` | Open quick-spawn favourites hotbar |
| `/mm ai ...` | AI lore & name generation (Gemini) |
| `/mm copy` | Copy held item's lore to clipboard |
| `/mm paste` | Paste clipboard lore onto held item |
| `/mm rename <name>` | Rename held item (supports `&` codes) |
| `/mm addlore <line>` | Add a lore line to held item |
| `/mm clearlore` | Clear all lore from held item |
| `/mm dupe [n]` | Duplicate held item n times |
| `/mm compare` | Compare two items side-by-side |
| `/mm inventory` | Export all inventory items to a dated folder |
| `/mm recent` | Show recently imported items (clickable) |
| `/mm tojson <path>` | Convert a `.mig` file to `.json` |
| `/mm tomig <path>` | Convert a `.json` file to `.mig` |
| `/mm info` | Detailed info about held item |
| `/mm nbt` | Raw NBT dump of held item |
| `/mm open` | Open the imports folder in Explorer |
| `/mm settings` | Open the settings GUI |

---

## /mm import

Spawns item(s) from a `.mig` or `.json` file in `Morgen/imports/`.

```
/mm import sword
/mm import weapons/longsword
/mm import skulls/custom_head
```

- Supports subfolders using `/`
- Items go into the first **empty inventory slot** (slots 9–35 first, then hotbar 36–44 — never overwrites occupied slots)
- `.json` files in the HTSL `{"item": "...NBT..."}` format are also supported directly

---

## /mm export

Exports the item you're holding to a `.mig` file.

```
/mm export sword
/mm export weapons/longsword
```

Captures: name, lore, HideFlags, enchantments, skull texture, leather colour, ItemModel, Unbreakable, Glow.  
Creates subfolders automatically if they don't exist.

---

## /mm gui — File Browser

Opens a draggable floating panel showing all files in `Morgen/imports/`.

```
/mm gui
```

**Features:**
- Navigate into subfolders by clicking them
- **Search** — just start typing to search all files recursively across all subfolders. Matching text is highlighted yellow
- Click any `.mig` or `.json` file to instantly import it
- Hover over a file to reveal a trash icon — click to delete
- **Folder button** (top-right of header) — opens the imports folder in Explorer
- Drag the header bar to reposition the panel anywhere on screen
- Panel position is saved between sessions
- Right-click anywhere to go back / clear search

**Keybinds** (configurable in Minecraft Controls → Morgen):

| Keybind | Default | Action |
|---|---|---|
| Open .mig Browser | `M` | Open the file browser GUI |
| Refresh File List | `R` | Refresh while GUI is open |
| Spawn Last Item | `L` | Re-spawn the last item you imported |
| Open Imports Folder | `O` | Open imports folder in Explorer |

---

## /mm preview — Item Stat Overlay

Toggles a persistent floating overlay that shows live stats for whatever item you're holding — without opening any GUI screen.

```
/mm preview         ← toggle on/off
/mm preview drag    ← open drag mode to reposition
```

Displays: Name, ID, Damage, Count, Enchantments, Lore (up to 8 lines), Unbreakable, Glow, Skull, HideFlags.  
Position is saved between sessions.

---

## /mm qs — Quick Spawn Hotbar

A 9-slot visual favourites bar that opens above your hotbar. Pin your most-used `.mig` files for one-click spawning.

```
/mm qs                          ← open the GUI
/mm qs set 1 weapons/sword      ← assign slot 1
/mm qs set 5 armor/chestplate   ← assign slot 5
/mm qs list                     ← list all slots
/mm qs clear 3                  ← clear slot 3
/mm qs clear                    ← clear all slots
```

- Left-click a slot to spawn the item
- Right-click a slot to clear it
- Slot assignments are saved to disk

---

## /mm ai — AI Lore & Name Generator

Uses Google Gemini to generate item lore and name lists that match your item's theme, colour scheme, and style.

```
/mm ai lore                     ← generate lore for held item
/mm ai names                    ← generate tier name list
/mm ai both                     ← generate lore + names together
/mm ai write make it about fire ← freeform prompt
/mm ai apply lore               ← apply last generated lore
/mm ai apply names              ← copy names list to clipboard
/mm ai regen                    ← regenerate last request
/mm ai status                   ← show current AI config
/mm ai key YOUR_API_KEY         ← set your Gemini API key
```

You can add a hint to any generation command:

```
/mm ai lore forged in the depths of hell
/mm ai names something that escalates from fire to inferno
/mm ai both ancient ocean artifact
```

After generation, a clickable row appears in chat:  
**[Apply Lore]  [Apply Names]  [Regenerate]**

**Getting a free Gemini API key:**
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API Key** → **Create API key**
4. Run `/mm ai key YOUR_KEY` in-game

---

## /mm copy & /mm paste — Lore Clipboard

Copy lore from one item and paste it onto another.

```
/mm copy    ← hold item A, copies its lore
/mm paste   ← hold item B, pastes the lore onto it
```

Paste preserves all other NBT on the target item (enchants, skull texture, etc).

---

## /mm compare

Compare two items side-by-side. Run twice — once per item.

```
/mm compare    ← hold item A — "Item 1 saved"
/mm compare    ← hold item B — shows diff
```

Compares: ID, Damage, Stack size, Unbreakable, HideFlags, Glow, and Lore (line count + content match). Differences are marked with `◄`.

---

## /mm dupe

Duplicate the held item into empty inventory slots.

```
/mm dupe        ← duplicate once
/mm dupe 5      ← duplicate 5 times
```

Preserves full NBT. Maximum 36 copies per command.

---

## /mm inventory

Exports every non-empty item in your inventory (hotbar, main inventory, armour) to dated `.mig` files.

```
/mm inventory
```

Files are saved to `Morgen/imports/inventory/2025-03-04_14-30/` with names like `slot_09_Diamond_Sword.mig`.

---

## /mm recent

Shows your last 10 imported items as clickable chat messages.

```
/mm recent
```

Click `[Import]` next to any entry to re-spawn it instantly. History is saved to disk.

---

## /mm tojson & /mm tomig

Convert between file formats.

```
/mm tojson weapons/sword     ← creates weapons/sword.json next to the .mig
/mm tomig  skulls/head       ← creates skulls/head.mig next to the .json
```

`.json` files follow the HTSL `{"item": "...NBT..."}` format used by Hypixel SkyBlock item editors. After converting with `tomig`, use `/mm import` as normal.

---

## /mm rename, /mm addlore, /mm clearlore

Edit the held item's display data in-place without re-exporting.

```
/mm rename &6Dragon Blade           ← rename with colour codes
/mm addlore &7A blade from the deep ← append a lore line
/mm clearlore                       ← wipe all lore
```

Supports `&` colour codes. Changes are applied immediately via creative packet.

---

## The .mig Format

A `.mig` file describes a single item or a batch of items. Lines starting with `#` are comments.

### Full Example

```
ITEM "minecraft:diamond_sword" {

    Name: list("&7Iron Blade", "&eSilver Blade", "&6Gold Blade")
    Amount: 3          # spawn 3 items
    Count: 1
    Damage: 0
    Unbreakable: true
    Glow: false
    HideFlags: 63      # hide everything

    # ItemModel: "none"

    Stats {
        damage: linear(10, 5)
        speed:  round(linear(1.0, 0.2), 1)
        tier:   list(Common, Uncommon, Rare)
    }

    Lore: [list(
        "&8Weapon",
        "&7",
        "&c+{damage} &7Damage",
        "&7Speed: &e{speed}",
        "&7",
        "&7Tier: &f{tier}",
        "&7Item {i+1} of 3"
    )]

}
```

### Fields Reference

| Field | Type | Description |
|---|---|---|
| `ITEM "id"` | string | Minecraft registry name e.g. `minecraft:stick` |
| `Name` | string / list | Display name. `list(...)` for per-item names in batch mode |
| `Amount` | int | How many item stacks to spawn (default: 1) |
| `Count` | int | Stack size per item (default: 1) |
| `Damage` | int | Item damage / meta value (default: 0) |
| `Unbreakable` | bool | Makes the item unbreakable |
| `Glow` | bool | Adds fake enchantment glint |
| `HideFlags` | int | Bitmask to hide tooltip sections |
| `Hex` | string | Leather armour colour `"#FF0000"` |
| `Texture` | string | Skull base64 texture |
| `ItemModel` | string | Custom `ItemModel` NBT tag |
| `Enchants` | JSON array | Real enchantments `[{"id":16,"lvl":5}]` |
| `Stats { }` | block | Named stat expressions |
| `Lore: [...]` | block | Lore lines |

### HideFlags Bitmask

| Value | Hides |
|---|---|
| 1 | Enchantments |
| 2 | Attribute Modifiers |
| 4 | Unbreakable tag |
| 8 | Can Destroy |
| 16 | Can Place On |
| 32 | Miscellaneous |
| **63** | **Everything** |

### Stat Expressions

| Expression | Formula | Example `i=2` |
|---|---|---|
| `static(v)` | Always `v` | `static(10)` → `10` |
| `linear(base, step)` | `base + step × i` | `linear(5, 2.5)` → `10` |
| `exp(base, factor)` | `base × factor^i` | `exp(2, 1.5)` → `4.5` |
| `list(a, b, c, ...)` | `args[i]` | `list(10,20,30)` → `30` |
| `round(expr, n)` | Round to n decimals | `round(linear(1,0.3), 1)` → `1.6` |

### Lore Placeholders

| Placeholder | Value |
|---|---|
| `{statName}` | Evaluated stat for this item |
| `{i}` | Item index (0-based) |
| `{i+1}` | Item index (1-based) |

### Special Items

**Custom skull:**
```
ITEM "minecraft:skull" {
    Name: list("&6Custom Head")
    Damage: 3
    Texture: "eyJ0ZXh0dXJlcyI..."
    HideFlags: 63
    Lore: [list("&8Decorative")]
}
```

**Coloured leather armour:**
```
ITEM "minecraft:leather_chestplate" {
    Name: list("&cRed Armour")
    Hex: "#FF0000"
    Unbreakable: true
    HideFlags: 63
    Lore: [list("&8Armour")]
}
```

**Real enchantments:**
```
ITEM "minecraft:diamond_sword" {
    Name: list("&5Enchanted Blade")
    Enchants: [{"id":16,"lvl":5},{"id":20,"lvl":2}]
    HideFlags: 1
    Lore: [list("&8Enchanted Weapon")]
}
```

---

## .json Format

Morgen supports the HTSL item JSON format used by Hypixel item editors:

```json
{
  "item": "{id:\"minecraft:skull\",Count:1b,tag:{display:{Name:\"&6Custom Head\",Lore:[\"&8Custom\"]},SkullOwner:{...}},Damage:3s}"
}
```

- Import directly via `/mm import` or click in the file browser GUI
- Convert to `.mig` with `/mm tomig <path>`
- Convert `.mig` back to `.json` with `/mm tojson <path>`

---

## Settings

Open with `/mm settings` or `/morgen`. All settings persist across sessions.

### General
| Setting | Default | Description |
|---|---|---|
| Default Config File | `items` | File used when no argument is given |
| Quiet Mode | Off | Suppress "Item placed in slot X" messages |
| Chat Prefix | `[Morgen]` | Prefix on all module messages |
| Open Imports Folder | Button | Opens imports folder in Explorer |
| Reload Settings | Button | Reloads settings from disk |

### Item Logic
| Setting | Default | Description |
|---|---|---|
| Smart HideFlags | On | Auto-adds HideFlags bit 4 when Unbreakable is true |
| Default HideFlags | 63 | Used when `.mig` has no HideFlags field |
| Auto-Glow | Off | Add fake enchant glow to all items |
| Auto Unbreakable | Off | Make all items unbreakable by default |
| Default Stack Size | 1 | Used when `.mig` has no Count field |

### Formatting
| Setting | Default | Description |
|---|---|---|
| Decimal Precision | 1 | Decimal places for stat values |
| Use & Colour Codes | On | `&6` vs `§6` in exported files |
| Strip Colour on Export | Off | Remove colour codes from lore on export |

### Export
| Setting | Default | Description |
|---|---|---|
| Lore as list() | On | Write lore in `list(...)` format |
| Name as list() | On | Write name in `list(...)` format |
| Add Stats Placeholder | On | Include commented Stats block on export |
| Auto-Open After Export | Off | Open imports folder after export |
| Export Enchantments | On | Include enchantments in exported file |
| Export Skull Texture | On | Include skull texture in exported file |

### AI
| Setting | Default | Description |
|---|---|---|
| Gemini API Key | *(empty)* | Your Google Gemini API key |
| Gemini Model | `gemini-2.0-flash` | Model to use (`gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`) |
| Auto-Apply Lore | Off | Apply generated lore immediately without preview |
| Filter AI Output | On | Strip lines that look like AI commentary |
| Lore Lines | 5 | How many lore lines to generate |
| Name Count | 5 | How many names to generate |
| Name Tier Min / Max | 1 / 5 | Tier range context for name escalation |
| Lore Style | `rpg` | `rpg` / `witty` / `scary` / `minimal` / `poetic` |
| Colour Style | `auto` | `auto` / `gold` / `blue` / `purple` / `red` / `green` / `white` |
| Temperature | `0.9` | AI creativity — 0.0 (precise) to 1.0 (very creative) |

### Advanced
| Setting | Default | Description |
|---|---|---|
| Debug Logging | Off | Print debug info to CT console |
| Safe Mode | On | Validate item IDs before spawning |
| Batch Delay | Off | 1-tick gap between batch items (fixes missing items) |

---

## VS Code Extension

A `.vsix` syntax extension for editing `.mig` files is included.

**Install:**
1. Open VS Code
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select `morgen-mig.vsix`

**Features:**
- Syntax highlighting for keywords, stat functions, colour codes, placeholders and comments
- Snippets — type prefix and press `Tab`:

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

## Colour Codes

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

## Troubleshooting

**`File not found`**
- Check the file exists in `Morgen/imports/`
- Don't include `.mig` in the command: use `/mm import sword` not `/mm import sword.mig`

**Item spawns with no name or lore**
- Make sure you are in Creative Mode
- Check the CT console (`/ct console`) for parse errors
- Enable Debug Logging in settings

**`You must be in Creative Mode`**
- Morgen uses the creative inventory packet and requires creative mode

**Items go missing in batch mode**
- Enable **Batch Delay** in Advanced settings

**AI generates nothing / times out**
- Check your API key is correct: `/mm ai status`
- Make sure you have an internet connection
- The free `gemini-2.0-flash` tier has a rate limit — wait a few seconds and retry

**AI generates lines without colour codes**
- Enable **Filter AI Output** in settings to strip plain-text commentary lines
- Try a different **Lore Style** (e.g. `rpg` tends to produce more coloured output than `minimal`)

**Icons not showing in the file browser**
- Make sure `folder.png`, `htsl.png`, `bin.png`, `bin_closed.png` exist in `Morgen/assets/`
- If missing, the GUI falls back to coloured squares (yellow = folder, blue = .mig, green = .json)

**Settings GUI crashes**
- Make sure you have the latest version of Vigilance installed

---

## License

MIT — free to use, modify and distribute.

---

<div align="center">

Made with ❤️ for the Minecraft ChatTriggers community  
**[ITV]** & **MorgenBinIchRich**

</div>
