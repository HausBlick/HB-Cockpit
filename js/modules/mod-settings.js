// ============================================================
// HB-Mieterportal | mod-settings.js
// Admin-Einstellungen: Allgemein (Unternehmen, Finanzen, Briefpapier)
// + Dokumenten-Designer (PDF-Vorlagen mit Live-Preview)
// Zugriff: nur admin
// ============================================================

let _designerState = null; // {template, blocks, dirty, previewTimer}

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

    const settings = s || {};

    if (settings.logo_url) {
        const { data: d } = await _supabase.storage.from('documents').createSignedUrl(settings.logo_url, 300);
        settings._logoSignedUrl = d?.signedUrl || null;
    }

    _settingsRender(settings);
}

// ─── Tab-basiertes Layout ────────────────────────────────────
function _settingsRender(s) {
    // Store settings for designer access
    window._settingsData = s;

    document.getElementById('content-area').innerHTML = `
        <div class="py-6">
            <h1 class="text-xl font-extrabold text-hb-offblack mb-4">Einstellungen</h1>

            <!-- Tab-Navigation -->
            <div class="flex gap-1 mb-5 border-b border-hb-olive/10 pb-0">
                <button id="stab-allgemein" onclick="_settingsTab('allgemein')"
                    class="px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all">Allgemein</button>
                <button id="stab-designer" onclick="_settingsTab('designer')"
                    class="px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all">Dokumenten-Designer</button>
            </div>

            <div id="settings-tab-content"></div>
        </div>
    `;

    _settingsTab('allgemein');
}

function _settingsTab(tab) {
    // Active/inactive tab styling
    document.querySelectorAll('[id^="stab-"]').forEach(el => {
        el.classList.remove('bg-hb-olive', 'text-white');
        el.classList.add('text-hb-olive', 'hover:bg-gray-100');
    });
    const active = document.getElementById('stab-' + tab);
    if (active) {
        active.classList.add('bg-hb-olive', 'text-white');
        active.classList.remove('text-hb-olive', 'hover:bg-gray-100');
    }

    if (tab === 'allgemein') {
        _settingsRenderAllgemein(window._settingsData || {});
    } else if (tab === 'designer') {
        _settingsRenderDesigner();
    }
}

