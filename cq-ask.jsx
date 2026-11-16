// ============================================================================
// swatchbook — Idea helper. A toggleable brainstorm at the top of Prompts.
// Describe a theme/mood -> a few brief idea cards. Tap one -> the full how-to.
// Like an idea? Save it to your library. Powered by window.claude.complete.
// ============================================================================
(function(){
  const { useState, useEffect, useRef } = React;

  // ---- inventory context, built once from the real material library ----
  const OWNED = window.SETS.map(s=>{
    const t = (window.MATERIAL_TYPES[s.type]||{}).label || s.type;
    return `• ${s.name} — ${t.toLowerCase()} (${s.colors.length} colours)`;
  }).join("\n");

  // shared knowledge — kept accurate so the detailed view recommends real moves
  const CONTEXT = `swatchbook is a sketchbook app for ONE artist who works in mixed media.

THE ARTIST OWNS:
${OWNED}
Plus finishing tools: a colourless alcohol blender, Posca white paint pens, white gel pens, and Derwent blender + burnisher pencils.

HOW EACH MEDIUM ACTUALLY BEHAVES (be accurate when you recommend one):
• Alcohol markers (Ohuhu): dye in alcohol solvent. Blend wet-into-wet, work light -> dark, a colourless blender feathers edges. Solvent re-wets dye, so keep a "dirty" nib for darks.
• Coloured pencils (Prismacolor, Luminance): wax-based. Build light layers, burnish last to fuse and shine. A complement underneath knocks a colour back for shadow.
• Derwent Inktense: water-soluble INK pencils — dull/matte dry, vivid once water touches them, and PERMANENT once dry (water won't re-lift; alcohol can pull a little).
• Gel pens (Guangna macaron): opaque, sit on top — highlights/accents on dark paper.
• Acrylic brush markers: opaque, light covers dark, let each layer dry before going back.`;

  const IDEAS_SYS = `${CONTEXT}

The artist gives you a THEME, MOOD or loose idea. First react to it, then brainstorm exactly 4 DISTINCT drawing ideas that fit it — things doable in a relaxed sketchbook evening, not masterpieces. Make the four genuinely different from each other in subject or composition.

Return ONLY a JSON object — no prose, no code fences, no trailing text:
{"intro":"...","ideas":[{"title":"...","brief":"..."}, … 4 items]}
• intro — 1 to 2 warm sentences talking TO the artist about their theme: the direction or mood you'd chase, a detail worth leaning into. Specific to what they said, never generic. Do NOT say "here are some ideas".
• title — 2 to 5 words, evocative, no ending punctuation.
• brief — ONE short glanceable sentence, max ~16 words, describing the idea.`;

  function detailPrompt(theme, title, brief){
    return `${CONTEXT}

From a brainstorm about "${theme}", the artist liked this idea:
"${title}" — ${brief}

Help them SEE it first, then tell them how to pull off its signature look. Two parts, in this order:

**The scene** — 3 to 4 vivid sentences painting exactly what's on the page: the focal subject, what surrounds it, the lighting / time of day, the mood, and a simple composition (what sits where, what's big vs small). Lush enough that they can picture the finished spread before drawing a line. This is the important part — spend most of your words here.

**To get the look** — then a few • bullets on how to achieve THIS idea's signature effect (the glow, the mist, the neon edge, the texture, the sparkle — whatever the scene calls for) using THEIR materials. Name the specific move and the order, but only what serves that effect. Skip generic layering advice.

Under ~150 words total. Use **bold** for the key moves. No intro line, no sign-off.`;
  }

  // ---- tiny markdown -> safe html (for the detailed view) ----
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function inline(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>"); }
  function fmt(text){
    const lines = (text||"").replace(/\r/g,"").split("\n");
    let html="", inList=false;
    for(const raw of lines){
      const line = raw.trim();
      if(!line){ if(inList){html+="</ul>";inList=false;} continue; }
      const m = line.match(/^(?:[•\-\*]|\d+[.)])\s+(.*)$/);
      if(m){ if(!inList){ html+="<ul>"; inList=true; } html += "<li>"+inline(m[1])+"</li>"; }
      else { if(inList){ html+="</ul>"; inList=false; } html += "<p>"+inline(line)+"</p>"; }
    }
    if(inList) html+="</ul>";
    return html;
  }
  window.cqFmt = fmt; // reused by Studio for saved-idea detail

  // pull the {intro, ideas} payload out of a model response, tolerating fences /
  // stray text and an older bare-array shape. Returns {intro, ideas} or null.
  function parseIdeas(raw){
    if(!raw) return null;
    let s = raw.trim().replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
    const norm = arr => Array.isArray(arr)
      ? arr.filter(x=>x&&x.title).slice(0,4)
          .map(x=>({title:String(x.title).trim(), brief:String(x.brief||"").trim()}))
      : null;
    // prefer a JSON object {intro, ideas}
    const o1=s.indexOf("{"), o2=s.lastIndexOf("}");
    if(o1>=0 && o2>o1){
      try{
        const obj = JSON.parse(s.slice(o1,o2+1));
        const ideas = norm(obj.ideas);
        if(ideas && ideas.length) return { intro:String(obj.intro||"").trim(), ideas };
      }catch{}
    }
    // fall back to a bare array
    const a=s.indexOf("["), b=s.lastIndexOf("]");
    if(a>=0 && b>a){
      try{
        const ideas = norm(JSON.parse(s.slice(a,b+1)));
        if(ideas && ideas.length) return { intro:"", ideas };
      }catch{}
    }
    return null;
  }

  const CHIPS = [
    { label:"🍂 cozy autumn cabin", q:"a cozy autumn cabin in the woods" },
    { label:"🌊 calm ocean", q:"a calm ocean, something peaceful" },
    { label:"🌙 quiet night scene", q:"a quiet night scene" },
    { label:"🍓 small & sweet", q:"something small and sweet on a little page" },
  ];

  function AskBar(){
    const [open,setOpen]     = window.useLocal("cq-ask-open", true);
    const [theme,setTheme]   = window.useLocal("cq-ask-theme", "");   // last asked theme
    const [ideas,setIdeas]   = window.useLocal("cq-ask-ideas", null); // [{title,brief}]
    const [intro,setIntro]   = window.useLocal("cq-ask-intro", "");   // model's reaction to the theme
    const [input,setInput]   = useState("");
    const [loading,setLoad]  = useState(false);
    const [err,setErr]       = useState("");
    const [openIdx,setOpenIdx]= useState(null);
    const [details,setDetails]= useState({});   // idx -> detail text
    const [detLoad,setDetLoad]= useState(null);  // idx currently fetching
    const [savedIdeas,setSavedIdeas] = window.useLocal("cq-saved-ideas", []);
    const [history,setHistory] = window.useLocal("cq-ask-history", []); // [theme strings], most-recent first
    const [showHist,setShowHist] = useState(false);
    const taRef = useRef(null);

    const grow = el => { if(!el) return; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,140)+"px"; };
    const savedList = Array.isArray(savedIdeas)?savedIdeas:[];
    const histList = Array.isArray(history)?history:[];
    const isSaved = (it)=> savedList.some(s=>s.title===it.title && s.theme===theme);

    function remember(q){
      setHistory(prev=>{
        const arr = Array.isArray(prev)?prev:[];
        return [q, ...arr.filter(h=>h.toLowerCase()!==q.toLowerCase())].slice(0,15);
      });
    }
    function removeHist(h){ setHistory(histList.filter(x=>x!==h)); }
    function clearHist(){ setHistory([]); setShowHist(false); }

    async function ask(qOverride){
      const q = (qOverride ?? input).trim();
      if(!q || loading) return;
      setLoad(true); setErr(""); setIdeas(null); setIntro(""); setOpenIdx(null); setDetails({}); setShowHist(false);
      try{
        if(!window.claude || !window.claude.complete) throw new Error("offline");
        const res = await window.claude.complete(IDEAS_SYS + "\n\n———\nTheme:\n" + q);
        const parsed = parseIdeas(res);
        if(!parsed || parsed.ideas.length===0) throw new Error("parse");
        setTheme(q); setIdeas(parsed.ideas); setIntro(parsed.intro||""); setInput(""); remember(q);
        if(taRef.current) taRef.current.style.height="auto";
      }catch(e){
        setErr("Couldn't reach the idea helper right now — give it another go in a moment.");
      }finally{ setLoad(false); }
    }

    async function toggleIdea(i){
      if(openIdx===i){ setOpenIdx(null); return; }
      setOpenIdx(i);
      if(details[i]!=null || detLoad!=null) return;
      const it = ideas[i];
      setDetLoad(i);
      try{
        if(!window.claude || !window.claude.complete) throw new Error("offline");
        const res = await window.claude.complete(detailPrompt(theme, it.title, it.brief));
        setDetails(d=>({...d,[i]:(res||"").trim()}));
      }catch(e){
        setDetails(d=>({...d,[i]:"__ERR__"}));
      }finally{ setDetLoad(null); }
    }

    function toggleSave(i){
      const it = ideas[i];
      if(isSaved(it)){
        setSavedIdeas(savedList.filter(s=>!(s.title===it.title && s.theme===theme)));
      }else{
        const rec = { id:Date.now()+"-"+i, theme, title:it.title, brief:it.brief,
          detail: details[i] && details[i]!=="__ERR__" ? details[i] : null, ts:Date.now() };
        setSavedIdeas([rec, ...savedList].slice(0,40));
      }
    }

    function clearAll(){ setIdeas(null); setIntro(""); setTheme(""); setOpenIdx(null); setDetails({}); setErr(""); }

    return (
      <div className="ask-wrap">
        <button className="ask-head" onClick={()=>setOpen(!open)} aria-expanded={open}>
          <span className="ask-head-l">
            <span className="ask-spark">✨</span>
            <span>
              Idea helper
              <span className="ask-tagline">describe a theme or mood — I’ll spark a few directions</span>
            </span>
          </span>
          <span className="ask-chev">{open ? "▾" : "▸"}</span>
        </button>

        {open && (
          <div className="ask-body">
            <div className="ask-chips">
              {CHIPS.map((c,i)=>(
                <button key={i} className="ask-chip" disabled={loading}
                  onClick={()=>{ setInput(c.q); ask(c.q); }}>{c.label}</button>
              ))}
            </div>

            <div className="ask-inputrow">
              <textarea ref={taRef} className="ask-input" rows={1}
                placeholder="e.g. “misty mountain lake”, “rainy window”, “tiny still life”…"
                value={input}
                onChange={e=>{ setInput(e.target.value); grow(e.target); }}
                onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); ask(); } }}/>
              <button className="ask-send" disabled={loading || !input.trim()} onClick={()=>ask()} aria-label="send">
                {loading ? "…" : "↑"}
              </button>
            </div>

            {histList.length>0 && (
              <div className="ask-hist">
                <button className="ask-recents" onClick={()=>setShowHist(s=>!s)} aria-expanded={showHist}>
                  <span>🕘 your prompt history · {histList.length}</span>
                  <span className="ask-recents-chev">{showHist?"▾":"▸"}</span>
                </button>
                {showHist && (
                  <div className="ask-histlist">
                    {histList.map((h,i)=>(
                      <div className="ask-histchip" key={i}>
                        <button className="ask-histtext" disabled={loading} title="run this prompt again"
                          onClick={()=>{ setShowHist(false); setInput(h); ask(h); }}>
                          {i===0 && <span className="ask-histlast">last</span>}{h}
                        </button>
                        <button className="ask-histx" onClick={()=>removeHist(h)} aria-label="remove from history">×</button>
                      </div>
                    ))}
                    <button className="ask-histclear" onClick={clearHist}>clear history</button>
                  </div>
                )}
              </div>
            )}

            {loading && <div className="ask-dots"><span/><span/><span/></div>}
            {err && !loading && <div className="ask-err">{err}</div>}

            {ideas && !loading && (
              <div className="ask-result">
                <div className="ask-asked">ideas for “{theme}” · tap one for the full how-to</div>
                {intro && <div className="ask-answer ask-intro">{intro}</div>}
                <div className="idea-list">
                  {ideas.map((it,i)=>{
                    const isOpen = openIdx===i;
                    const det = details[i];
                    return (
                      <div key={i} className={"idea-card"+(isOpen?" open":"")}>
                        <div className="idea-head" role="button" tabIndex={0}
                          onClick={()=>toggleIdea(i)}
                          onKeyDown={e=>{if(e.key==="Enter")toggleIdea(i);}}>
                          <span className="idea-num">{i+1}</span>
                          <span className="idea-htext">
                            <span className="idea-title">{it.title}</span>
                            <span className="idea-brief">{it.brief}</span>
                          </span>
                          <button className={"idea-heart"+(isSaved(it)?" on":"")}
                            onClick={e=>{e.stopPropagation();toggleSave(i);}}
                            title={isSaved(it)?"saved — tap to remove":"save to your library"}>
                            {isSaved(it)?"♥":"♡"}
                          </button>
                          <span className="idea-chev">▸</span>
                        </div>
                        {isOpen && (
                          <div className="idea-body">
                            {detLoad===i && <div className="ask-dots small"><span/><span/><span/></div>}
                            {det==="__ERR__" && <div className="ask-err" style={{marginTop:0}}>Couldn’t load the details — tap again to retry.</div>}
                            {det && det!=="__ERR__" && (
                              <div className="idea-detail" dangerouslySetInnerHTML={{__html:fmt(det)}}/>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{gap:10,marginTop:14,flexWrap:"wrap"}}>
                  <button className="btn btn-accent sm" disabled={loading} onClick={()=>ask(theme)}>↻ different ideas</button>
                  <button className="btn btn-ghost sm" onClick={clearAll}>clear</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  window.AskBar = AskBar;
  window.cqDetailPrompt = detailPrompt;   // reused by Studio to fill in missing detail
})();
