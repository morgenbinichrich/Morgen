import { msg, cleanLore, stripColor } from "../../utils/utils";
import Settings from "../../utils/config";

var isGenerating = false;
var ref1 = null; 
var ref2 = null;



function callGemini(prompt, onSuccess, onError) {
    var key = "" + (Settings.geminiApiKey || "");
    if (!key || key.trim() === "" || key === "paste-your-key-here") {
        msg("&cNo Gemini key! Run &f/mm ai key YOUR_KEY");
        return;
    }
    if (isGenerating) { msg("&eAlready generating, please wait..."); return; }
    isGenerating = true;

    var model  = "" + (Settings.geminiModel || "gemini-2.5-flash-lite");
    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key.trim();

    var temp    = 0.85;
    var payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: temp, maxOutputTokens: 8192 }
    });

    msg("&7Asking &eGemini &8(" + model + ")&7...");

    var Thread   = Java.type("java.lang.Thread");
    var Runnable = Java.type("java.lang.Runnable");
    var t = new Thread(new Runnable({
        run: function() {
            var resultText = null, errMsg = null;
            try {
                var HttpClients  = Java.type("org.apache.http.impl.client.HttpClients");
                var HttpPost     = Java.type("org.apache.http.client.methods.HttpPost");
                var StringEntity = Java.type("org.apache.http.entity.StringEntity");
                var client  = HttpClients.createDefault();
                var post    = new HttpPost(apiUrl);
                var ent     = new StringEntity(payload, "UTF-8");
                ent.setContentType("application/json");
                post.setEntity(ent);
                post.setHeader("Accept", "application/json");
                post.setHeader("User-Agent", "Morgen-CT/1.0");
                var response   = client.execute(post);
                var statusCode = response.getStatusLine().getStatusCode();
                var IS = Java.type("java.io.InputStreamReader");
                var BR = Java.type("java.io.BufferedReader");
                var SB = Java.type("java.lang.StringBuilder");
                var reader = new BR(new IS(response.getEntity().getContent(), "UTF-8"));
                var sb = new SB(), line;
                while ((line = reader.readLine()) !== null) sb.append(line);
                reader.close(); client.close();
                var body = "" + sb.toString();
                if (statusCode !== 200) {
                    try { var ej = JSON.parse(body); errMsg = ej.error && ej.error.message ? ej.error.message : "HTTP " + statusCode; }
                    catch(_) { errMsg = "HTTP " + statusCode; }
                } else {
                    try { var parsed = JSON.parse(body); resultText = "" + parsed.candidates[0].content.parts[0].text; }
                    catch(pe) { errMsg = "Parse error: " + pe; }
                }
            } catch(e) { errMsg = "" + e; }
            var ft = resultText, fe = errMsg;
            Client.scheduleTask(function() {
                isGenerating = false;
                if (fe) { msg("&cGemini error: " + ("" + fe).substring(0, 200)); if (onError) onError(fe); }
                else    { onSuccess(("" + ft).trim()); }
            });
        }
    }));
    t.setDaemon(true); t.setName("Morgen-AI"); t.start();
}



function cleanLines(txt) {
    return txt.split("\n").map(function(l) {
        l = l.replace(/\r/, "");
        l = l.replace(/\{(?!i(?:\+1)?\})[^}]*\}/g, "");
        l = l.replace(/§/g, "");
        return l.replace(/\s+$/, "");
    });
}

function heldItemRef() {
    var item = Player.getHeldItem();
    if (!item || item.getID() === 0) return null;
    
    return {
        name: item.getName().replace(/\u00a7/g, "&"),
        lore: cleanLore(item.getLore()).slice(1).map(function(l) {
            return ("" + l).replace(/\u00a7/g, "&");
        })
    };
}

// FIX: Safe clipboard — java.awt.Toolkit crashes on iOS/headless systems.
// We wrap in try-catch and show a fallback message if it fails.
function copyToClipboard(str) {
    try {
        var sel = Java.type("java.awt.datatransfer.StringSelection");
        var toolkit = Java.type("java.awt.Toolkit").getDefaultToolkit();
        toolkit.getSystemClipboard().setContents(new sel(str), null);
        return true;
    } catch(_) { return false; }
}

function div()  { ChatLib.chat(ChatLib.addColor("&8──────────────────────────────")); }
function div2() { ChatLib.chat(ChatLib.addColor("&8══════════════════════════════")); }

