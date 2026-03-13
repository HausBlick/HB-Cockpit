// ============================================================
// HB-Mieterportal | mod-objekte.js
// Modul: Objekte — Gebäude & Einheiten (CRUD + Zuweisungen)
// ============================================================

// ─── Tab-Helfer ──────────────────────────────────────────────
window.switchBuildingTab = (tabId) => {
    document.querySelectorAll('.bldg-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.bldg-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('bldg-tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('bldg-btn-' + tabId);
    if (btn) { btn.classList.add('border-hb-olive', 'text-hb-olive'); btn.classList.remove('border-transparent', 'text-gray-500'); }
};

window.switchAptTab = (tabId) => {
    document.querySelectorAll('.apt-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.apt-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('apt-tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('apt-btn-' + tabId);
    if (btn) { btn.classList.add('border-hb-olive', 'text-hb-olive'); btn.classList.remove('border-transparent', 'text-gray-500'); }
};

// ─── Gebäude-Liste ────────────────────────────────────────────
async function loadTenants() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] text-left">
            <div class="w-full lg:w-1/3 flex flex-col gap-4 h-full">
                <div class="card flex flex-col h-full overflow-hidden border border-gray-100">
                    <div class="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <h2 class="text-sm font-black uppercase tracking-widest text-gray-500">Immobilienbestand</h2>
                        <button onclick="showBuildingForm()"
                            class="bg-hb-olive text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-opacity-80 shadow-sm transition-transform hover:scale-105">+</button>
                    </div>
                    <div id="buildings-list" class="flex-grow overflow-y-auto p-3 space-y-2"></div>
                </div>
            </div>
            <div class="w-full lg:w-2/3 flex flex-col h-full" id="units-area">
                <div class="card p-10 flex flex-col items-center justify-center text-gray-400 h-full">
                    Bitte wähle ein Objekt aus.
                </div>
            </div>
        </div>`;
    await fetchBuildingsList();
}

async function fetchBuildingsList() {
    const list = document.getElementById('buildings-list');
    if (!list) return;
    const { data } = await _supabase.from('buildings').select('*').order('name');
    currentBuildings = data || [];
    list.innerHTML = currentBuildings.map(b => {
        const addr = b.street ? `${b.street} ${b.house_number || ''}, ${b.zip_code || ''} ${b.city || ''}` : (b.address || '—');
        return `<div onclick="selectBuilding(${b.id})" id="b-item-${b.id}"
                    class="p-4 rounded-xl cursor-pointer border border-transparent hover:bg-gray-50 transition-all text-left">
                    <h3 class="font-bold text-hb-offblack">${b.name}</h3>
                    <p class="text-xs text-gray-500 truncate">${addr}</p>
                </div>`;
    }).join('') || '<p class="text-sm text-gray-400 p-4">Keine Gebäude vorhanden.</p>';
    if (selectedBuildingId) highlightBuilding(selectedBuildingId);
}

function highlightBuilding(id) {
    document.querySelectorAll('[id^="b-item-"]').forEach(el => {
        el.classList.remove('bg-hb-olive', 'text-white', '!text-white');
        el.querySelectorAll('*').forEach(c => c.classList.remove('text-white', 'text-gray-500'));
    });
    const sel = document.getElementById(`b-item-${id}`);
    if (sel) sel.classList.add('bg-hb-olive', 'text-white');
}

async function selectBuilding(id) {
    selectedBuildingId = id;
    highlightBuilding(id);
    const b = currentBuildings.find(x => x.id === id);
    if (!b) return;
    const addr = b.street ? `${b.street} ${b.house_number || ''}, ${b.zip_code || ''} ${b.city || ''}` : (b.address || '—');

    document.getElementById('units-area').innerHTML = `
        <div class="card h-full flex flex-col overflow-hidden text-left">
            <div class="p-6 border-b border-gray-50 bg-white flex justify-between items-start">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">${b.status || 'Aktiv'}</span>
                        <span class="text-xs font-bold text-gray-400">Akten-Nr: ${b.file_number || '—'}</span>
                    </div>
                    <h2 class="text-2xl font-extrabold text-hb-offblack">${b.name}</h2>
                    <p class="text-sm text-gray-500">${addr}</p>
                </div>
                <button onclick="showBuildingForm(${b.id})"
                    class="text-xs font-bold text-hb-olive bg-hb-ultralight px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors shadow-sm">Details bearbeiten</button>
            </div>
            <div class="px-6 py-4 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
                <h3 class="text-sm font-black uppercase tracking-widest text-gray-500">Zugehörige Einheiten</h3>
                <button onclick="showApartmentForm()" class="btn-primary py-2 px-4 text-xs shadow-sm">+ Einheit</button>
            </div>
            <div class="flex-grow overflow-y-auto p-6 bg-[#f4f5f1]" id="apartments-list"></div>
        </div>`;
    await fetchApartmentsForBuilding(id);
}

async function fetchApartmentsForBuilding(bId) {
    const list = document.getElementById('apartments-list');
    if (!list) return;
    const { data } = await _supabase.from('apartments').select('*').eq('building_id', bId).order('apartment_number');
    currentApartments = data || [];
    list.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` +
        (currentApartments.length
            ? currentApartments.map(apt => `
                <div onclick="showApartmentForm(${apt.id})"
                    class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-hb-olive cursor-pointer transition-colors text-left">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="text-lg font-extrabold text-hb-offblack">Wohnung ${apt.apartment_number}</h4>
                        <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${apt.tenant_status === 'Vermietet' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}">${apt.tenant_status || 'Leerstand'}</span>
                    </div>
                    <p class="text-sm text-gray-500">${apt.sq_meters || 0} m² · ${apt.rooms || 0} Zi. · ${apt.type || 'Wohnen'}</p>
                    ${apt.floor ? `<p class="text-xs text-gray-400">${apt.floor}</p>` : ''}
                </div>`).join('')
            : '<p class="text-sm text-gray-400 col-span-2">Noch keine Einheiten angelegt.</p>')
        + `</div>`;
}

