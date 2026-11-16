// ============================================================================
// colorqueue — color engine. Generalized over a flat color list so palettes can
// MIX FREELY across sets/materials. Every color carries a unique `uid`
// (setId:code) so identical codes in different sets never collide.
// Works in CIE Lab / LCh for perceptual hue + value math.
// ============================================================================
window.CQ = (function () {
  // ---------- conversions ----------
  function hexToRgb(hex){ const h=hex.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function rgbToLab([r,g,b]){
    const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    const R=lin(r),G=lin(g),B=lin(b);
    const X=R*0.4124564+G*0.3575761+B*0.1804375, Y=R*0.2126729+G*0.7151522+B*0.0721750, Z=R*0.0193339+G*0.1191920+B*0.9503041;
    const Xn=0.95047,Yn=1.0,Zn=1.08883, f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
    const fx=f(X/Xn),fy=f(Y/Yn),fz=f(Z/Zn);
    return [116*fy-16,500*(fx-fy),200*(fy-fz)];
  }
  function labToLch([L,a,b]){ const C=Math.sqrt(a*a+b*b); let h=Math.atan2(b,a)*180/Math.PI; if(h<0)h+=360; return [L,C,h]; }
  function lchToLab([L,C,h]){ const r=h*Math.PI/180; return [L,Math.cos(r)*C,Math.sin(r)*C]; }
  function labToHex([L,a,b]){
    const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200, inv=t=>{const t3=t*t*t;return t3>0.008856?t3:(t-16/116)/7.787;};
    const Xn=0.95047,Yn=1.0,Zn=1.08883, X=inv(fx)*Xn,Y=inv(fy)*Yn,Z=inv(fz)*Zn;
    let R=X*3.2404542+Y*-1.5371385+Z*-0.4985314, G=X*-0.9692660+Y*1.8760108+Z*0.0415560, B=X*0.0556434+Y*-0.2040259+Z*1.0572252;
    const gam=v=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;return Math.max(0,Math.min(1,v));};
    const to=v=>Math.round(gam(v)*255).toString(16).padStart(2,"0");
    return "#"+to(R)+to(G)+to(B);
  }
  function dist(a,b){ return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2); }
  function prep(colors){ return colors.map(c=>{ if(c._lab) return c; const lab=rgbToLab(hexToRgb(c.hex)); return {...c,_lab:lab,_lch:labToLch(lab)}; }); }
  function relLuma(hex){ const [r,g,b]=hexToRgb(hex).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*r+0.7152*g+0.0722*b; }
  function textOn(hex){ return relLuma(hex)>0.42 ? "#1a1320" : "#ffffff"; }

  // ---------- families ----------
  // Family order follows the spectrum (warm → cool), then earth tones, then neutrals.
  const FAMILY_ORDER=["red","orange","yellow","lime","green","teal","blue","purple","pink","brown","neutral"];
  const FAMILY_LABEL={red:"Reds",orange:"Oranges",yellow:"Yellows",lime:"Yellow-greens",green:"Greens",teal:"Teals & aquas",blue:"Blues",purple:"Purples",pink:"Pinks & magentas",brown:"Browns & earth",neutral:"Neutrals & greys"};
  // Classification works in CIELAB hue (NOT the HSL wheel) — in Lab, true yellow
  // sits near h≈90 and orange near h≈60, which is why the old HSL-style cutoffs
  // mislabeled yellows as yellow-green. Boundaries below are tuned to the actual
  // swatch values measured across the whole collection.
  function familyOf(c){
    const [L,C,h]=c._lch;
    if(C<11) return "neutral";                                    // greys, whites, blacks
    if(h>=25 && h<100 && L<70 && C<52) return "brown";            // muted/dark warm = earth
    if(h>=320 && h<350) return "pink";                            // magenta / berry arc
    if(h>=350 || h<35) return (L>=64 && C<58) ? "pink" : "red";   // pale red tints read pink
    if(h<48) return "red";
    if(h<78) return "orange";
    if(h<108) return "yellow";
    if(h<130) return "lime";
    if(h<165) return "green";
    if(h<200) return "teal";
    if(h<293) return "blue";
    return "purple";
  }
  function families(colors){
    const list=prep(colors), groups={};
    list.forEach(c=>{const f=familyOf(c);(groups[f]=groups[f]||[]).push(c);});
    return FAMILY_ORDER.filter(f=>groups[f]).map(f=>({key:f,label:FAMILY_LABEL[f],colors:groups[f].sort((a,b)=>b._lch[0]-a._lch[0])}));
  }
  function find(colors,uid){ return prep(colors).find(c=>c.uid===uid)||null; }

  // ---------- BRIDGE ----------
  function bridge(colors,uidA,uidB,opts={}){
    const {mode="direct",maxTotal=9}=opts;
    const list=prep(colors);
    const A=list.find(c=>c.uid===uidA), B=list.find(c=>c.uid===uidB);
    if(!A||!B) return null;
    let path;
    if(mode==="around"){
      const [LA,CA,hA]=A._lch,[LB,CB,hB]=B._lch;
      let dShort=((hB-hA+540)%360)-180, dLong=dShort>=0?dShort-360:dShort+360;
      path=u=>lchToLab([LA+(LB-LA)*u,CA+(CB-CA)*u,hA+dLong*u]);
    } else {
      path=u=>[A._lab[0]+(B._lab[0]-A._lab[0])*u,A._lab[1]+(B._lab[1]-A._lab[1])*u,A._lab[2]+(B._lab[2]-A._lab[2])*u];
    }
    const SAMPLES=160, samplePts=[];
    for(let i=0;i<=SAMPLES;i++) samplePts.push(path(i/SAMPLES));
    const span=dist(A._lab,B._lab), ON_RAMP=Math.max(16,span*0.19), NEARBY=ON_RAMP*2.1;
    const scored=[];
    for(const c of list){
      if(c.uid===uidA||c.uid===uidB) continue;
      let bestD=Infinity,bestU=0;
      for(let i=0;i<samplePts.length;i++){const d=dist(c._lab,samplePts[i]);if(d<bestD){bestD=d;bestU=i/SAMPLES;}}
      if(bestU<=0.02||bestU>=0.98) continue;
      scored.push({...c,u:bestU,off:bestD});
    }
    scored.sort((a,b)=>a.u-b.u);
    const onLine=scored.filter(c=>c.off<=ON_RAMP);

    // ---- choose an evenly-spaced, well-separated subset (up to maxTotal incl. endpoints) ----
    // Even spacing along the path = even perceptual steps = a harmonious ramp.
    // We aim for target positions, pick the truest color near each, and reject
    // near-duplicates so every step reads as a distinct, balanced interval.
    const MAX_TOTAL=Math.max(3,Math.min(9,maxTotal));
    const internalN=Math.max(1,Math.min(MAX_TOTAL-2,Math.round(span/26)));
    const minStep=(span/(internalN+1))*0.5;   // min Lab distance between consecutive picks
    const picks=[]; const used=new Set();
    let prevLab=A._lab;
    for(let i=1;i<=internalN;i++){
      const tu=i/(internalN+1);
      let best=null,bestCost=Infinity;
      for(const c of onLine){
        if(used.has(c.uid)) continue;
        if(c.u<0.1||c.u>0.9) continue;                                  // keep clear of endpoints
        if(picks.length && c.u<=picks[picks.length-1].u) continue;     // keep order
        if(dist(c._lab,prevLab)<minStep*0.7) continue;                  // not too close to last pick
        if(dist(c._lab,B._lab)<minStep*0.7) continue;                   // not too close to the end
        const cost=Math.abs(c.u-tu)*120 + c.off*1.3;                    // near target + true to line
        if(cost<bestCost){bestCost=cost;best=c;}
      }
      if(best){picks.push(best);used.add(best.uid);prevLab=best._lab;}
    }
    const ramp=picks;
    const nearby=scored.filter(c=>!used.has(c.uid)&&c.off<=NEARBY).slice(0,6);
    const seq=[{...A,u:0,off:0},...ramp,{...B,u:1,off:0}];
    const GAP=Math.max(22,span*0.30), gaps=[];
    for(let i=0;i<seq.length-1;i++){const d=dist(seq[i]._lab,seq[i+1]._lab);if(d>GAP)gaps.push({afterIndex:i,from:seq[i],to:seq[i+1],size:Math.round(d)});}
    return { mode,a:A,b:B,ramp,nearby,seq,gaps,span:Math.round(span), gradient:Array.from({length:9},(_,i)=>labToHex(path(i/8))) };
  }

  // ---------- BUILDER ----------
  const ROLE_SCALE=["highlight","light","mid-light","base","mid-tone","mid-dark","shadow","dark","darkest"];
  // graded, monotonic role names for any palette size 1..9 (always anchored
  // on a highlight at the top and the darkest at the bottom).
  function rolesFor(n){
    if(n<=1) return ["base"];
    if(n>=ROLE_SCALE.length) return ROLE_SCALE.slice(0,ROLE_SCALE.length);
    const out=[];
    for(let i=0;i<n;i++) out.push(ROLE_SCALE[Math.round(i/(n-1)*(ROLE_SCALE.length-1))]);
    return out;
  }
  const MOODS={
    golden:{label:"Golden hour",dL:+3,mC:1.05,dH:+10,key:+2},
    pastel:{label:"Pastel",dL:+16,mC:0.45,dH:0,key:+10},
    blue:{label:"Blue hour",dL:-6,mC:0.85,dH:-18,key:-6},
    moody:{label:"Moody",dL:-13,mC:0.8,dH:-6,key:-12},
    vibrant:{label:"Vibrant",dL:+1,mC:1.45,dH:0,key:0},
    fresh:{label:"Fresh",dL:+9,mC:1.0,dH:-12,key:+6},
    earthy:{label:"Earthy",dL:-2,mC:0.6,dH:+12,key:-2},
    vintage:{label:"Vintage",dL:+4,mC:0.5,dH:+16,key:+2},
    balanced:{label:"Balanced",dL:0,mC:1,dH:0,key:0},   // v2: neutral recipe for "palettes around this color" (not in MOOD_ORDER)
  };
  const MOOD_ORDER=["golden","pastel","blue","moody","vibrant","fresh","earthy","vintage"];
  // hue offsets distributed across ANY number of slots per harmony.
  function huesFor(harmony,base,n){
    const B=((base%360)+360)%360;
    if(harmony==="monochrome") return Array.from({length:n},(_,i)=>((B+(i%2?5:-5))%360+360)%360);
    if(harmony==="analogous") return Array.from({length:n},(_,i)=>{const t=n<=1?0.5:i/(n-1);return ((B-32+64*t)%360+360)%360;});
    const groups={complementary:[0,180],splitComplement:[0,150,210],triadic:[0,120,240]}[harmony]||[0];
    return Array.from({length:n},(_,i)=>{
      const g=groups[i%groups.length], tier=Math.floor(i/groups.length);
      const jit=tier===0?0:(tier%2?14:-14);
      return ((B+g+jit)%360+360)%360;
    });
  }
  // build({ anchors?, locked?, mood, harmony, structure, reseed, count })
  //  - count:   palette size (4..9). slots + locked array scale to this.
  //  - anchors: flat list of uids to seed (assigned to nearest fitting slot) — used on first generate
  //  - locked:  array of `count` (uid|null) pinned BY SLOT INDEX — used for reroll/swap so the user's
  //             locked slots stay put and only the empty ones get fresh picks.
  function build(colors,opts={}){
    const {anchors=[],locked=null,baseHue=null,mood="golden",harmony="analogous",structure="value",reseed=0}=opts;
    const n=Math.max(3,Math.min(9,opts.count||6));
    const list=prep(colors);
    const lockArr=(locked&&locked.length===n)?locked.slice():new Array(n).fill(null);
    const M=MOODS[mood]||MOODS.golden;
    const roles=rolesFor(n);
    // base hue: when an explicit baseHue is passed (frozen at generate time) we use it verbatim so
    // that locking/swapping/rerolling never re-derives the recipe. only when no baseHue is frozen
    // yet (first generate, or migrating an older session) do we derive it — and the caller freezes
    // the returned baseHue immediately, so it can never be recomputed by a later lock toggle.
    const fixedUids=[...lockArr.filter(Boolean),...anchors];
    const fixedColors=fixedUids.map(u=>list.find(c=>c.uid===u)).filter(Boolean);
    const base=(baseHue!=null)
      ? ((baseHue%360)+360)%360
      : (fixedColors.length
          ? fixedColors.slice().sort((a,b)=>b._lch[1]-a._lch[1])[0]._lch[2]
          : (reseed*47)%360);
    const hues=huesFor(harmony,(base+reseed*17)%360,n);
    const LHI=90, LLO=(opts.lo!=null?opts.lo:18);   // v2: lo lets soft/pastel recipes stop short of near-black
    const targets=Array.from({length:n},(_,i)=>{
      const t=n<=1?0.35:i/(n-1);
      const Lv=LHI+(LLO-LHI)*t;
      const L=Math.max(8,Math.min(96,Lv+M.dL+M.key*(1-2*t)));
      const ends=(i===0||i===n-1);
      const baseC=structure==="hue"?42:(28+(ends?8:24));
      const C=Math.max(4,baseC*M.mC);
      const h=(hues[i]+M.dH+360)%360;
      return {lab:lchToLab([L,C,h]),role:roles[i],L};
    });
    const slots=targets.map(t=>({...t,marker:null,locked:false}));
    const used=new Set();
    // 1) pin explicit locked slots by index
    lockArr.forEach((u,i)=>{ if(!u)return; const c=list.find(x=>x.uid===u); if(c){slots[i].marker=c;slots[i].locked=true;used.add(u);} });
    // 2) seed flat anchors into their nearest still-empty slot
    anchors.map(u=>list.find(c=>c.uid===u)).filter(Boolean).forEach(ac=>{
      if(used.has(ac.uid))return;
      let bi=-1,bd=Infinity;
      slots.forEach((s,i)=>{if(s.marker)return;const d=dist(ac._lab,s.lab);if(d<bd){bd=d;bi=i;}});
      if(bi>=0){slots[bi].marker=ac;slots[bi].locked=true;used.add(ac.uid);}
    });
    // 3) fill the rest with the nearest unused color to each slot target
    slots.forEach(s=>{
      if(s.marker)return;
      let best=null,bd=Infinity;
      for(const c of list){if(used.has(c.uid))continue;const d=dist(c._lab,s.lab);if(d<bd){bd=d;best=c;}}
      if(best){s.marker=best;used.add(best.uid);}
    });
    return { kind:"built",mood,moodLabel:M.label,harmony,structure,baseHue:base,count:n,
      lockedArr:slots.map(s=>s.locked&&s.marker?s.marker.uid:null),
      colors:slots.map(s=>({marker:s.marker,role:s.role,locked:s.locked,targetLab:s.lab,targetHex:labToHex(s.lab)})) };
  }

  // ---------- GRADIENT ----------
  // Even N-step ramp between two colours, each stop snapped to the nearest owned
  // marker (endpoints stay exact). Prefers not to reuse a marker twice.
  function gradient(colors,uidA,uidB,opts={}){
    const {mode="around",steps=6}=opts;
    const list=prep(colors);
    const A=list.find(c=>c.uid===uidA),B=list.find(c=>c.uid===uidB);
    if(!A||!B) return null;
    let path;
    if(mode==="around"){
      const [LA,CA,hA]=A._lch,[LB,CB,hB]=B._lch;
      let dShort=((hB-hA+540)%360)-180, dLong=dShort>=0?dShort-360:dShort+360;
      path=u=>lchToLab([LA+(LB-LA)*u,CA+(CB-CA)*u,hA+dLong*u]);
    } else {
      path=u=>[A._lab[0]+(B._lab[0]-A._lab[0])*u,A._lab[1]+(B._lab[1]-A._lab[1])*u,A._lab[2]+(B._lab[2]-A._lab[2])*u];
    }
    const n=Math.max(2,Math.min(9,steps)), used=new Set(), stops=[];
    for(let i=0;i<n;i++){
      const u=n<=1?0:i/(n-1), idealLab=path(u), idealHex=labToHex(idealLab);
      let marker;
      if(i===0) marker=A; else if(i===n-1) marker=B;
      else{
        let best=null,bd=Infinity,any=null,ad=Infinity;
        for(const c of list){ const d=dist(c._lab,idealLab); if(d<ad){ad=d;any=c;} if(!used.has(c.uid)&&d<bd){bd=d;best=c;} }
        marker=best||any;
      }
      if(marker) used.add(marker.uid);
      stops.push({u,idealHex,marker,off:marker?Math.round(dist(marker._lab,idealLab)):0});
    }
    return {mode,steps:n,a:A,b:B,stops,
      gradient:Array.from({length:11},(_,i)=>labToHex(path(i/10)))};
  }

  // rank owned colors by closeness to a slot's target (for swapping a single slot)
  function slotCandidates(colors,targetLab,excludeUids=[],n=30){
    const ex=new Set(excludeUids);
    return prep(colors).filter(c=>!ex.has(c.uid))
      .map(c=>({c,d:dist(c._lab,targetLab)})).sort((a,b)=>a.d-b.d).slice(0,n).map(x=>x.c);
  }

  return { prep,families,familyOf,find,bridge,build,gradient,slotCandidates,labToHex,textOn, MOODS,MOOD_ORDER,ROLE_SCALE,FAMILY_ORDER,FAMILY_LABEL };
})();
