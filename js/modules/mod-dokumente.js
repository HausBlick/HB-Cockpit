// ============================================================
// HB-Mieterportal | mod-dokumente.js
// Modul: Dokumenten-Cloud — Upload, Vorschau, Kategorien
// ============================================================

const KATEGORIEN_WEG = [
    'Protokolle & Beschlüsse',
    'Jahresabrechnung & Wirtschaftsplan',
    'Verträge & Versicherungen',
    'Technische Unterlagen',
    'Grundbuch & Teilungserklärung',
    'Ausschreibungen & Angebote',
    'Wartung & Prüfberichte',
    'Eigentümerversammlung',
    'Finanzen & Rechnungen',
    'Sonstiges WEG',
];
const KATEGORIEN_MIET      = ['Mietverträge', 'Wohnungsübergabe'];
const KATEGORIEN_ALLGEMEIN = ['Allgemein'];
const ALLE_KATEGORIEN      = [...KATEGORIEN_WEG, ...KATEGORIEN_MIET, ...KATEGORIEN_ALLGEMEIN];

// Kategorie-Index-Lookup (für onclick ohne Escape-Probleme)
window._docsCatByIndex = (idx) => idx === -1 ? null : ALLE_KATEGORIEN[idx];

let _docsState = {
    category:     null,
    buildingId:   null,
    showArchived: false,
    data:         [],
    buildings:    [],
    readDocIds:   new Set(),
    stagingFiles: [],
};

