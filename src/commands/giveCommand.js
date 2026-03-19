import { createItem, colorize, formatStat, msg } from "../../utils/utils";
import Settings from "../../utils/config";

var recentItems = [], MAX_RECENT = 10;

function pushRecent(name, path) {
    recentItems = recentItems.filter(function(r) { return r.path !== path; });
    recentItems.unshift({ name: name, path: path, time: Date.now() });
    if (recentItems.length > MAX_RECENT) recentItems = recentItems.slice(0, MAX_RECENT);
    try {
        var base = new java.io.File(".").getCanonicalPath();
        new java.io.File(base + "/config/ChatTriggers/modules/Morgen/config").mkdirs();
        FileLib.write("Morgen/config", "recent.json", JSON.stringify(recentItems));
    } catch (_) {}
}

function loadRecent() {
    try {
        var r = FileLib.read("Morgen/config", "recent.json");
        if (r) recentItems = JSON.parse(r);
    } catch (_) {}
}
loadRecent();

export function trackRecent(name, path) { pushRecent(name, path); }
export function getRecentItems() { return recentItems; }

var STAT_FUNCTIONS = ["linear", "exp", "list", "static", "round"];

function stripMigComments(raw) {
    return raw.split("\n").map(function(line) {
        var inQ = false;
        for (var i = 0; i < line.length; i++) {
            if (line[i] === '"') inQ = !inQ;
            if (!inQ && line[i] === "#") return line.slice(0, i);
        }
        return line;
    }).join("\n");
}

function checkBrackets(src) {
    var errors = [], lines = src.split("\n");
    var curlies = 0, squares = 0, parens = 0, inQ = false;
    for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        for (var ci = 0; ci < line.length; ci++) {
            var ch = line[ci];
            if (ch === '"') { inQ = !inQ; continue; }
            if (inQ) continue;
            if (ch === "{") curlies++;
            else if (ch === "}") { curlies--; if (curlies < 0) errors.push("Line " + (li+1) + ": unexpected }"); }
            else if (ch === "[") squares++;
            else if (ch === "]") { squares--; if (squares < 0) errors.push("Line " + (li+1) + ": unexpected ]"); }
            else if (ch === "(") parens++;
            else if (ch === ")") { parens--; if (parens < 0) errors.push("Line " + (li+1) + ": unexpected )"); }
        }
    }
    if (curlies > 0) errors.push("Unclosed { (" + curlies + " missing })");
    if (squares > 0) errors.push("Unclosed [ (" + squares + " missing ])");
    if (parens  > 0) errors.push("Unclosed ( (" + parens  + " missing ))");
    return errors;
}

function checkStatFunctions(src) {
    var errors = [], statBlock = src.match(/Stats\s*\{([\s\S]*?)\}/);
    if (!statBlock) return errors;
    statBlock[1].split("\n").forEach(function(line, i) {
        line = line.trim(); if (!line) return;
        var c = line.indexOf(":");
        if (c === -1) { errors.push("Stats line " + (i+1) + " missing colon"); return; }
        var fn = line.slice(c+1).trim().match(/^(\w+)\((.+)\)$/);
        if (!fn) return;
        var name = fn[1].toLowerCase();
        if (STAT_FUNCTIONS.indexOf(name) === -1)
            errors.push("Stats line " + (i+1) + ": unknown function \"" + name + "\"");
        var args = fn[2].split(",").map(function(s) { return s.trim(); });
        if (args.some(function(a) { return a === ""; }))
            errors.push("Stats line " + (i+1) + ": empty argument in " + name + "()");
        if ((name === "linear" || name === "exp") && args.length !== 2)
            errors.push("Stats line " + (i+1) + ": " + name + "() needs 2 args, got " + args.length);
    });
    return errors;
}