function refContext() {
    var ctx = "";
    if (ref1) ctx += "\nReference item 1: \"" + ref1.name + "\"\n" + (ref1.lore.length ? "Lore:\n" + ref1.lore.map(function(l){return "  "+l;}).join("\n") + "\n" : "");
    if (ref2) ctx += "\nReference item 2: \"" + ref2.name + "\"\n" + (ref2.lore.length ? "Lore:\n" + ref2.lore.map(function(l){return "  "+l;}).join("\n") + "\n" : "");
    return ctx;
}



function buildLoreTemplate() {
    var src = ref1 || ref2;
    if (!src || src.lore.length === 0) return null;
    return src.lore.map(function(l) { return '    "' + l.replace(/"/g, '\\"') + '"'; }).join("\n");
}


function buildNamesPrompt(amount, theme) {
    var ctx = refContext();
    return "You are a Minecraft 1.8.9 RPG server item naming expert.\n"
         + "Generate EXACTLY " + amount + " names, no more, no less. Theme: \"" + theme + "\"\n"
         + (ctx ? "\nStyle reference items:" + ctx + "\nMatch their style and aesthetic.\n" : "")
         + "\nNames MUST escalate in power: weakest first, strongest last.\n"
         + "\nSTRICT RULES:\n"
         + "- Output EXACTLY " + amount + " lines. Count them before responding.\n"
         + "- One name per line. No numbering, no bullet points, no quotes, no blank lines.\n"
         + "- Each name MUST start with a Minecraft color code using the AMPERSAND character (&).\n"
         + "  Use the literal ampersand symbol & followed by a code letter/digit. Examples:\n"
         + "  &7Rusty Blade\n"
         + "  &eSilver Edge\n"
         + "  &6Gilded Fang\n"
         + "  &bVoid Shard\n"
         + "- CRITICAL: Use the & character (ampersand, ASCII 38). NEVER use the § character (section sign, ASCII 167). § will break the output.\n"
         + "- Max 35 chars per name including the color code. Sound like RPG item names.\n"
         + "- You MAY use additional & codes inside names for formatting (e.g. &l for bold, &o for italic).\n"
         + "- You MAY use unicode symbols (❖ ❤ ★ ⚔ ❀) for decoration.\n"
         + "- Output NOTHING else — no intro, no explanation, just the " + amount + " names.";
}

function buildMigPrompt(amount, theme) {
    var ctx = refContext();
    var loreTemplate = buildLoreTemplate();

    var exampleLore = loreTemplate
        ? loreTemplate
        : '        "&7First lore line"\n        "&8Second lore line"';

    var nameListExample = 'list("&7Weak ' + theme + '", "&eMid ' + theme + '", "&6Strong ' + theme + '")';

    var loreRule = loreTemplate
        ? "- The Lore block MUST be copied EXACTLY from the reference — every & code, every character. Do NOT change anything."
        : "- Write meaningful lore lines with & color codes. No plain uncolored text.";

    return "You are a Minecraft 1.8.9 Housing server item designer.\n"
         + "Generate ONE single ITEM block for a .mig file. Theme: \"" + theme + "\"\n"
         + "This one block represents " + amount + " item tiers using Name: list() and Amount: " + amount + ".\n"
         + (ctx ? "\nReference item (copy lore EXACTLY including all & color codes):" + ctx : "")
         + "\n\nOUTPUT FORMAT — copy this structure exactly:\n\n"
         + 'ITEM "minecraft:iron_pickaxe" {\n\n'
         + "    Name: " + nameListExample + "\n"
         + "    Amount: " + amount + "\n"
         + "    Count: 1\n\n"
         + "    Damage: 0\n"
         + "    Unbreakable: true\n"
         + "    Glow: false\n"
         + "    HideFlags: 63\n"
         + "    # ItemModel: \"none\"\n\n"
         + "    Stats {\n"
         + "        damage: linear(10, 15)\n"
         + "        speed:  linear(1, 0.5)\n"
         + "    }\n\n"
         + "    Lore: [\n"
         + exampleLore + "\n"
         + "    ]\n\n"
         + "}\n\n"
         + "STRICT RULES — violating any rule makes the file unusable:\n"
         + "- Output ONLY the single raw ITEM block. No markdown, no code fences, no explanations.\n"
         + "- ONE ITEM block only. Do NOT generate multiple ITEM blocks.\n"
         + "- The opening brace on the same line: ITEM \"id\" {\n"
         + "- Name: list() MUST contain EXACTLY " + amount + " names escalating &7 weak → &f → &e → &6 → &b mythic.\n"
         + "- Amount: MUST be " + amount + ".\n"
         + "- Count: must be a number (e.g. Count: 1). Never leave it blank.\n"
         + loreRule + "\n"
         + "- Stats block is required. Use linear(), exp(), or static() formulas. No hardcoded numbers.\n"
         + "- Use valid Minecraft 1.8.9 item IDs only.\n"
         + "- Use & color codes ONLY. NEVER use raw § characters.\n"
         + "- No curly braces { } inside Name or Lore string values.\n"
         + "- You MAY use unicode symbols (❖ ❤ ★ ⚔ ❀) in names and lore.";
}


function saveMig(content, theme, amount) {
    try {
        var base = new java.io.File(".").getCanonicalPath();
        new java.io.File(base + "/config/ChatTriggers/modules/Morgen/imports/ai/").mkdirs();
        var now  = new Date();
        var pad  = function(n) { return (""+n).length < 2 ? "0"+n : ""+n; };
        var stamp = now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes());
        var safe  = theme.replace(/[^a-zA-Z0-9_ -]/g, "").replace(/\s+/g, "_").substring(0, 24);
        var fname = safe + "_x" + amount + "_" + stamp + ".mig";
        FileLib.write("Morgen/imports/ai", fname, content);
        return "ai/" + fname.replace(/\.mig$/, "");
    } catch(e) { return null; }
}


export function handleAiCommand(args) {
    var sub  = ("" + (args[0] || "")).toLowerCase();
    var rest = args.slice(1);

    if (sub === "key") {
        if (!rest[0]) { msg("&cUsage: &f/mm ai key &eYOUR_KEY"); return; }
        Settings.geminiApiKey = rest[0]; Settings.save();
        msg("&aKey saved! &8(" + (""+rest[0]).substring(0,6) + "...)"); return;
    }

    if (sub === "status") {
        var k = "" + (Settings.geminiApiKey || "");
        div2(); msg("&b&l❖ AI Status  &8— &7Google Gemini"); div();
        msg("  &7Key    " + (k.length > 6 ? "&f" + k.substring(0,6) + "... &a✔" : "&cNot set"));
        msg("  &7Model  &e" + (Settings.geminiModel || "gemini-2.5-flash-lite"));
        msg("  &7Names  &e" + (Settings.aiNameCount || 8));
        msg("  &7Items  &e" + (Settings.aiItemCount || 5));
        msg("  &7Ref1   " + (ref1 ? "&f" + ref1.name + " &8(" + ref1.lore.length + " lore lines)" : "&8not set"));
        msg("  &7Ref2   " + (ref2 ? "&f" + ref2.name + " &8(" + ref2.lore.length + " lore lines)" : "&8not set"));
        div2(); return;
    }

    if (sub === "ref1") {
        if (rest.length === 0) {
            var r = heldItemRef();
            if (!r) { showRef(ref1, "Ref1"); return; }
            ref1 = r; msg("&aRef1 set: &f" + r.name + " &8(" + r.lore.length + " lore lines)");
        } else { showRef(ref1, "Ref1"); }
        return;
    }

    if (sub === "ref2") {
        if (rest.length === 0) {
            var r = heldItemRef();
            if (!r) { showRef(ref2, "Ref2"); return; }
            ref2 = r; msg("&aRef2 set: &f" + r.name + " &8(" + r.lore.length + " lore lines)");
        } else { showRef(ref2, "Ref2"); }
        return;
    }

    if (sub === "names" || sub === "name") {
        var firstIsNum = !isNaN(parseInt(rest[0]));
        var amount = firstIsNum ? parseInt(rest[0]) : (Settings.aiNameCount || 8);
        var theme  = firstIsNum ? rest.slice(1).join(" ") : rest.join(" ");
        if (!theme) { msg("&cUsage: &f/mm ai names &e[amount] <theme>"); return; }
        if (ref1) msg("  &8Using Ref1: &f" + ref1.name);
        if (ref2 && !ref1) msg("  &8Using Ref2: &f" + ref2.name);
        callGemini(buildNamesPrompt(amount, theme), function(txt) {
            var allLines = cleanLines(txt)
                .map(function(l) { return l.trim().replace(/\u00a7/g, "&"); })
                .filter(function(l) { return l.length > 0; });
            var colored = allLines.filter(function(l) { return /^&[0-9a-fk-or]/i.test(l); });
            var names = (colored.length >= amount ? colored : allLines).slice(0, amount);
            while (names.length < amount) { names.push("&7Item " + (names.length + 1)); }
            div2(); msg("&b&l❖ AI Names  &8— &7\"" + theme + "\" ×" + amount); div();
            names.forEach(function(n,i){ ChatLib.chat(ChatLib.addColor("  &8"+(i+1)+". "+n)); });
            div();
            var listStr  = names.map(function(n){return '"'+n.replace(/"/g,'\\"')+'"';}).join(", ");
            var listFull = "Name: list(" + listStr + ")";
            var copied = copyToClipboard(listFull);
            if (copied) {
                msg("&8Copied to clipboard: &7Name: list(...)");
            } else {
                msg("&8Clipboard not available on this system.");
            }
            var btn = new TextComponent(ChatLib.addColor("  &a[ ▶ Copy list() ]"));
            btn.setClick("suggest_command", listFull);
            btn.setHover("show_text", ChatLib.addColor("&7Click to fill chat with list()\n&8" + listFull.substring(0,60) + "..."));
            ChatLib.chat(new Message(btn));
            div2();
        });
        return;
    }

    if (sub === "mig") {
        var firstIsNum = !isNaN(parseInt(rest[0]));
        var amount = firstIsNum ? parseInt(rest[0]) : (Settings.aiItemCount || 5);
        var theme  = firstIsNum ? rest.slice(1).join(" ") : rest.join(" ");
        if (amount < 1 || amount > 20) { msg("&cAmount must be 1–20."); return; }
        if (!theme) { msg("&cUsage: &f/mm ai mig &e[amount] <theme>"); return; }
        if (ref1) msg("  &8Using Ref1: &f" + ref1.name + " &8(lore will be copied exactly)");
        if (ref2 && !ref1) msg("  &8Using Ref2: &f" + ref2.name + " &8(lore will be copied exactly)");
        callGemini(buildMigPrompt(amount, theme), function(txt) {
            var clean = txt.replace(/^```[^\n]*\n?/m, "").replace(/\n?```$/m, "").trim();
            clean = clean.replace(/^(\s*#\s*\w+:\s*)\d+(\s*)$/gm, "$1#$2");
            var savedPath = saveMig(clean, theme, amount);
            var itemCount = (clean.match(/^ITEM\s+/gm) || []).length;
            div2(); msg("&b&l❖ AI Mig  &8— &7\"" + theme + "\" ×" + amount); div();
            msg("  &7Generated &e" + itemCount + " &7item" + (itemCount !== 1 ? "s" : ""));
            if (savedPath) {
                msg("  &7Saved     " + savedPath + ".mig");
                var impComp = new TextComponent(ChatLib.addColor("  &a[ ▶ Import Now ]"));
                impComp.setClick("run_command", "/mm import " + savedPath);
                impComp.setHover("show_text", ChatLib.addColor("&7Click to import all " + itemCount + " items\n&8/mm import " + savedPath));
                ChatLib.chat(new Message(impComp));
            } else {
                msg("  &cSave failed.");
            }
            div2();
        });
        return;
    }

    div2(); msg("&b&l❖ Morgen AI  &8— &7Google Gemini"); div();
    msg("  &f/mm ai names &e[amount] <theme>  &8— &7generate tier names (default: " + (Settings.aiNameCount||8) + ")");
    msg("  &f/mm ai mig   &e[amount] <theme>  &8— &7generate full .mig file (default: " + (Settings.aiItemCount||5) + " items)");
    msg("  &8  e.g. /mm ai names nether swords");
    msg("  &8      /mm ai mig 8 ocean armor set"); div();
    msg("  &f/mm ai ref1   &8— &7hold item → set as reference 1 (lore copied exactly)");
    msg("  &f/mm ai ref2   &8— &7hold item → set as reference 2 (fallback if no ref1)");
    msg("  &8  (run without holding to view current ref)"); div();
    msg("  &f/mm ai status       &8— &7show AI config");
    msg("  &f/mm ai key &e<key>  &8— &7set Gemini API key"); div();
    msg("  &7Free key: https://aistudio.google.com&r");
    div2();
}

function showRef(r, label) {
    if (!r) { msg("&8" + label + " &7not set. Hold an item and run &f/mm ai " + label.toLowerCase()); return; }
    div(); msg("&b" + label + ": &f" + r.name);
    if (r.lore.length > 0) r.lore.forEach(function(l){ ChatLib.chat(ChatLib.addColor("  &8│ &7" + l)); });
    else msg("  &8(no lore)");
    div();
}