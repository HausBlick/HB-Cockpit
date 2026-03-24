// ============================================================
// HB-Mieterportal | mod-settings.js
// Admin-Einstellungen: Unternehmensdaten, Finanz-Defaults,
// Briefpapier & Logo
// Zugriff: nur admin
// ============================================================

async function loadSettings() {
    if (userProfile?.role !== 'admin') {
        document.getElementById('content-area').innerHTML =
            '<div class="p-10 card text-center"><p class="text-gray-500">Kein Zugriff.</p></div>';
        return;
    }

    const { data: s, error } = await _supabase
        .from('global_settings').select('*').eq('id', 1).single();

    if (error && error.code !== 'PGRST116') {
        showToast('Einstellungen konnten nicht geladen werden.', 'error');
        return;
    }

    _settingsRender(s || {});
}

function _settingsRender(s) {
    const logoPreview = s.logo_url
        ? `<img src="${s.logo_url}" alt="Logo" class="h-16 object-contain mb-2 rounded-lg border border-gray-100">`
        : `<div class="h-16 w-32 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 mb-2">Kein Logo</div>`;

    const letterheadPreview = s.letterhead_pdf_url
        ? `<div class="flex items-center gap-2 text-sm text-hb-olive font-semibold mb-2">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
               Briefbogen hinterlegt
           </div>`
        : `<div class="text-xs text-gray-400 mb-2">Kein Briefbogen hinterlegt</div>`;

    document.getElementById('content-area').innerHTML = `
        <div class="max-w-3xl space-y-5 py-6">
            <h1 class="text-xl font-extrabold text-hb-offblack">Einstellungen</h1>

            <!-- Card 1: Unternehmensdaten -->
            <div class="card">
                <div class="bg-hb-olive px-5 py-3">
                    <span class="text-sm font-bold text-white">Unternehmensdaten</span>
                </div>
                <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Firmenname</label>
                        <input id="s-company-name" type="text" value="${s.company_name || ''}" placeholder="HausBlick Verwaltungs GmbH">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Geschäftsführer</label>
                        <input id="s-ceo-name" type="text" value="${s.ceo_name || ''}" placeholder="Max Mustermann">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Straße & Hausnummer</label>
                        <input id="s-street" type="text" value="${s.street || ''}" placeholder="Musterstraße 1">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">PLZ & Ort</label>
                        <input id="s-zip-city" type="text" value="${s.zip_city || ''}" placeholder="12345 Berlin">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Telefon</label>
                        <input id="s-phone" type="text" value="${s.phone || ''}" placeholder="+49 30 123456">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">E-Mail</label>
                        <input id="s-email" type="email" value="${s.email || ''}" placeholder="info@hausverwaltung.de">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Website</label>
                        <input id="s-website" type="text" value="${s.website || ''}" placeholder="www.hausverwaltung.de">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Steuernummer</label>
                        <input id="s-tax-number" type="text" value="${s.tax_number || ''}" placeholder="12/345/67890">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Handelsregister (HRB)</label>
                        <input id="s-hrb-number" type="text" value="${s.hrb_number || ''}" placeholder="HRB 12345 B">
                    </div>
                </div>
                <div class="px-5 pb-5">
                    <button onclick="_settingsSaveCompany()" class="btn-primary text-sm px-5 py-2">Unternehmensdaten speichern</button>
                </div>
            </div>

            <!-- Card 2: Finanz-Standardwerte -->
            <div class="card">
                <div class="bg-hb-olive px-5 py-3">
                    <span class="text-sm font-bold text-white">Finanz-Standardwerte</span>
                </div>
                <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Standard-Mahngebühr (€)</label>
                        <input id="s-dunning-fee" type="number" step="0.01" min="0" value="${s.default_dunning_fee ?? '5.00'}" placeholder="5.00">
                        <p class="text-xs text-gray-400 mt-1">Wird beim Mahnlauf als Vorschlagswert verwendet.</p>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Basiszinssatz (% / Jahr)</label>
                        <input id="s-base-rate" type="number" step="0.01" min="0" value="${s.base_interest_rate ?? '3.37'}" placeholder="3.37">
                        <p class="text-xs text-gray-400 mt-1">Aktuell gültiger Basiszinssatz gem. § 247 BGB.</p>
                    </div>
                </div>
                <div class="px-5 pb-5">
                    <button onclick="_settingsSaveFinance()" class="btn-primary text-sm px-5 py-2">Finanzwerte speichern</button>
                </div>
            </div>

            <!-- Card 3: Briefpapier & Logo -->
            <div class="card">
                <div class="bg-hb-olive px-5 py-3">
                    <span class="text-sm font-bold text-white">Briefpapier & Logo</span>
                </div>
                <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p class="text-xs font-semibold text-gray-500 mb-2">Firmen-Logo (PNG/JPG)</p>
                        ${logoPreview}
                        <p class="text-xs text-gray-400 mb-3">Erscheint im Portal-Header und auf generierten Dokumenten.</p>
                        <label class="cursor-pointer inline-flex items-center gap-2 text-xs text-hb-olive bg-hb-ultralight px-3 py-2 rounded-lg hover:bg-gray-100 font-semibold border border-hb-olive/20">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Logo hochladen
                            <input type="file" accept="image/png,image/jpeg,image/svg+xml" class="hidden" onchange="_settingsUploadLogo(this)">
                        </label>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-gray-500 mb-2">Briefbogen-Vorlage (PDF, A4)</p>
                        ${letterheadPreview}
                        <p class="text-xs text-gray-400 mb-3">Wird als Hintergrundebene für alle generierten Briefe (Mahnungen, Wirtschaftspläne) genutzt.</p>
                        <label class="cursor-pointer inline-flex items-center gap-2 text-xs text-hb-olive bg-hb-ultralight px-3 py-2 rounded-lg hover:bg-gray-100 font-semibold border border-hb-olive/20">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Briefbogen hochladen
                            <input type="file" accept="application/pdf" class="hidden" onchange="_settingsUploadLetterhead(this)">
                        </label>
                    </div>
                </div>
                <div class="px-5 pb-4">
                    <p class="text-xs text-gray-400">Dateien werden sicher in Supabase Storage gespeichert. Maximal 5 MB pro Datei.</p>
                </div>
            </div>
        </div>
    `;
}