function checkLoreLines(src) {
    var warnings = [];

    // Find the Lore: [ ... ] block precisely — don't scan the whole file
    // (SkullOwnerJSON / ExtraAttributesJSON / Texture strings are NOT lore)
    var loreStart = src.indexOf("Lore:");
    if (loreStart === -1) return warnings;

    // Find the opening bracket
    var bracketOpen = src.indexOf("[", loreStart);
    if (bracketOpen === -1) return warnings;

    // Find the matching closing bracket
    var depth = 0, bracketClose = -1;
    var inQ = false;
    for (var ci = bracketOpen; ci < src.length; ci++) {
        var ch = src[ci];
        if (ch === '"' && src[ci-1] !== '\\') inQ = !inQ;
        if (!inQ) {
            if (ch === "[") depth++;
            else if (ch === "]") { depth--; if (depth === 0) { bracketClose = ci; break; } }
        }
    }
    if (bracketClose === -1) return warnings;

    var loreBlock = src.slice(bracketOpen + 1, bracketClose);
    var ms = loreBlock.match(/"((?:[^"\\]|\\.)*)"/g);
    if (!ms) return warnings;

    ms.forEach(function(m, i) {
        // Strip color codes before measuring length
        var raw = m.slice(1, -1).replace(/&[0-9a-fk-or]/gi, "").replace(/\\"/g, '"');
        if (raw.length > 100)
            warnings.push("Lore line " + (i+1) + " may be too long (" + raw.length + " chars)");
    });
    return warnings;
}

export function validateMig(raw) {
    var clean = stripMigComments(raw);
    var errors = [], warnings = [];
    if (!/ITEM\s+"[^"]+"/.test(clean)) errors.push("Missing ITEM \"id\" declaration");
    if (!/^\s*Name:/m.test(clean))     errors.push("Missing required field: Name");
    if (!/Lore\s*:\s*\[/m.test(clean)) errors.push("Missing required field: Lore");
    errors   = errors.concat(checkBrackets(clean)).concat(checkStatFunctions(clean));
    warnings = warnings.concat(checkLoreLines(clean));
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

export function validateAndReport(pathArg, msgFn) {
    var parts = ("" + pathArg).replace(/\\/g, "/").split("/");
    var file  = parts.pop();
    var dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    if (!file.endsWith(".mig")) file += ".mig";
    var raw;
    try { raw = FileLib.read(dir, file); } catch(e) { msgFn("&cCould not read: " + pathArg); return false; }
    if (!raw) { msgFn("&cFile not found: " + pathArg); return false; }
    var result = validateMig(raw);
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    msgFn("&6Validator &8— &f" + file);
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    if (result.errors.length === 0 && result.warnings.length === 0) {
        msgFn("&a✔ Valid — no issues found.");
    } else {
        result.errors.forEach(function(e)   { msgFn("  &c✖ " + e); });
        result.warnings.forEach(function(w) { msgFn("  &e⚠ " + w); });
    }
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    return result.valid;
}

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
        if ((s[0]==='"'&&s[s.length-1]==='"')||(s[0]==="'"&&s[s.length-1]==="'")) s = s.slice(1,-1);
        return s;
    }).filter(function(s) { return s.length > 0; });
}

function extractParens(str, keyword) {
    var ki = str.indexOf(keyword); if (ki === -1) return null;
    var start = str.indexOf("(", ki); if (start === -1) return null;
    var depth = 0, result = "";
    for (var i = start; i < str.length; i++) {
        if (str[i] === "(") depth++;
        else if (str[i] === ")") { if (--depth === 0) break; }
        if (i > start) result += str[i];
    }
    return result;
}

function extractBrackets(str, keyword) {
    var ki = str.indexOf(keyword); if (ki === -1) return null;
    var start = str.indexOf("[", ki); if (start === -1) return null;
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

function tryParseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch(_) { return null; }
}

