// ============================================================================
// swatchbook — Palettes. One home for every way to make a palette:
//   · Build    — a full lights→darks palette from a mood + harmony (4–9 colours)
//   · Blend    — the markers you already own that bridge two colours
//   · Gradient — an even N-step ramp between two colours, snapped to your markers
// All three save into the same shared library with auto-generated names.
// ============================================================================

// ---- shared descriptors (declared once, used across the modes) ----
const MOOD_DOT={golden:"#f3b03b",pastel:"#f2c6da",blue:"#5b6aa8",moody:"#3c3650",vibrant:"#ff6b5c",fresh:"#48c0b0",earthy:"#9b7038",vintage:"#c8a368"};
const MOOD_DESC={golden:"warm sun, long shadows",pastel:"soft, light, candy",blue:"dusk — cool and calm",moody:"dark, dramatic, rich",vibrant:"punchy and saturated",fresh:"airy, cool, clean",earthy:"natural, muted, warm",vintage:"faded, nostalgic"};
const MOOD_LIGHT={golden:"warm light, cool shadow",pastel:"soft, low-contrast light",blue:"cool dusk light, deep shadow",moody:"low-key — one dramatic light",vibrant:"bright, saturated light",fresh:"clean, airy, cool light",earthy:"muted natural daylight",vintage:"faded, warm nostalgic light"};
const HARM=[
  ["complementary","Complementary","opposites — bold, high contrast"],
  ["analogous","Analogous","neighbours — calm and cohesive"],
  ["splitComplement","Split-comp","a softer take on opposites"],
  ["triadic","Triadic","three-way balance, playful"],
  ["monochrome","Monochrome","one hue, many values"],
];
const HARM_LBL=Object.fromEntries(HARM.map(h=>[h[0],h[1]]));
const PAL_MIN=4, PAL_MAX=9;

// shared endpoint card for Blend + Gradient
function EndpointCard({label,color,onClick}){
  return (
    <div className="endpt" role="button" tabIndex={0} onClick={onClick}>
      <div className="endpt-label">{label}</div>
      {color?(
        <div className="row" style={{alignItems:"center",gap:10}}>
          <Dot hex={color.hex} size={38}/>
          <div style={{textAlign:"left"}}><div className="endpt-code">{codeLabel(color)}</div><div className="muted sm">{color.setName}</div></div>
        </div>
      ):<div className="muted">tap to pick →</div>}
    </div>
  );
}

