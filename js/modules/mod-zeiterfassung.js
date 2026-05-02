// ============================================================
// HB-Mieterportal | mod-zeiterfassung.js
// Zeiterfassung für Projekte & Arbeitspakete
// ============================================================

let _timeState = {
    projects:       [],
    packages:       [],
    entries:        [],
    buildings:      [],
    activeBuilding: null,
    activeProjectId: null,
    activeTimer:    null, // { entryId, startTime, intervalId }
};

// ─── Entry Point ──────────────────────────────────────────────

async function loadZeiterfassung() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    if (!['admin', 'manager'].includes(userProfile?.role)) {
        ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10"><h2 class="text-lg font-bold mb-2">Kein Zugriff</h2><p class="text-[15px] text-gray-500">Nur für Verwalter zugänglich.</p></div>`;
        return;
    }

    // Gebäude laden
    const { data: blds } = await _supabase.from('buildings').select('id, name, file_number, street, house_number').order('name');
    _timeState.buildings = blds || [];
    if (!_timeState.activeBuilding && _timeState.buildings.length > 0) {
        // Building-Kontext: URL-Param > sessionStorage > erster in Liste
        const urlBuilding = new URLSearchParams(window.location.search).get('building');
        const sessionBuilding = sessionStorage.getItem('hb_active_building');
        const targetId = urlBuilding || sessionBuilding;
        if (targetId && _timeState.buildings.find(b => b.id == targetId)) {
            _timeState.activeBuilding = parseInt(targetId);
        } else {
            _timeState.activeBuilding = _timeState.buildings[0].id;
        }
    }

    // Laufenden Timer prüfen
    const { data: running } = await _supabase.from('time_entries')
        .select('*, wp:time_work_packages(project_id)')
        .is('end_time', null)
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (running) {
        _timeState.activeTimer = {
            entryId: running.id,
            startTime: new Date(running.start_time),
            projectId: running.wp.project_id
        };
        _timeStartLocalInterval();
    }

    _timeRenderShell();
}

// ─── UI Rendering ─────────────────────────────────────────────

