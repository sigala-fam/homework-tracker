/* ═══════════════════════════════════════════════════════════════════════
   MIDNIGHT — the pixel-cat mascot, and the little ledge scene she lives on.

   This one file is the single source of truth for Midnight's art. It is used
   by BOTH the real app (homework-tracker/index.html) and the drawing studio
   (midnight-mockups/index.html), so a tweak here shows up in both places.

   How it is organised (same structure as the studio page):
     1. palette          — every colour Midnight and her scene are made of
     2. pixel kit        — tiny helpers: set / rect / ell / brush / smooth …
     3. shared face      — drawEars / drawEye / drawMuzzle, so all poses match
     4. one function per pose — poseWalk / poseSit / poseGroom / poseLounge /
                           poseSleep  (copied unchanged from the studio)
     5. the scene        — drawScene(): wall, window + moon + stars, ledge, plants
     6. renderer + brain — turns a grid into SVG, and walks her along the ledge
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════ 1 · palette ═══════════ */
export const C = {
  B:'#363442', K:'#201e29', L:'#5b5566',
  RIM:'#6d72bd', RIM2:'#474a7d', SHEEN:'#4fae8e', SHEEN2:'#316258',
  S:'#ffffff', N:'#F2A0B5', W:'#6f6a7d', CO:'#DA7756', T:'#FBBF24', I:'#b07a86',
  TONGUE:'#FB7DA8', Z:'#bdb7c6', SH:'rgba(0,0,0,0.30)',
  EYE:{ lid:'#15302a', teal:'#3fbfae', emerald:'#37b869', gold:'#f6c445',
        glow:'#ffe38a', pupil:'#0e0d14', shine:'#ffffff' }
};

/* The room she lives in changes with the clock. Things that look the same at
   any hour live in BASE; everything the time of day touches lives in SKINS. */
const BASE = {
  starA:'#ffffff', starB:'#FBBF24', starC:'#cfe3ff',
  rainA:'#c3d6ea', rainB:'#8497ad',                 // near drops / far drops
  wood:'#7d5940', woodHi:'#9b7053', woodLo:'#573c2b', woodDk:'#3a271c',
  pot:'#DA7756', potHi:'#ea9273', potLo:'#a55539', soil:'#31241c',
  leaf:'#3d9a72', leafHi:'#5fc194', leafLo:'#286a4f'
};

export const SKINS = {
  /* overcast, heavy cloud, rain running down the glass — the cosy one */
  rainy: {
    wall:'#37324d', wallGlow:'#413b5a', wallGlow2:'#4a4366', wallLo:'#251f36', wallDk:'#191426',
    frame:'#5d5378', frameHi:'#71668d', frameLo:'#3c3452',
    skyLo:'#414c60', sky:'#4d5a6c', skyHi:'#5c6879', glow:'#74808f',
    orb:null,                                        // no sun today
    craters:false, clouds:'heavy', cloudC:'#59637a', cloudLo:'#4a5468',
    rain:true, stars:0, ledgeLit:'#a08d7e'
  },
  /* bright blue sky, sun high, drifting clouds, no stars */
  sunny: {
    wall:'#4c4462', wallGlow:'#5b5378', wallGlow2:'#6a628b', wallLo:'#372f4a', wallDk:'#282136',
    frame:'#6b5f88', frameHi:'#82769f', frameLo:'#453c5e',
    skyLo:'#3d8fd8', sky:'#5aa8e8', skyHi:'#86c6f2', glow:'#b9e0f8',
    orbX:125, orbY:20, orbR:8, orb:'#fff9d2', orbLo:'#ffd95e', orbHalo:'#ffefae',
    craters:false, clouds:true, cloudC:'#ffffff', cloudLo:'#cfe4f5',
    stars:0, ledgeLit:'#c9a077'
  },
  /* the sun sinking into a warm horizon, first few stars overhead */
  evening: {
    wall:'#332b46', wallGlow:'#443351', wallGlow2:'#57405c', wallLo:'#221c33', wallDk:'#171224',
    frame:'#57496f', frameHi:'#6d5d87', frameLo:'#372f4b',
    skyLo:'#3a2a5e', sky:'#6b4270', skyHi:'#b0605c', glow:'#ee9f5c',
    orbX:125, orbY:45, orbR:8, orb:'#ffe3a4', orbLo:'#f6ac5c', orbHalo:'#d4785c',
    craters:false, clouds:true, cloudC:'#ffc9a6', cloudLo:'#c98a7e',
    stars:6, ledgeLit:'#c9885d'
  },
  /* her namesake hour: deep sky, full moon, the whole sky full of stars */
  night: {
    wall:'#241f36', wallGlow:'#2b2542', wallGlow2:'#332c4e', wallLo:'#171425', wallDk:'#0f0d1a',
    frame:'#4d4468', frameHi:'#63587f', frameLo:'#332d47',
    skyLo:'#0d0e24', sky:'#141634', skyHi:'#1b1f45', glow:'#23295c',
    orbX:125, orbY:21, orbR:7, orb:'#f8eec6', orbLo:'#ddd0a2', orbHalo:'#2a2f61',
    craters:true, clouds:false, cloudC:'#ffffff', cloudLo:'#d6e9f7',
    stars:22, ledgeLit:'#b3835f'
  }
};

/* the palette drawScene() reads — swapped by useSkin() before each repaint */
export let S = Object.assign({}, BASE, SKINS.night);
function useSkin(name){ S = Object.assign({}, BASE, SKINS[name] || SKINS.night); }

/* What daytime looks like when nobody has picked anything. */
export const DAY_LOOK = 'sunny';

/* Which look the clock says, given what daytime should look like. Midnight is
   still a night cat — this just means we get to watch her doze through a rainy
   afternoon too. */
export function phaseNow(dayLook, d){
  const h = (d || new Date()).getHours();
  if (h < 6)  return 'night';
  if (h < 18) return dayLook || DAY_LOOK;
  if (h < 21) return 'evening';
  return 'night';
}

/* ── What you can pick ──
   The two "auto" ones follow the clock; the rest pin one look forever. */
export const LOOKS = [
  { id:'auto-rainy', label:'Auto · rain', auto:'rainy' },
  { id:'auto-sunny', label:'Auto · sun',  auto:'sunny' },
  { id:'rainy',      label:'Rainy'   },
  { id:'sunny',      label:'Sunny'   },
  { id:'evening',    label:'Evening' },
  { id:'night',      label:'Night'   }
];
const LOOK_STORE = 'hw-midnight-look';
const DEFAULT_LOOK = 'auto-sunny';        // cycles sunny → evening → night