// ============================================================================
// BUILD
// ============================================================================
function BuildMode(){
  const [stage,setStage]=useLocal("cq-b-stage","vibe");      // vibe | anchors | style | result
  const [mood,setMood]=useLocal("cq-builder-mood","golden");
  const [anchors,setAnchors]=useLocal("cq-builder-anchors",[]);
  const [harmony,setHarmony]=useLocal("cq-builder-harmony","complementary");
  const [structure,setStructure]=useLocal("cq-builder-structure","value");
  const [source,setSource]=useLocal("cq-builder-source","all");   // all | set:<id>
  const [count,setCount]=useLocal("cq-b-count",6);
  const [lockedArr,setLockedArr]=useLocal("cq-b-locked",null);
  const [baseHue,setBaseHue]=useLocal("cq-b-basehue",null);
  const [reseed,setReseed]=useState(0);
  const [picking,setPicking]=useState(false);
  const [swapIdx,setSwapIdx]=useState(null);
  const [withWhite,setWithWhite]=useLocal("cq-b-white",true);
  const [adjust,setAdjust]=useState(false);
  const [saved,setSavedPalettes]=useLocal("cq-saved",[]);
  const [nameOpen,setNameOpen]=useState(false);
  const uid=useRef(Math.random().toString(36).slice(2,7)).current;
  const arr=Array.isArray(anchors)?anchors:[];
  const n=Math.max(PAL_MIN,Math.min(PAL_MAX,count||6));

  const pool=useMemo(()=>{
    let base=ALL;
    if(source.startsWith("set:")) base=ALL.filter(c=>c.setId===source.slice(4));
    if(base===ALL) return ALL;
    const have=new Set(base.map(c=>c.uid));
    const extra=arr.map(u=>ALL.find(c=>c.uid===u)).filter(c=>c&&!have.has(c.uid));
    return extra.length?base.concat(extra):base;
  },[source,arr.join(",")]);

  const result=useMemo(()=>CQ.build(pool,{
    anchors:arr,
    locked:(lockedArr&&lockedArr.length===n)?lockedArr:null,
    baseHue, mood, harmony, structure, reseed, count:n
  }),[pool,lockedArr&&lockedArr.join(","),arr.join(","),baseHue,mood,harmony,structure,reseed,n]);

  useEffect(()=>{
    if(stage==="result" && baseHue==null && result && typeof result.baseHue==="number")
      setBaseHue(result.baseHue);
  },[stage,baseHue,result]);

  const toggleAnchor=u=>setAnchors(prev=>{const a=Array.isArray(prev)?prev:[];if(a.includes(u))return a.filter(x=>x!==u);if(a.length>=PAL_MAX)return a;return [...a,u];});
  const lockArrNow=()=>(lockedArr&&lockedArr.length===n)?lockedArr.slice():result.colors.map(()=>null);
  const generate=()=>{ const r=CQ.build(pool,{anchors:arr,mood,harmony,structure,reseed:0,count:n}); setReseed(0); setBaseHue(r.baseHue); setLockedArr(r.lockedArr); setStage("result"); };
  const changeCount=nc=>{ const v=Math.max(PAL_MIN,Math.min(PAL_MAX,nc)); setCount(v); setLockedArr(null); };
  const toggleLock=i=>{ const c=lockArrNow(); c[i]=c[i]?null:result.colors[i].marker.uid; setLockedArr(c); };
  const doSwap=u=>{ const c=lockArrNow(); c[swapIdx]=u; setLockedArr(c); setSwapIdx(null); };
  const startOver=()=>{ setLockedArr(null); setBaseHue(null); setAnchors([]); setReseed(0); setAdjust(false); setStage("vibe"); };

  const white=FIN.find(f=>f.code==="PC-3M");
  const savedList=Array.isArray(saved)?saved:[];
  const curColors=(()=>{ const colors=result.colors.filter(c=>c.marker).map(c=>({marker:c.marker,role:c.role})); if(withWhite&&white)colors.push({marker:white,role:"highlight pen"}); return colors; })();
  const sig=paletteSig(curColors);
  const savedIdx=savedList.findIndex(p=>(p.sig||paletteSig(p.colors))===sig);
  const isSaved=savedIdx>=0;
  const toggleSave=()=>{ if(isSaved){ setSavedPalettes(savedList.filter((_,i)=>i!==savedIdx)); } else { setNameOpen(true); } };
  const doSave=(name)=>{ setSavedPalettes([{name,kind:"Built",note:`${result.moodLabel} · ${HARM_LBL[harmony]||harmony} · ${n}`,colors:curColors,sig,ts:Date.now()},...savedList].slice(0,60)); setNameOpen(false); };

  const Steps=({at})=>(
    <div className="steps">
      {["vibe","colours","style"].map((s,i)=>(
        <span key={s} className={"step-dot"+(i===at?" on":"")+(i<at?" done":"")}>{i+1}</span>
      ))}
    </div>
  );
  const CountStep=()=>(
    <>
      <div className="lbl">how many colours</div>
      <div className="count-step">
        <button onClick={()=>changeCount(n-1)} disabled={n<=PAL_MIN} aria-label="fewer">−</button>
        <span className="count-val">{n}<span className="muted"> colours</span></span>
        <button onClick={()=>changeCount(n+1)} disabled={n>=PAL_MAX} aria-label="more">+</button>
      </div>
      <div className="muted sm" style={{margin:"7px 2px 0",lineHeight:1.4}}>
        {n<=4?"a tight, punchy set":n<=6?"a balanced range — lights, mids and darks":"a rich range with lots of tonal steps"}
      </div>
    </>
  );

  // ---- vibe ----
  if(stage==="vibe"){
    return (
      <>
        <div className="scr-sub" style={{marginTop:12}}>Pick the mood of the scene you're picturing. You can change it later.</div>
        <Steps at={0}/>
        <div className="vibe-grid">
          {CQ.MOOD_ORDER.map(m=>(
            <button key={m} className={"vibe-card"+(mood===m?" on":"")} onClick={()=>setMood(m)}>
              <span className="vibe-dot" style={{background:MOOD_DOT[m]}}/>
              <span className="vibe-name">{CQ.MOODS[m].label}</span>
              <span className="vibe-desc">{MOOD_DESC[m]}</span>
            </button>
          ))}
        </div>
        <div className="lbl">draw from</div>
        <div className="filter-row">
          <button className={"pill sm"+(source==="all"?" active":"")} onClick={()=>setSource("all")}>Any · a mix</button>
          {window.SETS.map(s=>(
            <button key={s.id} className={"pill sm ghost"+(source==="set:"+s.id?" on":"")} onClick={()=>setSource("set:"+s.id)}>{s.short}</button>
          ))}
        </div>
        <div className="muted sm" style={{margin:"8px 2px 0",lineHeight:1.4}}>
          {source==="all"
            ? "mixing freely across every alcohol marker you own"
            : <>drawing from <b style={{color:"var(--accent2)"}}>{pool.length}</b> colour{pool.length===1?"":"s"}{pool.length<n?" — that’s a small set, so some slots may repeat":""}</>}
        </div>
        <button className="btn btn-accent wide" onClick={()=>setStage("anchors")}>Next · build around your colours →</button>
      </>
    );
  }

  // ---- anchors ----
  if(stage==="anchors"){
    const chosen=arr.map(u=>CQ.find(ALL,u)).filter(Boolean);
    return (
      <>
        <div className="scr-sub" style={{marginTop:12}}>Optional. Lock in up to {PAL_MAX} colours you own and I'll harmonise the rest around them — or skip and let me choose everything.</div>
        <Steps at={1}/>
        <div className="chosen-row">
          {chosen.length===0
            ? <span className="muted sm">none yet — totally optional</span>
            : chosen.map(c=>(
                <button key={c.uid} className="chosen-chip" onClick={()=>toggleAnchor(c.uid)} title="remove">
                  <span className="chosen-sw" style={{background:c.hex}}/>{codeLabel(c)}<span className="chosen-x">×</span>
                </button>
              ))}
        </div>
        <button className="btn btn-accent wide" onClick={()=>setPicking(true)}>🎨 pick from your colours {arr.length>0?`· ${arr.length}/${PAL_MAX}`:""}</button>
        <div className="wiz-nav">
          <button className="btn btn-ghost" onClick={()=>setStage("vibe")}>← back</button>
          <button className="btn btn-accent" onClick={()=>setStage("style")}>{arr.length>0?"Next →":"Skip →"}</button>
        </div>
        <Sheet open={picking} onClose={()=>setPicking(false)} title={`your colours${arr.length>=PAL_MAX?` · max ${PAL_MAX}`:""}`}>
          <ColorPicker selected={arr} onPick={toggleAnchor} multi/>
        </Sheet>
      </>
    );
  }

  // ---- style ----
  if(stage==="style"){
    return (
      <>
        <div className="scr-sub" style={{marginTop:12}}>The harmony sets how the hues sit together. Structure decides whether you get a full lights-to-darks range.</div>
        <Steps at={2}/>
        <div className="harm-list">
          {HARM.map(([v,l,d])=>(
            <button key={v} className={"harm-card"+(harmony===v?" on":"")} onClick={()=>setHarmony(v)}>
              <div className="harm-name">{l}</div>
              <div className="harm-desc">{d}</div>
            </button>
          ))}
        </div>
        <CountStep/>
        <div className="lbl">structure</div>
        <div className="seg wide-seg">
          <button className={structure==="value"?"active":""} onClick={()=>setStructure("value")}>Lights → darks</button>
          <button className={structure==="hue"?"active":""} onClick={()=>setStructure("hue")}>Pure hue</button>
        </div>
        <div className="muted sm" style={{margin:"8px 2px 0",lineHeight:1.4}}>
          {structure==="value"?"Guarantees highlights, mid-tones and shadows — best for a scene you'll shade.":"Keeps every swatch at full strength — best for flat, graphic colour."}
        </div>
        <div className="wiz-nav">
          <button className="btn btn-ghost" onClick={()=>setStage("anchors")}>← back</button>
          <button className="btn btn-accent" onClick={generate}>✦ Build palette</button>
        </div>
      </>
    );
  }

  // ---- result ----
  const usedUids=result.colors.map(c=>c.marker&&c.marker.uid).filter(Boolean);
  const swapCands=swapIdx==null?[]:CQ.slotCandidates(pool, result.colors[swapIdx].targetLab, usedUids, 36);
  const lockedCount=result.colors.filter(c=>c.locked).length;
  return (
    <>
      <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start",marginTop:8}}>
        <div className="scr-sub" style={{maxWidth:"24ch"}}>{CQ.MOODS[mood].label} · {HARM_LBL[harmony]} · {n} colours</div>
        <button className="btn btn-ghost sm" onClick={startOver}>↺ start over</button>
      </div>

      <div className="card slots-card">
        <div className="slots slots-grid">
          {result.colors.map((c,i)=>(
            <div key={i} className={"slot"+(c.locked?" locked":"")}>
              <button className="slot-sw" style={{background:c.marker?c.marker.hex:"#333"}} onClick={()=>setSwapIdx(i)} title="swap this colour"/>
              <div className="slot-code">{c.marker?codeLabel(c.marker):""}</div>
              <div className="slot-role">{c.role}</div>
              {c.marker&&<button className={"slot-lock"+(c.locked?" on":"")} onClick={()=>toggleLock(i)} title={c.locked?"unlock":"lock in"}>{c.locked?"🔒":"+"}</button>}
            </div>
          ))}
        </div>
        <div className="row" style={{gap:6,marginTop:12,flexWrap:"wrap",alignItems:"center"}}>
          <span className="muted sm">mixing</span>
          {[...new Set(result.colors.map(c=>c.marker&&c.marker.setName).filter(Boolean))].slice(0,4).map(s=><span key={s} className="tag ghost">{s}</span>)}
        </div>
      </div>

      <div className="wiz-nav">
        <button className="btn btn-accent" onClick={()=>setReseed(reseed+1)}>↻ Reroll {lockedCount>0?`the ${n-lockedCount} unlocked`:"all"}</button>
        <button className="btn btn-ghost" onClick={()=>setAdjust(!adjust)}>{adjust?"hide recipe ▴":"adjust recipe ▾"}</button>
      </div>

      {adjust && (
        <div className="card" style={{marginTop:10}}>
          <div className="lbl" style={{marginTop:0}}>mood</div>
          <div className="filter-row">
            {CQ.MOOD_ORDER.map(m=>(<button key={m} className={"pill"+(mood===m?" active":"")} onClick={()=>setMood(m)}><span className="mdot" style={{background:MOOD_DOT[m]}}/>{CQ.MOODS[m].label}</button>))}
          </div>
          <div className="lbl">harmony</div>
          <div className="filter-row">
            {HARM.map(([v,l])=>(<button key={v} className={"pill sm ghost"+(harmony===v?" on":"")} onClick={()=>setHarmony(v)}>{l}</button>))}
          </div>
          <CountStep/>
          <div className="lbl">structure</div>
          <div className="seg">
            <button className={structure==="value"?"active":""} onClick={()=>setStructure("value")}>Lights→darks</button>
            <button className={structure==="hue"?"active":""} onClick={()=>setStructure("hue")}>Pure hue</button>
          </div>
        </div>
      )}

      <div className="card scene-card">
        <Scene colors={result.colors} uid={uid+reseed} highlight={withWhite}/>
        <div className="scene-cap">how it reads as a scene — {MOOD_LIGHT[mood]||"warm light, cool shadow"}</div>
      </div>

      <div className={"fin-suggest"+(withWhite?" on":"")} onClick={()=>setWithWhite(!withWhite)} role="switch" aria-checked={withWhite}>
        <span className="fin-sw sm" style={{background:white?white.hex:"#fff"}}/>
        <div style={{flex:1}}>
          <div className="fin-name">Finish with {white?white.name.split(" — ")[0]:"a white pen"}{white?<span className="muted" style={{fontWeight:400}}> · {white.code}</span>:null}</div>
          <div className="muted sm">{withWhite?"✓ added — saves with your palette, glinting on the scene above":"opaque highlight on the sunlit edge — tap to add"}</div>
        </div>
        <span className={"toggle"+(withWhite?" on":"")}><span className="knob"/></span>
      </div>

      <div className="tip-card" style={{marginTop:14}}>
        <div className="tip-t">💡 bold complementary shading</div>
        <div className="tip-b">Shade with the base colour's opposite instead of black — reds shadow toward green, blues toward orange. Keeps the shadow vivid and pulls the eye to your focal point.</div>
      </div>

      <button className={"btn btn-accent wide"+(isSaved?" ok":"")} style={{marginTop:14}} onClick={toggleSave}><span className="btn-ico"><Icon name={isSaved?"check":"bookmark"} size={17}/>{isSaved?"saved — tap to remove":"save this palette"}</span></button>

      <Sheet open={swapIdx!=null} onClose={()=>setSwapIdx(null)} title={swapIdx!=null?`swap the ${result.colors[swapIdx].role}`:""}>
        <div className="muted sm" style={{marginBottom:10}}>Closest colours you own to this slot — tap one to lock it in.</div>
        <div className="fam-grid">
          {swapCands.map(c=>(
            <Dot key={c.uid} hex={c.hex} size={38} onClick={()=>doSwap(c.uid)} title={`${codeLabel(c)} · ${c.name} · ${c.setName}`}/>
          ))}
        </div>
      </Sheet>
      <NameSheet open={nameOpen} initial={cuteName(curColors)} colors={curColors} onSave={doSave} onClose={()=>setNameOpen(false)}/>
    </>
  );
}

