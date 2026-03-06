// ============================================================
//  Morgen — giveCommand.js   (/mmimport)
//  v3 — Pre-calculated slot plan, stack-merging, no list() lore
// ============================================================

import { createItem, colorize, formatStat, msg } from "../../utils/utils";
import { trackRecent } from "../commands/exportCommand";
import { validateMig } from "../migValidator";
import Settings from "../../utils/config";

var C10Packet = Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
var ItemStack = Java.type("net.minecraft.item.ItemStack");
var JsonToNBT = Java.type("net.minecraft.nbt.JsonToNBT");
var ItemReg   = Java.type("net.minecraft.item.Item");

// ─── Stat evaluator ───────────────────────────────────────────

function evaluateStat(statStr, i) {
    statStr = ("" + statStr).trim();
    var roundMatch = statStr.match(/^round\((.+),\s*(\d+)\)$/);
    if (roundMatch) {
        var inner = evaluateStat(roundMatch[1], i);
        return parseFloat(inner).toFixed(parseInt(roundMatch[2])).replace(/\.0+$/, "");
    }
    var match = statStr.match(/^(\w+)\((.+)\)$/);
    if (!match) return statStr;
    var type = match[1].toLowerCase();
    var args = match[2].split(",").map(function(s) { return s.trim().replace(/^['"]|['"]$/g, ""); });
    switch (type) {
        case "linear": return formatStat(parseFloat(args[0]) + parseFloat(args[1]) * i);
        case "exp":    return formatStat(parseFloat(args[0]) * Math.pow(parseFloat(args[1]), i));
        case "list":   return args[i] !== undefined ? args[i] : args[args.length - 1];
        case "static": return args[0];
        default:       return statStr;
    }
}

// ─── Helpers ──────────────────────────────────────────────────

function splitQuoted(str) {
    var result = [], current = "", inQuote = false;
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch === '"') { inQuote = !inQuote; current += ch; }
        else if (ch === "," && !inQuote) { result.push(current); current = ""; }
        else { current += ch; }
    }
    if (current.trim()) result.push(current);
    return result.map(function(s) {
        s = s.trim();
        if ((s[0] === '"' && s[s.length-1] === '"') || (s[0] === "'" && s[s.length-1] === "'"))
            s = s.slice(1, -1);
        return s;
    }).filter(function(s) { return s.length > 0; });
}

function extractParens(str, keyword) {
    var ki = str.indexOf(keyword);
    if (ki === -1) return null;
    var start = str.indexOf("(", ki);
    if (start === -1) return null;
    var depth = 0, result = "";
    for (var i = start; i < str.length; i++) {
        if (str[i] === "(") depth++;
        else if (str[i] === ")") { if (--depth === 0) break; }
        if (i > start) result += str[i];
    }
    return result;
}

function extractBrackets(str, keyword) {
    var ki = str.indexOf(keyword);
    if (ki === -1) return null;
    var start = str.indexOf("[", ki);
    if (start === -1) return null;
    var depth = 0, inQ = false, result = "";
    for (var i = start; i < str.length; i++) {
        var ch = str[i];
        if (ch === '"' && str[i-1] !== '\\') inQ = !inQ;
        if (!inQ) {
            if (ch === "[") depth++;
            else if (ch === "]") { if (--depth === 0) break; }
        }
        if (i > start) result += ch;
    }
    return result;
}

function stripComments(raw) {
    return raw.split("\n").map(function(line) {
        var inQ = false;
        for (var i = 0; i < line.length; i++) {
            if (line[i] === '"') inQ = !inQ;
            if (!inQ && line[i] === "#") return line.slice(0, i);
        }
        return line;
    }).join("\n");
}

// ─── .mig parser — single ITEM block ─────────────────────────

function parseOneBlock(blockText) {
    var clean = stripComments(blockText);

    function field(regex, def) {
        var m = clean.match(regex); return m ? m[1].trim() : def;
    }
    function fieldInt(regex, def) {
        var v = field(regex, null); return v !== null ? parseInt(v) : def;
    }
    function fieldBool(regex, def) {
        var v = field(regex, null);
        if (v === null) return def;
        return v.toLowerCase() === "true" || v === "1";
    }

    var itemId      = field(/ITEM\s+"([^"]+)"/, "minecraft:stone");
    var damage      = fieldInt(/^\s*Damage:\s*(\d+)/m,     0);
    var amount      = fieldInt(/^\s*Amount:\s*(\d+)/m,     1);
    var count       = fieldInt(/^\s*Count:\s*(\d+)/m,      Settings.defaultCount);
    var hideFlags   = fieldInt(/^\s*HideFlags:\s*(\d+)/m,  Settings.defaultHideFlags);
    var hex         = field(/^\s*Hex:\s*"([^"]+)"/m,       null);
    var texture     = field(/^\s*Texture:\s*"([^"]+)"/m,   null);
    var itemModel   = field(/^\s*ItemModel:\s*"([^"]+)"/m, null);
    var unbreakable = fieldBool(/^\s*Unbreakable:\s*(true|false|1|0)/im, Settings.defaultUnbreakable);
    var glow        = fieldBool(/^\s*Glow:\s*(true|false|1|0)/im,        Settings.defaultGlow);

    // Name — supports list("a","b") or plain "name" or plain name
    var names = ["Item"];
    var nameLineMatch = clean.match(/^\s*Name:\s*(.+)$/m);
    if (nameLineMatch) {
        var nameVal = nameLineMatch[1].trim();
        if (nameVal.indexOf("list(") !== -1) {
            var nameInner = extractParens(nameVal, "list");
            if (nameInner !== null) {
                var parsed = splitQuoted(nameInner);
                if (parsed.length > 0) names = parsed;
            }
        } else {
            var nameQ = nameVal.match(/^"([^"]*)"$/);
            if (nameQ) names = [nameQ[1]];
            else if (nameVal) names = [nameVal];
        }
    }

    var enchants = null;
    var enchMatch = clean.match(/^\s*Enchants:\s*(\[[\s\S]*?\])/m);
    if (enchMatch) { try { enchants = JSON.parse(enchMatch[1]); } catch (_) {} }

    var stats = {};
    var statBlock = clean.match(/^\s*Stats\s*\{([\s\S]*?)\}/m);
    if (statBlock) {
        statBlock[1].split("\n").forEach(function(line) {
            line = line.trim(); if (!line) return;
            var c = line.indexOf(":");
            if (c === -1) return;
            stats[line.slice(0, c).trim()] = line.slice(c + 1).trim();
        });
    }

    // Lore — supports Lore: [ "line1" "line2" ] or plain quoted lines
    // NO list() in lore — lines are just quoted strings in brackets
    var lore = [];
    var loreContent = extractBrackets(clean, "Lore:");
    if (loreContent !== null) {
        // Check for legacy list() inside lore block
        if (loreContent.indexOf("list(") !== -1) {
            var loreInner = extractParens(loreContent, "list");
            if (loreInner !== null) lore = splitQuoted(loreInner);
        } else {
            // Standard: each quoted "line" on its own row
            var loreLinesRaw = loreContent.split("\n");
            loreLinesRaw.forEach(function(l) {
                l = l.trim();
                if (!l) return;
                // Remove surrounding quotes if present
                if ((l[0] === '"' && l[l.length-1] === '"') || (l[0] === "'" && l[l.length-1] === "'"))
                    l = l.slice(1, -1);
                if (l.length > 0) lore.push(l);
            });
        }
    }

    return { itemId, damage, amount, count, hideFlags, hex, texture,
             itemModel, unbreakable, glow, names, enchants, stats, lore };
}