function parseOneBlock(blockText) {
    var clean = stripMigComments(blockText);
    function field(regex, def)    { var m = clean.match(regex); return m ? m[1].trim() : def; }
    function fieldInt(regex, def) { var v = field(regex, null); return v !== null ? parseInt(v) : def; }
    function fieldBool(regex, def){ var v = field(regex, null); if (v===null) return def; return v.toLowerCase()==="true"||v==="1"; }

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

    // ── SkullOwnerJSON — full SkullOwner compound stored as JSON ─────────
    var skullOwner = null;
    var soLine = clean.match(/^\s*SkullOwnerJSON:\s*(\{[\s\S]+?\})\s*$/m);
    if (soLine) skullOwner = tryParseJSON(soLine[1]);

    // ── ExtraAttributesJSON — full ExtraAttributes compound stored as JSON
    var extraAttributes = null;
    var eaLine = clean.match(/^\s*ExtraAttributesJSON:\s*(\{[\s\S]+?\})\s*$/m);
    if (eaLine) extraAttributes = tryParseJSON(eaLine[1]);

    var hexes = [hex];
    var hexLineMatch = clean.match(/^\s*Hex:\s*(.+)$/m);
    if (hexLineMatch && hexLineMatch[1].indexOf("list(") !== -1) {
        var hexInner = extractParens(hexLineMatch[1], "list");
        if (hexInner !== null) {
            var parsedHexes = splitQuoted(hexInner);
            if (parsedHexes.length > 0) hexes = parsedHexes;
        }
    }

    var names = ["Item"];
    var nameLineMatch = clean.match(/^\s*Name:\s*(.+)$/m);
    if (nameLineMatch) {
        var nameVal = nameLineMatch[1].trim();
        if (nameVal.indexOf("list(") !== -1) {
            var nameInner = extractParens(nameVal, "list");
            if (nameInner !== null) { var p = splitQuoted(nameInner); if (p.length > 0) names = p; }
        } else {
            var nameQ = nameVal.match(/^"([^"]*)"$/);
            if (nameQ) names = [nameQ[1]];
            else if (nameVal) names = [nameVal];
        }
    }

    var enchants = null;
    var enchMatch = clean.match(/^\s*Enchants:\s*(\[[\s\S]*?\])/m);
    if (enchMatch) { try { enchants = JSON.parse(enchMatch[1]); } catch(_) {} }

    var stats = {};
    var statBlock = clean.match(/^\s*Stats\s*\{([\s\S]*?)\}/m);
    if (statBlock) {
        statBlock[1].split("\n").forEach(function(line) {
            line = line.trim(); if (!line) return;
            var c = line.indexOf(":");
            if (c !== -1) stats[line.slice(0, c).trim()] = line.slice(c+1).trim();
        });
    }

    var lore = [];
    var loreContent = extractBrackets(clean, "Lore:");
    if (loreContent !== null) {
        if (loreContent.indexOf("list(") !== -1) {
            var loreInner = extractParens(loreContent, "list");
            if (loreInner !== null) lore = splitQuoted(loreInner);
        } else {
            loreContent.split("\n").forEach(function(l) {
                l = l.trim(); if (!l) return;
                if ((l[0]==='"'&&l[l.length-1]==='"')||(l[0]==="'"&&l[l.length-1]==="'")) l = l.slice(1,-1);
                if (l.length > 0) lore.push(l);
            });
        }
    }

    return {
        itemId, damage, amount, count, hideFlags, hex, hexes, texture, itemModel,
        unbreakable, glow, names, enchants, stats, lore,
        skullOwner, extraAttributes   // ← new fields
    };
}

function parseMIG(raw) {
    var clean = stripMigComments(raw);
    var blockStarts = [], re = /ITEM\s+"[^"]+"\s*\{/g, m;
    while ((m = re.exec(clean)) !== null) blockStarts.push(m.index);
    if (blockStarts.length === 0) return [];
    var blocks = [];
    for (var bi = 0; bi < blockStarts.length; bi++) {
        var start = blockStarts[bi];
        var braceStart = clean.indexOf("{", start); if (braceStart === -1) continue;
        var depth = 0, end = braceStart;
        for (var ci = braceStart; ci < clean.length; ci++) {
            if (clean[ci] === "{") depth++;
            else if (clean[ci] === "}") { depth--; if (depth === 0) { end = ci; break; } }
        }
        blocks.push(clean.slice(start, end+1));
    }
    return blocks.map(parseOneBlock);
}