// ============================================================================
// BLEND  (owned markers that bridge two colours)
// ============================================================================
function BlendMode(){
  const [uidA,setA]=useLocal("cq-bridge-a",null);
  const [uidB,setB]=useLocal("cq-bridge-b",null);
  const [mode,setMode]=useLocal("cq-bridge-mode","around");
  const [picking,setPicking]=useState(null); // "a"|"b"|null
  const [saved,setSavedPalettes]=useLocal("cq-saved",[]);
  const [nameOpen,setNameOpen]=useState(false);
  const A=uidA?CQ.find(ALL,uidA):null, B=uidB?CQ.find(ALL,uidB):null;
  const result=useMemo(()=>(A&&B)?CQ.bridge(ALL,uidA,uidB,{mode,maxTotal:9}):null,[uidA,uidB,mode]);

  const pick=uid=>{ if(picking==="a"){setA(uid);} else if(picking==="b"){setB(uid);} setPicking(null); };
  const palColors = result ? result.seq.map(c=>({marker:{uid:c.uid,code:c.code,name:c.name,hex:c.hex,setName:c.setName,type:c.type},role:`${Math.round(c.u*100)}%`})) : [];
  const sig = paletteSig(palColors);
  const savedList = Array.isArray(saved)?saved:[];
  const savedIdx = result ? savedList.findIndex(p=>(p.sig||paletteSig(p.colors))===sig) : -1;
  const isSaved = savedIdx>=0;
  const toggleSave=()=>{ if(!result) return; if(isSaved){ setSavedPalettes(savedList.filter((_,i)=>i!==savedIdx)); } else { setNameOpen(true); } };
  const doSave=(name)=>{
    setSavedPalettes([{name,kind:"Blend",note:`${result.a.code} → ${result.b.code}`,colors:palColors,sig,ts:Date.now()},...savedList].slice(0,60));
    setNameOpen(false);
  };

  return (
    <>
      <div className="scr-sub" style={{marginTop:12}}>Two colours you own → the markers that blend between them, across any sets. Up to 9 steps.</div>
      <div className="endpts">
        <EndpointCard label="From" color={A} onClick={()=>setPicking("a")}/>
        <span className="endpt-arrow">⇄</span>
        <EndpointCard label="To" color={B} onClick={()=>setPicking("b")}/>
      </div>

      <div className="row" style={{gap:10,alignItems:"center",marginTop:14,flexWrap:"wrap"}}>
        <div className="seg">
          <button className={mode==="around"?"active":""} onClick={()=>setMode("around")}>Around wheel</button>
          <button className={mode==="direct"?"active":""} onClick={()=>setMode("direct")}>Shortest</button>
        </div>
        {result && <button className={"btn btn-ghost sm"+(isSaved?" ok":"")} onClick={toggleSave}><span className="btn-ico"><Icon name={isSaved?"check":"bookmark"} size={15}/>{isSaved?"saved":"save"}</span></button>}
      </div>

      {!result && <div className="empty big">pick two colours to see what bridges them</div>}
      {result && (
        <>
          <div className="ramp">
            <div className="ramp-bar">
              <div className="ramp-grad" style={{background:`linear-gradient(90deg, ${result.gradient.join(",")})`}}/>
              {result.seq.map((c,i)=>{
                const end=c.uid===uidA||c.uid===uidB;
                return <div key={i} className={"ramp-node"+(end?" end":"")} style={{left:`${c.u*100}%`,background:c.hex}} title={`${codeLabel(c)} · ${c.name}`}/>;
              })}
              {result.gaps.map((g,i)=>{const mid=(g.from.u+g.to.u)/2;return <div key={"g"+i} className="gap" style={{left:`${mid*100}%`}}>blend</div>;})}
            </div>
            <div className="ramp-seq">
              {result.seq.map((c,i)=>{
                const end=c.uid===uidA||c.uid===uidB;
                return (
                  <React.Fragment key={i}>
                    <div className={"seq-chip"+(end?" end":"")}>
                      <span className="seq-sw" style={{background:c.hex}}/>
                      <span className="seq-code">{codeLabel(c)}</span>
                      <span className="seq-set">{c.setName}</span>
                    </div>
                    {result.gaps.find(g=>g.afterIndex===i) && <span className="seq-gap" title="blend by hand here">⤳</span>}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="summary">
            {result.ramp.length===0
              ? <>No in-betweens — these sit side by side. Blend <b>{codeLabel(result.a)}</b> straight into <b>{codeLabel(result.b)}</b>.</>
              : <><b>{result.ramp.length}</b> colours bridge this{result.gaps.length>0?<> · <b>{result.gaps.length}</b> hand-blend spot{result.gaps.length>1?"s":""}</>:<> · smooth the whole way ✦</>}</>}
          </div>
          {mode==="direct" && A&&B && A._lch[1]>20 && B._lch[1]>20 && result.ramp.some(c=>c._lch&&c._lch[1]<14) && (
            <div className="muted sm" style={{marginTop:8,lineHeight:1.45}}>
              ↪ The shortest mix dips through muted greys (that’s the real path between these two). Tap <b style={{color:"var(--accent2)"}}>Around wheel</b> to bend it through brighter colours instead.
            </div>
          )}
          {result.nearby.length>0 && (
            <div className="row" style={{gap:8,alignItems:"center",marginTop:10,flexWrap:"wrap"}}>
              <span className="muted sm">also near:</span>
              {result.nearby.map(c=><Dot key={c.uid} hex={c.hex} size={24} title={`${codeLabel(c)} · ${c.name}`}/>)}
            </div>
          )}
          <div className="tip-card" style={{marginTop:16}}>
            <div className="tip-t">💡 the gaps</div>
            <div className="tip-b">A "blend" flag means no marker lands there — that's where you feather two colours by hand or pull through with a colourless blender.</div>
          </div>
        </>
      )}

      <Sheet open={!!picking} onClose={()=>setPicking(null)} title={picking==="a"?"pick the FROM colour":"pick the TO colour"}>
        <ColorPicker selected={picking==="a"?uidA:uidB} onPick={pick}/>
      </Sheet>
      <NameSheet open={nameOpen} initial={cuteName(palColors)} colors={palColors} onSave={doSave} onClose={()=>setNameOpen(false)}/>
    </>
  );
}

// ============================================================================
// GRADIENT  (even N-step ramp between two colours, snapped to owned markers)
// ============================================================================
function GradientMode(){
  const [uidA,setA]=useLocal("cq-bridge-a",null);
  const [uidB,setB]=useLocal("cq-bridge-b",null);
  const [mode,setMode]=useLocal("cq-bridge-mode","around");
  const [steps,setSteps]=useLocal("cq-grad-steps",6);
  const [picking,setPicking]=useState(null);
  const [saved,setSavedPalettes]=useLocal("cq-saved",[]);
  const [nameOpen,setNameOpen]=useState(false);
  const A=uidA?CQ.find(ALL,uidA):null, B=uidB?CQ.find(ALL,uidB):null;
  const st=Math.max(3,Math.min(PAL_MAX,steps||6));
  const result=useMemo(()=>(A&&B)?CQ.gradient(ALL,uidA,uidB,{mode,steps:st}):null,[uidA,uidB,mode,st]);

  const pick=uid=>{ if(picking==="a"){setA(uid);} else if(picking==="b"){setB(uid);} setPicking(null); };

  // unique markers in order for saving
  const palColors=(()=>{
    if(!result) return [];
    const seen=new Set(), out=[];
    result.stops.forEach(s=>{ if(s.marker&&!seen.has(s.marker.uid)){seen.add(s.marker.uid); out.push({marker:{uid:s.marker.uid,code:s.marker.code,name:s.marker.name,hex:s.marker.hex,setName:s.marker.setName,type:s.marker.type},role:`${Math.round(s.u*100)}%`});} });
    return out;
  })();
  const sig=paletteSig(palColors);
  const savedList=Array.isArray(saved)?saved:[];
  const savedIdx=result?savedList.findIndex(p=>(p.sig||paletteSig(p.colors))===sig):-1;
  const isSaved=savedIdx>=0;
  const toggleSave=()=>{ if(!result) return; if(isSaved){ setSavedPalettes(savedList.filter((_,i)=>i!==savedIdx)); } else { setNameOpen(true); } };
  const doSave=(name)=>{ setSavedPalettes([{name,kind:"Gradient",note:`${result.a.code} → ${codeLabel(result.b)} · ${palColors.length}`,colors:palColors,sig,ts:Date.now()},...savedList].slice(0,60)); setNameOpen(false); };

  return (
    <>
      <div className="scr-sub" style={{marginTop:12}}>An even ramp between two colours — each step snapped to the nearest marker you own. Save it as a ready palette.</div>
      <div className="endpts">
        <EndpointCard label="From" color={A} onClick={()=>setPicking("a")}/>
        <span className="endpt-arrow">→</span>
        <EndpointCard label="To" color={B} onClick={()=>setPicking("b")}/>
      </div>

      <div className="row" style={{gap:10,alignItems:"center",marginTop:14,flexWrap:"wrap"}}>
        <div className="seg">
          <button className={mode==="around"?"active":""} onClick={()=>setMode("around")}>Around wheel</button>
          <button className={mode==="direct"?"active":""} onClick={()=>setMode("direct")}>Shortest</button>
        </div>
        {result && <button className={"btn btn-ghost sm"+(isSaved?" ok":"")} onClick={toggleSave}><span className="btn-ico"><Icon name={isSaved?"check":"bookmark"} size={15}/>{isSaved?"saved":"save"}</span></button>}
      </div>

      <div className="lbl">steps</div>
      <div className="count-step">
        <button onClick={()=>setSteps(Math.max(3,st-1))} disabled={st<=3} aria-label="fewer">−</button>
        <span className="count-val">{st}<span className="muted"> steps</span></span>
        <button onClick={()=>setSteps(Math.min(PAL_MAX,st+1))} disabled={st>=PAL_MAX} aria-label="more">+</button>
      </div>

      {!result && <div className="empty big">pick two colours to ramp between</div>}
      {result && (
        <>
          <div className="ramp">
            <div className="ramp-bar">
              <div className="ramp-grad" style={{opacity:.9,background:`linear-gradient(90deg, ${result.gradient.join(",")})`}}/>
              {result.stops.map((s,i)=>(
                <div key={i} className={"ramp-node"+(i===0||i===result.stops.length-1?" end":"")}
                  style={{left:`${s.u*100}%`,background:s.marker?s.marker.hex:s.idealHex}}
                  title={s.marker?`${codeLabel(s.marker)} · ${s.marker.name}`:s.idealHex}/>
              ))}
            </div>
            <div className="ramp-seq">
              {result.stops.map((s,i)=>(
                <div key={i} className={"seq-chip"+(i===0||i===result.stops.length-1?" end":"")}>
                  <span className="seq-sw" style={{background:s.marker?s.marker.hex:s.idealHex}}/>
                  <span className="seq-code">{s.marker?codeLabel(s.marker):"—"}</span>
                  <span className="seq-set">{s.marker?s.marker.setName:""}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="summary">
            A <b>{result.steps}-step</b> ramp{palColors.length<result.steps?<> · <b>{result.steps-palColors.length}</b> step{result.steps-palColors.length>1?"s":""} reuse a marker (your closest match)</>:<> · all distinct ✦</>}
          </div>
          <div className="tip-card" style={{marginTop:16}}>
            <div className="tip-t">💡 lay it down light → dark</div>
            <div className="tip-b">Work the ramp from the lightest step and layer toward the darkest while the ink's still damp — each step melts into the last for a seamless blend.</div>
          </div>
        </>
      )}

      <Sheet open={!!picking} onClose={()=>setPicking(null)} title={picking==="a"?"pick the FROM colour":"pick the TO colour"}>
        <ColorPicker selected={picking==="a"?uidA:uidB} onPick={pick}/>
      </Sheet>
      <NameSheet open={nameOpen} initial={cuteName(palColors)} colors={palColors} onSave={doSave} onClose={()=>setNameOpen(false)}/>
    </>
  );
}

// ============================================================================
// WRAPPER
// ============================================================================
function PalettesScreen(){
  const [mode,setMode]=useLocal("cq-pal-mode","build");
  const M=mode==="blend"||mode==="gradient"?mode:"build";
  return (
    <div className="screen">
      <div className="scr-eyebrow">make a palette</div>
      <h1 className="scr-title">Palettes</h1>
      <div className="seg wide-seg pal-modeseg">
        <button className={M==="build"?"active":""} onClick={()=>setMode("build")}>✦ Build</button>
        <button className={M==="blend"?"active":""} onClick={()=>setMode("blend")}>⇄ Blend</button>
        <button className={M==="gradient"?"active":""} onClick={()=>setMode("gradient")}>▤ Gradient</button>
      </div>
      {M==="build" && <BuildMode/>}
      {M==="blend" && <BlendMode/>}
      {M==="gradient" && <GradientMode/>}
    </div>
  );
}

Object.assign(window,{PalettesScreen});
