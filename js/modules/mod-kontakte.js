// ============================================================
// HB-Mieterportal | mod-kontakte.js
// Modul: Kontaktbuch — Dienstleister, Notfallkontakte, Ansprechpartner
// ============================================================

let _contactsData    = [];
let _contactReleases = [];
let _contactFilter   = 'Alle';
let _contactSearch   = '';
let _contactBuilding = null;
let _myBuildingIds   = [];

// Kontakt-Kategorien → definiert in config.js
const CAT_ORDER = CONTACT_CATEGORIES;

// ─── Haupteinstieg ────────────────────────────────────────────
async function loadContacts() {
    const role = userProfile?.role;
    const uid  = currentUser?.id;

    document.getElementById('content-area').innerHTML = `
        <div class="flex items-center justify-center h-40">
            <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
        </div>`;

    _myBuildingIds = await _getMyBuildingIds(role, uid);

    const [contactsRes, releasesRes] = await Promise.all([
        _supabase.from('contacts').select('*').order('created_at', { ascending: false }),
        _supabase.from('contact_releases').select('contact_id, building_id, released_by'),
    ]);

    const allContacts = contactsRes.data || [];
    _contactReleases  = releasesRes.data || [];

    // Rollenbasiertes Filtern
    if (role === 'admin' || role === 'manager') {
        _contactsData = allContacts;
    } else if (role === 'owner') {
        _contactsData = allContacts.filter(c =>
            c.visibility_scope === 'global' ||
            (c.building_ids || []).some(bid => _myBuildingIds.includes(bid))
        );
    } else {
        // tenant: nur globale Notfallkontakte + vom Vermieter freigegebene
        const releasedIds = new Set(
            _contactReleases
                .filter(r => _myBuildingIds.includes(r.building_id))
                .map(r => r.contact_id)
        );
        _contactsData = allContacts.filter(c =>
            (c.visibility_scope === 'global' && c.is_emergency) ||
            releasedIds.has(c.id)
        );
    }

    _contactFilter   = 'Alle';
    _contactSearch   = '';
    _contactBuilding = null;
    _renderContactsPage(role);
}

async function _getMyBuildingIds(role, uid) {
    if (role === 'admin') {
        const { data } = await _supabase.from('buildings').select('id');
        return (data || []).map(b => b.id);
    }
    if (role === 'manager') {
        const { data } = await _supabase.from('management_assignments').select('building_id').eq('manager_id', uid);
        return (data || []).map(r => r.building_id);
    }
    if (role === 'owner') {
        const { data: person } = await _supabase.from('persons').select('id').eq('auth_user_id', uid).maybeSingle();
        if (!person) return [];
        const { data: own } = await _supabase.from('ownerships')
            .select('apartments(building_id)').eq('owner_id', person.id).eq('is_active', true);
        const ids = new Set();
        (own || []).forEach(o => { if (o.apartments?.building_id) ids.add(o.apartments.building_id); });
        return [...ids];
    }
    // tenant: Gebäude über tenancies ermitteln (apartment_id ist nicht immer gesetzt)
    const { data: person } = await _supabase.from('persons').select('id').eq('auth_user_id', uid).maybeSingle();
    if (!person) return [];
    const { data: ten } = await _supabase.from('tenancies')
        .select('apartments(building_id)').eq('tenant_id', person.id).eq('status', 'Aktiv');
    const ids = new Set();
    (ten || []).forEach(t => { if (t.apartments?.building_id) ids.add(t.apartments.building_id); });
    return [...ids];
}