function buildSlotPlan(items) {
    var inv = Player.getInventory(); if (!inv) return null;

    // CT's Player.getInventory().getStackInSlot() uses these indices:
    //   0-8   = hotbar slots (displayed as slots 1-9 in hotbar)
    //   9-35  = main inventory
    //   36-39 = armor slots
    // The C10 creative packet uses a DIFFERENT numbering:
    //   36-44 = hotbar slots 1-9
    //   9-35  = main inventory
    // So to CHECK if a hotbar slot is occupied we read index 0-8,
    // but to SEND the packet we use index 36-44.

    // Build virtual snapshot: key = PACKET slot (36-44 hotbar, 9-35 inventory)
    var virtual = {};

    // Hotbar: read slots 0-8 from CT inventory, map to packet slots 36-44
    for (var h = 0; h <= 8; h++) {
        var packetSlot = 36 + h;
        try {
            var hstack = inv.getStackInSlot(h);
            if (hstack && hstack.getID() !== 0) {
                virtual[packetSlot] = { empty: false };
            } else {
                virtual[packetSlot] = { empty: true };
            }
        } catch(_) { virtual[packetSlot] = { empty: true }; }
    }

    // Main inventory: read slots 9-35 (same in both CT and packet)
    for (var m = 9; m <= 35; m++) {
        try {
            var mstack = inv.getStackInSlot(m);
            if (mstack && mstack.getID() !== 0) {
                virtual[m] = { id: ""+mstack.getRegistryName(), damage: mstack.getMetadata?mstack.getMetadata():0,
                               name: ""+mstack.getName(), count: mstack.getStackSize()||1, maxStack: 64, empty: false };
            } else { virtual[m] = { empty: true, count: 0 }; }
        } catch(_) { virtual[m] = { empty: true, count: 0 }; }
    }

    if (Settings.spawnIntoHotbar) {
        var baseIndex = (Settings.hotbarSlot || 1) - 1; // 0-based hotbar index
        var plan = [];
        for (var ii = 0; ii < items.length; ii++) {
            var item = items[ii], placed = false;

            // Try hotbar packet slots 36-44, starting from baseIndex, skipping occupied
            for (var offset = 0; offset < 9; offset++) {
                var hotbarIdx  = (baseIndex + offset) % 9;
                var hotbarSlot = 36 + hotbarIdx; // packet slot
                if (virtual[hotbarSlot] && virtual[hotbarSlot].empty) {
                    plan.push({ slot: hotbarSlot, stackWith: -1 });
                    virtual[hotbarSlot] = { empty: false };
                    baseIndex = (hotbarIdx + 1) % 9;
                    placed = true;
                    break;
                }
            }

            // Hotbar full: fall through to main inventory 9-35
            if (!placed) {
                for (var s3 = 9; s3 <= 35; s3++) {
                    if (virtual[s3] && virtual[s3].empty) {
                        plan.push({ slot: s3, stackWith: -1 });
                        virtual[s3] = { empty: false };
                        placed = true; break;
                    }
                }
            }

            if (!placed) plan.push({ slot: -1, stackWith: -1 });
        }
        return plan;
    }

    // Normal mode: try stacking, then first empty slot (inventory first, hotbar last)
    var plan = [];
    for (var ii = 0; ii < items.length; ii++) {
        var item = items[ii], placed = false;
        // Try stacking onto matching existing stack in main inventory
        for (var s2 = 9; s2 <= 35; s2++) {
            var vs = virtual[s2];
            if (!vs || vs.empty) continue;
            if (vs.id===item.id && vs.damage===item.damage && vs.name===item.name &&
                vs.count < vs.maxStack && vs.count+item.count <= vs.maxStack) {
                plan.push({ slot: s2, stackWith: s2 }); vs.count += item.count; placed = true; break;
            }
        }
        // First empty slot in main inventory
        if (!placed) {
            for (var s4 = 9; s4 <= 35; s4++) {
                if (virtual[s4] && virtual[s4].empty) {
                    plan.push({ slot: s4, stackWith: -1 });
                    virtual[s4] = { empty: false };
                    placed = true; break;
                }
            }
        }
        // Fall back to hotbar if inventory full
        if (!placed) {
            for (var s5 = 36; s5 <= 44; s5++) {
                if (virtual[s5] && virtual[s5].empty) {
                    plan.push({ slot: s5, stackWith: -1 });
                    virtual[s5] = { empty: false };
                    placed = true; break;
                }
            }
        }
        if (!placed) plan.push({ slot: -1, stackWith: -1 });
    }
    return plan;
}

