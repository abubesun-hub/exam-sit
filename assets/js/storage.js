(function(){
  const KEYS = {
    DATA: 'examSit:data:v1',
    SETTINGS: 'examSit:settings:v1',
    BACKUPS: 'examSit:backups:v1'
  };

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

  window.StorageAPI = { KEYS, load, save, loadSettings, saveSettings, getBackups, addBackup };
})();
