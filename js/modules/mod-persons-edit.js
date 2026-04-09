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
async function loadPersonForEdit(personId) {
    let personRes, bankRes, tenanciesRes, ownershipsRes, boardRes, spRes;
    try {
        [personRes, bankRes, tenanciesRes, ownershipsRes, boardRes, spRes] = await Promise.all([
            _supabase.from('persons').select('*').eq('id', personId).single(),
            _supabase.from('person_bank_accounts').select('*').eq('person_id', personId).maybeSingle(),
            _supabase.from('tenancies')
                .select('id, start_date, end_date, status, apartment_id, apartments(apartment_number, buildings(name))')
                .eq('tenant_id', personId),
            _supabase.from('ownerships')
                .select('id, valid_from, valid_to, is_active, apartment_id, apartments(apartment_number, buildings(name))')
                .eq('owner_id', personId),
            _supabase.from('board_members')
                .select('id, valid_from, valid_to, buildings(name)')
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
        tenancies: tenanciesRes.data || [],
        ownerships: ownershipsRes.data || [],
        boardMemberships: boardRes.data || [],
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

// --- Rollen-Tab rendern ---
function renderRolesTab(tenancies, ownerships, boardMemberships = [], serviceProviders = []) {
    const container = document.getElementById('person-tab-roles');
    const tenancyRows = tenancies.map(t => {
        const apt = t.apartments;
        const label = apt ? `${apt.buildings?.name || '—'} / Wohnung ${apt.apartment_number}` : '—';
        return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}</span>
            <span class="badge-mieter border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">Mieter</span>
        </div>`;
    }).join('');
    const ownershipRows = ownerships.map(o => {
        const apt = o.apartments;
        const label = apt ? `${apt.buildings?.name || '—'} / Wohnung ${apt.apartment_number}` : '—';
        return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}</span>
            <span class="badge-eigentuemer border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">Eigentümer</span>
        </div>`;
    }).join('');
    const boardRows = boardMemberships.map(bm => {
        const label = bm.buildings?.name || '—';
        return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}</span>
            <span class="badge-beirat border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">Beirat</span>
        </div>`;
    }).join('');
    const spRows = serviceProviders.map(sp => {
        const label = sp.buildings?.name ? `${sp.buildings.name}${sp.category ? ' · ' + sp.category : ''}` : (sp.category || '—');
        return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span class="text-sm text-gray-700">${label}</span>
            <span class="badge-dienstleister border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">Dienstleister</span>
        </div>`;
    }).join('');
    const allRows = tenancyRows + ownershipRows + boardRows + spRows;
    const empty = '<p class="text-sm text-gray-400 text-center py-4">Keine Zuweisungen vorhanden.</p>';
    container.innerHTML = `
        <div class="space-y-2">
            <p class="text-xs text-gray-400 mb-2">Zuweisungen erfolgen über das <strong>Objekte-Modul</strong>. Diese Ansicht ist schreibgeschützt.</p>
            <div class="bg-white border border-gray-100 rounded-xl p-4">
                ${allRows || empty}
            </div>
        </div>`;
}

// --- Haupt-Render ---
async function showPersonForm(id = null) {
    const container = document.getElementById('content-area');
    const isNew = !id;

    container.innerHTML = `<div class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
    </div>`;

    let p = {}, bank = {}, tenancies = [], ownerships = [], boardMemberships = [], serviceProviders = [], profileRole = null, profileIsLandlord = false;
    if (!isNew) {
        const data = await loadPersonForEdit(id);
        if (!data.person) { showToast('Person nicht gefunden.', 'error'); loadUserManagement(); return; }
        p = data.person;
        bank = data.bank || {};
        tenancies = data.tenancies;
        ownerships = data.ownerships;
        boardMemberships = data.boardMemberships;
        serviceProviders = data.serviceProviders;
        profileRole = data.profileRole;
        profileIsLandlord = data.profileIsLandlord || false;
    }

    const isCompany = p.is_company || false;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-extrabold">${isNew ? 'Neuen Kontakt anlegen' : 'Person bearbeiten'}</h2>
            <button onclick="loadUserManagement()"
                class="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-hb-orange">← Zurück</button>
        </div>
        <div class="card p-8 text-left">
            <!-- Tab-Navigation -->
            <div class="flex overflow-x-auto border-b border-gray-200 mb-8 gap-8 hide-scrollbar">
                <button type="button" id="person-btn-tab-base"    onclick="switchPersonTab('base')"    class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-hb-olive text-hb-olive">Stammdaten</button>
                <button type="button" id="person-btn-tab-roles"   onclick="switchPersonTab('roles')"   class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Rollen & Objekte</button>
                <button type="button" id="person-btn-tab-portal"  onclick="switchPersonTab('portal')"  class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Portal & Rechtliches</button>
                <button type="button" id="person-btn-tab-finance" onclick="switchPersonTab('finance')" class="person-tab-btn whitespace-nowrap pb-3 border-b-2 font-bold text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700">Finanzen & SEPA</button>
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
                                ? `<span class="text-emerald-600 font-bold">Registriert</span> — auth_user_id: ${p.auth_user_id || '—'}`
                                : 'Noch nicht registriert.'}</p>
                        </div>
                        ${p.is_registered
                            ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">Aktiv</span>`
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

                <div class="pt-6 border-t flex gap-4">
                    <button type="submit" class="btn-primary">Speichern</button>
                    <button type="button" onclick="loadUserManagement()" class="btn-secondary">Abbrechen</button>
                </div>
            </form>
        </div>`;

    // Rollen-Tab mit echten Daten befüllen
    renderRolesTab(tenancies, ownerships, boardMemberships, serviceProviders);

    // Formular-Submit
    document.getElementById('person-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Speichert...';
        const savedId = await savePersonData(id, isNew);
        if (savedId) {
            showToast('Kontakt gespeichert.', 'success');
            loadUserManagement();
        } else {
            btn.disabled = false;
            btn.textContent = 'Speichern';
        }
    };
}