/* localStorage can throw (private browsing), and it must never break the page */
function savedLook(){
  try { const v = localStorage.getItem(LOOK_STORE);
        return LOOKS.some(l => l.id === v) ? v : DEFAULT_LOOK; }
  catch (e) { return DEFAULT_LOOK; }
}
function saveLook(id){ try { localStorage.setItem(LOOK_STORE, id); } catch (e) {} }

/* ── whether Midnight shows up on the sign-in screen at all ── */
const ON_STORE = 'hw-midnight-on';
export function midnightOn(){
  try { return localStorage.getItem(ON_STORE) !== '0'; } catch (e) { return true; }
}
export function setMidnightOn(on){
  try { localStorage.setItem(ON_STORE, on ? '1' : '0'); } catch (e) {}
  announceLook();
}

/* Every mounted scene subscribes here, so picking a look in Settings also
   updates the sign-in scene sitting behind the app. */
const watchers = new Set();
function announceLook(){ watchers.forEach(fn => { try { fn(); } catch (e) {} }); }
/* …and so can the page itself, to show or hide the whole room */
export function onMidnightChange(fn){ watchers.add(fn); return () => watchers.delete(fn); }

/* ── account sync ──
   localStorage stays the working copy, because the sign-in screen has to draw
   her before anyone is logged in. app.js mirrors these into the user's
   Firestore doc and calls midnightAdopt() after login to pull them back down. */
export function midnightLook(){ return savedLook(); }
export function midnightPrefs(){ return { look: savedLook(), on: midnightOn() }; }
export function midnightAdopt(prefs){
  if (!prefs) return false;
  let changed = false;
  if (prefs.look && LOOKS.some(l => l.id === prefs.look) && prefs.look !== savedLook()) {
    saveLook(prefs.look); changed = true;
  }
  if (typeof prefs.on === 'boolean' && prefs.on !== midnightOn()) {
    try { localStorage.setItem(ON_STORE, prefs.on ? '1' : '0'); } catch (e) {}
    changed = true;
  }
  if (changed) announceLook();
  return changed;
}

/* a chosen look → the skin to actually draw */
export function skinFor(lookId){
  const look = LOOKS.find(l => l.id === lookId);
  if (look && look.auto) return phaseNow(look.auto);
  return SKINS[lookId] ? lookId : phaseNow();
}

/* ═══════════ 2 · tiny pixel drawing kit ═══════════ */
export const CAT_W = 46, CAT_H = 50;                 // Midnight's own grid
export const SCENE_W = 300, SCENE_H = 108;           // the boxed room's grid
export const LEDGE_Y = 90;                           // top of the shelf she walks on
const RAIN_P = 12;                                   // rain repeats every 12 rows

/* ── where everything sits ──
   The room comes in two shapes: a small framed box (Settings, the studio) and
   a full-bleed page background where the ledge runs the whole width. Rather
   than two sets of drawings, the art is authored once against the boxed
   300×108 grid and everything is drawn at an offset from this layout. Feed it
   any width/height in cells and the same room stretches to fit. */
export function roomLayout(cols,rows,ledgeRow,boxedWinW){
  const ledge = ledgeRow!=null ? ledgeRow : Math.round(rows*0.34);
  let winW, sillH, gap;
  if(boxedWinW){
    winW=boxedWinW; sillH=6; gap=26;                 // the boxed room, exactly as authored
  }else{
    // Full-bleed: make the window as big as the wall above the shelf allows.
    // The whole block is winH + sill + gap ≈ 0.5825·winW + gap, so invert that.
    const byHeight=Math.floor((ledge-16)/0.5825);
    winW=Math.max(96,Math.min(210,Math.min(byHeight,Math.round(cols*0.34))));
    sillH=Math.round(winW/16);
    gap=12;                                          // sit it close over the shelf
  }
  const winH=Math.round(winW*0.52);                  // 52:100, as authored
  const cx=Math.round(cols/2);
  const winX=cx-Math.round(winW/2);
  // On a wide-but-short window the block can outgrow the wall above the
  // shelf; give back the gap before letting it run off the top edge.
  let winY=ledge-(winH+sillH+gap);
  if(winY<3){ gap=Math.max(3,gap-(3-winY)); winY=Math.max(0,ledge-(winH+sillH+gap)); }
  return { cols, rows, ledge, cx, winX, winY, winW, winH, sillH,
           skyX:winX+Math.round(winW*0.05), skyY:winY+Math.round(winH*0.0962),
           skyW:Math.round(winW*0.91),      skyH:Math.round(winH*0.8269) };
}
/* the four panes of glass [x,y,w,h] — the rain is clipped to these.
   Derived from the authored pane grid so they follow the window's size. */
function panesOf(L){
  const sx=v=>L.skyX+Math.round((v-105)*L.skyW/91), sy=v=>L.skyY+Math.round((v-11)*L.skyH/43);
  return [[105,11,146,29],[152,11,195,29],[105,35,146,53],[152,35,195,53]]
    .map(([x0,y0,x1,y1])=>[sx(x0),sy(y0),sx(x1)-sx(x0)+1,sy(y1)-sy(y0)+1]);
}
let LAY = roomLayout(SCENE_W,SCENE_H,LEDGE_Y,100);       // the layout being drawn

