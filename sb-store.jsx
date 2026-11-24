// ============================================================================
// swatchbook v2 — photos of finished real-life pages, kept in IndexedDB.
// localStorage only holds ~5 MB on iPhone/iPad and the pages already use a lot of it,
// so photos never go there. A page only stores the photo ids (page.done.photos).
// Records: { id, pageId, src (JPEG data URL), w, h, addedAt }
// Wrapped in an IIFE: babel scripts share one global scope.
// ============================================================================
(function(){
  const { useState, useEffect } = React;
  const SB=window.SB;
  const DBN="swatchbook", ST="photos";
  let dbp=null;
  function db(){
    if(!dbp) dbp=new Promise((res,rej)=>{ const r=indexedDB.open(DBN,1);
      r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST,{keyPath:"id"}); };
      r.onsuccess=()=>res(r.result); r.onerror=()=>{ dbp=null; rej(r.error); }; });
    return dbp;
  }
  async function run(mode,fn){
    const d=await db();
    return new Promise((res,rej)=>{ const t=d.transaction(ST,mode), s=t.objectStore(ST); let out; const rq=fn(s);
      if(rq) rq.onsuccess=()=>{ out=rq.result; };
      t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); });
  }
  const cache=new Map();
  const PhotoDB={
    put:rec=>{ cache.set(rec.id,rec); return run("readwrite",s=>s.put(rec)); },
    get:async id=>{ if(cache.has(id)) return cache.get(id); const r=await run("readonly",s=>s.get(id)); if(r) cache.set(id,r); return r||null; },
    del:id=>{ cache.delete(id); return run("readwrite",s=>s.delete(id)); },
    all:()=>run("readonly",s=>s.getAll()),
  };
  // ask the browser not to clear app storage when the device is low on space
  try{ navigator.storage&&navigator.storage.persist&&navigator.storage.persist(); }catch{}

  function usePhoto(id){
    const [rec,setRec]=useState(()=>id&&cache.get(id)||null);
    useEffect(()=>{ let dead=false; if(!id){ setRec(null); return; }
      PhotoDB.get(id).then(r=>{ if(!dead) setRec(r); }).catch(()=>{}); return ()=>{ dead=true; }; },[id]);
    return rec;
  }
  // rough localStorage use, in characters (each is ~2 bytes on iOS)
  function storageUse(){ let n=0; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=k.length+(localStorage.getItem(k)||"").length; } }catch{} return n; }

  SB.PhotoDB=PhotoDB; SB.usePhoto=usePhoto; SB.storageUse=storageUse;
})();
