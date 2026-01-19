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
      console.warn('quota exceeded on DATA, pruning backups...', e);
      try{
        pruneBackups();
        localStorage.setItem(KEYS.DATA, payload);
      }catch(err){
        alert('فشل الاستيراد: مساحة التخزين المحلية ممتلئة. تم تقليص النسخ الاحتياطية تلقائياً، إن استمر الخطأ يرجى تصدير البيانات ثم تقليل الحجم (مثلاً عدد النسخ الاحتياطية).');
        throw err;
      }
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
      // If settings are large (logos as DataURL) and quota is exceeded,
      // prune backups to free space, then retry once.
      try{
        pruneBackups();
        localStorage.setItem(KEYS.SETTINGS, payload);
      }catch(err){
        alert('فشل حفظ الإعدادات: مساحة التخزين المحلية ممتلئة. تم تقليص النسخ الاحتياطية تلقائياً، إن استمر الخطأ قلّل عدد النسخ الاحتياطية أو احذف بعض البيانات ثم أعد المحاولة.');
        throw err;
      }
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
