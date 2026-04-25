// ============================================================
// HB-Mieterportal | mod-dokumente.js
// Dokumenten-Cloud — Upload, Vorschau, Listen- & Baumansicht
// ============================================================

// Dokument-Kategorien → definiert in config.js (DOC_CATEGORIES_*)
const KATEGORIEN_WEG       = DOC_CATEGORIES_WEG;
const KATEGORIEN_MIET      = DOC_CATEGORIES_MIET;
const KATEGORIEN_ALLGEMEIN = DOC_CATEGORIES_ALLGEMEIN;
const ALLE_KATEGORIEN      = DOC_CATEGORIES_ALL;

// SVG-Icons (wiederverwendet)
const _DICO_EYE     = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
const _DICO_DL      = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;
const _DICO_CHECK   = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
const _DICO_CHEVRON = `<svg class="w-4 h-4 flex-shrink-0 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;

let _docsState = {
    category:     null,
    buildingId:   null,
    showArchived: false,
    viewMode:     'list',   // 'list' | 'tree'
    data:         [],
    buildings:    [],
    apartments:   [],
    profiles:     [],
    readDocIds:   new Set(),
    stagingFiles: [],       // [{ file, title }]
    treeOpen:     new Set(),
};

// Typ-sicherer Lookup
const _docsById = (id) => _docsState.data.find(d => d.id == id);

// ─── Entry Point ───────────────────────────────────────────────
async function loadDocuments() {
    const role      = userProfile?.role;
    const canUpload = role === 'admin' || role === 'manager';
    const canTree   = role === 'admin' || role === 'manager';

    document.getElementById('content-area').innerHTML = `
        <div class="flex justify-between items-end mb-6 text-left">
            <div>
                <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Dokumenten Cloud</h2>
                <p class="text-sm text-gray-500 mt-1">Dokumente zentral verwalten und bereitstellen.</p>
            </div>
            <div class="flex items-center gap-3">
                ${canTree ? `
                <div class="flex gap-1 bg-gray-100 rounded-xl p-1" id="docs-view-toggle">
                    <button id="docs-view-list-btn" onclick="_docsSetView('list')" title="Listenansicht"
                        class="p-2 rounded-lg transition-colors bg-white text-hb-olive shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                    </button>
                    <button id="docs-view-tree-btn" onclick="_docsSetView('tree')" title="Baumansicht"
                        class="p-2 rounded-lg transition-colors text-gray-400 hover:text-hb-olive">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="5" r="2" stroke-width="2"/><circle cx="5" cy="19" r="2" stroke-width="2"/><circle cx="19" cy="12" r="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7v10M5 12h12"/></svg>
                    </button>
                </div>` : ''}
                ${canUpload ? `
                <button onclick="_openUploadModal()" class="btn-primary flex items-center gap-2 text-sm shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Hochladen
                </button>` : ''}
            </div>
        </div>
        <div id="docs-view-container" class="text-left"></div>`;

    await _loadDocsInit();
}

// ─── Init ──────────────────────────────────────────────────────
async function _loadDocsInit() {
    _docsState.category     = null;
    _docsState.buildingId   = null;
    _docsState.showArchived = false;

    const [bldRes, aptRes, profRes, docsData, readsRes] = await Promise.all([
        _supabase.from('buildings').select('id, name, file_number, street, house_number').order('name'),
        _supabase.from('apartments').select('id, building_id, apartment_number').order('apartment_number'),
        _supabase.from('profiles').select('id, full_name, email').order('full_name'),
        _fetchDocs(),
        _supabase.from('document_reads').select('document_id').eq('user_id', currentUser.id),
    ]);

    _docsState.buildings  = bldRes.data  || [];
    _docsState.apartments = aptRes.data  || [];
    _docsState.profiles   = profRes.data || [];
    _docsState.data       = docsData;
    _docsState.readDocIds = new Set((readsRes.data || []).map(r => r.document_id));

    _renderDocsView();
}

// ─── Daten laden ───────────────────────────────────────────────
async function _fetchDocs() {
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';
    let q = _supabase.from('documents')
        .select('id, title, document_title, original_filename, generated_filename, category, file_path, file_type, file_size, year, visibility_scope, status, is_deleted, building_id, apartment_id, uploaded_by, created_at, updated_at, buildings(name, file_number, street, house_number), profiles!uploaded_by(full_name)')
        .order('created_at', { ascending: false });

    if (!isAdmin)              q = q.neq('status', 'draft');
    if (!_docsState.showArchived) q = q.eq('is_deleted', false);
    if (_docsState.buildingId)    q = q.eq('building_id', _docsState.buildingId);

    const { data, error } = await q;
    if (error) { console.error('Dokumente laden:', error); return []; }
    return data || [];
}

// ─── View-Routing ──────────────────────────────────────────────
function _renderDocsView() {
    const container = document.getElementById('docs-view-container');
    if (!container) return;
    if (_docsState.viewMode === 'tree') {
        container.innerHTML = _buildTreeHtml();
        _attachTreeEvents();
    } else {
        container.innerHTML = _buildListHtml();
        _populateBuildingFilter();
        _renderDocsCategoryList();
        _renderDocsTable();
    }
}

window._docsSetView = (mode) => {
    _docsState.viewMode = mode;
    const listBtn = document.getElementById('docs-view-list-btn');
    const treeBtn = document.getElementById('docs-view-tree-btn');
    const on  = 'p-2 rounded-lg transition-colors bg-white text-hb-olive shadow-sm';
    const off = 'p-2 rounded-lg transition-colors text-gray-400 hover:text-hb-olive';
    if (listBtn) listBtn.className = mode === 'list' ? on : off;
    if (treeBtn) treeBtn.className = mode === 'tree' ? on : off;
    _renderDocsView();
};

// ─── LISTENANSICHT ─────────────────────────────────────────────
function _buildListHtml() {
    return `
        <div class="flex gap-5 items-start">
            <div class="w-60 flex-shrink-0 flex flex-col gap-3">
                <div class="card">
                    <div class="p-3 bg-hb-olive"><p class="text-xs font-bold text-white">Gebäude</p></div>
                    <div class="p-2">
                        <select id="docs-building-filter" onchange="_docsFilterBuilding(this.value)" class="w-full text-sm">
                            <option value="">Alle Gebäude</option>
                        </select>
                    </div>
                </div>
                <div class="card">
                    <div class="p-3 bg-hb-olive"><p class="text-xs font-bold text-white">Kategorien</p></div>
                    <div id="docs-category-list" class="py-1"></div>
                    <div class="border-t border-hb-olive/10 p-3">
                        <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
                            <input type="checkbox" id="docs-show-archived" onchange="_docsToggleArchived(this.checked)">
                            Archivierte anzeigen
                        </label>
                    </div>
                </div>
            </div>
            <div class="flex-grow min-w-0 card">
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
                                <th class="p-4">Gebäude / Einheit</th>
                                <th class="p-4">Jahr</th>
                                <th class="p-4">Hochgeladen</th>
                                <th class="p-4 text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody id="docs-table-body" class="text-sm divide-y divide-hb-olive/10">
                            <tr><td colspan="6" class="p-8 text-center text-gray-400">Lädt...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function _populateBuildingFilter() {
    const sel = document.getElementById('docs-building-filter');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    _docsState.buildings.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = formatBuildingName(b);
        if (_docsState.buildingId && b.id == _docsState.buildingId) opt.selected = true;
        sel.appendChild(opt);
    });
    if (_docsState.showArchived) {
        const cb = document.getElementById('docs-show-archived');
        if (cb) cb.checked = true;
    }
}

