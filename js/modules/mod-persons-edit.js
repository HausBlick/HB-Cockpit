// ============================================================
// HB-Mieterportal | mod-persons-edit.js
// Modul: Person bearbeiten — 4-Tab-Formular
// ============================================================

// --- Tab-Wechsel ---
window.switchPersonTab = (tabId) => {
    document.querySelectorAll('.person-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.person-tab-btn').forEach(el => {
        el.classList.remove('border-hb-olive', 'text-hb-olive');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById('person-tab-' + tabId).classList.remove('hidden');
    const btn = document.getElementById('person-btn-tab-' + tabId);
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-hb-olive', 'text-hb-olive');
    }
};

// --- Firmen-Toggle ---
window.toggleCompanyMode = (isCompany) => {
    document.getElementById('p_private_fields').classList.toggle('hidden', isCompany);
    document.getElementById('p_company_fields').classList.toggle('hidden', !isCompany);
};

// --- Einladungscode generieren ---
window.generateInviteCode = async (personId) => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await _supabase
        .from('persons')
        .update({ invite_code: code, invite_sent_at: new Date().toISOString() })
        .eq('id', personId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('invite_code_display').value = code;
    showToast('Einladungscode generiert.', 'success');
};

window.copyInviteCode = () => {
    const val = document.getElementById('invite_code_display').value;
    if (!val) return;
    navigator.clipboard.writeText(val);
    showToast('Code kopiert.', 'success');
};

// --- Daten laden ---
// CRM-Umbau Phase 2: Zuweisungen kommen jetzt aus der vereinheitlichten unit_assignments-Tabelle.
async function loadPersonForEdit(personId) {
    let personRes, bankRes, assignRes, spRes;
    try {
        [personRes, bankRes, assignRes, spRes] = await Promise.all([
            _supabase.from('persons').select('*').eq('id', personId).single(),
            _supabase.from('person_bank_accounts').select('*').eq('person_id', personId).maybeSingle(),
            _supabase.from('unit_assignments')
                .select('id, role, advisory_function, valid_from, valid_to, is_active, iban, bic, rent_amount, apartment_id, building_id, context_number, apartments(apartment_number, buildings(name))')
                .eq('person_id', personId),
            _supabase.from('service_providers')
                .select('id, category, buildings(name)')
                .eq('person_id', personId),
        ]);
    } catch (err) {
        console.error('loadPersonForEdit error:', err);
        return { person: null };
    }

    if (personRes.error) {
        console.error('Person load error:', personRes.error);
        return { person: null };
    }

    // Gebäudenamen für objektweite Zuweisungen (z.B. Beirat ohne Wohnung) nachladen
    const assigns = assignRes.data || [];
    const needBld = [...new Set(assigns.filter(a => !a.apartment_id && a.building_id).map(a => a.building_id))];
    let bldMap = {};
    if (needBld.length) {
        const { data: blds } = await _supabase.from('buildings').select('id, name').in('id', needBld);
        bldMap = Object.fromEntries((blds || []).map(b => [b.id, b.name]));
    }
    const assignments = assigns.map(a => ({
        ...a,
        buildingName:    a.apartments?.buildings?.name || bldMap[a.building_id] || '—',
        apartmentNumber: a.apartments?.apartment_number || null,
    }));

    // Profil-Rolle + Flags laden falls auth_user_id vorhanden
    let profileRole = null;
    let profileIsLandlord = false;
    const authUid = personRes.data?.auth_user_id;
    if (authUid) {
        const { data: prof } = await _supabase.from('profiles').select('role, is_landlord').eq('id', authUid).single();
        profileRole = prof?.role || null;
        profileIsLandlord = prof?.is_landlord === true;
    }

    return {
        person: personRes.data,
        bank: bankRes.data,
        assignments,
        serviceProviders: spRes.data || [],
        profileRole,
        profileIsLandlord,
    };
}

// --- Speichern ---
async function savePersonData(personId, isNew) {
    const isCompany = document.getElementById('p_is_company').checked;

    const personPayload = {
        is_company:    isCompany,
        company_name:  isCompany ? (document.getElementById('p_company_name').value || null) : null,
        salutation:    !isCompany ? (document.getElementById('p_salutation').value || null) : null,
        title:         !isCompany ? (document.getElementById('p_title').value || null) : null,
        first_name:    !isCompany ? (document.getElementById('p_first').value || null) : null,
        last_name:     isCompany
            ? (document.getElementById('p_company_name').value || '')
            : (document.getElementById('p_last').value || ''),
        birthdate:     (!isCompany && document.getElementById('p_birthdate').value) || null,
        tax_id:        document.getElementById('p_tax_id').value || null,
        email:         document.getElementById('p_email').value || null,
        phone:         document.getElementById('p_phone').value || null,
        mobile:        document.getElementById('p_mobile').value || null,
        street:        document.getElementById('p_street').value || null,
        house_number:  document.getElementById('p_house_number').value || null,
        zip_code:      document.getElementById('p_zip').value || null,
        city:          document.getElementById('p_city').value || null,
        corr_street:       document.getElementById('p_corr_street').value || null,
        corr_house_number: document.getElementById('p_corr_house_number').value || null,
        corr_zip_code:     document.getElementById('p_corr_zip').value || null,
        corr_city:         document.getElementById('p_corr_city').value || null,
        digital_communication_opt_in: document.getElementById('p_digital_post').checked,
        notes:         document.getElementById('p_notes').value || null,
        updated_at:    new Date().toISOString(),
    };

    let savedId = personId;
    if (isNew) {
        const { data, error } = await _supabase.from('persons').insert(personPayload).select('id').single();
        if (error) { showToast('Fehler: ' + error.message, 'error'); return null; }
        savedId = data.id;
    } else {
        const { error } = await _supabase.from('persons').update(personPayload).eq('id', personId);
        if (error) { showToast('Fehler: ' + error.message, 'error'); return null; }
    }

    // Portal-Rolle + Flags speichern (falls registrierter User)
    const roleSelect = document.getElementById('p_profile_role');
    if (roleSelect && !isNew) {
        const { data: person } = await _supabase.from('persons').select('auth_user_id').eq('id', savedId).single();
        if (person?.auth_user_id) {
            const isLandlord = document.getElementById('p_is_landlord')?.checked || false;
            await _supabase.from('profiles').update({
                role: roleSelect.value,
                is_landlord: isLandlord,
            }).eq('id', person.auth_user_id);
        }
    }

    // Bankdaten speichern
    const ibanVal = document.getElementById('p_iban').value;
    if (ibanVal) {
        const bankPayload = {
            person_id:          savedId,
            account_holder:     document.getElementById('p_bank_owner').value || null,
            iban:               ibanVal,
            bic:                document.getElementById('p_bic').value || null,
            sepa_mandate_ref:   document.getElementById('p_sepa_ref').value || null,
            sepa_signature_date: document.getElementById('p_sepa_date').value || null,
        };
        const existing = document.getElementById('p_bank_id').value;
        if (existing) {
            await _supabase.from('person_bank_accounts').update(bankPayload).eq('id', existing);
        } else {
            await _supabase.from('person_bank_accounts').insert(bankPayload);
        }
    }

    return savedId;
}

// --- Rollen-Tab rendern (aus unit_assignments) — editierbar: Zuweisung hinzufügen/beenden ---
let _peBuildingsCache = null;
async function _peEnsureBuildings() {
    if (_peBuildingsCache) return _peBuildingsCache;
    const { data } = await _supabase.from('buildings').select('id, name, file_number, street, house_number').order('file_number');
    _peBuildingsCache = data || [];
    return _peBuildingsCache;
}

async function renderRolesTab(assignments = [], serviceProviders = [], personId = null) {
    const container = document.getElementById('person-tab-roles');
    if (!container) return;
    const roleMeta = {
        owner:    ['Eigentümer', 'badge-eigentuemer'],
        tenant:   ['Mieter',     'badge-mieter'],
        advisory: ['Beirat',     'badge-beirat'],
    };
    const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '';
    const fmtEur  = v => `${Number(v).toFixed(2).replace('.', ',')} €`;

    const assignRows = assignments.map(a => {
        const [label, cls] = roleMeta[a.role] || [a.role, 'badge-dienstleister'];
        const loc = a.apartmentNumber ? `${a.buildingName} / Wohnung ${a.apartmentNumber}` : a.buildingName;
        const meta = [];
        if (a.context_number) meta.push(`Nr. ${a.context_number}`);
        if (a.valid_from || a.valid_to) meta.push(`${fmtDate(a.valid_from)}–${fmtDate(a.valid_to) || 'offen'}`);
        if (a.role === 'tenant' && a.rent_amount) meta.push(`Miete ${fmtEur(a.rent_amount)}`);
        if (a.role === 'advisory' && a.advisory_function) meta.push(a.advisory_function);
        if (a.iban) meta.push(`IBAN …${String(a.iban).slice(-4)}`);
        if (!a.is_active) meta.push('beendet');
        const metaHtml = meta.length ? `<span class="block text-[11px] text-gray-400 mt-0.5">${meta.join(' · ')}</span>` : '';
        // "Beenden" nur für aktive owner/tenant (haben source in ownerships/tenancies)
        const canEnd = a.is_active && (a.source_table === 'ownerships' || a.source_table === 'tenancies') && personId;
        const endBtn = canEnd
            ? `<button type="button" onclick="endPersonAssignment('${a.source_table}', ${a.source_id}, '${personId}')"
                 class="text-[11px] font-bold text-hb-error border border-hb-error/30 rounded-lg px-2 py-1 hover:bg-hb-error/5 whitespace-nowrap ml-2">Beenden</button>`
            : '';
        return `<div class="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${loc}${metaHtml}</span>
            <span class="flex items-center gap-1 flex-shrink-0">
                <span class="border ${cls} text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap">${label}</span>
                ${endBtn}
            </span>
        </div>`;
    }).join('');

    const spRows = serviceProviders.map(sp => {
        const label = sp.buildings?.name ? `${sp.buildings.name}${sp.category ? ' · ' + sp.category : ''}` : (sp.category || '—');
        return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}</span>
            <span class="badge-dienstleister border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">Dienstleister</span>
        </div>`;
    }).join('');

    const allRows = assignRows + spRows;
    const empty = '<p class="text-[15px] text-gray-400 text-center py-4">Keine Zuweisungen vorhanden.</p>';

    let addForm = '';
    if (personId) {
        const buildings = await _peEnsureBuildings();
        const bldOpts = buildings.map(b => `<option value="${b.id}">${typeof formatBuildingName === 'function' ? formatBuildingName(b) : (b.name || b.file_number)}</option>`).join('');
        const today = new Date().toISOString().split('T')[0];
        addForm = `
            <div class="bg-hb-olive/5 border border-hb-olive/15 rounded-xl p-4 mt-3">
                <p class="text-[10px] uppercase font-bold text-hb-olive mb-3">Neue Zuweisung</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude</label>
                        <select id="pa_building" onchange="_peLoadUnits(this.value)"><option value="">— wählen —</option>${bldOpts}</select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Einheit</label>
                        <select id="pa_unit"><option value="">— erst Gebäude wählen —</option></select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Rolle</label>
                        <select id="pa_role"><option value="Eigentümer">Eigentümer</option><option value="Mieter">Mieter</option></select>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Von</label><input type="date" id="pa_from" value="${today}"></div>
                        <div class="space-y-1"><label class="text-[10px] uppercase font-bold text-gray-500">Bis (optional)</label><input type="date" id="pa_to"></div>
                    </div>
                </div>
                <button type="button" onclick="addPersonAssignment('${personId}')" class="btn-primary text-xs px-4 mt-3">Zuweisen</button>
            </div>`;
    } else {
        addForm = '<p class="text-xs text-gray-400 mt-2">Person zuerst speichern, dann können Zuweisungen hinzugefügt werden.</p>';
    }

    container.innerHTML = `
        <div class="space-y-2">
            <div class="bg-white border border-gray-100 rounded-xl p-4">${allRows || empty}</div>
            ${addForm}
        </div>`;
}

// Einheiten eines Gebäudes ins Zuweisungs-Formular laden
window._peLoadUnits = async (buildingId) => {
    const sel = document.getElementById('pa_unit');
    if (!sel) return;
    if (!buildingId) { sel.innerHTML = '<option value="">— erst Gebäude wählen —</option>'; return; }
    const { data } = await _supabase.from('apartments').select('id, apartment_number').eq('building_id', buildingId).order('apartment_number');
    sel.innerHTML = '<option value="">— wählen —</option>' + (data || []).map(a => `<option value="${a.id}">Wohnung ${a.apartment_number}</option>`).join('');
};

// Zuweisung anlegen (schreibt in ownerships/tenancies; DB-Trigger synct unit_assignments + Rolle)
window.addPersonAssignment = async (personId) => {
    const aptId = parseInt(document.getElementById('pa_unit')?.value) || null;
    const role  = document.getElementById('pa_role')?.value;
    const from  = document.getElementById('pa_from')?.value || null;
    const to    = document.getElementById('pa_to')?.value || null;
    if (!aptId) { showToast('Bitte eine Einheit wählen.', 'error'); return; }
    let error;
    if (role === 'Eigentümer') {
        ({ error } = await _supabase.from('ownerships').insert([{ apartment_id: aptId, owner_id: personId, valid_from: from, valid_to: to, is_active: true }]));
    } else {
        ({ error } = await _supabase.from('tenancies').insert([{ apartment_id: aptId, tenant_id: personId, start_date: from, end_date: to, status: 'Aktiv' }]));
    }
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`${role} zugewiesen.`, 'success');
    _peReloadRoles(personId);
};

// Zuweisung beenden
window.endPersonAssignment = async (sourceTable, sourceId, personId) => {
    if (!confirm('Zuweisung wirklich beenden?')) return;
    const today = new Date().toISOString().split('T')[0];
    if (sourceTable === 'ownerships') {
        await _supabase.from('ownerships').update({ is_active: false, valid_to: today }).eq('id', sourceId);
    } else {
        await _supabase.from('tenancies').update({ status: 'Historisch', end_date: today }).eq('id', sourceId);
    }
    showToast('Zuweisung beendet.', 'success');
    _peReloadRoles(personId);
};

// Rollen-Tab neu laden
async function _peReloadRoles(personId) {
    const data = await loadPersonForEdit(personId);
    if (data.person) renderRolesTab(data.assignments || [], data.serviceProviders || [], personId);
}

// --- Haupt-Render ---
async function showPersonForm(id = null) {
    const container = document.getElementById('content-area');
    const isNew = !id;

    container.innerHTML = `<div class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
    </div>`;

    let p = {}, bank = {}, assignments = [], serviceProviders = [], profileRole = null, profileIsLandlord = false;
    if (!isNew) {
        const data = await loadPersonForEdit(id);
        if (!data.person) { showToast('Person nicht gefunden.', 'error'); loadCrm(); return; }
        p = data.person;
        bank = data.bank || {};
        assignments = data.assignments || [];
        serviceProviders = data.serviceProviders || [];
        profileRole = data.profileRole;
        profileIsLandlord = data.profileIsLandlord || false;
    }

    const isCompany = p.is_company || false;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-extrabold">${isNew ? 'Neuen Kontakt anlegen' : 'Person bearbeiten'}</h2>
            <button onclick="loadCrm()"
                class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück zum HB-CRM</button>
        </div>
        <div class="card p-8 text-left">
            <!-- Tab-Navigation -->
            <div class="flex overflow-x-auto border-b border-gray-200 mb-8 gap-8 hide-scrollbar">
                <button type="button" id="person-btn-tab-base"    onclick="switchPersonTab('base')"    class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="person-btn-tab-roles"   onclick="switchPersonTab('roles')"   class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Rollen & Objekte</button>
                <button type="button" id="person-btn-tab-portal"  onclick="switchPersonTab('portal')"  class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Portal & Rechtliches</button>
                <button type="button" id="person-btn-tab-finance" onclick="switchPersonTab('finance')" class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Finanzen & SEPA</button>
                ${!isNew ? `<button type="button" id="person-btn-tab-activity" onclick="switchPersonTab('activity')" class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Aktivitäten</button>` : ''}
            </div>

            <form id="person-form" class="space-y-6">

                <!-- ===== TAB 1: STAMMDATEN ===== -->
                <div id="person-tab-base" class="person-tab-content grid grid-cols-1 md:grid-cols-2 gap-6">

                    <!-- Firmen-Toggle -->
                    <div class="md:col-span-2 flex items-center gap-3">
                        <input type="checkbox" id="p_is_company" ${isCompany ? 'checked' : ''}
                            onchange="toggleCompanyMode(this.checked)">
                        <label for="p_is_company" class="text-sm font-bold text-gray-700 cursor-pointer">Ist Firma / juristische Person</label>
                    </div>

                    <!-- Firmen-Felder -->
                    <div id="p_company_fields" class="md:col-span-2 ${!isCompany ? 'hidden' : ''}">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Firmenname *</label>
                        <input type="text" id="p_company_name" value="${p.company_name || ''}">
                    </div>

                    <!-- Privatperson-Felder -->
                    <div id="p_private_fields" class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 ${isCompany ? 'hidden' : ''}">
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Anrede</label>
                            <select id="p_salutation">
                                <option value="" ${!p.salutation ? 'selected' : ''}>— Keine —</option>
                                ${SALUTATIONS.map(s => `<option value="${s}" ${p.salutation === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Titel (akademisch)</label>
                            <input type="text" id="p_title" value="${p.title || ''}" placeholder="Dr., Prof., ...">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Vorname</label>
                            <input type="text" id="p_first" value="${p.first_name || ''}">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Nachname *</label>
                            <input type="text" id="p_last" value="${p.last_name || ''}" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Geburtsdatum</label>
                            <input type="date" id="p_birthdate" value="${p.birthdate || ''}">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Steuer-ID (§35a EStG)</label>
                            <input type="text" id="p_tax_id" value="${p.tax_id || ''}">
                        </div>
                    </div>
                    <!-- Kontakt -->
                    <div class="md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-4">Kontakt</h3>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">E-Mail</label>
                        <input type="email" id="p_email" value="${p.email || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Telefon</label>
                        <input type="text" id="p_phone" value="${p.phone || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Mobil</label>
                        <input type="text" id="p_mobile" value="${p.mobile || ''}">
                    </div>

                    <!-- Hauptadresse -->
                    <div class="md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-4">Haupt-Meldeadresse</h3>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Straße</label>
                        <input type="text" id="p_street" value="${p.street || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Hausnummer</label>
                        <input type="text" id="p_house_number" value="${p.house_number || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label>
                        <input type="text" id="p_zip" value="${p.zip_code || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Ort</label>
                        <input type="text" id="p_city" value="${p.city || ''}">
                    </div>

                    <!-- Korrespondenzadresse -->
                    <div class="md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-4">Abweichende Korrespondenzadresse</h3>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Straße</label>
                        <input type="text" id="p_corr_street" value="${p.corr_street || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Hausnummer</label>
                        <input type="text" id="p_corr_house_number" value="${p.corr_house_number || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">PLZ</label>
                        <input type="text" id="p_corr_zip" value="${p.corr_zip_code || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Ort</label>
                        <input type="text" id="p_corr_city" value="${p.corr_city || ''}">
                    </div>
                </div>

                <!-- ===== TAB 2: ROLLEN & OBJEKTE ===== -->
                <div id="person-tab-roles" class="person-tab-content hidden space-y-4">
                    <p class="text-xs text-gray-400">Lädt...</p>
                </div>

                <!-- ===== TAB 3: PORTAL & RECHTLICHES ===== -->
                <div id="person-tab-portal" class="person-tab-content hidden space-y-6">
                    <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive">Portal-Zugang</h3>
                    <div class="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                            <p class="text-sm font-bold text-gray-800">Registrierungsstatus</p>
                            <p class="text-xs text-gray-500">${p.is_registered
                                ? `<span class="text-hb-success font-bold">Registriert</span> — auth_user_id: ${p.auth_user_id || '—'}`
                                : 'Noch nicht registriert.'}</p>
                        </div>
                        ${p.is_registered
                            ? `<span class="bg-hb-success/12 text-hb-success text-xs font-bold px-3 py-1 rounded-full">Aktiv</span>`
                            : `<span class="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">Inaktiv</span>`}
                    </div>

                    ${p.auth_user_id ? `<div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Portal-Rolle</label>
                        <select id="p_profile_role">
                            <option value="owner" ${profileRole === 'owner' ? 'selected' : ''}>Eigentümer</option>
                            <option value="tenant" ${profileRole === 'tenant' ? 'selected' : ''}>Mieter</option>
                            <option value="manager" ${profileRole === 'manager' ? 'selected' : ''}>Objektbetreuer</option>
                            <option value="admin" ${profileRole === 'admin' ? 'selected' : ''}>Administrator</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Zusatzrollen</label>
                        <label class="flex items-center gap-2 text-sm">
                            <input type="checkbox" id="p_is_landlord" ${profileIsLandlord ? 'checked' : ''} class="w-4 h-4 accent-hb-olive">
                            Vermieter <span class="text-xs text-gray-400">(darf Mieter anlegen & Tickets weiterleiten)</span>
                        </label>
                        <p class="text-xs text-gray-400">Beirat-Zugang wird über die Beirats-Zuweisung im Gebäude gesteuert.</p>
                    </div>` : ''}

                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Einladungscode</label>
                        <div class="flex gap-2">
                            <input type="text" id="invite_code_display" value="${p.invite_code || ''}" readonly
                                class="flex-grow" placeholder="Noch kein Code generiert">
                            <button type="button" onclick="generateInviteCode('${id}')"
                                class="btn-primary text-xs px-4 whitespace-nowrap">Generieren</button>
                            <button type="button" onclick="copyInviteCode()"
                                class="btn-secondary text-xs px-4 whitespace-nowrap">Kopieren</button>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 pt-2">
                        <input type="checkbox" id="p_digital_post" ${p.digital_communication_opt_in ? 'checked' : ''}>
                        <label for="p_digital_post" class="text-sm font-bold text-gray-700 cursor-pointer">
                            Digitaler Dokumentenversand (Opt-in)
                        </label>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Interne Notizen</label>
                        <textarea id="p_notes" rows="4">${p.notes || ''}</textarea>
                    </div>
                </div>

                <!-- ===== TAB 4: FINANZEN & SEPA ===== -->
                <div id="person-tab-finance" class="person-tab-content hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="hidden" id="p_bank_id" value="${bank.id || ''}">
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Kontoinhaber</label>
                        <input type="text" id="p_bank_owner" value="${bank.account_holder || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">IBAN</label>
                        <input type="text" id="p_iban" value="${bank.iban || ''}" placeholder="DE...">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">BIC</label>
                        <input type="text" id="p_bic" value="${bank.bic || ''}">
                    </div>
                    <div class="md:col-span-2 border-t pt-4">
                        <h3 class="text-sm font-black uppercase tracking-widest text-hb-olive mb-4">SEPA-Lastschriftmandat</h3>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Mandatsreferenz</label>
                        <input type="text" id="p_sepa_ref" value="${bank.sepa_mandate_ref || ''}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] uppercase font-bold text-gray-500">Datum der Unterschrift</label>
                        <input type="date" id="p_sepa_date" value="${bank.sepa_signature_date || ''}">
                    </div>
                </div>

                <!-- ===== TAB 5: AKTIVITÄTEN (Activity-Log) ===== -->
                ${!isNew ? `<div id="person-tab-activity" class="person-tab-content hidden">
                    <div id="crm-activity-container"></div>
                </div>` : ''}

                <div class="pt-6 border-t flex gap-4">
                    <button type="submit" class="btn-primary">Speichern</button>
                    <button type="button" onclick="loadCrm()" class="btn-secondary">Abbrechen</button>
                </div>
            </form>
        </div>`;

    // Rollen-Tab mit echten Daten befüllen (editierbar bei bestehender Person)
    renderRolesTab(assignments, serviceProviders, isNew ? null : id);

    // Activity-Log (nur für bestehende Personen)
    if (!isNew && typeof renderCrmActivityLog === 'function') {
        renderCrmActivityLog(document.getElementById('crm-activity-container'), 'person', id);
    }

    // Formular-Submit
    document.getElementById('person-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Speichert...';
        const savedId = await savePersonData(id, isNew);
        if (savedId) {
            showToast('Kontakt gespeichert.', 'success');
            // Zurück in die HB-CRM-Vollansicht der Person (statt in die alte Liste)
            if (typeof showCrmPersonDetail === 'function') showCrmPersonDetail(savedId);
            else loadCrm();
        } else {
            btn.disabled = false;
            btn.textContent = 'Speichern';
        }
    };
}
