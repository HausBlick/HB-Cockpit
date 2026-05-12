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
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Meine Einheiten</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}

async function loadMyTenants() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Meine Mieter</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}
