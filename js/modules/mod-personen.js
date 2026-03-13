// ============================================================
// HB-Mieterportal | mod-personen.js
// Modul: Personen — Globales CRM / Adressbuch
// Hinweis: mockPersons wird durch Supabase-Anbindung (2.1) ersetzt
// ============================================================

let mockPersons = [
    { id: '1', first_name: 'Max',    last_name: 'Müller',           email: 'max@mueller.de',      phone: '0151-1234567', city: 'Friedrichshafen', is_registered: true,  roles: ['Eigentümer', 'Beirat'], contact_type: 'Privatperson' },
    { id: '2', first_name: 'Sabine', last_name: 'Schmidt',          email: 'sabine.s@gmx.de',     phone: '07541-98765',  city: 'Ravensburg',      is_registered: false, roles: ['Mieter'],               contact_type: 'Privatperson' },
    { id: '3', first_name: '',       last_name: 'Sanitär Huber GmbH', email: 'info@huber-sanitaer.de', phone: '07541-112233', city: 'Friedrichshafen', is_registered: false, roles: ['Dienstleister'],    contact_type: 'Firma' }
];

let currentPersonFilter = 'Alle';
let personSearchQuery   = '';

// --- Personen-Liste ---
async function loadUserManagement() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="flex justify-between items-end mb-6 text-left">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-offblack tracking-tight">Globales Adressbuch</h2>
                <p class="text-sm text-gray-500 mt-1">Verwalten Sie Eigentümer, Mieter und Dienstleister zentral.</p>
            </div>
            <button onclick="showPersonForm()" class="btn-primary flex items-center gap-2 text-sm shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Neue Person
            </button>
        </div>
        <div class="card flex flex-col overflow-hidden text-left">
            <div class="p-5 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex flex-wrap gap-2" id="person-filters">
                    <button onclick="setPersonFilter('Alle')"          class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-hb-offblack text-white">Alle</button>
                    <button onclick="setPersonFilter('Eigentümer')"    class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-gray-500">Eigentümer</button>
                    <button onclick="setPersonFilter('Mieter')"        class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-gray-500">Mieter</button>
                    <button onclick="setPersonFilter('Beirat')"        class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-gray-500">Beiräte</button>
                    <button onclick="setPersonFilter('Dienstleister')" class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-gray-500">Dienstleister</button>
                </div>
                <input type="text" onkeyup="handlePersonSearch(event)" placeholder="Name oder E-Mail suchen..." class="md:w-64">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100">
                            <th class="p-4">Name / Firma</th>
                            <th class="p-4">Kontakt</th>
                            <th class="p-4">Rollen</th>
                            <th class="p-4 text-right">Aktion</th>
                        </tr>
                    </thead>
                    <tbody id="persons-table-body" class="text-sm divide-y divide-gray-50"></tbody>
                </table>
            </div>
        </div>`;
    renderPersonsTable();
}

window.setPersonFilter = (filter) => {
    currentPersonFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
        const match = el.innerText.trim() === filter || (filter === 'Alle' && el.innerText.trim() === 'Alle');
        el.className = match
            ? 'filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-hb-offblack text-white'
            : 'filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-gray-500 hover:bg-gray-50 transition-colors';
    });
    renderPersonsTable();
};

window.handlePersonSearch = (e) => {
    personSearchQuery = e.target.value.toLowerCase();
    renderPersonsTable();
};

function getRoleBadgeHtml(role) {
    const map = {
        'Eigentümer':   'badge-eigentuemer',
        'Mieter':       'badge-mieter',
        'Dienstleister':'badge-dienstleister',
        'Beirat':       'badge-beirat'
    };
    const cls = map[role] || 'bg-gray-100 text-gray-600 border-gray-200';
    return `<span class="border ${cls} text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mr-1 mb-1">${role}</span>`;
}

function renderPersonsTable() {
    const tbody = document.getElementById('persons-table-body');
    let filtered = mockPersons.filter(p => {
        const matchesFilter = currentPersonFilter === 'Alle' || p.roles.includes(currentPersonFilter);
        const matchesSearch = (p.first_name + ' ' + p.last_name).toLowerCase().includes(personSearchQuery)
            || p.email.toLowerCase().includes(personSearchQuery);
        return matchesFilter && matchesSearch;
    });
    tbody.innerHTML = filtered.map(p => {
        const isCompany = p.contact_type === 'Firma';
        const displayName = isCompany ? p.last_name : `${p.first_name || ''} ${p.last_name}`.trim();
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4">
                    <div class="font-bold text-hb-offblack">${displayName}</div>
                    <div class="text-xs text-gray-500">${p.city || '-'}</div>
                </td>
                <td class="p-4">
                    <div class="text-sm text-gray-700">${p.email || '-'}</div>
                    <div class="text-xs text-gray-500">${p.phone || p.mobile || '-'}</div>
                </td>
                <td class="p-4">${p.roles.map(r => getRoleBadgeHtml(r)).join('')}</td>
                <td class="p-4 text-right">
                    <button onclick="showPersonForm('${p.id}')"
                        class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>
                </td>
            </tr>`;
    }).join('');
}

// --- Tab-Wechsel Person ---
window.switchPersonTab = (tabId) => {
    document.querySelectorAll('.person-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.person-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('person-tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('person-btn-tab-' + tabId);
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-hb-olive', 'text-hb-olive');
    }
};

