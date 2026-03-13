// ============================================================
// HB-Mieterportal | mod-objekte.js
// Modul: Objekte — Gebäude & Einheiten (CRUD)
// ============================================================

// --- Gebäude-Liste laden ---
async function loadTenants() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] text-left">
            <div class="w-full lg:w-1/3 flex flex-col gap-4 h-full">
                <div class="card flex flex-col h-full overflow-hidden border border-gray-100">
                    <div class="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <h2 class="text-sm font-black uppercase tracking-widest text-gray-500">Immobilienbestand</h2>
                        <button onclick="showBuildingForm()" class="bg-hb-olive text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-opacity-80 shadow-sm transition-transform hover:scale-105">+</button>
                    </div>
                    <div id="buildings-list" class="flex-grow overflow-y-auto p-3 space-y-2 chat-scroll"></div>
                </div>
            </div>
            <div class="w-full lg:w-2/3 flex flex-col h-full text-left" id="units-area">
                <div class="card p-10 flex flex-col items-center justify-center text-gray-400 h-full">Bitte wähle ein Objekt aus.</div>
            </div>
        </div>`;
    await fetchBuildingsList();
}

async function fetchBuildingsList() {
    const list = document.getElementById('buildings-list');
    const { data } = await _supabase.from('buildings').select('*').order('name');
    currentBuildings = data || [];
    list.innerHTML = currentBuildings.map(b => {
        const addressStr = b.street
            ? `${b.street} ${b.house_number || ''}, ${b.zip_code || ''} ${b.city || ''}`
            : (b.address || 'Keine Adresse');
        return `<div onclick="selectBuilding(${b.id})" id="b-item-${b.id}"
                    class="p-4 rounded-xl cursor-pointer border border-transparent hover:bg-gray-50 transition-all text-left">
                    <h3 class="font-bold text-hb-offblack">${b.name}</h3>
                    <p class="text-xs text-gray-500 truncate">${addressStr}</p>
                </div>`;
    }).join('');
    if (selectedBuildingId) highlightSelectedBuilding(selectedBuildingId);
}

function highlightSelectedBuilding(id) {
    document.querySelectorAll('[id^="b-item-"]').forEach(el =>
        el.classList.remove('bg-hb-olive', 'text-white'));
    const sel = document.getElementById(`b-item-${id}`);
    if (sel) sel.classList.add('bg-hb-olive', 'text-white');
}

async function selectBuilding(id) {
    selectedBuildingId = id;
    highlightSelectedBuilding(id);
    const b = currentBuildings.find(x => x.id === id);
    const addressStr = b.street
        ? `${b.street} ${b.house_number || ''}, ${b.zip_code || ''} ${b.city || ''}`
        : (b.address || 'Keine Adresse');

    document.getElementById('units-area').innerHTML = `
        <div class="card h-full flex flex-col overflow-hidden text-left">
            <div class="p-6 border-b border-gray-50 bg-white flex justify-between items-start text-left">
                <div class="text-left">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">${b.status || 'Aktiv'}</span>
                        <span class="text-xs font-bold text-gray-400">Akten-Nr: ${b.file_number || '-'}</span>
                    </div>
                    <h2 class="text-2xl font-extrabold text-hb-offblack">${b.name}</h2>
                    <p class="text-sm text-gray-500">${addressStr}</p>
                </div>
                <button onclick="showBuildingForm(${b.id})"
                    class="text-xs font-bold text-hb-olive bg-hb-ultralight px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors shadow-sm">Details</button>
            </div>
            <div class="px-6 py-4 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center text-left">
                <h3 class="text-sm font-black uppercase tracking-widest text-gray-500">Zugehörige Einheiten</h3>
                <button onclick="showApartmentForm()" class="btn-primary py-2 px-4 text-xs shadow-sm">+ Einheit</button>
            </div>
            <div class="flex-grow overflow-y-auto p-6 bg-[#f4f5f1] chat-scroll text-left" id="apartments-list"></div>
        </div>`;
    await fetchApartmentsForBuilding(id);
}

// --- Tab-Wechsel Gebäude ---
window.switchBuildingTab = function (tabId) {
    document.querySelectorAll('.bldg-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.bldg-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('bldg-tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('bldg-btn-tab-' + tabId);
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-hb-olive', 'text-hb-olive');
    }
};

// --- Gebäude anlegen / bearbeiten ---
async function showBuildingForm(id = null) {
    const area = document.getElementById('units-area');
    let b = id ? currentBuildings.find(x => x.id === id) : {};
    const isEdit = !!id;

    area.innerHTML = `
        <div class="card p-8 h-full overflow-y-auto border border-gray-100 shadow-sm flex flex-col text-left">
            <div class="flex justify-between items-center mb-6 text-left">
                <h2 class="text-2xl font-extrabold text-hb-offblack tracking-tight">${isEdit ? 'Gebäude bearbeiten' : 'Neues Gebäude'}</h2>
                <button onclick="selectedBuildingId ? selectBuilding(selectedBuildingId) : loadTenants()"
                    class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">Zurück</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-8 hide-scrollbar flex-shrink-0">
                <button type="button" id="bldg-btn-tab-base" onclick="switchBuildingTab('base')"
                    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="bldg-btn-tab-legal" onclick="switchBuildingTab('legal')"
                    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Grundbuch</button>
                <button type="button" id="bldg-btn-tab-tech" onclick="switchBuildingTab('tech')"
                    class="bldg-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Technik</button>
            </div>

            <form id="building-form" class="flex-grow flex flex-col justify-between text-left space-y-6">
                <div id="bldg-tab-base" class="bldg-tab-content grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Name *</label><input type="text" id="b_name" value="${b.name || ''}" required></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Akten-Nr.</label><input type="text" id="b_file" value="${b.file_number || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Straße</label><input type="text" id="b_street" value="${b.street || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Haus-Nr.</label><input type="text" id="b_nr" value="${b.house_number || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label><input type="text" id="b_zip" value="${b.zip_code || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Ort</label><input type="text" id="b_city" value="${b.city || ''}"></div>
                </div>
                <div id="bldg-tab-legal" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Grundbuchamt</label><input type="text" id="b_registry" value="${b.land_registry || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Gesamt-MEA</label><input type="number" id="b_total_mea" value="${b.total_mea || ''}" step="0.0001"></div>
                </div>
                <div id="bldg-tab-tech" class="bldg-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Baujahr</label><input type="number" id="b_year" value="${b.construction_year || ''}"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Heizung</label><input type="text" id="b_heat" value="${b.energy_source || ''}"></div>
                </div>
                <div class="pt-6 border-t flex gap-4">
                    <button type="submit" class="btn-primary">Speichern</button>
                </div>
            </form>
        </div>`;

    document.getElementById('building-form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name:              document.getElementById('b_name').value,
            file_number:       document.getElementById('b_file').value,
            street:            document.getElementById('b_street').value,
            house_number:      document.getElementById('b_nr').value,
            zip_code:          document.getElementById('b_zip').value,
            city:              document.getElementById('b_city').value,
            total_mea:         document.getElementById('b_total_mea').value || 0,
            construction_year: document.getElementById('b_year').value || null,
            energy_source:     document.getElementById('b_heat').value
        };
        let res = isEdit
            ? await _supabase.from('buildings').update(payload).eq('id', id)
            : await _supabase.from('buildings').insert([payload]);
        if (!res.error) { showToast('Gespeichert'); loadTenants(); }
        else { showToast(res.error.message, 'error'); }
    };
}

// --- Einheiten ---
async function fetchApartmentsForBuilding(bId) {
    const list = document.getElementById('apartments-list');
    const { data } = await _supabase.from('apartments').select('*').eq('building_id', bId).order('apartment_number');
    currentApartments = data || [];
    list.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` +
        currentApartments.map(apt => `
            <div onclick="showApartmentForm(${apt.id})"
                class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-hb-olive cursor-pointer transition-colors group text-left">
                <h4 class="text-lg font-extrabold text-hb-offblack">${apt.apartment_number}</h4>
                <p class="text-sm text-gray-500">${apt.sq_meters || 0} m² • ${apt.tenant_status || 'Leerstand'}</p>
            </div>`).join('') +
        `</div>`;
}

// --- Tab-Wechsel Einheit ---
window.switchAptTab = function (tabId) {
    document.querySelectorAll('.apt-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.apt-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('btn-tab-' + tabId);
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-hb-olive', 'text-hb-olive');
    }
};

// --- Einheit anlegen / bearbeiten ---
async function showApartmentForm(id = null) {
    const area = document.getElementById('units-area');
    let apt = id ? currentApartments.find(x => x.id === id) : {};
    const isEdit = !!id;

    area.innerHTML = `
        <div class="card p-8 h-full overflow-y-auto border border-gray-100 shadow-sm flex flex-col text-left">
            <div class="flex justify-between items-center mb-6 text-left">
                <h2 class="text-2xl font-extrabold">${isEdit ? 'Einheit bearbeiten' : 'Neue Einheit'}</h2>
                <button onclick="selectBuilding(selectedBuildingId)"
                    class="text-xs font-bold text-gray-400 uppercase">Abbrechen</button>
            </div>

            <div class="flex overflow-x-auto border-b border-gray-200 mb-6 gap-8 hide-scrollbar flex-shrink-0">
                <button type="button" id="btn-tab-base" onclick="switchAptTab('base')"
                    class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="btn-tab-weg" onclick="switchAptTab('weg')"
                    class="apt-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm border-transparent text-gray-500">Finanzen & WEG</button>
            </div>

            <form id="apartment-form" class="flex-grow flex flex-col text-left space-y-6">
                <input type="hidden" id="apt_form_id" value="${apt.id || ''}">

                <div id="tab-base" class="apt-tab-content grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Nr. *</label><input type="text" id="apt_form_no" value="${apt.apartment_number || ''}" required></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Typ</label>
                        <select id="apt_form_type">
                            <option value="Wohnen"     ${apt.type === 'Wohnen'     ? 'selected' : ''}>Wohnen</option>
                            <option value="Gewerbe"    ${apt.type === 'Gewerbe'    ? 'selected' : ''}>Gewerbe</option>
                            <option value="Stellplatz" ${apt.type === 'Stellplatz' ? 'selected' : ''}>Stellplatz</option>
                        </select>
                    </div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">m²</label><input type="number" id="apt_form_sqm" value="${apt.sq_meters || ''}" step="0.01"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Zimmer</label><input type="number" id="apt_form_rooms" value="${apt.rooms || ''}" step="0.5"></div>
                </div>

                <div id="tab-weg" class="apt-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Hausgeld (€)</label><input type="number" id="apt_form_hausgeld" value="${apt.hausgeld || ''}" step="0.01"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">MEA</label><input type="number" id="apt_form_mea" value="${apt.mea || ''}" step="0.0001"></div>
                    <div class="space-y-2"><label class="text-[10px] uppercase font-bold text-gray-500">Status</label>
                        <select id="apt_form_status">
                            <option value="Leerstand" ${apt.tenant_status === 'Leerstand' ? 'selected' : ''}>Leerstand</option>
                            <option value="Vermietet" ${apt.tenant_status === 'Vermietet' ? 'selected' : ''}>Vermietet</option>
                        </select>
                    </div>
                </div>

                <div class="pt-6 border-t border-gray-100 flex gap-4 text-left">
                    <button type="submit" class="btn-primary">Speichern</button>
                    ${isEdit ? `<button type="button" onclick="deleteApartment(${apt.id})"
                        class="text-red-500 font-bold px-4 hover:bg-red-50 rounded-lg transition-colors">Löschen</button>` : ''}
                </div>
            </form>
        </div>`;

    document.getElementById('apartment-form').onsubmit = async (e) => {
        e.preventDefault();
        const aptId = document.getElementById('apt_form_id').value;
        const payload = {
            building_id:       selectedBuildingId,
            apartment_number:  document.getElementById('apt_form_no').value,
            type:              document.getElementById('apt_form_type').value,
            sq_meters:         document.getElementById('apt_form_sqm').value   || 0,
            rooms:             document.getElementById('apt_form_rooms').value  || 0,
            hausgeld:          document.getElementById('apt_form_hausgeld').value || 0,
            mea:               document.getElementById('apt_form_mea').value    || 0,
            tenant_status:     document.getElementById('apt_form_status').value
        };
        let res = aptId
            ? await _supabase.from('apartments').update(payload).eq('id', aptId)
            : await _supabase.from('apartments').insert([payload]);
        if (!res.error) { showToast('Einheit gespeichert'); selectBuilding(selectedBuildingId); }
        else { showToast(res.error.message, 'error'); }
    };
}

async function deleteApartment(id) {
    if (confirm('Einheit wirklich löschen?')) {
        const { error } = await _supabase.from('apartments').delete().eq('id', id);
        if (!error) selectBuilding(selectedBuildingId);
    }
}