// ─── Gebäude-Formular (4 Tabs) ────────────────────────────────
async function showBuildingForm(id = null) {
    const area = document.getElementById('units-area');
    let b = {};
    let bankAccounts = [];
    if (id) {
        b = currentBuildings.find(x => x.id === id) || {};
        const { data } = await _supabase.from('building_bank_accounts').select('*').eq('building_id', id);
        bankAccounts = data || [];
    }
    const isEdit = !!id;

    area.innerHTML = `
        <div class="card p-8 h-full overflow-y-auto flex flex-col text-left">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-extrabold text-hb-offblack">${isEdit ? 'Gebäude bearbeiten' : 'Neues Gebäude'}</h2>
                <button onclick="selectedBuildingId ? selectBuilding(selectedBuildingId) : loadTenants()"
                    class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-6 hide-scrollbar flex-shrink-0">
                <button type="button" id="bldg-btn-base"    onclick="switchBuildingTab('base')"    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="bldg-btn-finance" onclick="switchBuildingTab('finance')" class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Finanzen</button>
                <button type="button" id="bldg-btn-legal"   onclick="switchBuildingTab('legal')"   class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Grundbuch</button>
                <button type="button" id="bldg-btn-tech"    onclick="switchBuildingTab('tech')"    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Technik & Fristen</button>
            </div>

            <form id="building-form" class="flex-grow space-y-6">

                <!-- TAB 1: STAMMDATEN -->
                <div id="bldg-tab-base" class="bldg-tab-content grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Objektname (automatisch)</label>
                        <input type="text" id="b_name" value="${b.name || ''}" readonly
                            class="bg-gray-100 text-gray-500 cursor-default focus:outline-none" tabindex="-1">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Akten-Nr.</label>
                        <input type="text" id="b_file" value="${b.file_number || ''}" oninput="updateBuildingName()">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Status</label>
                        <select id="b_status">
                            <option value="aktiv"    ${(b.status||'aktiv') === 'aktiv'    ? 'selected' : ''}>Aktiv</option>
                            <option value="inaktiv"  ${b.status === 'inaktiv'             ? 'selected' : ''}>Inaktiv</option>
                            <option value="verkauft" ${b.status === 'verkauft'            ? 'selected' : ''}>Verkauft</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Straße</label>
                        <input type="text" id="b_street" value="${b.street || ''}" oninput="updateBuildingName()">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Hausnummer</label>
                        <input type="text" id="b_nr" value="${b.house_number || ''}" oninput="updateBuildingName()">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label>
                        <input type="text" id="b_zip" value="${b.zip_code || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Ort</label>
                        <input type="text" id="b_city" value="${b.city || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Baujahr</label>
                        <input type="number" id="b_year" value="${b.construction_year || ''}">
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Notizen</label>
                        <textarea id="b_notes" rows="2">${b.notes || ''}</textarea>
                    </div>
                </div>

                <!-- TAB 2: FINANZEN -->
                <div id="bldg-tab-finance" class="bldg-tab-content hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Wirtschaftsjahr Beginn (MM-TT)</label>
                            <input type="text" id="b_fy_start" value="${b.fiscal_year_start || '01-01'}" placeholder="01-01">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Wirtschaftsjahr Ende (MM-TT)</label>
                            <input type="text" id="b_fy_end" value="${b.fiscal_year_end || '12-31'}" placeholder="12-31">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Steuernummer</label>
                            <input type="text" id="b_taxno" value="${b.tax_number || ''}">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Gläubiger-ID (SEPA)</label>
                            <input type="text" id="b_creditor" value="${b.creditor_id || ''}">
                        </div>
                    </div>

                    <!-- Bankkonten Sub-Tabelle -->
                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Bankkonten</h3>
                            ${isEdit ? `<button type="button" onclick="addBankAccountRow()"
                                class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">+ Konto hinzufügen</button>` : '<span class="text-xs text-gray-400">Erst nach erstem Speichern verfügbar.</span>'}
                        </div>
                        <div id="bank-accounts-list" class="space-y-3">
                            ${bankAccounts.map(ba => bankAccountRowHtml(ba)).join('') || '<p class="text-sm text-gray-400">Keine Bankkonten hinterlegt.</p>'}
                        </div>
                    </div>
                </div>

                <!-- TAB 3: GRUNDBUCH -->
                <div id="bldg-tab-legal" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Gesamt-MEA</label>
                        <input type="number" id="b_total_mea" value="${b.total_mea || ''}" step="0.0001">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Grundbuchamt</label>
                        <input type="text" id="b_registry" value="${b.land_registry || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Gemarkung</label>
                        <input type="text" id="b_district" value="${b.district || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Flur</label>
                        <input type="text" id="b_parcel" value="${b.parcel || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Flurstück-Nr.</label>
                        <input type="text" id="b_parcel_no" value="${b.parcel_number || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Notar</label>
                        <input type="text" id="b_notary" value="${b.notary_name || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Teilungserklärung Datum</label>
                        <input type="date" id="b_div_date" value="${b.declaration_of_division_date || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Letzte Änderung Teilungserklärung</label>
                        <input type="date" id="b_div_amend" value="${b.declaration_last_amendment_date || ''}">
                    </div>
                </div>

                <!-- TAB 4: TECHNIK & FRISTEN -->
                <div id="bldg-tab-tech" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Heizungsart</label>
                        <input type="text" id="b_heat_type" value="${b.heating_type || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Energieträger</label>
                        <input type="text" id="b_energy" value="${b.energy_source || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Baujahr Heizung</label>
                        <input type="number" id="b_heat_year" value="${b.heating_system_year || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Aufzüge Anzahl</label>
                        <input type="number" id="b_elevator" value="${b.elevator_count ?? 0}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Schließanlage ID</label>
                        <input type="text" id="b_lock" value="${b.locking_system_id || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Hauptwasserzähler Nr.</label>
                        <input type="text" id="b_main_water" value="${b.main_water_meter_id || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Energieausweis Typ</label>
                        <select id="b_ec_type">
                            <option value=""          ${!b.energy_certificate_type                 ? 'selected' : ''}>— keiner —</option>
                            <option value="Bedarfs"   ${b.energy_certificate_type === 'Bedarfs'   ? 'selected' : ''}>Bedarfsausweis</option>
                            <option value="Verbrauchs"${b.energy_certificate_type === 'Verbrauchs'? 'selected' : ''}>Verbrauchsausweis</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Energieausweis gültig bis</label>
                        <input type="date" id="b_ec_expiry" value="${b.energy_certificate_expiry || ''}">
                    </div>
                    <div class="md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-4">Legionellen & Brandschutz</h3>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-3">
                        <input type="checkbox" id="b_leg_req" ${b.legionella_check_required ? 'checked' : ''}>
                        <label for="b_leg_req" class="text-sm font-bold text-gray-700 cursor-pointer">Legionellenprüfung erforderlich</label>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Letzte Legionellenprüfung</label>
                        <input type="date" id="b_leg_last" value="${b.last_legionella_check || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Prüfintervall (Monate)</label>
                        <input type="number" id="b_leg_interval" value="${b.legionella_check_interval_months || 36}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Trinkwasseruntersuchung fällig</label>
                        <input type="date" id="b_water_due" value="${b.drinking_water_analysis_due || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Nächste Brandschutzprüfung</label>
                        <input type="date" id="b_fire_next" value="${b.next_fire_safety_check || ''}">
                    </div>
                </div>

                <div class="pt-6 border-t flex gap-4 flex-shrink-0">
                    <button type="submit" class="btn-primary">Speichern</button>
                </div>
            </form>
        </div>`;

    document.getElementById('building-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Speichert...';
        const computedName = document.getElementById('b_name').value;
        const payload = {
            name:                              computedName,
            file_number:                       document.getElementById('b_file').value || null,
            status:                            document.getElementById('b_status').value,
            street:                            document.getElementById('b_street').value || null,
            house_number:                      document.getElementById('b_nr').value || null,
            zip_code:                          document.getElementById('b_zip').value || null,
            city:                              document.getElementById('b_city').value || null,
            construction_year:                 parseInt(document.getElementById('b_year').value) || null,
            notes:                             document.getElementById('b_notes').value || null,
            fiscal_year_start:                 document.getElementById('b_fy_start').value || '01-01',
            fiscal_year_end:                   document.getElementById('b_fy_end').value || '12-31',
            tax_number:                        document.getElementById('b_taxno').value || null,
            creditor_id:                       document.getElementById('b_creditor').value || null,
            total_mea:                         parseFloat(document.getElementById('b_total_mea').value) || null,
            land_registry:                     document.getElementById('b_registry').value || null,
            district:                          document.getElementById('b_district').value || null,
            parcel:                            document.getElementById('b_parcel').value || null,
            parcel_number:                     document.getElementById('b_parcel_no').value || null,
            notary_name:                       document.getElementById('b_notary').value || null,
            declaration_of_division_date:      document.getElementById('b_div_date').value || null,
            declaration_last_amendment_date:   document.getElementById('b_div_amend').value || null,
            heating_type:                      document.getElementById('b_heat_type').value || null,
            energy_source:                     document.getElementById('b_energy').value || null,
            heating_system_year:               parseInt(document.getElementById('b_heat_year').value) || null,
            elevator_count:                    parseInt(document.getElementById('b_elevator').value) || 0,
            locking_system_id:                 document.getElementById('b_lock').value || null,
            main_water_meter_id:               document.getElementById('b_main_water').value || null,
            energy_certificate_type:           document.getElementById('b_ec_type').value || null,
            energy_certificate_expiry:         document.getElementById('b_ec_expiry').value || null,
            legionella_check_required:         document.getElementById('b_leg_req').checked,
            last_legionella_check:             document.getElementById('b_leg_last').value || null,
            legionella_check_interval_months:  parseInt(document.getElementById('b_leg_interval').value) || 36,
            drinking_water_analysis_due:       document.getElementById('b_water_due').value || null,
            next_fire_safety_check:            document.getElementById('b_fire_next').value || null,
        };
        const res = isEdit
            ? await _supabase.from('buildings').update(payload).eq('id', id)
            : await _supabase.from('buildings').insert([payload]).select('id').single();
        if (res.error) { showToast(res.error.message, 'error'); btn.disabled = false; btn.textContent = 'Speichern'; return; }
        await fetchBuildingsList();
        showToast('Gebäude gespeichert.', 'success');
        const newId = isEdit ? id : res.data?.id;
        if (newId) selectBuilding(newId);
    };
}

// Name auto-berechnen
window.updateBuildingName = () => {
    const file   = document.getElementById('b_file')?.value?.trim();
    const street = document.getElementById('b_street')?.value?.trim();
    const nr     = document.getElementById('b_nr')?.value?.trim();
    const parts  = [];
    if (file) parts.push(`[${file}]`);
    parts.push('WEG');
    if (street) parts.push(street);
    if (nr) parts.push(nr);
    const nameEl = document.getElementById('b_name');
    if (nameEl) nameEl.value = parts.join(' ');
};

// ─── Bankkonten ───────────────────────────────────────────────
function bankAccountRowHtml(ba) {
    return `<div class="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-hb-ultralight rounded-xl border border-gray-100 items-end" id="ba-row-${ba.id || 'new'}">
        <div class="space-y-1">
            <label class="text-[10px] uppercase font-bold text-gray-400">Typ</label>
            <select class="ba-type text-xs h-9 px-2" data-id="${ba.id || ''}">
                <option value="Hausgeldkonto" ${ba.account_type === 'Hausgeldkonto' ? 'selected' : ''}>Hausgeldkonto</option>
                <option value="Rücklagenkonto" ${ba.account_type === 'Rücklagenkonto' ? 'selected' : ''}>Rücklagenkonto</option>
                <option value="Sonstiges" ${ba.account_type === 'Sonstiges' ? 'selected' : ''}>Sonstiges</option>
            </select>
        </div>
        <div class="space-y-1">
            <label class="text-[10px] uppercase font-bold text-gray-400">Bank</label>
            <input type="text" class="ba-bank text-xs h-9 px-2" value="${ba.bank_name || ''}" data-id="${ba.id || ''}">
        </div>
        <div class="space-y-1">
            <label class="text-[10px] uppercase font-bold text-gray-400">IBAN</label>
            <input type="text" class="ba-iban text-xs h-9 px-2" value="${ba.iban || ''}" placeholder="DE..." data-id="${ba.id || ''}">
        </div>
        <div class="flex gap-2 items-end">
            <button type="button" onclick="saveBankAccount(${selectedBuildingId}, '${ba.id || ''}')"
                class="btn-primary text-xs px-3 h-9 flex-1">OK</button>
            <button type="button" onclick="deleteBankAccount('${ba.id || ''}')"
                class="text-red-400 hover:text-red-600 h-9 px-2 font-bold">✕</button>
        </div>
    </div>`;
}

window.addBankAccountRow = () => {
    const list = document.getElementById('bank-accounts-list');
    const emptyMsg = list.querySelector('p');
    if (emptyMsg) emptyMsg.remove();
    const div = document.createElement('div');
    div.innerHTML = bankAccountRowHtml({ id: '', account_type: 'Hausgeldkonto', bank_name: '', iban: '' });
    list.appendChild(div.firstElementChild);
};

window.saveBankAccount = async (buildingId, baId) => {
    const row = document.getElementById(`ba-row-${baId || 'new'}`) || document.querySelector('[id^="ba-row-"]');
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

// ─── Einheit-Formular (5 Tabs) ────────────────────────────────
async function showApartmentForm(id = null) {
    const area = document.getElementById('units-area');
    let apt = {};
    let assignments = { tenancies: [], ownerships: [] };

    if (id) {
        apt = currentApartments.find(x => x.id === id) || {};
        assignments = await fetchApartmentAssignments(id);
    }
    const isEdit = !!id;
    const building = currentBuildings.find(x => x.id === selectedBuildingId);
    const costKeys = apt.custom_distribution_keys || {};

    area.innerHTML = `
        <div class="card p-8 h-full overflow-y-auto flex flex-col text-left">
            <!-- Breadcrumb -->
            <div class="flex justify-between items-center mb-6">
                <div>
                    <button onclick="selectBuilding(${selectedBuildingId})"
                        class="text-xs font-bold text-hb-olive hover:underline">← ${building?.name || 'Gebäude'}</button>
                    <h2 class="text-2xl font-extrabold text-hb-offblack mt-1">${isEdit ? `Wohnung ${apt.apartment_number}` : 'Neue Einheit'}</h2>
                </div>
                <button onclick="selectBuilding(${selectedBuildingId})"
                    class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">Abbrechen</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-6 hide-scrollbar flex-shrink-0">
                <button type="button" id="apt-btn-base"    onclick="switchAptTab('base')"    class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="apt-btn-billing" onclick="switchAptTab('billing')" class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Abrechnung</button>
                <button type="button" id="apt-btn-finance" onclick="switchAptTab('finance')" class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Finanzen</button>
                <button type="button" id="apt-btn-meters"  onclick="switchAptTab('meters')"  class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Zähler</button>
                <button type="button" id="apt-btn-legal"   onclick="switchAptTab('legal')"   class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500 hover:text-gray-700">Rechtliches</button>
            </div>

            <form id="apartment-form" class="flex-grow space-y-6">
                <input type="hidden" id="apt_id" value="${apt.id || ''}">

                <!-- TAB 1: STAMMDATEN -->
                <div id="apt-tab-base" class="apt-tab-content grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Wohnungs-Nr. *</label>
                        <input type="text" id="apt_no" value="${apt.apartment_number || ''}" required>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Typ</label>
                        <select id="apt_type">
                            <option value="Wohnen"     ${(apt.type||'Wohnen') === 'Wohnen'     ? 'selected':''}>Wohnen</option>
                            <option value="Gewerbe"    ${apt.type === 'Gewerbe'    ? 'selected':''}>Gewerbe</option>
                            <option value="Stellplatz" ${apt.type === 'Stellplatz' ? 'selected':''}>Stellplatz</option>
                            <option value="Keller"     ${apt.type === 'Keller'     ? 'selected':''}>Keller</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Etage / Lage</label>
                        <input type="text" id="apt_floor" value="${apt.floor || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Lage im Gebäude</label>
                        <input type="text" id="apt_location" value="${apt.location_in_building || ''}" placeholder="z.B. 1. OG links">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Zimmer</label>
                        <input type="number" id="apt_rooms" value="${apt.rooms || ''}" step="0.5">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Fläche (m²)</label>
                        <input type="number" id="apt_sqm" value="${apt.sq_meters || ''}" step="0.01">
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Ausstattungsmerkmale</label>
                        <textarea id="apt_equipment" rows="2">${apt.equipment_features || ''}</textarea>
                    </div>
                </div>

                <!-- TAB 2: ABRECHNUNG -->
                <div id="apt-tab-billing" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">MEA (dezimal)</label>
                        <input type="number" id="apt_mea" value="${apt.mea || ''}" step="0.0001">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">MEA Zähler</label>
                        <input type="number" id="apt_mea_num" value="${apt.mea_numerator || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">MEA Nenner</label>
                        <input type="number" id="apt_mea_den" value="${apt.mea_denominator || ''}">
                    </div>
                    <div class="md:col-span-2 border-t pt-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Abweichende Verteilerschlüssel</h3>
                            <button type="button" onclick="addCostKeyRow()"
                                class="text-xs font-bold text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">+ Schlüssel</button>
                        </div>
                        <div id="cost-keys-list" class="space-y-2">
                            ${Object.entries(costKeys).map(([k, v]) => costKeyRowHtml(k, v)).join('') || '<p class="text-sm text-gray-400" id="cost-keys-empty">Keine abweichenden Schlüssel.</p>'}
                        </div>
                    </div>
                </div>

                <!-- TAB 3: FINANZEN -->
                <div id="apt-tab-finance" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Hausgeld (€)</label>
                        <input type="number" id="apt_hausgeld" value="${apt.hausgeld || ''}" step="0.01">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Kaltmiete (€)</label>
                        <input type="number" id="apt_rent" value="${apt.rent_amount || ''}" step="0.01">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Nebenkosten (€)</label>
                        <input type="number" id="apt_utilities" value="${apt.utilities_amount || ''}" step="0.01">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Kaution (€)</label>
                        <input type="number" id="apt_deposit" value="${apt.deposit_amount || ''}" step="0.01">
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" id="apt_deposit_paid" ${apt.deposit_paid ? 'checked' : ''}>
                        <label for="apt_deposit_paid" class="text-sm font-bold text-gray-700 cursor-pointer">Kaution bezahlt</label>
                    </div>
                </div>

                <!-- TAB 4: ZÄHLER -->
                <div id="apt-tab-meters" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Stromzähler Nr.</label>
                        <input type="text" id="apt_m_elec" value="${apt.meter_electricity || ''}">
                    </div>
                    <div class="space-y-2"></div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Kaltwasserzähler Nr.</label>
                        <input type="text" id="apt_m_water" value="${apt.meter_water || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Eichdatum Kaltwasser</label>
                        <input type="date" id="apt_m_water_cal" value="${apt.meter_water_calibration_until || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Warmwasserzähler Nr.</label>
                        <input type="text" id="apt_m_water_warm" value="${apt.meter_water_warm || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Eichdatum Warmwasser</label>
                        <input type="date" id="apt_m_water_warm_cal" value="${apt.meter_water_warm_calibration || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Heizkostenzähler Nr.</label>
                        <input type="text" id="apt_m_heat" value="${apt.meter_heating || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Eichdatum Heizung</label>
                        <input type="date" id="apt_m_heat_cal" value="${apt.meter_heating_calibration_until || ''}">
                    </div>
                </div>

                <!-- TAB 5: RECHTLICHES & PERSONEN -->
                <div id="apt-tab-legal" class="apt-tab-content hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Belegungsstatus</label>
                            <select id="apt_status">
                                <option value="Leerstand" ${(apt.tenant_status||'Leerstand') === 'Leerstand' ? 'selected':''}>Leerstand</option>
                                <option value="Vermietet" ${apt.tenant_status === 'Vermietet' ? 'selected':''}>Vermietet</option>
                                <option value="Eigennutzung" ${apt.tenant_status === 'Eigennutzung' ? 'selected':''}>Eigennutzung</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Sondernutzungsrechte</label>
                            <input type="text" id="apt_special" value="${apt.special_use_rights || ''}" placeholder="z.B. Gartenanteil">
                        </div>
                    </div>

                    <!-- Zugewiesene Personen -->
                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Zugewiesene Personen</h3>
                            ${isEdit ? `<button type="button" onclick="openAssignModal(${id})"
                                class="btn-primary text-xs px-4 py-2">+ Zuweisung</button>` : ''}
                        </div>
                        <div id="apt-assignments" class="space-y-2">
                            ${renderAssignmentsList(assignments)}
                        </div>
                    </div>
                </div>

                <div class="pt-6 border-t flex gap-4 flex-shrink-0">
                    <button type="submit" class="btn-primary">Speichern</button>
                    ${isEdit ? `<button type="button" onclick="deleteApartment(${apt.id})"
                        class="text-red-500 font-bold px-4 hover:bg-red-50 rounded-lg">Löschen</button>` : ''}
                </div>
            </form>
        </div>`;

    document.getElementById('apartment-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Speichert...';
        const aptId = document.getElementById('apt_id').value;

        // Verteilerschlüssel aus Key-Value-Rows einlesen
        const costKeyObj = {};
        document.querySelectorAll('.cost-key-row').forEach(row => {
            const k = row.querySelector('.ck-key')?.value?.trim();
            const v = row.querySelector('.ck-val')?.value?.trim();
            if (k) costKeyObj[k] = v || '';
        });

        const payload = {
            building_id:                 selectedBuildingId,
            apartment_number:            document.getElementById('apt_no').value,
            type:                        document.getElementById('apt_type').value,
            floor:                       document.getElementById('apt_floor').value || null,
            location_in_building:        document.getElementById('apt_location').value || null,
            rooms:                       parseFloat(document.getElementById('apt_rooms').value) || null,
            sq_meters:                   parseFloat(document.getElementById('apt_sqm').value) || null,
            equipment_features:          document.getElementById('apt_equipment').value || null,
            mea:                         parseFloat(document.getElementById('apt_mea').value) || null,
            mea_numerator:               parseInt(document.getElementById('apt_mea_num').value) || null,
            mea_denominator:             parseInt(document.getElementById('apt_mea_den').value) || null,
            custom_distribution_keys:    costKeyObj,
            hausgeld:                    parseFloat(document.getElementById('apt_hausgeld').value) || 0,
            rent_amount:                 parseFloat(document.getElementById('apt_rent').value) || 0,
            utilities_amount:            parseFloat(document.getElementById('apt_utilities').value) || 0,
            deposit_amount:              parseFloat(document.getElementById('apt_deposit').value) || 0,
            deposit_paid:                document.getElementById('apt_deposit_paid').checked,
            meter_electricity:           document.getElementById('apt_m_elec').value || null,
            meter_water:                 document.getElementById('apt_m_water').value || null,
            meter_water_calibration_until: document.getElementById('apt_m_water_cal').value || null,
            meter_water_warm:            document.getElementById('apt_m_water_warm').value || null,
            meter_water_warm_calibration: document.getElementById('apt_m_water_warm_cal').value || null,
            meter_heating:               document.getElementById('apt_m_heat').value || null,
            meter_heating_calibration_until: document.getElementById('apt_m_heat_cal').value || null,
            tenant_status:               document.getElementById('apt_status').value,
            special_use_rights:          document.getElementById('apt_special').value || null,
        };

        const res = aptId
            ? await _supabase.from('apartments').update(payload).eq('id', aptId)
            : await _supabase.from('apartments').insert([payload]).select('id').single();

        if (res.error) { showToast(res.error.message, 'error'); btn.disabled = false; btn.textContent = 'Speichern'; return; }
        await fetchApartmentsForBuilding(selectedBuildingId);
        showToast('Einheit gespeichert.', 'success');
        const newId = aptId || res.data?.id;
        if (newId) { currentApartments = (await _supabase.from('apartments').select('*').eq('building_id', selectedBuildingId).order('apartment_number')).data || []; showApartmentForm(newId); }
        else selectBuilding(selectedBuildingId);
    };
}

// ─── Verteilerschlüssel Key-Value ─────────────────────────────
function costKeyRowHtml(k = '', v = '') {
    return `<div class="cost-key-row flex gap-2 items-center">
        <input type="text" class="ck-key flex-1 text-xs h-9 px-2" value="${k}" placeholder="Schlüssel (z.B. Heizung)">
        <input type="text" class="ck-val flex-1 text-xs h-9 px-2" value="${v}" placeholder="Wert (z.B. Verbrauch)">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 font-bold px-2">✕</button>
    </div>`;
}

window.addCostKeyRow = () => {
    const list = document.getElementById('cost-keys-list');
    const empty = document.getElementById('cost-keys-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = costKeyRowHtml();
    list.appendChild(div.firstElementChild);
};

// ─── Zuweisungen laden & rendern ──────────────────────────────
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
    if (!tenancies.length && !ownerships.length) {
        return '<p class="text-sm text-gray-400">Noch keine Personen zugewiesen.</p>';
    }
    const rows = [
        ...ownerships.map(o => ({
            role: 'Eigentümer', person: o['persons!ownerships_owner_id_fkey'] || o.persons, from: o.valid_from, to: o.valid_to,
            removeCall: `removeOwnership(${o.id})`
        })),
        ...tenancies.map(t => ({
            role: 'Mieter', person: t['persons!tenancies_tenant_id_fkey'] || t.persons, from: t.start_date, to: t.end_date,
            removeCall: `removeTenancy(${t.id})`
        })),
    ];
    return rows.map(r => {
        const name = personDisplayName(r.person);
        const badge = r.role === 'Eigentümer'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-emerald-100 text-emerald-800';
        const period = r.from ? `${r.from}${r.to ? ' – ' + r.to : ''}` : '';
        const personId = r.person?.id || '';
        return `<div class="flex items-center justify-between py-2 px-3 bg-hb-ultralight rounded-xl border border-gray-100">
            <div class="flex items-center gap-3">
                <span class="${badge} text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full">${r.role}</span>
                <button type="button" onclick="navigateToPerson('${personId}')"
                    class="text-sm font-bold text-hb-olive hover:underline">${name}</button>
                ${period ? `<span class="text-xs text-gray-400">${period}</span>` : ''}
            </div>
            <button type="button" onclick="${r.removeCall}" class="text-red-400 hover:text-red-600 text-xs font-bold px-2">Entfernen</button>
        </div>`;
    }).join('');
}

window.navigateToPerson = (personId) => {
    if (!personId) return;
    showPersonForm(personId);
};

window.removeOwnership = async (id) => {
    await _supabase.from('ownerships').update({ is_active: false, valid_to: new Date().toISOString().split('T')[0] }).eq('id', id);
    showToast('Eigentümer entfernt.', 'success');
    const aptId = parseInt(document.getElementById('apt_id').value);
    if (aptId) { const a = await fetchApartmentAssignments(aptId); document.getElementById('apt-assignments').innerHTML = renderAssignmentsList(a); }
};

window.removeTenancy = async (id) => {
    await _supabase.from('tenancies').update({ status: 'Historisch', end_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    showToast('Mietverhältnis beendet.', 'success');
    const aptId = parseInt(document.getElementById('apt_id').value);
    if (aptId) { const a = await fetchApartmentAssignments(aptId); document.getElementById('apt-assignments').innerHTML = renderAssignmentsList(a); }
};

// ─── Zuweisung-Modal ──────────────────────────────────────────
window.openAssignModal = (aptId) => {
    closeAssignModal();
    const modal = document.createElement('div');
    modal.id = 'assign-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-lg p-8 space-y-5 relative" onclick="event.stopPropagation()">
            <button onclick="closeAssignModal()" class="absolute top-4 right-4 text-gray-400 hover:text-hb-orange font-bold text-lg">✕</button>
            <h3 class="text-xl font-extrabold text-hb-offblack">Person zuweisen</h3>

            <!-- Rolle -->
            <div class="flex gap-4">
                <label class="flex items-center gap-2 font-bold text-sm cursor-pointer">
                    <input type="radio" name="assign_role" value="Eigentümer" checked> Eigentümer
                </label>
                <label class="flex items-center gap-2 font-bold text-sm cursor-pointer">
                    <input type="radio" name="assign_role" value="Mieter"> Mieter
                </label>
            </div>

            <!-- Personensuche -->
            <div class="space-y-2 relative">
                <label class="text-[10px] uppercase font-bold text-gray-500">Person suchen</label>
                <input type="text" id="assign_search" placeholder="Name oder E-Mail…" oninput="searchPersonsForAssign(this.value)" autocomplete="off">
                <div id="assign_results" class="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 hidden max-h-48 overflow-y-auto"></div>
            </div>

            <!-- Ausgewählte Person -->
            <div id="assign_selected" class="hidden p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800">
                <span id="assign_selected_name"></span>
                <input type="hidden" id="assign_person_id">
            </div>

            <!-- Quick-Create -->
            <div id="assign_quickcreate" class="hidden border-t pt-4 space-y-3">
                <p class="text-sm font-bold text-hb-orange">Keine Person gefunden — direkt anlegen:</p>
                <div class="grid grid-cols-2 gap-3">
                    <input type="text" id="qc_first" placeholder="Vorname">
                    <input type="text" id="qc_last"  placeholder="Nachname *">
                </div>
                <input type="email" id="qc_email" placeholder="E-Mail">
                <input type="text"  id="qc_phone" placeholder="Telefon">
                <button type="button" onclick="quickCreatePerson()"
                    class="btn-primary text-xs px-4 py-2 w-full">Person anlegen & auswählen</button>
            </div>

            <!-- Vertragsdaten -->
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Beginn</label>
                    <input type="date" id="assign_start" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Ende (optional)</label>
                    <input type="date" id="assign_end">
                </div>
            </div>

            <button type="button" onclick="saveAssignment(${aptId})"
                class="btn-primary w-full">Zuweisung speichern</button>
        </div>`;
    modal.addEventListener('click', closeAssignModal);
    document.body.appendChild(modal);
};

