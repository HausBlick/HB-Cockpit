/**
 * HB-Mieterportal: mod-etv.js
 * Tool zur Begleitung von Eigentümerversammlungen (Vorbereitung, Durchführung, Protokoll)
 */

// Natürliche Sortierung für hierarchische TOP-Nummern (1, 1.1, 1.2, 2, 2.1, 10, ...)
function _etvSortOrder(a, b) {
    const pa = String(a.sort_order).split('.').map(Number);
    const pb = String(b.sort_order).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const va = pa[i] ?? -1;
        const vb = pb[i] ?? -1;
        if (va !== vb) return va - vb;
    }
    return 0;
}

const _etvState = {
    buildingId: null,
    buildings: [],
    sessionId: null,
    session: null,
    agenda: [],
    attendance: [],
    apartments: [],
    owners: [],
    agendaDocs: [],
    votes: [],          // Abstimmungsergebnisse (wird beim Wechsel zu Nachbereitung geladen)
    _votesLoaded: false,
    selectedTopId: null, // aktiver TOP im rechten Detail-Panel der Durchführung
    sidebarCollapsed: true, // Quorum/Anwesenheits-Sidebar in der Durchführung
    activeTab: 'prep', // prep (Vorbereitung), exec (Durchführung), follow (Nachbereitung)
    votingDraft: {},   // { [aptId]: 'yes'|'no'|'abstain' } für Einzelstimmen-Modal
    votingTopId: null  // aktiver TOP im Einzelstimmen-Modal
};

/**
 * Haupt-Einstiegspunkt: Lädt die ETV-Übersicht (Two-Panel-Layout)
 */
async function loadETV() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const { data: buildings } = await _supabase.from('buildings').select('id, name, file_number, street, house_number, city').order('name');
    _etvState.buildings = buildings || [];
    if (_etvState.buildings.length === 0) {
        ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10"><p class="text-[15px] text-gray-500">Keine Gebäude gefunden.</p></div>`;
        return;
    }
    if (!_etvState.buildingId || !_etvState.buildings.find(b => b.id === _etvState.buildingId)) {
        const urlBuilding = new URLSearchParams(window.location.search).get('building');
        const sessionBuilding = sessionStorage.getItem('hb_active_building');
        const targetId = urlBuilding || sessionBuilding;
        if (targetId && _etvState.buildings.find(b => b.id == targetId)) {
            _etvState.buildingId = Number(targetId);
        } else {
            _etvState.buildingId = _etvState.buildings[0].id;
        }
    }

    ca.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] text-left">
            <!-- Linke Sidebar: Gebäude-Liste -->
            <div class="w-full lg:w-56 xl:w-64 flex-shrink-0 flex flex-col gap-3 h-full">
                <div class="card flex flex-col h-full overflow-hidden">
                    <div class="px-4 py-3 bg-hb-olive">
                        <h2 class="text-sm font-bold text-white">Objekte</h2>
                    </div>
                    <div id="etv-buildings-list" class="flex-grow overflow-y-auto p-2 space-y-0.5"></div>
                </div>
            </div>
            <!-- Rechter Bereich: Sessions -->
            <div class="flex-1 flex flex-col h-full min-w-0" id="etv-sessions-area">
                <div class="flex justify-center py-10"><div class="w-6 h-6 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        </div>
    `;

    _etvRenderBuildingList();
    await _etvSelectBuilding(_etvState.buildingId);
}

function _etvRenderBuildingList() {
    const list = document.getElementById('etv-buildings-list');
    if (!list) return;
    list.innerHTML = _etvState.buildings.map(b => `
        <div onclick="_etvSelectBuilding(${b.id})" id="etv-b-item-${b.id}"
            class="px-3 py-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-all text-left group">
            <p class="font-bold text-xs text-hb-offblack truncate group-hover:text-hb-olive">${formatBuildingName(b)}</p>
            <p class="text-[10px] text-gray-400 truncate">${b.street ? `${b.street} ${b.house_number || ''}` : (b.city || '')}</p>
        </div>`).join('') || '<p class="text-xs text-gray-400 p-3">Keine Gebäude.</p>';
    _etvMarkActiveBuilding(_etvState.buildingId);
}

function _etvMarkActiveBuilding(id) {
    document.querySelectorAll('[id^="etv-b-item-"]').forEach(el => el.classList.remove('bg-hb-ultralight', 'bg-gray-100'));
    const sel = document.getElementById(`etv-b-item-${id}`);
    if (sel) sel.classList.add('bg-hb-ultralight');
}

window._etvSelectBuilding = async (id) => {
    _etvState.buildingId = Number(id);
    sessionStorage.setItem('hb_active_building', String(id));
    _etvMarkActiveBuilding(_etvState.buildingId);

    const area = document.getElementById('etv-sessions-area');
    if (area) area.innerHTML = `<div class="flex justify-center py-10"><div class="w-6 h-6 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const bid = _etvState.buildingId;
    const { data: sessions, error } = await _supabase
        .from('etv_sessions')
        .select('*')
        .eq('building_id', bid)
        .order('meeting_date', { ascending: false });

    if (error) { showToast('Fehler beim Laden der ETVs: ' + error.message, 'error'); return; }

    const building = _etvState.buildings.find(b => b.id === bid);
    const buildingLabel = building ? formatBuildingName(building) : '';

    const sessionCards = sessions?.length ? sessions.map(s => {
        const date = new Date(s.meeting_date);
        const statusLabel = ETV_STATUS_LABELS?.[s.status] || s.status;
        return `
        <div class="bg-white rounded-2xl border border-hb-olive/12 overflow-hidden shadow-sm hover:shadow-lg transition-all group">
            <div class="${s.status === 'active' ? 'bg-hb-orange' : 'bg-hb-olive'} p-4 flex justify-between items-center">
                <span class="text-white font-black text-xs tracking-tighter uppercase opacity-80">${s.fiscal_year}</span>
                <span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold ${s.status === 'active' ? 'bg-white text-hb-orange animate-pulse' : 'bg-white/20 text-white'}">
                    ${s.status === 'active' ? '● LIVE' : statusLabel}
                </span>
            </div>
            <div class="p-6">
                <div class="text-2xl font-black text-hb-offblack mb-1">${date.toLocaleDateString('de-DE')}</div>
                <div class="text-xs text-gray-400 mb-6 flex items-center gap-2">
                    <span class="bg-hb-ultralight p-1.5 rounded-lg text-hb-olive">${icons.clock || ''}</span>
                    ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr • ${s.location || '—'}
                </div>
                <button onclick="_etvOpenSession('${s.id}')" class="w-full bg-hb-ultralight text-hb-olive py-3 rounded-xl text-sm font-black hover:bg-hb-olive hover:text-white transition-all">
                    Versammlung öffnen
                </button>
            </div>
        </div>`;
    }).join('') : `
        <div class="col-span-full py-20 bg-white rounded-2xl border-2 border-dashed border-hb-olive/12 flex flex-col items-center justify-center text-gray-400">
            <p class="font-bold">Keine Versammlungen gefunden.</p>
            <p class="text-[15px] mt-1">Starten Sie mit der Planung Ihrer ersten ETV.</p>
        </div>`;

    if (area) area.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 class="text-[28px] font-bold text-hb-offblack">Eigentümerversammlungen</h1>
                    <p class="text-xs text-gray-400 mt-0.5 font-bold uppercase tracking-widest">${buildingLabel}</p>
                </div>
                <button onclick="_etvNewSessionModal()" class="bg-hb-olive text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-all flex-shrink-0">
                    + Neue Versammlung planen
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-1 pb-10">
                ${sessionCards}
            </div>
        </div>`;
};

// Legacy-Alias für bestehende Aufrufe
window._etvOnBuildingChange = (val) => _etvSelectBuilding(val);

/**
 * Öffnet eine spezifische Versammlung und lädt alle Daten
 */
window._etvOpenSession = async (sessionId) => {
    _etvState.sessionId = sessionId;
    _etvState.selectedTopId = null;
    
    // Komplett-Check: Session, TOPs, Präsenz, Wohnungen & Eigentümer
    const [sRes, aRes, attRes, aptRes] = await Promise.all([
        _supabase.from('etv_sessions').select('*').eq('id', sessionId).single(),
        _supabase.from('etv_agenda_items').select('*').eq('session_id', sessionId),
        _supabase.from('etv_attendance').select('*, person:persons!etv_attendance_person_id_fkey(first_name, last_name)').eq('session_id', sessionId),
        _supabase.from('apartments').select('id, apartment_number, mea_numerator, mea_denominator').eq('building_id', _etvState.buildingId),
    ]);
    const aptIds = (aptRes.data || []).map(a => a.id);
    const ownRes = aptIds.length > 0
        ? await _supabase.from('ownerships').select('*, person:persons!ownerships_owner_id_fkey(id, first_name, last_name)').in('apartment_id', aptIds).eq('is_active', true)
        : { data: [] };

    _etvState.session = sRes.data;
    _etvState.agenda = (aRes.data || []).sort(_etvSortOrder);
    _etvState.attendance = attRes.data || [];
    _etvState.apartments = aptRes.data || [];
    _etvState.owners = ownRes.data || [];
    _etvState.votes = [];
    _etvState._votesLoaded = false;

    // TOP-Dokumente laden
    const agendaIds = _etvState.agenda.map(a => a.id);
    if (agendaIds.length) {
        const { data: docs } = await _supabase.from('etv_agenda_documents')
            .select('*, owner:persons(first_name, last_name)')
            .in('agenda_item_id', agendaIds);
        _etvState.agendaDocs = docs || [];
    } else {
        _etvState.agendaDocs = [];
    }

    // Präsenzliste mit aktuellen Eigentümern abgleichen (legt fehlende Einträge an)
    if (_etvState.owners.length > 0) {
        await _etvAutoInitAttendance();
    }

    _etvRenderMain();
};

/**
 * Initialisiert die Präsenzliste basierend auf den aktuellen Eigentümern
 */
/**
 * Gruppiert Attendance-Einträge nach Person.
 * Eigentümer mit mehreren WE erscheinen als ein Eintrag mit allen WEs.
 * Liefert: [{ person_id, person, attendances:[…], apartments:[…], totalMEA, allPresent, anyPresent }]
 */
function _etvGroupedAttendance() {
    const groups = new Map();
    for (const a of _etvState.attendance) {
        if (!a.person_id) continue;
        if (!groups.has(a.person_id)) {
            groups.set(a.person_id, {
                person_id: a.person_id,
                person: a.person,
                attendances: [],
                apartments: []
            });
        }
        const g = groups.get(a.person_id);
        g.attendances.push(a);
        const apt = _etvState.apartments.find(apt => apt.id === a.apartment_id);
        if (apt) g.apartments.push(apt);
    }
    for (const g of groups.values()) {
        g.totalMEA = g.apartments.reduce((s, apt) => s + (apt.mea_numerator || 0), 0);
        g.allPresent = g.attendances.length > 0 && g.attendances.every(a => a.is_present);
        g.anyPresent = g.attendances.some(a => a.is_present);
        g.proxyName = g.attendances.find(a => a.proxy_name)?.proxy_name || null;
    }
    return Array.from(groups.values());
}

async function _etvAutoInitAttendance() {
    const validOwners = _etvState.owners.filter(own => own.person && own.person.id);
    const existingApartmentIds = new Set(_etvState.attendance.map(a => a.apartment_id));
    const missing = validOwners.filter(o => !existingApartmentIds.has(o.apartment_id));
    if (missing.length === 0) return;

    const inserts = missing.map(own => ({
        session_id: _etvState.sessionId,
        person_id: own.person.id,
        apartment_id: own.apartment_id,
        is_present: false
    }));

    const { data, error } = await _supabase
        .from('etv_attendance')
        .insert(inserts)
        .select('*, person:persons!etv_attendance_person_id_fkey(first_name, last_name)');

    if (error) {
        showToast('Präsenzliste konnte nicht aktualisiert werden: ' + error.message, 'error');
        return;
    }
    _etvState.attendance = [..._etvState.attendance, ...data];
}

/**
 * Render-Loop für das Session-Interface
 */
function _etvRenderMain() {
    const s = _etvState.session;
    let html = `
        <div class="h-full flex flex-col">
            <!-- Navigation Header -->
            <div class="bg-white border-b border-hb-olive/10 p-4 px-8 flex justify-between items-center shadow-sm">
                <div class="flex items-center gap-6">
                    <button onclick="loadETV()" class="bg-hb-ultralight text-hb-olive hover:bg-hb-olive hover:text-white p-2.5 rounded-xl transition-all shadow-sm">
                        ${icons.back || '←'}
                    </button>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="bg-hb-olive text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter italic">ETV ${s.fiscal_year}</span>
                            <span class="text-hb-offblack font-black text-xl">${new Date(s.meeting_date).toLocaleDateString('de-DE')}</span>
                        </div>
                        <div class="text-xs text-gray-400 mt-0.5 font-bold flex items-center gap-2">
                            ${icons.location || ''} ${s.location}
                        </div>
                    </div>
                </div>
                
                <div class="flex bg-hb-ultralight p-1.5 rounded-2xl border border-hb-olive/10 shadow-inner">
                    <button onclick="_etvSetTab('prep')" class="px-8 py-2.5 rounded-xl text-sm font-black transition-all ${_etvState.activeTab === 'prep' ? 'bg-white text-hb-olive shadow-sm' : 'text-gray-400 hover:text-hb-olive'}">1. Vorbereitung</button>
                    <button onclick="_etvSetTab('exec')" class="px-8 py-2.5 rounded-xl text-sm font-black transition-all ${_etvState.activeTab === 'exec' ? 'bg-hb-olive text-white shadow-md scale-105' : 'text-gray-400 hover:text-hb-olive'}">2. Durchführung</button>
                    <button onclick="_etvSetTab('follow')" class="px-8 py-2.5 rounded-xl text-sm font-black transition-all ${_etvState.activeTab === 'follow' ? 'bg-white text-hb-olive shadow-sm' : 'text-gray-400 hover:text-hb-olive'}">3. Nachbereitung</button>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest">Status</div>
                        <div class="text-xs font-bold text-hb-offblack">${s.status.toUpperCase()}</div>
                    </div>
                    <div class="h-10 w-1 bg-hb-olive/10 rounded-full mx-2"></div>
                    <button onclick="_etvEditSessionSettings()" class="bg-hb-ultralight p-3 rounded-xl text-hb-olive hover:bg-gray-100 transition-colors">
                        ${icons.settings || '⚙'}
                    </button>
                </div>
            </div>

            <!-- Content Area -->
            <div id="etv-content" class="flex-grow overflow-y-auto bg-hb-ultralight/30 p-8">
                ${_etvRenderTabContent()}
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
}

function _etvRenderTabContent() {
    if (_etvState.activeTab === 'prep') return _etvRenderPrep();
    if (_etvState.activeTab === 'exec') return _etvRenderExec();
    if (_etvState.activeTab === 'follow') return _etvRenderFollow();
}

/**
 * PHASE 1: Vorbereitung (Tagesordnung & Einladung)
 */
