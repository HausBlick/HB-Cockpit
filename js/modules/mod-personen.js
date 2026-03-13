// ============================================================
// HB-Mieterportal | mod-personen.js
// Modul: Personen — Globales CRM / Adressbuch
// ============================================================

let personsData         = [];
let currentPersonFilter = 'Alle';
let personSearchQuery   = '';

// --- Rollen aus tenancies/ownerships/board_members/service_providers ableiten ---
async function fetchPersonsWithRoles() {
    const [personsRes, tenanciesRes, ownershipsRes, boardRes, spRes] = await Promise.all([
        _supabase.from('persons').select('id, is_company, company_name, first_name, last_name, email, phone, mobile, city, is_registered, contact_type'),
        _supabase.from('tenancies').select('tenant_id').neq('status', 'Historisch'),
        _supabase.from('ownerships').select('owner_id').eq('is_active', true),
        _supabase.from('board_members').select('person_id').is('valid_to', null),
        _supabase.from('service_providers').select('person_id'),
    ]);

    if (personsRes.error) { showToast('Fehler beim Laden: ' + personsRes.error.message, 'error'); return []; }

    const tenantIds     = new Set((tenanciesRes.data || []).map(r => r.tenant_id));
    const ownerIds      = new Set((ownershipsRes.data || []).map(r => r.owner_id));
    const boardIds      = new Set((boardRes.data || []).map(r => r.person_id));
    const spIds         = new Set((spRes.data || []).map(r => r.person_id));

    return (personsRes.data || []).map(p => {
        const roles = [];
        if (ownerIds.has(p.id))  roles.push('Eigentümer');
        if (tenantIds.has(p.id)) roles.push('Mieter');
        if (boardIds.has(p.id))  roles.push('Beirat');
        if (spIds.has(p.id))     roles.push('Dienstleister');
        return { ...p, roles };
    });
}

// --- Personen-Liste laden ---
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
                    <tbody id="persons-table-body" class="text-sm divide-y divide-gray-50">
                        <tr><td colspan="4" class="p-8 text-center text-gray-400 text-sm">Lädt...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;

    personsData = await fetchPersonsWithRoles();
    renderPersonsTable();
}

window.setPersonFilter = (filter) => {
    currentPersonFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
        const chipLabel = el.innerText.trim();
        const isActive  = chipLabel === filter || (filter === 'Alle' && chipLabel === 'Alle');
        el.className = isActive
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
        'Eigentümer':    'badge-eigentuemer',
        'Mieter':        'badge-mieter',
        'Dienstleister': 'badge-dienstleister',
        'Beirat':        'badge-beirat'
    };
    const cls = map[role] || 'bg-gray-100 text-gray-600 border-gray-200';
    return `<span class="border ${cls} text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mr-1 mb-1">${role}</span>`;
}

function renderPersonsTable() {
    const tbody = document.getElementById('persons-table-body');
    const filtered = personsData.filter(p => {
        const matchesFilter = currentPersonFilter === 'Alle' || p.roles.includes(currentPersonFilter);
        const searchStr = `${p.first_name || ''} ${p.last_name || ''} ${p.company_name || ''} ${p.email || ''}`.toLowerCase();
        return matchesFilter && searchStr.includes(personSearchQuery);
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-400 text-sm">Keine Personen gefunden.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const displayName = p.is_company
            ? (p.company_name || p.last_name || '—')
            : `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4">
                    <div class="font-bold text-hb-offblack">${displayName}</div>
                    <div class="text-xs text-gray-500">${p.city || '—'}</div>
                </td>
                <td class="p-4">
                    <div class="text-sm text-gray-700">${p.email || '—'}</div>
                    <div class="text-xs text-gray-500">${p.phone || p.mobile || '—'}</div>
                </td>
                <td class="p-4">${p.roles.length ? p.roles.map(r => getRoleBadgeHtml(r)).join('') : '<span class="text-xs text-gray-300">—</span>'}</td>
                <td class="p-4 text-right">
                    <button onclick="showPersonForm('${p.id}')"
                        class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>
                </td>
            </tr>`;
    }).join('');
}
