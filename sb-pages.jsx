// ============================================================================
// swatchbook v2 — Pages: snap a coloring page or sketch, tap to fill flat
// color with your real markers, try versions (incl. harmony recolors), get
// shading recs for any area, and switch to coloring mode while you work.
// Data lives in localStorage "cq-pages" (same key as before — older pages are
// migrated in memory: their fills become version "V1").
// ============================================================================
(function(){
  const { useState, useEffect, useRef, useCallback, useMemo } = React;
  const SB = window.SB, CQ = window.CQ;
  const { Icon, Sheet, Chip, groupOf, codeText } = SB;
  const MAXDIM = 1100, DEF_TOL = 42;
  const hexToRgb = h=>{const s=h.replace("#","");return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];};
  const colorOf = uid => window.liveColor({uid});
  const uidHex = uid => { const c=window.ALL.find(x=>x.uid===uid); return c?c.hex:null; };

  // ---------- image + fill engine ----------
  // ---------- page cleanup: find the paper, flatten it, clean the line art ----------
  // 1) paper = the largest bright, low-saturation region (Otsu on brightness, closed so
  //    line art doesn't split it); its 4 corners come from the extreme points.
  // 2) perspective-warp that quad to a flat rectangle.
  // 3) divide out uneven lighting, then keep only dark, unsaturated strokes as black
  //    lines on white — shadows, paper texture and pencil smudges drop out.
  function cv(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
  function otsu(hist,total){ let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
    let sB=0,wB=0,best=0,t=128; for(let i=0;i<256;i++){ wB+=hist[i]; if(!wB) continue; const wF=total-wB; if(!wF) break;
      sB+=i*hist[i]; const mB=sB/wB, mF=(sum-sB)/wF, v=wB*wF*(mB-mF)*(mB-mF); if(v>best){best=v;t=i;} } return t; }
  function morph(m,w,h,r,dilate){ // separable square max/min filter on a 0/1 grid
    const tmp=new Uint8Array(w*h), out=new Uint8Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=dilate?0:1; for(let k=-r;k<=r;k++){ const xx=x+k; if(xx<0||xx>=w) continue; const a=m[y*w+xx]; if(dilate?a:!a){ v=dilate?1:0; break; } } tmp[y*w+x]=v; }
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=dilate?0:1; for(let k=-r;k<=r;k++){ const yy=y+k; if(yy<0||yy>=h) continue; const a=tmp[yy*w+x]; if(dilate?a:!a){ v=dilate?1:0; break; } } out[y*w+x]=v; }
    return out; }
  function solve(A,b){ const n=b.length; for(let i=0;i<n;i++){ let p=i; for(let r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r;
      [A[i],A[p]]=[A[p],A[i]]; [b[i],b[p]]=[b[p],b[i]];
      for(let r=i+1;r<n;r++){ const f=A[r][i]/A[i][i]; for(let c=i;c<n;c++) A[r][c]-=f*A[i][c]; b[r]-=f*b[i]; } }
    const x=new Array(n).fill(0); for(let i=n-1;i>=0;i--){ let s=b[i]; for(let c=i+1;c<n;c++) s-=A[i][c]*x[c]; x[i]=s/A[i][i]; } return x; }
  function homography(src,dst){ // maps dst -> src
    const A=[],b=[]; for(let i=0;i<4;i++){ const [x,y]=dst[i],[u,v]=src[i];
      A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u); A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v); }
    const h=solve(A,b); return (x,y)=>{ const d=h[6]*x+h[7]*y+1; return [(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d]; }; }
  function findPaper(d,W,H){
    const q=6, w=Math.ceil(W/q), h=Math.ceil(H/q), Vs=new Float32Array(w*h), Ss=new Float32Array(w*h), Ds=new Float32Array(w*h), hist=new Array(256).fill(0);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let sv=0,sv2=0,ss=0,n=0;
      for(let yy=y*q;yy<Math.min(H,y*q+q);yy++) for(let xx=x*q;xx<Math.min(W,x*q+q);xx++){ const i=(yy*W+xx)*4, mx=Math.max(d[i],d[i+1],d[i+2]), mn=Math.min(d[i],d[i+1],d[i+2]); sv+=mx; sv2+=mx*mx; ss+=mx?(mx-mn)/mx:0; n++; }
      const mean=sv/n; Vs[y*w+x]=mean; Ss[y*w+x]=ss/n; Ds[y*w+x]=Math.sqrt(Math.max(0,sv2/n-mean*mean)); hist[Math.round(mean)]++; }
    const t=otsu(hist,w*h);
    // paper is bright, unsaturated AND smooth — textured surfaces (carpet, wood grain, fabric) drop out
    let m=new Uint8Array(w*h); for(let i=0;i<w*h;i++) m[i]=(Vs[i]>t && Ss[i]<0.3 && Ds[i]<9)?1:0;
    m=morph(m,w,h,1,false);
    const r=Math.max(2,Math.round(Math.min(w,h)*0.025)); m=morph(morph(m,w,h,r,true),w,h,r,false);
    const lab=new Int32Array(w*h).fill(-1); let bestId=-1,bestN=0,id=0;
    for(let i=0;i<w*h;i++){ if(!m[i]||lab[i]>=0) continue; let n=0; const st=[i]; lab[i]=id;
      while(st.length){ const p=st.pop(); n++; const x=p%w,y=(p/w)|0;
        for(const qq of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]) if(qq>=0&&m[qq]&&lab[qq]<0){ lab[qq]=id; st.push(qq); } }
      if(n>bestN){bestN=n;bestId=id;} id++; }
    if(bestN<0.18*w*h || bestN>0.97*w*h) return null;          // no clear sheet of paper (or it's already a scan)
    let tl=[0,0,Infinity],tr=[0,0,-Infinity],br=[0,0,-Infinity],bl=[0,0,Infinity];
    for(let i=0;i<w*h;i++){ if(lab[i]!==bestId) continue; const x=i%w,y=(i/w)|0;
      if(x+y<tl[2]) tl=[x,y,x+y]; if(x+y>br[2]) br=[x,y,x+y]; if(x-y>tr[2]) tr=[x,y,x-y]; if(x-y<bl[2]) bl=[x,y,x-y]; }
    const pts=[tl,tr,br,bl].map(p=>[(p[0]+0.5)*q,(p[1]+0.5)*q]);
    const cx=pts.reduce((a,p)=>a+p[0],0)/4, cy=pts.reduce((a,p)=>a+p[1],0)/4;
    return pts.map(([x,y])=>[x+(cx-x)*0.015, y+(cy-y)*0.015]);    // tuck in a hair from the paper edge
  }
  function cleanPage(img){
    const s0=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const W=Math.round(img.naturalWidth*s0), H=Math.round(img.naturalHeight*s0);
    const sc=cv(W,H), sx=sc.getContext("2d"); sx.drawImage(img,0,0,W,H);
    const sd=sx.getImageData(0,0,W,H).data;
    const quad=findPaper(sd,W,H);
    // 2) warp (or keep the frame if no paper edge was found)
    let ow,oh,map;
    if(quad){ const top=Math.hypot(quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]), bot=Math.hypot(quad[2][0]-quad[3][0],quad[2][1]-quad[3][1]);
      const lef=Math.hypot(quad[3][0]-quad[0][0],quad[3][1]-quad[0][1]), rig=Math.hypot(quad[2][0]-quad[1][0],quad[2][1]-quad[1][1]);
      let tw=(top+bot)/2, th=(lef+rig)/2; const k=Math.min(1,MAXDIM/Math.max(tw,th)); ow=Math.round(tw*k); oh=Math.round(th*k);
      map=homography(quad,[[0,0],[ow,0],[ow,oh],[0,oh]]);
    } else { const k=Math.min(1,MAXDIM/Math.max(W,H)); ow=Math.round(W*k); oh=Math.round(H*k); map=(x,y)=>[x/k,y/k]; }
    const N=ow*oh, R=new Float32Array(N), G=new Float32Array(N), B=new Float32Array(N);
    for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){ let [u,v]=map(x+0.5,y+0.5); u=Math.max(0,Math.min(W-1.001,u-0.5)); v=Math.max(0,Math.min(H-1.001,v-0.5));
      const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0, i00=(y0*W+x0)*4,i10=i00+4,i01=i00+W*4,i11=i01+4, o=y*ow+x;
      const lerp=c=>(sd[i00+c]*(1-fx)+sd[i10+c]*fx)*(1-fy)+(sd[i01+c]*(1-fx)+sd[i11+c]*fx)*fy;
      R[o]=lerp(0); G[o]=lerp(1); B[o]=lerp(2); }
    // 3) lighting-normalized line extraction
    const L=new Float32Array(N); for(let i=0;i<N;i++) L[i]=0.299*R[i]+0.587*G[i]+0.114*B[i];
    const rad=Math.max(8,Math.round(Math.max(ow,oh)*0.03)), I=new Float64Array((ow+1)*(oh+1));
    for(let y=0;y<oh;y++){ let row=0; for(let x=0;x<ow;x++){ row+=L[y*ow+x]; I[(y+1)*(ow+1)+x+1]=I[y*(ow+1)+x+1]+row; } }
    const out=cv(ow,oh), ox=out.getContext("2d"), od=ox.createImageData(ow,oh);
    for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){
      const x0=Math.max(0,x-rad),x1=Math.min(ow,x+rad+1),y0=Math.max(0,y-rad),y1=Math.min(oh,y+rad+1);
      const mean=(I[y1*(ow+1)+x1]-I[y0*(ow+1)+x1]-I[y1*(ow+1)+x0]+I[y0*(ow+1)+x0])/((x1-x0)*(y1-y0));
      const i=y*ow+x, bg=Math.max(40,mean*1.08), n=L[i]/bg;
      const mx=Math.max(R[i],G[i],B[i]), mn=Math.min(R[i],G[i],B[i]), sat=mx?(mx-mn)/mx:0;
      let v=Math.min(1,Math.max(0,(n-0.45)/(0.75-0.45)));
      if(sat>0.28 && L[i]>55) v=1;                                   // colored-in areas on the page aren't lines
      const g=Math.round(v*255), j=i*4; od.data[j]=od.data[j+1]=od.data[j+2]=g; od.data[j+3]=255; }
    ox.putImageData(od,0,0);
    // 4) if the art has an outer frame (one big connected stroke), trim to it — drops
    //    spiral binding, page numbers and edge noise outside the drawing.
    const q=3, mw=Math.ceil(ow/q), mh=Math.ceil(oh/q); let ink=new Uint8Array(mw*mh);
    for(let y=0;y<oh;y++) for(let x=0;x<ow;x++) if(od.data[(y*ow+x)*4]<128) ink[((y/q)|0)*mw+((x/q)|0)]=1;
    ink=morph(ink,mw,mh,1,true);
    const seen=new Uint8Array(mw*mh); let bb=null,bArea=0;
    for(let i=0;i<mw*mh;i++){ if(!ink[i]||seen[i]) continue; let x0=1e9,y0=1e9,x1=-1,y1=-1; const st=[i]; seen[i]=1;
      while(st.length){ const p=st.pop(), x=p%mw, y=(p/mw)|0; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
        for(const n of [x>0?p-1:-1,x<mw-1?p+1:-1,y>0?p-mw:-1,y<mh-1?p+mw:-1]) if(n>=0&&ink[n]&&!seen[n]){ seen[n]=1; st.push(n); } }
      // union of every sizeable stroke group (small bits — binding rings, specks — are ignored)
      if((x1-x0+1)*(y1-y0+1)>=0.03*mw*mh) bb=bb?[Math.min(bb[0],x0),Math.min(bb[1],y0),Math.max(bb[2],x1),Math.max(bb[3],y1)]:[x0,y0,x1,y1]; }
    if(bb) bArea=(bb[2]-bb[0]+1)*(bb[3]-bb[1]+1);
    if(bb && bArea>0.45*mw*mh && bArea<0.97*mw*mh){
      const pad=Math.round(Math.max(ow,oh)*0.03);
      const cx0=Math.max(0,bb[0]*q-pad), cy0=Math.max(0,bb[1]*q-pad), cx1=Math.min(ow,(bb[2]+1)*q+pad), cy1=Math.min(oh,(bb[3]+1)*q+pad);
      const t=cv(cx1-cx0,cy1-cy0); t.getContext("2d").drawImage(out,cx0,cy0,cx1-cx0,cy1-cy0,0,0,cx1-cx0,cy1-cy0);
      return {img:t.toDataURL("image/jpeg",0.9), w:t.width, h:t.height, cropped:true};
    }
    return {img:out.toDataURL("image/jpeg",0.9), w:ow, h:oh, cropped:!!quad};
  }
  async function readPagePhoto(file){
    const src=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
    const im=await loadImg(src);
    const orig=(()=>{ const k=Math.min(1,MAXDIM/Math.max(im.naturalWidth,im.naturalHeight)); const w=Math.round(im.naturalWidth*k), h=Math.round(im.naturalHeight*k);
      const c=cv(w,h), x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,w,h); x.drawImage(im,0,0,w,h); return {img:c.toDataURL("image/jpeg",0.85),w,h}; })();
    let clean=null; try{ clean=cleanPage(im); }catch(e){ clean=null; }
    return {orig, clean};
  }
  window.SBcleanPage=cleanPage;

  // flood fill bounded by color difference from the seed; grows a ring or two under
  // anti-aliased line art so no white halo is left.
  function floodFill(base, fill, w, h, sx, sy, rgb, tol, grow=2){
    const start=(sy*w+sx)*4;
    const sr=base[start], sg=base[start+1], sb=base[start+2];
    if(sr*0.299+sg*0.587+sb*0.114 < 60) return 0;
    const tol2=tol*tol*3, seen=new Uint8Array(w*h), stack=[sy*w+sx];
    const [fr,fg,fb]=rgb; let n=0, filled=[];
    while(stack.length){
      const p=stack.pop(); if(seen[p]) continue; seen[p]=1;
      const bi=p*4, dr=base[bi]-sr, dg=base[bi+1]-sg, db=base[bi+2]-sb;
      if(dr*dr+dg*dg+db*db>tol2) continue;
      fill[bi]=fr; fill[bi+1]=fg; fill[bi+2]=fb; fill[bi+3]=255; n++; filled.push(p);
      const x=p%w, y=(p/w)|0;
      if(x>0) stack.push(p-1); if(x<w-1) stack.push(p+1); if(y>0) stack.push(p-w); if(y<h-1) stack.push(p+w);
    }
    for(let g=0; n>0 && g<grow; g++){
      const ring=[];
      for(const p of filled){
        const x=p%w, y=(p/w)|0, nb=[];
        if(x>0)nb.push(p-1); if(x<w-1)nb.push(p+1); if(y>0)nb.push(p-w); if(y<h-1)nb.push(p+w);
        for(const q of nb){ const bi=q*4; if(fill[bi+3]===255) continue;
          if(base[bi]*0.299+base[bi+1]*0.587+base[bi+2]*0.114 < 95) continue;
          fill[bi]=fr; fill[bi+1]=fg; fill[bi+2]=fb; fill[bi+3]=255; ring.push(q); }
      }
      if(!ring.length) break; filled=filled.concat(ring);
    }
    return n;
  }
  function compose(ctx, baseCanvas, fillCanvas, w, h){
    ctx.clearRect(0,0,w,h); ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation="source-over"; ctx.drawImage(fillCanvas,0,0);
    ctx.globalCompositeOperation="multiply"; ctx.drawImage(baseCanvas,0,0);
    ctx.globalCompositeOperation="source-over";
  }
  function replayInto(fillCanvas, baseData, w, h, hist, tol){
    const fctx=fillCanvas.getContext("2d"); fctx.clearRect(0,0,w,h);
    const fimg=fctx.getImageData(0,0,w,h);
    hist.forEach(a=>{ const hex=uidHex(a.uid); if(hex) floodFill(baseData, fimg.data, w, h, a.x, a.y, hexToRgb(hex), a.tol||tol); });
    fctx.putImageData(fimg,0,0);
  }
  function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

  // ---------- data model ----------
  const vid = () => "v"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  function migrate(p){
    if(Array.isArray(p.versions)&&p.versions.length) return {...p, ver:Math.min(p.ver||0,p.versions.length-1)};
    return {...p, ver:0, versions:[{id:vid(), name:"V1", history:p.history||[], tray:p.tray||[], active:p.active||null, star:false}]};
  }
  const usesByCount = hist => { const c={}; hist.forEach(a=>{c[a.uid]=(c[a.uid]||0)+1;}); return Object.keys(c).sort((a,b)=>c[b]-c[a]); };
  const countMarkers = p => new Set(((p.versions&&p.versions[p.ver||0]&&p.versions[p.ver||0].history)||p.history||[]).map(a=>a.uid)).size;

  // ---------- thumbnail ----------
  function PageThumb({page}){
    const ref=useRef(null);
    useEffect(()=>{
      const cv=ref.current; if(!cv) return; let dead=false;
      (async()=>{
        try{
          const base=await loadImg(page.img); if(dead) return;
          const w=page.w, h=page.h; cv.width=w; cv.height=h;
          const bc=document.createElement("canvas"); bc.width=w; bc.height=h; bc.getContext("2d").drawImage(base,0,0);
          const fc=document.createElement("canvas"); fc.width=w; fc.height=h;
          if(page.fill){ try{ fc.getContext("2d").drawImage(await loadImg(page.fill),0,0); }catch{} }
          else { const v=(page.versions&&page.versions[page.ver||0])||page; const hist=v.history||[];
            if(hist.length){ const bd=bc.getContext("2d").getImageData(0,0,w,h).data; replayInto(fc,bd,w,h,hist,page.tol||DEF_TOL); } }
          if(!dead) compose(cv.getContext("2d"), bc, fc, w, h);
        }catch{}
      })();
      return ()=>{dead=true;};
    },[page.img,page.fill,page.w,page.h]);
    return <canvas ref={ref} className="sb-thumb-cv" aria-hidden="true"/>;
  }

  // ---------- Pages home ----------
  function PagesScreen(){
    const [pages,setPages]=window.useLocal("cq-pages",[]);
    const list=(Array.isArray(pages)?pages:[]).map(migrate);
    const [openId,setOpenId]=useState(null);
    const [startId,setStartId]=useState(null);
    const [openWith,setOpenWith]=useState(null);
    const [busy,setBusy]=useState(false);
    const [err,setErr]=useState("");
    const [alt,setAlt]=useState(null);           // {id, orig, clean, usingClean} — only while starting a new page
    const fileRef=useRef(null);
    const openPage=list.find(p=>p.id===openId)||null;
    function toggleClean(){
      if(!alt||!alt.clean) return; const p=list.find(x=>x.id===alt.id); if(!p) return;
      const next=alt.usingClean?alt.orig:alt.clean;
      updatePage({...p,img:next.img,w:next.w,h:next.h,fill:""}); setAlt({...alt,usingClean:!alt.usingClean});
    }

    async function onFile(e){
      const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
      setBusy(true); setErr("");
      try{
        const {orig,clean}=await readPagePhoto(f);
        const use=clean||orig;
        const id="pg"+Date.now();
        const page=migrate({id, name:"Page "+(list.length+1), img:use.img, w:use.w, h:use.h, fill:"", history:[], tray:[], active:null, tol:DEF_TOL, createdAt:Date.now(), updatedAt:Date.now()});
        setAlt({id,orig,clean,usingClean:!!clean});
        setPages([page,...list]); setStartId(id);
      }catch{ setErr("Couldn’t read that image — try another photo."); }
      finally{ setBusy(false); }
    }
    const updatePage=useCallback(next=>{
      setPages(prev=>(Array.isArray(prev)?prev:[]).map(p=>p.id===next.id?next:p));
    },[setPages]);
    function delPage(id){ setPages(prev=>(Array.isArray(prev)?prev:[]).filter(p=>p.id!==id)); setOpenId(null); }
    function startWith(id,tray,mode){
      const p=list.find(x=>x.id===id); if(!p) return;
      const versions=p.versions.map((v,i)=>i===p.ver?{...v,tray,active:tray[0]||null}:v);
      updatePage({...p,versions,tray,active:tray[0]||null});
      setStartId(null); setAlt(null); setOpenWith(mode); setOpenId(id);
    }

    if(openPage) return <PageEditor key={openPage.id} page={openPage} onChange={updatePage} onClose={()=>{setOpenId(null);setOpenWith(null);}} onDelete={()=>delPage(openPage.id)} openWith={openWith}/>;

    return (
      <div className="sb-screen">
        <header className="sb-head">
          <h1 className="sb-h1">Pages</h1>
          <button className="sb-btn sb-btn-ink" onClick={()=>fileRef.current&&fileRef.current.click()} disabled={busy}>
            <Icon n="camera" size={20}/><span>{busy?"Reading…":"New page"}</span>
          </button>
        </header>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile}/>
        {err && <div className="sb-err" role="alert">{err}</div>}
        {list.length===0 && !busy && (
          <button className="sb-emptycard" onClick={()=>fileRef.current&&fileRef.current.click()}>
            <Icon n="camera" size={30}/><b>Snap a coloring page or sketch</b><span>Then tap to try colors with your markers.</span>
          </button>
        )}
        {list.length>0 && (
          <div className="sb-pagegrid">
            {list.map(p=>{
              const v=p.versions[p.ver]; const star=p.versions.find(x=>x.star);
              const n=countMarkers(p);
              return (
                <button key={p.id} className="sb-pagecard" onClick={()=>setOpenId(p.id)}>
                  <span className="sb-pagecard-img"><PageThumb page={p}/></span>
                  <span className="sb-pagecard-row"><b>{p.name}</b>{star&&<span className="sb-star">★ {star.name}</span>}</span>
                  <span className="sb-muted sm">{p.versions.length} version{p.versions.length===1?"":"s"} · {n?`${n} marker${n===1?"":"s"}`:"not started"}</span>
                </button>
              );
            })}
            <button className="sb-pagecard sb-addcard" onClick={()=>fileRef.current&&fileRef.current.click()}>
              <Icon n="plus" size={26}/><span>Snap or upload</span>
            </button>
          </div>
        )}
        <StartSheet page={list.find(p=>p.id===startId)} alt={alt} onToggleClean={toggleClean} onClose={()=>{ const id=startId; setStartId(null); if(id){ setOpenWith("pick"); setOpenId(id);} }} onStart={startWith}/>
      </div>
    );
  }

  // ---------- New page: how to start ----------
  const RECIPES={ golden:{h:62,harm:"analogous"}, pastel:{h:325,harm:"triadic",lo:52}, blue:{h:245,harm:"analogous"},
    moody:{h:300,harm:"complementary"}, vibrant:{h:20,harm:"triadic"}, fresh:{h:160,harm:"analogous"},
    earthy:{h:55,harm:"splitComplement"}, vintage:{h:28,harm:"splitComplement"} };
  function StartSheet({page,alt,onToggleClean,onClose,onStart}){
    const [stage,setStage]=useState("choose");
    const [shuffle,setShuffle]=useState(0);
    const [stock]=window.useStock();
    const photoRef=useRef(null);
    const [busy,setBusy]=useState(false);
    useEffect(()=>{ if(page) setStage("choose"); },[page&&page.id]);
    const moods=useMemo(()=>{
      if(stage!=="moods") return [];
      const pool=window.ALL.filter(c=>(stock[c.uid]||"ok")!=="out");
      // each vibe gets its own key hue + harmony (before, every vibe started from hue 0 → all pinks)
      return CQ.MOOD_ORDER.map((m,i)=>{ const rc=RECIPES[m]||{h:i*45,harm:"analogous"};
        const r=CQ.build(pool,{mood:m,harmony:rc.harm,baseHue:(rc.h+shuffle*41)%360,count:7,lo:rc.lo});
        return {id:m,label:CQ.MOODS[m].label,uids:[...new Set(r.colors.map(c=>c.marker&&c.marker.uid).filter(Boolean))]}; });
    },[stage,stock,shuffle]);
    async function onPhoto(e){
      const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f||!page) return;
      setBusy(true);
      try{ const im=await SB.readImageFile(f); const uids=SB.extractFromImage(im,stock,7); onStart(page.id,uids,"photo"); }
      catch{} finally{ setBusy(false); }
    }
    return (
      <Sheet open={!!page} onClose={onClose} title={stage==="moods"?"Pick a vibe":"Start colors from"}>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto}/>
        {stage==="choose" && page && <div className="sb-startprev">
          <img src={page.img} alt="Your page, ready to color"/>
          {alt&&alt.clean && <div className="sb-startprev-txt">
            <b>{alt.usingClean?"Cleaned up":"Original photo"}</b>
            <span className="sb-muted sm">{alt.usingClean?"Cropped to the page, lines cleaned for filling.":"Exactly as you took it."}</span>
            <button className="sb-pillbtn" onClick={onToggleClean}>{alt.usingClean?"Use original":"Use cleaned up"}</button>
          </div>}
        </div>}
        {stage==="choose" && <div className="sb-stack">
          <button className="sb-option" onClick={()=>photoRef.current&&photoRef.current.click()} disabled={busy}>
            <span className="sb-option-ic"><Icon n="photo"/></span>
            <span className="sb-option-txt"><b>{busy?"Reading photo…":"A reference photo"}</b><span>Pulls its colors, matched to your markers</span></span>
          </button>
          <button className="sb-option" onClick={()=>setStage("moods")}>
            <span className="sb-option-ic"><Icon n="spark"/></span>
            <span className="sb-option-txt"><b>A starter palette</b><span>Pick a vibe, tweak from there</span></span>
          </button>
          <button className="sb-option" onClick={()=>page&&onStart(page.id,[],"pick")}>
            <span className="sb-option-ic"><Icon n="blank"/></span>
            <span className="sb-option-txt"><b>Nothing — wing it</b><span>Suggestions appear as you fill</span></span>
          </button>
        </div>}
        {stage==="moods" && <div className="sb-stack">
          {moods.map(m=>(
            <button key={m.id} className="sb-moodrow" onClick={()=>onStart(page.id,m.uids,"mood")}>
              <b>{m.label}</b>
              <span className="sb-strip">{m.uids.map(u=><span key={u} style={{background:uidHex(u)}}/>)}</span>
            </button>
          ))}
          <div className="sb-btnrow"><button className="sb-btn sb-btn-line" onClick={()=>setShuffle(x=>x+1)}><Icon n="spark" size={18}/><span>Shuffle</span></button>
            <button className="sb-btn sb-btn-line" onClick={()=>setStage("choose")}>Back</button></div>
        </div>}
      </Sheet>
    );
  }

  // ---------- the fill screen ----------
  function PageEditor({page,onChange,onClose,onDelete,openWith}){
    const viewRef=useRef(null), baseRef=useRef(null), fillRef=useRef(null), baseDataRef=useRef(null), wrapRef=useRef(null);
    const [stock]=window.useStock();
    const [ready,setReady]=useState(false);
    const [versions,setVersions]=useState(page.versions);
    const [ver,setVer]=useState(page.ver||0);
    const [tol,setTol]=useState(page.tol||DEF_TOL);
    const [view,setView]=useState({s:1,x:0,y:0});
    const [future,setFuture]=useState([]);
    const [pickOpen,setPickOpen]=useState(openWith==="pick");
    const [replaceUid,setReplaceUid]=useState(null);
    const [shade,setShade]=useState(null);         // {uid, context}
    const [moreOpen,setMoreOpen]=useState(false);
    const [newVerOpen,setNewVerOpen]=useState(false);
    const [around,setAround]=useState(null);       // anchor uid for "palettes with this color"
    const [colorMode,setColorMode]=useState(false);
    const [toast,showToast]=SB.useToast();
    const cur=versions[ver]||versions[0];
    const history=cur.history||[], tray=cur.tray||[], active=cur.active||null;

    // ---- set up canvases ----
    useEffect(()=>{
      let dead=false;
      loadImg(page.img).then(img=>{
        if(dead) return;
        const w=page.w, h=page.h;
        const base=document.createElement("canvas"); base.width=w; base.height=h; base.getContext("2d").drawImage(img,0,0,w,h);
        baseRef.current=base; baseDataRef.current=base.getContext("2d").getImageData(0,0,w,h).data;
        const fill=document.createElement("canvas"); fill.width=w; fill.height=h; fillRef.current=fill;
        replayInto(fill, baseDataRef.current, w, h, history, tol);
        const v=viewRef.current; v.width=w; v.height=h; redraw(); fitView(); setReady(true);
      });
      return ()=>{dead=true;};
      // eslint-disable-next-line
    },[]);
    useEffect(()=>{ const r=()=>fitView(); window.addEventListener("resize",r); return ()=>window.removeEventListener("resize",r); });

    const redraw=useCallback(()=>{ const v=viewRef.current,b=baseRef.current,f=fillRef.current; if(v&&b&&f) compose(v.getContext("2d"),b,f,page.w,page.h); },[page.w,page.h]);
    function fitView(){ const wrap=wrapRef.current; if(!wrap) return; const cw=wrap.clientWidth, ch=wrap.clientHeight;
      const s=Math.min(cw/page.w, ch/page.h)*0.98; setView({s, x:(cw-page.w*s)/2, y:(ch-page.h*s)/2}); }

    // ---- persistence ----
    function commit(nextVersions,nextVer=ver,extra={}){
      setVersions(nextVersions); setVer(nextVer);
      let fillURL=page.fill||""; if(extra.encode!==false){ try{ fillURL=fillRef.current?fillRef.current.toDataURL("image/png"):""; }catch{} }
      const v=nextVersions[nextVer];
      onChange({...page, versions:nextVersions, ver:nextVer, fill:fillURL, history:v.history, tray:v.tray, active:v.active, tol, name:extra.name||page.name, updatedAt:Date.now()});
    }
    const setCur=(patch,opts)=>commit(versions.map((v,i)=>i===ver?{...v,...patch}:v),ver,opts);
    function selectUid(uid){ const t=tray.includes(uid)?tray:[...tray,uid]; setCur({tray:t,active:uid},{encode:false}); }

    // ---- filling ----
    function doFill(px,py){
      if(!active){ setPickOpen(true); return; }
      const w=page.w,h=page.h; px=Math.max(0,Math.min(w-1,px|0)); py=Math.max(0,Math.min(h-1,py|0));
      const hex=uidHex(active); if(!hex) return;
      const fctx=fillRef.current.getContext("2d"); const fimg=fctx.getImageData(0,0,w,h);
      const i=(py*w+px)*4; const [r,g,b]=hexToRgb(hex);
      if(fimg.data[i+3]===255 && fimg.data[i]===r && fimg.data[i+1]===g && fimg.data[i+2]===b){ setShade({uid:active,context:"This area"}); return; }
      const n=floodFill(baseDataRef.current, fimg.data, w, h, px, py, [r,g,b], tol);
      if(n<3) return;
      fctx.putImageData(fimg,0,0); redraw(); setFuture([]);
      setCur({history:[...history,{x:px,y:py,uid:active,tol}]});
    }
    function rebuild(hist){ replayInto(fillRef.current, baseDataRef.current, page.w, page.h, hist, tol); redraw(); }
    function undo(){ if(!history.length) return; const popped=history[history.length-1]; const hist=history.slice(0,-1);
      setFuture(f=>[...f,popped]); rebuild(hist); setCur({history:hist}); }
    function switchVersion(i){ if(i===ver) return; setFuture([]); rebuild(versions[i].history||[]); commit(versions,i); }
    function replaceEverywhere(fromUid,toUid){
      const hist=history.map(a=>a.uid===fromUid?{...a,uid:toUid}:a);
      const t=[...new Set(tray.map(u=>u===fromUid?toUid:u))];
      rebuild(hist); setCur({history:hist,tray:t,active:toUid});
      const g=groupOf(toUid); showToast(`Changed to ${g?g.code:""} everywhere`);
    }
    function addVersion(kind,keepNeutral){
      const uses=[...usesByCount(history),...tray.filter(u=>!history.some(a=>a.uid===u))];
      const map=kind==="copy"?{}:SB.harmonyMap(uses,kind,keepNeutral,stock);
      const m=u=>map[u]||u;
      const label=kind==="copy"?"Copy":(SB.SCHEMES.find(s=>s.id===kind)||{}).label;
      const same=versions.filter(v=>v.name===label||v.name.startsWith(label+" ")).length;
      const nv={id:vid(), name:same?`${label} ${same+1}`:label, history:history.map(a=>({...a,uid:m(a.uid)})),
        tray:[...new Set(tray.map(m))], active:active?m(active):null, star:false};
      const next=[...versions,nv]; rebuild(nv.history); commit(next,next.length-1); setNewVerOpen(false);
    }

    // keep the anchor color where it is; give every other filled color a palette member of
    // similar lightness (so the picture keeps its lights and darks), as a new version
    function tryPalette(anchor,uids,label){
      const others=usesByCount(history).filter(u=>u!==anchor);
      const pool=uids.filter(u=>u!==anchor).map(u=>({u,g:groupOf(u)})).filter(x=>x.g);
      const map={}; const taken=new Set();
      others.forEach(u=>{ const g=groupOf(u); if(!g||!pool.length) return;
        const L=g._lch[0]; let best=null,bd=Infinity;
        pool.forEach(p=>{ const d=Math.abs(p.g._lch[0]-L)+(taken.has(p.u)?25:0); if(d<bd){bd=d;best=p;} });
        if(best){ map[u]=best.u; taken.add(best.u); } });
      const nv={id:vid(), name:label, history:history.map(a=>({...a,uid:map[a.uid]||a.uid})), tray:[...new Set([anchor,...uids])], active:anchor, star:false};
      const next=[...versions,nv]; rebuild(nv.history); commit(next,next.length-1);
    }

    // ---- gestures: tap = fill, drag = pan, pinch / wheel = zoom ----
    const ptrs=useRef(new Map()), gesture=useRef(null), pinch=useRef(null);
    const toImg=(cx,cy)=>{ const r=viewRef.current.getBoundingClientRect(); return [(cx-r.left)/r.width*page.w,(cy-r.top)/r.height*page.h]; };
    function onDown(e){ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size===1) gesture.current={sx:e.clientX,sy:e.clientY,moved:0};
      if(ptrs.current.size===2){ const [a,b]=[...ptrs.current.values()]; const r=wrapRef.current.getBoundingClientRect();
        pinch.current={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,s:view.s,vx:view.x,vy:view.y}; } }
    function onMove(e){ if(!ptrs.current.has(e.pointerId)) return; const prev=ptrs.current.get(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size>=2&&pinch.current){ const [a,b]=[...ptrs.current.values()]; const p=pinch.current;
        const ns=Math.max(0.3,Math.min(8,p.s*Math.hypot(a.x-b.x,a.y-b.y)/(p.d||1)));
        setView({s:ns,x:p.mx-(p.mx-p.vx)*(ns/p.s),y:p.my-(p.my-p.vy)*(ns/p.s)}); if(gesture.current) gesture.current.moved=99; return; }
      if(gesture.current){ gesture.current.moved=Math.abs(e.clientX-gesture.current.sx)+Math.abs(e.clientY-gesture.current.sy);
        if(gesture.current.moved>8){ const dx=e.clientX-prev.x, dy=e.clientY-prev.y; setView(v=>({...v,x:v.x+dx,y:v.y+dy})); } } }
    function onUp(e){ const single=ptrs.current.size===1; ptrs.current.delete(e.pointerId); if(ptrs.current.size<2) pinch.current=null;
      if(single&&gesture.current&&gesture.current.moved<8){ const [ix,iy]=toImg(e.clientX,e.clientY); doFill(ix,iy); }
      if(ptrs.current.size===0) gesture.current=null; }
    function onWheel(e){ const r=wrapRef.current.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
      const ns=Math.max(0.3,Math.min(8,view.s*(e.deltaY<0?1.12:0.9))); setView(v=>({s:ns,x:mx-(mx-v.x)*(ns/v.s),y:my-(my-v.y)*(ns/v.s)})); }

    // ---- export ----
    function flatCanvas(){ const c=document.createElement("canvas"); c.width=page.w; c.height=page.h; compose(c.getContext("2d"),baseRef.current,fillRef.current,page.w,page.h); return c; }
    function withListCanvas(){
      const img=flatCanvas(); const used=usesByCount(history).map(groupOf).filter(Boolean);
      const W=Math.max(page.w,780), padX=40, ix=(W-page.w)/2, rowH=66, H=40+page.h+28+70+Math.max(1,used.length)*rowH+40;
      const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
      x.fillStyle="#F5F1E8"; x.fillRect(0,0,W,H); x.drawImage(img,ix,40);
      let y=40+page.h+28; x.fillStyle="#2B2622"; x.font="600 32px Fredoka, sans-serif"; x.fillText(`${page.name} · ${cur.name}`,padX,y+32);
      x.font="400 19px Inter, sans-serif"; x.fillStyle="#6B6359"; x.fillText(`${used.length} marker${used.length===1?"":"s"}`,padX,y+58); y+=78;
      used.forEach(g=>{ x.fillStyle=g.hex; x.fillRect(padX,y,46,46); x.fillStyle="#2B2622"; x.font="600 23px Inter, sans-serif";
        x.fillText(codeText(g),padX+64,y+22); x.font="400 18px Inter, sans-serif"; x.fillStyle="#6B6359";
        x.fillText(`${g.name}${g.oldName&&g.oldName!==g.name?" · was "+g.oldName:""} · ${g.members.map(m=>m.setName).join(", ")}`,padX+64,y+44); y+=rowH; });
      return c;
    }
    async function share(canvas,suffix){
      const name=((page.name||"page").replace(/[^\w\s-]/g,"").trim()||"page")+suffix;
      await new Promise(res=>canvas.toBlob(async blob=>{
        if(!blob) return res(); const file=new File([blob],name+".png",{type:"image/png"});
        try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:page.name}); return res(); } }
        catch(e){ if(e&&e.name==="AbortError") return res(); }
        const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500); res();
      },"image/png"));
    }

    const activeG=active?groupOf(active):null;
    const suggestions=useMemo(()=>SB.suggestFor([...usesByCount(history),...tray],stock,tray),[history,tray,stock]);

    return (
      <div className="sb-editor">
        <header className="sb-ed-top">
          <button className="sb-iconbtn" onClick={onClose} aria-label="Back to pages"><Icon n="back"/></button>
          <h1 className="sb-ed-title">{page.name}</h1>
          <button className="sb-iconbtn" onClick={undo} disabled={!history.length} aria-label="Undo"><Icon n="undo"/></button>
          <button className="sb-iconbtn" onClick={()=>setColorMode(true)} aria-label="Coloring mode"><Icon n="eye"/></button>
          <button className="sb-iconbtn" onClick={()=>setMoreOpen(true)} aria-label="More"><Icon n="more"/></button>
        </header>
        <div className="sb-versions" role="tablist" aria-label="Versions">
          {versions.map((v,i)=>(
            <button key={v.id} role="tab" aria-selected={i===ver} className={"sb-vpill"+(i===ver?" on":"")} onClick={()=>switchVersion(i)}>
              {v.name}{v.star?" ★":""}
            </button>
          ))}
          <button className="sb-vpill add" onClick={()=>setNewVerOpen(true)} aria-label="New version"><Icon n="plus" size={18}/></button>
        </div>

        <div className="sb-canvas-wrap" ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
          {!ready && <div className="sb-loading">Loading…</div>}
          <canvas ref={viewRef} className="sb-view" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.s})`,opacity:ready?1:0}}/>
          {view.s>0 && ready && <button className="sb-fitbtn" onClick={fitView} aria-label="Fit page to screen"><Icon n="fit" size={18}/></button>}
        </div>

        <div className="sb-dock">
          <div className="sb-dock-sel">
            {activeG
              ? <><Chip hex={activeG.hex} size={28}/><span className="sb-dock-code"><b>{codeText(activeG)}</b> <span className="sb-muted">{activeG.name}</span></span>
                  <button className="sb-pillbtn" onClick={()=>setAround(active)}>Palettes</button>
                  <button className="sb-pillbtn" onClick={()=>setShade({uid:active})}>Shading</button></>
              : <span className="sb-muted">Pick a marker, then tap an area</span>}
          </div>
          <div className="sb-tray">
            {tray.map(u=>{ const g=groupOf(u); if(!g) return null; return <TrayPot key={u} g={g} on={u===active} status={SB.groupStatus(g,stock)}
              onTap={()=>{ if(u===active) setShade({uid:u}); else setCur({active:u},{encode:false}); }}
              onLong={()=>{ const t=tray.filter(x=>x!==u); setCur({tray:t,active:active===u?(t[0]||null):active},{encode:false}); showToast(`Removed ${g.code} from this page`); }}/>; })}
            <button className="sb-pot add" onClick={()=>setPickOpen(true)} aria-label="Add a marker"><Icon n="plus" size={20}/></button>
          </div>
          {suggestions.length>0 && (
            <div className="sb-suggest">
              <span className="sb-muted sm">Goes with this page</span>
              {suggestions.map(g=>(
                <button key={g.key} className="sb-sugg" onClick={()=>selectUid(SB.pickUid(g,stock))} aria-label={`Add ${codeText(g)}`}>
                  <span style={{background:g.hex}}/>{g.code}
                </button>
              ))}
            </div>
          )}
        </div>

        <SB.MarkerPicker open={pickOpen||!!replaceUid} title={replaceUid?"Change everywhere to…":"Add a marker"}
          onClose={()=>{setPickOpen(false);setReplaceUid(null);}}
          onPick={g=>{ const u=SB.pickUid(g,stock); if(replaceUid){ replaceEverywhere(replaceUid,u); setReplaceUid(null); } else { selectUid(u); setPickOpen(false); } }}/>

        <Sheet open={!!shade} onClose={()=>setShade(null)} title="Shading">
          {shade && <>
            <SB.ShadeCard group={groupOf(shade.uid)} context={shade.context} onUse={g=>{ selectUid(SB.pickUid(g,stock)); setShade(null); showToast(`${g.code} added to this page`); }}/>
            <button className="sb-btn sb-btn-line wide" onClick={()=>{ const u=shade.uid; setShade(null); setReplaceUid(u); }}><Icon n="swap" size={18}/><span>Change color everywhere</span></button>
          </>}
        </Sheet>

        <AroundSheet anchor={around} onClose={()=>setAround(null)} stock={stock} hasOthers={usesByCount(history).some(u=>u!==around)}
          onAdd={uids=>{ const t=[...new Set([...tray,...uids])]; setCur({tray:t,active:around},{encode:false}); setAround(null); showToast(`Added ${uids.length} markers`); }}
          onTry={(uids,label)=>{ tryPalette(around,uids,label); setAround(null); }}/>
        <NewVersionSheet open={newVerOpen} onClose={()=>setNewVerOpen(false)} page={page} history={history} tray={tray} stock={stock} baseRef={baseRef} baseDataRef={baseDataRef} tol={tol} onPick={addVersion}/>

        <Sheet open={moreOpen} onClose={()=>setMoreOpen(false)} title="Page">
          <label className="sb-field"><span>Name</span>
            <input defaultValue={page.name} maxLength={40} onBlur={e=>{ const n=e.target.value.trim()||page.name; if(n!==page.name) commit(versions,ver,{name:n,encode:false}); }}/>
          </label>
          <div className="sb-menu">
            <button onClick={()=>{ commit(versions.map((v,i)=>({...v,star:i===ver?!v.star:false})),ver,{encode:false}); setMoreOpen(false); }}><Icon n="star"/><span>{cur.star?"Unstar this version":"Star this version"}</span></button>
            <button onClick={()=>{ const uids=[...usesByCount(history),...tray.filter(u=>!history.some(x=>x.uid===u))]; const r=SB.savePalette(uids,"Page",`${page.name} · ${cur.name}`); setMoreOpen(false); showToast(r==="dup"?"Already saved":r?"Saved to Palettes":"Nothing to save yet"); }}><Icon n="palettes"/><span>Save these markers as a palette</span></button>
            <button onClick={async()=>{ await share(flatCanvas(),""); setMoreOpen(false); }}><Icon n="share"/><span>Export image</span></button>
            <button onClick={async()=>{ await share(withListCanvas(),"-markers"); setMoreOpen(false); }}><Icon n="share"/><span>Export image + marker list</span></button>
            {versions.length>1 && <button onClick={()=>{ const next=versions.filter((_,i)=>i!==ver); const nv=Math.max(0,ver-1); rebuild(next[nv].history||[]); commit(next,nv); setMoreOpen(false); }}><Icon n="trash"/><span>Delete version “{cur.name}”</span></button>}
            <button className="danger" onClick={()=>{ if(confirmDelete()) onDelete(); }}><Icon n="trash"/><span>Delete page</span></button>
          </div>
          <div className="sb-label">Fill spread <span className="sb-muted">— raise it if fills stop short on a photo</span></div>
          <input type="range" min="14" max="90" step="2" value={tol} onChange={e=>setTol(+e.target.value)} aria-label="Fill spread" className="sb-range"/>
        </Sheet>
        <SB.Toast msg={toast}/>
        {colorMode && <ColoringMode page={page} version={cur} imgSrc={flatCanvas().toDataURL("image/jpeg",0.9)} history={history} stock={stock} onClose={()=>setColorMode(false)}/>}
      </div>
    );
  }
  function confirmDelete(){ try{ return window.confirm("Delete this page and all its versions?"); }catch{ return true; } }

  function TrayPot({g,on,status,onTap,onLong}){
    const lp=SB.useLongPress(onLong,onTap);
    return <button className={"sb-pot"+(on?" on":"")} style={{background:g.hex}} aria-label={`${codeText(g)} ${g.name}${on?" (selected)":""}`} {...lp}>{status&&<span className={"sb-dot "+status}/>}</button>;
  }

  // ---------- palettes built around one marker ----------
  const AROUND=[["analogous","Analogous","Neighbors — calm"],["complementary","Complementary","Opposite accents"],
    ["splitComplement","Split-comp","Contrast, softer"],["triadic","Triadic","Three-way balance"],["monochrome","Monochrome","One hue, light → dark"]];
  function AroundSheet({anchor,onClose,onAdd,onTry,stock,hasOthers}){
    const [feel,setFeel]=useState("balanced");
    const [spin,setSpin]=useState(0);
    const g=anchor?groupOf(anchor):null;
    const opts=useMemo(()=>{
      if(!anchor) return [];
      const pool=window.ALL.filter(c=>(stock[c.uid]||"ok")!=="out"||c.uid===anchor);
      return AROUND.map(([h,label,sub])=>{ const r=CQ.build(pool,{anchors:[anchor],harmony:h,mood:feel,count:6,reseed:spin,lo:feel==="pastel"?50:undefined});
        const uids=[...new Set(r.colors.map(c=>c.marker&&c.marker.uid).filter(Boolean))];
        if(!uids.includes(anchor)) uids.unshift(anchor);
        return {h,label,sub,uids}; });
    },[anchor,feel,spin,stock]);
    return (
      <Sheet open={!!anchor} onClose={onClose} title={g?`Palettes with ${g.code}`:""} tall>
        <div className="sb-btnrow" style={{marginTop:0}}>
          <div className="sb-seg" role="group" aria-label="Feel">
            {[["pastel","Soft"],["balanced","Balanced"],["vibrant","Bold"]].map(([m,l])=><button key={m} className={feel===m?"on":""} onClick={()=>setFeel(m)}>{l}</button>)}
          </div>
          <button className="sb-pillbtn" onClick={()=>setSpin(x=>x+1)}>Shuffle</button>
        </div>
        {opts.map(o=>(
          <div key={o.h} className="sb-around">
            <div className="sb-around-head"><b>{o.label}</b><span className="sb-muted sm">{o.sub}</span></div>
            <div className="sb-around-chips">
              {o.uids.map(u=>{ const x=groupOf(u); return x && <span key={u} className={"sb-around-chip"+(u===anchor?" anchor":"")}>
                <span className="sb-around-sw" style={{background:x.hex}}/><span className="sm">{x.code}</span></span>; })}
            </div>
            <div className="sb-btnrow" style={{marginTop:8}}>
              <button className="sb-btn sb-btn-line" onClick={()=>onAdd(o.uids)}>Add to page</button>
              {hasOthers && <button className="sb-btn sb-btn-ink" onClick={()=>onTry(o.uids,`${g.code} · ${o.label}`)}>Try it</button>}
            </div>
          </div>
        ))}
      </Sheet>
    );
  }

  // ---------- New version: harmony previews ----------
  function NewVersionSheet({open,onClose,page,history,tray,stock,baseRef,baseDataRef,tol,onPick}){
    const [keep,setKeep]=useState(true);
    const [prev,setPrev]=useState({});
    const uses=useMemo(()=>[...usesByCount(history),...tray.filter(u=>!history.some(a=>a.uid===u))],[history,tray]);
    useEffect(()=>{
      if(!open||!baseRef.current) return; let dead=false;
      const w=page.w,h=page.h, out={};
      const fc=document.createElement("canvas"); fc.width=w; fc.height=h;
      const tmp=document.createElement("canvas"); tmp.width=w; tmp.height=h;
      SB.SCHEMES.forEach(s=>{
        const map=SB.harmonyMap(uses,s.id,keep,stock);
        replayInto(fc,baseDataRef.current,w,h,history.map(a=>({...a,uid:map[a.uid]||a.uid})),tol);
        compose(tmp.getContext("2d"),baseRef.current,fc,w,h);
        const sc=document.createElement("canvas"); const k=320/Math.max(w,h); sc.width=Math.round(w*k); sc.height=Math.round(h*k);
        sc.getContext("2d").drawImage(tmp,0,0,sc.width,sc.height);
        out[s.id]={src:sc.toDataURL("image/jpeg",0.85),chips:[...new Set(uses.map(u=>map[u]||u))].slice(0,7)};
      });
      if(!dead) setPrev(out);
      return ()=>{dead=true;};
    },[open,keep,uses,stock]);
    return (
      <Sheet open={open} onClose={onClose} title="New version" tall>
        {!history.length && <div className="sb-empty">Fill a few areas first — new versions recolor what you’ve filled.</div>}
        <div className="sb-schemes">
          {SB.SCHEMES.map(s=>(
            <button key={s.id} className="sb-scheme" onClick={()=>onPick(s.id,keep)} disabled={!history.length}>
              <span className="sb-scheme-img">{prev[s.id]?<img src={prev[s.id].src} alt=""/>:<span className="sb-loading">…</span>}</span>
              <b>{s.label}</b><span className="sb-muted sm">{s.sub}</span>
              <span className="sb-strip sm">{(prev[s.id]?prev[s.id].chips:[]).map(u=><span key={u} style={{background:uidHex(u)}}/>)}</span>
            </button>
          ))}
        </div>
        <label className="sb-toggle"><span>Keep browns &amp; neutrals</span><input type="checkbox" checked={keep} onChange={e=>setKeep(e.target.checked)}/></label>
        <button className="sb-link" onClick={()=>onPick("copy")}>Or copy as-is and recolor by hand</button>
      </Sheet>
    );
  }

  // ---------- coloring mode ----------
  function ColoringMode({page,version,imgSrc,history,stock,onClose}){
    const counts={}; history.forEach(a=>{counts[a.uid]=(counts[a.uid]||0)+1;});
    const rows=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).map(u=>({u,g:groupOf(u),n:counts[u]})).filter(r=>r.g);
    return (
      <div className="sb-colormode">
        <header className="sb-ed-top">
          <h1 className="sb-ed-title" style={{paddingLeft:8}}>{page.name} <span className="sb-muted">· {version.name}</span></h1>
          <button className="sb-btn sb-btn-ink" onClick={onClose}>Done</button>
        </header>
        <div className="sb-cm-body">
          <img className="sb-cm-img" src={imgSrc} alt={`${page.name}, ${version.name}`}/>
          <div className="sb-cm-list">
            <div className="sb-label">Pull list · {rows.length} marker{rows.length===1?"":"s"} <span className="sb-muted">base → shadow</span></div>
            {rows.length===0 && <div className="sb-empty">Nothing filled on this version yet.</div>}
            {rows.map(({u,g,n})=>{ const st=window.STORAGE.get("cq-stock",{})[u]; const sh=SB.shadeRecs(g,stock).same[0];
              return (
                <div key={u} className="sb-cm-row">
                  <Chip hex={g.hex} size={36}/>
                  <span className="sb-cm-txt"><b>{codeText(g)}{st&&st!=="ok"&&<span className={"sb-flag "+st}>{st==="low"?"LOW":"OUT"}</span>}</b>
                    <span className="sb-muted sm">{g.name} · {n} area{n===1?"":"s"}</span></span>
                  {sh && <span className="sb-cm-shadow"><Icon n="arrow" size={14}/><span className="sb-mini" style={{background:sh.hex}}/>{sh.code}</span>}
                </div>
              ); })}
          </div>
        </div>
      </div>
    );
  }

  window.PagesScreenV2 = PagesScreen;
})();
