// ============================================================
// HB-Cockpit | mod-crm.js
// HB-CRM — vereinheitlichte Suche über Personen + Objekte (Konzept §5).
// Volltext-Live-Suche (Name, Nummer, Straße, E-Mail), Vorschläge, Ergebnisliste,
// Icon-Aktionen (Bearbeiten/Aktivitäten/Vollansicht). Detailansicht = Vollseite (keine Modale).
// ============================================================

let _crmIndex = [];

const _crmIcons = {
    edit:  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
    activity: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    view:  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>',
    person: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    object: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h2m-2 4h2m6-4h2m-2 4h2M9 21v-4a1 1 0 011-1h4a1 1 0 011 1v4"/></svg>',
};

function _crmEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _crmAttr(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function _crmDate(d) { return d ? new Date(d).toLocaleDateString('de-DE') : null; }

// --- Landing laden ---
window.loadCrm = async () => {
    const c = document.getElementById('content-area');
    if (!c) return;
    c.innerHTML = `
        <div class="text-left">
            <div class="flex justify-between items-start mb-8 gap-4">
                <div>
                    <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">HB-Hub</h2>
                    <p class="text-[15px] text-gray-500 mt-1">Objekte und Personen suchen und verwalten.</p>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button onclick="showContactForm()" class="btn-secondary text-sm flex items-center gap-2 whitespace-nowrap">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h2m-2 4h2m6-4h2m-2 4h2M9 21v-4a1 1 0 011-1h4a1 1 0 011 1v4"/></svg>
                        Neue Firma
                    </button>
                    <button onclick="showPersonForm()" class="btn-primary text-sm flex items-center gap-2 shadow-sm whitespace-nowrap">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        Neue Person
                    </button>
                </div>
            </div>
            <div class="max-w-3xl mx-auto mb-8">
                <div class="relative">
                    <svg class="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                    <input type="text" id="crm-search" autocomplete="off" oninput="crmSearch(this.value)"
                        placeholder="Suchen — Name, Kunden-/Firmennummer, Straße, E-Mail…"
                        class="w-full text-lg h-16 pl-14 pr-5 rounded-full shadow-md border border-gray-200 focus:border-hb-olive focus:outline-none focus:ring-4 focus:ring-hb-olive/15 transition-all">
                </div>
                <p class="text-center text-xs text-gray-400 mt-3">z. B. „0011", „0011-01", „Mustermann", „Hauptstraße 5"</p>
            </div>
            <div id="crm-results"></div>
        </div>`;

    const loading = document.getElementById('crm-results');
    if (loading) loading.innerHTML = '<p class="text-sm text-gray-400 py-6">Lädt…</p>';

    const [persRes, bldRes, actRes, ctxRes] = await Promise.all([
        _supabase.from('persons').select('id, is_company, company_name, first_name, last_name, email, person_number, crm_status, street, house_number, zip_code, city'),
        _supabase.from('buildings').select('id, name, file_number, status, street, house_number, zip_code, city'),
        _supabase.from('crm_activities').select('entity_type, entity_id, created_at'),
        _supabase.from('unit_assignments').select('person_id, context_number').not('context_number', 'is', null),
    ]);

    // Kundennummer für Owner/Mieter = context_number(n) pro Gebäude
    const ctxMap = {};
    for (const u of (ctxRes.data || [])) {
        (ctxMap[u.person_id] ??= new Set()).add(u.context_number);
    }

    const lastAct = {};
    for (const a of (actRes.data || [])) {
        const k = `${a.entity_type}:${a.entity_id}`;
        if (!lastAct[k] || a.created_at > lastAct[k]) lastAct[k] = a.created_at;
    }
    const addrOf = (o) => {
        const line = [o.street, o.house_number].filter(Boolean).join(' ');
        const cityLine = [o.zip_code, o.city].filter(Boolean).join(' ');
        return [line, cityLine].filter(Boolean).join(', ');
    };

    const persons = (persRes.data || []).map(p => {
        const name = p.is_company ? (p.company_name || p.last_name || '—') : `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
        const addr = addrOf(p);
        const ctxNums = ctxMap[p.id] ? [...ctxMap[p.id]] : [];
        const number  = p.person_number || ctxNums.join(', ');
        return {
            type: 'person', id: p.id, title: name, number: number,
            kind: p.is_company ? 'Firma' : 'Person', crm_status: p.crm_status,
            email: p.email || '', address: addr, lastActivity: lastAct[`person:${p.id}`] || null,
            search: `${name} ${p.email || ''} ${p.person_number || ''} ${ctxNums.join(' ')} ${addr}`.toLowerCase(),
        };
    });
    const objects = (bldRes.data || []).map(b => {
        const addr = addrOf(b);
        return {
            type: 'object', id: b.id, title: b.name || addr || '—', number: b.file_number || '',
            kind: 'Objekt', status: b.status, address: addr,
            lastActivity: lastAct[`object:${b.id}`] || null,
            search: `${b.name || ''} ${b.file_number || ''} ${addr}`.toLowerCase(),
        };
    });
    _crmIndex = [...objects, ...persons];
    renderCrmResults('');
};

function _crmFilter(q) {
    const s = (q || '').trim().toLowerCase();
    if (!s) return _crmIndex;
    const terms = s.split(/\s+/);
    return _crmIndex.filter(it => terms.every(t => it.search.includes(t)));
}

function _crmRowActions(it) {
    const titleAttr = _crmAttr(it.title);
    const editFn = it.type === 'person' ? `showPersonForm('${it.id}')` : `crmOpenObject('${it.id}')`;
    return `
        <div class="flex items-center gap-1 flex-shrink-0">
            <button title="Vollansicht" onclick="event.stopPropagation(); crmOpenDetail('${it.type}','${it.id}')"
                class="p-2 rounded-lg text-gray-400 hover:text-hb-olive hover:bg-hb-olive/5">${_crmIcons.view}</button>
            <button title="Bearbeiten" onclick="event.stopPropagation(); ${editFn}"
                class="p-2 rounded-lg text-gray-400 hover:text-hb-olive hover:bg-hb-olive/5">${_crmIcons.edit}</button>
            <button title="Aktivitäten" onclick="event.stopPropagation(); showCrmActivityModal('${it.type}','${it.id}','${titleAttr}')"
                class="p-2 rounded-lg text-gray-400 hover:text-hb-olive hover:bg-hb-olive/5">${_crmIcons.activity}</button>
        </div>`;
}

function _crmRow(it) {
    const sub = [it.kind, it.number ? '#' + it.number : null, it.address || null].filter(Boolean).join(' · ');
    const last = _crmDate(it.lastActivity);
    return `
        <div onclick="crmOpenDetail('${it.type}','${it.id}')"
            class="flex items-center justify-between gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
            <div class="flex items-center gap-3 min-w-0">
                <span class="w-9 h-9 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center flex-shrink-0">${it.type === 'object' ? _crmIcons.object : _crmIcons.person}</span>
                <div class="min-w-0">
                    <div class="font-bold text-hb-offblack truncate">${_crmEsc(it.title)}</div>
                    <div class="text-xs text-gray-500 truncate">${_crmEsc(sub) || '—'}</div>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                ${it.type === 'person' && it.crm_status && typeof crmStatusChip === 'function' ? crmStatusChip(it.crm_status) : ''}
                ${last ? `<span class="text-[11px] text-gray-400 hidden sm:block">Letzte Aktivität: ${last}</span>` : ''}
                ${_crmRowActions(it)}
            </div>
        </div>`;
}

window.crmSearch = (q) => {
    // Live-Filterung direkt in der Ergebnisliste (kein separates Vorschlags-Dropdown mehr)
    renderCrmResults(q);
};

function renderCrmResults(q) {
    const el = document.getElementById('crm-results');
    if (!el) return;
    const rows = _crmFilter(q);
    const count = `<p class="text-xs text-gray-400 mb-2">${rows.length} Ergebnis${rows.length === 1 ? '' : 'se'}</p>`;
    if (!rows.length) {
        el.innerHTML = count + '<div class="card p-8 text-center text-gray-400 text-sm">Keine Treffer.</div>';
        return;
    }
    el.innerHTML = count + `<div class="card overflow-hidden">${rows.map(_crmRow).join('')}</div>`;
}

// Objekt im Objekt-Modul öffnen (Vollseite, kein Modal)
window.crmOpenObject = async (buildingId) => {
    if (typeof loadTenants === 'function') {
        await loadTenants();
        if (typeof selectBuilding === 'function') selectBuilding(Number(buildingId));
    }
};

// Portal-Einladung versenden (Token-Flow, Phase 3) — mit Doppel-Bestätigung.
window.crmSendInvite = async (personId, name, email) => {
    if (!email) { showToast('Person hat keine E-Mail-Adresse.', 'error'); return; }
    if (!confirm(`Einladung an ${name} (${email}) wirklich versenden?`)) return;
    const { data, error } = await _supabase.functions.invoke('send-crm-invite', { body: { person_id: personId } });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    if (data?.error) { showToast('Fehler: ' + data.error, 'error'); return; }
    showToast(data?.mail_sent
        ? 'Einladung versendet ✓'
        : `Token erstellt (Mail nicht gesendet): ${data?.token || ''}`, 'success');
    showCrmPersonDetail(personId); // Ansicht aktualisieren (Status → Eingeladen)
};

// Person (de)aktivieren — Soft-Status (crm_status). Aktivieren: 'active' wenn registriert, sonst 'inactive'.
window.crmSetPersonActive = async (personId, activate, registered) => {
    if (!activate && !confirm('Person wirklich deaktivieren? (Soft-Delete, Daten bleiben erhalten)')) return;
    const newStatus = activate ? (registered ? 'active' : 'inactive') : 'deactivated';
    const { error } = await _supabase.from('persons')
        .update({ crm_status: newStatus, deactivated_at: activate ? null : new Date().toISOString() })
        .eq('id', personId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(activate ? 'Person reaktiviert.' : 'Person deaktiviert.', 'success');
    showCrmPersonDetail(personId);
};

// Vollansicht: Person + Objekt jeweils als Vollseite (kein Modal)
window.crmOpenDetail = (type, id) => {
    document.getElementById('crm-suggest')?.classList.add('hidden');
    if (type === 'object') return showCrmObjectDetail(id);
    return showCrmPersonDetail(id);
};

// --- Objekt-Vollansicht (read-only Vollseite, Aktivitäten inline) ---
window.showCrmObjectDetail = async (buildingId) => {
    const c = document.getElementById('content-area');
    if (!c) return;
    c.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const isAdmin = userProfile?.role === 'admin';
    const [bRes, aptRes, mgmtRes] = await Promise.all([
        _supabase.from('buildings').select('*').eq('id', buildingId).single(),
        _supabase.from('apartments').select('id, apartment_number, type, sq_meters').eq('building_id', buildingId).order('apartment_number'),
        _supabase.from('management_assignments').select('manager_id, is_primary, manager:profiles!management_assignments_manager_id_fkey(full_name)').eq('building_id', buildingId).order('is_primary', { ascending: false }).order('created_at'),
    ]);
    const b = bRes.data;
    if (!b) { showToast('Objekt nicht gefunden.', 'error'); loadCrm(); return; }
    const apts = aptRes.data || [];
    const mgmt = mgmtRes.data || [];
    const managers = mgmt.map(m => m.manager?.full_name).filter(Boolean);

    // Verwalter-Zuweisung — nur Admin darf schreiben (RLS: management_assignments is_admin())
    let mgrAssignCard = '';
    if (isAdmin) {
        const { data: allMgrs } = await _supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'manager']).order('full_name');
        const assignedIds = new Set(mgmt.map(m => m.manager_id));
        const free = (allMgrs || []).filter(m => !assignedIds.has(m.id));
        const chips = mgmt.length ? mgmt.map(m => {
            const isPrim = m.is_primary === true;
            const star = isPrim
                ? '<span title="Haupt-Verwalter">★</span>'
                : `<button onclick="crmSetPrimaryManager('${b.id}','${m.manager_id}')" class="text-hb-olive/40 hover:text-hb-olive leading-none" title="Als Haupt-Verwalter setzen">☆</button>`;
            return `
            <span class="inline-flex items-center gap-2 ${isPrim ? 'bg-hb-olive text-white' : 'bg-hb-olive/10 text-hb-olive'} text-sm font-semibold px-3 py-1.5 rounded-full">
                ${star}
                ${_crmEsc(m.manager?.full_name || '—')}
                <button onclick="crmRemoveManager('${b.id}','${m.manager_id}')" class="${isPrim ? 'text-white/70 hover:text-white' : 'text-hb-olive/60 hover:text-hb-error'} font-bold leading-none text-base" title="Zuweisung entfernen">×</button>
            </span>`;
        }).join('') : '<span class="text-sm text-gray-400">Noch kein Verwalter zugewiesen.</span>';
        const options = free.length
            ? '<option value="">Verwalter wählen…</option>' + free.map(m => `<option value="${m.id}">${_crmEsc(m.full_name || '—')}${m.role === 'admin' ? ' (Admin)' : ''}</option>`).join('')
            : '<option value="">Alle verfügbaren bereits zugewiesen</option>';
        mgrAssignCard = `
            <div class="card p-6 mt-6">
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Verwalter-Zuweisung</p>
                <div class="flex flex-wrap gap-2 mb-2">${chips}</div>
                ${mgmt.length > 1 ? '<p class="text-xs text-gray-400 mb-4">★ Der Haupt-Verwalter erhält neue Tickets automatisch. Ohne Markierung gilt der zuerst zugewiesene.</p>' : '<div class="mb-2"></div>'}
                <div class="flex gap-2 items-center">
                    <select id="crm-mgr-select" class="!w-auto flex-grow" style="max-width:20rem">${options}</select>
                    <button onclick="crmAssignManager('${b.id}')" class="btn-primary text-xs px-4 flex-shrink-0"${free.length ? '' : ' disabled'}>Zuweisen</button>
                </div>
            </div>`;
    }

    const addr = [[b.street, b.house_number].filter(Boolean).join(' '), [b.zip_code, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const field = (label, value) => value
        ? `<div class="space-y-0.5"><p class="text-[10px] uppercase font-bold text-gray-400">${_crmEsc(label)}</p><p class="text-sm font-semibold text-hb-offblack">${_crmEsc(value)}</p></div>`
        : '';
    const unitRows = apts.length ? apts.map(a => `
        <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">Wohnung ${_crmEsc(a.apartment_number)}${a.type ? ' · ' + _crmEsc(a.type) : ''}</span>
            <span class="text-xs text-gray-400">${a.sq_meters ? _crmEsc(a.sq_meters) + ' m²' : ''}</span>
        </div>`).join('') : '<p class="text-sm text-gray-400 py-2">Keine Einheiten erfasst.</p>';

    c.innerHTML = `
        <div class="text-left">
            <div class="flex justify-between items-center mb-6">
                <button onclick="loadCrm()" class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück zur Suche</button>
                <div class="flex gap-2">
                    <button onclick="showCrmActivityModal('object','${b.id}','${_crmAttr(b.name || addr)}')" class="btn-secondary text-xs px-4">Aktivität erfassen</button>
                    <button onclick="crmOpenObject('${b.id}')" class="btn-primary text-xs px-4">Im Objekt-Modul bearbeiten</button>
                </div>
            </div>

            <div class="card p-6 mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center">${_crmIcons.object}</div>
                    <div>
                        <h2 class="text-xl font-extrabold text-hb-offblack leading-tight">${_crmEsc(b.name || addr || '—')}</h2>
                        <p class="text-xs text-gray-400">Objekt${b.file_number ? ' · #' + _crmEsc(b.file_number) : ''}${b.status ? ' · ' + _crmEsc(b.status) : ''}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card p-6 space-y-4">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Stammdaten</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('Adresse', addr)}
                        ${field('Objektnummer', b.file_number)}
                        ${field('Baujahr', b.construction_year)}
                        ${field('Heizung', b.heating_type)}
                        ${field('Einheiten', apts.length || null)}
                        ${isAdmin ? '' : field('Verwalter', managers.join(', '))}
                    </div>
                </div>
                <div class="card p-6 space-y-3">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Einheiten</p>
                    <div>${unitRows}</div>
                </div>
            </div>

            ${mgrAssignCard}

            <div class="card p-6 mt-6">
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Aktivitäten</p>
                <div id="crm-activity-container"></div>
            </div>
        </div>`;

    if (typeof renderCrmActivityLog === 'function') {
        renderCrmActivityLog(document.getElementById('crm-activity-container'), 'object', buildingId);
    }
};

// Verwalter einem Objekt zuweisen (Admin) — RLS: management_assignments is_admin()
window.crmAssignManager = async (buildingId) => {
    const sel = document.getElementById('crm-mgr-select');
    const managerId = sel?.value;
    if (!managerId) { showToast('Bitte einen Verwalter wählen.', 'error'); return; }
    const { error } = await _supabase.from('management_assignments').insert({ building_id: Number(buildingId), manager_id: managerId });
    if (error) { showToast('Fehler beim Zuweisen: ' + error.message, 'error'); return; }
    showToast('Verwalter zugewiesen.', 'success');
    showCrmObjectDetail(buildingId);
};

// Verwalter-Zuweisung entfernen (Admin)
window.crmRemoveManager = async (buildingId, managerId) => {
    const { error } = await _supabase.from('management_assignments').delete()
        .eq('building_id', Number(buildingId)).eq('manager_id', managerId);
    if (error) { showToast('Fehler beim Entfernen: ' + error.message, 'error'); return; }
    showToast('Zuweisung entfernt.', 'success');
    showCrmObjectDetail(buildingId);
};

// Haupt-Verwalter setzen (Admin) — erhält neue Tickets bevorzugt.
// Erst bestehenden Primary zurücksetzen (Unique-Index erlaubt nur einen), dann den gewählten setzen.
window.crmSetPrimaryManager = async (buildingId, managerId) => {
    const bId = Number(buildingId);
    let res = await _supabase.from('management_assignments').update({ is_primary: false }).eq('building_id', bId).eq('is_primary', true);
    if (res.error) { showToast('Fehler: ' + res.error.message, 'error'); return; }
    res = await _supabase.from('management_assignments').update({ is_primary: true }).eq('building_id', bId).eq('manager_id', managerId);
    if (res.error) { showToast('Fehler: ' + res.error.message, 'error'); return; }
    showToast('Haupt-Verwalter gesetzt.', 'success');
    showCrmObjectDetail(buildingId);
};

// --- Personen-Vollansicht (read-only Vollseite, Aktivitäten inline) ---
window.showCrmPersonDetail = async (personId) => {
    const c = document.getElementById('content-area');
    if (!c) return;
    c.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const data = await loadPersonForEdit(personId);
    if (!data.person) { showToast('Person nicht gefunden.', 'error'); loadCrm(); return; }
    const p = data.person;
    const assignments = data.assignments || [];
    const bank = data.bank || {};

    // Firma: Ansprechpartner (Kaskade) + Gebäude-Freigaben laden
    let crmKids = [], crmLinks = [], crmBmap = {};
    if (p.is_company) {
        const [kidsRes, linksRes] = await Promise.all([
            _supabase.from('persons').select('id, first_name, last_name, contact_role, email, phone, auth_user_id, crm_status')
                .eq('parent_person_id', p.id).order('last_name'),
            _supabase.from('person_building_links').select('id, building_id, category, is_emergency').eq('person_id', p.id),
        ]);
        crmKids = kidsRes.data || [];
        crmLinks = linksRes.data || [];
        const bids = [...new Set(crmLinks.map(l => l.building_id))];
        if (bids.length) {
            const { data: bs } = await _supabase.from('buildings').select('id, name, file_number').in('id', bids);
            (bs || []).forEach(b => crmBmap[b.id] = b);
        }
    }

    const displayName = p.is_company
        ? (p.company_name || p.last_name || '—')
        : `${p.salutation ? p.salutation + ' ' : ''}${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';

    // Kundennummer: globale person_number (Firma/Staff) ODER context_number pro Gebäude (Owner/Mieter)
    const _ctxNums = [...new Set((assignments || []).map(a => a.context_number).filter(Boolean))];
    const kundennummer = p.person_number || (_ctxNums.length ? _ctxNums.join(', ') : null);

    const field = (label, value, isEmail = false) => value
        ? `<div class="space-y-0.5">
               <p class="text-[10px] uppercase font-bold text-gray-400">${_crmEsc(label)}</p>
               <p class="text-sm font-semibold text-hb-offblack">${isEmail ? `<a href="mailto:${_crmEsc(value)}" class="text-hb-olive hover:underline">${_crmEsc(value)}</a>` : _crmEsc(value)}</p>
           </div>`
        : '';

    const roleMeta = { owner: ['Eigentümer', 'badge-eigentuemer'], tenant: ['Mieter', 'badge-mieter'], advisory: ['Beirat', 'badge-beirat'] };
    const assignHtml = assignments.length ? assignments.map(a => {
        const [label, cls] = roleMeta[a.role] || [a.role, 'badge-dienstleister'];
        const loc = a.apartmentNumber ? `${a.buildingName} / Wohnung ${a.apartmentNumber}` : a.buildingName;
        const meta = [];
        if (a.context_number) meta.push(`Nr. ${a.context_number}`);
        if (a.valid_from || a.valid_to) meta.push(`${_crmDate(a.valid_from) || ''}–${_crmDate(a.valid_to) || 'offen'}`);
        if (!a.is_active) meta.push('beendet');
        return `<div class="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${_crmEsc(loc)}${meta.length ? `<span class="block text-[11px] text-gray-400">${_crmEsc(meta.join(' · '))}</span>` : ''}</span>
            <span class="border ${cls} text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap ml-2">${label}</span>
        </div>`;
    }).join('') : '<p class="text-sm text-gray-400 py-2">Keine Zuweisungen.</p>';

    // Firmen-Zusatz: Ansprechpartner (Kaskade K11) + Gebäude-Freigaben
    const companyExtraHtml = p.is_company ? `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div class="card p-6 space-y-3">
                <div class="flex items-center justify-between">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Ansprechpartner</p>
                    <div class="flex items-center gap-3">
                        ${p.person_number === '0000' ? `<button onclick="crmAddStaff('${p.id}')" class="text-[11px] font-bold text-hb-olive hover:underline">+ Mitarbeiter (Login)</button>` : ''}
                        <button onclick="showContactPersonForm('${p.id}')" class="text-[11px] font-bold text-hb-olive hover:underline">+ Hinzufügen</button>
                    </div>
                </div>
                <div>${crmKids.length ? crmKids.map(k => {
                    const nm = [k.first_name, k.last_name].filter(Boolean).join(' ') || (k.last_name || '—');
                    return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div class="min-w-0">
                            <span class="text-sm font-semibold text-hb-offblack">${_crmEsc(nm)}</span>
                            ${k.contact_role ? `<span class="text-xs text-gray-400"> · ${_crmEsc(k.contact_role)}</span>` : ''}
                            ${k.auth_user_id ? `<span class="ml-1 text-[9px] font-black uppercase bg-hb-olive/10 text-hb-olive px-1 py-0.5 rounded">Login</span>` : ''}
                            ${(k.email || k.phone) ? `<div class="text-xs text-gray-500">${_crmEsc([k.email, k.phone].filter(Boolean).join(' · '))}</div>` : ''}
                        </div>
                        <button onclick="showContactPersonForm('${p.id}','${k.id}')" class="text-[11px] text-hb-olive font-semibold hover:underline flex-shrink-0">Bearbeiten</button>
                    </div>`;
                }).join('') : '<p class="text-sm text-gray-400 py-2">Keine Ansprechpartner.</p>'}</div>
            </div>
            <div class="card p-6 space-y-3">
                <div class="flex items-center justify-between">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Gebäude-Freigaben</p>
                    <button onclick="crmAddRelease('${p.id}')" class="text-[11px] font-bold text-hb-olive hover:underline">+ Freigeben</button>
                </div>
                <div>${crmLinks.length ? crmLinks.map(l => {
                    const b = crmBmap[l.building_id];
                    const bn = b ? [(b.file_number || ''), (b.name || '')].filter(Boolean).join(' · ') : ('Gebäude ' + l.building_id);
                    return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span class="text-sm text-gray-700">${_crmEsc(bn)}${l.category ? `<span class="text-xs text-gray-400"> · ${_crmEsc(l.category)}</span>` : ''}${l.is_emergency ? ' <span class="text-[9px] font-black uppercase bg-hb-orange/10 text-hb-orange px-1 py-0.5 rounded">Notfall</span>' : ''}</span>
                        <button onclick="crmRemoveRelease('${l.id}','${p.id}')" class="text-[11px] text-hb-orange font-semibold hover:underline flex-shrink-0">Entfernen</button>
                    </div>`;
                }).join('') : '<p class="text-sm text-gray-400 py-2">An kein Gebäude freigegeben.</p>'}</div>
            </div>
        </div>` : '';

    c.innerHTML = `
        <div class="text-left">
            <div class="flex justify-between items-center mb-6">
                <button onclick="loadCrm()" class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück zur Suche</button>
                <div class="flex gap-2 flex-wrap justify-end">
                    ${!p.auth_user_id ? (p.email
                        ? `<button onclick="crmSendInvite('${p.id}','${_crmAttr(displayName)}','${_crmAttr(p.email)}')" class="btn-secondary text-xs px-4">${p.crm_status === 'invited' ? 'Erneut einladen' : 'Einladen'}</button>`
                        : `<button type="button" disabled title="E-Mail hinterlegen, um einzuladen" class="btn-secondary text-xs px-4 opacity-50 cursor-not-allowed">Einladen</button>`) : ''}
                    ${p.crm_status === 'deactivated'
                        ? `<button onclick="crmSetPersonActive('${p.id}', true, ${p.auth_user_id ? 'true' : 'false'})" class="btn-secondary text-xs px-4">Reaktivieren</button>`
                        : `<button onclick="crmSetPersonActive('${p.id}', false, ${p.auth_user_id ? 'true' : 'false'})" class="btn-secondary text-xs px-4">Deaktivieren</button>`}
                    <button onclick="showCrmActivityModal('person','${p.id}','${_crmAttr(displayName)}')" class="btn-secondary text-xs px-4">Aktivität erfassen</button>
                    <button onclick="showPersonForm('${p.id}')" class="btn-primary text-xs px-4">Bearbeiten</button>
                </div>
            </div>

            <div class="card p-6 mb-6">
                <div class="flex items-center gap-3 mb-1">
                    <div class="w-12 h-12 rounded-full bg-hb-olive/10 text-hb-olive font-black flex items-center justify-center text-xl">${_crmEsc(displayName.charAt(0).toUpperCase())}</div>
                    <div>
                        <h2 class="text-xl font-extrabold text-hb-offblack leading-tight">${_crmEsc(displayName)}</h2>
                        <p class="text-xs text-gray-400">${p.is_company ? 'Unternehmen' : 'Privatperson'}${kundennummer ? ' · #' + _crmEsc(kundennummer) : ''}</p>
                        ${typeof crmStatusChip === 'function' ? `<div class="mt-1">${crmStatusChip(p.crm_status)}</div>` : ''}
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card p-6 space-y-4">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Kontakt</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('E-Mail', p.email, true)}
                        ${field('Telefon', p.phone)}
                        ${field('Mobil', p.mobile)}
                        ${field('Adresse', [p.street, p.house_number].filter(Boolean).join(' '))}
                        ${field('PLZ / Ort', [p.zip_code, p.city].filter(Boolean).join(' '))}
                    </div>
                    ${bank.iban ? `<div class="border-t pt-3 grid grid-cols-2 gap-4">
                        ${field('IBAN', bank.iban)}${field('BIC', bank.bic)}${field('Kontoinhaber', bank.account_holder)}
                    </div>` : ''}
                </div>
                <div class="card p-6 space-y-3">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Rollen & Objekte</p>
                    <div>${assignHtml}</div>
                </div>
            </div>

            ${companyExtraHtml}

            <div class="card p-6 mt-6">
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Aktivitäten</p>
                <div id="crm-activity-container"></div>
            </div>
        </div>`;

    if (typeof renderCrmActivityLog === 'function') {
        renderCrmActivityLog(document.getElementById('crm-activity-container'), 'person', personId);
    }
};

// --- Gebäude-Freigabe einer Firma (person_building_links) ---
window.crmAddRelease = async (personId) => {
    const { data: bs } = await _supabase.from('buildings').select('id, name, file_number').order('file_number');
    const buildings = bs || [];
    if (!buildings.length) { showToast('Keine Gebäude vorhanden.', 'error'); return; }
    const cats = (typeof CONTACT_CATEGORIES !== 'undefined' && CONTACT_CATEGORIES.length) ? CONTACT_CATEGORIES : ['Dienstleister'];
    showModal('crm-release-modal', `
            <h3 class="text-lg font-extrabold text-hb-offblack mb-4">An Gebäude freigeben</h3>
            <div class="space-y-3">
                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude</label>
                    <select id="crm_rel_bld" class="w-full text-sm">${buildings.map(b => `<option value="${b.id}">${_crmEsc([(b.file_number || ''), (b.name || ('Gebäude ' + b.id))].filter(Boolean).join(' · '))}</option>`).join('')}</select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Kategorie</label>
                    <select id="crm_rel_cat" class="w-full text-sm">${cats.map(c => `<option value="${c}">${_crmEsc(c)}</option>`).join('')}</select>
                </div>
                <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600"><input type="checkbox" id="crm_rel_emerg" class="w-4 h-4 accent-[#687451]"> 24/7 Notfallkontakt</label>
            </div>
            <div class="flex gap-3 justify-end pt-4">
                <button onclick="hideModal('crm-release-modal')" class="btn-secondary text-sm">Abbrechen</button>
                <button onclick="crmSaveRelease('${personId}')" class="btn-primary text-sm">Freigeben</button>
            </div>
    `, { maxWidth: 'max-w-md' });
};

window.crmSaveRelease = async (personId) => {
    const building_id  = parseInt(document.getElementById('crm_rel_bld')?.value);
    const category     = document.getElementById('crm_rel_cat')?.value || null;
    const is_emergency = document.getElementById('crm_rel_emerg')?.checked || false;
    if (!building_id) return;
    const { error } = await _supabase.from('person_building_links').upsert(
        [{ person_id: personId, building_id, category, is_emergency, is_visible_to_tenants: true }],
        { onConflict: 'person_id,building_id' }
    );
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('crm-release-modal');
    showToast('Freigegeben.', 'success');
    showCrmPersonDetail(personId);
};

window.crmRemoveRelease = async (linkId, personId) => {
    if (!confirm('Freigabe entfernen?')) return;
    const { error } = await _supabase.from('person_building_links').delete().eq('id', linkId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Freigabe entfernt.', 'success');
    showCrmPersonDetail(personId);
};

// --- Mitarbeiter (HB Verwaltung) mit Login + Rolle + Objektzuweisung anlegen ---
window.crmAddStaff = async (companyId) => {
    const { data: bs } = await _supabase.from('buildings').select('id, name, file_number').order('file_number');
    const buildings = bs || [];
    showModal('crm-staff-modal', `
            <h3 class="text-lg font-extrabold text-hb-offblack mb-1">Mitarbeiter anlegen</h3>
            <p class="text-xs text-gray-400 mb-4">Legt einen Login an, verknüpft ihn mit HB Verwaltung und vergibt Rolle/Objekte.</p>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Vorname</label><input id="cs_first" class="w-full text-sm" placeholder="Max"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Nachname *</label><input id="cs_last" class="w-full text-sm" placeholder="Mustermann"></div>
                </div>
                <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">E-Mail *</label><input id="cs_email" type="email" class="w-full text-sm" placeholder="max@hausblick-fn.de"></div>
                <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Rolle</label>
                    <select id="cs_role" onchange="document.getElementById('cs_bld_wrap').style.display=this.value==='manager'?'block':'none'" class="w-full text-sm">
                        <option value="manager">Manager (nur zugewiesene Gebäude)</option>
                        <option value="admin">Admin (Vollzugriff)</option>
                    </select>
                </div>
                <div id="cs_bld_wrap" class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Zugewiesene Gebäude</label>
                    <div class="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-1">
                        ${buildings.length ? buildings.map(b => `<label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" value="${b.id}" class="cs_bld accent-[#687451]"> ${_crmEsc([(b.file_number || ''), (b.name || ('Gebäude ' + b.id))].filter(Boolean).join(' · '))}</label>`).join('') : '<p class="text-xs text-gray-400">Keine Gebäude.</p>'}
                    </div>
                </div>
                <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Zugang</label>
                    <select id="cs_method" onchange="document.getElementById('cs_pw_wrap').style.display=this.value==='password'?'block':'none'" class="w-full text-sm">
                        <option value="invite">Einladung per E-Mail (setzt eigenes Passwort)</option>
                        <option value="password">Passwort direkt setzen</option>
                    </select>
                </div>
                <div id="cs_pw_wrap" style="display:none" class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Passwort</label><input id="cs_pw" type="text" class="w-full text-sm" placeholder="min. 8 Zeichen"></div>
            </div>
            <div class="flex gap-3 justify-end pt-4">
                <button onclick="hideModal('crm-staff-modal')" class="btn-secondary text-sm">Abbrechen</button>
                <button onclick="crmSaveStaff('${companyId}')" class="btn-primary text-sm">Anlegen</button>
            </div>
    `, { maxWidth: 'max-w-md' });
};

window.crmSaveStaff = async (companyId) => {
    const first  = document.getElementById('cs_first')?.value?.trim() || '';
    const last   = document.getElementById('cs_last')?.value?.trim() || '';
    const email  = document.getElementById('cs_email')?.value?.trim();
    const role   = document.getElementById('cs_role')?.value || 'manager';
    const method = document.getElementById('cs_method')?.value || 'invite';
    const pw     = document.getElementById('cs_pw')?.value?.trim();
    const full_name = [first, last].filter(Boolean).join(' ');
    if (!email || !last) { showToast('Nachname und E-Mail sind Pflicht.', 'error'); return; }
    if (method === 'password' && (!pw || pw.length < 8)) { showToast('Passwort min. 8 Zeichen.', 'error'); return; }

    const building_ids = role === 'manager'
        ? [...document.querySelectorAll('.cs_bld:checked')].map(e => parseInt(e.value))
        : [];
    const body = { email, full_name, role, building_ids };
    if (method === 'password') body.password = pw;

    const { data, error } = await _supabase.functions.invoke('create-user', { body });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    const res = Array.isArray(data) ? data[0] : data;
    if (!res || res.success === false) { showToast('Fehler: ' + (res?.error || 'unbekannt'), 'error'); return; }

    // Als Kind-Person (Ansprechpartner) der Verwaltung mit Login verknüpfen
    if (res.user_id) {
        await _supabase.from('persons').insert([{
            is_company: false, first_name: first || null, last_name: last, email,
            contact_type: 'Privatperson', parent_person_id: companyId, auth_user_id: res.user_id,
            contact_role: role === 'admin' ? 'Admin' : 'Manager', is_visible_to_tenants: true, crm_status: 'active',
        }]);
    }
    hideModal('crm-staff-modal');
    showToast('Mitarbeiter angelegt.', 'success');
    showCrmPersonDetail(companyId);
};
