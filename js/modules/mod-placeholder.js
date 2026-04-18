// ============================================================
// HB-Mieterportal | mod-placeholder.js
// Platzhalter für Module, die noch implementiert werden
// Jedes wird in seiner eigenen Datei landen, sobald es gebaut wird
// ============================================================

async function loadProfile() {
    const ca = document.getElementById('content-area');
    if (!currentUser || !userProfile) {
        ca.innerHTML = '<div class="p-10 card text-center"><p class="text-gray-500">Nicht angemeldet.</p></div>';
        return;
    }

    // Notification Preferences laden
    const { data: prefs } = await _supabase
        .from('notification_preferences')
        .select('trigger_type, enabled')
        .eq('user_id', currentUser.id);

    const prefMap = {};
    (prefs || []).forEach(p => prefMap[p.trigger_type] = p.enabled);

    // Default: opt-in (true) wenn kein Eintrag existiert
    const isEnabled = (type) => prefMap[type] !== false;

    const roleLabel = ROLE_LABELS[userProfile.role] || userProfile.role;

    ca.innerHTML = `
        <div class="py-6">
            <h1 class="text-xl font-extrabold text-hb-offblack mb-4">Mein Profil</h1>
            <div class="max-w-2xl space-y-5">
                <!-- Profildaten -->
                <div class="card">
                    <div class="bg-hb-olive px-5 py-3">
                        <span class="text-sm font-bold text-white">Kontodaten</span>
                    </div>
                    <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p class="text-xs font-semibold text-gray-500 mb-1">Name</p>
                            <p class="text-sm text-hb-offblack">${_escHtml(userProfile.full_name || '—')}</p>
                        </div>
                        <div>
                            <p class="text-xs font-semibold text-gray-500 mb-1">E-Mail</p>
                            <p class="text-sm text-hb-offblack">${_escHtml(currentUser.email || '—')}</p>
                        </div>
                        <div>
                            <p class="text-xs font-semibold text-gray-500 mb-1">Rolle</p>
                            <p class="text-sm text-hb-offblack">${_escHtml(roleLabel)}</p>
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
