/**
 * HB-Mieterportal: mod-etv.js
 * Tool zur Begleitung von Eigentümerversammlungen (Vorbereitung, Durchführung, Protokoll)
 */

const _etvState = {
    buildingId: null,
    buildings: [],
    sessionId: null,
    session: null,
    agenda: [],
    attendance: [],
    apartments: [],
    owners: [],
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
        ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10"><p class="text-sm text-gray-500">Keine Gebäude gefunden.</p></div>`;
        return;
    }
    if (!_etvState.buildingId || !_etvState.buildings.find(b => b.id === _etvState.buildingId)) {
        _etvState.buildingId = _etvState.buildings[0].id;
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
                    <h1 class="text-2xl font-bold text-hb-offblack">Eigentümerversammlungen</h1>
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
                    <div class="bg-white rounded-[20px] border border-hb-olive/20 overflow-hidden shadow-sm hover:shadow-lg transition-all group">
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
                    <div class="col-span-full py-20 bg-white rounded-[20px] border-2 border-dashed border-hb-olive/20 flex flex-col items-center justify-center text-gray-400">
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
    await _etvInitOverview();
};

/**
 * Öffnet eine spezifische Versammlung und lädt alle Daten
 */
window._etvOpenSession = async (sessionId) => {
    _etvState.sessionId = sessionId;
    
    // Komplett-Check: Session, TOPs, Präsenz, Wohnungen & Eigentümer
    const [sRes, aRes, attRes, aptRes] = await Promise.all([
        _supabase.from('etv_sessions').select('*').eq('id', sessionId).single(),
        _supabase.from('etv_agenda_items').select('*').eq('session_id', sessionId).order('sort_order'),
        _supabase.from('etv_attendance').select('*, person:persons(first_name, last_name)').eq('session_id', sessionId),
        _supabase.from('apartments').select('id, apartment_number, mea_numerator, mea_denominator').eq('building_id', _etvState.buildingId),
    ]);
    const aptIds = (aptRes.data || []).map(a => a.id);
    const ownRes = aptIds.length > 0
        ? await _supabase.from('ownerships').select('*, person:persons!ownerships_owner_id_fkey(id, first_name, last_name)').in('apartment_id', aptIds).eq('is_active', true)
        : { data: [] };

    _etvState.session = sRes.data;
    _etvState.agenda = aRes.data || [];
    _etvState.attendance = attRes.data || [];
    _etvState.apartments = aptRes.data || [];
    _etvState.owners = ownRes.data || [];

    // Falls Präsenz noch leer ist (erste Öffnung), initialisieren wir sie aus den Ownerships
    if (_etvState.attendance.length === 0 && _etvState.owners.length > 0) {
        await _etvAutoInitAttendance();
    }

    _etvRenderMain();
};

/**
 * Initialisiert die Präsenzliste basierend auf den aktuellen Eigentümern
 */
