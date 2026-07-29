// ============================================================
// HB-Mieterportal | utils.js
// UI-Hilfsfunktionen: Toast, Dropdown, Logout, Mobile-Menü
// ============================================================

// Varianten: 'success' (hb-success), 'error' (hb-error), 'info'/Default (hb-offblack).
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-hb-success'
                  : type === 'error'   ? 'bg-hb-error'
                                       : 'bg-hb-offblack';
    toast.className = `${bgColor} text-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 z-50`;
    toast.innerHTML = `<span class="text-sm font-bold text-left">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function toggleUserDropdown(e) {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('hidden');
}

function closeDropdowns(e) {
    if (!e.target.closest('.dropdown-container')) {
        document.getElementById('user-dropdown').classList.add('hidden');
    }
}

function logout() {
    _supabase.auth.signOut().then(() => window.location.href = 'index.html');
}

// ============================================================
// HB-Stamp: Stempel-Widget in der Header-Pille (nur admin/manager)
// Zentral hier gerendert (statt 4x im HTML). Bezug ueber auth.uid().
// ============================================================
let _stampState  = { open:false, sessionId:null, start:null, onBreak:false, breakStart:null };
let _stampTicker = null;

async function _initStampWidget() {
    const role = userProfile?.role;
    if (role !== 'admin' && role !== 'manager') return;          // nur Mitarbeiter
    const dd = document.getElementById('user-dropdown');
    if (!dd || document.getElementById('hb-stamp-widget')) return;

    const html = `
      <div id="hb-stamp-widget" class="px-4 py-3 border-b border-gray-50">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-400">Arbeitszeit</span>
          <a href="stamp.html" class="text-[11px] font-semibold text-hb-olive hover:underline">Zeiten ansehen</a>
        </div>
        <p id="stamp-status" class="text-sm font-semibold text-hb-offblack mb-2">Nicht eingestempelt</p>
        <div class="flex items-center gap-2">
          <button id="stamp-toggle-btn" onclick="_stampToggle()" class="flex-1 py-2 rounded-xl text-sm font-black text-white bg-hb-olive hover:opacity-90 transition-colors">Kommen</button>
          <label class="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" id="stamp-pause" onchange="_stampPauseToggle(this.checked)" disabled class="accent-hb-olive"> Pause
          </label>
        </div>
      </div>`;
    dd.querySelector('button')?.insertAdjacentHTML('beforebegin', html);   // vor "Profil bearbeiten"

    const avatar = document.getElementById('user-avatar');
    if (avatar && !document.getElementById('stamp-avatar-dot')) {
        avatar.style.position = 'relative';
        avatar.insertAdjacentHTML('beforeend',
          `<span id="stamp-avatar-dot" class="hidden absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-hb-success ring-2 ring-white"></span>`);
    }
    await _stampRefresh();
}

async function _stampRefresh() {
    try {
        const { data } = await _supabase.from('work_sessions')
            .select('id, start_at').is('end_at', null).eq('user_id', currentUser.id)
            .order('start_at', { ascending:false }).limit(1).maybeSingle();
        if (data) {
            _stampState.open = true; _stampState.sessionId = data.id;
            _stampState.start = new Date(data.start_at);
            // Laufende Pause serverseitig lesen (nicht aus Client-State) -> reload-fest
            const { data: ob } = await _supabase.from('work_breaks')
                .select('start_at').eq('session_id', data.id).is('end_at', null)
                .order('start_at', { ascending:false }).limit(1).maybeSingle();
            _stampState.onBreak = !!ob;
            _stampState.breakStart = ob ? new Date(ob.start_at) : null;
        } else {
            _stampState = { open:false, sessionId:null, start:null, onBreak:false, breakStart:null };
        }
    } catch (e) { console.warn('stamp refresh:', e); }
    _stampRender();
    if (_stampTicker) clearInterval(_stampTicker);
    if (_stampState.open) _stampTicker = setInterval(_stampRender, 30000);
}

function _stampRender() {
    const statusEl = document.getElementById('stamp-status');
    const btn   = document.getElementById('stamp-toggle-btn');
    const pause = document.getElementById('stamp-pause');
    const dot   = document.getElementById('stamp-avatar-dot');
    if (!statusEl || !btn) return;
    if (_stampState.open) {
        const hhmm = _stampState.start.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
        statusEl.textContent = _stampState.onBreak ? `Pause läuft · seit ${hhmm} eingestempelt` : `Eingestempelt seit ${hhmm}`;
        btn.textContent = 'Gehen'; btn.classList.remove('bg-hb-olive'); btn.classList.add('bg-hb-orange');
        if (pause) { pause.disabled = false; pause.checked = _stampState.onBreak; }
        dot?.classList.remove('hidden');
    } else {
        statusEl.textContent = 'Nicht eingestempelt';
        btn.textContent = 'Kommen'; btn.classList.remove('bg-hb-orange'); btn.classList.add('bg-hb-olive');
        if (pause) { pause.disabled = true; pause.checked = false; }
        dot?.classList.add('hidden');
    }
}

window._stampPauseToggle = async (checked) => {
    if (!_stampState.open) return;
    const pause = document.getElementById('stamp-pause');
    if (pause) pause.disabled = true;
    try {
        const { error } = checked
            ? await _supabase.rpc('stamp_pause_start')
            : await _supabase.rpc('stamp_pause_end');
        if (error) throw error;
    } catch (e) { showToast('Fehler: ' + (e.message || e), 'error'); }
    await _stampRefresh();     // Zustand serverseitig neu laden
};

window._stampToggle = async () => {
    const btn = document.getElementById('stamp-toggle-btn');
    if (btn) btn.disabled = true;
    try {
        if (!_stampState.open) {
            const { error } = await _supabase.rpc('stamp_start', { p_note: null });
            if (error) throw error;
            showToast('Eingestempelt.', 'success');
        } else {
            const { error } = await _supabase.rpc('stamp_stop', { p_note: null });
            if (error) throw error;
            showToast('Ausgestempelt.', 'success');
        }
        await _stampRefresh();
    } catch (e) {
        showToast('Fehler: ' + (e.message || e), 'error');
    } finally { if (btn) btn.disabled = false; }
};

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('overlay').classList.toggle('hidden');
}

// ─── Sidebar Pin (Desktop) ───────────────────────────────────
// Eingeklappt = 72px Icons. Hover = Overlay-Peek (kein Reflow).
// Pin geklickt = angedockt offen, bleibt bis zum Lösen (localStorage).
function toggleSidebarPin() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const pinned = sb.classList.toggle('pinned');
    try { localStorage.setItem('hb_sidebar_pinned', pinned ? '1' : '0'); } catch (e) {}
    _syncSidebarPinBtn(pinned);
}

function _syncSidebarPinBtn(pinned) {
    const btn = document.getElementById('sidebar-pin-btn');
    if (!btn) return;
    const lbl = btn.querySelector('.nav-label');
    if (lbl) lbl.textContent = pinned ? 'Menü lösen' : 'Menü fixieren';
    btn.title = pinned ? 'Menü lösen' : 'Menü fixieren';
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
}

function _initSidebarPin() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    let pinned = false;
    try { pinned = localStorage.getItem('hb_sidebar_pinned') === '1'; } catch (e) {}
    // Nur auf Desktop andocken – auf Mobile gilt das Slide-in-Menü.
    if (pinned && window.matchMedia('(min-width: 768px)').matches) sb.classList.add('pinned');
    _syncSidebarPinBtn(sb.classList.contains('pinned'));
}
document.addEventListener('DOMContentLoaded', _initSidebarPin);

// ─── Modal / Bottom Sheet ────────────────────────────────────
// Desktop: zentriertes Modal. Mobile: Bottom Sheet (slide-up).
// Nutzung: const modal = showModal('my-id', '<h2>Titel</h2>...', { maxWidth: 'max-w-2xl' });
// Schließen: hideModal('my-id') oder Overlay-Klick / Escape / Swipe-Down.
function showModal(id, contentHtml, { maxWidth = 'max-w-lg', onClose } = {}) {
    document.getElementById(id)?.remove();

    const modal = document.createElement('div');
    modal.id = id;
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex flex-col justify-end';
        // Bottom Sheet mit iOS-Drag-Indicator (5×36px Griff oben)
        modal.innerHTML = `<div class="modal-sheet bg-white rounded-t-2xl shadow-2xl w-full max-h-[85vh] overflow-y-auto translate-y-full" onclick="event.stopPropagation()"><div class="flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10"><div class="w-9 h-1.5 rounded-full bg-gray-300"></div></div><div class="p-5 space-y-4">${contentHtml}</div></div>`;
    } else {
        modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.innerHTML = `<div class="modal-inner bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-8 space-y-5 scale-95 opacity-0" onclick="event.stopPropagation()">${contentHtml}</div>`;
    }

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => {
        const inner = modal.firstElementChild;
        if (isMobile) inner.classList.remove('translate-y-full');
        else { inner.classList.remove('scale-95', 'opacity-0'); }
    });

    // Close: Overlay-Klick
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(id); });

    // Close: Escape
    const escH = (e) => { if (e.key === 'Escape') { hideModal(id); document.removeEventListener('keydown', escH); } };
    document.addEventListener('keydown', escH);
    modal._escHandler = escH;

    // Close: Swipe-Down (Mobile)
    if (isMobile) _addSwipeToDismiss(modal);

    // onClose-Callback speichern
    if (onClose) modal._onClose = onClose;

    return modal;
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const inner = modal.firstElementChild;
    const isMobile = window.innerWidth < 768;

    if (isMobile) inner.classList.add('translate-y-full');
    else { inner.classList.add('scale-95', 'opacity-0'); }

    if (modal._escHandler) document.removeEventListener('keydown', modal._escHandler);
    if (modal._onClose) modal._onClose();

    setTimeout(() => modal.remove(), 300);
}

// Swipe-Down-to-Dismiss für Bottom Sheets
function _addSwipeToDismiss(modal) {
    const sheet = modal.querySelector('.modal-sheet');
    if (!sheet) return;
    let startY = 0, currentY = 0, dragging = false;

    sheet.addEventListener('touchstart', (e) => {
        if (sheet.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        currentY = startY;
        dragging = true;
        sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        currentY = e.touches[0].clientY;
        const dy = currentY - startY;
        if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });

    sheet.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        sheet.style.transition = '';
        if (currentY - startY > 80) hideModal(modal.id);
        else sheet.style.transform = '';
    });
}

// ─── Responsive Table ────────────────────────────────────────
// Macht eine Tabelle mobil-responsive: liest <th>-Texte, setzt data-label auf <td>,
// und wickelt den Container in .rtable.
// Nutzung: makeTableResponsive(document.getElementById('my-table-container'))
// Oder per ID: makeTableResponsive('my-container-id')
function makeTableResponsive(elOrId) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    el.classList.add('rtable');
    const table = el.querySelector('table') || (el.tagName === 'TABLE' ? el : null);
    if (!table) return;
    const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr => {
        [...tr.querySelectorAll('td')].forEach((td, i) => {
            if (headers[i]) td.setAttribute('data-label', headers[i]);
            // Letzte Spalte mit Buttons/Links → Action-Styling
            if (i === headers.length - 1 && td.querySelector('button, a, .btn-primary')) {
                td.classList.add('td-action');
            }
        });
    });
}

// ─── Skeleton Loading ────────────────────────────────────────
// Erzeugt HTML-Platzhalter für Ladezustände (Phase 1C Pattern)
// Nutzung: container.innerHTML = showSkeleton({ rows: 4, type: 'cards' });
function showSkeleton({ rows = 3, type = 'list' } = {}) {
    if (type === 'cards') {
        return Array.from({ length: rows }, () =>
            `<div class="skeleton h-24 mb-3"></div>`
        ).join('');
    }
    if (type === 'table') {
        return `<div class="skeleton h-10 mb-2"></div>` +
            Array.from({ length: rows }, () =>
                `<div class="skeleton h-14 mb-2"></div>`
            ).join('');
    }
    // default: list
    return Array.from({ length: rows }, () =>
        `<div class="flex items-center gap-3 mb-3">
            <div class="skeleton w-10 h-10 rounded-full flex-shrink-0"></div>
            <div class="flex-1"><div class="skeleton h-4 mb-2 w-3/4"></div><div class="skeleton h-3 w-1/2"></div></div>
        </div>`
    ).join('');
}
