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
    selectedTopId: null, // aktiver TOP im rechten Detail-Panel der Durchführung
    sidebarCollapsed: true, // Quorum/Anwesenheits-Sidebar in der Durchführung
    activeTab: 'prep' // prep (Vorbereitung), exec (Durchführung), follow (Nachbereitung)
};

/**
 * Haupt-Einstiegspunkt: Lädt die ETV-Übersicht
 */
async function loadETV() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const { data: buildings } = await _supabase.from('buildings').select('id, name, file_number, street, house_number').order('name');
    _etvState.buildings = buildings || [];
    if (_etvState.buildings.length === 0) {
        ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10"><p class="text-[15px] text-gray-500">Keine Gebäude gefunden.</p></div>`;
        return;
    }
    if (!_etvState.buildingId || !_etvState.buildings.find(b => b.id === _etvState.buildingId)) {
        // Building-Kontext: URL-Param > sessionStorage > erster in Liste
        const urlBuilding = new URLSearchParams(window.location.search).get('building');
        const sessionBuilding = sessionStorage.getItem('hb_active_building');
        const targetId = urlBuilding || sessionBuilding;
        if (targetId && _etvState.buildings.find(b => b.id == targetId)) {
            _etvState.buildingId = Number(targetId);
        } else {
            _etvState.buildingId = _etvState.buildings[0].id;
        }
    }
    await _etvInitOverview();
}

/**
 * Lädt alle Versammlungen eines Gebäudes
 */
