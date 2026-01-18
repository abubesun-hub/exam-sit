/* نظام خارطة جلوس - واجهة عربية RTL */
(function(){
  const state = {
    data: StorageAPI.load(),
    settings: Object.assign({ theme:'light', backupLimit: 10 }, StorageAPI.loadSettings()),
    filter:{ studentQuery:'' }
  };

  // ==== Helpers ====
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2,9);
  const fmt = n => new Intl.NumberFormat('ar-IQ').format(n);
  let dragFromSeat = null;

  function saveAll({withBackup=false}={}){
    StorageAPI.save(state.data);
    if(withBackup) StorageAPI.addBackup(state.data, state.settings.backupLimit);
    refreshStats();
  }

  function setTheme(){
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }

  function toast(msg){
    console.log('[INFO]', msg);
  }

  // ==== Tabs ====
  function initTabs(){
    $$('.tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        $$('.tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        $$('.view').forEach(v=>v.classList.remove('active'));
        $(target).classList.add('active');
      });
    });
  }

  // ==== Dashboard ====
  function refreshStats(){
    $('#statStudents').textContent = fmt(state.data.students.length);
    $('#statHalls').textContent = fmt(state.data.halls.length);
    const assigned = Object.values(state.data.assignments||{}).length;
    $('#statAssigned').textContent = fmt(assigned);

    const b = StorageAPI.getBackups();
    const host = $('#backupList');
    host.innerHTML = '';
    if(!b.length){ host.innerHTML = '<div class="muted">لا توجد نسخ حتى الآن</div>'; return; }
    b.slice(0,6).forEach(x=>{
      const d = new Date(x.ts);
      const el = document.createElement('div');
      el.className='row';
      el.textContent = d.toLocaleString('ar-IQ');
      host.appendChild(el);
    });
  }

  // ==== Students ====
  function renderStudents(){
    const host = $('#studentsTable');
    const q = state.filter.studentQuery.trim();
    const list = state.data.students.filter(s=>
      !q || s.name.includes(q) || (s.stage||'').includes(q) || (s.className||'').includes(q)
    );

    const header = `<div class="row" style="font-weight:700;">
      <div>الاسم</div><div>المرحلة</div><div>الشعبة</div><div></div>
    </div>`;

    host.innerHTML = header + list.map(s=>{
      return `<div class="row">
        <div>${s.name}</div>
        <div>${s.stage||''}</div>
        <div>${s.className||''}</div>
        <div class="actions">
          <button class="btn btn-ghost" data-del="${s.id}"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-del');
        state.data.students = state.data.students.filter(x=>x.id!==id);
        saveAll({withBackup:true});
        renderStudents();
      });
    });
  }

  function initStudents(){
    $('#studentForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = $('#stName').value.trim();
      if(!name) return;
      state.data.students.push({id:uid(), name, stage:$('#stStage').value.trim(), className:$('#stClass').value.trim()});
      $('#stName').value=''; $('#stStage').value=''; $('#stClass').value='';
      saveAll({withBackup:true});
      renderStudents();
    });

    $('#studentSearch').addEventListener('input', (e)=>{
      state.filter.studentQuery = e.target.value;
      renderStudents();
    });

    $('#btnClearStudents').addEventListener('click', ()=>{
      if(confirm('حذف جميع الطلاب؟')){
        state.data.students = [];
        saveAll({withBackup:true});
        renderStudents();
      }
    });

    // Inline import button inside Students card
    $('#btnImportStudentsInline').addEventListener('click', async ()=>{
      const input = $('#fileImportStudentsInline');
      const file = input.files?.[0];
      if(!file){ alert('اختر ملف الطلاب أولاً'); return; }
      try{
        const count = await processImportFile(file);
        toast(`تم استيراد ${count} طالب`);
      }catch(e){
        alert('فشل الاستيراد: '+ e.message);
        console.error(e);
      } finally { $('#fileImportStudentsInline').value=''; }
    });
  }

  // ==== Halls & Sectors ====
  function renderHalls(){
    const wrap = $('#hallsList');
    if(!state.data.halls.length){
      wrap.innerHTML = '<div class="card neo">لا توجد قاعات بعد.</div>';
      return;
    }

    wrap.innerHTML = state.data.halls.map(h=>{
      const sectors = (h.sectors||[]).map(sec=>
        `<div class="sector neo">
          <h4>القطاع ${sec.name}</h4>
          <div class="row-config">
            <label><span>عدد الصفوف (الخطوط)</span><input type="number" min="1" value="${sec.rows?.length||2}" data-sect-rows="${h.id}:${sec.id}" /></label>
            <label><span>مقاعد كل صف (مثال: 8,8,7)</span><input type="text" value="${(sec.rows||[ {seats:8},{seats:8} ]).map(r=>r.seats).join(',')}" data-sect-seats="${h.id}:${sec.id}" placeholder="8,8,8"/></label>
          </div>
          <div class="templates">
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:2"><i class="bi bi-layout-three-columns"></i><span>قالب 2 خطوط</span></button>
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:3"><i class="bi bi-layout-three-columns"></i><span>قالب 3 خطوط</span></button>
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:4"><i class="bi bi-layout-three-columns"></i><span>قالب 4 خطوط</span></button>
          </div>
          <div class="actions mt">
            <button class="btn btn-neo" data-generate="${h.id}:${sec.id}"><i class="bi bi-diagram-3"></i><span>توليد المقاعد</span></button>
            <button class="btn btn-ghost" data-autoassign="${h.id}:${sec.id}"><i class="bi bi-magic"></i><span>توزيع تلقائي</span></button>
          </div>
          <div class="mt seats" id="seats-${h.id}-${sec.id}" data-cols="${Math.min(4, (sec.rows||[]).length||2)}"></div>
        </div>`
      ).join('');

      return `<div class="card neo hall-card">
        <div class="hall-header">
          <h3>${h.name}</h3>
          <div class="actions">
            <button class="btn btn-ghost" data-add-sector="${h.id}"><i class="bi bi-plus"></i><span>إضافة قطاع</span></button>
            <button class="btn btn-ghost" data-del-hall="${h.id}"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="sectors">${sectors || ''}</div>
      </div>`;
    }).join('');

    // wire actions
    wrap.querySelectorAll('[data-del-hall]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-del-hall');
        if(!confirm('حذف القاعة؟')) return;
        state.data.halls = state.data.halls.filter(x=>x.id!==id);
        saveAll({withBackup:true});
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-add-sector]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const hid = btn.getAttribute('data-add-sector');
        const hall = state.data.halls.find(x=>x.id===hid);
        const name = prompt('اسم القطاع', (hall.sectors?.length||0)+1);
        if(!name) return;
        hall.sectors = hall.sectors||[];
        hall.sectors.push({id:uid(), name: String(name), rows:[{seats:8},{seats:8}]});
        saveAll();
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-sect-rows]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const [hid,sid] = inp.getAttribute('data-sect-rows').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const n = Math.max(1, parseInt(inp.value||'1',10));
        const old = (sec.rows||[]).map(r=>r.seats);
        const next = Array.from({length:n}, (_,i)=>({seats: old[i]||8}));
        sec.rows = next; saveAll();
      });
    });

    wrap.querySelectorAll('[data-sect-seats]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const [hid,sid] = inp.getAttribute('data-sect-seats').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const parts = (inp.value||'').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>Number.isFinite(n)&&n>0);
        if(!parts.length){ alert('صيغة غير صحيحة. مثال: 8,8,7'); return; }
        sec.rows = parts.map(x=>({seats:x}));
        saveAll();
      });
    });

    wrap.querySelectorAll('[data-template]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid,nStr] = btn.getAttribute('data-template').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const n = Math.max(1, parseInt(nStr||'2',10));
        // استخدم القيمة السائدة للمقاعد أو 8 كمبدئي
        const defaultSeats = (sec.rows&&sec.rows.length)? Math.round(sec.rows.map(r=>r.seats).reduce((a,b)=>a+b,0)/sec.rows.length) : 8;
        sec.rows = Array.from({length:n}, ()=>({seats: defaultSeats||8}));
        saveAll();
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-generate]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid] = btn.getAttribute('data-generate').split(':');
        renderSeats(hid, sid);
      });
    });

    wrap.querySelectorAll('[data-autoassign]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid] = btn.getAttribute('data-autoassign').split(':');
        autoAssign(hid, sid);
        renderSeats(hid, sid);
        saveAll({withBackup:true});
      });
    });

    // render seats for all
    state.data.halls.forEach(h=> (h.sectors||[]).forEach(s=> renderSeats(h.id, s.id)) );
  }

  function renderSeats(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    const host = document.getElementById(`seats-${hid}-${sid}`);
    if(!sec || !host) return;

    // build seat boxes per row
    const seats = [];
    (sec.rows||[]).forEach((r,rowIndex)=>{
      for(let i=0;i<r.seats;i++){
        const seatId = `${hid}:${sid}:${rowIndex+1}:${i+1}`;
        seats.push({seatId, row:rowIndex+1, col:i+1, label:`صف ${rowIndex+1} - مقعد ${i+1}`, studentId: state.data.assignments[seatId]});
      }
    });

    host.setAttribute('data-cols', String(Math.min(4, (sec.rows||[]).length||1)));
    host.innerHTML = seats.map(seat=>{
      const st = state.data.students.find(x=>x.id===seat.studentId);
      const name = st? `${st.name} <span class=\"badge\">${st.className||''}</span>` : '<span class="muted">فارغ</span>';
      return `<div class="seat" draggable="true" data-seat="${seat.seatId}">
        <div class="label">${seat.label}</div>
        <div class="name">${name}</div>
      </div>`;
    }).join('');

    // Wire drag & drop
    host.querySelectorAll('.seat').forEach(el=>{
      el.addEventListener('dragstart', (e)=>{
        dragFromSeat = el.getAttribute('data-seat');
        e.dataTransfer.setData('text/plain', dragFromSeat);
      });
      el.addEventListener('dragover', (e)=>{ e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', ()=> el.classList.remove('drag-over'));
      el.addEventListener('drop', (e)=>{
        e.preventDefault();
        el.classList.remove('drag-over');
        const targetSeat = el.getAttribute('data-seat');
        const sourceSeat = dragFromSeat || e.dataTransfer.getData('text/plain');
        if(!sourceSeat || sourceSeat===targetSeat) return;
        const a = state.data.assignments[sourceSeat] || null;
        const b = state.data.assignments[targetSeat] || null;
        if(a==null && b==null) return;
        state.data.assignments[sourceSeat] = b || undefined;
        if(state.data.assignments[sourceSeat]===undefined) delete state.data.assignments[sourceSeat];
        state.data.assignments[targetSeat] = a || undefined;
        if(state.data.assignments[targetSeat]===undefined) delete state.data.assignments[targetSeat];
        saveAll();
        renderSeats(hid, sid);
      });
    });
  }

  // Build snake order list of seats (row-wise)
  function buildSeatSnake(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    if(!sec) return [];
    const list = [];
    (sec.rows||[]).forEach((r,rowIdx)=>{
      const rIndex = rowIdx+1;
      const dir = (rIndex % 2 === 1) ? 1 : -1; // odd L->R, even R->L
      const start = dir===1 ? 1 : r.seats;
      const end = dir===1 ? r.seats : 1;
      for(let c=start; dir===1? c<=end : c>=end; c+=dir){
        list.push({ seatId:`${hid}:${sid}:${rIndex}:${c}`, row:rIndex, col:c });
      }
    });
    return list;
  }

  function autoAssign(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    if(!sec) return;

    // collect unassigned students and group by class
    const assignedIds = new Set(Object.values(state.data.assignments||{}));
    const pool = state.data.students.filter(s=>!assignedIds.has(s.id));
    if(!pool.length) return;

    const groups = new Map();
    for(const s of pool){
      const cls = (s.className||'').trim();
      if(!groups.has(cls)) groups.set(cls, []);
      groups.get(cls).push(s);
    }

    const seatList = buildSeatSnake(hid, sid);
    const classAtPos = new Map(); // key "r,c" -> class

    function getNeighborsClasses(r,c){
      const res = [];
      const left = `${r},${c-1}`; if(classAtPos.has(left)) res.push(classAtPos.get(left));
      const up = `${r-1},${c}`; if(classAtPos.has(up)) res.push(classAtPos.get(up));
      return res.filter(Boolean);
    }

    function pickClass(avoid){
      // sort classes by remaining count desc each time
      const entries = Array.from(groups.entries()).filter(([,arr])=>arr.length>0)
        .sort((a,b)=> b[1].length - a[1].length);
      for(const [cls, arr] of entries){
        if(cls && !avoid.includes(cls)) return cls;
      }
      // try empty class
      const empty = entries.find(([cls,arr])=> cls==='' && arr.length>0);
      if(empty && !avoid.includes('')) return '';
      // fall back to largest
      return entries.length? entries[0][0] : null;
    }

    for(const seat of seatList){
      const avoid = getNeighborsClasses(seat.row, seat.col);
      const cls = pickClass(avoid);
      if(cls==null) break;
      const st = groups.get(cls).pop();
      state.data.assignments[seat.seatId] = st.id;
      classAtPos.set(`${seat.row},${seat.col}`, cls);
    }
  }

  function initHalls(){
    $('#hallForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = $('#hallName').value.trim();
      if(!name) return;
      state.data.halls.push({id:uid(), name, sectors: [ {id:uid(), name:'1', rows:[{seats:8},{seats:8}] } ]});
      $('#hallName').value='';
      saveAll();
      renderHalls();
    });
  }

  // ==== IO (Import/Export) ====
  function toCSV(rows){
    const esc = v => (v==null? '' : String(v).replaceAll('"','""'));
    return rows.map(r=> r.map(c=>`"${esc(c)}"`).join(',')).join('\n');
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exam-seating-data.json';
    a.click();
  }

  function exportStudentsCSV(){
    const rows = [["الاسم","المرحلة","الشعبة"]].concat(
      state.data.students.map(s=>[s.name, s.stage||'', s.className||''])
    );
    const blob = new Blob([toCSV(rows)], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students.csv';
    a.click();
  }

  function importStudentsFromCSV(text){
    const lines = text.split(/\r?\n/).filter(Boolean);
    if(!lines.length) return 0;
    // try to detect header
    const header = lines[0].split(',').map(s=>s.replace(/["\uFEFF]/g,'').trim());
    const hasHeader = header.some(h=>['الاسم','اسم','name'].includes(h));
    const start = hasHeader? 1 : 0;
    let count=0;
    for(let i=start;i<lines.length;i++){
      const cols = lines[i].split(',').map(s=>s.replace(/\"/g,'"').replace(/^"|"$/g,''));
      const name = cols[0]?.trim(); if(!name) continue;
      const stage = cols[1]?.trim()||'';
      const cls = cols[2]?.trim()||'';
      state.data.students.push({id:uid(), name, stage, className:cls});
      count++;
    }
    saveAll({withBackup:true});
    renderStudents();
    return count;
  }

  async function importStudentsFromExcel(file){
    if(!(window.XLSX)) throw new Error('SheetJS غير متوفر (تحتاج اتصال بالإنترنت). يمكن استيراد CSV/JSON كبديل.');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1});
    let count=0; let start=0;
    const header = (rows[0]||[]).map(x=>String(x||'').trim());
    if(header.some(h=>['الاسم','اسم','name'].includes(h))) start=1;
    for(let i=start;i<rows.length;i++){
      const [name, stage='', cls=''] = rows[i];
      if(!name) continue; count++;
      state.data.students.push({id:uid(), name:String(name), stage:String(stage||''), className:String(cls||'')});
    }
    saveAll({withBackup:true});
    renderStudents();
    return count;
  }

  async function processImportFile(file){
    let count = 0;
    if(file.name.endsWith('.json')){
      const obj = JSON.parse(await file.text());
      if(Array.isArray(obj.students)){
        state.data.students.push(...obj.students.map(s=> ({id: uid(), name:s.name, stage:s.stage, className:s.className})));
        count = obj.students.length;
      } else {
        state.data = obj; // استيراد كامل
        count = state.data.students.length;
      }
      saveAll({withBackup:true});
      renderStudents();
      renderHalls();
    } else if(file.name.endsWith('.csv')){
      count = importStudentsFromCSV(await file.text());
    } else if(/\.xlsx?$/.test(file.name)){
      count = await importStudentsFromExcel(file);
    } else {
      throw new Error('صيغة غير مدعومة');
    }
    return count;
  }

  function initIO(){
    $('#btnExportJSON').addEventListener('click', exportJSON);
    $('#btnExportStudentsCSV').addEventListener('click', exportStudentsCSV);

    $('#btnImportStudents').addEventListener('click', async ()=>{
      const input = $('#fileImport');
      const file = input.files?.[0];
      if(!file){ alert('الرجاء اختيار ملف'); return; }
      try{
        const count = await processImportFile(file);
        toast(`تم استيراد ${count} طالب`);
      }catch(e){
        alert('فشل الاستيراد: '+ e.message);
        console.error(e);
      } finally { $('#fileImport').value=''; }
    });
  }

  // ==== Settings & Print ====
  function initSettings(){
    $('#themeSelect').value = state.settings.theme;
    $('#backupLimit').value = state.settings.backupLimit;

    $('#btnSaveSettings').addEventListener('click', ()=>{
      state.settings.theme = $('#themeSelect').value;
      state.settings.backupLimit = Math.max(1, parseInt($('#backupLimit').value||'10',10));
      StorageAPI.saveSettings(state.settings);
      setTheme();
      toast('تم حفظ الإعدادات');
    });

    $('#btnResetApp').addEventListener('click', ()=>{
      if(!confirm('إرجاع كل البيانات للإفتراضي؟')) return;
      state.data = {students:[], halls:[], assignments:{}};
      saveAll({withBackup:true});
      renderStudents();
      renderHalls();
      refreshStats();
    });

    $('#btnBackupNow').addEventListener('click', ()=>{
      StorageAPI.addBackup(state.data, state.settings.backupLimit);
      refreshStats();
      toast('تم إنشاء نسخة احتياطية');
    });

    $('#btnPrint').addEventListener('click', ()=> window.print());
  }

  // ==== Init ====
  function init(){
    setTheme();
    initTabs();
    initStudents();
    initHalls();
    initIO();
    initSettings();
    renderStudents();
    renderHalls();
    refreshStats();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