// ─── Multi-ITEM block splitter ────────────────────────────────
// Splits a .mig file containing one or more ITEM "id" { } blocks.
// Returns array of parsed items.

function parseMIG(raw) {
    var clean = stripComments(raw);
    // Find all ITEM block start positions
    var blockStarts = [];
    var re = /ITEM\s+"[^"]+"\s*\{/g;
    var m;
    while ((m = re.exec(clean)) !== null) {
        blockStarts.push(m.index);
    }

    if (blockStarts.length === 0) return [];

    // Extract each block by matching its closing brace (depth-based)
    var blocks = [];
    for (var bi = 0; bi < blockStarts.length; bi++) {
        var start = blockStarts[bi];
        // find the opening { of this block
        var braceStart = clean.indexOf("{", start);
        if (braceStart === -1) continue;
        var depth = 0, end = braceStart;
        for (var ci = braceStart; ci < clean.length; ci++) {
            if (clean[ci] === "{") depth++;
            else if (clean[ci] === "}") {
                depth--;
                if (depth === 0) { end = ci; break; }
            }
        }
        blocks.push(clean.slice(start, end + 1));
    }

    return blocks.map(parseOneBlock);
}

// ─── Inventory slot plan — pre-calculate before placing ───────
// Returns array of {slot, stackWith} where stackWith = slot of
// existing item to stack onto, or -1 for a fresh empty slot.