// ─── Tab: Allgemein (bisherige 3 Cards) ──────────────────────
function _settingsRenderAllgemein(s) {
    const logoPreview = s._logoSignedUrl
        ? `<img src="${s._logoSignedUrl}" alt="Logo" class="h-16 object-contain mb-2 rounded-lg border border-gray-100">`
        : `<div class="h-16 w-32 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 mb-2">Kein Logo</div>`;

    const letterheadPreview = s.letterhead_pdf_url
        ? `<div class="flex items-center gap-2 text-sm text-hb-olive font-semibold mb-2">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
               Briefbogen hinterlegt
           </div>`
        : `<div class="text-xs text-gray-400 mb-2">Kein Briefbogen hinterlegt</div>`;

    document.getElementById('settings-tab-content').innerHTML = `
        <div class="max-w-3xl space-y-5">
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

    const { error } = await _supabase.from('global_settings').update({ logo_url: path, updated_at: new Date().toISOString() }).eq('id', 1);
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

    const { error } = await _supabase.from('global_settings').update({ letterhead_pdf_url: path, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { showToast('Fehler beim Speichern der URL: ' + error.message, 'error'); return; }

    showToast('Briefbogen gespeichert.');
    loadSettings();
}

// ============================================================
// DOKUMENTEN-DESIGNER (PDF-Vorlagen-System)
// ============================================================

// ─── Lazy-Load: pdf-lib + fontkit + utils-pdf.js ─────────────
// Im Dashboard sind diese Scripts nicht geladen (Phase 1B).
// Der Designer lädt sie bei Bedarf dynamisch nach.
let _dsLibsLoaded = false;
async function _dsEnsurePdfLibs() {
    if (_dsLibsLoaded) return true;
    if (typeof PDFLib !== 'undefined' && typeof fontkit !== 'undefined' && typeof generateFromTemplate === 'function') {
        _dsLibsLoaded = true;
        return true;
    }

    try {
        // Sequenziell laden: pdf-lib → fontkit → utils-pdf.js
        const scripts = [
            { src: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', check: () => typeof PDFLib !== 'undefined' },
            { src: 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js', check: () => typeof fontkit !== 'undefined' },
            { src: 'js/utils-pdf.js?v=20260401e', check: () => typeof generateFromTemplate === 'function' },
        ];

        for (const s of scripts) {
            if (s.check()) continue;
            await new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = s.src;
                el.onload = resolve;
                el.onerror = () => reject(new Error('Script-Laden fehlgeschlagen: ' + s.src));
                document.head.appendChild(el);
            });
        }

        _dsLibsLoaded = true;
        return true;
    } catch (e) {
        console.error('PDF-Libs laden fehlgeschlagen:', e);
        showToast('PDF-Bibliotheken konnten nicht geladen werden: ' + e.message, 'error');
        return false;
    }
}

// Block-Typ-Definitionen für das "Block hinzufügen"-Dropdown
const _BLOCK_TYPES = [
    { type: 'heading',    label: 'Überschrift',     icon: 'H' },
    { type: 'text',       label: 'Textabsatz',      icon: 'T' },
    { type: 'table',      label: 'Tabelle',         icon: '▦' },
    { type: 'spacer',     label: 'Abstand',         icon: '↕' },
    { type: 'page_break', label: 'Seitenumbruch',   icon: '⏎' },
    { type: 'hint_box',   label: 'Hinweis-Box',     icon: '!' },
];

// ─── Designer-Tab rendern ────────────────────────────────────
async function _settingsRenderDesigner() {
    const container = document.getElementById('settings-tab-content');

    // PDF-Libs lazy-loaden (nur im Dashboard nötig)
    container.innerHTML = '<div class="p-10 text-center"><div class="skeleton" style="height:40px;width:200px;margin:0 auto"></div><p class="text-xs text-gray-400 mt-3">PDF-Bibliotheken werden geladen...</p></div>';
    const libsOk = await _dsEnsurePdfLibs();
    if (!libsOk) {
        container.innerHTML = '<div class="card p-10 text-center"><p class="text-gray-500">PDF-Bibliotheken konnten nicht geladen werden. Bitte Seite neu laden.</p></div>';
        return;
    }

    container.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <label class="text-xs font-semibold text-gray-500">Vorlage:</label>
            <select id="ds-template-select" onchange="_dsLoadTemplate(this.value)" class="w-64">
                <option value="">— Vorlage wählen —</option>
            </select>
            <span id="ds-dirty-badge" class="hidden text-xs bg-hb-orange/10 text-hb-orange px-2 py-0.5 rounded-full font-semibold">Ungespeichert</span>
        </div>
        <div id="ds-editor-area" class="hidden">
            <!-- Splitscreen: Editor links, Preview rechts -->
            <div class="flex flex-col lg:flex-row gap-4" style="min-height: 700px;">
                <!-- Linke Spalte: Block-Editor -->
                <div class="lg:w-1/2 flex flex-col gap-3">
                    <!-- Toolbar -->
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="_dsSave()" class="btn-primary text-xs px-4 py-2">Speichern</button>
                        <div class="relative">
                            <button onclick="_dsToggleAddMenu()" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-2 rounded-lg hover:bg-gray-100 font-semibold border border-hb-olive/20">
                                + Block hinzufügen
                            </button>
                            <div id="ds-add-menu" class="hidden absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 w-48"></div>
                        </div>
                        <label class="flex items-center gap-2 text-xs text-gray-500 ml-auto cursor-pointer">
                            <input type="checkbox" id="ds-use-letterhead" checked onchange="_dsMarkDirty(); _dsSchedulePreview();">
                            Briefbogen anzeigen
                        </label>
                    </div>

                    <!-- Variablen-Palette -->
                    <div id="ds-vars-palette" class="card p-3 hidden">
                        <p class="text-xs font-bold text-gray-500 mb-2">Verfügbare Variablen <span class="font-normal text-gray-400">(klicken zum Einfügen)</span></p>
                        <div id="ds-vars-chips" class="flex flex-wrap gap-1.5"></div>
                    </div>

                    <!-- Block-Liste -->
                    <div id="ds-block-list" class="flex-1 overflow-y-auto space-y-2 pr-1" style="max-height: calc(700px - 100px);"></div>
                </div>

                <!-- Rechte Spalte: Live-Preview -->
                <div class="lg:w-1/2 card flex flex-col" style="min-height: 700px;">
                    <div class="bg-hb-olive px-4 py-2.5 flex items-center justify-between">
                        <span class="text-sm font-bold text-white">Vorschau</span>
                        <span id="ds-preview-status" class="text-xs text-white/60">Bereit</span>
                    </div>
                    <div class="flex-1 bg-gray-100 p-3 flex items-start justify-center overflow-auto">
                        <embed id="ds-preview-embed" type="application/pdf" class="bg-white shadow-lg" style="width: 100%; height: 100%; min-height: 600px;">
                    </div>
                </div>
            </div>
        </div>
        <div id="ds-empty-state" class="card p-10 text-center">
            <p class="text-gray-400 text-sm">Wähle oben eine Vorlage aus, um den Designer zu starten.</p>
            <p class="text-gray-300 text-xs mt-2">Vorlagen werden aus der Datenbank geladen (Tabelle pdf_templates).</p>
        </div>
    `;

    // Templates aus DB laden
    const { data: templates } = await _supabase.from('pdf_templates').select('type, name').order('name');
    const sel = document.getElementById('ds-template-select');
    if (templates?.length) {
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.type;
            opt.textContent = t.name;
            sel.appendChild(opt);
        });
    }
}

