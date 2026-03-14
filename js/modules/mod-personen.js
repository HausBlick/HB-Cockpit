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
            <div class="p-4 bg-hb-olive flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex flex-wrap gap-2" id="person-filters">
                    <button onclick="setPersonFilter('Alle')"          class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-hb-olive border-white">Alle</button>
                    <button onclick="setPersonFilter('Eigentümer')"    class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-transparent text-white border-white/50 hover:border-white">Eigentümer</button>
                    <button onclick="setPersonFilter('Mieter')"        class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-transparent text-white border-white/50 hover:border-white">Mieter</button>
                    <button onclick="setPersonFilter('Beirat')"        class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-transparent text-white border-white/50 hover:border-white">Beiräte</button>
                    <button onclick="setPersonFilter('Dienstleister')" class="filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-transparent text-white border-white/50 hover:border-white">Dienstleister</button>
                </div>
                <input type="text" onkeyup="handlePersonSearch(event)" placeholder="Name oder E-Mail suchen..." class="md:w-64 bg-white/10 border-white/30 text-white placeholder-white/60 focus:bg-white focus:text-hb-offblack">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-hb-olive/80 text-[10px] uppercase font-bold text-white border-b border-hb-olive/20">
                            <th class="p-4">Name / Firma</th>
                            <th class="p-4">Kontakt</th>
                            <th class="p-4">Rollen</th>
                            <th class="p-4 text-right">Aktion</th>
                        </tr>
                    </thead>
                    <tbody id="persons-table-body" class="text-sm divide-y divide-hb-olive/10">
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
            ? 'filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-white text-hb-olive border-white'
            : 'filter-chip px-4 py-2 text-xs font-bold rounded-full border bg-transparent text-white border-white/50 hover:border-white transition-colors';
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
            <tr onclick="showPersonInfo('${p.id}')" class="hover:bg-gray-50 transition-colors cursor-pointer">
                <td class="p-4">
                    <div class="font-bold text-hb-offblack">${displayName}</div>
                    <div class="text-xs text-gray-500">${p.city || '—'}</div>
                </td>
                <td class="p-4">
                    <div class="text-sm text-gray-700">${p.email ? `<a href="mailto:${p.email}" onclick="event.stopPropagation()" class="text-hb-olive hover:underline">${p.email}</a>` : '—'}</div>
                    <div class="text-xs text-gray-500">${p.phone || p.mobile || '—'}</div>
                </td>
                <td class="p-4">${p.roles.length ? p.roles.map(r => getRoleBadgeHtml(r)).join('') : '<span class="text-xs text-gray-300">—</span>'}</td>
                <td class="p-4 text-right" onclick="event.stopPropagation()">
                    <button onclick="showPersonForm('${p.id}')"
                        class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>
                </td>
            </tr>`;
    }).join('');
}

// ─── Person Info-Modal (read-only) ────────────────────────────
window.showPersonInfo = async (personId) => {
    const [personRes, bankRes] = await Promise.all([
        _supabase.from('persons').select('*').eq('id', personId).maybeSingle(),
        _supabase.from('person_bank_accounts').select('iban, bic, bank_name, account_holder').eq('person_id', personId).limit(1),
    ]);
    if (personRes.error || !personRes.data) {
        console.error('showPersonInfo error:', personRes.error);
        showToast('Person nicht gefunden.', 'error');
        return;
    }
    const p    = personRes.data;
    const bank = bankRes.data?.[0] || null;

    const base = personsData.find(x => x.id === personId);
    const roles = base?.roles || [];

    const displayName = p.is_company
        ? (p.company_name || p.last_name || '—')
        : `${p.salutation ? p.salutation + ' ' : ''}${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';

    const field = (label, value, isEmail = false) => value
        ? `<div class="space-y-0.5">
               <p class="text-[10px] uppercase font-bold text-gray-400">${label}</p>
               <p class="text-sm font-semibold text-hb-offblack">${isEmail ? `<a href="mailto:${value}" class="text-hb-olive hover:underline">${value}</a>` : value}</p>
           </div>`
        : '';

    document.getElementById('person-info-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'person-info-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
            <!-- Header -->
            <div class="p-6 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <div class="w-10 h-10 rounded-full bg-hb-olive/10 text-hb-olive font-black flex items-center justify-center text-lg">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 class="text-lg font-extrabold text-hb-offblack leading-tight">${displayName}</h2>
                            <p class="text-xs text-gray-400">${p.is_company ? 'Unternehmen' : 'Privatperson'}${p.city ? ' · ' + p.city : ''}</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-1 pt-1">
                        ${roles.map(r => getRoleBadgeHtml(r)).join('')}
                        ${!roles.length ? '<span class="text-xs text-gray-300">Keine Rolle</span>' : ''}
                    </div>
                </div>
                <div class="flex gap-2 items-center flex-shrink-0 ml-4">
                    <button onclick="document.getElementById('person-info-modal').remove(); showPersonForm('${personId}')"
                        class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>
                    <button onclick="document.getElementById('person-info-modal').remove()"
                        class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
                </div>
            </div>
            <!-- Inhalt -->
            <div class="p-6 overflow-y-auto flex-grow space-y-6">
                <!-- Kontakt -->
                <div>
                    <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Kontakt</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('E-Mail', p.email, true)}
                        ${field('Telefon', p.phone)}
                        ${field('Mobil', p.mobile)}
                        ${field('Stadt', p.city)}
                        ${field('Straße', p.street ? p.street + (p.house_number ? ' ' + p.house_number : '') : null)}
                        ${field('PLZ', p.postal_code)}
                    </div>
                </div>
                ${p.is_company && p.tax_id ? `
                <div>
                    <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Unternehmen</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('Steuer-ID', p.tax_id)}
                        ${field('Kontakttyp', p.contact_type)}
                    </div>
                </div>` : ''}
                ${bank ? `
                <div>
                    <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Bankverbindung</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('Kontoinhaber', bank.account_holder)}
                        ${field('Bank', bank.bank_name)}
                        ${field('IBAN', bank.iban)}
                        ${field('BIC', bank.bic)}
                    </div>
                </div>` : ''}
                <div>
                    <p class="text-[10px] uppercase font-bold text-gray-300 mb-3">Portal</p>
                    <div class="grid grid-cols-2 gap-4">
                        ${field('Einladungscode', p.invite_code)}
                        ${field('Digital opt-in', p.digital_optin ? 'Ja' : (p.digital_optin === false ? 'Nein' : null))}
                        ${field('Registriert', p.is_registered ? 'Ja' : 'Nein')}
                    </div>
                </div>
            </div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};