let Wg = CAT_W, Hg = CAT_H, g = null;
function newGrid(){ return Array.from({length:Hg},()=>Array(Wg).fill(null)); }
function set(x,y,c){ x=Math.round(x); y=Math.round(y); if(x>=0&&x<Wg&&y>=0&&y<Hg) g[y][x]=c; }
function getp(x,y){ return (y>=0&&y<Hg&&x>=0&&x<Wg)?g[y][x]:null; }
function ell(cx,cy,rx,ry,c){ for(let y=0;y<Hg;y++)for(let x=0;x<Wg;x++){const dx=(x-cx)/rx,dy=(y-cy)/ry; if(dx*dx+dy*dy<=1) set(x,y,c);} }
function rect(x0,y0,x1,y1,c){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) set(x,y,c); }
function brush(pts,r,c,rec){
  for(let i=0;i<pts.length-1;i++){
    const [x0,y0]=pts[i],[x1,y1]=pts[i+1];
    const steps=Math.ceil(Math.hypot(x1-x0,y1-y0)*3);
    for(let s=0;s<=steps;s++){ const t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;
      for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++) if(xx*xx+yy*yy<=r*r){
        const gx=Math.round(x+xx),gy=Math.round(y+yy);
        if(gx>=0&&gx<Wg&&gy>=0&&gy<Hg){ g[gy][gx]=c; if(rec) rec.add(gy*Wg+gx); }
      }
    }
  }
}
/* smooth away jagged notches + stray specks (run BEFORE details are added) */
function smooth(){
  const nb=(x,y)=>{let n=0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{ if(getp(x+dx,y+dy)) n++; });return n;};
  for(let p=0;p<2;p++){
    const fill=[],clear=[];
    for(let y=0;y<Hg;y++)for(let x=0;x<Wg;x++){
      if(!g[y][x]){ if(nb(x,y)>=3) fill.push([x,y]); }
      else if(nb(x,y)===0) clear.push([x,y]);
    }
    fill.forEach(([x,y])=>set(x,y,C.B));
    clear.forEach(([x,y])=>{ g[y][x]=null; });
  }
}
/* underside shadow: darken the lowest fur pixel in each column */
function underShadow(){
  for(let x=0;x<Wg;x++){ for(let y=Hg-1;y>=0;y--){ if(g[y][x]===C.B){ g[y][x]=C.K; break; } } }
}
/* iridescent sheen along the TOP edge (side-on poses) */
function sheenTop(x0,x1){
  const mid=(x0+x1)/2;
  for(let x=x0;x<=x1;x++){ for(let y=0;y<Hg;y++){ if(g[y][x]===C.B){
    const cool=x<mid; g[y][x]=cool?C.SHEEN:C.RIM;
    if(getp(x,y+1)===C.B) g[y+1][x]=cool?C.SHEEN2:C.RIM2;
    break; } } }
}
/* iridescent sheen along the BACK edge (upright poses) */
function sheenLeft(y0,y1){
  for(let y=y0;y<=y1;y++){ for(let x=0;x<Wg;x++){ if(g[y][x]===C.B){
    const top=y<(y0+y1)/2; g[y][x]=top?C.RIM:C.SHEEN;
    if(getp(x+1,y)===C.B) g[y][x+1]=top?C.RIM2:C.SHEEN2;
    break; } } }
}
/* soft contact shadow on the ground */
function contact(cx,half,gy){
  for(let x=cx-half;x<=cx+half;x++){
    const h=Math.round(1.6*Math.sqrt(Math.max(0,1-Math.pow((x-cx)/half,2))));
    for(let dy=-h;dy<=h;dy++){ const yy=gy+dy; if(yy>=0&&yy<Hg&&!getp(x,yy)) set(x,yy,C.SH); }
  }
}
/* rim-light: any pixel of one of `from` whose neighbour isn't also `from` becomes `to` */
function edgeLight(from,to,dx,dy){
  const inSet=(c)=>from.indexOf(c)>=0;
  const hits=[];
  for(let y=0;y<Hg;y++)for(let x=0;x<Wg;x++){ if(inSet(g[y][x]) && !inSet(getp(x+dx,y+dy))) hits.push([x,y]); }
  hits.forEach(([x,y])=>set(x,y,to));
}

/* ═══════════ 3 · shared face parts (hand-placed => always crisp) ═══════════ */
const EAR_FAR=[[-4,-9,'K'],[-5,-8,'K'],[-4,-8,'B'],[-5,-7,'K'],[-4,-7,'B'],[-3,-7,'B'],
  [-6,-6,'K'],[-5,-6,'B'],[-4,-6,'I'],[-3,-6,'B'],
  [-6,-5,'K'],[-5,-5,'B'],[-4,-5,'I'],[-3,-5,'I'],[-2,-5,'B'],
  [-6,-4,'B'],[-5,-4,'B'],[-4,-4,'I'],[-3,-4,'I'],[-2,-4,'B']];
const EAR_NEAR=[[3,-9,'K'],[3,-8,'B'],[4,-8,'K'],[2,-7,'B'],[3,-7,'B'],[4,-7,'K'],
  [2,-6,'B'],[3,-6,'I'],[4,-6,'B'],[5,-6,'K'],
  [1,-5,'B'],[2,-5,'I'],[3,-5,'I'],[4,-5,'B'],[5,-5,'K'],
  [1,-4,'B'],[2,-4,'I'],[3,-4,'I'],[4,-4,'B'],[5,-4,'B']];
const EPAL={B:C.B,K:C.K,I:C.I};
function drawEars(cx,cy){
  // clear a little airspace above the head so the ear points stay crisp
  for(let dy=-10;dy<=-4;dy++) for(let dx=-7;dx<=6;dx++) if(getp(cx+dx,cy+dy)) set(cx+dx,cy+dy,null);
  [EAR_FAR,EAR_NEAR].forEach(ear=>ear.forEach(([dx,dy,c])=>set(cx+dx,cy+dy,EPAL[c])));
}
/* relaxed, folded-back ears for the sleeping pose */
function drawSleepEars(cx,cy){
  const far=[[-5,-5,'K'],[-4,-5,'B'],[-5,-4,'K'],[-4,-4,'I'],[-3,-4,'B'],[-4,-3,'B'],[-3,-3,'B']];
  const near=[[1,-6,'K'],[1,-5,'B'],[2,-5,'K'],[1,-4,'B'],[2,-4,'I'],[3,-4,'B'],[2,-3,'B'],[3,-3,'B']];
  [far,near].forEach(e=>e.forEach(([dx,dy,c])=>set(cx+dx,cy+dy,EPAL[c])));
}
function drawEye(cx,cy,closed){
  const E=C.EYE;
  // a contented closed eye: a soft pale lash-line that curves up at the end
  if(closed){ set(cx,cy,C.L); set(cx+1,cy,C.L); set(cx+2,cy,C.L); set(cx+3,cy-1,C.L); return; }
  for(let i=-1;i<=3;i++) set(cx+i,cy-2,E.lid);
  set(cx-1,cy-1,E.teal); set(cx,cy-1,E.shine); set(cx+1,cy-1,E.pupil); set(cx+2,cy-1,E.gold);    set(cx+3,cy-1,E.emerald);
  set(cx-1,cy,  E.teal); set(cx,cy,  E.emerald); set(cx+1,cy,  E.pupil); set(cx+2,cy,  E.glow);   set(cx+3,cy,  E.emerald);
  set(cx,cy+1,E.lid); set(cx+1,cy+1,E.lid); set(cx+2,cy+1,E.lid);
}
function drawMuzzle(cx,cy,tongue){
  set(cx+6,cy+2,C.N); set(cx+7,cy+2,C.N); set(cx+7,cy+3,C.N);   // pink nose
  set(cx+4,cy+4,C.K); set(cx+5,cy+4,C.K); set(cx+6,cy+4,C.K);   // mouth line
  set(cx+8,cy+1,C.W); set(cx+9,cy,C.W);                          // whiskers (soft)
  set(cx+8,cy+5,C.W); set(cx+9,cy+5,C.W);
  if(tongue){ set(cx+6,cy+5,C.TONGUE); set(cx+7,cy+5,C.TONGUE); }
}
function drawFace(cx,cy,o){ o=o||{}; drawEars(cx,cy,o.squash); drawEye(cx,cy,o.closed); drawMuzzle(cx,cy,o.tongue); }
function collar(pts,tagx,tagy){
  brush(pts,1.0,C.CO);
  if(tagx!==undefined){ set(tagx,tagy,C.T); set(tagx,tagy+1,C.T); }
}
/* a leg: planted (straight to the floor) or stepping (bent, lifted & swung forward) */
function leg(hx,top,bottom,step){
  if(!step){
    rect(hx,top,hx+1,bottom-1,C.B); ell(hx+1,bottom,2.2,1.4,C.B);   // paw on the ground
  }else{
    const knee=Math.round(top+(bottom-top)*0.5);
    rect(hx,top,hx+1,knee,C.B);                 // thigh
    rect(hx+2,knee,hx+3,bottom-4,C.B);          // shin swung forward
    ell(hx+3,bottom-4,2.2,1.4,C.B);             // paw lifted clear of the floor
  }
}
/* draw something with a dark outline so it reads against fur of the same colour */
function outlined(fn){ fn(C.K,1.1); fn(C.B,0); }