async function _etvAutoInitAttendance() {
    const inserts = _etvState.owners.map(own => ({
        session_id: _etvState.sessionId,
        person_id: own.person.id,
        apartment_id: own.apartment_id,
        is_present: false
    }));
    
    const { data, error } = await _supabase.from('etv_attendance').insert(inserts).select('*, person:persons(first_name, last_name)');
    if (!error) _etvState.attendance = data;
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
                <div class="bg-white rounded-[25px] border border-hb-olive/20 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
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
                        ${_etvState.agenda.length ? _etvState.agenda.map(top => `
                            <div class="p-6 flex gap-6 hover:bg-hb-ultralight/20 transition-all group">
                                <div class="bg-hb-ultralight text-hb-olive h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">${top.sort_order}</div>
                                <div class="flex-grow">
                                    <div class="flex items-center gap-3">
                                        <h4 class="font-black text-hb-offblack text-lg">${top.title}</h4>
                                        <span class="px-2 py-0.5 bg-gray-100 text-[9px] font-black text-gray-500 rounded-md border border-gray-200 uppercase tracking-tighter italic">
                                            ${top.voting_type} • ${top.majority_type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p class="text-xs text-gray-400 mt-1 line-clamp-1 italic">${top.proposed_resolution || 'Kein Beschlussantrag hinterlegt.'}</p>
                                </div>
                                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onclick="_etvEditTOP('${top.id}')" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">Bearbeiten</button>
                                    <button onclick="_etvDeleteTOP('${top.id}')" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5">Löschen</button>
                                </div>
                            </div>
                        `).join('') : `
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
                <div class="bg-white p-8 rounded-[25px] border border-hb-olive/20 shadow-sm">
                    <h4 class="font-black text-hb-offblack mb-6 flex items-center gap-3">
                        <span class="bg-hb-olive text-white p-2 rounded-xl scale-75">${icons.document || ''}</span>
                        Einladung & Unterlagen
                    </h4>
                    <div class="space-y-4">
                        <button onclick="_etvPreviewEinladung()" class="w-full bg-hb-olive text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 shadow-lg hover:translate-y-[-2px] transition-all">
                            Einladungs-PDF generieren
                        </button>
                        <button onclick="_etvOpenStaging()" class="w-full bg-hb-ultralight text-hb-olive py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 border border-hb-olive/10 hover:bg-hb-olive/10 transition-all">
                            Dokumente in Staging (TOPs)
                        </button>
                    </div>
                    <div class="mt-8 p-4 bg-hb-ultralight/50 rounded-2xl border border-hb-olive/5">
                        <div class="text-[10px] font-black text-hb-olive uppercase mb-2 tracking-widest">Hinweis</div>
                        <p class="text-xs text-gray-400 leading-relaxed italic">Die Einladung enthält automatisch die Tagesordnung sowie ein personalisiertes Vollmachtsformular für jeden Eigentümer.</p>
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
    const isQuorum = percent >= 50.00;

    return `
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-7xl mx-auto h-full overflow-hidden">
            <!-- Sidebar: Quorum & Check-in -->
            <div class="lg:col-span-1 space-y-6 flex flex-col overflow-y-auto">
                <div class="bg-white p-8 rounded-[25px] border border-hb-olive/20 shadow-sm">
                    <h4 class="font-black text-hb-offblack mb-6 uppercase text-xs tracking-widest">Live-Quorum</h4>
                    
                    <div class="relative pt-1">
                        <div class="flex mb-3 items-center justify-between">
                            <div>
                                <span class="text-[10px] font-black inline-block py-1 px-2 uppercase rounded-full ${isQuorum ? 'text-green-600 bg-green-100' : 'text-hb-orange bg-orange-100'}">
                                    ${isQuorum ? 'Beschlussfähig' : 'Prüfung läuft'}
                                </span>
                            </div>
                            <div class="text-right">
                                <span class="text-xl font-black ${isQuorum ? 'text-hb-olive' : 'text-hb-orange'}">
                                    ${percent}%
                                </span>
                            </div>
                        </div>
                        <div class="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-hb-ultralight shadow-inner">
                            <div style="width:${percent}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${isQuorum ? 'bg-hb-olive' : 'bg-hb-orange'} transition-all duration-1000"></div>
                        </div>
                        <div class="text-[9px] font-bold text-gray-400 leading-tight italic">
                            Präsent: ${presentMEA.toLocaleString('de-DE')} von ${totalMEA.toLocaleString('de-DE')} MEA
                        </div>
                    </div>

                    <button onclick="_etvOpenCheckinModal()" class="w-full mt-8 bg-hb-olive text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-3">
                        ${icons.user || ''} Digitaler Check-in
                    </button>
                </div>

                <!-- Präsenzliste Kurzform -->
                <div class="bg-white rounded-[25px] border border-hb-olive/20 shadow-sm flex-grow overflow-hidden flex flex-col">
                    <div class="p-5 border-b border-hb-olive/10 bg-hb-ultralight/20">
                        <h5 class="text-[10px] font-black text-hb-olive uppercase tracking-widest">Anwesend (${presentUnits.length})</h5>
                    </div>
                    <div class="p-2 overflow-y-auto flex-grow divide-y divide-hb-olive/5">
                        ${presentUnits.map(a => `
                            <div class="p-3 flex items-center justify-between group">
                                <div class="flex flex-col">
                                    <span class="text-xs font-black text-hb-offblack">${a.person.first_name} ${a.person.last_name}</span>
                                    <span class="text-[10px] text-gray-400 font-bold tracking-tighter">WE ${(_etvState.apartments.find(apt => apt.id === a.apartment_id))?.apartment_number}</span>
                                </div>
                                <button onclick="_etvTogglePresent('${a.id}', false)" class="text-hb-orange opacity-0 group-hover:opacity-100 p-2 hover:bg-hb-orange/5 rounded-lg transition-all">
                                    ${icons.delete || '×'}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Abstimmungs-Konsole -->
            <div class="lg:col-span-3 space-y-6 overflow-y-auto pr-2 pb-10">
                ${_etvState.agenda.map(top => `
                    <div class="bg-white rounded-[30px] border border-hb-olive/20 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-xl">
                        <div class="p-8 flex justify-between items-start gap-6">
                            <div class="flex gap-6">
                                <div class="bg-hb-ultralight text-hb-olive h-16 w-16 min-w-[64px] rounded-[22px] flex items-center justify-center font-black text-2xl shadow-inner border border-hb-olive/10 group-hover:bg-hb-olive group-hover:text-white transition-all">
                                    ${top.sort_order}
                                </div>
                                <div>
                                    <div class="flex items-center gap-3 mb-1">
                                        <h4 class="font-black text-hb-offblack text-xl">${top.title}</h4>
                                        <span class="bg-hb-ultralight text-hb-olive px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-hb-olive/5">
                                            ${top.voting_type}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-500 leading-relaxed italic max-w-2xl">
                                        ${top.proposed_resolution || 'Kein Beschlussantrag hinterlegt.'}
                                    </p>
                                </div>
                            </div>
                            
                            <div class="flex flex-col items-end gap-2">
                                <div class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${top.result_status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}">
                                    ${top.result_status === 'pending' ? 'Warten' : top.result_status.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <!-- Abstimmungs-Knöpfe -->
                        <div class="bg-hb-ultralight/40 p-6 border-t border-hb-olive/5 flex justify-between items-center">
                            <div class="flex items-center gap-4">
                                <button onclick="_etvCastVote('${top.id}', 'yes')" class="group/btn relative bg-white border-2 border-green-600/20 text-green-700 px-8 py-3 rounded-2xl font-black text-sm hover:bg-green-600 hover:text-white hover:border-green-600 transition-all shadow-sm active:scale-95">
                                    JA
                                    <span class="absolute -top-2 -right-2 bg-green-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black scale-0 group-hover/btn:scale-100 transition-transform shadow-md">✓</span>
                                </button>
                                <button onclick="_etvCastVote('${top.id}', 'no')" class="group/btn relative bg-white border-2 border-hb-orange/20 text-hb-orange px-8 py-3 rounded-2xl font-black text-sm hover:bg-hb-orange hover:text-white hover:border-hb-orange transition-all shadow-sm active:scale-95">
                                    NEIN
                                    <span class="absolute -top-2 -right-2 bg-hb-orange text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black scale-0 group-hover/btn:scale-100 transition-transform shadow-md">×</span>
                                </button>
                                <button onclick="_etvCastVote('${top.id}', 'abstain')" class="group/btn relative bg-white border-2 border-gray-200 text-gray-400 px-8 py-3 rounded-2xl font-black text-sm hover:bg-gray-500 hover:text-white hover:border-gray-500 transition-all shadow-sm active:scale-95">
                                    ENTH.
                                </button>
                            </div>
                            
                            <div class="flex items-center gap-4">
                                <div class="text-right hidden sm:block">
                                    <div class="text-[9px] font-black text-hb-olive uppercase tracking-widest opacity-60">Abstimmungsergebnis</div>
                                    <div class="text-xs font-black text-hb-offblack italic">Einstimmiges JA</div>
                                </div>
                                <button class="bg-white p-3 rounded-2xl border border-hb-olive/10 text-hb-olive hover:bg-hb-olive hover:text-white transition-all shadow-sm">
                                    ${icons.edit || '✎'}
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * PHASE 3: Nachbereitung (Protokoll & Versiegelung)
 */
function _etvRenderFollow() {
    return `
        <div class="max-w-4xl mx-auto space-y-8 pb-20">
            <!-- Protokoll-Erstellung -->
            <div class="bg-white p-10 rounded-[35px] border border-hb-olive/20 shadow-xl overflow-hidden relative">
                <div class="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12">${icons.document || ''}</div>
                
                <h2 class="text-3xl font-black text-hb-offblack mb-4 tracking-tighter">Protokoll-Finale</h2>
                <p class="text-sm text-gray-400 max-w-xl leading-relaxed font-bold mb-10">
                    Die Versammlung ist abgeschlossen. Generieren Sie nun das rechtssichere Protokoll zur Unterschrift und Veröffentlichung.
                </p>

                <div class="bg-hb-ultralight p-8 rounded-[25px] border border-hb-olive/10 mb-10 relative">
                    <div class="absolute -top-3 left-8 bg-hb-olive text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Unterschriften-Status</div>
                    <div class="text-sm text-gray-600 leading-relaxed italic">
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
            <div class="bg-white p-10 rounded-[35px] border border-hb-olive/10 shadow-sm">
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
            <div class="bg-white rounded-[30px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
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
        meeting_date: `${date}T${time}:00`,
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
    const nextSort = _etvState.agenda.length + 1;
    const html = `
        <div id="etv-top-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-[30px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Tagesordnungspunkt hinzufügen</h3>
                </div>
                <div class="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-4 gap-4">
                        <div class="col-span-1">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Nr.</label>
                            <input type="number" id="top-sort" value="${nextSort}" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm">
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
                                <option value="mea">Wertprinzip (MEA)</option>
                                <option value="heads">Kopfprinzip</option>
                                <option value="object">Objektprinzip</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Mehrheit</label>
                            <select id="top-maj-type" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm font-bold">
                                <option value="simple">Einfache Mehrheit</option>
                                <option value="qualified">Qualifizierte Mehrheit</option>
                                <option value="double_qualified">Doppelt Qualifiziert</option>
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
        sort_order: parseInt(sort),
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
    const voteOpts = ['mea','heads','object'].map(v =>
        `<option value="${v}" ${top.voting_type === v ? 'selected' : ''}>${v === 'mea' ? 'Wertprinzip (MEA)' : v === 'heads' ? 'Kopfprinzip' : 'Objektprinzip'}</option>`
    ).join('');
    const majOpts = ['simple','qualified','double_qualified'].map(v =>
        `<option value="${v}" ${top.majority_type === v ? 'selected' : ''}>${v === 'simple' ? 'Einfache Mehrheit' : v === 'qualified' ? 'Qualifizierte Mehrheit' : 'Doppelt Qualifiziert'}</option>`
    ).join('');
    const html = `
        <div id="etv-top-edit-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-[30px] shadow-2xl w-full max-w-2xl overflow-hidden">
                <div class="bg-hb-olive p-6 text-white">
                    <h3 class="text-xl font-black">Tagesordnungspunkt bearbeiten</h3>
                </div>
                <div class="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-4 gap-4">
                        <div class="col-span-1">
                            <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Nr.</label>
                            <input type="number" id="top-edit-sort" value="${top.sort_order}" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm">
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
        sort_order: parseInt(sort),
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

// ─── CHECK-IN ───────────────────────────────────────────────

window._etvOpenCheckinModal = () => {
    const html = `
        <div id="etv-checkin-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-[35px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="bg-hb-olive p-8 text-white flex justify-between items-center">
                    <div>
                        <h3 class="text-2xl font-black tracking-tight">Präsenzliste</h3>
                        <p class="text-[10px] uppercase font-bold opacity-70 tracking-widest mt-1">Eigentümer ein- und auschecken</p>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] font-black opacity-60 uppercase">Anwesend</div>
                        <div class="text-3xl font-black">${_etvState.attendance.filter(a => a.is_present).length} / ${_etvState.attendance.length}</div>
                    </div>
                </div>
                <div class="flex-grow overflow-y-auto p-4 space-y-2">
                    ${_etvState.attendance.map(a => {
                        const apt = _etvState.apartments.find(apt => apt.id === a.apartment_id);
                        return `
                        <div class="flex items-center justify-between p-4 rounded-2xl hover:bg-hb-ultralight/50 transition-all border border-transparent hover:border-hb-olive/10 group">
                            <div class="flex items-center gap-4">
                                <div class="bg-hb-ultralight text-hb-olive h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border border-hb-olive/5">WE ${apt?.apartment_number}</div>
                                <div>
                                    <div class="font-black text-hb-offblack">${a.person.first_name} ${a.person.last_name}</div>
                                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">${apt?.mea_numerator || 0} / ${apt?.mea_denominator || 1000} MEA</div>
                                </div>
                            </div>
                            <button onclick="_etvTogglePresent('${a.id}', ${!a.is_present})" class="px-6 py-2 rounded-xl text-xs font-black transition-all ${a.is_present ? 'bg-hb-olive text-white shadow-md' : 'bg-hb-ultralight text-gray-400 group-hover:bg-hb-olive/10 group-hover:text-hb-olive'}">
                                ${a.is_present ? '✓ EINGECHECKT' : 'CHECK-IN'}
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
    }
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

window._etvPreviewEinladung = async () => {
    if (typeof generateETVEinladungPDF !== 'function') {
        showToast('PDF-Modul nicht bereit.', 'error'); return;
    }
    await generateETVEinladungPDF(_etvState.sessionId);
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
    const dateVal = dt.toISOString().split('T')[0];
    const timeVal = dt.toTimeString().slice(0, 5);
    const statusOptions = ['planned','active','closed'].map(v =>
        `<option value="${v}" ${s.status === v ? 'selected' : ''}>${v.toUpperCase()}</option>`
    ).join('');
    const html = `
        <div id="etv-settings-modal" class="fixed inset-0 bg-hb-offblack/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-white rounded-[30px] shadow-2xl w-full max-w-lg overflow-hidden">
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
                    <div>
                        <label class="block text-[10px] font-black text-hb-olive uppercase tracking-widest mb-1.5">Ort / Modus</label>
                        <input type="text" id="etv-edit-loc" value="${s.location || ''}" class="w-full">
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
    if (!date || !fy) { showToast('Bitte Datum und Jahr angeben.', 'error'); return; }
    const { error } = await _supabase.from('etv_sessions').update({
        fiscal_year: parseInt(fy),
        meeting_date: `${date}T${time}:00`,
        location: loc,
        status
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
        ? `<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-lg">Bereit</span>`
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
            <div class="bg-white rounded-[20px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                <div class="bg-hb-olive p-6 rounded-t-[20px] flex items-center justify-between">
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
                <div class="p-4 bg-hb-ultralight rounded-b-[20px] flex justify-end">
                    <button onclick="document.getElementById('etv-staging-modal').remove()" class="btn-secondary text-sm px-6 py-2">Schließen</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