// --- Person anlegen / bearbeiten ---
function showPersonForm(id = null) {
    const container = document.getElementById('content-area');
    let p = id ? mockPersons.find(x => x.id === id) : { roles: [], contact_type: 'Privatperson' };
    const isEdit = !!id;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-extrabold">${isEdit ? 'Person bearbeiten' : 'Neuen Kontakt anlegen'}</h2>
            <button onclick="loadUserManagement()"
                class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">Zurück zur Liste</button>
        </div>
        <div class="card p-8 text-left">
            <div class="flex overflow-x-auto border-b border-gray-200 mb-8 gap-8 hide-scrollbar flex-shrink-0">
                <button type="button" id="person-btn-tab-base"    onclick="switchPersonTab('base')"    class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-hb-olive text-hb-olive">Stammdaten & Adressen</button>
                <button type="button" id="person-btn-tab-roles"   onclick="switchPersonTab('roles')"   class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Rollen & Objekte</button>
                <button type="button" id="person-btn-tab-portal"  onclick="switchPersonTab('portal')"  class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Portal & Rechtliches</button>
                <button type="button" id="person-btn-tab-finance" onclick="switchPersonTab('finance')" class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Finanzen & SEPA</button>
            </div>

            <form id="person-form" class="space-y-6">

                <!-- TAB: STAMMDATEN -->
                <div id="person-tab-base" class="person-tab-content grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500">Kontakt-Typ</label>
                        <select id="p_type" class="w-full md:w-1/3">
                            <option value="Privatperson" ${p.contact_type === 'Privatperson' ? 'selected' : ''}>Privatperson</option>
                            <option value="Firma"        ${p.contact_type === 'Firma'        ? 'selected' : ''}>Firma / Organisation</option>
                        </select>
                    </div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Vorname / Titel</label><input type="text"  id="p_first" value="${p.first_name || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Nachname / Firmenname *</label><input type="text" id="p_last" value="${p.last_name || ''}" required></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">E-Mail</label><input type="email" id="p_email" value="${p.email || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Telefon</label><input type="text"  id="p_phone" value="${p.phone || ''}"></div>
                    <div class="space-y-2 md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-2">Haupt-Meldeadresse</h3>
                    </div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Straße & Hausnr.</label><input type="text" id="p_street"></div>
                    <div class="space-y-2">
                        <div class="grid grid-cols-3 gap-2">
                            <div class="col-span-1"><label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label><input type="text" id="p_zip"></div>
                            <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-gray-500">Ort</label><input type="text" id="p_city" value="${p.city || ''}"></div>
                        </div>
                    </div>
                </div>

                <!-- TAB: ROLLEN -->
                <div id="person-tab-roles" class="person-tab-content hidden space-y-6">
                    <div class="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center mb-4">
                        <h3 class="text-sm font-bold text-gray-700 mb-2">Rollen Übersicht</h3>
                        <p class="text-xs text-gray-500 mb-4">Die Zuweisung von Mietern/Eigentümern zu Wohnungen erfolgt direkt über das <strong>Objekte-Modul</strong>.</p>
                        <div class="flex justify-center gap-4 mt-4">
                            <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" ${p.roles.includes('Eigentümer')    ? 'checked' : ''} disabled> Eigentümer</label>
                            <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" ${p.roles.includes('Mieter')         ? 'checked' : ''} disabled> Mieter</label>
                            <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" ${p.roles.includes('Beirat')         ? 'checked' : ''}        > Beirat</label>
                            <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" ${p.roles.includes('Dienstleister')  ? 'checked' : ''}        > Dienstleister</label>
                        </div>
                    </div>
                </div>

                <!-- TAB: PORTAL -->
                <div id="person-tab-portal" class="person-tab-content hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-4 md:col-span-2">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Portal-Zugang</h3>
                            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p class="text-sm font-bold text-gray-800">App & Portal Nutzung</p>
                                    <p class="text-xs text-gray-500">${p.is_registered ? 'Nutzer hat sich registriert und ist aktiv.' : 'Bisher keine Registrierung.'}</p>
                                </div>
                                ${p.is_registered
                                    ? `<button type="button" class="btn-secondary text-xs px-4 py-2">Passwort Reset</button>`
                                    : `<button type="button" class="btn-primary text-xs px-4 py-2">Einladung generieren</button>`}
                            </div>
                        </div>
                        <div class="space-y-2 md:col-span-2">
                            <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500">Interne Notizen zur Person</label>
                            <textarea id="p_notes" rows="3"></textarea>
                        </div>
                    </div>
                </div>

                <!-- TAB: FINANZEN -->
                <div id="person-tab-finance" class="person-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Kontoinhaber</label><input type="text"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Bankname</label><input type="text"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">IBAN</label><input type="text" placeholder="DE..."></div>
                    <div class="space-y-2 border-t pt-4 md:col-span-2">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-2">SEPA-Lastschriftmandat</h3>
                    </div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Mandats-Referenz</label><input type="text"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Unterschrift Datum</label><input type="date"></div>
                </div>

                <div class="pt-6 border-t flex gap-4">
                    <button type="submit" class="btn-primary">Kontakt speichern</button>
                </div>
            </form>
        </div>`;

    document.getElementById('person-form').onsubmit = (e) => {
        e.preventDefault();
        showToast('Speicherlogik folgt.', 'success');
        loadUserManagement();
    };
}