function spawnQueue(tasks, idx, onDone) {
    if (idx >= tasks.length) { if (onDone) onDone(idx); return; }
    var task = tasks[idx];
    if (task.slot === -1) { msg("&cInventory full — stopped at " + idx + "/" + tasks.length); return; }
    try {
        createItem({
            id:              task.id,
            damage:          task.damage,
            count:           task.count,
            slot:            task.slot,
            name:            task.name,
            lore:            task.lore,
            unbreakable:     task.unbreakable,
            glow:            task.glow,
            hideFlags:       task.hideFlags,
            hex:             task.hex,
            texture:         task.texture,
            itemModel:       task.itemModel,
            enchants:        task.enchants,
            skullOwner:      task.skullOwner      || null,   // ← new
            extraAttributes: task.extraAttributes || null    // ← new
        });
    } catch(err) {
        console.log("[mmimport] error at " + idx + ": " + err);
        msg("&cError on item " + (idx+1) + " — see console.");
    }
    setTimeout(function() { spawnQueue(tasks, idx+1, onDone); }, 120);
}

function readFileSafe(dir, file) {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var f    = new java.io.File(base + "/config/ChatTriggers/modules/" + dir + "/" + file);
        var br   = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(f), "UTF-8"));
        var sb   = new java.lang.StringBuilder(), line;
        while ((line = br.readLine()) !== null) { sb.append(line); sb.append("\n"); }
        br.close();
        return "" + sb.toString();
    } catch(_) { return FileLib.read(dir, file) || null; }
}

function resolveFile(pathArg) {
    var clean = (""+pathArg).replace(/\\/g, "/");
    var parts = clean.split("/");
    var name  = parts.pop();
    var dir   = "Morgen/imports" + (parts.length ? "/"+parts.join("/") : "");

    var hasMigExt  = name.endsWith(".mig");
    var hasJsonExt = name.endsWith(".json");

    if (hasMigExt || hasJsonExt) {
        var content = readFileSafe(dir, name);
        if (content) return { dir: dir, file: name, content: content, display: pathArg };
        return null;
    }

    var migContent = readFileSafe(dir, name + ".mig");
    if (migContent) return { dir: dir, file: name+".mig", content: migContent, display: pathArg+".mig" };

    var jsonContent = readFileSafe(dir, name + ".json");
    if (jsonContent) return { dir: dir, file: name+".json", content: jsonContent, display: pathArg+".json" };

    return null;
}

