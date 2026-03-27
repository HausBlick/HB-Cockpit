/**
 * HB-Mieterportal: mod-etv.js
 * Tool zur Begleitung von Eigentümerversammlungen (Vorbereitung, Durchführung, Protokoll)
 */

const _etvState = {
    buildingId: null,
    sessionId: null,
    session: null,
    agenda: [],
    attendance: [],
    apartments: [],
    owners: [],
    activeTab: 'prep' // prep (Vorbereitung), exec (Durchführung), follow (Nachbereitung)
};

/**
 * Haupt-Einstiegspunkt: Lädt die ETV-Übersicht für das aktive Gebäude
 */
export async function loadETV() {
    const bid = _config.activeBuildingId;
    if (!bid) {
        document.getElementById('content-area').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full p-20 text-gray-400">
                ${_icons.building || ''}
                <p class="mt-4 font-bold">Kein Gebäude ausgewählt.</p>
                <p class="text-sm">Bitte wählen Sie links ein Objekt aus, um die ETV-Planung zu starten.</p>
            </div>
        `;
        return;
    }
    _etvState.buildingId = bid;
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

    let html = `
        <div class="p-6 max-w-6xl mx-auto h-full flex flex-col">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-hb-offblack">Eigentümerversammlungen</h1>
                    <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Planung & Durchführung</p>
                </div>
                <button onclick="_etvNewSessionModal()" class="bg-hb-olive text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-all">
                    ${_icons.plus || ''} Neue Versammlung planen
                </button>
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
                                <span class="bg-hb-ultralight p-1.5 rounded-lg text-hb-olive">${_icons.clock || ''}</span>
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

/**
 * Öffnet eine spezifische Versammlung und lädt alle Daten
 */
window._etvOpenSession = async (sessionId) => {
    _etvState.sessionId = sessionId;
    
    // Komplett-Check: Session, TOPs, Präsenz, Wohnungen & Eigentümer
    const [sRes, aRes, attRes, aptRes, ownRes] = await Promise.all([
        _supabase.from('etv_sessions').select('*').eq('id', sessionId).single(),
        _supabase.from('etv_agenda_items').select('*').eq('session_id', sessionId).order('sort_order'),
        _supabase.from('etv_attendance').select('*, person:persons(first_name, last_name)').eq('session_id', sessionId),
        _supabase.from('apartments').select('id, apartment_number, mea_numerator, mea_denominator').eq('building_id', _etvState.buildingId),
        _supabase.from('ownerships').select('*, person:persons(id, first_name, last_name)').eq('building_id', _etvState.buildingId).eq('is_active', true)
    ]);

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
                        ${_icons.back || '←'}
                    </button>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="bg-hb-olive text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter italic">ETV ${s.fiscal_year}</span>
                            <span class="text-hb-offblack font-black text-xl">${new Date(s.meeting_date).toLocaleDateString('de-DE')}</span>
                        </div>
                        <div class="text-xs text-gray-400 mt-0.5 font-bold flex items-center gap-2">
                            ${_icons.location || ''} ${s.location}
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
                        ${_icons.settings || '⚙'}
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
                                    <button onclick="_etvEditTOP('${top.id}')" class="p-3 text-hb-olive bg-hb-ultralight rounded-xl hover:bg-hb-olive hover:text-white transition-all">${_icons.edit || '✎'}</button>
                                    <button onclick="_etvDeleteTOP('${top.id}')" class="p-3 text-hb-orange bg-hb-orange/5 rounded-xl hover:bg-hb-orange hover:text-white transition-all">${_icons.delete || '×'}</button>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="flex flex-col items-center justify-center p-20 text-gray-400">
                                ${_icons.list || ''}
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
                        <span class="bg-hb-olive text-white p-2 rounded-xl scale-75">${_icons.document || ''}</span>
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
                        ${_icons.user || ''} Digitaler Check-in
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
                                    ${_icons.delete || '×'}
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
                                    ${_icons.edit || '✎'}
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
                <div class="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12">${_icons.document || ''}</div>
                
                <h2 class="text-3xl font-black text-hb-offblack mb-4 tracking-tighter italic">Protokoll-Finale</h2>
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
                        <h4 class="font-black text-hb-offblack text-xl italic tracking-tight">Transfer in Beschlusssammlung</h4>
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
                    <h3 class="text-xl font-black italic">Neue ETV planen</h3>
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
                    <h3 class="text-xl font-black italic">Tagesordnungspunkt hinzufügen</h3>
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
                        <label class="block text-[10px] font-black text-hb-olive uppercase mb-1.5">Beschlussantrag (Wortlaut)</label>
                        <textarea id="top-res" rows="3" class="w-full bg-hb-ultralight border-hb-olive/10 rounded-xl px-4 py-3 text-sm italic" placeholder="Die Eigentümerversammlung beschließt..."></textarea>
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
    const vType = document.getElementById('top-vote-type').value;
    const mType = document.getElementById('top-maj-type').value;

    if (!title) { showToast('Titel erforderlich', 'error'); return; }

    const { error } = await _supabase.from('etv_agenda_items').insert({
        session_id: _etvState.sessionId,
        sort_order: parseInt(sort),
        title: title,
        proposed_resolution: res,
        voting_type: vType,
        majority_type: mType
    });

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    
    document.getElementById('etv-top-modal').remove();
    showToast('TOP hinzugefügt.');
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
                        <h3 class="text-2xl font-black italic tracking-tight">Präsenzliste</h3>
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

window._etvGenProtokoll = async () => {
    if (typeof generateETVProtokollPDF !== 'function') {
        showToast('PDF-Modul nicht bereit.', 'error'); return;
    }
    await generateETVProtokollPDF(_etvState.sessionId);
};

window._etvCloseSession = async () => {
    if (!confirm('Möchten Sie die Versammlung offiziell schließen? Danach sind keine Abstimmungen mehr möglich.')) return;
    
    const { error } = await _supabase.from('etv_sessions').update({ status: 'closed' }).eq('id', _etvState.sessionId);
    if (!error) {
        showToast('Versammlung geschlossen & archiviert.');
        loadETV();
    }
};