function buildSlotPlan(items) {
    // Snapshot current inventory state
    var inv = Player.getInventory();
    if (!inv) return null;

    // Build a mutable map of slots: slot → {id, damage, name, count, stackSize}
    // We work on a virtual copy so we can simulate stacking without touching the real inv
    var virtual = {};
    for (var s = 9; s <= 44; s++) {
        try {
            var stack = inv.getStackInSlot(s);
            if (stack && stack.getID() !== 0) {
                virtual[s] = {
                    id:        "" + stack.getRegistryName(),
                    damage:    stack.getMetadata ? stack.getMetadata() : 0,
                    name:      "" + stack.getName(),
                    count:     stack.getStackSize() || 1,
                    maxStack:  64,
                    empty:     false
                };
            } else {
                virtual[s] = { empty: true, count: 0 };
            }
        } catch(_) {
            virtual[s] = { empty: true, count: 0 };
        }
    }

    var plan = [];

    for (var ii = 0; ii < items.length; ii++) {
        var item = items[ii];
        var placed = false;

        // Try to stack onto existing slot with same id+damage+name
        for (var s2 = 9; s2 <= 44; s2++) {
            var vs = virtual[s2];
            if (!vs || vs.empty) continue;
            if (vs.id === item.id &&
                vs.damage === item.damage &&
                vs.name === item.name &&
                vs.count < vs.maxStack &&
                vs.count + item.count <= vs.maxStack) {
                // Stack here
                plan.push({ slot: s2, stackWith: s2 });
                vs.count += item.count;
                placed = true;
                break;
            }
        }

        if (!placed) {
            // Find first empty slot (main inv first, then hotbar)
            for (var s3 = 9; s3 <= 44; s3++) {
                if (virtual[s3] && virtual[s3].empty) {
                    plan.push({ slot: s3, stackWith: -1 });
                    virtual[s3] = {
                        id:       item.id,
                        damage:   item.damage,
                        name:     item.name,
                        count:    item.count,
                        maxStack: 64,
                        empty:    false
                    };
                    placed = true;
                    break;
                }
            }
        }

        if (!placed) {
            plan.push({ slot: -1, stackWith: -1 }); // inventory full
        }
    }

    return plan;
}

// ─── Item placer with delay queue ────────────────────────────

function spawnQueue(tasks, idx, onDone) {
    if (idx >= tasks.length) {
        if (onDone) onDone(idx);
        return;
    }
    var task = tasks[idx];
    if (task.slot === -1) {
        msg("&cInventory full — stopped at " + idx + "/" + tasks.length);
        return;
    }

    try {
        createItem({
            id:          task.id,
            damage:      task.damage,
            count:       task.count,
            slot:        task.slot,
            name:        task.name,
            lore:        task.lore,
            unbreakable: task.unbreakable,
            glow:        task.glow,
            hideFlags:   task.hideFlags,
            hex:         task.hex,
            texture:     task.texture,
            itemModel:   task.itemModel,
            enchants:    task.enchants
        });
    } catch (err) {
        console.log("[mmimport] createItem error at " + idx + ": " + err);
        msg("&cError on item " + (idx+1) + " — see console.");
    }

    // Use a small delay between items to avoid packet flood / duplicate slots
    setTimeout(function() { spawnQueue(tasks, idx + 1, onDone); }, 40);
}

// ─── Path resolver ────────────────────────────────────────────

function resolvePath(pathArg) {
    var parts = ("" + pathArg).replace(/\\/g, "/").split("/");
    var file  = parts.pop() + ".mig";
    var dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    return { dir: dir, file: file, display: pathArg + ".mig" };
}