window.closeAssignModal = () => {
    document.getElementById('assign-modal')?.remove();
};

window.searchPersonsForAssign = async (query) => {
    const results = document.getElementById('assign_results');
    const quickCreate = document.getElementById('assign_quickcreate');
    if (query.length < 2) { results.classList.add('hidden'); return; }

    const { data } = await _supabase.from('persons')
        .select('id, first_name, last_name, company_name, is_company, email')
        .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,email.ilike.%${query}%,company_name.ilike.%${query}%`)
        .limit(10);

    if (!data || !data.length) {
        results.classList.add('hidden');
        quickCreate.classList.remove('hidden');
        return;
    }
    quickCreate.classList.add('hidden');
    results.classList.remove('hidden');
    results.innerHTML = data.map(p => {
        const name = personDisplayName(p);
        return `<button type="button" onclick="selectPersonForAssign('${p.id}', '${name.replace(/'/g, "\\'")}')"
            class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
            <span class="font-bold">${name}</span>
            ${p.email ? `<span class="text-gray-400 ml-2">${p.email}</span>` : ''}
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
    const payload = {
        first_name: document.getElementById('qc_first').value.trim() || null,
        last_name:  last,
        email:      document.getElementById('qc_email').value.trim() || null,
        phone:      document.getElementById('qc_phone').value.trim() || null,
    };
    const { data, error } = await _supabase.from('persons').insert([payload]).select('id, first_name, last_name').single();
    if (error) { showToast(error.message, 'error'); return; }
    const name = `${data.first_name || ''} ${data.last_name}`.trim();
    selectPersonForAssign(data.id, name);
    document.getElementById('assign_quickcreate').classList.add('hidden');
    showToast(`${name} angelegt und ausgewählt.`, 'success');
};

