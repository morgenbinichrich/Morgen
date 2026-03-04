// ============================================================
//  Morgen — giveCommand.js   (/mg)
// ============================================================

import { getNextEmptySlot, createItem, colorize, formatStat, msg } from "../../utils/utils";
import Settings from "../../utils/config";

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

// Split "a","b","c" by comma, respecting quoted strings
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
        // Strip surrounding whitespace and quotes (single or double, one layer)
        s = s.trim();
        if ((s[0] === '"' && s[s.length-1] === '"') ||
            (s[0] === "'" && s[s.length-1] === "'")) {
            s = s.slice(1, -1);
        }
        return s;
    }).filter(function(s) { return s.length > 0; });
}

// Extract content inside the FIRST balanced () after keyword
function extractParens(str, keyword) {
    var ki = str.indexOf(keyword);
    if (ki === -1) return null;
    var start = str.indexOf("(", ki);
    if (start === -1) return null;
    var depth = 0, result = "";
    for (var i = start; i < str.length; i++) {
        if (str[i] === "(") depth++;
        else if (str[i] === ")") {
            if (--depth === 0) break;
        }
        if (i > start) result += str[i];
    }
    return result;
}

// Extract content inside the FIRST balanced [] after keyword
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

// Strip # comments without touching quoted strings
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

// ─── .mig parser ─────────────────────────────────────────────

function parseMIG(raw) {
    var clean = stripComments(raw);

    // Simple field extractors
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

    // ── Names ─────────────────────────────────────────────────
    // Match ONLY the Name: line (not ItemModel etc.) using ^ anchor
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
            // plain: Name: "value"
            var nameQ = nameVal.match(/^"([^"]*)"$/);
            if (nameQ) names = [nameQ[1]];
            else if (nameVal) names = [nameVal];
        }
    }

    console.log("[parseMIG] names = " + JSON.stringify(names));

    // ── Enchants ──────────────────────────────────────────────
    var enchants = null;
    var enchMatch = clean.match(/^\s*Enchants:\s*(\[[\s\S]*?\])/m);
    if (enchMatch) { try { enchants = JSON.parse(enchMatch[1]); } catch (_) {} }

    // ── Stats ─────────────────────────────────────────────────
    var stats = {};
    var statBlock = clean.match(/^\s*Stats\s*\{([\s\S]*?)\}/m);
    if (statBlock) {
        statBlock[1].split("\n").forEach(function(line) {
            line = line.trim();
            if (!line) return;
            var c = line.indexOf(":");
            if (c === -1) return;
            stats[line.slice(0, c).trim()] = line.slice(c + 1).trim();
        });
    }

    // ── Lore ──────────────────────────────────────────────────
    var lore = [];
    var loreContent = extractBrackets(clean, "Lore:");
    if (loreContent !== null) {
        if (loreContent.indexOf("list(") !== -1) {
            var loreInner = extractParens(loreContent, "list");
            if (loreInner !== null) lore = splitQuoted(loreInner);
        } else {
            lore = loreContent.split("\n")
                .map(function(l) {
                    l = l.trim();
                    if ((l[0] === '"' && l[l.length-1] === '"') ||
                        (l[0] === "'" && l[l.length-1] === "'")) {
                        l = l.slice(1, -1);
                    }
                    return l;
                })
                .filter(function(l) { return l.length > 0; });
        }
    }

    console.log("[parseMIG] lore lines = " + lore.length);

    return { itemId, damage, amount, count, hideFlags, hex, texture,
             itemModel, unbreakable, glow, names, enchants, stats, lore };
}

// ─── Path resolver ────────────────────────────────────────────

function resolvePath(pathArg) {
    var parts = ("" + pathArg).replace(/\\/g, "/").split("/");
    var file  = parts.pop() + ".mig";
    var dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    return { dir: dir, file: file, display: pathArg + ".mig" };
}

// ─── /mg command ─────────────────────────────────────────────

register("command", function() {
    var args    = Array.prototype.slice.call(arguments);
    var pathArg = args[0] || Settings.defaultConfigFile;

    if (!pathArg) {
        msg("&cUsage: &f/mg &e<filename>");
        return;
    }

    try {
        var resolved = resolvePath(pathArg);
        var content  = FileLib.read(resolved.dir, resolved.file);
        if (!content) {
            msg("&cFile not found: &e" + resolved.display);
            return;
        }

        var mig = parseMIG(content);
        var nextSlot = 36, generated = 0;

        for (var i = 0; i < mig.amount; i++) {
            var targetSlot = getNextEmptySlot(nextSlot);
            if (targetSlot === -1) {
                msg("&cInventory full — placed " + generated + "/" + mig.amount);
                break;
            }

            // Safe name lookup with fallback
            var rawName = mig.names[i] !== undefined
                ? mig.names[i]
                : (mig.names.length > 0 ? mig.names[mig.names.length - 1] : "Item");

            var currentName = colorize("" + rawName);

            // Evaluate stats for index i
            var finalStats = {};
            Object.keys(mig.stats).forEach(function(k) {
                finalStats[k] = evaluateStat(mig.stats[k], i);
            });

            // Resolve lore placeholders
            var finalLore = (mig.lore || []).map(function(line) {
                var l = ("" + line)
                    .replace(/\{i\+1\}/g, "" + (i + 1))
                    .replace(/\{i\}/g, "" + i);
                Object.keys(finalStats).forEach(function(k) {
                    l = l.replace(new RegExp("\\{" + k + "\\}", "g"), finalStats[k]);
                });
                return colorize(l);
            });

            try {
                createItem({
                    id:          mig.itemId,
                    damage:      mig.damage,
                    count:       mig.count,
                    slot:        targetSlot,
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
                generated++;
                nextSlot = targetSlot + 1;
            } catch (err) {
                console.log("[mg] createItem error at i=" + i + ": " + err);
                msg("&cError on item " + (i + 1) + " — see console.");
            }
        }

        msg("&aGenerated &e" + generated + "&a item(s) from &e" + resolved.display);

    } catch (e) {
        msg("&cError: " + e);
        console.log("[mg] fatal: " + e + "\n" + (e.stack || ""));
    }

}).setName("mg");