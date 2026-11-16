// ============================================================================
// swatchbook — Studio. The "while you draw" reference bench.
// Pick a saved idea + a saved palette -> see the full prompt and every colour
// (codes, names, roles, values) side by side. Optionally ask Claude for a
// rough visual preview — only when the artist taps the button.
// ============================================================================
(function(){
  const { useState, useEffect, useMemo } = React;

  // relative luminance 0..1 from a #rrggbb hex
  function hexLum(hex){
    const m=(hex||"#888").replace("#","");
    if(m.length<6) return .5;
    const r=parseInt(m.slice(0,2),16)/255, g=parseInt(m.slice(2,4),16)/255, b=parseInt(m.slice(4,6),16)/255;
    const f=c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);
    return .2126*f(r)+.7152*f(g)+.0722*f(b);
  }

  // Just the visual scene — strip technique bullets + markdown, keep it short so
  // the SVG the model returns stays well under the output-token cap (which is what
  // used to truncate the </svg> and make the preview fail).
  function sceneOnly(idea){
    let d = idea.detail || idea.brief || idea.title || "";
    d = d.replace(/\r/g,"");
    // drop everything from the "how to / look" section onward
    d = d.split(/\n(?=\s*\*\*?(?:to get|how|materials|finish))/i)[0];
    // strip bullet lines and markdown
    d = d.split("\n").filter(l=>!/^\s*[•\-*]/.test(l)).join(" ");
    d = d.replace(/\*\*?/g,"").replace(/\s+/g," ").trim();
    return d.slice(0,220);
  }

  function previewPrompt(idea, hexes){
    return `Rough 10-second sketchbook thumbnail of: "${idea.title}" — ${sceneOnly(idea)}

Return ONLY a single <svg> element. No markdown fences, no comments, no words.
- <svg viewBox="0 0 400 340"> … </svg>, OMIT width/height.
- VERY simple and gestural: at most 12 paths / lines / basic shapes, like a napkin doodle. Capture the big idea, skip detail.
- stroke outlines (stroke-width 3–5, round caps, fill="none"); fill at most 2 shapes.
- Use ONLY these colours: ${hexes.join(", ")}. Transparent background.
- Keep the whole SVG short — it must be complete.`;
  }

  // Extract a usable <svg>. Tolerates ```fences```, stray prose, AND a response
  // that got cut off by the token cap before its closing tag — we salvage what
  // completed and close it ourselves, rather than failing outright.
  function cleanSvg(raw){
    if(!raw) return null;
    const a = raw.indexOf("<svg");
    if(a<0) return null;
    let svg = raw.slice(a);
    const close = svg.indexOf("</svg>");
    if(close>=0){
      svg = svg.slice(0, close+6);
    }else{
      // truncated — drop any unterminated trailing comment, cut back to the last
      // fully-closed tag, then close the svg so it still renders.
      const c = svg.lastIndexOf("<!--");
      if(c>=0 && svg.indexOf("-->",c)<0) svg = svg.slice(0,c);
      const gt = svg.lastIndexOf(">");
      if(gt>=0) svg = svg.slice(0, gt+1);
      svg += "</svg>";
    }
    // need at least the opener + some drawable content to be worth showing
    if(!/<(path|line|circle|rect|ellipse|polyline|polygon|g)\b/i.test(svg)) return null;
    // make it fill the frame regardless of attrs the model emitted
    svg = svg.replace(/<svg([^>]*)>/, (m,attrs)=>{
      let a2 = attrs.replace(/\swidth="[^"]*"/i,"").replace(/\sheight="[^"]*"/i,"");
      if(!/viewBox/i.test(a2)) a2 += ' viewBox="0 0 400 340"';
      return `<svg${a2} width="100%" style="display:block;height:auto">`;
    });
    return svg;
  }

  function StudioScreen(){
    const [savedPals] = window.useLocal("cq-saved", []);
    const [savedIdeas, setSavedIdeas] = window.useLocal("cq-saved-ideas", []);
    const [favs] = window.useLocal("cq-favs", []);
    const [selIdea, setSelIdea] = window.useLocal("cq-studio-idea", null); // {kind,id}
    const [selPalTs, setSelPalTs] = window.useLocal("cq-studio-pal", null);
    const [previews, setPreviews] = window.useLocal("cq-studio-previews", {}); // key -> svg
    const [detailCache, setDetailCache] = useState({}); // ideaId -> detail text (session)

    const [pickIdea, setPickIdea] = useState(false);
    const [pickPal, setPickPal]   = useState(false);
    const [genLoad, setGenLoad]   = useState(false);
    const [genErr, setGenErr]     = useState("");
    const [detLoad, setDetLoad]   = useState(false);

    const pals  = Array.isArray(savedPals)?savedPals:[];
    const ideas = Array.isArray(savedIdeas)?savedIdeas:[];
    const favList = Array.isArray(favs)?favs:[];

    // resolve current selections
    const idea = useMemo(()=>{
      if(!selIdea) return null;
      if(selIdea.kind==="idea") return ideas.find(i=>i.id===selIdea.id)||null;
      if(selIdea.kind==="fav"){ const f=favList.find(x=>x.shape===selIdea.id); return f?{kind:"fav",title:f.text,brief:window.CATEGORIES[f.cat]||"",shape:f.shape}:null; }
      return null;
    },[selIdea,ideas,favList]);
    const pal = useMemo(()=>pals.find(p=>p.ts===selPalTs)||null,[pals,selPalTs]);

    const palHexes = pal? pal.colors.map(c=>c.marker.hex) : [];
    const pvKey = (selIdea? (selIdea.kind+":"+selIdea.id):"_") + "|" + (selPalTs||"_");
    const preview = previews && previews[pvKey];

    // lazy-fill a saved Claude idea's detail if it was saved before being opened
    const detailText = idea && idea.kind==="fav" ? null
      : (idea && (idea.detail || detailCache[selIdea && selIdea.id])) || null;

    useEffect(()=>{
      if(!idea || idea.kind==="fav") return;
      if(idea.detail || detailCache[selIdea.id]) return;
      let live=true; setDetLoad(true);
      (async()=>{
        try{
          if(!window.claude || !window.claude.complete) throw 0;
          const res = await window.claude.complete(window.cqDetailPrompt(idea.theme||idea.title, idea.title, idea.brief));
          if(!live) return;
          const txt=(res||"").trim();
          setDetailCache(d=>({...d,[selIdea.id]:txt}));
          // persist back onto the saved record so it's there next time
          setSavedIdeas(prev=>(Array.isArray(prev)?prev:[]).map(r=>r.id===selIdea.id?{...r,detail:txt}:r));
        }catch{ /* leave brief showing */ }
        finally{ if(live) setDetLoad(false); }
      })();
      return ()=>{live=false;};
    },[selIdea && selIdea.id]);

    async function generate(){
      if(!idea || !pal || genLoad) return;
      setGenLoad(true); setGenErr("");
      try{
        if(!window.claude || !window.claude.complete) throw 0;
        const res = await window.claude.complete(previewPrompt(
          {title:idea.title, brief:idea.brief, detail:detailText}, palHexes));
        const svg = cleanSvg(res);
        if(!svg) throw 0;
        setPreviews({...(previews||{}), [pvKey]:svg});
      }catch{ setGenErr("The preview didn’t come through — give it another tap."); }
      finally{ setGenLoad(false); }
    }
    function clearPreview(){ const n={...(previews||{})}; delete n[pvKey]; setPreviews(n); }

    const hasIdeas = ideas.length>0 || favList.length>0;

    return (
      <div className="screen">
        <div className="scr-eyebrow">reference bench</div>
        <h1 className="scr-title">Studio</h1>
        <div className="scr-sub">Set a saved idea beside a saved palette — your one-screen reference while you draw.</div>

        {/* pickers */}
        <button className="studio-slot" onClick={()=>setPickIdea(true)}>
          <span className="studio-slot-lbl">✿ Idea</span>
          {idea
            ? <span className="studio-slot-val">{idea.title}<span className="studio-slot-sub">{idea.kind==="fav"?"saved prompt":(idea.theme?`from “${idea.theme}”`:"saved idea")}</span></span>
            : <span className="studio-slot-empty">tap to choose a saved idea →</span>}
        </button>

        <button className="studio-slot" onClick={()=>setPickPal(true)} style={{marginTop:10}}>
          <span className="studio-slot-lbl">🎨 Palette</span>
          {pal
            ? <span className="studio-slot-val">
                <span className="studio-pal-row">{pal.colors.slice(0,7).map((c,i)=><span key={i} className="studio-pal-dot" style={{background:c.marker.hex}}/>)}</span>
                <span className="studio-slot-sub">{(pal.name||pal.label)} · {pal.note}</span>
              </span>
            : <span className="studio-slot-empty">tap to choose a saved palette →</span>}
        </button>

        {!idea && !pal && (
          <div className="empty big">
            Save an idea from <b style={{color:"var(--accent)"}}>Prompts</b> and a palette from the <b style={{color:"var(--accent)"}}>Palettes</b> tab, then bring them together here.
          </div>
        )}

        {/* the idea, in full */}
        {idea && (
          <div className="card ref-card">
            <div className="ref-eyebrow">✿ the idea</div>
            <div className="ref-title">{idea.title}</div>
            <div className="ref-brief">{idea.brief}</div>
            {idea.kind==="fav" ? (
              <div className="ref-favsketch" dangerouslySetInnerHTML={{__html:window.Sketch.render(idea.shape,"medium")}}/>
            ) : (
              <>
                {detLoad && !detailText && <div className="ask-dots small"><span/><span/><span/></div>}
                {detailText && <div className="idea-detail ref-detail" dangerouslySetInnerHTML={{__html:window.cqFmt(detailText)}}/>}
              </>
            )}
          </div>
        )}

        {/* the palette, in full */}
        {pal && (
          <div className="card ref-card">
            <div className="ref-eyebrow">🎨 the palette · {pal.colors.length} colours</div>
            <div className="ref-title sm">{(pal.name||pal.label)}<span className="muted" style={{fontWeight:400}}> · {pal.note}</span></div>
            <div className="ref-pal-list">
              {pal.colors.map((c,i)=>{
                const L=Math.round(hexLum(c.marker.hex)*100);
                return (
                  <div className="ref-pal-row" key={i}>
                    <span className="ref-pal-sw" style={{background:c.marker.hex}}/>
                    <div className="ref-pal-meta">
                      <div className="ref-pal-top"><b>{codeLabel(c.marker)}</b> <span className="muted">{c.marker.name}</span></div>
                      <div className="ref-pal-bot">
                        <span className="tag ghost">{c.marker.setName}</span>
                        {c.role && <span className="ref-pal-role">{c.role}</span>}
                      </div>
                    </div>
                    <div className="ref-pal-val" title={"value "+L}>
                      <span className="ref-pal-vbar"><span className="ref-pal-vfill" style={{width:L+"%"}}/></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* optional generated preview */}
        {idea && pal && (
          <div className="card ref-card">
            <div className="ref-eyebrow">✨ rough visual preview <span className="muted" style={{textTransform:"none",letterSpacing:0,fontWeight:400}}>· optional</span></div>
            {!preview && !genLoad && (
              <>
                <div className="ref-pv-hint">Want a quick gestural sketch of this idea in these colours? Claude will rough one out — just a thumbnail to react to, not a finished drawing.</div>
                <button className="btn btn-accent wide" style={{marginTop:0}} onClick={generate}>✨ Sketch a rough preview</button>
              </>
            )}
            {genLoad && (
              <div className="ref-pv-frame loading">
                <div className="ask-dots"><span/><span/><span/></div>
                <div className="ref-pv-loadtxt">roughing it out…</div>
              </div>
            )}
            {preview && !genLoad && (
              <>
                <div className="ref-pv-frame" dangerouslySetInnerHTML={{__html:preview}}/>
                <div className="row" style={{gap:10,marginTop:12}}>
                  <button className="btn btn-ghost sm" onClick={generate}>↻ re-sketch</button>
                  <button className="btn btn-ghost sm" onClick={clearPreview}>× clear</button>
                </div>
              </>
            )}
            {genErr && !genLoad && <div className="ask-err">{genErr}</div>}
          </div>
        )}

        {/* idea picker */}
        <window.Sheet open={pickIdea} onClose={()=>setPickIdea(false)} title="your saved ideas">
          {!hasIdeas && <div className="empty">No saved ideas yet — tap ♡ on an idea in <b>Prompts</b> to keep it here.</div>}
          {ideas.length>0 && <div className="lbl" style={{marginTop:0}}>from the idea helper</div>}
          {ideas.map(it=>(
            <button key={it.id} className={"studio-pick-row"+((selIdea&&selIdea.kind==="idea"&&selIdea.id===it.id)?" on":"")}
              onClick={()=>{setSelIdea({kind:"idea",id:it.id});setPickIdea(false);}}>
              <span className="studio-pick-icon">✿</span>
              <span className="studio-pick-txt"><b>{it.title}</b><span>{it.brief}</span></span>
            </button>
          ))}
          {favList.length>0 && <div className="lbl">saved doodle prompts</div>}
          {favList.map(f=>(
            <button key={f.shape} className={"studio-pick-row"+((selIdea&&selIdea.kind==="fav"&&selIdea.id===f.shape)?" on":"")}
              onClick={()=>{setSelIdea({kind:"fav",id:f.shape});setPickIdea(false);}}>
              <span className="studio-pick-mini" dangerouslySetInnerHTML={{__html:window.Sketch.render(f.shape,"medium")}}/>
              <span className="studio-pick-txt"><b>{f.text}</b><span>{window.CATEGORIES[f.cat]||""}</span></span>
            </button>
          ))}
        </window.Sheet>

        {/* palette picker */}
        <window.Sheet open={pickPal} onClose={()=>setPickPal(false)} title="your saved palettes">
          {pals.length===0 && <div className="empty">No saved palettes yet — save one from the <b>Palettes</b> tab.</div>}
          {pals.map(p=>(
            <button key={p.ts} className={"studio-pick-row"+(selPalTs===p.ts?" on":"")}
              onClick={()=>{setSelPalTs(p.ts);setPickPal(false);}}>
              <span className="studio-pick-pal">{p.colors.slice(0,6).map((c,i)=><span key={i} style={{background:c.marker.hex}}/>)}</span>
              <span className="studio-pick-txt"><b>{p.name||p.label}</b><span>{p.note}</span></span>
            </button>
          ))}
        </window.Sheet>
      </div>
    );
  }

  window.StudioScreen = StudioScreen;
})();