/* ═══════════ 4 · one function per pose ═══════════ */
export function poseSit(){
  const tail=new Set();
  brush([[13,40],[15,45],[23,47],[30,46],[33,41],[32,36],[29,34]],1.9,C.B,tail);
  brush([[33,41],[32,36],[29,34]],1.2,C.B,tail);
  ell(20.5,34,8,10,C.B); ell(22,21,6,8,C.B); ell(24,10,6.5,6,C.B);
  ell(29,12,2.6,2.2,C.B); rect(25,14,28,20,C.B);
  rect(24,35,26,44,C.B); ell(25,44,2.7,1.8,C.B);
  smooth();
  ell(23.5,28,2.4,6,C.L);
  [[18,10],[18,11],[19,9]].forEach(([x,y])=>{ if(getp(x,y)===C.B) set(x,y,C.RIM2); });
  sheenLeft(17,38);
  underShadow();
  set(26,16,C.K); set(27,16,C.K); set(27,17,C.K);
  const tv=[...tail].map(k=>[k%Wg,(k/Wg)|0]).filter(([x,y])=>g[y][x]===C.B);
  const top={}; tv.forEach(([x,y])=>{ if(top[x]===undefined||y<top[x]) top[x]=y; });
  for(const x in top){ if(+x>=28) g[top[x]][+x]=C.SHEEN; }
  tv.forEach(([x,y])=>{ if(x>=29&&getp(x-1,y)===C.B&&!tail.has(y*Wg+(x-1))) set(x-1,y,C.K); });
  collar([[21,18],[24,19],[27,18]],24,20);
  drawFace(24,10);
  contact(21,10,46);
}

export function poseWalk(frame){
  const tail=new Set();
  brush([[11,31],[7,28],[5,22],[7,17],[11,15]],1.7,C.B,tail);  // tail up with a curl
  ell(19,32,10,5.5,C.B);                               // barrel body
  ell(13,32,6,6,C.B);                                  // rump
  ell(26,31,5.5,5.5,C.B);                              // shoulder
  ell(31,25,6.5,6,C.B);                                // head
  ell(36,27,2.6,2.2,C.B);                              // muzzle
  rect(27,26,31,32,C.B);                               // neck
  const A=(frame===0);
  leg(11,35,44,!A); leg(17,35,44,A);                   // hind pair  \ diagonal
  leg(25,35,44,A);  leg(30,35,44,!A);                  // front pair /  gait
  smooth();
  ell(20,35,7,2,C.L);                                  // lighter belly
  sheenTop(12,34);                                     // sheen on the BODY only
  underShadow();
  // a whisper of sheen on the tail's outer edge (kept subtle)
  [...tail].map(k=>[k%Wg,(k/Wg)|0]).forEach(([x,y])=>{
    if(g[y][x]===C.B && getp(x-1,y)!==C.B && y<26) g[y][x]=C.SHEEN2;
  });
  collar([[26,29],[29,31],[32,29]],29,32);
  drawFace(31,25);
  contact(21,13,46);
}

export function poseGroom(){
  const tail=new Set();
  brush([[13,40],[15,45],[23,47],[30,46],[33,42],[33,38]],1.9,C.B,tail);
  ell(20.5,34,8,10,C.B); ell(22,21,6,8,C.B);
  ell(25,14,6.5,6,C.B);                                // head bowed toward the paw
  ell(30,16,2.6,2.2,C.B); rect(25,18,29,24,C.B);       // muzzle + neck
  smooth();
  ell(23.5,30,2.4,5,C.L);
  sheenLeft(21,38);
  underShadow();
  collar([[21,22],[24,23],[27,22]],24,24);
  // raised front paw lifted up to the mouth — outlined so it reads against the chest
  outlined((col,pad)=>{
    brush([[24,36],[27,30],[31,24]],1.6+pad,col);
    ell(31,23,2.2+pad,1.9+pad,col);
  });
  drawFace(25,14,{tongue:true});
  contact(21,10,46);
}

export function poseLounge(){
  brush([[9,41],[4,43],[2,46]],1.7,C.B);               // tail trailing on the floor
  ell(19,39,12,5,C.B);                                 // long lying body
  ell(11,39,5.5,4.5,C.B);                              // hip
  ell(27,38,5,4.5,C.B);                                // shoulder
  ell(33,31,6.5,6,C.B);                                // head held up
  ell(38,33,2.6,2.2,C.B);                              // muzzle
  rect(29,33,34,39,C.B);                               // neck
  rect(28,41,37,43,C.B); ell(37,42,2.2,1.6,C.B);       // front legs stretched out
  rect(13,41,20,43,C.B);                               // back leg lying flat
  smooth();
  ell(23,41,4,1.3,C.L);                                // soft belly light
  sheenTop(4,38);
  underShadow();
  collar([[28,35],[31,37],[34,35]],31,38);
  drawFace(33,31);
  contact(20,15,46);
}

export function poseSleep(){
  ell(18,40,11,5.5,C.B);                               // curled-up loaf
  ell(29,34,5.8,5.2,C.B);                              // head, up clear of the curl
  ell(34,36,2.4,2,C.B);                                // muzzle
  smooth();
  ell(14,37,5,1.6,C.L);                                // moonlight on her back
  sheenTop(8,34);                                      // rim light over body AND head
  underShadow();
  // tail wrapped around IN FRONT of her, outlined so the wrap reads
  outlined((col,pad)=>brush([[10,44],[18,47],[27,46],[32,43]],1.5+pad,col));
  drawSleepEars(29,34);
  drawEye(28,34,true);                                 // eyes closed, content
  set(35,36,C.N); set(35,37,C.N);                      // nose
  set(36,35,C.W); set(37,34,C.W);                      // one soft whisker
  collar([[26,38],[29,39],[32,38]],29,40);
  // Zzz drifting up
  [[37,29],[39,26],[41,23]].forEach(([x,y])=>set(x,y,C.Z));
  contact(20,13,47);
}