// ─── Entry Point ───────────────────────────────────────────────
async function loadDocuments() {
    const container = document.getElementById('content-area');
    const role = userProfile?.role;
    const canUpload = role === 'admin' || role === 'manager';

    container.innerHTML = `
        <div class="flex justify-between items-end mb-6 text-left">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-offblack tracking-tight">Dokumenten Cloud</h2>
                <p class="text-sm text-gray-500 mt-1">Dokumente zentral verwalten und bereitstellen.</p>
            </div>
            ${canUpload ? `
            <button onclick="_openUploadModal()" class="btn-primary flex items-center gap-2 text-sm shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Hochladen
            </button>` : ''}
        </div>
        <div class="flex gap-5 items-start text-left">
            <!-- Kategorie-Sidebar -->
            <div class="w-60 flex-shrink-0 flex flex-col gap-3">
                <div class="card">
                    <div class="p-3 bg-hb-olive">
                        <p class="text-xs font-bold text-white">Gebäude</p>
                    </div>
                    <div class="p-2">
                        <select id="docs-building-filter" onchange="_docsFilterBuilding(this.value)"
                            class="w-full text-sm">
                            <option value="">Alle Gebäude</option>
                        </select>
                    </div>
                </div>
                <div class="card">
                    <div class="p-3 bg-hb-olive">
                        <p class="text-xs font-bold text-white">Kategorien</p>
                    </div>
                    <div id="docs-category-list" class="py-1">
                        <div class="px-3 py-2 text-sm text-gray-400">Lädt...</div>
                    </div>
                    <div class="border-t border-hb-olive/10 p-3">
                        <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
                            <input type="checkbox" id="docs-show-archived" onchange="_docsToggleArchived(this.checked)">
                            Archivierte anzeigen
                        </label>
                    </div>
                </div>
            </div>
            <!-- Hauptbereich -->
            <div class="flex-grow min-w-0">
                <div class="card">
                    <div class="p-4 bg-hb-olive flex justify-between items-center">
                        <p class="text-sm font-bold text-white" id="docs-list-title">Alle Dokumente</p>
                        <span id="docs-count" class="text-xs text-white/70"></span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead>
                                <tr class="bg-gray-50 text-xs font-bold text-gray-500 border-b border-gray-100">
                                    <th class="p-4">Dokument</th>
                                    <th class="p-4">Kategorie</th>
                                    <th class="p-4">Gebäude</th>
                                    <th class="p-4">Jahr</th>
                                    <th class="p-4">Hochgeladen</th>
                                    <th class="p-4 text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody id="docs-table-body" class="text-sm divide-y divide-hb-olive/10">
                                <tr><td colspan="6" class="p-8 text-center text-gray-400">Lädt...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

    await _loadDocsInit();
}

// ─── Init ──────────────────────────────────────────────────────
async function _loadDocsInit() {
    _docsState.category     = null;
    _docsState.buildingId   = null;
    _docsState.showArchived = false;

    const [buildingsRes, docsData, readsRes] = await Promise.all([
        _supabase.from('buildings').select('id, name').order('name'),
        _fetchDocs(),
        _supabase.from('document_reads').select('document_id').eq('user_id', currentUser.id),
    ]);

    _docsState.buildings  = buildingsRes.data || [];
    _docsState.data       = docsData;
    _docsState.readDocIds = new Set((readsRes.data || []).map(r => r.document_id));

    const sel = document.getElementById('docs-building-filter');
    if (sel) {
        _docsState.buildings.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            sel.appendChild(opt);
        });
    }

    _renderDocsCategoryList();
    _renderDocsTable();
}

// ─── Daten laden ───────────────────────────────────────────────
async function _fetchDocs() {
    let q = _supabase.from('documents')
        .select('id, title, category, file_path, file_type, file_size, year, visibility_scope, status, is_deleted, building_id, apartment_id, uploaded_by, created_at, updated_at, buildings(name), profiles!uploaded_by(full_name)')
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

    if (!_docsState.showArchived) q = q.eq('is_deleted', false);
    if (_docsState.buildingId)    q = q.eq('building_id', _docsState.buildingId);

    const { data, error } = await q;
    if (error) { console.error('Dokumente laden:', error); return []; }
    return data || [];
}

// ─── Kategorie-Sidebar ─────────────────────────────────────────
function _renderDocsCategoryList() {
    const el = document.getElementById('docs-category-list');
    if (!el) return;

    const counts = {};
    _docsState.data.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
    const total = _docsState.data.length;

    const isAllActive = !_docsState.category;
    let html = `
        <button onclick="window._docsFilterCatIdx(-1)"
            class="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-50 transition-colors
            ${isAllActive ? 'bg-hb-olive/5 text-hb-olive font-bold' : 'text-gray-700'}">
            <span>Alle</span>
            <span class="text-xs rounded-md px-1.5 py-0.5 font-bold ${isAllActive ? 'bg-hb-olive text-white' : 'bg-gray-100 text-gray-500'}">${total}</span>
        </button>`;

    const groups = [
        { label: 'WEG',       cats: KATEGORIEN_WEG },
        { label: 'Miet',      cats: KATEGORIEN_MIET },
        { label: 'Allgemein', cats: KATEGORIEN_ALLGEMEIN },
    ];

    groups.forEach(g => {
        const visible = g.cats.filter(c => counts[c] > 0 || _docsState.category === c);
        if (!visible.length) return;
        html += `<div class="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-wider text-gray-400">${g.label}</div>`;
        visible.forEach(cat => {
            const cnt = counts[cat] || 0;
            const idx = ALLE_KATEGORIEN.indexOf(cat);
            const isActive = _docsState.category === cat;
            html += `
                <button onclick="window._docsFilterCatIdx(${idx})"
                    class="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-50 transition-colors
                    ${isActive ? 'bg-hb-olive/5 text-hb-olive font-bold' : 'text-gray-700'}">
                    <span class="truncate pr-2">${cat}</span>
                    ${cnt > 0 ? `<span class="text-xs flex-shrink-0 rounded-md px-1.5 py-0.5 font-bold ${isActive ? 'bg-hb-olive text-white' : 'bg-gray-100 text-gray-500'}">${cnt}</span>` : ''}
                </button>`;
        });
    });

    el.innerHTML = html;
}

window._docsFilterCatIdx = (idx) => {
    _docsState.category = idx === -1 ? null : ALLE_KATEGORIEN[idx];
    _renderDocsCategoryList();
    _renderDocsTable();
};

// ─── Dokument-Tabelle ──────────────────────────────────────────
function _renderDocsTable() {
    const tbody = document.getElementById('docs-table-body');
    if (!tbody) return;

    const filtered = _docsState.category
        ? _docsState.data.filter(d => d.category === _docsState.category)
        : _docsState.data;

    const titleEl = document.getElementById('docs-list-title');
    const countEl = document.getElementById('docs-count');
    if (titleEl) titleEl.textContent = _docsState.category || 'Alle Dokumente';
    if (countEl) countEl.textContent = `${filtered.length} Dokument${filtered.length !== 1 ? 'e' : ''}`;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400 text-sm">Keine Dokumente gefunden.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(d => {
        const isRead     = _docsState.readDocIds.has(d.id);
        const isArchived = d.is_deleted;
        const iconLabel  = _docsFileIcon(d.file_type);
        const sizeStr    = d.file_size ? _formatFileSize(d.file_size) : '';
        const dateStr    = d.created_at ? new Date(d.created_at).toLocaleDateString('de-DE') : '—';
        const building   = d.buildings?.name || '—';
        const uploader   = d.profiles?.full_name || '—';

        return `
            <tr onclick="_openDocModal('${d.id}')"
                class="hover:bg-gray-50 transition-colors cursor-pointer ${isArchived ? 'opacity-50' : ''}">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center flex-shrink-0 text-[10px] font-black">${iconLabel}</div>
                        <div>
                            <div class="font-semibold text-hb-offblack flex items-center gap-2">
                                ${d.title}
                                ${!isRead ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-hb-orange flex-shrink-0"></span>' : ''}
                                ${isArchived ? '<span class="text-[9px] font-black uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Archiv</span>' : ''}
                            </div>
                            ${sizeStr ? `<div class="text-xs text-gray-400">${sizeStr}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="p-4 text-xs text-gray-600">${d.category || '—'}</td>
                <td class="p-4 text-xs text-gray-600">${building}</td>
                <td class="p-4 text-xs text-gray-600">${d.year || '—'}</td>
                <td class="p-4">
                    <div class="text-xs text-gray-600">${uploader}</div>
                    <div class="text-xs text-gray-400">${dateStr}</div>
                </td>
                <td class="p-4 text-right" onclick="event.stopPropagation()">
                    <button onclick="_downloadDoc('${d.id}')"
                        class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Download</button>
                </td>
            </tr>`;
    }).join('');
}

