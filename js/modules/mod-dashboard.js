// ============================================================
// HB-Mieterportal | mod-dashboard.js
// Modul: Dashboard — Übersicht & KPIs
// ============================================================

async function loadDashboard() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
        <div class="p-10 card text-center">
            <h2 class="text-xl font-bold mb-2">Willkommen im Dashboard</h2>
            <p class="text-gray-500">Ihre Übersicht wird geladen...</p>
        </div>`;
}