// ─── Speichern: Unternehmensdaten ─────────────────────────────
async function _settingsSaveCompany() {
    const updates = {
        company_name: document.getElementById('s-company-name').value.trim() || null,
        ceo_name:     document.getElementById('s-ceo-name').value.trim()     || null,
        street:       document.getElementById('s-street').value.trim()       || null,
        zip_city:     document.getElementById('s-zip-city').value.trim()     || null,
        phone:        document.getElementById('s-phone').value.trim()        || null,
        email:        document.getElementById('s-email').value.trim()        || null,
        website:      document.getElementById('s-website').value.trim()      || null,
        tax_number:   document.getElementById('s-tax-number').value.trim()   || null,
        hrb_number:   document.getElementById('s-hrb-number').value.trim()   || null,
        updated_at:   new Date().toISOString(),
    };

    const { error } = await _supabase.from('global_settings').update(updates).eq('id', 1);
    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
    showToast('Unternehmensdaten gespeichert.');
}

// ─── Speichern: Finanz-Defaults ───────────────────────────────
async function _settingsSaveFinance() {
    const fee  = parseFloat(document.getElementById('s-dunning-fee').value);
    const rate = parseFloat(document.getElementById('s-base-rate').value);

    if (isNaN(fee) || isNaN(rate) || fee < 0 || rate < 0) {
        showToast('Bitte gültige positive Zahlen eingeben.', 'error'); return;
    }

    const { error } = await _supabase.from('global_settings').update({
        default_dunning_fee: fee,
        base_interest_rate:  rate,
        updated_at:          new Date().toISOString(),
    }).eq('id', 1);

    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
    showToast('Finanzwerte gespeichert.');
}

// ─── Upload: Logo ─────────────────────────────────────────────
async function _settingsUploadLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Datei zu groß (max. 5 MB).', 'error'); return; }

    showToast('Logo wird hochgeladen...');
    const path = `settings/logo.${file.name.split('.').pop()}`;
    const { error: upErr } = await _supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (upErr) { showToast('Upload fehlgeschlagen: ' + upErr.message, 'error'); return; }

    const { data: { publicUrl } } = _supabase.storage.from('documents').getPublicUrl(path);
    const { error } = await _supabase.from('global_settings').update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { showToast('Fehler beim Speichern der URL: ' + error.message, 'error'); return; }

    showToast('Logo gespeichert.');
    loadSettings();
}

// ─── Upload: Briefbogen-PDF ───────────────────────────────────
async function _settingsUploadLetterhead(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Datei zu groß (max. 5 MB).', 'error'); return; }

    showToast('Briefbogen wird hochgeladen...');
    const path = 'settings/letterhead.pdf';
    const { error: upErr } = await _supabase.storage.from('documents').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (upErr) { showToast('Upload fehlgeschlagen: ' + upErr.message, 'error'); return; }

    const { data: { publicUrl } } = _supabase.storage.from('documents').getPublicUrl(path);
    const { error } = await _supabase.from('global_settings').update({ letterhead_pdf_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { showToast('Fehler beim Speichern der URL: ' + error.message, 'error'); return; }

    showToast('Briefbogen gespeichert.');
    loadSettings();
}