function _etvRenderPrep() {
    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <!-- Tagesordnung -->
            <div class="lg:col-span-2">
                <div class="bg-white rounded-2xl border border-hb-olive/12 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                    <div class="bg-hb-olive p-5 flex justify-between items-center">
                        <div>
                            <h3 class="text-white font-black text-lg tracking-tight">Tagesordnungspunkte (TOPs)</h3>
                            <p class="text-[10px] text-white/60 font-bold uppercase tracking-widest">Strukturierung der Versammlung</p>
                        </div>
                        <button onclick="_etvAddTOPModal()" class="bg-white text-hb-olive px-4 py-2 rounded-xl text-xs font-black hover:scale-105 transition-transform shadow-md">
                            + TOP hinzufügen
                        </button>
                    </div>
                    <div class="p-0 divide-y divide-hb-olive/10 flex-grow">
                        ${_etvState.agenda.length ? _etvState.agenda.map(top => {
                            const topDocs = _etvState.agendaDocs.filter(d => d.agenda_item_id === top.id);
                            const bldDocs = topDocs.filter(d => d.scope === 'building');
                            const ownDocs = topDocs.filter(d => d.scope === 'owner');
                            return `
                            <div class="p-6 hover:bg-hb-ultralight/20 transition-all group">
                                <div class="flex gap-6">
                                    <div class="bg-hb-ultralight text-hb-olive h-12 w-12 min-w-[48px] rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">${top.sort_order}</div>
                                    <div class="flex-grow">
                                        <div class="flex items-center gap-3">
                                            <h4 class="font-black text-hb-offblack text-lg">${top.title}</h4>
                                            <span class="px-2 py-0.5 bg-gray-100 text-[9px] font-black text-gray-500 rounded-md border border-gray-200 uppercase tracking-tighter italic">
                                                ${top.voting_type === 'none' ? 'Kein Beschluss' : top.voting_type + ' • ' + top.majority_type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p class="text-xs text-gray-400 mt-1 line-clamp-1 italic">${top.proposed_resolution || 'Kein Beschlussantrag hinterlegt.'}</p>
                                    </div>
                                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onclick="_etvTopDocsModal('${top.id}')" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100" title="Dokumente verwalten">${icons.document || '📎'} ${topDocs.length || ''}</button>
                                        <button onclick="_etvEditTOP('${top.id}')" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">Bearbeiten</button>
                                        <button onclick="_etvDeleteTOP('${top.id}')" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5">Löschen</button>
                                    </div>
                                </div>
                                ${topDocs.length ? `
                                <div class="ml-[72px] mt-3 flex flex-wrap gap-2">
                                    ${bldDocs.map(d => `
                                        <span class="inline-flex items-center gap-1.5 bg-hb-ultralight text-hb-olive text-[10px] font-bold px-2.5 py-1 rounded-lg border border-hb-olive/10">
                                            📄 ${d.file_name} <span class="text-gray-400">(alle)</span>
                                        </span>
                                    `).join('')}
                                    ${ownDocs.length ? `
                                        <span class="inline-flex items-center gap-1.5 bg-hb-orange/5 text-hb-orange text-[10px] font-bold px-2.5 py-1 rounded-lg border border-hb-orange/10">
                                            📄 ${ownDocs.length} eigentümerspezifisch
                                        </span>
                                    ` : ''}
                                </div>` : ''}
                            </div>`;
                        }).join('') : `
                            <div class="flex flex-col items-center justify-center p-20 text-gray-400">
                                ${icons.list || ''}
                                <p class="mt-4 font-bold italic">Noch keine TOPs definiert.</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <!-- Dokumente & Vorbereitung -->
            <div class="space-y-6">
                <div class="bg-white p-8 rounded-2xl border border-hb-olive/12 shadow-sm">
                    <h4 class="font-black text-hb-offblack mb-6 flex items-center gap-3">
                        <span class="bg-hb-olive text-white p-2 rounded-xl scale-75">${icons.document || ''}</span>
                        Einladung & Unterlagen
                    </h4>
                    <div class="space-y-4">
                        <button onclick="_etvPreviewEinladung()" class="w-full bg-hb-olive text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 shadow-lg hover:translate-y-[-2px] transition-all">
                            Einladungs-PDF generieren
                        </button>
                        <button onclick="_etvDraftEinladung()" class="w-full bg-hb-ultralight text-hb-olive py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 border border-hb-olive/10 hover:bg-hb-olive/10 transition-all">
                            Entwurf herunterladen
                        </button>
                        <button onclick="_etvOpenStaging()" class="w-full bg-hb-ultralight text-hb-olive py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 border border-hb-olive/10 hover:bg-hb-olive/10 transition-all">
                            Dokumente in Staging (TOPs)
                        </button>
                    </div>
                    <div class="mt-8 p-4 bg-hb-ultralight/50 rounded-2xl border border-hb-olive/5">
                        <div class="text-[10px] font-black text-hb-olive uppercase mb-2 tracking-widest">Hinweis</div>
                        <p class="text-xs text-gray-400 leading-relaxed italic">Pro Eigentümer wird ein PDF erstellt: Anschreiben + Tagesordnung + Vollmacht + Anlagen. Download als ZIP. Anschreiben-Text im Dokumenten-Designer editierbar (Einstellungen → Dokumenten-Designer → ETV-Einladung).</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * PHASE 2: Durchführung (Check-in & Live-Voten)
 */
function _etvRenderExec() {
    const s = _etvState.session;
    // Live-Quorum Berechnung
    const totalMEA = _etvState.apartments.reduce((sum, a) => sum + (a.mea_numerator || 0), 0);
    const presentUnits = _etvState.attendance.filter(a => a.is_present);
    const presentMEA = presentUnits.reduce((sum, u) => {
        const apt = _etvState.apartments.find(a => a.id === u.apartment_id);
        return sum + (apt?.mea_numerator || 0);
    }, 0);
    const percent = totalMEA > 0 ? (presentMEA / totalMEA * 100).toFixed(2) : 0;
    const quorumThreshold = _etvState.session?.quorum_percent ?? 50;
    const isQuorum = percent >= quorumThreshold;
    const totalUnits  = _etvState.apartments.length;
    const presentCount = presentUnits.length;
    const topNeedsWarning = (t) => {
        if (t.voting_type === 'none') return false;
        if (t.majority_type === 'unanimous') return presentCount < totalUnits;
        if (t.majority_type === 'double_qualified') return totalMEA > 0 && presentMEA * 2 <= totalMEA;
        return false;
    };

    // Personen-gruppierte Sicht (ein Eigentümer = ein Eintrag, auch bei mehreren WE)
    const groups = _etvGroupedAttendance();
    const presentGroups = groups.filter(g => g.anyPresent);

    const resultLabel = (status) => {
        if (status === 'approved')  return { text: 'Angenommen',  cls: 'bg-hb-success/12 text-hb-success border-hb-success/20' };
        if (status === 'rejected')  return { text: 'Abgelehnt',   cls: 'bg-hb-orange/10 text-hb-orange border-hb-orange/20' };
        if (status === 'abstained') return { text: 'Enthaltung',  cls: 'bg-gray-100 text-gray-500 border-gray-300' };
        if (status === 'postponed') return { text: 'Vertagt',     cls: 'bg-gray-100 text-gray-500 border-gray-200' };
        return { text: 'Offen', cls: 'bg-gray-100 text-gray-400 border-gray-200' };
    };

    // Default-TOP-Auswahl beim ersten Render bzw. wenn die Selektion ungültig wurde
    if (_etvState.agenda.length > 0) {
        const stillExists = _etvState.selectedTopId && _etvState.agenda.find(t => t.id === _etvState.selectedTopId);
        if (!stillExists) _etvState.selectedTopId = _etvState.agenda[0].id;
    } else {
        _etvState.selectedTopId = null;
    }
    const selectedTop = _etvState.agenda.find(t => t.id === _etvState.selectedTopId);

    const sidebarOpen = !_etvState.sidebarCollapsed;
    const middleSpan = sidebarOpen ? 'xl:col-span-4' : 'xl:col-span-5';
    const detailSpan = sidebarOpen ? 'xl:col-span-5' : 'xl:col-span-7';

    const hasProtoData = !!(s?.chairman_name || s?.actual_start_time);
    const protoBits = hasProtoData ? [
        s.actual_start_time ? `<span class="text-xs font-bold text-hb-offblack">Beginn: ${s.actual_start_time}</span>` : '',
        s.actual_end_time   ? `<span class="text-xs font-bold text-hb-offblack">Ende: ${s.actual_end_time}</span>` : '',
        s.chairman_name     ? `<span class="text-xs font-bold text-hb-offblack">VL: ${s.chairman_name}</span>` : '',
        s.secretary_name    ? `<span class="text-xs font-bold text-hb-offblack">Prot.: ${s.secretary_name}</span>` : '',
    ].filter(Boolean).join('') : '<span class="text-xs text-gray-400 italic">Protokoll-Formalia noch nicht erfasst</span>';
    return `
        <div class="flex flex-col h-full gap-3">
        <div class="flex-shrink-0 bg-white rounded-2xl border border-hb-olive/12 shadow-sm px-5 py-3 flex items-center gap-4">
            <div class="bg-hb-olive/10 p-2 rounded-xl text-hb-olive">📋</div>
            <div class="flex-grow flex flex-wrap items-center gap-x-5 gap-y-1">${protoBits}</div>
            <div class="flex items-center gap-2 shrink-0">
                <button onclick="_etvProtocolModal()" class="text-xs font-black text-hb-olive bg-hb-ultralight hover:bg-hb-olive hover:text-white px-4 py-2 rounded-xl transition-all border border-hb-olive/10">${hasProtoData ? 'Bearbeiten' : 'Formalia erfassen'}</button>
                <button onclick="_etvCloseSession()" class="text-xs font-black text-hb-orange bg-hb-orange/10 hover:bg-hb-orange hover:text-white px-4 py-2 rounded-xl transition-all border border-hb-orange/20">Versammlung beenden</button>
            </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0 flex-grow overflow-hidden">
            ${sidebarOpen ? `
            <!-- Sidebar: Quorum & Check-in (eingeklappt-Default, hier ausgeklappt) -->
            <div class="xl:col-span-3 space-y-4 flex flex-col overflow-y-auto min-w-0">
                <div class="bg-white p-5 rounded-2xl border border-hb-olive/12 shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-black text-hb-offblack uppercase text-[10px] tracking-widest">Live-Quorum</h4>
                        <button onclick="_etvToggleSidebar()" title="Einklappen" class="text-gray-400 hover:text-hb-olive p-1 rounded-lg hover:bg-hb-ultralight transition-all">
                            ‹
                        </button>
                    </div>

                    <div class="relative pt-1">
                        <div class="flex mb-2 items-center justify-between gap-2">
                            <span class="text-[9px] font-black inline-block py-1 px-2 uppercase rounded-full ${isQuorum ? 'text-hb-success bg-hb-success/12' : 'text-hb-orange bg-hb-orange/10'}">
                                ${isQuorum ? 'Beschlussfähig' : 'Prüfung'}
                            </span>
                            <span class="text-lg font-black ${isQuorum ? 'text-hb-olive' : 'text-hb-orange'}">
                                ${percent}%
                            </span>
                        </div>
                        <div class="overflow-hidden h-2 mb-2 rounded-full bg-hb-ultralight shadow-inner">
                            <div style="width:${percent}%" class="${isQuorum ? 'bg-hb-olive' : 'bg-hb-orange'} h-full transition-all duration-1000"></div>
                        </div>
                        <div class="text-[9px] font-bold text-gray-400 leading-tight italic">
                            ${presentMEA.toLocaleString('de-DE')} / ${totalMEA.toLocaleString('de-DE')} MEA
                        </div>
                    </div>

                    <button onclick="_etvOpenCheckinModal()" class="w-full mt-5 bg-hb-olive text-white py-3 rounded-xl font-black text-sm shadow hover:scale-105 transition-all flex items-center justify-center gap-2">
                        ${icons.user || ''} Check-in
                    </button>
                </div>

                <!-- Präsenzliste Kurzform (gruppiert nach Person) -->
                <div class="bg-white rounded-2xl border border-hb-olive/12 shadow-sm flex-grow overflow-hidden flex flex-col">
                    <div class="p-4 border-b border-hb-olive/10 bg-hb-ultralight/20">
                        <h5 class="text-[10px] font-black text-hb-olive uppercase tracking-widest">Anwesend (${presentGroups.length} · ${presentUnits.length} WE)</h5>
                    </div>
                    <div class="p-1.5 overflow-y-auto flex-grow divide-y divide-hb-olive/5">
                        ${presentGroups.length === 0 ? `
                            <div class="p-4 text-center text-[11px] text-gray-400 italic">Noch niemand eingecheckt</div>
                        ` : presentGroups.map(g => {
                            const personName = g.person ? `${g.person.first_name} ${g.person.last_name}` : 'Unbekannt';
                            const weList = g.apartments.map(a => `WE ${a.apartment_number}`).join(', ');
                            return `
                            <div class="p-2.5 flex items-center justify-between group">
                                <div class="flex flex-col min-w-0">
                                    <span class="text-xs font-black text-hb-offblack truncate">${personName}</span>
                                    <span class="text-[10px] text-gray-400 font-bold tracking-tighter truncate">${weList}${g.apartments.length > 1 ? ` · ${g.totalMEA} MEA` : ''}</span>
                                </div>
                                <button onclick="_etvTogglePersonPresent('${g.person_id}', false)" class="text-hb-orange opacity-0 group-hover:opacity-100 p-1.5 hover:bg-hb-orange/5 rounded-lg transition-all shrink-0">
                                    ${icons.delete || '×'}
                                </button>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- TOP-Liste (Mitte) -->
            <div class="${middleSpan} overflow-y-auto pr-1 pb-10 min-w-0">
                <!-- Toggle-Pill (zeigt Quorum-Live-Status, klick öffnet Sidebar) -->
                ${!sidebarOpen ? `
                    <button onclick="_etvToggleSidebar()" class="w-full mb-3 bg-white rounded-2xl border border-hb-olive/12 hover:border-hb-olive shadow-sm hover:shadow-md transition-all p-3 flex items-center gap-3 group">
                        <div class="bg-hb-ultralight rounded-xl p-2 flex items-center gap-2">
                            <span class="text-[9px] font-black uppercase tracking-widest ${isQuorum ? 'text-hb-success bg-hb-success/12' : 'text-hb-orange bg-hb-orange/10'} px-2 py-0.5 rounded-full">${isQuorum ? 'BF' : 'Prüf'}</span>
                            <span class="text-base font-black ${isQuorum ? 'text-hb-olive' : 'text-hb-orange'}">${percent}%</span>
                        </div>
                        <div class="flex-grow text-left">
                            <div class="text-[11px] font-black text-hb-offblack">${presentGroups.length} Eigentümer · ${presentUnits.length} WE anwesend</div>
                            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Quorum & Check-in öffnen</div>
                        </div>
                        <span class="text-hb-olive text-xl group-hover:translate-x-1 transition-transform">›</span>
                    </button>
                ` : ''}

                <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-2 px-1">Tagesordnung (${_etvState.agenda.length})</div>
                <div class="space-y-2.5">
                    ${_etvState.agenda.length === 0 ? `
                        <div class="bg-white rounded-2xl border border-hb-olive/10 p-8 text-center text-sm text-gray-400 italic">Keine TOPs hinterlegt — bitte unter "Vorbereitung" anlegen.</div>
                    ` : _etvState.agenda.map(top => {
                        const result = resultLabel(top.result_status);
                        const isActive = top.id === _etvState.selectedTopId;
                        return `
                        <div onclick="_etvSelectTop('${top.id}')" class="cursor-pointer rounded-2xl p-4 flex items-center gap-4 transition-all border ${isActive ? 'bg-hb-olive text-white border-hb-olive shadow-md' : 'bg-white border-hb-olive/10 hover:border-hb-olive/40 hover:bg-hb-ultralight/30'}">
                            <div class="${isActive ? 'bg-white text-hb-olive' : 'bg-hb-ultralight text-hb-olive'} h-14 w-14 min-w-[56px] rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">
                                ${top.sort_order}
                            </div>
                            <div class="flex-grow min-w-0">
                                <div class="font-black ${isActive ? 'text-white' : 'text-hb-offblack'} text-base leading-tight">${top.title}</div>
                                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span class="text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-hb-ultralight text-hb-olive'} font-black uppercase tracking-tight px-2 py-0.5 rounded-md">
                                        ${top.voting_type === 'none' ? 'Kein Beschluss' : (VOTING_TYPES[top.voting_type] || top.voting_type)}
                                    </span>
                                    ${top.voting_type !== 'none' && top.majority_type ? `
                                    <span class="text-[10px] ${isActive ? 'text-white/70' : 'text-gray-500'} font-bold uppercase tracking-tight">
                                        ${MAJORITY_TYPES[top.majority_type] || top.majority_type.replace('_', ' ')}
                                    </span>` : ''}
                                    ${topNeedsWarning(top) ? `
                                    <span class="text-[10px] font-black px-2 py-0.5 rounded-md border ${isActive ? 'text-white/90 bg-white/20 border-white/30' : 'text-hb-error bg-hb-error/8 border-hb-error/20'}">! Nicht erreichbar</span>
                                    ` : ''}
                                </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0 ${isActive ? 'bg-white/20 text-white border-white/30' : result.cls}">${result.text}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Detail + Abstimmung (rechts) -->
            <div class="${detailSpan} overflow-y-auto pb-10 min-w-0">
                ${selectedTop ? _etvRenderTopDetailPanel(selectedTop, resultLabel) : `
                    <div class="bg-white rounded-2xl border border-hb-olive/10 p-12 text-center text-sm text-gray-400 italic">
                        Wähle links einen TOP, um Details und Abstimmung zu sehen.
                    </div>
                `}
            </div>
        </div>
        </div>
    `;
}

window._etvToggleSidebar = () => {
    _etvState.sidebarCollapsed = !_etvState.sidebarCollapsed;
    const ca = document.getElementById('etv-content');
    if (ca) ca.innerHTML = _etvRenderTabContent();
};

/**
 * Rechtes Panel der Durchführung — zeigt vollen TOP-Inhalt (Interne Notiz, Vorbemerkung,
 * Beschlussantrag, Dokumente) und enthält die Abstimmungs-Buttons.
 */
function _etvRenderTopDetailPanel(top, resultLabelFn) {
    const result = resultLabelFn(top.result_status);
    const isNoVote = top.voting_type === 'none';
    const docs = _etvState.agendaDocs.filter(d => d.agenda_item_id === top.id);

    // Anwesenheits-Daten für per-TOP-Beschlussfähigkeitsprüfung
    const presentAtt  = _etvState.attendance.filter(a => a.is_present);
    const totalMEA    = _etvState.apartments.reduce((s, a) => s + (a.mea_numerator || 0), 0);
    const presentMEA  = presentAtt.reduce((s, a) => {
        const apt = _etvState.apartments.find(ap => ap.id === a.apartment_id);
        return s + (apt?.mea_numerator || 0);
    }, 0);
    const totalUnits   = _etvState.apartments.length;
    const presentCount = presentAtt.length;

    // Warnung wenn Mehrheitstyp mit aktueller Anwesenheit nicht erreichbar
    let topWarning = null;
    if (!isNoVote) {
        if (top.majority_type === 'unanimous' && presentCount < totalUnits) {
            topWarning = `Allstimmigkeit nicht erreichbar — ${totalUnits - presentCount} Eigentümer fehlen.`;
        } else if (top.majority_type === 'double_qualified' && totalMEA > 0 && presentMEA * 2 <= totalMEA) {
            topWarning = `Doppelt qualifizierte Mehrheit nicht erreichbar — es müssen >50% aller MEA zustimmen (aktuell ${(presentMEA / totalMEA * 100).toFixed(1)}% anwesend).`;
        }
    }

    // Aktiver Button-Zustand basierend auf gespeichertem Ergebnis
    const isApproved = top.result_status === 'approved';
    const isRejected = top.result_status === 'rejected';
    const isAbstain  = top.result_status === 'abstained';
    const hasVote    = isApproved || isRejected || isAbstain;
    const btnBase    = 'px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-95 border-2';
    const btnJa      = `${btnBase} ${isApproved ? 'bg-hb-success text-white border-hb-success shadow-md' : 'bg-white border-hb-success/20 text-hb-success hover:bg-hb-success hover:text-white hover:border-hb-success'}`;
    const btnNein    = `${btnBase} ${isRejected ? 'bg-hb-orange text-white border-hb-orange shadow-md'  : 'bg-white border-hb-orange/20 text-hb-orange hover:bg-hb-orange hover:text-white hover:border-hb-orange'}`;
    const btnEnth    = `${btnBase} ${isAbstain  ? 'bg-gray-500 text-white border-gray-500 shadow-md'    : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-500 hover:text-white hover:border-gray-500'}`;
    const bldDocs = docs.filter(d => d.scope === 'building');
    const ownDocs = docs.filter(d => d.scope === 'owner');

    const section = (label, value, opts = {}) => {
        if (!value && !opts.field) return '';
        const display = value || '<span class="italic text-gray-400">Noch nicht eingetragen.</span>';
        return `
        <div>
            <div class="flex items-center mb-1.5">
                <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest flex-grow">${label}</div>
                ${opts.field ? `<button onclick="_etvQuickEditField('${top.id}','${opts.field}','${label.replace(/'/g, '&#39;')}')" class="text-[10px] text-gray-400 hover:text-hb-olive font-black px-2 py-0.5 rounded-lg hover:bg-hb-ultralight transition-all flex-shrink-0">✎ Bearbeiten</button>` : ''}
            </div>
            <div class="text-[15px] leading-relaxed ${value ? 'text-hb-offblack' : ''} ${opts.italic && value ? 'italic text-gray-500' : ''} ${opts.box ? 'bg-hb-orange/5 border border-hb-orange/15 rounded-xl p-3' : ''} whitespace-pre-wrap">${display}</div>
        </div>
    `};

    return `
        <div class="bg-white rounded-2xl border border-hb-olive/12 shadow-sm overflow-hidden flex flex-col">
            <!-- Kopf -->
            <div class="bg-hb-olive p-5 text-white">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-black">TOP ${top.sort_order}</span>
                    <span class="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        ${isNoVote ? 'Kein Beschluss' : (VOTING_TYPES[top.voting_type] || top.voting_type)}
                    </span>
                    ${!isNoVote && top.majority_type ? `
                    <span class="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">${MAJORITY_TYPES[top.majority_type] || top.majority_type.replace('_', ' ')}</span>
                    ` : ''}
                    <span class="ml-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${result.cls}">${result.text}</span>
                </div>
                <h3 class="text-xl font-black tracking-tight">${top.title}</h3>
            </div>

            <!-- Inhalt: Reihenfolge interne Notiz → Vorbemerkung → Beschlussantrag -->
            <div class="p-5 space-y-5">
                ${section('Interne Notiz (nur Verwalter)', top.internal_note, { box: true, field: 'internal_note' })}
                ${section('Vorbemerkung', top.preliminary_remark, { field: 'preliminary_remark' })}
                ${section('Beschlussantrag', top.proposed_resolution, { field: 'proposed_resolution' })}
                ${section('Abstimmungs-Notiz', top.result_note, { field: 'result_note' })}

                ${docs.length ? `
                    <div>
                        <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-2">Verknüpfte Dokumente (${docs.length})</div>
                        <div class="space-y-1.5">
                            ${bldDocs.map(d => `
                                <div class="flex items-center gap-2 text-xs bg-hb-ultralight rounded-lg px-3 py-2 border border-hb-olive/10">
                                    <span class="text-hb-olive">📄</span>
                                    <span class="font-bold text-hb-offblack truncate flex-grow">${d.file_name}</span>
                                    <span class="text-[10px] text-gray-400 font-bold">alle</span>
                                </div>
                            `).join('')}
                            ${ownDocs.length ? `
                                <div class="flex items-center gap-2 text-xs bg-hb-orange/5 rounded-lg px-3 py-2 border border-hb-orange/10">
                                    <span class="text-hb-orange">📄</span>
                                    <span class="font-bold text-hb-offblack flex-grow">${ownDocs.length} eigentümerspezifisch</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Abstimmungs-Bereich -->
            ${isNoVote ? `
                <div class="bg-hb-ultralight/40 px-5 py-4 border-t border-hb-olive/5 text-center">
                    <span class="text-xs text-gray-400 italic">Nicht abstimmungsrelevant</span>
                </div>
            ` : `
                <div class="bg-hb-ultralight/60 px-5 py-5 border-t border-hb-olive/10">
                    ${topWarning ? `
                    <div class="flex items-start gap-2 bg-hb-error/8 border border-hb-error/20 rounded-xl px-4 py-3 mb-4">
                        <span class="text-hb-error font-black text-base leading-none mt-0.5">!</span>
                        <span class="text-[11px] font-bold text-hb-error leading-snug">${topWarning}</span>
                    </div>
                    ` : ''}
                    <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-3">Abstimmung</div>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="_etvCastVote('${top.id}', 'yes')" class="${btnJa}">JA</button>
                        <button onclick="_etvCastVote('${top.id}', 'no')" class="${btnNein}">NEIN</button>
                        <button onclick="_etvCastVote('${top.id}', 'abstain')" class="${btnEnth}">ENTH.</button>
                    </div>
                    ${hasVote ? `
                    <div class="flex items-center gap-1.5 mt-3">
                        <span class="text-hb-success text-xs font-black">✓</span>
                        <span class="text-[10px] font-bold text-gray-500">Ergebnis gespeichert — erneut klicken zum Ändern</span>
                    </div>
                    ` : ''}
                    <div class="mt-3 pt-3 border-t border-hb-olive/10">
                        <button onclick="_etvOpenIndividualVoting('${top.id}')" class="w-full text-xs font-black text-hb-olive hover:bg-hb-olive/5 py-2 rounded-xl transition-all border border-hb-olive/15">
                            Einzelstimmen erfassen →
                        </button>
                    </div>
                </div>
            `}
        </div>
    `;
}

window._etvSelectTop = (topId) => {
    _etvState.selectedTopId = topId;
    const ca = document.getElementById('etv-content');
    if (ca) ca.innerHTML = _etvRenderTabContent();
};

/**
 * PHASE 3: Nachbereitung (Protokoll & Versiegelung)
 */
function _etvRenderFollow() {
    const s = _etvState.session;
    if (!s) return '<div class="p-10 text-center text-gray-400">Keine Versammlung geladen.</div>';

    const agenda = _etvState.agenda;
    const approvedCount = agenda.filter(a => a.result_status === 'approved').length;
    const totalCount = agenda.length;

    // Formalia-Daten
    const fmtTime = (t) => t ? t.slice(0, 5) : '—';
    const meetingDate = s.meeting_date ? new Date(s.meeting_date).toLocaleDateString('de-DE') : '—';
    const formaliaRows = [
        ['Versammlungsbeginn', s.actual_start_time ? `${meetingDate}, ${fmtTime(s.actual_start_time)} Uhr` : meetingDate],
        ['Versammlungsende',   s.actual_end_time   ? `${meetingDate}, ${fmtTime(s.actual_end_time)} Uhr`  : '—'],
        ['Versammlungsort',    s.location || '—'],
        ['Versammlungsleitung', s.chairman_name || '—'],
        ['Protokollführung',   s.secretary_name || '—'],
    ].map(([label, val]) => `
        <div class="flex gap-4 py-2.5 border-b border-hb-olive/6 last:border-0">
            <span class="text-[11px] font-black text-gray-400 uppercase tracking-wide w-44 shrink-0">${label}</span>
            <span class="text-sm font-bold text-hb-offblack">${val}</span>
        </div>`).join('');

    // TOPs accordion
    const topItems = agenda.map(top => {
        const itemVotes = _etvState.votes.filter(v => v.agenda_item_id === top.id);
        const yesMEA  = itemVotes.filter(v => v.vote === 'yes').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
        const noMEA   = itemVotes.filter(v => v.vote === 'no').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
        const absMEA  = itemVotes.filter(v => v.vote === 'abstain').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
        const yesObj  = itemVotes.filter(v => v.vote === 'yes').length;
        const noObj   = itemVotes.filter(v => v.vote === 'no').length;
        const absObj  = itemVotes.filter(v => v.vote === 'abstain').length;
        const totalMEA = yesMEA + noMEA + absMEA;

        let statusBadge = '';
        if (top.voting_type === 'none') {
            statusBadge = '<span class="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md">Kein Beschluss</span>';
        } else if (top.result_status === 'approved') {
            statusBadge = '<span class="text-[10px] font-black text-hb-success uppercase bg-hb-success/10 border border-hb-success/20 px-2 py-0.5 rounded-md">✓ Angenommen</span>';
        } else if (top.result_status === 'rejected') {
            statusBadge = '<span class="text-[10px] font-black text-hb-error uppercase bg-hb-error/10 border border-hb-error/20 px-2 py-0.5 rounded-md">✗ Abgelehnt</span>';
        } else {
            statusBadge = '<span class="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md">Ausstehend</span>';
        }

        const votingBlock = top.voting_type !== 'none' ? `
            <div class="mb-4">
                <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-2">Abstimmungsergebnis</div>
                <div class="bg-hb-ultralight rounded-xl p-4 border border-hb-olive/10">
                    <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                        <div class="flex justify-between">
                            <span class="text-gray-500 text-xs">Beschlussregel</span>
                            <span class="font-bold text-xs">${MAJORITY_TYPES[top.majority_type] || top.majority_type || '—'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 text-xs">Prinzip</span>
                            <span class="font-bold text-xs">${VOTING_TYPES[top.voting_type] || top.voting_type || '—'}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="bg-hb-success/10 border border-hb-success/20 rounded-xl p-2">
                            <div class="text-[10px] text-hb-success font-black uppercase">JA</div>
                            <div class="font-black text-hb-offblack text-sm">${yesMEA.toLocaleString('de-DE', {minimumFractionDigits:3})}</div>
                            <div class="text-[10px] text-gray-400">${yesObj} Obj. · ${totalMEA > 0 ? (yesMEA/totalMEA*100).toFixed(1) : 0}%</div>
                        </div>
                        <div class="bg-hb-error/8 border border-hb-error/15 rounded-xl p-2">
                            <div class="text-[10px] text-hb-error font-black uppercase">NEIN</div>
                            <div class="font-black text-hb-offblack text-sm">${noMEA.toLocaleString('de-DE', {minimumFractionDigits:3})}</div>
                            <div class="text-[10px] text-gray-400">${noObj} Obj.</div>
                        </div>
                        <div class="bg-gray-100 border border-gray-200 rounded-xl p-2">
                            <div class="text-[10px] text-gray-500 font-black uppercase">ENTH.</div>
                            <div class="font-black text-hb-offblack text-sm">${absMEA.toLocaleString('de-DE', {minimumFractionDigits:3})}</div>
                            <div class="text-[10px] text-gray-400">${absObj} Obj.</div>
                        </div>
                    </div>
                </div>
            </div>` : '';

        return `
        <div class="border border-hb-olive/10 rounded-2xl overflow-hidden mb-3">
            <button onclick="_etvFollowToggleTop('${top.id}')" class="w-full flex items-center gap-4 px-5 py-4 bg-hb-ultralight hover:bg-hb-olive/8 transition-all text-left">
                <span class="text-[10px] font-black text-hb-olive bg-hb-olive/10 px-2 py-1 rounded-lg tracking-widest shrink-0">TOP ${top.sort_order}</span>
                <span class="font-black text-hb-offblack flex-1 text-sm">${top.title}</span>
                ${statusBadge}
                <svg id="etv-follow-chevron-${top.id}" class="w-4 h-4 text-gray-400 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="etv-follow-body-${top.id}" class="hidden px-5 pb-5 pt-4 space-y-4">
                ${top.preliminary_remark ? `
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Vorbemerkung</label>
                    <textarea id="etv-follow-remark-${top.id}" rows="3" class="w-full bg-hb-ultralight rounded-xl px-4 py-3 text-sm border border-hb-olive/10 focus:border-hb-olive focus:ring-1 focus:ring-hb-olive/20 resize-none">${top.preliminary_remark || ''}</textarea>
                </div>` : ''}
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Beschlussantrag</label>
                    <textarea id="etv-follow-resolution-${top.id}" rows="4" class="w-full bg-hb-ultralight rounded-xl px-4 py-3 text-sm border border-hb-olive/10 focus:border-hb-olive focus:ring-1 focus:ring-hb-olive/20 resize-none">${top.proposed_resolution || ''}</textarea>
                </div>
                ${votingBlock}
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Diskussionsnotiz <span class="text-gray-400 normal-case font-normal">(optional — erscheint im Protokoll)</span></label>
                    <textarea id="etv-follow-discussion-${top.id}" rows="2" class="w-full bg-hb-ultralight rounded-xl px-4 py-3 text-sm border border-hb-olive/10 focus:border-hb-olive focus:ring-1 focus:ring-hb-olive/20 resize-none">${top.result_note || ''}</textarea>
                </div>
                <div class="flex justify-end">
                    <button onclick="_etvFollowSaveTop('${top.id}')" class="bg-hb-olive text-white text-xs font-black px-5 py-2 rounded-xl hover:opacity-90 transition-all">Speichern</button>
                </div>
            </div>
        </div>`;
    }).join('');

    const s1 = s.beirat_signatory_1 || '';
    const s2 = s.beirat_signatory_2 || '';

    return `
        <div class="max-w-4xl mx-auto space-y-6 pb-20">

            <!-- Protokoll-Vorschau -->
            <div class="bg-white p-8 rounded-3xl border border-hb-olive/12 shadow-sm">
                <div class="flex items-start justify-between mb-6">
                    <div>
                        <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Protokoll-Vorschau</h2>
                        <p class="text-[15px] text-gray-400 mt-1 leading-relaxed">Prüfen und bearbeiten Sie die Texte vor der PDF-Generierung. Interne Notizen erscheinen nicht im Protokoll.</p>
                    </div>
                    <span class="shrink-0 bg-hb-ultralight border border-hb-olive/12 text-hb-olive text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                        ${approvedCount} / ${totalCount} Beschlüsse
                    </span>
                </div>
                ${agenda.length === 0
                    ? '<div class="bg-hb-ultralight rounded-2xl p-8 text-center text-[15px] text-gray-400">Keine Tagesordnungspunkte vorhanden.</div>'
                    : topItems}
            </div>

            <!-- Formalia -->
            <div class="bg-white p-8 rounded-3xl border border-hb-olive/12 shadow-sm">
                <div class="flex items-start justify-between mb-5">
                    <div>
                        <h3 class="text-xl font-black text-hb-offblack tracking-tight">Formalia</h3>
                        <p class="text-[10px] text-hb-olive font-black uppercase tracking-widest mt-0.5">Protokoll-Daten der Versammlung</p>
                    </div>
                    <button onclick="_etvProtocolModal()" class="text-xs font-black text-hb-olive bg-hb-ultralight hover:bg-hb-olive hover:text-white px-4 py-2 rounded-xl transition-all border border-hb-olive/10">Bearbeiten</button>
                </div>
                <div>${formaliaRows}</div>
                ${s.general_notes ? `<div class="mt-4 bg-hb-ultralight rounded-xl p-4 border border-hb-olive/10">
                    <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Allgemeine Notizen</div>
                    <p class="text-sm text-gray-600">${s.general_notes}</p>
                </div>` : ''}
            </div>

            <!-- PDF generieren & Unterzeichner -->
            <div class="bg-white p-8 rounded-3xl border border-hb-olive/12 shadow-sm">
                <h3 class="text-xl font-black text-hb-offblack tracking-tight mb-1">Protokoll generieren</h3>
                <p class="text-[15px] text-gray-400 mb-6 leading-relaxed">Geben Sie die Unterzeichner an. Leere Felder erscheinen als Platzhalter im PDF.</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Versammlungsleiter</label>
                        <input type="text" id="etv-sign-vl" value="${s.chairman_name || ''}" placeholder="Name (bleibt leer = Platzhalter im PDF)" class="w-full">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Protokollführer</label>
                        <input type="text" id="etv-sign-pf" value="${s.secretary_name || ''}" placeholder="Name (bleibt leer = Platzhalter im PDF)" class="w-full">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Unterzeichner Beirat 1 <span class="text-gray-400 normal-case font-normal">(optional)</span></label>
                        <input type="text" id="etv-sign-b1" value="${s1}" placeholder="Name Beirat / Eigentümer" class="w-full">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Unterzeichner Beirat 2 <span class="text-gray-400 normal-case font-normal">(optional)</span></label>
                        <input type="text" id="etv-sign-b2" value="${s2}" placeholder="Name Beirat / Eigentümer" class="w-full">
                    </div>
                </div>

                <!-- Freigabe-Option -->
                <div class="bg-hb-ultralight rounded-2xl p-5 border border-hb-olive/10 mb-6 flex items-center justify-between gap-4">
                    <div>
                        <div class="font-black text-hb-offblack text-sm">Im Portal freigeben</div>
                        <div class="text-xs text-gray-400 mt-0.5">Protokoll wird nach Generierung sofort für Eigentümer sichtbar. Kann auch später manuell freigegeben werden.</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="etv-publish-now" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-hb-olive/20 rounded-full peer peer-checked:bg-hb-olive after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                </div>

                <button id="etv-gen-protokoll-btn" onclick="_etvGenProtokoll()" class="w-full bg-hb-olive text-white py-4 rounded-2xl font-black text-base shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all">
                    Protokoll PDF generieren
                </button>

                <!-- Beschlusssammlung Transfer -->
                <div class="mt-4 bg-hb-ultralight border border-hb-olive/10 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <div class="font-black text-hb-offblack text-sm">Beschlusssammlung</div>
                        <div class="text-xs text-gray-400 mt-0.5">Angenommene Beschlüsse dieser Versammlung in die Beschlusssammlung übertragen.</div>
                    </div>
                    <button onclick="_beschTransferFromSession('${_etvState.sessionId}')" class="shrink-0 bg-hb-olive/10 text-hb-olive px-4 py-2 rounded-xl text-xs font-black hover:bg-hb-olive hover:text-white transition-all">
                        Übertragen
                    </button>
                </div>

                <!-- Hinweis Original beim Verwalter -->
                <div class="mt-5 bg-hb-ultralight border border-hb-olive/10 rounded-2xl p-5">
                    <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-2">§ 24 Abs. 6 WEG — Hinweis zu Unterschriften</div>
                    <p class="text-[15px] text-gray-500 leading-relaxed">Das generierte PDF enthält Unterschriften-Blöcke für die handschriftliche Unterzeichnung. Das Original mit den geleisteten Unterschriften verbleibt beim Verwalter und kann dort auf Anfrage eingesehen werden. Im Portal wird ausschließlich die elektronische Fassung veröffentlicht.</p>
                </div>
            </div>

        </div>
    `;
}

window._etvFollowToggleTop = (id) => {
    const body = document.getElementById(`etv-follow-body-${id}`);
    const chev = document.getElementById(`etv-follow-chevron-${id}`);
    if (!body) return;
    body.classList.toggle('hidden');
    chev?.classList.toggle('rotate-180');
};

window._etvFollowSaveTop = async (id) => {
    const top = _etvState.agenda.find(a => a.id === id);
    if (!top) return;
    const resolution  = document.getElementById(`etv-follow-resolution-${id}`)?.value?.trim() ?? top.proposed_resolution;
    const discussion  = document.getElementById(`etv-follow-discussion-${id}`)?.value?.trim() ?? top.result_note;
    const remark      = document.getElementById(`etv-follow-remark-${id}`)?.value?.trim()     ?? top.preliminary_remark;

    const { error } = await _supabase.from('etv_agenda_items').update({
        proposed_resolution: resolution || null,
        result_note:         discussion  || null,
        preliminary_remark:  remark      || null,
    }).eq('id', id);

    if (error) { showToast('Fehler beim Speichern.', 'error'); return; }
    top.proposed_resolution = resolution || null;
    top.result_note         = discussion  || null;
    top.preliminary_remark  = remark      || null;
    showToast('TOP gespeichert.');
};

/**
 * Hilfsfunktionen für Navigation und Modals
 */

window._etvSetTab = async (tab) => {
    _etvState.activeTab = tab;
    _etvRenderMain();
    if (tab === 'follow' && _etvState.sessionId && !_etvState._votesLoaded) {
        const agendaIds = _etvState.agenda.map(a => a.id);
        if (agendaIds.length) {
            const { data } = await _supabase.from('etv_votes').select('*').in('agenda_item_id', agendaIds);
            _etvState.votes = data || [];
        }
        _etvState._votesLoaded = true;
        _etvRenderMain();
    }
};

// ─── SESSIONS ────────────────────────────────────────────────

window._etvNewSessionModal = () => {
    const nextYear = new Date().getFullYear();
    const html = `
        <div id="etv-session-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Neue ETV planen</h3>
                    <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">Versammlungsdaten festlegen</p>
                </div>
                <div class="p-8 space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Wirtschaftsjahr</label>
                            <input type="number" id="etv-new-fy" value="${nextYear}" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm focus:ring-hb-olive/20 focus:border-hb-olive transition-all">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Datum</label>
                            <input type="date" id="etv-new-date" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm focus:ring-hb-olive/20 focus:border-hb-olive transition-all">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Uhrzeit</label>
                        <input type="time" id="etv-new-time" value="18:30" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm focus:ring-hb-olive/20 focus:border-hb-olive transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Ort / Modus</label>
                        <input type="text" id="etv-new-loc" placeholder="z.B. Gemeindesaal St. Marien / Online" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm focus:ring-hb-olive/20 focus:border-hb-olive transition-all">
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight flex gap-3">
                    <button onclick="document.getElementById('etv-session-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveSession()" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Planung anlegen</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvSaveSession = async () => {
    const fy = document.getElementById('etv-new-fy').value;
    const date = document.getElementById('etv-new-date').value;
    const time = document.getElementById('etv-new-time').value;
    const loc = document.getElementById('etv-new-loc').value;

    if (!date || !fy) { showToast('Bitte Datum und Jahr angeben.', 'error'); return; }

    const { data, error } = await _supabase.from('etv_sessions').insert({
        building_id: _etvState.buildingId,
        fiscal_year: parseInt(fy),
        meeting_date: new Date(`${date}T${time || '00:00'}:00`).toISOString(),
        location: loc,
        status: 'planned'
    }).select().single();

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    
    document.getElementById('etv-session-modal').remove();
    showToast('Versammlung erfolgreich geplant.', 'success');
    _etvOpenSession(data.id);
};

// ─── AGENDA (TOPs) ──────────────────────────────────────────

window._etvAddTOPModal = () => {
    const last = _etvState.agenda[_etvState.agenda.length - 1];
    const nextSort = last ? (parseInt(last.sort_order) || _etvState.agenda.length) + 1 : 1;
    const html = `
        <div id="etv-top-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Tagesordnungspunkt hinzufügen</h3>
                </div>
                <div class="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-4 gap-4">
                        <div class="col-span-1">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Nr.</label>
                            <input type="text" id="top-sort" value="${nextSort}" placeholder="z.B. 2.1" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm">
                        </div>
                        <div class="col-span-3">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Titel des TOP</label>
                            <input type="text" id="top-title" placeholder="z.B. Entlastung der Verwaltung" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Vorbemerkung <span class="text-gray-400 normal-case font-normal">(erscheint in Einladung & Protokoll)</span></label>
                        <textarea id="top-prem" rows="2" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Sachverhaltsdarstellung, Hintergrundinformation..."></textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Beschlussantrag (Wortlaut)</label>
                        <textarea id="top-res" rows="3" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Die Eigentümerversammlung beschließt..."></textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Interne Notiz <span class="text-gray-400 normal-case font-normal">(nur intern, nicht in Einladung/Protokoll)</span></label>
                        <textarea id="top-note" rows="2" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Interne Hinweise, Vorüberlegungen..."></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Stimmprinzip</label>
                            <select id="top-vote-type" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                                ${Object.entries(VOTING_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Mehrheit</label>
                            <select id="top-maj-type" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                                ${Object.entries(MAJORITY_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight flex gap-3 border-t border-hb-olive/5">
                    <button onclick="document.getElementById('etv-top-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveTOP()" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">TOP speichern</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvSaveTOP = async () => {
    const title = document.getElementById('top-title').value;
    const sort  = document.getElementById('top-sort').value;
    const res   = document.getElementById('top-res').value;
    const prem  = document.getElementById('top-prem').value;
    const note  = document.getElementById('top-note').value;
    const vType = document.getElementById('top-vote-type').value;
    const mType = document.getElementById('top-maj-type').value;

    if (!title) { showToast('Titel erforderlich', 'error'); return; }

    const { error } = await _supabase.from('etv_agenda_items').insert({
        session_id: _etvState.sessionId,
        sort_order: sort.trim(),
        title,
        preliminary_remark: prem || null,
        proposed_resolution: res,
        internal_note: note || null,
        voting_type: vType,
        majority_type: mType
    });

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    document.getElementById('etv-top-modal').remove();
    showToast('TOP hinzugefügt.');
    _etvOpenSession(_etvState.sessionId);
};

window._etvEditTOP = (id) => {
    const top = _etvState.agenda.find(t => t.id === id);
    if (!top) return;
    const voteOpts = Object.entries(VOTING_TYPES).map(([k,v]) =>
        `<option value="${k}" ${top.voting_type === k ? 'selected' : ''}>${v}</option>`
    ).join('');
    const majOpts = Object.entries(MAJORITY_TYPES).map(([k,v]) =>
        `<option value="${k}" ${top.majority_type === k ? 'selected' : ''}>${v}</option>`
    ).join('');
    const html = `
        <div id="etv-top-edit-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Tagesordnungspunkt bearbeiten</h3>
                </div>
                <div class="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-4 gap-4">
                        <div class="col-span-1">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Nr.</label>
                            <input type="text" id="top-edit-sort" value="${top.sort_order}" placeholder="z.B. 2.1" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm">
                        </div>
                        <div class="col-span-3">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Titel des TOP</label>
                            <input type="text" id="top-edit-title" value="${top.title || ''}" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Vorbemerkung <span class="text-gray-400 normal-case font-normal">(erscheint in Einladung & Protokoll)</span></label>
                        <textarea id="top-edit-prem" rows="2" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Sachverhaltsdarstellung...">${top.preliminary_remark || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Beschlussantrag (Wortlaut)</label>
                        <textarea id="top-edit-res" rows="3" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Die Eigentümerversammlung beschließt...">${top.proposed_resolution || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Interne Notiz <span class="text-gray-400 normal-case font-normal">(nur intern, nicht in Einladung/Protokoll)</span></label>
                        <textarea id="top-edit-note" rows="2" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm" placeholder="Interne Hinweise...">${top.internal_note || ''}</textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Stimmprinzip</label>
                            <select id="top-edit-vote-type" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">${voteOpts}</select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Mehrheit</label>
                            <select id="top-edit-maj-type" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">${majOpts}</select>
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight flex gap-3 border-t border-hb-olive/5">
                    <button onclick="document.getElementById('etv-top-edit-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvUpdateTOP('${id}')" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Speichern</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvUpdateTOP = async (id) => {
    const title = document.getElementById('top-edit-title').value;
    const sort  = document.getElementById('top-edit-sort').value;
    const prem  = document.getElementById('top-edit-prem').value;
    const res   = document.getElementById('top-edit-res').value;
    const note  = document.getElementById('top-edit-note').value;
    const vType = document.getElementById('top-edit-vote-type').value;
    const mType = document.getElementById('top-edit-maj-type').value;
    if (!title) { showToast('Titel erforderlich', 'error'); return; }
    const { error } = await _supabase.from('etv_agenda_items').update({
        sort_order: sort.trim(),
        title,
        preliminary_remark: prem || null,
        proposed_resolution: res,
        internal_note: note || null,
        voting_type: vType,
        majority_type: mType
    }).eq('id', id);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('etv-top-edit-modal').remove();
    showToast('TOP aktualisiert.', 'success');
    _etvOpenSession(_etvState.sessionId);
};

window._etvDeleteTOP = async (id) => {
    if (!confirm('TOP wirklich löschen?')) return;
    const { error } = await _supabase.from('etv_agenda_items').delete().eq('id', id);
    if (!error) _etvOpenSession(_etvState.sessionId);
};

// ─── TOP-DOKUMENTE ─────────────────────────────────────────

window._etvTopDocsModal = async (agendaItemId) => {
    const top = _etvState.agenda.find(t => t.id === agendaItemId);
    if (!top) return;
    const docs = _etvState.agendaDocs.filter(d => d.agenda_item_id === agendaItemId);
    const owners = _etvState.owners;

    const docRows = docs.map(d => {
        const scopeLabel = d.scope === 'building'
            ? '<span class="text-hb-olive font-bold">Alle Eigentümer</span>'
            : `<span class="text-hb-orange font-bold">${d.owner ? d.owner.first_name + ' ' + d.owner.last_name : 'Eigentümer'}</span>`;
        return `
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-gray-400">📄</span>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-hb-offblack truncate">${d.file_name}</p>
                        <p class="text-[10px] text-gray-400">${scopeLabel}</p>
                    </div>
                </div>
                <button onclick="_etvDeleteTopDoc('${d.id}', '${d.file_path}', '${agendaItemId}')" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 shrink-0">Entfernen</button>
            </div>`;
    }).join('');

    const ownerOpts = owners.map(o =>
        `<option value="${o.person?.id}">${o.person?.first_name} ${o.person?.last_name} (${_etvState.apartments.find(a => a.id === o.apartment_id)?.apartment_number || '?'})</option>`
    ).join('');

    const html = `
        <div id="etv-topdocs-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Dokumente — TOP ${top.sort_order}: ${top.title}</h3>
                </div>
                <div class="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    <!-- Bestehende Dokumente -->
                    <div>
                        <h4 class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-3">Hochgeladene Dokumente (${docs.length})</h4>
                        ${docs.length ? `<div class="bg-hb-ultralight rounded-2xl p-4">${docRows}</div>`
                            : '<p class="text-[15px] text-gray-400 italic">Noch keine Dokumente hochgeladen.</p>'}
                    </div>

                    <!-- Upload -->
                    <div class="border-t border-hb-olive/10 pt-6">
                        <h4 class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-3">Neues Dokument hochladen</h4>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1.5">PDF-Datei</label>
                                <input type="file" id="topdoc-file" accept="application/pdf" class="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-hb-ultralight file:text-hb-olive hover:file:bg-hb-olive/10">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1.5">Zuweisung</label>
                                <select id="topdoc-scope" onchange="document.getElementById('topdoc-owner-wrap').classList.toggle('hidden', this.value === 'building')" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                                    <option value="building">Für alle Eigentümer</option>
                                    <option value="owner">Für bestimmten Eigentümer</option>
                                </select>
                            </div>
                            <div id="topdoc-owner-wrap" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 mb-1.5">Eigentümer auswählen</label>
                                <select id="topdoc-owner" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                                    ${ownerOpts}
                                </select>
                            </div>
                            <button onclick="_etvUploadTopDoc('${agendaItemId}')" class="w-full bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">
                                Hochladen
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight border-t border-hb-olive/5">
                    <button onclick="document.getElementById('etv-topdocs-modal').remove()" class="w-full py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Schließen</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvUploadTopDoc = async (agendaItemId) => {
    const fileInput = document.getElementById('topdoc-file');
    const file = fileInput?.files?.[0];
    if (!file) { showToast('Bitte PDF auswählen.', 'error'); return; }
    if (file.type !== 'application/pdf') { showToast('Nur PDF-Dateien erlaubt.', 'error'); return; }

    const scope = document.getElementById('topdoc-scope').value;
    const ownerPersonId = scope === 'owner' ? document.getElementById('topdoc-owner').value : null;

    const sessionId = _etvState.sessionId;
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const storagePath = `etv-docs/${sessionId}/${agendaItemId}/${ts}_${safeName}`;

    showToast('Wird hochgeladen…');

    const { error: uploadErr } = await _supabase.storage
        .from('documents').upload(storagePath, file, { contentType: 'application/pdf', upsert: false });
    if (uploadErr) { showToast('Upload fehlgeschlagen: ' + uploadErr.message, 'error'); return; }

    const { error: dbErr } = await _supabase.from('etv_agenda_documents').insert({
        agenda_item_id: agendaItemId,
        file_path: storagePath,
        file_name: file.name,
        scope,
        owner_person_id: ownerPersonId || null
    });
    if (dbErr) { showToast('DB-Fehler: ' + dbErr.message, 'error'); return; }

    showToast('Dokument hochgeladen.', 'success');
    document.getElementById('etv-topdocs-modal').remove();
    await _etvOpenSession(_etvState.sessionId);
};

window._etvDeleteTopDoc = async (docId, filePath, agendaItemId) => {
    if (!confirm('Dokument wirklich entfernen?')) return;
    await _supabase.storage.from('documents').remove([filePath]);
    const { error } = await _supabase.from('etv_agenda_documents').delete().eq('id', docId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Dokument entfernt.');
    document.getElementById('etv-topdocs-modal').remove();
    await _etvOpenSession(_etvState.sessionId);
};

// ─── CHECK-IN ───────────────────────────────────────────────

window._etvOpenCheckinModal = () => {
    const groups = _etvGroupedAttendance();
    const presentGroups = groups.filter(g => g.allPresent).length;
    const presentUnits = _etvState.attendance.filter(a => a.is_present).length;
    const denomDefault = _etvState.apartments[0]?.mea_denominator || 1000;

    const html = `
        <div id="etv-checkin-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="bg-hb-olive p-8 text-white flex justify-between items-center">
                    <div>
                        <h3 class="text-2xl font-black tracking-tight">Präsenzliste</h3>
                        <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">Eigentümer ein- und auschecken</p>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] font-black opacity-60 uppercase">Anwesend</div>
                        <div class="text-3xl font-black">${presentGroups} / ${groups.length}</div>
                        <div class="text-[10px] font-bold opacity-60 mt-0.5">${presentUnits} / ${_etvState.attendance.length} WE</div>
                    </div>
                </div>
                <div class="flex-grow overflow-y-auto p-4 space-y-2">
                    ${groups.length === 0 ? `
                        <div class="p-10 text-center text-sm text-gray-500">
                            <div class="font-bold text-hb-offblack mb-2">Keine Eigentümer in der Präsenzliste</div>
                            <p class="text-xs leading-relaxed">
                                Für die Einheiten dieses Gebäudes ist kein aktiver Eigentümer-Eintrag hinterlegt.<br>
                                Bitte unter <span class="font-bold">Objekte → Einheit → Eigentümer</span> nachpflegen und die Seite neu laden.
                            </p>
                        </div>
                    ` : groups.map(g => {
                        const personName = g.person ? `${g.person.first_name} ${g.person.last_name}` : 'Unbekannt';
                        const weBadges = g.apartments.map(apt =>
                            `<span class="bg-hb-ultralight text-hb-olive rounded-md px-2 py-0.5 text-[10px] font-bold border border-hb-olive/10">WE ${apt.apartment_number}</span>`
                        ).join(' ');
                        const isMulti = g.apartments.length > 1;
                        let actionHtml;
                        if (g.proxyName) {
                            actionHtml = `
                                <div class="flex items-center gap-2 shrink-0">
                                    <div class="text-right">
                                        <div class="text-[9px] font-black text-hb-olive uppercase tracking-widest">Vertreten durch</div>
                                        <div class="text-xs font-black text-hb-offblack max-w-[120px] truncate">${g.proxyName}</div>
                                    </div>
                                    <button onclick="_etvClearProxy('${g.person_id}')" class="text-hb-orange text-lg font-black p-1.5 rounded-xl hover:bg-hb-orange/5 transition-all" title="Vollmacht entfernen">×</button>
                                </div>`;
                        } else if (g.allPresent) {
                            actionHtml = `<button onclick="_etvTogglePersonPresent('${g.person_id}', false)" class="px-6 py-2 rounded-xl text-xs font-black transition-all shrink-0 bg-hb-olive text-white shadow-md">✓ EINGECHECKT</button>`;
                        } else if (g.anyPresent) {
                            actionHtml = `<button onclick="_etvTogglePersonPresent('${g.person_id}', false)" class="px-6 py-2 rounded-xl text-xs font-black transition-all shrink-0 bg-hb-orange/10 text-hb-orange border border-hb-orange/30">TEILWEISE</button>`;
                        } else {
                            actionHtml = `
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="_etvTogglePersonPresent('${g.person_id}', true)" class="px-4 py-2 rounded-xl text-xs font-black bg-hb-ultralight text-hb-olive hover:bg-hb-olive hover:text-white transition-all">CHECK-IN</button>
                                    <button onclick="_etvOpenProxyModal('${g.person_id}')" class="px-4 py-2 rounded-xl text-xs font-black bg-hb-ultralight text-gray-400 hover:bg-hb-olive/10 hover:text-hb-olive transition-all border border-hb-olive/10">Vertreten</button>
                                </div>`;
                        }
                        return `
                        <div class="flex items-center justify-between p-4 rounded-2xl hover:bg-hb-ultralight/50 transition-all border border-transparent hover:border-hb-olive/10 group">
                            <div class="flex items-center gap-4 min-w-0">
                                <div class="bg-hb-ultralight text-hb-olive h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border border-hb-olive/5 shrink-0">${g.apartments.length}×WE</div>
                                <div class="min-w-0">
                                    <div class="font-black text-hb-offblack flex items-center gap-2 flex-wrap">
                                        ${personName}
                                        ${isMulti ? `<span class="bg-hb-orange/10 text-hb-orange px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight">Multi-WE</span>` : ''}
                                        ${g.proxyName ? `<span class="bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Vollmacht</span>` : ''}
                                    </div>
                                    <div class="flex flex-wrap gap-1 mt-1">${weBadges}</div>
                                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">${g.totalMEA} / ${denomDefault} MEA${isMulti ? ' gesamt' : ''}</div>
                                </div>
                            </div>
                            ${actionHtml}
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="p-6 bg-hb-ultralight border-t border-hb-olive/5 flex justify-center">
                    <button onclick="document.getElementById('etv-checkin-modal').remove()" class="bg-hb-offblack text-white px-10 py-3 rounded-2xl font-black text-sm shadow-lg hover:scale-105 transition-all">Schließen & Quorum prüfen</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvTogglePresent = async (attId, isPresent) => {
    const { error } = await _supabase.from('etv_attendance').update({ is_present: isPresent }).eq('id', attId);
    if (!error) {
        const att = _etvState.attendance.find(a => a.id === attId);
        if (att) att.is_present = isPresent;

        // Modal aktualisieren
        const modal = document.getElementById('etv-checkin-modal');
        if (modal) {
            modal.remove();
            _etvOpenCheckinModal();
        }
        _etvRenderMain();
    } else {
        showToast('Check-in fehlgeschlagen: ' + error.message, 'error');
    }
};

/**
 * Bulk-Toggle: Alle WE-Einträge einer Person ein-/auschecken.
 * Wird genutzt, wenn ein Eigentümer mehrere Einheiten besitzt — ein Klick erfasst alle.
 */
window._etvTogglePersonPresent = async (personId, isPresent) => {
    const attIds = _etvState.attendance
        .filter(a => a.person_id === personId)
        .map(a => a.id);
    if (attIds.length === 0) return;

    const { error } = await _supabase.from('etv_attendance').update({ is_present: isPresent }).in('id', attIds);
    if (error) {
        showToast('Check-in fehlgeschlagen: ' + error.message, 'error');
        return;
    }
    for (const att of _etvState.attendance) {
        if (att.person_id === personId) att.is_present = isPresent;
    }
    const modal = document.getElementById('etv-checkin-modal');
    if (modal) {
        modal.remove();
        _etvOpenCheckinModal();
    }
    _etvRenderMain();
};

// ─── VOTING ──────────────────────────────────────────────────

window._etvCastVote = async (topId, vote) => {
    const top = _etvState.agenda.find(t => t.id === topId);
    if (!top) return;

    showToast(`Ergebnis für TOP ${top.sort_order} wird erfasst...`);

    // 1. Alle Stimmen für diesen TOP löschen (Reset)
    await _supabase.from('etv_votes').delete().eq('agenda_item_id', topId);

    // 2. Stimmen für alle EINGECHECKTEN Einheiten anlegen
    const present = _etvState.attendance.filter(a => a.is_present);
    const voteInserts = present.map(a => {
        const apt = _etvState.apartments.find(apt => apt.id === a.apartment_id);
        return {
            agenda_item_id: topId,
            apartment_id: a.apartment_id,
            vote: vote,
            weight_mea: Number(apt?.mea_numerator || 0)
        };
    });

    const { error: vErr } = await _supabase.from('etv_votes').insert(voteInserts);
    if (vErr) { showToast('Fehler beim Voten: ' + vErr.message, 'error'); return; }

    // 3. Status des TOP aktualisieren
    const status = (vote === 'yes') ? 'approved' : (vote === 'no' ? 'rejected' : 'abstained');
    await _supabase.from('etv_agenda_items').update({ result_status: status }).eq('id', topId);

    showToast('Abstimmung abgeschlossen.', 'success');
    _etvOpenSession(_etvState.sessionId);
};

// ─── QUICK-EDIT (Felder während Durchführung bearbeiten) ────

window._etvQuickEditField = (topId, fieldName, label) => {
    const top = _etvState.agenda.find(t => t.id === topId);
    if (!top) return;
    const current = top[fieldName] || '';
    const isResolution = fieldName === 'proposed_resolution';
    showModal('etv-qedit-modal', `
        <div class="p-6 space-y-4">
            <textarea id="etv-qedit-val" rows="${isResolution ? 8 : 5}"
                class="w-full rounded-xl border border-hb-olive/20 bg-hb-ultralight px-4 py-3 text-[15px] text-hb-offblack leading-relaxed resize-none"
                placeholder="${isResolution ? 'Beschlussantrag eingeben…' : ''}">${current}</textarea>
            <div class="flex gap-3 justify-end">
                <button onclick="hideModal('etv-qedit-modal')"
                    class="px-5 py-2.5 rounded-xl border border-hb-olive/20 text-hb-offblack font-bold text-sm hover:bg-hb-ultralight transition-all">Abbrechen</button>
                <button onclick="_etvQuickEditSave('${topId}','${fieldName}')"
                    class="px-5 py-2.5 rounded-xl bg-hb-olive text-white font-bold text-sm hover:bg-hb-olive/90 transition-all">Speichern</button>
            </div>
        </div>
    `, { title: label + ' bearbeiten', maxWidth: 'max-w-lg' });
};

window._etvQuickEditSave = async (topId, fieldName) => {
    const val = document.getElementById('etv-qedit-val')?.value?.trim() || null;
    const { error } = await _supabase.from('etv_agenda_items').update({ [fieldName]: val }).eq('id', topId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('etv-qedit-modal');
    showToast('Gespeichert.', 'success');
    _etvOpenSession(_etvState.sessionId);
};

// ─── PDF & ABSCHLUSS ────────────────────────────────────────

window._etvDraftEinladung = async () => {
    if (typeof generateETVEinladungPDF !== 'function') {
        showToast('PDF-Modul nicht bereit.', 'error'); return;
    }
    const btn = document.querySelector('[onclick*="_etvDraftEinladung"]');
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Entwurf wird erstellt…'; }
    try {
        await generateETVEinladungPDF(_etvState.sessionId, { draft: true });
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
};

window._etvPreviewEinladung = async () => {
    if (typeof generateETVEinladungPDF !== 'function') {
        showToast('PDF-Modul nicht bereit.', 'error'); return;
    }
    if (!confirm('Kombi-PDFs (Einladung + Anlagen) generieren und Dokumente für Eigentümer freischalten?\n\nDie verknüpften Jahresabrechnungen und Wirtschaftspläne werden im Portal sichtbar.')) return;

    const btn = document.querySelector('[onclick*="_etvPreviewEinladung"]');
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Kombi-PDFs werden generiert…'; }

    try {
        await generateETVEinladungPDF(_etvState.sessionId);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
};

window._etvGenProtokoll = async () => {
    if (typeof generateETVProtokollPDF !== 'function') {
        showToast('PDF-Modul nicht bereit.', 'error'); return;
    }
    const btn = document.getElementById('etv-gen-protokoll-btn');
    const vl = document.getElementById('etv-sign-vl')?.value.trim() || null;
    const pf = document.getElementById('etv-sign-pf')?.value.trim() || null;
    const b1 = document.getElementById('etv-sign-b1')?.value.trim() || null;
    const b2 = document.getElementById('etv-sign-b2')?.value.trim() || null;
    const publishNow = document.getElementById('etv-publish-now')?.checked || false;

    // Namen in DB speichern für spätere Re-Generierung
    await _supabase.from('etv_sessions').update({
        chairman_name:       vl,
        secretary_name:      pf,
        beirat_signatory_1:  b1,
        beirat_signatory_2:  b2,
    }).eq('id', _etvState.sessionId);
    _etvState.session.chairman_name      = vl;
    _etvState.session.secretary_name     = pf;
    _etvState.session.beirat_signatory_1 = b1;
    _etvState.session.beirat_signatory_2 = b2;

    if (btn) { btn.disabled = true; btn.textContent = 'PDF wird erstellt…'; }
    try {
        await generateETVProtokollPDF(_etvState.sessionId, {
            signatories: { vl, pf, b1, b2 },
            publishNow,
        });
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Protokoll PDF generieren'; }
    }
};

window._etvEditSessionSettings = () => {
    const s = _etvState.session;
    const dt = new Date(s.meeting_date);
    const pad = n => String(n).padStart(2, '0');
    const dateVal = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const timeVal = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const statusOptions = ETV_STATUSES.map(v =>
        `<option value="${v}" ${s.status === v ? 'selected' : ''}>${ETV_STATUS_LABELS[v] || v.toUpperCase()}</option>`
    ).join('');
    const html = `
        <div id="etv-settings-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Versammlungsdetails bearbeiten</h3>
                    <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">ETV ${s.fiscal_year}</p>
                </div>
                <div class="p-8 space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Wirtschaftsjahr</label>
                            <input type="number" id="etv-edit-fy" value="${s.fiscal_year}" class="w-full">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Datum</label>
                            <input type="date" id="etv-edit-date" value="${dateVal}" class="w-full">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Uhrzeit</label>
                            <input type="time" id="etv-edit-time" value="${timeVal}" class="w-full">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Status</label>
                            <select id="etv-edit-status" class="w-full">${statusOptions}</select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Ort / Modus</label>
                            <input type="text" id="etv-edit-loc" value="${s.location || ''}" class="w-full">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Quorum (%)</label>
                            <input type="number" id="etv-edit-quorum" value="${s.quorum_percent ?? 50}" min="0" max="100" step="0.01" class="w-full">
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight flex gap-3">
                    <button onclick="document.getElementById('etv-settings-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveSessionSettings()" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Speichern</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvSaveSessionSettings = async () => {
    const fy   = document.getElementById('etv-edit-fy').value;
    const date = document.getElementById('etv-edit-date').value;
    const time = document.getElementById('etv-edit-time').value;
    const loc  = document.getElementById('etv-edit-loc').value;
    const status = document.getElementById('etv-edit-status').value;
    const quorum = parseFloat(document.getElementById('etv-edit-quorum')?.value) || 50;
    if (!date || !fy) { showToast('Bitte Datum und Jahr angeben.', 'error'); return; }
    const { error } = await _supabase.from('etv_sessions').update({
        fiscal_year: parseInt(fy),
        meeting_date: new Date(`${date}T${time || '00:00'}:00`).toISOString(),
        location: loc,
        status,
        quorum_percent: quorum
    }).eq('id', _etvState.sessionId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('etv-settings-modal').remove();
    showToast('Versammlung aktualisiert.', 'success');
    await _etvOpenSession(_etvState.sessionId);
};

window._etvCloseSession = async () => {
    const votedStatuses = ['approved', 'rejected', 'abstained', 'postponed', 'none'];
    const openTops = _etvState.agenda.filter(t => t.voting_type !== 'none' && !votedStatuses.includes(t.result_status));
    if (openTops.length > 0) {
        if (!confirm(`${openTops.length} TOP(s) wurden noch nicht abgestimmt. Trotzdem schließen?`)) return;
    } else {
        if (!confirm('Möchten Sie die Versammlung offiziell schließen? Danach sind keine Abstimmungen mehr möglich.')) return;
    }

    const { error } = await _supabase.from('etv_sessions').update({ status: 'closed' }).eq('id', _etvState.sessionId);
    if (!error) {
        showToast('Versammlung geschlossen. Bitte Protokoll in Tab 3 erstellen.', 'success');
        await _etvOpenSession(_etvState.sessionId);
        _etvSetTab('follow');
    }
};

window._etvOpenStaging = async () => {
    const bid = _etvState.buildingId;
    const session = _etvState.session;
    if (!bid || !session) { showToast('Keine aktive Versammlung.', 'error'); return; }
    const fy = session.fiscal_year;

    // Load apartments for this building
    const { data: apts } = await _supabase.from('apartments')
        .select('id, apartment_number, floor')
        .eq('building_id', bid)
        .order('apartment_number');

    if (!apts || apts.length === 0) {
        showToast('Keine Einheiten gefunden.', 'error');
        return;
    }

    // Check which staged files exist in Storage
    const checkFile = async (path) => {
        try {
            const { data } = await _supabase.storage.from('documents').createSignedUrl(path, 10);
            return !!data?.signedUrl;
        } catch { return false; }
    };

    const rows = await Promise.all(apts.map(async (apt) => {
        const wpPath  = `etv-staging/${bid}/${fy}/wp/${apt.id}.pdf`;
        const jabPath = `etv-staging/${bid}/${fy}/jab/${apt.id}.pdf`;
        const [hasWP, hasJAB] = await Promise.all([checkFile(wpPath), checkFile(jabPath)]);
        return { apt, hasWP, hasJAB };
    }));

    const badge = (ok) => ok
        ? `<span class="text-xs font-bold text-hb-success bg-hb-success/12 px-2 py-0.5 rounded-lg">Bereit</span>`
        : `<span class="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Fehlt</span>`;

    const tableRows = rows.map(r => `
        <tr class="border-b border-hb-olive/10">
            <td class="px-4 py-3 text-sm font-semibold">${r.apt.apartment_number || '—'}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${r.apt.floor || '—'}</td>
            <td class="px-4 py-3">${badge(r.hasWP)}</td>
            <td class="px-4 py-3">${badge(r.hasJAB)}</td>
        </tr>`).join('');

    const readyWP  = rows.filter(r => r.hasWP).length;
    const readyJAB = rows.filter(r => r.hasJAB).length;
    const total    = rows.length;

    const html = `
        <div id="etv-staging-modal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                <div class="bg-hb-olive p-6 rounded-t-2xl flex items-center justify-between">
                    <div>
                        <h3 class="text-white font-bold text-lg">Staging-Status ETV ${fy}</h3>
                        <p class="text-white/70 text-xs mt-0.5">Vorbereitete Dokumente je Einheit</p>
                    </div>
                    <button onclick="document.getElementById('etv-staging-modal').remove()" class="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div class="p-6 flex gap-6 border-b border-hb-olive/10">
                    <div class="text-center">
                        <div class="text-2xl font-black text-hb-olive">${readyWP}/${total}</div>
                        <div class="text-xs text-gray-500 font-bold uppercase tracking-widest">Wirtschaftspläne</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-hb-olive">${readyJAB}/${total}</div>
                        <div class="text-xs text-gray-500 font-bold uppercase tracking-widest">Jahresabrechnungen</div>
                    </div>
                    <div class="ml-auto text-right text-xs text-gray-400 leading-relaxed self-center">
                        Dokumente werden über<br>
                        <span class="font-bold text-hb-olive">Buchhaltung → Wirtschaftsplan</span><br>
                        bzw. <span class="font-bold text-hb-olive">Jahresabrechnung</span><br>
                        mit "Für ETV speichern" abgelegt.
                    </div>
                </div>
                <div class="overflow-y-auto flex-grow">
                    <table class="w-full">
                        <thead class="bg-gray-50 sticky top-0">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Lage</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Wirtschaftsplan</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Jahresabrechnung</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-hb-olive/10">${tableRows}</tbody>
                    </table>
                </div>
                <div class="p-4 bg-hb-ultralight rounded-b-2xl flex justify-end">
                    <button onclick="document.getElementById('etv-staging-modal').remove()" class="btn-secondary text-sm px-6 py-2">Schließen</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Responsive tables
    const stagingModal = document.getElementById('etv-staging-modal');
    if (stagingModal) makeTableResponsive(stagingModal);
};

// ─── PROTOKOLL-FORMALIA ──────────────────────────────────────

window._etvProtocolModal = () => {
    const s = _etvState.session;
    const nowTime = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    const html = `
        <div id="etv-protocol-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Protokoll-Formalia</h3>
                    <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">Erscheinen im Protokoll-PDF</p>
                </div>
                <div class="p-8 space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Tatsächlicher Beginn</label>
                            <input type="time" id="prot-start" value="${s.actual_start_time || nowTime}" class="w-full">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Tatsächliches Ende</label>
                            <input type="time" id="prot-end" value="${s.actual_end_time || ''}" class="w-full" placeholder="--:--">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Versammlungsleiter</label>
                        <input type="text" id="prot-chairman" value="${s.chairman_name || ''}" placeholder="Name des Versammlungsleiters" class="w-full">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Protokollführer</label>
                        <input type="text" id="prot-secretary" value="${s.secretary_name || ''}" placeholder="Name des Protokollführers" class="w-full">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Allgemeine Notizen</label>
                        <textarea id="prot-notes" rows="3" class="w-full" placeholder="Besondere Vorkommnisse, Hinweise zum Ablauf...">${s.general_notes || ''}</textarea>
                    </div>
                </div>
                <div class="p-6 bg-hb-ultralight flex gap-3 border-t border-hb-olive/5">
                    <button onclick="document.getElementById('etv-protocol-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveProtocolData()" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Speichern</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvSaveProtocolData = async () => {
    const startTime = document.getElementById('prot-start').value || null;
    const endTime   = document.getElementById('prot-end').value || null;
    const chairman  = document.getElementById('prot-chairman').value.trim() || null;
    const secretary = document.getElementById('prot-secretary').value.trim() || null;
    const notes     = document.getElementById('prot-notes').value.trim() || null;

    const { error } = await _supabase.from('etv_sessions').update({
        actual_start_time: startTime,
        actual_end_time: endTime,
        chairman_name: chairman,
        secretary_name: secretary,
        general_notes: notes
    }).eq('id', _etvState.sessionId);

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    _etvState.session.actual_start_time = startTime;
    _etvState.session.actual_end_time   = endTime;
    _etvState.session.chairman_name     = chairman;
    _etvState.session.secretary_name    = secretary;
    _etvState.session.general_notes     = notes;

    document.getElementById('etv-protocol-modal').remove();
    showToast('Protokoll-Daten gespeichert.', 'success');
    const ca = document.getElementById('etv-content');
    if (ca) ca.innerHTML = _etvRenderTabContent();
};

// ─── VOLLMACHTEN (PROXY) ────────────────────────────────────

window._etvOpenProxyModal = (personId) => {
    const group = _etvGroupedAttendance().find(g => g.person_id === personId);
    if (!group) return;
    const personName = group.person ? `${group.person.first_name} ${group.person.last_name}` : 'Unbekannt';
    const currentProxy = group.proxyName || '';
    const votingTops = _etvState.agenda.filter(t => t.voting_type !== 'none');
    const currentInstructions = group.attendances[0]?.instructions || {};
    window._etvProxyInstructions = { ...currentInstructions };

    const mkPI = (topId, val, label) => {
        const active = currentInstructions[topId] === val;
        const cls = active
            ? (val === 'yes' ? 'bg-hb-success text-white border-hb-success' : val === 'no' ? 'bg-hb-orange text-white border-hb-orange' : 'bg-gray-500 text-white border-gray-500')
            : 'bg-white text-gray-400 border-gray-200 hover:border-hb-olive/30';
        return `<button onclick="_etvSetProxyInstruction('${topId}','${val}')" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${cls}" id="pi-${topId}-${val}">${label}</button>`;
    };

    const topRows = votingTops.map(top => `
        <div class="flex items-center justify-between py-2.5 border-b border-hb-olive/8 last:border-0">
            <span class="text-xs font-bold text-hb-offblack flex-grow pr-4 leading-snug">TOP ${top.sort_order}: ${top.title}</span>
            <div class="flex gap-1.5 shrink-0">
                ${mkPI(top.id,'yes','JA')}
                ${mkPI(top.id,'no','NEIN')}
                ${mkPI(top.id,'abstain','ENTH.')}
            </div>
        </div>`).join('');

    const html = `
        <div id="etv-proxy-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Vollmacht erfassen</h3>
                    <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">${personName}</p>
                </div>
                <div class="p-6 space-y-5 flex-grow overflow-y-auto">
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Vertreten durch</label>
                        <input type="text" id="etv-proxy-name" value="${currentProxy}" placeholder="z.B. Hausverwaltung GmbH oder Max Mustermann" class="w-full">
                    </div>
                    ${votingTops.length ? `
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Vorab-Weisungen (optional)</label>
                        <p class="text-[11px] text-gray-400 mb-3 leading-relaxed">Gemäß schriftlicher Vollmacht vorausgefüllt — können bei Abstimmung noch angepasst werden.</p>
                        <div>${topRows}</div>
                    </div>` : ''}
                </div>
                <div class="p-6 bg-hb-ultralight border-t border-hb-olive/5 flex gap-3">
                    <button onclick="document.getElementById('etv-proxy-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveProxy('${personId}')" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Vollmacht speichern</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._etvSetProxyInstruction = (topId, vote) => {
    if (!window._etvProxyInstructions) window._etvProxyInstructions = {};
    if (window._etvProxyInstructions[topId] === vote) {
        delete window._etvProxyInstructions[topId];
    } else {
        window._etvProxyInstructions[topId] = vote;
    }
    for (const v of ['yes','no','abstain']) {
        const btn = document.getElementById(`pi-${topId}-${v}`);
        if (!btn) continue;
        const active = window._etvProxyInstructions[topId] === v;
        btn.className = `px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${active
            ? (v === 'yes' ? 'bg-hb-success text-white border-hb-success' : v === 'no' ? 'bg-hb-orange text-white border-hb-orange' : 'bg-gray-500 text-white border-gray-500')
            : 'bg-white text-gray-400 border-gray-200 hover:border-hb-olive/30'}`;
    }
};

window._etvSaveProxy = async (personId) => {
    const proxyName = document.getElementById('etv-proxy-name')?.value?.trim();
    if (!proxyName) { showToast('Bitte Namen des Vertreters eingeben.', 'error'); return; }
    const attIds = _etvState.attendance.filter(a => a.person_id === personId).map(a => a.id);
    if (attIds.length === 0) return;
    const instructions = window._etvProxyInstructions || {};
    const { error } = await _supabase.from('etv_attendance')
        .update({ proxy_name: proxyName, instructions, is_present: true })
        .in('id', attIds);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    for (const att of _etvState.attendance) {
        if (att.person_id === personId) {
            att.proxy_name = proxyName;
            att.instructions = instructions;
            att.is_present = true;
        }
    }
    document.getElementById('etv-proxy-modal').remove();
    showToast('Vollmacht gespeichert.', 'success');
    const modal = document.getElementById('etv-checkin-modal');
    if (modal) { modal.remove(); _etvOpenCheckinModal(); }
    _etvRenderMain();
};

window._etvClearProxy = async (personId) => {
    const attIds = _etvState.attendance.filter(a => a.person_id === personId).map(a => a.id);
    if (attIds.length === 0) return;
    const { error } = await _supabase.from('etv_attendance')
        .update({ proxy_name: null, instructions: null, is_present: false })
        .in('id', attIds);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    for (const att of _etvState.attendance) {
        if (att.person_id === personId) {
            att.proxy_name = null;
            att.instructions = null;
            att.is_present = false;
        }
    }
    showToast('Vollmacht entfernt.');
    const modal = document.getElementById('etv-checkin-modal');
    if (modal) { modal.remove(); _etvOpenCheckinModal(); }
    _etvRenderMain();
};

// ─── EINZELSTIMMEN ──────────────────────────────────────────

window._etvOpenIndividualVoting = (topId) => {
    _etvState.votingTopId = topId;
    const top = _etvState.agenda.find(t => t.id === topId);
    if (!top) return;
    _etvLoadVotesAndOpenModal(topId, top);
};

async function _etvLoadVotesAndOpenModal(topId, top) {
    const { data: existing } = await _supabase
        .from('etv_votes').select('apartment_id, vote').eq('agenda_item_id', topId);
    const voteMap = {};
    for (const v of (existing || [])) voteMap[v.apartment_id] = v.vote;

    const presentAtt = _etvState.attendance.filter(a => a.is_present);
    const draft = {};
    for (const att of presentAtt) {
        if (voteMap[att.apartment_id]) {
            draft[att.apartment_id] = voteMap[att.apartment_id];
        } else if (att.instructions?.[topId]) {
            draft[att.apartment_id] = att.instructions[topId];
        }
    }
    _etvState.votingDraft = draft;
    _etvShowVotingModal(topId, top, presentAtt);
}

function _etvShowVotingModal(topId, top, presentAtt) {
    const mkVBtn = (aptId, val, label) => {
        const active = _etvState.votingDraft[aptId] === val;
        const cls = active
            ? (val === 'yes' ? 'bg-hb-success text-white border-hb-success shadow' : val === 'no' ? 'bg-hb-orange text-white border-hb-orange shadow' : 'bg-gray-500 text-white border-gray-500 shadow')
            : 'bg-white text-gray-400 border-gray-200 hover:border-hb-olive/30';
        return `<button onclick="_etvSetDraftVote('${aptId}','${val}')" class="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 border ${cls}" id="dv-${aptId}-${val}">${label}</button>`;
    };

    const unitRows = presentAtt.map(att => {
        const apt = _etvState.apartments.find(a => a.id === att.apartment_id);
        const owner = _etvState.owners.find(o => o.apartment_id === att.apartment_id);
        const ownerName = owner?.person ? `${owner.person.first_name} ${owner.person.last_name}` : '';
        return `
            <div class="flex items-center justify-between py-3 border-b border-hb-olive/8 last:border-0">
                <div class="min-w-0 flex-grow pr-4">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="bg-hb-ultralight text-hb-olive rounded px-2 py-0.5 text-[10px] font-bold border border-hb-olive/10">WE ${apt?.apartment_number || '?'}</span>
                        <span class="text-xs font-bold text-hb-offblack">${ownerName}</span>
                        ${att.proxy_name ? `<span class="text-[9px] bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded font-black uppercase">Vollmacht</span>` : ''}
                        ${att.instructions?.[topId] ? `<span class="text-[9px] bg-hb-gold-bold/10 text-hb-gold-bold px-1.5 py-0.5 rounded font-black">Weisung</span>` : ''}
                    </div>
                    ${att.proxy_name ? `<div class="text-[10px] text-hb-olive font-bold mt-0.5">↳ ${att.proxy_name}</div>` : ''}
                </div>
                <div class="flex gap-1.5 shrink-0">
                    ${mkVBtn(att.apartment_id,'yes','JA')}
                    ${mkVBtn(att.apartment_id,'no','NEIN')}
                    ${mkVBtn(att.apartment_id,'abstain','ENTH.')}
                </div>
            </div>`;
    }).join('');

    const summary = _etvCalcResultStatus(presentAtt);
    const html = `
        <div id="etv-ivoting-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Einzelstimmen — TOP ${top.sort_order}</h3>
                    <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">${top.title}</p>
                </div>
                <div class="px-6 pt-4 pb-3 border-b border-hb-olive/10 flex items-center justify-between gap-4 flex-shrink-0">
                    <button onclick="_etvSetAllDraftVotes('yes')" class="px-4 py-2 bg-hb-success/10 text-hb-success border border-hb-success/20 rounded-xl text-xs font-black hover:bg-hb-success hover:text-white transition-all">Alle auf JA setzen</button>
                    <div id="etv-vote-summary" class="text-[10px] font-bold text-gray-500 text-right">${summary.text}</div>
                </div>
                <div class="flex-grow overflow-y-auto px-6 py-2">
                    ${presentAtt.length === 0
                        ? '<p class="py-8 text-center text-sm text-gray-400 italic">Keine eingecheckten Einheiten.</p>'
                        : unitRows}
                </div>
                <div class="p-6 bg-hb-ultralight border-t border-hb-olive/5 flex gap-3">
                    <button onclick="document.getElementById('etv-ivoting-modal').remove()" class="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-hb-offblack transition-colors">Abbrechen</button>
                    <button onclick="_etvSaveIndividualVotes('${topId}')" class="flex-[2] bg-hb-olive text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all">Abstimmung speichern</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window._etvSetDraftVote = (aptId, vote) => {
    if (_etvState.votingDraft[aptId] === vote) {
        delete _etvState.votingDraft[aptId];
    } else {
        _etvState.votingDraft[aptId] = vote;
    }
    for (const v of ['yes','no','abstain']) {
        const btn = document.getElementById(`dv-${aptId}-${v}`);
        if (!btn) continue;
        const active = _etvState.votingDraft[aptId] === v;
        btn.className = `px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 border ${active
            ? (v === 'yes' ? 'bg-hb-success text-white border-hb-success shadow' : v === 'no' ? 'bg-hb-orange text-white border-hb-orange shadow' : 'bg-gray-500 text-white border-gray-500 shadow')
            : 'bg-white text-gray-400 border-gray-200 hover:border-hb-olive/30'}`;
    }
    const presentAtt = _etvState.attendance.filter(a => a.is_present);
    const el = document.getElementById('etv-vote-summary');
    if (el) el.textContent = _etvCalcResultStatus(presentAtt).text;
};

window._etvSetAllDraftVotes = (vote) => {
    const presentAtt = _etvState.attendance.filter(a => a.is_present);
    for (const att of presentAtt) {
        _etvState.votingDraft[att.apartment_id] = vote;
        for (const v of ['yes','no','abstain']) {
            const btn = document.getElementById(`dv-${att.apartment_id}-${v}`);
            if (!btn) continue;
            const active = v === vote;
            btn.className = `px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 border ${active
                ? (v === 'yes' ? 'bg-hb-success text-white border-hb-success shadow' : v === 'no' ? 'bg-hb-orange text-white border-hb-orange shadow' : 'bg-gray-500 text-white border-gray-500 shadow')
                : 'bg-white text-gray-400 border-gray-200 hover:border-hb-olive/30'}`;
        }
    }
    const el = document.getElementById('etv-vote-summary');
    if (el) el.textContent = _etvCalcResultStatus(presentAtt).text;
};

function _etvCalcResultStatus(presentAtt) {
    const draft = _etvState.votingDraft;
    let yesCount = 0, noCount = 0, abstainCount = 0, emptyCount = 0;
    let yesMEA = 0, noMEA = 0;
    for (const att of presentAtt) {
        const apt = _etvState.apartments.find(a => a.id === att.apartment_id);
        const mea = apt?.mea_numerator || 0;
        const v = draft[att.apartment_id];
        if (v === 'yes')         { yesCount++;     yesMEA += mea; }
        else if (v === 'no')     { noCount++;      noMEA  += mea; }
        else if (v === 'abstain') abstainCount++;
        else                      emptyCount++;
    }
    let text = `JA: ${yesCount} · NEIN: ${noCount} · ENTH: ${abstainCount}`;
    if (emptyCount > 0) text += ` · Offen: ${emptyCount}`;
    return { text, yesCount, noCount, abstainCount, emptyCount, yesMEA, noMEA };
}

window._etvSaveIndividualVotes = async (topId) => {
    const top = _etvState.agenda.find(t => t.id === topId);
    if (!top) return;
    const presentAtt = _etvState.attendance.filter(a => a.is_present);
    const draft = _etvState.votingDraft;
    const unvoted = presentAtt.filter(a => !draft[a.apartment_id]);
    if (unvoted.length > 0) {
        if (!confirm(`${unvoted.length} Einheit(en) ohne Stimme. Trotzdem speichern?`)) return;
    }

    await _supabase.from('etv_votes').delete().eq('agenda_item_id', topId);

    const inserts = presentAtt.filter(a => draft[a.apartment_id]).map(a => {
        const apt = _etvState.apartments.find(ap => ap.id === a.apartment_id);
        return {
            agenda_item_id:    topId,
            apartment_id:      a.apartment_id,
            vote:              draft[a.apartment_id],
            weight_mea:        apt?.mea_numerator || 0,
            cast_by_person_id: a.person_id || null
        };
    });
    if (inserts.length > 0) {
        const { error: vErr } = await _supabase.from('etv_votes').insert(inserts);
        if (vErr) { showToast('Fehler: ' + vErr.message, 'error'); return; }
    }

    const calc     = _etvCalcResultStatus(presentAtt);
    const totalMEA = _etvState.apartments.reduce((s, a) => s + (a.mea_numerator || 0), 0);
    let resultStatus;
    if (top.majority_type === 'unanimous') {
        resultStatus = (calc.yesCount === presentAtt.length && calc.emptyCount === 0) ? 'approved' : 'rejected';
    } else if (top.majority_type === 'double_qualified') {
        resultStatus = (calc.yesMEA > totalMEA / 2) ? 'approved' : 'rejected';
    } else if (top.majority_type === 'qualified') {
        const voted = calc.yesCount + calc.noCount + calc.abstainCount;
        resultStatus = voted > 0 && (calc.yesCount / voted > 0.75) ? 'approved' : 'rejected';
    } else {
        resultStatus = calc.yesCount > calc.noCount ? 'approved' : (calc.yesCount === calc.noCount && calc.abstainCount > 0 ? 'abstained' : 'rejected');
    }

    await _supabase.from('etv_agenda_items').update({ result_status: resultStatus }).eq('id', topId);
    document.getElementById('etv-ivoting-modal').remove();
    showToast('Abstimmung gespeichert.', 'success');
    _etvOpenSession(_etvState.sessionId);
};

// ════════════════════════════════════════════════════════════════
// BESCHLUSSSAMMLUNG §24 Abs. 7 WEG
// ════════════════════════════════════════════════════════════════

const _beschState = {
    buildingId: null,
    data:       [],
    anfragen:   [],
    activeTab:  'list'
};

async function loadBeschluesse() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    if (!_etvState.buildings.length) {
        const { data } = await _supabase.from('buildings').select('id, name, street, house_number, city').order('name');
        _etvState.buildings = data || [];
    }
    if (!_etvState.buildings.length) {
        ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10"><p class="text-[15px] text-gray-500">Keine Gebäude gefunden.</p></div>`;
        return;
    }
    if (!_beschState.buildingId || !_etvState.buildings.find(b => b.id === _beschState.buildingId)) {
        const urlBuilding = new URLSearchParams(window.location.search).get('building');
        const sessionBuilding = sessionStorage.getItem('hb_active_building');
        const targetId = urlBuilding || sessionBuilding;
        _beschState.buildingId = (targetId && _etvState.buildings.find(b => b.id == targetId))
            ? Number(targetId)
            : _etvState.buildings[0].id;
    }

    ca.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] text-left">
            <div class="w-full lg:w-56 xl:w-64 flex-shrink-0 flex flex-col h-full">
                <div class="card flex flex-col h-full overflow-hidden">
                    <div class="px-4 py-3 bg-hb-olive"><h2 class="text-sm font-bold text-white">Objekte</h2></div>
                    <div id="besch-buildings-list" class="flex-grow overflow-y-auto p-2 space-y-0.5"></div>
                </div>
            </div>
            <div class="flex-1 flex flex-col h-full min-w-0" id="besch-main-area">
                <div class="flex justify-center py-10"><div class="w-6 h-6 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        </div>`;

    _beschRenderBuildingList();
    await _beschSelectBuilding(_beschState.buildingId);
}

function _beschRenderBuildingList() {
    const list = document.getElementById('besch-buildings-list');
    if (!list) return;
    list.innerHTML = _etvState.buildings.map(b => `
        <div onclick="_beschSelectBuilding(${b.id})" id="besch-b-item-${b.id}"
            class="px-3 py-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-all text-left group">
            <p class="font-bold text-xs text-hb-offblack truncate group-hover:text-hb-olive">${formatBuildingName(b)}</p>
            <p class="text-[10px] text-gray-400 truncate">${b.street ? `${b.street} ${b.house_number || ''}` : (b.city || '')}</p>
        </div>`).join('') || '<p class="text-xs text-gray-400 p-3">Keine Gebäude.</p>';
    document.querySelectorAll('[id^="besch-b-item-"]').forEach(el => el.classList.remove('bg-hb-ultralight'));
    const sel = document.getElementById(`besch-b-item-${_beschState.buildingId}`);
    if (sel) sel.classList.add('bg-hb-ultralight');
}

window._beschSelectBuilding = async (id) => {
    _beschState.buildingId = Number(id);
    sessionStorage.setItem('hb_active_building', String(id));
    document.querySelectorAll('[id^="besch-b-item-"]').forEach(el => el.classList.remove('bg-hb-ultralight'));
    const sel = document.getElementById(`besch-b-item-${id}`);
    if (sel) sel.classList.add('bg-hb-ultralight');
    await _beschLoadAndRender();
};

async function _beschLoadAndRender() {
    const area = document.getElementById('besch-main-area');
    if (!area) return;
    area.innerHTML = `<div class="flex justify-center py-10"><div class="w-6 h-6 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const bid = _beschState.buildingId;
    const building = _etvState.buildings.find(b => b.id === bid);

    const [beschRes, anfragenRes] = await Promise.all([
        _supabase.from('beschluesse').select('*').eq('building_id', bid).order('beschluss_datum', { ascending: true }).order('beschluss_nr', { ascending: true }),
        _supabase.from('tickets').select('id, title, created_at, creator_id, profiles!creator_id(full_name)').eq('building_id', bid).eq('category', 'Beschlusssammlung-Anfrage').eq('status', 'Offen')
    ]);
    _beschState.data     = beschRes.data || [];
    _beschState.anfragen = anfragenRes.data || [];

    const openCount = _beschState.anfragen.length;
    area.innerHTML = `
        <div class="flex flex-col h-full gap-4">
            <div class="flex gap-1 bg-white rounded-2xl p-1 shadow-soft border border-hb-olive/12 w-fit shrink-0">
                <button onclick="_beschSetTab('list')" id="besch-tab-list"
                    class="px-5 py-2 rounded-xl text-xs font-black transition-all ${_beschState.activeTab === 'list' ? 'bg-hb-olive text-white' : 'text-gray-500 hover:bg-gray-50'}">
                    Beschlüsse (${_beschState.data.length})
                </button>
                <button onclick="_beschSetTab('anfragen')" id="besch-tab-anfragen"
                    class="px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${_beschState.activeTab === 'anfragen' ? 'bg-hb-olive text-white' : 'text-gray-500 hover:bg-gray-50'}">
                    Anfragen${openCount > 0 ? ` <span class="bg-hb-orange text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">${openCount}</span>` : ''}
                </button>
            </div>
            <div id="besch-content" class="flex-1 min-h-0 overflow-y-auto card">
                ${_beschState.activeTab === 'list' ? _beschRenderListHtml(building) : _beschRenderAnfragenHtml()}
            </div>
        </div>`;
}

window._beschSetTab = (tab) => {
    _beschState.activeTab = tab;
    const building = _etvState.buildings.find(b => b.id === _beschState.buildingId);
    document.getElementById('besch-content').innerHTML = tab === 'list' ? _beschRenderListHtml(building) : _beschRenderAnfragenHtml();
    const tabs = { list: 'besch-tab-list', anfragen: 'besch-tab-anfragen' };
    Object.entries(tabs).forEach(([t, elId]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.className = `px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${t === tab ? 'bg-hb-olive text-white' : 'text-gray-500 hover:bg-gray-50'}`;
    });
};

function _beschRenderListHtml(building) {
    const artLabel = { etv: 'ETV', umlauf: 'Umlauf', sonstig: 'Sonstig' };
    const statusBadge = (s) => {
        if (s === 'angefochten') return `<span class="px-2 py-0.5 text-[9px] font-black uppercase bg-hb-orange/10 text-hb-orange rounded-md border border-hb-orange/20">Angefochten</span>`;
        if (s === 'nichtig')     return `<span class="px-2 py-0.5 text-[9px] font-black uppercase bg-gray-100 text-gray-400 rounded-md border border-gray-200">Nichtig</span>`;
        if (s === 'aufgehoben') return `<span class="px-2 py-0.5 text-[9px] font-black uppercase bg-hb-error/10 text-hb-error rounded-md border border-hb-error/20">Aufgehoben</span>`;
        return `<span class="px-2 py-0.5 text-[9px] font-black uppercase bg-hb-success/10 text-hb-success rounded-md border border-hb-success/20">Aktiv</span>`;
    };
    const ergebnisLabel = { angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', einstimmig: 'Einstimmig' };

    const rows = _beschState.data.length
        ? _beschState.data.map(b => `
            <tr class="border-b border-hb-olive/8 hover:bg-hb-ultralight/60 transition-colors">
                <td class="p-3 text-xs font-black text-hb-olive whitespace-nowrap" data-label="Nr.">${b.beschluss_nr}</td>
                <td class="p-3 text-xs text-gray-600 whitespace-nowrap" data-label="Datum">${new Date(b.beschluss_datum).toLocaleDateString('de-DE')}</td>
                <td class="p-3" data-label="Art"><span class="px-2 py-0.5 text-[9px] font-black uppercase bg-hb-olive/10 text-hb-olive rounded-md">${artLabel[b.art] || b.art}</span></td>
                <td class="p-3 text-sm text-hb-offblack" data-label="Beschluss"><div class="line-clamp-2">${b.beschluss_text}</div></td>
                <td class="p-3 text-xs text-gray-500 whitespace-nowrap" data-label="Ergebnis">${ergebnisLabel[b.ergebnis] || b.ergebnis || '—'}</td>
                <td class="p-3" data-label="Status">${statusBadge(b.status)}</td>
                <td class="p-3 td-action">
                    <button onclick="_beschDetailModal(${b.id})" class="text-hb-olive text-[11px] font-black hover:underline">Details</button>
                </td>
            </tr>`).join('')
        : `<tr><td colspan="7" class="p-10 text-center text-[15px] text-gray-400">Noch keine Beschlüsse eingetragen.</td></tr>`;

    return `
        <div class="p-4 bg-hb-olive flex justify-between items-center gap-3">
            <p class="text-sm font-bold text-white">${building ? formatBuildingName(building) : 'Beschlüsse'}</p>
            <div class="flex gap-2">
                <button onclick="_beschRenumber()" title="Neu durchnummerieren" class="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">↕ Neu nummerieren</button>
                <button onclick="_beschNewModal()" class="bg-white text-hb-olive px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-hb-ultralight transition-all">+ Neuer Beschluss</button>
            </div>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead><tr class="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wide">
                    <th class="p-3">Nr.</th><th class="p-3">Datum</th><th class="p-3">Art</th>
                    <th class="p-3">Beschlusstext</th><th class="p-3">Ergebnis</th>
                    <th class="p-3">Status</th><th class="p-3"></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function _beschRenderAnfragenHtml() {
    if (!_beschState.anfragen.length) {
        return `<div class="p-4 bg-hb-olive"><p class="text-sm font-bold text-white">Offene Anfragen</p></div>
                <div class="p-10 text-center text-[15px] text-gray-400">Keine offenen Anfragen.</div>`;
    }
    const rows = _beschState.anfragen.map(t => `
        <tr class="border-b border-hb-olive/8 hover:bg-hb-ultralight/60">
            <td class="p-3 text-sm font-bold text-hb-offblack" data-label="Anfragender">${t.profiles?.full_name || '—'}</td>
            <td class="p-3 text-xs text-gray-500" data-label="Datum">${new Date(t.created_at).toLocaleDateString('de-DE')}</td>
            <td class="p-3 td-action">
                <button onclick="_beschGenAndRelease(${t.id}, '${t.creator_id}')" class="bg-hb-olive text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-hb-olive/80 transition-all">
                    PDF freigeben
                </button>
            </td>
        </tr>`).join('');
    return `
        <div class="p-4 bg-hb-olive"><p class="text-sm font-bold text-white">Offene Anfragen</p></div>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead><tr class="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wide">
                    <th class="p-3">Anfragender</th><th class="p-3">Datum</th><th class="p-3"></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// ─── Neuer Beschluss Modal ─────────────────────────────────────

window._beschNewModal = () => {
    const year = new Date().getFullYear();
    const countThisYear = _beschState.data.filter(b => b.beschluss_datum?.startsWith(String(year))).length;
    const suggestedNr = `${year}/${String(countThisYear + 1).padStart(3, '0')}`;

    showModal('besch-new-modal', `
        <div class="p-5 bg-hb-olive text-white">
            <h3 class="text-lg font-black">Neuer Beschluss</h3>
        </div>
        <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Beschluss-Nr.</label>
                    <input type="text" id="besch-new-nr" value="${suggestedNr}" class="w-full">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Datum</label>
                    <input type="date" id="besch-new-datum" value="${new Date().toISOString().split('T')[0]}" class="w-full">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Art</label>
                    <select id="besch-new-art" class="w-full">
                        <option value="etv">ETV-Beschluss</option>
                        <option value="umlauf">Umlaufbeschluss</option>
                        <option value="sonstig">Sonstiger Beschluss</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Ergebnis</label>
                    <select id="besch-new-ergebnis" class="w-full">
                        <option value="angenommen">Angenommen</option>
                        <option value="einstimmig">Einstimmig angenommen</option>
                        <option value="abgelehnt">Abgelehnt</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1">Beschlusstext *</label>
                <textarea id="besch-new-text" rows="4" placeholder="Vollständiger Wortlaut des Beschlusses..." class="w-full" style="height:auto"></textarea>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ja-Stimmen</label>
                    <input type="number" id="besch-new-ja" min="0" class="w-full" placeholder="—">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nein-Stimmen</label>
                    <input type="number" id="besch-new-nein" min="0" class="w-full" placeholder="—">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Enthaltungen</label>
                    <input type="number" id="besch-new-enthaltung" min="0" class="w-full" placeholder="—">
                </div>
            </div>
            <div class="flex gap-3 pt-2">
                <button onclick="hideModal('besch-new-modal')" class="btn-secondary flex-1">Abbrechen</button>
                <button onclick="_beschSaveNew()" class="btn-primary flex-1">Speichern</button>
            </div>
        </div>
    `);
};

window._beschSaveNew = async () => {
    const text = document.getElementById('besch-new-text')?.value?.trim();
    const datum = document.getElementById('besch-new-datum')?.value;
    const nr    = document.getElementById('besch-new-nr')?.value?.trim();
    if (!text || !datum || !nr) { showToast('Beschlusstext, Datum und Nr. sind Pflichtfelder.', 'error'); return; }

    const { error } = await _supabase.from('beschluesse').insert({
        building_id:           _beschState.buildingId,
        beschluss_nr:          nr,
        beschluss_datum:       datum,
        art:                   document.getElementById('besch-new-art')?.value || 'etv',
        beschluss_text:        text,
        ergebnis:              document.getElementById('besch-new-ergebnis')?.value || 'angenommen',
        abstimmung_ja:         Number(document.getElementById('besch-new-ja')?.value) || null,
        abstimmung_nein:       Number(document.getElementById('besch-new-nein')?.value) || null,
        abstimmung_enthaltung: Number(document.getElementById('besch-new-enthaltung')?.value) || null,
        created_by:            currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('besch-new-modal');
    showToast('Beschluss eingetragen.', 'success');
    await _beschLoadAndRender();
};

// ─── Detail / Status-Änderung Modal ───────────────────────────

window._beschDetailModal = (id) => {
    const b = _beschState.data.find(x => x.id === id);
    if (!b) return;
    const artLabel = { etv: 'ETV-Beschluss', umlauf: 'Umlaufbeschluss', sonstig: 'Sonstiger Beschluss' };
    const ergebnisLabel = { angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', einstimmig: 'Einstimmig angenommen' };
    const abstimmung = [b.abstimmung_ja != null ? `${b.abstimmung_ja} Ja` : null, b.abstimmung_nein != null ? `${b.abstimmung_nein} Nein` : null, b.abstimmung_enthaltung != null ? `${b.abstimmung_enthaltung} Enth.` : null].filter(Boolean).join(' / ') || '—';

    showModal('besch-detail-modal', `
        <div class="p-5 bg-hb-olive text-white flex justify-between items-center">
            <div>
                <h3 class="text-lg font-black">Beschluss ${b.beschluss_nr}</h3>
                <p class="text-xs opacity-70">${new Date(b.beschluss_datum).toLocaleDateString('de-DE')} · ${artLabel[b.art] || b.art}</p>
            </div>
        </div>
        <div class="p-5 space-y-4">
            <div class="bg-hb-ultralight rounded-2xl p-4">
                <p class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-2">Beschlusstext</p>
                <p class="text-sm text-hb-offblack leading-relaxed">${b.beschluss_text}</p>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-[10px] font-black text-gray-400 uppercase block mb-1">Ergebnis</span>${ergebnisLabel[b.ergebnis] || b.ergebnis || '—'}</div>
                <div><span class="text-[10px] font-black text-gray-400 uppercase block mb-1">Abstimmung</span>${abstimmung}</div>
                <div><span class="text-[10px] font-black text-gray-400 uppercase block mb-1">Status</span>${b.status}</div>
                ${b.status_notiz ? `<div class="col-span-2"><span class="text-[10px] font-black text-gray-400 uppercase block mb-1">Statusnotiz</span>${b.status_notiz}</div>` : ''}
            </div>
            ${b.status === 'aktiv' ? `
            <div class="border-t border-gray-100 pt-4">
                <p class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-3">Status ändern</p>
                <div class="space-y-3">
                    <select id="besch-new-status-val" class="w-full">
                        <option value="angefochten">Angefochten</option>
                        <option value="nichtig">Nichtig</option>
                        <option value="aufgehoben">Gerichtlich aufgehoben</option>
                    </select>
                    <textarea id="besch-new-status-notiz" rows="2" placeholder="Begründung / Aktenzeichen..." class="w-full" style="height:auto"></textarea>
                    <button onclick="_beschSaveStatus(${id})" class="btn-primary w-full">Status speichern</button>
                </div>
            </div>` : ''}
            <button onclick="hideModal('besch-detail-modal')" class="btn-secondary w-full">Schließen</button>
        </div>
    `);
};

window._beschSaveStatus = async (id) => {
    const status = document.getElementById('besch-new-status-val')?.value;
    const notiz  = document.getElementById('besch-new-status-notiz')?.value?.trim();
    if (!notiz) { showToast('Bitte Begründung angeben.', 'error'); return; }

    const { error } = await _supabase.from('beschluesse').update({
        status, status_notiz: notiz, status_datum: new Date().toISOString().split('T')[0]
    }).eq('id', id);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('besch-detail-modal');
    showToast('Status aktualisiert.', 'success');
    await _beschLoadAndRender();
};

// ─── Neu durchnummerieren ──────────────────────────────────────

window._beschRenumber = async () => {
    if (_beschState.data.length === 0) { showToast('Keine Beschlüsse vorhanden.', 'info'); return; }
    if (!confirm('Alle Beschlüsse chronologisch neu nummerieren (JJJJ/NNN)? Die bestehenden Nummern werden überschrieben.')) return;

    // Gruppieren nach Jahr des Beschlussdatums, dann nummerieren
    const grouped = {};
    [..._beschState.data]
        .sort((a, b) => a.beschluss_datum.localeCompare(b.beschluss_datum))
        .forEach(b => {
            const year = b.beschluss_datum.split('-')[0];
            if (!grouped[year]) grouped[year] = [];
            grouped[year].push(b);
        });

    const updates = [];
    Object.entries(grouped).forEach(([year, items]) => {
        items.forEach((item, i) => {
            updates.push({ id: item.id, nr: `${year}/${String(i + 1).padStart(3, '0')}` });
        });
    });

    let hadError = false;
    for (const upd of updates) {
        const { error } = await _supabase.from('beschluesse').update({ beschluss_nr: upd.nr }).eq('id', upd.id);
        if (error) { hadError = true; }
    }
    showToast(hadError ? 'Teilweise Fehler beim Nummerieren.' : `${updates.length} Beschlüsse neu nummeriert.`, hadError ? 'error' : 'success');
    await _beschLoadAndRender();
};

// ─── Transfer aus ETV-Session ─────────────────────────────────

window._beschTransferFromSession = async (sessionId) => {
    if (!sessionId) return;
    const session = _etvState.session;
    const agenda  = _etvState.agenda || [];
    // Alle TOPs mit Abstimmung — "Kein Beschluss notwendig" ausschließen
    const votingTops = agenda.filter(a => a.voting_type !== 'none');

    if (!votingTops.length) {
        showToast('Keine abstimmungsfähigen TOPs in dieser Versammlung.', 'info');
        return;
    }

    // Prüfen welche TOPs bereits übertragen wurden
    const { data: existing } = await _supabase.from('beschluesse').select('top_id').eq('building_id', _etvState.buildingId).not('top_id', 'is', null);
    const existingTopIds = new Set((existing || []).map(e => e.top_id));
    const toTransfer = votingTops.filter(a => !existingTopIds.has(a.id));

    if (!toTransfer.length) {
        showToast('Alle TOPs wurden bereits übertragen.', 'info');
        return;
    }

    const meetingDate = session?.meeting_date ? new Date(session.meeting_date) : new Date();
    const year = meetingDate.getFullYear();
    const existingCount = _beschState.data.filter(b => b.beschluss_datum?.startsWith(String(year))).length;

    const resultLabel = { approved: 'Angenommen', rejected: 'Abgelehnt', abstained: 'Enthaltung', pending: 'Ausstehend' };
    const rows = toTransfer.map((top, i) => {
        const votes = (_etvState.votes || []).filter(v => v.agenda_item_id === top.id);
        const ja = votes.filter(v => v.vote === 'yes').length;
        const nein = votes.filter(v => v.vote === 'no').length;
        const enth = votes.filter(v => v.vote === 'abstain').length;
        const einstimmig = nein === 0 && enth === 0 && ja > 0;
        const ergebnis = top.result_status === 'approved' ? (einstimmig ? 'einstimmig' : 'angenommen') : top.result_status === 'rejected' ? 'abgelehnt' : 'angenommen';
        return { top, ja, nein, enth, einstimmig, ergebnis, suggestedNr: `${year}/${String(existingCount + i + 1).padStart(3, '0')}` };
    });

    const tableRows = rows.map((r, i) => {
        const statusColor = r.top.result_status === 'approved' ? 'text-hb-success' : r.top.result_status === 'rejected' ? 'text-hb-error' : 'text-hb-gold-bold';
        return `
        <tr class="border-b border-gray-100">
            <td class="p-2"><input type="text" id="besch-tr-nr-${i}" value="${r.suggestedNr}" class="w-24 text-xs px-2 py-1" style="height:32px"></td>
            <td class="p-2 text-xs font-bold text-hb-offblack max-w-xs"><div class="line-clamp-2">${r.top.sort_order} ${r.top.title}</div></td>
            <td class="p-2 text-xs text-gray-500 whitespace-nowrap">${r.ja}/${r.nein}/${r.enth}</td>
            <td class="p-2 text-xs font-bold ${statusColor}">${resultLabel[r.top.result_status] || '—'}</td>
            <td class="p-2"><input type="checkbox" id="besch-tr-check-${i}" checked class="w-4 h-4" style="height:16px;width:16px"></td>
        </tr>`;
    }).join('');

    showModal('besch-transfer-modal', `
        <div class="p-5 bg-hb-olive text-white">
            <h3 class="text-lg font-black">Beschlüsse übertragen</h3>
            <p class="text-xs opacity-70 mt-1">${toTransfer.length} TOPs zur Übertragung bereit</p>
        </div>
        <div class="p-5 space-y-4">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead><tr class="text-[10px] font-black text-gray-400 uppercase border-b border-gray-100">
                        <th class="p-2">Nr.</th><th class="p-2">TOP</th><th class="p-2">Ja/Nein/Enth.</th><th class="p-2">Ergebnis</th><th class="p-2">✓</th>
                    </tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="flex gap-3 pt-2">
                <button onclick="hideModal('besch-transfer-modal')" class="btn-secondary flex-1">Abbrechen</button>
                <button onclick="_beschDoTransfer()" class="btn-primary flex-1">Übertragen</button>
            </div>
        </div>
    `);

    // Attach rows data to window for the confirm button
    window._beschTransferRows = rows;
};

window._beschDoTransfer = async () => {
    const rowsMeta = window._beschTransferRows || [];
    const inserts = [];
    rowsMeta.forEach((r, i) => {
        const checked = document.getElementById(`besch-tr-check-${i}`)?.checked;
        if (!checked) return;
        const nr = document.getElementById(`besch-tr-nr-${i}`)?.value?.trim() || r.suggestedNr;
        const session = _etvState.session;
        const datum = session?.meeting_date ? session.meeting_date.split('T')[0] : new Date().toISOString().split('T')[0];
        inserts.push({
            building_id:           _etvState.buildingId,
            beschluss_nr:          nr,
            beschluss_datum:       datum,
            art:                   'etv',
            beschluss_text:        r.top.proposed_resolution || r.top.title,
            ergebnis:              r.ergebnis || (r.einstimmig ? 'einstimmig' : 'angenommen'),
            abstimmung_ja:         r.ja || null,
            abstimmung_nein:       r.nein || null,
            abstimmung_enthaltung: r.enth || null,
            etv_session_id:        _etvState.sessionId,
            top_id:                r.topId,
            created_by:            currentUser.id,
        });
    });

    if (!inserts.length) { hideModal('besch-transfer-modal'); return; }

    const { error } = await _supabase.from('beschluesse').insert(inserts);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('besch-transfer-modal');
    showToast(`${inserts.length} Beschluss/Beschlüsse übertragen.`, 'success');
};

// ─── PDF freigeben für Anfrage ─────────────────────────────────

window._beschGenAndRelease = async (ticketId, creatorId) => {
    const building = _etvState.buildings.find(b => b.id === _beschState.buildingId);
    if (!building) return;

    if (_beschState.data.length === 0) {
        showToast('Keine Beschlüsse vorhanden — bitte zuerst Einträge vornehmen.', 'error');
        return;
    }

    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = 'Wird generiert…'; }

    try {
        // PDF generieren
        const pdfBytes = await generateBeschlussPDF(building, _beschState.data);

        // Storage Upload
        const dateStr = new Date().toISOString().split('T')[0];
        const filePath = `${_beschState.buildingId}/Beschlusssammlung_${dateStr}_${Date.now()}.pdf`;
        const { error: upErr } = await _supabase.storage.from('documents').upload(filePath, pdfBytes, {
            contentType: 'application/pdf', upsert: false
        });
        if (upErr) throw upErr;

        // Dokument-Eintrag
        const { data: doc, error: docErr } = await _supabase.from('documents').insert({
            title:             `Beschlusssammlung ${building.name || building.file_number} (${dateStr})`,
            document_title:    `Beschlusssammlung ${dateStr}`,
            original_filename: `Beschlusssammlung_${dateStr}.pdf`,
            category:          'Beschlusssammlung',
            file_path:         filePath,
            file_type:         'application/pdf',
            file_size:         pdfBytes.byteLength,
            year:              new Date().getFullYear(),
            visibility_scope:  'person',
            building_id:       _beschState.buildingId,
            uploaded_by:       currentUser.id,
            status:            'active',
            is_deleted:        false,
        }).select('id').single();
        if (docErr) throw docErr;

        // document_link für anfragenden Eigentümer
        await _supabase.from('document_links').insert({ document_id: doc.id, profile_id: creatorId });

        // Ticket schließen
        await _supabase.from('tickets').update({ status: 'Erledigt' }).eq('id', ticketId);

        showToast('PDF erstellt und freigegeben.', 'success');
        await _beschLoadAndRender();
    } catch (err) {
        console.error(err);
        showToast('Fehler beim Generieren: ' + (err.message || err), 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'PDF freigeben'; }
    }
};

// ─── Owner: Kopie anfordern (wird von mod-dokumente.js aufgerufen) ─

window._beschRequestCopy = async (buildingId) => {
    if (!buildingId) { showToast('Bitte zuerst ein Gebäude auswählen.', 'error'); return; }

    const bid = Number(buildingId);
    const building = (_etvState.buildings || []).find(b => b.id === bid);
    const buildingName = building ? formatBuildingName(building) : `Objekt ${bid}`;

    const { data: ticket, error } = await _supabase.from('tickets').insert({
        title:       `Beschlusssammlung angefordert — ${buildingName}`,
        description: `Eine Kopie der Beschlusssammlung für ${buildingName} wurde angefordert.`,
        category:    'Beschlusssammlung-Anfrage',
        status:      'Offen',
        building_id: bid,
        creator_id:  currentUser.id,
        tenant_id:   currentUser.id,
    }).select('id').single();

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    // Standard-Benachrichtigung an Admin/Manager
    if (ticket?.id) {
        sendNotification('ticket_new', { ticket_id: ticket.id, building_id: bid, title: `Beschlusssammlung angefordert — ${buildingName}` });
    }

    showToast('Anfrage gesendet. Der Verwalter stellt Ihnen die Beschlusssammlung zeitnah bereit.', 'success');
};

