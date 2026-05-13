// ============================================================
// HB-Mieterportal | mod-objekte.js
// Modul: Gebäude & Einheiten — Info-Ansicht + Bearbeitung
// ============================================================

// ─── Tab-Helfer ──────────────────────────────────────────────
function makeTabSwitcher(btnPrefix, contentPrefix) {
    return (tabId) => {
        document.querySelectorAll(`.${contentPrefix}-content`).forEach(el => el.classList.add('hidden'));
        document.querySelectorAll(`.${contentPrefix}-btn`).forEach(el => {
            el.classList.remove('border-hb-olive', 'text-hb-olive');
            el.classList.add('border-transparent', 'text-gray-500');
        });
        document.getElementById(`${contentPrefix}-${tabId}`)?.classList.remove('hidden');
        const btn = document.getElementById(`${btnPrefix}-${tabId}`);
        if (btn) { btn.classList.add('border-hb-olive', 'text-hb-olive'); btn.classList.remove('border-transparent', 'text-gray-500'); }
    };
}
window.switchBuildingTab = makeTabSwitcher('bldg-btn', 'bldg-tab');
window.switchAptTab      = makeTabSwitcher('apt-btn',  'apt-tab');

// ─── Read-only Feldhelfer ─────────────────────────────────────
function infoField(label, value, span = '') {
    const v = (value !== null && value !== undefined && value !== '') ? value : '—';
    return `<div class="${span}">
        <p class="text-[9px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">${label}</p>
        <p class="text-sm font-semibold text-hb-offblack">${v}</p>
    </div>`;
}
function infoSection(title) {
    return `<div class="md:col-span-2 border-t pt-4 mt-2">
        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">${title}</h3>
    </div>`;
}
function boolField(label, value) {
    const icon = value ? '✓ Ja' : '✗ Nein';
    const cls  = value ? 'text-hb-success' : 'text-gray-400';
    return `<div class="space-y-1">
        <p class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">${label}</p>
        <p class="text-sm font-semibold ${cls}">${icon}</p>
    </div>`;
}

// ─── Tab-Navigation HTML ──────────────────────────────────────
function tabNav(tabs, btnPrefix, activeFirst) {
    return tabs.map((t, i) =>
        `<button type="button" id="${btnPrefix}-${t.id}" onclick="switch${btnPrefix === 'bldg-btn' ? 'BuildingTab' : 'AptTab'}('${t.id}')"
            class="${btnPrefix === 'bldg-btn' ? 'bldg' : 'apt'}-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors ${i === 0 ? 'border-hb-olive text-hb-olive' : 'border-transparent text-gray-500 hover:text-gray-700'}">${t.label}</button>`
    ).join('');
}

