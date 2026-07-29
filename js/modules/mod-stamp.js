// ============================================================
// HB-Mieterportal | mod-stamp.js
// HB-Stamp — Arbeitszeiterfassung (§ 17 MiLoG). Nur admin/manager.
// Getrennt von HB-Track. Bezug ueber auth.uid(). Pausen aus work_breaks.
// ============================================================

let _stmp = { y:null, m:null, uid:null, caps:{view:false,approve:false}, users:[], _sessions:[] };

const _stEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const _stMon = m => ['','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][m];
const _stH   = min => { const h=Math.floor(Math.abs(min)/60), mm=Math.abs(min)%60; return `${min<0?'-':''}${h}:${String(mm).padStart(2,'0')} h`; };
const _stTime = ts => ts ? new Date(ts).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : '';
const _stEur  = n => Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
// Abwesenheitstypen (aus absence_types) ---------------------------
function _absType(key){ return (_stmp.absTypes||[]).find(t=>t.key===key) || null; }
function _absLabel(key){ return _absType(key)?.label || key; }
function _absVacationKeys(){ return (_stmp.absTypes||[]).filter(t=>t.counts_as_vacation).map(t=>t.key); }
function _absSollKeys(){ return new Set((_stmp.absTypes||[]).filter(t=>t.fulfills_soll).map(t=>t.key)); }
// Lohn ------------------------------------------------------------
function _wageForDay(wages, ds){ return (wages||[]).find(w => w.valid_from <= ds && (!w.valid_to || w.valid_to >= ds)) || null; }
function _monatsverdienst(sessions, wages){
    let eur=0, hours=0, hasRate=false;
    (sessions||[]).forEach(s=>{
        if (!s.end_at || !['erfasst','genehmigt'].includes(s.status)) return;
        const net = _stNet(s)/60; hours += net;
        const w = _wageForDay(wages, s.work_date);
        if (w) { eur += net * Number(w.hourly_rate); hasRate = true; }
    });
    return { eur, hours, hasRate };
}
function _stNet(s) {
    if (!s.end_at) return 0;
    return Math.max(0, Math.round((new Date(s.end_at) - new Date(s.start_at))/60000) - (s.break_minutes||0));
}

// ─── Entry Point ───────────────────────────────────────────────
async function loadStamp() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="py-16 text-center text-gray-400">Lädt…</div>`;
    const now = new Date();
    if (!_stmp.y) { _stmp.y = now.getFullYear(); _stmp.m = now.getMonth()+1; }
    if (!_stmp.uid) _stmp.uid = currentUser.id;

    const [{ data: v }, { data: a }] = await Promise.all([
        _supabase.rpc('can_view_all_times'),
        _supabase.rpc('can_approve_times'),
    ]);
    _stmp.caps = { view: v === true, approve: a === true };

    if (_stmp.caps.view || _stmp.caps.approve) {
        const { data: us } = await _supabase.from('profiles')
            .select('id, full_name, email').in('role', ['admin','manager']).order('full_name');
        _stmp.users = us || [];
        if (!_stmp.users.some(u => u.id === _stmp.uid)) _stmp.uid = currentUser.id;
    } else {
        _stmp.users = [{ id: currentUser.id, full_name: userProfile?.full_name || 'Ich', email: userProfile?.email }];
        _stmp.uid = currentUser.id;
    }
    _stmp.isAdmin = userProfile?.role === 'admin';   // Mitarbeiter-Reiter nur fuer Admins (RLS ist die eigentliche Absicherung)
    _stmp.view = _stmp.view || 'zeiten';
    await _stampRenderView();
}

async function _stampRenderView() {
    if (_stmp.isAdmin && _stmp.view === 'mitarbeiter') return _stampRenderStaff();
    return _stampRender();
}
window._stampSetView = (v) => { _stmp.view = v; _stampRenderView(); };

function _stampToggle() {
    if (!_stmp.isAdmin) return '';
    const v = _stmp.view || 'zeiten';
    return `<div class="inline-flex bg-gray-100 rounded-xl p-1 mb-5">
      <button onclick="_stampSetView('zeiten')" class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${v!=='mitarbeiter'?'bg-white text-hb-olive shadow-sm':'text-gray-500'}">Zeiten</button>
      <button onclick="_stampSetView('mitarbeiter')" class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${v==='mitarbeiter'?'bg-white text-hb-olive shadow-sm':'text-gray-500'}">Mitarbeiter</button>
    </div>`;
}

// ─── Render ────────────────────────────────────────────────────
async function _stampRender() {
    const ca = document.getElementById('content-area');
    const { y, m, uid } = _stmp;
    const daysInMonth = new Date(y, m, 0).getDate();
    const first = `${y}-${String(m).padStart(2,'0')}-01`;
    const last  = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
    const yStart = `${y}-01-01`, yEnd = `${y}-12-31`;

    // Lohn nur laden, wenn erlaubt (Admin oder eigene Person) — RLS wuerde Fremde ohnehin blocken
    const mayWage = _stmp.isAdmin || uid === currentUser.id;
    const [sesRes, absRes, setRes, ledRes, clsRes, absYearRes, atRes, wageRes] = await Promise.all([
        _supabase.from('work_sessions').select('*').eq('user_id', uid).gte('work_date', first).lte('work_date', last).order('start_at'),
        _supabase.from('absences').select('*').eq('user_id', uid).lte('date_from', last).gte('date_to', first),
        _supabase.from('employment_settings').select('*').eq('user_id', uid).order('valid_from', { ascending:true }),
        _supabase.from('vacation_ledger').select('*').eq('user_id', uid).eq('year', y).maybeSingle(),
        _supabase.from('month_closures').select('id').eq('user_id', uid).eq('year', y).eq('month', m).maybeSingle(),
        _supabase.from('absences').select('date_from,date_to,type').eq('user_id', uid).eq('status','genehmigt').lte('date_from', yEnd).gte('date_to', yStart),
        _supabase.from('absence_types').select('*').order('sort_order', { ascending:true }),
        mayWage ? _supabase.from('employment_wages').select('*').eq('user_id', uid).order('valid_from', { ascending:true }) : Promise.resolve({ data: [] }),
    ]);
    _stmp.absTypes = atRes.data || [];
    const sessions = sesRes.data || [];
    const absences = absRes.data || [];
    const settingsRows = setRes.data || [];   // alle Zeilen (tagesgenaue Soll-Auswertung)
    const ledger   = ledRes.data || null;
    const closed   = !!clsRes.data;
    const urlaubYear = (absYearRes.data || []).filter(a => _absVacationKeys().includes(a.type));   // nur Typen mit counts_as_vacation
    const wages = wageRes.data || [];
    _stmp._sessions = sessions;
    const verdienst = mayWage ? _monatsverdienst(sessions, wages) : null;

    let pending = [];
    if (_stmp.caps.approve) {
        const [pa, pw] = await Promise.all([
            _supabase.from('absences').select('*').eq('status','beantragt').order('created_at', { ascending:false }).limit(50),
            _supabase.from('work_sessions').select('*').eq('status','beantragt').order('created_at', { ascending:false }).limit(50),
        ]);
        pending = [ ...(pa.data||[]).map(x=>({kind:'absence',...x})), ...(pw.data||[]).map(x=>({kind:'session',...x})) ];
    }

    const k = _stampKpis(sessions, absences, settingsRows, y, m);
    const warns = _stampWarnings(sessions, y, m, k);

    ca.innerHTML = `
    ${_stampToggle()}
    <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div>
        <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">HB-Stamp</h2>
        <p class="text-[15px] text-gray-500 mt-1">Arbeitszeiterfassung nach § 17 MiLoG.</p>
      </div>
      <div class="flex items-center gap-2">
        ${(_stmp.caps.view || _stmp.caps.approve) ? `
          <select id="stmp-user" onchange="_stampPickUser(this.value)" class="text-sm" style="width:auto;min-width:180px;">
            ${_stmp.users.map(u=>`<option value="${u.id}" ${u.id===uid?'selected':''}>${_stEsc(u.full_name || u.email || u.id)}</option>`).join('')}
          </select>` : ''}
        <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-xl">
          <button onclick="_stampMonth(-1)" class="px-3 py-2 text-gray-500 hover:text-hb-olive font-bold">‹</button>
          <span class="text-sm font-bold text-hb-offblack px-1 min-w-[130px] text-center">${_stMon(m)} ${y}</span>
          <button onclick="_stampMonth(1)" class="px-3 py-2 text-gray-500 hover:text-hb-olive font-bold">›</button>
        </div>
      </div>
    </div>

    ${closed ? `<div class="mb-4 px-4 py-2.5 rounded-xl bg-hb-olive/10 text-hb-olive text-sm font-semibold flex items-center gap-2">🔒 Monat abgeschlossen${_stmp.caps.approve ? ` · <button onclick="_stampReopen()" class="underline font-bold">wieder öffnen</button>` : ''}</div>` : ''}

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${k.noSoll ? `
        ${_stKpi('Ist', k.istTxt)}
        ${k.maxMin!=null ? _stKpi('Obergrenze', _stH(k.maxMin)) : _stKpi('Soll', '— (kein Soll)')}
        ${k.maxMin!=null ? _stKpi('Restkontingent', _stH(k.maxMin-k.istMin), (k.maxMin-k.istMin)<0?'text-hb-error':'text-hb-success') : _stKpi('Differenz','—')}
        ${_stKpi('Resturlaub', _stampResturlaub(ledger, urlaubYear, settingsRows))}
      ` : `
        ${_stKpi('Soll', k.sollTxt)}
        ${_stKpi('Ist', k.istTxt)}
        ${_stKpi('Differenz', k.diffTxt, k.diffCls)}
        ${_stKpi('Resturlaub', _stampResturlaub(ledger, urlaubYear, settingsRows))}
      `}
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 card p-5">
        <div class="grid grid-cols-7 gap-1.5 mb-1.5 text-[11px] font-bold text-gray-400 text-center">
          ${['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=>`<div>${d}</div>`).join('')}
        </div>
        <div class="stamp-cal">${_stampCalendar(sessions, absences, y, m)}</div>
        <div class="flex flex-wrap gap-3 mt-4 text-[11px] text-gray-500">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded stamp-work inline-block"></span>Gearbeitet</span>
          ${(_stmp.absTypes||[]).filter(t=>t.is_active).map(t=>`<span class="flex items-center gap-1"><span class="w-3 h-3 rounded inline-block" style="background:${t.color||'#ccc'}"></span>${_stEsc(t.label)}</span>`).join('')}
        </div>
      </div>

      <div class="space-y-6">
        <div class="card p-5 space-y-2">
          <h3 class="text-sm font-bold text-hb-offblack mb-1">Erfassen</h3>
          <button onclick="_stampAbsenceModal()" class="btn-outline w-full text-sm">Abwesenheit erfassen</button>
          ${_stmp.caps.approve
            ? `<button onclick="_stampManualModal()" class="btn-outline w-full text-sm">Zeit nachtragen</button>`
            : `<button onclick="_stampRequestModal()" class="btn-outline w-full text-sm">Korrektur beantragen</button>`}
        </div>

        ${absences.length ? `
        <div class="card p-5">
          <h3 class="text-sm font-bold text-hb-offblack mb-3">Abwesenheiten · ${_stMon(m)}</h3>
          ${absences.map(a=>_stampAbsRow(a)).join('')}
        </div>` : ''}

        ${warns.length ? `
        <div class="card p-5">
          <h3 class="text-sm font-bold text-hb-offblack mb-3">Hinweise</h3>
          <ul class="space-y-2 text-[13px]">
            ${warns.map(w=>`<li class="flex items-start gap-2 text-hb-orange"><span>⚠</span><span>${_stEsc(w)}</span></li>`).join('')}
          </ul>
        </div>` : ''}

        ${!_stmp.caps.approve ? `
        <div class="card p-5">
          <h3 class="text-sm font-bold text-hb-offblack mb-3">Meine Anträge · ${_stMon(m)}</h3>
          ${_stampMyRequests(sessions, absences)}
        </div>` : ''}

        ${_stmp.caps.approve ? `
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-hb-offblack">Offene Anträge</h3>
            <span class="text-xs text-gray-400">${pending.length}</span>
          </div>
          ${pending.length ? pending.map(p=>_stampPendingRow(p)).join('') : '<p class="text-[13px] text-gray-400">Keine offenen Anträge.</p>'}
        </div>
        <div class="card p-5 space-y-2">
          <h3 class="text-sm font-bold text-hb-offblack mb-1">Monat</h3>
          <button onclick="_stampCsv()" class="btn-outline w-full text-sm">CSV-Export</button>
          ${!closed ? `<button onclick="_stampCloseMonth()" class="btn-primary w-full text-sm">Monat abschließen</button>` : ''}
        </div>` : ''}
      </div>
    </div>
    ${verdienst && verdienst.hasRate ? `<div class="mt-6">${_stampVerdienstCard(verdienst, wages, sessions, absences, settingsRows, y, m)}</div>` : ''}`;
}

function _stKpi(label, value, cls='') {
    return `<div class="card p-5"><div class="text-[10px] uppercase font-bold text-gray-400 mb-1">${label}</div><div class="text-2xl font-extrabold ${cls||'text-hb-offblack'}">${value}</div></div>`;
}

// ─── KPIs (Soll/Ist/Differenz) ─────────────────────────────────
// SOLL-REGEL (dokumentiert): Monats-Soll = Summe ueber ALLE Kalendertage von daySoll(Tag),
// wobei daySoll aus der fuer DIESEN Tag gueltigen employment_settings-Zeile kommt:
//   soll_mode='woche' -> Wert des Wochentags (soll_mon..sun);
//   soll_mode='monat' -> soll_hours_month / Kalendertage-im-Monat (kalendertaeglich anteilig).
// Bei Wechsel mitten im Monat also aus beiden Zeilen tagesgenau; ohne Wechsel ergibt
// 'monat' wieder exakt soll_hours_month. Abwesenheits-Gutschrift nutzt dieselbe daySoll.
function _stampKpis(sessions, absences, settingsRows, y, m) {
    const daysInMonth = new Date(y, m, 0).getDate();
    let istMin = 0;
    sessions.forEach(s => { if (['erfasst','genehmigt'].includes(s.status) && s.end_at) istMin += _stNet(s); });

    const wdKey = wd => ({1:'soll_mon',2:'soll_tue',3:'soll_wed',4:'soll_thu',5:'soll_fri',6:'soll_sat',0:'soll_sun'}[wd]);
    const rowForDay = ds => (settingsRows||[]).find(r => r.valid_from <= ds && (!r.valid_to || r.valid_to >= ds)) || null;
    const daySollMin = (ds, wd) => {
        const r = rowForDay(ds); if (!r || r.soll_mode === 'ohne') return null;   // 'ohne' -> kein Soll
        if (r.soll_mode === 'woche') return Math.round((Number(r[wdKey(wd)])||0)*60);
        if (r.soll_hours_month == null) return null;
        return Math.round(Number(r.soll_hours_month)*60 / daysInMonth);
    };
    const sollKeys = _absSollKeys();   // Typen mit fulfills_soll (aus absence_types)

    let sollMin = 0, anySoll = false, creditMin = 0;
    for (let d=1; d<=daysInMonth; d++){
        const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const c = daySollMin(ds, new Date(y,m-1,d).getDay());
        if (c != null) { sollMin += c; anySoll = true; }
    }
    absences.filter(a => a.status==='genehmigt' && sollKeys.has(a.type)).forEach(a => {
        const s = new Date(Math.max(new Date(a.date_from), new Date(y,m-1,1)));
        const e = new Date(Math.min(new Date(a.date_to),   new Date(y,m-1,daysInMonth)));
        for (let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) {
            const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const c = daySollMin(ds, d.getDay());
            if (c != null) creditMin += c;
        }
    });

    // Obergrenze aus der am Monatsende gueltigen Zeile (sonst letzte Zeile mit max)
    const lastDs = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
    const rowEnd = rowForDay(lastDs) || (settingsRows||[]).slice().reverse().find(r=>r.max_hours_month!=null) || null;
    const maxMin = (rowEnd && rowEnd.max_hours_month != null) ? Math.round(Number(rowEnd.max_hours_month)*60) : null;

    const sollTxt = anySoll ? _stH(sollMin) : '—';
    const istTxt  = _stH(istMin);
    let diffTxt='—', diffCls='';
    if (anySoll) { const diff=(istMin+creditMin)-sollMin; diffTxt=_stH(diff); diffCls=diff<0?'text-hb-error':'text-hb-success'; }
    return { istMin, sollMin: anySoll?sollMin:null, creditMin, maxMin, noSoll: !anySoll, sollTxt, istTxt, diffTxt, diffCls };
}

// ─── Warnhinweise (nicht blockierend) ──────────────────────────
function _stampWarnings(sessions, y, m, k) {
    const w = [];
    const byDay = {};
    sessions.filter(s=>s.end_at && ['erfasst','genehmigt'].includes(s.status)).forEach(s=>{ (byDay[s.work_date] ||= []).push(s); });
    Object.entries(byDay).forEach(([date, arr]) => {
        const net = arr.reduce((a,s)=>a+_stNet(s),0);
        const brk = arr.reduce((a,s)=>a+(s.break_minutes||0),0);   // an echte Pausen (work_breaks) gekoppelt
        const dTxt = new Date(date).toLocaleDateString('de-DE');
        if (net > 600) w.push(`${dTxt}: über 10 h Arbeitszeit (${_stH(net)}).`);
        const req = net >= 540 ? 45 : (net >= 360 ? 30 : 0);
        if (req > 0 && brk < req) w.push(`${dTxt}: Pause zu kurz — ${brk} von ${req} Min bei ${_stH(net)}.`);
    });
    const ends = sessions.filter(s=>s.end_at).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
    for (let i=1;i<ends.length;i++){
        const gap = (new Date(ends[i].start_at) - new Date(ends[i-1].end_at))/3600000;
        if (gap > 0 && gap < 11 && ends[i].work_date !== ends[i-1].work_date)
            w.push(`${new Date(ends[i].work_date).toLocaleDateString('de-DE')}: Ruhezeit unter 11 h (${gap.toFixed(1)} h).`);
    }
    if (k.sollMin!=null && k.istMin > k.sollMin) w.push('Ist-Arbeitszeit über dem Monats-Soll.');
    if (k.maxMin!=null && k.istMin > k.maxMin) w.push(`Obergrenze überschritten — ${_stH(k.istMin)} von max. ${_stH(k.maxMin)}.`);
    return w;
}

// ─── Monatsverdienst + Minijob-Grenze (nur Admin/eigene Person) ─
// Orientierung, KEINE Lohnabrechnung. Entgelt = gearbeitete Nettostunden × tagesgenauem Satz
// PLUS Ersatzentgelt bezahlter Abwesenheiten (is_paid), da Urlaubs-/Entgeltfortzahlung als
// Arbeitsentgelt zur Minijob-Grenze zaehlt. Ersatzentgelt = Tages-Soll × Satz; wo kein
// Tages-Soll bestimmbar ist (soll_mode='ohne'), wird NICHT geschaetzt, sondern markiert.
function _stampVerdienstCard(verdienst, wages, sessions, absences, settingsRows, y, m) {
    const daysInMonth = new Date(y,m,0).getDate();
    const lastDs = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
    const wEnd = _wageForDay(wages, lastDs);
    const limit = wEnd ? Number(wEnd.minijob_limit_eur) : null;

    const wdKey = wd => ({1:'soll_mon',2:'soll_tue',3:'soll_wed',4:'soll_thu',5:'soll_fri',6:'soll_sat',0:'soll_sun'}[wd]);
    const rowForDay = ds => (settingsRows||[]).find(r=>r.valid_from<=ds && (!r.valid_to||r.valid_to>=ds)) || null;
    const daySollH = (ds, wd) => { const r=rowForDay(ds); if(!r || r.soll_mode==='ohne') return null;
        if(r.soll_mode==='woche') return Number(r[wdKey(wd)])||0;
        if(r.soll_hours_month==null) return null; return Number(r.soll_hours_month)/daysInMonth; };

    // Tägliches Entgelt (gearbeitet)
    const daily = {};
    (sessions||[]).filter(s=>s.end_at && ['erfasst','genehmigt'].includes(s.status)).forEach(s=>{
        const w=_wageForDay(wages, s.work_date); if(!w) return;
        daily[s.work_date]=(daily[s.work_date]||0)+(_stNet(s)/60)*Number(w.hourly_rate);
    });
    const workedEur = Object.values(daily).reduce((a,b)=>a+b,0);

    // Ersatzentgelt bezahlter Abwesenheiten
    const paidKeys = new Set((_stmp.absTypes||[]).filter(t=>t.is_paid).map(t=>t.key));
    let ersatzEur=0, unestimable=false;
    (absences||[]).filter(a=>a.status==='genehmigt' && paidKeys.has(a.type)).forEach(a=>{
        const s=new Date(Math.max(new Date(a.date_from), new Date(y,m-1,1)));
        const e=new Date(Math.min(new Date(a.date_to), new Date(y,m-1,daysInMonth)));
        for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
            const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const h=daySollH(ds, d.getDay());
            if(h==null){ unestimable=true; continue; }
            if(h<=0) continue;
            const w=_wageForDay(wages, ds); if(!w) continue;
            const val=h*Number(w.hourly_rate);
            daily[ds]=(daily[ds]||0)+val; ersatzEur+=val;
        }
    });

    const total = workedEur + ersatzEur;
    const over = limit!=null && total > limit;
    let reached=null;
    if(limit!=null){ let cum=0; for(const ds of Object.keys(daily).sort()){ cum+=daily[ds]; if(cum>=limit){reached=ds;break;} } }
    const restEur = limit!=null ? limit-total : null;
    return `<div class="card p-5 ${over?'border border-hb-error/40 bg-hb-error/5':''}">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-bold text-hb-offblack">Monatsverdienst <span class="font-normal text-gray-400">(${verdienst.hours.toFixed(1).replace('.',',')} h gearbeitet)</span></h3>
        <span class="text-xs text-gray-400">Orientierung — keine Lohnabrechnung</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><div class="text-[10px] uppercase font-bold text-gray-400 mb-1">Arbeit</div><div class="text-xl font-extrabold text-hb-offblack">${_stEur(workedEur)}</div></div>
        <div><div class="text-[10px] uppercase font-bold text-gray-400 mb-1">+ bez. Abwesenh.</div><div class="text-xl font-extrabold text-hb-offblack">${_stEur(ersatzEur)}</div></div>
        <div><div class="text-[10px] uppercase font-bold text-gray-400 mb-1">Summe (Minijob)</div><div class="text-xl font-extrabold ${over?'text-hb-error':'text-hb-offblack'}">${_stEur(total)}</div></div>
        ${limit!=null?`<div><div class="text-[10px] uppercase font-bold text-gray-400 mb-1">Rest bis ${_stEur(limit)}</div><div class="text-xl font-extrabold ${restEur<0?'text-hb-error':'text-hb-success'}">${_stEur(restEur)}</div></div>`:''}
      </div>
      ${over?`<p class="text-[13px] text-hb-error font-semibold mt-3">⚠ Minijob-Grenze überschritten${reached?` — rechnerisch erreicht am ${new Date(reached).toLocaleDateString('de-DE')}`:''}.</p>`
            :(reached?`<p class="text-[12px] text-gray-400 mt-3">Grenze rechnerisch erreicht am ${new Date(reached).toLocaleDateString('de-DE')}.</p>`:'')}
      <p class="text-[10px] text-gray-400 mt-2">Arbeit = Nettostunden × Satz (tagesgenau). Bezahlte Abwesenheiten als Ersatzentgelt geschätzt (Tages-Soll × Satz)${unestimable?' — <strong class="text-hb-orange">bezahlte Tage ohne hinterlegtes Tages-Soll sind NICHT enthalten, hier selbst nachrechnen</strong>':''}. Ohne Zuschläge, Abzüge, Sozialversicherung.</p>
    </div>`;
}

// ─── Kalender ──────────────────────────────────────────────────
function _stampCalendar(sessions, absences, y, m) {
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWd = (new Date(y, m-1, 1).getDay() + 6) % 7;   // Mo=0
    const byDay = {}; sessions.forEach(s=>{ (byDay[s.work_date] ||= []).push(s); });
    const absOn = ds => absences.filter(a => ds >= a.date_from && ds <= a.date_to);
    let html = '';
    for (let i=0;i<firstWd;i++) html += `<div class="stamp-cell other"></div>`;
    for (let d=1; d<=daysInMonth; d++){
        const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const net = (byDay[ds]||[]).filter(s=>s.end_at).reduce((a,s)=>a+_stNet(s),0);
        const abs = absOn(ds);
        const g = abs.find(a=>a.status==='genehmigt');
        let cls='stamp-cell', label='', style='';
        if (g) { const t=_absType(g.type); label=t?.label||g.type; if (t?.color) style=`background:${t.color}1f;border-color:${t.color}55;`; else cls+=' stamp-urlaub'; }
        else if (net>0) cls += ' stamp-work';
        if (abs.some(a=>a.status==='beantragt')) cls += ' stamp-pending';
        const hasSess = (byDay[ds]||[]).length>0;
        if (hasSess) style += 'cursor:pointer;';   // gebuchte Zeiten anklickbar -> Tages-Detail
        html += `<div class="${cls}"${style?` style="${style}"`:''}${hasSess?` onclick="_stampDayModal('${ds}')" title="Zeiten ansehen/bearbeiten"`:''}><div class="d">${d}</div>${net>0?`<div class="font-bold text-hb-offblack mt-1">${_stH(net)}</div>`:''}${label?`<div class="mt-1 text-[10px] leading-tight">${_stEsc(label)}</div>`:''}</div>`;
    }
    return html;
}

// ─── Resturlaub (berechnet) ────────────────────────────────────
// Verbrauch an TATSAECHLICHE Arbeitstage gekoppelt (pro Tag ein Gewicht):
//   soll_mode='woche' -> Tag mit Wochentagswert > 0 zaehlt 1, sonst 0
//                        (2-Tage-Woche: Urlaubswoche zieht 2 statt 5 Tage ab).
//   soll_mode='monat' -> Tage sind nicht fest verteilt; Mo-Fr-Tag zaehlt anteilig
//                        work_days_per_week/5 (Minijob 2 Tage/Woche: Urlaubswoche = 2).
//                        Ohne gesetzte Wochenarbeitstage Fallback 5 (= Mo-Fr, 1 pro Tag).
//   keine Zeile         -> Naeherung Mo-Fr. Feiertagsabzug bewusst nicht enthalten.
function _stampResturlaub(ledger, urlaubYear, settingsRows) {
    if (!ledger) return '—';
    const wdKey = wd => ({1:'soll_mon',2:'soll_tue',3:'soll_wed',4:'soll_thu',5:'soll_fri',6:'soll_sat',0:'soll_sun'}[wd]);
    const rows = settingsRows || [];
    // Aelteste bekannte Zeile: gilt als Fallback fuer Urlaubstage VOR dem ersten Stichtag
    // (sonst wuerde ein solcher Tag auf die Mo-Fr-Naeherung = voller Tag fallen und ueberzaehlen).
    const earliest = rows.length ? rows.reduce((a,b)=>a.valid_from<=b.valid_from?a:b) : null;
    const rowForDay = ds => rows.find(r => r.valid_from <= ds && (!r.valid_to || r.valid_to >= ds))
                         || (earliest && ds < earliest.valid_from ? earliest : null);
    const dayWeight = dObj => {
        const ds = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2,'0')}-${String(dObj.getDate()).padStart(2,'0')}`;
        const wd = dObj.getDay();
        const r = rowForDay(ds);
        if (r && r.soll_mode === 'woche') return (Number(r[wdKey(wd)])||0) > 0 ? 1 : 0;   // echte Arbeitstage
        if (wd >= 1 && wd <= 5) {                                                          // monat/keine Zeile: nur Mo-Fr
            const wdpw = (r && r.work_days_per_week != null) ? Number(r.work_days_per_week) : 5;
            return wdpw / 5;                                                               // anteilig zu den Wochenarbeitstagen
        }
        return 0;
    };
    let taken = 0;
    (urlaubYear||[]).forEach(a=>{
        for (let d=new Date(a.date_from); d<=new Date(a.date_to); d.setDate(d.getDate()+1)) { taken += dayWeight(new Date(d)); }
    });
    taken = Math.round(taken * 2) / 2;   // auf halbe Tage runden (anteilige monat-Gewichte)
    const rest = Number(ledger.anspruch_tage||0) + Number(ledger.uebertrag_vorjahr||0) + Number(ledger.korrektur_tage||0) - taken;
    return `${String(rest).replace('.', ',')} Tage`;
}

// ─── Offene Anträge ────────────────────────────────────────────
function _stampPendingRow(p) {
    const who = (_stmp.users.find(u=>u.id===p.user_id)?.full_name) || String(p.user_id).slice(0,8);
    const desc = p.kind==='absence'
        ? `${_absLabel(p.type)} ${new Date(p.date_from).toLocaleDateString('de-DE')}–${new Date(p.date_to).toLocaleDateString('de-DE')}`
        : `Zeitkorrektur ${new Date(p.work_date).toLocaleDateString('de-DE')}`;
    return `<div class="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0 text-[13px]">
      <div class="min-w-0"><p class="font-semibold text-hb-offblack truncate">${_stEsc(who)}</p><p class="text-gray-500 truncate">${_stEsc(desc)}${p.note?' · '+_stEsc(p.note):''}</p></div>
      <div class="flex gap-1 flex-shrink-0">
        <button onclick="_stampApprove('${p.kind}',${p.id},true)" class="px-2 py-1 rounded-lg bg-hb-success/10 text-hb-success text-xs font-black">✓</button>
        <button onclick="_stampApprove('${p.kind}',${p.id},false)" class="px-2 py-1 rounded-lg bg-hb-error/10 text-hb-error text-xs font-black">✕</button>
      </div></div>`;
}

window._stampApprove = async (kind, id, ok) => {
    if (kind === 'session') {
        // Ablehnen einer "Gehen"-Anfrage oeffnet die Buchung serverseitig wieder (review_session)
        let reason = null;
        if (!ok) { reason = prompt('Grund der Ablehnung (wird protokolliert):', ''); if (reason === null) return; }
        const { data, error } = await _supabase.rpc('review_session', { p_id: id, p_approve: ok, p_reason: reason });
        if (error) { showToast('Fehler: '+error.message, 'error'); return; }
        showToast(data==='reopened' ? 'Abgelehnt — Buchung wieder geöffnet.' : (ok?'Genehmigt.':'Abgelehnt.'), 'success');
        _stampRender(); return;
    }
    const { error } = await _supabase.from('absences')
        .update({ status: ok?'genehmigt':'abgelehnt', approved_by: currentUser.id, approved_at: new Date().toISOString() })
        .eq('id', id);
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    showToast(ok?'Genehmigt.':'Abgelehnt.', 'success');
    _stampRender();
};

// ─── Tages-Detail: gebuchte Zeiten anpassen/löschen (Freigeber/Admin) ─
window._stampDayModal = (ds) => {
    const sess = (_stmp._sessions||[]).filter(s=>s.work_date===ds).slice().sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
    const canEdit = !!_stmp.caps.approve;
    const isAdmin = !!_stmp.isAdmin;
    const rows = sess.map(s=>{
        const net = s.end_at ? _stH(_stNet(s)) : 'offen';
        return `<div class="border border-gray-100 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2 text-sm">
            <span class="font-bold text-hb-offblack">${_stTime(s.start_at)}–${s.end_at?_stTime(s.end_at):'offen'} · ${net}</span>
            <span class="text-xs text-gray-400">${s.status} · ${s.source}</span>
          </div>
          ${canEdit ? `
          <div class="grid grid-cols-3 gap-2">
            <div><div class="text-[10px] text-gray-400 mb-0.5">Beginn</div><input type="time" id="ed-start-${s.id}" value="${_stTime(s.start_at)}"></div>
            <div><div class="text-[10px] text-gray-400 mb-0.5">Ende</div><input type="time" id="ed-end-${s.id}" value="${s.end_at?_stTime(s.end_at):''}"></div>
            <div><div class="text-[10px] text-gray-400 mb-0.5">Pause min</div><input type="number" min="0" id="ed-brk-${s.id}" value="${s.break_minutes||0}"></div>
          </div>
          <div class="flex gap-2 mt-2">
            <button onclick="_stampSessionSave(${s.id},'${ds}')" class="btn-primary text-xs px-3 py-1.5">Speichern</button>
            ${isAdmin?`<button onclick="_stampSessionDelete(${s.id})" class="btn-outline text-xs px-3 py-1.5 text-hb-error">Löschen</button>`:''}
          </div>` : ''}
        </div>`;
    }).join('') || '<p class="text-sm text-gray-400">Keine Buchungen an diesem Tag.</p>';
    showModal('stamp-day-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">${new Date(ds).toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h3></div>
      <div class="p-5 space-y-3">
        ${rows}
        ${(!canEdit && sess.length)?'<p class="text-[11px] text-gray-400">Korrekturen bitte über „Korrektur beantragen".</p>':''}
        <button onclick="hideModal('stamp-day-modal')" class="btn-secondary w-full text-sm">Schließen</button>
      </div>`);
};
window._stampSessionSave = async (id, ds) => {
    const start = document.getElementById('ed-start-'+id).value;
    const end   = document.getElementById('ed-end-'+id).value;
    const brk   = Number(document.getElementById('ed-brk-'+id).value)||0;
    if (!start) { showToast('Beginn fehlt.', 'error'); return; }
    if (end && end < start) { showToast('Ende liegt vor Beginn (Nachtschichten über Mitternacht werden nicht unterstützt).', 'error'); return; }
    const toTs=(d,t)=>new Date(`${d}T${t}`).toISOString();
    const { error } = await _supabase.rpc('update_session', {
        p_id:id, p_start:toTs(ds,start), p_end: end?toTs(ds,end):null, p_break_minutes:brk, p_note:null,
    });
    if (error){ showToast('Fehler: '+error.message,'error'); return; }
    hideModal('stamp-day-modal'); showToast('Gespeichert.', 'success'); _stampRender();
};
window._stampSessionDelete = async (id) => {
    if (!confirm('Diese Buchung wirklich löschen?')) return;
    const { error } = await _supabase.rpc('delete_session', { p_id:id });
    if (error){ showToast('Fehler: '+error.message,'error'); return; }
    hideModal('stamp-day-modal'); showToast('Gelöscht.', 'success'); _stampRender();
};

// ─── Navigation / Aktionen ─────────────────────────────────────
window._stampMonth = (dir) => { let m=_stmp.m+dir, y=_stmp.y; if(m<1){m=12;y--;} if(m>12){m=1;y++;} _stmp.m=m; _stmp.y=y; _stampRender(); };
window._stampPickUser = (uid) => { _stmp.uid = uid; _stampRender(); };

window._stampReopen = async () => {
    if (!confirm('Monat wieder öffnen? Der Vorgang wird protokolliert.')) return;
    const { error } = await _supabase.from('month_closures').delete().eq('user_id', _stmp.uid).eq('year', _stmp.y).eq('month', _stmp.m);
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    showToast('Monat geöffnet.', 'success'); _stampRender();
};
window._stampCloseMonth = async () => {
    if (!confirm(`${_stMon(_stmp.m)} ${_stmp.y} abschließen? Danach sind keine Änderungen mehr möglich (außer durch Admin).`)) return;
    const { error } = await _supabase.from('month_closures').insert({ user_id:_stmp.uid, year:_stmp.y, month:_stmp.m, closed_by: currentUser.id });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    showToast('Monat abgeschlossen.', 'success'); _stampRender();
};

window._stampCsv = () => {
    const rows = (_stmp._sessions||[]).slice().sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
    const head = ['Datum','Beginn','Ende','Pausenminuten','Nettostunden','Status'];
    const lines = [head.join(';')];
    rows.forEach(s=>{
        const beg = new Date(s.start_at), end = s.end_at?new Date(s.end_at):null;
        lines.push([
            new Date(s.work_date).toLocaleDateString('de-DE'),
            beg.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),
            end?end.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'',
            s.break_minutes||0,
            (_stNet(s)/60).toFixed(2).replace('.',','),
            s.status
        ].join(';'));
    });
    const blob = new Blob(['﻿'+lines.join('\r\n')], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `HB-Stamp_${_stmp.y}-${String(_stmp.m).padStart(2,'0')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
};

// ─── Abwesenheit erfassen/beantragen ───────────────────────────
window._stampAbsenceModal = () => {
    const today = new Date().toISOString().slice(0,10);
    const targetUid = _stmp.uid || currentUser.id;
    const tName = (_stmp.users.find(u=>u.id===targetUid)?.full_name) || 'mich';
    showModal('stamp-abs-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">Abwesenheit erfassen</h3><p class="text-white/70 text-xs">Für: ${_stEsc(tName)}</p></div>
      <div class="p-5 space-y-4">
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Art</label>
          <select id="abs-type">${(_stmp.absTypes||[]).filter(t=>t.is_active).map(t=>`<option value="${t.key}">${_stEsc(t.label)}</option>`).join('')}</select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Von</label><input type="date" id="abs-from" value="${today}"></div>
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Bis</label><input type="date" id="abs-to" value="${today}"></div>
        </div>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Notiz (optional)</label><textarea id="abs-note" rows="2"></textarea></div>
        <div class="flex gap-3 pt-1">
          <button onclick="hideModal('stamp-abs-modal')" class="btn-secondary flex-1">Abbrechen</button>
          <button onclick="_stampAbsenceSave()" class="btn-primary flex-1">${_stmp.caps.approve?'Erfassen':'Beantragen'}</button>
        </div>
      </div>`);
};
window._stampAbsenceSave = async () => {
    const type = document.getElementById('abs-type').value;
    const from = document.getElementById('abs-from').value;
    const to   = document.getElementById('abs-to').value;
    const note = document.getElementById('abs-note').value || null;
    if (!from || !to || to < from) { showToast('Zeitraum ungültig.', 'error'); return; }
    // Für den im Picker gewählten User erfassen (Nicht-Freigeber sehen nur sich selbst -> _stmp.uid = currentUser.id).
    // Cross-User + Status/Genehmigung + Monatssperre laufen serverseitig im Definer-RPC (RLS-Self-Service bleibt zu).
    const targetUid = _stmp.uid || currentUser.id;
    const { error } = await _supabase.rpc('set_absence', {
        p_user_id: targetUid, p_type: type, p_from: from, p_to: to, p_note: note, p_approve: !!_stmp.caps.approve,
    });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    hideModal('stamp-abs-modal');
    showToast(_stmp.caps.approve?'Erfasst.':'Beantragt.', 'success');
    _stampRender();
};

// ─── Abwesenheiten-Liste (Monat) + Löschen ─────────────────────
function _stampAbsRow(a) {
    const label = _absLabel(a.type);
    const range = a.date_from===a.date_to
        ? new Date(a.date_from).toLocaleDateString('de-DE')
        : `${new Date(a.date_from).toLocaleDateString('de-DE')}–${new Date(a.date_to).toLocaleDateString('de-DE')}`;
    const stCls = a.status==='genehmigt'?'text-hb-success':a.status==='abgelehnt'?'text-hb-error':'text-gray-400';
    return `<div class="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0 text-[13px]">
      <div class="min-w-0"><p class="font-semibold text-hb-offblack truncate">${label} · ${range}</p>
        <p class="${stCls} text-xs truncate">${a.status}${a.note?' · '+_stEsc(a.note):''}</p></div>
      ${_stmp.caps.approve ? `<button onclick="_stampAbsDelete(${a.id})" title="Löschen" class="px-2 py-1 rounded-lg bg-hb-error/10 text-hb-error text-xs font-black flex-shrink-0">✕</button>` : ''}
    </div>`;
}
window._stampAbsDelete = async (id) => {
    if (!confirm('Diese Abwesenheit wirklich löschen?')) return;
    const { error } = await _supabase.rpc('delete_absence', { p_id: id });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    showToast('Gelöscht.', 'success');
    _stampRender();
};

// ─── Zeit nachtragen (Admin/Freigeber) ─────────────────────────
window._stampManualModal = () => {
    const today = new Date().toISOString().slice(0,10);
    const targetUid = _stmp.uid || currentUser.id;
    const tName = (_stmp.users.find(u=>u.id===targetUid)?.full_name) || 'mich';
    showModal('stamp-manual-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">Zeit nachtragen</h3><p class="text-white/70 text-xs">Für: ${_stEsc(tName)}</p></div>
      <div class="p-5 space-y-4">
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Datum</label><input type="date" id="man-date" value="${today}"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Beginn</label><input type="time" id="man-start"></div>
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Ende <span class="font-normal text-gray-400">(optional)</span></label><input type="time" id="man-end"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Pause (Min)</label><input type="number" min="0" id="man-break" value="0"></div>
          <div class="flex items-end"><p class="text-[11px] text-gray-400 leading-snug">Ohne Ende: offene Buchung für <strong>heute</strong> — die Person drückt selbst „Gehen".</p></div>
        </div>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Notiz (optional)</label><textarea id="man-note" rows="2"></textarea></div>
        <div class="flex gap-3 pt-1">
          <button onclick="hideModal('stamp-manual-modal')" class="btn-secondary flex-1">Abbrechen</button>
          <button onclick="_stampManualSave()" class="btn-primary flex-1">Nachtragen</button>
        </div>
      </div>`);
};
window._stampManualSave = async () => {
    const date  = document.getElementById('man-date').value;
    const start = document.getElementById('man-start').value;
    const end   = document.getElementById('man-end').value;
    const brk   = Number(document.getElementById('man-break').value) || 0;
    const note  = document.getElementById('man-note').value || null;
    if (!date || !start) { showToast('Datum und Beginn sind Pflicht.', 'error'); return; }
    if (end && end < start) { showToast('Ende liegt vor Beginn (Nacht-Schichten über Mitternacht werden nicht unterstützt).', 'error'); return; }
    const toTs = (d,t) => new Date(`${d}T${t}`).toISOString();   // lokale Zeit -> UTC (timestamptz)
    const targetUid = _stmp.uid || currentUser.id;
    const { error } = await _supabase.rpc('stamp_manual', {
        p_user_id: targetUid, p_work_date: date, p_start: toTs(date, start),
        p_end: end ? toTs(date, end) : null, p_break_minutes: brk, p_note: note,
    });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    hideModal('stamp-manual-modal');
    showToast(end ? 'Zeit nachgetragen.' : 'Offene Buchung angelegt — die Person kann jetzt „Gehen" drücken.', 'success');
    _stampRender();
};

// ─── Korrektur beantragen (Nicht-Freigeber) ────────────────────
// Zwei Wege (beide status='beantragt' -> Vier-Augen):
//  • nur Kommen / Kommen+Gehen: Self-Insert ueber ws_insert-Policy (source='manual', Ende optional=offen).
//  • nur Gehen: schliesst die eigene offene Buchung per Definer-RPC request_stop (setzt Ende + beantragt).
window._stampRequestModal = async () => {
    const today = new Date().toISOString().slice(0,10);
    const { data: openRows } = await _supabase.from('work_sessions')
        .select('id, work_date, start_at').eq('user_id', currentUser.id).is('end_at', null)
        .order('start_at', { ascending:false }).limit(1);
    const open = (openRows && openRows[0]) || null;
    const openBlock = open ? `
        <div class="rounded-xl bg-hb-orange/5 border border-hb-orange/20 p-3 space-y-2">
          <p class="text-[13px] font-bold text-hb-offblack">Offene Buchung · ${new Date(open.work_date).toLocaleDateString('de-DE')} ab ${_stTime(open.start_at)}</p>
          <p class="text-[11px] text-gray-500">Ausstempeln vergessen? Ende nachtragen (nur „Gehen"):</p>
          <div class="grid grid-cols-2 gap-2">
            <input type="time" id="stop-end">
            <button onclick="_stampRequestStop('${open.work_date}')" class="btn-outline text-sm">Gehen beantragen</button>
          </div>
          <textarea id="stop-note" rows="1" placeholder="Begründung *"></textarea>
        </div>
        <div class="text-center text-[11px] text-gray-400">— oder neue Korrektur —</div>` : '';
    showModal('stamp-req-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">Korrektur beantragen</h3><p class="text-white/70 text-xs">Geht zur Freigabe an die Verwaltung.</p></div>
      <div class="p-5 space-y-4">
        ${openBlock}
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Datum</label><input type="date" id="req-date" value="${today}"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Beginn</label><input type="time" id="req-start"></div>
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Ende <span class="font-normal text-gray-400">(optional)</span></label><input type="time" id="req-end"></div>
        </div>
        <p class="text-[11px] text-gray-400 -mt-2">Ende leer = „nur Kommen" (offene Buchung, du drückst später „Gehen").</p>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Pause (Min)</label><input type="number" min="0" id="req-break" value="0"></div>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Begründung <span class="text-hb-error">*</span></label>
          <textarea id="req-note" rows="2" placeholder="z. B. Einstempeln vergessen"></textarea></div>
        <div class="flex gap-3 pt-1">
          <button onclick="hideModal('stamp-req-modal')" class="btn-secondary flex-1">Abbrechen</button>
          <button onclick="_stampRequestSave()" class="btn-primary flex-1">Beantragen</button>
        </div>
      </div>`);
};
// nur Gehen -> offene Buchung schliessen (Antrag)
window._stampRequestStop = async (workDate) => {
    const end  = document.getElementById('stop-end').value;
    const note = (document.getElementById('stop-note').value || '').trim();
    if (!end)  { showToast('Bitte die Ende-Zeit angeben.', 'error'); return; }
    if (!note) { showToast('Bitte eine Begründung angeben.', 'error'); return; }
    const p_end = new Date(`${workDate}T${end}`).toISOString();
    const { error } = await _supabase.rpc('request_stop', { p_end, p_note: note });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    hideModal('stamp-req-modal');
    showToast('Gehen beantragt — zur Freigabe eingereicht.', 'success');
    _stampRender();
};
// nur Kommen / Kommen+Gehen -> Self-Insert
window._stampRequestSave = async () => {
    const date  = document.getElementById('req-date').value;
    const start = document.getElementById('req-start').value;
    const end   = document.getElementById('req-end').value;
    const brk   = Number(document.getElementById('req-break').value) || 0;
    const note  = (document.getElementById('req-note').value || '').trim();
    if (!date || !start) { showToast('Datum und Beginn sind Pflicht. Für „nur Gehen" die offene Buchung oben nutzen.', 'error'); return; }
    if (end && end < start) { showToast('Ende liegt vor Beginn (Nacht-Schichten über Mitternacht werden nicht unterstützt).', 'error'); return; }
    if (!note) { showToast('Bitte eine Begründung angeben.', 'error'); return; }
    const toTs = (d,t) => new Date(`${d}T${t}`).toISOString();
    const row = {
        user_id: currentUser.id, work_date: date,
        start_at: toTs(date,start), end_at: end ? toTs(date,end) : null,
        break_minutes: brk, source: 'manual', status: 'beantragt',
        note, created_by: currentUser.id,
    };
    const { error } = await _supabase.from('work_sessions').insert(row);
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    hideModal('stamp-req-modal');
    showToast(end ? 'Korrektur beantragt — zur Freigabe eingereicht.' : 'Kommen beantragt (Ende offen) — zur Freigabe eingereicht.', 'success');
    _stampRender();
};

// ─── Eigene Anträge (Nicht-Freigeber) ──────────────────────────
function _stampReqRow(title, sub, status, note) {
    const stCls = status==='abgelehnt' ? 'text-hb-error' : 'text-hb-orange';
    const stTxt = status==='abgelehnt' ? 'abgelehnt' : 'wartet auf Freigabe';
    return `<div class="py-2 border-b border-gray-50 last:border-0 text-[13px]">
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-hb-offblack truncate">${_stEsc(title)} · ${_stEsc(sub)}</p>
        <span class="${stCls} text-xs font-bold flex-shrink-0">${stTxt}</span>
      </div>
      ${note?`<p class="text-gray-500 text-xs truncate">${_stEsc(note)}</p>`:''}
    </div>`;
}
function _stampMyRequests(sessions, absences) {
    const rows = [];
    (sessions||[]).filter(s => ['beantragt','abgelehnt'].includes(s.status)).forEach(s => {
        const d = new Date(s.work_date).toLocaleDateString('de-DE');
        const t = s.end_at ? `${_stTime(s.start_at)}–${_stTime(s.end_at)}` : `ab ${_stTime(s.start_at)}`;
        rows.push({ when:s.work_date, html:_stampReqRow('Zeitkorrektur', `${d} · ${t}`, s.status, s.note) });
    });
    (absences||[]).filter(a => ['beantragt','abgelehnt'].includes(a.status)).forEach(a => {
        const label = _absLabel(a.type);
        const range = a.date_from===a.date_to
            ? new Date(a.date_from).toLocaleDateString('de-DE')
            : `${new Date(a.date_from).toLocaleDateString('de-DE')}–${new Date(a.date_to).toLocaleDateString('de-DE')}`;
        rows.push({ when:a.date_from, html:_stampReqRow(label, range, a.status, a.note) });
    });
    rows.sort((a,b)=> a.when < b.when ? 1 : -1);
    return rows.length ? rows.map(r=>r.html).join('') : '<p class="text-[13px] text-gray-400">Keine offenen Anträge.</p>';
}

// ═══════════════════════════════════════════════════════════════
// Mitarbeiter-Reiter (admin-only): employment_settings + vacation_ledger
// Speichern ausschliesslich ueber Definer-RPC set_employment_settings (Versionierung
// + Ueberlappungsschutz); vacation_ledger per Upsert. RLS ist die eigentliche Absicherung.
// ═══════════════════════════════════════════════════════════════
async function _stampRenderStaff() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `${_stampToggle()}<div class="py-16 text-center text-gray-400">Lädt…</div>`;
    const ids = _stmp.users.map(u=>u.id);
    const year = new Date().getFullYear();
    const [esRes, vlRes, ewRes, atRes] = await Promise.all([
        _supabase.from('employment_settings').select('*').in('user_id', ids).is('valid_to', null),
        _supabase.from('vacation_ledger').select('*').in('user_id', ids).eq('year', year),
        _supabase.from('employment_wages').select('*').in('user_id', ids).is('valid_to', null),
        _supabase.from('absence_types').select('*').order('sort_order', { ascending:true }),
    ]);
    const esMap = {}; (esRes.data||[]).forEach(r=>{ esMap[r.user_id] = r; });
    const vlMap = {}; (vlRes.data||[]).forEach(r=>{ vlMap[r.user_id] = r; });
    const ewMap = {}; (ewRes.data||[]).forEach(r=>{ ewMap[r.user_id] = r; });
    _stmp._esMap = esMap; _stmp._vlMap = vlMap; _stmp._ewMap = ewMap; _stmp._staffYear = year;
    _stmp.absTypes = atRes.data || [];

    const rows = _stmp.users.map(u => {
        const es = esMap[u.id], vl = vlMap[u.id], ew = ewMap[u.id];
        let soll = '—';
        if (es) soll = es.soll_mode==='ohne' ? 'Ohne Soll'
            : es.soll_mode==='monat' ? `${es.soll_hours_month ?? '—'} h/Monat`
            : `Woche (Σ ${['mon','tue','wed','thu','fri','sat','sun'].reduce((a,k)=>a+(Number(es['soll_'+k])||0),0)} h)`;
        if (es && es.max_hours_month!=null) soll += ` · max ${es.max_hours_month} h`;
        const flags = es ? ([es.can_view_all_times?'Sicht':null, es.can_approve_times?'Freigabe':null].filter(Boolean).join(', ') || '—') : '—';
        const anspruch = vl ? (Number(vl.anspruch_tage||0)+Number(vl.uebertrag_vorjahr||0)+Number(vl.korrektur_tage||0))+' Tage' : '—';
        return `<tr class="border-b border-gray-50">
          <td class="p-3 font-semibold text-hb-offblack">${_stEsc(u.full_name||u.email||u.id)}</td>
          <td class="p-3 text-sm">${soll}</td>
          <td class="p-3 text-sm">${flags}</td>
          <td class="p-3 text-sm">${ew ? _stEur(ew.hourly_rate)+'/h' : '—'}</td>
          <td class="p-3 text-sm">${anspruch}</td>
          <td class="p-3 text-right"><button onclick="_stampStaffEdit('${u.id}')" class="btn-outline text-xs px-3 py-1.5">Bearbeiten</button></td>
        </tr>`;
    }).join('');

    ca.innerHTML = `
      ${_stampToggle()}
      <div class="mb-6"><h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Mitarbeiter & Rechte</h2>
        <p class="text-[15px] text-gray-500 mt-1">Soll/Obergrenze, Rechte, Urlaub und Lohn pro Person. Änderungen werden protokolliert.</p></div>
      <div class="card overflow-x-auto">
        <table class="w-full text-left">
          <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500 border-b border-gray-100">
            <th class="p-3">Name</th><th class="p-3">Soll / Grenze</th><th class="p-3">Rechte</th><th class="p-3">Lohn</th><th class="p-3">Urlaubsanspruch ${year}</th><th class="p-3"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${_stampTypesSection()}`;
}

// ─── Abwesenheitstypen verwalten (admin) ───────────────────────
function _stampTypesSection() {
    const rows = (_stmp.absTypes||[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map(t=>`
      <tr class="border-b border-gray-50 ${t.is_active?'':'opacity-50'}">
        <td class="p-2"><span class="inline-block w-3 h-3 rounded align-middle" style="background:${t.color||'#ccc'}"></span></td>
        <td class="p-2 font-semibold text-hb-offblack">${_stEsc(t.label)} <span class="text-gray-400 text-xs">(${_stEsc(t.key)})</span></td>
        <td class="p-2 text-center">${t.counts_as_vacation?'✓':'—'}</td>
        <td class="p-2 text-center">${t.fulfills_soll?'✓':'—'}</td>
        <td class="p-2 text-center">${t.is_paid?'✓':'—'}</td>
        <td class="p-2 text-center text-xs ${t.is_active?'text-hb-success':'text-gray-400'}">${t.is_active?'aktiv':'inaktiv'}</td>
        <td class="p-2 text-right"><button onclick="_stampTypeEdit('${_stEsc(t.key)}')" class="btn-outline text-xs px-2 py-1">Bearbeiten</button></td>
      </tr>`).join('');
    return `<div class="card mt-6 overflow-x-auto">
      <div class="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 class="font-bold text-hb-offblack">Abwesenheitstypen</h3>
        <button onclick="_stampTypeEdit(null)" class="btn-primary text-xs px-3 py-1.5">+ Neuer Typ</button>
      </div>
      <table class="w-full text-left text-sm">
        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
          <th class="p-2"></th><th class="p-2">Typ</th><th class="p-2 text-center">Urlaub</th><th class="p-2 text-center">Soll</th><th class="p-2 text-center">Bezahlt</th><th class="p-2 text-center">Status</th><th class="p-2"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="text-[11px] text-gray-400 p-3">„Urlaub" = zieht vom Urlaubskonto ab · „Soll" = zählt als Soll-Erfüllung. Verwendete Typen lassen sich nicht löschen — stattdessen deaktivieren.</p>
    </div>`;
}
window._stampTypeEdit = (key) => {
    const t = key ? (_stmp.absTypes.find(x=>x.key===key)||{}) : {};
    const isNew = !key;
    showModal('stamp-type-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">${isNew?'Neuer Abwesenheitstyp':'Typ bearbeiten'}</h3></div>
      <div class="p-5 space-y-3">
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Schlüssel (key)</label>
          <input id="at-key" value="${_stEsc(t.key||'')}" ${isNew?'':'disabled'} placeholder="z. B. sonderurlaub" class="${isNew?'':'bg-gray-100 text-gray-400'}"></div>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Bezeichnung</label><input id="at-label" value="${_stEsc(t.label||'')}"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Farbe</label><input type="color" id="at-color" value="${t.color||'#687451'}" style="height:38px;padding:2px;width:100%;"></div>
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Reihenfolge</label><input type="number" id="at-sort" value="${t.sort_order ?? 100}"></div>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="at-vac" ${t.counts_as_vacation?'checked':''}> Zieht vom Urlaubskonto ab</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="at-soll" ${t.fulfills_soll!==false?'checked':''}> Zählt als Soll-Erfüllung</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="at-paid" ${t.is_paid?'checked':''}> Bezahlt</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="at-active" ${t.is_active!==false?'checked':''}> Aktiv (auswählbar)</label>
        <div class="flex gap-3 pt-1">
          <button onclick="hideModal('stamp-type-modal')" class="btn-secondary flex-1">Abbrechen</button>
          <button onclick="_stampTypeSave(${isNew})" class="btn-primary flex-1">Speichern</button>
        </div>
      </div>`);
};
window._stampTypeSave = async (isNew) => {
    const key = (document.getElementById('at-key').value||'').trim().toLowerCase().replace(/\s+/g,'_');
    const label = (document.getElementById('at-label').value||'').trim();
    if (!key || !label) { showToast('Schlüssel und Bezeichnung sind Pflicht.', 'error'); return; }
    const row = { key, label,
        counts_as_vacation: document.getElementById('at-vac').checked,
        fulfills_soll: document.getElementById('at-soll').checked,
        is_paid: document.getElementById('at-paid').checked,
        is_active: document.getElementById('at-active').checked,
        color: document.getElementById('at-color').value,
        sort_order: Number(document.getElementById('at-sort').value)||100 };
    const { error } = await _supabase.from('absence_types').upsert(row, { onConflict: 'key' });
    if (error) { showToast('Fehler: '+error.message, 'error'); return; }
    hideModal('stamp-type-modal');
    showToast('Gespeichert.', 'success');
    _stampRenderStaff();
};

window._stampStaffEdit = (uid) => {
    const u = _stmp.users.find(x=>x.id===uid);
    const es = _stmp._esMap[uid] || {};
    const vl = _stmp._vlMap[uid] || {};
    const ew = _stmp._ewMap[uid] || {};
    const y = _stmp._staffYear;
    const mode = es.soll_mode || 'monat';
    const today = new Date().toISOString().slice(0,10);
    const derivedWat = ['mon','tue','wed','thu','fri','sat','sun'].filter(k=>Number(es['soll_'+k])>0).length;
    const watPrefill = (es.work_days_per_week != null) ? es.work_days_per_week
        : (es.soll_mode==='woche' && derivedWat>0) ? derivedWat : 5;
    _vcLast = null;
    showModal('stmp-staff-modal', `
      <div class="p-5 bg-hb-olive text-white"><h3 class="text-lg font-black">${_stEsc(u?.full_name||uid)}</h3><p class="text-white/70 text-xs">Soll, Rechte &amp; Urlaub</p></div>
      <div class="p-5 space-y-4 overflow-y-auto" style="max-height:72vh;">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-gray-500 mb-1">Gültig ab</label><input type="date" id="es-from" value="${today}"></div>
          <div class="flex items-end"><p class="text-[11px] text-gray-400 leading-snug">Heute = sofort wirksam · späteres Datum = ab dann. Ältere Werte bleiben als geschlossene Zeile erhalten.</p></div>
        </div>
        <div><label class="block text-xs font-bold text-gray-500 mb-1">Soll-Modus</label>
          <select id="es-mode" onchange="_stampStaffModeToggle(this.value)">
            <option value="monat" ${mode==='monat'?'selected':''}>Monat (Stunden/Monat)</option>
            <option value="woche" ${mode==='woche'?'selected':''}>Woche (Stunden/Wochentag)</option>
            <option value="ohne" ${mode==='ohne'?'selected':''}>Ohne Soll (nur Ist / Obergrenze)</option>
          </select></div>
        <div id="es-monat" class="${mode!=='monat'?'hidden':''}">
          <label class="block text-xs font-bold text-gray-500 mb-1">Soll-Stunden / Monat</label>
          <input type="number" step="0.5" id="es-hm" value="${es.soll_hours_month ?? ''}">
        </div>
        <div id="es-woche" class="${mode!=='woche'?'hidden':''}">
          <label class="block text-xs font-bold text-gray-500 mb-1">Soll-Stunden je Wochentag</label>
          <div class="grid grid-cols-7 gap-1">
            ${[['mon','Mo'],['tue','Di'],['wed','Mi'],['thu','Do'],['fri','Fr'],['sat','Sa'],['sun','So']].map(([k,l])=>`
              <div class="text-center"><div class="text-[10px] text-gray-400 mb-0.5">${l}</div><input type="number" step="0.5" id="es-${k}" value="${es['soll_'+k] ?? ''}" style="padding:6px;height:38px;text-align:center;"></div>`).join('')}
          </div>
        </div>
        <div id="es-wdpw-wrap" class="${mode==='woche'?'hidden':''}">
          <label class="block text-xs font-bold text-gray-500 mb-1">Wochenarbeitstage <span class="font-normal text-gray-400">(für Urlaubsverbrauch, z. B. Minijob 2)</span></label>
          <input type="number" step="0.5" min="0" max="7" id="es-wdpw" value="${es.work_days_per_week ?? ''}">
          <p class="text-[10px] text-gray-400 mt-1">Flexible Tage: eine Urlaubswoche zieht so viele Tage ab, wie hier stehen. Ohne Angabe wird Mo–Fr genähert.</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1">Obergrenze Stunden / Monat <span class="font-normal text-gray-400">(optional)</span></label>
          <input type="number" step="0.5" min="0" id="es-max" value="${es.max_hours_month ?? ''}">
          <p class="text-[10px] text-gray-400 mt-1">Warnt bei Überschreitung. Bei „Ohne Soll" wird statt Differenz das Restkontingent gezeigt.</p>
        </div>
        <div class="space-y-2 pt-1 border-t">
          <label class="flex items-center gap-2 text-sm pt-2"><input type="checkbox" id="es-view" ${es.can_view_all_times?'checked':''}> Darf fremde Zeiten sehen</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="es-approve" onchange="document.getElementById('es-approve-warn').classList.toggle('hidden', !this.checked)" ${es.can_approve_times?'checked':''}> Darf freigeben &amp; Monate abschließen</label>
          <div id="es-approve-warn" class="${es.can_approve_times?'':'hidden'} text-[12px] text-hb-orange bg-hb-orange/5 border border-hb-orange/20 rounded-xl p-3 leading-snug">
            ⚠ Mit diesem Recht kann die Person <strong>fremde Zeiteinträge freigeben/ablehnen und Monate abschließen</strong> — die folgenreichste Einstellung im Modul. Bitte nur bewusst vergeben.
          </div>
        </div>
        <div class="border-t pt-4">
          <p class="text-xs font-black uppercase tracking-wide text-hb-olive mb-2">Urlaubskonto ${y}</p>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Anspruch</label><input type="number" step="0.5" id="vl-anspruch" value="${vl.anspruch_tage ?? ''}"></div>
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Übertrag</label><input type="number" step="0.5" id="vl-uebertrag" value="${vl.uebertrag_vorjahr ?? ''}"></div>
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Korrektur</label><input type="number" step="0.5" id="vl-korrektur" value="${vl.korrektur_tage ?? ''}"></div>
          </div>
          <label class="block text-[11px] font-bold text-gray-500 mb-1 mt-3">Notiz / Herkunft</label>
          <textarea id="vl-note" rows="2">${_stEsc(vl.note || '')}</textarea>

          <div class="mt-3 bg-hb-ultralight rounded-xl p-3">
            <p class="text-[11px] font-bold text-gray-500 mb-2">Rechenhilfe Urlaubsanspruch (Vorschlag, § 5 BUrlG — gesetzliche Mindestregelung; abweichende Verträge manuell setzen)</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><div class="text-[10px] text-gray-400">Wochenarbeitstage</div><input type="number" min="1" max="6" id="vc-wat" value="${watPrefill}" style="height:38px;"></div>
              <div><div class="text-[10px] text-gray-400">Eintrittsmonat</div><input type="number" min="1" max="12" id="vc-eintritt" value="1" style="height:38px;"></div>
              <div><div class="text-[10px] text-gray-400">Austrittsmonat</div><input type="number" min="1" max="12" id="vc-austritt" placeholder="—" style="height:38px;"></div>
              <div><div class="text-[10px] text-gray-400">Basis (Vollzeit)</div><input type="number" step="0.5" id="vc-basis" value="20" style="height:38px;"></div>
            </div>
            <button onclick="_stampVacCalc()" class="btn-outline text-xs px-3 py-1.5 mt-2">Vorschlag berechnen</button>
            <div id="vc-result" class="hidden mt-2 bg-white border border-gray-100 rounded-lg p-3"></div>
          </div>
        </div>
        <div class="border-t pt-4">
          <p class="text-xs font-black uppercase tracking-wide text-hb-olive mb-2">Stundenlohn & Minijob</p>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Gültig ab</label><input type="date" id="ew-from" value="${today}"></div>
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Stundensatz €</label><input type="number" step="0.01" min="0" id="ew-rate" value="${ew.hourly_rate ?? ''}"></div>
            <div><label class="block text-[11px] font-bold text-gray-500 mb-1">Minijob-Limit €</label><input type="number" step="1" min="0" id="ew-limit" value="${ew.minijob_limit_eur ?? 603}"></div>
          </div>
          <button onclick="_stampWageSave('${uid}')" class="btn-outline text-xs px-3 py-1.5 mt-2">Lohn speichern</button>
          <p class="text-[10px] text-gray-400 mt-1">Eigene, versionierte Historie (separates Speichern). Nur Orientierung für die Minijob-Grenze — keine Lohnabrechnung. Sichtbar nur für Admin und die Person selbst.</p>
        </div>
        <div class="flex gap-3 pt-1">
          <button onclick="hideModal('stmp-staff-modal')" class="btn-secondary flex-1">Abbrechen</button>
          <button onclick="_stampStaffSave('${uid}')" class="btn-primary flex-1">Speichern (Soll/Rechte/Urlaub)</button>
        </div>
      </div>`, { maxWidth: 'max-w-xl' });
};

window._stampStaffModeToggle = (v) => {
    document.getElementById('es-monat').classList.toggle('hidden', v!=='monat');
    document.getElementById('es-woche').classList.toggle('hidden', v!=='woche');
    document.getElementById('es-wdpw-wrap').classList.toggle('hidden', v==='woche');   // Wochenarbeitstage: monat + ohne
};

let _vcLast = null;
window._stampVacCalc = () => {
    const num = id => Number(document.getElementById(id).value);
    const wat = Math.max(1, Math.min(6, num('vc-wat')||0));
    const eintritt = Math.max(1, Math.min(12, num('vc-eintritt')||1));
    const austrittRaw = document.getElementById('vc-austritt').value;
    const austritt = austrittRaw ? Math.max(1, Math.min(12, Number(austrittRaw))) : 12;
    const basis = num('vc-basis')||20;
    const months = Math.max(0, Math.min(12, austritt - eintritt + 1));
    const jahr = basis/5*wat;
    const anteil = jahr * months/12;
    const days = Math.round(anteil);   // Bruchteile ab 0,5 aufrunden
    const mN = ['','Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const de = n => Number(n).toFixed(2).replace('.',',');
    const note = `Urlaubsvorschlag §5 BUrlG: Basis ${basis} ÷ 5 × ${wat} AT = ${de(jahr)}; × ${months}/12 (${mN[eintritt]}–${mN[austritt]}) = ${de(anteil)} → ${days} Tage`;
    _vcLast = { days, note };
    const box = document.getElementById('vc-result');
    box.classList.remove('hidden');
    box.innerHTML = `<p class="text-[13px] text-hb-offblack leading-snug">${_stEsc(note)}</p>
      <button onclick="_stampVacApply()" class="mt-2 btn-primary text-xs px-3 py-1.5">Wert übernehmen (${days} Tage)</button>`;
};
window._stampVacApply = () => {
    if (!_vcLast) return;
    document.getElementById('vl-anspruch').value = _vcLast.days;
    document.getElementById('vl-note').value = _vcLast.note;
    showToast('Vorschlag übernommen — bitte prüfen und speichern.', 'success');
};

window._stampStaffSave = async (uid) => {
    const mode = document.getElementById('es-mode').value;
    const num = id => { const v=document.getElementById(id).value; return v===''?null:Number(v); };
    const validFrom = document.getElementById('es-from').value;
    if (!validFrom) { showToast('Bitte „Gültig ab" setzen.', 'error'); return; }
    const { error: e1 } = await _supabase.rpc('set_employment_settings', {
        p_user_id: uid, p_valid_from: validFrom, p_soll_mode: mode,
        p_soll_hours_month: mode==='monat' ? num('es-hm') : null,
        p_mon: mode==='woche'?num('es-mon'):null, p_tue: mode==='woche'?num('es-tue'):null,
        p_wed: mode==='woche'?num('es-wed'):null, p_thu: mode==='woche'?num('es-thu'):null,
        p_fri: mode==='woche'?num('es-fri'):null, p_sat: mode==='woche'?num('es-sat'):null,
        p_sun: mode==='woche'?num('es-sun'):null,
        // Wochenarbeitstage: bei 'woche' aus den Wochentagen (>0) ableiten, sonst (monat/ohne) aus dem Feld
        p_work_days_per_week: mode==='woche'
            ? (['mon','tue','wed','thu','fri','sat','sun'].filter(k=>{const v=num('es-'+k); return v!=null && v>0;}).length || null)
            : num('es-wdpw'),
        p_max_hours_month: num('es-max'),   // Obergrenze, unabhaengig vom Modus
        p_can_view: document.getElementById('es-view').checked,
        p_can_approve: document.getElementById('es-approve').checked,
    });
    if (e1) { showToast('Fehler: '+e1.message, 'error'); return; }   // sprechende RPC-Meldungen (Stichtag/Ueberlappung)
    const vl = { user_id: uid, year: _stmp._staffYear,
        anspruch_tage: num('vl-anspruch') ?? 0, uebertrag_vorjahr: num('vl-uebertrag') ?? 0,
        korrektur_tage: num('vl-korrektur') ?? 0, note: document.getElementById('vl-note').value || null };
    const { error: e2 } = await _supabase.from('vacation_ledger').upsert(vl, { onConflict: 'user_id,year' });
    if (e2) { showToast('Fehler (Urlaub): '+e2.message, 'error'); return; }
    hideModal('stmp-staff-modal');
    showToast('Gespeichert.', 'success');
    _stampRenderStaff();
};

// Lohn separat speichern (eigene versionierte Historie via set_wage) — Modal bleibt offen
window._stampWageSave = async (uid) => {
    const num = id => { const v=document.getElementById(id).value; return v===''?null:Number(v); };
    const from = document.getElementById('ew-from').value;
    const rate = num('ew-rate');
    if (!from) { showToast('Bitte „Gültig ab" für den Lohn setzen.', 'error'); return; }
    if (rate == null) { showToast('Bitte einen Stundensatz angeben.', 'error'); return; }
    const { error } = await _supabase.rpc('set_wage', {
        p_user_id: uid, p_valid_from: from, p_hourly_rate: rate, p_minijob_limit_eur: num('ew-limit'),
    });
    if (error) { showToast('Fehler (Lohn): '+error.message, 'error'); return; }   // sprechende RPC-Meldungen (Stichtag/Ueberlappung)
    _stmp._ewMap[uid] = { hourly_rate: rate, minijob_limit_eur: num('ew-limit') ?? 603 };
    showToast('Lohn gespeichert.', 'success');
};
