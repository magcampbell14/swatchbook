// ============================================================================
// swatchbook v2 — auto-fill: see a whole page in any palette.
//
//   segment()  finds every fillable area of the line art, using exactly the flood-fill
//              rule the editor uses, so an auto-filled version is just a normal history
//              (one tap per area) — undo, versions, export and coloring mode all work.
//   groupsFor() decides which areas share a color:
//              · areas you already filled keep their grouping (everything that was one
//                marker stays one color), and remember how light/dark they were
//              · empty areas are grouped by repeated shape (all the starfish together),
//                and a group of touching areas (a tile pattern) is split so neighbors differ
//   assign()   gives each group a palette color by ROLE — the biggest areas get the calmest
//              colors (the base), the smallest get the boldest (accents), lights stay light
//              on a page you filled, and touching areas are kept apart. Adding a color to
//              the palette re-runs this, so the new color lands where its role fits.
// Wrapped in an IIFE: babel scripts share one global scope.
// ============================================================================
(function(){
  const SB=window.SB, P=SB.PAL;
  const { groupOf } = SB;

  // ---------- regions ----------
  function segment(bd,w,h,tol){
    const N=w*h, lab=new Int32Array(N).fill(-1), tol2=tol*tol*3, stack=new Int32Array(N);
    const regions=[]; const minA=Math.max(24,Math.round(N*0.00003));
    for(let p0=0;p0<N;p0++){
      if(lab[p0]!==-1) continue; const i0=p0*4;
      if(bd[i0]*0.299+bd[i0+1]*0.587+bd[i0+2]*0.114<230) continue;
      const sr=bd[i0],sg=bd[i0+1],sb=bd[i0+2], id=regions.length;
      let sp=0; stack[sp++]=p0; lab[p0]=id;
      let area=0,sx=0,sy=0,x0=w,y0=h,x1=0,y1=0,edge=false;
      while(sp){
        const p=stack[--sp]; area++; const x=p%w, y=(p/w)|0; sx+=x; sy+=y;
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
        if(x===0||y===0||x===w-1||y===h-1) edge=true;
        for(let k=0;k<4;k++){
          let q; if(k===0){ if(x===0) continue; q=p-1; } else if(k===1){ if(x===w-1) continue; q=p+1; }
          else if(k===2){ if(y===0) continue; q=p-w; } else { if(y===h-1) continue; q=p+w; }
          if(lab[q]!==-1) continue; const j=q*4, dr=bd[j]-sr, dg=bd[j+1]-sg, db=bd[j+2]-sb;
          if(dr*dr+dg*dg+db*db<=tol2){ lab[q]=id; stack[sp++]=q; }
        }
      }
      regions.push({id,area,seed:[p0%w,(p0/w)|0],cx:sx/area,cy:sy/area,bw:x1-x0+1,bh:y1-y0+1,edge,ok:area>=minA&&!edge});
    }
    // neighbors: two areas are touching if only a line (a short run of unlabeled pixels) separates them
    const gap=Math.max(6,Math.round(Math.max(w,h)*0.02)), adj=regions.map(()=>new Map());
    const link=(a,b)=>{ if(a===b) return; adj[a].set(b,(adj[a].get(b)||0)+1); adj[b].set(a,(adj[b].get(a)||0)+1); };
    for(let y=0;y<h;y+=2){ let last=-1,run=0; for(let x=0;x<w;x++){ const l=lab[y*w+x];
      if(l>=0&&regions[l].ok){ if(last>=0&&l!==last&&run<=gap) link(last,l); last=l; run=0; } else if(l<0) run++; else { last=-1; run=0; } } }
    for(let x=0;x<w;x+=2){ let last=-1,run=0; for(let y=0;y<h;y++){ const l=lab[y*w+x];
      if(l>=0&&regions[l].ok){ if(last>=0&&l!==last&&run<=gap) link(last,l); last=l; run=0; } else if(l<0) run++; else { last=-1; run=0; } } }
    return {w,h,lab,regions,adj,tol};
  }
  // which area a history tap landed in (taps on a line were snapped to paper when made)
  function regionAt(seg,x,y){
    const {w,h,lab}=seg; x=Math.max(0,Math.min(w-1,x|0)); y=Math.max(0,Math.min(h-1,y|0));
    let l=lab[y*w+x]; if(l>=0) return l;
    for(let r=1;r<=4;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) continue; l=lab[yy*w+xx]; if(l>=0) return l; }
    return -1;
  }

  // ---------- groups ----------
  function shapeKey(r){ return [Math.log(r.area), r.bw/r.bh, r.area/(r.bw*r.bh)]; }
  function similar(a,b){ const A=shapeKey(a),B=shapeKey(b); return Math.abs(A[0]-B[0])<0.16 && Math.abs(Math.log(A[1]/B[1]))<0.22 && Math.abs(A[2]-B[2])<0.07; }
  // split a set of areas so no two touching ones share a group (tile patterns alternate)
  function splitTouching(ids,seg){
    const color=new Map(), set=new Set(ids);
    ids.slice().sort((a,b)=>seg.regions[b].area-seg.regions[a].area).forEach(id=>{
      const used=new Set(); seg.adj[id].forEach((_,n)=>{ if(set.has(n)&&color.has(n)) used.add(color.get(n)); });
      let c=0; while(used.has(c)) c++; color.set(id,c); });
    const out=[]; ids.forEach(id=>{ const c=color.get(id); (out[c]=out[c]||[]).push(id); });
    return out.filter(Boolean);
  }
  // groups: [{regions:[ids], area, uid (if from the page), L0 (lightness of its current color)}]
  function groupsFor(seg,history,{fillEmpty=true}={}){
    const {regions}=seg; const regUid=new Map();
    history.forEach(a=>{ const l=regionAt(seg,a.x,a.y); if(l>=0) regUid.set(l,a.uid); });
    const byUid=new Map();
    regUid.forEach((u,l)=>{ if(!byUid.has(u)) byUid.set(u,[]); byUid.get(u).push(l); });
    const groups=[];
    byUid.forEach((ids,u)=>{ const g=groupOf(u); groups.push({regions:ids,uid:u,L0:g?g._lch[0]:null}); });
    if(fillEmpty){
      const empty=regions.filter(r=>r.ok&&!regUid.has(r.id));
      const clusters=[];
      empty.sort((a,b)=>b.area-a.area).forEach(r=>{ const c=clusters.find(c=>similar(c[0],r)); if(c) c.push(r); else clusters.push([r]); });
      clusters.forEach(c=>splitTouching(c.map(r=>r.id),seg).forEach(ids=>groups.push({regions:ids,uid:null,L0:null})));
    }
    groups.forEach((g,i)=>{ g.i=i; g.area=g.regions.reduce((s,id)=>s+regions[id].area,0); });
    return groups;
  }
  function groupAdj(seg,groups){
    const owner=new Map(); groups.forEach((g,i)=>g.regions.forEach(id=>owner.set(id,i)));
    const A=groups.map(()=>new Map());
    groups.forEach((g,i)=>g.regions.forEach(id=>seg.adj[id].forEach((n,nb)=>{ const j=owner.get(nb); if(j!=null&&j!==i) A[i].set(j,(A[i].get(j)||0)+n); })));
    return A;
  }
  // more palette colors than groups: split the group with the most areas (touching areas first,
  // then alternating by position) so every color gets somewhere to go
  function splitToFit(groups,k,seg){
    const gs=groups.map(g=>({...g}));
    let guard=0;
    while(gs.length<k && guard++<20){
      let bi=-1; gs.forEach((g,i)=>{ if(g.regions.length>=2&&(bi<0||g.regions.length>gs[bi].regions.length)) bi=i; });
      if(bi<0) break;
      const g=gs[bi]; let parts=splitTouching(g.regions,seg);
      if(parts.length<2){ const s=g.regions.slice().sort((a,b)=>(seg.regions[a].cx+seg.regions[a].cy)-(seg.regions[b].cx+seg.regions[b].cy)); parts=[s.filter((_,i)=>i%2===0),s.filter((_,i)=>i%2===1)]; }
      const [a,...rest]=parts; const b=[].concat(...rest);
      gs.splice(bi,1,{...g,regions:a},{...g,regions:b,split:true});
    }
    gs.forEach((g,i)=>{ g.i=i; g.area=g.regions.reduce((s,id)=>s+seg.regions[id].area,0); });
    return gs;
  }

  // ---------- assignment ----------
  const rankOf=(vals,desc)=>{ const idx=vals.map((v,i)=>i).sort((a,b)=>desc?vals[b]-vals[a]:vals[a]-vals[b]); const r=new Array(vals.length); idx.forEach((i,k)=>{ r[i]=vals.length>1?k/(vals.length-1):0; }); return r; };
  // returns { groups, colorOf:[uid per group] }
  function assign(seg,baseGroups,uids,{seed=1}={}){
    const cols=[...new Set(uids)].map(u=>({u,g:groupOf(u)})).filter(c=>c.g);
    if(!cols.length||!baseGroups.length) return {groups:baseGroups,colorOf:baseGroups.map(g=>g.uid)};
    const groups=cols.length>baseGroups.length?splitToFit(baseGroups,cols.length,seg):baseGroups;
    const G=groups.length, K=cols.length, A=groupAdj(seg,groups);
    const total=groups.reduce((s,g)=>s+g.area,0)||1;
    const areaRank=rankOf(groups.map(g=>g.area),true);              // 0 = biggest
    const Ls=cols.map(c=>c.g._lch[0]), Cs=cols.map(c=>c.g._lch[1]);
    const Lmed=Ls.slice().sort((a,b)=>a-b)[Math.floor(K/2)], Cmax=Math.max(20,...Cs), Ldev=Math.max(8,...Ls.map(l=>Math.abs(l-Lmed)));
    const accent=cols.map((c,i)=>0.6*Cs[i]/Cmax+0.4*Math.abs(Ls[i]-Lmed)/Ldev);
    const accRank=rankOf(accent,false);                               // 0 = calmest
    const gL=groups.map(g=>g.L0), haveL=gL.some(v=>v!=null);
    const gLr=haveL?rankOf(gL.map(v=>v==null?50:v),false):null, cLr=rankOf(Ls,false);
    const de=(a,b)=>P.de00(cols[a].g._lab,cols[b].g._lab);
    const r=P.rng(seed*7919+K*31+G);
    let best=null;
    const tries=seed>1?60:30;
    for(let t=0;t<tries;t++){
      const noise=t===0&&seed<=1?0:(seed>1?0.75:0.28);   // Re-arrange = a looser, more varied pass
      const order=groups.map((g,i)=>i).sort((a,b)=>groups[b].area*(1+noise*(r()-0.5))-groups[a].area*(1+noise*(r()-0.5)));
      const pick=new Array(G).fill(-1), uses=new Array(K).fill(0); let cost=0;
      order.forEach(gi=>{
        let bc=-1,bv=Infinity;
        for(let c=0;c<K;c++){
          let v = (haveL&&gL[gi]!=null ? 0.55 : 1.0)*Math.abs(areaRank[gi]-accRank[c]);
          if(haveL&&gL[gi]!=null) v+=1.4*Math.abs(gLr[gi]-cLr[c]);
          else if(groups[gi].area/total>0.18) v+=0.35*(1-Ls[c]/100);   // a big background reads better light
          if(G<=K){ if(uses[c]) v+=6; } else v+=0.45*uses[c];
          A[gi].forEach((wt,nb)=>{ const pc=pick[nb]; if(pc<0) return;
            if(pc===c) v+=4; else { const d=de(pc,c); if(d<10) v+=0.9; else if(d<16) v+=0.3; } });
          v+=noise*r()*0.5;
          if(v<bv){ bv=v; bc=c; }
        }
        pick[gi]=bc; uses[bc]++; cost+=bv;
      });
      // every color should show up somewhere when there's room for it
      cost+=1.5*uses.filter(u=>u===0).length*(G>=K?1:0);
      if(!best||cost<best.cost) best={cost,pick:pick.slice()};
    }
    return {groups,colorOf:best.pick.map(c=>cols[c].u)};
  }

  // the history a version would get: your own taps (recolored) + one tap per newly filled area
  function toHistory(seg,res,history,tol){
    const regColor=new Map(); res.groups.forEach((g,i)=>g.regions.forEach(id=>regColor.set(id,res.colorOf[i])));
    const out=[]; const done=new Set();
    history.forEach(a=>{ const l=regionAt(seg,a.x,a.y); const u=l>=0&&regColor.has(l)?regColor.get(l):a.uid; out.push({...a,uid:u}); if(l>=0) done.add(l); });
    res.groups.forEach((g,i)=>g.regions.forEach(id=>{ if(done.has(id)) return; const r=seg.regions[id]; out.push({x:r.seed[0],y:r.seed[1],uid:res.colorOf[i],tol}); done.add(id); }));
    return out;
  }

  // ---------- fast previews ----------
  // a small label map + small line art, painted per palette in a single pass
  function makeThumb(seg,baseCanvas,size){
    const k=size/Math.max(seg.w,seg.h), tw=Math.max(1,Math.round(seg.w*k)), th=Math.max(1,Math.round(seg.h*k));
    const lab=new Int32Array(tw*th);
    for(let y=0;y<th;y++){ const sy=Math.min(seg.h-1,Math.floor((y+0.5)/k)); for(let x=0;x<tw;x++){ const sx=Math.min(seg.w-1,Math.floor((x+0.5)/k)); lab[y*tw+x]=seg.lab[sy*seg.w+sx]; } }
    const base=document.createElement("canvas"); base.width=tw; base.height=th;
    const bx=base.getContext("2d"); bx.imageSmoothingQuality="high"; bx.drawImage(baseCanvas,0,0,tw,th);
    return {tw,th,lab,base};
  }
  function paintThumb(thumb,seg,regColor){
    const {tw,th,lab,base}=thumb; const c=document.createElement("canvas"); c.width=tw; c.height=th;
    const x=c.getContext("2d"); const img=x.createImageData(tw,th); const d=img.data; const cache=new Map();
    for(let i=0;i<tw*th;i++){ const l=lab[i]; let rgb=null;
      if(l>=0&&regColor.has(l)){ const u=regColor.get(l); rgb=cache.get(u); if(!rgb){ const g=groupOf(u); const hx=g?g.hex:"#ffffff"; rgb=[parseInt(hx.slice(1,3),16),parseInt(hx.slice(3,5),16),parseInt(hx.slice(5,7),16)]; cache.set(u,rgb); } }
      const j=i*4; if(rgb){ d[j]=rgb[0]; d[j+1]=rgb[1]; d[j+2]=rgb[2]; } else { d[j]=d[j+1]=d[j+2]=255; } d[j+3]=255; }
    x.putImageData(img,0,0); x.globalCompositeOperation="multiply"; x.drawImage(base,0,0); x.globalCompositeOperation="source-over";
    return c;
  }
  function regColorFrom(seg,hist){ const m=new Map(); hist.forEach(a=>{ const l=regionAt(seg,a.x,a.y); if(l>=0) m.set(l,a.uid); }); return m; }

  SB.AUTO={segment,regionAt,groupsFor,assign,toHistory,makeThumb,paintThumb,regColorFrom};
})();