// ─── Hauptlayout ─────────────────────────────────────────────
async function loadTenants() {
    // Nur admin/manager dürfen Gebäude & Einheiten verwalten
    if (!['admin', 'manager'].includes(userProfile?.role)) {
        showToast('Kein Zugriff auf Gebäude & Einheiten.', 'error');
        return;
    }
    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] text-left">
            <!-- Linke Sidebar: schmaler -->
            <div class="w-full lg:w-56 xl:w-64 flex-shrink-0 flex flex-col gap-3 h-full">
                <div class="card flex flex-col h-full overflow-hidden">
                    <div class="px-4 py-3 flex justify-between items-center bg-hb-olive">
                        <h2 class="text-sm font-bold text-white">Objekte</h2>
                        <button onclick="showBuildingForm()"
                            class="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors">+ Neues Objekt</button>
                    </div>
                    <!-- Suche -->
                    <div class="px-3 py-2 border-b border-gray-50">
                        <input type="text" id="building-search" placeholder="Suchen…"
                            oninput="filterBuildingsList(this.value)"
                            class="text-xs h-8 px-3 rounded-lg">
                    </div>
                    <div id="buildings-list" class="flex-grow overflow-y-auto p-2 space-y-0.5"></div>
                </div>
            </div>
            <!-- Rechter Bereich -->
            <div class="flex-1 flex flex-col h-full min-w-0" id="units-area">
                <div class="card p-10 flex flex-col items-center justify-center text-gray-400 h-full">
                    Bitte wähle ein Objekt aus.
                </div>
            </div>
        </div>`;
    await fetchBuildingsList();
}

let _buildingsAll = [];

async function fetchBuildingsList(query = '') {
    const list = document.getElementById('buildings-list');
    if (!list) return;
    const { data } = await _supabase.from('buildings').select('*').order('name');
    _buildingsAll = data || [];
    currentBuildings = _buildingsAll;
    renderBuildingsList(query);
}

function renderBuildingsList(query = '') {
    const list = document.getElementById('buildings-list');
    if (!list) return;
    const q = query.toLowerCase();
    const filtered = q
        ? _buildingsAll.filter(b =>
            (b.name || '').toLowerCase().includes(q) ||
            (b.street || '').toLowerCase().includes(q) ||
            (b.file_number || '').toLowerCase().includes(q))
        : _buildingsAll;

    list.innerHTML = filtered.map(b => `
        <div onclick="selectBuilding(${b.id})" id="b-item-${b.id}"
            class="px-3 py-3 rounded-lg cursor-pointer
                   hover:bg-gray-100 transition-all text-left group">
            <p class="font-bold text-xs text-hb-offblack truncate group-hover:text-hb-olive">${formatBuildingName(b)}</p>
            <p class="text-[10px] text-gray-400 truncate">${b.street ? `${b.street} ${b.house_number || ''}` : (b.city || '')}</p>
        </div>`).join('')
        || '<p class="text-xs text-gray-400 p-3">Keine Treffer.</p>';

    if (selectedBuildingId) markSelectedBuilding(selectedBuildingId);
}

window.filterBuildingsList = (query) => renderBuildingsList(query);

function markSelectedBuilding(id) {
    document.querySelectorAll('[id^="b-item-"]').forEach(el => {
        el.classList.remove('bg-hb-ultralight', 'bg-gray-100');
    });
    const sel = document.getElementById(`b-item-${id}`);
    if (sel) { sel.classList.add('bg-hb-ultralight'); }
}

// ─── Gebäude auswählen → Info-Ansicht ────────────────────────
async function selectBuilding(id) {
    selectedBuildingId = id;
    markSelectedBuilding(id);
    const b = _buildingsAll.find(x => x.id === id);
    if (!b) return;
    await showBuildingInfo(b);
}

async function showBuildingInfo(b) {
    const area = document.getElementById('units-area');
    const [bankRes, dkRes, bmRes] = await Promise.all([
        _supabase.from('building_bank_accounts').select('*').eq('building_id', b.id),
        _supabase.from('distribution_keys').select('id, name, type, total_value, heiz_split_percent, is_system_default').eq('building_id', b.id).order('is_system_default', { ascending: false }),
        _supabase.from('board_members').select('id, person_id, valid_from, valid_to, persons(first_name, last_name)').eq('building_id', b.id).is('valid_to', null),
    ]);
    const bankAccounts = bankRes.data || [];
    const distKeys = dkRes.data || [];
    const boardMembers = bmRes.data || [];
    const addr = b.street ? `${b.street} ${b.house_number || ''}, ${b.zip_code || ''} ${b.city || ''}` : '—';

    area.innerHTML = `
        <div class="card h-full flex flex-col overflow-hidden text-left">
            <!-- Header -->
            <div class="px-4 py-3 border-b border-gray-50 flex justify-between items-center flex-shrink-0">
                <div>
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">${b.status || 'aktiv'}</span>
                        <span class="text-[10px] font-bold text-gray-400">Nr. ${b.file_number || '—'}</span>
                    </div>
                    <h2 class="text-base font-extrabold text-hb-offblack leading-tight">${formatBuildingName(b)}</h2>
                    <p class="text-xs text-gray-500">${addr}</p>
                </div>
                <button onclick="showBuildingForm(${b.id})"
                    class="btn-outline text-xs px-3 py-1.5 flex-shrink-0">Bearbeiten</button>
            </div>

            <!-- Tabs -->
            <div class="flex overflow-x-auto border-b border-gray-200 px-4 gap-5 hide-scrollbar flex-shrink-0">
                ${tabNav([
                    {id:'base',    label:'Stammdaten'},
                    {id:'finance', label:'Finanzen'},
                    {id:'legal',   label:'Grundbuch'},
                    {id:'tech',    label:'Technik & Fristen'},
                ], 'bldg-btn', 'base')}
                <button type="button" id="bldg-btn-keys"
                    onclick="switchBuildingTab('keys')"
                    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Verteilerschlüssel</button>
            </div>

            <!-- Tab-Content: nimmt nur so viel wie nötig, max 25vh -->
            <div class="overflow-y-auto p-3 flex-shrink-0" style="max-height:25vh">

                <!-- TAB 1 -->
                <div id="bldg-tab-base" class="bldg-tab-content grid grid-cols-2 md:grid-cols-3 gap-3">
                    ${infoField('Akten-Nr.', b.file_number)}
                    ${infoField('Status', b.status)}
                    ${infoField('Baujahr', b.construction_year)}
                    ${infoField('Straße', b.street)}
                    ${infoField('Hausnummer', b.house_number)}
                    ${infoField('PLZ / Ort', b.zip_code && b.city ? `${b.zip_code} ${b.city}` : (b.city || b.zip_code))}
                    ${b.notes ? infoField('Notizen', b.notes, 'col-span-2 md:col-span-3') : ''}
                </div>

                <!-- TAB 2: FINANZEN -->
                <div id="bldg-tab-finance" class="bldg-tab-content hidden space-y-3">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        ${infoField('Wirtschaftsjahr', `${b.fiscal_year_start || '01-01'} – ${b.fiscal_year_end || '12-31'}`)}
                        ${infoField('Steuernummer', b.tax_number)}
                        ${infoField('Gläubiger-ID (SEPA)', b.creditor_id)}
                    </div>
                    <div class="border-t pt-3">
                        <h3 class="text-xs font-black uppercase tracking-widest text-hb-olive mb-2">Bankkonten</h3>
                        ${bankAccounts.length
                            ? `<table class="w-full text-sm">
                                <thead><tr class="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100">
                                    <th class="pb-1 text-left">Typ</th><th class="pb-1 text-left">Bank</th><th class="pb-1 text-left">IBAN</th>
                                </tr></thead>
                                <tbody class="divide-y divide-hb-olive/10">${bankAccounts.map(ba =>
                                    `<tr><td class="py-1.5 font-medium">${ba.account_type || '—'}</td>
                                         <td class="py-1.5 text-gray-600">${ba.bank_name || '—'}</td>
                                         <td class="py-1.5 font-mono text-xs text-gray-600">${ba.iban || '—'}</td></tr>`
                                ).join('')}</tbody></table>`
                            : '<p class="text-[15px] text-gray-400">Keine Bankkonten hinterlegt.</p>'}
                    </div>
                </div>

                <!-- TAB 3: GRUNDBUCH -->
                <div id="bldg-tab-legal" class="bldg-tab-content hidden">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        ${infoField('Gesamt-MEA', b.total_mea)}
                        ${infoField('Grundbuchamt', b.land_registry)}
                        ${infoField('Gemarkung', b.district)}
                        ${infoField('Flur', b.parcel)}
                        ${infoField('Flurstück-Nr.', b.parcel_number)}
                        ${infoField('Notar', b.notary_name)}
                        ${infoField('Teilungserklärung', b.declaration_of_division_date)}
                        ${infoField('Letzte Änderung TE', b.declaration_last_amendment_date)}
                    </div>
                    <!-- Verwaltungsbeirat -->
                    <div class="mt-4 border-t border-gray-100 pt-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="text-sm font-bold text-hb-offblack">Verwaltungsbeirat</h4>
                            <button onclick="_showAddBoardMemberModal(${b.id})"
                                class="btn-outline text-xs px-3 py-1.5">+ Beirat hinzufügen</button>
                        </div>
                        <div id="board-members-list">
                            ${boardMembers.length ? boardMembers.map(bm => {
                                const name = bm.persons ? [bm.persons.first_name, bm.persons.last_name].filter(Boolean).join(' ') : '—';
                                const von = bm.valid_from ? new Date(bm.valid_from).toLocaleDateString('de-DE') : '—';
                                const bis = bm.valid_to ? new Date(bm.valid_to).toLocaleDateString('de-DE') : 'unbefristet';
                                return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div>
                                        <span class="text-sm font-semibold text-gray-700">${name}</span>
                                        <span class="text-xs text-gray-400 ml-2">${von} – ${bis}</span>
                                    </div>
                                    <button onclick="_removeBoardMember(${bm.id}, ${b.id})"
                                        class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5">Entfernen</button>
                                </div>`;
                            }).join('') : '<p class="text-[15px] text-gray-400">Kein Beirat zugewiesen.</p>'}
                        </div>
                    </div>
                </div>

                <!-- TAB 4: TECHNIK -->
                <div id="bldg-tab-tech" class="bldg-tab-content hidden grid grid-cols-2 md:grid-cols-3 gap-3">
                    ${infoField('Heizungsart', b.heating_type)}
                    ${infoField('Energieträger', b.energy_source)}
                    ${infoField('Baujahr Heizung', b.heating_system_year)}
                    ${infoField('Aufzüge', b.elevator_count ?? 0)}
                    ${infoField('Schließanlage', b.locking_system_id)}
                    ${infoField('Hauptwasserzähler', b.main_water_meter_id)}
                    ${infoField('Energieausweis Typ', b.energy_certificate_type)}
                    ${infoField('Energieausweis bis', b.energy_certificate_expiry)}
                    ${infoSection('Legionellen & Brandschutz')}
                    ${boolField('Prüfung erforderlich', b.legionella_check_required)}
                    ${infoField('Letzte Prüfung', b.last_legionella_check)}
                    ${infoField('Intervall (Monate)', b.legionella_check_interval_months)}
                    ${infoField('Trinkwasser fällig', b.drinking_water_analysis_due)}
                    ${infoField('Brandschutz fällig', b.next_fire_safety_check)}
                </div>

                <!-- TAB 5: VERTEILERSCHLÜSSEL -->
                <div id="bldg-tab-keys" class="bldg-tab-content hidden">
                    ${_dkRenderTab(distKeys, b.id)}
                </div>

            </div>

            <!-- Einheitenliste: nimmt verbleibenden Platz, scrollbar -->
            <div class="border-t border-hb-olive/12 flex-grow flex flex-col min-h-0">
                <div class="px-4 py-2.5 bg-hb-olive/80 flex justify-between items-center flex-shrink-0">
                    <h3 class="text-sm font-bold text-white">Einheiten</h3>
                    <button onclick="showApartmentForm()" class="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">+ Einheit</button>
                </div>
                <div id="apartments-list" class="flex-grow overflow-y-auto"></div>
            </div>
        </div>`;

    // Responsive tables (bank accounts, distribution keys)
    area.querySelectorAll('table').forEach(t => {
        makeTableResponsive(t.parentElement);
    });

    await fetchApartmentsForBuilding(b.id);
}

// ─── Einheiten als Tabelle ────────────────────────────────────
async function fetchApartmentsForBuilding(bId) {
    const list = document.getElementById('apartments-list');
    if (!list) return;
    const { data } = await _supabase.from('apartments').select('*').eq('building_id', bId).order('apartment_number');
    currentApartments = data || [];

    if (!currentApartments.length) {
        list.innerHTML = '<p class="text-[15px] text-gray-400 p-4">Noch keine Einheiten angelegt.</p>';
        return;
    }

    // Hausgeld dynamisch aus aktivem WP laden (parallel für alle Einheiten)
    const hgResults = await Promise.all(currentApartments.map(apt => getMonthlyHausgeld(apt.id, bId)));
    const hgMap = {};
    currentApartments.forEach((apt, i) => { hgMap[apt.id] = hgResults[i]; });

    list.innerHTML = `
        <table class="w-full text-left text-sm">
            <thead class="text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
                <tr>
                    <th class="px-4 py-2">Nr.</th>
                    <th class="px-4 py-2">Typ</th>
                    <th class="px-4 py-2">Lage</th>
                    <th class="px-4 py-2">m²</th>
                    <th class="px-4 py-2">Hausgeld</th>
                    <th class="px-4 py-2">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-hb-olive/10">
                ${currentApartments.map(apt => {
                    const hg = hgMap[apt.id] ?? apt.hausgeld;
                    const statusCls = apt.tenant_status === 'Vermietet'
                        ? 'bg-hb-success/12 text-hb-success'
                        : 'bg-gray-100 text-gray-500';
                    return `<tr onclick="showApartmentInfo(${apt.id})"
                        class="hover:bg-hb-ultralight cursor-pointer transition-colors">
                        <td class="px-4 py-2.5 font-bold text-hb-offblack">${apt.apartment_number}</td>
                        <td class="px-4 py-2.5 text-gray-600">${apt.type || 'Wohnen'}</td>
                        <td class="px-4 py-2.5 text-gray-500 text-xs">${apt.location_in_building || apt.floor || '—'}</td>
                        <td class="px-4 py-2.5 text-gray-600">${apt.sq_meters ? apt.sq_meters + ' m²' : '—'}</td>
                        <td class="px-4 py-2.5 text-gray-600">${hg ? hg + ' €' : '—'}</td>
                        <td class="px-4 py-2.5">
                            <span class="${statusCls} text-[10px] font-bold px-2 py-0.5 rounded-full">${apt.tenant_status || 'Leerstand'}</span>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
    makeTableResponsive(list);
}

// ─── Einheit Info-Ansicht ─────────────────────────────────────
async function showApartmentInfo(id) {
    const area = document.getElementById('units-area');
    const apt  = currentApartments.find(x => x.id === id);
    if (!apt) return;
    const building    = _buildingsAll.find(x => x.id === selectedBuildingId);
    const assignments = await fetchApartmentAssignments(id);
    const costKeys    = apt.custom_distribution_keys || {};
    const aptDynHG    = await getMonthlyHausgeld(apt.id, apt.building_id);

    area.innerHTML = `
        <div class="card h-full flex flex-col overflow-hidden text-left">
            <!-- Header -->
            <div class="p-6 border-b border-gray-50 flex justify-between items-start flex-shrink-0">
                <div>
                    <button onclick="selectBuilding(${selectedBuildingId})"
                        class="text-xs font-bold text-hb-olive hover:underline mb-1 block">← ${building?.name || 'Gebäude'}</button>
                    <h2 class="text-xl font-extrabold text-hb-offblack">Wohnung ${apt.apartment_number}</h2>
                    <p class="text-sm text-gray-500">${apt.type || 'Wohnen'} · ${apt.sq_meters || 0} m² · ${apt.rooms || 0} Zimmer</p>
                </div>
                <button onclick="showApartmentForm(${apt.id})"
                    class="btn-outline text-xs px-3 py-1.5 flex-shrink-0">Bearbeiten</button>
            </div>

            <!-- Tabs -->
            <div class="flex overflow-x-auto border-b border-gray-200 px-6 gap-6 hide-scrollbar flex-shrink-0">
                ${tabNav([
                    {id:'base',    label:'Stammdaten'},
                    {id:'billing', label:'Abrechnung'},
                    {id:'finance', label:'Finanzen'},
                    {id:'meters',  label:'Zähler'},
                    {id:'legal',   label:'Rechtliches'},
                ], 'apt-btn', 'base')}
            </div>

            <div class="flex-grow overflow-y-auto p-6">

                <!-- TAB 1 -->
                <div id="apt-tab-base" class="apt-tab-content grid grid-cols-2 md:grid-cols-3 gap-5">
                    ${infoField('Wohnungs-Nr.', apt.apartment_number)}
                    ${infoField('Typ', apt.type)}
                    ${infoField('Etage', apt.floor)}
                    ${infoField('Lage im Gebäude', apt.location_in_building)}
                    ${infoField('Zimmer', apt.rooms)}
                    ${infoField('Fläche', apt.sq_meters ? apt.sq_meters + ' m²' : null)}
                    ${apt.equipment_features ? infoField('Ausstattung', apt.equipment_features, 'col-span-2 md:col-span-3') : ''}
                </div>

                <!-- TAB 2: ABRECHNUNG -->
                <div id="apt-tab-billing" class="apt-tab-content hidden grid grid-cols-2 md:grid-cols-3 gap-5">
                    ${infoField('MEA (dezimal)', apt.mea)}
                    ${infoField('MEA Zähler', apt.mea_numerator)}
                    ${infoField('MEA Nenner', apt.mea_denominator)}
                    ${infoSection('Abweichende Verteilerschlüssel')}
                    ${Object.keys(costKeys).length
                        ? Object.entries(costKeys).map(([k, v]) => infoField(k, v)).join('')
                        : '<p class="col-span-full text-[15px] text-gray-400">Keine abweichenden Schlüssel.</p>'}
                </div>

                <!-- TAB 3: FINANZEN -->
                <div id="apt-tab-finance" class="apt-tab-content hidden grid grid-cols-2 md:grid-cols-3 gap-5">
                    ${infoField('Hausgeld', aptDynHG ? aptDynHG + ' €' : (apt.hausgeld ? apt.hausgeld + ' €' : null))}
                    ${infoField('Kaltmiete', apt.rent_amount ? apt.rent_amount + ' €' : null)}
                    ${infoField('Nebenkosten', apt.utilities_amount ? apt.utilities_amount + ' €' : null)}
                    ${infoField('Kaution', apt.deposit_amount ? apt.deposit_amount + ' €' : null)}
                    ${boolField('Kaution bezahlt', apt.deposit_paid)}
                </div>

                <!-- TAB 4: ZÄHLER -->
                <div id="apt-tab-meters" class="apt-tab-content hidden grid grid-cols-2 md:grid-cols-3 gap-5">
                    ${infoField('Strom Nr.', apt.meter_electricity)}
                    <div></div>
                    ${infoField('Kaltwasser Nr.', apt.meter_water)}
                    ${infoField('Kaltwasser Eichung', apt.meter_water_calibration_until)}
                    ${infoField('Warmwasser Nr.', apt.meter_water_warm)}
                    ${infoField('Warmwasser Eichung', apt.meter_water_warm_calibration)}
                    ${infoField('Heizkosten Nr.', apt.meter_heating)}
                    ${infoField('Heizkosten Eichung', apt.meter_heating_calibration_until)}
                </div>

                <!-- TAB 5: RECHTLICHES -->
                <div id="apt-tab-legal" class="apt-tab-content hidden space-y-5">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-5">
                        ${infoField('Belegungsstatus', apt.tenant_status)}
                        ${infoField('Sondernutzungsrecht', apt.special_use_rights)}
                    </div>
                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-xs font-black uppercase tracking-widest text-hb-olive">Zugewiesene Personen</h3>
                            <button type="button" onclick="openAssignModal(${id})"
                                class="btn-primary text-xs px-3 py-1.5">+ Zuweisung</button>
                        </div>
                        <div id="apt-assignments">${renderAssignmentsList(assignments)}</div>
                    </div>
                </div>

            </div>
        </div>`;
}

// ─── Gebäude-Formular (4 Tabs, Edit) ─────────────────────────
async function showBuildingForm(id = null) {
    const area = document.getElementById('units-area');
    let b = {};
    let bankAccounts = [];
    if (id) {
        b = _buildingsAll.find(x => x.id === id) || {};
        const { data } = await _supabase.from('building_bank_accounts').select('*').eq('building_id', id);
        bankAccounts = data || [];
    }
    const isEdit = !!id;

    area.innerHTML = `
        <div class="card p-6 h-full overflow-y-auto flex flex-col text-left">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 class="text-xl font-extrabold text-hb-offblack">${isEdit ? 'Gebäude bearbeiten' : 'Neues Gebäude'}</h2>
                <button onclick="${isEdit ? `selectBuilding(${id})` : 'selectedBuildingId ? selectBuilding(selectedBuildingId) : loadTenants()'}"
                    class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-6 hide-scrollbar flex-shrink-0">
                ${tabNav([
                    {id:'base',    label:'Stammdaten'},
                    {id:'finance', label:'Finanzen'},
                    {id:'legal',   label:'Grundbuch'},
                    {id:'tech',    label:'Technik & Fristen'},
                ], 'bldg-btn', 'base')}
            </div>

            <form id="building-form" class="flex-grow space-y-6">

                <div id="bldg-tab-base" class="bldg-tab-content grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1 md:col-span-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Objektname (automatisch)</label>
                        <input type="text" id="b_name" value="${b.name || ''}" readonly class="bg-gray-100 text-gray-500 cursor-default" tabindex="-1">
                    </div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Akten-Nr.</label>
                        <input type="text" id="b_file" value="${b.file_number || ''}" oninput="updateBuildingName()"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Status</label>
                        <select id="b_status">
                            <option value="aktiv"    ${(b.status||'aktiv')==='aktiv'    ?'selected':''}>Aktiv</option>
                            <option value="inaktiv"  ${b.status==='inaktiv'             ?'selected':''}>Inaktiv</option>
                            <option value="verkauft" ${b.status==='verkauft'            ?'selected':''}>Verkauft</option>
                        </select></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Straße</label>
                        <input type="text" id="b_street" value="${b.street || ''}" oninput="updateBuildingName()"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Hausnummer</label>
                        <input type="text" id="b_nr" value="${b.house_number || ''}" oninput="updateBuildingName()"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label>
                        <input type="text" id="b_zip" value="${b.zip_code || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Ort</label>
                        <input type="text" id="b_city" value="${b.city || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Baujahr</label>
                        <input type="number" id="b_year" value="${b.construction_year || ''}"></div>
                    <div class="space-y-1 md:col-span-2"><label class="text-[10px] uppercase font-bold text-gray-500">Notizen</label>
                        <textarea id="b_notes" rows="2">${b.notes || ''}</textarea></div>
                </div>

                <div id="bldg-tab-finance" class="bldg-tab-content hidden space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">WJ Beginn (MM-TT)</label>
                            <input type="text" id="b_fy_start" value="${b.fiscal_year_start || '01-01'}" placeholder="01-01"></div>
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">WJ Ende (MM-TT)</label>
                            <input type="text" id="b_fy_end" value="${b.fiscal_year_end || '12-31'}" placeholder="12-31"></div>
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Steuernummer</label>
                            <input type="text" id="b_taxno" value="${b.tax_number || ''}"></div>
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Gläubiger-ID</label>
                            <input type="text" id="b_creditor" value="${b.creditor_id || ''}"></div>
                    </div>
                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Bankkonten</h3>
                            ${isEdit ? `<button type="button" onclick="addBankAccountRow()"
                                class="btn-outline text-xs px-3 py-1.5">+ Konto</button>`
                                : '<span class="text-xs text-gray-400">Nach erstem Speichern verfügbar.</span>'}
                        </div>
                        <div id="bank-accounts-list" class="space-y-3">
                            ${bankAccounts.map(ba => bankAccountRowHtml(ba)).join('') || '<p class="text-[15px] text-gray-400">Keine Konten hinterlegt.</p>'}
                        </div>
                    </div>
                </div>

                <div id="bldg-tab-legal" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Gesamt-MEA</label>
                        <input type="number" id="b_total_mea" value="${b.total_mea || ''}" step="0.0001"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Grundbuchamt</label>
                        <input type="text" id="b_registry" value="${b.land_registry || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Gemarkung</label>
                        <input type="text" id="b_district" value="${b.district || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Flur</label>
                        <input type="text" id="b_parcel" value="${b.parcel || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Flurstück-Nr.</label>
                        <input type="text" id="b_parcel_no" value="${b.parcel_number || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Notar</label>
                        <input type="text" id="b_notary" value="${b.notary_name || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Teilungserklärung Datum</label>
                        <input type="date" id="b_div_date" value="${b.declaration_of_division_date || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Letzte Änderung TE</label>
                        <input type="date" id="b_div_amend" value="${b.declaration_last_amendment_date || ''}"></div>
                </div>

                <div id="bldg-tab-tech" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Heizungsart</label>
                        <input type="text" id="b_heat_type" value="${b.heating_type || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Energieträger</label>
                        <input type="text" id="b_energy" value="${b.energy_source || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Baujahr Heizung</label>
                        <input type="number" id="b_heat_year" value="${b.heating_system_year || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Aufzüge Anzahl</label>
                        <input type="number" id="b_elevator" value="${b.elevator_count ?? 0}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Schließanlage ID</label>
                        <input type="text" id="b_lock" value="${b.locking_system_id || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Hauptwasserzähler</label>
                        <input type="text" id="b_main_water" value="${b.main_water_meter_id || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Energieausweis Typ</label>
                        <select id="b_ec_type">
                            <option value=""          ${!b.energy_certificate_type                  ?'selected':''}>— keiner —</option>
                            <option value="Bedarfs"   ${b.energy_certificate_type==='Bedarfs'       ?'selected':''}>Bedarfsausweis</option>
                            <option value="Verbrauchs"${b.energy_certificate_type==='Verbrauchs'    ?'selected':''}>Verbrauchsausweis</option>
                        </select></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Energieausweis bis</label>
                        <input type="date" id="b_ec_expiry" value="${b.energy_certificate_expiry || ''}"></div>
                    <div class="md:col-span-2 border-t pt-3">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-3">Legionellen & Brandschutz</h3>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-3">
                        <input type="checkbox" id="b_leg_req" ${b.legionella_check_required ? 'checked' : ''}>
                        <label for="b_leg_req" class="text-sm font-bold text-gray-700 cursor-pointer">Legionellenprüfung erforderlich</label>
                    </div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Letzte Prüfung</label>
                        <input type="date" id="b_leg_last" value="${b.last_legionella_check || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Intervall (Monate)</label>
                        <input type="number" id="b_leg_interval" value="${b.legionella_check_interval_months || 36}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Trinkwasser fällig</label>
                        <input type="date" id="b_water_due" value="${b.drinking_water_analysis_due || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Brandschutz fällig</label>
                        <input type="date" id="b_fire_next" value="${b.next_fire_safety_check || ''}"></div>
                </div>

                <div class="pt-4 border-t flex gap-4 flex-shrink-0">
                    <button type="submit" class="btn-primary">Speichern</button>
                </div>
            </form>
        </div>`;

    document.getElementById('building-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Speichert...';
        const payload = {
            name:                             document.getElementById('b_name').value,
            file_number:                      document.getElementById('b_file').value || null,
            status:                           document.getElementById('b_status').value,
            street:                           document.getElementById('b_street').value || null,
            house_number:                     document.getElementById('b_nr').value || null,
            zip_code:                         document.getElementById('b_zip').value || null,
            city:                             document.getElementById('b_city').value || null,
            construction_year:                parseInt(document.getElementById('b_year').value) || null,
            notes:                            document.getElementById('b_notes').value || null,
            fiscal_year_start:                document.getElementById('b_fy_start').value || '01-01',
            fiscal_year_end:                  document.getElementById('b_fy_end').value || '12-31',
            tax_number:                       document.getElementById('b_taxno').value || null,
            creditor_id:                      document.getElementById('b_creditor').value || null,
            total_mea:                        parseFloat(document.getElementById('b_total_mea').value) || null,
            land_registry:                    document.getElementById('b_registry').value || null,
            district:                         document.getElementById('b_district').value || null,
            parcel:                           document.getElementById('b_parcel').value || null,
            parcel_number:                    document.getElementById('b_parcel_no').value || null,
            notary_name:                      document.getElementById('b_notary').value || null,
            declaration_of_division_date:     document.getElementById('b_div_date').value || null,
            declaration_last_amendment_date:  document.getElementById('b_div_amend').value || null,
            heating_type:                     document.getElementById('b_heat_type').value || null,
            energy_source:                    document.getElementById('b_energy').value || null,
            heating_system_year:              parseInt(document.getElementById('b_heat_year').value) || null,
            elevator_count:                   parseInt(document.getElementById('b_elevator').value) || 0,
            locking_system_id:                document.getElementById('b_lock').value || null,
            main_water_meter_id:              document.getElementById('b_main_water').value || null,
            energy_certificate_type:          document.getElementById('b_ec_type').value || null,
            energy_certificate_expiry:        document.getElementById('b_ec_expiry').value || null,
            legionella_check_required:        document.getElementById('b_leg_req').checked,
            last_legionella_check:            document.getElementById('b_leg_last').value || null,
            legionella_check_interval_months: parseInt(document.getElementById('b_leg_interval').value) || 36,
            drinking_water_analysis_due:      document.getElementById('b_water_due').value || null,
            next_fire_safety_check:           document.getElementById('b_fire_next').value || null,
        };
        const res = isEdit
            ? await _supabase.from('buildings').update(payload).eq('id', id)
            : await _supabase.from('buildings').insert([payload]).select('id').single();
        if (res.error) { showToast(res.error.message, 'error'); btn.disabled = false; btn.textContent = 'Speichern'; return; }
        showToast('Gebäude gespeichert.', 'success');
        const { data } = await _supabase.from('buildings').select('*').order('name');
        _buildingsAll = data || [];
        currentBuildings = _buildingsAll;
        renderBuildingsList(document.getElementById('building-search')?.value || '');
        const savedId = isEdit ? id : res.data?.id;
        if (savedId) { selectedBuildingId = savedId; const b2 = _buildingsAll.find(x => x.id === savedId); if (b2) showBuildingInfo(b2); }
    };
}

window.updateBuildingName = () => {
    const file   = document.getElementById('b_file')?.value?.trim();
    const street = document.getElementById('b_street')?.value?.trim();
    const nr     = document.getElementById('b_nr')?.value?.trim();
    const parts  = [];
    if (file) parts.push(`[${file}]`);
    parts.push('WEG');
    if (street) parts.push(street);
    if (nr) parts.push(nr);
    const el = document.getElementById('b_name');
    if (el) el.value = parts.join(' ');
};

// ─── Bankkonten ───────────────────────────────────────────────
function bankAccountRowHtml(ba) {
    const rowId = ba.id ? `ba-row-${ba.id}` : 'ba-row-new';
    return `<div class="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-hb-ultralight rounded-xl border border-gray-100 items-end" id="${rowId}">
        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-400">Typ</label>
            <select class="ba-type text-xs h-9 px-2" data-id="${ba.id || ''}">
                <option value="Hausgeldkonto"  ${ba.account_type==='Hausgeldkonto'  ?'selected':''}>Hausgeldkonto</option>
                <option value="Rücklagenkonto" ${ba.account_type==='Rücklagenkonto' ?'selected':''}>Rücklagenkonto</option>
                <option value="Sonstiges"      ${ba.account_type==='Sonstiges'      ?'selected':''}>Sonstiges</option>
            </select></div>
        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-400">Bank</label>
            <input type="text" class="ba-bank text-xs h-9 px-2" value="${ba.bank_name || ''}"></div>
        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-400">IBAN</label>
            <input type="text" class="ba-iban text-xs h-9 px-2" value="${ba.iban || ''}" placeholder="DE..."></div>
        <div class="flex gap-1 items-end">
            <button type="button" onclick="saveBankAccount(${selectedBuildingId}, '${ba.id || ''}')"
                class="btn-primary text-xs px-2 h-9 flex-1">OK</button>
            <button type="button" onclick="deleteBankAccount('${ba.id || ''}')"
                class="text-hb-orange hover:text-hb-orange/70 h-9 px-2">✕</button>
        </div>
    </div>`;
}

window.addBankAccountRow = () => {
    const list = document.getElementById('bank-accounts-list');
    const empty = list.querySelector('p');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = bankAccountRowHtml({ id: '', account_type: 'Hausgeldkonto', bank_name: '', iban: '' });
    list.appendChild(div.firstElementChild);
};

window.saveBankAccount = async (buildingId, baId) => {
    const row = document.getElementById(baId ? `ba-row-${baId}` : 'ba-row-new');
    if (!row) return;
    const payload = {
        building_id:  buildingId,
        account_type: row.querySelector('.ba-type').value,
        bank_name:    row.querySelector('.ba-bank').value || null,
        iban:         row.querySelector('.ba-iban').value || null,
    };
    const res = baId
        ? await _supabase.from('building_bank_accounts').update(payload).eq('id', baId)
        : await _supabase.from('building_bank_accounts').insert([payload]);
    if (res.error) { showToast(res.error.message, 'error'); return; }
    showToast('Bankkonto gespeichert.', 'success');
    showBuildingForm(buildingId);
};

window.deleteBankAccount = async (baId) => {
    if (!baId) { document.getElementById('ba-row-new')?.remove(); return; }
    await _supabase.from('building_bank_accounts').delete().eq('id', baId);
    showBuildingForm(selectedBuildingId);
};

// ─── Einheit-Formular (5 Tabs, Edit) ─────────────────────────
async function showApartmentForm(id = null) {
    const area = document.getElementById('units-area');
    let apt = {};
    if (id) apt = currentApartments.find(x => x.id === id) || {};
    const isEdit = !!id;
    const building = _buildingsAll.find(x => x.id === selectedBuildingId);
    const costKeys = apt.custom_distribution_keys || {};

    area.innerHTML = `
        <div class="card p-6 h-full overflow-y-auto flex flex-col text-left">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <button onclick="${isEdit ? `showApartmentInfo(${id})` : `selectBuilding(${selectedBuildingId})`}"
                        class="text-xs font-bold text-hb-olive hover:underline mb-1 block">← ${isEdit ? `Wohnung ${apt.apartment_number}` : (building?.name || 'Gebäude')}</button>
                    <h2 class="text-xl font-extrabold text-hb-offblack">${isEdit ? 'Einheit bearbeiten' : 'Neue Einheit'}</h2>
                </div>
                <button onclick="${isEdit ? `showApartmentInfo(${id})` : `selectBuilding(${selectedBuildingId})`}"
                    class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">Abbrechen</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-6 hide-scrollbar flex-shrink-0">
                ${tabNav([
                    {id:'base',    label:'Stammdaten'},
                    {id:'billing', label:'Abrechnung'},
                    {id:'finance', label:'Finanzen'},
                    {id:'meters',  label:'Zähler'},
                    {id:'legal',   label:'Rechtliches'},
                ], 'apt-btn', 'base')}
            </div>

            <form id="apartment-form" class="flex-grow space-y-5">
                <input type="hidden" id="apt_id" value="${apt.id || ''}">

                <div id="apt-tab-base" class="apt-tab-content grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Wohnungs-Nr. *</label>
                        <input type="text" id="apt_no" value="${apt.apartment_number || ''}" required></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Typ</label>
                        <select id="apt_type">
                            <option value="Wohnen"     ${(apt.type||'Wohnen')==='Wohnen'    ?'selected':''}>Wohnen</option>
                            <option value="Gewerbe"    ${apt.type==='Gewerbe'               ?'selected':''}>Gewerbe</option>
                            <option value="Stellplatz" ${apt.type==='Stellplatz'            ?'selected':''}>Stellplatz</option>
                            <option value="Keller"     ${apt.type==='Keller'               ?'selected':''}>Keller</option>
                        </select></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Etage</label>
                        <input type="text" id="apt_floor" value="${apt.floor || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Lage im Gebäude</label>
                        <input type="text" id="apt_location" value="${apt.location_in_building || ''}" placeholder="z.B. 1. OG links"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Zimmer</label>
                        <input type="number" id="apt_rooms" value="${apt.rooms || ''}" step="0.5"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Fläche (m²)</label>
                        <input type="number" id="apt_sqm" value="${apt.sq_meters || ''}" step="0.01"></div>
                    <div class="space-y-1 md:col-span-2"><label class="text-[10px] uppercase font-bold text-gray-500">Ausstattung</label>
                        <textarea id="apt_equipment" rows="2">${apt.equipment_features || ''}</textarea></div>
                </div>

                <div id="apt-tab-billing" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">MEA (dezimal)</label>
                        <input type="number" id="apt_mea" value="${apt.mea || ''}" step="0.0001"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">MEA Zähler</label>
                        <input type="number" id="apt_mea_num" value="${apt.mea_numerator || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">MEA Nenner</label>
                        <input type="number" id="apt_mea_den" value="${apt.mea_denominator || ''}"></div>
                    <div class="md:col-span-2 border-t pt-3">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Verteilerschlüssel</h3>
                            <button type="button" onclick="addCostKeyRow()"
                                class="btn-outline text-xs px-3 py-1.5">+ Schlüssel</button>
                        </div>
                        <div id="cost-keys-list" class="space-y-2">
                            ${Object.entries(costKeys).map(([k, v]) => costKeyRowHtml(k, v)).join('')
                              || '<p class="text-[15px] text-gray-400" id="cost-keys-empty">Keine abweichenden Schlüssel.</p>'}
                        </div>
                    </div>
                </div>

                <div id="apt-tab-finance" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Hausgeld (€)</label>
                        <input type="number" id="apt_hausgeld" value="${apt.hausgeld || ''}" step="0.01"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Kaltmiete (€)</label>
                        <input type="number" id="apt_rent" value="${apt.rent_amount || ''}" step="0.01"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Nebenkosten (€)</label>
                        <input type="number" id="apt_utilities" value="${apt.utilities_amount || ''}" step="0.01"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Kaution (€)</label>
                        <input type="number" id="apt_deposit" value="${apt.deposit_amount || ''}" step="0.01"></div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" id="apt_deposit_paid" ${apt.deposit_paid ? 'checked' : ''}>
                        <label for="apt_deposit_paid" class="text-sm font-bold text-gray-700 cursor-pointer">Kaution bezahlt</label>
                    </div>
                </div>

                <div id="apt-tab-meters" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Strom Nr.</label>
                        <input type="text" id="apt_m_elec" value="${apt.meter_electricity || ''}"></div>
                    <div></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Kaltwasser Nr.</label>
                        <input type="text" id="apt_m_water" value="${apt.meter_water || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Kaltwasser Eichung</label>
                        <input type="date" id="apt_m_water_cal" value="${apt.meter_water_calibration_until || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Warmwasser Nr.</label>
                        <input type="text" id="apt_m_water_warm" value="${apt.meter_water_warm || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Warmwasser Eichung</label>
                        <input type="date" id="apt_m_water_warm_cal" value="${apt.meter_water_warm_calibration || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Heizkosten Nr.</label>
                        <input type="text" id="apt_m_heat" value="${apt.meter_heating || ''}"></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Heizkosten Eichung</label>
                        <input type="date" id="apt_m_heat_cal" value="${apt.meter_heating_calibration_until || ''}"></div>
                </div>

                <div id="apt-tab-legal" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Belegungsstatus</label>
                        <select id="apt_status">
                            <option value="Leerstand"   ${(apt.tenant_status||'Leerstand')==='Leerstand'   ?'selected':''}>Leerstand</option>
                            <option value="Vermietet"   ${apt.tenant_status==='Vermietet'                  ?'selected':''}>Vermietet</option>
                            <option value="Eigennutzung"${apt.tenant_status==='Eigennutzung'               ?'selected':''}>Eigennutzung</option>
                        </select></div>
                    <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Sondernutzungsrecht</label>
                        <input type="text" id="apt_special" value="${apt.special_use_rights || ''}"></div>
                </div>

                <div class="pt-4 border-t flex gap-4 flex-shrink-0">
                    <button type="submit" class="btn-primary">Speichern</button>
                    ${isEdit ? `<button type="button" onclick="deleteApartment(${apt.id})"
                        class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 transition-colors">Löschen</button>` : ''}
                </div>
            </form>
        </div>`;

    document.getElementById('apartment-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Speichert...';
        const aptId = document.getElementById('apt_id').value;
        const costKeyObj = {};
        document.querySelectorAll('.cost-key-row').forEach(row => {
            const k = row.querySelector('.ck-key')?.value?.trim();
            const v = row.querySelector('.ck-val')?.value?.trim();
            if (k) costKeyObj[k] = v || '';
        });
        const payload = {
            building_id:                  selectedBuildingId,
            apartment_number:             document.getElementById('apt_no').value,
            type:                         document.getElementById('apt_type').value,
            floor:                        document.getElementById('apt_floor').value || null,
            location_in_building:         document.getElementById('apt_location').value || null,
            rooms:                        parseFloat(document.getElementById('apt_rooms').value) || null,
            sq_meters:                    parseFloat(document.getElementById('apt_sqm').value) || null,
            equipment_features:           document.getElementById('apt_equipment').value || null,
            mea:                          parseFloat(document.getElementById('apt_mea').value) || null,
            mea_numerator:                parseInt(document.getElementById('apt_mea_num').value) || null,
            mea_denominator:              parseInt(document.getElementById('apt_mea_den').value) || null,
            custom_distribution_keys:     costKeyObj,
            hausgeld:                     parseFloat(document.getElementById('apt_hausgeld').value) || 0,
            rent_amount:                  parseFloat(document.getElementById('apt_rent').value) || 0,
            utilities_amount:             parseFloat(document.getElementById('apt_utilities').value) || 0,
            deposit_amount:               parseFloat(document.getElementById('apt_deposit').value) || 0,
            deposit_paid:                 document.getElementById('apt_deposit_paid').checked,
            meter_electricity:            document.getElementById('apt_m_elec').value || null,
            meter_water:                  document.getElementById('apt_m_water').value || null,
            meter_water_calibration_until:document.getElementById('apt_m_water_cal').value || null,
            meter_water_warm:             document.getElementById('apt_m_water_warm').value || null,
            meter_water_warm_calibration: document.getElementById('apt_m_water_warm_cal').value || null,
            meter_heating:                document.getElementById('apt_m_heat').value || null,
            meter_heating_calibration_until: document.getElementById('apt_m_heat_cal').value || null,
            tenant_status:                document.getElementById('apt_status').value,
            special_use_rights:           document.getElementById('apt_special').value || null,
        };
        const res = aptId
            ? await _supabase.from('apartments').update(payload).eq('id', aptId)
            : await _supabase.from('apartments').insert([payload]).select('id').single();
        if (res.error) { showToast(res.error.message, 'error'); btn.disabled = false; btn.textContent = 'Speichern'; return; }
        showToast('Einheit gespeichert.', 'success');
        const savedId = aptId || res.data?.id;
        const { data } = await _supabase.from('apartments').select('*').eq('building_id', selectedBuildingId).order('apartment_number');
        currentApartments = data || [];
        if (savedId) showApartmentInfo(parseInt(savedId));
        else selectBuilding(selectedBuildingId);
    };
}

// ─── Verteilerschlüssel ───────────────────────────────────────
function costKeyRowHtml(k = '', v = '') {
    return `<div class="cost-key-row flex gap-2 items-center">
        <input type="text" class="ck-key flex-1 text-xs h-9 px-2" value="${k}" placeholder="Schlüssel">
        <input type="text" class="ck-val flex-1 text-xs h-9 px-2" value="${v}" placeholder="Wert">
        <button type="button" onclick="this.parentElement.remove()" class="text-hb-error/70 hover:text-hb-error font-bold px-2">✕</button>
    </div>`;
}
window.addCostKeyRow = () => {
    const list = document.getElementById('cost-keys-list');
    document.getElementById('cost-keys-empty')?.remove();
    const div = document.createElement('div');
    div.innerHTML = costKeyRowHtml();
    list.appendChild(div.firstElementChild);
};

// ─── Zuweisungen ──────────────────────────────────────────────
async function fetchApartmentAssignments(aptId) {
    const [tenRes, ownRes] = await Promise.all([
        _supabase.from('tenancies')
            .select('id, tenant_id, start_date, end_date, status, persons!tenancies_tenant_id_fkey(id, first_name, last_name, company_name, is_company)')
            .eq('apartment_id', aptId).neq('status', 'Historisch'),
        _supabase.from('ownerships')
            .select('id, owner_id, valid_from, valid_to, is_active, persons!ownerships_owner_id_fkey(id, first_name, last_name, company_name, is_company)')
            .eq('apartment_id', aptId).eq('is_active', true),
    ]);
    return { tenancies: tenRes.data || [], ownerships: ownRes.data || [] };
}

function personDisplayName(p) {
    if (!p) return '—';
    return p.is_company ? (p.company_name || p.last_name || '—') : `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
}

function renderAssignmentsList({ tenancies, ownerships }) {
    if (!tenancies.length && !ownerships.length)
        return '<p class="text-[15px] text-gray-400">Noch keine Personen zugewiesen.</p>';
    const rows = [
        ...ownerships.map(o => ({ role: 'Eigentümer', person: o['persons!ownerships_owner_id_fkey'] || o.persons, from: o.valid_from, to: o.valid_to, rm: `removeOwnership(${o.id})` })),
        ...tenancies.map(t  => ({ role: 'Mieter',     person: t['persons!tenancies_tenant_id_fkey']  || t.persons, from: t.start_date, to: t.end_date,   rm: `removeTenancy(${t.id})`  })),
    ];
    return rows.map(r => {
        const name   = personDisplayName(r.person);
        const badge  = r.role === 'Eigentümer' ? 'bg-hb-olive/12 text-hb-olive' : 'bg-hb-gold-soft/30 text-hb-gold-bold';
        const period = r.from ? `${r.from}${r.to ? ' – ' + r.to : ''}` : '';
        return `<div class="flex items-center justify-between py-2 px-3 bg-hb-ultralight rounded-xl border border-gray-100">
            <div class="flex items-center gap-3 min-w-0">
                <span class="${badge} text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0">${r.role}</span>
                <button type="button" onclick="navigateToPerson('${r.person?.id || ''}')"
                    class="text-sm font-bold text-hb-olive hover:underline truncate">${name}</button>
                ${period ? `<span class="text-xs text-gray-400 flex-shrink-0">${period}</span>` : ''}
            </div>
            <button type="button" onclick="${r.rm}" class="text-xs text-hb-orange px-2 flex-shrink-0">Entfernen</button>
        </div>`;
    }).join('');
}

window.navigateToPerson = (personId) => { if (personId) showPersonForm(personId); };

window.removeOwnership = async (id) => {
    await _supabase.from('ownerships').update({ is_active: false, valid_to: new Date().toISOString().split('T')[0] }).eq('id', id);
    showToast('Eigentümer entfernt.', 'success');
    const aptId = parseInt(document.getElementById('apt_id')?.value || '0') || _currentAptId;
    if (aptId) { const a = await fetchApartmentAssignments(aptId); const el = document.getElementById('apt-assignments'); if (el) el.innerHTML = renderAssignmentsList(a); }
};
window.removeTenancy = async (id) => {
    await _supabase.from('tenancies').update({ status: 'Historisch', end_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    showToast('Mietverhältnis beendet.', 'success');
    const aptId = parseInt(document.getElementById('apt_id')?.value || '0') || _currentAptId;
    if (aptId) { const a = await fetchApartmentAssignments(aptId); const el = document.getElementById('apt-assignments'); if (el) el.innerHTML = renderAssignmentsList(a); }
};

let _currentAptId = null;

// ─── Zuweisung-Modal ──────────────────────────────────────────
window.openAssignModal = (aptId) => {
    _currentAptId = aptId;
    closeAssignModal();
    const modal = document.createElement('div');
    modal.id = 'assign-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 space-y-5 relative" onclick="event.stopPropagation()">
            <button onclick="closeAssignModal()" class="absolute top-4 right-4 text-gray-400 hover:text-hb-orange font-bold text-lg leading-none">✕</button>
            <h3 class="text-xl font-extrabold text-hb-offblack">Person zuweisen</h3>
            <div class="flex gap-6">
                <label class="flex items-center gap-2 font-bold text-sm cursor-pointer"><input type="radio" name="assign_role" value="Eigentümer" checked> Eigentümer</label>
                <label class="flex items-center gap-2 font-bold text-sm cursor-pointer"><input type="radio" name="assign_role" value="Mieter"> Mieter</label>
            </div>
            <div class="space-y-2 relative">
                <label class="text-[10px] uppercase font-bold text-gray-500">Person suchen</label>
                <input type="text" id="assign_search" placeholder="Name oder E-Mail…" oninput="searchPersonsForAssign(this.value)" autocomplete="off">
                <div id="assign_results" class="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 hidden max-h-48 overflow-y-auto"></div>
            </div>
            <div id="assign_selected" class="hidden p-3 bg-hb-success/10 border border-hb-success/20 rounded-xl text-sm font-bold text-hb-success">
                <span id="assign_selected_name"></span><input type="hidden" id="assign_person_id">
            </div>
            <div id="assign_quickcreate" class="hidden border-t pt-4 space-y-3">
                <p class="text-[15px] font-bold text-hb-orange">Keine Person gefunden — direkt anlegen:</p>
                <div class="grid grid-cols-2 gap-3">
                    <input type="text" id="qc_first" placeholder="Vorname">
                    <input type="text" id="qc_last"  placeholder="Nachname *">
                </div>
                <input type="email" id="qc_email" placeholder="E-Mail">
                <input type="text"  id="qc_phone" placeholder="Telefon">
                <button type="button" onclick="quickCreatePerson()" class="btn-primary text-xs px-4 py-2 w-full">Person anlegen & auswählen</button>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Beginn</label>
                    <input type="date" id="assign_start" value="${new Date().toISOString().split('T')[0]}"></div>
                <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Ende (optional)</label>
                    <input type="date" id="assign_end"></div>
            </div>
            <button type="button" onclick="saveAssignment(${aptId})" class="btn-primary w-full">Zuweisung speichern</button>
        </div>`;
    modal.addEventListener('click', closeAssignModal);
    document.body.appendChild(modal);
};
window.closeAssignModal = () => document.getElementById('assign-modal')?.remove();

window.searchPersonsForAssign = async (query) => {
    const results    = document.getElementById('assign_results');
    const quickCreate = document.getElementById('assign_quickcreate');
    if (query.length < 2) { results.classList.add('hidden'); return; }
    const { data } = await _supabase.from('persons')
        .select('id, first_name, last_name, company_name, is_company, email')
        .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,email.ilike.%${query}%,company_name.ilike.%${query}%`)
        .limit(10);
    if (!data?.length) { results.classList.add('hidden'); quickCreate.classList.remove('hidden'); return; }
    quickCreate.classList.add('hidden');
    results.classList.remove('hidden');
    results.innerHTML = data.map(p => {
        const name = personDisplayName(p);
        return `<button type="button" onclick="selectPersonForAssign('${p.id}', '${name.replace(/'/g, "\\'")}')"
            class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
            <span class="font-bold">${name}</span>${p.email ? `<span class="text-gray-400 ml-2 text-xs">${p.email}</span>` : ''}
        </button>`;
    }).join('');
};

window.selectPersonForAssign = (id, name) => {
    document.getElementById('assign_person_id').value = id;
    document.getElementById('assign_selected_name').textContent = `✓ ${name}`;
    document.getElementById('assign_selected').classList.remove('hidden');
    document.getElementById('assign_results').classList.add('hidden');
    document.getElementById('assign_search').value = name;
    document.getElementById('assign_quickcreate').classList.add('hidden');
};

window.quickCreatePerson = async () => {
    const last = document.getElementById('qc_last').value.trim();
    if (!last) { showToast('Nachname ist Pflichtfeld.', 'error'); return; }
    const { data, error } = await _supabase.from('persons').insert([{
        first_name: document.getElementById('qc_first').value.trim() || null,
        last_name:  last,
        email:      document.getElementById('qc_email').value.trim() || null,
        phone:      document.getElementById('qc_phone').value.trim() || null,
    }]).select('id, first_name, last_name').single();
    if (error) { showToast(error.message, 'error'); return; }
    const name = `${data.first_name || ''} ${data.last_name}`.trim();
    selectPersonForAssign(data.id, name);
    document.getElementById('assign_quickcreate').classList.add('hidden');
    showToast(`${name} angelegt und ausgewählt.`, 'success');
};

window.saveAssignment = async (aptId) => {
    const personId = document.getElementById('assign_person_id').value;
    if (!personId) { showToast('Bitte zuerst eine Person auswählen.', 'error'); return; }
    const role      = document.querySelector('input[name="assign_role"]:checked').value;
    const startDate = document.getElementById('assign_start').value || null;
    const endDate   = document.getElementById('assign_end').value || null;
    let error;
    if (role === 'Eigentümer') {
        ({ error } = await _supabase.from('ownerships').insert([{ apartment_id: aptId, owner_id: personId, valid_from: startDate, valid_to: endDate, is_active: true }]));
    } else {
        ({ error } = await _supabase.from('tenancies').insert([{ apartment_id: aptId, tenant_id: personId, start_date: startDate, end_date: endDate, status: 'Aktiv' }]));
    }
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`${role} erfolgreich zugewiesen.`, 'success');
    closeAssignModal();
    const newA = await fetchApartmentAssignments(aptId);
    const el = document.getElementById('apt-assignments');
    if (el) el.innerHTML = renderAssignmentsList(newA);
    await fetchApartmentsForBuilding(selectedBuildingId);
};

// ─── Einheit löschen ──────────────────────────────────────────
async function deleteApartment(id) {
    if (!confirm('Einheit wirklich löschen?')) return;
    const { error } = await _supabase.from('apartments').delete().eq('id', id);
    if (!error) { showToast('Einheit gelöscht.', 'success'); selectBuilding(selectedBuildingId); }
    else showToast(error.message, 'error');
}

// ============================================================
// Verteilerschlüssel-Management (_dk* Funktionen)
// ============================================================

const _DK_TYPE_LABELS = {
    mea:         'MEA',
    sqm:         'm²',
    units:       'Einheiten',
    consumption: 'Verbrauch',
    persons:     'Personen',
    heizkosten:  'HeizKV-Split',
    custom:      'Individuell',
};

function _dkTypeBadge(type) {
    const label = _DK_TYPE_LABELS[type] || type;
    const cls = type === 'heizkosten' ? 'bg-hb-orange/10 text-hb-orange'
              : type === 'mea'        ? 'bg-hb-olive/10 text-hb-olive'
              : 'bg-gray-100 text-gray-600';
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}">${label}</span>`;
}

function _dkRenderTab(keys, buildingId) {
    const rows = keys.length === 0
        ? '<p class="text-[15px] text-gray-400 py-2">Noch keine Verteilerschlüssel angelegt.</p>'
        : `<table class="w-full text-sm mt-3">
            <thead class="text-xs font-bold text-gray-500 bg-gray-50">
                <tr>
                    <th class="px-3 py-2 text-left">Name</th>
                    <th class="px-3 py-2 text-left">Typ</th>
                    <th class="px-3 py-2 text-right">Gesamtwert</th>
                    <th class="px-3 py-2 text-right">Aktionen</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-hb-olive/10">
                ${keys.map(k => `
                <tr>
                    <td class="px-3 py-2 font-semibold text-hb-offblack">
                        ${k.name}
                        ${k.is_system_default ? '<span class="ml-1 text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Standard</span>' : ''}
                        ${k.type === 'heizkosten' && k.heiz_split_percent != null
                            ? `<span class="ml-1 text-[9px] text-gray-400">(${k.heiz_split_percent}% / ${100 - k.heiz_split_percent}%)</span>`
                            : ''}
                    </td>
                    <td class="px-3 py-2">${_dkTypeBadge(k.type)}</td>
                    <td class="px-3 py-2 text-right font-mono text-gray-600">${k.total_value != null ? Number(k.total_value).toLocaleString('de-DE', {maximumFractionDigits:4}) : '—'}</td>
                    <td class="px-3 py-2 text-right space-x-2">
                        <button onclick="_dkOpenValuesModal('${k.id}', ${buildingId})"
                            class="text-xs text-hb-olive bg-hb-ultralight px-2 py-1 rounded-lg hover:bg-gray-100">Werte</button>
                        ${k.is_system_default ? '' : `<button onclick="_dkDeleteKey('${k.id}', ${buildingId})"
                            class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5">Löschen</button>`}
                    </td>
                </tr>`).join('')}
            </tbody>
           </table>`;
    return `
        <div class="flex justify-between items-center">
            <p class="text-xs text-gray-500">${keys.length} Schlüssel konfiguriert</p>
            <button onclick="_dkOpenNewModal(${buildingId})"
                class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 font-semibold border border-hb-olive/12">+ Neuer Schlüssel</button>
        </div>
        ${rows}`;
}

async function _dkRefreshTab(buildingId) {
    const { data } = await _supabase.from('distribution_keys')
        .select('id, name, type, total_value, heiz_split_percent, is_system_default')
        .eq('building_id', buildingId).order('is_system_default', { ascending: false });
    const keys = data || [];
    const tab = document.getElementById('bldg-tab-keys');
    if (tab) {
        tab.innerHTML = _dkRenderTab(keys, buildingId);
        makeTableResponsive(tab);
    }
}

window._dkOpenNewModal = function(buildingId) {
    const overlay = document.createElement('div');
    overlay.id = 'dk-new-overlay';
    overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div class="flex justify-between items-center mb-5">
                <h3 class="text-base font-extrabold text-hb-offblack">Neuer Verteilerschlüssel</h3>
                <button onclick="document.getElementById('dk-new-overlay').remove()"
                    class="text-gray-400 hover:text-hb-orange text-xl leading-none">×</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Name</label>
                    <input id="dk-new-name" type="text" placeholder="z.B. Heizkosten 2025" class="w-full">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Typ</label>
                    <select id="dk-new-type" onchange="_dkToggleHeizSplit()" class="w-full">
                        <option value="mea">MEA (Miteigentumsanteile)</option>
                        <option value="sqm">m² (Wohnfläche)</option>
                        <option value="units">Einheiten (je 1/n)</option>
                        <option value="consumption">Verbrauch</option>
                        <option value="persons">Personen</option>
                        <option value="heizkosten">HeizKV-Split</option>
                        <option value="custom">Individuell</option>
                    </select>
                </div>
                <div id="dk-heiz-split-row" class="hidden">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Verbrauchsanteil (%)</label>
                    <input id="dk-new-heiz-split" type="number" min="1" max="99" step="1" value="70" class="w-full">
                    <p class="text-xs text-gray-400 mt-1">z.B. 70 = 70% Verbrauch / 30% Fläche (gem. HeizkostenV)</p>
                </div>
            </div>
            <div class="flex gap-3 mt-6 justify-end">
                <button onclick="document.getElementById('dk-new-overlay').remove()"
                    class="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">Abbrechen</button>
                <button onclick="_dkSaveNew(${buildingId})" class="btn-primary text-sm px-5 py-2">Erstellen & Werte eingeben</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
};

window._dkToggleHeizSplit = function() {
    const type = document.getElementById('dk-new-type')?.value;
    const row  = document.getElementById('dk-heiz-split-row');
    if (row) row.classList.toggle('hidden', type !== 'heizkosten');
};

window._dkSaveNew = async function(buildingId) {
    const name = document.getElementById('dk-new-name')?.value.trim();
    const type = document.getElementById('dk-new-type')?.value;
    if (!name) { showToast('Bitte einen Namen eingeben.', 'error'); return; }

    const payload = { building_id: buildingId, name, type };
    if (type === 'heizkosten') {
        const split = parseFloat(document.getElementById('dk-new-heiz-split')?.value);
        if (isNaN(split) || split < 1 || split > 99) { showToast('Verbrauchsanteil muss zwischen 1 und 99 liegen.', 'error'); return; }
        payload.heiz_split_percent = split;
    }

    const { data: newKey, error } = await _supabase.from('distribution_keys').insert(payload).select().single();
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    // Auto-Initialisierung der Einheitenwerte
    const { data: apts } = await _supabase.from('apartments').select('id, mea, sq_meters').eq('building_id', buildingId);
    if (apts && apts.length > 0) {
        const initRows = apts.map(apt => {
            let value = 0;
            if (type === 'mea')        value = parseFloat(apt.mea) || 0;
            else if (type === 'sqm')   value = parseFloat(apt.sq_meters) || 0;
            else if (type === 'units') value = 1;
            return { distribution_key_id: newKey.id, apartment_id: apt.id, value };
        });
        await _supabase.from('distribution_key_units').insert(initRows);
    }

    document.getElementById('dk-new-overlay')?.remove();
    showToast('Schlüssel angelegt.');
    await _dkRefreshTab(buildingId);
    _dkOpenValuesModal(newKey.id, buildingId);
};

window._dkOpenValuesModal = async function(keyId, buildingId) {
    const [{ data: key }, { data: apts }, { data: unitVals }] = await Promise.all([
        _supabase.from('distribution_keys').select('*').eq('id', keyId).single(),
        _supabase.from('apartments').select('id, apartment_number, floor, sq_meters, mea').eq('building_id', buildingId).order('apartment_number'),
        _supabase.from('distribution_key_units').select('apartment_id, value').eq('distribution_key_id', keyId),
    ]);
    if (!key || !apts) return;

    const valMap = {};
    (unitVals || []).forEach(u => { valMap[u.apartment_id] = u.value; });

    const isHeiz = key.type === 'heizkosten';

    // Pre-calc: is total_value manually set (differs from unit sum)?
    const unitSum = Object.values(valMap).reduce(function(s, v) { return s + Number(v || 0); }, 0);
    const storedTotal = Number(key.total_value) || 0;
    const isManualTotal = storedTotal > 0 && Math.abs(storedTotal - unitSum) > 0.0001;
    const manualChecked = isManualTotal ? 'checked' : '';
    const manualRowHidden = isManualTotal ? '' : 'hidden';
    const manualTotalVal = isManualTotal ? storedTotal : '';

    // Quick-fill buttons based on type
    const fillBtns = [];
    if (key.type === 'mea' || key.type === 'custom' || key.type === 'heizkosten')
        fillBtns.push('<button onclick="_dkFillFrom(\'mea\')" class="text-xs text-hb-olive bg-white border border-hb-olive/12 px-2 py-1 rounded-lg hover:bg-hb-ultralight">MEA</button>');
    if (key.type === 'sqm' || key.type === 'custom' || key.type === 'heizkosten')
        fillBtns.push('<button onclick="_dkFillFrom(\'sqm\')" class="text-xs text-hb-olive bg-white border border-hb-olive/12 px-2 py-1 rounded-lg hover:bg-hb-ultralight">m²</button>');
    if (key.type === 'units' || key.type === 'custom')
        fillBtns.push('<button onclick="_dkFillFrom(\'units\')" class="text-xs text-hb-olive bg-white border border-hb-olive/12 px-2 py-1 rounded-lg hover:bg-hb-ultralight">je 1/n</button>');

    const overlay = document.createElement('div');
    overlay.id = 'dk-vals-overlay';
    overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style="max-height:90vh">
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <div>
                    <h3 class="text-base font-extrabold text-hb-offblack">${key.name}</h3>
                    <p class="text-xs text-gray-500">${_DK_TYPE_LABELS[key.type] || key.type}${isHeiz ? ' · ' + (key.heiz_split_percent ?? 70) + '% Verbrauch / ' + (100 - (key.heiz_split_percent ?? 70)) + '% Fläche' : ''}</p>
                </div>
                <button onclick="document.getElementById('dk-vals-overlay').remove()"
                    class="text-gray-400 hover:text-hb-orange text-xl leading-none">&times;</button>
            </div>
            ${isHeiz ? '<div class="px-6 py-3 bg-hb-ultralight border-b border-gray-100 flex items-center gap-3 flex-shrink-0">' +
                '<label class="text-xs font-bold text-gray-500">Verbrauchsanteil (%)</label>' +
                '<input id="dk-heiz-split-val" type="number" min="1" max="99" step="1" value="' + (key.heiz_split_percent ?? 70) + '" class="w-20 text-sm" oninput="_dkUpdateHeizLabel()">' +
                '<span id="dk-heiz-rest-label" class="text-xs text-gray-400">= ' + (100 - (key.heiz_split_percent ?? 70)) + '% Fläche</span></div>' : ''}
            <div class="px-6 py-3 bg-hb-ultralight border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                <p class="text-xs text-gray-500 flex-grow">Schnell befüllen aus:</p>
                ${fillBtns.join('')}
                <button onclick="_dkFillFrom('zero')" class="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Auf 0</button>
            </div>
            <div class="overflow-y-auto flex-grow">
                <table class="w-full text-sm">
                    <thead class="text-xs font-bold text-gray-500 bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-4 py-2 text-left">Einheit</th>
                            <th class="px-4 py-2 text-right">Wert</th>
                            <th class="px-4 py-2 text-right">Anteil %</th>
                        </tr>
                    </thead>
                    <tbody id="dk-vals-body" class="divide-y divide-hb-olive/10">
                        ${apts.map(function(apt) { return '<tr data-apt-id="' + apt.id + '" data-mea="' + (apt.mea || 0) + '" data-sqm="' + (apt.sq_meters || 0) + '">' +
                            '<td class="px-4 py-2 font-semibold">' + apt.apartment_number +
                                '<span class="text-xs text-gray-400 font-normal">' + (apt.floor ? '&middot; ' + apt.floor : '') + '</span></td>' +
                            '<td class="px-4 py-1.5 text-right"><input type="number" step="0.0001" min="0" class="dk-val-input w-28 text-right text-sm" value="' + (valMap[apt.id] ?? 0) + '" oninput="_dkUpdateSum()"></td>' +
                            '<td class="px-4 py-2 text-right text-xs text-gray-500 dk-pct-cell">&mdash;</td></tr>'; }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="px-6 py-3 border-t border-gray-100 flex-shrink-0 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="text-sm">
                        <span class="text-gray-500">Summe Einheitenwerte:</span>
                        <span id="dk-sum-display" class="font-bold text-hb-offblack ml-2">&mdash;</span>
                    </div>
                </div>
                <div class="bg-hb-ultralight rounded-lg px-4 py-3 space-y-2">
                    <div class="flex items-center gap-4 text-sm">
                        <span class="text-xs font-bold text-gray-500">Gesamtumlage:</span>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="dk-total-mode" value="auto" ${manualChecked ? '' : 'checked'}
                                onchange="_dkToggleManualTotal()" class="text-hb-olive focus:ring-hb-olive">
                            <span class="text-xs text-gray-600">Automatisch (Summe)</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="dk-total-mode" value="manual" ${manualChecked ? 'checked' : ''}
                                onchange="_dkToggleManualTotal()" class="text-hb-olive focus:ring-hb-olive">
                            <span class="text-xs text-gray-600">Manuell festlegen</span>
                        </label>
                    </div>
                    <div id="dk-manual-total-row" class="${manualRowHidden} flex items-center gap-3">
                        <input id="dk-manual-total-val" type="number" step="0.0001" min="0" value="${manualTotalVal}"
                            placeholder="z.B. 800" class="w-32 text-right text-sm" oninput="_dkUpdateTotalDisplay()">
                        <span class="text-xs text-gray-400">z.B. MEA 800 von 1000 (Garagen ausgenommen)</span>
                    </div>
                    <div class="text-sm font-bold text-hb-olive">
                        Gesamtumlage: <span id="dk-total-display">&mdash;</span>
                    </div>
                </div>
                <div class="flex gap-3 justify-end">
                    <button onclick="document.getElementById('dk-vals-overlay').remove()"
                        class="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">Abbrechen</button>
                    <button onclick="_dkSaveValues('${keyId}', ${buildingId})" class="btn-primary text-sm px-5 py-2">Speichern</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    _dkUpdateSum();

    // Responsive tables
    makeTableResponsive(overlay);
};

window._dkUpdateHeizLabel = function() {
    const val = parseInt(document.getElementById('dk-heiz-split-val')?.value) || 70;
    const lbl = document.getElementById('dk-heiz-rest-label');
    if (lbl) lbl.textContent = `= ${100 - val}% Fläche`;
};

window._dkUpdateSum = function() {
    const inputs = document.querySelectorAll('.dk-val-input');
    let sum = 0;
    inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
    const sumEl = document.getElementById('dk-sum-display');
    if (sumEl) sumEl.textContent = sum.toLocaleString('de-DE', { maximumFractionDigits: 4 });
    // Update percentage cells
    const rows = document.querySelectorAll('#dk-vals-body tr');
    rows.forEach(row => {
        const inp = row.querySelector('.dk-val-input');
        const pct = row.querySelector('.dk-pct-cell');
        if (!inp || !pct) return;
        const v = parseFloat(inp.value) || 0;
        pct.textContent = sum > 0 ? (v / sum * 100).toFixed(2) + '%' : '—';
    });
    _dkUpdateTotalDisplay();
};

window._dkToggleManualTotal = function() {
    const mode = document.querySelector('input[name="dk-total-mode"]:checked')?.value;
    const row = document.getElementById('dk-manual-total-row');
    if (row) row.classList.toggle('hidden', mode !== 'manual');
    _dkUpdateTotalDisplay();
};

window._dkUpdateTotalDisplay = function() {
    const mode = document.querySelector('input[name="dk-total-mode"]:checked')?.value;
    const sumEl = document.getElementById('dk-sum-display');
    const totalEl = document.getElementById('dk-total-display');
    if (!totalEl) return;
    if (mode === 'manual') {
        const manVal = parseFloat(document.getElementById('dk-manual-total-val')?.value);
        totalEl.textContent = !isNaN(manVal) && manVal > 0
            ? manVal.toLocaleString('de-DE', { maximumFractionDigits: 4 }) + ' (manuell)'
            : '—';
    } else {
        totalEl.textContent = sumEl ? sumEl.textContent + ' (auto)' : '—';
    }
};

window._dkFillFrom = function(source) {
    const rows = document.querySelectorAll('#dk-vals-body tr');
    const n = rows.length;
    rows.forEach(row => {
        const inp = row.querySelector('.dk-val-input');
        if (!inp) return;
        if      (source === 'mea')   inp.value = parseFloat(row.dataset.mea) || 0;
        else if (source === 'sqm')   inp.value = parseFloat(row.dataset.sqm) || 0;
        else if (source === 'units') inp.value = n > 0 ? (1 / n).toFixed(6) : 0;
        else if (source === 'zero')  inp.value = 0;
    });
    _dkUpdateSum();
};

window._dkSaveValues = async function(keyId, buildingId) {
    const rows = document.querySelectorAll('#dk-vals-body tr');
    const upserts = [];
    rows.forEach(row => {
        const aptId = parseInt(row.dataset.aptId);
        const val   = parseFloat(row.querySelector('.dk-val-input')?.value) || 0;
        upserts.push({ distribution_key_id: keyId, apartment_id: aptId, value: val });
    });

    const summedValue = upserts.reduce((s, r) => s + r.value, 0);
    const mode = document.querySelector('input[name="dk-total-mode"]:checked')?.value;
    const isManual = mode === 'manual';
    let totalValue = summedValue;
    if (isManual) {
        const manVal = parseFloat(document.getElementById('dk-manual-total-val')?.value);
        if (!isNaN(manVal) && manVal > 0) totalValue = manVal;
    }
    const updatePayload = { total_value: totalValue, updated_at: new Date().toISOString() };

    // Update heiz_split_percent if applicable
    const splitInput = document.getElementById('dk-heiz-split-val');
    if (splitInput) {
        const split = parseFloat(splitInput.value);
        if (!isNaN(split)) updatePayload.heiz_split_percent = split;
    }

    const { error: upErr } = await _supabase.from('distribution_keys').update(updatePayload).eq('id', keyId);
    if (upErr) { showToast('Fehler beim Speichern: ' + upErr.message, 'error'); return; }

    const { error: dkuErr } = await _supabase.from('distribution_key_units').upsert(upserts, { onConflict: 'distribution_key_id,apartment_id' });
    if (dkuErr) { showToast('Fehler beim Speichern der Werte: ' + dkuErr.message, 'error'); return; }

    document.getElementById('dk-vals-overlay')?.remove();
    showToast('Verteilerschlüssel gespeichert.');
    await _dkRefreshTab(buildingId);
};

window._dkDeleteKey = async function(keyId, buildingId) {
    if (!confirm('Verteilerschlüssel wirklich löschen? Konten-Zuweisungen werden auf "kein Schlüssel" gesetzt.')) return;
    const { error } = await _supabase.from('distribution_keys').delete().eq('id', keyId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Schlüssel gelöscht.');
    await _dkRefreshTab(buildingId);
};

// ─── Verwaltungsbeirat ───────────────────────────────────────

window._showAddBoardMemberModal = async (buildingId) => {
    // Eigentümer des Gebäudes laden
    const { data: apts } = await _supabase.from('apartments').select('id').eq('building_id', buildingId);
    const aptIds = (apts || []).map(a => a.id);
    const { data: bmData } = await _supabase.from('board_members').select('person_id').eq('building_id', buildingId).is('valid_to', null);
    const existingBmIds = new Set((bmData || []).map(bm => bm.person_id));

    let candidates = [];
    if (aptIds.length) {
        const { data } = await _supabase.from('ownerships')
            .select('owner_id, owner:persons!ownerships_owner_id_fkey(id, first_name, last_name)')
            .in('apartment_id', aptIds).eq('is_active', true);
        const seen = new Set();
        (data || []).forEach(o => {
            if (o.owner && !existingBmIds.has(o.owner.id) && !seen.has(o.owner.id)) {
                seen.add(o.owner.id);
                candidates.push(o.owner);
            }
        });
    }

    if (!candidates.length) {
        showToast('Alle Eigentümer dieses Gebäudes sind bereits Beiratsmitglieder.', 'info');
        return;
    }

    showModal('add-board-member-modal', `
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-extrabold text-hb-offblack">Beirat hinzufügen</h3>
            <button onclick="hideModal('add-board-member-modal')" class="text-gray-400 hover:text-hb-orange font-bold text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">✕</button>
        </div>
        <div class="space-y-3">
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Eigentümer auswählen</label>
                <select id="bm_person_id" class="w-full">
                    ${candidates.map(c => `<option value="${c.id}">${[c.first_name, c.last_name].filter(Boolean).join(' ')}</option>`).join('')}
                </select>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Gültig ab</label>
                <input type="date" id="bm_valid_from" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <button onclick="_saveBoardMember(${buildingId})" class="btn-primary w-full">Beirat zuweisen</button>
        </div>
    `);
};

window._saveBoardMember = async (buildingId) => {
    const personId = document.getElementById('bm_person_id')?.value;
    const validFrom = document.getElementById('bm_valid_from')?.value;
    if (!personId) { showToast('Bitte eine Person auswählen.', 'error'); return; }

    const { error } = await _supabase.from('board_members').insert([{
        person_id: personId,
        building_id: buildingId,
        valid_from: validFrom || new Date().toISOString().split('T')[0],
    }]);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('add-board-member-modal');
    showToast('Beiratsmitglied hinzugefügt.', 'success');
    const b = _buildingsAll.find(x => x.id === buildingId);
    if (b) await showBuildingInfo(b);
};

window._removeBoardMember = async (bmId, buildingId) => {
    if (!confirm('Beiratsmitglied wirklich entfernen?')) return;
    const { error } = await _supabase.from('board_members')
        .update({ valid_to: new Date().toISOString().split('T')[0] })
        .eq('id', bmId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Beiratsmitglied entfernt.', 'success');
    const b = _buildingsAll.find(x => x.id === buildingId);
    if (b) await showBuildingInfo(b);
};