function tasksFromJson(content, pathArg) {
    var parsed;
    try { parsed = JSON.parse(content); } catch(e) { msg("&cInvalid JSON: " + e); return null; }

    if (parsed.itemId) {
        var d = parsed;
        var lore = (d.lore || []).map(function(l) {
            return colorize((""+l).replace(/&([0-9a-fk-or])/gi, "\u00a7$1"));
        });
        var enchants = (d.enchants || []).map(function(e) { return { id: e.id, lvl: e.lvl }; });
        if (d.glow) enchants.push({ id: 0, lvl: 1 });

        // Resolve skullOwner: prefer skullOwner JSON blob, fallback to bare texture
        var skullOwner = d.skullOwner || null;
        if (!skullOwner && d.texture) {
            skullOwner = {
                Id: "00000000-0000-0000-0000-000000000000",
                Properties: { textures: { 0: { Value: d.texture } } }
            };
        }

        return [{
            id:              d.itemId,
            damage:          d.damage      || 0,
            count:           d.count       || 1,
            name:            colorize((""+d.name).replace(/&([0-9a-fk-or])/gi, "\u00a7$1")),
            lore:            lore,
            unbreakable:     !!d.unbreakable,
            glow:            false,
            hideFlags:       d.hideFlags   !== undefined ? d.hideFlags : Settings.defaultHideFlags,
            hex:             d.hex         || null,
            texture:         d.texture     || null,
            itemModel:       d.itemModel   || null,
            enchants:        enchants,
            skullOwner:      skullOwner,
            extraAttributes: d.extraAttributes || null,
            _firstName:      d.name || pathArg
        }];
    }

    if (parsed.item) {
        var nbtStr = parsed.item;
        var idM    = nbtStr.match(/id:"([^"]+)"/);
        var cntM   = nbtStr.match(/Count:(\d+)/);
        var damM   = nbtStr.match(/Damage:(\d+)/);
        var nameM  = nbtStr.match(/Name:"([^"]*)"/);
        var texM   = nbtStr.match(/Value:"([^"]{10,})"/);
        var hfM    = nbtStr.match(/HideFlags:(\d+)/);
        var colM   = nbtStr.match(/color:(\d+)/);

        var loreLines = [];
        var loreM = nbtStr.match(/Lore:\[([^\]]*)\]/);
        if (loreM) {
            var lMatches = loreM[1].match(/\d+:"((?:[^"\\]|\\.)*?)"/g);
            if (lMatches) loreLines = lMatches.map(function(s) {
                return colorize(s.replace(/^\d+:"|"$/g,"").replace(/\\u00a7/g,"&").replace(/\u00a7/g,"&").replace(/&([0-9a-fk-or])/gi,"\u00a7$1"));
            });
        }

        var hexVal = null;
        if (colM) hexVal = "#" + parseInt(colM[1]).toString(16).toUpperCase().padStart(6,"0");

        return [{
            id:              idM   ? idM[1]            : "minecraft:stone",
            damage:          damM  ? parseInt(damM[1]) : 0,
            count:           cntM  ? parseInt(cntM[1]) : 1,
            name:            nameM ? colorize(nameM[1].replace(/\\u00a7/g,"\u00a7")) : "",
            lore:            loreLines,
            unbreakable:     false,
            glow:            false,
            hideFlags:       hfM   ? parseInt(hfM[1])  : Settings.defaultHideFlags,
            hex:             hexVal,
            texture:         texM  ? texM[1]           : null,
            itemModel:       null,
            enchants:        [],
            skullOwner:      null,
            extraAttributes: null,
            _firstName:      pathArg
        }];
    }

    if (Array.isArray(parsed)) {
        var tasks = [];
        parsed.forEach(function(entry) {
            var sub = tasksFromJson(JSON.stringify(entry), pathArg);
            if (sub) tasks = tasks.concat(sub);
        });
        return tasks.length > 0 ? tasks : null;
    }

    msg("&cUnrecognised JSON format. Supported: Morgen native, NBT-string {item:...}, or array of items.");
    return null;
}

