// ============================================================================
// colorqueue — Learn screen. Three sub-tabs:
//   Mixing   — curated layer-order + combo guides for THIS kit (window.MIXING)
//   Materials— per-medium deep dive (window.MATERIAL_TYPES + TIPS.material)
//   Theory   — colour-theory mini-lessons (TIPS.theory)
// Exports window.LearnScreen (replaces the old one in cq-screens.jsx).
// ============================================================================
(function(){
  const { useState } = React;
  const TYPE_GLYPH = window.TYPE_GLYPH;
  const MED_COLOR  = window.MED_COLOR || {};

  // light markdown -> safe html (shared, tiny)
  function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function md(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"); }

  // ---- vertical layer stack (rendered top = last applied) ----
  function LayerStack({ layers, full }){
    const rows = layers.slice().reverse(); // data is first->last; show last on top
    return (
      <div className="lstack">
        <div className="lstack-cap">↑ on top · done last</div>
        {rows.map((l,i)=>(
          <div className="llayer" key={i}>
            <span className="llayer-chip" style={{background:MED_COLOR[l.type]||"var(--surface2)"}}>{TYPE_GLYPH[l.type]||"●"}</span>
            <span className="llayer-txt">
              <b>{l.label}</b>
              {l.note && <em>{l.note}</em>}
            </span>
          </div>
        ))}
        <div className="lstack-cap bottom">↓ paper · down first</div>
      </div>
    );
  }

  // ---- one expandable combo guide ----
  function ComboCard({ c, open, onToggle }){
    return (
      <div className={"combo"+(open?" open":"")}>
        <button className="combo-head" onClick={onToggle}>
          <span className="combo-glyphs">
            <span className="combo-gchip" style={{background:MED_COLOR[c.a]||"var(--surface2)"}}>{TYPE_GLYPH[c.a]||"●"}</span>
            {c.b && <span className="combo-gchip b" style={{background:MED_COLOR[c.b]||"var(--surface2)"}}>{TYPE_GLYPH[c.b]||"●"}</span>}
          </span>
          <span className="combo-htxt">
            <span className="combo-title">{c.title}</span>
            <span className="combo-verdict">{c.verdict}</span>
          </span>
          <span className="combo-caret">{open?"−":"+"}</span>
        </button>

        {open && (
          <div className="combo-body">
            <div className="combo-seclbl">layer order</div>
            <LayerStack layers={c.order}/>

            <div className="combo-seclbl">how to do it</div>
            <ol className="combo-steps">
              {c.steps.map((s,i)=><li key={i}>{s}</li>)}
            </ol>

            <div className="combo-seclbl">blending</div>
            <div className="combo-blend">{c.blend}</div>

            <div className="combo-watch" dangerouslySetInnerHTML={{__html:"<b>⚠ Watch out — </b>"+md(c.watch)}}/>

            {c.note && <div className="combo-note">✎ {c.note}</div>}
          </div>
        )}
      </div>
    );
  }

  // ---- MIXING section ----
  const MIX_FILTERS = [
    ["all","All"],["ink","Inktense"],["alcohol","Markers"],
    ["pencil","Pencils"],["gel","Gel"],["acrylic","Acrylic"],
  ];
  function MixingSection(){
    const M = window.MIXING;
    const [filter,setFilter] = useState("all");
    const [open,setOpen] = useState(M.combos[0] ? M.combos[0].id : null);
    const combos = filter==="all" ? M.combos : M.combos.filter(c=>c.involves.includes(filter));

    return (
      <div>
        {/* hero: the universal stack */}
        <div className="card mix-hero">
          <div className="mix-hero-h">The layering order</div>
          <div className="mix-hero-sub">{M.stackWhy}</div>
          <LayerStack layers={M.stack} full/>
        </div>

        <div className="filter-row" style={{marginTop:16}}>
          {MIX_FILTERS.map(([v,l])=>(
            <button key={v} className={"pill sm ghost"+(filter===v?" on":"")} onClick={()=>setFilter(v)}>{l}</button>
          ))}
        </div>

        <div className="combo-list">
          {combos.length===0 && <div className="empty">no combos for that filter</div>}
          {combos.map(c=>(
            <ComboCard key={c.id} c={c} open={open===c.id} onToggle={()=>setOpen(open===c.id?null:c.id)}/>
          ))}
        </div>

        {/* blender reference */}
        <div className="lbl">blenders &amp; finishers — what moves what</div>
        <div className="fin-list">
          {M.blenders.map((b,i)=>(
            <div className="fin-row blend-row" key={i}>
              <span className="blend-glyph">{b.glyph}</span>
              <div className="fin-meta">
                <div className="fin-name">{b.name}</div>
                <div className="blend-works">{b.works}</div>
                <div className="muted sm" style={{marginTop:4,lineHeight:1.4}}>{b.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- one expandable effect/technique guide ----
  function EffectCard({ t, open, onToggle }){
    return (
      <div className={"combo"+(open?" open":"")}>
        <button className="combo-head" onClick={onToggle}>
          <span className="combo-glyphs">
            <span className="combo-gchip" style={{background:"var(--surface2)"}}>{t.glyph}</span>
          </span>
          <span className="combo-htxt">
            <span className="combo-title">{t.name}</span>
            <span className="combo-verdict">{t.effect}</span>
          </span>
          <span className="combo-caret">{open?"−":"+"}</span>
        </button>

        {open && (
          <div className="combo-body">
            <div className="combo-seclbl">what you'll reach for</div>
            <div className="row" style={{flexWrap:"wrap",gap:6}}>
              {t.materials.map((m,i)=><span className="tag ghost" key={i}>{m}</span>)}
            </div>

            <div className="combo-seclbl">how to do it</div>
            <ol className="combo-steps">
              {t.steps.map((s,i)=><li key={i}>{s}</li>)}
            </ol>

            <div className="combo-watch" dangerouslySetInnerHTML={{__html:"<b>⚠ Watch out — </b>"+md(t.watch)}}/>
            {t.note && <div className="combo-note">✎ {t.note}</div>}
          </div>
        )}
      </div>
    );
  }

  // ---- EFFECTS section ----
  function EffectsSection(){
    const T = window.TECHNIQUES || [];
    const [open,setOpen] = useState(T[0] ? T[0].id : null);
    return (
      <div>
        <div className="card mix-hero">
          <div className="mix-hero-h">Signature looks</div>
          <div className="mix-hero-sub">The "how did they <em>do</em> that?" effects from the alcohol-marker and cozy-coloring world — broken down for the exact markers, acrylic and pens you own.</div>
        </div>
        <div className="combo-list" style={{marginTop:16}}>
          {T.map(t=>(
            <EffectCard key={t.id} t={t} open={open===t.id} onToggle={()=>setOpen(open===t.id?null:t.id)}/>
          ))}
        </div>
      </div>
    );
  }

  // ---- MATERIALS section ----
  function MaterialsSection(){
    const T = window.TIPS, MT = window.MATERIAL_TYPES;
    const [openMat,setOpenMat] = useState(null);
    return (
      <div className="mat-list">
        {Object.entries(MT).map(([k,v])=>{
          const open = openMat===k;
          return (
            <div className={"mat"+(open?" open":"")} key={k}>
              <button className="mat-head" onClick={()=>setOpenMat(open?null:k)}>
                <span className="mat-glyph">{TYPE_GLYPH[k]}</span>
                <span className="mat-title">{v.label}</span>
                <span className="mat-caret">{open?"−":"+"}</span>
              </button>
              {open && (
                <div className="mat-body">
                  <div className="muted sm" style={{marginBottom:8}}>{v.blurb}</div>
                  <ul className="mat-tips">{(T.material[k]||[]).map((t,j)=><li key={j}>{t}</li>)}</ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- THEORY section ----
  function TheorySection(){
    const T = window.TIPS;
    return (
      <div className="lessons">
        {T.theory.map((l,i)=>(
          <div className="lesson" key={i}>
            <div className="lesson-n">{String(i+1).padStart(2,"0")}</div>
            <div><div className="lesson-t">{l.t}</div><div className="lesson-b">{l.b}</div></div>
          </div>
        ))}
      </div>
    );
  }

  function LearnScreen(){
    const [tab,setTab] = window.useLocal("cq-learn-tab","mixing");
    return (
      <div className="screen">
        <div className="scr-eyebrow">get better</div>
        <h1 className="scr-title">Learn</h1>
        <div className="scr-sub">How to combine, layer and blend the exact materials you own.</div>
        <div className="seg wide-seg" style={{marginTop:14}}>
          <button className={tab==="mixing"?"active":""} onClick={()=>setTab("mixing")}>Mixing</button>
          <button className={tab==="effects"?"active":""} onClick={()=>setTab("effects")}>Effects</button>
          <button className={tab==="material"?"active":""} onClick={()=>setTab("material")}>Materials</button>
          <button className={tab==="theory"?"active":""} onClick={()=>setTab("theory")}>Theory</button>
        </div>

        {tab==="mixing"   && <MixingSection/>}
        {tab==="effects"  && <EffectsSection/>}
        {tab==="material" && <MaterialsSection/>}
        {tab==="theory"   && <TheorySection/>}
      </div>
    );
  }

  window.LearnScreen = LearnScreen;
})();
