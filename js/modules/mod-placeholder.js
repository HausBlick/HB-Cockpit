// ============================================================
// HB-Mieterportal | mod-placeholder.js
// ============================================================

async function loadProfile() {
    const ca = document.getElementById('content-area');
    if (!currentUser || !userProfile) {
        ca.innerHTML = '<div class="p-10 card text-center"><p class="text-gray-500">Nicht angemeldet.</p></div>';
        return;
    }

    const { data: prefs } = await _supabase
        .from('notification_preferences')
        .select('trigger_type, enabled')
        .eq('user_id', currentUser.id);

    const prefMap = {};
    (prefs || []).forEach(p => prefMap[p.trigger_type] = p.enabled);
    const isEnabled = (type) => prefMap[type] !== false;

    const roleLabel = ROLE_LABELS[userProfile.role] || userProfile.role;

    // F1: Ansprechpartner-Daten nur für Verwalter (admin/manager)
    const isStaff = userProfile.role === 'admin' || userProfile.role === 'manager';
    let me = {}, avatarSignedUrl = '';
    if (isStaff) {
        const { data } = await _supabase.from('profiles')
            .select('avatar_url, function_title, phone, mobile, whatsapp_enabled').eq('id', currentUser.id).single();
        me = data || {};
        if (me.avatar_url) {
            const { data: s } = await _supabase.storage.from('avatars').createSignedUrl(me.avatar_url, 3600);
            avatarSignedUrl = s?.signedUrl || '';
        }
    }

    ca.innerHTML = `
        <div class="py-6">
            <h1 class="text-[28px] font-bold text-hb-offblack mb-6">Mein Profil</h1>
            <div class="max-w-2xl space-y-5">

                <!-- Kontodaten -->
                <div class="card">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">Kontodaten</span>
                    </div>
                    <div class="divide-y divide-gray-50">

                        <!-- Name -->
                        <div class="p-5">
                            <div class="flex items-center justify-between mb-1">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Name</p>
                                <button onclick="_profileEditToggle('name')" class="text-xs text-hb-olive font-medium hover:underline min-h-[44px] px-2">Bearbeiten</button>
                            </div>
                            <p id="profile-name-display" class="text-sm text-hb-offblack">${_escHtml(userProfile.full_name || '—')}</p>
                            <div id="profile-name-edit" class="hidden mt-3 space-y-2">
                                <input type="text" id="profile-name-input" value="${_escHtml(userProfile.full_name || '')}" class="w-full px-4 text-sm" placeholder="Vollständiger Name">
                                <div id="profile-name-error" class="hidden text-xs text-hb-error font-bold"></div>
                                <div class="flex gap-2">
                                    <button onclick="_profileSaveName()" class="btn-primary px-4 py-2 text-sm">Speichern</button>
                                    <button onclick="_profileEditToggle('name')" class="px-4 py-2 text-sm text-gray-500 hover:text-hb-offblack">Abbrechen</button>
                                </div>
                            </div>
                        </div>

                        <!-- E-Mail -->
                        <div class="p-5">
                            <div class="flex items-center justify-between mb-1">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest">E-Mail-Adresse</p>
                                <button onclick="_profileEditToggle('email')" class="text-xs text-hb-olive font-medium hover:underline min-h-[44px] px-2">Ändern</button>
                            </div>
                            <p id="profile-email-display" class="text-sm text-hb-offblack">${_escHtml(currentUser.email || '—')}</p>
                            <div id="profile-email-edit" class="hidden mt-3 space-y-2">
                                <input type="email" id="profile-email-input" value="" class="w-full px-4 text-sm" placeholder="neue@email.de">
                                <p class="text-xs text-gray-400">An die neue Adresse wird ein Bestätigungslink gesendet.</p>
                                <div id="profile-email-error" class="hidden text-xs text-hb-error font-bold"></div>
                                <div id="profile-email-success" class="hidden text-xs text-hb-success font-bold"></div>
                                <div class="flex gap-2">
                                    <button onclick="_profileSaveEmail()" class="btn-primary px-4 py-2 text-sm">Bestätigung senden</button>
                                    <button onclick="_profileEditToggle('email')" class="px-4 py-2 text-sm text-gray-500 hover:text-hb-offblack">Abbrechen</button>
                                </div>
                            </div>
                        </div>

                        <!-- Rolle (read-only) -->
                        <div class="p-5">
                            <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Rolle</p>
                            <p class="text-sm text-hb-offblack">${_escHtml(roleLabel)}</p>
                        </div>
                    </div>
                </div>

                ${isStaff ? `
                <!-- Ansprechpartner-Daten (F1, nur Verwalter) -->
                <div class="card">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">Ansprechpartner-Daten</span>
                    </div>
                    <div class="p-5 space-y-4">
                        <p class="text-xs text-gray-400 leading-snug">Diese Angaben sehen Ihre Eigentümer im Dashboard-Widget „Mein Ansprechpartner".</p>
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 rounded-full bg-hb-olive/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img id="profile-avatar-preview" src="${avatarSignedUrl}" class="${avatarSignedUrl ? '' : 'hidden'} w-full h-full object-cover" alt="">
                                <span id="profile-avatar-placeholder" class="${avatarSignedUrl ? 'hidden' : ''} text-hb-olive font-extrabold text-xl">${_escHtml((userProfile.full_name || '?').charAt(0).toUpperCase())}</span>
                            </div>
                            <label class="text-sm text-hb-olive font-semibold bg-hb-ultralight px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                Foto hochladen
                                <input type="file" accept="image/*" class="hidden" onchange="_profileUploadAvatar(this)">
                            </label>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Funktion / Bezeichnung</label>
                            <input type="text" id="profile-function-input" value="${_escHtml(me.function_title || '')}" placeholder="z.B. Objektbetreuer" class="w-full px-4 text-sm mt-1">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Telefon</label>
                                <input type="tel" id="profile-phone-input" value="${_escHtml(me.phone || '')}" placeholder="+49 …" class="w-full px-4 text-sm mt-1">
                            </div>
                            <div>
                                <label class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Mobil</label>
                                <input type="tel" id="profile-mobile-input" value="${_escHtml(me.mobile || '')}" placeholder="+49 …" class="w-full px-4 text-sm mt-1">
                            </div>
                        </div>
                        <label class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
                            <input type="checkbox" id="profile-whatsapp-input" ${me.whatsapp_enabled ? 'checked' : ''} class="w-5 h-5 accent-[#687451]">
                            <div>
                                <p class="text-sm font-semibold text-hb-offblack">WhatsApp-Kontakt anbieten</p>
                                <p class="text-xs text-gray-400">Zeigt Eigentümern einen WhatsApp-Link zu Ihrer Mobilnummer.</p>
                            </div>
                        </label>
                        <button onclick="_profileSaveContactInfo()" class="btn-primary px-4 py-2 text-sm">Speichern</button>
                    </div>
                </div>` : ''}

                <!-- Sicherheit -->
                <div class="card">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">Sicherheit</span>
                    </div>
                    <div class="p-5">
                        <div class="flex items-center justify-between mb-1">
                            <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Passwort</p>
                            <button onclick="_profileEditToggle('password')" class="text-xs text-hb-olive font-medium hover:underline min-h-[44px] px-2">Ändern</button>
                        </div>
                        <p id="profile-password-display" class="text-sm text-gray-400">••••••••</p>
                        <div id="profile-password-edit" class="hidden mt-3 space-y-2">
                            <input type="password" id="profile-pw-new" class="w-full px-4 text-sm" placeholder="Neues Passwort (min. 8 Zeichen)">
                            <input type="password" id="profile-pw-confirm" class="w-full px-4 text-sm" placeholder="Passwort bestätigen">
                            <div id="profile-password-error" class="hidden text-xs text-hb-error font-bold"></div>
                            <div class="flex gap-2">
                                <button onclick="_profileSavePassword()" class="btn-primary px-4 py-2 text-sm">Passwort speichern</button>
                                <button onclick="_profileEditToggle('password')" class="px-4 py-2 text-sm text-gray-500 hover:text-hb-offblack">Abbrechen</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- E-Mail-Benachrichtigungen -->
                <div class="card">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">E-Mail-Benachrichtigungen</span>
                    </div>
                    <div class="p-5 space-y-1">
                        ${_profileNotifRow('ticket_new', 'Neues Ticket', 'Wenn Ihnen ein neues Ticket zugewiesen wird.', isEnabled('ticket_new'))}
                        ${_profileNotifRow('ticket_status', 'Ticket-Statusänderung', 'Wenn sich der Status eines Ihrer Tickets ändert.', isEnabled('ticket_status'))}
                        ${_profileNotifRow('document_released', 'Dokument freigegeben', 'Wenn ein neues Dokument für Sie freigegeben wird.', isEnabled('document_released'))}
                        ${_profileNotifRow('news_new', 'Neuer Beitrag', 'Wenn ein neuer Beitrag am Schwarzen Brett veröffentlicht wird.', isEnabled('news_new'))}
                    </div>
                </div>

            </div>
        </div>
    `;
}

