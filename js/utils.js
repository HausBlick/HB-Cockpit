// ============================================================
// HB-Mieterportal | utils.js
// UI-Hilfsfunktionen: Toast, Dropdown, Logout, Mobile-Menü
// ============================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-hb-orange' : 'bg-hb-olive';
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

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('overlay').classList.toggle('hidden');
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