register("command", function() {
    var args    = Array.prototype.slice.call(arguments);
    var pathArg = (args.length > 0 ? args.join(" ") : null) || Settings.defaultConfigFile;
    if (!pathArg) { msg("&cUsage: &f/mmimport &e<filename>"); return; }

    try {
        var resolved = resolveFile(pathArg);
        if (!resolved) { msg("&cFile not found: &e" + pathArg + " &8(.mig or .json)"); return; }

        var tasks = [];
        var firstName = pathArg;

        if (resolved.file.endsWith(".json")) {
            var jsonTasks = tasksFromJson(resolved.content, pathArg);
            if (!jsonTasks) return;
            tasks     = jsonTasks;
            firstName = jsonTasks[0] && jsonTasks[0]._firstName ? jsonTasks[0]._firstName : pathArg;
        } else {
            var validation = validateMig(resolved.content);
            if (!validation.valid) {
                msg("&c✖ Cannot import — " + resolved.display + " has errors:");
                validation.errors.forEach(function(e) { msg("  &c• " + e); });
                return;
            }
            if (validation.warnings.length > 0)
                msg("&e⚠ " + validation.warnings.length + " warning(s) in " + resolved.display);

            var migsArr = parseMIG(resolved.content);
            if (migsArr.length === 0) { msg("&cNo valid ITEM blocks found."); return; }

            var isMulti = migsArr.length > 1;
            firstName   = migsArr[0].names[0] || pathArg;

            migsArr.forEach(function(mig, blockIdx) {
                var itemCount = isMulti ? 1 : mig.amount;
                for (var i = 0; i < itemCount; i++) {
                    var globalI    = isMulti ? blockIdx : i;
                    var rawName    = mig.names[i] !== undefined ? mig.names[i] : mig.names[mig.names.length-1];
                    var finalStats = {};
                    Object.keys(mig.stats).forEach(function(k) { finalStats[k] = evaluateStat(mig.stats[k], globalI); });
                    var finalLore  = (mig.lore||[]).map(function(line) {
                        var l = (""+line).replace(/\{i\+1\}/g, ""+(globalI+1)).replace(/\{i\}/g, ""+globalI);
                        Object.keys(finalStats).forEach(function(k) {
                            l = l.replace(new RegExp("\\{"+k+"\\}", "g"), finalStats[k]);
                        });
                        return colorize(l);
                    });
                    var finalHex = mig.hexes && mig.hexes.length > 0
                        ? (mig.hexes[i] !== undefined ? mig.hexes[i] : mig.hexes[mig.hexes.length-1])
                        : mig.hex;

                    // Resolve skullOwner: prefer full SkullOwnerJSON, fallback to Texture field
                    var resolvedSkullOwner = mig.skullOwner || null;
                    if (!resolvedSkullOwner && mig.texture) {
                        resolvedSkullOwner = {
                            Id: "00000000-0000-0000-0000-000000000000",
                            Properties: { textures: { 0: { Value: mig.texture } } }
                        };
                    }

                    tasks.push({
                        id:              mig.itemId,
                        damage:          mig.damage,
                        count:           mig.count,
                        name:            colorize(""+rawName),
                        lore:            finalLore,
                        unbreakable:     mig.unbreakable,
                        glow:            mig.glow,
                        hideFlags:       mig.hideFlags,
                        hex:             finalHex,
                        texture:         mig.texture,
                        itemModel:       mig.itemModel,
                        enchants:        mig.enchants,
                        skullOwner:      resolvedSkullOwner,       // ← full compound
                        extraAttributes: mig.extraAttributes || null  // ← extra data
                    });
                }
            });
        }

        if (tasks.length === 0) { msg("&cNo items to spawn."); return; }

        var plan = buildSlotPlan(tasks);
        if (!plan) { msg("&cCould not read inventory."); return; }
        for (var pi = 0; pi < tasks.length && pi < plan.length; pi++)
            tasks[pi].slot = plan[pi].slot;

        spawnQueue(tasks, 0, function(placed) {
            if (placed > 0) pushRecent(firstName, pathArg);
        });

    } catch(e) {
        msg("&cError: " + e);
        console.log("[mmimport] fatal: " + e + "\n" + (e.stack || ""));
    }
}).setName("mmimport");