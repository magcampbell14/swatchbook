// ============================================================================
// swatchbook — Pages. Photograph / upload a blank coloring page, then tap
// regions to preview colours from a saved palette or any colour you own.
// Line art is preserved via a multiply composite, so fills read as a real
// colouring preview. Each page remembers its fills + the colours you used.
// ============================================================================
(function(){
  const { useState, useEffect, useRef, useCallback } = React;
  const MAXDIM = 1100;             // working resolution cap
  const DEF_TOL = 42;              // default flood-fill tolerance

  // ---- helpers -------------------------------------------------------------
  const hexToRgb = h=>{const s=h.replace("#","");return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];};
  const colorOf = uid => window.CQ.find(window.ALL, uid);   // {code,name,hex,setName,...}

  // downscale an uploaded image to a JPEG data URL + dims
  function loadAndScale(file){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        let {width:w,height:h}=img;
        const s=Math.min(1, MAXDIM/Math.max(w,h));
        w=Math.round(w*s); h=Math.round(h*s);
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,w,h); x.drawImage(img,0,0,w,h);
        resolve({img:c.toDataURL("image/jpeg",0.85), w, h});
      };
      img.onerror=reject;
      const fr=new FileReader(); fr.onload=()=>{img.src=fr.result;}; fr.onerror=reject; fr.readAsDataURL(file);
    });
  }

  // scanline-ish stack flood fill; writes flat colour into `fill`, bounded by
  // colour difference from the seed (dark line art naturally stops it). After the
  // fill we grow the region a ring or two into adjacent non-line pixels so the
  // colour tucks UNDER anti-aliased outlines instead of leaving a white halo.
  function floodFill(base, fill, w, h, sx, sy, rgb, tol, grow=2){
    const start=(sy*w+sx)*4;
    const sr=base[start], sg=base[start+1], sb=base[start+2];
    // don't fill from a dark seed — that's line art, not a region
    if(sr*0.299+sg*0.587+sb*0.114 < 60) return 0;
    const tol2=tol*tol*3;
    const seen=new Uint8Array(w*h);
    const stack=[sy*w+sx];
    const [fr,fg,fb]=rgb; let n=0;
    let filled=[];
    while(stack.length){
      const p=stack.pop();
      if(seen[p]) continue; seen[p]=1;
      const bi=p*4;
      const dr=base[bi]-sr, dg=base[bi+1]-sg, db=base[bi+2]-sb;
      if(dr*dr+dg*dg+db*db>tol2) continue;
      fill[bi]=fr; fill[bi+1]=fg; fill[bi+2]=fb; fill[bi+3]=255; n++; filled.push(p);
      const x=p%w, y=(p/w)|0;
      if(x>0) stack.push(p-1);
      if(x<w-1) stack.push(p+1);
      if(y>0) stack.push(p-w);
      if(y<h-1) stack.push(p+w);
    }
    // edge tuck: dilate the fill into empty, non-line neighbours
    for(let g=0; n>0 && g<grow; g++){
      const ring=[];
      for(const p of filled){
        const x=p%w, y=(p/w)|0;
        const nb=[]; if(x>0)nb.push(p-1); if(x<w-1)nb.push(p+1); if(y>0)nb.push(p-w); if(y<h-1)nb.push(p+w);
        for(const q of nb){
          const bi=q*4;
          if(fill[bi+3]===255) continue;                                  // already a fill
          if(base[bi]*0.299+base[bi+1]*0.587+base[bi+2]*0.114 < 95) continue; // keep out of line art
          fill[bi]=fr; fill[bi+1]=fg; fill[bi+2]=fb; fill[bi+3]=255; ring.push(q);
        }
      }
      if(!ring.length) break;
      filled=filled.concat(ring);
    }
    return n;
  }

  // composite fill layer under the line art (multiply) into a target ctx
  function compose(ctx, baseCanvas, fillCanvas, w, h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation="source-over"; ctx.drawImage(fillCanvas,0,0);
    ctx.globalCompositeOperation="multiply";    ctx.drawImage(baseCanvas,0,0);
    ctx.globalCompositeOperation="source-over";
  }

  // ---- small gallery thumbnail (base + fills, composited) ------------------
  function PageThumb({page}){
    const ref=useRef(null);
    useEffect(()=>{
      const cv=ref.current; if(!cv) return; let dead=false;
      const base=new Image();
      base.onload=()=>{
        if(dead) return;
        const w=page.w, h=page.h; cv.width=w; cv.height=h;
        const bc=document.createElement("canvas"); bc.width=w; bc.height=h; bc.getContext("2d").drawImage(base,0,0);
        const draw=fc=>{ if(dead) return; compose(cv.getContext("2d"), bc, fc, w, h); };
        if(page.fill){ const fi=new Image(); fi.onload=()=>{const fc=document.createElement("canvas");fc.width=w;fc.height=h;fc.getContext("2d").drawImage(fi,0,0);draw(fc);}; fi.src=page.fill; }
        else { const fc=document.createElement("canvas"); fc.width=w; fc.height=h; draw(fc); }
      };
      base.src=page.img;
      return ()=>{dead=true;};
    },[page.img,page.fill,page.w,page.h]);
    return <canvas ref={ref} className="pg-thumb-cv"/>;
  }

  // ---- editor --------------------------------------------------------------
  function PageEditor({page, onChange, onClose}){
    const viewRef=useRef(null);
    const baseRef=useRef(null);          // offscreen base
    const fillRef=useRef(null);          // offscreen fills
    const baseDataRef=useRef(null);      // cached base ImageData.data
    const wrapRef=useRef(null);
    const [ready,setReady]=useState(false);
    const [tray,setTray]=useState(page.tray||[]);
    const [active,setActive]=useState(page.active||null);
    const [tol,setTol]=useState(page.tol||DEF_TOL);
    const [mode,setMode]=useState("fill");      // fill | move
    const [view,setView]=useState({s:1,x:0,y:0});
    const [history,setHistory]=useState(page.history||[]);
    const [future,setFuture]=useState([]);
    const [manageOpen,setManageOpen]=useState(false);
    const [clearConfirm,setClearConfirm]=useState(false);
    const [pickOpen,setPickOpen]=useState(false);
    const [palOpen,setPalOpen]=useState(false);
    const [usedOpen,setUsedOpen]=useState(false);
    const [tolOpen,setTolOpen]=useState(false);
    const [exportOpen,setExportOpen]=useState(false);
    const [exportBusy,setExportBusy]=useState("");
    const [saved]=window.useLocal("cq-saved",[]);
    const pals=Array.isArray(saved)?saved:[];

    // ---- set up canvases from the stored image ----
    useEffect(()=>{
      let dead=false;
      const img=new Image();
      img.onload=()=>{
        if(dead) return;
        const w=page.w, h=page.h;
        const base=document.createElement("canvas"); base.width=w; base.height=h;
        base.getContext("2d").drawImage(img,0,0,w,h);
        baseRef.current=base;
        baseDataRef.current=base.getContext("2d").getImageData(0,0,w,h).data;
        const fill=document.createElement("canvas"); fill.width=w; fill.height=h;
        fillRef.current=fill;
        const replay=()=>{
          const hist=page.history||[];
          if(!hist.length) return;
          const fctx=fill.getContext("2d");
          const fimg=fctx.getImageData(0,0,w,h);
          hist.forEach(a=>{ const c=colorOf(a.uid); if(c) floodFill(baseDataRef.current, fimg.data, w, h, a.x, a.y, hexToRgb(c.hex), a.tol||page.tol||DEF_TOL); });
          fctx.putImageData(fimg,0,0);
        };
        const done=()=>{ if(dead) return; const v=viewRef.current; v.width=w; v.height=h; redraw(); fitView(); setReady(true); };
        if(page.fill){ const fi=new Image(); fi.onload=()=>{ fill.getContext("2d").drawImage(fi,0,0); done(); }; fi.onerror=()=>{ replay(); done(); }; fi.src=page.fill; }
        else { replay(); done(); }
      };
      img.src=page.img;
      return ()=>{dead=true;};
    // eslint-disable-next-line
    },[]);

    const redraw=useCallback(()=>{
      const v=viewRef.current, b=baseRef.current, f=fillRef.current;
      if(!v||!b||!f) return;
      compose(v.getContext("2d"), b, f, page.w, page.h);
    },[page.w,page.h]);

    function fitView(){
      const wrap=wrapRef.current; if(!wrap) return;
      const cw=wrap.clientWidth, ch=wrap.clientHeight;
      const s=Math.min(cw/page.w, ch/page.h);
      setView({s, x:(cw-page.w*s)/2, y:(ch-page.h*s)/2});
    }

    // persist current state up to the gallery (fill PNG cached + history + tray)
    const persist=useCallback((hist)=>{
      const f=fillRef.current;
      let fillURL=""; try{ fillURL=f?f.toDataURL("image/png"):""; }catch{}
      onChange({...page, fill:fillURL, history:hist, tray, active, tol, updatedAt:Date.now()});
    },[onChange,page,tray,active,tol]);

    // keep tray/active/tol changes saved (cheap — no fill re-encode)
    useEffect(()=>{ if(ready) onChange({...page, tray, active, tol, updatedAt:Date.now()}); /*eslint-disable-next-line*/ },[tray,active,tol]);

    // ---- fill at image pixel ----
    function doFill(px,py){
      if(!active){ setPickOpen(true); return; }
      const w=page.w, h=page.h;
      px=Math.max(0,Math.min(w-1,px|0)); py=Math.max(0,Math.min(h-1,py|0));
      const col=colorOf(active); if(!col) return;
      const fctx=fillRef.current.getContext("2d");
      const fimg=fctx.getImageData(0,0,w,h);
      const n=floodFill(baseDataRef.current, fimg.data, w, h, px, py, hexToRgb(col.hex), tol);
      if(n<3) return;                    // ignore stray taps on lines
      fctx.putImageData(fimg,0,0);
      redraw();
      setFuture([]);
      const hist=[...history,{x:px,y:py,uid:active,tol}];
      setHistory(hist); persist(hist);
    }

    // rebuild the whole fill layer from a history list (used by undo + redo)
    function rebuild(hist){
      const w=page.w, h=page.h;
      const fctx=fillRef.current.getContext("2d");
      fctx.clearRect(0,0,w,h);
      const fimg=fctx.getImageData(0,0,w,h);
      hist.forEach(a=>{ const c=colorOf(a.uid); if(c) floodFill(baseDataRef.current, fimg.data, w, h, a.x, a.y, hexToRgb(c.hex), a.tol||tol); });
      fctx.putImageData(fimg,0,0); redraw();
    }
    function undo(){
      if(!history.length) return;
      const popped=history[history.length-1];
      const hist=history.slice(0,-1);
      setFuture(f=>[...f,popped]);
      rebuild(hist); setHistory(hist); persist(hist);
    }
    function redo(){
      if(!future.length) return;
      const a=future[future.length-1];
      const hist=[...history,a];
      setFuture(future.slice(0,-1));
      rebuild(hist); setHistory(hist); persist(hist);
    }
    function clearAll(){
      const w=page.w, h=page.h;
      fillRef.current.getContext("2d").clearRect(0,0,w,h);
      redraw(); setHistory([]); setFuture([]); persist([]);
    }
    function removeFromTray(uid){
      setTray(t=>{ const nx=t.filter(x=>x!==uid); if(active===uid) setActive(nx[0]||null); return nx; });
    }

    // ---- colours used (from history) ----
    const usedCounts={}; history.forEach(a=>{usedCounts[a.uid]=(usedCounts[a.uid]||0)+1;});
    const usedList=Object.keys(usedCounts).map(uid=>({col:colorOf(uid),count:usedCounts[uid],uid})).filter(x=>x.col)
      .sort((a,b)=>b.count-a.count);

    // secondary (cross-reference) code carried in the name, e.g. "Powder Blue (B220)"
    function altCode(col){ const m=(col.name||"").match(/\(([^)]+)\)/); return m?m[1]:null; }
    function cleanName(col){ return (col.name||"").replace(/\s*\([^)]*\)\s*/," ").trim(); }
    const isOhuhu = col => (col.setId||"").indexOf("ohuhu")===0;

    // build a flat PNG of the current work at full page resolution
    function flatCanvas(){
      const w=page.w, h=page.h;
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      compose(c.getContext("2d"), baseRef.current, fillRef.current, w, h);
      return c;
    }

    // build image + palette legend (codes, names; both codes for Ohuhu when known)
    function paletteCanvas(){
      const img=flatCanvas();
      const W=Math.max(page.w, 780);
      const padX=40, ix=(W-page.w)/2;
      const titleH=76, rowH=70, gapTop=28, botPad=44;
      const rows=usedList.length||1;
      const H=40+page.h+gapTop+titleH+rows*rowH+botPad;
      const c=document.createElement("canvas"); c.width=W; c.height=H;
      const x=c.getContext("2d");
      x.fillStyle="#faf6ef"; x.fillRect(0,0,W,H);
      // image
      x.drawImage(img, ix, 40);
      x.strokeStyle="#e4dccd"; x.lineWidth=1; x.strokeRect(ix+.5,40.5,page.w-1,page.h-1);
      let y=40+page.h+gapTop;
      // title
      x.fillStyle="#1a1320"; x.textBaseline="alphabetic";
      x.font="600 34px Fredoka, sans-serif";
      x.fillText(page.name||"Coloring page", padX, y+34);
      x.font="400 20px Fredoka, sans-serif"; x.fillStyle="#8a7f70";
      x.fillText(`Palette used · ${usedList.length} colour${usedList.length===1?"":"s"}`, padX, y+62);
      y+=titleH+8;
      if(usedList.length===0){
        x.fillStyle="#8a7f70"; x.font="400 22px Fredoka, sans-serif";
        x.fillText("No colours filled yet.", padX, y+30);
      }
      usedList.forEach(({col})=>{
        const sw=48;
        x.fillStyle=col.hex; roundRect(x,padX,y,sw,sw,10); x.fill();
        x.strokeStyle="rgba(0,0,0,.12)"; x.lineWidth=1; roundRect(x,padX+.5,y+.5,sw-1,sw-1,10); x.stroke();
        const tx=padX+sw+18;
        const alt=altCode(col), ohuhu=isOhuhu(col);
        // code line
        x.fillStyle="#1a1320"; x.font="600 25px Fredoka, sans-serif";
        let cx=tx;
        x.fillText(col.code, cx, y+27);
        cx+=x.measureText(col.code).width+12;
        if(ohuhu && alt){
          x.font="400 19px Fredoka, sans-serif"; x.fillStyle="#8a7f70";
          x.fillText("· alt "+alt, cx, y+26);
        }
        // name + set line
        x.font="400 20px Fredoka, sans-serif"; x.fillStyle="#5a5040";
        x.fillText(cleanName(col)+"  —  "+col.setName, tx, y+52);
        y+=rowH;
      });
      return c;
    }
    function roundRect(x,px,py,w,h,r){ x.beginPath(); x.moveTo(px+r,py); x.arcTo(px+w,py,px+w,py+h,r); x.arcTo(px+w,py+h,px,py+h,r); x.arcTo(px,py+h,px,py,r); x.arcTo(px,py,px+w,py,r); x.closePath(); }

    async function saveCanvas(canvas, suffix){
      const name=((page.name||"coloring").replace(/[^\w\s-]/g,"").trim()||"coloring")+suffix;
      await new Promise(res=>{
        canvas.toBlob(async blob=>{
          if(!blob){ res(); return; }
          const file=new File([blob], name+".png", {type:"image/png"});
          try{
            if(navigator.canShare && navigator.canShare({files:[file]})){
              await navigator.share({files:[file], title:page.name||"Coloring page"});
              res(); return;
            }
          }catch(e){ if(e && e.name==="AbortError"){ res(); return; } }
          const url=URL.createObjectURL(blob); const a=document.createElement("a");
          a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(url),1500); res();
        },"image/png");
      });
    }
    async function doExport(kind){
      setExportBusy(kind);
      try{ await saveCanvas(kind==="palette"?paletteCanvas():flatCanvas(), kind==="palette"?"-with-palette":""); }
      catch{}
      finally{ setExportBusy(""); setExportOpen(false); }
    }

    // ---- pointer / gesture handling ----
    const ptrs=useRef(new Map());
    const gesture=useRef(null);         // {sx,sy,moved} for tap detection
    const pinch=useRef(null);
    const toImgXY=(clientX,clientY)=>{
      const r=viewRef.current.getBoundingClientRect();
      return [ (clientX-r.left)/r.width*page.w, (clientY-r.top)/r.height*page.h ];
    };
    function onDown(e){
      e.target.setPointerCapture?.(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size===1){ gesture.current={sx:e.clientX,sy:e.clientY,moved:0}; }
      if(ptrs.current.size===2){ pinch.current=pinchState(); }
    }
    function pinchState(){
      const [a,b]=[...ptrs.current.values()];
      const wrap=wrapRef.current.getBoundingClientRect();
      return { d:Math.hypot(a.x-b.x,a.y-b.y),
               mx:(a.x+b.x)/2-wrap.left, my:(a.y+b.y)/2-wrap.top,
               s:view.s, vx:view.x, vy:view.y };
    }
    function onMove(e){
      if(!ptrs.current.has(e.pointerId)) return;
      const prev=ptrs.current.get(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size>=2 && pinch.current){
        const [a,b]=[...ptrs.current.values()];
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        const p=pinch.current, ratio=d/(p.d||1);
        const ns=Math.max(0.4,Math.min(8,p.s*ratio));
        setView({ s:ns, x:p.mx-(p.mx-p.vx)*(ns/p.s), y:p.my-(p.my-p.vy)*(ns/p.s) });
        if(gesture.current) gesture.current.moved+=99;
        return;
      }
      const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
      if(gesture.current){ gesture.current.moved+=Math.abs(e.clientX-gesture.current.sx)+Math.abs(e.clientY-gesture.current.sy); }
      if(mode==="move"){ setView(v=>({...v,x:v.x+dx,y:v.y+dy})); }
    }
    function onUp(e){
      const wasSingle=ptrs.current.size===1;
      ptrs.current.delete(e.pointerId);
      if(ptrs.current.size<2) pinch.current=null;
      if(mode==="fill" && wasSingle && gesture.current && gesture.current.moved<8){
        const [ix,iy]=toImgXY(e.clientX,e.clientY); doFill(ix,iy);
      }
      gesture.current=null;
    }
    function onWheel(e){
      e.preventDefault();
      const wrap=wrapRef.current.getBoundingClientRect();
      const mx=e.clientX-wrap.left, my=e.clientY-wrap.top;
      const ns=Math.max(0.4,Math.min(8, view.s*(e.deltaY<0?1.12:0.9)));
      setView(v=>({s:ns, x:mx-(mx-v.x)*(ns/v.s), y:my-(my-v.y)*(ns/v.s)}));
    }
    function zoom(f){
      const wrap=wrapRef.current; const mx=wrap.clientWidth/2, my=wrap.clientHeight/2;
      const ns=Math.max(0.4,Math.min(8, view.s*f));
      setView(v=>({s:ns, x:mx-(mx-v.x)*(ns/v.s), y:my-(my-v.y)*(ns/v.s)}));
    }

    const activeCol=active?colorOf(active):null;

    return (
      <div className="page-editor">
        <div className="pg-top">
          <button className="icon-btn" onClick={onClose} aria-label="back to pages">‹</button>
          <input className="pg-name" value={page.name}
            onChange={e=>onChange({...page,name:e.target.value})} maxLength={32} placeholder="untitled page"/>
          <button className="icon-btn" onClick={()=>setExportOpen(true)} title="save image" aria-label="save image">⤓</button>
          <button className="icon-btn" onClick={()=>setUsedOpen(true)} title="colours used" aria-label="colours used">
            <window.Icon name="drop" size={17}/>{usedList.length>0&&<span className="badge">{usedList.length}</span>}
          </button>
        </div>

        <div className="pg-canvas-wrap" ref={wrapRef}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
          style={{cursor: mode==="move"?"grab":"crosshair"}}>
          {!ready && <div className="pg-loading"><div className="ask-dots"><span/><span/><span/></div></div>}
          <canvas ref={viewRef} className="pg-view"
            style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.s})`, transformOrigin:"0 0",
                    touchAction:"none", opacity:ready?1:0}}/>
        </div>

        {/* toolbar */}
        <div className="pg-tools">
          <div className="seg pg-modeseg">
            <button className={mode==="fill"?"active":""} onClick={()=>setMode("fill")}>◧ Fill</button>
            <button className={mode==="move"?"active":""} onClick={()=>setMode("move")}>✋ Move</button>
          </div>
          <div className="pg-tool-sp"/>
          <button className="pg-tbtn" onClick={()=>zoom(0.8)} aria-label="zoom out">−</button>
          <button className="pg-tbtn" onClick={fitView} aria-label="fit">⊡</button>
          <button className="pg-tbtn" onClick={()=>zoom(1.25)} aria-label="zoom in">+</button>
          <button className={"pg-tbtn"+(tolOpen?" on":"")} onClick={()=>setTolOpen(o=>!o)} title="edge sensitivity">◍</button>
          <button className="pg-tbtn" onClick={undo} disabled={!history.length} aria-label="undo">↶</button>
          <button className="pg-tbtn" onClick={redo} disabled={!future.length} aria-label="redo">↷</button>
        </div>
        {tolOpen && (
          <div className="pg-tolrow">
            <span className="sm muted">Fill spread</span>
            <input type="range" min="14" max="90" step="2" value={tol} onChange={e=>setTol(+e.target.value)}/>
            <span className="sm" style={{width:26,textAlign:"right"}}>{tol}</span>
            {!clearConfirm
              ? <button className="pg-tolclear" onClick={()=>setClearConfirm(true)} disabled={!history.length}>clear all</button>
              : <span className="pg-confirm"><button className="pg-tolclear" onClick={()=>{clearAll();setClearConfirm(false);}}>clear</button><button className="pg-tolkeep" onClick={()=>setClearConfirm(false)}>keep</button></span>}
          </div>
        )}

        {/* current colour + dropdown */}
        <div className="pg-colorbar">
          <button className="pg-cc" onClick={()=>setManageOpen(true)}>
            <span className="pg-cc-sw" style={{background:activeCol?activeCol.hex:"transparent",borderStyle:activeCol?"solid":"dashed"}}/>
            <span className="pg-cc-meta">
              {activeCol
                ? <><b>{activeCol.code} · {activeCol.name}</b><span>{tray.length} colour{tray.length===1?"":"s"} ready · tap to switch</span></>
                : <><b>pick a colour</b><span>tap to choose or load a palette</span></>}
            </span>
            <span className="pg-cc-chev">▴</span>
          </button>
          <button className="pg-cc-add" onClick={()=>setPickOpen(true)} aria-label="add a colour you own">＋</button>
        </div>

        {/* manage the working set of colours */}
        <window.Sheet open={manageOpen} onClose={()=>setManageOpen(false)} title="your colours">
          {tray.length===0 && <div className="empty">No colours in your set yet — add one or load a saved palette below.</div>}
          {tray.length>0 && (
            <div className="pg-pal-grid">
              {tray.map(uid=>{ const c=colorOf(uid); if(!c) return null;
                return (
                  <button key={uid} className={"pg-pal-cell"+(active===uid?" on":"")} title={`${c.code} · ${c.name}`}
                    onClick={()=>{setActive(uid);setMode("fill");setManageOpen(false);}}>
                    <span className="pg-pal-dot" style={{background:c.hex}}/>
                    <span className="pg-pal-code">{c.code}</span>
                    <span className="pg-pal-x" role="button" aria-label="remove" onClick={e=>{e.stopPropagation();removeFromTray(uid);}}>×</span>
                  </button>
                ); })}
            </div>
          )}
          <div className="pg-pal-actions">
            <button className="btn btn-accent" onClick={()=>{setManageOpen(false);setPickOpen(true);}}><span className="btn-ico">＋ add a colour you own</span></button>
            <button className="btn btn-ghost" onClick={()=>{setManageOpen(false);setPalOpen(true);}}><span className="btn-ico">🎨 load a saved palette</span></button>
          </div>
        </window.Sheet>

        {/* search a colour you own */}
        <window.Sheet open={pickOpen} onClose={()=>setPickOpen(false)} title="a colour you own">
          <window.ColorPicker selected={active} onPick={uid=>{
            setTray(t=>t.includes(uid)?t:[...t,uid]); setActive(uid); setPickOpen(false);
          }}/>
        </window.Sheet>

        {/* load a saved palette into the tray */}
        <window.Sheet open={palOpen} onClose={()=>setPalOpen(false)} title="load a saved palette">
          {pals.length===0 && <div className="empty">No saved palettes yet — make one in the <b>Palettes</b> tab.</div>}
          {pals.map(p=>(
            <button key={p.ts} className="studio-pick-row" onClick={()=>{
              const uids=p.colors.map(c=>c.marker.uid);
              setTray(t=>[...new Set([...t,...uids])]); setActive(uids[0]||null); setPalOpen(false);
            }}>
              <span className="studio-pick-pal">{p.colors.slice(0,6).map((c,i)=><span key={i} style={{background:c.marker.hex}}/>)}</span>
              <span className="studio-pick-txt"><b>{p.name||p.label}</b><span>{p.colors.length} colours · {p.note}</span></span>
            </button>
          ))}
        </window.Sheet>

        {/* save / export */}
        <window.Sheet open={exportOpen} onClose={()=>setExportOpen(false)} title="save this page">
          <div className="scr-sub" style={{marginBottom:4}}>Saves a PNG — on phones, tap Save to Photos / Save Image from the share sheet.</div>
          <button className="pg-exp-opt" disabled={!!exportBusy} onClick={()=>doExport("flat")}>
            <span className="pg-exp-ic">▦</span>
            <span className="pg-exp-txt"><b>Filled image only</b><span>Just the page as it looks now</span></span>
            {exportBusy==="flat"&&<span className="sm muted">…</span>}
          </button>
          <button className="pg-exp-opt" disabled={!!exportBusy} onClick={()=>doExport("palette")}>
            <span className="pg-exp-ic">◫</span>
            <span className="pg-exp-txt"><b>Image + palette list</b><span>Adds every colour used — codes, names & sets below the art</span></span>
            {exportBusy==="palette"&&<span className="sm muted">…</span>}
          </button>
        </window.Sheet>

        {/* colours used on this page */}
        <window.Sheet open={usedOpen} onClose={()=>setUsedOpen(false)} title={`colours on “${page.name||"this page"}”`}>
          {usedList.length===0 && <div className="empty">Nothing filled yet — tap a region to preview a colour.</div>}
          {usedList.length>0 && <div className="lbl" style={{marginTop:0}}>{usedList.length} colour{usedList.length===1?"":"s"} · {history.length} fill{history.length===1?"":"s"}</div>}
          {usedList.map(({col,count,uid})=>(
            <div className="pg-used-row" key={uid}>
              <span className="pg-used-sw" style={{background:col.hex}}/>
              <div className="pg-used-meta">
                <div className="pg-used-top"><b>{col.code}</b> <span className="muted">{col.name}</span></div>
                <div className="pg-used-bot"><span className="tag ghost">{col.setName}</span></div>
              </div>
              <span className="pg-used-count">×{count}</span>
              <button className="pg-used-use" onClick={()=>{setActive(uid);setTray(t=>t.includes(uid)?t:[...t,uid]);setUsedOpen(false);setMode("fill");}}>use</button>
            </div>
          ))}
        </window.Sheet>
      </div>
    );
  }

  // ---- gallery + upload ----------------------------------------------------
  function PagesScreen(){
    const [pages,setPages]=window.useLocal("cq-pages",[]);
    const list=Array.isArray(pages)?pages:[];
    const [openId,setOpenId]=useState(null);
    const [busy,setBusy]=useState(false);
    const [err,setErr]=useState("");
    const fileRef=useRef(null);

    const openPage=list.find(p=>p.id===openId)||null;

    async function onFile(e){
      const f=e.target.files&&e.target.files[0]; e.target.value="";
      if(!f) return;
      setBusy(true); setErr("");
      try{
        const {img,w,h}=await loadAndScale(f);
        const id="pg"+Date.now();
        const page={id, name:"Page "+(list.length+1), img, w, h, fill:"", history:[], tray:[], active:null, tol:DEF_TOL, createdAt:Date.now(), updatedAt:Date.now()};
        setPages([page,...list]);
        setOpenId(id);
      }catch{ setErr("Couldn’t read that image — try another photo or file."); }
      finally{ setBusy(false); }
    }

    function updatePage(next){
      setPages(prev=>{ const arr=Array.isArray(prev)?prev:[]; 
        try{ return arr.map(p=>p.id===next.id?next:p); }
        catch{ return arr; }
      });
    }
    function delPage(id){ setPages(prev=>(Array.isArray(prev)?prev:[]).filter(p=>p.id!==id)); }

    if(openPage){
      return <PageEditor page={openPage} onChange={updatePage} onClose={()=>setOpenId(null)}/>;
    }

    return (
      <div className="screen">
        <div className="scr-eyebrow">colour it in</div>
        <h1 className="scr-title">Pages</h1>
        <div className="scr-sub">Snap or upload a blank coloring page, then tap to preview your colours before you commit for real.</div>

        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={onFile}/>
        <button className="btn btn-accent wide pg-addbtn" onClick={()=>fileRef.current&&fileRef.current.click()} disabled={busy}>
          {busy?"reading…":"＋  Take or upload a page"}
        </button>
        {err && <div className="ask-err">{err}</div>}

        {list.length===0 && !busy && (
          <div className="empty big">No pages yet.<br/>Add a blank coloring page to start previewing colours on it.</div>
        )}

        {list.length>0 && (
          <div className="pg-grid">
            {list.map(p=>{
              const used=new Set((p.history||[]).map(a=>a.uid)).size;
              return (
                <div className="pg-card" key={p.id}>
                  <button className="pg-card-tap" onClick={()=>setOpenId(p.id)}>
                    <PageThumb page={p}/>
                  </button>
                  <div className="pg-card-foot">
                    <div className="pg-card-meta">
                      <div className="pg-card-name">{p.name}</div>
                      <div className="pg-card-sub">{used?`${used} colour${used===1?"":"s"}`:"untouched"}</div>
                    </div>
                    <button className="pg-card-del" onClick={()=>delPage(p.id)} aria-label="delete page">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  window.PagesScreen = PagesScreen;
})();
