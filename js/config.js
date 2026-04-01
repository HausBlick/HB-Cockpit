// ============================================================
// HB-Mieterportal | config.js
// Supabase-Client, globale State-Variablen, Icon-Library
// ============================================================

const SUPABASE_URL = 'https://unprrlbvylmzxxhpfisr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nWYozmRQq8E17z_ljZ2SHA_LUulwUV1';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Globaler App-State ---
let currentUser    = null;
let userProfile    = null;
let currentBuildings   = [];
let selectedBuildingId = null;
let currentApartments  = [];

// --- Globale Hilfsfunktionen ---
function formatBuildingName(b) {
    if (!b) return '—';
    if (b.file_number) return `${b.file_number} - WEG ${b.street || ''} ${b.house_number || ''}`.trim();
    return b.name || '—';
}

// --- Dynamisches Hausgeld aus aktivem Wirtschaftsplan ---
// Berechnet den monatlichen Hausgeld-Anteil einer Einheit aus dem aktiven WP + Verteilerschlüssel.
// Fallback auf apartments.hausgeld wenn kein aktiver WP existiert.
async function getMonthlyHausgeld(apartmentId, buildingId) {
    // 1) Aktiven Wirtschaftsplan laden
    const { data: plan } = await _supabase.from('budget_plans')
        .select('id')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .limit(1).single();
    if (!plan) return null; // kein aktiver WP → Caller nutzt Fallback

    // 2) WP-Positionen mit Schlüssel laden
    const { data: items } = await _supabase.from('budget_plan_items')
        .select('planned_amount, account_id')
        .eq('plan_id', plan.id);
    if (!items?.length) return null;

    // 3) Konten mit Verteilerschlüssel laden
    const accIds = items.map(i => i.account_id).filter(Boolean);
    const { data: accounts } = await _supabase.from('accounts')
        .select('id, primary_key_id')
        .in('id', accIds);
    const accMap = {};
    (accounts || []).forEach(a => accMap[a.id] = a);

    // 4) Verteilerschlüssel + Einheitenwerte laden
    const keyIds = [...new Set((accounts || []).map(a => a.primary_key_id).filter(Boolean))];
    if (!keyIds.length) return null;
    const [{ data: keys }, { data: keyUnits }] = await Promise.all([
        _supabase.from('distribution_keys').select('id, total_value').in('id', keyIds),
        _supabase.from('distribution_key_units').select('distribution_key_id, apartment_id, value').eq('apartment_id', apartmentId).in('distribution_key_id', keyIds),
    ]);
    const keyMap = {};
    (keys || []).forEach(k => keyMap[k.id] = k);
    const unitValMap = {};
    (keyUnits || []).forEach(u => unitValMap[u.distribution_key_id] = u.value);

    // 5) Anteil berechnen: Summe aller (planned_amount × unitValue / totalValue)
    let totalYear = 0;
    for (const item of items) {
        const acc = accMap[item.account_id];
        const keyId = acc?.primary_key_id;
        if (!keyId) continue;
        const dk = keyMap[keyId];
        const unitVal = unitValMap[keyId];
        if (!dk?.total_value || unitVal == null) continue;
        totalYear += item.planned_amount * unitVal / dk.total_value;
    }
    return totalYear > 0 ? Math.round(totalYear / 12 * 100) / 100 : null;
}

// --- Icon-Library ---
const icons = {
    dashboard: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`,
    news:      `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"></path></svg>`,
    tickets:   `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    users:     `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>`,
    buildings: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M3 21h18"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path></svg>`,
    docs:      `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`,
    contact:   `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path></svg>`,
    finance:   `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    settings:  `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    calendar:  `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    clock:     `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    more:      `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>`
};

// ============================================================
// Zentrale Enum-Konstanten (SSOT — Single Source of Truth)
// ============================================================

const TICKET_STATUSES = ['Offen', 'In Bearbeitung', 'Warte auf Rückmeldung', 'Wiedervorlage', 'Erledigt'];

