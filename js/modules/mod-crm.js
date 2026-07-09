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
            <div class="flex justify-between items-start mb-6 gap-4">
                <div>
                    <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">HB-CRM</h2>
                    <p class="text-[15px] text-gray-500 mt-1">Suche über Objekte und Personen — Name, Nummer, Straße oder E-Mail.</p>
                </div>
                <button onclick="showPersonForm()" class="btn-primary text-sm flex items-center gap-2 shadow-sm whitespace-nowrap flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Neue Person
                </button>
            </div>
            <div class="relative max-w-2xl">
                <input type="text" id="crm-search" autocomplete="off" oninput="crmSearch(this.value)"
                    onkeydown="if(event.key==='Escape'){document.getElementById('crm-suggest').classList.add('hidden')}"
                    placeholder="Suchen: Mustermann, Hauptstraße, 0011, 012…"
                    class="w-full text-base h-12 pl-4 pr-4">
                <div id="crm-suggest" class="hidden absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"></div>
            </div>
            <div id="crm-results" class="mt-6"></div>
        </div>`;

    const loading = document.getElementById('crm-results');
    if (loading) loading.innerHTML = '<p class="text-sm text-gray-400 py-6">Lädt…</p>';

    const [persRes, bldRes, actRes] = await Promise.all([
        _supabase.from('persons').select('id, is_company, company_name, first_name, last_name, email, person_number, crm_status, street, house_number, zip_code, city'),
        _supabase.from('buildings').select('id, name, file_number, status, street, house_number, zip_code, city'),
        _supabase.from('crm_activities').select('entity_type, entity_id, created_at'),
    ]);

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
        return {
            type: 'person', id: p.id, title: name, number: p.person_number || '',
            kind: p.is_company ? 'Firma' : 'Person', crm_status: p.crm_status,
            email: p.email || '', address: addr, lastActivity: lastAct[`person:${p.id}`] || null,
            search: `${name} ${p.email || ''} ${p.person_number || ''} ${addr}`.toLowerCase(),
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
    renderCrmResults(q);
    const sug = document.getElementById('crm-suggest');
    if (!sug) return;
    const s = (q || '').trim();
    if (!s) { sug.classList.add('hidden'); sug.innerHTML = ''; return; }
    const top = _crmFilter(q).slice(0, 6);
    if (!top.length) { sug.classList.add('hidden'); sug.innerHTML = ''; return; }
    sug.innerHTML = top.map(it => {
        const sub = [it.kind, it.number ? '#' + it.number : null].filter(Boolean).join(' · ');
        return `<div onclick="crmOpenDetail('${it.type}','${it.id}')"
            class="flex items-center gap-2 px-4 py-2 hover:bg-hb-olive/5 cursor-pointer">
            <span class="text-hb-olive">${it.type === 'object' ? _crmIcons.object : _crmIcons.person}</span>
            <span class="text-sm font-semibold text-hb-offblack truncate">${_crmEsc(it.title)}</span>
            <span class="text-xs text-gray-400 truncate">${_crmEsc(sub)}</span>
        </div>`;
    }).join('');
    sug.classList.remove('hidden');
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

    const [bRes, aptRes, mgmtRes] = await Promise.all([
        _supabase.from('buildings').select('*').eq('id', buildingId).single(),
        _supabase.from('apartments').select('id, apartment_number, type, sq_meters').eq('building_id', buildingId).order('apartment_number'),
        _supabase.from('management_assignments').select('manager:profiles!management_assignments_manager_id_fkey(full_name)').eq('building_id', buildingId),
    ]);
    const b = bRes.data;
    if (!b) { showToast('Objekt nicht gefunden.', 'error'); loadCrm(); return; }
    const apts = aptRes.data || [];
    const managers = (mgmtRes.data || []).map(m => m.manager?.full_name).filter(Boolean);

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
                        ${field('Verwalter', managers.join(', '))}
                    </div>
                </div>
                <div class="card p-6 space-y-3">
                    <p class="text-[10px] uppercase font-bold text-gray-300">Einheiten</p>
                    <div>${unitRows}</div>
                </div>
            </div>

            <div class="card p-6 mt-6">
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Aktivitäten</p>
                <div id="crm-activity-container"></div>
            </div>
        </div>`;

    if (typeof renderCrmActivityLog === 'function') {
        renderCrmActivityLog(document.getElementById('crm-activity-container'), 'object', buildingId);
    }
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
    const displayName = p.is_company
        ? (p.company_name || p.last_name || '—')
        : `${p.salutation ? p.salutation + ' ' : ''}${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';

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

    c.innerHTML = `
        <div class="text-left">
            <div class="flex justify-between items-center mb-6">
                <button onclick="loadCrm()" class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück zur Suche</button>
                <div class="flex gap-2 flex-wrap justify-end">
                    ${(p.email && !p.auth_user_id) ? `<button onclick="crmSendInvite('${p.id}','${_crmAttr(displayName)}','${_crmAttr(p.email)}')" class="btn-secondary text-xs px-4">${p.crm_status === 'invited' ? 'Erneut einladen' : 'Einladen'}</button>` : ''}
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
                        <p class="text-xs text-gray-400">${p.is_company ? 'Unternehmen' : 'Privatperson'}${p.person_number ? ' · #' + _crmEsc(p.person_number) : ''}</p>
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

            <div class="card p-6 mt-6">
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Aktivitäten</p>
                <div id="crm-activity-container"></div>
            </div>
        </div>`;

    if (typeof renderCrmActivityLog === 'function') {
        renderCrmActivityLog(document.getElementById('crm-activity-container'), 'person', personId);
    }
};