// ─── Filter-Handler ────────────────────────────────────────────
window._docsFilterBuilding = async (bid) => {
    _docsState.buildingId = bid || null;
    _docsState.data = await _fetchDocs();
    _renderDocsCategoryList();
    _renderDocsTable();
};

window._docsToggleArchived = async (val) => {
    _docsState.showArchived = val;
    _docsState.data = await _fetchDocs();
    _renderDocsCategoryList();
    _renderDocsTable();
};

// ─── Dokument-Detail-Modal ─────────────────────────────────────
window._openDocModal = async (docId) => {
    const doc = _docsState.data.find(d => d.id === docId);
    if (!doc) return;

    _markDocRead(docId);

    const isPdf = (doc.file_type || '').toLowerCase().includes('pdf');
    let signedUrl = null;
    if (doc.file_path) {
        const { data } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
        signedUrl = data?.signedUrl || null;
    }

    const role = userProfile?.role;
    const canEdit = role === 'admin' || role === 'manager';

    document.getElementById('doc-detail-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'doc-detail-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col text-left" onclick="event.stopPropagation()">
            <div class="p-5 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div>
                    <h2 class="text-lg font-extrabold text-hb-offblack leading-tight">${doc.title}</h2>
                    <p class="text-xs text-gray-400 mt-0.5">${[doc.category, doc.year, doc.buildings?.name].filter(Boolean).join(' · ')}</p>
                </div>
                <div class="flex gap-2 items-center ml-4 flex-shrink-0">
                    ${signedUrl ? `
                        <a href="${signedUrl}" download="${doc.title}"
                            onclick="_markDocRead('${docId}')"
                            class="btn-primary text-xs px-3 py-1.5">Download</a>` : ''}
                    ${canEdit ? `
                        <button onclick="document.getElementById('doc-detail-modal').remove(); _openDocEditModal('${docId}')"
                            class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Bearbeiten</button>
                        <button onclick="_archiveDoc('${docId}')"
                            class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 transition-colors">${doc.is_deleted ? 'Wiederherstellen' : 'Archivieren'}</button>` : ''}
                    <button onclick="document.getElementById('doc-detail-modal').remove()"
                        class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none ml-1">✕</button>
                </div>
            </div>
            <div class="flex-grow overflow-hidden min-h-0">
                ${isPdf && signedUrl
                    ? `<iframe src="${signedUrl}" class="w-full h-full" style="min-height:500px;" frameborder="0"></iframe>`
                    : `<div class="p-10 text-center text-gray-400">
                           <div class="text-5xl mb-4">${_docsFileIcon(doc.file_type)}</div>
                           <p class="text-sm mb-3">Vorschau nicht verfügbar.</p>
                           ${signedUrl ? `<a href="${signedUrl}" download="${doc.title}" class="text-hb-olive text-sm hover:underline">Datei herunterladen</a>` : '<p class="text-xs text-gray-300">Kein Dateipfad hinterlegt.</p>'}
                       </div>`}
            </div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

// ─── Read-Tracking ─────────────────────────────────────────────
async function _markDocRead(docId) {
    if (_docsState.readDocIds.has(docId)) return;
    _docsState.readDocIds.add(docId);
    await _supabase.from('document_reads').upsert(
        { document_id: docId, user_id: currentUser.id, read_at: new Date().toISOString() },
        { onConflict: 'document_id,user_id' }
    );
    _renderDocsTable();
    window.refreshNavBadges?.();
}
window._markDocRead = _markDocRead;

// ─── Download ──────────────────────────────────────────────────
window._downloadDoc = async (docId) => {
    const doc = _docsState.data.find(d => d.id === docId);
    if (!doc?.file_path) { showToast('Kein Dateipfad hinterlegt.', 'error'); return; }

    const { data, error } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (error || !data?.signedUrl) { showToast('Download-Link konnte nicht erstellt werden.', 'error'); return; }

    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = doc.title;
    a.click();
    _markDocRead(docId);
};

// ─── Archivieren ───────────────────────────────────────────────
window._archiveDoc = async (docId) => {
    const doc = _docsState.data.find(d => d.id === docId);
    if (!doc) return;
    const toArchive = !doc.is_deleted;

    const { error } = await _supabase.from('documents').update({
        is_deleted: toArchive,
        deleted_at: toArchive ? new Date().toISOString() : null,
    }).eq('id', docId);

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    document.getElementById('doc-detail-modal')?.remove();
    showToast(toArchive ? 'Dokument archiviert.' : 'Dokument wiederhergestellt.', 'success');
    _docsState.data = await _fetchDocs();
    _renderDocsCategoryList();
    _renderDocsTable();
};

// ─── Bearbeiten-Modal ──────────────────────────────────────────
window._openDocEditModal = (docId) => {
    const doc = _docsState.data.find(d => d.id === docId);
    if (!doc) return;

    const catOptions  = ALLE_KATEGORIEN.map(c => `<option value="${c}" ${doc.category === c ? 'selected' : ''}>${c}</option>`).join('');
    const bldOptions  = _docsState.buildings.map(b => `<option value="${b.id}" ${doc.building_id === b.id ? 'selected' : ''}>${b.name}</option>`).join('');
    const curYear     = new Date().getFullYear();
    let   yearOptions = '<option value="">—</option>';
    for (let y = curYear + 1; y >= curYear - 10; y--) {
        yearOptions += `<option value="${y}" ${doc.year === y ? 'selected' : ''}>${y}</option>`;
    }

    document.getElementById('doc-edit-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'doc-edit-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-md flex flex-col text-left" onclick="event.stopPropagation()">
            <div class="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 class="text-base font-extrabold text-hb-offblack">Dokument bearbeiten</h2>
                <button onclick="document.getElementById('doc-edit-modal').remove()"
                    class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-5 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Titel</label>
                    <input type="text" id="doc-edit-title" value="${doc.title || ''}">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Kategorie</label>
                    <select id="doc-edit-category">${catOptions}</select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Gebäude</label>
                        <select id="doc-edit-building"><option value="">Kein Gebäude</option>${bldOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Jahr</label>
                        <select id="doc-edit-year">${yearOptions}</select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Sichtbarkeit</label>
                    <select id="doc-edit-scope">
                        <option value="global"   ${doc.visibility_scope === 'global'   ? 'selected' : ''}>Global (alle)</option>
                        <option value="building" ${doc.visibility_scope === 'building' ? 'selected' : ''}>Gebäude</option>
                        <option value="apartment"${doc.visibility_scope === 'apartment'? 'selected' : ''}>Einheit</option>
                    </select>
                </div>
            </div>
            <div class="p-5 border-t border-gray-100 flex justify-end gap-3">
                <button onclick="document.getElementById('doc-edit-modal').remove()"
                    class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_saveDocEdit('${docId}')"
                    class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

window._saveDocEdit = async (docId) => {
    const title      = document.getElementById('doc-edit-title')?.value.trim();
    const category   = document.getElementById('doc-edit-category')?.value;
    const buildingId = document.getElementById('doc-edit-building')?.value || null;
    const year       = parseInt(document.getElementById('doc-edit-year')?.value) || null;
    const scope      = document.getElementById('doc-edit-scope')?.value || 'global';

    if (!title) { showToast('Titel ist erforderlich.', 'error'); return; }

    const { error } = await _supabase.from('documents').update({
        title, category, building_id: buildingId, year,
        visibility_scope: scope, updated_at: new Date().toISOString(),
    }).eq('id', docId);

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('doc-edit-modal')?.remove();
    showToast('Dokument gespeichert.', 'success');
    _docsState.data = await _fetchDocs();
    _renderDocsCategoryList();
    _renderDocsTable();
};

// ─── Upload-Modal ──────────────────────────────────────────────
window._openUploadModal = () => {
    document.getElementById('doc-upload-modal')?.remove();
    _docsState.stagingFiles = [];

    const catOptions = ALLE_KATEGORIEN.map(c => `<option value="${c}">${c}</option>`).join('');
    const bldOptions = _docsState.buildings.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    const curYear    = new Date().getFullYear();
    let   yearOpts   = '';
    for (let y = curYear; y >= curYear - 5; y--) {
        yearOpts += `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`;
    }

    const modal = document.createElement('div');
    modal.id = 'doc-upload-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-md flex flex-col text-left" onclick="event.stopPropagation()">
            <div class="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 class="text-base font-extrabold text-hb-offblack">Dokumente hochladen</h2>
                <button onclick="document.getElementById('doc-upload-modal').remove()"
                    class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-5 space-y-4">
                <div id="doc-drop-zone"
                    ondragover="event.preventDefault(); this.classList.add('border-hb-olive','bg-hb-olive/5')"
                    ondragleave="this.classList.remove('border-hb-olive','bg-hb-olive/5')"
                    ondrop="_handleDocDrop(event)"
                    onclick="document.getElementById('doc-file-input').click()"
                    class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-hb-olive hover:bg-hb-olive/5 transition-colors">
                    <div class="text-3xl mb-2">📁</div>
                    <p class="text-sm text-gray-500">Dateien ablegen oder <span class="text-hb-olive font-semibold">hier klicken</span></p>
                    <p class="text-xs text-gray-400 mt-1">PDF, Word, Excel, Bilder — max. 20 MB pro Datei</p>
                    <input type="file" id="doc-file-input" multiple class="hidden" onchange="_handleDocFileInput(this.files)">
                </div>
                <div id="doc-upload-filelist" class="space-y-2 max-h-32 overflow-y-auto"></div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Kategorie</label>
                    <select id="doc-upload-category">${catOptions}</select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Gebäude</label>
                        <select id="doc-upload-building"><option value="">Kein Gebäude</option>${bldOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Jahr</label>
                        <select id="doc-upload-year">${yearOpts}</select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Sichtbarkeit</label>
                    <select id="doc-upload-scope">
                        <option value="global">Global (alle)</option>
                        <option value="building">Gebäude</option>
                    </select>
                </div>
            </div>
            <div class="p-5 border-t border-gray-100 flex justify-end gap-3">
                <button onclick="document.getElementById('doc-upload-modal').remove()"
                    class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button id="doc-upload-btn" onclick="_doUploadDocs()"
                    class="btn-primary text-sm px-4 py-2">Hochladen</button>
            </div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

// ─── Drag & Drop ───────────────────────────────────────────────
window._handleDocDrop = (e) => {
    e.preventDefault();
    document.getElementById('doc-drop-zone')?.classList.remove('border-hb-olive', 'bg-hb-olive/5');
    _addDocsToStaging(Array.from(e.dataTransfer.files));
};
window._handleDocFileInput = (files) => _addDocsToStaging(Array.from(files));

function _addDocsToStaging(newFiles) {
    _docsState.stagingFiles.push(...newFiles);
    const list = document.getElementById('doc-upload-filelist');
    if (!list) return;
    list.innerHTML = _docsState.stagingFiles.map((f, i) => `
        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
            <span class="font-black text-hb-olive w-8 text-center">${_docsFileIcon(f.type)}</span>
            <span class="flex-grow truncate text-gray-700">${f.name}</span>
            <span class="text-gray-400 flex-shrink-0">${_formatFileSize(f.size)}</span>
            <button onclick="_removeDocStaging(${i})" class="text-hb-orange hover:opacity-70 font-bold ml-1">✕</button>
        </div>`
    ).join('');
}

window._removeDocStaging = (idx) => {
    _docsState.stagingFiles.splice(idx, 1);
    // Re-render list by calling with empty (no new files)
    const saved = [..._docsState.stagingFiles];
    _docsState.stagingFiles = [];
    _addDocsToStaging(saved);
};

// ─── Upload ausführen ──────────────────────────────────────────
window._doUploadDocs = async () => {
    if (!_docsState.stagingFiles.length) {
        showToast('Bitte Dateien auswählen.', 'error');
        return;
    }

    const category  = document.getElementById('doc-upload-category')?.value;
    const buildingId= document.getElementById('doc-upload-building')?.value || null;
    const year      = parseInt(document.getElementById('doc-upload-year')?.value) || null;
    const scope     = document.getElementById('doc-upload-scope')?.value || 'global';

    const btn = document.getElementById('doc-upload-btn');
    if (btn) { btn.textContent = 'Lädt hoch…'; btn.disabled = true; }

    let ok = 0, fail = 0;

    for (const file of _docsState.stagingFiles) {
        const ext       = file.name.split('.').pop();
        const safeName  = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const storagePath = buildingId ? `${buildingId}/${safeName}` : `global/${safeName}`;

        const { error: upErr } = await _supabase.storage
            .from('documents')
            .upload(storagePath, file, { cacheControl: '3600', upsert: false });

        if (upErr) { console.error('Upload-Fehler:', upErr); fail++; continue; }

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const { error: dbErr } = await _supabase.from('documents').insert({
            title:            baseName,
            category,
            file_path:        storagePath,
            file_type:        file.type || ext,
            file_size:        file.size,
            year,
            visibility_scope: scope,
            building_id:      buildingId,
            uploaded_by:      currentUser.id,
            status:           'active',
            is_deleted:       false,
        });

        if (dbErr) { console.error('DB-Fehler:', dbErr); fail++; } else { ok++; }
    }

    document.getElementById('doc-upload-modal')?.remove();
    if (ok)   showToast(`${ok} Dokument${ok > 1 ? 'e' : ''} hochgeladen.`, 'success');
    if (fail) showToast(`${fail} Datei${fail > 1 ? 'en' : ''} fehlgeschlagen.`, 'error');

    _docsState.data = await _fetchDocs();
    _renderDocsCategoryList();
    _renderDocsTable();
    window.refreshNavBadges?.();
};

// ─── Nav-Badge: ungelesene Dokumente ──────────────────────────
async function _loadDocsNavBadge() {
    const { data: allDocs } = await _supabase.from('documents')
        .select('id')
        .eq('status', 'active')
        .eq('is_deleted', false);

    const { data: reads } = await _supabase.from('document_reads')
        .select('document_id')
        .eq('user_id', currentUser.id);

    const readSet  = new Set((reads || []).map(r => r.document_id));
    const unread   = (allDocs || []).filter(d => !readSet.has(d.id)).length;
    _setNavBadge('nav-badge-docs', unread);
}
window._loadDocsNavBadge = _loadDocsNavBadge;

// ─── Hilfsfunktionen ───────────────────────────────────────────
function _docsFileIcon(fileType) {
    const t = (fileType || '').toLowerCase();
    if (t.includes('pdf'))                                          return 'PDF';
    if (t.includes('word') || t.includes('doc'))                   return 'DOC';
    if (t.includes('excel') || t.includes('sheet') || t.includes('xls')) return 'XLS';
    if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg')) return 'IMG';
    if (t.includes('zip') || t.includes('rar'))                    return 'ZIP';
    return 'DAT';
}

function _formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024)          return bytes + ' B';
    if (bytes < 1048576)       return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
