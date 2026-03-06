// ============================================================
//  Morgen — src/commands/aiCommand.js   v4  (REWRITE)
//
//  COMMANDS:
//    /mm ai key <KEY>             — save Gemini API key
//    /mm ai ref1                  — set held item as reference 1
//    /mm ai ref2                  — set held item as reference 2
//    /mm ai set <path> [count]    — generate N-tier .mig from 2 refs
//    /mm ai names [count] [hint]  — generate item name tiers
//
//  DESIGN RULES:
//    - Lore is copied 1:1 from references, Gemini has ZERO style freedom
//    - Gemini only fills in stat values and adapts lines to the theme
//    - Output .mig uses {stat1}, {stat2} ... with linear(base, step) formulas
//    - Names get tier colours (&7 → &f → &e → &6 → &5 → &b)
// ============================================================

import { msg, cleanLore, stripColor, requireCreative } from "../../utils/utils";
import Settings from "../../utils/config";

// ─── State ────────────────────────────────────────────────────

var ref1 = null;  // { name, lore[], id, damage }
var ref2 = null;
var isGenerating = false;

// ─── Gemini HTTP ──────────────────────────────────────────────

function callGemini(prompt, maxTok, onSuccess, onError) {
    var key = "" + (Settings.geminiApiKey || "");
    if (!key || key.trim() === "" || key === "paste-your-key-here") {
        msg("&cNo Gemini key! Run &f/mm ai key YOUR_KEY");
        return;
    }
    if (isGenerating) { msg("&eAlready generating — please wait..."); return; }
    isGenerating = true;

    var model   = "" + (Settings.geminiModel || "gemini-2.5-flash-lite");
    var payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTok || 1200 }
    });

    msg("&7Asking &eGemini &8(" + model + ")&7...");

    var Thread   = Java.type("java.lang.Thread");
    var Runnable = Java.type("java.lang.Runnable");

    var t = new Thread(new Runnable({
        run: function() {
            var resultText = null;
            var errMsg     = null;
            try {
                var HttpClients  = Java.type("org.apache.http.impl.client.HttpClients");
                var HttpPost     = Java.type("org.apache.http.client.methods.HttpPost");
                var StringEntity = Java.type("org.apache.http.entity.StringEntity");
                var URIBuilder   = Java.type("org.apache.http.client.utils.URIBuilder");

                var builder = new URIBuilder("https://generativelanguage.googleapis.com");
                builder.setPath("/v1beta/models/" + model + ":generateContent");
                builder.setParameter("key", key.trim());

                var client = HttpClients.createDefault();
                var post   = new HttpPost(builder.build());
                var entity = new StringEntity(payload, "UTF-8");
                entity.setContentType("application/json");
                post.setEntity(entity);
                post.setHeader("Accept", "application/json");
                post.setHeader("User-Agent", "Morgen-CT/1.0");

                var response   = client.execute(post);
                var statusCode = response.getStatusLine().getStatusCode();
                var respEntity = response.getEntity();

                var IS  = Java.type("java.io.InputStreamReader");
                var BR  = Java.type("java.io.BufferedReader");
                var SB  = Java.type("java.lang.StringBuilder");
                var reader = new BR(new IS(respEntity.getContent(), "UTF-8"));
                var sb = new SB();
                var line2;
                while ((line2 = reader.readLine()) !== null) { sb.append(line2); sb.append("\n"); }
                reader.close();
                client.close();

                var raw    = "" + sb.toString();
                var parsed = JSON.parse(raw);

                if (statusCode !== 200) {
                    errMsg = "HTTP " + statusCode + ": " + (parsed.error ? parsed.error.message : raw.substring(0, 120));
                } else {
                    resultText = "" + parsed.candidates[0].content.parts[0].text;
                }
            } catch (e) {
                errMsg = "" + e;
            }

            var finalResult = resultText;
            var finalErr    = errMsg;
            Client.scheduleTask(function() {
                isGenerating = false;
                if (finalErr)    { msg("&cGemini error: " + finalErr); if (onError) onError(finalErr); }
                else if (finalResult) { onSuccess(finalResult); }
                else             { msg("&cEmpty response from Gemini."); }
            });
        }
    }));
    t.setDaemon(true);
    t.start();
}