// Kategorie-Sidebar
function _renderDocsCategoryList() {
    const el = document.getElementById('docs-category-list');
    if (!el) return;

    const counts = {};
    _docsState.data.filter(d => d.status !== 'draft')
        .forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
    const total      = _docsState.data.filter(d => d.status !== 'draft').length;
    const draftCount = _docsState.data.filter(d => d.status === 'draft').length;

    const isAllActive = !_docsState.category;
    let html = `
        <button onclick="window._docsFilterCatIdx(-1)"
            class="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-50 transition-colors ${isAllActive ? 'bg-hb-olive/5 text-hb-olive font-bold' : 'text-gray-700'}">
            <span>Alle</span>
            <span class="text-xs rounded-md px-1.5 py-0.5 font-bold ${isAllActive ? 'bg-hb-olive text-white' : 'bg-gray-100 text-gray-500'}">${total}</span>
        </button>`;

    if (draftCount > 0) {
        const isDraft = _docsState.category === '__draft__';
        html += `
        <button onclick="window._docsFilterCatIdx(-2)"
            class="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-50 transition-colors ${isDraft ? 'bg-hb-orange/5 text-hb-orange font-bold' : 'text-gray-500'}">
            <span>Entwürfe</span>
            <span class="text-xs rounded-md px-1.5 py-0.5 font-bold ${isDraft ? 'bg-hb-orange text-white' : 'bg-hb-orange/10 text-hb-orange'}">${draftCount}</span>
        </button>`;
    }

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
            const cnt    = counts[cat] || 0;
            const idx    = ALLE_KATEGORIEN.indexOf(cat);
            const active = _docsState.category === cat;
            html += `
                <button onclick="window._docsFilterCatIdx(${idx})"
                    class="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-50 transition-colors ${active ? 'bg-hb-olive/5 text-hb-olive font-bold' : 'text-gray-700'}">
                    <span class="truncate pr-2">${cat}</span>
                    ${cnt > 0 ? `<span class="text-xs flex-shrink-0 rounded-md px-1.5 py-0.5 font-bold ${active ? 'bg-hb-olive text-white' : 'bg-gray-100 text-gray-500'}">${cnt}</span>` : ''}
                </button>`;
        });
    });
    el.innerHTML = html;
}

window._docsFilterCatIdx = (idx) => {
    if (idx === -1)      _docsState.category = null;
    else if (idx === -2) _docsState.category = '__draft__';
    else                 _docsState.category = ALLE_KATEGORIEN[idx];
    _renderDocsCategoryList();
    _renderDocsTable();
};