/* ═══════════ 5 · the scene she lives in ═══════════ */
/* a cosy corner at night: wall, a window with the moon and stars,
   a wooden ledge across the whole width, and a plant at each end. */
/* a terracotta pot: rim on top, tapering body, soil inside */
function pot(cx,halfTop,rimY,baseY){
  const halfBase=halfTop-3;
  rect(cx-halfTop+2,rimY+1,cx+halfTop-2,rimY+2,S.soil);
  for(let y=rimY+3;y<=baseY;y++){
    const t=(y-(rimY+3))/Math.max(1,baseY-rimY-3);
    const h=Math.round(halfTop-2-(halfTop-2-halfBase)*t);
    rect(cx-h,y,cx+h,y,S.pot);
  }
  rect(cx-halfTop,rimY,cx+halfTop,rimY+3,S.pot);       // rim
  rect(cx-halfTop,rimY,cx+halfTop,rimY,S.potHi);       // lit top of the rim
}
/* a leaf blade: follows a curve while its thickness changes point to point,
   so it can start thin, swell in the middle and taper to a sharp tip */
function blade(pts,radii,c){
  for(let i=0;i<pts.length-1;i++){
    const [x0,y0]=pts[i],[x1,y1]=pts[i+1];
    const r0=radii[i], r1=radii[i+1];
    const steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)*3));
    for(let s=0;s<=steps;s++){
      const t=s/steps, x=x0+(x1-x0)*t, y=y0+(y1-y0)*t, r=r0+(r1-r0)*t, R=Math.ceil(r);
      for(let yy=-R;yy<=R;yy++) for(let xx=-R;xx<=R;xx++) if(xx*xx+yy*yy<=r*r) set(x+xx,y+yy,c);
    }
  }
}
/* a small pointed leaf growing out of a stem, from (x0,y0) toward (x1,y1) */
function leaf(x0,y0,x1,y1,c){ blade([[x0,y0],[(x0+x1)/2,(y0+y1)/2],[x1,y1]],[0.6,1.9,0.3],c); }

