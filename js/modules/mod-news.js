// ============================================================
// HB-Mieterportal | mod-news.js
// Modul: Schwarzes Brett — News-Feed mit Like & Lese-Tracking
// ============================================================

let _newsData       = [];
let _newsLiked      = new Set();
let _newsRead       = new Set();
let _newsFilter     = 'Alle';
let _userBuildingId = null;

// ─── Haupteinstieg ────────────────────────────────────────────
async function loadNews() {
    const container = document.getElementById('content-area');
    const canCreate = ['admin', 'manager', 'owner'].includes(userProfile?.role);

    container.innerHTML = `
        <div class="flex justify-between items-end mb-6">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-offblack tracking-tight">Schwarzes Brett</h2>
                <p class="text-sm text-gray-500 mt-1">Ankündigungen, Wartungshinweise und Neuigkeiten.</p>
            </div>
            ${canCreate ? `<button onclick="showCreateNewsModal()"
                class="btn-primary flex items-center gap-2 text-sm shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>Neuer Beitrag</button>` : ''}
        </div>

        <!-- Filter-Chips -->
        <div class="flex flex-wrap gap-2 mb-6" id="news-filter-chips">
            ${['Alle','Ankündigung','Wartung','Allgemein'].map((c, i) =>
                `<button onclick="setNewsFilter('${c}')"
                    class="news-chip px-4 py-2 text-xs font-bold rounded-full border transition-colors
                        ${i === 0 ? 'bg-hb-offblack text-white border-hb-offblack' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}">${c}</button>`
            ).join('')}
        </div>

        <!-- Grid -->
        <div id="news-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <div class="col-span-full flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>`;

    await _loadNewsContext();
    await _loadLikedAndRead();
    await _fetchAndRenderNews();
}

async function _loadNewsContext() {
    if (!userProfile?.apartment_id) { _userBuildingId = null; return; }
    const { data } = await _supabase.from('apartments')
        .select('building_id').eq('id', userProfile.apartment_id).single();
    _userBuildingId = data?.building_id || null;
}

async function _loadLikedAndRead() {
    const [likedRes, readRes] = await Promise.all([
        _supabase.from('news_likes').select('news_id').eq('user_id', currentUser.id),
        _supabase.from('news_reads').select('news_id, read_at').eq('user_id', currentUser.id),
    ]);
    _newsLiked = new Set((likedRes.data || []).map(r => r.news_id));
    // Map: news_id → read_at (Date-Objekt oder null)
    _newsRead  = new Map((readRes.data || []).map(r => [r.news_id, r.read_at ? new Date(r.read_at) : new Date(0)]));
}

async function _fetchAndRenderNews() {
    const { data, error } = await _supabase.from('news')
        .select('*, author:profiles!news_author_id_fkey(id, full_name), buildings(name)')
        .order('created_at', { ascending: false });

    if (error) { showToast('Fehler beim Laden.', 'error'); return; }

    const role = userProfile?.role;
    _newsData = (data || []).filter(item => {
        if (role === 'admin' || role === 'manager') return true;
        if (item.visibility_scope === 'global') return true;
        if (item.visibility_scope === 'building' && item.building_id === _userBuildingId) return true;
        if (item.visibility_scope === 'unit' && item.apartment_id === userProfile?.apartment_id) return true;
        return false;
    });

    _renderGrid();
}

function _renderGrid() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    const filtered = _newsFilter === 'Alle'
        ? _newsData
        : _newsData.filter(n => n.category === _newsFilter);

    if (!filtered.length) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400 text-sm">Keine Beiträge vorhanden.</div>`;
        return;
    }
    grid.innerHTML = filtered.map(n => _newsCardHtml(n)).join('');
}

function _newsBadge(n) {
    const readAt    = _newsRead.get(n.id); // undefined = nie gelesen
    const updatedAt = n.updated_at ? new Date(n.updated_at) : null;
    const wasEdited = updatedAt && (updatedAt - new Date(n.created_at)) > 60_000;
    if (!readAt) return `<span class="absolute top-4 right-4 bg-hb-orange text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Neu</span>`;
    if (wasEdited && updatedAt > readAt) return `<span class="absolute top-4 right-4 bg-hb-olive text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Update</span>`;
    return '';
}