// ─── Template laden ──────────────────────────────────────────
async function _dsLoadTemplate(type) {
    if (!type) {
        document.getElementById('ds-editor-area').classList.add('hidden');
        document.getElementById('ds-empty-state').classList.remove('hidden');
        _designerState = null;
        return;
    }

    const { data: tpl, error } = await _supabase
        .from('pdf_templates').select('*').eq('type', type).single();
    if (error || !tpl) {
        showToast('Vorlage konnte nicht geladen werden.', 'error');
        return;
    }

    _designerState = {
        template: tpl,
        blocks: Array.isArray(tpl.content) ? JSON.parse(JSON.stringify(tpl.content)) : [],
        dirty: false,
        previewTimer: null,
    };

    document.getElementById('ds-editor-area').classList.remove('hidden');
    document.getElementById('ds-empty-state').classList.add('hidden');
    document.getElementById('ds-use-letterhead').checked = tpl.use_letterhead !== false;

    // Variablen-Palette füllen
    _dsRenderVarsPalette(type);

    // Block-Liste rendern
    _dsRenderBlocks();

    // Initiale Preview
    _dsSchedulePreview();
}

// ─── Variablen-Palette ───────────────────────────────────────
function _dsRenderVarsPalette(type) {
    const vars = (typeof PDF_TEMPLATE_VARIABLES !== 'undefined' && PDF_TEMPLATE_VARIABLES[type]) || [];
    const palette = document.getElementById('ds-vars-palette');
    const chips = document.getElementById('ds-vars-chips');

    if (!vars.length) { palette.classList.add('hidden'); return; }
    palette.classList.remove('hidden');

    chips.innerHTML = vars.map(v =>
        `<button onclick="_dsInsertVar('${v.key}')" title="${v.label}"
            class="text-xs bg-hb-olive/10 text-hb-olive px-2 py-1 rounded-md hover:bg-hb-olive/20 font-mono transition-colors">
            {{${v.key}}}
        </button>`
    ).join('');
}