// Toggle inline edit section
window._profileEditToggle = (section) => {
    const editEl = document.getElementById(`profile-${section}-edit`);
    const isHidden = editEl.classList.contains('hidden');
    // Close all sections first
    ['name', 'email', 'password'].forEach(s => {
        document.getElementById(`profile-${s}-edit`)?.classList.add('hidden');
    });
    if (isHidden) editEl.classList.remove('hidden');
};

// Save name
window._profileSaveName = async () => {
    const input = document.getElementById('profile-name-input');
    const errEl = document.getElementById('profile-name-error');
    const name = input.value.trim();
    errEl.classList.add('hidden');

    if (!name) {
        errEl.textContent = 'Name darf nicht leer sein.';
        errEl.classList.remove('hidden');
        return;
    }

    const { error } = await _supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', currentUser.id);

    if (error) {
        errEl.textContent = 'Fehler: ' + error.message;
        errEl.classList.remove('hidden');
        return;
    }

    userProfile.full_name = name;
    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-name-edit').classList.add('hidden');
    showToast('Name gespeichert.', 'success');
};

// F1: Ansprechpartner-Daten (Funktion/Telefon/Mobil) speichern
window._profileSaveContactInfo = async () => {
    const payload = {
        function_title:   document.getElementById('profile-function-input')?.value?.trim() || null,
        phone:            document.getElementById('profile-phone-input')?.value?.trim()  || null,
        mobile:           document.getElementById('profile-mobile-input')?.value?.trim() || null,
        whatsapp_enabled: document.getElementById('profile-whatsapp-input')?.checked || false,
    };
    const { error } = await _supabase.from('profiles').update(payload).eq('id', currentUser.id);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    userProfile.phone = payload.phone;
    userProfile.mobile = payload.mobile;
    userProfile.function_title = payload.function_title;
    showToast('Ansprechpartner-Daten gespeichert.', 'success');
};

