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
  let picker = { seatId:null, hid:null, sid:null, capacity:1 };

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
          <div class="actions" style="margin-bottom:.5rem">
            <button class="btn btn-ghost" data-edit-sector="${h.id}:${sec.id}"><i class="bi bi-pencil"></i><span>تعديل اسم القطاع</span></button>
            <button class="btn btn-ghost" data-del-sector="${h.id}:${sec.id}"><i class="bi bi-trash"></i><span>حذف القطاع</span></button>
            <button class="btn btn-ghost" data-clear-sector="${h.id}:${sec.id}"><i class="bi bi-eraser"></i><span>تفريغ القطاع</span></button>
          </div>
          <div class="row-config">
            <label><span>عدد الخطوط (الأعمدة) لكل صف</span><input type="number" min="1" value="${rowsToColHeights(sec.rows||[ {seats:8},{seats:8} ]).length}" data-sect-cols="${h.id}:${sec.id}" /></label>
            <label><span>مقاعد ضمن عمود (مثال: 6,6,5)</span><input type="text" value="${rowsToColHeights(sec.rows||[ {seats:8},{seats:8} ]).join(',')}" data-sect-seats="${h.id}:${sec.id}" placeholder="6,6,5"/></label>
          </div>
          <div class="capacity">
            <label><span>سعة المقعد</span>
              <select data-seat-capacity="${h.id}:${sec.id}">
                <option value="1" ${sec.seatCapacity==2? '' : 'selected'}>طالب واحد</option>
                <option value="2" ${sec.seatCapacity==2? 'selected' : ''}>طالبان</option>
              </select>
            </label>
          </div>
          <div class="templates">
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:2"><i class="bi bi-layout-three-columns"></i><span>قالب 2 خطوط</span></button>
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:3"><i class="bi bi-layout-three-columns"></i><span>قالب 3 خطوط</span></button>
            <button class="btn btn-ghost" data-template="${h.id}:${sec.id}:4"><i class="bi bi-layout-three-columns"></i><span>قالب 4 خطوط</span></button>
          </div>
          <div class="actions mt">
            <button class="btn btn-neo" data-generate="${h.id}:${sec.id}"><i class="bi bi-diagram-3"></i><span>توليد المقاعد</span></button>
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

    // أُلغي التحكم بعدد الصفوف؛ عدد الصفوف يتحدد من مدخل "مقاعد كل صف"

    wrap.querySelectorAll('[data-sect-seats]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const [hid,sid] = inp.getAttribute('data-sect-seats').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const colsHeights = (inp.value||'').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>Number.isFinite(n)&&n>0);
        if(!colsHeights.length){ alert('صيغة غير صحيحة. مثال: 6,6,5'); return; }
        const maxRows = Math.max(...colsHeights);
        const rows = Array.from({length:maxRows}, (_,rowIdx)=>{
          const seatsInThisRow = colsHeights.filter(h=> h >= (rowIdx+1)).length; // عدد الأعمدة التي تمتد لهذا الصف
          return {seats: seatsInThisRow};
        });
        sec.rows = rows;
        saveAll();
        renderHalls();
      });
    });

    // ضبط عدد الخطوط (الأعمدة) بشكل موحّد لكل الصفوف
    wrap.querySelectorAll('[data-sect-cols]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const [hid,sid] = inp.getAttribute('data-sect-cols').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const n = Math.max(1, parseInt(inp.value||'1',10));
        sec.rows = (sec.rows||[{seats:8},{seats:8}]).map(r=> ({seats:n}));
        saveAll();
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-seat-capacity]').forEach(sel=>{
      sel.addEventListener('change', ()=>{
        const [hid,sid] = sel.getAttribute('data-seat-capacity').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        sec.seatCapacity = parseInt(sel.value,10)===2?2:1;
        saveAll();
        renderHalls();
      });
    });

    // قوالب تغيير عدد الخطوط (الأعمدة) لكل الصفوف
    wrap.querySelectorAll('[data-template]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid,nStr] = btn.getAttribute('data-template').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const n = Math.max(1, parseInt(nStr||'2',10));
        // غيّر عدد الأعمدة لكل الصفوف إلى n
        sec.rows = (sec.rows||[{seats:8},{seats:8}]).map(r=> ({seats:n}));
        saveAll();
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-edit-sector]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid] = btn.getAttribute('data-edit-sector').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        const sec = hall?.sectors?.find(s=>s.id===sid);
        const name = prompt('اسم القطاع الجديد', sec.name);
        if(!name) return;
        sec.name = String(name);
        saveAll();
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-del-sector]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid] = btn.getAttribute('data-del-sector').split(':');
        const hall = state.data.halls.find(h=>h.id===hid);
        if(!confirm('حذف القطاع؟')) return;
        hall.sectors = (hall.sectors||[]).filter(s=>s.id!==sid);
        // إزالة التعيينات المرتبطة بهذا القطاع
        Object.keys(state.data.assignments||{}).forEach(k=>{ if(k.startsWith(`${hid}:${sid}:`)) delete state.data.assignments[k]; });
        saveAll({withBackup:true});
        renderHalls();
      });
    });

    wrap.querySelectorAll('[data-clear-sector]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [hid,sid] = btn.getAttribute('data-clear-sector').split(':');
        if(!confirm('تفريغ جميع المقاعد في هذا القطاع؟')) return;
        Object.keys(state.data.assignments||{}).forEach(k=>{ if(k.startsWith(`${hid}:${sid}:`)) delete state.data.assignments[k]; });
        saveAll({withBackup:true});
        renderSeats(hid, sid);
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
        openAutoOptions(hid, sid);
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
        seats.push({seatId, row:rowIndex+1, col:i+1, label:`صف ${rowIndex+1} - مقعد ${i+1}`, students: normalizeSeat(state.data.assignments[seatId])});
      }
    });

    // header controls: stage per vertical line
    const rows = sec.rows||[];
    const maxCols = Math.max(...rows.map(r=> r.seats||0));
    const visibleCols = Math.min(maxCols||1, 4);
    const stages = uniqueStages();
    const capacity = sec.seatCapacity===2?2:1;
    const lineControls = Array.from({length:visibleCols},(_,i)=>{
      const c = i+1;
      if(capacity===2){
        return `<div class="line-ctrl two"><div class="line-label">خط ${c}</div><div class="line-pair"><div class="pair-item"><div class="pair-title">طالب 1 (يمين)</div><select class="line-stage-a" data-col="${c}">${stages.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div><div class="pair-item"><div class="pair-title">طالب 2 (يسار)</div><select class="line-stage-b" data-col="${c}">${stages.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div></div></div>`;
      }
      return `<div class="line-ctrl"><div class="line-label">خط ${c}</div><select class="line-stage" data-col="${c}">${stages.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>`;
    }).join('');

    const header = `<div class="line-controls" style="grid-column:1/-1; grid-template-columns:repeat(${visibleCols}, 1fr)">${lineControls}</div><div class="line-actions" style="grid-column:1/-1"><button class="btn" id="applyLines-${hid}-${sid}">تطبيق التوزيع حسب الخطوط</button></div>`;

    // عدد الأعمدة المرئية يساوي أكبر عدد مقاعد في أي خط
    host.setAttribute('data-cols', String(visibleCols));
    host.innerHTML = header + seats.map(seat=>{
      if(capacity===2){
        const [s1,s2] = [seat.students[0], seat.students[1]];
        const st1 = state.data.students.find(x=>x.id===s1);
        const st2 = state.data.students.find(x=>x.id===s2);
        const n1 = st1? `${st1.name}` : '<span class=\"muted\">فارغ</span>';
        const n2 = st2? `${st2.name}` : '<span class=\"muted\">فارغ</span>';
        return `<div class="seat two" draggable="true" data-seat="${seat.seatId}">
          <div class="label">${seat.label}</div>
          <div class="names">
            <div class="slot"><div class="name">${n1}</div><div class="meta">${st1? `${st1.stage||''} ${st1.className||''}`:''}</div></div>
            <div class="slot"><div class="name">${n2}</div><div class="meta">${st2? `${st2.stage||''} ${st2.className||''}`:''}</div></div>
          </div>
        </div>`;
      } else {
        const s = seat.students[0];
        const st = state.data.students.find(x=>x.id===s);
        const name = st? `${st.name}` : '<span class=\"muted\">فارغ</span>';
        return `<div class="seat" draggable="true" data-seat="${seat.seatId}">
          <div class="label">${seat.label}</div>
          <div class="name">${name}</div>
          <div class="meta">${st? `${st.stage||''} ${st.className||''}`:''}</div>
        </div>`;
      }
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
        const a = normalizeSeat(state.data.assignments[sourceSeat]);
        const b = normalizeSeat(state.data.assignments[targetSeat]);
        if(a.length===0 && b.length===0) return;
        state.data.assignments[sourceSeat] = b.length? b : undefined;
        if(state.data.assignments[sourceSeat]===undefined) delete state.data.assignments[sourceSeat];
        state.data.assignments[targetSeat] = a.length? a : undefined;
        if(state.data.assignments[targetSeat]===undefined) delete state.data.assignments[targetSeat];
        saveAll();
        renderSeats(hid, sid);
      });
      el.addEventListener('click', ()=>{
        openStudentPicker(hid, sid, el.getAttribute('data-seat'));
      });
    });

    const applyBtn = document.getElementById(`applyLines-${hid}-${sid}`);
    if(applyBtn){
      applyBtn.addEventListener('click', ()=>{
        applyLineDistribution(hid, sid);
        saveAll();
        renderSeats(hid, sid);
      });
    }
  }

  function normalizeSeat(val){
    if(!val) return [];
    if(Array.isArray(val)) return val.filter(Boolean);
    return [val];
  }

  function removeStudentFromAssignments(studentId){
    const keys = Object.keys(state.data.assignments||{});
    for(const k of keys){
      const arr = normalizeSeat(state.data.assignments[k]);
      const idx = arr.indexOf(studentId);
      if(idx>=0){
        arr.splice(idx,1);
        if(arr.length) state.data.assignments[k] = arr; else delete state.data.assignments[k];
      }
    }
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

  // Helpers to convert between row counts and column heights
  function rowsToColHeights(rows){
    const r = rows||[];
    const maxCols = Math.max(...r.map(x=> x?.seats||0), 0);
    const heights = [];
    for(let c=1;c<=maxCols;c++){
      let h = 0;
      for(let i=0;i<r.length;i++){
        if((r[i]?.seats||0) >= c) h++;
      }
      heights.push(h);
    }
    return heights;
  }

  function clearSectorAssignments(hid, sid){
    const list = buildSeatSnake(hid, sid);
    for(const seat of list){ delete state.data.assignments[seat.seatId]; }
  }

  function applyLineDistribution(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    if(!sec) return;
    const rows = sec.rows||[];
    const maxCols = Math.max(...rows.map(r=> r.seats||0));
    const visibleCols = Math.min(maxCols||1, 4);
    const cap = sec.seatCapacity===2?2:1;
    const students = [...state.data.students];
    const isAssigned = (id)=>{
      for(const v of Object.values(state.data.assignments||{})){
        if(Array.isArray(v)? v.includes(id): v===id) return true;
      }
      return false;
    };
    const takeFromStage = (stage)=>{
      const idx = students.findIndex(s=> (s.stage||'').trim()===stage && !isAssigned(s.id));
      if(idx<0) return null; const st = students[idx]; students.splice(idx,1); return st;
    };
    clearSectorAssignments(hid, sid);
    if(cap===1){
      for(let c=1;c<=visibleCols;c++){
        const sel = document.querySelector(`#seats-${hid}-${sid} .line-stage[data-col="${c}"]`);
        const stg = sel?.value; if(!stg) continue;
        for(let r=1;r<=rows.length;r++){
          const seatsInRow = rows[r-1]?.seats||0; if(c>seatsInRow) continue;
          const seatId = `${hid}:${sid}:${r}:${c}`;
          const s = takeFromStage(stg); if(!s) continue;
          state.data.assignments[seatId] = s.id;
        }
      }
    } else {
      for(let c=1;c<=visibleCols;c++){
        const aSel = document.querySelector(`#seats-${hid}-${sid} .line-stage-a[data-col="${c}"]`);
        const bSel = document.querySelector(`#seats-${hid}-${sid} .line-stage-b[data-col="${c}"]`);
        const aStage = aSel?.value || '';
        const bStage = bSel?.value || '';
        for(let r=1;r<=rows.length;r++){
          const seatsInRow = rows[r-1]?.seats||0; if(c>seatsInRow) continue;
          const seatId = `${hid}:${sid}:${r}:${c}`;
          const sA = aStage? takeFromStage(aStage) : null;
          const sB = bStage? takeFromStage(bStage) : null;
          if(sA && sB){ state.data.assignments[seatId] = [sA.id, sB.id]; }
          else if(sA){ state.data.assignments[seatId] = [sA.id]; }
        }
      }
    }
  }

  function autoAssign(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    if(!sec) return;

    // collect unassigned students and group by class
    const assignedIds = new Set();
    for(const v of Object.values(state.data.assignments||{})){
      if(Array.isArray(v)) v.forEach(id=>assignedIds.add(id)); else assignedIds.add(v);
    }
    const pool = state.data.students.filter(s=>!assignedIds.has(s.id));
    if(!pool.length) return;

    const groups = new Map();
    for(const s of pool){
      const cls = (s.className||'').trim();
      if(!groups.has(cls)) groups.set(cls, []);
      groups.get(cls).push(s);
    }

    const seatList = buildSeatSnake(hid, sid);
    const classAtPos = new Map(); // key "r,c" -> set of classes

    function getNeighborsClasses(r,c){
      const res = [];
      const left = `${r},${c-1}`; if(classAtPos.has(left)) res.push(...classAtPos.get(left));
      const up = `${r-1},${c}`; if(classAtPos.has(up)) res.push(...classAtPos.get(up));
      return res.filter(Boolean);
    }

    function pickClass(avoid){
      // sort classes by remaining count desc each time
      const entries = Array.from(groups.entries()).filter(([,arr])=>arr.length>0)
        .sort((a,b)=> b[1].length - a[1].length);
      for(const [cls, arr] of entries){
        if(cls && !avoid.includes(cls)) return cls;
      }
      const empty = entries.find(([cls,arr])=> cls===''
        && arr.length>0);
      if(empty && !avoid.includes('')) return '';
      return entries.length? entries[0][0] : null;
    }

    const capacity = sec.seatCapacity===2?2:1;
    function pickDifferentStage(currentStage){
      // ابحث في كل المجموعات عن طالب بمرحلة مختلفة
      const entries = Array.from(groups.entries()).filter(([,arr])=>arr.length>0)
        .sort((a,b)=> b[1].length - a[1].length);
      for(const [,arr] of entries){
        const idx = arr.findIndex(s=> (s.stage||'') !== (currentStage||''));
        if(idx>=0){ const s = arr.splice(idx,1)[0]; return s; }
      }
      return null;
    }

    for(const seat of seatList){
      const avoidBase = getNeighborsClasses(seat.row, seat.col);
      const seatClasses = new Set();
      const arr = [];
      for(let slot=0; slot<capacity; slot++){
        const avoid = [...avoidBase, ...seatClasses];
        const cls = pickClass(avoid);
        if(cls==null) break;
        let st = groups.get(cls).pop();
        if(capacity===2 && slot===1){
          // حاول اختيار طالب بمرحلة مختلفة عن الأول
          const firstStage = (arr.length? state.data.students.find(x=>x.id===arr[0])?.stage : null);
          if(firstStage && (st.stage||'')===firstStage){
            const alt = pickDifferentStage(firstStage);
            if(alt) st = alt;
          }
        }
        arr.push(st.id);
        seatClasses.add(cls);
      }
      if(arr.length) state.data.assignments[seat.seatId] = arr;
      classAtPos.set(`${seat.row},${seat.col}`, Array.from(seatClasses));
    }
  }

  // ===== Auto-Assign Options Modal =====
  function uniqueStages(){
    return Array.from(new Set(state.data.students.map(s=> (s.stage||'').trim()).filter(Boolean)));
  }

  function openAutoOptions(hid, sid){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    const cap = sec?.seatCapacity===2?2:1;
    const stages = uniqueStages();
    const host = document.getElementById('autoBody');
    const rowSelects = (sec.rows||[]).map((_,i)=>`<label><span>مرحلة صف ${i+1}</span><select data-row-stage="${i+1}">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label>`).join('');
    const maxCols = Math.max(...(sec.rows||[]).map(r=>r.seats));
    const colSelects = Array.from({length:maxCols},(_,i)=>`<label><span>مرحلة خط ${i+1}</span><select data-col-stage="${i+1}">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label>`).join('');
    const colPairSelects = Array.from({length:maxCols},(_,i)=>`<div class="row-config" style="grid-template-columns:1fr 1fr"><label><span>مرحلة الطالب الأول (خط ${i+1})</span><select data-col-stage-a="${i+1}">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label><label><span>مرحلة الطالب الثاني (خط ${i+1})</span><select data-col-stage-b="${i+1}">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label></div>`).join('');
    host.innerHTML = `
      <div class="form-grid">
        <label><input type="radio" name="autoMode" value="mixed" checked> <span>توزيع ذكي (تفادي تلاصق الشُعب، ومراحل مختلفة داخل المقعد الثنائي)</span></label>
        ${cap===2? `<label><input type="radio" name="autoMode" value="pairStages"> <span>طالبان بمراحل محددة</span></label>
          <div class="sub" data-mode="pairStages">
            <label><span>مرحلة الطالب الأول</span><select id="pairStageA">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label>
            <label><span>مرحلة الطالب الثاني</span><select id="pairStageB">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label>
          </div>` : ''}
        ${cap===1? `<label><input type="radio" name="autoMode" value="rowStage"> <span>مرحلة واحدة لكل صف</span></label>
          <div class="sub" data-mode="rowStage">${rowSelects}</div>
          <label><input type="radio" name="autoMode" value="colStage"> <span>مرحلة واحدة لكل خط (عمود)</span></label>
          <div class="sub" data-mode="colStage">${colSelects}</div>` : `<label><input type="radio" name="autoMode" value="colStage"> <span>مراحل لكل خط (عمود) مع اختلاف داخل المقعد</span></label>
          <div class="sub" data-mode="colStage">${colPairSelects}</div>`}
        <label><input type="radio" name="autoMode" value="singleStage"> <span>الجميع من نفس المرحلة</span></label>
        <div class="sub" data-mode="singleStage"><label><span>المرحلة</span><select id="singleStageSel">${stages.map(st=>`<option value="${st}">${st}</option>`).join('')}</select></label></div>
      </div>
    `;
    document.getElementById('autoRun').onclick = ()=>{
      const mode = document.querySelector('input[name="autoMode"]:checked').value;
      autoAssignByMode(hid, sid, mode);
      saveAll({withBackup:true});
      renderSeats(hid, sid);
      document.getElementById('autoOptions').classList.add('hidden');
    };
    document.getElementById('autoClose').onclick = ()=> document.getElementById('autoOptions').classList.add('hidden');
    document.getElementById('autoOptions').classList.remove('hidden');
  }

  function autoAssignByMode(hid, sid, mode){
    if(mode==='mixed'){ autoAssign(hid, sid); return; }
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    const seatList = buildSeatSnake(hid, sid);
    // نظّف تعيينات هذا القطاع قبل أي توزيع جديد لضمان توافق الفلاتر
    for(const seat of seatList){ delete state.data.assignments[seat.seatId]; }
    const cap = sec?.seatCapacity===2?2:1;
    const students = [...state.data.students];
    const takeFromStage = (stage)=>{
      const idx = students.findIndex(s=> (s.stage||'').trim()===stage && !isAssigned(s.id));
      if(idx<0) return null; const st = students[idx]; students.splice(idx,1); return st;
    };
    function isAssigned(id){
      for(const v of Object.values(state.data.assignments||{})){
        if(Array.isArray(v)? v.includes(id): v===id) return true;
      }
      return false;
    }
    if(mode==='pairStages' && cap===2){
      const a = document.getElementById('pairStageA').value;
      const b = document.getElementById('pairStageB').value;
      for(const seat of seatList){
        const sA = takeFromStage(a); const sB = takeFromStage(b);
        if(!sA || !sB) break;
        state.data.assignments[seat.seatId] = [sA.id, sB.id];
      }
      return;
    }
    if(mode==='rowStage' && cap===1){
      const map = new Map();
      (sec.rows||[]).forEach((_,i)=>{ const sel = document.querySelector(`[data-row-stage="${i+1}"]`); if(sel) map.set(i+1, sel.value); });
      for(const seat of seatList){
        const stg = map.get(seat.row);
        const s = takeFromStage(stg);
        if(!s) continue;
        state.data.assignments[seat.seatId] = s.id;
      }
      return;
    }

    if(mode==='colStage'){
      if(cap===1){
        const colMap = new Map();
        $$('[data-col-stage]').forEach(el=> colMap.set(+el.getAttribute('data-col-stage'), el.value));
        // وزّع حسب الأعمدة عموديًا من الأعلى للأدنى لضمان تطابق تام
        const rows = sec.rows||[];
        const maxCols = Math.max(...rows.map(r=> r.seats||0));
        for(let c=1;c<=maxCols;c++){
          const stage = colMap.get(c);
          if(!stage) continue;
          for(let r=1;r<=rows.length;r++){
            const seatsInRow = rows[r-1]?.seats||0;
            if(c>seatsInRow) continue; // لا يوجد مقعد بهذا العمود في هذا الصف
            const seatId = `${hid}:${sid}:${r}:${c}`;
            const s = takeFromStage(stage);
            if(!s) continue; // إذا نفدت المرحلة اتركه فارغًا
            state.data.assignments[seatId] = s.id;
          }
        }
      } else {
        const mapA = new Map();
        const mapB = new Map();
        $$('[data-col-stage-a]').forEach(el=> mapA.set(+el.getAttribute('data-col-stage-a'), el.value));
        $$('[data-col-stage-b]').forEach(el=> mapB.set(+el.getAttribute('data-col-stage-b'), el.value));
        // توزيع ثنائي حسب العمود عموديًا
        const rows = sec.rows||[];
        const maxCols = Math.max(...rows.map(r=> r.seats||0));
        for(let c=1;c<=maxCols;c++){
          let aStage = mapA.get(c) || uniqueStages()[0] || '';
          let bStage = mapB.get(c) || uniqueStages().find(s=> s!==aStage) || aStage;
          for(let r=1;r<=rows.length;r++){
            const seatsInRow = rows[r-1]?.seats||0;
            if(c>seatsInRow) continue;
            const seatId = `${hid}:${sid}:${r}:${c}`;
            const sA = aStage? takeFromStage(aStage) : null;
            const sB = bStage? takeFromStage(bStage) : null;
            if(sA && sB){
              state.data.assignments[seatId] = [sA.id, sB.id];
            } else if(sA){
              // إذا نفدت مرحلة B، حاول مرحلة مختلفة عن A
              const firstStage = sA.stage||'';
              let sDiff = null;
              for(let i=0;i<students.length;i++){
                if(!isAssigned(students[i].id) && (students[i].stage||'')!==firstStage){ sDiff = students.splice(i,1)[0]; break; }
              }
              state.data.assignments[seatId] = sDiff? [sA.id, sDiff.id] : [sA.id];
            }
          }
        }
      }
      return;
    }
    if(mode==='singleStage'){
      const stg = document.getElementById('singleStageSel').value;
      for(const seat of seatList){
        if(cap===2){
          const sA = takeFromStage(stg); const sB = takeFromStage(stg);
          if(!sA || !sB) break;
          state.data.assignments[seat.seatId] = [sA.id, sB.id];
        } else {
          const s = takeFromStage(stg); if(!s) break; state.data.assignments[seat.seatId] = s.id;
        }
      }
      return;
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

  // ===== Student Picker Modal =====
  function openStudentPicker(hid, sid, seatId){
    const hall = state.data.halls.find(h=>h.id===hid);
    const sec = hall?.sectors?.find(s=>s.id===sid);
    picker = { hid, sid, seatId, capacity: sec?.seatCapacity===2?2:1 };
    $('#pickerTitle').textContent = `اختيار طالب لـ ${seatId}`;
    $('#pickerSearch').value = '';
    buildPickerGroups('');
    $('#studentPicker').classList.remove('hidden');
  }

  function buildPickerGroups(query){
    const host = $('#pickerGroups');
    const q = (query||'').trim();
    const students = state.data.students.filter(s=>{
      const text = `${s.name} ${s.stage||''} ${s.className||''}`;
      return !q || text.includes(q);
    });
    const byStage = new Map();
    for(const s of students){
      const stg = (s.stage||'غير محدد').trim();
      if(!byStage.has(stg)) byStage.set(stg, []);
      byStage.get(stg).push(s);
    }
    host.innerHTML = Array.from(byStage.entries()).map(([stage, list])=>{
      const items = list.map(s=> `<div class=\"picker-item\" data-pick=\"${s.id}\">${s.name} <span class=\"badge\">${s.className||''}</span></div>`).join('');
      return `<div class=\"picker-group\"><h4>${stage}</h4><div class=\"picker-list\">${items}</div></div>`;
    }).join('');
    host.querySelectorAll('[data-pick]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const sid = el.getAttribute('data-pick');
        const arr = normalizeSeat(state.data.assignments[picker.seatId]);
        if(arr.length>=picker.capacity){ alert('المقعد ممتلئ'); return; }
        removeStudentFromAssignments(sid);
        arr.push(sid);
        state.data.assignments[picker.seatId] = arr;
        saveAll();
        renderSeats(picker.hid, picker.sid);
      });
    });
  }

  function initPicker(){
    $('#pickerClose').addEventListener('click', ()=> $('#studentPicker').classList.add('hidden'));
    $('#pickerDone').addEventListener('click', ()=> $('#studentPicker').classList.add('hidden'));
    $('#pickerClearSeat').addEventListener('click', ()=>{
      if(!picker.seatId) return;
      delete state.data.assignments[picker.seatId];
      saveAll();
      renderSeats(picker.hid, picker.sid);
    });
    $('#pickerSearch').addEventListener('input', (e)=> buildPickerGroups(e.target.value));
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
    initPicker();
    renderStudents();
    renderHalls();
    refreshStats();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