window.saveAssignment = async (aptId) => {
    const personId = document.getElementById('assign_person_id').value;
    if (!personId) { showToast('Bitte zuerst eine Person auswählen.', 'error'); return; }
    const role       = document.querySelector('input[name="assign_role"]:checked').value;
    const startDate  = document.getElementById('assign_start').value || null;
    const endDate    = document.getElementById('assign_end').value || null;

    let error;
    if (role === 'Eigentümer') {
        ({ error } = await _supabase.from('ownerships').insert([{
            apartment_id: aptId, owner_id: personId,
            valid_from: startDate, valid_to: endDate, is_active: true
        }]));
    } else {
        ({ error } = await _supabase.from('tenancies').insert([{
            apartment_id: aptId, tenant_id: personId,
            start_date: startDate, end_date: endDate, status: 'Aktiv'
        }]));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(`${role} erfolgreich zugewiesen.`, 'success');
    closeAssignModal();
    // Tab 5 aktualisieren ohne Form neu zu rendern
    const newAssignments = await fetchApartmentAssignments(aptId);
    const el = document.getElementById('apt-assignments');
    if (el) el.innerHTML = renderAssignmentsList(newAssignments);
    await fetchApartmentsForBuilding(selectedBuildingId);
};

// ─── Einheit löschen ──────────────────────────────────────────
async function deleteApartment(id) {
    if (!confirm('Einheit wirklich löschen?')) return;
    const { error } = await _supabase.from('apartments').delete().eq('id', id);
    if (!error) { showToast('Einheit gelöscht.', 'success'); selectBuilding(selectedBuildingId); }
    else showToast(error.message, 'error');
}
