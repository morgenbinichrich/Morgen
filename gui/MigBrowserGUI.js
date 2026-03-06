// ============================================================
//  Morgen — gui/MigBrowserGUI.js  v3
//  + Hover preview panel showing item lore / meta from .mig
// ============================================================

import { msg } from "../utils/utils";
import Settings from "../utils/config";

// ─── Icons ────────────────────────────────────────────────────

var A = "config/ChatTriggers/modules/Morgen/assets/";
function loadImg(n){try{return new Image(A+n);}catch(_){return null;}}
var I_FOLDER=loadImg("folder.png"), I_MIG=loadImg("paper.png");
var I_JSON=loadImg("item.png"), I_TRASH=loadImg("bin_closed.png"), I_TRASH2=loadImg("bin.png");

function drawFallback(x,y,isDir,isJson){
    if(isDir){
        Renderer.drawRect(Renderer.color(230,180,40,220),x+1,y+5,14,9);
        Renderer.drawRect(Renderer.color(230,180,40,220),x+1,y+3,7,4);
    }else if(isJson){
        Renderer.drawRect(Renderer.color(60,180,90,220),x+2,y+1,12,14);
        Renderer.drawRect(Renderer.color(100,220,130,180),x+3,y+4,5,2);
        Renderer.drawRect(Renderer.color(100,220,130,180),x+3,y+7,7,2);
        Renderer.drawRect(Renderer.color(100,220,130,180),x+3,y+10,4,2);
    }else{
        Renderer.drawRect(Renderer.color(70,120,220,220),x+2,y+1,12,14);
        Renderer.drawRect(Renderer.color(140,180,255,180),x+3,y+4,6,2);
        Renderer.drawRect(Renderer.color(140,180,255,180),x+3,y+7,8,2);
        Renderer.drawRect(Renderer.color(140,180,255,180),x+3,y+10,5,2);
    }
}
function drawImg(img,x,y,w,h,isDir,isJson){
    if(img){try{Renderer.drawImage(img,x,y,w,h);return;}catch(_){}}
    drawFallback(x,y,isDir,isJson);
}

// ─── Sounds ───────────────────────────────────────────────────

var sndC,sndP;
try{sndC=new Sound({source:"click.ogg",category:"master"});}catch(_){}
try{sndP=new Sound({source:"paper.ogg",category:"master"});}catch(_){}
function playClick(){try{sndC.rewind();sndC.play();}catch(_){World.playSound("random.click",0.5,1);}}
function playPaper(){try{sndP.rewind();sndP.play();}catch(_){World.playSound("random.click",0.3,0.8);}}

// ─── Keybinds ─────────────────────────────────────────────────

var kOpen=new KeyBind("Open .mig Browser",Keyboard.KEY_M,"Morgen");
var kRef=new KeyBind("Refresh File List",Keyboard.KEY_R,"Morgen");
var kLast=new KeyBind("Spawn Last Item",Keyboard.KEY_L,"Morgen");
var kFolder=new KeyBind("Open Imports Folder",Keyboard.KEY_O,"Morgen");
var lastPath=null;
register("tick",function(){
    if(kOpen.isPressed())openMigBrowser();
    if(kFolder.isPressed())openFolder();
    if(kRef.isPressed()&&open2){refresh();msg("&aRefreshed.");}
    if(kLast.isPressed()&&lastPath)ChatLib.command("mm import "+lastPath,true);
});

// ─── State ────────────────────────────────────────────────────

var gui=new Gui(),open2=false;
var allFiles=[],files=[],filtered=[];
var subDir="",page=0,hoverIdx=-1;
var searchText="",searchActive=false,searchMode=false;
var perPage=10;
var dragging=false,dOX=0,dOY=0,pOX=0,pOY=0;
var L={};

// Hover preview state
var previewCache = {};   // path → { name, lore[], id, amount, flags }
var previewEntry = null; // currently hovered entry

// ─── File IO ──────────────────────────────────────────────────

var BASE="./config/ChatTriggers/modules/Morgen/imports/";

