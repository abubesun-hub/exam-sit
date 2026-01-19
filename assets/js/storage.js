(function(){
  const KEYS = {
    DATA: 'examSit:data:v1',
    SETTINGS: 'examSit:settings:v1',
    BACKUPS: 'examSit:backups:v1'
  };
  // ===== IndexedDB for large assets (logos etc.) =====
  const DB_NAME = 'examSit-db';
  const DB_STORE = 'assets';
  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }
  async function setAsset(key, dataUrl){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(dataUrl||'', key);
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
    });
  }
  async function getAsset(key){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = ()=> resolve(req.result || '');
      req.onerror = ()=> reject(req.error);
    });
  }
  async function removeAsset(key){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
    });
  }

  function nowISO(){return new Date().toISOString();}

  function load(){
    try{
      const raw = localStorage.getItem(KEYS.DATA);
      if(!raw) return {students:[], halls:[], assignments:{}};
      return JSON.parse(raw);
    }catch(e){
      console.error('load data failed', e);
      return {students:[], halls:[], assignments:{}};
    }
  }

  function getBackups(){
    try{ return JSON.parse(localStorage.getItem(KEYS.BACKUPS)||'[]'); }catch{ return []; }
  }

  function setBackups(list){
    localStorage.setItem(KEYS.BACKUPS, JSON.stringify(list||[]));
  }

  function pruneBackups(){
    // Trim backups aggressively to free space
    const list = getBackups();
    if(list.length<=1) return;
    const keep = Math.ceil(list.length/2);
    setBackups(list.slice(0, keep));
  }

  function save(data){
    const payload = JSON.stringify(data);
    try{
      localStorage.setItem(KEYS.DATA, payload);
    }catch(e){
      // لا تقم بتقليص النسخ الاحتياطية تلقائياً ولا تُظهر تنبيهًا.
      // المتصفح يفرض حدًا لمساحة localStorage ولا يمكن تجاوزه.
      console.warn('quota exceeded on DATA (localStorage limit reached). Save skipped.', e);
    }
  }

  function loadSettings(){
    try{
      return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
    }catch{ return {}; }
  }

  function saveSettings(s){
    // احفظ الإعدادات كما هي (بما في ذلك الشعارات إن توفرت).
    const payload = JSON.stringify(s||{});
    try{
      localStorage.setItem(KEYS.SETTINGS, payload);
    }catch(e){
      // لا تقم بتقليص النسخ الاحتياطية تلقائياً ولا تُظهر تنبيهًا.
      console.warn('quota exceeded on SETTINGS (localStorage limit reached). Save skipped.', e);
    }
  }

  function addBackup(snapshot, limit){
    try{
      const list = getBackups();
      list.unshift({ts: nowISO(), snapshot});
      while(list.length > (limit||10)) list.pop();
      setBackups(list);
    }catch(e){
      // If quota hit on backups, prune and retry once
      try{
        pruneBackups();
        const list = getBackups();
        list.unshift({ts: nowISO(), snapshot});
        while(list.length > (limit||10)) list.pop();
        setBackups(list);
      }catch(err){
        console.warn('backup skipped due to quota');
      }
    }
  }

  window.StorageAPI = { KEYS, load, save, loadSettings, saveSettings, getBackups, addBackup, setAsset, getAsset, removeAsset };
})();
