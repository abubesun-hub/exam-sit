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

  function save(data){
    localStorage.setItem(KEYS.DATA, JSON.stringify(data));
  }

  function loadSettings(){
    try{
      return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
    }catch{ return {}; }
  }

  function saveSettings(s){
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s||{}));
  }

  function getBackups(){
    try{ return JSON.parse(localStorage.getItem(KEYS.BACKUPS)||'[]'); }catch{ return []; }
  }

  function addBackup(snapshot, limit){
    const list = getBackups();
    list.unshift({ts: nowISO(), snapshot});
    while(list.length > (limit||10)) list.pop();
    localStorage.setItem(KEYS.BACKUPS, JSON.stringify(list));
  }

  window.StorageAPI = { KEYS, load, save, loadSettings, saveSettings, getBackups, addBackup };
})();