// F1: Profilfoto hochladen (privater avatars-Bucket, Pfad {uid}/avatar.<ext>)
window._profileUploadAvatar = async (input) => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Bitte eine Bilddatei wählen.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Bild ist größer als 5 MB.', 'error'); return; }
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error: upErr } = await _supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { showToast('Upload fehlgeschlagen: ' + upErr.message, 'error'); return; }
    const { error: dbErr } = await _supabase.from('profiles').update({ avatar_url: path }).eq('id', currentUser.id);
    if (dbErr) { showToast('Fehler beim Speichern: ' + dbErr.message, 'error'); return; }
    userProfile.avatar_url = path;
    const { data: signed } = await _supabase.storage.from('avatars').createSignedUrl(path, 3600);
    const img = document.getElementById('profile-avatar-preview');
    const ph  = document.getElementById('profile-avatar-placeholder');
    if (img && signed?.signedUrl) {
        img.src = signed.signedUrl + '&t=' + (input.files[0].size); // Cache-Bust bei gleichem Pfad
        img.classList.remove('hidden');
        ph?.classList.add('hidden');
    }
    showToast('Foto gespeichert.', 'success');
};

// Save email
window._profileSaveEmail = async () => {
    const input = document.getElementById('profile-email-input');
    const errEl = document.getElementById('profile-email-error');
    const successEl = document.getElementById('profile-email-success');
    const email = input.value.trim();
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (!email || !email.includes('@')) {
        errEl.textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.';
        errEl.classList.remove('hidden');
        return;
    }

    const { error } = await _supabase.auth.updateUser({ email });

    if (error) {
        errEl.textContent = 'Fehler: ' + error.message;
        errEl.classList.remove('hidden');
        return;
    }

    successEl.textContent = `Bestätigungslink wurde an ${email} gesendet.`;
    successEl.classList.remove('hidden');
    input.disabled = true;
};

