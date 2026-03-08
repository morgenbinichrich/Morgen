// ============================================================
//  Morgen — src/storage/recentStorage.js
//  Shared recent-items storage — imported by both exportCommand
//  and giveCommand to avoid a circular dependency.
// ============================================================

var recentItems = [];
var MAX_RECENT  = 10;

function pushRecent(name, path) {
    recentItems = recentItems.filter(function(r) { return r.path !== path; });
    recentItems.unshift({ name: name, path: path, time: Date.now() });
    if (recentItems.length > MAX_RECENT) recentItems = recentItems.slice(0, MAX_RECENT);
    try {
        var base = new java.io.File(".").getCanonicalPath();
        var dir  = new java.io.File(base + "/config/ChatTriggers/modules/Morgen/config");
        if (!dir.exists()) dir.mkdirs();
        FileLib.write("Morgen/config", "recent.json", JSON.stringify(recentItems));
    } catch (_) {}
}

function loadRecent() {
    try {
        var raw = FileLib.read("Morgen/config", "recent.json");
        if (raw) recentItems = JSON.parse(raw);
    } catch (_) {}
}
loadRecent();

export function trackRecent(name, path) {
    pushRecent(name, path);
}

export function getRecentItems() {
    return recentItems;
}
