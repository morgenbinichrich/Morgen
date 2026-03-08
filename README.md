# Morgen
**Minecraft 1.8.9 ChatTriggers mod for Housing item management**

> Import, export, and AI-generate Housing items using `.mig` files.  
> Built for Hypixel Housing — works in Creative mode.

---

## Requirements
- Minecraft **1.8.9** with **Forge**
- [ChatTriggers](https://www.chattriggers.com/) installed
- Creative mode (for item spawning)

---

## Installation
1. Download and extract `Morgen` into your ChatTriggers modules folder:  
   `.minecraft/config/ChatTriggers/modules/`
2. In-game: `/ct load`
3. Set up your Gemini key if you want AI features: `/mm ai key YOUR_KEY`

---

## Commands

### Core
| Command | Description |
|---|---|
| `/mm import <path>` | Spawn items from a `.mig` file |
| `/mm export <path>` | Export held item to a `.mig` file |
| `/mm continue` | Resume import after inventory was full |
| `/mm gui` | Open the `.mig` file browser |
| `/mm recent` | Show recently imported items |
| `/mm settings` | Open settings GUI |

> **Spaces in paths are supported:** `/mm import Weapons/Fire Sword`

---

### File Browser (`/mm gui`)
- **Scroll** through files with the mouse wheel
- **Click** a file to import it
- **Drag** the window by the header
- **Search** by typing — results show the folder path below the name
- **Resize** the window: click the `100%` button in the footer, then scroll
- **Trash icon** on hover to delete a file

---

### Chest Export
An **Export All → .mig** overlay button appears whenever a chest GUI is open.

- Click to export all chest items into one `.mig` file (saved to `imports/housing/`)
- **Move the button:** click the `⛿` lock icon to the left of the button, then drag it anywhere. Click the lock again to save position.
- Configure in `/mm settings → Export`

---

### Quick Spawn (`/mm qs`)
| Command | Description |
|---|---|
| `/mm qs` | Open Quick Spawn GUI (9 slots) |
| `/mm qs <1-9>` | Directly spawn from a slot |
| `/mm qs set <1-9> <path>` | Assign a `.mig` path to a slot |
| `/mm qs clear [1-9]` | Clear one or all slots |
| `/mm qs list` | List all assigned slots |

---

### AI — Google Gemini (`/mm ai`)
AI-powered item name and `.mig` file generation.

**Setup**
```
/mm ai key YOUR_GEMINI_KEY
```
Get a free key at [aistudio.google.com](https://aistudio.google.com)

**Commands**
| Command | Description |
|---|---|
| `/mm ai names <amount> <theme>` | Generate N tier names for a theme |
| `/mm ai mig <amount> <theme>` | Generate a full `.mig` file with N items |
| `/mm ai ref1` | Hold an item → set as style reference 1 |
| `/mm ai ref2` | Hold an item → set as style reference 2 |
| `/mm ai status` | Show current AI config |
| `/mm ai key <key>` | Set Gemini API key |
| `/mm ai region <region>` | Set regional API endpoint (or `clear`) |

**Examples**
```
/mm ai names 6 nether swords
/mm ai mig 5 ocean armor set
/mm ai names 8 corrupted bows
```

**Reference items** — run `/mm ai ref1` while holding an item to capture its name and lore as style context. The AI will match the aesthetic for names and mig generation. Set `/mm ai ref2` for a second reference.

Generated `.mig` files are saved to `imports/ai/` and include a clickable **Import Now** button in chat.

---

### Other Commands
| Command | Description |
|---|---|
| `/mm info` | Show detailed NBT info for held item |
| `/mm nbt` | Raw NBT dump |
| `/mm edit` | Open visual item editor |
| `/mm invgui` | Visual inventory viewer |
| `/mm symbols` / `/mm sym` | Symbol picker (click to copy) |
| `/mm validate <path>` | Validate a `.mig` file before importing |
| `/mm undo` | Restore last item change |
| `/mm inventory` | Export all inventory items |
| `/mm open` | Open the imports folder |
| `/mm ai` | AI help |

---

## .mig File Format

```
ITEM "minecraft:diamond_sword"
  Name: "&6Infernal Blade"
  Lore: [
    "&7Forged in the depths of the Nether"
    "&8Ancient power flows within"
  ]
  # Damage: #
  # Speed: #
  HideFlags: 63
  Glow: false
  Unbreakable: true
END
```

- **`# StatName: #`** — stat placeholder (the `#` is replaced at import time or kept as comment)
- **`Name: list("&7Name", "&e Name")`** — multiple names for batch items
- **`Amount: 5`** — spawn 5 copies
- Color codes use `&` (e.g. `&6`, `&a`, `&b`)
- Files are stored in `imports/` inside the module folder

---

## Settings

Open with `/mm settings` or in the ChatTriggers mod menu.

Key options:
- **Gemini API Key / Model** — AI configuration
- **Export All Button** — show/hide the chest export overlay
- **Skip Last Row** — skip navigation row when exporting chests
- **Lore Lines** — how many lore lines the AI generates
- **Strip Color on Export** — remove color codes when exporting

---

## Keyboard Shortcuts (in GUIs)
| Key | Action |
|---|---|
| `M` | Open file browser |
| `R` | Refresh file list |
| `L` | Spawn last imported item |
| `O` | Open imports folder |

---

## Credits
Made by **[ITV]** & **MorgenBinIchRich**