// Save password
window._profileSavePassword = async () => {
    const pw1 = document.getElementById('profile-pw-new').value;
    const pw2 = document.getElementById('profile-pw-confirm').value;
    const errEl = document.getElementById('profile-password-error');
    errEl.classList.add('hidden');

    if (pw1.length < 8) {
        errEl.textContent = 'Passwort muss mindestens 8 Zeichen haben.';
        errEl.classList.remove('hidden');
        return;
    }
    if (pw1 !== pw2) {
        errEl.textContent = 'Passwörter stimmen nicht überein.';
        errEl.classList.remove('hidden');
        return;
    }

    const { error } = await _supabase.auth.updateUser({ password: pw1 });

    if (error) {
        errEl.textContent = 'Fehler: ' + error.message;
        errEl.classList.remove('hidden');
        return;
    }

    document.getElementById('profile-password-edit').classList.add('hidden');
    showToast('Passwort gespeichert.', 'success');
};

function _profileNotifRow(type, label, desc, enabled) {
    return `
        <label class="flex items-center justify-between py-3 border-b border-gray-50 cursor-pointer min-h-[44px]">
            <div class="pr-4">
                <p class="text-sm font-semibold text-hb-offblack">${label}</p>
                <p class="text-xs text-gray-400">${desc}</p>
            </div>
            <div class="hb-toggle">
                <input type="checkbox" ${enabled ? 'checked' : ''} onchange="_profileToggleNotif('${type}', this.checked)">
                <span class="hb-toggle-track"></span>
                <span class="hb-toggle-thumb"></span>
            </div>
        </label>
    `;
}