function _timeRenderShell() {
    const ca = document.getElementById('content-area');
    const b = _timeState.buildings.find(x => x.id == _timeState.activeBuilding);
    const bName = b ? formatBuildingName(b) : 'Kein Gebäude ausgewählt';

    ca.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 class="text-[28px] font-bold text-hb-offblack">Zeiterfassung & Projekte</h1>
                <p class="text-xs text-gray-500 mt-1">${bName}</p>
            </div>
            <div class="flex gap-2">
                <select onchange="_timeChangeBuilding(this.value)" class="text-sm border-gray-200 rounded-lg">
                    ${_timeState.buildings.map(x => `<option value="${x.id}" ${x.id == _timeState.activeBuilding ? 'selected' : ''}>${formatBuildingName(x)}</option>`).join('')}
                </select>
                <button onclick="_timeOpenNewProjectModal()" class="btn-primary text-sm px-4 py-2">+ Neues Projekt</button>
            </div>
        </div>

        ${_timeState.activeTimer ? `
        <div id="timer-bar" class="card bg-hb-orange/5 border-hb-orange/20 p-4 mb-6 flex justify-between items-center animate-pulse">
            <div class="flex items-center gap-4">
                <div class="w-3 h-3 bg-hb-orange rounded-full"></div>
                <div>
                    <p class="text-xs font-bold text-hb-orange uppercase tracking-wider">Timer läuft...</p>
                    <p id="timer-display" class="text-2xl font-mono text-hb-offblack">00:00:00</p>
                </div>
            </div>
            <button onclick="_timeStopTimer()" class="bg-hb-orange text-white px-6 py-2 rounded-lg font-bold hover:bg-opacity-90">Stoppen</button>
        </div>` : ''}

        <div id="time-main-content">
            <div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>
        </div>
    `;

    _timeLoadProjects();
}

async function _timeLoadProjects() {
    const { data: projs } = await _supabase.from('time_projects')
        .select('*')
        .eq('building_id', _timeState.activeBuilding)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
    
    _timeState.projects = projs || [];
    _timeRenderProjectList();
}

function _timeRenderProjectList() {
    const container = document.getElementById('time-main-content');
    if (!_timeState.projects.length) {
        container.innerHTML = `<div class="card p-12 text-center text-gray-400">Keine Projekte für dieses Gebäude vorhanden.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${_timeState.projects.map(p => `
                <div class="card hover:shadow-md transition-shadow cursor-pointer flex flex-col" onclick="_timeOpenProject(${p.id})">
                    <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                        <span class="text-sm font-bold text-white">${p.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}</span>
                        <span class="text-xs text-white/70">${new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                    </div>
                    <div class="p-5 flex-grow">
                        <h3 class="font-bold text-hb-offblack mb-1">${p.title}</h3>
                        <p class="text-[15px] text-gray-500 line-clamp-2">${p.description || 'Keine Beschreibung.'}</p>
                    </div>
                    <div class="p-5 pt-0 mt-auto flex justify-between items-center border-t border-hb-olive/10 pt-4">
                        <div class="text-xs text-gray-500">Taktung: <b>${p.billing_increment_min} Min.</b></div>
                        <span class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">Details & Zeiten →</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function _timeOpenProject(id) {
    _timeState.activeProjectId = id;
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const [projRes, wpRes] = await Promise.all([
        _supabase.from('time_projects').select('*').eq('id', id).single(),
        _supabase.from('time_work_packages').select('*').eq('project_id', id).order('id')
    ]);

    const p = projRes.data;
    const wps = wpRes.data || [];

    // Alle Einträge für dieses Projekt laden (via WP Join)
    const { data: entries } = await _supabase.from('time_entries')
        .select('*, wp:time_work_packages(title, project_id)')
        .eq('wp.project_id', id)
        .order('start_time', { ascending: false });

    ca.innerHTML = `
        <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="flex items-center gap-3">
                <button onclick="loadZeiterfassung()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                </button>
                <div>
                    <h1 class="text-[28px] font-bold text-hb-offblack">${p.title}</h1>
                    <p class="text-xs text-gray-500 uppercase font-bold tracking-tight">${p.status === 'active' ? 'Projekt Aktiv' : 'Abgeschlossen'}</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="_timeGenerateReport(${p.id})" class="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Arbeitsrapport (PDF)
                </button>
                <button onclick="_timeOpenProjectEditModal(${p.id})" class="btn-secondary text-sm px-4 py-2">Bearbeiten</button>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Linke Spalte: Arbeitspakete & Timer -->
            <div class="lg:col-span-1 space-y-6">
                <div class="card overflow-hidden">
                    <div class="bg-hb-olive px-4 py-2 flex justify-between items-center">
                        <span class="text-xs font-bold text-white">Arbeitspakete</span>
                        <button onclick="_timeOpenNewWPModal(${p.id})" class="bg-white text-hb-olive hover:bg-gray-100 p-1 rounded transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                    <div class="divide-y divide-hb-olive/10">
                        ${wps.map(wp => `
                            <div class="p-4 hover:bg-gray-50 transition-colors group">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-sm font-bold text-hb-offblack ${wp.status === 'closed' ? 'line-through opacity-50' : ''}">${wp.title}</span>
                                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="_timeEditWP(${wp.id}, '${wp.title}')" class="p-1 hover:text-hb-olive"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    ${wp.status === 'open' ? `
                                        <button onclick="_timeStartTimer(${wp.id})" class="text-[10px] bg-hb-olive text-white px-2 py-1 rounded hover:bg-opacity-90 flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                                            Timer
                                        </button>
                                        <button onclick="_timeOpenManualModal(${wp.id})" class="text-[10px] bg-hb-ultralight text-hb-olive px-2 py-1 rounded border border-hb-olive/12 hover:bg-white flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                            Manuell
                                        </button>
                                    ` : '<span class="text-[10px] text-gray-400 italic">Abgeschlossen</span>'}
                                </div>
                            </div>
                        `).join('')}
                        ${!wps.length ? `<div class="p-8 text-center text-xs text-gray-400 italic">Noch keine Arbeitspakete angelegt.</div>` : ''}
                    </div>
                </div>

                <div class="card overflow-hidden">
                    <div class="bg-hb-olive px-4 py-2">
                        <span class="text-sm font-bold text-white">Projekt-Statistik</span>
                    </div>
                    <div class="p-5">
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500">Gesamtzeit (Netto)</span>
                            <span class="text-sm font-mono font-bold">${_timeCalculateTotal(entries || [], 'netto')}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500">Abgerechnet (Getaktet)</span>
                            <span class="text-sm font-mono font-bold text-hb-olive">${_timeCalculateTotal(entries || [], 'billed', p.billing_increment_min)}</span>
                        </div>
                        <div class="pt-4 border-t border-hb-olive/10">
                            <div class="flex justify-between items-center">
                                <span class="text-xs text-gray-500">Kontroll-Wert (@${p.hourly_rate}€/h)</span>
                                <span class="text-sm font-bold text-hb-offblack">${_timeCalculateValue(entries || [], p.hourly_rate, p.billing_increment_min)} €</span>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            <!-- Rechte Spalte: Letzte Einträge -->
            <div class="lg:col-span-2">
                <div class="card overflow-hidden">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">Zeithistorie</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-gray-50 border-b text-xs font-bold text-gray-500">
                                <tr>
                                    <th class="px-5 py-3">Datum</th>
                                    <th class="px-5 py-3">Paket</th>
                                    <th class="px-5 py-3">Von - Bis</th>
                                    <th class="px-5 py-3 text-right">Dauer</th>
                                    <th class="px-5 py-3">Tätigkeit</th>
                                    <th class="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-hb-olive/10">
                                ${(entries || []).map(e => {
                                    const start = new Date(e.start_time);
                                    const end = e.end_time ? new Date(e.end_time) : null;
                                    const duration = end ? (end - start) / 1000 / 60 : 0;
                                    const billed = _timeRound(duration, p.billing_increment_min);
                                    return `
                                        <tr class="hover:bg-gray-50 transition-colors">
                                            <td class="px-5 py-4 whitespace-nowrap">${start.toLocaleDateString('de-DE')}</td>
                                            <td class="px-5 py-4"><span class="text-xs font-bold text-hb-offblack">${e.wp.title}</span></td>
                                            <td class="px-5 py-4 whitespace-nowrap text-xs text-gray-500">${start.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})} - ${end ? end.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}) : '...'}</td>
                                            <td class="px-5 py-4 text-right whitespace-nowrap font-mono font-bold">${billed} Min.</td>
                                            <td class="px-5 py-4 text-xs text-gray-500">${e.description || '—'}</td>
                                            <td class="px-5 py-4 text-right">
                                                <div class="flex gap-1 justify-end">
                                                    <button onclick="_timeEditEntry(${e.id})" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                                    </button>
                                                    <button onclick="_timeDeleteEntry(${e.id})" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 transition-colors">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                ${!entries?.length ? `<tr><td colspan="6" class="px-5 py-12 text-center text-gray-400 italic">Noch keine Zeiteinträge vorhanden.</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Responsive tables
    document.querySelectorAll('#content-area .card table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });
}

// ─── Timer Logik ──────────────────────────────────────────────

async function _timeStartTimer(wpId) {
    if (_timeState.activeTimer) {
        showToast('Es läuft bereits ein Timer. Bitte diesen erst stoppen.', 'error');
        return;
    }

    const now = new Date();
    const { data, error } = await _supabase.from('time_entries').insert({
        work_package_id: wpId,
        user_id: currentUser.id,
        start_time: now.toISOString(),
        description: 'Timer läuft...'
    }).select().single();

    if (error) { showToast('Fehler beim Starten des Timers.', 'error'); return; }

    _timeState.activeTimer = {
        entryId: data.id,
        startTime: now,
        projectId: _timeState.activeProjectId
    };

    _timeStartLocalInterval();
    _timeRenderShell();
}

function _timeStartLocalInterval() {
    if (_timeState.timerInterval) clearInterval(_timeState.timerInterval);
    _timeState.timerInterval = setInterval(() => {
        const el = document.getElementById('timer-display');
        if (!el) return;
        const diff = new Date() - _timeState.activeTimer.startTime;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

async function _timeStopTimer() {
    if (!_timeState.activeTimer) return;

    const desc = await _timeAskForDescription();
    const now = new Date();

    const { error } = await _supabase.from('time_entries').update({
        end_time: now.toISOString(),
        description: desc || 'Timer gestoppt.'
    }).eq('id', _timeState.activeTimer.entryId);

    if (error) { showToast('Fehler beim Stoppen des Timers.', 'error'); return; }

    clearInterval(_timeState.timerInterval);
    _timeState.activeTimer = null;
    loadZeiterfassung(); // Refresh everything
    showToast('Zeit wurde erfasst.');
}

function _timeAskForDescription() {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
        modal.innerHTML = `
            <div class="card w-full max-w-sm overflow-hidden">
                <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                    <span class="text-sm font-bold text-white">Timer stoppen</span>
                    <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
                </div>
                <div class="p-6">
                    <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Was haben Sie getan?</label>
                    <textarea id="timer-desc" class="text-sm w-full h-24" placeholder="Kurze Beschreibung..."></textarea>
                </div>
                <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                    <button id="timer-save" class="btn-primary text-sm px-4 py-2">Speichern</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('timer-desc').focus();
        document.getElementById('timer-save').onclick = () => {
            const val = document.getElementById('timer-desc').value;
            modal.remove();
            resolve(val);
        };
    });
}

// ─── Hilfsfunktionen & Logik ──────────────────────────────────

function _timeRound(min, increment) {
    if (!increment || increment <= 1) return Math.ceil(min);
    return Math.ceil(min / increment) * increment;
}

function _timeCalculateTotal(entries, mode, increment = 1) {
    const totalMin = entries.reduce((acc, e) => {
        if (!e.end_time) return acc;
        const dur = (new Date(e.end_time) - new Date(e.start_time)) / 60000;
        return acc + (mode === 'billed' ? _timeRound(dur, increment) : dur);
    }, 0);

    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    return `${h} Std. ${m} Min.`;
}

function _timeCalculateValue(entries, rate, increment = 1) {
    const totalMinBilled = entries.reduce((acc, e) => {
        if (!e.end_time) return acc;
        const dur = (new Date(e.end_time) - new Date(e.start_time)) / 60000;
        return acc + _timeRound(dur, increment);
    }, 0);
    return (totalMinBilled / 60 * rate).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// ─── Modals (Projekt / Arbeitspakete) ─────────────────────────

function _timeOpenNewProjectModal() {
    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    m.innerHTML = `
        <div class="card w-full max-w-md overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Neues Projekt anlegen</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Projekt-Titel</label>
                     <input type="text" id="p-title" class="text-sm w-full" placeholder="z.B. Dachsanierung 2026"></div>
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Beschreibung (optional)</label>
                     <textarea id="p-desc" class="text-sm w-full h-20" placeholder="Details zum Umfang..."></textarea></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Stundensatz (€/h)</label>
                         <input type="number" id="p-rate" class="text-sm w-full" value="0.00" step="0.01"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Abrechnungstakt</label>
                         <select id="p-increment" class="text-sm w-full">
                            <option value="1">Minutengenau</option>
                            <option value="15">15 Min. Takt</option>
                            <option value="30">30 Min. Takt</option>
                            <option value="60">60 Min. Takt</option>
                         </select></div>
                </div>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveProject()" class="btn-primary text-sm px-4 py-2">Projekt erstellen</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

async function _timeSaveProject() {
    const title = document.getElementById('p-title').value;
    const desc = document.getElementById('p-desc').value;
    const rate = parseFloat(document.getElementById('p-rate').value) || 0;
    const inc = parseInt(document.getElementById('p-increment').value) || 1;

    if (!title) { showToast('Titel ist erforderlich.', 'error'); return; }

    const { error } = await _supabase.from('time_projects').insert({
        building_id: _timeState.activeBuilding,
        title,
        description: desc,
        hourly_rate: rate,
        billing_increment_min: inc,
        created_by: currentUser.id
    });

    if (error) { showToast('Fehler beim Erstellen des Projekts.', 'error'); return; }
    
    document.querySelector('.modal-backdrop')?.remove();
    _timeLoadProjects();
    showToast('Projekt wurde angelegt.');
}

function _timeOpenNewWPModal(projId) {
    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    m.innerHTML = `
        <div class="card w-full max-w-sm overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Neues Arbeitspaket</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6">
                <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Bezeichnung der Etappe</label>
                <input type="text" id="wp-title" class="text-sm w-full" placeholder="z.B. Baubesprechung / Planung">
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveWP(${projId})" class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

async function _timeSaveWP(projId) {
    const title = document.getElementById('wp-title').value;
    if (!title) return;

    const { error } = await _supabase.from('time_work_packages').insert({
        project_id: projId,
        title
    });

    if (error) { showToast('Fehler beim Erstellen.', 'error'); return; }
    document.querySelector('.modal-backdrop')?.remove();
    _timeOpenProject(projId);
}

function _timeOpenManualModal(wpId) {
    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    const today = new Date().toISOString().split('T')[0];
    m.innerHTML = `
        <div class="card w-full max-w-md overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Zeit manuell erfassen</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Datum</label>
                         <input type="date" id="m-date" class="text-sm w-full" value="${today}"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Tätigkeit</label>
                         <input type="text" id="m-desc" class="text-sm w-full" placeholder="z.B. Telefonat mit Handwerker"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Startzeit</label>
                         <input type="time" id="m-start" class="text-sm w-full" value="09:00"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Endzeit</label>
                         <input type="time" id="m-end" class="text-sm w-full" value="10:00"></div>
                </div>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveManual(${wpId})" class="btn-primary text-sm px-4 py-2">Eintragen</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

async function _timeSaveManual(wpId) {
    const date = document.getElementById('m-date').value;
    const start = document.getElementById('m-start').value;
    const end = document.getElementById('m-end').value;
    const desc = document.getElementById('m-desc').value;

    if (!date || !start || !end) return;

    const startISO = new Date(`${date}T${start}`).toISOString();
    const endISO = new Date(`${date}T${end}`).toISOString();

    const { error } = await _supabase.from('time_entries').insert({
        work_package_id: wpId,
        user_id: currentUser.id,
        start_time: startISO,
        end_time: endISO,
        description: desc
    });

    if (error) { showToast('Fehler beim Speichern.', 'error'); return; }
    document.querySelector('.modal-backdrop')?.remove();
    _timeOpenProject(_timeState.activeProjectId);
    showToast('Zeit wurde manuell erfasst.');
}

async function _timeDeleteEntry(id) {
    if (!confirm('Diesen Zeiteintrag wirklich löschen?')) return;
    const { error } = await _supabase.from('time_entries').delete().eq('id', id);
    if (error) showToast('Fehler beim Löschen.', 'error');
    else _timeOpenProject(_timeState.activeProjectId);
}

function _timeChangeBuilding(id) {
    _timeState.activeBuilding = id;
    sessionStorage.setItem('hb_active_building', String(id));
    _timeRenderShell();
}

// ─── Projekt bearbeiten ──────────────────────────────────────

async function _timeOpenProjectEditModal(projId) {
    const { data: p, error } = await _supabase.from('time_projects').select('*').eq('id', projId).single();
    if (error || !p) { showToast('Projekt konnte nicht geladen werden.', 'error'); return; }

    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    m.innerHTML = `
        <div class="card w-full max-w-md overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Projekt bearbeiten</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Projekt-Titel</label>
                     <input type="text" id="pe-title" class="text-sm w-full" value="${p.title}"></div>
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Beschreibung (optional)</label>
                     <textarea id="pe-desc" class="text-sm w-full h-20">${p.description || ''}</textarea></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Stundensatz (€/h)</label>
                         <input type="number" id="pe-rate" class="text-sm w-full" value="${p.hourly_rate || 0}" step="0.01"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Abrechnungstakt</label>
                         <select id="pe-increment" class="text-sm w-full">
                            <option value="1" ${p.billing_increment_min == 1 ? 'selected' : ''}>Minutengenau</option>
                            <option value="15" ${p.billing_increment_min == 15 ? 'selected' : ''}>15 Min. Takt</option>
                            <option value="30" ${p.billing_increment_min == 30 ? 'selected' : ''}>30 Min. Takt</option>
                            <option value="60" ${p.billing_increment_min == 60 ? 'selected' : ''}>60 Min. Takt</option>
                         </select></div>
                </div>
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Status</label>
                     <select id="pe-status" class="text-sm w-full">
                        <option value="active" ${p.status === 'active' ? 'selected' : ''}>Aktiv</option>
                        <option value="closed" ${p.status === 'closed' ? 'selected' : ''}>Abgeschlossen</option>
                     </select></div>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveProjectEdit(${projId})" class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

async function _timeSaveProjectEdit(projId) {
    const title = document.getElementById('pe-title').value;
    const desc = document.getElementById('pe-desc').value;
    const rate = parseFloat(document.getElementById('pe-rate').value) || 0;
    const inc = parseInt(document.getElementById('pe-increment').value) || 1;
    const status = document.getElementById('pe-status').value;

    if (!title) { showToast('Titel ist erforderlich.', 'error'); return; }

    const { error } = await _supabase.from('time_projects').update({
        title, description: desc, hourly_rate: rate, billing_increment_min: inc, status
    }).eq('id', projId);

    if (error) { showToast('Fehler beim Speichern.', 'error'); return; }

    document.querySelector('.modal-backdrop')?.remove();
    _timeOpenProject(projId);
    showToast('Projekt wurde aktualisiert.');
}

// ─── Arbeitspaket bearbeiten ─────────────────────────────────

async function _timeEditWP(wpId, currentTitle) {
    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    m.innerHTML = `
        <div class="card w-full max-w-sm overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Arbeitspaket bearbeiten</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Bezeichnung</label>
                     <input type="text" id="wpe-title" class="text-sm w-full" value="${currentTitle}"></div>
                <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Status</label>
                     <select id="wpe-status" class="text-sm w-full">
                        <option value="open">Offen</option>
                        <option value="closed">Abgeschlossen</option>
                     </select></div>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveWPEdit(${wpId})" class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);

    // Aktuellen Status laden
    const { data: wp } = await _supabase.from('time_work_packages').select('status').eq('id', wpId).single();
    if (wp) document.getElementById('wpe-status').value = wp.status;
}

async function _timeSaveWPEdit(wpId) {
    const title = document.getElementById('wpe-title').value;
    const status = document.getElementById('wpe-status').value;

    if (!title) { showToast('Bezeichnung ist erforderlich.', 'error'); return; }

    const { error } = await _supabase.from('time_work_packages').update({ title, status }).eq('id', wpId);

    if (error) { showToast('Fehler beim Speichern.', 'error'); return; }

    document.querySelector('.modal-backdrop')?.remove();
    _timeOpenProject(_timeState.activeProjectId);
    showToast('Arbeitspaket aktualisiert.');
}

// ─── Zeiteintrag bearbeiten ──────────────────────────────────

async function _timeEditEntry(entryId) {
    const { data: e, error } = await _supabase.from('time_entries').select('*').eq('id', entryId).single();
    if (error || !e) { showToast('Eintrag konnte nicht geladen werden.', 'error'); return; }

    const start = new Date(e.start_time);
    const end = e.end_time ? new Date(e.end_time) : null;
    const dateStr = start.toISOString().split('T')[0];
    const startStr = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const endStr = end ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

    const m = document.createElement('div');
    m.className = 'modal-backdrop flex items-center justify-center p-4 z-[999]';
    m.innerHTML = `
        <div class="card w-full max-w-md overflow-hidden">
            <div class="bg-hb-olive px-6 py-4 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Zeiteintrag bearbeiten</span>
                <button onclick="this.closest('.modal-backdrop').remove()" class="text-white/50 hover:text-white">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Datum</label>
                         <input type="date" id="ee-date" class="text-sm w-full" value="${dateStr}"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Tätigkeit</label>
                         <input type="text" id="ee-desc" class="text-sm w-full" value="${(e.description || '').replace(/"/g, '&quot;')}"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Startzeit</label>
                         <input type="time" id="ee-start" class="text-sm w-full" value="${startStr}"></div>
                    <div><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Endzeit</label>
                         <input type="time" id="ee-end" class="text-sm w-full" value="${endStr}"></div>
                </div>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
                <button onclick="this.closest('.modal-backdrop').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_timeSaveEntryEdit(${entryId})" class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

async function _timeSaveEntryEdit(entryId) {
    const date = document.getElementById('ee-date').value;
    const startTime = document.getElementById('ee-start').value;
    const endTime = document.getElementById('ee-end').value;
    const desc = document.getElementById('ee-desc').value;

    if (!date || !startTime || !endTime) { showToast('Datum und Zeiten sind erforderlich.', 'error'); return; }

    const startISO = new Date(date + 'T' + startTime).toISOString();
    const endISO = new Date(date + 'T' + endTime).toISOString();

    const { error } = await _supabase.from('time_entries').update({
        start_time: startISO, end_time: endISO, description: desc
    }).eq('id', entryId);

    if (error) { showToast('Fehler beim Speichern.', 'error'); return; }

    document.querySelector('.modal-backdrop')?.remove();
    _timeOpenProject(_timeState.activeProjectId);
    showToast('Zeiteintrag aktualisiert.');
}

// ─── PDF Export (Arbeitsrapport) ──────────────────────────────

async function _timeGenerateReport(projId) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error');
        return;
    }

    showToast('Erstelle Arbeitsrapport…');

    try {
        // ── Daten laden ──────────────────────────────────────
        const [projRes, wpRes, settings] = await Promise.all([
            _supabase.from('time_projects').select('*, building:buildings(id, name, file_number, street, house_number, zip_code, city)').eq('id', projId).single(),
            _supabase.from('time_work_packages').select('*').eq('project_id', projId).order('id'),
            _pdfGetSettings()
        ]);

        const p = projRes.data;
        if (!p) { showToast('Projekt nicht gefunden.', 'error'); return; }
        const wps = wpRes.data || [];
        if (!wps.length) { showToast('Keine Arbeitspakete vorhanden.', 'error'); return; }

        const { data: entries } = await _supabase.from('time_entries')
            .select('*')
            .in('work_package_id', wps.map(x => x.id))
            .order('start_time', { ascending: true });

        if (!entries || !entries.length) { showToast('Keine Zeiteinträge vorhanden.', 'error'); return; }

        // ── PDF-Dokument + Briefbogen ────────────────────────
        const { PDFDocument, rgb } = PDFLib;

        if (!settings.letterhead_pdf_url) {
            showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error');
            return;
        }

        const { data: signedData } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
        if (!signedData?.signedUrl) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
        const lhResp = await fetch(signedData.signedUrl);
        if (!lhResp.ok) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
        const templateBytes = await lhResp.arrayBuffer();
        const templateDoc   = await PDFDocument.load(templateBytes);

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        let fReg, fSemi, fBold;
        try {
            ({ reg: fReg, semi: fSemi, bold: fBold } = await _pdfLoadInterFonts(pdfDoc));
        } catch (e) {
            console.error('Inter font load error:', e);
            showToast('Inter-Schriftart konnte nicht geladen werden: ' + e.message, 'error');
            return;
        }

        // ── Farben & Maße ────────────────────────────────────
        const olive    = rgb(0.408, 0.455, 0.318);
        const offblack = rgb(0.216, 0.216, 0.216);
        const orange   = rgb(0.922, 0.463, 0.176);
        const gray50   = rgb(0.5, 0.5, 0.5);
        const white    = rgb(1, 1, 1);

        const mLeft = 56.7, mRight = 538.6, mBottom = 60;
        const contentW = mRight - mLeft;
        const bld = p.building;
        const bldName   = bld ? formatBuildingName(bld) : '—';
        const bldStreet = bld ? `${bld.street || ''} ${bld.house_number || ''}`.trim() : '';
        const bldCity   = bld ? `${bld.zip_code || ''} ${bld.city || ''}`.trim() : '';
        const today     = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

        let page, pgH, y;

        // ── Hilfs-Funktionen ─────────────────────────────────
        function drawR(text, xRight, yPos, size, font, color) {
            const w = font.widthOfTextAtSize(text, size);
            page.drawText(text, { x: xRight - w, y: yPos, size, font, color });
        }

        function fmtDur(min) {
            const h = Math.floor(min / 60);
            const m = Math.round(min % 60);
            if (h > 0) return `${h} Std. ${m} Min.`;
            return `${m} Min.`;
        }

        // Olive Table-Header (wie Einzelwirtschaftsplan)
        function drawTableHeader(cols) {
            const hH = 22;
            page.drawRectangle({ x: mLeft, y: y - hH, width: contentW, height: hH, color: olive });
            const baseY = y - 5 - 8;
            cols.forEach(function(c) {
                if (c.align === 'right') {
                    drawR(c.label, c.x, baseY, 8, fBold, white);
                } else {
                    page.drawText(c.label, { x: c.x, y: baseY, size: 8, font: fBold, color: white });
                }
            });
            y -= hH;
        }

        // ── Seite 1 (ohne Kopfzeile, wie addFirstPage) ──────
        async function addFirstPage() {
            const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
            page = pdfDoc.addPage(copied);
            pgH = page.getSize().height;
            y = pgH - 100;
            // Nur Datum rechtsbündig
            drawR(today, mRight, y, 9, fReg, gray50);
            y -= 25;
        }

        // Folgeseiten mit kompakter Kopfzeile
        let currentCols = null; // gesetzt wenn Tabellenheader bei Seitenumbruch neu gezeichnet werden soll

        async function addPage() {
            const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
            page = pdfDoc.addPage(copied);
            pgH = page.getSize().height;
            // Kopfzeile unterhalb der Briefbogen-Logo-Zone (~100pt ab Seitenanfang)
            page.drawText(`Arbeitsrapport | ${p.title} | ${bldName}`, { x: mLeft, y: pgH - 112, size: 8, font: fReg, color: gray50 });
            page.drawLine({ start: { x: mLeft, y: pgH - 118 }, end: { x: mRight, y: pgH - 118 }, thickness: 0.5, color: gray50 });
            y = pgH - 136;
        }

        async function ensureSpace(needed) {
            if (y - needed < mBottom) {
                await addPage();
                if (currentCols) {
                    drawTableHeader(currentCols);
                    y -= 2;
                }
            }
        }

        // ── Seite 1: Titel + Info-Boxen ──────────────────────
        await addFirstPage();

        // Titel
        page.drawText('Arbeitsrapport', { x: mLeft, y, size: 16, font: fBold, color: offblack });
        y -= 20;
        page.drawText('Zeitnachweis', { x: mLeft, y, size: 12, font: fSemi, color: gray50 });
        y -= 25;

        // Objekt- & Verwalter-Block (zweispaltig, wie Einzelwirtschaftsplan)
        const boxH = 60;
        const halfW = contentW / 2;
        page.drawRectangle({ x: mLeft, y: y - boxH, width: contentW, height: boxH, borderColor: olive, borderWidth: 0.5, color: white });
        page.drawLine({ start: { x: mLeft + halfW, y }, end: { x: mLeft + halfW, y: y - boxH }, thickness: 0.5, color: olive });

        // Links: Objekt
        const boxPad = 8;
        page.drawText('Objekt', { x: mLeft + boxPad, y: y - 12, size: 7, font: fBold, color: gray50 });
        page.drawText(bldName, { x: mLeft + boxPad, y: y - 24, size: 9, font: fSemi, color: offblack });
        if (bldStreet) page.drawText(`${bldStreet}, ${bldCity}`, { x: mLeft + boxPad, y: y - 36, size: 8, font: fReg, color: gray50 });

        // Rechts: Verwalter
        const rX = mLeft + halfW + boxPad;
        page.drawText('Verwalter', { x: rX, y: y - 12, size: 7, font: fBold, color: gray50 });
        if (settings.company_name) page.drawText(settings.company_name, { x: rX, y: y - 24, size: 9, font: fSemi, color: offblack });
        const verwalterAddr = [settings.street, settings.zip_city].filter(Boolean).join(', ');
        if (verwalterAddr) page.drawText(verwalterAddr, { x: rX, y: y - 36, size: 8, font: fReg, color: gray50 });
        y -= boxH + 10;

        // Projekt-Box (olive-umrandet, wie Eigentümer-Box)
        const projBoxH = 48;
        page.drawRectangle({ x: mLeft, y: y - projBoxH, width: contentW, height: projBoxH, borderColor: olive, borderWidth: 0.5, color: white });
        page.drawText('Projekt', { x: mLeft + boxPad, y: y - 12, size: 7, font: fBold, color: gray50 });
        page.drawText(p.title, { x: mLeft + boxPad, y: y - 24, size: 10, font: fBold, color: offblack });
        const projMeta = `Taktung: ${p.billing_increment_min} Min.  |  Status: ${p.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}`;
        page.drawText(projMeta, { x: mLeft + boxPad, y: y - 38, size: 8, font: fReg, color: gray50 });
        // Erstellungsdatum rechts
        drawR(`Erstellt: ${today}`, mRight - boxPad, y - 38, 8, fReg, gray50);
        y -= projBoxH + 20;

        // ── Zeiteinträge je Arbeitspaket ─────────────────────
        let totalProjectMin = 0;

        // Spalten: Datum | Tätigkeit | Von | Bis | Dauer
        const cDatumR = mLeft + 62;  // rechtsbündige Kante Datum-Spalte
        const cTaet  = mLeft + 63;
        const cVonR  = mRight - 95;  // rechtsbündige Kante Von-Spalte
        const cBisR  = mRight - 47;  // rechtsbündige Kante Bis-Spalte
        const cDauer = mRight - 3;   // rechtsbündig

        const cols = [
            { label: 'Datum',       x: cDatumR, align: 'right' },
            { label: 'Tätigkeit',   x: cTaet },
            { label: 'Von',         x: cVonR, align: 'right' },
            { label: 'Bis',         x: cBisR, align: 'right' },
            { label: 'Dauer',       x: cDauer, align: 'right' }
        ];

        const descMaxW = cVonR - 40 - cTaet - 8;

        for (const wp of wps) {
            const wpEntries = entries.filter(function(e) { return e.work_package_id === wp.id; });
            if (!wpEntries.length) continue;

            // AP-Gruppierung: olive Balken mit Titel
            await ensureSpace(65);
            y -= 8;
            const apH = 20;
            page.drawRectangle({ x: mLeft, y: y - apH, width: contentW, height: apH, color: rgb(0.96, 0.97, 0.95), borderColor: olive, borderWidth: 0.5 });
            page.drawText(wp.title, { x: mLeft + 5, y: y - 14, size: 9, font: fBold, color: olive });
            y -= apH + 2;

            // Olive Tabellen-Header
            drawTableHeader(cols);
            y -= 2;
            currentCols = cols; // Tabellenheader bei Seitenumbruch wiederholen

            let wpMin = 0;

            for (const e of wpEntries) {
                const start = new Date(e.start_time);
                const end   = e.end_time ? new Date(e.end_time) : null;
                const durMin  = end ? (end - start) / 60000 : 0;
                const billed  = _timeRound(durMin, p.billing_increment_min);
                wpMin += billed;

                const desc = e.description || '—';
                const descLines = _pdfSplitText(desc, fReg, 8, descMaxW);
                const rowH = Math.max(16, descLines.length * 11 + 4);

                await ensureSpace(rowH + 4); // tatsächliche Zeilenhöhe reservieren

                // Zebra: 0.5pt kürzer, damit die Trennlinie der Vorgängerzeile nicht überdeckt wird
                if ((wpEntries.indexOf(e) % 2) === 1) {
                    page.drawRectangle({ x: mLeft, y: y - rowH, width: contentW, height: rowH - 0.5, color: rgb(0.976, 0.98, 0.973) });
                }

                const textY = y - 11;
                drawR(start.toLocaleDateString('de-DE'), cDatumR, textY, 8, fReg, offblack);
                drawR(start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), cVonR, textY, 8, fReg, offblack);
                drawR(end ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '…', cBisR, textY, 8, fReg, offblack);
                drawR(`${billed} Min.`, cDauer, textY, 8, fBold, offblack);

                descLines.forEach(function(line, li) {
                    page.drawText(line, { x: cTaet, y: textY - (li * 11), size: 8, font: fReg, color: gray50 });
                });

                y -= rowH;
                page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.3, color: olive });
            }

            currentCols = null; // Tabellenheader-Wiederholung deaktivieren

            // WP-Zwischensumme — Dauer rechtsbündig auf gleicher Position
            await ensureSpace(22);
            y -= 2;
            const sumH = 18;
            page.drawRectangle({ x: mLeft, y: y - sumH, width: contentW, height: sumH, color: rgb(0.96, 0.97, 0.95) });
            page.drawText(`Summe`, { x: mLeft + 3, y: y - 13, size: 8, font: fSemi, color: offblack });
            drawR(fmtDur(wpMin), cDauer, y - 13, 8, fBold, olive);
            y -= sumH + 12;

            totalProjectMin += wpMin;
        }

        // ── Gesamtsumme (Grand Total, olive bg wie im WP-PDF) ─
        await ensureSpace(50);
        y -= 5;
        const gtH = 24;
        page.drawRectangle({ x: mLeft, y: y - gtH, width: contentW, height: gtH, color: olive });
        page.drawText('Gesamtaufwand Projekt', { x: mLeft + 5, y: y - 16, size: 10, font: fBold, color: white });
        drawR(fmtDur(totalProjectMin), mRight - 3, y - 16, 10, fBold, white);
        y -= gtH + 20;

        // ── Hinweis-Box (orange, wie im Einzelwirtschaftsplan) ─
        await ensureSpace(50);
        const hintText = 'Dieses Dokument dient als Arbeitsnachweis für die erbrachten Leistungen und stellt keine Rechnung dar. ' +
            'Die Abrechnung erfolgt in der vereinbarten Taktung.';
        const hintPad = 10;
        const hintFS = 8;
        const hintLines = _pdfSplitText(hintText, fReg, hintFS, contentW - hintPad * 2 - 18);
        const hintBoxH = hintLines.length * 12 + hintPad * 2;

        page.drawRectangle({ x: mLeft, y: y - hintBoxH, width: contentW, height: hintBoxH,
            color: white, borderColor: orange, borderWidth: 1 });
        // Orange "i" circle
        const circleY = y - hintPad - 5;
        page.drawCircle({ x: mLeft + hintPad + 5, y: circleY, size: 5, color: orange });
        page.drawText('i', { x: mLeft + hintPad + 3, y: circleY - 3.5, size: 7, font: fBold, color: white });

        hintLines.forEach(function(line, i) {
            page.drawText(line, { x: mLeft + hintPad + 18, y: y - hintPad - 9 - (i * 12), size: hintFS, font: fReg, color: offblack });
        });

        // ── Download ─────────────────────────────────────────
        const pdfBytes = await pdfDoc.save();
        const filename = `Arbeitsrapport_${p.title.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_')}.pdf`;
        _pdfDownload(pdfBytes, filename);
        showToast('Arbeitsrapport wurde generiert.');

    } catch (err) {
        console.error('Arbeitsrapport PDF Fehler:', err);
        showToast('PDF konnte nicht erstellt werden: ' + err.message, 'error');
    }
}
