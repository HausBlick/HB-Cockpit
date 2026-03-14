// ============================================================
// HB-Mieterportal | mod-tickets.js
// Modul: Ticket-System — Mangelmeldungen im Zammad-Stil
// ============================================================

let _ticketFilter         = 'mine';
let _ticketsData          = [];
let _currentTicketId      = null;
let _ticketRealtimeChannel = null;

const TICKET_STATUSES = ['Offen', 'In Bearbeitung', 'Warte auf Rückmeldung', 'Wiedervorlage', 'Erledigt'];

const STATUS_STYLE = {
    'Offen':                  'ts-offen',
    'In Bearbeitung':         'ts-bearbeitung',
    'Warte auf Rückmeldung':  'ts-warte',
    'Wiedervorlage':          'ts-wiedervorlage',
    'Erledigt':               'ts-erledigt',
};

// ─── Haupteinstieg ────────────────────────────────────────────
async function loadTickets() {
    // Realtime-Kanal beim Modul-Reload sauber schließen
    if (_ticketRealtimeChannel) {
        _supabase.removeChannel(_ticketRealtimeChannel);
        _ticketRealtimeChannel = null;
    }

    await _checkSnoozedTickets();

    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-140px)] text-left">
            <!-- Linke Filter-Sidebar -->
            <div id="ticket-sidebar" class="w-full lg:w-56 xl:w-64 flex-shrink-0">
                <div class="card lg:h-full flex flex-col overflow-hidden">
                    <div class="px-4 py-3 flex justify-between items-center bg-hb-olive">
                        <h2 class="text-xs font-black uppercase tracking-widest text-white">Tickets</h2>
                        <button onclick="showCreateTicketModal()"
                            class="bg-white/20 text-white w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none hover:bg-white/30 transition-colors">+</button>
                    </div>
                    <div class="px-2 pt-2 pb-1 flex-shrink-0">
                        <input type="search" id="ticket-search" placeholder="Suchen…"
                            oninput="searchTickets(this.value)"
                            class="w-full text-xs h-8 px-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-hb-olive outline-none transition-colors">
                    </div>
                    <div class="flex-grow overflow-y-auto p-2 space-y-0.5" id="ticket-filter-menu"></div>
                </div>
            </div>
            <!-- Rechter Bereich -->
            <div class="flex-1 min-w-0 lg:h-full" id="ticket-main">
                <div class="card lg:h-full flex items-center justify-center text-gray-400 text-sm">
                    Bitte wähle eine Ansicht aus.
                </div>
            </div>
        </div>`;

    await _renderFilterMenu();
    // Mobile: ticket-main erst nach Auswahl sichtbar
    if (window.innerWidth < 1024) {
        document.getElementById('ticket-main').style.display = 'none';
    } else {
        await _loadTicketView('mine');
    }
}

async function _checkSnoozedTickets() {
    const now = new Date().toISOString();
    await _supabase.from('tickets')
        .update({ status: 'Offen', snooze_until: null })
        .eq('status', 'Wiedervorlage')
        .lt('snooze_until', now)
        .or(`creator_id.eq.${currentUser.id},assigned_to.eq.${currentUser.id}`);
}

// ─── Filter-Menü ──────────────────────────────────────────────
async function _renderFilterMenu() {
    const menu = document.getElementById('ticket-filter-menu');
    if (!menu) return;

    // Counts laden (ein Query, client-side aggregieren)
    const { data: allTickets } = await _supabase
        .from('tickets').select('id, status, building_id, creator_id, assigned_to');
    const all = allTickets || [];

    const counts = {
        mine:                    all.filter(t => (t.creator_id === currentUser.id || t.assigned_to === currentUser.id) && t.status !== 'Erledigt').length,
        'Offen':                 all.filter(t => t.status === 'Offen').length,
        'In Bearbeitung':        all.filter(t => t.status === 'In Bearbeitung').length,
        'Warte auf Rückmeldung': all.filter(t => t.status === 'Warte auf Rückmeldung').length,
        'Wiedervorlage':         all.filter(t => t.status === 'Wiedervorlage').length,
        'Erledigt':              all.filter(t => t.status === 'Erledigt').length,
    };

    const badge = (n) => n > 0
        ? `<span class="ml-auto text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">${n}</span>`
        : '';

    const s = 'width="16" height="16" fill="none" stroke="#687451" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="flex-shrink:0"';
    const svgIcons = {
        person:      `<svg ${s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        checkSquare: `<svg ${s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
        circle:      `<svg ${s}><circle cx="12" cy="12" r="9"/></svg>`,
        tool:        `<svg ${s}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
        clock:       `<svg ${s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
        repeat:      `<svg ${s}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        checkCircle: `<svg ${s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    };

    const filters = [
        { id: 'mine',                  label: 'Meine Tickets',           icon: svgIcons.person,      showBadge: true  },
        { id: 'Offen',                 label: 'Offen',                   icon: svgIcons.circle,      showBadge: true  },
        { id: 'In Bearbeitung',        label: 'In Bearbeitung',          icon: svgIcons.tool,        showBadge: true  },
        { id: 'Warte auf Rückmeldung', label: 'Warte auf Antwort',       icon: svgIcons.clock,       showBadge: true  },
        { id: 'Wiedervorlage',         label: 'Wiedervorlage',           icon: svgIcons.repeat,      showBadge: true  },
        { id: 'Erledigt',              label: 'Alle erledigten',         icon: svgIcons.checkCircle, showBadge: false },
        { id: 'mine-done',             label: 'Meine erledigten Tickets', icon: svgIcons.checkSquare, showBadge: false },
    ];

    menu.innerHTML = filters.map(f => `
        <button onclick="setTicketFilter('${f.id}')" id="tf-${f.id.replace(/\s/g,'-')}"
            class="ticket-filter-btn w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold
                   transition-colors flex items-center gap-2 text-gray-600 hover:bg-gray-50
                   ${_ticketFilter === f.id ? 'bg-hb-ultralight text-hb-olive font-bold' : ''}">
            ${f.icon}${f.label}${f.showBadge ? badge(counts[f.id]) : ''}
        </button>`).join('') + `<div class="border-t border-gray-100 my-2"></div>
        <p class="text-[10px] uppercase font-bold text-gray-400 px-3 pb-1">Nach Gebäude</p>
        <div id="ticket-building-filters" class="space-y-0.5"></div>`;

    // Gebäude-Filter mit Counts
    const { data: buildings } = await _supabase.from('buildings').select('id, name').order('name');
    const bDiv = document.getElementById('ticket-building-filters');
    if (bDiv && buildings) {
        bDiv.innerHTML = buildings.map(b => {
            const n = all.filter(t => t.building_id === b.id && t.status !== 'Erledigt').length;
            return `
            <button onclick="setTicketFilter('building-${b.id}')" id="tf-building-${b.id}"
                class="ticket-filter-btn w-full text-left px-3 py-2 rounded-lg text-xs font-semibold
                       text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-2">
                <span class="truncate flex-1">${b.name}</span>${badge(n)}
            </button>`;
        }).join('');
    }
}

// Mobile: von Detail zurück zur Ticket-Liste (nicht zur Sidebar)
window._backToList = () => {
    if (_ticketRealtimeChannel) {
        _supabase.removeChannel(_ticketRealtimeChannel);
        _ticketRealtimeChannel = null;
    }
    setTicketFilter(_ticketFilter);
};

// Mobile: von Ticket-Liste zurück zur Filter-Sidebar
window._backToSidebar = () => {
    const sidebar = document.getElementById('ticket-sidebar');
    const main    = document.getElementById('ticket-main');
    if (sidebar) sidebar.style.display = '';
    if (main)    main.style.display    = 'none';
};

// Mobile: Info-Sidebar ein-/ausklappen
window._toggleMobileInfo = () => {
    const info = document.getElementById('ticket-info-sidebar');
    if (!info) return;
    info.classList.toggle('hidden');
    info.classList.toggle('block');
};

window.setTicketFilter = async (filterId) => {
    _ticketFilter = filterId;
    // Mobile: Sidebar ausblenden, Ticket-Liste einblenden
    if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('ticket-sidebar');
        const main    = document.getElementById('ticket-main');
        if (sidebar) sidebar.style.display = 'none';
        if (main)    main.style.display    = 'block';
    }
    document.querySelectorAll('.ticket-filter-btn').forEach(el => {
        const active = el.id === `tf-${filterId.replace(/\s/g,'-')}` || el.id === `tf-${filterId}`;
        el.classList.toggle('bg-hb-ultralight', active);
        el.classList.toggle('text-hb-olive', active);
        el.classList.toggle('font-bold', active);
    });
    await _loadTicketView(filterId);
};

// ─── Ticket-Liste laden ───────────────────────────────────────
async function _loadTicketView(filterId) {
    const main = document.getElementById('ticket-main');
    if (!main) return;
    main.innerHTML = `<div class="card h-full flex items-center justify-center">
        <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
    </div>`;

    let query = _supabase.from('tickets')
        .select(`*, buildings(id, name), apartments(id, apartment_number),
            creator:profiles!tickets_creator_id_fkey(id, full_name),
            assignee:profiles!tickets_assigned_to_fkey(id, full_name)`)
        .order('created_at', { ascending: false });

    if (filterId === 'mine') {
        query = query.or(`creator_id.eq.${currentUser.id},assigned_to.eq.${currentUser.id}`)
                     .neq('status', 'Erledigt');
    } else if (filterId === 'mine-done') {
        query = query.or(`creator_id.eq.${currentUser.id},assigned_to.eq.${currentUser.id}`)
                     .eq('status', 'Erledigt');
    } else if (filterId.startsWith('building-')) {
        const bId = filterId.replace('building-', '');
        query = query.eq('building_id', bId).neq('status', 'Erledigt');
    } else {
        query = query.eq('status', filterId);
    }

    const { data, error } = await query;
    if (error) { showToast(error.message, 'error'); return; }
    _ticketsData = data || [];
    _renderTicketList(filterId);
}

function _renderTicketList(filterId) {
    const main = document.getElementById('ticket-main');
    if (!main) return;

    const title = filterId === 'mine' ? 'Meine Tickets'
        : filterId.startsWith('building-') ? 'Gebäude-Tickets'
        : filterId;

    main.innerHTML = `
        <div class="card lg:h-full flex flex-col overflow-hidden">
            <div class="px-4 py-3 flex items-center gap-3 flex-shrink-0 bg-hb-olive">
                <button onclick="_backToSidebar()" class="lg:hidden text-white font-bold text-xs flex-shrink-0">← Filter</button>
                <h3 class="font-bold text-white">${title}
                    <span class="ml-2 text-xs font-normal text-white/70">(${_ticketsData.length})</span>
                </h3>
            </div>
            <div class="overflow-y-auto flex-grow">
                <table class="w-full text-left text-sm">
                    <thead class="text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0">
                        <tr>
                            <th class="px-4 py-2">Betreff</th>
                            <th class="px-4 py-2 hidden md:table-cell">Kategorie</th>
                            <th class="px-4 py-2 hidden md:table-cell">Ersteller</th>
                            <th class="px-4 py-2 hidden lg:table-cell">Objekt &amp; Einheit</th>
                            <th class="px-4 py-2 text-right">Status / Datum</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-hb-olive/10">
                        ${_ticketsData.length
                            ? _ticketsData.map(t => _ticketRowHtml(t)).join('')
                            : '<tr><td colspan="5" class="p-8 text-center text-gray-400 text-sm">Keine Tickets vorhanden.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
}

function _ticketRowHtml(t) {
    const stCls   = STATUS_STYLE[t.status] || 'bg-gray-100 text-gray-500';
    const date    = new Date(t.created_at).toLocaleDateString('de-DE', { day:'2-digit', month:'short' });
    const isMine  = t.creator_id === currentUser.id;
    const isAssigned = t.assigned_to === currentUser.id;
    const dirBadge = isMine
        ? `<span class="ml-1.5 text-[9px] font-bold bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded">Von mir</span>`
        : (isAssigned ? `<span class="ml-1.5 text-[9px] font-bold bg-hb-orange/10 text-hb-orange px-1.5 py-0.5 rounded">An mich</span>` : '');
    const location = [t.buildings?.name, t.apartments?.apartment_number ? `Wohnung ${t.apartments.apartment_number}` : null].filter(Boolean).join(' / ') || '—';
    return `<tr onclick="openTicketDetail('${t.id}')" class="hover:bg-hb-olive/5 cursor-pointer transition-colors">
        <td class="px-4 py-3">
            <span class="font-bold text-hb-offblack">${t.title}</span>${dirBadge}
        </td>
        <td class="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">${t.category || '—'}</td>
        <td class="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">${t.creator?.full_name || '—'}</td>
        <td class="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">${location}</td>
        <td class="px-4 py-3 text-right">
            <span class="${stCls} text-[10px] font-bold px-2 py-0.5 rounded-full">${t.status}</span>
            <p class="text-[10px] text-gray-400 mt-0.5">${date}</p>
        </td>
    </tr>`;
}

// ─── Suche ────────────────────────────────────────────────────
window.searchTickets = async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) { await _loadTicketView(_ticketFilter); return; }

    // Parallel: alle zugänglichen Tickets + Nachrichten-Treffer (RLS filtert jeweils automatisch)
    const [ticketsRes, msgRes] = await Promise.all([
        _supabase.from('tickets')
            .select(`*, buildings(id, name), apartments(id, apartment_number),
                creator:profiles!tickets_creator_id_fkey(id, full_name),
                assignee:profiles!tickets_assigned_to_fkey(id, full_name)`)
            .order('created_at', { ascending: false }),
        _supabase.from('ticket_messages')
            .select('ticket_id')
            .ilike('message', `%${q}%`)
            .eq('is_system_message', false),
    ]);

    if (ticketsRes.error) { showToast(ticketsRes.error.message, 'error'); return; }

    const allAccessible  = ticketsRes.data || [];
    const accessibleIds  = new Set(allAccessible.map(t => t.id));

    // Nachrichten-Treffer auf Tickets beschränken, die der User sowieso sehen darf
    const msgMatchedIds  = new Set(
        (msgRes.data || []).map(m => m.ticket_id).filter(id => accessibleIds.has(id))
    );

    _ticketsData = allAccessible.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.creator?.full_name?.toLowerCase().includes(q) ||
        t.buildings?.name?.toLowerCase().includes(q) ||
        msgMatchedIds.has(t.id)
    );

    const main = document.getElementById('ticket-main');
    if (!main) return;
    main.innerHTML = `
        <div class="card h-full flex flex-col overflow-hidden">
            <div class="px-5 py-3 flex justify-between items-center flex-shrink-0 bg-hb-olive">
                <h3 class="font-bold text-white">Suchergebnisse für „${query}"
                    <span class="ml-2 text-xs font-normal text-white/70">(${_ticketsData.length})</span>
                </h3>
            </div>
            <div class="flex-grow overflow-y-auto">
                <table class="w-full text-left text-sm">
                    <thead class="text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th class="px-4 py-2">Betreff</th>
                            <th class="px-4 py-2 hidden md:table-cell">Kategorie</th>
                            <th class="px-4 py-2 hidden md:table-cell">Ersteller</th>
                            <th class="px-4 py-2 hidden lg:table-cell">Objekt &amp; Einheit</th>
                            <th class="px-4 py-2 text-right">Status / Datum</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-hb-olive/10">
                        ${_ticketsData.length
                            ? _ticketsData.map(t => _ticketRowHtml(t)).join('')
                            : '<tr><td colspan="5" class="p-8 text-center text-gray-400 text-sm">Keine Tickets gefunden.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
};

// ─── Ticket-Detail ────────────────────────────────────────────
window.openTicketDetail = async (ticketId) => {
    _currentTicketId = ticketId;
    const main = document.getElementById('ticket-main');
    if (!main) return;

    const [ticketRes, messagesRes, managersRes] = await Promise.all([
        _supabase.from('tickets')
            .select(`*, buildings(id, name), apartments(id, apartment_number),
                creator:profiles!tickets_creator_id_fkey(id, full_name),
                assignee:profiles!tickets_assigned_to_fkey(id, full_name)`)
            .eq('id', ticketId).single(),
        _supabase.from('ticket_messages')
            .select('*, sender:profiles!ticket_messages_sender_id_fkey(id, full_name)')
            .eq('ticket_id', ticketId).order('created_at'),
        _supabase.from('profiles').select('id, full_name').in('role', ['admin', 'manager']),
    ]);

    const t        = ticketRes.data;
    const messages = messagesRes.data || [];
    const managers = managersRes.data || [];
    if (!t) { showToast('Ticket nicht gefunden.', 'error'); return; }

    const role    = userProfile?.role;
    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = role === 'owner';
    const stCls   = STATUS_STYLE[t.status] || 'bg-gray-100 text-gray-500';

    // Mobile: Sidebar ausblenden, Hauptbereich vollflächig einblenden
    if (window.innerWidth < 1024) {
        document.getElementById('ticket-sidebar').style.display = 'none';
        main.style.display = 'block';
    }

    main.innerHTML = `
        <div class="card lg:h-full flex flex-col lg:flex-row lg:overflow-hidden">
            <!-- Chat-Bereich -->
            <div class="flex-1 flex flex-col min-w-0 lg:border-r border-gray-100">
                <div class="px-4 py-3 border-b border-gray-50 flex justify-between items-center flex-shrink-0">
                    <div class="min-w-0">
                        <button onclick="_backToList()"
                            class="text-xs font-bold text-hb-olive hover:underline">← Zurück</button>
                        <p class="font-bold text-hb-offblack mt-0.5 truncate">${t.title}</p>
                    </div>
                    <!-- Mobile: Info-Toggle -->
                    <button onclick="_toggleMobileInfo()" class="lg:hidden flex-shrink-0 ml-2 text-xs font-bold text-gray-400 border border-gray-200 rounded-lg px-2 py-1">
                        Info ▾
                    </button>
                </div>
                <!-- Chat -->
                <div class="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-50/30" id="ticket-chat" style="min-height:200px">
                    ${messages.map(m => _messageBubble(m)).join('')}
                    ${!messages.length ? '<p class="text-center text-sm text-gray-400 py-8">Noch keine Nachrichten.</p>' : ''}
                </div>
                <!-- Eingabe -->
                <div class="p-3 border-t border-gray-100 flex-shrink-0 flex gap-2 items-end bg-white">
                    <textarea id="ticket-reply-input" rows="2" placeholder="Antwort schreiben…"
                        class="flex-grow resize-none text-sm"
                        onkeydown="if(event.key==='Enter'&&event.ctrlKey)sendTicketMessage('${t.id}')"></textarea>
                    <button onclick="sendTicketMessage('${t.id}')"
                        class="btn-primary px-3 py-2 text-sm flex-shrink-0">Senden</button>
                </div>
            </div>

            <!-- Info-Sidebar (Desktop: rechts fest | Mobile: ausklappbar) -->
            <div id="ticket-info-sidebar" class="hidden lg:block w-full lg:w-64 xl:w-72 flex-shrink-0 overflow-y-auto p-5 space-y-5 text-left border-t lg:border-t-0">
                <!-- Status -->
                <div class="space-y-2">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Status</p>
                    ${isAdmin ? `
                        <select id="ticket-status-sel" onchange="updateTicketStatus('${t.id}', this.value)"
                            class="text-sm h-9 px-2">
                            ${TICKET_STATUSES.map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                        <div id="snooze-wrap" class="${t.status === 'Wiedervorlage' ? '' : 'hidden'} space-y-1 mt-1">
                            <label class="text-[10px] uppercase font-bold text-gray-400">Wiedervorlage Datum</label>
                            <input type="date" id="snooze-date" value="${t.snooze_until ? t.snooze_until.split('T')[0] : ''}"
                                onchange="saveSnoozeDate('${t.id}', this.value)">
                        </div>` : `<span class="${stCls} text-xs font-bold px-3 py-1 rounded-full">${t.status}</span>`}
                </div>

                <!-- Kategorie -->
                <div class="space-y-1">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Kategorie</p>
                    <p class="text-sm font-semibold">${t.category || '—'}</p>
                </div>

                <!-- Gebäude Deep-Link -->
                ${t.buildings ? `<div class="space-y-1">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Gebäude</p>
                    <button onclick="navigateToBuilding(${t.buildings.id})"
                        class="text-sm font-bold text-hb-olive hover:underline">${t.buildings.name}</button>
                </div>` : ''}

                <!-- Einheit Deep-Link -->
                ${t.apartments ? `<div class="space-y-1">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Einheit</p>
                    <button onclick="navigateToApartment(${t.buildings?.id}, ${t.apartments.id})"
                        class="text-sm font-bold text-hb-olive hover:underline">Wohnung ${t.apartments.apartment_number}</button>
                </div>` : ''}

                <!-- Ersteller -->
                <div class="space-y-1">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Erstellt von</p>
                    ${isAdmin
                        ? `<button onclick="navigateToPersonByProfile('${t.creator?.id}')"
                            class="text-sm font-bold text-hb-olive hover:underline">${t.creator?.full_name || '—'}</button>`
                        : `<p class="text-sm font-semibold">${t.creator?.full_name || '—'}</p>`}
                </div>

                <!-- Zugewiesen an -->
                <div class="space-y-2">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Zugewiesen an</p>
                    ${isAdmin ? `
                        <select onchange="assignTicket('${t.id}', this.value)" class="text-sm h-9 px-2">
                            <option value="">— Niemand —</option>
                            ${managers.map(m => `<option value="${m.id}" ${t.assigned_to===m.id?'selected':''}>${m.full_name}</option>`).join('')}
                        </select>` : `<p class="text-sm font-semibold">${t.assignee?.full_name || '—'}</p>`}
                </div>

                <!-- Eskalation (nur owner) -->
                ${isOwner && t.status !== 'Erledigt' ? `
                    <div class="border-t pt-4">
                        <button onclick="escalateTicket('${t.id}')"
                            class="btn-secondary w-full text-xs py-2">An Verwalter weiterleiten</button>
                    </div>` : ''}

                <!-- Priorität -->
                <div class="space-y-1 border-t pt-4">
                    <p class="text-[10px] uppercase font-bold text-gray-400">Erstellt am</p>
                    <p class="text-xs text-gray-500">${new Date(t.created_at).toLocaleString('de-DE')}</p>
                </div>
            </div>
        </div>`;

    // Chat ans Ende scrollen
    setTimeout(() => {
        const chat = document.getElementById('ticket-chat');
        if (chat) chat.scrollTop = chat.scrollHeight;
    }, 50);

    // ─── Realtime: neue Nachrichten anderer User live empfangen ───
    if (_ticketRealtimeChannel) _supabase.removeChannel(_ticketRealtimeChannel);
    _ticketRealtimeChannel = _supabase
        .channel(`ticket-messages-${ticketId}`)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'ticket_messages',
            filter: `ticket_id=eq.${ticketId}`,
        }, async (payload) => {
            // Eigene Nachrichten werden direkt in sendTicketMessage() angezeigt
            if (payload.new.sender_id === currentUser.id) return;
            const { data: msg } = await _supabase
                .from('ticket_messages')
                .select('*, sender:profiles!ticket_messages_sender_id_fkey(id, full_name)')
                .eq('id', payload.new.id).single();
            const chat = document.getElementById('ticket-chat');
            if (chat && msg) {
                // Platzhalter "Noch keine Nachrichten" entfernen
                chat.querySelector('p.text-center')?.remove();
                chat.innerHTML += _messageBubble(msg);
                chat.scrollTop = chat.scrollHeight;
            }
            refreshNavBadges?.();
        })
        .subscribe();
};

function _messageBubble(m) {
    if (m.is_system_message) {
        return `<div class="text-center text-xs italic text-gray-400 py-1">${m.message}</div>`;
    }
    const isOwn  = m.sender_id === currentUser.id;
    const name   = m.sender?.full_name || '—';
    const time   = new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `<div class="flex ${isOwn ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[75%] space-y-1">
            ${!isOwn ? `<p class="text-[10px] font-bold text-gray-400 px-1">${name}</p>` : ''}
            <div class="${isOwn ? 'bg-hb-olive text-white' : 'bg-white border border-gray-100'} rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                ${m.message}
            </div>
            <p class="text-[10px] text-gray-300 px-1 ${isOwn ? 'text-right' : ''}">${time}</p>
        </div>
    </div>`;
}

// ─── Nachricht senden ─────────────────────────────────────────
window.sendTicketMessage = async (ticketId) => {
    const input = document.getElementById('ticket-reply-input');
    const msg   = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    input.disabled = true;

    const { error } = await _supabase.from('ticket_messages').insert([{
        ticket_id: ticketId,
        sender_id: currentUser.id,
        message:   msg,
    }]);
    input.disabled = false;
    if (error) { showToast(error.message, 'error'); return; }

    // Auto-Reopen: Mieter/Eigentümer-Antwort setzt Status zurück auf "Offen"
    const role = userProfile?.role;
    if (role === 'tenant' || role === 'owner') {
        const { data: ticket } = await _supabase.from('tickets').select('status').eq('id', ticketId).single();
        const closedStatuses = ['In Bearbeitung', 'Warte auf Rückmeldung', 'Wiedervorlage'];
        if (ticket && closedStatuses.includes(ticket.status)) {
            const sysMsg = `${userProfile.full_name} hat geantwortet — Ticket automatisch auf „Offen" gesetzt.`;
            await Promise.all([
                _supabase.from('tickets').update({ status: 'Offen', snooze_until: null, updated_at: new Date().toISOString() }).eq('id', ticketId),
                _supabase.from('ticket_messages').insert([{ ticket_id: ticketId, sender_id: currentUser.id, message: sysMsg, is_system_message: true }]),
            ]);
            // Status-Dropdown im UI aktualisieren
            const sel = document.getElementById('ticket-status-sel');
            if (sel) sel.value = 'Offen';
            document.getElementById('snooze-wrap')?.classList.add('hidden');
        } else {
            await _supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
        }
    } else {
        await _supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
    }

    // Eigene Nachricht sofort im Chat anzeigen (Realtime übernimmt fremde)
    const chat = document.getElementById('ticket-chat');
    if (chat) {
        chat.querySelector('p.text-center')?.remove();
        const fakeMsg = { id: Date.now(), sender_id: currentUser.id, message: msg,
            created_at: new Date().toISOString(), is_system_message: false,
            sender: { full_name: userProfile?.full_name } };
        chat.innerHTML += _messageBubble(fakeMsg);
        chat.scrollTop = chat.scrollHeight;
    }
};