window._profileToggleNotif = async (type, enabled) => {
    const { error } = await _supabase.from('notification_preferences').upsert({
        user_id: currentUser.id,
        trigger_type: type,
        enabled,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,trigger_type' });

    if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
    }
    showToast(enabled ? 'Benachrichtigung aktiviert.' : 'Benachrichtigung deaktiviert.');
};

async function loadMyUnits() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = '<div class="flex justify-center py-20"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>';

    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const euro = n => (n === null || n === undefined || isNaN(n)) ? '—'
        : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const dt = d => d ? new Date(d).toLocaleDateString('de-DE') : '';
    const header = `
        <div class="mb-6 text-left">
            <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Meine Einheiten</h2>
            <p class="text-[15px] text-gray-500 mt-1">Ihre Eigentumseinheiten im Überblick.</p>
        </div>`;
    const empty = (msg) => `${header}<div class="p-10 card text-center max-w-md mx-auto"><p class="text-[15px] text-gray-500">${msg}</p></div>`;

    // 1) Person → aktive Eigentümerschaften → Einheiten
    const { data: person } = await _supabase.from('persons').select('id').eq('auth_user_id', currentUser.id).maybeSingle();
    let apts = [];
    if (person?.id) {
        const { data: ow } = await _supabase.from('ownerships')
            .select('apartments!inner(id, building_id, apartment_number, type, sq_meters, floor, mea, hausgeld)')
            .eq('owner_id', person.id).eq('is_active', true);
        apts = (ow || []).map(o => o.apartments).filter(Boolean);
    }
    if (!apts.length) {
        ca.innerHTML = empty('Für Ihr Konto ist derzeit keine Einheit hinterlegt. Bitte wenden Sie sich an Ihre Verwaltung.');
        return;
    }

    const bldIds = [...new Set(apts.map(a => a.building_id))];
    const aptIds = apts.map(a => a.id);

    // 2) Gebäude, Zähler, Zählerstände parallel
    const [bldRes, metersRes] = await Promise.all([
        _supabase.from('buildings').select('id, name, file_number, street, house_number, zip_code, city').in('id', bldIds),
        _supabase.from('meters').select('id, apartment_id, meter_number, meter_type, location_in_apartment').in('apartment_id', aptIds).eq('is_active', true).order('meter_type'),
    ]);
    const bldMap = Object.fromEntries((bldRes.data || []).map(b => [b.id, b]));
    const meters = metersRes.data || [];
    const meterIds = meters.map(m => m.id);
    let latestByMeter = {};
    if (meterIds.length) {
        const { data: rd } = await _supabase.from('meter_readings')
            .select('meter_id, reading_value, reading_date')
            .in('meter_id', meterIds).order('reading_date', { ascending: false });
        (rd || []).forEach(r => { if (!latestByMeter[r.meter_id]) latestByMeter[r.meter_id] = r; });
    }

    // 3) Verwalter je Gebäude (RLS-sichere RPC) + dynamisches Hausgeld je Einheit
    const mgrByBld = {}, hgByApt = {};
    await Promise.all([
        ...bldIds.map(async bid => {
            const { data } = await _supabase.rpc('get_building_managers', { p_building_id: bid });
            mgrByBld[bid] = (data || []).map(m => m.full_name).filter(Boolean);
        }),
        ...apts.map(async a => {
            const dyn = await getMonthlyHausgeld(a.id, a.building_id);
            hgByApt[a.id] = { amount: (dyn ?? a.hausgeld), dynamic: (dyn !== null && dyn !== undefined) };
        }),
    ]);

    // 4) Render — eine Karte je Einheit
    const meterIcon = t => {
        const s = (t || '').toLowerCase();
        if (s.includes('strom')) return '⚡';
        if (s.includes('wasser')) return '💧';
        if (s.includes('wärme') || s.includes('warme') || s.includes('heiz') || s.includes('gas')) return '🔥';
        return '📊';
    };

    const cards = apts.sort((a, b) => String(a.apartment_number).localeCompare(String(b.apartment_number), 'de', { numeric: true })).map(a => {
        const b = bldMap[a.building_id];
        const addr = b ? [[b.street, b.house_number].filter(Boolean).join(' '), [b.zip_code, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
        const stats = [
            a.sq_meters ? `${esc(a.sq_meters)} m²` : null,
            (a.mea !== null && a.mea !== undefined && a.mea !== '') ? `MEA ${esc(a.mea)}` : null,
            (a.floor !== null && a.floor !== undefined && a.floor !== '') ? `${esc(a.floor)}` : null,
            a.type ? esc(a.type) : null,
        ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
        const hg = hgByApt[a.id] || {};
        const aptMeters = meters.filter(m => m.apartment_id === a.id);
        const meterRows = aptMeters.length ? aptMeters.map(m => {
            const r = latestByMeter[m.id];
            const stand = r ? `${esc(r.reading_value)}${r.reading_date ? ` <span class="text-gray-400">(${dt(r.reading_date)})</span>` : ''}` : '<span class="text-gray-400">kein Stand erfasst</span>';
            const label = [m.meter_type, m.meter_number].filter(Boolean).map(esc).join(' · ');
            const loc = m.location_in_apartment ? ` <span class="text-gray-400">· ${esc(m.location_in_apartment)}</span>` : '';
            return `<div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <span class="text-gray-700">${meterIcon(m.meter_type)} ${label}${loc}</span>
                <span class="font-semibold text-hb-offblack">${stand}</span>
            </div>`;
        }).join('') : '<p class="text-sm text-gray-400 py-1">Keine Zähler hinterlegt.</p>';

        return `
        <div class="card p-6 space-y-5">
            <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center flex-shrink-0 text-xl">🏠</div>
                <div class="min-w-0">
                    <h3 class="text-lg font-extrabold text-hb-offblack leading-tight">Wohnung ${esc(a.apartment_number)}</h3>
                    <p class="text-sm text-gray-500 truncate">${esc(formatBuildingName(b))}${addr ? ' · ' + esc(addr) : ''}</p>
                </div>
            </div>

            ${stats ? `<p class="text-sm text-gray-600">${stats}</p>` : ''}

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-hb-ultralight rounded-xl p-4">
                    <p class="text-[10px] uppercase font-bold text-gray-400 mb-1">Monatliches Hausgeld</p>
                    <p class="text-2xl font-extrabold text-hb-offblack">${euro(hg.amount)}</p>
                    ${hg.dynamic ? '<p class="text-[11px] text-gray-400 mt-0.5">aus aktivem Wirtschaftsplan</p>' : ''}
                </div>
                <div class="bg-hb-ultralight rounded-xl p-4">
                    <p class="text-[10px] uppercase font-bold text-gray-400 mb-1">Verwalter</p>
                    <p class="text-sm font-semibold text-hb-offblack">${(mgrByBld[a.building_id] && mgrByBld[a.building_id].length) ? esc(mgrByBld[a.building_id].join(', ')) : '—'}</p>
                </div>
            </div>

            <div>
                <p class="text-[10px] uppercase font-bold text-gray-300 mb-1">Zähler & Stände</p>
                ${meterRows}
            </div>

            <div class="flex flex-wrap gap-2 pt-1">
                <button onclick="loadDocuments()" class="btn-outline text-xs px-4">Dokumente ansehen</button>
                <button onclick="(typeof _dashNewTicket==='function'?_dashNewTicket():loadTickets())" class="btn-outline text-xs px-4">Ticket melden</button>
            </div>
        </div>`;
    }).join('');

    ca.innerHTML = `${header}<div class="grid grid-cols-1 xl:grid-cols-2 gap-6 text-left">${cards}</div>`;
}

async function loadMyTenants() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Meine Mieter</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}