function _newsCardHtml(n) {
    const liked    = _newsLiked.has(n.id);
    const catColor = { Ankündigung: 'bg-hb-olive/10 text-hb-olive', Wartung: 'bg-hb-orange/10 text-hb-orange', Allgemein: 'bg-gray-100 text-gray-500' }[n.category] || 'bg-gray-100 text-gray-500';
    const preview  = (n.content || '').replace(/<[^>]+>/g, '').substring(0, 120);
    const date     = new Date(n.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
        <div onclick="openNewsModal(${n.id})"
            class="card p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3 text-left relative">
            ${_newsBadge(n)}
            <div class="flex items-center gap-2">
                <span class="${catColor} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">${n.category || 'Allgemein'}</span>
                ${n.buildings?.name ? `<span class="text-[10px] text-gray-400">${n.buildings.name}</span>` : ''}
            </div>
            <h3 class="font-extrabold text-hb-offblack text-base leading-snug pr-8">${n.title}</h3>
            <p class="text-sm text-gray-500 line-clamp-3 flex-grow">${preview}…</p>
            <div class="flex justify-between items-center pt-2 border-t border-gray-50 text-xs text-gray-400">
                <span>${n.author?.full_name || '—'} · ${date}</span>
                <button onclick="toggleNewsLike(event, ${n.id})"
                    class="flex items-center gap-1 hover:text-hb-orange transition-colors ${liked ? 'text-hb-orange' : ''}"
                    id="like-btn-${n.id}">
                    <svg class="w-4 h-4" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    <span id="like-count-${n.id}">${n.likes || 0}</span>
                </button>
            </div>
        </div>`;
}

// ─── Filter ───────────────────────────────────────────────────
window.setNewsFilter = (cat) => {
    _newsFilter = cat;
    document.querySelectorAll('.news-chip').forEach(el => {
        const active = el.textContent.trim() === cat;
        el.className = `news-chip px-4 py-2 text-xs font-bold rounded-full border transition-colors ${active
            ? 'bg-hb-offblack text-white border-hb-offblack'
            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`;
    });
    _renderGrid();
};

// ─── Modal: News lesen ────────────────────────────────────────
window.openNewsModal = async (newsId) => {
    const item = _newsData.find(n => n.id === newsId);
    if (!item) return;

    // Gelesen markieren (immer upsert mit aktuellem Timestamp → Update-Badge verschwindet)
    const now = new Date();
    await _supabase.from('news_reads').upsert({ news_id: newsId, user_id: currentUser.id, read_at: now.toISOString() });
    _newsRead.set(newsId, now);
    // Badge auf Karte entfernen
    const card = document.querySelector(`[onclick="openNewsModal(${newsId})"]`);
    card?.querySelector('.absolute.top-4.right-4')?.remove();

    const liked   = _newsLiked.has(newsId);
    const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'manager'
        || (userProfile?.role === 'owner' && item.author?.id === currentUser.id);
    const date    = new Date(item.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    const catColor = { Ankündigung: 'bg-blue-100 text-blue-700', Wartung: 'bg-hb-orange/10 text-hb-orange', Allgemein: 'bg-gray-100 text-gray-600' }[item.category] || 'bg-gray-100 text-gray-600';

    document.getElementById('news-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'news-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
            <div class="p-6 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div class="space-y-2">
                    <span class="${catColor} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">${item.category || 'Allgemein'}</span>
                    <h2 class="text-xl font-extrabold text-hb-offblack">${item.title}</h2>
                    <p class="text-xs text-gray-400">${item.author?.full_name || '—'} · ${date}
                        ${item.buildings?.name ? ` · ${item.buildings.name}` : ''}</p>
                </div>
                <div class="flex gap-2 items-center flex-shrink-0 ml-4">
                    ${canEdit ? `
                        <button onclick="showEditNewsModal(${newsId})"
                            class="text-xs text-hb-olive hover:text-hb-offblack font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100">Bearbeiten</button>
                        <button onclick="deleteNews(${newsId})"
                            class="text-xs text-red-400 hover:text-red-600 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">Löschen</button>` : ''}
                    <button onclick="document.getElementById('news-modal').remove()"
                        class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
                </div>
            </div>
            <div class="p-6 overflow-y-auto flex-grow text-sm text-gray-700 leading-relaxed
                        [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-3
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
                        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
                        [&_strong]:font-bold [&_em]:italic [&_p]:mb-2">${item.content || ''}</div>
            <div class="p-4 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button onclick="toggleNewsLike(event, ${newsId}, true)"
                    id="modal-like-btn-${newsId}"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors font-bold text-sm
                        ${liked ? 'border-hb-orange text-hb-orange bg-hb-orange/5' : 'border-gray-200 text-gray-500 hover:border-hb-orange hover:text-hb-orange'}">
                    <svg class="w-4 h-4" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    Gefällt mir (<span id="modal-like-count-${newsId}">${item.likes || 0}</span>)
                </button>
            </div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

// ─── Like Toggle (Optimistic UI) ──────────────────────────────
window.toggleNewsLike = async (e, newsId, fromModal = false) => {
    e.stopPropagation();
    const item    = _newsData.find(n => n.id === newsId);
    if (!item) return;
    const wasLiked = _newsLiked.has(newsId);
    const newCount = (item.likes || 0) + (wasLiked ? -1 : 1);

    // Optimistic update
    item.likes = newCount;
    if (wasLiked) { _newsLiked.delete(newsId); } else { _newsLiked.add(newsId); }
    _updateLikeUI(newsId, !wasLiked, newCount);

    // DB
    if (wasLiked) {
        await _supabase.from('news_likes').delete().match({ news_id: newsId, user_id: currentUser.id });
        await _supabase.from('news').update({ likes: newCount }).eq('id', newsId);
    } else {
        await _supabase.from('news_likes').upsert({ news_id: newsId, user_id: currentUser.id });
        await _supabase.from('news').update({ likes: newCount }).eq('id', newsId);
    }
};

function _updateLikeUI(newsId, liked, count) {
    [`like-btn-${newsId}`, `modal-like-btn-${newsId}`].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const svg   = btn.querySelector('svg');
        const countEl = btn.querySelector(`#like-count-${newsId}, #modal-like-count-${newsId}`);
        if (svg) svg.setAttribute('fill', liked ? 'currentColor' : 'none');
        if (countEl) countEl.textContent = count;
        btn.classList.toggle('text-hb-orange', liked);
        btn.classList.toggle('border-hb-orange', liked);
    });
}