// ─── Status-Änderung ──────────────────────────────────────────
window.updateTicketStatus = async (ticketId, newStatus) => {
    const snoozeWrap = document.getElementById('snooze-wrap');
    if (snoozeWrap) snoozeWrap.classList.toggle('hidden', newStatus !== 'Wiedervorlage');

    const payload = { status: newStatus };
    if (newStatus !== 'Wiedervorlage') payload.snooze_until = null;

    const { error } = await _supabase.from('tickets').update(payload).eq('id', ticketId);
    if (error) showToast(error.message, 'error');
    else { showToast('Status aktualisiert.', 'success'); refreshNavBadges?.(); }
};

window.saveSnoozeDate = async (ticketId, date) => {
    await _supabase.from('tickets').update({ snooze_until: date ? new Date(date).toISOString() : null }).eq('id', ticketId);
};

// ─── Zuweisung ────────────────────────────────────────────────
window.assignTicket = async (ticketId, userId) => {
    await _supabase.from('tickets').update({ assigned_to: userId || null }).eq('id', ticketId);
    showToast('Zuweisung gespeichert.', 'success');
};

// ─── Eskalation (owner → Verwalter) ──────────────────────────
window.escalateTicket = async (ticketId) => {
    // Manager für das Gebäude finden
    const ticketData = await _supabase.from('tickets').select('building_id, creator:profiles!tickets_creator_id_fkey(full_name)').eq('id', ticketId).single();
    const bId = ticketData.data?.building_id;
    let managerId = null;
    if (bId) {
        const { data: mgmt } = await _supabase.from('management_assignments').select('manager_id').eq('building_id', bId).limit(1).single();
        managerId = mgmt?.manager_id || null;
    }
    const senderName = userProfile?.full_name || 'Eigentümer';
    const sysMsg = `${senderName} hat dieses Ticket an den Verwalter weitergeleitet.`;

    await Promise.all([
        _supabase.from('tickets').update({ assigned_to: managerId, status: 'Offen' }).eq('id', ticketId),
        _supabase.from('ticket_messages').insert([{ ticket_id: ticketId, sender_id: currentUser.id, message: sysMsg, is_system_message: true }]),
    ]);
    showToast('Ticket weitergeleitet.', 'success');
    await openTicketDetail(ticketId);
};

