// ============================================================
// HB-Mieterportal | mod-placeholder.js
// Platzhalter für Module, die noch implementiert werden
// Jedes wird in seiner eigenen Datei landen, sobald es gebaut wird
// ============================================================

async function loadSettings() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Einstellungen</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}

async function loadProfile() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Mein Profil</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}

async function loadMyUnits() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Meine Einheiten</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}

async function loadMyTenants() {
    document.getElementById('content-area').innerHTML =
        '<div class="p-10 card text-center"><h2 class="text-xl font-bold mb-2">Meine Mieter</h2><p class="text-gray-500">Demnächst verfügbar.</p></div>';
}
