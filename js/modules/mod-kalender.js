// ============================================================
// HB-Mieterportal | mod-kalender.js
// Monatskalender — Gebäude-Fristen & Ticket-Wiedervorlagen
// ============================================================

const DEADLINE_TYPES_KAL = [
    { key: 'energy_certificate_expiry',   label: 'Energieausweis' },
    { key: 'next_fire_safety_check',      label: 'Brandschutz' },
    { key: 'drinking_water_analysis_due', label: 'Trinkwasser' },
];

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

let _kalState = {
    year:     new Date().getFullYear(),
    month:    new Date().getMonth(),  // 0-based
    events:   {},                     // { 'YYYY-MM-DD': [{...}] }
    eventMap: {},                     // { 'key': eventObj } für onclick-Lookup
};

// ─── Entry Point ──────────────────────────────────────────────

async function loadCalendar() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `
        <div class="flex justify-between items-end mb-6">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-olive tracking-tight">Kalender</h2>
                <p class="text-sm text-gray-500 mt-1">Gebäude-Fristen und Ticket-Wiedervorlagen im Überblick.</p>
            </div>
            <button onclick="_kalJumpToday()" class="text-xs text-hb-olive font-semibold bg-hb-ultralight border border-hb-olive/20 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Heute
            </button>
        </div>
        <div id="kal-container" class="card p-5">
            <div class="flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
        <!-- Legende -->
        <div class="flex flex-wrap gap-4 mt-4 px-1">
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span class="inline-block w-3 h-3 rounded bg-red-200"></span> Überfällig / &lt; 14 Tage
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span class="inline-block w-3 h-3 rounded bg-hb-orange/30"></span> 14–30 Tage
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span class="inline-block w-3 h-3 rounded bg-green-200"></span> &gt; 30 Tage
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span class="inline-block w-3 h-3 rounded bg-hb-olive/20"></span> Ticket Wiedervorlage
            </div>
        </div>`;

    await _kalLoadData();
    _kalRender();
}

// ─── Daten laden ──────────────────────────────────────────────

async function _kalLoadData() {
    const uid = currentUser.id;

    const [buildingsRes, ticketsRes] = await Promise.all([
        _supabase.from('buildings').select(
            'id, name, file_number, street, house_number, energy_certificate_expiry, next_fire_safety_check, drinking_water_analysis_due, last_legionella_check, legionella_check_interval_months'
        ),
        _supabase.from('tickets')
            .select('id, title, snooze_until')
            .eq('status', 'Wiedervorlage')
            .not('snooze_until', 'is', null)
            .or(`creator_id.eq.${uid},assigned_to.eq.${uid}`),
    ]);

    const events = {};

    const addEvent = (dateStr, event) => {
        if (!events[dateStr]) events[dateStr] = [];
        events[dateStr].push(event);
    };

    // ── Gebäude-Fristen ──
    for (const b of (buildingsRes.data || [])) {
        for (const dt of DEADLINE_TYPES_KAL) {
            if (!b[dt.key]) continue;
            const dateStr = b[dt.key].split('T')[0];
            const days    = _kalDaysFromToday(b[dt.key]);
            addEvent(dateStr, {
                type:       'deadline',
                label:      dt.label,
                building:   formatBuildingName(b),
                buildingId: b.id,
                date:       b[dt.key].split('T')[0],
                days,
                color: days < 14 ? 'red' : days <= 30 ? 'orange' : 'green',
            });
        }
        // Legionella berechnen
        if (b.last_legionella_check && b.legionella_check_interval_months) {
            const due = new Date(b.last_legionella_check);
            due.setMonth(due.getMonth() + Number(b.legionella_check_interval_months));
            const dateStr = due.toISOString().split('T')[0];
            const days    = _kalDaysFromToday(due.toISOString());
            addEvent(dateStr, {
                type:       'deadline',
                label:      'Legionellenprüfung',
                building:   formatBuildingName(b),
                buildingId: b.id,
                date:       dateStr,
                days,
                color: days < 14 ? 'red' : days <= 30 ? 'orange' : 'green',
            });
        }
    }

    // ── Ticket-Wiedervorlagen ──
    for (const t of (ticketsRes.data || [])) {
        const dateStr = t.snooze_until.split('T')[0];
        addEvent(dateStr, {
            type:     'ticket',
            label:    t.title,
            color:    'olive',
            ticketId: t.id,
        });
    }

    _kalState.events   = events;
    _kalState.eventMap = {};
}

function _kalDaysFromToday(dateStr) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ─── Rendern ──────────────────────────────────────────────────

