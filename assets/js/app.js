/* نظام خارطة جلوس - واجهة عربية RTL */
(function(){
  const state = {
    data: StorageAPI.load(),
    settings: Object.assign({
      theme:'light',
      backupLimit: 10,
      schoolName:'',
      schoolType:'بنين',
      academicYear:'',
      principalName:'',
      committeeHead:'',
      logoDataUrl:'',
      ministryLogoDataUrl:'',
      hasSchoolLogo:false,
      hasMinistryLogo:false,
      backupScheduleEnabled:false,
      backupScheduleTime:'23:00',
      backupScheduleLastRun:'',
      printHeaderFontFamily:'Tajawal',
      printHeaderFontSize:18,
      printHeaderFontColor:'#000000',
      printTextColor:'#000000',
      printAccentColor:'#008080',
      printMinLogoSizePx:48,
      printSchoolLogoSizePx:48,
      printPaperSize:'A4',
      printOrientation:'portrait',
      printMarginMm:10
    }, StorageAPI.loadSettings()),
    filter:{ studentQuery:'' }
  };

  // ==== Helpers ====
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2,9);
  const fmt = n => new Intl.NumberFormat('ar-IQ').format(n);
  let dragFromSeat = null;
  let picker = { seatId:null, hid:null, sid:null, capacity:1 };

  async function compressImageFile(file, maxDim=480){
    return new Promise((resolve, reject)=>{
      try{
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = ()=>{
          try{
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            const scale = Math.min(1, maxDim / Math.max(w,h));
            const cw = Math.max(1, Math.round(w * scale));
            const ch = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, cw, ch);
            let dataUrl = '';
            try{ dataUrl = canvas.toDataURL('image/webp', 0.85); }
            catch{ try{ dataUrl = canvas.toDataURL('image/jpeg', 0.85); } catch{ dataUrl = canvas.toDataURL('image/png'); } }
            URL.revokeObjectURL(url);
            resolve(String(dataUrl||''));
          }catch(e){ URL.revokeObjectURL(url); reject(e); }
        };
        img.onerror = (e)=>{ URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      }catch(e){ reject(e); }
    });
  }

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
        updatePrintButtonVisibility(target);
      });
    });
  }

  function updatePrintButtonVisibility(activeTarget){
    const printBtn = $('#btnPrint');
    if(!printBtn) return;
    if(activeTarget==='#halls'){ printBtn.style.display = 'inline-flex'; }
    else { printBtn.style.display = 'none'; }
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

  // ==== School Info (Dashboard) ====
  function initSchoolInfo(){
    const s = state.settings;
    const nameEl = $('#schName');
    const typeEl = $('#schType');
    const yearEl = $('#schYear');
    const principalEl = $('#schPrincipal');
    const committeeEl = $('#schCommittee');
    const logoInput = $('#schLogo');
    const logoPreview = $('#schLogoPreview');
    const clearLogoBtn = $('#btnClearLogo');
    const logoStatus = $('#schLogoStatus');
    const ministryLogoInput = $('#ministryLogo');
    const ministryLogoPreview = $('#ministryLogoPreview');
    const clearMinistryLogoBtn = $('#btnClearMinistryLogo');

    if(nameEl) nameEl.value = s.schoolName||'';
    if(typeEl) typeEl.value = s.schoolType||'بنين';
    if(yearEl) yearEl.value = s.academicYear||'';
    if(principalEl) principalEl.value = s.principalName||'';
    if(committeeEl) committeeEl.value = s.committeeHead||'';
    if(logoPreview){
      if(s.logoDataUrl){ logoPreview.src = s.logoDataUrl; logoPreview.style.display = 'block'; }
      else { logoPreview.src=''; logoPreview.style.display = 'none'; }
    }
    if(ministryLogoPreview){
      if(s.ministryLogoDataUrl){ ministryLogoPreview.src = s.ministryLogoDataUrl; ministryLogoPreview.style.display = 'block'; }
      else { ministryLogoPreview.src=''; ministryLogoPreview.style.display = 'none'; }
    }
    if(logoStatus){ logoStatus.textContent = s.logoDataUrl? 'تم الرفع ✓' : ''; }
    const ministryLogoStatus = $('#ministryLogoStatus');
    if(ministryLogoStatus){ ministryLogoStatus.textContent = s.ministryLogoDataUrl? 'تم الرفع ✓' : ''; }

    function saveSettings(){ StorageAPI.saveSettings(state.settings); }

    if(nameEl) nameEl.addEventListener('input', ()=>{ state.settings.schoolName = nameEl.value.trim(); saveSettings(); });
    if(typeEl) typeEl.addEventListener('change', ()=>{ state.settings.schoolType = typeEl.value; saveSettings(); });
    if(yearEl) yearEl.addEventListener('input', ()=>{ state.settings.academicYear = yearEl.value.trim(); saveSettings(); });
    if(principalEl) principalEl.addEventListener('input', ()=>{ state.settings.principalName = principalEl.value.trim(); saveSettings(); });
    if(committeeEl) committeeEl.addEventListener('input', ()=>{ state.settings.committeeHead = committeeEl.value.trim(); saveSettings(); });

    if(logoInput) logoInput.addEventListener('change', async ()=>{
      const file = logoInput.files?.[0];
      if(!file){ return; }
      if(!file.type.startsWith('image/')){ alert('الرجاء اختيار صورة للشعار'); return; }
      try{
        const dataUrl = await compressImageFile(file, 600);
        state.settings.logoDataUrl = dataUrl;
        state.settings.hasSchoolLogo = true;
        saveSettings();
        try{ await StorageAPI.setAsset('schoolLogo', dataUrl); }catch(e){ console.warn('failed to store school logo in IndexedDB', e); }
        if(logoPreview){ logoPreview.src = state.settings.logoDataUrl; logoPreview.style.display = 'block'; }
        if(logoStatus){ logoStatus.textContent = 'تم الرفع ✓'; }
        applyPrintHeaderPreview();
      }catch(e){
        alert('تعذر معالجة الصورة. يرجى اختيار ملف صورة آخر أو تصغير حجمه.');
        console.error(e);
      }
    });

    if(clearLogoBtn) clearLogoBtn.addEventListener('click', ()=>{
      state.settings.logoDataUrl = '';
      state.settings.hasSchoolLogo = false;
      saveSettings();
      if(logoPreview){ logoPreview.src=''; logoPreview.style.display='none'; }
      if(logoStatus){ logoStatus.textContent = ''; }
      StorageAPI.removeAsset('schoolLogo').catch(()=>{});
    });

    if(ministryLogoInput) ministryLogoInput.addEventListener('change', async ()=>{
      const file = ministryLogoInput.files?.[0];
      if(!file){ return; }
      if(!file.type.startsWith('image/')){ alert('الرجاء اختيار صورة لشعار الوزارة'); return; }
      try{
        const dataUrl = await compressImageFile(file, 600);
        state.settings.ministryLogoDataUrl = dataUrl;
        state.settings.hasMinistryLogo = true;
        saveSettings();
        try{ await StorageAPI.setAsset('ministryLogo', dataUrl); }catch(e){ console.warn('failed to store ministry logo in IndexedDB', e); }
        if(ministryLogoPreview){ ministryLogoPreview.src = state.settings.ministryLogoDataUrl; ministryLogoPreview.style.display = 'block'; }
        if(ministryLogoStatus){ ministryLogoStatus.textContent = 'تم الرفع ✓'; }
        applyPrintHeaderPreview();
      }catch(e){
        alert('تعذر معالجة صورة شعار الوزارة. يرجى اختيار ملف صورة آخر أو تصغير حجمه.');
        console.error(e);
      }
    });

    if(clearMinistryLogoBtn) clearMinistryLogoBtn.addEventListener('click', ()=>{
      state.settings.ministryLogoDataUrl = '';
      state.settings.hasMinistryLogo = false;
      saveSettings();
      if(ministryLogoPreview){ ministryLogoPreview.src=''; ministryLogoPreview.style.display='none'; }
      if(ministryLogoStatus){ ministryLogoStatus.textContent = ''; }
      StorageAPI.removeAsset('ministryLogo').catch(()=>{});
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
          <div class="mt seats" id="seats-${h.id}-${sec.id}" data-cols="${Math.min(4, Math.max(...(sec.rows||[]).map(r=> r.seats||0), 1))}"></div>
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
    // تم إخفاء الحقل القديم "مقاعد ضمن عمود" والاكتفاء بمتحكمات الأعمدة أعلى المقاعد

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
    // سنبني المقاعد عموديًا بحسب الأعمدة (الخطوط)

    // header controls: stage per vertical line
    const rows = sec.rows||[];
    const maxCols = Math.max(...rows.map(r=> r.seats||0));
    const visibleCols = Math.min(maxCols||1, 4);
    const colHeights = rowsToColHeights(rows);
    const stages = uniqueStages();
    const capacity = sec.seatCapacity===2?2:1;
    const storedSingle = sec?.colStages || [];
    const storedA = sec?.colStagesA || [];
    const storedB = sec?.colStagesB || [];
    const lineControls = Array.from({length:visibleCols},(_,i)=>{
      const c = i+1;
      const hVal = colHeights[i]||rows.length||1;
      if(capacity===2){
        const selA = storedA[i]||''; const selB = storedB[i]||'';
        return `<div class="line-ctrl two"><div class="line-label">خط ${c}</div><div class="line-pair"><div class="pair-item"><div class="pair-title">طالب 1 (يمين)</div><select class="line-stage-a" data-col="${c}">${stages.map(s=>`<option value="${s}" ${selA===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="pair-item"><div class="pair-title">طالب 2 (يسار)</div><select class="line-stage-b" data-col="${c}">${stages.map(s=>`<option value="${s}" ${selB===s?'selected':''}>${s}</option>`).join('')}</select></div></div><label class="col-height-label"><span>مقاعد ضمن عمود</span><input type="number" min="1" class="col-height" data-col="${c}" value="${hVal}" /></label></div>`;
      }
      const sel = storedSingle[i]||'';
      return `<div class="line-ctrl"><div class="line-label">خط ${c}</div><select class="line-stage" data-col="${c}">${stages.map(s=>`<option value="${s}" ${sel===s?'selected':''}>${s}</option>`).join('')}</select><label class="col-height-label"><span>مقاعد ضمن عمود</span><input type="number" min="1" class="col-height" data-col="${c}" value="${hVal}" /></label></div>`;
    }).join('');

    const header = `<div class="line-controls" style="grid-column:1/-1; grid-template-columns:repeat(${visibleCols}, 1fr)">${lineControls}</div><div class="line-actions" style="grid-column:1/-1"><button class="btn" id="applyLines-${hid}-${sid}">تطبيق التوزيع حسب الخطوط</button></div>`;

    // عدد الأعمدة المرئية يساوي أكبر عدد مقاعد في أي خط
    host.setAttribute('data-cols', String(visibleCols));
    const columnsHTML = Array.from({length:visibleCols}, (_,i)=>{
      const c = i+1;
      const h = colHeights[i]||0;
      const seatsInCol = Array.from({length:h}, (_,ri)=>{
        const r = ri+1;
        const seatId = `${hid}:${sid}:${r}:${c}`;
        const assigned = normalizeSeat(state.data.assignments[seatId]);
        if(capacity===2){
          const [s1,s2] = [assigned[0], assigned[1]];
          const st1 = state.data.students.find(x=>x.id===s1);
          const st2 = state.data.students.find(x=>x.id===s2);
          const n1 = st1? `${st1.name}` : '<span class="muted">فارغ</span>';
          const n2 = st2? `${st2.name}` : '<span class="muted">فارغ</span>';
          return `<div class="seat two" draggable="true" data-seat="${seatId}">
            <div class="label">خط ${c} - صف ${r}</div>
            <div class="names">
              <div class="slot"><div class="name">${n1}</div><div class="meta">${st1? `${st1.stage||''} ${st1.className||''}`:''}</div></div>
              <div class="slot"><div class="name">${n2}</div><div class="meta">${st2? `${st2.stage||''} ${st2.className||''}`:''}</div></div>
            </div>
          </div>`;
        } else {
          const s = assigned[0];
          const st = state.data.students.find(x=>x.id===s);
          const name = st? `${st.name}` : '<span class="muted">فارغ</span>';
          return `<div class="seat" draggable="true" data-seat="${seatId}">
            <div class="label">خط ${c} - صف ${r}</div>
            <div class="name">${name}</div>
            <div class="meta">${st? `${st.stage||''} ${st.className||''}`:''}</div>
          </div>`;
        }
      }).join('');
      return `<div class="col">${seatsInCol}</div>`;
    }).join('');

    host.innerHTML = header + columnsHTML;

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

    // Wire per-column height changes
    host.querySelectorAll('.col-height').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        // Read heights from all visible inputs to avoid leftover hidden columns
        const heights = Array.from(host.querySelectorAll('.col-height')).map(el=> Math.max(1, parseInt(el.value||'1',10)));
        const maxRows = Math.max(...heights, 1);
        const newRows = Array.from({length:maxRows}, (_,rowIdx)=>{
          const seatsInThisRow = heights.filter(h=> h >= (rowIdx+1)).length;
          return {seats: seatsInThisRow};
        });
        sec.rows = newRows;
        saveAll();
        renderHalls();
      });
    });
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
      const chosenStages = [];
      for(let c=1;c<=visibleCols;c++){
        const sel = document.querySelector(`#seats-${hid}-${sid} .line-stage[data-col="${c}"]`);
        const stg = sel?.value; if(stg) chosenStages[c-1] = stg; else chosenStages[c-1] = '';
        if(!stg) continue;
        for(let r=1;r<=rows.length;r++){
          const seatsInRow = rows[r-1]?.seats||0; if(c>seatsInRow) continue;
          const seatId = `${hid}:${sid}:${r}:${c}`;
          const s = takeFromStage(stg); if(!s) continue;
          state.data.assignments[seatId] = s.id;
        }
      }
      sec.colStages = chosenStages;
    } else {
      const chosenA = []; const chosenB = [];
      for(let c=1;c<=visibleCols;c++){
        const aSel = document.querySelector(`#seats-${hid}-${sid} .line-stage-a[data-col="${c}"]`);
        const bSel = document.querySelector(`#seats-${hid}-${sid} .line-stage-b[data-col="${c}"]`);
        let aStage = aSel?.value || '';
        let bStage = bSel?.value || '';
        chosenA[c-1] = aStage; chosenB[c-1] = bStage;
        for(let r=1;r<=rows.length;r++){
          const seatsInRow = rows[r-1]?.seats||0; if(c>seatsInRow) continue;
          const seatId = `${hid}:${sid}:${r}:${c}`;
          const sA = aStage? takeFromStage(aStage) : null;
          const sB = bStage? takeFromStage(bStage) : null;
          if(sA && sB){ state.data.assignments[seatId] = [sA.id, sB.id]; }
          else if(sA){ state.data.assignments[seatId] = [sA.id]; }
        }
      }
      sec.colStagesA = chosenA; sec.colStagesB = chosenB;
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
    // legacy: export data only
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exam-seating-data.json';
    a.click();
  }

  function buildFullPackage(){
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state.data,
      settings: state.settings
    };
    return payload;
  }

  function exportFull(){
    const pkg = buildFullPackage();
    const blob = new Blob([JSON.stringify(pkg, null, 2)], {type:'application/json'});
    const ts = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `exam-seating-backup-${ts}.json`;
    a.click();
  }

  async function saveAsFull(){
    const pkg = buildFullPackage();
    const ts = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
    const suggested = `exam-seating-backup-${ts}.json`;
    try{
      if(window.showSaveFilePicker){
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }]
        });
        const stream = await handle.createWritable();
        await stream.write(new Blob([JSON.stringify(pkg, null, 2)], {type:'application/json'}));
        await stream.close();
        toast('تم الحفظ باسم بنجاح');
      }else{
        exportFull(); // fallback to download
      }
    }catch(e){
      if(e && e.name==='AbortError'){ return; }
      console.error(e);
      alert('تعذر الحفظ باسم. تمت إعادة المحاولة كتنزيل عادي.');
      exportFull();
    }
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
      // ثلاثة أشكال: {students:[...] } فقط، أو هيكل data فقط، أو حزمة كاملة {data, settings}
      if(Array.isArray(obj.students)){
        state.data.students.push(...obj.students.map(s=> ({id: uid(), name:s.name, stage:s.stage, className:s.className})));
        count = obj.students.length;
      } else if(obj && obj.data && (obj.settings!==undefined)){
        state.data = obj.data || {students:[], halls:[], assignments:{}};
        // دمج الإعدادات مع الحفاظ على الافتراضيات
        state.settings = Object.assign({
          theme:'light', backupLimit:10, schoolName:'', schoolType:'بنين', academicYear:'', principalName:'', committeeHead:'', logoDataUrl:''
        }, obj.settings||{});
        StorageAPI.saveSettings(state.settings);
        setTheme();
        count = state.data.students.length;
      } else {
        // نفترض أنه هيكل بيانات كامل فقط
        state.data = obj || {students:[], halls:[], assignments:{}};
        count = state.data.students.length;
      }
      saveAll({withBackup:true});
      renderStudents();
      renderHalls();
      refreshStats();
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
    // exportFull replaces legacy exportJSON for full backups
    const btnFull = $('#btnExportFull'); if(btnFull) btnFull.addEventListener('click', exportFull);
    const btnSaveAs = $('#btnSaveAs'); if(btnSaveAs) btnSaveAs.addEventListener('click', saveAsFull);
    // keep students-only CSV export for convenience
    $('#btnExportStudentsCSV').addEventListener('click', exportStudentsCSV);

    $('#btnImportStudents').addEventListener('click', async ()=>{
      const input = $('#fileImport');
      const file = input.files?.[0];
      if(!file){ alert('الرجاء اختيار ملف'); return; }
      try{
        const count = await processImportFile(file);
        toast(`تم الاستيراد بنجاح. عدد الطلاب: ${count}`);
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
    const schEnabledEl = $('#backupScheduleEnabled');
    const schTimeEl = $('#backupScheduleTime');
    if(schEnabledEl) schEnabledEl.checked = !!state.settings.backupScheduleEnabled;
    if(schTimeEl) schTimeEl.value = state.settings.backupScheduleTime || '23:00';
    const phFontFam = $('#printHeaderFontFamily');
    const phFontSize = $('#printHeaderFontSize');
    const phFontColor = $('#printHeaderFontColor');
    const minLogoSizeInp = $('#printMinLogoSizePx');
    const schLogoSizeInp = $('#printSchoolLogoSizePx');
    const pTextColor = $('#printTextColor');
    const pAccentColor = $('#printAccentColor');
    const pSize = $('#printPaperSize');
    const pOrient = $('#printOrientation');
    const pMargin = $('#printMarginMm');
    if(phFontFam) phFontFam.value = state.settings.printHeaderFontFamily||'Tajawal';
    if(phFontSize) phFontSize.value = String(state.settings.printHeaderFontSize||18);
    if(phFontColor) phFontColor.value = state.settings.printHeaderFontColor||'#000000';
    if(minLogoSizeInp) minLogoSizeInp.value = String(state.settings.printMinLogoSizePx||48);
    if(schLogoSizeInp) schLogoSizeInp.value = String(state.settings.printSchoolLogoSizePx||48);
    if(pTextColor) pTextColor.value = state.settings.printTextColor||'#000000';
    if(pAccentColor) pAccentColor.value = state.settings.printAccentColor||'#008080';
    if(pSize) pSize.value = state.settings.printPaperSize||'A4';
    if(pOrient) pOrient.value = state.settings.printOrientation||'portrait';
    if(pMargin) pMargin.value = String(state.settings.printMarginMm||10);

    function performSaveSettings(){
      state.settings.theme = $('#themeSelect').value;
      state.settings.backupLimit = Math.max(1, parseInt($('#backupLimit').value||'10',10));
      if(schEnabledEl) state.settings.backupScheduleEnabled = schEnabledEl.checked;
      if(schTimeEl) state.settings.backupScheduleTime = schTimeEl.value || '23:00';
      if(phFontFam) state.settings.printHeaderFontFamily = phFontFam.value||'Tajawal';
      if(phFontSize) state.settings.printHeaderFontSize = Math.max(12, parseInt(phFontSize.value||'18',10));
      if(phFontColor) state.settings.printHeaderFontColor = phFontColor.value||'#000000';
      if(minLogoSizeInp) state.settings.printMinLogoSizePx = Math.max(16, parseInt(minLogoSizeInp.value||'48',10));
      if(schLogoSizeInp) state.settings.printSchoolLogoSizePx = Math.max(16, parseInt(schLogoSizeInp.value||'48',10));
      if(pTextColor) state.settings.printTextColor = pTextColor.value||'#000000';
      if(pAccentColor) state.settings.printAccentColor = pAccentColor.value||'#008080';
      if(pSize) state.settings.printPaperSize = pSize.value||'A4';
      if(pOrient) state.settings.printOrientation = pOrient.value||'portrait';
      if(pMargin) state.settings.printMarginMm = Math.max(0, parseInt(pMargin.value||'10',10));
      StorageAPI.saveSettings(state.settings);
      setTheme();
      startBackupScheduler();
      applyPrintSettings();
      applyPrintHeaderPreview();
      toast('تم حفظ الإعدادات');
    }
    const btnSaveGeneral = $('#btnSaveSettings');
    if(btnSaveGeneral) btnSaveGeneral.addEventListener('click', performSaveSettings);
    const btnSavePrint = $('#btnSavePrintSettings');
    if(btnSavePrint) btnSavePrint.addEventListener('click', performSaveSettings);

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

    const previewBtn = $('#btnPreviewPrint');
    if(previewBtn){ previewBtn.addEventListener('click', ()=>{
      // انتقل إلى تبويب القاعات ثم اطبع
      const hallsTab = Array.from(document.querySelectorAll('.tab')).find(t=> t.getAttribute('data-target')==='#halls');
      if(hallsTab) hallsTab.click(); else { $$('.view').forEach(v=>v.classList.remove('active')); $('#halls').classList.add('active'); }
      applyPrintSettings();
      window.print();
    }); }
    $('#btnPrint').addEventListener('click', ()=>{ applyPrintSettings(); window.print(); });
  }

  // ==== Backup Scheduler ====
  let backupTimer = null;
  function formatTimeHM(d){
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  function todayISODate(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function checkBackupSchedule(){
    if(!state.settings.backupScheduleEnabled) return;
    const nowHM = formatTimeHM(new Date());
    const target = state.settings.backupScheduleTime||'23:00';
    if(nowHM!==target) return;
    const today = todayISODate();
    if(state.settings.backupScheduleLastRun===today) return;
    StorageAPI.addBackup(state.data, state.settings.backupLimit);
    state.settings.backupScheduleLastRun = today;
    StorageAPI.saveSettings(state.settings);
    refreshStats();
    toast('تم النسخ الاحتياطي المجدول');
  }
  function startBackupScheduler(){
    if(backupTimer){ clearInterval(backupTimer); backupTimer = null; }
    if(!state.settings.backupScheduleEnabled) return;
    backupTimer = setInterval(checkBackupSchedule, 60*1000);
  }

  // ==== Apply Print Settings ====
  function applyPrintSettings(){
    document.documentElement.style.setProperty('--print-text', state.settings.printTextColor||'#000000');
    document.documentElement.style.setProperty('--print-accent', state.settings.printAccentColor||'#008080');
    const schLogo = $('#printSchoolLogo');
    const minLogo = $('#printMinistryLogo');
    const titleEl = $('#printSchoolTitle');
    const typeEl = $('#printSchoolType');
    if(titleEl){
      titleEl.textContent = state.settings.schoolName || '';
      titleEl.style.fontFamily = state.settings.printHeaderFontFamily || 'Tajawal';
      titleEl.style.fontSize = (state.settings.printHeaderFontSize||18) + 'px';
      titleEl.style.color = state.settings.printHeaderFontColor || '#000000';
    }
    if(typeEl){
      const t = (state.settings.schoolType||'').trim();
      const map = { 'بنين':'للبنين', 'بنات':'للبنات', 'مختلطة':'مختلطة' };
      typeEl.textContent = map[t] || t || '';
      typeEl.style.fontFamily = state.settings.printHeaderFontFamily || 'Tajawal';
      typeEl.style.color = state.settings.printHeaderFontColor || '#000000';
    }
    if(schLogo){
      if(state.settings.logoDataUrl){ schLogo.src = state.settings.logoDataUrl; schLogo.style.display='block'; schLogo.style.height = (state.settings.printSchoolLogoSizePx||48)+'px'; }
      else { schLogo.src=''; schLogo.style.display='none'; }
    }
    if(minLogo){
      if(state.settings.ministryLogoDataUrl){ minLogo.src = state.settings.ministryLogoDataUrl; minLogo.style.display='block'; minLogo.style.height = (state.settings.printMinLogoSizePx||48)+'px'; }
      else { minLogo.src=''; minLogo.style.display='none'; }
    }
    let styleEl = document.getElementById('printPageStyle');
    if(!styleEl){ styleEl = document.createElement('style'); styleEl.id='printPageStyle'; styleEl.setAttribute('media','print'); document.head.appendChild(styleEl); }
    const size = (state.settings.printPaperSize||'A4');
    const orientation = (state.settings.printOrientation||'portrait');
    const margin = Math.max(0, state.settings.printMarginMm||10);
    styleEl.textContent = `@page{ size: ${size} ${orientation}; margin: ${margin}mm; }\n@media print{ @page{ size: ${size} ${orientation}; } }`;
  }

  function applyPrintHeaderPreview(){
    const titlePrev = $('#phPrevTitle');
    const typePrev = $('#phPrevType');
    const schPrev = $('#phPrevSchLogo');
    const minPrev = $('#phPrevMinLogo');
    if(titlePrev){
      titlePrev.textContent = state.settings.schoolName || '';
      titlePrev.style.fontFamily = state.settings.printHeaderFontFamily || 'Tajawal';
      titlePrev.style.fontSize = (state.settings.printHeaderFontSize||18) + 'px';
      titlePrev.style.color = state.settings.printHeaderFontColor || '#000000';
    }
    if(typePrev){
      const t = (state.settings.schoolType||'').trim();
      const map = { 'بنين':'للبنين', 'بنات':'للبنات', 'مختلطة':'مختلطة' };
      typePrev.textContent = map[t] || t || '';
      typePrev.style.fontFamily = state.settings.printHeaderFontFamily || 'Tajawal';
      typePrev.style.color = state.settings.printHeaderFontColor || '#000000';
    }
    if(schPrev){
      if(state.settings.logoDataUrl){ schPrev.src = state.settings.logoDataUrl; schPrev.style.display='block'; schPrev.style.height = (state.settings.printSchoolLogoSizePx||48)+'px'; }
      else { schPrev.src=''; schPrev.style.display='none'; }
    }
    if(minPrev){
      if(state.settings.ministryLogoDataUrl){ minPrev.src = state.settings.ministryLogoDataUrl; minPrev.style.display='block'; minPrev.style.height = (state.settings.printMinLogoSizePx||48)+'px'; }
      else { minPrev.src=''; minPrev.style.display='none'; }
    }
  }

  // ==== Init ====
  function init(){
    setTheme();
    initTabs();
    initStudents();
    initHalls();
    initIO();
    initSettings();
    initSchoolInfo();
    initPicker();
    renderStudents();
    renderHalls();
    refreshStats();
    startBackupScheduler();
    applyPrintSettings();
    applyPrintHeaderPreview();
    // إظهار زر الطباعة فقط في تبويب القاعات
    updatePrintButtonVisibility('#dashboard');
    // جلب الشعارات من IndexedDB بعد التحميل لتجاوز حدود localStorage
    Promise.all([
      StorageAPI.getAsset('schoolLogo'),
      StorageAPI.getAsset('ministryLogo')
    ]).then(async ([sch,min])=>{
      // إذا لم يوجد في IndexedDB لكن يوجد في الإعدادات، خزّنه مهاجرةً لضمان الاستمرارية
      if(!sch && state.settings.logoDataUrl){ try{ await StorageAPI.setAsset('schoolLogo', state.settings.logoDataUrl); sch = state.settings.logoDataUrl; }catch{} }
      if(!min && state.settings.ministryLogoDataUrl){ try{ await StorageAPI.setAsset('ministryLogo', state.settings.ministryLogoDataUrl); min = state.settings.ministryLogoDataUrl; }catch{} }
      if(sch){ state.settings.logoDataUrl = sch; state.settings.hasSchoolLogo = true; }
      if(min){ state.settings.ministryLogoDataUrl = min; state.settings.hasMinistryLogo = true; }
      // حدث المعاينات إن وجدت
      const logoPreview = $('#schLogoPreview');
      const ministryLogoPreview = $('#ministryLogoPreview');
      if(logoPreview){ if(sch){ logoPreview.src = sch; logoPreview.style.display='block'; } }
      if(ministryLogoPreview){ if(min){ ministryLogoPreview.src = min; ministryLogoPreview.style.display='block'; } }
      applyPrintHeaderPreview();
    }).catch(()=>{});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
