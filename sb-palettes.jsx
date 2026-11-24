// ============================================================================
// swatchbook v2 — Palettes: your saved palettes ("cq-saved", same shape as
// before), a palette pulled from any photo, and one "between two markers" tool
// (the old Blend + Gradient, merged).
// ============================================================================
(function(){
  const { useState, useEffect, useMemo, useRef } = React;
  const SB = window.SB, CQ = window.CQ;
  const { Icon, Sheet, Chip, groupOf, codeText } = SB;
  const hexOfUid = u => window.hexOf({uid:u});

  function PalettesScreen({betweenSeed,clearSeed}){
    const [saved,setSaved]=window.useLocal("cq-saved",[]);
    const list=Array.isArray(saved)?saved:[];
    const [open,setOpen]=useState(null);           // ts of palette in detail
    const [tool,setTool]=useState(betweenSeed?"between":null);
    const [toast,showToast]=SB.useToast();
    useEffect(()=>{ if(betweenSeed) setTool("between"); },[betweenSeed]);
    const cur=list.find(p=>p.ts===open)||null;

    function save(uids,kind,note){
      const colors=uids.map(u=>window.liveColor({uid:u})).filter(c=>c&&c.uid).map(c=>({marker:{uid:c.uid,code:c.code,name:c.name,hex:c.hex,setName:c.setName,type:c.type},role:""}));
      const sig=window.paletteSig(colors);
      if(list.some(p=>(p.sig||window.paletteSig(p.colors))===sig)){ showToast("Already saved"); return; }
      setSaved([{name:window.cuteName(colors),kind,note,colors,sig,ts:Date.now()},...list].slice(0,60));
      showToast("Saved"); setTool(null);
    }

    return (
      <div className="sb-screen">
        <header className="sb-head"><h1 className="sb-h1">Palettes</h1></header>
        <div className="sb-tools">
          <button className="sb-option" onClick={()=>setTool("vibe")}>
            <span className="sb-option-ic"><Icon n="spark"/></span>
            <span className="sb-option-txt"><b>Make a palette</b><span>Pick a vibe, keep what you like, shuffle the rest</span></span>
          </button>
          <button className="sb-option" onClick={()=>setTool("photo")}>
            <span className="sb-option-ic"><Icon n="photo"/></span>
            <span className="sb-option-txt"><b>From a photo</b><span>Matched to your markers</span></span>
          </button>
          <button className="sb-option" onClick={()=>setTool("between")}>
            <span className="sb-option-ic"><Icon n="blend"/></span>
            <span className="sb-option-txt"><b>Between two markers</b><span>The steps that blend them</span></span>
          </button>
        </div>
        <h2 className="sb-label">Saved <span className="sb-muted">· {list.length}</span></h2>
        {list.length===0 && <div className="sb-empty">Nothing saved yet.</div>}
        <div className="sb-pallist">
          {list.map(p=>(
            <button key={p.ts} className="sb-palcard" onClick={()=>setOpen(p.ts)}>
              <span className="sb-strip lg">{(p.colors||[]).slice(0,9).map((c,i)=><span key={i} style={{background:window.hexOf(c.marker)}}/>)}</span>
              <span className="sb-palcard-row"><b>{p.name||p.label||"Palette"}</b><span className="sb-muted sm">{(p.colors||[]).length} markers</span></span>
              {p.note && <span className="sb-muted sm">{p.note}</span>}
            </button>
          ))}
        </div>

        <BackupSection/>
        <Sheet open={!!cur} onClose={()=>setOpen(null)} title={cur?(cur.name||"Palette"):""}>
          {cur && <PaletteDetail p={cur} onRename={n=>setSaved(list.map(x=>x.ts===cur.ts?{...x,name:n}:x))}
            onDelete={()=>{ setSaved(list.filter(x=>x.ts!==cur.ts)); setOpen(null); }} showToast={showToast}/>}
        </Sheet>
        <Sheet open={tool==="vibe"} onClose={()=>setTool(null)} title="Make a palette" tall>
          {tool==="vibe" && <MakeTool onSave={(uids,label)=>save(uids,"Vibe",label+" palette")}/>}
        </Sheet>
        <PhotoTool open={tool==="photo"} onClose={()=>setTool(null)} onSave={uids=>save(uids,"Photo","From a photo")}/>
        <BetweenTool open={tool==="between"} seed={betweenSeed} onClose={()=>{ setTool(null); clearSeed&&clearSeed(); }} onSave={(uids,note)=>save(uids,"Gradient",note)}/>
        <SB.Toast msg={toast}/>
      </div>
    );
  }

  function MakeTool({onSave}){
    const [stock]=window.useStock();
    const start=useMemo(()=>({vibe:"pastel"}),[]);
    return <SB.PaletteTuner stock={stock} mode="vibe" start={start} useLabel="Save palette" onUse={onSave}/>;
  }

  function PaletteDetail({p,onRename,onDelete,showToast}){
    const cols=(p.colors||[]).map(c=>({c,g:groupOf(c.marker.uid)}));
    function copy(){ const t=cols.map(({c,g})=>g?`${codeText(g)} ${g.name}`:`${c.marker.code} ${c.marker.name}`).join("\n");
      try{ navigator.clipboard.writeText(`${p.name}\n${t}`).then(()=>showToast("Copied"),()=>showToast("Couldn’t copy")); }catch{ showToast("Couldn’t copy"); } }
    return (
      <div>
        <label className="sb-field"><span>Name</span><input defaultValue={p.name||""} maxLength={40} onBlur={e=>{ const n=e.target.value.trim(); if(n&&n!==p.name) onRename(n); }}/></label>
        <div className="sb-list">
          {cols.map(({c,g},i)=>(
            <div key={i} className="sb-row static">
              <Chip hex={window.hexOf(c.marker)} size={40}/>
              <span className="sb-row-txt"><b>{g?codeText(g):window.codeLabel(c.marker)}</b><span className="sb-muted sm">{g?g.name:c.marker.name}{c.role&&!/%$/.test(c.role)?` · ${c.role}`:""}</span></span>
            </div>
          ))}
        </div>
        <div className="sb-btnrow">
          <button className="sb-btn sb-btn-line" onClick={copy}><Icon n="copy" size={18}/><span>Copy codes</span></button>
          <button className="sb-btn sb-btn-line danger" onClick={onDelete}><Icon n="trash" size={18}/><span>Delete</span></button>
        </div>
      </div>
    );
  }

  function PhotoTool({open,onClose,onSave}){
    const [stock]=window.useStock();
    const [img,setImg]=useState(null);
    const [n,setN]=useState(6);
    const ref=useRef(null);
    const uids=useMemo(()=>img?SB.extractFromImage(img,stock,n):[],[img,n,stock]);
    useEffect(()=>{ if(open&&!img) setTimeout(()=>ref.current&&ref.current.click(),50); if(!open) setImg(null); },[open]);
    async function onFile(e){ const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return; try{ setImg(await SB.readImageFile(f)); }catch{} }
    return (
      <Sheet open={open} onClose={onClose} title="From a photo" tall>
        <input ref={ref} type="file" accept="image/*" hidden onChange={onFile}/>
        {!img && <button className="sb-emptycard" onClick={()=>ref.current&&ref.current.click()}><Icon n="photo" size={28}/><b>Choose a photo</b><span>Any reference you love</span></button>}
        {img && <>
          <img className="sb-photo" src={img.src} alt="Your reference photo"/>
          <div className="sb-stepper"><span>Colors</span>
            <button onClick={()=>setN(Math.max(3,n-1))} aria-label="Fewer colors">−</button><b>{n}</b><button onClick={()=>setN(Math.min(9,n+1))} aria-label="More colors">+</button>
          </div>
          <div className="sb-list">
            {uids.map(u=>{ const g=groupOf(u); return g && (
              <div key={u} className="sb-row static"><Chip hex={g.hex} size={40}/><span className="sb-row-txt"><b>{codeText(g)}</b><span className="sb-muted sm">{g.name} · {g.brand}</span></span></div>
            ); })}
          </div>
          <div className="sb-btnrow">
            <button className="sb-btn sb-btn-line" onClick={()=>ref.current&&ref.current.click()}>Another photo</button>
            <button className="sb-btn sb-btn-ink" onClick={()=>onSave(uids)} disabled={!uids.length}>Save palette</button>
          </div>
        </>}
      </Sheet>
    );
  }

  function BetweenTool({open,onClose,onSave,seed}){
    const [stock]=window.useStock();
    const [a,setA]=useState(seed||null), [b,setB]=useState(null);
    const [steps,setSteps]=useState(6), [mode,setMode]=useState("around");
    const [pick,setPick]=useState(null);
    useEffect(()=>{ if(seed) setA(seed); },[seed]);
    const pool=useMemo(()=>window.ALL.filter(c=>(stock[c.uid]||"ok")!=="out"||c.uid===a||c.uid===b),[stock,a,b]);
    const res=useMemo(()=>a&&b?CQ.gradient(pool,a,b,{mode,steps}):null,[a,b,mode,steps,pool]);
    const ga=a&&groupOf(a), gb=b&&groupOf(b);
    const End=({g,label,onClick})=>(
      <button className="sb-end" onClick={onClick}>
        {g?<><Chip hex={g.hex} size={34}/><span><b>{g.code}</b><span className="sb-muted sm">{g.name}</span></span></>:<span className="sb-muted">{label}</span>}
      </button>
    );
    return (
      <Sheet open={open} onClose={onClose} title="Between two markers" tall>
        <div className="sb-ends"><End g={ga} label="From…" onClick={()=>setPick("a")}/><Icon n="arrow" size={18}/><End g={gb} label="To…" onClick={()=>setPick("b")}/></div>
        <div className="sb-btnrow" style={{marginTop:12}}>
          <div className="sb-seg" role="group" aria-label="Path">
            <button className={mode==="around"?"on":""} onClick={()=>setMode("around")}>Around wheel</button>
            <button className={mode==="direct"?"on":""} onClick={()=>setMode("direct")}>Shortest</button>
          </div>
          <div className="sb-stepper"><button onClick={()=>setSteps(Math.max(3,steps-1))} aria-label="Fewer steps">−</button><b>{steps}</b><button onClick={()=>setSteps(Math.min(9,steps+1))} aria-label="More steps">+</button></div>
        </div>
        {res && <>
          <div className="sb-ramp">{res.stops.map((s,i)=><span key={i} style={{background:s.marker?s.marker.hex:s.idealHex}}/>)}</div>
          <div className="sb-list">
            {res.stops.map((s,i)=>{ const g=s.marker&&groupOf(s.marker.uid); return g && (
              <div key={i} className="sb-row static"><Chip hex={g.hex} size={36}/><span className="sb-row-txt"><b>{codeText(g)}</b><span className="sb-muted sm">{g.name}{s.off>12&&i>0&&i<res.stops.length-1?" · closest you own":""}</span></span></div>
            ); })}
          </div>
          <button className="sb-btn sb-btn-ink wide" onClick={()=>onSave([...new Set(res.stops.map(s=>s.marker&&s.marker.uid).filter(Boolean))],`${ga.code} → ${gb.code} · ${steps}`)}>Save palette</button>
        </>}
        {!res && <div className="sb-empty">Pick two markers to see the steps between them.</div>}
        <SB.MarkerPicker open={!!pick} onClose={()=>setPick(null)} title={pick==="a"?"From…":"To…"} onPick={g=>{ const u=SB.pickUid(g,stock); pick==="a"?setA(u):setB(u); setPick(null); }}/>
      </Sheet>
    );
  }


  // ---------- backup / restore — same envelope + merge rules as before ----------
  // { app:"swatchbook", v:1, exportedAt, keys:{ every "cq-" localStorage key } }
  const BACKUP_PREFIX="cq-";
  function collectBackup(){
    const keys={};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf(BACKUP_PREFIX)===0){ keys[k]=localStorage.getItem(k); } }
    return {app:"swatchbook",v:1,exportedAt:new Date().toISOString(),keys};
  }
  // real-life photos live in IndexedDB; they ride along in the backup file
  async function withPhotos(env){ try{ env.photos=await SB.PhotoDB.all(); }catch{ env.photos=[]; } return env; }
  async function restorePhotos(env){ for(const r of (Array.isArray(env.photos)?env.photos:[])){ try{ if(r&&r.id&&!(await SB.PhotoDB.get(r.id))) await SB.PhotoDB.put(r); }catch{} } }
  function countIn(env){ const ph=Array.isArray(env.photos)?env.photos.length:0; try{ const s=JSON.parse(env.keys["cq-saved"]||"[]"); const pg=JSON.parse(env.keys["cq-pages"]||"[]"); return {pals:Array.isArray(s)?s.length:0,pages:Array.isArray(pg)?pg.length:0,photos:ph}; }catch{ return {pals:0,pages:0,photos:ph}; } }
  function mergeArr(cur,inc,keyOf){ const out=Array.isArray(cur)?cur.slice():[]; const seen=new Set(out.map(keyOf)); (Array.isArray(inc)?inc:[]).forEach(x=>{ const k=keyOf(x); if(!seen.has(k)){ seen.add(k); out.push(x); } }); return out; }
  function restoreBackup(env,mode){
    if(!env||env.app!=="swatchbook"||!env.keys) throw new Error("not a swatchbook backup");
    if(mode==="replace"){ Object.entries(env.keys).forEach(([k,v])=>{ if(v!=null) localStorage.setItem(k,v); }); return; }
    const parse=(s,f)=>{ try{ return JSON.parse(s); }catch{ return f; } };
    const readLS=(k,f)=>parse(localStorage.getItem(k),f);
    const inc=k=>parse(env.keys[k],null);
    const sigOf=p=>(p&&(p.sig||(p.colors||[]).map(c=>c&&c.marker&&(c.marker.uid||c.marker.code)).filter(Boolean).sort().join("|")))||JSON.stringify(p);
    if(env.keys["cq-saved"]!=null)       localStorage.setItem("cq-saved",JSON.stringify(mergeArr(readLS("cq-saved",[]),inc("cq-saved"),sigOf).slice(0,60)));
    if(env.keys["cq-saved-ideas"]!=null) localStorage.setItem("cq-saved-ideas",JSON.stringify(mergeArr(readLS("cq-saved-ideas",[]),inc("cq-saved-ideas"),x=>x&&(x.id||x.title))));
    if(env.keys["cq-pages"]!=null)       localStorage.setItem("cq-pages",JSON.stringify(mergeArr(readLS("cq-pages",[]),inc("cq-pages"),x=>x&&(x.id||x.ts||JSON.stringify(x)))));
    if(env.keys["cq-favs"]!=null)        localStorage.setItem("cq-favs",JSON.stringify(mergeArr(readLS("cq-favs",[]),inc("cq-favs"),x=>x&&(x.shape||JSON.stringify(x)))));
    Object.entries(env.keys).forEach(([k,v])=>{ if(v!=null && localStorage.getItem(k)==null) localStorage.setItem(k,v); });
  }
  function BackupSection(){
    const [pending,setPending]=useState(null);
    const [msg,setMsg]=useState("");
    const ref=useRef(null);
    async function doExport(){
      const env=await withPhotos(collectBackup()); const c=countIn(env);
      const blob=new Blob([JSON.stringify(env,null,2)],{type:"application/json"});
      const file=new File([blob],`swatchbook-backup-${env.exportedAt.slice(0,10)}.json`,{type:"application/json"});
      try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Swatch Book backup"}); setMsg(`Backed up ${c.pals} palettes, ${c.pages} pages${c.photos?`, ${c.photos} photos`:""}`); return; } }
      catch(e){ if(e&&e.name==="AbortError") return; }
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0); setMsg(`Downloaded — ${c.pals} palettes, ${c.pages} pages${c.photos?`, ${c.photos} photos`:""}`);
    }
    async function onFile(e){
      const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
      try{ const env=JSON.parse(await f.text()); if(env.app!=="swatchbook"||!env.keys) throw 0; setPending(env); setMsg(""); }
      catch{ setPending(null); setMsg("That file isn’t a Swatch Book backup."); }
    }
    const finish=async mode=>{ try{ restoreBackup(pending,mode); await restorePhotos(pending); location.reload(); }catch(err){ setMsg("Restore failed: "+(err.message||err)); } };
    const used=SB.storageUse(), mb=(used*2/1048576);
    const c=pending?countIn(pending):null;
    return (
      <section className="sb-backup">
        <h2 className="sb-label">Backup</h2>
        <input ref={ref} type="file" accept="application/json,.json" hidden onChange={onFile}/>
        <div className="sb-btnrow" style={{marginTop:0}}>
          <button className="sb-btn sb-btn-line" onClick={doExport}><Icon n="share" size={18}/><span>Export backup</span></button>
          <button className="sb-btn sb-btn-line" onClick={()=>ref.current&&ref.current.click()}><Icon n="copy" size={18}/><span>Restore…</span></button>
        </div>
        {pending && <div className="sb-restore">
          <span>Found {c.pals} palettes, {c.pages} pages{c.photos?` and ${c.photos} photos`:""}. The app will reload.</span>
          <div className="sb-btnrow">
            <button className="sb-btn sb-btn-ink" onClick={()=>finish("merge")}>Merge in</button>
            <button className="sb-btn sb-btn-line" onClick={()=>{ if(window.confirm("Replace everything saved here with this backup?")) finish("replace"); }}>Replace all</button>
          </div>
        </div>}
        {msg && <p className="sb-muted sm">{msg}</p>}
        <p className="sb-muted sm">Pages &amp; palettes use about {mb.toFixed(1)} MB of this device’s ~5 MB app storage{mb>3.5?" — getting full: export a backup and clear out pages you don’t need.":"."} Real-life photos are stored separately.</p>
      </section>
    );
  }

  window.PalettesScreenV2 = PalettesScreen;
})();