function readShallow(path){
    var r=[];
    try{
        var d=new java.io.File(path);
        if(!d.exists()){d.mkdirs();return r;}
        var e=d.listFiles();if(!e)return r;
        for(var i=0;i<e.length;i++){
            var f=e[i],n=f.getName();
            if(f.isDirectory())r.push({name:n,isDir:true,isJson:false,rel:""});
            else if(n.endsWith(".mig"))r.push({name:n,isDir:false,isJson:false,rel:""});
            else if(n.endsWith(".json"))r.push({name:n,isDir:false,isJson:true,rel:""});
        }
        r.sort(function(a,b){
            if(a.isDir&&!b.isDir)return -1;if(!a.isDir&&b.isDir)return 1;
            return a.name.toLowerCase()<b.name.toLowerCase()?-1:1;
        });
    }catch(e){}
    return r;
}

function readRecursive(path,base){
    var r=[];
    try{
        var d=new java.io.File(path);if(!d.exists())return r;
        var e=d.listFiles();if(!e)return r;
        for(var i=0;i<e.length;i++){
            var f=e[i],n=f.getName();
            if(f.isDirectory()){var s=readRecursive(path+n+"/",base+n+"/");for(var j=0;j<s.length;j++)r.push(s[j]);}
            else if(n.endsWith(".mig")||n.endsWith(".json"))
                r.push({name:n,isDir:false,isJson:n.endsWith(".json"),rel:base});
        }
    }catch(e){}
    return r;
}

function refresh(){
    page=0;hoverIdx=-1;previewEntry=null;
    files=readShallow(BASE+subDir);
    allFiles=readRecursive(BASE,"");
    filter();
}

function filter(){
    page=0;
    if(!searchText){searchMode=false;filtered=files.slice();return;}
    searchMode=true;
    var q=searchText.toLowerCase();
    filtered=allFiles.filter(function(f){return(f.rel+f.name).toLowerCase().indexOf(q)!==-1;});
}

// ─── .mig / .json quick parser for preview ───────────────────