// ─── Seiten-Rendering ─────────────────────────────────────────
function _renderContactsPage(role) {
    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = role === 'owner';
    const cats = [...new Set(_contactsData.map(c => c.category || 'Sonstiges'))];

    document.getElementById('content-area').innerHTML = `
        <div class="flex justify-between items-end mb-5">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-offblack tracking-tight">Kontaktbuch</h2>
                <p class="text-sm text-gray-500 mt-1">Ansprechpartner, Dienstleister und Notfallkontakte</p>
            </div>
            ${isAdmin || isOwner ? `
            <button onclick="showContactForm()" class="btn-primary flex items-center gap-2 text-sm shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                Neuer Kontakt
            </button>` : ''}
        </div>

        <!-- Suche & Filter + Hinweis-Banner nebeneinander -->
        <div class="flex flex-col lg:flex-row gap-4 mb-5">
            <!-- Suche & Filter -->
            <div class="card p-4 flex-1">
                <div class="flex flex-col md:flex-row gap-3 items-start">
                    <input type="text" id="contact-search" placeholder="Firma oder Name suchen…"
                        oninput="_filterContacts()" class="md:w-64">
                    ${(isAdmin || isOwner) && _myBuildingIds.length > 1 ? `<div id="contact-building-filter-wrap"></div>` : ''}
                </div>
                <div class="flex flex-wrap gap-2 mt-3" id="contact-filter-chips">
                    <button onclick="_setContactFilter('Alle')" class="contact-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-hb-offblack text-white">Alle</button>
                    <button onclick="_setContactFilter('Notfälle')" class="contact-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-white text-gray-500 hover:bg-gray-50 transition-colors">Nur Notfälle</button>
                    ${CAT_ORDER.filter(c => cats.includes(c)).map(c =>
                        `<button onclick="_setContactFilter('${c}')" class="contact-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-white text-gray-500 hover:bg-gray-50 transition-colors">${c}</button>`
                    ).join('')}
                </div>
            </div>
            <!-- Hinweis-Banner -->
            <div class="lg:w-1/2 bg-hb-ultralight border border-hb-orange rounded-xl p-4 flex flex-col justify-center">
                <p class="text-xs font-extrabold uppercase tracking-wide text-hb-orange mb-1">Wichtiger Hinweis</p>
                <p class="text-xs text-gray-600">Die aufgeführten Dienstleister kennen das Objekt bereits und dienen zur Empfehlung. Bitte beachten Sie: <strong class="text-hb-offblack">Aufträge außerhalb von Kleinreparaturen müssen dringend durch den Vermieter oder die Gemeinschaft freigegeben werden.</strong></p>
            </div>
        </div>

        <!-- Grid -->
        <div id="contacts-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>`;

    if ((isAdmin || isOwner) && _myBuildingIds.length > 1) _renderBuildingDropdown();
    _renderContactGrid();
}

async function _renderBuildingDropdown() {
    const wrap = document.getElementById('contact-building-filter-wrap');
    if (!wrap) return;
    const { data: buildings } = await _supabase.from('buildings').select('id, name, file_number, street, house_number')
        .in('id', _myBuildingIds).order('name');
    wrap.innerHTML = `
        <select onchange="_setContactBuilding(this.value)" class="md:w-56">
            <option value="">Alle Gebäude</option>
            ${(buildings || []).map(b => `<option value="${b.id}">${formatBuildingName(b)}</option>`).join('')}
        </select>`;
}

window._setContactBuilding = (val) => {
    _contactBuilding = val ? parseInt(val) : null;
    _renderContactGrid();
};

window._setContactFilter = (f) => {
    _contactFilter = f;
    document.querySelectorAll('.contact-chip').forEach(el => {
        const active = el.innerText.trim() === f;
        el.className = active
            ? 'contact-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-hb-offblack text-white'
            : 'contact-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-white text-gray-500 hover:bg-gray-50 transition-colors';
    });
    _renderContactGrid();
};

window._filterContacts = () => {
    _contactSearch = document.getElementById('contact-search')?.value.toLowerCase() || '';
    _renderContactGrid();
};

