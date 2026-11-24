// ============================================================================
// swatchbook v2 — shared core: marker groups (same ink merged), stock, shading
// recommendations, harmony recolor, photo palette extraction, and the small UI
// pieces every screen uses (icons, bottom sheet, swatch, shade card, picker).
// Wrapped in an IIFE: babel scripts share one global scope.
// ============================================================================
(function(){
  const { useState, useEffect, useRef, useMemo } = React;
  const CQ = window.CQ;
  const ALL = window.ALL;                       // prepped: uid, code, old, name, hex, _lab, _lch, setId, setName

  // ---------- color math ----------
  const lchToLab = ([L,C,h]) => { const r=h*Math.PI/180; return [L,Math.cos(r)*C,Math.sin(r)*C]; };
  const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const hueDiff = (a,b) => { const d=Math.abs(((a-b)%360+360)%360); return d>180?360-d:d; };
  const wrap = h => ((h%360)+360)%360;
  const towards = (h,target,deg) => { let d=((target-h+540)%360)-180; return wrap(h+Math.sign(d)*Math.min(Math.abs(d),deg)); };
  function rgbToLab(r,g,b){
    const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    const R=lin(r),G=lin(g),B=lin(b);
    const X=R*0.4124564+G*0.3575761+B*0.1804375, Y=R*0.2126729+G*0.7151522+B*0.0721750, Z=R*0.0193339+G*0.1191920+B*0.9503041;
    const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
    const fx=f(X/0.95047),fy=f(Y),fz=f(Z/1.08883);
    return [116*fy-16,500*(fx-fy),200*(fy-fz)];
  }

  // ---------- marker groups: one entry per physical ink ----------
  // Ohuhu markers with the same code are the same ink across sets (merged, "×2").
  // SFAIH is a different brand — its inks stay separate even when codes match.
  const brandOf = setId => setId==="sfaih" ? "SFAIH" : "Ohuhu";
  const GROUPS = (()=>{
    const m=new Map();
    ALL.forEach(c=>{
      const key=(c.setId==="sfaih"?"sf:":"oh:")+c.code;
      // SFAIH: show what's printed on the cap first (B340 Lavender Mist); the Ohuhu 2025
      // equivalent (BV05 Cornflower) rides along in old/oldName as a small reference.
      const sf=c.setId==="sfaih"&&c.old;
      if(!m.has(key)) m.set(key,{key, code:sf?c.old:c.code, old:sf?c.code:(c.old||""), name:c.name, oldName:c.oldName||"", hex:c.hex,
        _lab:c._lab, _lch:c._lch, brand:brandOf(c.setId), family:CQ.familyOf(c), members:[]});
      m.get(key).members.push(c);
    });
    return [...m.values()];
  })();
  const GROUP_BY_UID={}; GROUPS.forEach(g=>g.members.forEach(c=>{ GROUP_BY_UID[c.uid]=g; }));
  const groupOf = uid => GROUP_BY_UID[uid]||null;
  const codeText = g => g ? (g.old ? `${g.code} / ${g.old}` : g.code) : "";
  // second line under a name: Ohuhu's renamed markers show their old name; SFAIH shows its Ohuhu match
  const altName = g => !g ? "" : g.brand==="SFAIH" ? (g.old?`Ohuhu ${g.old}${g.oldName?" "+g.oldName:""}`:"") : (g.oldName&&g.oldName!==g.name?`was ${g.oldName}`:"");

  // stock: per physical marker (uid). A group is "out" only when every copy is out.
  function groupStatus(g,stock){
    if(!g) return null;
    const st=g.members.map(c=>stock[c.uid]||"ok");
    if(st.every(s=>s==="out")) return "out";
    if(st.some(s=>s==="low"||s==="out")) return "low";
    return null;
  }
  const usable = (g,stock) => g && groupStatus(g,stock)!=="out";
  const pickUid = (g,stock) => { const m=g.members.find(c=>(stock[c.uid]||"ok")!=="out")||g.members[0]; return m.uid; };

  function snap(lab,stock,exclude){
    let best=null,bd=Infinity;
    for(const g of GROUPS){
      if(exclude&&exclude.has(g.key)) continue;
      if(!usable(g,stock)) continue;
      const d=dist(g._lab,lab); if(d<bd){bd=d;best=g;}
    }
    return best;
  }

  // ---------- shading: base → 1–2 same-family shadows + 1 cool shadow ----------
  function shadeRecs(g,stock){
    if(!g) return {same:[],cool:null};
    const [L,C,h]=g._lch;
    const neutral=C<10;
    const cands=GROUPS.filter(x=>x.key!==g.key && usable(x,stock));
    const scored=cands.filter(x=>{
      const dL=L-x._lch[0];
      return dL>5 && dL<36 && (neutral ? x._lch[1]<16 : hueDiff(x._lch[2],h)<30);
    }).map(x=>({x,s:Math.abs((L-x._lch[0])-14)+hueDiff(x._lch[2],h)*0.6+Math.abs(x._lch[1]-C*1.1)*0.3}))
      .sort((a,b)=>a.s-b.s);
    const same=[];
    if(scored[0]){
      same.push(scored[0].x);
      const deeper=scored.find(o=>o.x._lch[0]<scored[0].x._lch[0]-6);
      if(deeper) same.push(deeper.x);
    }
    const ex=new Set([g.key,...same.map(x=>x.key)]);
    const coolTarget=lchToLab([Math.max(12,L-14), Math.max(6,C*0.55), towards(h,285,neutral?0:40)]);
    const cool=snap(coolTarget,stock,ex);
    return {same,cool};
  }

  // ---------- harmony recolor (versions) ----------
  // Like a linked color wheel: every chromatic color moves together relative to the
  // page's key color, each keeps its lightness (so the drawing still reads), and the
  // result snaps to the nearest marker you own. Browns/greys can stay put.
  const OFFSETS={
    analogous:[0,30,-30,50,-50,15,-15,40,-40,25,-25],
    complementary:[0,-25,180,165,195,10,-10,170,190,20,-20],
    split:[0,-25,150,210,140,220,10,160,200,-10,20],
  };
  const isEarthy = g => g._lch[1]<12 || g.family==="brown" || g.family==="neutral";
  function harmonyMap(uidsByUse,kind,keepNeutral,stock){
    const groups=[]; const seen=new Set();
    uidsByUse.forEach(u=>{ const g=groupOf(u); if(g&&!seen.has(g.key)){seen.add(g.key);groups.push(g);} });
    const map={}; const keyOfGroup={};
    if(kind==="pastel"){
      groups.forEach(g=>{
        const [L,C,h]=g._lch;
        const t=C<6 ? g : snap(lchToLab([Math.max(L,84),Math.max(Math.min(C*0.7,22),10),h]),stock);
        keyOfGroup[g.key]=t||g;
      });
    } else {
      const chroma=groups.filter(g=>!(keepNeutral&&isEarthy(g)));
      const key=chroma.length?chroma[0]._lch[2]:0;
      const offs=OFFSETS[kind]||OFFSETS.analogous;
      groups.forEach(g=>{ keyOfGroup[g.key]=g; });
      chroma.forEach((g,i)=>{
        const [L,C]=g._lch;
        const t=snap(lchToLab([L,Math.max(C,20),wrap(key+offs[i%offs.length])]),stock);
        if(t) keyOfGroup[g.key]=t;
      });
    }
    uidsByUse.forEach(u=>{ const g=groupOf(u); if(g){ const t=keyOfGroup[g.key]; map[u]= t.key===g.key ? u : pickUid(t,stock); } });
    return map;
  }
  const SCHEMES=[
    {id:"pastel",label:"Pastel",sub:"Same hues, softened"},
    {id:"analogous",label:"Analogous",sub:"Neighbors — calm"},
    {id:"complementary",label:"Complementary",sub:"Opposites — pops"},
    {id:"split",label:"Split-comp",sub:"Contrast, softer"},
  ];

  // suggestions that go with what's already on the page (not already in the tray)
  function suggestFor(uids,stock,exclude){
    const gs=[...new Set(uids.map(u=>groupOf(u)).filter(Boolean))];
    const chroma=gs.filter(g=>!isEarthy(g));
    if(!gs.length) return [];
    const base=(chroma[0]||gs[0]);
    const [L,C,h]=base._lch;
    const ex=new Set([...(exclude||[]).map(u=>groupOf(u)&&groupOf(u).key).filter(Boolean), ...gs.map(g=>g.key)]);
    const targets=[[L,C,wrap(h+30)],[L,C,wrap(h-30)],[Math.min(90,L+10),Math.max(14,C*0.8),wrap(h+180)],[L-18,C,h]];
    const out=[];
    targets.forEach(t=>{ const g=snap(lchToLab(t),stock,ex); if(g){ ex.add(g.key); out.push(g); } });
    return out;
  }

  // ---------- "fits this page" ranking ----------
  // A marker fits when its hue sits in a harmony with a hue already on the page
  // (same / neighbor / complement / split / triad) AND it shares the page's softness —
  // a cohesive palette's colors share a similar intensity, so tonal match counts as much as hue.
  const HARM=[[0,0],[30,3],[-30,3],[180,6],[150,8],[-150,8],[120,10],[-120,10]];
  function pageContext(uids){
    const gs=[...new Set((uids||[]).map(u=>groupOf(u)).filter(Boolean))];
    const cs=gs.map(g=>g._lch[1]).sort((a,b)=>a-b), ls=gs.map(g=>g._lch[0]);
    return { gs, keys:new Set(gs.map(g=>g.key)), hues:gs.filter(g=>g._lch[1]>=10).map(g=>g._lch[2]),
      cMed:cs.length?cs[Math.floor(cs.length/2)]:30, lMin:ls.length?Math.min(...ls):20, lMax:ls.length?Math.max(...ls):95 };
  }
  function fitScore(g,ctx){
    const [L,C,h]=g._lch;
    let hc;
    if(C<10) hc=12;                                   // greys/near-neutrals go with most things
    else if(!ctx.hues.length) hc=20;
    else { hc=Infinity; for(const ph of ctx.hues) for(const [o,pen] of HARM){ const d=hueDiff(h,wrap(ph+o))+pen; if(d<hc) hc=d; } }
    const tonal=Math.abs(C-ctx.cMed)*0.6;
    const lc=L<ctx.lMin-10?(ctx.lMin-10-L)*0.4:L>ctx.lMax+10?(L-ctx.lMax-10)*0.4:0;
    const twin=ctx.gs.some(p=>dist(p._lab,g._lab)<7)?18:0;  // near-copies of what's already there aren't helpful
    // Ou & Luo pair harmony with what's already on the page (engine loads after this file)
    const P=window.SB&&window.SB.PAL; let hh=0;
    if(P&&ctx.gs.length){ let s=0; ctx.gs.forEach(p=>{ s+=P.ouLuo(p._lab,g._lab); }); hh=-14*(s/ctx.gs.length); }
    return hc+tonal+lc+twin+hh;
  }
  function bestFits(uids,stock,n=5,diverse=true){
    const ctx=pageContext(uids); if(!ctx.gs.length) return [];
    const ranked=GROUPS.filter(g=>!ctx.keys.has(g.key)&&usable(g,stock)).map(g=>({g,s:fitScore(g,ctx)})).sort((a,b)=>a.s-b.s);
    const out=[], fams=new Set();
    for(const r of ranked){ if(diverse&&fams.has(r.g.family)) continue; fams.add(r.g.family); out.push(r.g); if(out.length>=n) break; }
    return out;
  }

  // ---------- palette from a photo ----------
  function extractFromImage(img,stock,k=7){
    const S=72, c=document.createElement("canvas");
    const s=S/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height);
    c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s)); c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s));
    const x=c.getContext("2d"); x.drawImage(img,0,0,c.width,c.height);
    const d=x.getImageData(0,0,c.width,c.height).data;
    const px=[];
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<128) continue; const lab=rgbToLab(d[i],d[i+1],d[i+2]); if(lab[0]>97) continue; px.push(lab); }
    if(!px.length) return [];
    const K=Math.min(10,px.length);
    // farthest-point init, then k-means in Lab
    let cent=[px[Math.floor(px.length/2)]];
    while(cent.length<K){ let bi=0,bd=-1; px.forEach((p,i)=>{ const m=Math.min(...cent.map(c=>dist(c,p))); if(m>bd){bd=m;bi=i;} }); cent.push(px[bi]); }
    let assign=new Array(px.length).fill(0);
    for(let it=0;it<10;it++){
      px.forEach((p,i)=>{ let bi=0,bd=Infinity; cent.forEach((c,j)=>{ const dd=dist(c,p); if(dd<bd){bd=dd;bi=j;} }); assign[i]=bi; });
      cent=cent.map((c,j)=>{ let n=0,a=[0,0,0]; px.forEach((p,i)=>{ if(assign[i]===j){n++;a[0]+=p[0];a[1]+=p[1];a[2]+=p[2];} }); return n?[a[0]/n,a[1]/n,a[2]/n]:c; });
    }
    const size=cent.map((_,j)=>assign.filter(a=>a===j).length);
    const order=cent.map((c,j)=>({c,n:size[j]})).sort((a,b)=>b.n-a.n);
    const out=[]; const ex=new Set();
    for(const o of order){ const g=snap(o.c,stock,ex); if(g){ex.add(g.key);out.push(pickUid(g,stock));} if(out.length>=k) break; }
    return out;
  }
  function readImageFile(file){
    return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); });
  }

  // ---------- UI pieces ----------
  const ICONS={
    pages:'<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/>',
    markers:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    palettes:'<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/>',
    back:'<path d="M15 5l-7 7 7 7"/>', undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/>',
    photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    blank:'<path d="M12 20l-7-7 3-3 7 7"/><path d="M14 4l6 6-5 5-6-6z"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', swap:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    share:'<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', drop:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
    blend:'<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  };
  function Icon({n,size=22,color="currentColor",label,stroke=1.8}){
    const a=label?{role:"img","aria-label":label}:{"aria-hidden":"true"};
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" {...a} dangerouslySetInnerHTML={{__html:ICONS[n]||""}}/>;
  }

  function Sheet({open,onClose,title,children,tall,actions}){
    window.useScrollLock(open);
    useEffect(()=>{ if(!open) return; const h=e=>{ if(e.key==="Escape") onClose&&onClose(); }; window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[open,onClose]);
    if(!open) return null;
    return (
      <div className="sb-sheet-wrap">
        <div className="sb-scrim" onClick={onClose}/>
        <div className={"sb-sheet"+(tall?" tall":"")} role="dialog" aria-label={title||"panel"}>
          <div className="sb-grab"/>
          {(title||onClose) && (
            <div className="sb-sheet-head">
              <h2 className="sb-h2">{title}</h2>
              {actions}
              <button className="sb-iconbtn" onClick={onClose} aria-label="Close"><Icon n="close"/></button>
            </div>
          )}
          <div className="sb-sheet-body">{children}</div>
        </div>
      </div>
    );
  }

  function Chip({hex,size=40,ring,status,dim,label,onClick,children,radius}){
    const st={width:size,height:size,background:hex,borderRadius:radius||Math.round(size*0.26)};
    const cls="sb-chip"+(ring?" ring":"")+(dim?" dim":"");
    const inner=<>{status&&<span className={"sb-dot "+status} aria-hidden="true"/>}{children}</>;
    return onClick
      ? <button className={cls} style={st} onClick={onClick} aria-label={label}>{inner}</button>
      : <span className={cls} style={st} role={label?"img":undefined} aria-label={label}>{inner}</span>;
  }

  // shading card — the same component on a page and in Markers
  function ShadeCard({group,onUse,context,useLabel="Use",hideBase}){
    const [stock]=window.useStock();
    const recs=useMemo(()=>shadeRecs(group,stock),[group,stock]);
    if(!group) return null;
    const Row=({g,note})=>(
      <button className="sb-rec" onClick={onUse?()=>onUse(g):undefined} disabled={!onUse}>
        <Chip hex={g.hex} size={40}/>
        <span className="sb-rec-txt"><b>{codeText(g)}</b><span>{g.name}{g.brand==="SFAIH"?" · SFAIH":""}{note||""}</span></span>
        {onUse && <span className="sb-rec-use">{useLabel}</span>}
      </button>
    );
    return (
      <div className="sb-shade">
        {!hideBase && <div className="sb-shade-base">
          <Chip hex={group.hex} size={56}/>
          <div className="sb-shade-base-txt">
            <span className="sb-eyebrow">{context?context+" · base":"Base"}</span>
            <span className="sb-shade-code">{codeText(group)}</span>
            <span className="sb-muted">{group.name}{altName(group)?` · ${altName(group)}`:""}</span>
          </div>
        </div>}
        {recs.same.length>0 && <div className="sb-label">Shadow · same family</div>}
        {recs.same.map((g,i)=><Row key={g.key} g={g} note={i===1?" · deeper":""}/>)}
        {recs.cool && <div className="sb-label">Shadow · cool</div>}
        {recs.cool && <Row g={recs.cool}/>}
        {!recs.same.length && !recs.cool && <div className="sb-empty">No darker marker you own fits this one.</div>}
      </div>
    );
  }

  // search + grid of every ink you own; returns a group. With fitUids (the page's markers)
  // it opens on "Best with this page" and lets you pick a color family first.
  function MarkerPicker({open,onClose,onPick,title="Add a marker",exclude,fitUids}){
    const [q,setQ]=useState("");
    const [fam,setFam]=useState("all");
    const [stock]=window.useStock();
    const ctx=useMemo(()=>fitUids&&fitUids.length?pageContext(fitUids):null,[fitUids]);
    const t=q.trim().toLowerCase();
    const {best,rest}=useMemo(()=>{
      const ex=new Set(exclude||[]);
      let l=GROUPS.filter(g=>!ex.has(g.key));
      if(fam!=="all") l=l.filter(g=>g.family===fam);
      if(t) l=l.filter(g=>(g.code+" "+g.old+" "+g.name+" "+g.oldName+" "+g.brand).toLowerCase().includes(t));
      const byFam=(a,b)=>CQ.FAMILY_ORDER.indexOf(a.family)-CQ.FAMILY_ORDER.indexOf(b.family)||b._lch[0]-a._lch[0];
      if(!ctx||t) return {best:[],rest:l.slice().sort(byFam)};
      const best=l.filter(g=>!ctx.keys.has(g.key)&&usable(g,stock)).map(g=>({g,s:fitScore(g,ctx)})).sort((a,b)=>a.s-b.s).slice(0,fam==="all"?10:6).map(x=>x.g);
      const bk=new Set(best.map(g=>g.key));
      return {best,rest:l.filter(g=>!bk.has(g.key)).sort(byFam)};
    },[t,fam,exclude,ctx,stock]);
    useEffect(()=>{ if(!open){ setQ(""); setFam("all"); } },[open]);
    const famsPresent=CQ.FAMILY_ORDER.filter(f=>GROUPS.some(g=>g.family===f));
    const Tile=({g})=>{ const st=groupStatus(g,stock); return (
      <button className="sb-tile" onClick={()=>onPick(g)} aria-label={`${codeText(g)} ${g.name}`}>
        <span className={"sb-tile-sw"+(st==="out"?" dim":"")} style={{background:g.hex}}>{st&&<span className={"sb-dot "+st}/>}</span>
        <span className="sb-tile-code">{g.code}</span>
        <span className="sb-tile-old">{g.old||" "}</span>
      </button>); };
    const FAM_SHORT={red:"Reds",orange:"Oranges",yellow:"Yellows",lime:"Limes",green:"Greens",teal:"Teals",blue:"Blues",purple:"Purples",pink:"Pinks",brown:"Browns",neutral:"Greys"};
    const famLabel=f=>FAM_SHORT[f]||CQ.FAMILY_LABEL[f]||f;
    return (
      <Sheet open={open} onClose={onClose} title={title} tall>
        <label className="sb-search"><Icon n="search" size={18}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Code, old code or name" aria-label="Search markers"/>
          {q && <button className="sb-clear" onClick={()=>setQ("")} aria-label="Clear search"><Icon n="close" size={16}/></button>}
        </label>
        <div className="sb-filters" role="tablist" aria-label="Color family">
          <button className={"sb-fchip"+(fam==="all"?" on":"")} onClick={()=>setFam("all")}>All</button>
          {famsPresent.map(f=><button key={f} className={"sb-fchip"+(fam===f?" on":"")} onClick={()=>setFam(f)}>{famLabel(f)}</button>)}
        </div>
        {best.length>0 && <>
          <h3 className="sb-label">Best with this page{fam!=="all"?` · ${famLabel(fam)}`:""}</h3>
          <div className="sb-grid sb-grid-sm" style={{marginTop:0}}>{best.map(g=><Tile key={g.key} g={g}/>)}</div>
          <h3 className="sb-label">{fam==="all"?"Everything":`All ${famLabel(fam).toLowerCase()}`}</h3>
        </>}
        <div className="sb-grid sb-grid-sm" style={best.length?{marginTop:0}:undefined}>{rest.map(g=><Tile key={g.key} g={g}/>)}</div>
        {!best.length && !rest.length && <div className="sb-empty">No marker matches.</div>}
      </Sheet>
    );
  }

  function useLongPress(onLong,onTap,ms=480){
    const t=useRef(null), fired=useRef(false), start=useRef(null);
    const clear=()=>{ if(t.current){clearTimeout(t.current);t.current=null;} };
    return {
      onPointerDown:e=>{ fired.current=false; start.current=[e.clientX,e.clientY]; clear(); t.current=setTimeout(()=>{ fired.current=true; try{navigator.vibrate&&navigator.vibrate(12);}catch{} onLong(); },ms); },
      onPointerMove:e=>{ if(start.current && Math.hypot(e.clientX-start.current[0],e.clientY-start.current[1])>10) clear(); },
      onPointerUp:()=>{ clear(); if(!fired.current) onTap&&onTap(); },
      onPointerLeave:clear, onPointerCancel:clear,
      onContextMenu:e=>e.preventDefault(),
    };
  }

  // save a set of markers as a palette (same shape as the original saved palettes)
  function savePalette(uids,kind,note,name){
    const colors=uids.map(u=>window.liveColor({uid:u})).filter(c=>c&&c.uid).map(c=>({marker:{uid:c.uid,code:c.code,name:c.name,hex:c.hex,setName:c.setName,type:c.type},role:""}));
    if(!colors.length) return null;
    const list=window.STORAGE.get("cq-saved",[]); const arr=Array.isArray(list)?list:[];
    const sig=window.paletteSig(colors);
    if(arr.some(p=>(p.sig||window.paletteSig(p.colors))===sig)) return "dup";
    const p={name:name||window.cuteName(colors),kind,note,colors,sig,ts:Date.now()};
    window.STORAGE.set("cq-saved",[p,...arr].slice(0,60));
    return p;
  }

  function Toast({msg}){ return msg ? <div className="sb-toast" role="status">{msg}</div> : null; }
  function useToast(){ const [m,setM]=useState(""); const t=useRef(null); const show=s=>{ setM(s); clearTimeout(t.current); t.current=setTimeout(()=>setM(""),1800); }; return [m,show]; }

  Object.assign(window,{SB:{
    GROUPS, groupOf, codeText, altName, groupStatus, usable, pickUid, snap, shadeRecs, harmonyMap, SCHEMES, suggestFor,
    extractFromImage, readImageFile, rgbToLab, lchToLab, dist, isEarthy,
    Icon, Sheet, Chip, ShadeCard, MarkerPicker, bestFits, pageContext, fitScore, useLongPress, Toast, useToast, savePalette,
  }});
})();