// ─── News löschen ─────────────────────────────────────────────
window.deleteNews = async (newsId) => {
    if (!confirm('Beitrag wirklich löschen?')) return;
    const { error } = await _supabase.from('news').delete().eq('id', newsId);
    if (error) { showToast(error.message, 'error'); return; }
    document.getElementById('news-modal')?.remove();
    showToast('Beitrag gelöscht.', 'success');
    _newsData = _newsData.filter(n => n.id !== newsId);
    _renderGrid();
};

// ─── News bearbeiten ──────────────────────────────────────────
window.showEditNewsModal = async (newsId) => {
    const item = _newsData.find(n => n.id === newsId);
    if (!item) return;

    const { data: buildings } = await _supabase.from('buildings').select('id, name').order('name');
    const bList = buildings || [];
    const role  = userProfile?.role;

    document.getElementById('news-modal')?.remove();
    document.getElementById('edit-news-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'edit-news-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-2xl p-8 space-y-5" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-extrabold text-hb-offblack">Beitrag bearbeiten</h3>
                <button onclick="document.getElementById('edit-news-modal').remove()" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Titel *</label>
                <input type="text" id="edit_news_title" value="${item.title || ''}" placeholder="Betreff des Beitrags">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Kategorie</label>
                    <select id="edit_news_cat">
                        ${['Allgemein','Ankündigung','Wartung'].map(c => `<option value="${c}" ${item.category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Sichtbarkeit</label>
                    <select id="edit_news_scope" onchange="handleEditNewsScopeChange(this.value)">
                        ${role === 'admin' || role === 'manager' ? `<option value="global" ${item.visibility_scope==='global'?'selected':''}>Global</option>` : ''}
                        <option value="building" ${item.visibility_scope==='building'?'selected':''}>Gebäude</option>
                        ${role === 'owner' ? `<option value="unit" ${item.visibility_scope==='unit'?'selected':''}>Einheit</option>` : ''}
                    </select>
                </div>
            </div>
            <div id="edit_news_building_wrap" class="space-y-2 ${item.visibility_scope==='global'?'hidden':''}">
                <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude</label>
                <select id="edit_news_building_id">
                    <option value="">— Bitte wählen —</option>
                    ${bList.map(b => `<option value="${b.id}" ${item.building_id===b.id?'selected':''}>${b.name}</option>`).join('')}
                </select>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Inhalt *</label>
                <div class="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-200 rounded-t-lg border-b-0">
                    <button type="button" onclick="document.execCommand('bold')"
                        class="rte-btn w-7 h-7 rounded font-bold text-sm hover:bg-gray-200 transition-colors" title="Fett">B</button>
                    <button type="button" onclick="document.execCommand('italic')"
                        class="rte-btn w-7 h-7 rounded italic text-sm hover:bg-gray-200 transition-colors" title="Kursiv">I</button>
                    <div class="w-px bg-gray-200 mx-0.5 self-stretch"></div>
                    <button type="button" onclick="document.execCommand('formatBlock', false, 'h3')"
                        class="rte-btn px-2 h-7 rounded text-xs font-bold hover:bg-gray-200 transition-colors" title="Überschrift">H</button>
                    <button type="button" onclick="document.execCommand('formatBlock', false, 'p')"
                        class="rte-btn px-2 h-7 rounded text-xs hover:bg-gray-200 transition-colors" title="Normaler Text">¶</button>
                    <div class="w-px bg-gray-200 mx-0.5 self-stretch"></div>
                    <button type="button" onclick="document.execCommand('insertUnorderedList')"
                        class="rte-btn px-2 h-7 rounded text-sm hover:bg-gray-200 transition-colors" title="Aufzählung">• —</button>
                    <button type="button" onclick="document.execCommand('insertOrderedList')"
                        class="rte-btn px-2 h-7 rounded text-sm hover:bg-gray-200 transition-colors" title="Nummerierung">1. —</button>
                </div>
                <div id="edit_news_content"
                    contenteditable="true"
                    class="min-h-[180px] p-3 border border-gray-200 rounded-b-lg bg-white text-sm text-gray-700
                           focus:outline-none focus:border-hb-olive leading-relaxed
                           [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1
                           [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                           [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1"></div>
            </div>
            <button onclick="updateNews(${newsId})" class="btn-primary w-full">Änderungen speichern</button>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
    document.getElementById('edit_news_content').innerHTML = item.content || '';
};

window.handleEditNewsScopeChange = (scope) => {
    document.getElementById('edit_news_building_wrap').classList.toggle('hidden', scope === 'global');
};

window.updateNews = async (newsId) => {
    const title   = document.getElementById('edit_news_title')?.value?.trim();
    const editor  = document.getElementById('edit_news_content');
    const content = editor?.innerHTML?.trim();
    const isEmpty = !content || content === '<br>' || content === '<p><br></p>';
    if (!title || isEmpty) { showToast('Titel und Inhalt sind Pflichtfelder.', 'error'); return; }

    const scope = document.getElementById('edit_news_scope')?.value;
    const bId   = parseInt(document.getElementById('edit_news_building_id')?.value) || null;

    const { error } = await _supabase.from('news').update({
        title,
        content,
        category:         document.getElementById('edit_news_cat')?.value || 'Allgemein',
        visibility_scope: scope || 'building',
        building_id:      scope !== 'global' ? bId : null,
        updated_at:       new Date().toISOString(),
    }).eq('id', newsId);

    if (error) { showToast(error.message, 'error'); return; }
    document.getElementById('edit-news-modal')?.remove();
    showToast('Beitrag aktualisiert.', 'success');
    await _loadLikedAndRead();
    await _fetchAndRenderNews();
    refreshNavBadges?.();
};

// ─── News erstellen ───────────────────────────────────────────
window.showCreateNewsModal = async () => {
    const role = userProfile?.role;
    // Gebäude für Auswahl
    const { data: buildings } = await _supabase.from('buildings').select('id, name').order('name');
    const bList = buildings || [];

    document.getElementById('create-news-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'create-news-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-2xl p-8 space-y-5" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-extrabold text-hb-offblack">Neuer Beitrag</h3>
                <button onclick="document.getElementById('create-news-modal').remove()" class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Titel *</label>
                <input type="text" id="news_title" placeholder="Betreff des Beitrags">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Kategorie</label>
                    <select id="news_cat">
                        <option value="Allgemein">Allgemein</option>
                        <option value="Ankündigung">Ankündigung</option>
                        <option value="Wartung">Wartung</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="text-[10px] uppercase font-bold text-gray-500">Sichtbarkeit</label>
                    <select id="news_scope" onchange="handleNewsScopeChange(this.value)">
                        ${role === 'admin' || role === 'manager' ? '<option value="global">Global</option>' : ''}
                        <option value="building" selected>Gebäude</option>
                        ${role === 'owner' ? '<option value="unit">Einheit</option>' : ''}
                    </select>
                </div>
            </div>
            <div id="news_building_wrap" class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Gebäude</label>
                <select id="news_building_id" onchange="handleNewsBuildingChange(this.value)">
                    <option value="">— Bitte wählen —</option>
                    ${bList.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
            </div>
            <div id="news_unit_wrap" class="space-y-2 hidden">
                <label class="text-[10px] uppercase font-bold text-gray-500">Einheit</label>
                <select id="news_apartment_id">
                    <option value="">— Zuerst Gebäude wählen —</option>
                </select>
            </div>
            <div class="space-y-2">
                <label class="text-[10px] uppercase font-bold text-gray-500">Inhalt *</label>
                <!-- Toolbar -->
                <div class="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-200 rounded-t-lg border-b-0">
                    <button type="button" onclick="document.execCommand('bold')"
                        class="rte-btn w-7 h-7 rounded font-bold text-sm hover:bg-gray-200 transition-colors" title="Fett">B</button>
                    <button type="button" onclick="document.execCommand('italic')"
                        class="rte-btn w-7 h-7 rounded italic text-sm hover:bg-gray-200 transition-colors" title="Kursiv">I</button>
                    <div class="w-px bg-gray-200 mx-0.5 self-stretch"></div>
                    <button type="button" onclick="document.execCommand('formatBlock', false, 'h3')"
                        class="rte-btn px-2 h-7 rounded text-xs font-bold hover:bg-gray-200 transition-colors" title="Überschrift">H</button>
                    <button type="button" onclick="document.execCommand('formatBlock', false, 'p')"
                        class="rte-btn px-2 h-7 rounded text-xs hover:bg-gray-200 transition-colors" title="Normaler Text">¶</button>
                    <div class="w-px bg-gray-200 mx-0.5 self-stretch"></div>
                    <button type="button" onclick="document.execCommand('insertUnorderedList')"
                        class="rte-btn px-2 h-7 rounded text-sm hover:bg-gray-200 transition-colors" title="Aufzählung">• —</button>
                    <button type="button" onclick="document.execCommand('insertOrderedList')"
                        class="rte-btn px-2 h-7 rounded text-sm hover:bg-gray-200 transition-colors" title="Nummerierung">1. —</button>
                </div>
                <!-- Editor -->
                <div id="news_content"
                    contenteditable="true"
                    class="min-h-[180px] p-3 border border-gray-200 rounded-b-lg bg-white text-sm text-gray-700
                           focus:outline-none focus:border-hb-olive leading-relaxed
                           [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1
                           [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                           [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1"
                    data-placeholder="Text des Beitrags…"></div>
            </div>
            <button onclick="saveNews()" class="btn-primary w-full">Veröffentlichen</button>
        </div>`;

    // Placeholder-Verhalten für contenteditable
    const editor = modal.querySelector('#news_content');
    const updatePlaceholder = () => {
        editor.classList.toggle('text-gray-400', editor.innerHTML === '' || editor.innerHTML === '<br>');
    };
    editor.addEventListener('focus', () => { if (editor.innerHTML === '') editor.innerHTML = ''; });
    editor.addEventListener('input', updatePlaceholder);
    editor.setAttribute('data-empty', 'true');
    editor.innerHTML = '';
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

window.handleNewsScopeChange = (scope) => {
    document.getElementById('news_building_wrap').classList.toggle('hidden', scope === 'global');
    document.getElementById('news_unit_wrap').classList.toggle('hidden', scope !== 'unit');
};

window.handleNewsBuildingChange = async (bId) => {
    const aptSel = document.getElementById('news_apartment_id');
    if (!aptSel || !bId) return;
    const { data } = await _supabase.from('apartments').select('id, apartment_number').eq('building_id', bId).order('apartment_number');
    aptSel.innerHTML = '<option value="">— Einheit wählen —</option>'
        + (data || []).map(a => `<option value="${a.id}">Wohnung ${a.apartment_number}</option>`).join('');
};

window.saveNews = async () => {
    const title   = document.getElementById('news_title')?.value?.trim();
    const editor  = document.getElementById('news_content');
    const content = editor?.innerHTML?.trim();
    const isEmpty = !content || content === '<br>' || content === '<p><br></p>';
    if (!title || isEmpty) { showToast('Titel und Inhalt sind Pflichtfelder.', 'error'); return; }
    const scope   = document.getElementById('news_scope')?.value;
    const bId     = parseInt(document.getElementById('news_building_id')?.value) || null;
    const aptId   = parseInt(document.getElementById('news_apartment_id')?.value) || null;

    const payload = {
        title,
        content,
        category:         document.getElementById('news_cat')?.value || 'Allgemein',
        visibility_scope: scope || 'building',
        building_id:      scope !== 'global' ? bId : null,
        apartment_id:     scope === 'unit' ? aptId : null,
        author_id:        currentUser.id,
        likes:            0,
    };
    const { error } = await _supabase.from('news').insert([payload]);
    if (error) { showToast(error.message, 'error'); return; }
    document.getElementById('create-news-modal')?.remove();
    showToast('Beitrag veröffentlicht.', 'success');
    await _loadLikedAndRead();
    await _fetchAndRenderNews();
    refreshNavBadges?.();
};