function _renderContactGrid() {
    const grid = document.getElementById('contacts-grid');
    if (!grid) return;

    let filtered = _contactsData.filter(c => {
        const name = _displayName(c).toLowerCase();
        const matchSearch  = !_contactSearch || name.includes(_contactSearch) || (c.category || '').toLowerCase().includes(_contactSearch);
        const matchFilter  = _contactFilter === 'Alle' || (_contactFilter === 'Notfälle' && c.is_emergency) || (c.category || 'Sonstiges') === _contactFilter;
        const matchBuilding = !_contactBuilding || (c.building_ids || []).includes(_contactBuilding);
        return matchSearch && matchFilter && matchBuilding;
    });

    // Sortierung: CAT_ORDER-Index, innerhalb Gruppe 2 alphabetisch
    filtered.sort((a, b) => {
        const iA = CAT_ORDER.indexOf(a.category || 'Sonstiges');
        const iB = CAT_ORDER.indexOf(b.category || 'Sonstiges');
        if (iA !== iB) return (iA < 0 ? 99 : iA) - (iB < 0 ? 99 : iB);
        return _displayName(a).localeCompare(_displayName(b), 'de');
    });

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="col-span-3 text-center py-16 text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                </svg>
                <p class="font-semibold">Keine Kontakte gefunden</p>
                <p class="text-sm mt-1">Versuche einen anderen Filter oder Suchbegriff.</p>
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(c => _contactCardHtml(c)).join('');
}

function _displayName(c) {
    return (c.is_company ? c.company : c.contact_person) || c.company || c.contact_person || '—';
}