// Dokumenten-Tabelle
function _renderDocsTable() {
    const tbody = document.getElementById('docs-table-body');
    if (!tbody) return;

    let filtered = _docsState.data;
    if (_docsState.category === '__draft__')  filtered = filtered.filter(d => d.status === 'draft');
    else if (_docsState.category)             filtered = filtered.filter(d => d.category === _docsState.category && d.status !== 'draft');
    else                                      filtered = filtered.filter(d => d.status !== 'draft');

    const titleEl = document.getElementById('docs-list-title');
    const countEl = document.getElementById('docs-count');
    if (titleEl) titleEl.textContent = _docsState.category === '__draft__' ? 'Entwürfe' : (_docsState.category || 'Alle Dokumente');
    if (countEl) countEl.textContent = `${filtered.length} Dokument${filtered.length !== 1 ? 'e' : ''}`;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400 text-sm">Keine Dokumente gefunden.</td></tr>';
        return;
    }

    const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'manager';

    tbody.innerHTML = filtered.map(d => {
        const isRead     = _docsState.readDocIds.has(d.id);
        const isArchived = d.is_deleted;
        const isDraft    = d.status === 'draft';
        const displayName = d.generated_filename || d.document_title || d.title;
        const sizeStr    = d.file_size ? _formatFileSize(d.file_size) : '';
        const dateStr    = d.created_at ? new Date(d.created_at).toLocaleDateString('de-DE') : '—';
        const bldName    = d.buildings?.name || '—';
        const apt        = d.apartment_id ? _docsState.apartments.find(a => a.id == d.apartment_id) : null;
        const location   = apt ? `${bldName} / ${apt.apartment_number}` : bldName;
        const uploader   = d.profiles?.full_name || '—';

        const actionBtns = isDraft && canEdit
            ? `<button onclick="_publishDoc(${d.id})"
                    class="flex items-center gap-1.5 text-xs text-white bg-hb-olive px-3 py-1.5 rounded-lg hover:bg-hb-olive/80 transition-colors font-semibold">
                    ${_DICO_CHECK} Freigeben
                </button>`
            : `<div class="flex gap-1 justify-end">
                <button onclick="_openDocModal(${d.id})" title="Anzeigen"
                    class="p-2 text-hb-olive bg-hb-ultralight rounded-lg hover:bg-gray-100 transition-colors">${_DICO_EYE}</button>
                <button onclick="_downloadDoc(${d.id})" title="Herunterladen"
                    class="p-2 text-hb-olive bg-hb-ultralight rounded-lg hover:bg-gray-100 transition-colors">${_DICO_DL}</button>
               </div>`;

        return `
            <tr onclick="_openDocModal(${d.id})"
                class="hover:bg-gray-50 transition-colors cursor-pointer ${isArchived ? 'opacity-50' : ''}">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center flex-shrink-0 text-[10px] font-black">${_docsFileIcon(d.file_type)}</div>
                        <div>
                            <div class="font-semibold text-hb-offblack flex items-center gap-2">
                                ${displayName}
                                ${isDraft ? '<span class="text-[9px] font-black uppercase bg-hb-orange/10 text-hb-orange px-1.5 py-0.5 rounded">Entwurf</span>' : ''}
                                ${!isRead && !isDraft ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-hb-orange flex-shrink-0"></span>' : ''}
                                ${isArchived ? '<span class="text-[9px] font-black uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Archiv</span>' : ''}
                            </div>
                            ${d.original_filename && d.original_filename !== displayName
                                ? `<div class="text-[11px] text-gray-400 truncate max-w-[200px]">${d.original_filename}</div>`
                                : sizeStr ? `<div class="text-xs text-gray-400">${sizeStr}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="p-4 text-xs text-gray-600">${d.category || '—'}</td>
                <td class="p-4 text-xs text-gray-600">${location}</td>
                <td class="p-4 text-xs text-gray-600">${d.year || '—'}</td>
                <td class="p-4">
                    <div class="text-xs text-gray-600">${uploader}</div>
                    <div class="text-xs text-gray-400">${dateStr}</div>
                </td>
                <td class="p-4 text-right" onclick="event.stopPropagation()">${actionBtns}</td>
            </tr>`;
    }).join('');
    makeTableResponsive(tbody.closest('.card'));
}

// ─── BAUMANSICHT ───────────────────────────────────────────────
function _buildTreeHtml() {
    const docs = _docsState.data.filter(d => d.status !== 'draft');

    // Baum aufbauen: building_id → apartment_id → category → docs[]
    const tree = new Map();
    docs.forEach(d => {
        const bk = d.building_id ?? '__none__';
        if (!tree.has(bk)) tree.set(bk, new Map());
        const ak = d.apartment_id ?? '__bld__';
        if (!tree.get(bk).has(ak)) tree.get(bk).set(ak, new Map());
        const cat = d.category || 'Sonstiges';
        if (!tree.get(bk).get(ak).has(cat)) tree.get(bk).get(ak).set(cat, []);
        tree.get(bk).get(ak).get(cat).push(d);
    });

    if (!tree.size) return `<div class="card p-8 text-center text-gray-400 text-sm">Keine Dokumente vorhanden.</div>`;

    let html = `<div class="card">`;

    tree.forEach((byApt, bk) => {
        const bld     = _docsState.buildings.find(b => b.id == bk);
        const bLabel  = bld ? `${bld.name}${bld.file_number ? ' · ' + bld.file_number : ''}` : 'Ohne Gebäude';
        const bNodeKey = `b:${bk}`;
        const bOpen   = _docsState.treeOpen.has(bNodeKey);
        const total   = [...byApt.values()].reduce((s, byCat) => s + [...byCat.values()].reduce((s2, d) => s2 + d.length, 0), 0);

        html += `
            <div class="border-b border-hb-olive/10 last:border-0">
                <button data-tnode="${bNodeKey}"
                    class="docs-tree-btn w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                    <span class="${bOpen ? 'rotate-90' : ''} transition-transform duration-150 inline-block">${_DICO_CHEVRON}</span>
                    <svg class="w-4 h-4 text-hb-olive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                    <span class="font-bold text-hb-offblack text-sm flex-grow">${bLabel}</span>
                    <span class="text-xs text-gray-400 mr-2">${total} Dok.</span>
                </button>`;

        if (bOpen) {
            byApt.forEach((byCat, ak) => {
                const apt      = ak === '__bld__' ? null : _docsState.apartments.find(a => a.id == ak);
                const aLabel   = apt ? `Einheit ${apt.apartment_number}` : 'Gebäude-Ebene';
                const aNodeKey = `a:${ak}`;
                const aOpen    = _docsState.treeOpen.has(aNodeKey);
                const aTotal   = [...byCat.values()].reduce((s, d) => s + d.length, 0);

                html += `
                    <div class="border-t border-gray-50">
                        <button data-tnode="${aNodeKey}"
                            class="docs-tree-btn w-full flex items-center gap-3 pl-14 pr-5 py-3 hover:bg-gray-50 transition-colors text-left">
                            <span class="${aOpen ? 'rotate-90' : ''} transition-transform duration-150 inline-block text-gray-300">${_DICO_CHEVRON}</span>
                            <span class="text-xs font-bold text-gray-600 flex-grow">${aLabel}</span>
                            <span class="text-xs text-gray-400">${aTotal}</span>
                        </button>`;

                if (aOpen) {
                    byCat.forEach((docList, cat) => {
                        const cNodeKey = `c:${ak}:${ALLE_KATEGORIEN.indexOf(cat)}`;
                        const cOpen    = _docsState.treeOpen.has(cNodeKey);

                        html += `
                            <div>
                                <button data-tnode="${cNodeKey}"
                                    class="docs-tree-btn w-full flex items-center gap-3 pl-24 pr-5 py-2.5 hover:bg-gray-50 transition-colors text-left">
                                    <span class="${cOpen ? 'rotate-90' : ''} transition-transform duration-150 inline-block text-gray-200">${_DICO_CHEVRON}</span>
                                    <span class="text-xs text-gray-500 flex-grow">${cat}</span>
                                    <span class="text-[10px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-bold">${docList.length}</span>
                                </button>`;

                        if (cOpen) {
                            docList.forEach(d => {
                                const isRead  = _docsState.readDocIds.has(d.id);
                                const dName   = d.generated_filename || d.document_title || d.title;
                                html += `
                                    <div class="flex items-center gap-3 pl-32 pr-5 py-2.5 hover:bg-gray-50 border-t border-gray-50 transition-colors">
                                        <div class="w-7 h-7 rounded-md bg-hb-olive/10 text-hb-olive flex items-center justify-center flex-shrink-0 text-[9px] font-black">${_docsFileIcon(d.file_type)}</div>
                                        <div class="flex-grow min-w-0">
                                            <div class="text-sm font-semibold text-hb-offblack truncate flex items-center gap-1.5">
                                                ${dName}
                                                ${!isRead ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-hb-orange flex-shrink-0"></span>' : ''}
                                            </div>
                                            ${d.file_size ? `<div class="text-[11px] text-gray-400">${_formatFileSize(d.file_size)}</div>` : ''}
                                        </div>
                                        <div class="flex gap-1 flex-shrink-0">
                                            <button onclick="_openDocModal(${d.id})" title="Anzeigen"
                                                class="p-1.5 text-hb-olive bg-hb-ultralight rounded-lg hover:bg-gray-100 transition-colors">${_DICO_EYE}</button>
                                            <button onclick="_downloadDoc(${d.id})" title="Herunterladen"
                                                class="p-1.5 text-hb-olive bg-hb-ultralight rounded-lg hover:bg-gray-100 transition-colors">${_DICO_DL}</button>
                                        </div>
                                    </div>`;
                            });
                        }
                        html += `</div>`;
                    });
                }
                html += `</div>`;
            });
        }
        html += `</div>`;
    });

    html += `</div>`;
    return html;
}

function _attachTreeEvents() {
    document.querySelectorAll('.docs-tree-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const key = btn.dataset.tnode;
            _docsState.treeOpen.has(key) ? _docsState.treeOpen.delete(key) : _docsState.treeOpen.add(key);
            _renderDocsView();
        });
    });
}

// ─── Filter-Handler ────────────────────────────────────────────
window._docsFilterBuilding = async (bid) => {
    _docsState.buildingId = bid || null;
    _docsState.data = await _fetchDocs();
    _renderDocsView();
};
window._docsToggleArchived = async (val) => {
    _docsState.showArchived = val;
    _docsState.data = await _fetchDocs();
    _renderDocsView();
};

// ─── Dokument freigeben (mit Auto-Naming) ──────────────────────
window._publishDoc = async (docId) => {
    const doc = _docsById(docId);
    if (!doc) return;

    const bld = _docsState.buildings.find(b => b.id == doc.building_id);
    const apt = _docsState.apartments.find(a => a.id == doc.apartment_id);

    const docTitle  = doc.document_title || doc.title;
    const parts     = [bld?.file_number, apt?.apartment_number].filter(Boolean).join(' ');
    const ext       = _docsFileExt(doc.file_type);
    const generated = (parts ? `${parts} - ${docTitle}` : docTitle) + (ext ? `.${ext}` : '');

    const { error } = await _supabase.from('documents').update({
        status: 'active',
        generated_filename: generated,
        updated_at: new Date().toISOString(),
    }).eq('id', Number(docId));

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    // E-Mail-Benachrichtigung (fire & forget)
    sendNotification('document_released', { document_id: docId, building_id: doc.building_id, title: docTitle });

    showToast(`Freigegeben als: ${generated}`, 'success');
    _docsState.data = await _fetchDocs();
    _renderDocsView();
    window.refreshNavBadges?.();
};

// ─── Detail-Modal ──────────────────────────────────────────────
window._openDocModal = async (docId) => {
    const doc = _docsById(docId);
    if (!doc) return;

    if (doc.status !== 'draft') _markDocRead(doc.id);

    const isPdf = (doc.file_type || '').toLowerCase().includes('pdf');
    let signedUrl = null;
    if (doc.file_path) {
        const { data } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
        signedUrl = data?.signedUrl || null;
    }

    const canEdit    = userProfile?.role === 'admin' || userProfile?.role === 'manager';
    const displayName = doc.generated_filename || doc.document_title || doc.title;

    const modal = showModal('doc-detail-modal', `
            <div class="p-5 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div>
                    <h2 class="text-lg font-extrabold text-hb-offblack leading-tight">${displayName}</h2>
                    <p class="text-xs text-gray-400 mt-0.5">${[doc.category, doc.year, doc.buildings?.name].filter(Boolean).join(' · ')}</p>
                    ${doc.original_filename && doc.original_filename !== displayName
                        ? `<p class="text-[11px] text-gray-300 mt-0.5">Originaldatei: ${doc.original_filename}</p>` : ''}
                </div>
                <div class="flex gap-2 items-center ml-4 flex-shrink-0">
                    ${signedUrl ? `<a href="${signedUrl}" download="${displayName}" onclick="_markDocRead(${doc.id})" class="btn-primary text-xs px-3 py-1.5">Download</a>` : ''}
                    ${canEdit ? `
                        <button onclick="hideModal('doc-detail-modal'); _openDocEditModal(${doc.id})"
                            class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100">Bearbeiten</button>
                        <button onclick="_archiveDoc(${doc.id})"
                            class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5">${doc.is_deleted ? 'Wiederherstellen' : 'Archivieren'}</button>` : ''}
                    <button onclick="hideModal('doc-detail-modal')"
                        class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none ml-1">✕</button>
                </div>
            </div>
            <div class="flex-grow overflow-hidden min-h-0">
                ${isPdf && signedUrl
                    ? `<iframe src="${signedUrl}" class="w-full h-full" style="min-height:500px;" frameborder="0"></iframe>`
                    : `<div class="p-10 text-center text-gray-400">
                           <div class="text-5xl mb-4">${_docsFileIcon(doc.file_type)}</div>
                           <p class="text-sm mb-3">Vorschau nicht verfügbar.</p>
                           ${signedUrl ? `<a href="${signedUrl}" download="${displayName}" class="text-hb-olive text-sm hover:underline">Datei herunterladen</a>` : ''}
                       </div>`}
            </div>
    `, { maxWidth: 'max-w-3xl' });
};

// ─── Read-Tracking ─────────────────────────────────────────────
async function _markDocRead(docId) {
    const id = Number(docId);
    if (_docsState.readDocIds.has(id)) return;
    _docsState.readDocIds.add(id);
    await _supabase.from('document_reads').upsert(
        { document_id: id, user_id: currentUser.id, read_at: new Date().toISOString() },
        { onConflict: 'document_id,user_id' }
    );
    _renderDocsView();
    window.refreshNavBadges?.();
}
window._markDocRead = _markDocRead;

// ─── Download ──────────────────────────────────────────────────
window._downloadDoc = async (docId) => {
    const doc = _docsById(docId);
    if (!doc?.file_path) { showToast('Kein Dateipfad hinterlegt.', 'error'); return; }
    const { data, error } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (error || !data?.signedUrl) { showToast('Download-Link konnte nicht erstellt werden.', 'error'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = doc.generated_filename || doc.document_title || doc.title;
    a.click();
    _markDocRead(doc.id);
};

// ─── Archivieren ───────────────────────────────────────────────
window._archiveDoc = async (docId) => {
    const doc = _docsById(docId);
    if (!doc) return;
    const toArchive = !doc.is_deleted;
    const { error } = await _supabase.from('documents').update({
        is_deleted: toArchive,
        deleted_at: toArchive ? new Date().toISOString() : null,
    }).eq('id', Number(docId));
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('doc-detail-modal');
    showToast(toArchive ? 'Archiviert.' : 'Wiederhergestellt.', 'success');
    _docsState.data = await _fetchDocs();
    _renderDocsView();
};

// ─── Bearbeiten-Modal ──────────────────────────────────────────
window._openDocEditModal = async (docId) => {
    const doc = _docsById(docId);
    if (!doc) return;

    // document_links laden wenn person scope
    let currentLinks = [];
    if (doc.visibility_scope === 'person') {
        const { data } = await _supabase.from('document_links')
            .select('id, profile_id, profiles(full_name, email)')
            .eq('document_id', Number(docId));
        currentLinks = data || [];
    }

    const catOptions = ALLE_KATEGORIEN.map(c => `<option value="${c}" ${doc.category === c ? 'selected' : ''}>${c}</option>`).join('');
    const bldOptions = _docsState.buildings.map(b => `<option value="${b.id}" ${doc.building_id == b.id ? 'selected' : ''}>${formatBuildingName(b)}</option>`).join('');
    const aptOptions = _docsState.apartments
        .filter(a => !doc.building_id || a.building_id == doc.building_id)
        .map(a => `<option value="${a.id}" ${doc.apartment_id == a.id ? 'selected' : ''}>${a.apartment_number}</option>`).join('');
    const curYear = new Date().getFullYear();
    let yearOptions = '<option value="">—</option>';
    for (let y = curYear + 1; y >= curYear - 10; y--) {
        yearOptions += `<option value="${y}" ${doc.year == y ? 'selected' : ''}>${y}</option>`;
    }

    const linksHtml = doc.visibility_scope === 'person' ? `
        <div>
            <label class="block text-xs font-bold text-gray-500 mb-2">Verknüpfte Personen</label>
            <div class="space-y-1 max-h-28 overflow-y-auto mb-2">
                ${currentLinks.length
                    ? currentLinks.map(l => `
                        <div class="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                            <span>${l.profiles?.full_name || '—'}</span>
                            <button onclick="_removeDocLink(${l.id}, ${docId})" class="text-hb-orange hover:opacity-70">✕</button>
                        </div>`).join('')
                    : '<p class="text-xs text-gray-400 py-1">Keine Personen verknüpft.</p>'}
            </div>
            <select id="doc-edit-add-person" class="w-full text-sm">
                <option value="">Person hinzufügen…</option>
                ${_docsState.profiles
                    .filter(p => !currentLinks.find(l => l.profile_id === p.id))
                    .map(p => `<option value="${p.id}">${p.full_name}${p.email ? ' · ' + p.email : ''}</option>`).join('')}
            </select>
            <button onclick="_addDocLink(${docId})" class="mt-2 text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 w-full">Person verknüpfen</button>
        </div>` : '';

    const modal = showModal('doc-edit-modal', `
            <div class="p-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <h2 class="text-base font-extrabold text-hb-offblack">Dokument bearbeiten</h2>
                <button onclick="hideModal('doc-edit-modal')"
                    class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Dokumententitel</label>
                    <input type="text" id="doc-edit-title" value="${doc.document_title || doc.title || ''}">
                    ${doc.original_filename ? `<p class="text-[11px] text-gray-400 mt-1">Originaldatei: ${doc.original_filename}</p>` : ''}
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Kategorie</label>
                    <select id="doc-edit-category">${catOptions}</select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Gebäude</label>
                        <select id="doc-edit-building"><option value="">—</option>${bldOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Einheit</label>
                        <select id="doc-edit-apartment"><option value="">—</option>${aptOptions}</select>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Jahr</label>
                        <select id="doc-edit-year">${yearOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Sichtbarkeit</label>
                        <select id="doc-edit-scope">
                            <option value="global"   ${doc.visibility_scope === 'global'   ? 'selected' : ''}>Global</option>
                            <option value="building" ${doc.visibility_scope === 'building' ? 'selected' : ''}>Gebäude</option>
                            <option value="unit"     ${doc.visibility_scope === 'unit'     ? 'selected' : ''}>Einheit</option>
                            <option value="person"   ${doc.visibility_scope === 'person'   ? 'selected' : ''}>Person</option>
                        </select>
                    </div>
                </div>
                ${linksHtml}
            </div>
            <div class="p-5 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                <button onclick="hideModal('doc-edit-modal')"
                    class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_saveDocEdit(${doc.id})"
                    class="btn-primary text-sm px-4 py-2">Speichern</button>
            </div>
    `, { maxWidth: 'max-w-md' });
};

window._saveDocEdit = async (docId) => {
    const title      = document.getElementById('doc-edit-title')?.value.trim();
    const category   = document.getElementById('doc-edit-category')?.value;
    const buildingId = document.getElementById('doc-edit-building')?.value || null;
    const apartmentId= document.getElementById('doc-edit-apartment')?.value || null;
    const year       = parseInt(document.getElementById('doc-edit-year')?.value) || null;
    const scope      = document.getElementById('doc-edit-scope')?.value || 'global';
    if (!title) { showToast('Titel ist erforderlich.', 'error'); return; }
    const { error } = await _supabase.from('documents').update({
        document_title: title, title, category,
        building_id: buildingId, apartment_id: apartmentId,
        year, visibility_scope: scope, updated_at: new Date().toISOString(),
    }).eq('id', Number(docId));
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('doc-edit-modal');
    showToast('Gespeichert.', 'success');
    _docsState.data = await _fetchDocs();
    _renderDocsView();
};

// document_links verwalten
window._addDocLink = async (docId) => {
    const profileId = document.getElementById('doc-edit-add-person')?.value;
    if (!profileId) return;
    const { error } = await _supabase.from('document_links').insert({ document_id: Number(docId), profile_id: profileId });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    hideModal('doc-edit-modal');
    _openDocEditModal(docId);
};
window._removeDocLink = async (linkId, docId) => {
    await _supabase.from('document_links').delete().eq('id', linkId);
    hideModal('doc-edit-modal');
    _openDocEditModal(docId);
};

// ─── Upload-Modal ──────────────────────────────────────────────
window._openUploadModal = () => {
    _docsState.stagingFiles = [];

    const catOptions = ALLE_KATEGORIEN.map(c => `<option value="${c}">${c}</option>`).join('');
    const bldOptions = _docsState.buildings.map(b => `<option value="${b.id}">${formatBuildingName(b)}</option>`).join('');
    const curYear    = new Date().getFullYear();
    let yearOpts = '';
    for (let y = curYear; y >= curYear - 5; y--) {
        yearOpts += `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`;
    }
    const profOptions = _docsState.profiles
        .map(p => `<option value="${p.id}">${p.full_name}${p.email ? ' · ' + p.email : ''}</option>`).join('');

    const modal = showModal('doc-upload-modal', `
            <div class="p-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <h2 class="text-base font-extrabold text-hb-offblack">Dokumente hochladen</h2>
                <button onclick="hideModal('doc-upload-modal')"
                    class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto">
                <!-- Drop-Zone -->
                <div id="doc-drop-zone"
                    ondragover="event.preventDefault(); this.classList.add('border-hb-olive','bg-hb-olive/5')"
                    ondragleave="this.classList.remove('border-hb-olive','bg-hb-olive/5')"
                    ondrop="_handleDocDrop(event)"
                    onclick="document.getElementById('doc-file-input').click()"
                    class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-hb-olive hover:bg-hb-olive/5 transition-colors">
                    <div class="text-3xl mb-1">📁</div>
                    <p class="text-sm text-gray-500">Dateien ablegen oder <span class="text-hb-olive font-semibold">hier klicken</span></p>
                    <p class="text-xs text-gray-400 mt-0.5">PDF, Word, Excel, Bilder — max. 20 MB</p>
                    <input type="file" id="doc-file-input" multiple class="hidden" onchange="_handleDocFileInput(this.files)">
                </div>
                <!-- Staging-Liste -->
                <div id="doc-upload-filelist" class="space-y-2 max-h-40 overflow-y-auto"></div>
                <!-- Kategorie -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Kategorie</label>
                    <select id="doc-upload-category">${catOptions}</select>
                </div>
                <!-- Gebäude (immer) -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Gebäude</label>
                    <select id="doc-upload-building" onchange="_docsUpdateScopeFields()">
                        <option value="">Kein Gebäude</option>${bldOptions}
                    </select>
                </div>
                <!-- Jahr + Sichtbarkeit -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Jahr</label>
                        <select id="doc-upload-year">${yearOpts}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Sichtbarkeit</label>
                        <select id="doc-upload-scope" onchange="_docsUpdateScopeFields()">
                            <option value="building">Gebäude</option>
                            <option value="unit">Einheit</option>
                            <option value="person">Person</option>
                        </select>
                    </div>
                </div>
                <!-- Einheit (unit / person) -->
                <div id="doc-scope-apt" class="hidden">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Einheit</label>
                    <select id="doc-upload-apartment">
                        <option value="">Einheit wählen</option>
                    </select>
                </div>
                <!-- Personen (person) -->
                <div id="doc-scope-persons" class="hidden">
                    <label class="block text-xs font-bold text-gray-500 mb-2">Personen</label>
                    <div class="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
                        ${_docsState.profiles.map(p => `
                            <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                <input type="checkbox" name="doc-person-link" value="${p.id}">
                                <span class="text-xs flex-grow">${p.full_name}</span>
                                <span class="text-[11px] text-gray-400">${p.email || ''}</span>
                            </label>`).join('')}
                    </div>
                </div>
                <!-- Entwurf -->
                <label class="flex items-start gap-3 p-3 bg-hb-orange/5 rounded-xl cursor-pointer border border-hb-orange/20">
                    <input type="checkbox" id="doc-upload-draft" class="flex-shrink-0 mt-0.5">
                    <div>
                        <span class="text-xs font-bold text-hb-orange">Als Entwurf speichern</span>
                        <p class="text-[11px] text-gray-500 mt-0.5">Erst prüfen, dann manuell freigeben. Beim Freigeben wird der Dateiname automatisch generiert.</p>
                    </div>
                </label>
            </div>
            <div class="p-5 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                <button onclick="hideModal('doc-upload-modal')"
                    class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button id="doc-upload-btn" onclick="_doUploadDocs()"
                    class="btn-primary text-sm px-4 py-2">Hochladen</button>
            </div>
    `, { maxWidth: 'max-w-lg' });
};

// Kaskadierendes Scope-UI
window._docsUpdateScopeFields = () => {
    const scope     = document.getElementById('doc-upload-scope')?.value;
    const buildingId = document.getElementById('doc-upload-building')?.value;
    const aptDiv    = document.getElementById('doc-scope-apt');
    const personDiv = document.getElementById('doc-scope-persons');
    if (aptDiv)    aptDiv.classList.toggle('hidden',    scope === 'building');
    if (personDiv) personDiv.classList.toggle('hidden', scope !== 'person');

    // Einheiten-Dropdown befüllen
    if (scope !== 'building') {
        const sel  = document.getElementById('doc-upload-apartment');
        const apts = _docsState.apartments.filter(a => !buildingId || a.building_id == buildingId);
        if (sel) sel.innerHTML = `<option value="">Einheit wählen</option>` +
            apts.map(a => `<option value="${a.id}">${a.apartment_number}</option>`).join('');
    }
};

// ─── Drag & Drop ───────────────────────────────────────────────
window._handleDocDrop = (e) => {
    e.preventDefault();
    document.getElementById('doc-drop-zone')?.classList.remove('border-hb-olive', 'bg-hb-olive/5');
    _addDocsToStaging(Array.from(e.dataTransfer.files));
};
window._handleDocFileInput = (files) => _addDocsToStaging(Array.from(files));

function _addDocsToStaging(newFiles) {
    newFiles.forEach(f => _docsState.stagingFiles.push({
        file:  f,
        title: f.name.replace(/\.[^/.]+$/, ''), // Titel ohne Extension
    }));
    _renderStagingList();
}

function _renderStagingList() {
    const list = document.getElementById('doc-upload-filelist');
    if (!list) return;
    if (!_docsState.stagingFiles.length) { list.innerHTML = ''; return; }
    list.innerHTML = _docsState.stagingFiles.map((item, i) => `
        <div class="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
            <div class="flex items-center gap-2 text-xs">
                <span class="w-8 h-8 rounded-lg bg-hb-olive/10 text-hb-olive flex items-center justify-center font-black text-[9px] flex-shrink-0">${_docsFileIcon(item.file.type)}</span>
                <span class="flex-grow text-gray-400 truncate">${item.file.name}</span>
                <span class="text-gray-300 flex-shrink-0">${_formatFileSize(item.file.size)}</span>
                <button onclick="_removeDocStaging(${i})" class="text-hb-orange hover:opacity-70 font-bold ml-1 flex-shrink-0">✕</button>
            </div>
            <div>
                <input type="text" id="doc-staging-title-${i}" value="${item.title}"
                    oninput="_docsState.stagingFiles[${i}].title = this.value"
                    placeholder="Dokumententitel"
                    class="text-sm" style="height:34px;">
            </div>
        </div>`
    ).join('');
}

window._removeDocStaging = (idx) => {
    _docsState.stagingFiles.splice(idx, 1);
    _renderStagingList();
};

// ─── Upload ausführen ──────────────────────────────────────────
window._doUploadDocs = async () => {
    if (!_docsState.stagingFiles.length) { showToast('Bitte Dateien auswählen.', 'error'); return; }

    const category   = document.getElementById('doc-upload-category')?.value;
    const buildingId = document.getElementById('doc-upload-building')?.value || null;
    const aptId      = document.getElementById('doc-upload-apartment')?.value || null;
    const year       = parseInt(document.getElementById('doc-upload-year')?.value) || null;
    const scope      = document.getElementById('doc-upload-scope')?.value || 'building';
    const asDraft    = document.getElementById('doc-upload-draft')?.checked || false;
    const personIds  = scope === 'person'
        ? [...document.querySelectorAll('input[name="doc-person-link"]:checked')].map(cb => cb.value)
        : [];

    const btn = document.getElementById('doc-upload-btn');
    if (btn) { btn.textContent = 'Lädt hoch…'; btn.disabled = true; }

    let ok = 0, fail = 0;

    for (const item of _docsState.stagingFiles) {
        const { file, title } = item;
        const ext        = file.name.split('.').pop();
        const safeName   = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = buildingId ? `${buildingId}/${safeName}` : `global/${safeName}`;

        const { error: upErr } = await _supabase.storage
            .from('documents').upload(storagePath, file, { cacheControl: '3600', upsert: false });
        if (upErr) { console.error('Upload:', upErr); fail++; continue; }

        const { data: dbRow, error: dbErr } = await _supabase.from('documents').insert({
            title:             title,
            document_title:    title,
            original_filename: file.name,
            category,
            file_path:         storagePath,
            file_type:         file.type || ext,
            file_size:         file.size,
            year,
            visibility_scope:  scope,
            building_id:       buildingId,
            apartment_id:      aptId || null,
            uploaded_by:       currentUser.id,
            status:            asDraft ? 'draft' : 'active',
            is_deleted:        false,
        }).select('id').single();

        if (dbErr) { console.error('DB:', dbErr); fail++; continue; }
        ok++;

        // document_links für person scope
        if (!asDraft && scope === 'person' && personIds.length && dbRow?.id) {
            await _supabase.from('document_links').insert(
                personIds.map(pid => ({ document_id: dbRow.id, profile_id: pid }))
            );
        }
    }

    hideModal('doc-upload-modal');
    if (ok)   showToast(`${ok} Dokument${ok > 1 ? 'e' : ''} ${asDraft ? 'als Entwurf gespeichert' : 'hochgeladen'}.`, 'success');
    if (fail) showToast(`${fail} Datei${fail > 1 ? 'en' : ''} fehlgeschlagen.`, 'error');

    _docsState.data = await _fetchDocs();
    _renderDocsView();
    window.refreshNavBadges?.();
};

// ─── Nav-Badge ─────────────────────────────────────────────────
async function _loadDocsNavBadge() {
    const { data: allDocs } = await _supabase.from('documents').select('id').eq('status', 'active').eq('is_deleted', false);
    const { data: reads }   = await _supabase.from('document_reads').select('document_id').eq('user_id', currentUser.id);
    const readSet = new Set((reads || []).map(r => r.document_id));
    _setNavBadge('nav-badge-docs', (allDocs || []).filter(d => !readSet.has(d.id)).length);
}
window._loadDocsNavBadge = _loadDocsNavBadge;

// ─── Hilfsfunktionen ───────────────────────────────────────────
function _docsFileIcon(fileType) {
    const t = (fileType || '').toLowerCase();
    if (t.includes('pdf'))                                                return 'PDF';
    if (t.includes('word') || t.includes('doc'))                         return 'DOC';
    if (t.includes('excel') || t.includes('sheet') || t.includes('xls')) return 'XLS';
    if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg')) return 'IMG';
    if (t.includes('zip') || t.includes('rar'))                          return 'ZIP';
    return 'DAT';
}

function _docsFileExt(fileType) {
    const t = (fileType || '').toLowerCase();
    if (t.includes('pdf'))                                                return 'pdf';
    if (t.includes('word') || t.includes('docx'))                        return 'docx';
    if (t.includes('excel') || t.includes('sheet') || t.includes('xlsx')) return 'xlsx';
    return '';
}

function _formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024)    return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