// ─── Ticket erstellen ─────────────────────────────────────────
window.showCreateTicketModal = async () => {
    const { data: buildings } = await _supabase.from('buildings').select('id, name').order('name');
    const bList = buildings || [];

    document.getElementById('create-ticket-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'create-ticket-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-lg p-8 space-y-5" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-extrabold text-hb-offblack">Neues Ticket</h3>
                <button onclick="document.getElementById('create-ticket-modal').remove()" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Betreff *</label>
                <input type="text" id="tkt_title" placeholder="Kurze Beschreibung des Problems">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Kategorie</label>
                    <select id="tkt_cat">
                        <option>Sonstiges</option>
                        <option>Heizung</option>
                        <option>Wasser</option>
                        <option>Elektro</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude</label>
                    <select id="tkt_building" onchange="loadApartmentsForTicket(this.value)">
                        <option value="">— Bitte wählen —</option>
                        ${bList.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Einheit (optional)</label>
                <select id="tkt_apt"><option value="">— Erst Gebäude wählen —</option></select>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Beschreibung *</label>
                <textarea id="tkt_desc" rows="4" placeholder="Beschreibe das Problem so genau wie möglich…"></textarea>
            </div>
            <!-- Anhang Platzhalter -->
            <div class="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400">
                <svg class="w-6 h-6 mx-auto mb-1 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                Dateianhang (folgt in nächster Version)
            </div>
            <button onclick="saveTicket()" class="btn-primary w-full">Ticket erstellen</button>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);

    // Vorausfüllen wenn Profil apartment_id hat
    if (userProfile?.apartment_id) {
        const { data: apt } = await _supabase.from('apartments').select('id, building_id, apartment_number').eq('id', userProfile.apartment_id).single();
        if (apt) {
            const bSel = document.getElementById('tkt_building');
            if (bSel) bSel.value = apt.building_id;
            await loadApartmentsForTicket(apt.building_id, apt.id);
        }
    }
};

window.loadApartmentsForTicket = async (bId, preselect = null) => {
    const sel = document.getElementById('tkt_apt');
    if (!sel || !bId) return;
    const { data } = await _supabase.from('apartments').select('id, apartment_number').eq('building_id', bId).order('apartment_number');
    sel.innerHTML = '<option value="">— Keine Einheit —</option>'
        + (data || []).map(a => `<option value="${a.id}" ${a.id === preselect ? 'selected' : ''}>Wohnung ${a.apartment_number}</option>`).join('');
};

window.saveTicket = async () => {
    const title = document.getElementById('tkt_title')?.value?.trim();
    const desc  = document.getElementById('tkt_desc')?.value?.trim();
    if (!title || !desc) { showToast('Betreff und Beschreibung sind Pflichtfelder.', 'error'); return; }

    const bId   = parseInt(document.getElementById('tkt_building')?.value) || null;
    const aptId = parseInt(document.getElementById('tkt_apt')?.value) || null;

    const { error } = await _supabase.from('tickets').insert([{
        title,
        description:  desc,
        category:     document.getElementById('tkt_cat')?.value || 'Sonstiges',
        status:       'Offen',
        building_id:  bId,
        apartment_id: aptId,
        creator_id:   currentUser.id,
        tenant_id:    currentUser.id,
    }]);
    if (error) { showToast(error.message, 'error'); return; }
    document.getElementById('create-ticket-modal')?.remove();
    showToast('Ticket erstellt.', 'success');
    refreshNavBadges?.();
    await _loadTicketView(_ticketFilter);
};

// ─── Deep-Links ───────────────────────────────────────────────
window.navigateToBuilding = async (buildingId) => {
    document.querySelector('[onclick*="loadTenants"]')?.click();
    await loadTenants();
    if (buildingId) selectBuilding(buildingId);
};

window.navigateToApartment = async (buildingId, apartmentId) => {
    await navigateToBuilding(buildingId);
    // Nach dem Laden der Einheitenliste die Info-Ansicht öffnen
    setTimeout(() => { if (apartmentId) showApartmentInfo(apartmentId); }, 300);
};

window.navigateToPersonByProfile = async (profileId) => {
    if (!profileId) return;
    const { data } = await _supabase.from('persons').select('id').eq('auth_user_id', profileId).single();
    if (data?.id) showPersonForm(data.id);
    else showToast('Kein CRM-Profil verknüpft.', 'error');
};