// Variable in das aktuell fokussierte Textfeld einfügen
function _dsInsertVar(key) {
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') && focused.closest('#ds-block-list')) {
        const start = focused.selectionStart;
        const end = focused.selectionEnd;
        const val = focused.value;
        const insert = `{{${key}}}`;
        focused.value = val.substring(0, start) + insert + val.substring(end);
        focused.selectionStart = focused.selectionEnd = start + insert.length;
        focused.focus();
        // Trigger update
        focused.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        // Kein fokussiertes Feld — in Zwischenablage kopieren
        navigator.clipboard.writeText(`{{${key}}}`).then(() => {
            showToast(`{{${key}}} kopiert — in ein Textfeld einfügen.`);
        });
    }
}

// ─── Block-Liste rendern ─────────────────────────────────────
function _dsRenderBlocks() {
    if (!_designerState) return;
    const list = document.getElementById('ds-block-list');
    const blocks = _designerState.blocks;

    list.innerHTML = blocks.map((b, i) => _dsBlockHtml(b, i)).join('');

    // Drag & Drop Setup
    list.querySelectorAll('.ds-block').forEach(el => {
        el.addEventListener('dragstart', _dsDragStart);
        el.addEventListener('dragover', _dsDragOver);
        el.addEventListener('drop', _dsDrop);
        el.addEventListener('dragend', _dsDragEnd);
    });
}

