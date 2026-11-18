// ============================================================================
// swatchbook v2 — palette engine + the shared "shuffle & tune" panel.
//
// Every palette in the app (starter vibes, palettes around a marker, new page
// versions, the Palettes tab generator) comes from here, so they all follow the
// same rules:
//   1. Each vibe is a color *story*, not just a hue nudge. Golden hour is honey,
//      apricot and coral light with cool mauve shadows; Earthy is terracotta,
//      ochre, olive, sage, sand and brown; and so on. Each part has its own hue,
//      lightness and softness range (CIELAB LCh).
//   2. A shuffle draws ~40 candidate palettes inside those ranges, snaps each to
//      markers you own (CIEDE2000, never the same ink twice, never "out"), and
//      keeps the one that scores best on the Ou & Luo (2006) colour-harmony model
//      while staying true to the vibe and not repeating the last shuffle.
//   3. Locks, color scheme, warmer/cooler, lighter/deeper, softer/bolder and
//      count all feed the same generator, so a shuffle never leaves the vibe.
// Wrapped in an IIFE: babel scripts share one global scope.
// ============================================================================
(function(){
  const { useState, useEffect, useMemo, useRef } = React;
  const SB = window.SB;
  const { GROUPS, groupOf, usable, pickUid, Icon, Sheet } = SB;

  // ---------- color math ----------
  const D2R=Math.PI/180;
  const wrap=h=>((h%360)+360)%360;
  const hueDiff=(a,b)=>{ const d=Math.abs(wrap(a-b)); return d>180?360-d:d; };
  const sdiff=(a,b)=>((a-b+540)%360)-180;                 // signed a−b in (−180,180]
  const lchToLab=([L,C,h])=>[L,Math.cos(h*D2R)*C,Math.sin(h*D2R)*C];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function de00(p,q){
    const [L1,a1,b1]=p,[L2,a2,b2]=q;
    const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,Cb7=Cb**7;
    const G=0.5*(1-Math.sqrt(Cb7/(Cb7+6103515625)));
    const a1p=a1*(1+G),a2p=a2*(1+G),C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
    const ang=(b,a)=>(a===0&&b===0)?0:wrap(Math.atan2(b,a)/D2R);
    const h1=ang(b1,a1p),h2=ang(b2,a2p);
    const dL=L2-L1,dC=C2p-C1p;
    let dh=0; if(C1p*C2p!==0){ dh=h2-h1; if(dh>180)dh-=360; else if(dh<-180)dh+=360; }
    const dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh*D2R/2);
    const Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;
    let hb=h1+h2; if(C1p*C2p!==0){ if(Math.abs(h1-h2)>180) hb+=(h1+h2<360)?360:-360; hb/=2; }
    const T=1-0.17*Math.cos((hb-30)*D2R)+0.24*Math.cos(2*hb*D2R)+0.32*Math.cos((3*hb+6)*D2R)-0.2*Math.cos((4*hb-63)*D2R);
    const dTh=30*Math.exp(-(((hb-275)/25)**2)), Cbp7=Cbp**7;
    const RC=2*Math.sqrt(Cbp7/(Cbp7+6103515625));
    const SL=1+0.015*(Lb-50)**2/Math.sqrt(20+(Lb-50)**2), SC=1+0.045*Cbp, SH=1+0.015*Cbp*T;
    const RT=-Math.sin(2*dTh*D2R)*RC;
    return Math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH));
  }

  // Ou & Luo (2006), "A colour harmony model for two-colour combinations", Color Res. Appl. 31(3).
  // CH = H_C + H_L + H_H; above 0 tends to read as harmonious. Rewards shared hue/chroma,
  // lighter pairs, and a clear (not tiny) lightness step.
  function ouLuo(p,q){
    const lc=l=>{ const C=Math.hypot(l[1],l[2]); return [l[0],C,wrap(Math.atan2(l[2],l[1])/D2R)]; };
    const [L1,C1,h1]=lc(p),[L2,C2,h2]=lc(q);
    const dE2=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2, dCab=C1-C2, dLab=p[0]-q[0];
    const dH2=Math.max(0,dE2-dLab*dLab-dCab*dCab);
    const dC=Math.sqrt(dH2+(dCab/1.46)**2);
    const HC=0.04+0.53*Math.tanh(0.8-0.045*dC);
    const HL=0.3+0.5*Math.tanh(-4+0.029*(L1+L2)) + 0.14+0.15*Math.tanh(-2+0.2*Math.abs(L1-L2));
    const sy=(L,C,h)=>{ const EC=0.5+0.5*Math.tanh(-2+0.5*C), HS=-0.08-0.14*Math.sin((h+50)*D2R)-0.07*Math.sin((2*h+90)*D2R);
      const t=(90-h)/10, EY=((0.22*L-12.8)/10)*Math.exp(t-Math.exp(t)); return EC*(HS+EY); };
    return HC+HL+sy(L1,C1,h1)+sy(L2,C2,h2);
  }
  function harmonyOf(gs){
    let s=0,n=0; for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){ s+=ouLuo(gs[i]._lab,gs[j]._lab); n++; }
    return n?s/n:0;
  }

  // small seeded RNG so a shuffle is repeatable (and "back" can return to it)
  function rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
  const span=(r,[a,b])=>a+(b-a)*r();
  const pickOf=(r,arr)=>arr[Math.floor(r()*arr.length)%arr.length];
  const newSeed=()=>Math.floor(Math.random()*2147483646)+1;

  // ---------- vibes ----------
  // CIELAB hue angles: pink/red ≈ 0–40 · orange 50–75 · yellow 80–105 · yellow-green 110–128 ·
  // green 130–165 · teal 165–200 · sky/blue 215–292 · violet 294–320 · magenta 320–350.
  // Parts are listed most-important first; a 5-color palette uses the first five.
  // {h:[lo,hi]} = fixed hue range · {s:i} = the i-th hue of the chosen color scheme (+ jitter j).
  const SCHEME_OFFS={
    analogous:[0,28,-28,52,-52,14,-14,40,-40],
    complementary:[0,180,18,198,-18,162,8,188,-8],
    split:[0,150,210,18,165,195,-18,140,220],
    triadic:[0,120,240,16,136,256,-16,104,224],
    mono:[0,6,-6,10,-10,3,-3,8,-8],
  };
  const SCHEME_LABEL={auto:"Auto",analogous:"Analogous",complementary:"Complementary",split:"Split-comp",triadic:"Triadic",mono:"One hue"};
  const VIBES={
    pastel:{label:"Pastel",noMud:true,blurb:"Airy, soft, light",base:[[0,360]],schemes:["analogous","triadic","split","complementary"],parts:[
      {s:0,j:10,L:[78,90],C:[14,28]}, {s:1,j:12,L:[80,92],C:[12,26]}, {s:2,j:12,L:[78,90],C:[12,26]},
      {s:3,j:12,L:[82,93],C:[10,22]}, {s:0,j:14,L:[70,80],C:[16,28]}, {h:[60,100],L:[88,96],C:[4,14]},
      {s:4,j:12,L:[74,86],C:[12,24]}, {s:5,j:12,L:[80,92],C:[10,22]}, {s:6,j:12,L:[70,82],C:[14,26]}]},
    golden:{label:"Golden hour",blurb:"Honey light, cool mauve shadows",parts:[
      {h:[74,92],L:[72,86],C:[34,56]}, {h:[50,68],L:[72,84],C:[26,46]}, {h:[18,42],L:[60,74],C:[28,46]},
      {h:[300,336],L:[54,68],C:[14,28]}, {h:[86,102],L:[87,95],C:[16,34]}, {h:[55,75],L:[48,60],C:[32,54]},
      {h:[288,320],L:[36,48],C:[14,28]}, {h:[30,50],L:[78,88],C:[16,30]}, {h:[0,20],L:[56,68],C:[22,38]}]},
    blue:{label:"Blue hour",blurb:"Twilight blues, one warm lamp glow",parts:[
      {h:[255,285],L:[44,58],C:[24,40]}, {h:[282,302],L:[62,74],C:[18,32]}, {h:[286,306],L:[24,36],C:[20,36]},
      {h:[66,92],L:[76,88],C:[28,50]}, {h:[305,332],L:[50,62],C:[16,30]}, {h:[228,255],L:[66,78],C:[14,26]},
      {h:[195,230],L:[36,50],C:[14,28]}, {h:[340,360],L:[66,76],C:[14,24]}, {h:[240,270],L:[80,88],C:[8,18]}]},
    moody:{label:"Moody",blurb:"Deep, muted, low light",base:[[5,25],[318,340],[140,160],[195,215],[262,282]],schemes:["analogous","complementary"],parts:[
      {s:0,j:8,L:[28,40],C:[16,32]}, {s:2,j:10,L:[38,50],C:[12,26]}, {s:1,j:10,L:[42,56],C:[14,28]},
      {s:0,j:16,L:[62,72],C:[6,16]}, {s:3,j:10,L:[22,34],C:[12,26]}, {s:0,j:30,L:[16,26],C:[2,10]},
      {s:4,j:12,L:[50,60],C:[8,20]}, {s:5,j:10,L:[30,42],C:[12,24]}, {s:6,j:10,L:[56,66],C:[8,18]}]},
    vibrant:{label:"Vibrant",noMud:true,blurb:"Saturated and punchy",hw:1.4,base:[[0,360]],schemes:["triadic","split","complementary","analogous"],parts:[
      {s:0,j:10,L:"cusp",C:[48,80]}, {s:1,j:10,L:"cusp",C:[44,78]}, {s:2,j:10,L:"cusp",C:[44,78]},
      {s:3,j:12,L:"cusp",dL:8,C:[36,70]}, {s:4,j:12,L:"cusp",dL:-12,C:[36,62]}, {s:5,j:12,L:"cusp",C:[44,74]},
      {s:6,j:12,L:"cusp",dL:-8,C:[40,66]}, {s:7,j:12,L:"cusp",C:[40,70]}, {s:8,j:12,L:"cusp",dL:6,C:[40,70]}]},
    fresh:{label:"Fresh",noMud:true,blurb:"Spring greens, aqua, citrus, a coral pop",parts:[
      {h:[118,150],L:[60,76],C:[28,48]}, {h:[150,190],L:[78,90],C:[16,32]}, {h:[205,240],L:[68,82],C:[18,34]},
      {h:[92,112],L:[84,94],C:[32,60]}, {h:[12,42],L:[66,78],C:[28,46]}, {h:[124,152],L:[44,56],C:[26,42]},
      {h:[292,318],L:[70,82],C:[14,26]}, {h:[170,200],L:[56,68],C:[18,30]}, {h:[60,80],L:[82,92],C:[18,32]}]},
    earthy:{label:"Earthy",blurb:"Terracotta, ochre, olive, sage, sand",parts:[
      {h:[36,52],L:[46,60],C:[26,40]}, {h:[70,88],L:[58,72],C:[30,48]}, {h:[94,118],L:[44,58],C:[16,32]},
      {h:[115,148],L:[64,76],C:[10,22]}, {h:[68,92],L:[80,90],C:[10,22]}, {h:[38,66],L:[26,38],C:[12,26]},
      {h:[18,40],L:[60,72],C:[14,26]}, {h:[54,72],L:[66,76],C:[18,32]}, {h:[180,215],L:[46,58],C:[8,18]}]},
    vintage:{label:"Vintage",blurb:"Faded teal, mustard, dusty rose, cream",parts:[
      {h:[188,218],L:[50,64],C:[12,26]}, {h:[76,92],L:[68,80],C:[28,46]}, {h:[8,32],L:[66,78],C:[14,28]},
      {h:[74,96],L:[86,94],C:[8,18]}, {h:[26,42],L:[42,54],C:[26,40]}, {h:[48,70],L:[36,48],C:[14,26]},
      {h:[238,266],L:[58,70],C:[12,22]}, {h:[120,150],L:[60,70],C:[10,20]}, {h:[330,355],L:[56,66],C:[12,24]}]},
  };
  const VIBE_ORDER=["pastel","golden","blue","moody","vibrant","fresh","earthy","vintage"];
  const RELATIVE=v=>!!(v&&v.schemes);       // vibes whose hues come from a color scheme

  // palettes around one marker: its own hue drives the scheme; "feel" sets the softness band,
  // centered on the marker's own softness so the set reads as one family.
  function aroundRecipe(g,feel){
    const [La,Ca]=g._lch;
    const band = feel==="pastel" ? {L:[74,92],C:[10,Math.max(18,Math.min(28,Ca))]}
      : feel==="vibrant" ? {L:[44,78],C:[Math.max(40,Ca-6),82]}
      : {L:[Math.max(30,Math.min(La-20,45)),Math.max(82,Math.min(92,La+20))],C:[Math.max(14,Ca-10),Math.max(32,Ca+12)]};
    const fr=[0.5,0.15,0.85,0.35,0.7,0.0,1.0,0.25,0.6];       // spread lightness across the band
    // soft: lightness straight from the band. balanced/bold: halfway toward where each hue is
    // naturally most colorful, so a red's neighbors become coral and rose, not brown.
    const parts=fr.map((f,i)=>{ const Lc=band.L[0]+(band.L[1]-band.L[0])*f;
      return {s:i,j:i?8:0,L:[Lc-5,Lc+5],C:band.C,mix:feel!=="pastel"}; });
    return {label:"Around",keepOrder:true,base:[[0,360]],schemes:["analogous","complementary","split","triadic","mono"],parts,band};
  }

  // ---------- generator ----------
  const ALLG = GROUPS;
  // the lightness where YOUR markers are most saturated, per hue (yellow is brightest when light,
  // red and violet when mid-dark) — vibrant targets sit there so they don't snap to olive or brown
  const CUSP=(()=>{ const out=[]; for(let b=0;b<36;b++){ const c=b*10; let best=null;
      for(const g of ALLG){ if(g._lch[1]<20) continue; if(hueDiff(g._lch[2],c)>15) continue; if(!best||g._lch[1]>best._lch[1]) best=g; }
      out.push(best?best._lch[0]:60); }
    return out.map((v,i)=>(out[(i+35)%36]+2*v+out[(i+1)%36])/4); })();
  const cuspL=h=>{ const x=wrap(h)/10, i=Math.floor(x)%36, f=x-Math.floor(x); return CUSP[i]*(1-f)+CUSP[(i+1)%36]*f; };
  function applyNudge(t,nudge){
    const n=nudge||{};
    let {L,C,h,band}=t;
    if(n.warm && C>8){ const k=n.warm; const goal=k>0?55:250; const d=sdiff(goal,h); h=wrap(h+Math.sign(d)*Math.min(Math.abs(d),12*Math.abs(k))); }
    if(n.light){ L=clamp(L+5*n.light,10,97); band={...band,L:[band.L[0]+5*n.light,band.L[1]+5*n.light]}; }
    if(n.soft){ const f=n.soft>0?Math.pow(0.78,n.soft):Math.pow(1.25,-n.soft); C=clamp(C*f,2,95); band={...band,C:[band.C[0]*f,band.C[1]*f]}; }
    return {...t,L,C,h,band};
  }
  function makeTargets(recipe,r,{n,scheme,baseHue,nudge}){
    const sch = RELATIVE(recipe) ? (scheme&&SCHEME_OFFS[scheme] ? scheme : recipe.schemes[0]) : null;
    const base = baseHue!=null ? baseHue : (recipe.base ? span(r,pickOf(r,recipe.base)) : 0);
    const offs = sch?SCHEME_OFFS[sch]:null;
    // fixed-story vibes: always the first three parts (the vibe's core), then a random mix of the
    // rest, so shuffles tell the same story with different supporting colors
    let order=recipe.parts.map((_,i)=>i);
    if(!RELATIVE(recipe) && !recipe.keepOrder){ const rest=order.slice(3); for(let i=rest.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [rest[i],rest[j]]=[rest[j],rest[i]]; } order=[...order.slice(0,3),...rest]; }
    const out=[];
    for(let i=0;i<n;i++){
      const p=recipe.parts[order[i%order.length]], extra=i>=recipe.parts.length;
      let h = p.h ? span(r,p.h) : wrap(base+offs[p.s%offs.length]+(r()*2-1)*(p.j||0));
      if(extra) h=wrap(h+(r()*2-1)*14);
      const Lb = p.L==="cusp" ? (()=>{ const c=cuspL(h)+(p.dL||0); return [c-8,c+5]; })()
        : p.mix ? (()=>{ const c=((p.L[0]+p.L[1])/2+cuspL(h))/2; return [c-7,c+7]; })() : p.L;
      const t={L:span(r,Lb),C:span(r,p.C),h,band:{L:Lb,C:p.C}};
      out.push(applyNudge(t,nudge));
    }
    return {targets:out,scheme:sch,base};
  }
  const outside=(v,[a,b])=>v<a?a-v:v>b?v-b:0;
  function snapAll(targets,locks,stock,r,exclude){
    const used=new Set(locks.filter(Boolean)), gs=new Array(targets.length).fill(null);
    locks.forEach((k,i)=>{ if(k&&i<gs.length) gs[i]=ALLG.find(g=>g.key===k)||null; });
    for(let i=0;i<targets.length;i++){
      if(gs[i]) continue;
      const tl=lchToLab([targets[i].L,targets[i].C,targets[i].h]);
      let b1=null,d1=Infinity,b2=null,d2=Infinity;
      for(const g of ALLG){
        if(used.has(g.key)||(exclude&&exclude.has(g.key))||!usable(g,stock)) continue;
        const d=de00(tl,g._lab);
        if(d<d1){ b2=b1;d2=d1;b1=g;d1=d; } else if(d<d2){ b2=g;d2=d; }
      }
      const g=(b2&&d2-d1<3&&r()<0.3)?b2:b1;
      if(g){ gs[i]=g; used.add(g.key); }
    }
    return gs;
  }
  function scorePalette(gs,targets,locks,avoid,hw,noMud){
    let fid=0,pen=0,nf=0,minD=Infinity,over=0;
    gs.forEach((g,i)=>{ if(!g||locks[i]) return; const t=targets[i];
      fid+=de00(lchToLab([t.L,t.C,t.h]),g._lab); nf++;
      const [L,C]=g._lch; pen+=outside(L,t.band.L)+0.8*outside(C,t.band.C);
      if(avoid&&avoid.has(g.key)) over++; });
    const real=gs.filter(Boolean);
    for(let i=0;i<real.length;i++)for(let j=i+1;j<real.length;j++) minD=Math.min(minD,de00(real[i]._lab,real[j]._lab));
    const ch=harmonyOf(real);
    // light/clean vibes: no khaki, olive-drab or mud (a dull yellow is what reads as "dirty")
    let mud=0; if(noMud) gs.forEach((g,i)=>{ if(!g||locks[i]) return; const [L,C,h]=g._lch;
      if(g.family==="brown"||(C<16&&L<82&&h>60&&h<130)||(g.family==="neutral"&&L<86)) mud++; });
    return { score: (hw||3)*ch - 1.2*mud - 0.10*(nf?fid/nf:0) - 0.035*pen - 0.6*Math.max(0,8-(isFinite(minD)?minD:99)) - 0.35*over, ch, minD };
  }
  // generate(vibe | recipe, opts) → { keys, uids, scheme, base, ch, seed }
  //  opts: n, seed, locks (array of group keys by slot, null = free), avoid (keys from the last
  //  shuffle), scheme ("auto" or a scheme id), nudge {warm, light, soft}, stock, tries
  function generate(vibe,opts={}){
    const recipe=typeof vibe==="string"?VIBES[vibe]:vibe;
    const n=clamp(opts.n||7,3,9), seed=opts.seed||1, stock=opts.stock||{};
    const locks=(opts.locks||[]).slice(0,n); while(locks.length<n) locks.push(null);
    const avoid=opts.avoid?new Set(opts.avoid):null;
    let baseHue=opts.baseHue!=null?opts.baseHue:null;
    if(baseHue==null && RELATIVE(recipe)){
      const lg=locks.map(k=>k&&ALLG.find(g=>g.key===k)).find(g=>g&&g._lch[1]>=10);
      if(lg) baseHue=lg._lch[2];
    }
    const r=rng(seed), tries=opts.tries||40;
    // one color scheme per shuffle (picked from the seed) so "Auto" rotates through them
    // instead of always landing on the easiest one
    const scheme = RELATIVE(recipe) ? (opts.scheme&&opts.scheme!=="auto"&&SCHEME_OFFS[opts.scheme] ? opts.scheme : pickOf(r,recipe.schemes)) : null;
    let best=null;
    for(let t=0;t<tries;t++){
      const {targets,base}=makeTargets(recipe,r,{n,scheme,baseHue,nudge:opts.nudge});
      const gs=snapAll(targets,locks,stock,r,opts.exclude);
      if(gs.some(g=>!g)) continue;
      const s=scorePalette(gs,targets,locks,avoid,recipe.hw,recipe.noMud);
      if(!best||s.score>best.score) best={...s,gs,scheme,base};
    }
    if(!best) return {keys:[],uids:[],scheme:null,ch:0,seed};
    return { keys:best.gs.map(g=>g.key), uids:best.gs.map(g=>pickUid(g,stock)), scheme:best.scheme, base:best.base, ch:best.ch, minD:best.minD, seed };
  }
  function around(anchorUid,harmony,feel,opts={}){
    const g=groupOf(anchorUid); if(!g) return null;
    const recipe=aroundRecipe(g,feel);
    const res=generate(recipe,{...opts,n:opts.n||6,scheme:harmony,baseHue:g._lch[2],locks:[g.key,...(opts.locks||[]).slice(1)]});
    // the anchor keeps the exact copy the person picked
    res.uids[0]=anchorUid; return res;
  }

  // ---------- recolor a page (new versions) ----------
  // Color schemes keep each color's lightness and softness, and keep the page's colors in the
  // same order around the wheel — they're squeezed into the scheme instead of reassigned at random,
  // so a sky stays different from the grass. Vibes map the page's lights and darks onto a palette
  // of that vibe. Distinct colors stay distinct whenever your markers allow it.
  const VERSION_SCHEMES=[
    {id:"pastel",label:"Pastel",sub:"Same hues, softened"},
    {id:"analogous",label:"Analogous",sub:"Neighbors — calm"},
    {id:"complementary",label:"Complementary",sub:"Two opposite sides"},
    {id:"split",label:"Split-comp",sub:"Contrast, softer"},
    {id:"triadic",label:"Triadic",sub:"Three-way balance"},
    {id:"rotate",label:"Spin the wheel",sub:"Same relationships, new hues"},
  ];
  const VERSION_VIBES=["golden","blue","moody","vibrant","fresh","earthy","vintage"].map(id=>({id:"vibe:"+id,label:VIBES[id].label,sub:VIBES[id].blurb}));
  // what "keep browns & neutrals" holds still: real greys and real browns — not pale creams and
  // peaches, which on a pastel page are part of the color story (before, they never changed)
  const isEarthy=g=>g._lch[1]<8||(g.family==="brown"&&g._lch[0]<72)||(g.family==="neutral"&&g._lch[1]<10&&g._lch[0]<88);
  function schemeHue(kind,key,d,r){
    const s=Math.sign(d)||1, a=Math.abs(d);
    if(kind==="analogous") return wrap(key+s*50*Math.pow(a/180,0.75));
    if(kind==="complementary") return a<=90 ? wrap(key+d*(24/90)) : wrap(key+180+(d-s*180)*(24/90));
    if(kind==="split") return a<60 ? wrap(key+d*(20/60)) : wrap(key+s*(138+24*((a-60)/120)));
    if(kind==="triadic") return a<60 ? wrap(key+d*(20/60)) : wrap(key+s*(110+20*((a-60)/120)));
    return wrap(key+d);
  }
  function recolor(uidsByUse,kind,{keep=true,stock={},seed=1}={}){
    const r=rng(seed);
    const groups=[]; const seen=new Set();
    uidsByUse.forEach(u=>{ const g=groupOf(u); if(g&&!seen.has(g.key)){seen.add(g.key);groups.push(g);} });
    const to={}; groups.forEach(g=>{ to[g.key]=g; });
    const movers=groups.filter(g=>g._lch[1]>=6 && !(keep&&isEarthy(g)));
    const takenBy=new Set(groups.filter(g=>!movers.includes(g)).map(g=>g.key));
    const snapOne=(lab,band)=>{
      let b1=null,d1=Infinity,b2=null,d2=Infinity;
      for(const g of ALLG){ if(!usable(g,stock)) continue;
        let d=de00(lab,g._lab)+(takenBy.has(g.key)?14:0);
        if(band) d+=0.5*(outside(g._lch[0],band.L)+outside(g._lch[1],band.C));
        if(d<d1){b2=b1;d2=d1;b1=g;d1=d;} else if(d<d2){b2=g;d2=d;} }
      const g=(seed>1&&b2&&d2-d1<4&&r()<0.35)?b2:b1; if(g) takenBy.add(g.key); return g;
    };
    if(kind.startsWith("vibe:")){
      const vid=kind.slice(5), n=clamp(movers.length,3,9);
      const pal=generate(vid,{n,seed,stock,tries:30}).keys.map(k=>ALLG.find(g=>g.key===k)).filter(Boolean);
      const src=movers.slice().sort((a,b)=>b._lch[0]-a._lch[0]), dst=pal.slice().sort((a,b)=>b._lch[0]-a._lch[0]);
      src.forEach((g,i)=>{ const t=dst[Math.round(i*(dst.length-1)/Math.max(1,src.length-1))]; if(t) to[g.key]=t; });
    } else if(kind==="pastel"){
      movers.forEach(g=>{ const [L,C,h]=g._lch; const t=snapOne(lchToLab([Math.max(L,82+r()*6),clamp(C*0.6,9,24),wrap(h+(seed>1?(r()*2-1)*10:0))]),{L:[76,95],C:[6,30]}); if(t) to[g.key]=t; });
    } else {
      const top=movers.slice(0,Math.min(3,movers.length));
      const keyG=seed>1&&top.length?top[Math.floor(r()*top.length)]:top[0];
      if(keyG){
        let key=keyG._lch[2];
        if(kind==="rotate") key=wrap(key+(seed>1?60+r()*240:150));
        else if(seed>1) key=wrap(key+(r()*2-1)*12);
        // a page that's mostly one hue family has nothing to squeeze — spread its colors across
        // the scheme by how much each is used instead (key, opposite, key, opposite…)
        const spread=Math.max(0,...movers.map(g=>Math.abs(sdiff(g._lch[2],keyG._lch[2]))));
        const RANK={complementary:[0,180,-16,196,16,164],split:[0,150,210,-14,164,196],triadic:[0,120,240,-16,136,256],analogous:[0,32,-32,16,-16,48,-48]};
        let ri=0;
        movers.forEach(g=>{
          const [L,C,h]=g._lch;
          const d=sdiff(h,keyG._lch[2]);
          const byRank = kind!=="rotate" && kind!=="analogous" && spread<75 && RANK[kind];
          const nh = kind==="rotate" ? wrap(key+d) : byRank ? wrap(key+RANK[kind][(g===keyG?0:(++ri))%RANK[kind].length]) : schemeHue(kind,key,d,r);
          const t=(g===keyG && kind!=="rotate" && seed<=1) ? g : snapOne(lchToLab([L,C,nh]),null);
          if(t){ to[g.key]=t; takenBy.add(t.key); }
        });
      }
    }
    const map={};
    uidsByUse.forEach(u=>{ const g=groupOf(u); if(!g) return; const t=to[g.key]; map[u]=(!t||t.key===g.key)?u:pickUid(t,stock); });
    return map;
  }
  function versionLabel(kind){
    const s=VERSION_SCHEMES.find(x=>x.id===kind)||VERSION_VIBES.find(x=>x.id===kind);
    return s?s.label:"Version";
  }

  SB.PAL={ de00, ouLuo, harmonyOf, rng, newSeed, VIBES, VIBE_ORDER, SCHEME_LABEL, generate, around, recolor,
    VERSION_SCHEMES, VERSION_VIBES, versionLabel, RELATIVE };

  // ======================= UI: shuffle & tune =======================
  const P=SB.PAL;
  const hexOfKey=k=>{ const g=ALLG.find(x=>x.key===k); return g?g.hex:"#ccc"; };
  const gOfKey=k=>ALLG.find(x=>x.key===k)||null;
  const NUDGES=[["warm",1,"Warmer"],["warm",-1,"Cooler"],["light",1,"Lighter"],["light",-1,"Deeper"],["soft",1,"Softer"],["soft",-1,"Bolder"]];
  const FEELS=[["pastel","Soft"],["balanced","Balanced"],["vibrant","Bold"]];
  const AROUND_SCHEMES=["analogous","complementary","split","triadic","mono"];

  // One panel for every "make me a palette" spot. mode "vibe": pick any vibe; mode "around": the
  // anchor marker always stays in. Tap a color to lock it; Shuffle redraws the rest; the adjust
  // pills shift the same palette (warmer, lighter, softer…) without starting over.
  function PaletteTuner({stock,mode="vibe",start,onUse,useLabel="Use these",secondary,onBack}){
    const anchor=mode==="around"?start.anchor:null, ag=anchor?groupOf(anchor):null;
    const [vibe,setVibe]=useState(start.vibe||"pastel");
    const [feel,setFeel]=useState(start.feel||"balanced");
    const [scheme,setScheme]=useState(start.scheme||"auto");
    const [nudge,setNudge]=useState({warm:0,light:0,soft:0});
    const [n,setN]=useState(start.n||(mode==="around"?6:7));
    const [cur,setCur]=useState(()=>start.keys?{keys:start.keys,seed:start.seed||1}:null);
    const [locks,setLocks]=useState(()=>{ const a=new Array(9).fill(null); if(ag) a[0]=ag.key; return a; });
    const [hist,setHist]=useState([]);
    const [picker,setPicker]=useState(false);
    function run(over={}){
      const o={vibe,feel,scheme,nudge,n,locks,seed:P.newSeed(),avoid:cur?cur.keys:null,...over};
      const lk=o.locks.slice(0,o.n);
      const res = mode==="around"
        ? P.around(anchor,o.scheme==="auto"?"analogous":o.scheme,o.feel,{n:o.n,seed:o.seed,stock,locks:lk,avoid:o.avoid,nudge:o.nudge})
        : P.generate(o.vibe,{n:o.n,seed:o.seed,stock,locks:lk,avoid:o.avoid,scheme:o.scheme,nudge:o.nudge});
      if(!res||!res.keys.length) return;
      if(cur && !over.noHist) setHist(h=>[...h.slice(-19),cur]);
      setCur({keys:res.keys,seed:o.seed,scheme:res.scheme});
    }
    useEffect(()=>{ if(!cur) run({noHist:true}); },[]);
    const keys=cur?cur.keys:[];
    const relative = mode==="around" || P.RELATIVE(P.VIBES[vibe]);
    const schemes = mode==="around" ? AROUND_SCHEMES : (P.VIBES[vibe].schemes||[]);
    function toggleLock(i){ if(ag&&i===0) return; const l=locks.slice(); l[i]=l[i]?null:keys[i]; setLocks(l); }
    function nudgeBy(k,d){ const nn={...nudge,[k]:Math.max(-3,Math.min(3,nudge[k]+d))}; setNudge(nn); run({nudge:nn,seed:cur?cur.seed:1,avoid:null}); }
    function resetNudge(){ const nn={warm:0,light:0,soft:0}; setNudge(nn); run({nudge:nn,seed:cur?cur.seed:1,avoid:null}); }
    function back(){ if(!hist.length) return; const prev=hist[hist.length-1]; setHist(h=>h.slice(0,-1)); setCur(prev); }
    function setCount(m){ m=Math.max(4,Math.min(9,m)); setN(m); run({n:m,seed:cur?cur.seed:1,avoid:null}); }
    function include(x){ const g=typeof x==="string"?groupOf(x):x; setPicker(false); if(!g) return;
      const l=locks.slice(); let i=l.findIndex((x,j)=>j<n&&!x); if(i<0) i=n-1; if(ag&&i===0) i=1;
      l[i]=g.key; setLocks(l); run({locks:l}); }
    const uids=keys.map(k=>{ const g=gOfKey(k); return g?pickUid(g,stock):null; }).filter(Boolean);
    if(ag&&uids.length) uids[0]=anchor;
    const label = mode==="around" ? `${ag?ag.code:""} · ${P.SCHEME_LABEL[(cur&&cur.scheme)||scheme]||""}` : P.VIBES[vibe].label;
    const nudged=nudge.warm||nudge.light||nudge.soft;
    return (
      <div className="sb-tuner">
        {onBack && <button className="sb-link sb-tuner-back" onClick={onBack}><Icon n="back" size={16}/> All palettes</button>}
        {mode==="vibe" && <div className="sb-scrollrow" role="group" aria-label="Vibe">
          {P.VIBE_ORDER.map(v=><button key={v} className={"sb-pillbtn"+(v===vibe?" on":"")} onClick={()=>{ setVibe(v); setScheme("auto"); run({vibe:v,scheme:"auto",avoid:null}); }}>{P.VIBES[v].label}</button>)}
        </div>}
        {mode==="around" && <div className="sb-seg" role="group" aria-label="Feel">
          {FEELS.map(([m,l])=><button key={m} className={feel===m?"on":""} onClick={()=>{ setFeel(m); run({feel:m,avoid:null}); }}>{l}</button>)}
        </div>}
        <div className="sb-muted sm sb-tuner-blurb">{mode==="vibe"?P.VIBES[vibe].blurb:"Tap a color to keep it, then shuffle the rest."}</div>
        <div className="sb-tuner-chips">
          {keys.map((k,i)=>{ const g=gOfKey(k); const lk=!!locks[i]; return g && (
            <button key={i+":"+k} className={"sb-tchip"+(lk?" locked":"")} onClick={()=>toggleLock(i)} aria-pressed={lk} aria-label={`${g.code} ${g.name}${lk?", kept":""}`}>
              <span className="sb-tchip-sw" style={{background:g.hex}}>{lk&&<span className="sb-tchip-lock"><Icon n="lock" size={14}/></span>}</span>
              <b>{g.code}</b><span className="sm">{g.name}</span>
            </button>); })}
        </div>
        <div className="sb-btnrow sb-tuner-main">
          <button className="sb-btn sb-btn-line" onClick={back} disabled={!hist.length}><Icon n="undo" size={18}/><span>Back</span></button>
          <button className="sb-btn sb-btn-ink" onClick={()=>run()}><Icon n="spark" size={18}/><span>Shuffle</span></button>
        </div>
        {relative && schemes.length>1 && <>
          <div className="sb-label">Color scheme</div>
          <div className="sb-scrollrow">
            {mode==="vibe" && <button className={"sb-pillbtn"+(scheme==="auto"?" on":"")} onClick={()=>{ setScheme("auto"); run({scheme:"auto"}); }}>Mix it up</button>}
            {schemes.map(sc=><button key={sc} className={"sb-pillbtn"+((scheme===sc||(mode==="around"&&scheme==="auto"&&sc==="analogous"))?" on":"")} onClick={()=>{ setScheme(sc); run({scheme:sc}); }}>{P.SCHEME_LABEL[sc]}</button>)}
          </div>
        </>}
        <div className="sb-label">Adjust {nudged ? <button className="sb-link sm" onClick={resetNudge}>reset</button> : null}</div>
        <div className="sb-nudges">
          {NUDGES.map(([k,d,l])=>{ const on=Math.sign(nudge[k])===d; return <button key={l} className={"sb-pillbtn"+(on?" on":"")} onClick={()=>nudgeBy(k,d)}>{l}{on&&Math.abs(nudge[k])>1?` ×${Math.abs(nudge[k])}`:""}</button>; })}
        </div>
        <div className="sb-tuner-foot">
          <div className="sb-stepper"><span>Colors</span>
            <button onClick={()=>setCount(n-1)} aria-label="Fewer colors">−</button><b>{n}</b><button onClick={()=>setCount(n+1)} aria-label="More colors">+</button>
          </div>
          <button className="sb-pillbtn" onClick={()=>setPicker(true)}><Icon n="plus" size={14}/> Include a marker</button>
        </div>
        <div className="sb-btnrow">
          {(secondary||[]).map(b=><button key={b.label} className="sb-btn sb-btn-line" onClick={()=>b.onClick(uids,label)}>{b.label}</button>)}
          <button className="sb-btn sb-btn-ink" onClick={()=>onUse(uids,label)} disabled={!uids.length}>{useLabel}</button>
        </div>
        <SB.MarkerPicker open={picker} onClose={()=>setPicker(false)} onPick={include} title="Include a marker" fitUids={uids}/>
      </div>
    );
  }

  // the list of vibes, each with its own shuffle; tapping one opens the tuner
  function VibeList({stock,onOpen}){
    const [seeds,setSeeds]=useState(()=>Object.fromEntries(P.VIBE_ORDER.map(v=>[v,P.newSeed()])));
    const [prev,setPrev]=useState({});
    const res=useMemo(()=>Object.fromEntries(P.VIBE_ORDER.map(v=>[v,P.generate(v,{n:7,seed:seeds[v],stock,avoid:prev[v]||null})])),[seeds,stock]);
    function spin(v){ setPrev(p=>({...p,[v]:res[v].keys})); setSeeds(s=>({...s,[v]:P.newSeed()})); }
    function spinAll(){ setPrev(Object.fromEntries(P.VIBE_ORDER.map(v=>[v,res[v].keys]))); setSeeds(Object.fromEntries(P.VIBE_ORDER.map(v=>[v,P.newSeed()]))); }
    return (
      <div className="sb-stack">
        {P.VIBE_ORDER.map(v=>(
          <div key={v} className="sb-viberow">
            <button className="sb-viberow-main" onClick={()=>onOpen(v,res[v])}>
              <span className="sb-viberow-txt"><b>{P.VIBES[v].label}</b><span className="sb-muted sm">{P.VIBES[v].blurb}</span></span>
              <span className="sb-strip">{res[v].keys.map(k=><span key={k} style={{background:hexOfKey(k)}}/>)}</span>
            </button>
            <button className="sb-iconbtn sb-spin" onClick={()=>spin(v)} aria-label={`Shuffle ${P.VIBES[v].label}`}><Icon n="spark" size={18}/></button>
          </div>
        ))}
        <div className="sb-btnrow"><button className="sb-btn sb-btn-line" onClick={spinAll}><Icon n="spark" size={18}/><span>Shuffle all</span></button></div>
        <div className="sb-muted sm">Tap a vibe to keep colors you like and shuffle the rest.</div>
      </div>
    );
  }
  SB.PaletteTuner=PaletteTuner; SB.VibeList=VibeList;
})();