export function drawScene(){
  /* Everything below is authored against the boxed 300×108 room, then nudged
     by these offsets so the identical drawing also works full-bleed:
       wx,wy — the window block   ly — anything sitting on the ledge
       rx    — anything hugging the right-hand edge                        */
  const L=LAY, W=L.cols-1, H=L.rows-1;
  const ly=L.ledge-90, rx=L.cols-300;
  /* The window can be any size now, so its innards are mapped from the
     authored 91×43 sky box into whatever this room's sky box is. sx/sy map a
     point, sw/sh scale a length. */
  const sx=v=>L.skyX+Math.round((v-105)*L.skyW/91), sy=v=>L.skyY+Math.round((v-11)*L.skyH/43);
  const sw=v=>Math.max(1,Math.round(v*L.skyW/91)),  sh=v=>Math.max(1,Math.round(v*L.skyH/43));
  const skyR=L.skyX+L.skyW-1, skyB=L.skyY+L.skyH-1;
  const bt=Math.max(2,Math.round(L.winW/50));        // frame thickness

  /* ── wall, with a soft pool of light spilling out of the window ──
     three rings rather than two, so the falloff doesn't band on a wide wall */
  rect(0,0,W,H,S.wall);
  const gcy=L.winY+Math.round(L.winH*0.75);
  ell(L.cx,gcy,L.winW*1.50,L.winH*1.58,S.wallGlow);
  ell(L.cx,gcy-Math.round(L.winH*0.08),L.winW*1.20,L.winH*1.23,S.wallGlow2);
  ell(L.cx,gcy-Math.round(L.winH*0.19),L.winW*0.88,L.winH*0.88,S.wallGlow2);

  /* ── under the shelf the room falls away into shadow, with a little light
        still reaching down below the window ──
     Row-by-row rather than ell(), because ell() paints the whole grid and
     this pool must stop dead at the shelf instead of washing over the wall. */
  const drop=L.rows-L.ledge;
  if(drop>26){
    rect(0,L.ledge,W,H,S.wallDk);
    const cy=L.ledge+Math.round(drop*0.22), ry=drop*0.85,
          rx=Math.max(L.winW*1.9,L.cols*0.62);         // wide enough to clear the sides
    for(let y=L.ledge;y<=H;y++){
      const dy=(y-cy)/ry; if(Math.abs(dy)>1) continue;
      const half=rx*Math.sqrt(1-dy*dy);
      rect(Math.round(L.cx-half),y,Math.round(L.cx+half),y,S.wallLo);
    }
  } else {
    rect(0,L.ledge,W,H,S.wallLo);                      // the boxed room is too short to bother
  }

  /* ── window frame ── */
  rect(L.winX,L.winY,L.winX+L.winW,L.winY+L.winH,S.frameLo);
  rect(L.winX+bt,L.winY+bt,L.winX+L.winW-bt,L.winY+L.winH-bt,S.frame);
  rect(L.winX+bt+1,L.winY+bt+1,L.winX+L.winW-bt-1,L.winY+bt+2,S.frameHi);  // lit top edge

  /* ── sky: darkest at the top, warming toward the horizon ── */
  rect(L.skyX,sy(11),skyR,sy(22),S.skyLo);
  rect(L.skyX,sy(23),skyR,sy(38),S.sky);
  rect(L.skyX,sy(39),skyR,sy(48),S.skyHi);
  rect(L.skyX,sy(49),skyR,skyB,S.glow);

  /* ── sun or moon: a halo, a soft outer disc, a bright core ──
     (skipped entirely when it's overcast — no sun to be seen) ── */
  if(S.orb){
    const ox=sx(S.orbX), oy=sy(S.orbY), k=(L.skyW/91+L.skyH/43)/2, r=S.orbR*k;
    ell(ox,oy,r+3*k,r+3*k,S.orbHalo);
    ell(ox,oy,r,r,S.orbLo);
    ell(ox,oy,r-1.5*k,r-1.5*k,S.orb);
    if(S.craters){                                     // the moon's seas
      ell(ox-2*k,oy-2*k,1.7*k,1.5*k,S.orbLo);
      ell(ox+2*k,oy+2*k,1.4*k,1.3*k,S.orbLo);
      ell(ox+2*k,oy-4*k,1.1*k,1.1*k,S.orbLo);
    }
  }

  /* ── stars: the whole sky at night, just a few early ones at dusk ──
     (three colour groups so they twinkle out of step with each other) ── */
  const STARS=[[109,15],[112,26],[141,14],[138,27],[144,20],[158,16],
               [168,13],[176,22],[188,17],[163,27],[192,25],
               [110,41],[120,48],[131,38],[141,50],[126,44],
               [157,40],[166,47],[178,41],[189,50],[171,52],[184,37]];
  const SC=[S.starA,S.starB,S.starC];
  STARS.slice(0,S.stars).forEach(([ax,ay],i)=>{
    const c=SC[i%3], x=sx(ax), y=sy(ay);
    set(x,y,c);
    if(i%5===0){ set(x-1,y,c); set(x+1,y,c); set(x,y-1,c); set(x,y+1,c); }   // sparkle shape
  });

  /* ── clouds, drawn after the sun so they drift in front of it ── */
  const LIGHT=[[162,17,7],[176,26,5],[118,45,6],[172,46,8]];
  const HEAVY=[[122,16,9],[152,14,7],[180,18,8],[112,24,6],
               [168,27,6],[140,21,5],[118,44,7],[170,45,8]];
  if(S.clouds){
    (S.clouds==='heavy'?HEAVY:LIGHT).forEach(([acx,acy,w])=>{
      const cx=sx(acx), cy=sy(acy), ww=sw(w), hh=sh(2.2);
      ell(cx,cy,ww,hh,S.cloudLo);
      ell(cx-ww*0.3,cy-hh*0.68,ww*0.45,hh*0.9,S.cloudLo);
      ell(cx+ww*0.25,cy-hh*0.45,ww*0.4,hh*0.8,S.cloudLo);
      ell(cx,cy-hh*0.4,ww*0.75,hh*0.6,S.cloudC);
    });
  }

  /* ── glazing bars ── */
  rect(sx(147),sy(11),sx(151),skyB,S.frame); rect(sx(147),sy(11),sx(147),skyB,S.frameHi);
  rect(L.skyX,sy(30),skyR,sy(34),S.frame);  rect(L.skyX,sy(30),skyR,sy(30),S.frameHi);

  /* ── window sill ── */
  const so=Math.round(L.winW*0.04), sTop=L.winY+L.winH, sBot=sTop+L.sillH;
  rect(L.winX-so,sTop,L.winX+L.winW+so,sBot,S.wood);
  rect(L.winX-so,sTop,L.winX+L.winW+so,sTop,S.woodHi);
  rect(L.winX-so,sBot-1,L.winX+L.winW+so,sBot,S.woodLo);
  rect(L.winX-so+2,sBot+1,L.winX+L.winW+so-2,sBot+2,S.wallLo);   // sill's shadow on the wall

  /* ── the ledge she walks along — runs the full width, whatever that is ── */
  rect(0,L.ledge,W,L.ledge+1,S.woodHi);                // lit top surface
  rect(0,L.ledge+2,W,L.ledge+5,S.wood);                // front face
  rect(0,L.ledge+6,W,L.ledge+7,S.woodLo);
  rect(0,L.ledge+8,W,L.ledge+8,S.woodDk);
  for(let x=12;x<L.cols-18;x+=48){                     // grain, spaced along the board
    const y=L.ledge+3+((x/48)&1);
    rect(x,y,x+15,y,S.woodLo);
  }
  // little brackets holding the shelf up — more of them on a wider board
  const inset=Math.round(L.cols*0.15), bx=[inset,L.cols-inset-8];
  if(L.cols>430) bx.push(Math.round(L.cols/2)-4);
  bx.forEach(b=>{ for(let i=0;i<8;i++) rect(b,L.ledge+9+i,b+8-i,L.ledge+9+i,S.woodDk); });

  /* ── left plant: a full, leafy one in a terracotta pot ──
     every blade springs from the same spot in the soil and tapers to a point */
  const P=(x,y)=>[x,y+ly];                             // left plant: hugs the left edge
  const LB=P(20,68);
  [[[16,60],[10,50],[6,41]],
   [[19,58],[16,47],[14,37]],
   [[21,57],[22,45],[23,35]],
   [[24,59],[28,49],[31,41]],
   [[26,62],[33,54],[38,47]],
   [[15,63],[8,57],[3,52]],
   [[27,65],[35,62],[41,59]]].forEach((path,i)=>{
    blade([LB,...path.map(([x,y])=>P(x,y))],[1.0,2.3,1.7,0.3],(i%2)?S.leafLo:S.leaf);
  });
  pot(20,15,66+ly,89+ly);

  /* ── right plant: a trailing vine spilling over the shelf edge ── */
  const R=(x,y)=>[x+rx,y+ly];                          // ...and this one the right edge
  const rl=(x0,y0,x1,y1,c)=>leaf(x0+rx,y0+ly,x1+rx,y1+ly,c);
  brush([R(278,76),R(285,67),R(289,60)],0.8,S.leafLo); // stem reaching for the moon
  rl(285,67,292,61,S.leaf); rl(283,70,276,64,S.leaf); rl(289,60,286,52,S.leaf);
  brush([R(278,76),R(271,68),R(268,61)],0.8,S.leafLo);
  rl(272,70,265,64,S.leafLo); rl(268,61,271,54,S.leaf);
  // one long vine hanging down over the front of the ledge
  brush([R(272,80),R(266,88),R(262,96),R(265,104)],0.8,S.leafLo);
  rl(266,88,259,84,S.leaf); rl(264,93,270,91,S.leafLo);
  rl(262,98,255,97,S.leaf); rl(265,104,268,99,S.leaf);
  pot(278+rx,15,74+ly,89+ly);

  /* ── light pooling on the shelf, right under the window ── */
  for(let x=L.winX+4;x<=L.winX+L.winW-4;x++){
    if(g[L.ledge][x]===S.woodHi) set(x,L.ledge,S.ledgeLit);
  }

  /* ── rim-light everything so it all sits together ── */
  edgeLight([S.leaf,S.leafLo],S.leafHi,0,-1);
  edgeLight([S.pot],S.potLo,-1,0);
  edgeLight([S.pot],S.potLo,1,0);
}

/* Rain, painted on its own transparent sheet OVER the room — never into the
   room's own grid, or the drops would punch holes through the wall behind
   them once they get clipped away. Two depths of drops. The pattern repeats
   every RAIN_P rows, so sliding a sheet down by exactly RAIN_P loops forever;
   the rows drawn above the glass are what feed that loop. */
export function drawRain(){
  const L=LAY;
  const sx=v=>L.skyX+Math.round((v-105)*L.skyW/91);
  const top=L.skyY-RAIN_P, bottom=L.skyY+L.skyH;
  const streak=(x,y,c,len)=>{ for(let i=0;i<len;i++) set(x-(i>>1),y+i,c); };
  const sheet=(cols,c,len,skew)=>cols.forEach((ax,i)=>{
    const ph=(i*skew)%RAIN_P, x=sx(ax);
    for(let y=top;y<=bottom;y+=RAIN_P) streak(x,y+ph,c,len);
  });
  sheet([106,112,118,123,129,135,140,146,154,159,165,170,176,182,187,193],BASE.rainA,3,5);
  sheet([109,115,121,126,132,138,143,156,162,168,173,179,185,191],BASE.rainB,2,7);
}

