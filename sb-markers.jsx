// ============================================================================
// swatchbook v2 — Markers: every ink you own as a swatch grid (same-ink copies
// merged with a ×2 badge), long-press to mark low / out, a Restock list that
// replaces the paper notepad, and a detail sheet with shading recs.
// Stock lives in "cq-stock" keyed by each physical marker's uid (unchanged).
// ============================================================================
(function(){
  const { useState, useMemo } = React;
  const SB = window.SB, CQ = window.CQ;
  const { Icon, Sheet, Chip, GROUPS, codeText, groupStatus } = SB;
  const NEXT = {ok:"low", low:"out", out:"ok"};

  function MarkersScreen({onBlend}){
    const [stock,setStockFor]=window.useStock();
    const [q,setQ]=useState("");
    const [filter,setFilter]=window.useLocal("sb-mk-filter","all");
    const [detail,setDetail]=useState(null);
    const [toast,showToast]=SB.useToast();

    const restock=GROUPS.filter(g=>groupStatus(g,stock));
    const sets=window.SETS.map(s=>[s.id,s.short]);
    const t=q.trim().toLowerCase();
    const list=useMemo(()=>{
      let l=GROUPS;
      if(filter==="restock") l=l.filter(g=>groupStatus(g,stock));
      else if(filter!=="all") l=l.filter(g=>g.members.some(c=>c.setId===filter));
      if(t) l=l.filter(g=>(g.code+" "+g.old+" "+g.name+" "+g.oldName+" "+g.brand).toLowerCase().includes(t));
      return l;
    },[filter,t,stock]);
    const sections=useMemo(()=>{
      if(t||filter==="restock") return [{key:"all",label:null,items:list.slice().sort((a,b)=>b._lch[0]-a._lch[0])}];
      return CQ.FAMILY_ORDER.map(f=>({key:f,label:CQ.FAMILY_LABEL[f],items:list.filter(g=>g.family===f).sort((a,b)=>b._lch[0]-a._lch[0])})).filter(s=>s.items.length);
    },[list,t,filter]);

    function cycle(g){
      if(g.members.length>1){ setDetail(g); return; }
      const u=g.members[0].uid; const nx=NEXT[stock[u]||"ok"]; setStockFor(u,nx);
      showToast(nx==="ok"?`${g.code} back in stock`:`${g.code} marked ${nx}`);
    }
    function copyRestock(){
      const txt=restock.map(g=>{ const bad=g.members.filter(c=>stock[c.uid]&&stock[c.uid]!=="ok");
        return `${codeText(g)} ${g.name} — ${bad.map(c=>`${stock[c.uid]} (${c.setName})`).join(", ")}`; }).join("\n");
      try{ navigator.clipboard.writeText(txt).then(()=>showToast("Copied — paste it into your notes"),()=>showToast("Couldn’t copy")); }catch{ showToast("Couldn’t copy"); }
    }

    return (
      <div className="sb-screen">
        <header className="sb-head">
          <h1 className="sb-h1">Markers</h1>
          <span className="sb-muted sm">{window.ALL.length} markers · {sets.length} sets</span>
        </header>
        <label className="sb-search"><Icon n="search" size={18}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Code, old code or name" aria-label="Search markers"/>
          {q && <button className="sb-clear" onClick={()=>setQ("")} aria-label="Clear search"><Icon n="close" size={16}/></button>}
        </label>
        <div className="sb-filters" role="tablist" aria-label="Filter">
          <button className={"sb-fchip"+(filter==="all"?" on":"")} onClick={()=>setFilter("all")}>All</button>
          <button className={"sb-fchip"+(filter==="restock"?" on":"")} onClick={()=>setFilter("restock")}>Restock{restock.length>0&&<span className="sb-count"> · {restock.length}</span>}</button>
          {sets.map(([id,lbl])=><button key={id} className={"sb-fchip"+(filter===id?" on":"")} onClick={()=>setFilter(id)}>{lbl}</button>)}
        </div>

        {filter==="restock" ? (
          <div className="sb-restock">
            {restock.length===0 && <div className="sb-empty">Nothing running low. Long-press a swatch to mark it low or out.</div>}
            {restock.length>0 && <button className="sb-btn sb-btn-line" onClick={copyRestock}><Icon n="copy" size={18}/><span>Copy restock list</span></button>}
            {list.map(g=>(
              <button key={g.key} className="sb-row" onClick={()=>setDetail(g)}>
                <Chip hex={g.hex} size={38} status={groupStatus(g,stock)}/>
                <span className="sb-row-txt"><b>{codeText(g)}</b><span className="sb-muted sm">{g.name} · {g.members.filter(c=>stock[c.uid]&&stock[c.uid]!=="ok").map(c=>`${stock[c.uid]} in ${c.setName}`).join(", ")}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {sections.map(sec=>(
              <section key={sec.key}>
                {sec.label && <h2 className="sb-label">{sec.label} <span className="sb-muted">· {sec.items.length}</span></h2>}
                <div className="sb-grid">
                  {sec.items.map(g=><Tile key={g.key} g={g} status={groupStatus(g,stock)} onTap={()=>setDetail(g)} onLong={()=>cycle(g)}/>)}
                </div>
              </section>
            ))}
            {list.length===0 && <div className="sb-empty">No marker matches “{q}”.</div>}
            <p className="sb-hint">Long-press a swatch to mark it low or out.</p>
          </>
        )}

        <Sheet open={!!detail} onClose={()=>setDetail(null)} title={detail?codeText(detail):""}>
          {detail && <MarkerDetail g={detail} stock={stock} setStockFor={setStockFor} onOpen={g=>setDetail(g)} onBlend={()=>{ setDetail(null); onBlend&&onBlend(SB.pickUid(detail,stock)); }}/>}
        </Sheet>
        <SB.Toast msg={toast}/>
      </div>
    );
  }

  function Tile({g,status,onTap,onLong}){
    const lp=SB.useLongPress(onLong,onTap);
    return (
      <button className="sb-tile" aria-label={`${codeText(g)} ${g.name}${status?`, ${status}`:""}`} {...lp}>
        <span className={"sb-tile-sw"+(status==="out"?" dim":"")} style={{background:g.hex}}>
          {status && <span className={"sb-dot "+status}/>}
          {g.members.length>1 && <span className="sb-badge">×{g.members.length}</span>}
        </span>
        <span className="sb-tile-code">{g.code}</span>
        <span className="sb-tile-old">{g.brand==="SFAIH"?"SFAIH":(g.old||"\u00a0")}</span>
      </button>
    );
  }

  function MarkerDetail({g,stock,setStockFor,onOpen,onBlend}){
    return (
      <div>
        <div className="sb-md-top">
          <span className="sb-md-sw" style={{background:g.hex}}/>
          <div className="sb-md-txt">
            <b className="sb-md-name">{g.name}</b>
            {g.brand==="SFAIH"
              ? (g.old && <span className="sb-muted">Matches Ohuhu {g.old}{g.oldName?` ${g.oldName}`:""}</span>)
              : (g.oldName && g.oldName!==g.name && <span className="sb-muted">was {g.old} {g.oldName}</span>)}
            <span className="sb-muted sm">{g.brand==="SFAIH"?"SFAIH Pastel":g.brand}</span>
          </div>
        </div>
        <div className="sb-label">Your {g.members.length>1?"copies":"marker"}</div>
        {g.members.map(c=>{ const cur=stock[c.uid]||"ok";
          return (
            <div key={c.uid} className="sb-copy">
              <span>{c.setName}</span>
              <div className="sb-seg" role="group" aria-label={`Stock for ${c.setName}`}>
                {["ok","low","out"].map(s=><button key={s} className={(cur===s?"on ":"")+s} onClick={()=>setStockFor(c.uid,s)}>{s==="ok"?"Stocked":s==="low"?"Low":"Out"}</button>)}
              </div>
            </div>
          ); })}
        <SB.ShadeCard group={g} onUse={x=>onOpen(x)} useLabel="Open" hideBase/>
        <button className="sb-btn sb-btn-line wide" onClick={onBlend}><Icon n="blend" size={18}/><span>Blend from this marker</span></button>
      </div>
    );
  }

  window.MarkersScreenV2 = MarkersScreen;
})();