function _kalRender() {
    const container = document.getElementById('kal-container');
    if (!container) return;

    const { year, month, events } = _kalState;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
    const todayStr = new Date().toISOString().split('T')[0];

    // ── Tages-Zellen ──
    let cells = '';

    // Leere Zellen vor dem 1.
    for (let i = 0; i < firstDayOffset; i++) {
        cells += `<div class="min-h-[90px] bg-gray-50/30"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayEvts = events[dateStr] || [];

        const pills = dayEvts.map((e, idx) => {
            const colorCls = {
                red:    'bg-red-100 text-red-700',
                orange: 'bg-hb-orange/15 text-hb-orange',
                green:  'bg-green-100 text-green-700',
                olive:  'bg-hb-olive/10 text-hb-olive',
            }[e.color] || 'bg-gray-100 text-gray-600';

            const isTicket  = e.type === 'ticket';
            const sizeClass = isTicket ? 'text-[9px]' : 'text-[10px] font-semibold';

            // Event in Map ablegen — kein JSON im onclick-Attribut nötig
            const eventKey = `${dateStr}-${idx}`;
            _kalState.eventMap[eventKey] = e;

            const prefix    = e.building ? `${e.building.length > 12 ? e.building.slice(0, 12) + '…' : e.building} · ` : '';
            const fullTitle = e.building ? `${e.building}: ${e.label}` : e.label;
            const onclick   = isTicket
                ? `_kalOpenTicket('${e.ticketId}')`
                : `_kalShowPopup(event,'${eventKey}')`;

            return `<div onclick="${onclick}" title="${fullTitle}"
                class="${sizeClass} ${colorCls} px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-75 transition-opacity block">
                ${prefix}${e.label}
            </div>`;
        }).join('');

        cells += `
            <div class="min-h-[90px] p-1.5 border border-gray-100 transition-colors ${isToday ? 'bg-hb-olive/5 ring-2 ring-inset ring-hb-olive/25' : 'hover:bg-gray-50/60'}">
                <div class="text-xs font-bold text-right mb-1 ${isToday ? 'text-hb-olive' : 'text-gray-400'}">${day}</div>
                <div class="space-y-0.5">${pills}</div>
            </div>`;
    }

    container.innerHTML = `
        <!-- Monats-Navigation -->
        <div class="flex items-center justify-between mb-4">
            <button onclick="_kalPrev()" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h3 class="text-lg font-extrabold text-hb-offblack">${MONTHS_DE[month]} ${year}</h3>
            <button onclick="_kalNext()" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
        </div>

        <!-- Wochentag-Header -->
        <div class="grid grid-cols-7 mb-px">
            ${['Mo','Di','Mi','Do','Fr','Sa','So'].map(d =>
                `<div class="py-2 text-center text-xs font-bold text-gray-400">${d}</div>`
            ).join('')}
        </div>

        <!-- Tages-Grid -->
        <div class="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
            ${cells}
        </div>`;
}

// ─── Navigation ───────────────────────────────────────────────

window._kalPrev = () => {
    if (_kalState.month === 0) { _kalState.month = 11; _kalState.year--; }
    else _kalState.month--;
    _kalRender();
};

window._kalNext = () => {
    if (_kalState.month === 11) { _kalState.month = 0; _kalState.year++; }
    else _kalState.month++;
    _kalRender();
};

window._kalJumpToday = () => {
    _kalState.year  = new Date().getFullYear();
    _kalState.month = new Date().getMonth();
    _kalRender();
};

// ─── Events ───────────────────────────────────────────────────

window._kalOpenTicket = async (ticketId) => {
    const navEl = Array.from(document.querySelectorAll('#nav-links a')).find(a => a.textContent.includes('Ticket'));
    if (navEl) setActiveNav(navEl);
    await loadTickets();
    openTicketDetail(ticketId);
};

// ─── Deadline-Popup ───────────────────────────────────────────

window._kalShowPopup = (event, eventKey) => {
    const e = _kalState.eventMap[eventKey];
    if (!e) return;
    event.stopPropagation();
    document.getElementById('kal-popup')?.remove();

    const days     = e.days;
    const daysText = days < 0
        ? `<span class="text-red-600 font-bold">${Math.abs(days)} Tage überfällig</span>`
        : days === 0
            ? `<span class="text-red-600 font-bold">Heute fällig</span>`
            : `<span class="${days < 14 ? 'text-red-600' : days <= 30 ? 'text-hb-orange' : 'text-green-600'} font-bold">in ${days} Tagen</span>`;

    const dateFormatted = new Date(e.date + 'T12:00:00').toLocaleDateString('de-DE', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    const popup = document.createElement('div');
    popup.id = 'kal-popup';
    popup.className = 'fixed z-50 bg-white rounded-[15px] shadow-2xl border border-hb-olive/20 p-5 w-72 text-left';
    popup.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div class="text-xs font-black uppercase tracking-widest text-hb-orange">${e.label}</div>
            <button onclick="document.getElementById('kal-popup')?.remove()"
                class="text-gray-400 hover:text-gray-600 transition-colors -mt-0.5 ml-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <div class="font-extrabold text-hb-offblack text-base mb-1">${e.building}</div>
        <div class="text-sm text-gray-500 mb-3">${dateFormatted}</div>
        <div class="text-sm mb-4">${daysText}</div>
        <button onclick="_kalGoBuilding(${e.buildingId})"
            class="w-full btn-primary text-sm flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></svg>
            Zum Gebäude
        </button>`;

    // Popup neben dem geklickten Element positionieren
    document.body.appendChild(popup);
    const rect = event.currentTarget.getBoundingClientRect();
    const popW = 288; // w-72
    let left = rect.right + 8;
    let top  = rect.top + window.scrollY;
    if (left + popW > window.innerWidth) left = rect.left - popW - 8;
    if (top + 200 > window.innerHeight + window.scrollY) top = Math.max(8, rect.bottom + window.scrollY - 200);
    popup.style.left = `${Math.max(8, left)}px`;
    popup.style.top  = `${top}px`;

    // Schließen bei Klick außerhalb
    setTimeout(() => document.addEventListener('click', _kalClosePopup, { once: true }), 0);
};

function _kalClosePopup(e) {
    if (!document.getElementById('kal-popup')?.contains(e.target)) {
        document.getElementById('kal-popup')?.remove();
    }
}

window._kalGoBuilding = async (buildingId) => {
    document.getElementById('kal-popup')?.remove();
    const navEl = Array.from(document.querySelectorAll('#nav-links a')).find(a => a.textContent.includes('Gebäude'));
    if (navEl) setActiveNav(navEl);
    await loadTenants();
    if (buildingId) selectBuilding(buildingId);
};