// ─── File reader (bypass FileLib "rf" prefix bug) ─────────────

function readFileSafe(dir, file) {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var abs  = base + "/config/ChatTriggers/modules/" + dir + "/" + file;
        var f    = new java.io.File(abs);
        var br   = new java.io.BufferedReader(new java.io.FileReader(f));
        var sb   = new java.lang.StringBuilder();
        var line;
        while ((line = br.readLine()) !== null) { sb.append(line); sb.append("\n"); }
        br.close();
        return "" + sb.toString();
    } catch(_) {
        return FileLib.read(dir, file) || null;
    }
}

// ─── /mmimport command ────────────────────────────────────────

register("command", function() {
    var args    = Array.prototype.slice.call(arguments);
    var pathArg = args[0] || Settings.defaultConfigFile;

    if (!pathArg) { msg("&cUsage: &f/mmimport &e<filename>"); return; }

    try {
        var resolved = resolvePath(pathArg);
        var content  = readFileSafe(resolved.dir, resolved.file);
        if (!content) { msg("&cFile not found: &e" + resolved.display); return; }

        // Validation
        var validation = validateMig(content);
        if (!validation.valid) {
            msg("&c\u2716 Cannot import — &e" + resolved.display + " &chas errors:");
            validation.errors.forEach(function(e) { msg("  &c\u2022 " + e); });
            return;
        }
        if (validation.warnings.length > 0) {
            msg("&e\u26a0 " + resolved.display + " has " + validation.warnings.length + " warning(s).");
        }

        // Parse — handles single or multi-ITEM blocks
        var migsArr = parseMIG(content);
        if (migsArr.length === 0) { msg("&cNo valid ITEM blocks found."); return; }

        var isMulti = migsArr.length > 1;

        // Build flat task list
        var tasks = [];

        migsArr.forEach(function(mig, blockIdx) {
            var itemCount = isMulti ? 1 : mig.amount; // multi-block: 1 per block

            for (var i = 0; i < itemCount; i++) {
                var globalI = isMulti ? blockIdx : i;

                var rawName = mig.names[i] !== undefined
                    ? mig.names[i]
                    : (mig.names.length > 0 ? mig.names[mig.names.length - 1] : "Item");
                var currentName = colorize("" + rawName);

                var finalStats = {};
                Object.keys(mig.stats).forEach(function(k) {
                    finalStats[k] = evaluateStat(mig.stats[k], globalI);
                });

                var finalLore = (mig.lore || []).map(function(line) {
                    var l = ("" + line)
                        .replace(/\{i\+1\}/g, "" + (globalI + 1))
                        .replace(/\{i\}/g,    "" + globalI);
                    Object.keys(finalStats).forEach(function(k) {
                        l = l.replace(new RegExp("\\{" + k + "\\}", "g"), finalStats[k]);
                    });
                    return colorize(l);
                });

                tasks.push({
                    id:          mig.itemId,
                    damage:      mig.damage,
                    count:       mig.count,
                    name:        currentName,
                    lore:        finalLore,
                    unbreakable: mig.unbreakable,
                    glow:        mig.glow,
                    hideFlags:   mig.hideFlags,
                    hex:         mig.hex,
                    texture:     mig.texture,
                    itemModel:   mig.itemModel,
                    enchants:    mig.enchants
                });
            }
        });

        if (tasks.length === 0) { msg("&cNo items to spawn."); return; }

        // Build slot plan ONCE before any placement
        var plan = buildSlotPlan(tasks);
        if (!plan) { msg("&cCould not read inventory."); return; }

        // Assign slots from plan
        for (var pi = 0; pi < tasks.length && pi < plan.length; pi++) {
            tasks[pi].slot = plan[pi].slot;
        }

        // Spawn all with delay
        spawnQueue(tasks, 0, function(placed) {
            msg("&aImported &e" + placed + "&a item(s) from &e" + resolved.display);
            if (placed > 0) {
                var firstName = migsArr[0].names[0] || pathArg;
                trackRecent(firstName, pathArg);
            }
        });

    } catch (e) {
        msg("&cError: " + e);
        console.log("[mmimport] fatal: " + e + "\n" + (e.stack || ""));
    }

}).setName("mmimport");