function _dsBlockHtml(block, idx) {
    const typeLabel = (_BLOCK_TYPES.find(t => t.type === block.type) || {}).label || block.type;
    const typeIcon  = (_BLOCK_TYPES.find(t => t.type === block.type) || {}).icon || '?';

    let bodyHtml = '';

    switch (block.type) {
    case 'heading':
        bodyHtml = `
            <div class="flex gap-2 items-center mt-2">
                <input type="text" value="${_escAttr(block.text || '')}" oninput="_dsUpdateBlock(${idx}, 'text', this.value)"
                    placeholder="Überschrift..." class="flex-1 text-sm">
                <select onchange="_dsUpdateBlock(${idx}, 'size', Number(this.value))" class="w-20 text-xs">
                    ${[9,10,11,12,13,14,16].map(s => `<option value="${s}" ${block.size === s ? 'selected' : ''}>${s}pt</option>`).join('')}
                </select>
                <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                    <input type="checkbox" ${block.bold !== false ? 'checked' : ''} onchange="_dsUpdateBlock(${idx}, 'bold', this.checked)"> Fett
                </label>
            </div>`;
        break;

    case 'text':
        bodyHtml = `
            <div class="mt-2">
                <textarea rows="2" oninput="_dsUpdateBlock(${idx}, 'text', this.value)"
                    placeholder="Text eingeben..." class="text-sm w-full" style="min-height:50px">${_escHtml(block.text || '')}</textarea>
                <div class="flex gap-2 items-center mt-1">
                    <select onchange="_dsUpdateBlock(${idx}, 'size', Number(this.value))" class="w-20 text-xs">
                        ${[8,9,10,11,12].map(s => `<option value="${s}" ${block.size === s ? 'selected' : ''}>${s}pt</option>`).join('')}
                    </select>
                    <label class="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" ${block.bold ? 'checked' : ''} onchange="_dsUpdateBlock(${idx}, 'bold', this.checked)"> Fett
                    </label>
                    <select onchange="_dsUpdateBlock(${idx}, 'color', this.value)" class="w-24 text-xs">
                        <option value="" ${!block.color ? 'selected' : ''}>Standard</option>
                        <option value="gray" ${block.color === 'gray' ? 'selected' : ''}>Grau</option>
                        <option value="olive" ${block.color === 'olive' ? 'selected' : ''}>Olive</option>
                        <option value="orange" ${block.color === 'orange' ? 'selected' : ''}>Orange</option>
                    </select>
                </div>
            </div>`;
        break;

    case 'spacer':
        bodyHtml = `
            <div class="flex items-center gap-2 mt-2">
                <label class="text-xs text-gray-500">Höhe:</label>
                <input type="number" min="1" max="200" value="${block.height || 10}" class="w-20 text-xs"
                    oninput="_dsUpdateBlock(${idx}, 'height', Number(this.value))">
                <span class="text-xs text-gray-400">pt</span>
            </div>`;
        break;

    case 'page_break':
        bodyHtml = `<p class="text-xs text-gray-400 mt-1">Erzwingt einen Seitenumbruch an dieser Stelle.</p>`;
        break;

    case 'hint_box':
        bodyHtml = `
            <div class="mt-2 space-y-2">
                <input type="text" value="${_escAttr(block.title || '')}" oninput="_dsUpdateBlock(${idx}, 'title', this.value)"
                    placeholder="Titel (optional, z.B. 'Hinweis:')" class="text-sm w-full">
                <textarea rows="2" oninput="_dsUpdateBlock(${idx}, 'text', this.value)"
                    placeholder="Hinweis-Text..." class="text-sm w-full" style="min-height:50px">${_escHtml(block.text || '')}</textarea>
            </div>`;
        break;

    case 'table': {
        const source = block.source || '';
        const templateType = _designerState?.template?.type || '';
        const availTables = (typeof PDF_TEMPLATE_TABLES !== 'undefined' && PDF_TEMPLATE_TABLES[templateType]) || [];
        bodyHtml = `
            <div class="mt-2 space-y-2">
                <div class="flex gap-2 items-center">
                    <label class="text-xs text-gray-500">Datenquelle:</label>
                    <select onchange="_dsUpdateBlock(${idx}, 'source', this.value)" class="w-48 text-xs">
                        <option value="">— wählen —</option>
                        ${availTables.map(t => `<option value="${t.key}" ${source === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-2 items-center">
                    <label class="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" ${block.show_header !== false ? 'checked' : ''} onchange="_dsUpdateBlock(${idx}, 'show_header', this.checked)"> Kopfzeile
                    </label>
                    <label class="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" ${block.highlight_last ? 'checked' : ''} onchange="_dsUpdateBlock(${idx}, 'highlight_last', this.checked)"> Letzte Zeile hervorheben
                    </label>
                </div>
                <p class="text-xs text-gray-400">Spalten werden automatisch aus der Datenquelle übernommen.</p>
            </div>`;
        break;
    }
    }

    return `
        <div class="ds-block card p-3 cursor-grab hover:shadow-md transition-shadow" draggable="true" data-idx="${idx}">
            <div class="flex items-center gap-2">
                <span class="text-xs w-6 h-6 flex items-center justify-center bg-hb-olive/10 text-hb-olive rounded font-bold flex-shrink-0">${typeIcon}</span>
                <span class="text-xs font-semibold text-gray-600 flex-1">${typeLabel}</span>
                <button onclick="_dsMoveBlock(${idx}, -1)" title="Nach oben" class="text-gray-400 hover:text-hb-olive p-1 min-h-[28px] min-w-[28px] flex items-center justify-center"${idx === 0 ? ' disabled' : ''}>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                </button>
                <button onclick="_dsMoveBlock(${idx}, 1)" title="Nach unten" class="text-gray-400 hover:text-hb-olive p-1 min-h-[28px] min-w-[28px] flex items-center justify-center"${idx === _designerState.blocks.length - 1 ? ' disabled' : ''}>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button onclick="_dsRemoveBlock(${idx})" title="Löschen" class="text-gray-400 hover:text-hb-orange p-1 min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            ${bodyHtml}
        </div>
    `;
}

// ─── Block-Operationen ───────────────────────────────────────
function _dsUpdateBlock(idx, key, value) {
    if (!_designerState) return;
    _designerState.blocks[idx][key] = value;
    _dsMarkDirty();
    _dsSchedulePreview();
}

function _dsMoveBlock(idx, dir) {
    if (!_designerState) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= _designerState.blocks.length) return;
    const blocks = _designerState.blocks;
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    _dsMarkDirty();
    _dsRenderBlocks();
    _dsSchedulePreview();
}

function _dsRemoveBlock(idx) {
    if (!_designerState) return;
    _designerState.blocks.splice(idx, 1);
    _dsMarkDirty();
    _dsRenderBlocks();
    _dsSchedulePreview();
}

function _dsAddBlock(type) {
    if (!_designerState) return;
    const defaults = {
        heading:    { type: 'heading', text: '', size: 11, bold: true },
        text:       { type: 'text', text: '', size: 10, bold: false },
        spacer:     { type: 'spacer', height: 15 },
        page_break: { type: 'page_break' },
        hint_box:   { type: 'hint_box', text: '', title: 'Hinweis:', size: 8 },
        table:      { type: 'table', source: '', columns: [], show_header: true, highlight_last: false },
    };
    _designerState.blocks.push(defaults[type] || { type });
    _dsMarkDirty();
    _dsRenderBlocks();
    _dsSchedulePreview();

    // Scroll zum neuen Block
    const list = document.getElementById('ds-block-list');
    setTimeout(() => list.scrollTop = list.scrollHeight, 50);

    // Menü schließen
    document.getElementById('ds-add-menu').classList.add('hidden');
}

function _dsToggleAddMenu() {
    const menu = document.getElementById('ds-add-menu');
    if (menu.classList.contains('hidden')) {
        menu.innerHTML = _BLOCK_TYPES.map(t =>
            `<button onclick="_dsAddBlock('${t.type}')" class="w-full text-left px-3 py-2 text-sm hover:bg-hb-ultralight flex items-center gap-2">
                <span class="w-5 h-5 flex items-center justify-center bg-hb-olive/10 text-hb-olive rounded text-xs font-bold">${t.icon}</span>
                ${t.label}
            </button>`
        ).join('');
        menu.classList.remove('hidden');
        // Click-Outside schließen
        setTimeout(() => document.addEventListener('click', _dsCloseAddMenu, { once: true }), 10);
    } else {
        menu.classList.add('hidden');
    }
}

function _dsCloseAddMenu(e) {
    const menu = document.getElementById('ds-add-menu');
    if (menu && !menu.contains(e?.target)) menu.classList.add('hidden');
}

// ─── Dirty-State ─────────────────────────────────────────────
function _dsMarkDirty() {
    if (!_designerState) return;
    _designerState.dirty = true;
    const badge = document.getElementById('ds-dirty-badge');
    if (badge) badge.classList.remove('hidden');
}

// ─── Drag & Drop ─────────────────────────────────────────────
let _dsDragIdx = null;

function _dsDragStart(e) {
    _dsDragIdx = Number(e.currentTarget.dataset.idx);
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function _dsDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('ring-2', 'ring-hb-olive/30');
}

function _dsDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-hb-olive/30');
    const targetIdx = Number(e.currentTarget.dataset.idx);
    if (_dsDragIdx == null || _dsDragIdx === targetIdx) return;

    const blocks = _designerState.blocks;
    const [moved] = blocks.splice(_dsDragIdx, 1);
    blocks.splice(targetIdx, 0, moved);
    _dsMarkDirty();
    _dsRenderBlocks();
    _dsSchedulePreview();
}

function _dsDragEnd(e) {
    e.currentTarget.style.opacity = '';
    _dsDragIdx = null;
    document.querySelectorAll('.ds-block').forEach(el => el.classList.remove('ring-2', 'ring-hb-olive/30'));
}

// ─── Speichern ───────────────────────────────────────────────
async function _dsSave() {
    if (!_designerState) return;
    const tpl = _designerState.template;
    const useLetterhead = document.getElementById('ds-use-letterhead')?.checked ?? true;

    const { error } = await _supabase.from('pdf_templates').update({
        content: _designerState.blocks,
        use_letterhead: useLetterhead,
        updated_at: new Date().toISOString(),
    }).eq('id', tpl.id);

    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }

    _designerState.dirty = false;
    const badge = document.getElementById('ds-dirty-badge');
    if (badge) badge.classList.add('hidden');

    // Cache invalidieren
    _pdfClearTemplateCache(tpl.type);

    showToast('Vorlage gespeichert.');
}

// ─── Live-Preview (Debounced) ────────────────────────────────
function _dsSchedulePreview() {
    if (!_designerState) return;
    if (_designerState.previewTimer) clearTimeout(_designerState.previewTimer);
    const status = document.getElementById('ds-preview-status');
    if (status) status.textContent = 'Aktualisiere...';
    _designerState.previewTimer = setTimeout(_dsRenderPreview, 600);
}

async function _dsRenderPreview() {
    if (!_designerState) return;
    const status = document.getElementById('ds-preview-status');

    try {
        if (typeof PDFLib === 'undefined') {
            if (status) status.textContent = 'PDF-Bibliothek nicht geladen';
            return;
        }

        const { PDFDocument, rgb } = PDFLib;
        const blocks = _designerState.blocks;
        const templateType = _designerState.template.type;
        const dummy = (typeof PDF_PREVIEW_DUMMY_DATA !== 'undefined' && PDF_PREVIEW_DUMMY_DATA[templateType]) || { placeholders: {}, tables: {} };
        const useLetterhead = document.getElementById('ds-use-letterhead')?.checked ?? true;
        const settings = window._settingsData || {};

        // PDF-Dokument erstellen
        let pdfDoc, page, templateDoc = null;

        if (useLetterhead && settings.letterhead_pdf_url) {
            try {
                const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 60);
                if (sd?.signedUrl) {
                    const resp = await fetch(sd.signedUrl);
                    if (resp.ok) {
                        const templateBytes = await resp.arrayBuffer();
                        templateDoc = await PDFDocument.load(templateBytes);
                        pdfDoc = await PDFDocument.create();
                        const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
                        page = pdfDoc.addPage(copied);
                    }
                }
            } catch (e) { /* Fallback: leere Seite */ }
        }

        if (!pdfDoc) {
            pdfDoc = await PDFDocument.create();
            page = pdfDoc.addPage([595.28, 841.89]); // A4
        }

        // Fonts laden
        let fonts;
        try {
            pdfDoc.registerFontkit(fontkit);
            fonts = await _pdfLoadInterFonts(pdfDoc);
        } catch (_) {
            const { StandardFonts } = PDFLib;
            const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            fonts = { reg, semi: reg, bold };
        }

        const { height } = page.getSize();

        // DIN 5008 Elemente für Preview (Sender + Adresse + Datum)
        _pdfDrawSenderLine(page, fonts.reg, settings);
        _pdfDrawAddressField(page, fonts.reg,
            dummy.placeholders.empfaenger_name || 'Max Mustermann',
            dummy.placeholders.empfaenger_strasse || 'Musterstraße 12',
            dummy.placeholders.empfaenger_plz_ort || '12345 Berlin'
        );
        _pdfDrawDate(page, fonts.reg, settings);

        // Template-Blöcke rendern
        await generateFromTemplate(blocks, dummy.placeholders, dummy.tables, {
            pdfDoc, page, fonts, settings, templateDoc,
            startY: height - 200,
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const embed = document.getElementById('ds-preview-embed');
        if (embed) {
            // Alten Blob-URL freigeben
            if (embed._blobUrl) URL.revokeObjectURL(embed._blobUrl);
            embed.src = url;
            embed._blobUrl = url;
        }

        if (status) status.textContent = 'Aktuell';
    } catch (e) {
        console.error('Preview-Fehler:', e);
        if (status) status.textContent = 'Fehler: ' + e.message;
    }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────
function _escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