/* ═══════════ 6 · renderer ═══════════ */
const NS='http://www.w3.org/2000/svg';
/* Draws a grid into <g> elements. Runs of the same colour become ONE <rect>,
   which keeps the page fast. `layerMap` can put certain colours into their own
   sub-group so they can be animated on their own (the Zzz, the stars). */
function paint(parentEl,w,h,builder,cls,layerMap){
  const prev={g,Wg,Hg};
  Wg=w; Hg=h; g=newGrid();
  builder();
  const root=document.createElementNS(NS,'g');
  if(cls) root.setAttribute('class',cls);
  const layers=new Map();
  const host=(color)=>{
    const name=layerMap&&layerMap[color];
    if(!name) return root;
    if(!layers.has(name)){ const el=document.createElementNS(NS,'g'); el.setAttribute('class',name); layers.set(name,el); }
    return layers.get(name);
  };
  for(let y=0;y<h;y++){
    let x=0;
    while(x<w){
      const c=g[y][x];
      if(c==null){ x++; continue; }
      let x2=x; while(x2+1<w && g[y][x2+1]===c) x2++;
      const r=document.createElementNS(NS,'rect');
      r.setAttribute('x',x); r.setAttribute('y',y);
      r.setAttribute('width',x2-x+1); r.setAttribute('height',1);
      r.setAttribute('fill',c);
      host(c).appendChild(r);
      x=x2+1;
    }
  }
  layers.forEach(el=>root.appendChild(el));
  parentEl.appendChild(root);
  Wg=prev.Wg; Hg=prev.Hg; g=prev.g;
  return root;
}

const CAT_LAYERS={ [C.Z]:'pet-z' };
const SCENE_LAYERS={ [BASE.starA]:'twinkle-a', [BASE.starB]:'twinkle-b', [BASE.starC]:'twinkle-c',
                     [BASE.rainA]:'rain-a', [BASE.rainB]:'rain-b' };

export const POSES=[
  ['walk',null],['sit',poseSit],['groom',poseGroom],['lounge',poseLounge],['nap',poseSleep]
];

/* one <svg> holding every pose, stacked; the brain shows one at a time */
export function buildCatSvg(){
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox',`0 0 ${CAT_W} ${CAT_H}`);
  svg.setAttribute('class','midnight-cat');
  const walk=document.createElementNS(NS,'g');
  walk.setAttribute('class','pose pose-walk');
  svg.appendChild(walk);
  paint(walk,CAT_W,CAT_H,()=>poseWalk(0),'walkA',CAT_LAYERS);
  paint(walk,CAT_W,CAT_H,()=>poseWalk(1),'walkB',CAT_LAYERS);
  POSES.slice(1).forEach(([name,fn])=>paint(svg,CAT_W,CAT_H,fn,'pose pose-'+name,CAT_LAYERS));
  return svg;
}

let sceneId=0;
export function buildSceneSvg(phase,layout){
  useSkin(phase||phaseNow());
  LAY=layout||roomLayout(SCENE_W,SCENE_H,LEDGE_Y,100);
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox',`0 0 ${LAY.cols} ${LAY.rows}`);
  // fill rather than letterbox — if the fit is ever a frame behind, crop the
  // edges instead of showing bare gaps down the sides
  svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  svg.setAttribute('class','midnight-room');
  paint(svg,LAY.cols,LAY.rows,drawScene,'room',SCENE_LAYERS);

  if(S.rain){
    const id='mn-panes-'+(++sceneId);                 // unique per scene on the page
    const defs=document.createElementNS(NS,'defs');
    const clip=document.createElementNS(NS,'clipPath');
    clip.setAttribute('id',id);
    panesOf(LAY).forEach(([x,y,w,h])=>{
      const r=document.createElementNS(NS,'rect');
      r.setAttribute('x',x); r.setAttribute('y',y);
      r.setAttribute('width',w); r.setAttribute('height',h);
      clip.appendChild(r);
    });
    defs.appendChild(clip);
    svg.insertBefore(defs,svg.firstChild);
    // The clip goes on a STILL wrapper, never on the drifting sheets themselves:
    // SVG applies an element's transform before its clip, so a clip on a moving
    // sheet would slide down with it and let drops escape the window.
    const wrap=document.createElementNS(NS,'g');
    wrap.setAttribute('clip-path','url(#'+id+')');
    paint(wrap,LAY.cols,LAY.rows,drawRain,null,SCENE_LAYERS);
    svg.appendChild(wrap);
  }
  return svg;
}

/* a single pose on its own, for the studio page */
export function buildPoseSvg(fn){
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox',`0 0 ${CAT_W} ${CAT_H}`);
  paint(svg,CAT_W,CAT_H,fn,null,CAT_LAYERS);
  return svg;
}

/* ═══════════ 7 · her roaming brain ═══════════ */
/* walk along the ledge → stop → pick a random mood → sit there a while → repeat.
   Positions are a percentage across the scene, so it works at any size. */
/* Which moods she's in the mood for. She still naps in the afternoon and
   still pounces about at 1am — this only tips the dice. */
const MOODS={
  sunny:   ['sit','sit','groom','groom','lounge','nap'],
  rainy:   ['nap','nap','lounge','lounge','sit','groom'],   // rain = a napping cat
  evening: ['sit','groom','lounge','lounge','nap','nap'],
  night:   ['sit','groom','lounge','lounge','nap','nap','nap']
};
const REST={ sunny:[4000,4000], rainy:[6000,7000], evening:[5000,6000], night:[6000,8000] };