async function _etvInitOverview() {
    const bid = _etvState.buildingId;
    const { data: sessions, error } = await _supabase
        .from('etv_sessions')
        .select('*')
        .eq('building_id', bid)
        .order('meeting_date', { ascending: false });

    if (error) { showToast('Fehler beim Laden der ETVs: ' + error.message, 'error'); return; }

    const buildingOpts = _etvState.buildings.map(b =>
        `<option value="${b.id}" ${b.id == bid ? 'selected' : ''}>${formatBuildingName(b)}</option>`
    ).join('');

    let html = `
        <div class="p-6 max-w-6xl mx-auto h-full flex flex-col">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-[28px] font-bold text-hb-offblack">Eigentümerversammlungen</h1>
                    <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Planung & Durchführung</p>
                </div>
                <div class="flex items-center gap-3">
                    <select onchange="_etvOnBuildingChange(this.value)" class="w-60 text-sm">${buildingOpts}</select>
                    <button onclick="_etvNewSessionModal()" class="bg-hb-olive text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-all">
                        + Neue Versammlung planen
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-10">
                ${sessions?.map(s => {
                    const date = new Date(s.meeting_date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    return `
                    <div class="bg-white rounded-2xl border border-hb-olive/12 overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                        <div class="${s.status === 'active' ? 'bg-hb-orange' : 'bg-hb-olive'} p-4 flex justify-between items-center">
                            <span class="text-white font-black text-xs tracking-tighter uppercase opacity-80">${s.fiscal_year}</span>
                            <span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold ${s.status === 'active' ? 'bg-white text-hb-orange animate-pulse' : 'bg-white/20 text-white'}">
                                ${s.status === 'active' ? '● LIVE' : s.status}
                            </span>
                        </div>
                        <div class="p-6">
                            <div class="text-2xl font-black text-hb-offblack mb-1">${date.toLocaleDateString('de-DE')}</div>
                            <div class="text-xs text-gray-400 mb-6 flex items-center gap-2">
                                <span class="bg-hb-ultralight p-1.5 rounded-lg text-hb-olive">${icons.clock || ''}</span>
                                ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr • ${s.location}
                            </div>
                            <button onclick="_etvOpenSession('${s.id}')" class="w-full bg-hb-ultralight text-hb-olive py-3 rounded-xl text-sm font-black hover:bg-hb-olive hover:text-white transition-all">
                                Versammlung öffnen
                            </button>
                        </div>
                    </div>
                    `;
                }).join('') || `
                    <div class="col-span-full py-20 bg-white rounded-2xl border-2 border-dashed border-hb-olive/12 flex flex-col items-center justify-center text-gray-400">
                        <p class="font-bold">Keine Versammlungen gefunden.</p>
                        <p class="text-xs">Starten Sie mit der Planung Ihrer ersten ETV.</p>
                    </div>
                `}
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
}

window._etvOnBuildingChange = async (val) => {
    _etvState.buildingId = Number(val);
    sessionStorage.setItem('hb_active_building', String(val));
    await _etvInitOverview();
};

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
        if (status === 'approved') return { text: 'Angenommen', cls: 'bg-hb-success/12 text-hb-success border-hb-success/20' };
        if (status === 'rejected') return { text: 'Abgelehnt', cls: 'bg-hb-orange/10 text-hb-orange border-hb-orange/20' };
        if (status === 'postponed') return { text: 'Vertagt', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
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

    return `
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full overflow-hidden">
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
    const isAbstain  = top.result_status === 'pending';
    const hasVote    = isApproved || isRejected || isAbstain;
    const btnBase    = 'px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-95 border-2';
    const btnJa      = `${btnBase} ${isApproved ? 'bg-hb-success text-white border-hb-success shadow-md' : 'bg-white border-hb-success/20 text-hb-success hover:bg-hb-success hover:text-white hover:border-hb-success'}`;
    const btnNein    = `${btnBase} ${isRejected ? 'bg-hb-orange text-white border-hb-orange shadow-md'  : 'bg-white border-hb-orange/20 text-hb-orange hover:bg-hb-orange hover:text-white hover:border-hb-orange'}`;
    const btnEnth    = `${btnBase} ${isAbstain  ? 'bg-gray-500 text-white border-gray-500 shadow-md'    : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-500 hover:text-white hover:border-gray-500'}`;
    const bldDocs = docs.filter(d => d.scope === 'building');
    const ownDocs = docs.filter(d => d.scope === 'owner');

    const section = (label, value, opts = {}) => value ? `
        <div>
            <div class="text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">${label}</div>
            <div class="text-[15px] text-hb-offblack leading-relaxed ${opts.italic ? 'italic text-gray-500' : ''} ${opts.box ? 'bg-hb-orange/5 border border-hb-orange/15 rounded-xl p-3' : ''} whitespace-pre-wrap">${value}</div>
        </div>
    ` : '';

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
                ${section('Interne Notiz (nur Verwalter)', top.internal_note, { box: true })}
                ${section('Vorbemerkung', top.preliminary_remark)}
                ${section('Beschlussantrag', top.proposed_resolution || 'Kein Beschlussantrag hinterlegt.', { italic: !top.proposed_resolution })}
                ${section('Abstimmungs-Notiz', top.result_note)}

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
    return `
        <div class="max-w-4xl mx-auto space-y-8 pb-20">
            <!-- Protokoll-Erstellung -->
            <div class="bg-white p-10 rounded-3xl border border-hb-olive/12 shadow-xl overflow-hidden relative">
                <div class="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12">${icons.document || ''}</div>
                
                <h2 class="text-3xl font-black text-hb-offblack mb-4 tracking-tighter">Protokoll-Finale</h2>
                <p class="text-[15px] text-gray-400 max-w-xl leading-relaxed font-bold mb-10">
                    Die Versammlung ist abgeschlossen. Generieren Sie nun das rechtssichere Protokoll zur Unterschrift und Veröffentlichung.
                </p>

                <div class="bg-hb-ultralight p-8 rounded-2xl border border-hb-olive/10 mb-10 relative">
                    <div class="absolute -top-3 left-8 bg-hb-olive text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Unterschriften-Status</div>
                    <div class="text-[15px] text-gray-600 leading-relaxed italic">
                        "Dieses Protokoll wurde am ${new Date().toLocaleDateString('de-DE')} von [Versammlungsleiter] und [Beirat] unterzeichnet. 
                        Das Original mit den handschriftlichen Unterschriften kann gemäß § 24 Abs. 6 WEG beim Verwalter eingesehen werden."
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onclick="_etvGenProtokoll()" class="bg-hb-olive text-white py-5 rounded-2xl font-black shadow-lg hover:shadow-2xl hover:translate-y-[-4px] transition-all flex flex-col items-center gap-1">
                        <span class="text-lg tracking-tight">Protokoll PDF generieren</span>
                        <span class="text-[10px] opacity-60 font-bold uppercase tracking-widest">Inkl. Unterschriften-Layer</span>
                    </button>
                    <button onclick="_etvPublishProtokoll()" class="bg-hb-ultralight text-hb-olive py-5 rounded-2xl font-black border border-hb-olive/10 hover:bg-hb-olive hover:text-white transition-all flex flex-col items-center gap-1">
                        <span class="text-lg tracking-tight">Im Portal freigeben</span>
                        <span class="text-[10px] opacity-60 font-bold uppercase tracking-widest">Mitteilung an Eigentümer</span>
                    </button>
                </div>
            </div>

            <!-- Beschlusssammlung §24 Abs 7 -->
            <div class="bg-white p-10 rounded-3xl border border-hb-olive/10 shadow-sm">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h4 class="font-black text-hb-offblack text-xl tracking-tight">Transfer in Beschlusssammlung</h4>
                        <p class="text-[10px] text-hb-olive font-black uppercase tracking-widest mt-1">Rechtssicherheit gemäß § 24 Abs. 7 WEG</p>
                    </div>
                    <button onclick="_etvSyncCollection()" class="bg-hb-ultralight text-hb-olive px-6 py-3 rounded-2xl text-xs font-black border border-hb-olive/10 hover:bg-hb-olive hover:text-white transition-all">
                        Jetzt synchronisieren
                    </button>
                </div>
                <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center gap-6">
                    <div class="bg-white p-4 rounded-xl shadow-sm text-hb-olive font-black text-2xl">${_etvState.agenda.filter(a => a.result_status === 'approved').length}</div>
                    <div class="text-xs text-gray-400 leading-relaxed">
                        Beschlüsse wurden in dieser Versammlung gefasst und stehen für die Übernahme in die gesetzliche Beschlusssammlung bereit.
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Hilfsfunktionen für Navigation und Modals
 */

window._etvSetTab = (tab) => {
    _etvState.activeTab = tab;
    _etvRenderMain();
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
                        const btnLabel = g.allPresent ? '✓ EINGECHECKT' : (g.anyPresent ? 'TEILWEISE' : 'CHECK-IN');
                        const btnClass = g.allPresent
                            ? 'bg-hb-olive text-white shadow-md'
                            : (g.anyPresent ? 'bg-hb-orange/10 text-hb-orange border border-hb-orange/30' : 'bg-hb-ultralight text-gray-400 group-hover:bg-hb-olive/10 group-hover:text-hb-olive');
                        return `
                        <div class="flex items-center justify-between p-4 rounded-2xl hover:bg-hb-ultralight/50 transition-all border border-transparent hover:border-hb-olive/10 group">
                            <div class="flex items-center gap-4 min-w-0">
                                <div class="bg-hb-ultralight text-hb-olive h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border border-hb-olive/5 shrink-0">${g.apartments.length}×WE</div>
                                <div class="min-w-0">
                                    <div class="font-black text-hb-offblack flex items-center gap-2">
                                        ${personName}
                                        ${isMulti ? `<span class="bg-hb-orange/10 text-hb-orange px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight">Multi-WE</span>` : ''}
                                    </div>
                                    <div class="flex flex-wrap gap-1 mt-1">${weBadges}</div>
                                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">${g.totalMEA} / ${denomDefault} MEA${isMulti ? ' gesamt' : ''}</div>
                                </div>
                            </div>
                            <button onclick="_etvTogglePersonPresent('${g.person_id}', ${!g.allPresent})" class="px-6 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${btnClass}">
                                ${btnLabel}
                            </button>
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
    const status = (vote === 'yes') ? 'approved' : (vote === 'no' ? 'rejected' : 'pending');
    await _supabase.from('etv_agenda_items').update({ result_status: status }).eq('id', topId);

    showToast('Abstimmung abgeschlossen.', 'success');
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
    await generateETVProtokollPDF(_etvState.sessionId);
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
    if (!confirm('Möchten Sie die Versammlung offiziell schließen? Danach sind keine Abstimmungen mehr möglich.')) return;

    const { error } = await _supabase.from('etv_sessions').update({ status: 'closed' }).eq('id', _etvState.sessionId);
    if (!error) {
        showToast('Versammlung geschlossen & archiviert.');
        loadETV();
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