// ─── Kontakt-Karte ────────────────────────────────────────────
function _contactCardHtml(c) {
    const role    = userProfile?.role;
    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = role === 'owner';
    const name    = _displayName(c);
    const cat     = c.category || 'Sonstiges';

    const iconHtml = c.logo_url
        ? `<img src="${c.logo_url}" alt="Logo" class="w-12 h-12 rounded-xl object-contain bg-gray-50 p-1 flex-shrink-0">`
        : c.is_company
            ? `<div class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                   <svg width="22" height="22" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21V10h6v11"/></svg>
               </div>`
            : `<div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(104,116,81,.1)">
                   <svg width="22" height="22" fill="none" stroke="#687451" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
               </div>`;

    const addrLine  = c.address ? `<div class="flex items-center gap-2 text-xs text-gray-500 min-w-0"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span class="truncate">${c.address}</span></div>` : '';
    const phoneLine = (c.phone || c.mobile) ? `<div class="flex items-center gap-2 text-xs text-gray-500"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="flex-shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.36 2 2 0 0 1 3.62 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.82-.82a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg><a href="tel:${c.phone || c.mobile}" onclick="event.stopPropagation()" class="hover:text-hb-olive">${c.phone || c.mobile}</a></div>` : '';
    const emailLine = c.email ? `<div class="flex items-center gap-2 text-xs text-gray-500 min-w-0"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="flex-shrink-0"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:${c.email}" onclick="event.stopPropagation()" class="hover:text-hb-olive truncate">${c.email}</a></div>` : '';

    // Release-Toggle nur für Vermieter (Landlord)
    let releaseToggle = '';
    if (isOwner && userProfile?._isLandlord) {
        const released = _contactReleases.some(r => r.released_by === currentUser.id && r.contact_id === c.id);
        releaseToggle = `
            <div class="border-t border-gray-50 mt-2 pt-2" onclick="event.stopPropagation()">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" ${released ? 'checked' : ''} onchange="toggleContactRelease(${c.id}, this.checked)" class="accent-[#687451] w-4 h-4">
                    <span class="text-xs text-gray-500">Für meine Mieter freigegeben</span>
                </label>
            </div>`;
    }

    const canEdit = isAdmin || (isOwner && c.created_by === currentUser.id);

    return `
        <div onclick="openContactDetail(${c.id})" class="card p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3">
            <div class="flex items-start gap-3">
                ${iconHtml}
                <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-1">
                        <h3 class="font-bold text-hb-offblack text-sm leading-snug truncate">${name}</h3>
                        ${canEdit ? `<button onclick="event.stopPropagation(); showContactForm(${c.id})" class="text-xs text-hb-olive bg-hb-ultralight px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">Bearbeiten</button>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1 mt-1">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md" style="background:rgba(104,116,81,.12);color:#687451">${cat}</span>
                        ${c.is_emergency ? `<span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md" style="background:rgba(235,118,45,.12);color:#c4601e">24/7 Notfall</span>` : ''}
                    </div>
                </div>
            </div>
            ${(addrLine || phoneLine || emailLine) ? `<div class="space-y-1.5">${addrLine}${phoneLine}${emailLine}</div>` : ''}
            ${releaseToggle}
        </div>`;
}

// ─── Detail-Modal ─────────────────────────────────────────────
window.openContactDetail = async (contactId) => {
    const cached = _contactsData.find(c => c.id === contactId);
    const buildingIdsForContact = cached?.building_ids || [];

    const [contactRes, personsRes, buildingsRes] = await Promise.all([
        _supabase.from('contacts').select('*').eq('id', contactId).single(),
        _supabase.from('contact_persons').select('*').eq('contact_id', contactId).order('name'),
        buildingIdsForContact.length
            ? _supabase.from('buildings').select('id, name, file_number, street, house_number').in('id', buildingIdsForContact)
            : Promise.resolve({ data: [] }),
    ]);

    if (!contactRes.data) { showToast('Kontakt nicht gefunden.', 'error'); return; }
    const c       = contactRes.data;
    const persons = personsRes.data || [];
    const bList   = buildingsRes.data || [];
    const role    = userProfile?.role;
    const isAdmin = role === 'admin' || role === 'manager';
    const name    = _displayName(c);
    const cat     = c.category || 'Sonstiges';

    const field = (label, val) => val ? `<div><p class="text-[10px] uppercase font-bold text-gray-400">${label}</p><p class="text-sm font-semibold text-hb-offblack mt-0.5">${val}</p></div>` : '';

    const personsHtml = (c.is_company && persons.length) ? `
        <div>
            <p class="text-[10px] uppercase font-bold text-gray-300 mb-2">Ansprechpartner</p>
            <div class="space-y-2">
                ${persons.map(p => {
                    const visible = isAdmin || p.is_visible_to_tenants;
                    return `<div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl ${!visible ? 'opacity-50' : ''}">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(104,116,81,.1)">
                            <svg width="14" height="14" fill="none" stroke="#687451" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-hb-offblack">${p.name}${p.role ? ` <span class="font-normal text-gray-400">· ${p.role}</span>` : ''}</p>
                            ${p.phone ? `<p class="text-xs text-gray-500">${p.phone}</p>` : ''}
                            ${p.email ? `<p class="text-xs text-gray-500">${p.email}</p>` : ''}
                        </div>
                        ${!visible ? `<span class="text-[9px] text-gray-400 flex-shrink-0">nicht sichtbar</span>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>` : '';

    const buildingsHtml = bList.length ? `
        <div>
            <p class="text-[10px] uppercase font-bold text-gray-300 mb-2">Gebäude</p>
            <div class="flex flex-wrap gap-2">
                ${bList.map(b => `
                <button onclick="navigateToBuilding(${b.id}); hideModal('contact-detail-modal')"
                    class="text-xs font-bold text-hb-olive px-3 py-1 rounded-lg hover:bg-hb-olive/10 transition-colors" style="background:rgba(104,116,81,.1)">
                    ${formatBuildingName(b)}
                </button>`).join('')}
            </div>
        </div>` : '';

    const canEdit = isAdmin || (role === 'owner' && c.created_by === currentUser.id);

    const modal = showModal('contact-detail-modal', `
            <div class="p-6 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center ${c.is_company ? 'bg-gray-100' : ''}" ${!c.is_company ? 'style="background:rgba(104,116,81,.1)"' : ''}>
                        ${c.is_company
                            ? `<svg width="20" height="20" fill="none" stroke="#9ca3af" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21V10h6v11"/></svg>`
                            : `<svg width="20" height="20" fill="none" stroke="#687451" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
                    </div>
                    <div>
                        <h2 class="text-lg font-extrabold text-hb-offblack leading-tight">${name}</h2>
                        <div class="flex flex-wrap gap-1 mt-0.5">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md" style="background:rgba(104,116,81,.12);color:#687451">${cat}</span>
                            ${c.is_emergency ? `<span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md" style="background:rgba(235,118,45,.12);color:#c4601e">24/7 Notfall</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 ml-4">
                    ${canEdit ? `<button onclick="hideModal('contact-detail-modal'); showContactForm(${c.id})" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>` : ''}
                    <button onclick="hideModal('contact-detail-modal')" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
                </div>
            </div>
            <div class="p-6 overflow-y-auto flex-grow space-y-5">
                <div>
                    <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Kontakt</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${c.is_company && c.contact_person ? field('Ansprechpartner', c.contact_person) : ''}
                        ${field('Telefon', c.phone)}
                        ${field('Mobil', c.mobile)}
                        ${field('E-Mail', c.email)}
                        ${field('Adresse', c.address)}
                        ${field('Kategorie', cat)}
                    </div>
                </div>
                ${personsHtml}
                ${buildingsHtml}
                ${isAdmin && c.is_company ? `
                <div class="border-t pt-4">
                    <button onclick="showContactPersonForm(${c.id})" class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        + Ansprechpartner hinzufügen
                    </button>
                </div>` : ''}
            </div>
    `, { maxWidth: 'max-w-lg' });
};

// ─── Erstellen / Bearbeiten ───────────────────────────────────
window.showContactForm = async (contactId = null) => {
    const role    = userProfile?.role;
    const isAdmin = role === 'admin' || role === 'manager';

    const [contactRes, buildingsRes] = await Promise.all([
        contactId
            ? _supabase.from('contacts').select('*').eq('id', contactId).single()
            : Promise.resolve({ data: null }),
        _myBuildingIds.length
            ? _supabase.from('buildings').select('id, name, file_number, street, house_number').in('id', _myBuildingIds).order('name')
            : Promise.resolve({ data: [] }),
    ]);

    const c        = contactRes.data || {};
    const buildings = buildingsRes.data || [];
    const isEdit   = !!contactId;

    const modal = showModal('contact-form-modal', `
            <div class="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <h3 class="text-xl font-extrabold text-hb-offblack">${isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</h3>
                <button onclick="hideModal('contact-form-modal')" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-6 overflow-y-auto flex-grow space-y-4">

                <label class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
                    <input type="checkbox" id="ctct_is_company" ${c.is_company ? 'checked' : ''}
                        onchange="_toggleCompanyFields()" class="w-5 h-5 accent-[#687451]">
                    <span class="text-sm font-semibold text-hb-offblack">Ist eine Firma / Organisation</span>
                </label>

                <div id="ctct_company_wrap" class="${c.is_company ? '' : 'hidden'} space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Firmenname *</label>
                    <input type="text" id="ctct_company" value="${c.company || ''}" placeholder="Musterbau GmbH">
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500" id="ctct_person_label">${c.is_company ? 'Ansprechpartner (optional)' : 'Name *'}</label>
                    <input type="text" id="ctct_contact_person" value="${c.contact_person || ''}" placeholder="Max Mustermann">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Kategorie</label>
                        <select id="ctct_category">
                            ${CAT_ORDER.map(cat => `<option value="${cat}" ${(c.category || 'Sonstiges') === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                        </select>
                    </div>
                    ${isAdmin ? `
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Sichtbarkeit</label>
                        <select id="ctct_scope">
                            <option value="building" ${(c.visibility_scope || 'building') === 'building' ? 'selected' : ''}>Gebäudespezifisch</option>
                            <option value="global" ${c.visibility_scope === 'global' ? 'selected' : ''}>Global (alle Nutzer)</option>
                        </select>
                    </div>` : ''}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Telefon</label>
                        <input type="tel" id="ctct_phone" value="${c.phone || ''}" placeholder="+49 30 …">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Mobil</label>
                        <input type="tel" id="ctct_mobile" value="${c.mobile || ''}" placeholder="+49 160 …">
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">E-Mail</label>
                    <input type="email" id="ctct_email" value="${c.email || ''}" placeholder="kontakt@firma.de">
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Adresse</label>
                    <input type="text" id="ctct_address" value="${c.address || ''}" placeholder="Musterstraße 1, 12345 Berlin">
                </div>

                ${buildings.length ? `
                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude (Mehrfachauswahl)</label>
                    <div class="space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
                        ${buildings.map(b => `
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" value="${b.id}" class="ctct_building_cb accent-[#687451]"
                                ${(c.building_ids || []).includes(b.id) ? 'checked' : ''}>
                            <span class="text-sm">${formatBuildingName(b)}</span>
                        </label>`).join('')}
                    </div>
                </div>` : ''}

                <label class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
                    <input type="checkbox" id="ctct_emergency" ${c.is_emergency ? 'checked' : ''} class="w-5 h-5 accent-[#687451]">
                    <div>
                        <p class="text-sm font-semibold text-hb-offblack">24/7 Notfallkontakt</p>
                        <p class="text-xs text-gray-400">Wird mit orangem Badge hervorgehoben</p>
                    </div>
                </label>
            </div>
            <div class="p-6 border-t border-gray-50 flex justify-between items-center flex-shrink-0">
                ${isEdit ? `<button onclick="deleteContact(${c.id})" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 transition-colors">Löschen</button>` : '<div></div>'}
                <div class="flex gap-3">
                    <button onclick="hideModal('contact-form-modal')" class="btn-secondary text-sm">Abbrechen</button>
                    <button onclick="saveContact(${contactId || 'null'})" class="btn-primary text-sm">Speichern</button>
                </div>
            </div>
    `, { maxWidth: 'max-w-lg' });
};

window._toggleCompanyFields = () => {
    const isCompany = document.getElementById('ctct_is_company')?.checked;
    document.getElementById('ctct_company_wrap')?.classList.toggle('hidden', !isCompany);
    const lbl = document.getElementById('ctct_person_label');
    if (lbl) lbl.textContent = isCompany ? 'Ansprechpartner (optional)' : 'Name *';
};

window.saveContact = async (contactId) => {
    const isCompany = document.getElementById('ctct_is_company')?.checked || false;
    const company   = document.getElementById('ctct_company')?.value?.trim() || null;
    const person    = document.getElementById('ctct_contact_person')?.value?.trim() || null;

    if (isCompany && !company) { showToast('Firmenname ist Pflichtfeld.', 'error'); return; }
    if (!isCompany && !person) { showToast('Name ist Pflichtfeld.', 'error'); return; }

    const buildingIds = [...document.querySelectorAll('.ctct_building_cb:checked')].map(el => parseInt(el.value));

    const payload = {
        is_company:     isCompany,
        company:        company,
        contact_person: person,
        category:       document.getElementById('ctct_category')?.value || 'Sonstiges',
        phone:          document.getElementById('ctct_phone')?.value?.trim()   || null,
        mobile:         document.getElementById('ctct_mobile')?.value?.trim()  || null,
        email:          document.getElementById('ctct_email')?.value?.trim()   || null,
        address:        document.getElementById('ctct_address')?.value?.trim() || null,
        is_emergency:   document.getElementById('ctct_emergency')?.checked || false,
        building_ids:   buildingIds.length ? buildingIds : null,
    };

    const scopeEl = document.getElementById('ctct_scope');
    if (scopeEl) payload.visibility_scope = scopeEl.value;
    if (!contactId) payload.created_by = currentUser.id;

    const { data: saved, error } = contactId
        ? await _supabase.from('contacts').update(payload).eq('id', contactId).select('id').single()
        : await _supabase.from('contacts').insert([payload]).select('id').single();

    if (error) { showToast(error.message, 'error'); return; }

    hideModal('contact-form-modal');
    showToast(contactId ? 'Kontakt aktualisiert.' : 'Kontakt angelegt.', 'success');
    await loadContacts();

    // Nach Anlage einer Firma: Mitarbeiter hinzufügen?
    if (!contactId && isCompany && saved?.id) {
        _showAddPersonsPrompt(saved.id, company);
    }
};

function _showAddPersonsPrompt(contactId, companyName) {
    const modal = showModal('add-persons-prompt', `
            <h3 class="text-lg font-extrabold text-hb-offblack">Ansprechpartner hinzufügen?</h3>
            <p class="text-sm text-gray-500">Möchten Sie für <strong>${companyName || 'diese Firma'}</strong> direkt Ansprechpartner anlegen?</p>
            <div class="flex gap-3 justify-end">
                <button onclick="hideModal('add-persons-prompt')" class="btn-secondary text-sm">Nicht jetzt</button>
                <button onclick="hideModal('add-persons-prompt'); showContactPersonForm(${contactId})" class="btn-primary text-sm">Ansprechpartner anlegen</button>
            </div>
    `, { maxWidth: 'max-w-md' });
}

window.showContactPersonForm = (contactId) => {
    const modal = showModal('contact-person-form-modal', `
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-extrabold text-hb-offblack">Ansprechpartner</h3>
                <button onclick="hideModal('contact-person-form-modal')" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="space-y-3">
                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Name *</label>
                    <input type="text" id="cp_name" placeholder="Max Mustermann">
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Rolle / Position</label>
                    <input type="text" id="cp_role" placeholder="Notdienst, Projektleiter, …">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Telefon</label>
                        <input type="tel" id="cp_phone" placeholder="+49 …">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">E-Mail</label>
                        <input type="email" id="cp_email" placeholder="max@firma.de">
                    </div>
                </div>
                <label class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
                    <input type="checkbox" id="cp_visible" checked class="w-5 h-5 accent-[#687451]">
                    <div>
                        <p class="text-sm font-semibold text-hb-offblack">Für Mieter sichtbar</p>
                        <p class="text-xs text-gray-400">Deaktivieren für interne Kontakte</p>
                    </div>
                </label>
            </div>
            <div class="flex gap-3 justify-end pt-2">
                <button onclick="hideModal('contact-person-form-modal')" class="btn-secondary text-sm">Abbrechen</button>
                <button onclick="saveContactPerson(${contactId})" class="btn-primary text-sm">Speichern</button>
            </div>
    `, { maxWidth: 'max-w-md' });
};

window.saveContactPerson = async (contactId) => {
    const name = document.getElementById('cp_name')?.value?.trim();
    if (!name) { showToast('Name ist Pflichtfeld.', 'error'); return; }

    const { error } = await _supabase.from('contact_persons').insert([{
        contact_id:            contactId,
        name,
        role:                  document.getElementById('cp_role')?.value?.trim()  || null,
        phone:                 document.getElementById('cp_phone')?.value?.trim() || null,
        email:                 document.getElementById('cp_email')?.value?.trim() || null,
        is_visible_to_tenants: document.getElementById('cp_visible')?.checked ?? true,
    }]);
    if (error) { showToast(error.message, 'error'); return; }
    hideModal('contact-person-form-modal');
    showToast('Ansprechpartner gespeichert.', 'success');
    _showAddPersonsPrompt(contactId, '');
};

window.deleteContact = async (contactId) => {
    if (!confirm('Kontakt wirklich löschen? Alle Ansprechpartner werden ebenfalls gelöscht.')) return;
    const { error } = await _supabase.from('contacts').delete().eq('id', contactId);
    if (error) { showToast(error.message, 'error'); return; }
    hideModal('contact-form-modal');
    showToast('Kontakt gelöscht.', 'success');
    await loadContacts();
};

// ─── Owner: Freigabe-Toggle ───────────────────────────────────
window.toggleContactRelease = async (contactId, checked) => {
    const uid = currentUser.id;
    if (checked) {
        const c = _contactsData.find(x => x.id === contactId);
        const myBids = (c?.building_ids || []).filter(bid => _myBuildingIds.includes(bid));
        const bids = myBids.length ? myBids : _myBuildingIds.slice(0, 1);
        await Promise.all(bids.map(bid =>
            _supabase.from('contact_releases').upsert(
                [{ contact_id: contactId, released_by: uid, building_id: bid }],
                { onConflict: 'contact_id,released_by,building_id' }
            )
        ));
    } else {
        await _supabase.from('contact_releases').delete()
            .eq('contact_id', contactId).eq('released_by', uid);
    }
    // Lokalen State aktualisieren
    _contactReleases = _contactReleases.filter(r => !(r.released_by === uid && r.contact_id === contactId));
    showToast(checked ? 'Freigegeben.' : 'Freigabe aufgehoben.', 'success');
};