export function initMidnightBrain(cat,opts){
  opts=opts||{};
  let MIN=opts.min??22, MAX=opts.max??78;         // keep her clear of the plants
  // 15%/sec matches the 0.42s leg cycle — any slower and she moonwalks
  const SPEED=opts.speed??15;
  const phase=opts.getPhase||(()=>'night');
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let x=(MIN+MAX)/2, dir=1, target=x, raf=0, timer=0, last=0, dead=false;
  const show=(p)=>cat.querySelectorAll('.pose').forEach(el=>{
    el.style.display=el.classList.contains('pose-'+p)?'':'none';
  });
  const place=()=>{ cat.style.left=x.toFixed(2)+'%'; };
  const face=(d)=>{ cat.style.transform='translateX(-50%)'+(d<0?' scaleX(-1)':''); };
  // NB: an SVG element has no offsetParent at all, so ask her container (a
  // plain <div>) instead — it goes null exactly when the overlay is hidden.
  const onScreen=()=>!!(cat.parentElement&&cat.parentElement.offsetParent);

  function idle(){
    if(dead) return;
    const moods=MOODS[phase()]||MOODS.night, rest=REST[phase()]||REST.night;
    show(moods[Math.floor(Math.random()*moods.length)]);
    clearTimeout(timer);
    timer=setTimeout(startWalk, rest[0]+Math.random()*rest[1]);
  }
  function step(now){
    if(dead) return;
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    // if she's off-screen (signed in, tab hidden) don't burn battery
    if(!onScreen()){ clearTimeout(timer); timer=setTimeout(startWalk,1500); return; }
    const move=SPEED*dt;
    if(Math.abs(target-x)<=move){ x=target; place(); return idle(); }
    x+=dir*move; place();
    raf=requestAnimationFrame(step);
  }
  function startWalk(){
    if(dead) return;
    show('walk');
    // always take a decent stroll, never a pointless half-step
    do { target=MIN+Math.random()*(MAX-MIN); } while(Math.abs(target-x)<18);
    dir=(target>x)?1:-1;
    face(dir);
    cancelAnimationFrame(raf);
    last=performance.now();
    raf=requestAnimationFrame(step);
  }

  place(); face(1);
  // reduced motion: she just sits, but still needs to sit in a sensible spot
  if(reduce){ show('sit'); return { stop(){}, freeze(){}, setRange(lo,hi){ MIN=lo; MAX=hi; } }; }
  startWalk();
  return { stop(){ dead=true; cancelAnimationFrame(raf); clearTimeout(timer); },
           freeze(p){ cancelAnimationFrame(raf); clearTimeout(timer); show(p); },
           // the shelf gets longer or shorter when the window is resized
           setRange(lo,hi){ MIN=lo; MAX=hi; x=Math.min(Math.max(x,lo),hi); place(); } };
}

/* ═══════════ 8 · put the whole thing on the page ═══════════ */
/* the little row of buttons under the picture */
function buildPicker(chosen,onPick){
  const bar=document.createElement('div');
  bar.className='midnight-looks';
  bar.setAttribute('role','group');
  bar.setAttribute('aria-label','Weather in Midnight’s window');
  LOOKS.forEach(l=>{
    const b=document.createElement('button');
    b.type='button';                              // never submits the sign-in form
    b.className='midnight-look';
    b.dataset.look=l.id;
    b.textContent=l.label;
    b.setAttribute('aria-pressed',String(l.id===chosen));
    b.addEventListener('click',()=>onPick(l.id));
    bar.appendChild(b);
  });
  return bar;
}

export function mountMidnight(container,opts){
  opts=opts||{};
  if(!container || container.dataset.midnight) return null;
  container.dataset.midnight='1';

  // the framed picture. Purely decorative, and never in the way of a tap.
  const stage=document.createElement('div');
  stage.className='midnight-stage';
  stage.setAttribute('aria-hidden','true');
  container.appendChild(stage);

  const pinned=!!opts.phase;                      // the studio pins a look
  const full=opts.mode==='full';                  // fills the page instead of a box
  let look=pinned?opts.phase:savedLook();
  let current=null, lay=null;

  /* Work out the room's size in pixels. One screen-pixel is a fixed size, so
     the art never changes chunkiness — it's the *number* of pixels that
     changes with the window.
     Returns null when the page hasn't been laid out yet (a backgrounded tab
     reports zero size). Painting then would draw a tiny wrong room for a
     frame, so instead we wait: the ResizeObserver does the first paint the
     moment a real size shows up. */
  function measure(){
    if(!full) return roomLayout(SCENE_W,SCENE_H,LEDGE_Y,100);
    const r=stage.getBoundingClientRect();
    const w=Math.round(r.width||innerWidth||0), h=Math.round(r.height||innerHeight||0);
    if(w<40||h<40) return null;
    const c = w>=1100?2.6 : w>=700?2.3 : 1.95;
    return roomLayout(Math.max(220,Math.round(w/c)),
                      Math.max(140,Math.round(h/c)));
  }
  function placeCat(cat){
    if(!cat||!lay) return;
    cat.style.width=(46/lay.cols*100).toFixed(3)+'%';
    // her paws sit ~4.5 cells above the bottom of her own drawing
    cat.style.bottom=((lay.rows-lay.ledge-4.5)/lay.rows*100).toFixed(3)+'%';
  }
  function paintRoom(force){
    container.dataset.look=look;
    if(!lay) return;                              // no size yet — nothing to draw on
    const p=pinned?opts.phase:skinFor(look);
    if(p===current && !force) return;
    current=p;
    stage.querySelector('.midnight-room')?.remove();
    stage.insertBefore(buildSceneSvg(p,lay),stage.firstChild);
    container.dataset.phase=p;                    // handy for styling/debugging
    if(opts.onPhase) opts.onPhase(p);             // let the page react too
  }
  const roam=l=>[(68/l.cols)*100,((l.cols-68)/l.cols)*100];   // clear of the plants

  lay=measure();
  paintRoom();

  const cat=buildCatSvg();
  stage.appendChild(cat);
  placeCat(cat);
  const brain=initMidnightBrain(cat,Object.assign({
    getPhase:()=>current,
    min:lay?roam(lay)[0]:22, max:lay?roam(lay)[1]:78
  },opts));

  if(full){
    // The room IS the page, so it must be redrawn whenever the page changes
    // size. A ResizeObserver on the stage beats a window 'resize' listener:
    // it also catches rotations, chrome sliding in and out on mobile, and any
    // layout change that never fires a window resize at all.
    let t=0;
    const refit=()=>{
      clearTimeout(t);
      t=setTimeout(()=>{
        const next=measure();
        if(!next) return;
        if(lay && next.cols===lay.cols && next.rows===lay.rows) return;
        lay=next; paintRoom(true); placeCat(cat);
        brain.setRange(...roam(lay));
      },220);
    };
    if(window.ResizeObserver) new ResizeObserver(refit).observe(stage);
    else addEventListener('resize',refit);
  }

  // the picker is opt-in: it lives in Settings, not on the sign-in screen
  let syncButtons=null;
  if(!pinned && opts.picker){
    const bar=buildPicker(look,id=>{ look=id; saveLook(id); paintRoom(); announceLook(); });
    container.appendChild(bar);
    syncButtons=()=>bar.querySelectorAll('.midnight-look').forEach(b=>
      b.setAttribute('aria-pressed',String(b.dataset.look===look)));
  }
  if(!pinned){
    // follow anyone else's choice, and keep up with the clock on "auto"
    watchers.add(()=>{ look=savedLook(); paintRoom(); if(syncButtons) syncButtons(); });
    setInterval(paintRoom,10*60*1000);
  }
  return Object.assign(brain,{ repaint:paintRoom, phase:()=>current, look:()=>look });
}
