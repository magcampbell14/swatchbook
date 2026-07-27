// ============================================================================
// colorqueue — shared UI: hooks, merged inventory, reusable components.
// Loaded after React + cq-engine.js + data. Exports to window for screens.
// ============================================================================
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ---------- storage ----------
const STORAGE = {
  get:(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
};
const LL_SUBS={};
function useLocal(key,initial){
  const [v,setV]=useState(()=>STORAGE.get(key,initial));
  const ref=useRef(v); ref.current=v;
  useEffect(()=>{
    const sub=nv=>{ if(JSON.stringify(ref.current)!==JSON.stringify(nv)){ref.current=nv;setV(nv);} };
    (LL_SUBS[key]=LL_SUBS[key]||new Set()).add(sub);
    return ()=>LL_SUBS[key].delete(sub);
  },[key]);
  const prev=useRef();
  useEffect(()=>{
    const s=JSON.stringify(v); if(prev.current===s) return; prev.current=s;
    if(JSON.stringify(STORAGE.get(key,initial))===s) return;
    STORAGE.set(key,v); (LL_SUBS[key]||[]).forEach(fn=>fn(v));
  },[key,v]);
  return [v,setV];
}

// ---------- merged inventory (mix freely across sets) ----------
const ALL_COLORS=[];
window.SETS.forEach(s=>s.colors.forEach(c=>ALL_COLORS.push({
  uid:s.id+":"+c.code, code:c.code, name:c.name, hex:c.hex,
  setId:s.id, setName:s.short, type:s.type,
})));
const ALL = window.CQ.prep(ALL_COLORS);
const FIN = window.FINISHING.map(f=>({...f, uid:"fin:"+f.code}));
const TYPE_FILTERS=[["all","All"]];
const SET_FILTERS=[["all","All sets"],...window.SETS.map(s=>[s.id,s.short])];

function filterColors(setId,type){
  return ALL.filter(c=>(setId==="all"||c.setId===setId)&&(type==="all"||c.type===type));
}

// ---------- tiny helpers ----------
function pickRandom(arr,fn){const p=fn?arr.filter(fn):arr;return p[Math.floor(Math.random()*p.length)];}
function dayStamp(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function seededPick(arr,seed){let h=0;for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;return arr[h%arr.length];}
const TYPE_GLYPH={alcohol:"◖",pencil:"✎",ink:"💧",gel:"✦",acrylic:"▰"};

// ---------- palette identity + auto-naming ----------
// stable signature of a saved palette (used to prevent duplicate saves)
function paletteSig(colors){
  return (colors||[]).map(c=>c&&c.marker&&(c.marker.uid||c.marker.code)).filter(Boolean).sort().join("|");
}
const NAME_NOUNS={
  red:["ember","poppy","cherry","garnet"], orange:["amber","marmalade","clay","ochre"],
  yellow:["honey","butter","straw","sunbeam"], lime:["meadow","sprout","chartreuse","clover"],
  green:["fern","moss","pine","sage"], teal:["lagoon","seafoam","spruce","tide"],
  blue:["dusk","harbor","cobalt","slate"], purple:["plum","thistle","orchid","iris"],
  pink:["blush","rosewater","peony","petal"], brown:["cocoa","chestnut","driftwood","toast"],
  neutral:["stone","ash","fog","linen"],
};
// a cute, lowercase, deterministic name from the palette's colours
function cuteName(colors){
  const cs=(colors||[]).map(c=>c&&c.marker).filter(Boolean);
  if(!cs.length) return "little palette";
  const prepped=window.CQ.prep(cs.map((c,i)=>({hex:c.hex,uid:(c.uid||c.code||i)+""})));
  const byC=prepped.slice().sort((a,b)=>b._lch[1]-a._lch[1]);
  const fam=window.CQ.familyOf(byC[0]);
  const avgL=prepped.reduce((s,c)=>s+c._lch[0],0)/prepped.length;
  const avgC=prepped.reduce((s,c)=>s+c._lch[1],0)/prepped.length;
  const sig=paletteSig(colors)||cs.map(c=>c.hex).join("");
  const nouns=NAME_NOUNS[fam]||NAME_NOUNS.neutral;
  let adjs;
  if(avgL>68)      adjs=["soft","pale","faded","powdered","quiet"];
  else if(avgL<38) adjs=["deep","midnight","smoked","inky","velvet"];
  else if(avgC>42) adjs=["bright","electric","bold","candied"];
  else if(avgC<18) adjs=["dusty","muted","worn","hushed"];
  else             adjs=["warm","golden","cozy","sunlit"];
  return (seededPick(adjs,sig+"a")+" "+seededPick(nouns,sig+"n")).toLowerCase();
}

// ---------- scene preview ----------
// Map a palette of ANY size onto the scene's 6 tonal slots: sort light→dark and
// sample evenly, so a 4- or 9-colour palette both read as a coherent scene.
function sceneColors(cs){
  const hexes=(cs||[]).map(c=>c&&(c.marker?c.marker.hex:c.hex)).filter(Boolean);
  if(!hexes.length) return ["#e9d9b8","#cdbfa0","#9c8f76","#6f6552","#4a4336","#2a271f"];
  const prepped=window.CQ.prep(hexes.map((h,i)=>({hex:h,uid:i+""}))).slice().sort((a,b)=>b._lch[0]-a._lch[0]);
  const out=[];
  for(let i=0;i<6;i++){ const idx=Math.round(i/5*(prepped.length-1)); out.push(prepped[idx].hex); }
  return out;   // [lightest … darkest]
}
function sceneSVG(cs,uid,highlight){
  const g="sk"+uid;
  return `<svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cs[1]}"/><stop offset="1" stop-color="${cs[0]}"/></linearGradient></defs>
    <rect width="320" height="150" fill="url(#${g})"/>
    <circle cx="244" cy="44" r="22" fill="${cs[0]}" stroke="rgba(0,0,0,.13)"/>
    <path d="M0,86 Q80,70 160,82 Q240,92 320,78 L320,150 L0,150 Z" fill="${cs[2]}"/>
    <path d="M0,102 Q90,88 160,100 Q240,110 320,96 L320,150 L0,150 Z" fill="${cs[3]}"/>
    <path d="M0,118 Q90,108 160,116 Q240,122 320,110 L320,150 L0,150 Z" fill="${cs[4]}"/>
    <path d="M0,134 Q100,128 160,132 Q220,136 320,128 L320,150 L0,150 Z" fill="${cs[5]}"/>
    <g fill="${cs[5]}"><rect x="58" y="118" width="3" height="16"/><path d="M59.5,96 L49,122 L70,122 Z"/><path d="M59.5,107 L52,126 L67,126 Z"/></g>
    ${highlight?`<g class="scene-glint" fill="#fff"><path d="M250 18 L252.7 25.3 L260 28 L252.7 30.7 L250 38 L247.3 30.7 L240 28 L247.3 25.3 Z"/><circle cx="232" cy="31" r="2.3"/><circle cx="262" cy="41" r="1.6"/></g>`:""}
  </svg>`;
}
function Scene({colors,uid,highlight}){
  const html=useMemo(()=>sceneSVG(sceneColors(colors),uid||"x",highlight),[colors,uid,highlight]);
  return <div className="scene" dangerouslySetInnerHTML={{__html:html}} />;
}

// ---------- stock state (running low / out of a colour) ----------
function useStock(){
  const [stock,setStock]=useLocal("cq-stock",{});
  const s=(stock&&typeof stock==="object"&&!Array.isArray(stock))?stock:{};
  const setStockFor=(uid,val)=>{ const n={...s}; if(!val||val==="ok") delete n[uid]; else n[uid]=val; setStock(n); };
  return [s,setStockFor];
}

// ---------- swatch dot ----------
function Dot({hex,size=44,sel,ring,onClick,title,stock}){
  const btn=(
    <button className={"dot"+(sel?" sel":"")+(stock?" "+stock:"")} onClick={onClick}
      title={stock?`${title||""} · ${stock==="out"?"out":"running low"}`:title}
      style={{width:size,height:size,background:hex,outline:ring?`2px solid ${ring}`:"none",outlineOffset:2}} aria-label={title}/>
  );
  if(!stock) return btn;
  return <span className="dot-wrap">{btn}<span className={"dot-low-badge "+stock}>{stock==="out"?<Icon name="close" size={9} stroke={3.2}/>:<Icon name="drop" size={9} stroke={2.6} fill="currentColor"/>}</span></span>;
}

// ---------- crisp inline icons (no font dependency — render identically everywhere) ----------
const ICON_PATHS={
  bookmark:"M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z",
  search:"M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm6 13 4 4",
  sort:"M7 4v16M7 4 3 8m4-4 4 4M17 20V4m0 16 4-4m-4 4-4-4",
  plus:"M12 5v14M5 12h14",
  edit:"M4 20h4L20 8l-4-4L4 16v4z",
  close:"M6 6l12 12M18 6 6 18",
  check:"M4 12l5 5L20 6",
  drop:"M12 3s7 8 7 12a7 7 0 0 1-14 0c0-4 7-12 7-12z",
  up:"M6 15l6-6 6 6",
  down:"M6 9l6 6 6-6",
};
function Icon({name,size=18,stroke=2,fill="none",style}){
  const d=ICON_PATHS[name]; if(!d) return null;
  const solid = name==="bookmark" && fill!=="none";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={solid?fill:"none"} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{display:"block",...style}} aria-hidden="true">
      <path d={d}/>
    </svg>
  );
}

