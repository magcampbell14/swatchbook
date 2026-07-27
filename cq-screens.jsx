// ============================================================================
// colorqueue — screens. Library / Bridge / Builder / Learn / Prompts + sheets.
// ============================================================================
const CQ = window.CQ;
function labDist(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);}
function nearestTo(color,n=4){
  return ALL.filter(c=>c.uid!==color.uid)
    .map(c=>({c,d:labDist(c._lab,color._lab)})).sort((a,b)=>a.d-b.d).slice(0,n).map(x=>x.c);
}
function randTip(type){const a=(window.TIPS.material[type]||[]);return a[Math.floor(Math.random()*a.length)];}

// ---------------- Color detail sheet ----------------
function ColorSheet({color,onClose,onBridge,onBuilder}){
  const near=useMemo(()=>color?nearestTo(color,5):[],[color]);
  const tip=useMemo(()=>color?randTip(color.type):"",[color]);
  const [stock,setStockFor]=window.useStock();
  if(!color) return null;
  const mt=window.MATERIAL_TYPES[color.type]||{};
  const L=Math.round(color._lch[0]);
  const cur=stock[color.uid]||"ok";
  return (
    <Sheet open={!!color} onClose={onClose} title="color">
      <div className="cs-top">
        <div className="cs-bigswatch" style={{background:color.hex}}/>
        <div className="cs-meta">
          <div className="cs-code">{color.code}</div>
          <div className="cs-name">{color.name}</div>
          <div className="cs-tags">
            <span className="tag">{TYPE_GLYPH[color.type]||"●"} {mt.short||color.type}</span>
            <span className="tag ghost">{color.setName}</span>
          </div>
          <div className="cs-value">
            <span className="muted">value</span>
            <div className="vbar"><div className="vfill" style={{width:L+"%"}}/></div>
            <span className="muted">{L}</span>
          </div>
        </div>
      </div>
      <div className="stock-row">
        <span className="muted sm">in your kit</span>
        <div className="seg stock-seg">
          <button className={cur==="ok"?"active":""} onClick={()=>setStockFor(color.uid,"ok")}>Stocked</button>
          <button className={"on-low"+(cur==="low"?" active":"")} onClick={()=>setStockFor(color.uid,"low")}>Low</button>
          <button className={"on-out"+(cur==="out"?" active":"")} onClick={()=>setStockFor(color.uid,"out")}>Out</button>
        </div>
      </div>
      <div className="tip-card">
        <div className="tip-t">💡 {mt.label} tip</div>
        <div className="tip-b">{tip}</div>
      </div>
      <div className="cs-near">
        <div className="muted sm" style={{marginBottom:8}}>closest colors you own</div>
        <div className="row" style={{gap:8}}>
          {near.map(c=>(
            <div key={c.uid} className="near-col">
              <Dot hex={c.hex} size={36} stock={stock[c.uid]} title={`${c.code} · ${c.name}`}/>
              <div className="near-code">{c.code}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="cs-actions">
        <button className="btn btn-accent" onClick={()=>onBridge(color.uid)}><span className="btn-ico">⇄ Blend from this</span></button>
        <button className="btn btn-ghost" onClick={()=>onBuilder(color.uid)}><span className="btn-ico">✦ Build with this</span></button>
      </div>
    </Sheet>
  );
}

// ---------------- LIBRARY ----------------
function LibTile({c,stock,showSet,onClick}){
  const st=stock&&stock[c.uid];
  return (
    <button className={"lib-tile"+(st?" "+st:"")} onClick={onClick}>
      <span className="lib-tile-sw" style={{background:c.hex}}/>
      <span className="lib-tile-meta">
        <span className="lib-tile-code">{c.code}</span>
        <span className="lib-tile-name">{c.name}</span>
      </span>
      <span className="lib-tile-right">
        {st&&<span className={"lib-tile-stock "+st}>{st}</span>}
        {showSet&&<span className="lib-tile-set">{c.setName}</span>}
      </span>
    </button>
  );
}
const SORT_LABEL={family:"Family",value:"Lightest → darkest",hue:"Around the wheel"};
function LibraryScreen({onBridge,onBuilder}){
  const [setId,setSetId]=useState("all");
  const [active,setActive]=useState(null);
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState("family");        // family | value | hue
  const [stockOnly,setStockOnly]=useState(false);  // show only low/out
  const [stock]=window.useStock();
  const showFin = setId==="finishing";

  const base=useMemo(()=>showFin?[]:filterColors(setId,"all"),[setId,showFin]);
  const q=query.trim().toLowerCase();
  const filtered=useMemo(()=>{
    let l=base;
    if(q) l=l.filter(c=>(c.code+" "+c.name+" "+c.setName).toLowerCase().includes(q));
    if(stockOnly) l=l.filter(c=>stock[c.uid]);
    return l;
  },[base,q,stockOnly,stock]);

  const useFlat = q!=="" || stockOnly || sort!=="family";
  const flat=useMemo(()=>{
    const l=filtered.slice();
    if(sort==="hue") l.sort((a,b)=>{
      const na=a._lch[1]<11, nb=b._lch[1]<11;            // neutrals to the end
      if(na!==nb) return na?1:-1;
      return a._lch[2]-b._lch[2];
    });
    else l.sort((a,b)=>b._lch[0]-a._lch[0]);             // value (also the friendliest order for search)
    return l;
  },[filtered,sort]);
  const groups=useMemo(()=>window.CQ.families(filtered),[filtered]);
  const total=showFin?FIN.length:filtered.length;
  const lowCount=base.filter(c=>stock[c.uid]).length;

  return (
    <div className="screen">
      <div className="scr-eyebrow">your colors</div>
      <h1 className="scr-title">Library</h1>
      <div className="scr-sub">{total} {showFin?"finishing tools":(q||stockOnly?"matches":"colors")} · tap any to learn it</div>

      {!showFin && (
        <div className="search-row">
          <Icon name="search" size={16}/>
          <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="search a code or name…" autoComplete="off" autoCapitalize="off" spellCheck="false"/>
          {query && <button className="search-clear" onClick={()=>setQuery("")} aria-label="clear search"><Icon name="close" size={14} stroke={2.4}/></button>}
        </div>
      )}

      <div className="filter-row" style={{marginTop:showFin?14:10}}>
        {SET_FILTERS.map(([v,l])=>(
          <button key={v} className={"pill sm ghost"+(setId===v?" on":"")} onClick={()=>setSetId(v)}>{l}</button>
        ))}
        <button className={"pill sm ghost"+(showFin?" on":"")} onClick={()=>setSetId("finishing")}>✦ Finishing</button>
      </div>

      {!showFin && (
        <div className="row" style={{gap:10,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
          <div className="seg">
            <button className={sort==="family"?"active":""} onClick={()=>setSort("family")}>Family</button>
            <button className={sort==="value"?"active":""} onClick={()=>setSort("value")}>Value</button>
            <button className={sort==="hue"?"active":""} onClick={()=>setSort("hue")}>Hue</button>
          </div>
          {lowCount>0 && (
            <button className={"pill sm ghost"+(stockOnly?" on":"")} onClick={()=>setStockOnly(!stockOnly)}>
              <span className="btn-ico"><Icon name="drop" size={13} fill="currentColor" stroke={2}/>low / out · {lowCount}</span>
            </button>
          )}
        </div>
      )}

      {showFin ? (
        <div className="fin-list">
          {FIN.map(f=>(
            <div className="fin-row" key={f.uid}>
              <span className="fin-sw" style={{background:f.hex}}/>
              <div className="fin-meta"><div className="fin-name">{f.name}</div><div className="muted sm">{f.kind} · {f.role}</div></div>
            </div>
          ))}
          <div className="tip-card" style={{marginTop:12}}>
            <div className="tip-t">💡 when to reach for white</div>
            <div className="tip-b">Save opaque whites for the very end — tiny sparkle highlights on the brightest edge, after everything else is done.</div>
          </div>
        </div>
      ) : useFlat ? (
        filtered.length===0
          ? <div className="empty big">{q?<>no colours match “{query}”</>:"nothing flagged low or out yet"}</div>
          : <div className="fam" style={{marginTop:16}}>
              <div className="fam-label">{SORT_LABEL[sort]} <span className="muted">· {flat.length}</span></div>
              <div className="lib-list">
                {flat.map(c=>(
                  <LibTile key={c.uid} c={c} stock={stock} showSet={setId==="all"} onClick={()=>setActive(c)}/>
                ))}
              </div>
            </div>
      ) : (
        <div className="lib-groups">
          {groups.map(g=>(
            <div className="fam" key={g.key}>
              <div className="fam-label">{g.label} <span className="muted">· {g.colors.length}</span></div>
              <div className="lib-list">
                {g.colors.map(c=>(
                  <LibTile key={c.uid} c={c} stock={stock} showSet={setId==="all"} onClick={()=>setActive(c)}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ColorSheet color={active} onClose={()=>setActive(null)}
        onBridge={uid=>{setActive(null);onBridge(uid);}}
        onBuilder={uid=>{setActive(null);onBuilder(uid);}}/>
    </div>
  );
}

// ---------------- LEARN ----------------
// LearnScreen now lives in src/cq-learn.jsx (Mixing / Materials / Theory).

// ---------------- PROMPTS ----------------
function PromptsScreen(){
  const [mode,setMode]=useState("random");
  const stamp=dayStamp();
  const [prompt,setPrompt]=useState(()=>STORAGE.get("cq-prompt",null)||pickRandom(window.PROMPTS));
  const daily=useMemo(()=>seededPick(window.PROMPTS,stamp+"-p"),[stamp]);
  const [favs,setFavs]=useLocal("cq-favs",[]);
  const cur=mode==="daily"?daily:prompt;
  useEffect(()=>{if(mode==="random")STORAGE.set("cq-prompt",prompt);},[prompt,mode]);
  const svg=useMemo(()=>window.Sketch.render(cur.shape,"medium"),[cur.shape]);
  const isFav=favs.some(f=>f.shape===cur.shape);

  return (
    <div className="screen">
      <div className="scr-eyebrow">go practice</div>
      <h1 className="scr-title">Prompts</h1>
      <div className="scr-sub">A little thing to draw — then take a palette to it.</div>

      {window.AskBar && <window.AskBar/>}

      <div className="seg wide-seg" style={{marginTop:14}}>
        <button className={mode==="random"?"active":""} onClick={()=>setMode("random")}>Random</button>
        <button className={mode==="daily"?"active":""} onClick={()=>setMode("daily")}>Today’s</button>
      </div>

      <div className="card prompt-card">
        <div className="prompt-sketch" dangerouslySetInnerHTML={{__html:svg}}/>
        <div className="cat">✿ {window.CATEGORIES[cur.cat]}</div>
        <div className="prompt-text">{cur.text}</div>
        <div className="row" style={{gap:10,marginTop:14,flexWrap:"wrap"}}>
          {mode==="random" && <button className="btn btn-accent sm" onClick={()=>setPrompt(pickRandom(window.PROMPTS,p=>p.shape!==prompt.shape))}>↻ new prompt</button>}
          <button className={"btn btn-ghost sm"+(isFav?" ok":"")} onClick={()=>isFav?setFavs(favs.filter(f=>f.shape!==cur.shape)):setFavs([...favs,{...cur,ts:Date.now()}])}>{isFav?"♥ saved":"♡ save"}</button>
        </div>
      </div>

      {mode==="daily" && <div className="muted sm" style={{textAlign:"center",marginTop:14}}>~ same for everyone, changes at midnight ~</div>}

      {favs.length>0 && (
        <>
          <div className="lbl">saved prompts</div>
          <div className="fav-grid">
            {favs.map((f,i)=>(
              <div className="fav-mini" key={i} onClick={()=>{setMode("random");setPrompt(f);}}>
                <div className="fav-sketch" dangerouslySetInnerHTML={{__html:window.Sketch.render(f.shape,"medium")}}/>
                <button className="fav-x" onClick={e=>{e.stopPropagation();setFavs(favs.filter(x=>x.shape!==f.shape));}}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- SAVED library sheet (palettes + ideas) ----------------
// ---------------- backup: export / import the whole swatchbook library ----------------
// Backs up EVERY localStorage key that starts with "cq-" (saved palettes live in
// cq-saved, ideas in cq-saved-ideas, pages in cq-pages, favs in cq-favs, stock in cq-stock).
// iOS can evict localStorage under storage pressure, so this is the safety net.
const BACKUP_PREFIX="cq-";
function collectBackup(){
  const keys={};
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf(BACKUP_PREFIX)===0){ keys[k]=localStorage.getItem(k); } }
  return {app:"swatchbook",v:1,exportedAt:new Date().toISOString(),keys};
}
function countIn(env){ try{ const s=JSON.parse(env.keys["cq-saved"]||"[]"); const ideas=JSON.parse(env.keys["cq-saved-ideas"]||"[]"); return {pals:Array.isArray(s)?s.length:0,ideas:Array.isArray(ideas)?ideas.length:0}; }catch{ return {pals:0,ideas:0}; } }
function mergeArr(cur,inc,keyOf){ const out=Array.isArray(cur)?cur.slice():[]; const seen=new Set(out.map(keyOf)); (Array.isArray(inc)?inc:[]).forEach(x=>{ const k=keyOf(x); if(!seen.has(k)){ seen.add(k); out.push(x); } }); return out; }
function restoreBackup(env,mode){
  if(!env||env.app!=="swatchbook"||!env.keys) throw new Error("not a swatchbook backup");
  if(mode==="replace"){
    Object.entries(env.keys).forEach(([k,v])=>{ if(v!=null) localStorage.setItem(k,v); });
  } else { // merge — never drop what's already here
    const parse=(s,f)=>{ try{ return JSON.parse(s); }catch{ return f; } };
    const readLS=(k,f)=>parse(localStorage.getItem(k),f);
    const inc=k=>parse(env.keys[k],null);
    const sigOf=p=>(p&&(p.sig||(p.colors||[]).map(c=>c&&c.marker&&(c.marker.uid||c.marker.code)).filter(Boolean).sort().join("|")))||JSON.stringify(p);
    if(env.keys["cq-saved"]!=null)       localStorage.setItem("cq-saved",JSON.stringify(mergeArr(readLS("cq-saved",[]),inc("cq-saved"),sigOf).slice(0,60)));
    if(env.keys["cq-saved-ideas"]!=null) localStorage.setItem("cq-saved-ideas",JSON.stringify(mergeArr(readLS("cq-saved-ideas",[]),inc("cq-saved-ideas"),x=>x&&(x.id||x.title))));
    if(env.keys["cq-pages"]!=null)       localStorage.setItem("cq-pages",JSON.stringify(mergeArr(readLS("cq-pages",[]),inc("cq-pages"),x=>x&&(x.id||x.ts||JSON.stringify(x)))));
    if(env.keys["cq-favs"]!=null)        localStorage.setItem("cq-favs",JSON.stringify(mergeArr(readLS("cq-favs",[]),inc("cq-favs"),x=>x&&(x.shape||JSON.stringify(x)))));
    // settings-ish keys: only fill in ones we don't already have
    Object.entries(env.keys).forEach(([k,v])=>{ if(v!=null && localStorage.getItem(k)==null) localStorage.setItem(k,v); });
  }
}
function BackupPanel(){
  const [open,setOpen]=useState(false);
  const [text,setText]=useState("");
  const [msg,setMsg]=useState("");
  const [pending,setPending]=useState(null); // parsed envelope awaiting a restore choice
  const doExport=()=>{ const env=collectBackup(); const json=JSON.stringify(env,null,2); const c=countIn(env);
    const blob=new Blob([json],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`swatchbook-backup-${env.exportedAt.slice(0,10)}.json`; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);
    setMsg(`downloaded — ${c.pals} palette${c.pals===1?"":"s"}, ${c.ideas} idea${c.ideas===1?"":"s"}`); };
  const doCopy=async()=>{ const json=JSON.stringify(collectBackup(),null,2);
    try{ await navigator.clipboard.writeText(json); setMsg("copied to clipboard ✦"); }
    catch{ setText(json); setMsg("select the text above and copy it"); } };
  const parsePending=()=>{ try{ const env=JSON.parse(text.trim()); if(env.app!=="swatchbook"||!env.keys) throw 0; setPending(env); setMsg(""); }
    catch{ setPending(null); setMsg("that doesn't look like a swatchbook backup"); } };
  const finish=(mode)=>{ try{ restoreBackup(pending,mode); location.reload(); }catch(e){ setMsg("restore failed: "+(e.message||e)); } };
  if(!open) return (
    <div className="backup-foot">
      <button className="btn btn-ghost sm wide" onClick={()=>{setOpen(true);setMsg("");}}><span className="btn-ico"><Icon name="bookmark" size={15}/>back up · export / import</span></button>
      <div className="muted sm" style={{textAlign:"center",marginTop:6}}>keep a copy — iOS can clear storage on its own</div>
    </div>
  );
  const c=pending?countIn(pending):null;
  return (
    <div className="backup-foot open">
      <div className="row" style={{justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="saved-label">back up your library</div>
        <button className="btn btn-ghost sm" onClick={()=>{setOpen(false);setText("");setPending(null);setMsg("");}}>done</button>
      </div>
      <div className="muted sm" style={{marginBottom:8}}>export saves a JSON file of every palette, idea &amp; page. import brings them back on a new device or after a storage wipe.</div>
      <div className="row" style={{gap:8,marginBottom:12}}>
        <button className="btn btn-accent" style={{flex:1}} onClick={doExport}><span className="btn-ico"><Icon name="down" size={15}/>download</span></button>
        <button className="btn btn-ghost" style={{flex:1}} onClick={doCopy}><span className="btn-ico"><Icon name="edit" size={15}/>copy</span></button>
      </div>
      <div className="muted sm" style={{marginBottom:6}}>restore — paste a backup below:</div>
      <textarea className="text-field" style={{minHeight:70,fontFamily:"monospace",fontSize:12}} value={text}
        onChange={e=>{setText(e.target.value);setPending(null);}} placeholder='{"app":"swatchbook", ...}'/>
      {!pending
        ? <button className="btn btn-ghost sm wide" style={{marginTop:8}} disabled={!text.trim()} onClick={parsePending}>check this backup</button>
        : <div style={{marginTop:8}}>
            <div className="muted sm" style={{marginBottom:8}}>found {c.pals} palette{c.pals===1?"":"s"} &amp; {c.ideas} idea{c.ideas===1?"":"s"}. the app will reload.</div>
            <div className="row" style={{gap:8}}>
              <button className="btn btn-accent" style={{flex:1}} onClick={()=>finish("merge")}>merge in</button>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{ if(window.confirm("Replace everything currently saved with this backup?")) finish("replace"); }}>replace all</button>
            </div>
          </div>}
      {msg && <div className="muted sm" style={{marginTop:8,color:"var(--accent)"}}>{msg}</div>}
    </div>
  );
}

function SavedSheet({open,onClose}){
  const [saved,setSavedPalettes]=useLocal("cq-saved",[]);
  const [ideas,setSavedIdeas]=useLocal("cq-saved-ideas",[]);
  const [tab,setTab]=useState("palettes");
  const [editing,setEditing]=useState(null); // {kind:'pal'|'idea',i}
  const [draft,setDraft]=useState("");
  const [palEdit,setPalEdit]=useState(null);   // index of palette whose colours we're editing
  const [addOpen,setAddOpen]=useState(false);  // colour-picker for adding to a palette
  const list=Array.isArray(saved)?saved:[];
  const ideaList=Array.isArray(ideas)?ideas:[];

  const move=(arr,setter,i,d)=>{ const j=i+d; if(j<0||j>=arr.length)return; const n=arr.slice(); const t=n[i]; n[i]=n[j]; n[j]=t; setter(n); };
  // ---- edit the colours inside one saved palette ----
  const updatePal=(i,cols)=>{ const n=list.slice(); if(!n[i])return; n[i]={...n[i],colors:cols,sig:paletteSig(cols)}; setSavedPalettes(n); };
  const moveColor=(i,ci,d)=>{ const cols=list[i].colors.slice(); const j=ci+d; if(j<0||j>=cols.length)return; const t=cols[ci];cols[ci]=cols[j];cols[j]=t; updatePal(i,cols); };
  const removeColor=(i,ci)=>{ const cols=list[i].colors.filter((_,k)=>k!==ci); if(!cols.length)return; updatePal(i,cols); };
  const addColor=(i,uid)=>{ const c=CQ.find(ALL,uid)||FIN.find(f=>f.uid===uid); if(!c)return; const cols=list[i].colors.slice(); if(cols.some(x=>x.marker.uid===c.uid))return; cols.push({marker:{uid:c.uid,code:c.code,name:c.name,hex:c.hex,setName:c.setName,type:c.type},role:""}); updatePal(i,cols); };
  const startEdit=(kind,i,cur)=>{ setEditing({kind,i}); setDraft(cur||""); };
  const commit=()=>{
    if(!editing) return;
    const t=draft.trim();
    if(editing.kind==="pal"){ const n=list.slice(); if(n[editing.i]) n[editing.i]={...n[editing.i],name:t||n[editing.i].name||n[editing.i].label}; setSavedPalettes(n); }
    else { const n=ideaList.slice(); if(n[editing.i]) n[editing.i]={...n[editing.i],title:t||n[editing.i].title}; setSavedIdeas(n); }
    setEditing(null);
  };

  return (
    <Sheet open={open} onClose={()=>{setEditing(null);setPalEdit(null);onClose();}} title={palEdit!=null?"edit colours":"your library"}>
      {palEdit!=null && list[palEdit] ? (
        // ---- palette colour editor ----
        (()=>{ const p=list[palEdit]; const cols=p.colors;
          return (<>
            <button className="btn btn-ghost sm" onClick={()=>setPalEdit(null)} style={{marginBottom:12}}>‹ done</button>
            <div className="saved-label" style={{marginBottom:2}}>{(p.name||p.label)}</div>
            <div className="muted sm" style={{marginBottom:12}}>reorder with ↑↓ · tap × to remove · add more below</div>
            <div className="saved-list">
              {cols.map((c,ci)=>(
                <div className="pg-used-row" key={c.marker.uid||ci}>
                  <span className="pg-used-sw" style={{background:c.marker.hex}}/>
                  <div className="pg-used-meta">
                    <div className="pg-used-top"><b>{c.marker.code}</b> <span className="muted">{c.marker.name}</span></div>
                    <div className="pg-used-bot"><span className="tag ghost">{c.marker.setName}</span>{c.role&&<span className="ref-pal-role" style={{marginLeft:8}}>{c.role}</span>}</div>
                  </div>
                  <div className="saved-acts">
                    <button onClick={()=>moveColor(palEdit,ci,-1)} disabled={ci===0} aria-label="move up"><Icon name="up" size={16}/></button>
                    <button onClick={()=>moveColor(palEdit,ci,1)} disabled={ci===cols.length-1} aria-label="move down"><Icon name="down" size={16}/></button>
                    <button className="danger" onClick={()=>removeColor(palEdit,ci)} disabled={cols.length<=1} aria-label="remove"><Icon name="close" size={15} stroke={2.4}/></button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-accent wide" onClick={()=>setAddOpen(true)}><span className="btn-ico"><Icon name="plus" size={16}/>add a colour</span></button>
            <Sheet open={addOpen} onClose={()=>setAddOpen(false)} title="add a colour you own">
              <ColorPicker selected={cols.map(c=>c.marker.uid)} onPick={uid=>{addColor(palEdit,uid);}} multi/>
            </Sheet>
          </>);
        })()
      ) : (<>
      <div className="seg wide-seg" style={{marginBottom:14}}>
        <button className={tab==="palettes"?"active":""} onClick={()=>setTab("palettes")}>Palettes · {list.length}</button>
        <button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas · {ideaList.length}</button>
      </div>

      {tab==="palettes" && (<>
        {list.length===0 && <div className="empty">save palettes from the Palettes tab ✦</div>}
        {list.length>0 && <div className="muted sm" style={{marginBottom:10}}>tap ✎ to rename · ⋯ to edit colours{list.length>1?" · ↑↓ to reorder":""}</div>}
        <div className="saved-list">
          {list.map((p,i)=>(
            <div className="saved-item" key={p.ts||i}>
              <div className="saved-top">
                {editing&&editing.kind==="pal"&&editing.i===i
                  ? <input className="text-field sm" autoFocus value={draft} maxLength={28}
                      onChange={e=>setDraft(e.target.value)} onBlur={commit}
                      onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(null);}}/>
                  : <div className="saved-label">{(p.kind&&(p.name||p.kind!==p.label))&&<span className="saved-kind">{p.kind}</span>}{p.name||p.label}</div>}
                <div className="saved-acts">
                  <button onClick={()=>move(list,setSavedPalettes,i,-1)} disabled={i===0} aria-label="move up"><Icon name="up" size={16}/></button>
                  <button onClick={()=>move(list,setSavedPalettes,i,1)} disabled={i===list.length-1} aria-label="move down"><Icon name="down" size={16}/></button>
                  <button onClick={()=>startEdit("pal",i,p.name||p.label)} aria-label="rename"><Icon name="edit" size={15}/></button>
                  <button className="danger" onClick={()=>setSavedPalettes(list.filter((_,j)=>j!==i))} aria-label="delete"><Icon name="close" size={15} stroke={2.4}/></button>
                </div>
              </div>
              {p.note && <div className="muted sm" style={{marginTop:2}}>{p.note}</div>}
              <div className="row" style={{gap:5,marginTop:8,flexWrap:"wrap"}}>
                {p.colors.map((c,j)=><span key={j} className="saved-chip" style={{background:c.marker.hex}} title={`${c.marker.code} · ${c.marker.name}`}/>)}
              </div>
              <div className="row" style={{justifyContent:"space-between",alignItems:"center",marginTop:8,gap:8}}>
                <div className="saved-codes" style={{marginTop:0,flex:1,minWidth:0}}>{p.colors.map(c=>c.marker.code).join(" · ")}</div>
                <button className="pg-used-use" style={{flex:"0 0 auto"}} onClick={()=>{setEditing(null);setPalEdit(i);}}>⋯ edit colours</button>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {tab==="ideas" && (<>
        {ideaList.length===0 && <div className="empty">tap ♡ on an idea in Prompts to keep it here ✿</div>}
        {ideaList.length>1 && <div className="muted sm" style={{marginBottom:10}}>tap ✎ to rename · ↑↓ to reorder</div>}
        <div className="saved-list">
          {ideaList.map((it,i)=>(
            <div className="saved-item" key={it.id||i}>
              <div className="saved-top">
                {editing&&editing.kind==="idea"&&editing.i===i
                  ? <input className="text-field sm" autoFocus value={draft} maxLength={40}
                      onChange={e=>setDraft(e.target.value)} onBlur={commit}
                      onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(null);}}/>
                  : <div className="saved-label">{it.title}</div>}
                <div className="saved-acts">
                  <button onClick={()=>move(ideaList,setSavedIdeas,i,-1)} disabled={i===0} aria-label="move up"><Icon name="up" size={16}/></button>
                  <button onClick={()=>move(ideaList,setSavedIdeas,i,1)} disabled={i===ideaList.length-1} aria-label="move down"><Icon name="down" size={16}/></button>
                  <button onClick={()=>startEdit("idea",i,it.title)} aria-label="rename"><Icon name="edit" size={15}/></button>
                  <button className="danger" onClick={()=>setSavedIdeas(ideaList.filter((_,j)=>j!==i))} aria-label="delete"><Icon name="close" size={15} stroke={2.4}/></button>
                </div>
              </div>
              <div className="muted sm" style={{marginTop:4,lineHeight:1.4}}>{it.brief}</div>
              {it.theme && <div className="saved-codes" style={{marginTop:7}}>from “{it.theme}”</div>}
            </div>
          ))}
        </div>
        {ideaList.length>0 && <div className="muted sm" style={{textAlign:"center",marginTop:10}}>open one beside a palette in <b style={{color:"var(--accent)"}}>Studio</b> ❖</div>}
      </>)}
      <BackupPanel/>
      </>)}
    </Sheet>
  );
}

Object.assign(window,{LibraryScreen,PromptsScreen,SavedSheet,ColorSheet,BackupPanel});
