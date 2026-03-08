// ============================================================
//  Morgen — src/migValidator.js
//  Validates a .mig file before import:
//   - required fields
//   - bracket balance
//   - stat function syntax
//   - lore line length
// ============================================================

var REQUIRED_FIELDS = ["ITEM", "Name", "Lore"];
var STAT_FUNCTIONS  = ["linear", "exp", "list", "static", "round"];

// ─── Strip comments (respects quoted strings) ─────────────────

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

// ─── Bracket balance check ────────────────────────────────────

function checkBrackets(src) {
    var errors = [];
    var lines  = src.split("\n");
    var curlies = 0, squares = 0, parens = 0;
    var inQ = false;

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
    if (curlies > 0) errors.push("Unclosed { brace (" + curlies + " missing })");
    if (squares > 0) errors.push("Unclosed [ bracket (" + squares + " missing ])");
    if (parens  > 0) errors.push("Unclosed ( paren ("   + parens  + " missing ))");
    return errors;
}

// ─── Stat function syntax ────────────────────────────────────

function checkStatFunctions(src) {
    var errors = [];
    var statBlock = src.match(/Stats\s*\{([\s\S]*?)\}/);
    if (!statBlock) return errors;
    var lines = statBlock[1].split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var c = line.indexOf(":");
        if (c === -1) { errors.push("Stats line " + (i+1) + " missing colon: \"" + line + "\""); continue; }
        var val = line.slice(c + 1).trim();
        // Check if it looks like a function
        var fnMatch = val.match(/^(\w+)\((.+)\)$/);
        if (fnMatch) {
            var fnName = fnMatch[1].toLowerCase();
            if (STAT_FUNCTIONS.indexOf(fnName) === -1) {
                errors.push("Stats line " + (i+1) + ": unknown function \"" + fnName + "\" (valid: " + STAT_FUNCTIONS.join(", ") + ")");
            }
            // Check args are comma-separated non-empty
            var args = fnMatch[2].split(",").map(function(s){return s.trim();});
            if (args.some(function(a){return a === "";})) {
                errors.push("Stats line " + (i+1) + ": empty argument in " + fnName + "()");
            }
            // linear/exp need exactly 2 numeric args
            if ((fnName === "linear" || fnName === "exp") && args.length !== 2) {
                errors.push("Stats line " + (i+1) + ": " + fnName + "() needs exactly 2 args, got " + args.length);
            }
        }
    }
    return errors;
}

// ─── Required field check ─────────────────────────────────────

function checkRequiredFields(src) {
    var errors = [];
    if (!/ITEM\s+"[^"]+"/.test(src))           errors.push("Missing ITEM \"id\" declaration");
    if (!/^\s*Name:/m.test(src))               errors.push("Missing required field: Name");
    if (!/Lore\s*:\s*\[/m.test(src))           errors.push("Missing required field: Lore");
    return errors;
}

// ─── Lore line length ─────────────────────────────────────────

function checkLoreLines(src) {
    var warnings = [];
    var loreStart = src.indexOf("Lore:");
    if (loreStart === -1) return warnings;
    var loreSection = src.slice(loreStart);
    var loreMatches = loreSection.match(/"((?:[^"\\]|\\.)*)"/g);
    if (!loreMatches) return warnings;
    loreMatches.forEach(function(m, i) {
        var raw = m.slice(1, -1).replace(/&[0-9a-fk-or]/gi, "").replace(/\\"/g, '"');
        if (raw.length > 50) {
            warnings.push("Lore line " + (i+1) + " may be too long (" + raw.length + " visible chars, max ~50): \"" + raw.substring(0,30) + "...\"");
        }
    });
    return warnings;
}

// ─── Main validate ────────────────────────────────────────────

/**
 * Validates raw .mig content.
 * Returns { valid: bool, errors: string[], warnings: string[] }
 */
export function validateMig(raw) {
    var clean    = stripComments(raw);
    var errors   = [];
    var warnings = [];

    errors   = errors.concat(checkRequiredFields(clean));
    errors   = errors.concat(checkBrackets(clean));
    errors   = errors.concat(checkStatFunctions(clean));
    warnings = warnings.concat(checkLoreLines(clean));

    return {
        valid:    errors.length === 0,
        errors:   errors,
        warnings: warnings
    };
}

/**
 * Validates a .mig file by path and prints results to chat.
 * Returns true if valid, false if errors found.
 */
export function validateAndReport(pathArg, msg) {
    var parts = ("" + pathArg).replace(/\\/g, "/").split("/");
    var file  = parts.pop();
    var dir   = "Morgen/imports" + (parts.length ? "/" + parts.join("/") : "");
    if (!file.endsWith(".mig")) file += ".mig";
    var raw;
    try { raw = FileLib.read(dir, file); } catch (e) {
        msg("&cCould not read file: &e" + pathArg);
        return false;
    }
    if (!raw) { msg("&cFile not found: &e" + pathArg); return false; }

    var result = validateMig(raw);

    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    msg("&6&l✦ MIG Validator &8— &f" + file);
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));

    if (result.errors.length === 0 && result.warnings.length === 0) {
        msg("&a✔ File is valid! No issues found.");
    } else {
        if (result.errors.length > 0) {
            msg("&c✖ " + result.errors.length + " error" + (result.errors.length !== 1 ? "s" : "") + ":");
            result.errors.forEach(function(e) { msg("  &c• " + e); });
        }
        if (result.warnings.length > 0) {
            msg("&e⚠ " + result.warnings.length + " warning" + (result.warnings.length !== 1 ? "s" : "") + ":");
            result.warnings.forEach(function(w) { msg("  &e• " + w); });
        }
    }
    ChatLib.chat(ChatLib.addColor("&8&m──────────────────────────────"));
    return result.valid;
}
