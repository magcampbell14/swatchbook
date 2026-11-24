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
  // ---------- real-life results: done pages, photos, compare ----------
  async function renderVersion(page,vi){
    const base=await loadImg(page.img); const w=page.w, h=page.h;
    const bc=document.createElement("canvas"); bc.width=w; bc.height=h; bc.getContext("2d").drawImage(base,0,0);
    const fc=document.createElement("canvas"); fc.width=w; fc.height=h;
    const v=page.versions[vi]||page.versions[0]; const hist=(v&&v.history)||[];
    if(hist.length) replayInto(fc,bc.getContext("2d").getImageData(0,0,w,h).data,w,h,hist,page.tol||DEF_TOL);
    const out=document.createElement("canvas"); out.width=w; out.height=h; compose(out.getContext("2d"),bc,fc,w,h);
    return out;
  }
  // a photo of the finished page: also try a version cropped and straightened to the paper
  async function prepRealPhoto(file){
    const im=await SB.readImageFile(file); const MAXP=1400;
    const nw=im.naturalWidth, nh=im.naturalHeight;
    const k0=Math.min(1,MAXP/Math.max(nw,nh)); const c0=cv(Math.round(nw*k0),Math.round(nh*k0)); c0.getContext("2d").drawImage(im,0,0,c0.width,c0.height);
    const orig={src:c0.toDataURL("image/jpeg",0.82),w:c0.width,h:c0.height};
    let crop=null;
    try{
      const s0=Math.min(1,1600/Math.max(nw,nh)), W=Math.round(nw*s0), H=Math.round(nh*s0);
      const sc=cv(W,H), sx=sc.getContext("2d"); sx.drawImage(im,0,0,W,H); const sd=sx.getImageData(0,0,W,H).data;
      const quad=findPaper(sd,W,H);
      if(quad){
        let a=0; for(let i=0;i<4;i++){ const [x1,y1]=quad[i],[x2,y2]=quad[(i+1)%4]; a+=x1*y2-x2*y1; } a=Math.abs(a)/2;
        if(a>0.25*W*H && a<0.96*W*H){
          const top=Math.hypot(quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]), bot=Math.hypot(quad[2][0]-quad[3][0],quad[2][1]-quad[3][1]);
          const lef=Math.hypot(quad[3][0]-quad[0][0],quad[3][1]-quad[0][1]), rig=Math.hypot(quad[2][0]-quad[1][0],quad[2][1]-quad[1][1]);
          const tw=(top+bot)/2, th=(lef+rig)/2, kk=Math.min(1,MAXP/Math.max(tw,th)); const ow=Math.round(tw*kk), oh=Math.round(th*kk);
          const map=homography(quad,[[0,0],[ow,0],[ow,oh],[0,oh]]);
          const out=cv(ow,oh), ox=out.getContext("2d"), od=ox.createImageData(ow,oh);
          for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){ let [u,v]=map(x+0.5,y+0.5); u=Math.max(0,Math.min(W-1.001,u-0.5)); v=Math.max(0,Math.min(H-1.001,v-0.5));
            const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0,i00=(y0*W+x0)*4,i10=i00+4,i01=i00+W*4,i11=i01+4,j=(y*ow+x)*4;
            for(let c=0;c<3;c++) od.data[j+c]=(sd[i00+c]*(1-fx)+sd[i10+c]*fx)*(1-fy)+(sd[i01+c]*(1-fx)+sd[i11+c]*fx)*fy; od.data[j+3]=255; }
          ox.putImageData(od,0,0); crop={src:out.toDataURL("image/jpeg",0.82),w:ow,h:oh};
        }
      }
    }catch{}
    return {orig,crop};
  }
  const todayISO=()=>{ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  const fmtDate=iso=>{ if(!iso) return ""; const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined,{month:"short",day:"numeric",year:new Date().getFullYear()===y?undefined:"numeric"}); };
  function PhotoThumb({id,onClick,label,children}){
    const r=SB.usePhoto(id);
    return <button className="sb-pthumb" onClick={onClick} aria-label={label}>{r?<img src={r.src} alt=""/>:<span className="sb-loading">…</span>}{children}</button>;
  }

  // mark a page done in real life: which version you followed, when, and photos of the result
  function DoneSheet({open,page,onClose,onSave}){
    const done=page.done||null;
    const [ver,setVer]=useState(null);
    const [at,setAt]=useState(todayISO());
    const [keep,setKeep]=useState([]);
    const [adds,setAdds]=useState([]);
    const [busy,setBusy]=useState(false);
    const fileRef=useRef(null);
    useEffect(()=>{ if(!open) return;
      const star=page.versions.find(v=>v.star);
      setVer(done&&done.ver&&page.versions.some(v=>v.id===done.ver)?done.ver:(star||page.versions[page.ver]||page.versions[0]).id);
      setAt((done&&done.at)||todayISO()); setKeep((done&&done.photos)||[]); setAdds([]);
    },[open]);
    async function onFiles(e){
      const fs=[...(e.target.files||[])]; e.target.value=""; if(!fs.length) return; setBusy(true);
      for(const f of fs.slice(0,6)){ try{ const r=await prepRealPhoto(f); setAdds(a=>[...a,{key:Math.random().toString(36).slice(2),...r,useCrop:!!r.crop}]); }catch{} }
      setBusy(false);
    }
    async function save(){
      setBusy(true);
      const ids=[...keep];
      for(const a of adds){ const p=a.useCrop&&a.crop?a.crop:a.orig; const id="ph_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        try{ await SB.PhotoDB.put({id,pageId:page.id,src:p.src,w:p.w,h:p.h,addedAt:Date.now()}); ids.push(id); }catch{ alert("Couldn’t save a photo — your device may be out of space."); } }
      for(const id of ((done&&done.photos)||[])) if(!keep.includes(id)) { try{ await SB.PhotoDB.del(id); }catch{} }
      setBusy(false);
      onSave({...page,done:{at,ver,photos:ids}});
    }
    async function undone(){
      if(!window.confirm("Move this page back to Up next? Its real-life photos will be removed.")) return;
      for(const id of ((done&&done.photos)||[])) { try{ await SB.PhotoDB.del(id); }catch{} }
      const {done:_d,...rest}=page; onSave(rest);
    }
    return (
      <Sheet open={open} onClose={onClose} title={done?"Done in real life":"Mark done in real life"} tall>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles}/>
        <div className="sb-label">Photos of your finished page</div>
        <div className="sb-pthumbs">
          {keep.map(id=><PhotoThumb key={id} id={id} label="Remove photo" onClick={()=>setKeep(k=>k.filter(x=>x!==id))}><span className="sb-pthumb-x"><Icon n="close" size={12}/></span></PhotoThumb>)}
          {adds.map(a=><div key={a.key} className="sb-padd">
            <img src={(a.useCrop&&a.crop?a.crop:a.orig).src} alt=""/>
            <button className="sb-pthumb-x" onClick={()=>setAdds(x=>x.filter(y=>y!==a))} aria-label="Remove photo"><Icon n="close" size={12}/></button>
            {a.crop && <button className="sb-pillbtn sm" onClick={()=>setAdds(x=>x.map(y=>y===a?{...y,useCrop:!y.useCrop}:y))}>{a.useCrop?"Cropped to page":"Full photo"}</button>}
          </div>)}
          <button className="sb-pthumb add" onClick={()=>fileRef.current&&fileRef.current.click()} disabled={busy}><Icon n="photo" size={22}/><span>{busy?"Reading…":"Add"}</span></button>
        </div>
        <div className="sb-muted sm">Add a few — with and without flash is great. Tap “Cropped to page” to switch to the full photo.</div>
        <div className="sb-label">Version you followed</div>
        <div className="sb-scrollrow">
          {page.versions.map(v=><button key={v.id} className={"sb-pillbtn"+(ver===v.id?" on":"")} onClick={()=>setVer(v.id)}>{v.star?"★ ":""}{v.name}</button>)}
        </div>
        <label className="sb-field"><span>Finished on</span><input type="date" value={at} max={todayISO()} onChange={e=>setAt(e.target.value||todayISO())}/></label>
        <div className="sb-btnrow">
          {done && <button className="sb-btn sb-btn-line" onClick={undone}>Move back to Up next</button>}
          <button className="sb-btn sb-btn-ink" onClick={save} disabled={busy}>{done?"Save":"Mark as done"}</button>
        </div>
      </Sheet>
    );
  }

  // plan vs. real life, side by side (stacked on a phone held upright); tap one to see it big
  function CompareView({page,onClose,onOpen,onSave}){
    const done=page.done||{}; const photos=done.photos||[];
    const vi0=page.versions.findIndex(v=>v.id===done.ver);
    const [vi,setVi]=useState(vi0>=0?vi0:page.ver||0);
    const [pi,setPi]=useState(0);
    const [focus,setFocus]=useState(null);
    const [plan,setPlan]=useState(null);
    const [edit,setEdit]=useState(false);
    useEffect(()=>{ let dead=false; setPlan(null); renderVersion(page,vi).then(c=>{ if(!dead) setPlan(c.toDataURL("image/jpeg",0.9)); }).catch(()=>{}); return ()=>{ dead=true; }; },[vi,page.img,page.updatedAt]);
    useEffect(()=>{ if(pi>=photos.length) setPi(0); },[photos.length]);
    const rec=SB.usePhoto(photos[pi]);
    const v=page.versions[vi]||page.versions[0];
    const uses=usesByCount((v&&v.history)||[]);
    const tap=side=>setFocus(f=>f?null:side);
    return (
      <div className="sb-editor sb-compare">
        <header className="sb-ed-top">
          <button className="sb-iconbtn" onClick={onClose} aria-label="Back to pages"><Icon n="back"/></button>
          <h1 className="sb-ed-title">{page.name}</h1>
          <button className="sb-pillbtn" onClick={()=>setEdit(true)}>Edit</button>
          <button className="sb-pillbtn" onClick={onOpen}>Open page</button>
        </header>
        <div className="sb-cmp-body">
          <div className="sb-muted sm sb-cmp-meta">Done {fmtDate(done.at)} · followed {v?v.name:"—"} · tap a side to see it bigger</div>
          <div className={"sb-cmp-panes"+(focus?" one":"")}>
            {focus!=="real" && <figure className="sb-cmp-pane" onClick={()=>tap("plan")}>
              <div className="sb-cmp-img">{plan?<img src={plan} alt={`Plan, ${v?v.name:""}`}/>:<span className="sb-loading">…</span>}</div>
              <figcaption>Plan · {v?v.name:""}</figcaption></figure>}
            {focus!=="plan" && <figure className="sb-cmp-pane" onClick={()=>photos.length?tap("real"):setEdit(true)}>
              <div className="sb-cmp-img">{photos.length?(rec?<img src={rec.src} alt="Your finished page"/>:<span className="sb-loading">…</span>)
                :<span className="sb-cmp-empty"><Icon n="photo" size={26}/>Add a photo of your finished page</span>}</div>
              <figcaption>Real life{photos.length>1?` · ${pi+1} of ${photos.length}`:""}</figcaption></figure>}
          </div>
          {photos.length>0 && <><div className="sb-label">Photos</div>
            <div className="sb-pthumbs">
              {photos.map((id,i)=><PhotoThumb key={id} id={id} label={`Photo ${i+1}`} onClick={()=>setPi(i)}>{i===pi&&<span className="sb-pthumb-on"/>}</PhotoThumb>)}
              <button className="sb-pthumb add" onClick={()=>setEdit(true)}><Icon n="plus" size={20}/><span>Add</span></button>
            </div></>}
          {page.versions.length>1 && <><div className="sb-label">Compare with version</div>
            <div className="sb-scrollrow">{page.versions.map((x,i)=><button key={x.id} className={"sb-pillbtn"+(i===vi?" on":"")} onClick={()=>setVi(i)}>{x.id===done.ver?"✓ ":""}{x.name}</button>)}</div></>}
          {uses.length>0 && <><div className="sb-label">Markers in this plan · {uses.length}</div>
            <div className="sb-cmp-markers">{uses.map(u=>{ const c=colorOf(u); return <span key={u} className="sb-cmp-mk"><span style={{background:uidHex(u)}}/>{c?c.code:""}</span>; })}</div></>}
        </div>
        <DoneSheet open={edit} page={page} onClose={()=>setEdit(false)} onSave={p=>{ setEdit(false); onSave(p); }}/>
      </div>
    );
  }
  function DoneCard({p,onOpen}){
    const photos=(p.done&&p.done.photos)||[]; const r=SB.usePhoto(photos[0]);
    return (
      <button className="sb-pagecard" onClick={onOpen}>
        <span className="sb-pagecard-img sb-donecover">
          {photos.length ? (r?<img src={r.src} alt=""/>:<span className="sb-loading">…</span>) : <PageThumb page={p}/>}
          {photos.length>0 && <span className="sb-doneinset"><PageThumb page={p}/></span>}
        </span>
        <span className="sb-pagecard-row"><b>{p.name}</b></span>
        <span className="sb-muted sm">Done {fmtDate(p.done.at)}{photos.length?` · ${photos.length} photo${photos.length===1?"":"s"}`:" · add a photo"}</span>
      </button>
    );
  }

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
    const [compareId,setCompareId]=useState(null);
    const [pTab,setPTab]=window.useLocal("sb-pages-tab","todo");
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
    function delPage(id){
      const pg=list.find(p=>p.id===id); ((pg&&pg.done&&pg.done.photos)||[]).forEach(ph=>{ try{ SB.PhotoDB.del(ph); }catch{} });
      setPages(prev=>(Array.isArray(prev)?prev:[]).filter(p=>p.id!==id)); setOpenId(null); setCompareId(null); }
    function startWith(id,tray,mode){
      const p=list.find(x=>x.id===id); if(!p) return;
      const versions=p.versions.map((v,i)=>i===p.ver?{...v,tray,active:tray[0]||null}:v);
      updatePage({...p,versions,tray,active:tray[0]||null});
      setStartId(null); setAlt(null); setOpenWith(mode); setOpenId(id);
    }

    const cmpPage=list.find(p=>p.id===compareId&&p.done);
    if(openPage) return <PageEditor key={openPage.id} page={openPage} onChange={updatePage} onClose={()=>{setOpenId(null);setOpenWith(null);}} onDelete={()=>delPage(openPage.id)} openWith={openWith}
      onCompare={()=>{ setCompareId(openPage.id); setOpenId(null); setOpenWith(null); }}/>;
    if(cmpPage) return <CompareView key={cmpPage.id} page={cmpPage} onClose={()=>setCompareId(null)} onOpen={()=>{ setOpenId(cmpPage.id); setCompareId(null); }} onSave={updatePage}/>;
    const upNext=list.filter(p=>!p.done), doneList=list.filter(p=>p.done).sort((a,b)=>(b.done.at||"").localeCompare(a.done.at||""));
    const view=(pTab==="done")?"done":"todo";

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
          <div className="sb-seg sb-pagetabs" role="tablist" aria-label="Pages">
            <button role="tab" aria-selected={view==="todo"} className={view==="todo"?"on":""} onClick={()=>setPTab("todo")}>Up next · {upNext.length}</button>
            <button role="tab" aria-selected={view==="done"} className={view==="done"?"on":""} onClick={()=>setPTab("done")}>Done · {doneList.length}</button>
          </div>
        )}
        {list.length>0 && view==="done" && (doneList.length===0
          ? <div className="sb-empty">Finished a page on paper? Open it, tap ⋯ → <b>Done in real life</b>, and add a photo to compare it with your plan.</div>
          : <div className="sb-pagegrid">{doneList.map(p=><DoneCard key={p.id} p={p} onOpen={()=>setCompareId(p.id)}/>)}</div>)}
        {list.length>0 && view==="todo" && (
          <div className="sb-pagegrid">
            {upNext.map(p=>{
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
  function StartSheet({page,alt,onToggleClean,onClose,onStart}){
    const [stage,setStage]=useState("choose");
    const [tune,setTune]=useState(null);
    const [stock]=window.useStock();
    const photoRef=useRef(null);
    const [busy,setBusy]=useState(false);
    useEffect(()=>{ if(page){ setStage("choose"); setTune(null); } },[page&&page.id]);
    async function onPhoto(e){
      const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f||!page) return;
      setBusy(true);
      try{ const im=await SB.readImageFile(f); const uids=SB.extractFromImage(im,stock,7); onStart(page.id,uids,"photo"); }
      catch{} finally{ setBusy(false); }
    }
    return (
      <Sheet open={!!page} onClose={onClose} title={stage==="moods"?"Pick a vibe":stage==="tune"?"Shuffle & tune":"Start colors from"} tall={stage!=="choose"}>
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
          <button className="sb-option" onClick={()=>page&&onStart(page.id,[],"try")}>
            <span className="sb-option-ic"><Icon n="palettes"/></span>
            <span className="sb-option-txt"><b>See it filled in</b><span>The whole page in different palettes — vibes, saved, or a photo</span></span>
          </button>
          <button className="sb-option" onClick={()=>page&&onStart(page.id,[],"pick")}>
            <span className="sb-option-ic"><Icon n="blank"/></span>
            <span className="sb-option-txt"><b>Nothing — wing it</b><span>Suggestions appear as you fill</span></span>
          </button>
        </div>}
        {(stage==="moods"||stage==="tune") && <div hidden={stage!=="moods"}>
          <SB.VibeList stock={stock} onOpen={(v,r)=>{ setTune({vibe:v,keys:r.keys,seed:r.seed}); setStage("tune"); }}/>
          <button className="sb-link" onClick={()=>setStage("choose")}>Back</button>
        </div>}
        {stage==="tune" && tune && <SB.PaletteTuner key={tune.vibe+tune.seed} stock={stock} mode="vibe" start={tune} useLabel="Start with these"
          onBack={()=>setStage("moods")} onUse={uids=>onStart(page.id,uids,"mood")}/>}
      </Sheet>
    );
  }

  // ---------- the fill screen ----------
  function PageEditor({page,onChange,onClose,onDelete,openWith,onCompare}){
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
    const [doneOpen,setDoneOpen]=useState(false);
    const [newVerOpen,setNewVerOpen]=useState(openWith==="try");
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
      // a fingertip often lands on the outline of a small shape — slide to the nearest
      // paper pixel within ~16 screen px so tiny areas (apples, buttons) still fill
      const bd=baseDataRef.current, lum=(x,y)=>{ const k=(y*w+x)*4; return bd[k]*0.299+bd[k+1]*0.587+bd[k+2]*0.114; };
      if(lum(px,py)<150){
        const R=Math.max(4,Math.round(16/Math.max(0.2,viewR.current.s))); let found=null;
        for(let r=1;r<=R&&!found;r++){ let bestD=Infinity;
          for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
            const x=px+dx,y=py+dy; if(x<0||y<0||x>=w||y>=h) continue; const d=dx*dx+dy*dy;
            if(d<bestD && lum(x,y)>=150){ bestD=d; found=[x,y]; } } }
        if(!found) return; [px,py]=found;
      }
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
    function redo(){ if(!future.length) return; const op=future[future.length-1]; setFuture(f=>f.slice(0,-1));
      const hex=uidHex(op.uid); if(!hex) return; const w=page.w,h=page.h;
      const fctx=fillRef.current.getContext("2d"), fimg=fctx.getImageData(0,0,w,h);
      floodFill(baseDataRef.current, fimg.data, w, h, op.x, op.y, hexToRgb(hex), op.tol||tol); fctx.putImageData(fimg,0,0); redraw();
      setCur({history:[...history,op]}); }
    function switchVersion(i){ if(i===ver) return; setFuture([]); rebuild(versions[i].history||[]); commit(versions,i); }
    function replaceEverywhere(fromUid,toUid){
      const hist=history.map(a=>a.uid===fromUid?{...a,uid:toUid}:a);
      const t=[...new Set(tray.map(u=>u===fromUid?toUid:u))];
      rebuild(hist); setCur({history:hist,tray:t,active:toUid});
      const g=groupOf(toUid); showToast(`Changed to ${g?g.code:""} everywhere`);
    }
    function addVersion(kind,keepNeutral,seed){
      const uses=[...usesByCount(history),...tray.filter(u=>!history.some(a=>a.uid===u))];
      const map=kind==="copy"?{}:SB.PAL.recolor(uses,kind,{keep:keepNeutral,stock,seed:seed||1});
      const m=u=>map[u]||u;
      const label=kind==="copy"?"Copy":SB.PAL.versionLabel(kind);
      const same=versions.filter(v=>v.name===label||v.name.startsWith(label+" ")).length;
      const nv={id:vid(), name:same?`${label} ${same+1}`:label, history:history.map(a=>({...a,uid:m(a.uid)})),
        tray:[...new Set(tray.map(m))], active:active?m(active):null, star:false};
      const next=[...versions,nv]; rebuild(nv.history); commit(next,next.length-1); setNewVerOpen(false);
    }

    // a palette filled in from Try palettes: fills this version if it's still blank, otherwise
    // becomes a new version (named after the palette)
    function fillAs(hist,uids,label){
      setFuture([]);
      if(!history.length){ rebuild(hist); setCur({history:hist,tray:[...new Set([...uids,...tray])],active:uids[0]||null}); setNewVerOpen(false); showToast(`Filled with ${label}`); return; }
      const same=versions.filter(v=>v.name===label||v.name.startsWith(label+" ")).length;
      const nv={id:vid(), name:same?`${label} ${same+1}`:label, history:hist, tray:[...new Set(uids)], active:uids[0]||null, star:false};
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

    // ---- gestures ----
    // tap = fill · two fingers = zoom + move, anchored between the fingers (like most coloring
    // apps) · a deliberate one-finger drag also moves · mouse wheel zooms on a computer.
    // The page is kept on screen, so it can't get lost off to the side.
    const ptrs=useRef(new Map()), g=useRef(null), viewR=useRef(view); viewR.current=view;
    function clampView(v){
      const wrap=wrapRef.current; if(!wrap) return v; const cw=wrap.clientWidth, ch=wrap.clientHeight;
      const fit=Math.min(cw/page.w,ch/page.h)*0.98, s=Math.max(fit*0.9,Math.min(fit*14,v.s));
      const pw=page.w*s, ph=page.h*s, m=48;
      return {s, x:pw<=cw?(cw-pw)/2:Math.min(m,Math.max(cw-pw-m,v.x)), y:ph<=ch?(ch-ph)/2:Math.min(m,Math.max(ch-ph-m,v.y))};
    }
    const setV=v=>setView(clampView(v));
    const rel=(x,y)=>{ const r=wrapRef.current.getBoundingClientRect(); return [x-r.left,y-r.top]; };
    const toImg=(cx,cy)=>{ const r=viewRef.current.getBoundingClientRect(); return [(cx-r.left)/r.width*page.w,(cy-r.top)/r.height*page.h]; };
    function startPinch(){ const [a,b]=[...ptrs.current.values()]; const [mx,my]=rel((a.x+b.x)/2,(a.y+b.y)/2);
      g.current={...(g.current||{}),multi:true,pinch:{d:Math.hypot(a.x-b.x,a.y-b.y)||1,mx,my,v:viewR.current}}; }
    function onDown(e){ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size===1) g.current={t:Date.now(),sx:e.clientX,sy:e.clientY,moved:0,multi:false,mouse:e.pointerType==="mouse"};
      else if(ptrs.current.size===2) startPinch(); }
    function onMove(e){ if(!ptrs.current.has(e.pointerId)||!g.current) return; const prev=ptrs.current.get(e.pointerId);
      ptrs.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.current.size>=2&&g.current.pinch){ const [a,b]=[...ptrs.current.values()], p=g.current.pinch;
        const [mx,my]=rel((a.x+b.x)/2,(a.y+b.y)/2); const ns=p.v.s*Math.hypot(a.x-b.x,a.y-b.y)/p.d;
        setV({s:ns,x:mx-(p.mx-p.v.x)*(ns/p.v.s),y:my-(p.my-p.v.y)*(ns/p.v.s)}); return; }
      if(ptrs.current.size===1){ g.current.moved=Math.max(g.current.moved,Math.hypot(e.clientX-g.current.sx,e.clientY-g.current.sy));
        if(g.current.moved>(g.current.mouse?5:22)){ const dx=e.clientX-prev.x, dy=e.clientY-prev.y; const v=viewR.current; setV({...v,x:v.x+dx,y:v.y+dy}); } } }
    function onUp(e){ ptrs.current.delete(e.pointerId);
      if(ptrs.current.size===1&&g.current){ g.current.pinch=null; }          // one finger left after a pinch: keep it a move, never a fill
      if(ptrs.current.size===0&&g.current){ const G=g.current; g.current=null;
        if(e.type!=="pointercancel"&&!G.multi&&G.moved<(G.mouse?5:22)&&Date.now()-G.t<800){ const [ix,iy]=toImg(e.clientX,e.clientY); doFill(ix,iy); } } }
    function onWheel(e){ const [mx,my]=rel(e.clientX,e.clientY); const v=viewR.current;
      const ns=v.s*(e.deltaY<0?1.12:0.9); setV({s:ns,x:mx-(mx-v.x)*(ns/v.s),y:my-(my-v.y)*(ns/v.s)}); }

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
        x.fillText(`${g.name}${SB.altName(g)?" · "+SB.altName(g):""} · ${g.members.map(m=>m.setName).join(", ")}`,padX+64,y+44); y+=rowH; });
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
    const suggestions=useMemo(()=>SB.bestFits([...usesByCount(history),...tray],stock,5,true),[history,tray,stock]);

    return (
      <div className="sb-editor">
        <header className="sb-ed-top">
          <button className="sb-iconbtn" onClick={onClose} aria-label="Back to pages"><Icon n="back"/></button>
          <h1 className="sb-ed-title">{page.name}</h1>
          <button className="sb-iconbtn" onClick={undo} disabled={!history.length} aria-label="Undo"><Icon n="undo"/></button>
          <button className="sb-iconbtn" onClick={redo} disabled={!future.length} aria-label="Redo"><Icon n="redo"/></button>
          <button className="sb-iconbtn" onClick={()=>setNewVerOpen(true)} aria-label="Try palettes"><Icon n="spark"/></button>
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
              : <><span className="sb-muted">Pick a marker, then tap an area</span>{!history.length && <button className="sb-pillbtn" onClick={()=>setNewVerOpen(true)}>Try palettes</button>}</>}
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
              <button className="sb-sugg more" onClick={()=>setPickOpen(true)}>More…</button>
            </div>
          )}
        </div>

        <SB.MarkerPicker open={pickOpen||!!replaceUid} title={replaceUid?"Change everywhere to…":"Add a marker"} fitUids={[...usesByCount(history),...tray]}
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
        <NewVersionSheet open={newVerOpen} onClose={()=>setNewVerOpen(false)} page={page} history={history} tray={tray} stock={stock} baseRef={baseRef} baseDataRef={baseDataRef} tol={tol} onPick={addVersion} onFill={fillAs} startTab={openWith==="try"?"vibes":null} ready={ready}/>

        <Sheet open={moreOpen} onClose={()=>setMoreOpen(false)} title="Page">
          <label className="sb-field"><span>Name</span>
            <input defaultValue={page.name} maxLength={40} onBlur={e=>{ const n=e.target.value.trim()||page.name; if(n!==page.name) commit(versions,ver,{name:n,encode:false}); }}/>
          </label>
          <div className="sb-menu">
            {page.done
              ? <button onClick={()=>{ setMoreOpen(false); onCompare&&onCompare(); }}><Icon n="check"/><span>Compare with real life</span></button>
              : <button onClick={()=>{ setMoreOpen(false); setDoneOpen(true); }}><Icon n="check"/><span>Done in real life…</span></button>}
            {page.done && <button onClick={()=>{ setMoreOpen(false); setDoneOpen(true); }}><Icon n="photo"/><span>Real-life photos &amp; details</span></button>}
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
        <DoneSheet open={doneOpen} page={page} onClose={()=>setDoneOpen(false)} onSave={p=>{ const first=!page.done&&p.done; onChange({...p,updatedAt:Date.now()}); setDoneOpen(false); if(first&&onCompare) onCompare(); else showToast(p.done?"Saved":"Moved back to Up next"); }}/>
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
    ["split","Split-comp","Contrast, softer"],["triadic","Triadic","Three-way balance"],["mono","One hue","Light → dark of one color"]];
  function AroundSheet({anchor,onClose,onAdd,onTry,stock,hasOthers}){
    const [feel,setFeel]=useState("balanced");
    const [seeds,setSeeds]=useState({});
    const [tune,setTune]=useState(null);
    const prevRef=useRef({});
    useEffect(()=>{ setTune(null); setSeeds({}); prevRef.current={}; },[anchor]);
    const g=anchor?groupOf(anchor):null;
    const opts=useMemo(()=>{
      if(!anchor) return [];
      return AROUND.map(([h,label,sub])=>{ const seed=seeds[h]||1;
        const r=SB.PAL.around(anchor,h,feel,{seed,stock,avoid:prevRef.current[h]||null});
        return {h,label,sub,uids:r?r.uids:[anchor],keys:r?r.keys:[],seed}; });
    },[anchor,feel,seeds,stock]);
    function spin(h){ const o=opts.find(x=>x.h===h); prevRef.current[h]=o&&o.keys; setSeeds(s=>({...s,[h]:SB.PAL.newSeed()})); }
    function spinAll(){ opts.forEach(o=>{ prevRef.current[o.h]=o.keys; }); setSeeds(Object.fromEntries(AROUND.map(([h])=>[h,SB.PAL.newSeed()]))); }
    return (
      <Sheet open={!!anchor} onClose={onClose} title={g?(tune?`Shuffle & tune · ${g.code}`:`Palettes with ${g.code}`):""} tall>
        {tune && <SB.PaletteTuner key={tune.scheme+tune.seed} stock={stock} mode="around" start={tune} useLabel="Add to page" onBack={()=>setTune(null)}
          onUse={uids=>onAdd(uids)} secondary={hasOthers?[{label:"Try it",onClick:(u,l)=>onTry(u,l)}]:null}/>}
        {!tune && <>
        <div className="sb-btnrow" style={{marginTop:0}}>
          <div className="sb-seg" role="group" aria-label="Feel">
            {[["pastel","Soft"],["balanced","Balanced"],["vibrant","Bold"]].map(([m,l])=><button key={m} className={feel===m?"on":""} onClick={()=>setFeel(m)}>{l}</button>)}
          </div>
          <button className="sb-pillbtn" onClick={spinAll}>Shuffle all</button>
        </div>
        {opts.map(o=>(
          <div key={o.h} className="sb-around">
            <div className="sb-around-head"><b>{o.label}</b><span className="sb-muted sm">{o.sub}</span>
              <button className="sb-iconbtn sb-spin" onClick={()=>spin(o.h)} aria-label={`Shuffle ${o.label}`}><Icon n="spark" size={18}/></button></div>
            <div className="sb-around-chips">
              {o.uids.map(u=>{ const x=groupOf(u); return x && <span key={u} className={"sb-around-chip"+(u===anchor?" anchor":"")}>
                <span className="sb-around-sw" style={{background:x.hex}}/><span className="sm">{x.code}</span></span>; })}
            </div>
            <div className="sb-btnrow" style={{marginTop:8}}>
              <button className="sb-btn sb-btn-line" onClick={()=>setTune({anchor,scheme:o.h,feel,keys:o.keys,seed:o.seed})}>Tune</button>
              <button className="sb-btn sb-btn-line" onClick={()=>onAdd(o.uids)}>Add to page</button>
              {hasOthers && <button className="sb-btn sb-btn-ink" onClick={()=>onTry(o.uids,`${g.code} · ${o.label}`)}>Try it</button>}
            </div>
          </div>
        ))}
        </>}
      </Sheet>
    );
  }

  // ---------- Try palettes: the page filled in with any palette ----------
  // Vibes (generated), My palettes (saved), Photo (from the camera roll) and, once something
  // is filled, Color schemes (recolor what you did). Every card is the whole page filled in;
  // tap one to add or remove colors, re-arrange, and keep it as a version.
  function useProgressive(items){
    const [done,setDone]=useState({});
    const sigs=items.map(it=>it.key+"|"+it.sig).join("\n");
    useEffect(()=>{
      let dead=false, i=0; const todo=items.filter(it=>!done[it.key]||done[it.key].sig!==it.sig);
      function step(){ if(dead||i>=todo.length) return; const it=todo[i++];
        let out=null; try{ out=it.run(); }catch(e){ console.warn(e); }
        if(out) setDone(d=>({...d,[it.key]:{...out,sig:it.sig}}));
        setTimeout(step,0); }
      const t=setTimeout(step,20);
      return ()=>{ dead=true; clearTimeout(t); };
    // eslint-disable-next-line
    },[sigs]);
    return done;
  }
  const savedUids=p=>(p.colors||[]).map(c=>c&&c.marker&&c.marker.uid).filter(u=>u&&groupOf(u));
  function NewVersionSheet({open,onClose,page,history,tray,stock,baseRef,baseDataRef,tol,onPick,onFill,startTab,ready}){
    const P=SB.PAL, A=SB.AUTO;
    const hasHist=history.length>0;
    const segRef=useRef(null), thumbRef=useRef(null), bigRef=useRef(null), photoRef=useRef(null);
    const [segV,setSegV]=useState(0);
    const [tab,setTab]=useState(startTab||"vibes");
    const [keep,setKeep]=useState(true);
    const [fillEmpty,setFillEmpty]=useState(true);
    const [seeds,setSeeds]=useState({});
    const [photos,setPhotos]=useState([]);
    const [detail,setDetail]=useState(null);
    const prevKeys=useRef({});
    useEffect(()=>{ if(open&&startTab) setTab(startTab); if(!open) setDetail(null); },[open]);
    useEffect(()=>{
      if(!open||!baseDataRef.current||!baseRef.current) return;
      if(segRef.current&&segRef.current.tol===tol&&segRef.current.img===page.img) return;
      const t=setTimeout(()=>{ const s=A.segment(baseDataRef.current,page.w,page.h,tol); s.img=page.img; segRef.current=s;
        thumbRef.current=A.makeThumb(s,baseRef.current,300); bigRef.current=A.makeThumb(s,baseRef.current,1100); setSegV(v=>v+1); },40);
      return ()=>clearTimeout(t);
    },[open,tol,page.img,ready]);
    const seg=segRef.current;
    const hsig=history.length+":"+history.slice(-3).map(a=>a.uid+a.x+","+a.y).join(";");
    const groups=useMemo(()=>seg?A.groupsFor(seg,history,{fillEmpty:hasHist?fillEmpty:true}):[],[segV,hsig,fillEmpty]);
    const emptyCount=useMemo(()=>{ if(!seg||!hasHist) return 0; const filled=A.regColorFrom(seg,history); return seg.regions.filter(r=>r.ok&&!filled.has(r.id)).length; },[segV,hsig]);
    const nAuto=Math.max(4,Math.min(7,hasHist?groups.length:6));
    const saved=useMemo(()=>{ if(!open) return []; const l=window.STORAGE.get("cq-saved",[]); return (Array.isArray(l)?l:[]).map(p=>({id:"s"+p.ts,label:p.name||p.label||"Palette",uids:savedUids(p)})).filter(p=>p.uids.length>=2); },[open]);
    const sigBase=`${segV}|${hsig}|${fillEmpty}`;
    // a palette → the page filled in with it
    function fillWith(uids,seed){
      const res=A.assign(seg,groups,uids,{seed});
      const hist=A.toHistory(seg,res,history,tol);
      return {hist,uids};
    }
    function thumbOf(hist){ return A.paintThumb(thumbRef.current,seg,A.regColorFrom(seg,hist)).toDataURL("image/jpeg",0.85); }
    const items=useMemo(()=>{
      if(!seg||!open) return [];
      if(tab==="vibes") return P.VIBE_ORDER.map(v=>{ const sd=seeds["v:"+v]||1; return {key:"v:"+v,sig:`${sigBase}|${sd}|${nAuto}`,label:P.VIBES[v].label,sub:P.VIBES[v].blurb,
        run:()=>{ const pal=P.generate(v,{n:nAuto,seed:sd,stock,avoid:prevKeys.current["v:"+v]||null}); const f=fillWith(pal.uids,1); return {...f,src:thumbOf(f.hist),keys:pal.keys}; }}; });
      if(tab==="saved") return saved.map(p=>{ const sd=seeds[p.id]||1; return {key:p.id,sig:`${sigBase}|${sd}`,label:p.label,sub:`${p.uids.length} colors`,
        run:()=>{ const f=fillWith(p.uids,sd); return {...f,src:thumbOf(f.hist)}; }}; });
      if(tab==="photo") return photos.map(p=>{ const sd=seeds[p.id]||1; return {key:p.id,sig:`${sigBase}|${sd}|${p.uids.join()}`,label:"Photo palette",photo:p.src,
        run:()=>{ const f=fillWith(p.uids,sd); return {...f,src:thumbOf(f.hist)}; }}; });
      if(tab==="schemes") return [...P.VERSION_SCHEMES,...P.VERSION_VIBES].map(c=>{ const sd=seeds["k:"+c.id]||1; return {key:"k:"+c.id,sig:`${segV}|${hsig}|${keep}|${sd}`,label:c.label,sub:c.sub,scheme:c.id,
        run:()=>{ const uses=[...usesByCount(history),...tray.filter(u=>!history.some(a=>a.uid===u))];
          const map=P.recolor(uses,c.id,{keep,stock,seed:sd}); const hist=history.map(a=>({...a,uid:map[a.uid]||a.uid}));
          return {hist,uids:[...new Set(uses.map(u=>map[u]||u))],src:thumbOf(hist)}; }}; });
      return [];
    },[tab,segV,sigBase,seeds,saved,photos,keep,stock,nAuto]);
    const done=useProgressive(items);
    function spin(it){ const d=done[it.key]; if(d&&d.keys) prevKeys.current[it.key]=d.keys; setSeeds(s=>({...s,[it.key]:P.newSeed()})); }
    async function onPhoto(e){
      const fs=[...(e.target.files||[])]; e.target.value="";
      for(const f of fs.slice(0,6)){ try{ const im=await SB.readImageFile(f);
        const c=document.createElement("canvas"); const k=160/Math.max(im.naturalWidth,im.naturalHeight); c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        const uids=SB.extractFromImage(im,stock,6); if(uids.length) setPhotos(ps=>[{id:"p"+Date.now()+Math.random().toString(36).slice(2,5),src:c.toDataURL("image/jpeg",0.8),uids},...ps]); }catch{} }
    }
    function open_(it){ const d=done[it.key]; if(!d) return;
      if(it.scheme){ onPick(it.scheme,keep,seeds[it.key]||1); return; }
      setDetail({key:it.key,label:it.label,uids:d.uids,seed:1,vibe:it.key.startsWith("v:")?it.key.slice(2):null,fromSaved:tab==="saved"}); }
    const TABS=[["vibes","Vibes"],["saved","My palettes"],["photo","Photo"],...(hasHist?[["schemes","Recolor"]]:[])];
    const title=detail?detail.label:"Try palettes";
    return (
      <Sheet open={open} onClose={onClose} title={title} tall>
        <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={onPhoto}/>
        {!seg && open && <div className="sb-empty">Finding the areas on this page…</div>}
        {seg && detail && <TryDetail key={detail.key} d={detail} setD={setDetail} seg={seg} groups={groups} history={history} tol={tol} stock={stock}
          big={bigRef.current} fillWith={fillWith} onFill={onFill} hasHist={hasHist} emptyCount={emptyCount} fillEmpty={fillEmpty} setFillEmpty={setFillEmpty} nAuto={nAuto}/>}
        {seg && !detail && <>
          <div className="sb-scrollrow sb-trytabs" role="tablist">
            {TABS.map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} className={"sb-pillbtn"+(tab===id?" on":"")} onClick={()=>setTab(id)}>{l}</button>)}
          </div>
          <div className="sb-muted sm" style={{margin:"2px 0 10px"}}>
            {tab==="schemes"?"Recolors what you filled, keeping its lights and darks.":
             hasHist?"Your page, filled with each palette — your color choices keep their places.":"Your page, filled in with each palette. Tap one to tweak it."}
            {" "}<Icon n="spark" size={13}/> = another take.
          </div>
          {hasHist && emptyCount>0 && tab!=="schemes" && <label className="sb-toggle"><span>Fill the empty areas too</span><input type="checkbox" checked={fillEmpty} onChange={e=>setFillEmpty(e.target.checked)}/></label>}
          {tab==="saved" && !saved.length && <div className="sb-empty">No saved palettes yet. Save one from the Palettes tab or from a page’s ⋯ menu.</div>}
          {tab==="photo" && <button className="sb-btn sb-btn-line wide" onClick={()=>photoRef.current&&photoRef.current.click()}><Icon n="photo" size={18}/><span>{photos.length?"Add more photos":"Choose photos"}</span></button>}
          {tab==="photo" && !photos.length && <div className="sb-muted sm" style={{marginTop:8}}>Pick one or a few — each becomes a palette from your markers, shown on this page.</div>}
          <div className="sb-schemes" style={{marginTop:10}}>
            {items.map(it=>{ const d=done[it.key]; const fresh=d&&d.sig===it.sig; return (
              <div key={it.key} className="sb-scheme">
                <button className="sb-scheme-pick" onClick={()=>open_(it)} disabled={!d}>
                  <span className={"sb-scheme-img"+(fresh?"":" busy")}>{d?<img src={d.src} alt=""/>:<span className="sb-loading">…</span>}
                    {it.photo && <img className="sb-scheme-photo" src={it.photo} alt=""/>}</span>
                  <b>{it.label}</b>{it.sub&&<span className="sb-muted sm">{it.sub}</span>}
                  <span className="sb-strip sm">{(d?d.uids:[]).slice(0,9).map(u=><span key={u} style={{background:uidHex(u)}}/>)}</span>
                </button>
                <button className="sb-scheme-spin" onClick={()=>spin(it)} aria-label={`Another take on ${it.label}`}><Icon n="spark" size={16}/></button>
              </div>); })}
          </div>
          {tab==="schemes" && <label className="sb-toggle"><span>Keep browns &amp; greys</span><input type="checkbox" checked={keep} onChange={e=>setKeep(e.target.checked)}/></label>}
          {hasHist && <button className="sb-link" onClick={()=>onPick("copy")}>Or copy this version as-is and recolor by hand</button>}
        </>}
      </Sheet>
    );
  }

  // one palette on the page, big: add / remove colors, re-arrange, keep it
  function TryDetail({d,setD,seg,groups,history,tol,stock,big,fillWith,onFill,hasHist,emptyCount,fillEmpty,setFillEmpty,nAuto}){
    const P=SB.PAL, A=SB.AUTO;
    const [picker,setPicker]=useState(false);
    const [peek,setPeek]=useState(false);
    const [hist2,setHist2]=useState([]);
    const canvasRef=useRef(null);
    const f=useMemo(()=>fillWith(d.uids,d.seed),[d.uids,d.seed,groups]);
    useEffect(()=>{ const c=canvasRef.current; if(!c||!big) return;
      const img=A.paintThumb(big,seg,A.regColorFrom(seg,peek?history:f.hist)); c.width=img.width; c.height=img.height; c.getContext("2d").drawImage(img,0,0); },[f,peek]);
    const set=patch=>{ setHist2(h=>[...h.slice(-19),d]); setD({...d,...patch}); };
    const used=new Set(f.hist.map(a=>a.uid));
    function add(g){ setPicker(false); if(!g) return; const u=typeof g==="string"?g:SB.pickUid(g,stock); if(d.uids.includes(u)) return; set({uids:[...d.uids,u]}); }
    function suggest(){ const s=SB.bestFits(d.uids,stock,1,false)[0]; if(s) add(s); }
    return (
      <div className="sb-trydetail">
        <button className="sb-link sb-tuner-back" onClick={()=>setD(null)}><Icon n="back" size={16}/> All palettes</button>
        <div className="sb-trybig" onPointerDown={()=>hasHist&&setPeek(true)} onPointerUp={()=>setPeek(false)} onPointerLeave={()=>setPeek(false)} onPointerCancel={()=>setPeek(false)}>
          <canvas ref={canvasRef}/>
          {hasHist && <span className="sb-trybig-tag">{peek?"Your version":"Hold to compare"}</span>}
        </div>
        <div className="sb-trychips">
          {d.uids.map(u=>{ const g=groupOf(u); return g && (
            <span key={u} className={"sb-trychip"+(used.has(u)?"":" unused")}>
              <span className="sb-trychip-sw" style={{background:g.hex}}/><b>{g.code}</b>
              {d.uids.length>2 && <button onClick={()=>set({uids:d.uids.filter(x=>x!==u)})} aria-label={`Remove ${g.code}`}><Icon n="close" size={12}/></button>}
            </span>); })}
          <button className="sb-trychip add" onClick={()=>setPicker(true)} aria-label="Add a color"><Icon n="plus" size={16}/></button>
        </div>
        <div className="sb-muted sm">{[...used].length<d.uids.length?"Faded colors don’t fit anywhere yet — add more areas or remove one.":"New colors slot in by role: big areas get calm colors, small ones the accents."}</div>
        <div className="sb-nudges" style={{marginTop:10}}>
          <button className="sb-pillbtn" onClick={suggest}><Icon n="plus" size={14}/> Suggest a color</button>
          <button className="sb-pillbtn" onClick={()=>set({seed:P.newSeed()})}><Icon n="spark" size={14}/> Re-arrange</button>
          {d.vibe && <button className="sb-pillbtn" onClick={()=>set({uids:P.generate(d.vibe,{n:d.uids.length||nAuto,seed:P.newSeed(),stock,avoid:d.uids.map(u=>{ const g=groupOf(u); return g&&g.key; })}).uids,seed:1})}><Icon n="spark" size={14}/> New {P.VIBES[d.vibe].label} palette</button>}
          <button className="sb-pillbtn" disabled={!hist2.length} onClick={()=>{ const p=hist2[hist2.length-1]; setHist2(h=>h.slice(0,-1)); setD(p); }}><Icon n="undo" size={14}/> Back</button>
        </div>
        {hasHist && emptyCount>0 && <label className="sb-toggle"><span>Fill the empty areas too</span><input type="checkbox" checked={fillEmpty} onChange={e=>setFillEmpty(e.target.checked)}/></label>}
        <div className="sb-btnrow">
          {!d.fromSaved && <button className="sb-btn sb-btn-line" onClick={()=>{ const r=SB.savePalette(d.uids,"Built",d.label); setD({...d,savedMsg:r==="dup"?"Already saved":"Saved"}); }}>{d.savedMsg||"Save palette"}</button>}
          <button className="sb-btn sb-btn-ink" onClick={()=>onFill(f.hist,d.uids,d.label)}>{hasHist?"Add as version":"Fill this page"}</button>
        </div>
        <SB.MarkerPicker open={picker} onClose={()=>setPicker(false)} onPick={add} title="Add a color" fitUids={d.uids}/>
      </div>
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