function parseMigPreview(raw) {
    if (!raw) return null;
    try {
        // Strip comments
        var clean = raw.split("\n").map(function(l){
            var inQ=false;
            for(var i=0;i<l.length;i++){
                if(l[i]==='"')inQ=!inQ;
                if(!inQ&&l[i]==='#')return l.slice(0,i);
            }
            return l;
        }).join("\n");

        var idM    = clean.match(/ITEM\s+"([^"]+)"/);
        var nameM  = clean.match(/^\s*Name:\s*(?:list\()?["']?([^"'\n\)]+)/m);
        var amtM   = clean.match(/^\s*Amount:\s*(\d+)/m);
        var dmgM   = clean.match(/^\s*Damage:\s*(\d+)/m);
        var cntM   = clean.match(/^\s*Count:\s*(\d+)/m);
        var glowM  = clean.match(/^\s*Glow:\s*(true|false)/im);
        var unbrM  = clean.match(/^\s*Unbreakable:\s*(true|false)/im);
        var hfM    = clean.match(/^\s*HideFlags:\s*(\d+)/m);

        // Parse lore block
        var lore = [];
        var loreStart = clean.indexOf("Lore:");
        if (loreStart !== -1) {
            var loreSection = clean.slice(loreStart);
            var loreMatches = loreSection.match(/"((?:[^"\\]|\\.)*)"/g);
            if (loreMatches) {
                lore = loreMatches.slice(0, 12).map(function(s){
                    return s.slice(1,-1).replace(/\\"/g,'"').replace(/&([0-9a-fk-or])/gi,"\u00a7$1");
                });
            }
        }

        // Multiple names from list()
        var names = [];
        if (nameM) {
            var nameVal = nameM[0].replace(/^\s*Name:\s*/,"").trim();
            if (nameVal.indexOf("list(") !== -1) {
                var inner = nameVal.slice(nameVal.indexOf("(")+1);
                var parts = inner.split(",");
                names = parts.map(function(p){
                    return p.trim().replace(/^["']|["']\)?$/g,"");
                }).filter(function(p){return p.length>0;});
            } else {
                var q = nameVal.replace(/^["']|["']$/g,"");
                if (q) names = [q];
            }
        }

        return {
            id:      idM   ? idM[1]             : "minecraft:stone",
            names:   names.length>0 ? names : ["Item"],
            amount:  amtM  ? parseInt(amtM[1])  : 1,
            damage:  dmgM  ? parseInt(dmgM[1])  : 0,
            count:   cntM  ? parseInt(cntM[1])  : 1,
            glow:    glowM  ? glowM[1]==="true" : false,
            unbreak: unbrM  ? unbrM[1]==="true" : false,
            hf:      hfM   ? parseInt(hfM[1])   : 63,
            lore:    lore
        };
    } catch(e) { return null; }
}

function getPreview(entry) {
    if (!entry || entry.isDir) return null;
    var key = (entry.rel||"") + entry.name;
    if (previewCache[key]) return previewCache[key];
    try {
        var raw = FileLib.read(BASE + key);
        if (!raw) return null;
        var data;
        if (entry.isJson) {
            var parsed = JSON.parse(raw);
            data = { id:"json", names:[entry.name.replace(/\.json$/,"")], amount:1,
                     lore:["&8JSON item", "&7NBT: "+(""+parsed.item).substring(0,30)+"..."],
                     damage:0, count:1, glow:false, unbreak:false, hf:63 };
        } else {
            data = parseMigPreview(raw);
        }
        if (data) previewCache[key] = data;
        return data;
    } catch(e) { return null; }
}

// ─── Layout ───────────────────────────────────────────────────

function layout(){
    var sw=Renderer.screen.getWidth(),sh=Renderer.screen.getHeight();
    var pW=Math.min(260,Math.max(200,Math.floor(sw*0.28)));
    var pH=Math.floor(sh*0.8);
    var pX=Math.max(0,Math.min(Math.floor(sw/2-pW/2)+pOX,sw-pW));
    var pY=Math.max(0,Math.min(Math.floor(sh/2-pH/2)+pOY,sh-pH));
    var hH=28,sH=20,fH=26;
    var lY=pY+hH+sH+10,lH=pH-hH-sH-fH-14;
    perPage=Math.max(1,Math.floor(lH/21));
    // Preview panel: to the right of main panel
    var pvW=140,pvX=pX+pW+6;
    // Clamp preview to screen
    if(pvX+pvW>sw)pvX=pX-pvW-6;
    L={sw:sw,sh:sh,pX:pX,pY:pY,pW:pW,pH:pH,
       hH:hH,sH:sH,fH:fH,
       lX:pX+7,lW:pW-14,lY:lY,lH:lH,
       fY:pY+pH-fH,
       sX:pX+7,sY:pY+hH+4,sW:pW-14,
       fbX:pX+pW-23,fbY:pY+6,fbW:17,fbH:15,
       pvX:pvX,pvY:pY,pvW:pvW};
}

// ─── Draw helpers ─────────────────────────────────────────────

var GOLD=Renderer.color(198,148,32,255);
var GOLD2=Renderer.color(255,200,60,255);
var PANEL=Renderer.color(13,14,21,248);
var BORDER=Renderer.color(52,55,82,220);
var HEADER=Renderer.color(18,20,34,255);
var DARK=Renderer.color(0,0,0,90);

function border1(x,y,w,h,col,t){
    t=t||1;
    Renderer.drawRect(col,x,y,w,t);Renderer.drawRect(col,x,y+h-t,w,t);
    Renderer.drawRect(col,x,y,t,h);Renderer.drawRect(col,x+w-t,y,t,h);
}

function drawBtn(lbl,x,y,w,h,mx,my,hovCol){
    var hov=mx>=x&&mx<=x+w&&my>=y&&my<=y+h;
    Renderer.drawRect(hov?(hovCol||Renderer.color(70,76,115,230)):Renderer.color(32,35,54,215),x,y,w,h);
    border1(x,y,w,h,hov?GOLD:BORDER);
    var lw=Renderer.getStringWidth(lbl);
    Renderer.drawString("&f"+lbl,x+Math.floor((w-lw)/2),y+Math.floor(h/2)-3,true);
}

// ─── Preview panel draw ───────────────────────────────────────

function drawPreviewPanel(mx,my) {
    var entry = hoverIdx>=0&&hoverIdx<filtered.length ? filtered[hoverIdx] : null;
    if (!entry || entry.isDir) { previewEntry=null; return; }
    previewEntry = entry;
    var pv = getPreview(entry);
    if (!pv) return;

    // Measure how tall the panel needs to be
    var lineH = 11;
    var rows = [];
    // Name(s)
    pv.names.slice(0,3).forEach(function(n,i){
        rows.push({ text: n.replace(/&([0-9a-fk-or])/gi,"\u00a7$1"), bold: i===0 });
    });
    if (pv.names.length > 3) rows.push({ text: "\u00a78+"+(pv.names.length-3)+" more names" });
    // Meta row
    var meta = "\u00a78"+pv.id.replace("minecraft:","")+" \u00b7 dmg:"+pv.damage;
    if (pv.amount>1) meta += " \u00b7 x"+pv.amount;
    rows.push({ text: meta, small: true });
    rows.push({ sep: true });
    // Lore
    if (pv.lore.length === 0) {
        rows.push({ text: "\u00a78(no lore)" });
    } else {
        pv.lore.slice(0, 14).forEach(function(l){
            rows.push({ text: l === "" ? "\u00a78\u25aa" : l });
        });
        if (pv.lore.length > 14) rows.push({ text: "\u00a78+"+(pv.lore.length-14)+" more lines" });
    }
    // Flags
    var flags = [];
    if (pv.glow)    flags.push("\u00a7dGlow");
    if (pv.unbreak) flags.push("\u00a7aUnbreak");
    if (flags.length) rows.push({ sep:true }), rows.push({ text: flags.join("  ") });

    var pvH = 24 + rows.length * lineH + 8;
    var pvX = L.pvX, pvY = Math.min(L.pvY + 4, L.sh - pvH - 4);
    var pvW = L.pvW;

    // Shadow
    Renderer.drawRect(DARK, pvX+4, pvY+4, pvW, pvH);
    // Panel
    Renderer.drawRect(Renderer.color(13,14,21,242), pvX, pvY, pvW, pvH);
    // Gold left stripe
    Renderer.drawRect(GOLD, pvX, pvY, 2, pvH);
    border1(pvX, pvY, pvW, pvH, BORDER);

    // Header
    Renderer.drawRect(HEADER, pvX+2, pvY, pvW-2, 20);
    Renderer.drawRect(Renderer.color(198,148,32,60), pvX+2, pvY+19, pvW-2, 1);
    // Icon in header
    var ic = entry.isJson ? I_JSON : I_MIG;
    drawImg(ic, pvX+5, pvY+2, 15, 15, false, entry.isJson);
    // Filename
    var fname = entry.name.replace(/\.(mig|json)$/,"");
    if (fname.length > 14) fname = fname.substring(0,13)+"\u2026";
    Renderer.drawString("\u00a7f"+fname+(entry.isJson?"\u00a78.json":"\u00a78.mig"),
        pvX+23, pvY+5, true);

    // Rows
    var ry = pvY + 23;
    for (var i=0; i<rows.length; i++) {
        var row = rows[i];
        if (row.sep) { Renderer.drawRect(Renderer.color(52,55,82,150),pvX+6,ry+3,pvW-12,1); ry+=8; continue; }
        Renderer.drawString(row.text, pvX+8, ry, true);
        ry += lineH;
    }
}

// ─── Main draw ────────────────────────────────────────────────

gui.registerDraw(function(mx,my){
    layout();
    if(dragging){pOX=mx-dOX-Math.floor(L.sw/2-L.pW/2);pOY=my-dOY-Math.floor(L.sh/2-L.pH/2);layout();}

    Renderer.drawRect(DARK,L.pX+5,L.pY+5,L.pW,L.pH);
    Renderer.drawRect(PANEL,L.pX,L.pY,L.pW,L.pH);
    Renderer.drawRect(GOLD,L.pX,L.pY,2,L.pH);
    border1(L.pX,L.pY,L.pW,L.pH,BORDER);

    // Header
    Renderer.drawRect(HEADER,L.pX+2,L.pY,L.pW-2,L.hH);
    Renderer.drawRect(Renderer.color(198,148,32,70),L.pX+2,L.pY+L.hH-1,L.pW-2,1);
    Renderer.drawRect(GOLD,L.pX+9,L.pY+11,4,4);
    Renderer.drawRect(GOLD2,L.pX+10,L.pY+12,2,2);
    var title=searchMode?"&8[search] &f"+searchText
        :(subDir===""?"&6&lMorgen &8\u00bb &7Imports":"&8\u00bb &e"+subDir.replace(/\/$/,""));
    Renderer.drawString(title,L.pX+18,L.pY+9,true);

    // Folder button
    var onFb=mx>=L.fbX&&mx<=L.fbX+L.fbW&&my>=L.fbY&&my<=L.fbY+L.fbH;
    Renderer.drawRect(onFb?Renderer.color(198,148,32,190):Renderer.color(32,35,50,200),L.fbX,L.fbY,L.fbW,L.fbH);
    border1(L.fbX,L.fbY,L.fbW,L.fbH,onFb?GOLD:BORDER);
    drawImg(I_FOLDER,L.fbX+1,L.fbY,15,14,true,false);
    if(onFb){
        var tw=Renderer.getStringWidth("Open folder")+10;
        Renderer.drawRect(PANEL,L.fbX-tw-2,L.fbY,tw,14);
        border1(L.fbX-tw-2,L.fbY,tw,14,BORDER);
        Renderer.drawString("&7Open folder",L.fbX-tw+2,L.fbY+3,true);
    }

    // Search bar
    var sBg=searchActive?Renderer.color(22,25,42,255):Renderer.color(18,20,32,240);
    Renderer.drawRect(sBg,L.sX,L.sY,L.sW,L.sH);
    border1(L.sX,L.sY,L.sW,L.sH,searchActive?GOLD:BORDER);
    Renderer.drawString("&8\u25ba",L.sX+4,L.sY+5,true);
    Renderer.drawString(searchText===""?"&8Search files...":"&f"+searchText,L.sX+14,L.sY+5,true);
    if(searchActive&&(Date.now()%900)<450)
        Renderer.drawRect(GOLD,L.sX+14+Renderer.getStringWidth(searchText),L.sY+3,1,12);

    Renderer.drawRect(Renderer.color(198,148,32,55),L.pX+2,L.lY-4,L.pW-2,1);

    // File list
    hoverIdx=-1;
    var start=page*perPage,end=Math.min(start+perPage,filtered.length);
    if(filtered.length===0)
        Renderer.drawString(searchMode?"&8No results for \"&7"+searchText+"&8\"":"&8No files here.",L.lX+4,L.lY+7,true);

    for(var i=start;i<end;i++){
        var e=filtered[i];
        var rY=L.lY+(i-start)*21;
        var hov=mx>=L.lX&&mx<=L.lX+L.lW&&my>=rY&&my<=rY+19;
        if(hov)hoverIdx=i;
        if(hov){
            Renderer.drawRect(Renderer.color(26,30,50,200),L.lX,rY,L.lW,20);
            Renderer.drawRect(GOLD,L.lX,rY,2,20);
        }
        var ic=e.isDir?I_FOLDER:(e.isJson?I_JSON:I_MIG);
        drawImg(ic,L.lX+4,rY+2,15,15,e.isDir,e.isJson);
        Renderer.drawString(buildLabel(e),L.lX+23,rY+5,true);
        if(searchMode&&e.rel)
            Renderer.drawString("&8"+e.rel.replace(/\/$/,""),L.lX+L.lW-Renderer.getStringWidth(e.rel)-22,rY+5,true);
        if(hov&&!e.isDir){
            var tx=L.lX+L.lW-18,onT=mx>=tx&&mx<=tx+16;
            drawImg(onT?I_TRASH2:I_TRASH,tx,rY+2,15,15,false,false);
        }
    }

    // Footer
    Renderer.drawRect(Renderer.color(16,18,30,255),L.pX+2,L.fY,L.pW-2,L.fH);
    Renderer.drawRect(Renderer.color(198,148,32,55),L.pX+2,L.fY,L.pW-2,1);
    if(!searchMode&&subDir!=="")drawBtn("\u2190",L.pX+8,L.fY+4,38,18,mx,my,Renderer.color(198,148,32,180));
    if(searchMode)drawBtn("\u00d7",L.pX+8,L.fY+4,38,18,mx,my,Renderer.color(160,55,55,200));
    drawBtn("\u27F3",L.pX+L.pW-24,L.fY+4,17,18,mx,my,Renderer.color(198,148,32,180));
    var total=Math.max(1,Math.ceil(filtered.length/perPage));
    var pcx=Math.floor(L.pX+L.pW/2);
    var pStr=(page+1)+"/"+total;
    if(page>0)drawBtn("<",pcx-22,L.fY+4,18,18,mx,my,Renderer.color(198,148,32,180));
    if(page+1<total)drawBtn(">",pcx+4,L.fY+4,18,18,mx,my,Renderer.color(198,148,32,180));
    Renderer.drawString("&7"+pStr,pcx-Math.floor(Renderer.getStringWidth(pStr)/2),L.fY+8,true);
    Renderer.drawString("&8"+filtered.length+(searchMode?" results":" files"),
        L.pX+L.pW-Renderer.getStringWidth(filtered.length+" results")-10,L.fY+8,true);

    // ── Hover preview panel ───────────────────────────────────
    drawPreviewPanel(mx,my);
});

// ─── Label ────────────────────────────────────────────────────

function buildLabel(e){
    if(e.isDir)return"&e"+e.name+"&8/";
    var ext=e.isJson?".json":".mig",extC=e.isJson?"&2":"&8";
    var base=e.name.replace(/\.(mig|json)$/,"");
    if(!searchText)return"&f"+base+extC+ext;
    var qi=e.name.toLowerCase().indexOf(searchText.toLowerCase());
    if(qi===-1)return"&f"+base+extC+ext;
    return"&f"+e.name.substring(0,qi)+"&6&l"+e.name.substring(qi,qi+searchText.length)
        +"&r&f"+e.name.substring(qi+searchText.length).replace(/\.(mig|json)$/,"")+extC+ext;
}

// ─── Mouse / Key ──────────────────────────────────────────────

gui.registerClicked(function(mx,my,btn){
    layout();
    if(btn===1){if(searchMode){searchText="";searchActive=false;filter();}else if(subDir!=="")goUp();return;}
    if(btn!==0)return;
    if(mx>=L.fbX&&mx<=L.fbX+L.fbW&&my>=L.fbY&&my<=L.fbY+L.fbH){openFolder();playClick();return;}
    if(mx>=L.pX+2&&mx<=L.pX+L.pW&&my>=L.pY&&my<=L.pY+L.hH){
        dragging=true;dOX=mx-(Math.floor(L.sw/2-L.pW/2)+pOX);dOY=my-(Math.floor(L.sh/2-L.pH/2)+pOY);return;}
    if(mx>=L.sX&&mx<=L.sX+L.sW&&my>=L.sY&&my<=L.sY+L.sH){searchActive=true;return;}
    searchActive=false;
    var total=Math.max(1,Math.ceil(filtered.length/perPage));
    var pcx=Math.floor(L.pX+L.pW/2);
    if(mx>=L.pX+L.pW-24&&mx<=L.pX+L.pW-7&&my>=L.fY+4&&my<=L.fY+22){refresh();playClick();return;}
    if(mx>=L.pX+8&&mx<=L.pX+46&&my>=L.fY+4&&my<=L.fY+22){
        if(searchMode){searchText="";searchActive=false;filter();}else goUp();playClick();return;}
    if(page>0&&mx>=pcx-22&&mx<=pcx-4&&my>=L.fY+4&&my<=L.fY+22){page--;playClick();return;}
    if(page+1<total&&mx>=pcx+4&&mx<=pcx+22&&my>=L.fY+4&&my<=L.fY+22){page++;playClick();return;}
    if(hoverIdx>=0&&hoverIdx<filtered.length){
        var e=filtered[hoverIdx];
        if(!e.isDir){
            var tx=L.lX+L.lW-18;
            if(mx>=tx&&mx<=tx+16){delFile(e);return;}
            e.isJson?loadJson(e):loadMig(e);
        }else{subDir+=e.name+"/";previewCache={};refresh();playClick();}
    }
});

register("guiMouseRelease",function(){dragging=false;});

gui.registerKeyTyped(function(ch,code){
    if(code===1){gui.close();return;}
    if(code===14){
        if(searchText.length>0){searchText=searchText.slice(0,-1);filter();}
        else{if(searchMode){searchActive=false;filter();}else if(subDir!=="")goUp();}
        return;
    }
    if(ch&&ch!=="\u0000"){searchText+=ch;searchActive=true;filter();}
});

// ─── Actions ──────────────────────────────────────────────────

function loadMig(e){
    var path=(e.rel||subDir)+e.name.replace(/\.mig$/,"");
    lastPath=path;gui.close();
    setTimeout(function(){ChatLib.command("mm import "+path,true);},80);
}

function loadJson(e){
    try{
        var rel=(e.rel||subDir)+e.name;
        var raw=FileLib.read(BASE+rel);
        if(!raw){msg("&cCould not read: "+rel);return;}
        var nbtStr=JSON.parse(raw).item;
        if(!nbtStr){msg("&cNo item key.");return;}
        var C10=Java.type("net.minecraft.network.play.client.C10PacketCreativeInventoryAction");
        var IS=Java.type("net.minecraft.item.ItemStack");
        var NBT=Java.type("net.minecraft.nbt.JsonToNBT");
        var IR=Java.type("net.minecraft.item.Item");
        var compound=NBT.func_180713_a(nbtStr);
        var idTag=compound.func_74781_a("id");
        var id=idTag?(""+idTag).replace(/"/g,""):"minecraft:stone";
        var count=compound.func_74762_e("Count")||1;
        var damage=compound.func_74765_d("Damage")||0;
        var mc=IR.func_111206_d(id);
        if(!mc){msg("&cUnknown ID: "+id);return;}
        var stk=new IS(mc,count,damage);
        var tagNBT=compound.func_74775_l("tag");
        if(tagNBT)stk.func_77982_d(tagNBT);
        var inv=Player.getInventory(),slot=-1;
        for(var i=9;i<=35&&slot===-1;i++){try{var s=inv.getStackInSlot(i);if(!s||s.getID()===0)slot=i;}catch(_){}}
        for(var i=36;i<=44&&slot===-1;i++){try{var s=inv.getStackInSlot(i);if(!s||s.getID()===0)slot=i;}catch(_){}}
        if(slot===-1){msg("&cInventory full!");return;}
        gui.close();
        setTimeout(function(){Client.sendPacket(new C10(slot,stk));msg("&aLoaded &f"+e.name);},80);
    }catch(err){msg("&cJSON error: "+err);}
}

function delFile(e){
    var key=(e.rel||subDir)+e.name;
    delete previewCache[key];
    try{new java.io.File(BASE+(e.rel||subDir)+e.name).delete();playPaper();refresh();}
    catch(err){msg("&cDelete failed: "+err);}
}

function goUp(){
    var s=subDir.replace(/\/$/,""),l=s.lastIndexOf("/");
    subDir=l===-1?"":s.substring(0,l+1);previewCache={};refresh();
}

function openFolder(){
    try{
        var d=new java.io.File(new java.io.File(".").getCanonicalPath()+"/config/ChatTriggers/modules/Morgen/imports");
        if(!d.exists())d.mkdirs();java.awt.Desktop.getDesktop().open(d);
        msg("&aOpened imports folder.");
    }catch(e){msg("&cFailed: "+e);}
}

function loadPos(){try{var r=FileLib.read("Morgen/config","guiPos.json");if(!r)return;var p=JSON.parse(r);pOX=p.x||0;pOY=p.y||0;}catch(_){}}
function savePos(){try{var b=new java.io.File(".").getCanonicalPath();new java.io.File(b+"/config/ChatTriggers/modules/Morgen/config").mkdirs();FileLib.write("Morgen/config","guiPos.json",JSON.stringify({x:pOX,y:pOY}));}catch(_){}}
register("guiClosed",function(){if(open2)savePos();open2=false;dragging=false;previewEntry=null;});

export function openMigBrowser(){
    subDir="";searchText="";searchActive=false;searchMode=false;
    page=0;dragging=false;previewCache={};loadPos();refresh();open2=true;gui.open();
}