// ---------- bottom sheet ----------
// ---------- body scroll lock (used by every popup) ----------
function useScrollLock(active){
  useEffect(()=>{
    if(!active) return;
    const y=window.scrollY||window.pageYOffset||0;
    const b=document.body.style;
    const prev={position:b.position,top:b.top,left:b.left,right:b.right,width:b.width,overflow:b.overflow};
    b.position="fixed"; b.top=`-${y}px`; b.left="0"; b.right="0"; b.width="100%"; b.overflow="hidden";
    return ()=>{ Object.assign(b,prev); window.scrollTo(0,y); };
  },[active]);
}

function Sheet({open,onClose,title,children}){
  useScrollLock(open);
  if(!open) return null;
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grip"/>
        <div className="sheet-head">
          <span>{title}</span>
          <button className="sheet-close" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- name-this-palette sheet (shared by Bridge + Builder save) ----------
function NameSheet({open,initial,colors,onSave,onClose}){
  const [name,setName]=useState(initial||"");
  useEffect(()=>{ if(open) setName(initial||""); },[open,initial]);
  if(!open) return null;
  const go=()=>{ const t=(name||"").trim(); if(t) onSave(t); };
  return (
    <Sheet open={open} onClose={onClose} title="name this palette">
      <div className="row" style={{gap:5,flexWrap:"wrap",marginBottom:16}}>
        {(colors||[]).map((c,i)=><span key={i} className="saved-chip" style={{background:c.marker.hex}} title={c.marker.code}/>)}
      </div>
      <input className="text-field" value={name} maxLength={28} autoFocus
        onChange={e=>setName(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter") go(); }} placeholder="a little name…"/>
      <div className="muted sm" style={{marginTop:9,lineHeight:1.4}}>a name's filled in for you — keep it or make it your own ✦</div>
      <div className="wiz-nav">
        <button className="btn btn-ghost" onClick={onClose}>cancel</button>
        <button className="btn btn-accent" disabled={!(name||"").trim()} onClick={go}><span className="btn-ico"><Icon name="bookmark" size={16}/>save it</span></button>
      </div>
    </Sheet>
  );
}

// ---------- color picker (used across Palettes + Pages) ----------
function ColorPicker({selected,onPick,multi}){
  const [setId,setSetId]=useState("all");
  const [query,setQuery]=useState("");
  const [confirm,setConfirm]=useState(null);   // last swatch tapped — {color, action}
  const [stock]=useStock();
  const list=useMemo(()=>filterColors(setId,"all"),[setId]);
  const q=query.trim().toLowerCase();
  const matches=useMemo(()=>q?list.filter(c=>(c.code+" "+c.name+" "+c.setName).toLowerCase().includes(q)):list,[list,q]);
  const groups=useMemo(()=>window.CQ.families(matches),[matches]);
  const flat=useMemo(()=>q?matches.slice().sort((a,b)=>b._lch[0]-a._lch[0]):[],[matches,q]);
  const sel=new Set(Array.isArray(selected)?selected:(selected?[selected]:[]));
  const tap=c=>{
    const was=sel.has(c.uid);
    onPick(c.uid);
    setConfirm({color:c, action: multi ? (was?"removed":"added") : "selected"});
  };
  const swatch=c=>(
    <Dot key={c.uid} hex={c.hex} size={34} sel={sel.has(c.uid)} stock={stock[c.uid]}
      ring={sel.has(c.uid)?"var(--accent)":null}
      onClick={()=>tap(c)} title={`${c.code} · ${c.name} · ${c.setName}`}/>
  );
  return (
    <div className="picker">
      <div className="search-row">
        <Icon name="search" size={16}/>
        <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="search a code or name…" autoComplete="off" autoCapitalize="off" spellCheck="false"/>
        {query && <button className="search-clear" onClick={()=>setQuery("")} aria-label="clear search"><Icon name="close" size={14} stroke={2.4}/></button>}
      </div>
      <div className="filter-row" style={{marginTop:10}}>
        {SET_FILTERS.map(([v,l])=>(
          <button key={v} className={"pill sm ghost"+(setId===v?" on":"")} onClick={()=>setSetId(v)}>{l}</button>
        ))}
      </div>

      {confirm && (
        <div className={"pick-confirm "+confirm.action} aria-live="polite">
          <span className="pick-confirm-sw" style={{background:confirm.color.hex}}/>
          <div className="pick-confirm-meta">
            <div className="pick-confirm-code">{confirm.color.code}</div>
            <div className="pick-confirm-name">{confirm.color.name} · {confirm.color.setName}</div>
          </div>
          <span className={"pick-confirm-tag "+confirm.action}>
            {confirm.action==="removed"?"removed":confirm.action==="added"?"✓ added":"✓ this one"}
          </span>
        </div>
      )}

      <div className="picker-scroll">
        {q ? (
          flat.length===0
            ? <div className="empty">no colours match “{query}”</div>
            : <div className="fam">
                <div className="fam-label">{flat.length} match{flat.length===1?"":"es"} <span className="muted">· lightest → darkest</span></div>
                <div className="fam-grid">{flat.map(swatch)}</div>
              </div>
        ) : (
          groups.length===0
            ? <div className="empty">no colors match that filter</div>
            : groups.map(g=>(
                <div className="fam" key={g.key}>
                  <div className="fam-label">{g.label} <span className="muted">· {g.colors.length}</span></div>
                  <div className="fam-grid">{g.colors.map(swatch)}</div>
                </div>
              ))
        )}
      </div>
    </div>
  );
}

Object.assign(window,{
  STORAGE,useLocal,ALL,FIN,filterColors,TYPE_FILTERS,SET_FILTERS,TYPE_GLYPH,
  pickRandom,dayStamp,seededPick,paletteSig,cuteName,sceneSVG,sceneColors,Scene,Dot,Icon,useStock,Sheet,NameSheet,ColorPicker,useScrollLock,
  useState,useEffect,useMemo,useRef,useCallback,
});