// ─── Read held item ───────────────────────────────────────────

function readHeld() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) { msg("&cHold an item first!"); return null; }
    var name  = "" + item.getName();
    var lore  = cleanLore(item.getLore()).slice(1)
        .map(function(l) { return ("" + l).replace(/\u00a7/g, "&"); });
    var id    = "" + item.getRegistryName();
    var dmg   = item.getMetadata ? item.getMetadata() : 0;
    return { name: name, lore: lore, id: id, damage: dmg };
}

// ─── /mm ai set — generate N-tier .mig from 2 references ─────

function doSet(args) {
    // /mm ai set <path> [count]
    if (!ref1 || !ref2) {
        msg("&cSet both references first: &f/mm ai ref1 &cand &f/mm ai ref2");
        return;
    }

    var savePath = args[0] || "ai/generated";
    var count    = parseInt(args[1]) || Settings.aiItemCount || 5;

    // Build lore TEMPLATE by extracting stat placeholders from ref lore.
    // We detect lines containing numbers and turn them into {stat1}, {stat2}...
    // The AI is asked ONLY to fill in the numeric progression values.
    // The lore STRUCTURE (all text, colour codes, symbols) comes directly from ref1.

    var templateLore = ref1.lore.map(function(l) { return "" + l; });

    // Extract all numeric values from ref1 lore to use as base stats
    var statNames = [];
    var statBases = [];
    var statRe    = /(\d+(?:\.\d+)?)/g;
    var statIdx   = 0;

    var annotatedLore = templateLore.map(function(line) {
        return line.replace(statRe, function(match) {
            var sName = "stat" + (statIdx + 1);
            statNames.push(sName);
            statBases.push(parseFloat(match));
            statIdx++;
            return "{" + sName + "}";
        });
    });

    // If no stats found, use generic placeholder
    if (statNames.length === 0) {
        statNames  = ["stat1"];
        statBases  = [1];
        annotatedLore = templateLore.map(function(l, i) {
            if (i === 0) return l + " {stat1}";
            return l;
        });
    }

    // Also get stat values from ref2 for the step calculation
    var ref2Numbers = [];
    ref2.lore.forEach(function(l) {
        var m;
        var re2 = /(\d+(?:\.\d+)?)/g;
        while ((m = re2.exec(l)) !== null) {
            ref2Numbers.push(parseFloat(m[1]));
        }
    });

    // Build linear formulas: linear(base, step)
    // step = (ref2_value - ref1_value) / 1 (they are adjacent tiers)
    var statFormulas = statNames.map(function(name, i) {
        var base = statBases[i] || 1;
        var ref2Val = ref2Numbers[i] !== undefined ? ref2Numbers[i] : base * 1.5;
        var step = parseFloat((ref2Val - base).toFixed(2));
        return name + ": linear(" + base + ", " + step + ")";
    });

    // Build the prompt — Gemini only generates the NAME list
    // The lore structure is provided verbatim and Gemini cannot change it
    var tierColors = ["&7", "&f", "&e", "&6", "&5", "&b", "&3", "&c", "&d", "&a"];

    var prompt = "You are a Minecraft item generator. Generate EXACTLY " + count + " item names for a weapon/item progression.\n\n";
    prompt += "REFERENCE ITEM 1 name: " + stripColor("" + ref1.name) + "\n";
    prompt += "REFERENCE ITEM 2 name: " + stripColor("" + ref2.name) + "\n\n";
    prompt += "Rules:\n";
    prompt += "- Generate " + count + " names that form a progression from weak to powerful\n";
    prompt += "- Each name gets a Minecraft color code prefix in this order:\n";
    for (var ti = 0; ti < count && ti < tierColors.length; ti++) {
        prompt += "  Tier " + (ti+1) + ": " + tierColors[ti] + "\n";
    }
    prompt += "- Names should fit the theme of: " + stripColor("" + ref1.name) + "\n";
    prompt += "- Output ONLY the names, one per line, with & color codes, nothing else\n";
    prompt += "- No explanations, no numbering, no extra text\n";
    prompt += "- Example output format:\n";
    prompt += "  &7Rusty Dagger\n  &fIron Blade\n  &eGolden Sword\n  &6Flame Edge\n  &5Shadow Reaper\n\n";
    prompt += "OUTPUT " + count + " NAMES NOW:";

    callGemini(prompt, 400, function(raw) {
        // Parse names from response
        var lines = raw.split("\n")
            .map(function(l) { return l.trim(); })
            .filter(function(l) { return l.length > 2; });

        // Take exactly `count` names
        var names = lines.slice(0, count);
        while (names.length < count) {
            names.push(tierColors[names.length % tierColors.length] + "Item Tier " + (names.length + 1));
        }

        // Build .mig file
        var cc = "&";
        var mig = "// Generated by Morgen AI\n";
        mig += "// References: " + stripColor("" + ref1.name) + " + " + stripColor("" + ref2.name) + "\n";
        mig += "// Tiers: " + count + "\n\n";

        mig += 'ITEM "' + ref1.id + '" {\n\n';
        mig += '    Name: list(' + names.map(function(n) { return '"' + n.replace(/"/g, '\\"') + '"'; }).join(", ") + ')\n';
        mig += '    Amount: ' + count + '\n';
        mig += '    Count: 1\n\n';
        mig += '    Damage: ' + ref1.damage + '\n';
        mig += '    Unbreakable: true\n';
        mig += '    Glow: false\n';
        mig += '    HideFlags: 63\n\n';

        // Stats block with linear formulas
        mig += '    Stats {\n';
        statFormulas.forEach(function(f) {
            mig += '        ' + f + '\n';
        });
        mig += '    }\n\n';

        // Lore — exact structure from ref1, stats replaced with {statN} placeholders
        mig += '    Lore: [\n';
        annotatedLore.forEach(function(l) {
            mig += '        "' + l.replace(/"/g, '\\"') + '"\n';
        });
        mig += '    ]\n\n}\n';

        // Save file
        try {
            var parts  = savePath.replace(/\\/g, "/").split("/");
            var file   = parts.pop() + ".mig";
            var dir    = "Morgen/imports/" + (parts.length ? parts.join("/") : "ai");
            var base   = new java.io.File(".").getCanonicalPath();
            var d      = new java.io.File(base + "/config/ChatTriggers/modules/" + dir);
            if (!d.exists()) d.mkdirs();
            FileLib.write(dir, file, mig);
            msg("&a\u2714 Generated &e" + count + "&a tiers → &fimports/" + savePath + ".mig");
            msg("&7Import with &f/mmimport " + savePath);
        } catch(e) {
            msg("&cSave error: " + e);
        }
    });
}

// ─── /mm ai names — generate tier names only ─────────────────

function doNames(args) {
    var count = parseInt(args[0]) || Settings.aiNameCount || 8;
    var hint  = args.slice(1).join(" ") || (ref1 ? stripColor("" + ref1.name) : "weapon");

    var tierColors = ["&8", "&7", "&f", "&e", "&6", "&5", "&b", "&3", "&c", "&d"];
    // Build colour assignment string for prompt
    var colorAssign = "";
    for (var i = 0; i < count && i < tierColors.length; i++) {
        colorAssign += "  Tier " + (i+1) + ": prefix &8[&" + (tierColors[i][1]) + "COLOR&8]" +
            " → use color code " + tierColors[i] + "\n";
    }

    var prompt = "You are a Minecraft item namer. Generate EXACTLY " + count + " item names.\n\n";
    prompt += "Theme / hint: " + hint + "\n\n";
    prompt += "Rules:\n";
    prompt += "- " + count + " names forming a clear power progression (weakest first)\n";
    prompt += "- Each name MUST start with exactly one of these Minecraft color codes:\n";
    for (var ti = 0; ti < count; ti++) {
        var col = tierColors[ti % tierColors.length];
        prompt += "  Name " + (ti+1) + " → starts with exactly: " + col + "\n";
    }
    prompt += "- Names should feel epic, fitting for a Minecraft RPG server\n";
    prompt += "- NO explanations, NO numbering, NO extra text\n";
    prompt += "- Output ONLY the " + count + " names, one per line\n";
    if (ref1) prompt += "- Style reference: " + stripColor("" + ref1.name) + "\n";
    prompt += "\nOUTPUT " + count + " NAMES:";

    callGemini(prompt, 300, function(raw) {
        var lines = raw.split("\n")
            .map(function(l) { return l.trim(); })
            .filter(function(l) { return l.length > 1; })
            .slice(0, count);

        while (lines.length < count) {
            lines.push(tierColors[lines.length % tierColors.length] + hint + " Tier " + (lines.length + 1));
        }

        msg("&6&l=== Generated Names ===");
        lines.forEach(function(n, i) {
            msg("  &8" + (i+1) + ". " + n);
        });
        msg("&7Copy names above to use in your .mig file under Name: list(...)");

        // Also format as ready-to-use list() string
        var listStr = 'Name: list(' + lines.map(function(n) {
            return '"' + n.replace(/"/g, '\\"') + '"';
        }).join(', ') + ')';
        msg("&8Ready to paste:");
        msg("&f" + listStr);
    });
}

// ─── exported handler (called by exportCommand.js /mm ai) ────

export function handleAiCommand(args) {
    var sub = (args[0] || "").toLowerCase();

    switch (sub) {
        case "key":
            if (!args[1]) { msg("&cUsage: &f/mm ai key <YOUR_KEY>"); return; }
            Settings.geminiApiKey = args.slice(1).join("");
            Settings.save();
            msg("&aGemini API key saved!");
            return;

        case "ref1":
            var r1 = readHeld();
            if (r1) {
                ref1 = r1;
                msg("&aReference 1 set: &f" + stripColor(r1.name) + " &8(" + r1.id + ")");
                msg("&7Lore lines: &e" + r1.lore.length);
            }
            return;

        case "ref2":
            var r2 = readHeld();
            if (r2) {
                ref2 = r2;
                msg("&aReference 2 set: &f" + stripColor(r2.name) + " &8(" + r2.id + ")");
                msg("&7Lore lines: &e" + r2.lore.length);
            }
            return;

        case "set":
            doSet(args.slice(1));
            return;

        case "names":
            doNames(args.slice(1));
            return;

        case "status":
            msg("&6&l=== AI Status ===");
            var keyStr = (Settings.geminiApiKey && Settings.geminiApiKey.length > 4)
                ? "&a✔ Set (&8" + Settings.geminiApiKey.substring(0,4) + "...&8)"
                : "&c✘ Not set";
            msg("  &7Key:    " + keyStr);
            msg("  &7Model:  &f" + (Settings.geminiModel || "gemini-2.5-flash-lite"));
            msg("  &7Ref 1:  " + (ref1 ? "&a✔ &f" + stripColor(""+ref1.name) : "&8not set"));
            msg("  &7Ref 2:  " + (ref2 ? "&a✔ &f" + stripColor(""+ref2.name) : "&8not set"));
            msg("  &7Count:  &e" + (Settings.aiItemCount || 5) + " &8(default tier count)");
            return;

        default:
            msg("&6&lMorgen AI &8» commands:");
            msg("  &f/mm ai key &e<KEY>            &8— save Gemini API key");
            msg("  &f/mm ai ref1                   &8— set held item as reference 1");
            msg("  &f/mm ai ref2                   &8— set held item as reference 2");
            msg("  &f/mm ai set &e<path> [count]   &8— generate tier .mig from refs");
            msg("  &f/mm ai names &e[count] [hint] &8— generate name tier list");
            msg("  &f/mm ai status                &8— show current config");
            return;
    }
}