const TICKET_STATUS_STYLES = {
    'Offen':                  'ts-offen',
    'In Bearbeitung':         'ts-bearbeitung',
    'Warte auf Rückmeldung':  'ts-warte',
    'Wiedervorlage':          'ts-wiedervorlage',
    'Erledigt':               'ts-erledigt',
};

const NEWS_CATEGORIES = ['Alle', 'Ankündigung', 'Wartung', 'Allgemein'];

const DOC_CATEGORIES_WEG = [
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
const DOC_CATEGORIES_MIET      = ['Mietverträge', 'Wohnungsübergabe'];
const DOC_CATEGORIES_ALLGEMEIN = ['Allgemein'];
const DOC_CATEGORIES_ALL       = [...DOC_CATEGORIES_WEG, ...DOC_CATEGORIES_MIET, ...DOC_CATEGORIES_ALLGEMEIN];

const CONTACT_CATEGORIES = ['Vermieter', 'Verwalter', 'Hausmeister', 'Heizung', 'Sanitär', 'Elektro', 'Reinigung', 'Versicherung', 'Sonstiges'];

const DEADLINE_TYPES = [
    { key: 'energy_certificate_expiry',   label: 'Energieausweis' },
    { key: 'next_fire_safety_check',      label: 'Brandschutzprüfung' },
    { key: 'drinking_water_analysis_due', label: 'Trinkwasseranalyse' },
];

const DEADLINE_THRESHOLDS = { critical: 14, warning: 30 };

const ROLE_LABELS = {
    admin:    'Verwalter Cockpit',
    manager:  'Objektbetreuer',
    owner:    'Eigentümer Cockpit',
    tenant:   'Mieter Portal',
    landlord: 'Vermieter Cockpit',
    advisory: 'Beirat Cockpit',
};

const SALUTATIONS = ['Herr', 'Frau', 'Divers'];

const ETV_STATUSES       = ['planned', 'active', 'closed'];
const ETV_STATUS_LABELS  = { planned: 'GEPLANT', active: 'AKTIV', closed: 'GESCHLOSSEN' };
const VOTING_TYPES       = { mea: 'Wertprinzip (MEA)', heads: 'Kopfprinzip', object: 'Objektprinzip' };
const MAJORITY_TYPES     = { simple: 'Einfache Mehrheit', qualified: 'Qualifizierte Mehrheit', double_qualified: 'Doppelt Qualifiziert' };

const BUDGET_PLAN_STATUSES = { draft: 'Entwurf', approved: 'Beschlossen', active: 'Aktiv', closed: 'Abgeschlossen' };

const DUNNING_LEVEL_LABELS = { 1: 'Zahlungserinnerung', 2: '1. Mahnung', 3: 'Letzte Mahnung' };

// ============================================================
// Multi-Page Routing (Phase 1B)
// Module die als eigene HTML-Seiten ausgelagert sind
// ============================================================

const EXTERNAL_PAGES = {
    'loadZeiterfassung': 'zeiterfassung.html',
    // Zukünftig: 'loadETV': 'etv.html', 'loadDocuments': 'dokumente.html', 'loadFinance': 'finanzen.html'
};

// Auth-Guard: Welche externen Seiten nur admin/manager sehen dürfen
const EXTERNAL_PAGE_ROLES = {
    'zeiterfassung': ['admin', 'manager'],
    // 'etv': ['admin', 'manager'],
    // 'finanzen': ['admin', 'manager', 'advisory'],
};

function _getCurrentPage() {
    const path = window.location.pathname;
    if (path.endsWith('zeiterfassung.html')) return 'zeiterfassung';
    if (path.endsWith('etv.html')) return 'etv';
    if (path.endsWith('dokumente.html')) return 'dokumente';
    if (path.endsWith('finanzen.html')) return 'finanzen';
    return 'dashboard';
}

function _isExternalPage() {
    return _getCurrentPage() !== 'dashboard';
}

function _syncBuildingToSession() {
    if (selectedBuildingId) {
        sessionStorage.setItem('hb_active_building', String(selectedBuildingId));
    }
}
