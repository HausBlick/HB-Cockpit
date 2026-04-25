// ============================================================
// HB-Mieterportal | mod-finanzen.js
// Buchhaltung: Übersicht, Buchungen, Zählerstände, Sollstellungen,
//              Wirtschaftsplan, Rücklage, Belegprüfung, Onboarding
// ============================================================

let _finState = {
    tab:              'uebersicht',
    buildingId:       null,
    buildings:        [],
    accounts:         [],
    entries:          [],
    demands:          [],
    apartments:       [],
    meters:           [],
    lastReadings:     {},
    fiscalYear:       new Date().getFullYear(),
    // Wirtschaftsplan
    selectedPlanId:   null,
    plans:            [],
    planItems:        [],
    sonderumlagen:    [],
    // Beirat
    isBeirat:         false,
    beiratBuildingId: null,
    beiratFiscalYear: null,
    // Jahresabrechnung
    jabStep:  1,   // 1=Vermögensbericht, 2=Zeitraum/Konten, 3=Ist-Review, 4=Heizkosten, 5=Soll-Ist, 6=Abschluss
    jabData:  {},   // { fy, from, to, entries, accounts, distKeys, heatingMode, heatingManual, sollIst }
    // Onboarding
    onboardStep:      1,
    onboardBankRows:  [],
    onboardOwnerRows: [],
};

// ─── Hilfsfunktionen ──────────────────────────────────────────

// Prüft ob ein Wirtschaftsjahr für ein Gebäude abgeschlossen (gesperrt) ist.
// Gibt true zurück wenn das Jahr gesperrt ist und keine neuen Buchungen erlaubt sind.
// Storno-Buchungen (entry_type='storno') sind von der Sperre ausgenommen (GoBD).
async function _finIsYearClosed(buildingId, fiscalYear) {
    if (!buildingId || !fiscalYear) return false;
    const { data } = await _supabase.from('budget_plans')
        .select('status')
        .eq('building_id', buildingId)
        .eq('fiscal_year', fiscalYear)
        .eq('status', 'closed')
        .maybeSingle();
    return !!data;
}

// Prüft und zeigt Toast wenn gesperrt. Gibt true zurück wenn gesperrt (= Abbruch).
async function _finBlockIfYearClosed(buildingId, fiscalYear) {
    const closed = await _finIsYearClosed(buildingId, fiscalYear);
    if (closed) {
        showToast(`Das Wirtschaftsjahr ${fiscalYear} ist abgeschlossen. Neue Buchungen sind nicht mehr möglich. (Stornierungen bleiben erlaubt.)`, 'error');
    }
    return closed;
}

function _finFormatDate(dateStr) {
    if (!dateStr) return '—';
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}.${m}.${y}`;
}

// ─── Entry Point ──────────────────────────────────────────────

async function loadFinance() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const isAdminManager = ['admin','manager'].includes(userProfile?.role);

    // Beirat-Prüfung für Nicht-Verwalter
    _finState.isBeirat = false;
    _finState.beiratBuildingId = null;
    _finState.beiratFiscalYear = null;

    if (!isAdminManager) {
        // RPC umgeht RLS — Owner hat keinen Lesezugriff auf board_members/beirat_access_periods
        const { data: accessArr } = await _supabase.rpc('get_beirat_access');
        _finState.beiratPeriods = Array.isArray(accessArr) ? accessArr : [];
        const access = _finState.beiratPeriods[0];
        if (access?.building_id) {
            _finState.isBeirat        = true;
            _finState.beiratBuildingId = access.building_id;
            _finState.beiratFiscalYear = access.fiscal_year;
        }
        if (!_finState.isBeirat) {
            ca.innerHTML = `<div class="p-10 card text-center max-w-sm mx-auto mt-10">
                <h2 class="text-lg font-bold mb-2 text-hb-offblack">Kein Zugriff</h2>
                <p class="text-[15px] text-gray-500">Aktuell keine aktive Belegprüfungs-Freigabe vorhanden.</p></div>`;
            return;
        }
        // Beirat: direkt Belegansicht
        _finRenderBeiratView();
        return;
    }

    const { data: buildings } = await _supabase.from('buildings').select('id, name, file_number, street, house_number').order('name');
    _finState.buildings = buildings || [];
    if (!_finState.buildingId && _finState.buildings.length > 0) {
        // Building-Kontext: URL-Param > sessionStorage > erster in Liste
        const urlBuilding = new URLSearchParams(window.location.search).get('building');
        const sessionBuilding = sessionStorage.getItem('hb_active_building');
        const targetId = urlBuilding || sessionBuilding;
        if (targetId && _finState.buildings.find(b => b.id == targetId)) {
            _finState.buildingId = Number(targetId);
        } else {
            _finState.buildingId = _finState.buildings[0].id;
        }
    }

    // Tab Deep-Linking: ?tab=buchungen etc.
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['uebersicht','buchungen','zaehler','sollstellung','wirtschaftsplan','ruecklage','belegpruefung','jahresabrechnung','mahnwesen','datev','csv_import','sepa_export','onboarding'];
    if (urlTab && validTabs.includes(urlTab)) {
        _finState.tab = urlTab;
    }

    _finRenderShell();
    await _finLoadTab(_finState.tab);
}

// ─── Shell & Tab-Navigation ───────────────────────────────────

function _finRenderShell() {
    const tabs = [
        { key: 'uebersicht',      label: 'Übersicht' },
        { key: 'buchungen',       label: 'Buchungen' },
        { key: 'zaehler',         label: 'Zählerstände' },
        { key: 'sollstellung',    label: 'Sollstellungen' },
        { key: 'wirtschaftsplan', label: 'Wirtschaftsplan' },
        { key: 'ruecklage',       label: 'Rücklage' },
        { key: 'belegpruefung',     label: 'Belegprüfung' },
        { key: 'jahresabrechnung',  label: 'Jahresabrechnung' },
        { key: 'mahnwesen',         label: 'Mahnwesen' },
        { key: 'datev',             label: 'DATEV-Export' },
        { key: 'csv_import',        label: 'CSV-Import' },
        { key: 'sepa_export',       label: 'SEPA-Export' },
        { key: 'onboarding',        label: 'Onboarding' },
    ];

    const buildingOpts = _finState.buildings.map(b =>
        `<option value="${b.id}" ${b.id == _finState.buildingId ? 'selected' : ''}>${formatBuildingName(b)}</option>`
    ).join('');

    const tabHtml = tabs.map(t => `
        <button onclick="_finSwitchTab('${t.key}')" id="fin-tab-${t.key}"
            class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${_finState.tab === t.key ? 'bg-hb-olive text-white' : 'text-hb-olive hover:bg-hb-olive/10'}">
            ${t.label}
        </button>`).join('');

    document.getElementById('content-area').innerHTML = `
        <div class="flex justify-between items-end mb-6">
            <div>
                <h2 class="text-[28px] font-bold text-hb-olive tracking-tight">Buchhaltung</h2>
                <p class="text-[15px] text-gray-500 mt-1">Konten, Buchungen, Zählerstände & Sollstellungen.</p>
            </div>
            <select id="fin-building-select" onchange="_finOnBuildingChange(this.value)"
                class="w-56 text-sm">${buildingOpts}</select>
        </div>
        <div class="flex gap-2 mb-5 flex-wrap">
            ${tabHtml}
        </div>
        <div id="fin-content"></div>`;
}

window._finOnBuildingChange = async (val) => {
    _finState.buildingId = Number(val);
    sessionStorage.setItem('hb_active_building', String(val));
    _finState.accounts = [];
    await _finLoadTab(_finState.tab);
};

window._finSwitchTab = async (tab) => {
    _finState.tab = tab;
    document.querySelectorAll('[id^="fin-tab-"]').forEach(btn => {
        const isActive = btn.id === `fin-tab-${tab}`;
        btn.className = `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive ? 'bg-hb-olive text-white' : 'text-hb-olive hover:bg-hb-olive/10'}`;
    });
    await _finLoadTab(tab);
};

async function _finLoadTab(tab) {
    const el = document.getElementById('fin-content');
    if (!el) return;
    el.innerHTML = `<div class="flex justify-center py-10"><div class="w-7 h-7 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    if (tab === 'uebersicht')        await _finLoadOverview();
    else if (tab === 'buchungen')         await _finLoadBookings();
    else if (tab === 'zaehler')           await _finLoadMeters();
    else if (tab === 'sollstellung')      await _finLoadDemands();
    else if (tab === 'wirtschaftsplan')   await _finLoadWirtschaftsplan();
    else if (tab === 'ruecklage')         await _finLoadRuecklage();
    else if (tab === 'belegpruefung')     await _finLoadBelegpruefung();
    else if (tab === 'jahresabrechnung')  await _finLoadJahresabrechnung();
    else if (tab === 'mahnwesen')         await _finLoadMahnwesen();
    else if (tab === 'datev')             await _finLoadDatev();
    else if (tab === 'csv_import')        await _finLoadCsvImport();
    else if (tab === 'sepa_export')       await _finLoadSepaExport();
    else if (tab === 'onboarding')        _finRenderOnboarding();
}

// ─── Konten sicherstellen (System-Konten kopieren) ────────────

async function _finEnsureAccounts(buildingId) {
    const { data: existing } = await _supabase.from('accounts').select('id').eq('building_id', buildingId).limit(1);
    if (existing?.length > 0) return;

    const { data: templates } = await _supabase.from('accounts').select('*').is('building_id', null);
    if (!templates?.length) return;

    const copies = templates.map(t => ({
        building_id:       buildingId,
        account_number:    t.account_number,
        account_name:      t.account_name,
        account_type:      t.account_type,
        account_subtype:   t.account_subtype,
        is_reserve_account: t.is_reserve_account,
        reserve_label:     t.reserve_label,
        is_system_account: t.is_system_account || false,
        is_allocatable:    t.is_allocatable    || false,
        is_active:         true,
        sort_order:        t.sort_order,
    }));
    await _supabase.from('accounts').insert(copies);
}

async function _finGetAccounts(buildingId) {
    await _finEnsureAccounts(buildingId);
    const { data } = await _supabase.from('accounts')
        .select('*')
        .eq('building_id', buildingId)
        .eq('is_active', true)
        .order('account_number');
    return data || [];
}

// ─── Tab 1: Übersicht ─────────────────────────────────────────

async function _finLoadOverview() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const [accounts, { data: debits }, { data: credits }, { data: dkData }] = await Promise.all([
        _finGetAccounts(bid),
        _supabase.from('journal_entries').select('debit_account_id, amount').eq('building_id', bid),
        _supabase.from('journal_entries').select('credit_account_id, amount').eq('building_id', bid),
        _supabase.from('distribution_keys').select('id, name, type, total_value, heiz_split_percent').eq('building_id', bid).order('name'),
    ]);
    _finState.accounts = accounts;
    _finState.distKeys = dkData || [];

    // Saldo pro Konto berechnen
    const saldoMap = {};
    for (const a of accounts) saldoMap[a.id] = 0;
    for (const e of (debits || []))  if (saldoMap[e.debit_account_id]  !== undefined) saldoMap[e.debit_account_id]  += Number(e.amount);
    for (const e of (credits || [])) if (saldoMap[e.credit_account_id] !== undefined) saldoMap[e.credit_account_id] -= Number(e.amount);

    const typeLabels = { asset: 'Aktiva', liability: 'Passiva', equity: 'Eigenkapital', revenue: 'Ertrag', expense: 'Aufwand' };
    const typeBadge  = { asset: 'bg-hb-olive/10 text-hb-olive', liability: 'bg-hb-gold-soft/20 text-hb-gold-bold', equity: 'bg-hb-olive/10 text-hb-olive', revenue: 'bg-hb-success/12 text-hb-success', expense: 'bg-hb-orange/10 text-hb-orange' };

    // Saldo-Map auch für Ledger bereitstellen
    _finState._saldoMap = saldoMap;

    const buildOverviewRows = (filter = '') => {
        const q = filter.toLowerCase();
        const filtered = accounts.filter(a =>
            !q ||
            (a.account_number || '').toLowerCase().includes(q) ||
            (a.account_name   || '').toLowerCase().includes(q) ||
            (typeLabels[a.account_type] || '').toLowerCase().includes(q)
        );
        return filtered.map(a => {
            const saldo = saldoMap[a.id] ?? 0;
            const saldoCls = saldo < 0 ? 'text-hb-error' : saldo > 0 ? 'text-hb-success' : 'text-gray-400';
            const isChild = !!a.parent_account_id;
            const namePrefix = isChild ? '<span class="text-gray-400 mr-1.5">└</span>' : '';
            const rowClass = isChild ? 'bg-gray-50/50' : '';
            const lockIcon = '<svg class="w-3 h-3 inline-block ml-1.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"/></svg>';
            const actions = a.is_system_account ? '' :
                `<button onclick="event.stopPropagation();_finEditAccount(${a.id})" title="Bearbeiten"
                    class="text-xs text-hb-olive bg-hb-ultralight px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z"/></svg>
                </button>
                <button onclick="event.stopPropagation();_finDeleteAccount(${a.id})" title="Löschen"
                    class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>`;
            return `<tr class="hover:bg-gray-50/60 transition-colors cursor-pointer ${rowClass}" onclick="_finOpenLedger(${a.id}, '${a.account_name.replace(/'/g, "\\'")}')">
                <td class="px-4 py-3 text-sm font-mono text-gray-500 ${isChild ? 'pl-8' : ''}">${a.account_number}</td>
                <td class="px-4 py-3 text-sm font-semibold text-hb-offblack">${namePrefix}${a.account_name}${a.reserve_label ? `<span class="ml-2 text-xs text-gray-400">(${a.reserve_label})</span>` : ''}${a.is_system_account ? lockIcon : ''}</td>
                <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-md ${typeBadge[a.account_type] || 'bg-gray-100 text-gray-600'}">${typeLabels[a.account_type] || a.account_type}</span></td>
                <td class="px-4 py-3 text-sm font-bold text-right ${saldoCls}">${saldo.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                <td class="px-4 py-3 text-right" onclick="event.stopPropagation()"><div class="flex gap-1 justify-end">${actions}</div></td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Treffer.</td></tr>';
    };

    document.getElementById('fin-content').innerHTML = `
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Kontenblatt</span>
                <div class="flex items-center gap-2">
                    <input id="fin-overview-search" type="text" placeholder="Suche…"
                        oninput="_finFilterOverview(this.value)"
                        class="text-xs h-7 px-3 rounded-lg bg-white border-0 text-hb-offblack w-44 focus:outline-none focus:ring-2 focus:ring-white/50">
                    <button onclick="_finOpenNewAccountModal()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">+ Konto anlegen</button>
                </div>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Nr.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Bezeichnung</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                </tr></thead>
                <tbody id="fin-overview-tbody" class="divide-y divide-hb-olive/10">${buildOverviewRows()}</tbody>
            </table>
        </div>

        <!-- Modal Neues Konto -->
        <div id="fin-account-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-base font-extrabold text-hb-offblack mb-4">Neues Konto anlegen</h3>
                <div class="space-y-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Kontonummer</label>
                        <input id="fin-acc-number" type="text" placeholder="z.B. 4500"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Kontobezeichnung</label>
                        <input id="fin-acc-name" type="text"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Typ</label>
                        <select id="fin-acc-type">
                            <option value="asset">Aktiva</option>
                            <option value="liability">Passiva</option>
                            <option value="equity">Eigenkapital</option>
                            <option value="revenue">Ertrag</option>
                            <option value="expense" selected>Aufwand</option>
                        </select></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Übergeordnetes Konto (Unterkonto von…)</label>
                        <select id="fin-acc-parent">
                            <option value="">— Kein übergeordnetes Konto —</option>
                            ${accounts.map(a => `<option value="${a.id}">${a.account_number} – ${a.account_name}</option>`).join('')}
                        </select></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Rücklage-Label (optional)</label>
                        <input id="fin-acc-reserve" type="text" placeholder="z.B. Instandhaltungsrücklage"></div>
                    <div class="flex items-center gap-3 pt-1">
                        <input type="checkbox" id="fin-acc-allocatable" class="w-4 h-4 rounded border-gray-300 text-hb-olive focus:ring-hb-olive/30">
                        <label for="fin-acc-allocatable" class="text-xs font-semibold text-gray-700 cursor-pointer">Umlagefähig (Betriebskosten)</label>
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSaveAccount()" class="btn-primary flex-1 text-sm py-2.5">Speichern</button>
                    <button onclick="document.getElementById('fin-account-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>

        <!-- Modal Konto bearbeiten -->
        <div id="fin-account-edit-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-base font-extrabold text-hb-offblack mb-4">Konto bearbeiten</h3>
                <input type="hidden" id="fin-edit-acc-id">
                <div class="space-y-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Kontonummer</label>
                        <input id="fin-edit-acc-number" type="text"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Kontobezeichnung</label>
                        <input id="fin-edit-acc-name" type="text"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Typ</label>
                        <select id="fin-edit-acc-type">
                            <option value="asset">Aktiva</option>
                            <option value="liability">Passiva</option>
                            <option value="equity">Eigenkapital</option>
                            <option value="revenue">Ertrag</option>
                            <option value="expense">Aufwand</option>
                        </select></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Übergeordnetes Konto (Unterkonto von…)</label>
                        <select id="fin-edit-acc-parent">
                            <option value="">— Kein übergeordnetes Konto —</option>
                            ${accounts.map(a => `<option value="${a.id}">${a.account_number} – ${a.account_name}</option>`).join('')}
                        </select></div>
                    <div id="fin-edit-acc-reserve-wrap"><label class="text-xs font-semibold text-gray-500 mb-1 block">Rücklage-Label</label>
                        <input id="fin-edit-acc-reserve" type="text"></div>
                    <div class="flex items-center gap-3 pt-1">
                        <input type="checkbox" id="fin-edit-acc-allocatable" class="w-4 h-4 rounded border-gray-300 text-hb-olive focus:ring-hb-olive/30">
                        <label for="fin-edit-acc-allocatable" class="text-xs font-semibold text-gray-700 cursor-pointer">Umlagefähig (Betriebskosten)</label>
                    </div>
                    <div class="border-t pt-3 mt-1">
                        <p class="text-xs font-black uppercase tracking-widest text-hb-olive mb-2">Verteilerschlüssel</p>
                        <div class="space-y-3">
                            <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Primärer Schlüssel</label>
                                <select id="fin-edit-acc-pk">
                                    <option value="">— Kein Schlüssel —</option>
                                    ${(_finState.distKeys || []).map(k => `<option value="${k.id}">${k.name} (${k.type})</option>`).join('')}
                                </select></div>
                            <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Sekundärer Schlüssel (HeizKV-Split)</label>
                                <select id="fin-edit-acc-sk" onchange="_finToggleSkPercent()">
                                    <option value="">— Keiner —</option>
                                    ${(_finState.distKeys || []).map(k => `<option value="${k.id}">${k.name} (${k.type})</option>`).join('')}
                                </select></div>
                            <div id="fin-edit-sk-pct-wrap" class="hidden">
                                <label class="text-xs font-semibold text-gray-500 mb-1 block">Anteil sekundärer Schlüssel (%)</label>
                                <input id="fin-edit-acc-sk-pct" type="number" min="0" max="100" step="0.01" placeholder="z.B. 30">
                                <p class="text-xs text-gray-400 mt-1">Restanteil wird dem primären Schlüssel zugeordnet.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSaveEditAccount()" class="btn-primary flex-1 text-sm py-2.5">Speichern</button>
                    <button onclick="document.getElementById('fin-account-edit-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>`;

    // Responsive tables
    makeTableResponsive(document.querySelector('#fin-content .card'));
}

window._finOpenNewAccountModal = () => {
    document.getElementById('fin-account-modal')?.classList.remove('hidden');
};

window._finSaveAccount = async () => {
    const number   = document.getElementById('fin-acc-number')?.value.trim();
    const name     = document.getElementById('fin-acc-name')?.value.trim();
    const type     = document.getElementById('fin-acc-type')?.value;
    const parentId = document.getElementById('fin-acc-parent')?.value || null;
    const reserve  = document.getElementById('fin-acc-reserve')?.value.trim();
    if (!number || !name) { showToast('Kontonummer und Bezeichnung sind Pflicht.', 'error'); return; }

    const allocatable = document.getElementById('fin-acc-allocatable')?.checked || false;

    const { error } = await _supabase.from('accounts').insert({
        building_id:       _finState.buildingId,
        account_number:    number,
        account_name:      name,
        account_type:      type,
        parent_account_id: parentId ? Number(parentId) : null,
        reserve_label:     reserve || null,
        is_allocatable:    allocatable,
        is_active:         true,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-account-modal')?.classList.add('hidden');
    showToast('Konto angelegt.', 'success');
    _finState.accounts = [];
    await _finLoadOverview();
};

window._finEditAccount = (accountId) => {
    const a = _finState.accounts.find(x => x.id == accountId);
    if (!a || a.is_system_account) return;
    document.getElementById('fin-edit-acc-id').value     = a.id;
    document.getElementById('fin-edit-acc-number').value = a.account_number || '';
    document.getElementById('fin-edit-acc-name').value   = a.account_name || '';
    document.getElementById('fin-edit-acc-type').value   = a.account_type || 'expense';
    document.getElementById('fin-edit-acc-parent').value = a.parent_account_id || '';
    document.getElementById('fin-edit-acc-reserve').value = a.reserve_label || '';
    const reserveWrap = document.getElementById('fin-edit-acc-reserve-wrap');
    if (reserveWrap) reserveWrap.style.display = a.is_reserve_account ? '' : 'none';
    document.getElementById('fin-edit-acc-allocatable').checked = !!a.is_allocatable;
    document.getElementById('fin-edit-acc-pk').value     = a.primary_key_id || '';
    document.getElementById('fin-edit-acc-sk').value     = a.secondary_key_id || '';
    document.getElementById('fin-edit-acc-sk-pct').value = a.secondary_key_percentage || '';
    _finToggleSkPercent();
    document.getElementById('fin-account-edit-modal')?.classList.remove('hidden');
};

window._finSaveEditAccount = async () => {
    const id       = document.getElementById('fin-edit-acc-id')?.value;
    const number   = document.getElementById('fin-edit-acc-number')?.value.trim();
    const name     = document.getElementById('fin-edit-acc-name')?.value.trim();
    const type     = document.getElementById('fin-edit-acc-type')?.value;
    const parentId = document.getElementById('fin-edit-acc-parent')?.value || null;
    const reserve  = document.getElementById('fin-edit-acc-reserve')?.value.trim();
    if (!number || !name) { showToast('Kontonummer und Bezeichnung sind Pflicht.', 'error'); return; }
    if (parentId && Number(parentId) === Number(id)) { showToast('Ein Konto kann nicht sein eigenes Unterkonto sein.', 'error'); return; }

    const pkId   = document.getElementById('fin-edit-acc-pk')?.value || null;
    const skId   = document.getElementById('fin-edit-acc-sk')?.value || null;
    const skPct  = document.getElementById('fin-edit-acc-sk-pct')?.value;

    const allocatable = document.getElementById('fin-edit-acc-allocatable')?.checked || false;

    const { error } = await _supabase.from('accounts').update({
        account_number:           number,
        account_name:             name,
        account_type:             type,
        parent_account_id:        parentId ? Number(parentId) : null,
        reserve_label:            reserve || null,
        is_allocatable:           allocatable,
        primary_key_id:           pkId || null,
        secondary_key_id:         skId || null,
        secondary_key_percentage: skId && skPct ? parseFloat(skPct) : null,
    }).eq('id', Number(id));
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-account-edit-modal')?.classList.add('hidden');
    showToast('Konto aktualisiert.', 'success');
    _finState.accounts = [];
    await _finLoadOverview();
};

window._finToggleSkPercent = () => {
    const sk = document.getElementById('fin-edit-acc-sk')?.value;
    const wrap = document.getElementById('fin-edit-sk-pct-wrap');
    if (wrap) wrap.classList.toggle('hidden', !sk);
};

window._finDeleteAccount = async (accountId) => {
    const a = _finState.accounts.find(x => x.id == accountId);
    if (!a || a.is_system_account) return;

    // Check for existing journal entries
    const { count } = await _supabase.from('journal_entries')
        .select('id', { count: 'exact', head: true })
        .or(`debit_account_id.eq.${accountId},credit_account_id.eq.${accountId}`);
    if (count > 0) {
        showToast('Konto kann nicht gelöscht werden — es existieren Buchungen auf dieses Konto.', 'error');
        return;
    }

    // Check for child accounts
    const hasChildren = _finState.accounts.some(x => x.parent_account_id == accountId);
    if (hasChildren) {
        showToast('Konto kann nicht gelöscht werden — es hat noch Unterkonten.', 'error');
        return;
    }

    if (!confirm(`Konto „${a.account_number} ${a.account_name}" wirklich löschen?`)) return;

    const { error } = await _supabase.from('accounts').update({ is_active: false }).eq('id', accountId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Konto gelöscht.', 'success');
    _finState.accounts = [];
    await _finLoadOverview();
};

window._finFilterOverview = (q) => {
    const typeLabels = { asset: 'Aktiva', liability: 'Passiva', equity: 'Eigenkapital', revenue: 'Ertrag', expense: 'Aufwand' };
    const typeBadge  = { asset: 'bg-hb-olive/10 text-hb-olive', liability: 'bg-hb-gold-soft/20 text-hb-gold-bold', equity: 'bg-hb-olive/10 text-hb-olive', revenue: 'bg-hb-success/12 text-hb-success', expense: 'bg-hb-orange/10 text-hb-orange' };
    const lower = q.toLowerCase();
    const saldoMap = _finState._saldoMap || {};
    const rows = _finState.accounts.filter(a =>
        !lower ||
        (a.account_number || '').toLowerCase().includes(lower) ||
        (a.account_name   || '').toLowerCase().includes(lower) ||
        (typeLabels[a.account_type] || '').toLowerCase().includes(lower)
    ).map(a => {
        const saldo = saldoMap[a.id] ?? 0;
        const saldoCls = saldo < 0 ? 'text-hb-error' : saldo > 0 ? 'text-hb-success' : 'text-gray-400';
        const isChild = !!a.parent_account_id;
        const namePrefix = isChild ? '<span class="text-gray-400 mr-1.5">└</span>' : '';
        const rowClass = isChild ? 'bg-gray-50/50' : '';
        const lockIcon2 = '<svg class="w-3 h-3 inline-block ml-1.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"/></svg>';
        const actions = a.is_system_account ? '' :
            `<button onclick="event.stopPropagation();_finEditAccount(${a.id})" title="Bearbeiten"
                class="text-xs text-hb-olive bg-hb-ultralight px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z"/></svg>
            </button>
            <button onclick="event.stopPropagation();_finDeleteAccount(${a.id})" title="Löschen"
                class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>`;
        return `<tr class="hover:bg-gray-50/60 transition-colors cursor-pointer ${rowClass}" onclick="_finOpenLedger(${a.id}, '${a.account_name.replace(/'/g, "\\'")}')">
            <td class="px-4 py-3 text-sm font-mono text-gray-500 ${isChild ? 'pl-8' : ''}">${a.account_number}</td>
            <td class="px-4 py-3 text-sm font-semibold text-hb-offblack">${namePrefix}${a.account_name}${a.reserve_label ? `<span class="ml-2 text-xs text-gray-400">(${a.reserve_label})</span>` : ''}${a.is_system_account ? lockIcon2 : ''}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-md ${typeBadge[a.account_type] || 'bg-gray-100 text-gray-600'}">${typeLabels[a.account_type] || a.account_type}</span></td>
            <td class="px-4 py-3 text-sm font-bold text-right ${saldoCls}">${saldo.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
            <td class="px-4 py-3 text-right" onclick="event.stopPropagation()"><div class="flex gap-1 justify-end">${actions}</div></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Treffer.</td></tr>';
    const tbody = document.getElementById('fin-overview-tbody');
    if (tbody) tbody.innerHTML = rows;
};

window._finOpenLedger = async (accountId, accountName) => {
    const el = document.getElementById('fin-content');
    el.innerHTML = `<div class="flex justify-center py-10"><div class="w-7 h-7 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const { data: entries } = await _supabase.from('journal_entries')
        .select('*, debit_account:accounts!debit_account_id(account_number,account_name), credit_account:accounts!credit_account_id(account_number,account_name)')
        .eq('building_id', _finState.buildingId)
        .or(`debit_account_id.eq.${accountId},credit_account_id.eq.${accountId}`)
        .order('entry_date', { ascending: true });

    let runningBalance = 0;
    const rows = (entries || []).map(e => {
        const isSoll   = e.debit_account_id  == accountId;
        const soll     = isSoll  ? Number(e.amount) : 0;
        const haben    = !isSoll ? Number(e.amount) : 0;
        runningBalance += soll - haben;
        const gegenkonto = isSoll
            ? `${e.credit_account?.account_number || ''} ${e.credit_account?.account_name || ''}`.trim()
            : `${e.debit_account?.account_number  || ''} ${e.debit_account?.account_name  || ''}`.trim();
        const saldoCls = runningBalance < 0 ? 'text-hb-error' : runningBalance > 0 ? 'text-hb-success' : 'text-gray-400';
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate" title="${gegenkonto}">${gegenkonto}</td>
            <td class="px-4 py-3 text-sm text-hb-offblack max-w-[200px] truncate" title="${e.description}">${e.description}</td>
            <td class="px-4 py-3 text-sm text-right">${soll > 0 ? soll.toLocaleString('de-DE', {minimumFractionDigits:2}) + ' €' : ''}</td>
            <td class="px-4 py-3 text-sm text-right">${haben > 0 ? haben.toLocaleString('de-DE', {minimumFractionDigits:2}) + ' €' : ''}</td>
            <td class="px-4 py-3 text-sm font-bold text-right ${saldoCls}">${runningBalance.toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen für dieses Konto.</td></tr>';

    el.innerHTML = `
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Kontoblatt: ${accountName}</span>
                <button onclick="_finLoadOverview()" class="text-xs text-white/80 hover:text-white font-semibold transition-colors">← Zurück zur Kontenübersicht</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Gegenkonto</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Beschreibung</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Soll</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Haben</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${rows}</tbody>
                </table>
            </div>
        </div>`;

    // Responsive tables
    makeTableResponsive(document.querySelector('#fin-content .card'));
};

// ─── Tab 2: Buchungen ─────────────────────────────────────────

async function _finLoadBookings() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const accounts = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accounts;

    const { data: apts } = await _supabase.from('apartments').select('id, apartment_number').eq('building_id', bid).order('apartment_number');
    _finState.apartments = apts || [];

    await _finRenderBookings();
}

async function _finRenderBookings() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    const accounts = _finState.accounts;

    const { data: entries } = await _supabase.from('journal_entries')
        .select('*, debit_account:accounts!debit_account_id(account_number,account_name), credit_account:accounts!credit_account_id(account_number,account_name), apartment:apartments(id,apartment_number)')
        .eq('building_id', bid)
        .eq('fiscal_year', fy)
        .order('entry_date', { ascending: false });
    _finState.entries = entries || [];

    const accOpts = accounts.map(a => `<option value="${a.id}">${a.account_number} – ${a.account_name}</option>`).join('');
    const aptOpts = '<option value="">– Keine Einheit –</option>' + _finState.apartments.map(a => `<option value="${a.id}">${a.apartment_number}</option>`).join('');

    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y===fy?'selected':''}>${y}</option>`).join('');

    const buildJournalRows = (filter = '') => {
        const q = filter.toLowerCase();
        return _finState.entries.filter(e =>
            !q ||
            (e.description || '').toLowerCase().includes(q) ||
            String(e.amount).includes(q) ||
            (e.debit_account?.account_name  || '').toLowerCase().includes(q) ||
            (e.credit_account?.account_name || '').toLowerCase().includes(q) ||
            (e.debit_account?.account_number  || '').toLowerCase().includes(q) ||
            (e.credit_account?.account_number || '').toLowerCase().includes(q)
        ).map(e => {
            const isStorno  = e.entry_type === 'storno';
            const hasStorno = _finState.entries.some(x => x.storno_of == e.id);
            const canStorno = !isStorno && !hasStorno && !e.is_locked;
            return `<tr class="hover:bg-gray-50/60 transition-colors cursor-pointer ${isStorno ? 'opacity-60' : ''}" onclick="_finOpenEntryDetail(${e.id})">
                <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
                <td class="px-4 py-3 text-sm text-hb-offblack max-w-[200px]">
                    <span class="truncate block" title="${e.description}">${e.description}</span>
                    ${e.apartment?.apartment_number ? `<span class="text-[10px] font-semibold bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded mt-0.5 inline-block">${e.apartment.apartment_number}</span>` : ''}
                </td>
                <td class="px-4 py-3 text-xs text-gray-600">${e.debit_account?.account_number} ${e.debit_account?.account_name}</td>
                <td class="px-4 py-3 text-xs text-gray-600">${e.credit_account?.account_number} ${e.credit_account?.account_name}</td>
                <td class="px-4 py-3 text-sm font-semibold text-right">${Number(e.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                    ${e.attachment_path ? `<button onclick="_finPreviewAttachment('${e.attachment_path}')" title="Beleg anzeigen" class="text-hb-olive hover:text-hb-olive/70"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>` : ''}
                    ${e.lohn_anteil_35a > 0 ? `<span class="text-xs bg-hb-orange/10 text-hb-orange font-semibold px-1.5 py-0.5 rounded ml-1">§35a</span>` : ''}
                </td>
                <td class="px-4 py-3 text-right" onclick="event.stopPropagation()">
                    ${isStorno ? '<span class="text-xs text-gray-400">Storno</span>' : ''}
                    ${canStorno ? `<button onclick="_finStorno(${e.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5 transition-colors">Storno</button>` : ''}
                </td>
            </tr>`;
        }).join('') || `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Keine Treffer.</td></tr>`;
    };
    const entryRows = buildJournalRows();
    const yearClosed = await _finIsYearClosed(bid, fy);
    const closedBanner = yearClosed
        ? `<div class="mb-4 px-4 py-3 rounded-2xl border border-hb-orange/30 bg-hb-orange/5 flex items-center gap-3">
               <svg class="w-5 h-5 text-hb-orange shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m5-7V7a5 5 0 00-10 0v4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2z"/></svg>
               <span class="text-sm text-hb-orange font-semibold">Wirtschaftsjahr ${fy} ist abgeschlossen — neue Buchungen sind gesperrt. Stornierungen bleiben möglich.</span>
           </div>`
        : '';

    document.getElementById('fin-content').innerHTML = `
        ${closedBanner}
        <!-- Buchungsmaske -->
        <div class="card p-5 mb-5${yearClosed ? ' opacity-50 pointer-events-none' : ''}">
            <h3 class="text-sm font-bold text-hb-offblack mb-4">Neue Buchung erfassen${yearClosed ? ' 🔒' : ''}</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Einheit (optional)</label>
                    <select id="fin-b-apt">${aptOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Datum *</label>
                    <input id="fin-b-date" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wertstellung</label>
                    <input id="fin-b-valdate" type="date"></div>
                <div class="md:col-span-2"><label class="text-xs font-semibold text-gray-500 mb-1 block">Beschreibung / Verwendungszweck *</label>
                    <input id="fin-b-desc" type="text" placeholder="z.B. Hausmeisterrechnung März"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Betrag (€) *</label>
                    <input id="fin-b-amount" type="number" step="0.01" min="0.01" placeholder="0,00"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Soll-Konto *</label>
                    <select id="fin-b-debit">${accOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Haben-Konto *</label>
                    <select id="fin-b-credit">${accOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Referenznummer</label>
                    <input id="fin-b-ref" type="text" placeholder="z.B. RE-2025-001"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">§35a EStG Lohnanteil (€)</label>
                    <input id="fin-b-35a" type="number" step="0.01" min="0" placeholder="0,00"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Beleg (PDF/Bild)</label>
                    <input id="fin-b-file" type="file" accept="application/pdf,image/*" style="height:auto;padding:6px 12px"></div>
            </div>
            <button onclick="_finSubmitBooking()" class="btn-primary mt-4 text-sm px-6 py-2.5">Buchen</button>
        </div>

        <!-- Journal-Tabelle -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center gap-3">
                <span class="text-sm font-bold text-white">Buchungsjournal</span>
                <div class="flex items-center gap-2 ml-auto">
                    <input id="fin-journal-search" type="text" placeholder="Suche…"
                        oninput="_finFilterJournal(this.value)"
                        class="text-xs h-7 px-3 rounded-lg bg-white border-0 text-hb-offblack w-44 focus:outline-none focus:ring-2 focus:ring-white/50">
                    <select onchange="_finChangeFY(this.value)" class="text-xs bg-white text-hb-olive font-bold px-2 py-1 rounded-lg border-0 cursor-pointer">${fyOpts}</select>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Beschreibung</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Soll</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Haben</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Beleg</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                    </tr></thead>
                    <tbody id="fin-journal-tbody" class="divide-y divide-hb-olive/10">${entryRows}</tbody>
                </table>
            </div>
        </div>

`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finChangeFY = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finRenderBookings();
};

window._finFilterJournal = (q) => {
    const lower = q.toLowerCase();
    const rows = _finState.entries.filter(e =>
        !lower ||
        (e.description || '').toLowerCase().includes(lower) ||
        String(e.amount).includes(lower) ||
        (e.debit_account?.account_name  || '').toLowerCase().includes(lower) ||
        (e.credit_account?.account_name || '').toLowerCase().includes(lower) ||
        (e.debit_account?.account_number  || '').toLowerCase().includes(lower) ||
        (e.credit_account?.account_number || '').toLowerCase().includes(lower)
    ).map(e => {
        const isStorno  = e.entry_type === 'storno';
        const hasStorno = _finState.entries.some(x => x.storno_of == e.id);
        const canStorno = !isStorno && !hasStorno && !e.is_locked;
        return `<tr class="hover:bg-gray-50/60 transition-colors cursor-pointer ${isStorno ? 'opacity-60' : ''}" onclick="_finOpenEntryDetail(${e.id})">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
            <td class="px-4 py-3 text-sm text-hb-offblack max-w-[200px]">
                <span class="truncate block" title="${e.description}">${e.description}</span>
                ${e.apartment?.apartment_number ? `<span class="text-[10px] font-semibold bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded mt-0.5 inline-block">${e.apartment.apartment_number}</span>` : ''}
            </td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.debit_account?.account_number} ${e.debit_account?.account_name}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.credit_account?.account_number} ${e.credit_account?.account_name}</td>
            <td class="px-4 py-3 text-sm font-semibold text-right">${Number(e.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
            <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                ${e.attachment_path ? `<button onclick="_finPreviewAttachment('${e.attachment_path}')" class="text-hb-olive hover:text-hb-olive/70"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>` : ''}
                ${e.lohn_anteil_35a > 0 ? `<span class="text-xs bg-hb-orange/10 text-hb-orange font-semibold px-1.5 py-0.5 rounded ml-1">§35a</span>` : ''}
            </td>
            <td class="px-4 py-3 text-right" onclick="event.stopPropagation()">
                ${isStorno ? '<span class="text-xs text-gray-400">Storno</span>' : ''}
                ${canStorno ? `<button onclick="_finStorno(${e.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5 transition-colors">Storno</button>` : ''}
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Keine Treffer.</td></tr>';
    const tbody = document.getElementById('fin-journal-tbody');
    if (tbody) tbody.innerHTML = rows;
};

window._finCloseEntryPanel = () => {
    const panel   = document.getElementById('fin-entry-panel');
    const overlay = document.getElementById('fin-entry-overlay');
    if (panel) { panel.style.transform = 'translateX(100%)'; setTimeout(() => panel.remove(), 300); }
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); }
};

window._finOpenEntryDetail = async (entryId) => {
    const e = _finState.entries.find(x => x.id == entryId);
    if (!e) return;

    // Remove existing panel if open
    document.getElementById('fin-entry-panel')?.remove();
    document.getElementById('fin-entry-overlay')?.remove();

    const entryTypeLabels = { manual: 'Manuelle Buchung', storno: 'Storno', hausgeld: 'Hausgeld', abrechnungsspitze: 'Abrechnungsspitze', ruecklage: 'Rücklage', erhoeffnungsbilanz: 'Eröffnungsbilanz', csv_import: 'CSV-Import' };
    const stornoHint = e.storno_of ? `<span class="text-xs text-hb-orange font-semibold">Storno von #${e.storno_of}</span>` : '';

    // Load attachments from journal_attachments table
    const { data: attachments } = await _supabase.from('journal_attachments')
        .select('id, attachment_path, created_at')
        .eq('journal_entry_id', entryId)
        .order('created_at', { ascending: true });

    let attachmentSection = '';
    const attachLinks = [];
    for (const att of (attachments || [])) {
        const { data: urlData } = await _supabase.storage.from('documents').createSignedUrl(att.attachment_path, 120);
        const fileName = att.attachment_path.split('/').pop().replace(/^\d+_/, '');
        attachLinks.push(urlData?.signedUrl
            ? `<a href="${urlData.signedUrl}" target="_blank" class="text-sm text-hb-olive font-semibold hover:underline flex items-center gap-1.5">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                ${fileName}</a>`
            : `<span class="text-sm text-gray-400">${fileName}</span>`
        );
    }
    attachmentSection = `
        <div>
            <p class="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Belege (${(attachments||[]).length})</p>
            <div class="flex flex-col gap-1.5">${attachLinks.join('')}</div>
            <button onclick="_finUploadAttachment(${e.id})" class="mt-2 text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">+ Beleg hinzufügen</button>
        </div>`;

    const field = (label, value) => (!value || value === '—') ? '' :
        `<div><p class="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">${label}</p>
         <p class="text-sm font-semibold text-hb-offblack">${value}</p></div>`;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'fin-entry-overlay';
    overlay.onclick = _finCloseEntryPanel;
    Object.assign(overlay.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.2)', zIndex:'49', opacity:'0', transition:'opacity 0.3s' });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');

    // Panel
    const panel = document.createElement('div');
    panel.id = 'fin-entry-panel';
    Object.assign(panel.style, { position:'fixed', right:'0', top:'0', height:'100%', width:'420px', maxWidth:'100vw', zIndex:'50', transform:'translateX(100%)', transition:'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)', display:'flex', flexDirection:'column', backgroundColor:'#F5F5F5', boxShadow:'-4px 0 24px rgba(0,0,0,0.1)' });
    const canEdit = !e.is_locked && e.entry_type !== 'storno';
    panel.innerHTML = `
        <div style="background:#687451;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
            <div>
                <span style="font-size:14px;font-weight:700;color:white">Buchungsdetail #${e.id}</span>
                <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                    <span style="font-size:11px;font-weight:600;background:rgba(255,255,255,0.2);color:white;padding:1px 8px;border-radius:6px">${entryTypeLabels[e.entry_type] || e.entry_type}</span>
                    ${e.is_locked ? '<span style="font-size:11px;font-weight:600;background:rgba(235,118,45,0.3);color:white;padding:1px 8px;border-radius:6px">🔒 Gesperrt</span>' : ''}
                    ${stornoHint}
                </div>
            </div>
            <button onclick="_finCloseEntryPanel()" style="color:rgba(255,255,255,0.8);background:none;border:none;cursor:pointer;font-size:22px;line-height:1;padding:4px">×</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:20px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                ${field('Datum', _finFormatDate(e.entry_date))}
                ${field('Wirtschaftsjahr', e.fiscal_year)}
                ${field('Wertstellung', _finFormatDate(e.value_date))}
                ${field('Einheit', e.apartment?.apartment_number || '—')}
                <div style="grid-column:1/-1">${field('Soll-Konto', `${e.debit_account?.account_number || ''} ${e.debit_account?.account_name || ''}`.trim())}</div>
                <div style="grid-column:1/-1">${field('Haben-Konto', `${e.credit_account?.account_number || ''} ${e.credit_account?.account_name || ''}`.trim())}</div>
                ${field('Betrag', Number(e.amount).toLocaleString('de-DE', {minimumFractionDigits:2}) + ' €')}
                ${field('Referenznummer', e.reference_number)}
                ${Number(e.lohn_anteil_35a) > 0 ? field('§35a Lohnanteil', Number(e.lohn_anteil_35a).toLocaleString('de-DE', {minimumFractionDigits:2}) + ' €') : ''}
                <div style="grid-column:1/-1">${field('Beschreibung', e.description)}</div>
                <div style="grid-column:1/-1">${attachmentSection}</div>
            </div>
        </div>
        ${canEdit ? `
        <div style="padding:16px 20px;border-top:1px solid rgba(104,116,81,0.12);flex-shrink:0;display:flex;gap:8px">
            <button onclick="_finEditEntry(${e.id})" style="flex:1;background:#687451;color:white;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">Metadaten bearbeiten</button>
        </div>` : ''}
        `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.style.transform = 'translateX(0)');
};

window._finUploadAttachment = (entryId) => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const bid  = _finState.buildingId;
        const path = `belege/${bid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        showToast('Beleg wird hochgeladen…', 'success');
        const { error: upErr } = await _supabase.storage.from('documents').upload(path, file);
        if (upErr) { showToast('Upload fehlgeschlagen: ' + upErr.message, 'error'); return; }
        const { error } = await _supabase.from('journal_attachments').insert({
            journal_entry_id: entryId,
            attachment_path:  path,
            uploaded_by:      currentUser?.id || null,
        });
        if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
        showToast('Beleg gespeichert.', 'success');
        _finCloseEntryPanel();
        _finOpenEntryDetail(entryId);
    };
    input.click();
};

window._finEditEntry = (entryId) => {
    const e = _finState.entries.find(x => x.id == entryId);
    if (!e) return;
    const aptOpts = '<option value="">– Keine Einheit –</option>' +
        (_finState.apartments || []).map(a =>
            `<option value="${a.id}" ${e.apartment_id == a.id ? 'selected' : ''}>${a.apartment_number}</option>`
        ).join('');

    const modal = document.createElement('div');
    modal.id = 'fin-entry-edit-modal';
    modal.innerHTML = `<div class="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onclick="if(event.target===this)document.getElementById('fin-entry-edit-modal').remove()">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 class="text-base font-bold text-hb-offblack mb-1">Buchung bearbeiten #${e.id}</h3>
            <p class="text-xs text-gray-400 mb-4">Finanzielle Felder (Konten, Betrag, Datum) sind GoBD-geschützt und können nicht geändert werden. Bitte Storno + Neubuchung für Korrekturen nutzen.</p>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Einheit (Direktzuweisung)</label>
                    <select id="fee-apt" class="w-full text-sm rounded-lg border border-gray-200 bg-hb-ultralight px-3 py-2">${aptOpts}</select>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Beschreibung</label>
                    <input id="fee-desc" type="text" value="${(e.description || '').replace(/"/g, '&quot;')}" class="w-full text-sm rounded-lg border border-gray-200 bg-hb-ultralight px-3 py-2">
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Referenznummer</label>
                    <input id="fee-ref" type="text" value="${e.reference_number || ''}" class="w-full text-sm rounded-lg border border-gray-200 bg-hb-ultralight px-3 py-2">
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">§35a Lohnanteil (€)</label>
                    <input id="fee-35a" type="number" step="0.01" min="0" value="${e.lohn_anteil_35a || ''}" class="w-full text-sm rounded-lg border border-gray-200 bg-hb-ultralight px-3 py-2">
                </div>
            </div>
            <div class="flex gap-3 justify-end mt-5">
                <button onclick="document.getElementById('fin-entry-edit-modal').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_finSaveEntryEdit(${entryId})" class="btn-primary text-sm px-5 py-2">Speichern</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window._finSaveEntryEdit = async (entryId) => {
    const aptVal = document.getElementById('fee-apt')?.value;
    const desc   = document.getElementById('fee-desc')?.value || '';
    const ref    = document.getElementById('fee-ref')?.value || null;
    const lohn   = parseFloat(document.getElementById('fee-35a')?.value) || null;

    const { error } = await _supabase.from('journal_entries').update({
        apartment_id:    aptVal ? Number(aptVal) : null,
        description:     desc,
        reference_number: ref || null,
        lohn_anteil_35a: lohn,
    }).eq('id', entryId);

    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    document.getElementById('fin-entry-edit-modal')?.remove();
    _finCloseEntryPanel();
    await _finRenderBookings();
    showToast('Buchung aktualisiert.', 'success');
};

window._finSubmitBooking = async () => {
    const bid     = _finState.buildingId;
    const aptVal  = document.getElementById('fin-b-apt')?.value;
    const date    = document.getElementById('fin-b-date')?.value;
    const valDate = document.getElementById('fin-b-valdate')?.value;
    const desc    = document.getElementById('fin-b-desc')?.value.trim();
    const amount  = parseFloat(document.getElementById('fin-b-amount')?.value);
    const debitId = document.getElementById('fin-b-debit')?.value;
    const creditId= document.getElementById('fin-b-credit')?.value;
    const ref     = document.getElementById('fin-b-ref')?.value.trim();
    const lohn35a = parseFloat(document.getElementById('fin-b-35a')?.value) || null;
    const file    = document.getElementById('fin-b-file')?.files?.[0];

    if (!date || !desc || !amount || amount <= 0 || !debitId || !creditId) {
        showToast('Bitte alle Pflichtfelder ausfüllen.', 'error'); return;
    }
    if (debitId === creditId) {
        showToast('Soll- und Haben-Konto dürfen nicht identisch sein.', 'error'); return;
    }

    let attachmentPath = null;
    if (file) {
        const ext  = file.name.split('.').pop();
        const path = `belege/${bid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error: upErr } = await _supabase.storage.from('documents').upload(path, file);
        if (upErr) { showToast('Beleg-Upload fehlgeschlagen: ' + upErr.message, 'error'); return; }
        attachmentPath = path;
    }

    const fy = new Date(date).getFullYear();

    // Journal-Sperre: abgeschlossene Jahre blockieren
    if (await _finBlockIfYearClosed(bid, fy)) return;

    const { error } = await _supabase.from('journal_entries').insert({
        building_id:       bid,
        apartment_id:      aptVal ? Number(aptVal) : null,
        entry_date:        date,
        value_date:        valDate || null,
        description:       desc,
        amount:            amount,
        debit_account_id:  Number(debitId),
        credit_account_id: Number(creditId),
        reference_number:  ref || null,
        entry_type:        'manual',
        fiscal_year:       fy,
        attachment_path:   attachmentPath,
        lohn_anteil_35a:   lohn35a,
        created_by:        currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Buchung gespeichert.', 'success');
    await _finRenderBookings();
};

window._finStorno = async (entryId) => {
    if (!confirm('Gegenbuchung (Storno) erstellen?')) return;
    const orig = _finState.entries.find(e => e.id == entryId);
    if (!orig) return;

    const { error } = await _supabase.from('journal_entries').insert({
        building_id:       orig.building_id,
        apartment_id:      orig.apartment_id,
        entry_date:        new Date().toISOString().split('T')[0],
        description:       'Storno: ' + orig.description,
        amount:            orig.amount,
        debit_account_id:  orig.credit_account_id,   // umgekehrt
        credit_account_id: orig.debit_account_id,
        entry_type:        'storno',
        storno_of:         orig.id,
        fiscal_year:       orig.fiscal_year,
        created_by:        currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Storno-Buchung erstellt.', 'success');
    await _finRenderBookings();
};

window._finPreviewAttachment = async (path) => {
    const { data } = await _supabase.storage.from('documents').createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
};

// ─── Tab 3: Zählerstände ──────────────────────────────────────

async function _finLoadMeters() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const [{ data: apts }, { data: meters }, { data: lastReadings }] = await Promise.all([
        _supabase.from('apartments').select('id, apartment_number').eq('building_id', bid).order('apartment_number'),
        _supabase.from('meters').select('*').in('apartment_id',
            (await _supabase.from('apartments').select('id').eq('building_id', bid)).data?.map(a => a.id) || []
        ).eq('is_active', true),
        _supabase.from('meter_readings').select('meter_id, reading_value, reading_date')
            .order('reading_date', { ascending: false }),
    ]);

    _finState.apartments = apts || [];
    _finState.meters     = meters || [];

    // Letzten Wert pro Zähler
    const lastMap = {};
    for (const r of (lastReadings || [])) {
        if (!lastMap[r.meter_id]) lastMap[r.meter_id] = r.reading_value;
    }
    _finState.lastReadings = lastMap;

    _finRenderMeters();
}

function _finRenderMeters() {
    const apts    = _finState.apartments;
    const meters  = _finState.meters;
    const lastMap = _finState.lastReadings;

    // Zähler nach Einheit gruppieren
    const metersByApt = {};
    for (const m of meters) {
        if (!metersByApt[m.apartment_id]) metersByApt[m.apartment_id] = [];
        metersByApt[m.apartment_id].push(m);
    }

    const typeLabels = { electricity: 'Strom', water: 'Wasser', water_warm: 'Warmwasser', heating: 'Heizung' };

    const rows = apts.map(apt => {
        const aptMeters = metersByApt[apt.id] || [];
        if (!aptMeters.length) return `<tr><td class="px-4 py-3 text-sm font-semibold">${apt.apartment_number}</td><td colspan="4" class="px-4 py-3 text-xs text-gray-400">Keine Zähler erfasst</td></tr>`;

        const cells = ['electricity','water','water_warm','heating'].map(type => {
            const m = aptMeters.find(x => x.meter_type === type);
            if (!m) return `<td class="px-4 py-3 text-xs text-gray-300 text-center">–</td>`;
            const last = lastMap[m.id];
            return `<td class="px-4 py-3">
                <div class="text-[10px] text-gray-400 mb-0.5">${m.meter_number || '–'}</div>
                <input type="number" step="0.001" data-meter-id="${m.id}"
                    placeholder="${last !== undefined ? last : ''}"
                    class="w-28 text-sm text-center rounded-lg border border-gray-200 bg-hb-ultralight px-2 py-1 focus:border-hb-olive focus:outline-none">
            </td>`;
        }).join('');

        return `<tr class="hover:bg-gray-50/50"><td class="px-4 py-3 text-sm font-semibold">${apt.apartment_number}</td>${cells}</tr>`;
    }).join('');

    // Ablesehistorie (letzte 20)
    const historyData = Object.entries(_finState.lastReadings).slice(0, 20);

    document.getElementById('fin-content').innerHTML = `
        <!-- Schnelleingabe -->
        <div class="card overflow-hidden mb-5">
            <div class="bg-hb-olive px-5 py-3 flex flex-wrap justify-between items-center gap-3">
                <span class="text-sm font-bold text-white">Zählerstand-Erfassung</span>
                <div class="flex gap-2 items-center flex-wrap">
                    <input id="fin-z-date" type="date" value="${new Date().toISOString().split('T')[0]}"
                        class="text-xs rounded-lg px-3 py-1.5 border-0 bg-white/90 h-auto w-auto text-hb-offblack font-semibold">
                    <select id="fin-z-type" class="text-xs rounded-lg px-3 py-1.5 border-0 bg-white/90 h-auto w-auto text-hb-offblack font-semibold">
                        <option value="regulaer">Regulär</option>
                        <option value="jahresablesung">Jahresablesung</option>
                        <option value="einzug">Einzug</option>
                        <option value="auszug">Auszug</option>
                    </select>
                    <button onclick="_finSaveReadings()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Alle speichern</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Strom</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Wasser</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Warmwasser</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Heizung</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${rows || '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Einheiten/Zähler vorhanden.</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- Letzte Ablesungen -->
        <div id="fin-z-history" class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3">
                <span class="text-sm font-bold text-white">Ablesehistorie (letzte 20)</span>
            </div>
            <div class="px-5 py-8 text-center text-sm text-gray-400">Wird nach dem ersten Speichern angezeigt.</div>
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finSaveReadings = async () => {
    const date  = document.getElementById('fin-z-date')?.value;
    const rtype = document.getElementById('fin-z-type')?.value;
    if (!date) { showToast('Stichtag fehlt.', 'error'); return; }

    const inputs = document.querySelectorAll('[data-meter-id]');
    const inserts = [];
    for (const inp of inputs) {
        const val = inp.value.trim();
        if (!val) continue;
        inserts.push({
            meter_id:     Number(inp.dataset.meterId),
            reading_value: parseFloat(val),
            reading_date: date,
            reading_type: rtype,
            recorded_by:  currentUser.id,
        });
    }
    if (!inserts.length) { showToast('Keine Werte eingegeben.', 'error'); return; }

    const { error } = await _supabase.from('meter_readings').insert(inserts);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(`${inserts.length} Ablesungen gespeichert.`, 'success');
    await _finLoadMeters();
};

// ─── Tab 4: Sollstellungen ────────────────────────────────────

async function _finLoadDemands() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const [{ data: demands }, { data: apts }] = await Promise.all([
        _supabase.from('payment_demands')
            .select('*, apartment:apartments(apartment_number), person:persons(first_name, last_name)')
            .eq('building_id', bid)
            .eq('fiscal_year', fy)
            .eq('demand_type', 'hausgeld')
            .order('due_date'),
        _supabase.from('apartments').select('id, apartment_number, hausgeld').eq('building_id', bid),
    ]);
    _finState.demands   = demands || [];
    _finState.apartments = apts || [];

    _finRenderDemands();
}

function _finRenderDemands() {
    const fy      = _finState.fiscalYear;
    const demands = _finState.demands;
    const today   = new Date().toISOString().split('T')[0];
    const fyOpts  = [fy+1, fy, fy-1].map(y => `<option value="${y}" ${y===fy?'selected':''}>${y}</option>`).join('');

    const statusBadge = (d) => {
        if (d.status === 'paid') return '<span class="text-xs bg-hb-success/12 text-hb-success font-semibold px-2 py-0.5 rounded-md">Bezahlt</span>';
        if (d.due_date < today) return '<span class="text-xs bg-hb-orange/15 text-hb-orange font-semibold px-2 py-0.5 rounded-md">Überfällig</span>';
        return '<span class="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">Offen</span>';
    };

    const rows = demands.map(d => `
        <tr class="hover:bg-gray-50/60 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(d.due_date)}</td>
            <td class="px-4 py-3 text-sm font-semibold">${d.apartment?.apartment_number || '–'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${d.person ? (d.person.first_name + ' ' + d.person.last_name) : '–'}</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(d.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
            <td class="px-4 py-3">${statusBadge(d)}</td>
            <td class="px-4 py-3 text-right">
                ${d.status !== 'paid' ? `<button onclick="_finMarkPaid(${d.id})" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Als bezahlt markieren</button>` : ''}
            </td>
        </tr>`).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Generierung -->
        <div class="card p-5 mb-5">
            <h3 class="text-sm font-bold text-hb-offblack mb-3">Sollstellungen generieren</h3>
            <div class="flex flex-wrap gap-3 items-end">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wirtschaftsjahr</label>
                    <select id="fin-s-fy" onchange="_finChangeFySolls(this.value)" class="w-32">${fyOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Fälligkeitstag</label>
                    <input id="fin-s-day" type="number" min="1" max="28" value="1" class="w-20"></div>
                <button onclick="_finGenerateDemands()" class="btn-primary text-sm px-5 py-2.5">Sollstellungen generieren</button>
            </div>
            <p class="text-xs text-gray-400 mt-2">Erstellt je 12 monatliche Hausgeld-Sollstellungen für alle aktiven Eigentümer. Bereits vorhandene werden übersprungen.</p>
        </div>

        <!-- Tabelle -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Sollstellungen ${fy}</span>
                <span class="text-xs text-white/70">${demands.length} Einträge</span>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Fälligkeit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Person</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Status</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${rows || `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Sollstellungen für ${fy}. Bitte generieren.</td></tr>`}</tbody>
            </table>
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finChangeFySolls = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finLoadDemands();
};

window._finGenerateDemands = async () => {
    const bid = _finState.buildingId;
    const fy  = Number(document.getElementById('fin-s-fy')?.value) || _finState.fiscalYear;
    const day = Number(document.getElementById('fin-s-day')?.value) || 1;

    // Journal-Sperre: abgeschlossene Jahre blockieren
    if (await _finBlockIfYearClosed(bid, fy)) return;

    // Aktive Eigentümer mit Einheit + Hausgeld
    const { data: ownerships } = await _supabase.from('ownerships')
        .select('id, owner_id, apartment_id, apartment:apartments(apartment_number, hausgeld, building_id)')
        .eq('is_active', true);
    const relevant = (ownerships || []).filter(o => o.apartment?.building_id == bid);

    if (!relevant.length) { showToast('Keine aktiven Eigentümer für dieses Gebäude gefunden.', 'error'); return; }

    // Bereits vorhandene Sollstellungen laden
    const { data: existing } = await _supabase.from('payment_demands')
        .select('apartment_id, due_date')
        .eq('building_id', bid)
        .eq('fiscal_year', fy)
        .eq('demand_type', 'hausgeld');
    const existingSet = new Set((existing || []).map(e => `${e.apartment_id}_${e.due_date}`));

    // Konten für Journal-Einträge holen
    const accounts = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accounts;
    const acc1400 = accounts.find(a => a.account_number === '1400');
    const acc8400 = accounts.find(a => a.account_number === '8400');

    const demandsToInsert = [];
    const journalsToInsert = [];

    for (const o of relevant) {
        const dynHG = await getMonthlyHausgeld(o.apartment_id, bid);
        const hausgeld = dynHG ?? Number(o.apartment?.hausgeld || 0);
        if (!hausgeld) continue;

        for (let m = 1; m <= 12; m++) {
            const dueDate = `${fy}-${String(m).padStart(2,'0')}-${String(Math.min(day,28)).padStart(2,'0')}`;
            const key = `${o.apartment_id}_${dueDate}`;
            if (existingSet.has(key)) continue;

            const demandObj = {
                building_id:  bid,
                apartment_id: o.apartment_id,
                person_id:    o.owner_id,
                demand_type:  'hausgeld',
                amount:       hausgeld,
                due_date:     dueDate,
                fiscal_year:  fy,
                status:       'open',
                created_at:   new Date().toISOString(),
            };
            demandsToInsert.push(demandObj);

            if (acc1400 && acc8400) {
                journalsToInsert.push({
                    building_id:       bid,
                    apartment_id:      o.apartment_id,
                    entry_date:        dueDate,
                    description:       `Hausgeld ${String(m).padStart(2,'0')}/${fy} – ${o.apartment?.apartment_number || ''}`,
                    amount:            hausgeld,
                    debit_account_id:  acc1400.id,
                    credit_account_id: acc8400.id,
                    entry_type:        'sollstellung',
                    fiscal_year:       fy,
                    created_by:        currentUser.id,
                });
            }
        }
    }

    if (!demandsToInsert.length) { showToast('Alle Sollstellungen für dieses Jahr sind bereits vorhanden.', 'error'); return; }

    const { error } = await _supabase.from('payment_demands').insert(demandsToInsert);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    if (journalsToInsert.length) await _supabase.from('journal_entries').insert(journalsToInsert);

    showToast(`${demandsToInsert.length} Sollstellungen erstellt.`, 'success');
    _finState.fiscalYear = fy;
    await _finLoadDemands();
};

window._finMarkPaid = async (demandId) => {
    const { error } = await _supabase.from('payment_demands')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', demandId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Als bezahlt markiert.', 'success');
    await _finLoadDemands();
};

// ─── Tab 5: Onboarding ────────────────────────────────────────

function _finRenderOnboarding() {
    const step = _finState.onboardStep;
    const bid  = _finState.buildingId;

    const stepDots = [1,2,3].map(i =>
        `<div class="flex items-center gap-2 ${i <= step ? 'text-hb-olive' : 'text-gray-300'}">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i === step ? 'bg-hb-olive text-white border-hb-olive' : i < step ? 'bg-hb-olive/20 text-hb-olive border-hb-olive/30' : 'bg-gray-50 border-gray-200 text-gray-300'}">${i}</div>
            <span class="text-xs font-semibold hidden sm:block">${['Stichtag','Bankkonten','Offene Posten'][i-1]}</span>
            ${i < 3 ? '<div class="w-8 h-px bg-gray-200 mx-1"></div>' : ''}
        </div>`
    ).join('');

    let stepContent = '';

    if (step === 1) {
        const buildingOpts = _finState.buildings.map(b =>
            `<option value="${b.id}" ${b.id == bid ? 'selected' : ''}>${formatBuildingName(b)}</option>`
        ).join('');
        stepContent = `
            <div class="max-w-md mx-auto space-y-4">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Gebäude</label>
                    <select id="ob-building" onchange="_finOnBuildingChange(this.value)">${buildingOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Stichtag</label>
                    <input id="ob-date" type="date" value="${new Date().getFullYear()}-01-01"></div>
                <div class="bg-hb-olive/5 border border-hb-olive/12 rounded-2xl p-4 text-sm text-gray-600">
                    Alle Salden werden zum gewählten Stichtag als Eröffnungsbuchung hinterlegt. Dieser Schritt kann pro Gebäude nur einmal sinnvoll durchgeführt werden.
                </div>
                <button onclick="_finOBNext(1)" class="btn-primary w-full text-sm py-3">Weiter →</button>
            </div>`;
    } else if (step === 2) {
        const rows = (_finState.onboardBankRows || []).map((b,i) => `
            <tr class="hover:bg-gray-50/50">
                <td class="px-4 py-3 text-sm font-semibold">${b.bank_name}</td>
                <td class="px-4 py-3 text-xs text-gray-500">${b.iban}</td>
                <td class="px-4 py-3 text-xs text-gray-400">${b.account_type}</td>
                <td class="px-4 py-3"><input type="number" step="0.01" data-bank-idx="${i}" placeholder="0,00"
                    class="w-32 text-sm text-right rounded-lg border border-gray-200 bg-hb-ultralight px-2 py-1 focus:border-hb-olive focus:outline-none"></td>
            </tr>`).join('');
        stepContent = `
            <div class="mb-4 text-sm text-gray-500">Gib den aktuellen Saldo jedes Bankkontos zum Stichtag ein.</div>
            <div class="card overflow-hidden mb-5">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Bank</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">IBAN</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Startsaldo (€)</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${rows || '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-gray-400">Keine Bankkonten für dieses Gebäude gefunden.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="flex gap-3">
                <button onclick="_finState.onboardStep=1;_finRenderOnboarding()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
                <button onclick="_finOBNext(2)" class="btn-primary text-sm px-5 py-2.5">Weiter →</button>
            </div>`;
    } else if (step === 3) {
        const rows = (_finState.onboardOwnerRows || []).map((o,i) => `
            <tr class="hover:bg-gray-50/50">
                <td class="px-4 py-3 text-sm font-semibold">${o.apartment_number}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${o.owner_name}</td>
                <td class="px-4 py-3 text-xs text-gray-400">${Number(o.hausgeld || 0).toFixed(2)} €/Monat</td>
                <td class="px-4 py-3"><input type="number" step="0.01" data-owner-idx="${i}" placeholder="0,00"
                    title="Positiv = offene Schulden, Negativ = Guthaben"
                    class="w-32 text-sm text-right rounded-lg border border-gray-200 bg-hb-ultralight px-2 py-1 focus:border-hb-olive focus:outline-none"></td>
            </tr>`).join('');
        stepContent = `
            <div class="mb-4 text-sm text-gray-500">Trage offene Beträge der Eigentümer zum Stichtag ein. <strong>Positiv = Schulden</strong>, <strong>Negativ = Guthaben</strong>.</div>
            <div class="card overflow-hidden mb-5">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Eigentümer</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Hausgeld</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Offener Betrag (€)</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${rows || '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-gray-400">Keine aktiven Eigentümer gefunden.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="flex gap-3">
                <button onclick="_finState.onboardStep=2;_finRenderOnboarding()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
                <button onclick="_finOBComplete()" class="btn-primary text-sm px-5 py-2.5">Onboarding abschließen ✓</button>
            </div>`;
    }

    document.getElementById('fin-content').innerHTML = `
        <div class="card p-6 max-w-2xl">
            <h3 class="text-base font-extrabold text-hb-offblack mb-1">Buchhaltungs-Onboarding</h3>
            <p class="text-[15px] text-gray-400 mb-5">Eröffnungssalden und Altbestände erfassen.</p>
            <div class="flex items-center gap-1 mb-6">${stepDots}</div>
            ${stepContent}
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });
}

window._finOBNext = async (fromStep) => {
    const bid = _finState.buildingId;

    if (fromStep === 1) {
        const date = document.getElementById('ob-date')?.value;
        if (!date) { showToast('Bitte Stichtag wählen.', 'error'); return; }
        _finState.obDate = date;

        const { data: bankAccounts } = await _supabase.from('building_bank_accounts')
            .select('id, bank_name, iban, account_type, current_balance')
            .eq('building_id', bid);
        _finState.onboardBankRows = bankAccounts || [];
        _finState.onboardStep = 2;
        _finRenderOnboarding();

    } else if (fromStep === 2) {
        // Bankzeilen mit eingegebenen Werten merken
        document.querySelectorAll('[data-bank-idx]').forEach(inp => {
            const idx = Number(inp.dataset.bankIdx);
            if (_finState.onboardBankRows[idx]) _finState.onboardBankRows[idx]._inputValue = inp.value;
        });

        const { data: ownerships } = await _supabase.from('ownerships')
            .select('id, owner_id, apartment_id, apartment:apartments(apartment_number, hausgeld, building_id), owner:persons!ownerships_owner_id_fkey(first_name, last_name)')
            .eq('is_active', true);
        _finState.onboardOwnerRows = (ownerships || [])
            .filter(o => o.apartment?.building_id == bid)
            .map(o => ({
                ownership_id:    o.id,
                owner_id:        o.owner_id,
                apartment_id:    o.apartment_id,
                apartment_number: o.apartment?.apartment_number,
                owner_name:      o.owner ? (o.owner.first_name + ' ' + o.owner.last_name) : '–',
                hausgeld:        o.apartment?.hausgeld,
            }));
        _finState.onboardStep = 3;
        _finRenderOnboarding();
    }
};

window._finOBComplete = async () => {
    const bid   = _finState.buildingId;
    const date  = _finState.obDate;
    const fy    = new Date(date).getFullYear();
    if (!bid || !date) { showToast('Stichtag fehlt.', 'error'); return; }

    // Konten sicherstellen
    const accounts = await _finGetAccounts(bid);
    const getAcc = (num) => accounts.find(a => a.account_number === num);

    const journals = [];

    // Schritt 2: Banksalden
    document.querySelectorAll('[data-bank-idx]').forEach(inp => {
        const idx = Number(inp.dataset.bankIdx);
        if (_finState.onboardBankRows[idx]) _finState.onboardBankRows[idx]._inputValue = inp.value;
    });

    for (const b of _finState.onboardBankRows) {
        const val = parseFloat(b._inputValue);
        if (!val) continue;
        const isRuecklage = b.account_type === 'ruecklage';
        const debitAcc  = getAcc(isRuecklage ? '1210' : '1200');
        const creditAcc = getAcc(isRuecklage ? '3000' : '8400');
        if (!debitAcc || !creditAcc) continue;
        journals.push({
            building_id:       bid,
            entry_date:        date,
            description:       `Eröffnungsbilanz – ${b.bank_name} (${b.iban})`,
            amount:            Math.abs(val),
            debit_account_id:  val > 0 ? debitAcc.id : creditAcc.id,
            credit_account_id: val > 0 ? creditAcc.id : debitAcc.id,
            entry_type:        'erhoeffnungsbilanz',
            fiscal_year:       fy,
            created_by:        currentUser.id,
        });
    }

    // Schritt 3: Offene Posten
    document.querySelectorAll('[data-owner-idx]').forEach(inp => {
        const idx = Number(inp.dataset.ownerIdx);
        if (_finState.onboardOwnerRows[idx]) _finState.onboardOwnerRows[idx]._inputValue = inp.value;
    });

    const demands = [];
    const acc1400 = getAcc('1400'), acc8400 = getAcc('8400');
    for (const o of _finState.onboardOwnerRows) {
        const val = parseFloat(o._inputValue);
        if (!val) continue;
        demands.push({
            building_id:  bid,
            apartment_id: o.apartment_id,
            person_id:    o.owner_id,
            demand_type:  'hausgeld',
            amount:       Math.abs(val),
            due_date:     date,
            fiscal_year:  fy,
            status:       val > 0 ? 'open' : 'paid',
            notes:        'Altbestand aus Onboarding',
        });
        if (acc1400 && acc8400 && val > 0) {
            journals.push({
                building_id:       bid,
                apartment_id:      o.apartment_id,
                entry_date:        date,
                description:       `Offener Posten Onboarding – ${o.apartment_number} (${o.owner_name})`,
                amount:            Math.abs(val),
                debit_account_id:  acc1400.id,
                credit_account_id: acc8400.id,
                entry_type:        'erhoeffnungsbilanz',
                fiscal_year:       fy,
                created_by:        currentUser.id,
            });
        }
    }

    if (!journals.length && !demands.length) { showToast('Keine Werte eingegeben.', 'error'); return; }

    const results = await Promise.all([
        journals.length ? _supabase.from('journal_entries').insert(journals) : Promise.resolve({}),
        demands.length  ? _supabase.from('payment_demands').insert(demands)  : Promise.resolve({}),
    ]);
    const err = results.find(r => r.error);
    if (err) { showToast('Fehler: ' + err.error.message, 'error'); return; }

    showToast('Onboarding abgeschlossen! Eröffnungsbuchungen wurden gespeichert.', 'success');
    _finState.onboardStep = 1;
    _finState.onboardBankRows  = [];
    _finState.onboardOwnerRows = [];
    await _finSwitchTab('uebersicht');
};

// ============================================================
// ─── Tab 5: Wirtschaftsplan & Sonderumlagen ──────────────────
// ============================================================

async function _finLoadWirtschaftsplan() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const accounts = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accounts;

    const [{ data: plans }, { data: levies }] = await Promise.all([
        _supabase.from('budget_plans').select('*').eq('building_id', bid).order('fiscal_year', { ascending: false }),
        _supabase.from('special_levies').select('*').eq('building_id', bid).order('due_date', { ascending: false }),
    ]);
    _finState.plans        = plans || [];
    _finState.sonderumlagen = levies || [];

    // Aktiven Plan für gewähltes Jahr finden
    const plan = _finState.plans.find(p => p.fiscal_year == fy) || null;
    _finState.selectedPlanId = plan?.id || null;

    let planItems = [];
    if (plan) {
        const { data: items } = await _supabase.from('budget_plan_items')
            .select('*, account:accounts(account_number, account_name)')
            .eq('budget_plan_id', plan.id)
            .order('id');
        planItems = items || [];
    }
    _finState.planItems = planItems;

    _finRenderWirtschaftsplan(plan, planItems);
}

function _finRenderWirtschaftsplan(plan, planItems) {
    const fy  = _finState.fiscalYear;
    const bid = _finState.buildingId;
    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y==fy?'selected':''}>${y}</option>`).join('');

    const statusBadge = (s) => ({
        draft:    '<span class="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">Entwurf</span>',
        approved: '<span class="text-xs bg-hb-olive/10 text-hb-olive font-semibold px-2 py-0.5 rounded-md">Beschlossen</span>',
        active:   '<span class="text-xs bg-hb-success/12 text-hb-success font-semibold px-2 py-0.5 rounded-md">Aktiv</span>',
        closed:   '<span class="text-xs bg-gray-100 text-gray-400 font-semibold px-2 py-0.5 rounded-md">Abgeschlossen</span>',
    }[s] || '');

    const totalPlanned = planItems.reduce((s, i) => s + Number(i.planned_amount || 0), 0);

    // Gruppierung nach is_allocatable (aus _finState.accounts nachschlagen)
    const accMap = new Map((_finState.accounts || []).map(a => [a.id, a]));
    const allocItems    = planItems.filter(i => accMap.get(i.account_id)?.is_allocatable);
    const nonAllocItems = planItems.filter(i => !accMap.get(i.account_id)?.is_allocatable);
    const allocTotal    = allocItems.reduce((s, i) => s + Number(i.planned_amount || 0), 0);
    const nonAllocTotal = nonAllocItems.reduce((s, i) => s + Number(i.planned_amount || 0), 0);

    const _wpItemRow = (item) => `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-xs font-mono text-gray-500">${item.account?.account_number || '–'}</td>
            <td class="px-4 py-3 text-sm">${item.account?.account_name || '–'}</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">${Number(item.prior_year_actual || 0).toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">
                ${plan?.status === 'draft'
                    ? `<input type="number" step="0.1" id="fin-wp-adj-${item.id}"
                            value="${item.adjustment_percent != null ? item.adjustment_percent : ''}"
                            placeholder="0"
                            oninput="_finWPLiveAdj(${item.id}, ${Number(item.prior_year_actual || 0).toFixed(2)}, this.value)"
                            onblur="_finUpdatePlanItemAdj(${item.id}, this.value)"
                            class="text-sm text-right w-20 bg-hb-ultralight border border-gray-200 rounded-lg px-2 focus:border-hb-olive focus:outline-none" style="height:32px">`
                    : `${item.adjustment_percent != null ? item.adjustment_percent + ' %' : '–'}`}
            </td>
            <td class="px-4 py-3 text-right">
                ${plan?.status === 'draft'
                    ? `<input type="number" step="0.01" min="0" id="fin-wp-planned-${item.id}"
                            value="${Number(item.planned_amount || 0).toFixed(2)}"
                            oninput="_finWPLivePlanned(${item.id}, ${Number(item.prior_year_actual || 0).toFixed(2)}, this.value)"
                            onblur="_finUpdatePlanItemAmount(${item.id}, this.value)"
                            class="text-sm font-bold text-right w-28 bg-hb-ultralight border border-gray-200 rounded-lg px-2 focus:border-hb-olive focus:outline-none" style="height:32px">`
                    : `<span class="text-sm font-bold">${Number(item.planned_amount || 0).toLocaleString('de-DE', {minimumFractionDigits:2})} €</span>`}
            </td>
            <td class="px-4 py-3 text-right">
                ${plan?.status === 'draft' ? `<button onclick="_finDeletePlanItem(${item.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5">Entfernen</button>` : ''}
            </td>
        </tr>`;

    const _wpSectionHeader = (label) => `<tr><td colspan="6" class="px-4 pt-5 pb-2 text-xs font-black uppercase tracking-widest text-hb-olive">${label}</td></tr>`;
    const _wpSubtotal = (label, amount) => `<tr class="bg-gray-50"><td colspan="4" class="px-4 py-2 text-xs font-bold text-right text-gray-500">${label}:</td><td class="px-4 py-2 text-xs font-bold text-right text-gray-600">${amount.toLocaleString('de-DE', {minimumFractionDigits:2})} €</td><td></td></tr>`;

    let itemRows = '';
    if (allocItems.length) {
        itemRows += _wpSectionHeader('Umlagefähige Kosten');
        itemRows += allocItems.map(_wpItemRow).join('');
        itemRows += _wpSubtotal('Zwischensumme umlagefähig', allocTotal);
    }
    if (nonAllocItems.length) {
        itemRows += _wpSectionHeader('Nicht umlagefähige Kosten');
        itemRows += nonAllocItems.map(_wpItemRow).join('');
        itemRows += _wpSubtotal('Zwischensumme nicht umlagefähig', nonAllocTotal);
    }
    if (!allocItems.length && !nonAllocItems.length) {
        itemRows = '';
    }

    // Status-Aktions-Button
    let statusAction = '';
    if (plan) {
        if (plan.status === 'draft')
            statusAction = `<button onclick="_finPlanStatus(${plan.id},'approved')" class="btn-primary text-sm px-4 py-2">Als beschlossen markieren</button>`;
        else if (plan.status === 'approved')
            statusAction = `<div class="flex gap-2 items-center">
                <input id="fin-wp-validfrom" type="date" class="w-40 text-sm" value="${new Date().toISOString().split('T')[0]}">
                <button onclick="_finPlanStatus(${plan.id},'active')" class="btn-primary text-sm px-4 py-2">Aktivieren ab...</button>
            </div>`;
        else if (plan.status === 'active')
            statusAction = `<button onclick="_finPlanStatus(${plan.id},'closed')" class="btn-secondary text-sm px-4 py-2">Abschließen</button>`;
        else if (plan.status === 'closed')
            statusAction = `<button onclick="_finReopenYear(${plan.id})" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5">Wieder öffnen</button>`;
    }

    // Sonderumlagen-Tabelle
    const levyStatusBadge = (s) => s === 'active' ? '<span class="text-xs bg-hb-success/12 text-hb-success font-semibold px-2 py-0.5 rounded-md">Aktiv</span>'
        : s === 'draft' ? '<span class="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">Entwurf</span>'
        : '<span class="text-xs bg-hb-orange/10 text-hb-orange font-semibold px-2 py-0.5 rounded-md">Abgeschlossen</span>';
    const levyRows = _finState.sonderumlagen.map(l => `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm font-semibold">${l.title}</td>
            <td class="px-4 py-3 text-sm text-right font-bold">${Number(l.total_amount).toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-xs text-gray-500">${DISTRIBUTION_KEY_LABELS[l.distribution_key] || l.distribution_key}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(l.due_date)}</td>
            <td class="px-4 py-3">${levyStatusBadge(l.status)}</td>
            <td class="px-4 py-3 text-right">
                ${l.status === 'draft' ? `<button onclick="_finActivateLevy(${l.id})" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Aktivieren</button>` : ''}
            </td>
        </tr>`).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Plan-Header -->
        <div class="card p-5 mb-5">
            <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div class="flex items-center gap-3">
                    <h3 class="text-sm font-bold text-hb-offblack">Wirtschaftsplan</h3>
                    <select onchange="_finChangeWPFY(this.value)" class="text-sm w-24">${fyOpts}</select>
                    ${plan ? statusBadge(plan.status) : ''}
                </div>
                <div class="flex gap-2 flex-wrap">
                    ${statusAction}
                    ${!plan ? `<button onclick="_finNewPlan()" class="btn-primary text-sm px-4 py-2">+ Neuer Plan ${fy}</button>` : ''}
                    ${plan?.status === 'draft' ? `<button onclick="_finOpenAddItemModal()" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-hb-olive/12">+ Position hinzufügen</button>` : ''}
                    ${plan ? `<button onclick="generateWirtschaftsplanPDF(${plan.id})" class="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        PDF
                    </button>` : ''}
                    ${plan ? `<button onclick="generateEinzelwirtschaftsplanPDF(${plan.id})" class="text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-hb-olive/12 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        Einzelpläne PDF
                    </button>` : ''}
                    ${plan ? `<button onclick="generateEinzelwirtschaftsplanPDF(${plan.id}, true)" class="text-xs text-hb-orange bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 border border-hb-orange/20 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Für ETV speichern
                    </button>` : ''}
                </div>
            </div>
            ${!plan ? `<p class="text-[15px] text-gray-400">Kein Wirtschaftsplan für ${fy} vorhanden.</p>` : `
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Kto.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Bezeichnung</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Vorjahres-Ist</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Anpassung</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Plan ${fy}</th>
                    <th class="px-4 py-3"></th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">
                    ${itemRows || '<tr><td colspan="6" class="px-4 py-6 text-center text-sm text-gray-400">Noch keine Positionen. Klicke „+ Position hinzufügen".</td></tr>'}
                    <tr class="bg-hb-olive/5 font-bold">
                        <td colspan="4" class="px-4 py-3 text-sm text-right text-hb-offblack">Gesamtaufwand geplant:</td>
                        <td id="fin-wp-total" class="px-4 py-3 text-sm text-right text-hb-olive">${totalPlanned.toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>`}
        </div>

        <!-- Sonderumlagen -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Sonderumlagen</span>
                <button onclick="_finOpenNewLevyModal()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">+ Sonderumlage anlegen</button>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Titel</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Gesamtbetrag</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Schlüssel</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Fälligkeit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Status</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${levyRows || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Sonderumlagen vorhanden.</td></tr>'}</tbody>
            </table>
        </div>

        <!-- Modal: Position hinzufügen -->
        <div id="fin-item-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-base font-extrabold text-hb-offblack mb-4">Position hinzufügen</h3>
                <div class="space-y-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Konto *</label>
                        <select id="fin-item-acc">${_finState.accounts.filter(a=>['expense','revenue','liability'].includes(a.account_type)).map(a=>`<option value="${a.id}">${a.account_number} – ${a.account_name}</option>`).join('')}</select></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Vorjahres-Ist (€)</label>
                        <input id="fin-item-prior" type="number" step="0.01" min="0" placeholder="0,00" oninput="_finCalcPlanned()"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Anpassung (%)</label>
                        <input id="fin-item-adj" type="number" step="0.1" placeholder="0" oninput="_finCalcPlanned()"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Geplanter Betrag (€) *</label>
                        <input id="fin-item-planned" type="number" step="0.01" min="0" placeholder="0,00" oninput="_finCalcAdjFromPlanned()"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Notiz</label>
                        <input id="fin-item-notes" type="text"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSavePlanItem()" class="btn-primary flex-1 text-sm py-2.5">Hinzufügen</button>
                    <button onclick="document.getElementById('fin-item-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>

        <!-- Modal: Sonderumlage -->
        <div id="fin-levy-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-base font-extrabold text-hb-offblack mb-4">Sonderumlage anlegen</h3>
                <div class="space-y-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Titel *</label>
                        <input id="fin-lv-title" type="text" placeholder="z.B. Fassadensanierung"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Gesamtbetrag (€) *</label>
                        <input id="fin-lv-amount" type="number" step="0.01" min="0.01"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Verteilerschlüssel</label>
                        <select id="fin-lv-key">${['mea','units','sqm','custom'].map(k=>`<option value="${k}">${DISTRIBUTION_KEY_LABELS[k]}</option>`).join('')}</select></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Fälligkeitsdatum *</label>
                        <input id="fin-lv-due" type="date"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wirtschaftsjahr</label>
                        <input id="fin-lv-fy" type="number" value="${fy}"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSaveLevy()" class="btn-primary flex-1 text-sm py-2.5">Speichern</button>
                    <button onclick="document.getElementById('fin-levy-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card table, #fin-content > .card > table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });
}

window._finChangeWPFY = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finLoadWirtschaftsplan();
};

window._finNewPlan = async () => {
    const { error } = await _supabase.from('budget_plans').insert({
        building_id: _finState.buildingId,
        fiscal_year: _finState.fiscalYear,
        status:      'draft',
        created_by:  currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(`Wirtschaftsplan ${_finState.fiscalYear} angelegt.`, 'success');
    await _finLoadWirtschaftsplan();
};

window._finPlanStatus = async (planId, newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'approved') updateData.approved_at = new Date().toISOString();
    if (newStatus === 'active') {
        const vf = document.getElementById('fin-wp-validfrom')?.value;
        if (vf) updateData.valid_from = vf;
        showToast(`Plan aktiviert ab ${vf || 'heute'}. Neue Hausgelder können im Tab „Sollstellungen" generiert werden.`, 'success');
    }
    const { error } = await _supabase.from('budget_plans').update(updateData).eq('id', planId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    if (newStatus !== 'active') showToast('Status aktualisiert.', 'success');
    await _finLoadWirtschaftsplan();
};

window._finOpenAddItemModal = () => {
    document.getElementById('fin-item-modal')?.classList.remove('hidden');
};

window._finCalcPlanned = () => {
    const prior = parseFloat(document.getElementById('fin-item-prior')?.value) || 0;
    const adj   = parseFloat(document.getElementById('fin-item-adj')?.value) || 0;
    const calc  = prior * (1 + adj / 100);
    const p = document.getElementById('fin-item-planned');
    if (p && prior) p.value = calc.toFixed(2);
};

window._finCalcAdjFromPlanned = () => {
    const prior   = parseFloat(document.getElementById('fin-item-prior')?.value) || 0;
    const planned = parseFloat(document.getElementById('fin-item-planned')?.value) || 0;
    const adjEl   = document.getElementById('fin-item-adj');
    if (adjEl && prior) adjEl.value = (((planned / prior) - 1) * 100).toFixed(1);
};

window._finWPLivePlanned = (itemId, prior, plannedVal) => {
    const planned = parseFloat(plannedVal) || 0;
    const adjEl   = document.getElementById(`fin-wp-adj-${itemId}`);
    if (adjEl && prior) adjEl.value = (((planned / prior) - 1) * 100).toFixed(1);
};

window._finWPLiveAdj = (itemId, prior, adjVal) => {
    const adj       = parseFloat(adjVal) || 0;
    const plannedEl = document.getElementById(`fin-wp-planned-${itemId}`);
    if (plannedEl && prior) plannedEl.value = (prior * (1 + adj / 100)).toFixed(2);
};

window._finUpdatePlanItemAdj = async (itemId, value) => {
    const adj = parseFloat(value);
    if (isNaN(adj)) return;
    const { error } = await _supabase.from('budget_plan_items').update({ adjustment_percent: adj }).eq('id', itemId);
    if (error) showToast('Fehler beim Speichern: ' + error.message, 'error');
};

window._finSavePlanItem = async () => {
    const accId   = document.getElementById('fin-item-acc')?.value;
    const prior   = parseFloat(document.getElementById('fin-item-prior')?.value) || null;
    const adj     = parseFloat(document.getElementById('fin-item-adj')?.value) || null;
    const planned = parseFloat(document.getElementById('fin-item-planned')?.value);
    const notes   = document.getElementById('fin-item-notes')?.value.trim();
    if (!accId || !planned) { showToast('Konto und geplanter Betrag sind Pflicht.', 'error'); return; }

    const { error } = await _supabase.from('budget_plan_items').insert({
        budget_plan_id:    _finState.selectedPlanId,
        account_id:        Number(accId),
        planned_amount:    planned,
        prior_year_actual: prior,
        adjustment_percent: adj,
        notes:             notes || null,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-item-modal')?.classList.add('hidden');
    showToast('Position hinzugefügt.', 'success');
    await _finLoadWirtschaftsplan();
};

window._finDeletePlanItem = async (itemId) => {
    const { error } = await _supabase.from('budget_plan_items').delete().eq('id', itemId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Position entfernt.', 'success');
    await _finLoadWirtschaftsplan();
};

window._finUpdatePlanItemAmount = async (itemId, value) => {
    const planned = parseFloat(value);
    if (isNaN(planned) || planned < 0) return;
    const { error } = await _supabase.from('budget_plan_items').update({ planned_amount: planned }).eq('id', itemId);
    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
    const item = _finState.planItems.find(i => i.id == itemId);
    if (item) item.planned_amount = planned;
    const total = _finState.planItems.reduce((s, i) => s + Number(i.planned_amount || 0), 0);
    const totalEl = document.getElementById('fin-wp-total');
    if (totalEl) totalEl.textContent = total.toLocaleString('de-DE', {minimumFractionDigits:2}) + ' €';
    showToast('Betrag gespeichert.', 'success');
};

window._finOpenNewLevyModal = () => {
    document.getElementById('fin-levy-modal')?.classList.remove('hidden');
};

window._finSaveLevy = async () => {
    const title  = document.getElementById('fin-lv-title')?.value.trim();
    const amount = parseFloat(document.getElementById('fin-lv-amount')?.value);
    const key    = document.getElementById('fin-lv-key')?.value;
    const due    = document.getElementById('fin-lv-due')?.value;
    const fy     = Number(document.getElementById('fin-lv-fy')?.value) || _finState.fiscalYear;
    if (!title || !amount || !due) { showToast('Titel, Betrag und Fälligkeit sind Pflicht.', 'error'); return; }

    const { error } = await _supabase.from('special_levies').insert({
        building_id:     _finState.buildingId,
        title, total_amount: amount,
        distribution_key: key,
        due_date:        due,
        fiscal_year:     fy,
        status:          'draft',
        created_by:      currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-levy-modal')?.classList.add('hidden');
    showToast('Sonderumlage gespeichert.', 'success');
    await _finLoadWirtschaftsplan();
};

window._finActivateLevy = async (levyId) => {
    const levy = _finState.sonderumlagen.find(l => l.id == levyId);
    if (!levy) return;

    // Aktive Eigentümer mit Einheit holen
    const { data: ownerships } = await _supabase.from('ownerships')
        .select('id, owner_id, apartment_id, apartment:apartments(mea, mea_numerator, mea_denominator, sq_meters, building_id)')
        .eq('is_active', true);
    const relevant = (ownerships || []).filter(o => o.apartment?.building_id == _finState.buildingId);
    if (!relevant.length) { showToast('Keine aktiven Eigentümer gefunden.', 'error'); return; }

    const totalApts = relevant.length;
    const totalSqm  = relevant.reduce((s, o) => s + Number(o.apartment?.sq_meters || 0), 0);

    const demands = relevant.map(o => {
        let share = 0;
        const apt = o.apartment;
        if (levy.distribution_key === 'mea') {
            const num = apt.mea_numerator || 0, den = apt.mea_denominator || 1;
            share = den > 0 ? levy.total_amount * (num / den) : levy.total_amount * (Number(apt.mea || 0) / 100);
        } else if (levy.distribution_key === 'units') {
            share = levy.total_amount / totalApts;
        } else if (levy.distribution_key === 'sqm') {
            share = totalSqm > 0 ? levy.total_amount * (Number(apt.sq_meters || 0) / totalSqm) : 0;
        } else {
            share = levy.total_amount / totalApts; // custom → gleiche Aufteilung als Fallback
        }
        return {
            building_id:  _finState.buildingId,
            apartment_id: o.apartment_id,
            person_id:    o.owner_id,
            demand_type:  'sonderumlage',
            amount:       Math.round(share * 100) / 100,
            due_date:     levy.due_date,
            fiscal_year:  levy.fiscal_year,
            status:       'open',
        };
    });

    const { error: dErr } = await _supabase.from('payment_demands').insert(demands);
    if (dErr) { showToast('Fehler Demands: ' + dErr.message, 'error'); return; }

    await _supabase.from('special_levies').update({ status: 'active' }).eq('id', levyId);
    showToast(`Sonderumlage aktiviert — ${demands.length} Sollstellungen erstellt.`, 'success');
    await _finLoadWirtschaftsplan();
};

// ============================================================
// ─── Tab 6: Erhaltungsrücklage ────────────────────────────────
// ============================================================

async function _finLoadRuecklage() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const accounts = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accounts;
    const reserveAccs = accounts.filter(a => a.is_reserve_account);

    // Saldi aus journal_entries
    const [{ data: debits }, { data: credits }] = await Promise.all([
        _supabase.from('journal_entries').select('debit_account_id, amount').eq('building_id', bid),
        _supabase.from('journal_entries').select('credit_account_id, amount').eq('building_id', bid),
    ]);
    const saldoMap = {};
    for (const a of accounts) saldoMap[a.id] = 0;
    for (const e of (debits  || [])) if (saldoMap[e.debit_account_id]  !== undefined) saldoMap[e.debit_account_id]  += Number(e.amount);
    for (const e of (credits || [])) if (saldoMap[e.credit_account_id] !== undefined) saldoMap[e.credit_account_id] -= Number(e.amount);

    // Soll-Bestand aus aktivem Wirtschaftsplan
    const activePlan = _finState.plans.find(p => p.fiscal_year == fy && p.status === 'active');
    let planTargetMap = {};
    if (activePlan) {
        const { data: items } = await _supabase.from('budget_plan_items').select('account_id, planned_amount').eq('budget_plan_id', activePlan.id);
        for (const i of (items || [])) planTargetMap[i.account_id] = Number(i.planned_amount);
    }

    // Buchungshistorie für erstes Rücklagenkonto laden (Jahres-Filter)
    const firstResAcc = reserveAccs[0];
    let histEntries = [];
    if (firstResAcc) {
        const { data: hist } = await _supabase.from('journal_entries')
            .select('id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type')
            .eq('building_id', bid)
            .eq('fiscal_year', fy)
            .or(`debit_account_id.eq.${firstResAcc.id},credit_account_id.eq.${firstResAcc.id}`)
            .order('entry_date');
        histEntries = hist || [];
    }

    _finRenderRuecklage(reserveAccs, saldoMap, planTargetMap, histEntries);
}

function _finRenderRuecklage(reserveAccs, saldoMap, planTargetMap, histEntries) {
    const fy  = _finState.fiscalYear;
    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y==fy?'selected':''}>${y}</option>`).join('');

    const cards = reserveAccs.length ? reserveAccs.map(a => {
        const saldo  = saldoMap[a.id] ?? 0;
        const target = planTargetMap[a.id];
        const diff   = target != null ? saldo - target : null;
        const warn   = diff != null && Math.abs(diff) / (target || 1) > 0.05;
        return `<div class="card p-4 flex-1 min-w-[220px]">
            <div class="text-xs font-black uppercase tracking-widest text-hb-orange mb-1">${a.account_number}</div>
            <div class="text-sm font-extrabold text-hb-offblack mb-1">${a.reserve_label || a.account_name}</div>
            <div class="text-2xl font-extrabold ${saldo < 0 ? 'text-hb-error' : 'text-hb-olive'}">${saldo.toLocaleString('de-DE', {minimumFractionDigits:2})} €</div>
            ${target != null ? `<div class="text-xs ${warn ? 'text-hb-orange font-semibold' : 'text-gray-400'} mt-1">
                Soll: ${target.toLocaleString('de-DE', {minimumFractionDigits:2})} € ${warn ? '⚠ Abweichung >5%' : '✓'}
            </div>` : ''}
        </div>`;
    }).join('') : '<p class="text-[15px] text-gray-400">Keine Rücklagekonten vorhanden. Konto anlegen und „Ist Rücklagekonto" setzen.</p>';

    // Laufender Saldo für Entwicklungsübersicht
    let runSaldo = 0;
    const firstResAcc = reserveAccs[0];
    const histRows = histEntries.map(e => {
        const isDebit = e.debit_account_id == firstResAcc?.id;
        const typeLabel = isDebit ? 'Zuführung' : 'Entnahme';
        const typeCls   = isDebit ? 'text-hb-success bg-hb-success/12' : 'text-hb-orange bg-hb-orange/10';
        runSaldo += isDebit ? Number(e.amount) : -Number(e.amount);
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
            <td class="px-4 py-3 text-sm">${e.description}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-md ${typeCls}">${typeLabel}</span></td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(e.amount).toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm font-semibold text-right ${runSaldo < 0 ? 'text-hb-error' : 'text-hb-success'}">${runSaldo.toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
        </tr>`;
    }).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Karten-Übersicht -->
        <div class="flex gap-4 flex-wrap mb-5">${cards}</div>

        <!-- Manuelle Buchungen -->
        <div class="card p-5 mb-5">
            <h3 class="text-sm font-bold text-hb-offblack mb-3">Rücklage manuell buchen</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Rücklagenkonto</label>
                    <select id="fin-rl-acc">${reserveAccs.map(a=>`<option value="${a.id}">${a.account_number} – ${a.reserve_label||a.account_name}</option>`).join('')}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Betrag (€)</label>
                    <input id="fin-rl-amount" type="number" step="0.01" min="0.01" placeholder="0,00"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Datum</label>
                    <input id="fin-rl-date" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Beschreibung</label>
                    <input id="fin-rl-desc" type="text" placeholder="z.B. Monatliche Zuführung"></div>
            </div>
            <div class="flex gap-3 mt-4">
                <button onclick="_finBuchenRuecklage('zufuehrung')" class="btn-primary text-sm px-5 py-2.5">Zuführung buchen</button>
                <button onclick="_finBuchenRuecklage('entnahme')" class="btn-secondary text-sm px-5 py-2.5">Entnahme buchen</button>
            </div>
        </div>

        <!-- Entwicklungsübersicht -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Entwicklung ${firstResAcc?.reserve_label || 'Rücklage'} ${fy}</span>
                <select onchange="_finChangeRLFY(this.value)" class="text-xs bg-white text-hb-olive font-bold px-2 py-1 rounded-lg border-0 cursor-pointer">${fyOpts}</select>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Buchungstext</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${histRows || `<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Rücklagebuchungen für ${fy}.</td></tr>`}</tbody>
            </table>
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finChangeRLFY = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finLoadRuecklage();
};

window._finBuchenRuecklage = async (type) => {
    const accId  = document.getElementById('fin-rl-acc')?.value;
    const amount = parseFloat(document.getElementById('fin-rl-amount')?.value);
    const date   = document.getElementById('fin-rl-date')?.value;
    const desc   = document.getElementById('fin-rl-desc')?.value.trim();
    if (!accId || !amount || !date) { showToast('Bitte alle Felder ausfüllen.', 'error'); return; }

    const accounts = _finState.accounts;
    const rlAcc    = accounts.find(a => a.id == accId);
    const acc3000  = accounts.find(a => a.account_number === '3000');
    if (!rlAcc || !acc3000) { showToast('Rücklagekonto oder Gegenkonto (3000) nicht gefunden.', 'error'); return; }

    const isZu = type === 'zufuehrung';
    const rlFy = new Date(date).getFullYear();

    // Journal-Sperre: abgeschlossene Jahre blockieren
    if (await _finBlockIfYearClosed(_finState.buildingId, rlFy)) return;

    const { error } = await _supabase.from('journal_entries').insert({
        building_id:       _finState.buildingId,
        entry_date:        date,
        description:       desc || (isZu ? 'Zuführung Rücklage' : 'Entnahme Rücklage'),
        amount,
        debit_account_id:  isZu ? rlAcc.id  : acc3000.id,
        credit_account_id: isZu ? acc3000.id : rlAcc.id,
        entry_type:        'ruecklage',
        fiscal_year:       rlFy,
        created_by:        currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(`${isZu ? 'Zuführung' : 'Entnahme'} gebucht.`, 'success');
    await _finLoadRuecklage();
};

// ============================================================
// ─── Tab 7: Belegprüfung Beirat (Admin-Verwaltung) ───────────
// ============================================================

async function _finLoadBelegpruefung() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const [{ data: periods }, { data: entries }, { data: protocols }] = await Promise.all([
        _supabase.from('beirat_access_periods').select('*').eq('building_id', bid).order('access_from', { ascending: false }),
        _supabase.from('journal_entries')
            .select('*, debit_account:accounts!debit_account_id(account_number,account_name), credit_account:accounts!credit_account_id(account_number,account_name)')
            .eq('building_id', bid)
            .eq('fiscal_year', fy)
            .order('entry_date', { ascending: false }),
        _supabase.from('audit_protocols')
            .select('*, auditor:profiles(full_name)')
            .eq('building_id', bid).eq('fiscal_year', fy),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y==fy?'selected':''}>${y}</option>`).join('');

    const periodRows = (periods || []).map(p => {
        const isActive = p.access_from <= today && p.access_to >= today;
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm">${p.access_from}</td>
            <td class="px-4 py-3 text-sm">${p.access_to}</td>
            <td class="px-4 py-3 text-sm">${p.fiscal_year}</td>
            <td class="px-4 py-3">
                ${isActive ? '<span class="text-xs bg-hb-success/12 text-hb-success font-semibold px-2 py-0.5 rounded-md">Aktiv</span>'
                           : '<span class="text-xs bg-gray-100 text-gray-400 font-semibold px-2 py-0.5 rounded-md">Abgelaufen</span>'}
            </td>
            <td class="px-4 py-3 text-right">
                <button onclick="_finDeleteAccessPeriod(${p.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5">Entfernen</button>
            </td>
        </tr>`;
    }).join('');

    const entryRows = (entries || []).map(e => `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
            <td class="px-4 py-3 text-sm max-w-[200px] truncate" title="${e.description}">${e.description}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.debit_account?.account_number} ${e.debit_account?.account_name}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.credit_account?.account_number} ${e.credit_account?.account_name}</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(e.amount).toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-center">
                ${e.attachment_path ? `<button onclick="_finPreviewAttachment('${e.attachment_path}')" title="Beleg" class="text-hb-olive hover:opacity-70"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>` : '–'}
            </td>
        </tr>`).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Freigabe-Verwaltung -->
        <div class="card overflow-hidden mb-5">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Beirat-Freigabezeiträume</span>
                <button onclick="_finOpenNewAccessModal()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">+ Freigabe definieren</button>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Von</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Bis</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Wirtschaftsjahr</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Status</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${periodRows || '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-gray-400">Keine Freigaben definiert.</td></tr>'}</tbody>
            </table>
            <div class="px-5 py-3 bg-hb-ultralight border-t border-hb-olive/10 text-xs text-gray-500">
                Personen mit Beirat-Eintrag im Gebäude sehen während eines aktiven Freigabezeitraums alle Buchungen und Belege des freigegebenen Wirtschaftsjahres (nur lesend).
            </div>
        </div>

        <!-- Prüfprotokolle (eingereichte Ergebnisse der Beiräte) -->
        ${(protocols && protocols.length) ? `
        <div class="card overflow-hidden mb-5">
            <div class="bg-hb-olive px-5 py-3">
                <span class="text-sm font-bold text-white">Prüfprotokolle</span>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Prüfer</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Ergebnis</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Umfang</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Feststellungen</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${protocols.map(p => `
                    <tr class="hover:bg-gray-50/60">
                        <td class="px-4 py-3 text-sm font-semibold">${p.auditor?.full_name || '—'}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${p.check_date ? new Date(p.check_date).toLocaleDateString('de-DE') : '—'}</td>
                        <td class="px-4 py-3">${p.is_formally_correct
                            ? '<span class="text-xs font-bold bg-hb-success/12 text-hb-success px-2 py-0.5 rounded-md">Ordnungsgemäß</span>'
                            : '<span class="text-xs font-bold bg-hb-orange/15 text-hb-orange px-2 py-0.5 rounded-md">Beanstandung</span>'}</td>
                        <td class="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">${p.scope_description || '—'}</td>
                        <td class="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">${p.findings || '—'}</td>
                    </tr>`).join('')}</tbody>
            </table>
        </div>` : ''}

        <!-- Buchungsvorschau (für Admins als Voransicht was der Beirat sieht) -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Vorschau: Buchungen ${fy}</span>
                <select onchange="_finChangeBPFY(this.value)" class="text-xs bg-white text-hb-olive font-bold px-2 py-1 rounded-lg border-0 cursor-pointer">${fyOpts}</select>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Beschreibung</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Soll</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Haben</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Beleg</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${entryRows || `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen für ${fy}.</td></tr>`}</tbody>
                </table>
            </div>
        </div>

        <!-- Modal: Freigabezeitraum -->
        <div id="fin-access-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-base font-extrabold text-hb-offblack mb-4">Freigabezeitraum definieren</h3>
                <div class="space-y-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Von</label>
                        <input id="fin-ac-from" type="date" value="${today}"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Bis</label>
                        <input id="fin-ac-to" type="date"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wirtschaftsjahr</label>
                        <input id="fin-ac-fy" type="number" value="${fy}"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSaveAccessPeriod()" class="btn-primary flex-1 text-sm py-2.5">Speichern</button>
                    <button onclick="document.getElementById('fin-access-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finChangeBPFY = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finLoadBelegpruefung();
};

window._finOpenNewAccessModal = () => {
    document.getElementById('fin-access-modal')?.classList.remove('hidden');
};

window._finSaveAccessPeriod = async () => {
    const from = document.getElementById('fin-ac-from')?.value;
    const to   = document.getElementById('fin-ac-to')?.value;
    const fy   = Number(document.getElementById('fin-ac-fy')?.value);
    if (!from || !to || !fy) { showToast('Alle Felder ausfüllen.', 'error'); return; }
    if (to < from) { showToast('„Bis" muss nach „Von" liegen.', 'error'); return; }

    const { error } = await _supabase.from('beirat_access_periods').insert({
        building_id:  _finState.buildingId,
        fiscal_year:  fy,
        access_from:  from,
        access_to:    to,
        created_by:   currentUser.id,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-access-modal')?.classList.add('hidden');
    showToast('Freigabezeitraum gespeichert.', 'success');
    await _finLoadBelegpruefung();
};

window._finDeleteAccessPeriod = async (id) => {
    if (!confirm('Freigabe wirklich entfernen?')) return;
    await _supabase.from('beirat_access_periods').delete().eq('id', id);
    showToast('Freigabe entfernt.', 'success');
    await _finLoadBelegpruefung();
};

// ============================================================
// ─── Beirat: Read-Only Belegansicht ──────────────────────────
// ============================================================

window._finSwitchBeiratYear = async (fy) => {
    const period = (_finState.beiratPeriods || []).find(p => p.fiscal_year === fy);
    if (!period) return;
    _finState.beiratBuildingId = period.building_id;
    _finState.beiratFiscalYear = period.fiscal_year;
    await _finRenderBeiratView();
};

async function _finRenderBeiratView() {
    const bid = _finState.beiratBuildingId;
    const fy  = _finState.beiratFiscalYear;
    const ca  = document.getElementById('content-area');

    const [{ data: bldg }, { data: entries }, , { data: existingProtocol }, { data: gsData }] = await Promise.all([
        _supabase.from('buildings').select('name, file_number, street, house_number').eq('id', bid).single(),
        _supabase.from('journal_entries')
            .select('*, debit_account:accounts!debit_account_id(account_number,account_name), credit_account:accounts!credit_account_id(account_number,account_name)')
            .eq('building_id', bid)
            .eq('fiscal_year', fy)
            .order('entry_date', { ascending: false }),
        // Belege werden nach dem Laden der Entries gefiltert
        Promise.resolve({ data: null }),
        _supabase.from('audit_protocols').select('*').eq('building_id', bid).eq('fiscal_year', fy).eq('auditor_id', currentUser.id).maybeSingle(),
        _supabase.from('global_settings').select('audit_hint_text').eq('id', 1).maybeSingle(),
    ]);

    // Belege separat laden (entry-IDs erst nach Entries-Load bekannt)
    const attMap = {};
    const entryIds = (entries || []).map(e => e.id).filter(Boolean);
    if (entryIds.length) {
        const { data: atts } = await _supabase.from('journal_attachments')
            .select('journal_entry_id, attachment_path')
            .in('journal_entry_id', entryIds);
        (atts || []).forEach(a => { attMap[a.journal_entry_id] = a.attachment_path; });
    }

    const entryRows = (entries || []).map(e => {
        const attPath = attMap[e.id] || e.attachment_path;
        return `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(e.entry_date)}</td>
            <td class="px-4 py-3 text-sm max-w-[200px] truncate" title="${e.description}">${e.description}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.debit_account?.account_number || '–'} ${e.debit_account?.account_name || ''}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.credit_account?.account_number || '–'} ${e.credit_account?.account_name || ''}</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(e.amount).toLocaleString('de-DE', {minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-center">
                ${attPath ? `<button onclick="_finPreviewAttachment('${attPath}')" title="Beleg anzeigen" class="text-hb-olive hover:opacity-70"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>` : '–'}
            </td>
        </tr>`;
    }).join('');

    // Hinweisbox-Text (aus global_settings oder Default)
    const hintText = gsData?.audit_hint_text || 'Das Prüfergebnis wird auf der kommenden Eigentümerversammlung als eigener Tagesordnungspunkt (TOP) behandelt. Bitte geben Sie hierzu eine kurze Stellungnahme ab.';

    // Prüfprotokoll: Status
    const proto = existingProtocol;
    const alreadySubmitted = proto && proto.status !== 'pending';
    const protoStatusBadge = !proto ? ''
        : proto.status === 'completed' ? '<span class="text-xs font-bold bg-hb-success/12 text-hb-success px-2 py-1 rounded-md">Ordnungsgemäß geprüft</span>'
        : proto.status === 'disputed' ? '<span class="text-xs font-bold bg-hb-orange/15 text-hb-orange px-2 py-1 rounded-md">Beanstandung</span>'
        : '<span class="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md">Ausstehend</span>';

    const protocolForm = alreadySubmitted
        ? `<div class="card p-5">
               <div class="flex items-center gap-3 mb-3">
                   <h3 class="text-sm font-bold text-hb-offblack">Prüfprotokoll</h3>
                   ${protoStatusBadge}
               </div>
               <div class="grid grid-cols-2 gap-3 text-sm">
                   <div><span class="text-xs text-gray-400">Prüfungsdatum</span><br><strong>${proto.check_date ? new Date(proto.check_date).toLocaleDateString('de-DE') : '—'}</strong></div>
                   <div><span class="text-xs text-gray-400">Ergebnis</span><br><strong>${proto.is_formally_correct ? 'Ordnungsgemäß' : 'Beanstandung'}</strong></div>
                   ${proto.scope_description ? `<div class="col-span-2"><span class="text-xs text-gray-400">Prüfungsumfang</span><br>${proto.scope_description}</div>` : ''}
                   ${proto.findings ? `<div class="col-span-2"><span class="text-xs text-gray-400">Feststellungen</span><br>${proto.findings}</div>` : ''}
               </div>
           </div>`
        : `<div class="card p-5">
               <h3 class="text-sm font-bold text-hb-offblack mb-4">Prüfprotokoll ausfüllen</h3>
               <div class="space-y-3 max-w-lg">
                   <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Prüfungsergebnis</label>
                       <select id="bp-result" class="text-sm">
                           <option value="correct">Ordnungsgemäß geprüft</option>
                           <option value="disputed">Beanstandung</option>
                       </select></div>
                   <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Prüfungsumfang (kurze Beschreibung)</label>
                       <textarea id="bp-scope" rows="2" class="text-sm w-full" placeholder="z.B. Stichprobenartige Prüfung aller Konten, Belege vollständig vorhanden..."></textarea></div>
                   <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Feststellungen / Anmerkungen <span id="bp-findings-required" class="text-hb-orange hidden">(Pflichtfeld bei Beanstandung)</span></label>
                       <textarea id="bp-findings" rows="3" class="text-sm w-full" placeholder="Ggf. Beanstandungen oder Anmerkungen..."></textarea></div>
               </div>
               <button onclick="_finBeiratSubmitProtocol()" class="btn-primary text-sm px-5 py-2.5 mt-4">Prüfprotokoll abgeben</button>
           </div>`;

    ca.innerHTML = `
        <div class="flex justify-between items-end mb-6">
            <div>
                <p class="text-xs uppercase tracking-widest font-bold text-hb-orange mb-1">Belegprüfung Beirat</p>
                <h2 class="text-[28px] font-bold text-hb-olive tracking-tight">${formatBuildingName(bldg)}</h2>
                <p class="text-[15px] text-gray-500 mt-1">Wirtschaftsjahr ${fy} — schreibgeschützt</p>
            </div>
            <div class="flex items-center gap-3">
                ${protoStatusBadge ? `<div>${protoStatusBadge}</div>` : ''}
                ${(_finState.beiratPeriods || []).length > 1 ? `
                    <select onchange="_finSwitchBeiratYear(+this.value)" class="text-sm border border-gray-200 rounded-lg px-3 py-2">
                        ${_finState.beiratPeriods.map(p => `<option value="${p.fiscal_year}" ${p.fiscal_year === fy ? 'selected' : ''}>${p.fiscal_year}</option>`).join('')}
                    </select>` : ''}
            </div>
        </div>

        <!-- Hinweisbox -->
        <div class="mb-5 px-4 py-3 rounded-2xl border border-hb-orange/30 bg-hb-orange/5 flex items-start gap-3">
            <svg class="w-5 h-5 text-hb-orange shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
            <p class="text-[15px] text-hb-offblack">${hintText}</p>
        </div>

        <!-- Buchungsjournal -->
        <div class="card overflow-hidden mb-5">
            <div class="bg-hb-olive px-5 py-3">
                <span class="text-sm font-bold text-white">Buchungsjournal ${fy}</span>
                <span class="text-xs text-white/60 ml-2">${(entries || []).length} Buchungen</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Beschreibung</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Soll</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Haben</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Beleg</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${entryRows || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen im freigegebenen Zeitraum.</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- Prüfprotokoll -->
        ${protocolForm}`;

    // Beanstandung → Findings-Pflichtfeld markieren
    document.getElementById('bp-result')?.addEventListener('change', function() {
        const req = document.getElementById('bp-findings-required');
        if (req) req.classList.toggle('hidden', this.value !== 'disputed');
    });

    // Responsive tables
    document.querySelectorAll('#content-area .card').forEach(c => makeTableResponsive(c));
}

// ── Beirat: Prüfprotokoll absenden ──────────────────────────
window._finBeiratSubmitProtocol = async () => {
    const bid = _finState.beiratBuildingId;
    const fy  = _finState.beiratFiscalYear;
    const result  = document.getElementById('bp-result')?.value;
    const scope   = document.getElementById('bp-scope')?.value?.trim() || null;
    const findings = document.getElementById('bp-findings')?.value?.trim() || null;

    const isCorrect = result === 'correct';
    const status    = isCorrect ? 'completed' : 'disputed';

    if (!isCorrect && !findings) {
        showToast('Bei einer Beanstandung ist das Feld "Feststellungen" ein Pflichtfeld.', 'error'); return;
    }

    const signatureData = {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
    };

    const { error } = await _supabase.from('audit_protocols').upsert({
        building_id: bid,
        fiscal_year: fy,
        auditor_id: currentUser.id,
        status: status,
        check_date: new Date().toISOString(),
        scope_description: scope,
        findings: findings,
        is_formally_correct: isCorrect,
        signature_data: signatureData,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'building_id,fiscal_year,auditor_id' });

    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
    showToast('Prüfprotokoll erfolgreich abgegeben.', 'success');
    await _finRenderBeiratView();
};

// ============================================================
// ─── Tab 9: Jahresabrechnung ──────────────────────────────────
// ============================================================

async function _finLoadJahresabrechnung() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }
    _finRenderJAB();
}

function _finRenderJAB() {
    const step = _finState.jabStep;
    const fy   = _finState.jabData.fy || _finState.fiscalYear;

    const stepLabels = ['Vermögen', 'Zeitraum', 'Ist-Daten', 'Schlüssel', 'Soll/Ist', 'Abschluss'];
    const stepDots = [1,2,3,4,5,6].map(i =>
        `<div class="flex items-center gap-1" title="${stepLabels[i-1]}">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i === step ? 'bg-hb-olive text-white border-hb-olive' : i < step ? 'bg-hb-olive/20 text-hb-olive border-hb-olive/30' : 'bg-gray-50 border-gray-200 text-gray-300'}">${i}</div>
            ${i < 6 ? '<div class="w-4 h-px bg-gray-200"></div>' : ''}
        </div>`
    ).join('');

    let content = '';
    if (step === 1)      content = _finJABStep1Html(fy);
    else if (step === 2) content = _finJABStep2Html(fy);
    else if (step === 3) content = _finJABStep3Html();
    else if (step === 4) content = _finJABStep4Html();
    else if (step === 5) content = _finJABStep5Html();
    else if (step === 6) content = _finJABStep6Html();

    document.getElementById('fin-content').innerHTML = `
        <div class="card p-6">
            <div class="flex items-center justify-between mb-5">
                <div>
                    <h3 class="text-base font-extrabold text-hb-offblack">Jahresabrechnung / Hausgeldabrechnung</h3>
                    <p class="text-xs text-gray-400 mt-0.5">Geldflussprinzip — nur tatsächliche Zahlungsströme werden abgerechnet.</p>
                </div>
                <div class="flex items-center gap-1">${stepDots}</div>
            </div>
            ${content}
        </div>`;

    // Responsive tables
    document.querySelectorAll('#fin-content table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });

    // Step 6: Abschluss/Reopen-Button Toggle
    if (step === 6) {
        const jabFy = _finState.jabData?.fy || _finState.fiscalYear;
        _finIsYearClosed(_finState.buildingId, jabFy).then(closed => {
            const btnClose = document.getElementById('btn-jab-abschluss');
            const btnReopen = document.getElementById('btn-jab-reopen');
            if (btnClose) btnClose.classList.toggle('hidden', closed);
            if (btnReopen) btnReopen.classList.toggle('hidden', !closed);
        });
    }
}

// ── Step 1: Vermögensbericht (§ 28 WEG) ──────────────────────
function _finJABStep1Html(fy) {
    const d = _finState.jabData;
    const vsLoaded = !!d?.vsLoaded;
    const vsRows = d?.vsRows || [];
    const forderungen = d?.forderungen || [];

    let bankSection = '';
    let forderungenSection = '';

    if (vsLoaded) {
        // Bank- und Rücklagenkonten: Saldenabgleich
        const bankRows = vsRows.map((r, i) => {
            const diff = r.statement_balance != null ? (Number(r.statement_balance) - r.system_balance) : null;
            const diffStr = diff != null ? diff.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '—';
            const diffClass = diff == null ? 'text-gray-300' : Math.abs(diff) < 0.01 ? 'text-hb-success' : 'text-hb-orange font-bold';
            const validated = r.is_validated;
            const icon = validated ? '✓' : diff != null && Math.abs(diff) < 0.01 ? '✓' : '';
            const iconClass = validated ? 'text-hb-success' : '';
            return `<tr class="hover:bg-gray-50/60">
                <td class="px-4 py-3 text-xs font-mono text-gray-500">${r.account_number}</td>
                <td class="px-4 py-3 text-sm">${r.account_name}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold">${r.system_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                <td class="px-4 py-3 text-right">
                    <input type="number" step="0.01" data-vs-idx="${i}" value="${r.statement_balance ?? ''}"
                        placeholder="Saldo lt. Auszug" class="text-sm text-right w-32 px-2 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hb-olive/20"
                        onchange="_finVSUpdateRow(${i}, this.value)">
                </td>
                <td class="px-4 py-3 text-sm text-right ${diffClass}">${diffStr}</td>
                <td class="px-4 py-3 text-center text-lg ${iconClass}">${icon}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Bank-/Rücklagenkonten gefunden.</td></tr>';

        bankSection = `
            <h4 class="text-sm font-bold text-hb-offblack mb-2 mt-4">Kontensalden prüfen (Bank & Rücklage)</h4>
            <p class="text-xs text-gray-400 mb-3">Tragen Sie den tatsächlichen Kontostand lt. Bankauszug zum Stichtag 31.12.${fy} ein. Bei Differenz = 0 erscheint ein ✓.</p>
            <div class="overflow-x-auto rounded-lg border border-hb-olive/10 max-h-[300px] overflow-y-auto">
                <table class="w-full">
                    <thead class="bg-gray-50 sticky top-0"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Kto.</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Konto</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">System-Saldo</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo lt. Auszug</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Differenz</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Status</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${bankRows}</tbody>
                </table>
            </div>`;

        // Forderungen und Verbindlichkeiten
        const fordRows = forderungen.map(f => {
            const amt = Number(f.amount || 0);
            return `<tr class="hover:bg-gray-50/60">
                <td class="px-4 py-3 text-sm">${f.person_name || '—'}</td>
                <td class="px-4 py-3 text-sm">${f.apt_number || '—'}</td>
                <td class="px-4 py-3 text-xs text-gray-500">${f.demand_type || '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold text-right ${amt > 0 ? 'text-hb-orange' : 'text-gray-400'}">${amt.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                <td class="px-4 py-3 text-xs text-gray-400">${_finFormatDate(f.due_date)}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="_finVSStornoDemand('${f.id}')" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5" title="Stornieren">✕</button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine offenen Forderungen zum Stichtag.</td></tr>';

        const totalFord = forderungen.reduce((s, f) => s + Number(f.amount || 0), 0);
        forderungenSection = `
            <h4 class="text-sm font-bold text-hb-offblack mb-2 mt-6">Forderungen & Verbindlichkeiten zum Stichtag</h4>
            <p class="text-xs text-gray-400 mb-3">Offene Sollstellungen (Hausgeldrückstände) zum 31.12.${fy}. Fehlerhafte Posten können direkt storniert werden.</p>
            <div class="overflow-x-auto rounded-lg border border-hb-olive/10 max-h-[250px] overflow-y-auto">
                <table class="w-full">
                    <thead class="bg-gray-50 sticky top-0"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Person</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Fällig</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500"></th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${fordRows}</tbody>
                </table>
            </div>
            <div class="mt-2 text-sm font-semibold text-right text-hb-offblack">Offene Forderungen gesamt: ${totalFord.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>`;
    }

    return `
        <div class="space-y-2">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-hb-olive/10 flex items-center justify-center">
                    <svg class="w-4 h-4 text-hb-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-hb-offblack">Vermögensbericht (§ 28 WEG)</h4>
                    <p class="text-xs text-gray-400">Stichtag: 31.12.${fy} — Abgleich der System-Salden mit den tatsächlichen Bankkontoständen.</p>
                </div>
            </div>
            ${bankSection}
            ${forderungenSection}
        </div>
        <div class="flex gap-3 mt-5">
            ${vsLoaded
                ? `<button onclick="_finJABNext(1)" class="btn-primary text-sm px-6 py-2.5">Salden speichern & weiter →</button>`
                : `<button onclick="_finJABNext(1)" class="btn-primary text-sm px-6 py-2.5">Vermögensbericht laden →</button>`
            }
        </div>`;
}

// ── Step 2: Zeitraum & Kontenwahl (ehemals Step 1) ────────────
function _finJABStep2Html(fy) {
    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y==fy?'selected':''}>${y}</option>`).join('');
    const hasPlan = _finState.plans.some(p => p.fiscal_year == fy && ['active','approved'].includes(p.status));
    const d = _finState.jabData;
    const loaded = !!d?.step2Loaded;

    // Konto-Checkliste (nur nach Laden)
    let accountList = '';
    if (loaded && d.rawEntries) {
        const accs = _finState.accounts;
        const accMap = {};
        for (const a of accs) accMap[a.id] = a;

        const accIds = new Set();
        const counts = {};
        for (const e of d.rawEntries) {
            if (e.debit_account_id)  { accIds.add(e.debit_account_id);  counts[e.debit_account_id]  = (counts[e.debit_account_id]  || 0) + 1; }
            if (e.credit_account_id) { accIds.add(e.credit_account_id); counts[e.credit_account_id] = (counts[e.credit_account_id] || 0) + 1; }
        }

        const selIds = d.selectedAccIds ? new Set(d.selectedAccIds) : accIds;
        const typeLabel = { expense: 'Aufwand', revenue: 'Ertrag', asset: 'Aktiva', liability: 'Passiva' };

        const rows = [...accIds].sort((a, b) => {
            const na = accMap[a]?.account_number || '9999';
            const nb = accMap[b]?.account_number || '9999';
            return na.localeCompare(nb, undefined, { numeric: true });
        }).map(id => {
            const a = accMap[id];
            if (!a) return '';
            const checked = selIds.has(id) ? 'checked' : '';
            const tl = typeLabel[a.account_type] || a.account_type || '–';
            return `<tr class="hover:bg-gray-50/60">
                <td class="px-3 py-2.5 text-center"><input type="checkbox" data-jab-acc="${id}" ${checked} class="rounded accent-[#687451]"></td>
                <td class="px-3 py-2.5 text-xs font-mono text-gray-500">${a.account_number}</td>
                <td class="px-3 py-2.5 text-sm text-hb-offblack">${a.account_name}</td>
                <td class="px-3 py-2.5"><span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">${tl}</span></td>
                <td class="px-3 py-2.5 text-xs text-right text-gray-400">${counts[id] || 0} Buchungen</td>
            </tr>`;
        }).filter(Boolean).join('');

        accountList = `
            <div class="mt-5">
                <div class="flex items-center justify-between mb-1">
                    <h4 class="text-sm font-bold text-hb-offblack">Konten mit Buchungen im Zeitraum</h4>
                    <span class="text-xs text-gray-400">${accIds.size} Konten &nbsp;·&nbsp;
                        <a class="text-hb-olive cursor-pointer hover:underline" onclick="_finJABSelectAll(true)">Alle</a> /
                        <a class="text-hb-olive cursor-pointer hover:underline" onclick="_finJABSelectAll(false)">Keine</a>
                    </span>
                </div>
                <p class="text-xs text-gray-400 mb-2">Wählen Sie, welche Konten in die Jahresabrechnung einfließen sollen.</p>
                <div class="overflow-x-auto rounded-lg border border-hb-olive/10 max-h-[320px] overflow-y-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 sticky top-0"><tr>
                            <th class="px-3 py-3 w-8"></th>
                            <th class="px-3 py-3 text-left text-xs font-bold text-gray-500">Kto.</th>
                            <th class="px-3 py-3 text-left text-xs font-bold text-gray-500">Konto</th>
                            <th class="px-3 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                            <th class="px-3 py-3 text-right text-xs font-bold text-gray-500">Buchungen</th>
                        </tr></thead>
                        <tbody class="divide-y divide-hb-olive/10">${rows || '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen im Zeitraum gefunden.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    return `
        <div class="max-w-2xl space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wirtschaftsjahr</label>
                    <select id="jab-fy" class="text-sm" onchange="_finJABStep1Reset()">${fyOpts}</select></div>
                <div></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Zeitraum von</label>
                    <input id="jab-from" type="date" value="${d?.from || fy+'-01-01'}"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Zeitraum bis</label>
                    <input id="jab-to" type="date" value="${d?.to || fy+'-12-31'}"></div>
            </div>
            ${!hasPlan ? `<div class="bg-hb-orange/10 border border-hb-orange/20 rounded-2xl p-4 text-sm text-hb-orange font-semibold">
                ⚠ Kein aktiver Wirtschaftsplan für ${fy} gefunden. Die Abrechnung ist trotzdem möglich.
            </div>` : ''}
            ${accountList}
        </div>
        <div class="flex gap-3 mt-5">
            <button onclick="_finState.jabStep=1;_finRenderJAB()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
            ${loaded
                ? `<button onclick="_finJABStep1Reset()" class="btn-secondary text-sm px-5 py-2.5">↺ Neu laden</button>
                   <button onclick="_finJABNext(2)" class="btn-primary text-sm px-6 py-2.5">Weiter →</button>`
                : `<button onclick="_finJABNext(2)" class="btn-primary text-sm px-6 py-2.5">Konten laden →</button>`
            }
        </div>`;
}

function _finJABStep3Html() {
    const d  = _finState.jabData;
    const accs = _finState.accounts;
    const accMap = {};
    for (const a of accs) accMap[a.id] = a;

    // Aggregiere Buchungen pro Konto
    const soll = {}, haben = {};
    for (const e of (d.entries || [])) {
        soll[e.debit_account_id]   = (soll[e.debit_account_id]  || 0) + Number(e.amount);
        haben[e.credit_account_id] = (haben[e.credit_account_id] || 0) + Number(e.amount);
    }
    const allIds = new Set([...Object.keys(soll), ...Object.keys(haben)].map(Number));
    const rows = [...allIds].map(id => {
        const a = accMap[id];
        const s = soll[id] || 0, h = haben[id] || 0, sal = s - h;
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-xs font-mono text-gray-500">${a?.account_number||'–'}</td>
            <td class="px-4 py-3 text-sm">${a?.account_name||'–'}</td>
            <td class="px-4 py-3 text-sm text-right">${s.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm text-right">${h.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm font-bold text-right ${sal>0?'text-hb-orange':sal<0?'text-hb-success':'text-gray-400'}">${sal.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
        </tr>`;
    }).join('');

    return `
        <p class="text-[15px] text-gray-500 mb-3">Ist-Buchungen ${d.from} – ${d.to}: <strong>${(d.entries||[]).length}</strong> Buchungen</p>
        <div class="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-hb-olive/10">
            <table class="w-full">
                <thead class="bg-gray-50 sticky top-0"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Kto.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Konto</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Soll-Summe</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Haben-Summe</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${rows||'<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen im Zeitraum.</td></tr>'}</tbody>
            </table>
        </div>
        <div class="flex gap-3 mt-5">
            <button onclick="_finState.jabStep=2;_finRenderJAB()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
            <button onclick="_finJABNext(3)" class="btn-primary text-sm px-6 py-2.5">Weiter →</button>
        </div>`;
}

function _finJABStep4Html() {
    const expenseAccs = _finState.accounts.filter(a => a.account_type === 'expense');
    const dkList = _finState.distKeys || [];
    const dkLookup = {};
    dkList.forEach(function(k) { dkLookup[k.id] = k.name; });
    const rows = expenseAccs.map(a => {
        const pkName = a.primary_key_id && dkLookup[a.primary_key_id] ? dkLookup[a.primary_key_id] : '—';
        const skName = a.secondary_key_id && dkLookup[a.secondary_key_id] ? ' / ' + dkLookup[a.secondary_key_id] + ' (' + (a.secondary_key_percentage || 0) + '%)' : '';
        return `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-xs font-mono text-gray-500">${a.account_number}</td>
            <td class="px-4 py-3 text-sm">${a.account_name}</td>
            <td class="px-4 py-3 text-sm ${pkName === '—' ? 'text-hb-orange font-semibold' : 'text-hb-offblack'}">${pkName}${skName}</td>
        </tr>`;
    }).join('');

    return `
        <div class="mb-4">
            <h4 class="text-sm font-bold text-hb-offblack mb-1">Umlageschlüssel pro Kostenkonto</h4>
            <p class="text-xs text-gray-500 mb-3">Prüfen Sie die zugewiesenen Verteilerschlüssel. Konten ohne Schlüssel (—) werden nicht verteilt.</p>
            <div class="overflow-x-auto rounded-lg border border-hb-olive/10 mb-3">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Kto.</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Konto</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Schlüssel</th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${rows||'<tr><td colspan="3" class="px-4 py-6 text-center text-sm text-gray-400">Keine Aufwandskonten.</td></tr>'}</tbody>
                </table>
            </div>
            <p class="text-xs text-gray-400 italic">Schlüsselzuweisung bearbeiten: Kontenblatt → Konto bearbeiten → Verteilerschlüssel</p>
            <h4 class="text-sm font-bold text-hb-offblack mb-2">Heizkosten-Abrechnung</h4>
            <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="jab-heating" value="A" ${(_finState.jabData.heatingMode||'A')==='A'?'checked':''} onchange="_finState.jabData.heatingMode='A';_finRenderJAB()"> 
                    Option A — Messdienstleister (manuelle Festbeträge)
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="jab-heating" value="B" ${_finState.jabData.heatingMode==='B'?'checked':''} onchange="_finState.jabData.heatingMode='B';_finRenderJAB()">
                    Option B — Selbstabrechner (HeizkostenV)
                </label>
            </div>
            ${(_finState.jabData.heatingMode||'A')==='A' ? `
            <div class="mt-3 p-4 bg-hb-ultralight rounded-lg">
                <p class="text-xs text-gray-500 mb-2">Heizkosten-Festbetrag pro Einheit eingeben (leer = keine Heizkosten-Abrechnung für diese Einheit):</p>
                ${(_finState.apartments||[]).map(apt => `
                    <div class="flex items-center gap-3 mb-1.5">
                        <span class="text-sm w-24 font-semibold">${apt.apartment_number}</span>
                        <input type="number" step="0.01" min="0" data-apt-id="${apt.id}" data-heat="A"
                            value="${_finState.jabData.heatingManual?.[apt.id]||''}"
                            placeholder="0,00" class="w-28 text-sm text-right rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-hb-olive focus:outline-none">
                        <span class="text-xs text-gray-400">€</span>
                    </div>`).join('')}
            </div>` : `
            <div class="mt-3 p-4 bg-hb-ultralight rounded-lg">
                <p class="text-xs text-gray-500 mb-3">Heizkosten werden aus Zählerständen nach HeizkostenV berechnet. Fehlende Werte werden mit Vorjahresverbrauch + 10% geschätzt.</p>
                <div class="grid grid-cols-2 gap-3 max-w-xs">
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Verbrauchsanteil %</label>
                        <input type="number" id="jab-heat-split-v" min="0" max="100"
                            value="${_finState.jabData.heatSplitV}"
                            oninput="_finValidateHeatSplit()"
                            class="text-sm text-right w-full rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-hb-olive focus:outline-none" style="height:36px">
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-gray-500 mb-1 block">Flächenanteil %</label>
                        <input type="number" id="jab-heat-split-f" min="0" max="100"
                            value="${_finState.jabData.heatSplitF}"
                            oninput="_finValidateHeatSplit()"
                            class="text-sm text-right w-full rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-hb-olive focus:outline-none" style="height:36px">
                    </div>
                </div>
                <p id="jab-heat-split-error" class="text-xs text-hb-error mt-1 hidden">Verbrauchs- und Flächenanteil müssen zusammen 100% ergeben.</p>
            </div>`}
        </div>
        <div class="flex gap-3 mt-5">
            <button onclick="_finState.jabStep=3;_finRenderJAB()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
            <button onclick="_finJABNext(4)" class="btn-primary text-sm px-6 py-2.5">Weiter →</button>
        </div>`;
}

window._finValidateHeatSplit = () => {
    const v   = Number(document.getElementById('jab-heat-split-v')?.value) || 0;
    const f   = Number(document.getElementById('jab-heat-split-f')?.value) || 0;
    const err = document.getElementById('jab-heat-split-error');
    if (Math.round(v + f) !== 100) {
        err?.classList.remove('hidden');
    } else {
        err?.classList.add('hidden');
        _finState.jabData.heatSplitV = v;
        _finState.jabData.heatSplitF = f;
    }
};

function _finJABStep5Html() {
    const d    = _finState.jabData;
    const rows = (d.sollIst || []).map(row => {
        const diff = row.soll - row.bezahlt;
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm font-semibold">${row.apt_number}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${row.owner_name||'–'}</td>
            <td class="px-4 py-3 text-sm text-right">${row.soll.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm text-right">${row.bezahlt.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm font-bold text-right ${diff>0?'text-hb-orange':diff<0?'text-hb-olive':'text-gray-400'}">
                ${diff>0?'+':''}${diff.toLocaleString('de-DE',{minimumFractionDigits:2})} €
                ${diff>0?'<span class="text-[10px] ml-1">Nachzahlung</span>':diff<0?'<span class="text-[10px] ml-1">Guthaben</span>':''}
            </td>
        </tr>`;
    }).join('');

    const sonderRows = (d.sonderIst || []).map(l => `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm font-semibold">${l.title}</td>
            <td class="px-4 py-3 text-sm text-right">${Number(l.total_amount).toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3"><span class="text-xs ${l.status==='active'?'bg-hb-success/12 text-hb-success':'bg-gray-100 text-gray-600'} font-semibold px-2 py-0.5 rounded-md">${l.status}</span></td>
        </tr>`).join('');

    return `
        <div class="bg-hb-ultralight border border-hb-olive/10 rounded-lg p-3 mb-4 text-xs text-gray-500">
            Bei Eigentümerwechsel im laufenden Jahr wird das gesamte Wirtschaftsjahr mit dem aktuell im System hinterlegten Eigentümer abgerechnet (Stichtagsprinzip). Interne Ausgleiche zwischen Alt- und Neu-Eigentümer erfolgen manuell.
        </div>
        <h4 class="text-sm font-bold text-hb-offblack mb-2">Soll-Ist-Abgleich Hausgeld ${d.fy}</h4>
        <div class="overflow-x-auto rounded-lg border border-hb-olive/10 mb-5">
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Eigentümer</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Soll-HG</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Bezahlt</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Differenz</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${rows||'<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Keine Sollstellungen gefunden.</td></tr>'}</tbody>
            </table>
        </div>
        ${(d.sonderIst||[]).length ? `
        <h4 class="text-sm font-bold text-hb-offblack mb-2">Sonderumlagen</h4>
        <div class="overflow-x-auto rounded-lg border border-hb-olive/10 mb-5">
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Titel</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Gesamtbetrag</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Status</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${sonderRows}</tbody>
            </table>
        </div>` : ''}
        <div class="flex gap-3 mt-5">
            <button onclick="_finState.jabStep=4;_finRenderJAB()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
            <button onclick="_finJABNext(5)" class="btn-primary text-sm px-6 py-2.5">Weiter →</button>
        </div>`;
}

function _finJABStep6Html() {
    const d = _finState.jabData;
    const saldoData = d.abrechnungsSaldo || [];
    const nachz    = saldoData.filter(r => r.saldo > 0);
    const gutschr  = saldoData.filter(r => r.saldo < 0);
    const nettoSaldo = saldoData.reduce((s, r) => s + r.saldo, 0);

    const fmtEur = v => Number(v||0).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';

    const saldoRows = saldoData.map(r => {
        const label = r.saldo > 0 ? 'Nachzahlung' : r.saldo < 0 ? 'Guthaben' : 'Ausgeglichen';
        const color = r.saldo > 0 ? 'text-hb-orange' : r.saldo < 0 ? 'text-hb-olive' : 'text-gray-400';
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm font-semibold">${r.apt_number}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${r.owner_name||'–'}</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">${fmtEur(r.istKosten)}</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">${fmtEur(r.soll)}</td>
            <td class="px-4 py-3 text-sm text-right text-gray-500">${fmtEur(r.bezahlt)}</td>
            <td class="px-4 py-3 text-sm font-bold text-right ${color}">${fmtEur(Math.abs(r.saldo))}<span class="text-[10px] ml-1">${label}</span></td>
        </tr>`;
    }).join('');

    const stRows = (d.steuerbescheinigung||[]).map(r=>`
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm font-semibold">${r.apt_number}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${r.owner_name||'–'}</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${r.lohn35a.toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
        </tr>`).join('');

    return `
        <div class="grid grid-cols-3 gap-4 mb-5">
            <div class="card p-4 text-center">
                <div class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Netto-Ergebnis WEG</div>
                <div class="text-xl font-extrabold ${nettoSaldo>0?'text-hb-orange':nettoSaldo<0?'text-hb-olive':'text-gray-400'}">${fmtEur(nettoSaldo)}</div>
            </div>
            <div class="card p-4 text-center">
                <div class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Nachzahlungen</div>
                <div class="text-xl font-extrabold text-hb-orange">${nachz.length} Eigentümer</div>
            </div>
            <div class="card p-4 text-center">
                <div class="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Guthaben</div>
                <div class="text-xl font-extrabold text-hb-olive">${gutschr.length} Eigentümer</div>
            </div>
        </div>

        <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-bold text-hb-offblack">Abrechnungsergebnis je Eigentümer</h4>
            <div class="flex flex-wrap gap-2">
                <button onclick="_finJABExportCSV()" class="text-xs text-hb-olive bg-hb-ultralight border border-hb-olive/12 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Als CSV exportieren</button>
                <button onclick="_finJABExportPDF()" class="text-xs text-hb-olive bg-hb-ultralight border border-hb-olive/12 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Abrechnung als PDF exportieren</button>
                <button onclick="_finJABSaveForETV()" class="text-xs text-hb-orange bg-hb-ultralight border border-hb-orange/20 px-4 py-2 rounded-lg font-semibold hover:bg-hb-orange/5 transition-colors">Für ETV speichern</button>
                <button onclick="_finJABAbschluss()" id="btn-jab-abschluss" class="btn-primary text-xs px-4 py-2">Abrechnung abschließen & sperren</button>
                <button onclick="_finJABReopen()" id="btn-jab-reopen" class="text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5 hidden">Sperre aufheben</button>
                <button onclick="_finActivateBeschluss()" class="text-xs text-white bg-hb-olive px-4 py-2 rounded-lg font-semibold hover:bg-hb-olive/90 transition-colors border-2 border-hb-olive">Beschlüsse aktivieren</button>
            </div>
        </div>
        <div class="overflow-x-auto rounded-lg border border-hb-olive/10 mb-5">
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Eigentümer</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Ist-Kosten</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">HG-Soll</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">HG-Ist</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${saldoRows||'<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine Daten.</td></tr>'}</tbody>
            </table>
        </div>

        ${stRows ? `
        <h4 class="text-sm font-bold text-hb-offblack mb-2">§35a EStG Steuerbescheinigung</h4>
        <div class="overflow-x-auto rounded-lg border border-hb-olive/10 mb-5">
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Eigentümer</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Lohnanteil §35a</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${stRows}</tbody>
            </table>
        </div>` : ''}

        <div class="flex gap-3 mt-5">
            <button onclick="_finState.jabStep=5;_finRenderJAB()" class="btn-secondary text-sm px-5 py-2.5">← Zurück</button>
        </div>`;
}

window._finJABStep1Reset = () => {
    if (_finState.jabData) _finState.jabData.step2Loaded = false;
    _finRenderJAB();
};

// ── Vermögensbericht Helpers ─────────────────────────────────
window._finVSUpdateRow = (idx, val) => {
    const rows = _finState.jabData?.vsRows;
    if (!rows || !rows[idx]) return;
    rows[idx].statement_balance = val !== '' ? parseFloat(val) : null;
    // Live-Update der Zeile (Differenz + Status)
    _finRenderJAB();
};

window._finVSStornoDemand = async (demandId) => {
    if (!confirm('Sollstellung stornieren?')) return;
    const { error } = await _supabase.from('payment_demands').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', demandId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    // Aus lokaler Liste entfernen und neu rendern
    _finState.jabData.forderungen = (_finState.jabData.forderungen || []).filter(f => f.id !== demandId);
    showToast('Sollstellung storniert.', 'success');
    _finRenderJAB();
};

window._finJABSelectAll = (val) => {
    document.querySelectorAll('[data-jab-acc]').forEach(function(cb) { cb.checked = val; });
};

window._finJABDistChange = (accId, val) => {
    if (!_finState.jabData.distKeys) _finState.jabData.distKeys = {};
    _finState.jabData.distKeys[accId] = val;
};

window._finJABNext = async (fromStep) => {
    const bid = _finState.buildingId;

    // ── Step 1: Vermögensbericht laden/speichern ────────────
    if (fromStep === 1) {
        const fy = _finState.jabData.fy || _finState.fiscalYear;

        if (!_finState.jabData?.vsLoaded) {
            // Phase A: Daten laden (Bank/Rücklagenkonten + Forderungen)
            const accs = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
            _finState.accounts = accs;

            // Bank- und Rücklagenkonten (asset-Konten mit Kontonummer 1xxx = Bank/Kasse)
            const bankAccs = accs.filter(a => a.account_type === 'asset' && /^1[0-9]{3}$/.test(a.account_number));

            // System-Saldo per Konto berechnen (Soll - Haben bis Stichtag)
            const stichtag = fy + '-12-31';
            const { data: journalAll } = await _supabase.from('journal_entries').select('debit_account_id, credit_account_id, amount')
                .eq('building_id', bid).lte('entry_date', stichtag);

            const saldoMap = {};
            for (const e of (journalAll || [])) {
                saldoMap[e.debit_account_id]  = (saldoMap[e.debit_account_id]  || 0) + Number(e.amount);
                saldoMap[e.credit_account_id] = (saldoMap[e.credit_account_id] || 0) - Number(e.amount);
            }

            // Bestehende financial_statements laden (falls bereits gespeichert)
            const { data: existing } = await _supabase.from('financial_statements')
                .select('*').eq('building_id', bid).eq('fiscal_year', fy);
            const existMap = {};
            for (const fs of (existing || [])) existMap[fs.account_id] = fs;

            const vsRows = bankAccs.map(a => ({
                account_id: a.id,
                account_number: a.account_number,
                account_name: a.account_name,
                system_balance: Math.round((saldoMap[a.id] || 0) * 100) / 100,
                statement_balance: existMap[a.id]?.statement_balance ?? null,
                is_validated: existMap[a.id]?.is_validated || false,
                fs_id: existMap[a.id]?.id || null,
            }));

            // Offene Forderungen zum Stichtag
            const { data: demands } = await _supabase.from('payment_demands')
                .select('id, amount, due_date, demand_type, apartment:apartments(apartment_number), person:persons(first_name, last_name)')
                .eq('building_id', bid).lte('due_date', stichtag).in('status', ['open', 'overdue']);

            const forderungen = (demands || []).map(d => ({
                id: d.id,
                amount: d.amount,
                due_date: d.due_date,
                demand_type: d.demand_type,
                apt_number: d.apartment?.apartment_number || '—',
                person_name: d.person ? [d.person.first_name, d.person.last_name].filter(Boolean).join(' ') : '—',
            }));

            _finState.jabData.vsRows = vsRows;
            _finState.jabData.forderungen = forderungen;
            _finState.jabData.vsLoaded = true;
            _finState.jabData.fy = fy;
            _finRenderJAB();
            return;
        }

        // Phase B: Salden in financial_statements speichern
        const vsRows = _finState.jabData.vsRows || [];
        const upserts = vsRows.filter(r => r.statement_balance != null).map(r => ({
            building_id: bid,
            fiscal_year: fy,
            stichtag: fy + '-12-31',
            account_id: r.account_id,
            system_balance: r.system_balance,
            statement_balance: r.statement_balance,
            is_validated: Math.abs((r.statement_balance || 0) - r.system_balance) < 0.01,
            validated_at: Math.abs((r.statement_balance || 0) - r.system_balance) < 0.01 ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        }));

        if (upserts.length) {
            const { error } = await _supabase.from('financial_statements').upsert(upserts, { onConflict: 'building_id,fiscal_year,account_id' });
            if (error) { showToast('Fehler beim Speichern der Salden: ' + error.message, 'error'); return; }
        }

        _finState.jabStep = 2;
        _finRenderJAB();
        return;
    }

    // ── Step 2: Zeitraum & Konten (ehemals Step 1) ──────────
    if (fromStep === 2) {
        const fy   = Number(document.getElementById('jab-fy')?.value);
        const from = document.getElementById('jab-from')?.value;
        const to   = document.getElementById('jab-to')?.value;
        if (!from || !to) { showToast('Bitte Zeitraum eingeben.', 'error'); return; }

        const accs = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
        _finState.accounts = accs;

        // Phase A: Konten laden und Checkliste anzeigen
        if (!_finState.jabData?.step2Loaded) {
            const { data: entries } = await _supabase.from('journal_entries').select('*')
                .eq('building_id', bid)
                .gte('entry_date', from)
                .lte('entry_date', to)
                .order('entry_date');

            const allAccIds = new Set();
            for (const e of (entries || [])) {
                if (e.debit_account_id)  allAccIds.add(e.debit_account_id);
                if (e.credit_account_id) allAccIds.add(e.credit_account_id);
            }

            // HeizKV-Split aus Verteilerschlüssel laden (Fallback 70/30)
            const heizDK = (_finState.distKeys || []).find(k => k.type === 'heizkosten');
            const defaultSplitV = heizDK?.heiz_split_percent ?? 70;
            const defaultSplitF = 100 - defaultSplitV;

            _finState.jabData = {
                fy, from, to,
                rawEntries: entries || [],
                entries: entries || [],
                selectedAccIds: [...allAccIds],
                distKeys: {}, heatingMode: 'A', heatingManual: {}, heatSplitV: defaultSplitV, heatSplitF: defaultSplitF,
                step2Loaded: true
            };
            _finRenderJAB();
            return;
        }

        // Phase B: Auswahl übernehmen und zu Schritt 2 weiter
        const selectedAccIds = [...document.querySelectorAll('[data-jab-acc]:checked')].map(cb => Number(cb.dataset.jabAcc));
        if (!selectedAccIds.length) { showToast('Bitte mindestens ein Konto auswählen.', 'error'); return; }

        _finState.jabData.selectedAccIds = selectedAccIds;
        _finState.jabData.entries = _finState.jabData.rawEntries.filter(function(e) {
            return selectedAccIds.includes(e.debit_account_id) || selectedAccIds.includes(e.credit_account_id);
        });
        _finState.jabStep = 3;
        _finRenderJAB();

    } else if (fromStep === 3) {
        _finState.jabStep = 4;

        // Apartments laden falls nötig
        if (!_finState.apartments.length) {
            const { data: apts } = await _supabase.from('apartments').select('id,apartment_number,sq_meters').eq('building_id', bid).order('apartment_number');
            _finState.apartments = apts || [];
        }
        _finRenderJAB();

    } else if (fromStep === 4) {
        // Heizkosten-Manualwerte einlesen
        document.querySelectorAll('[data-heat="A"]').forEach(inp => {
            const aptId = Number(inp.dataset.aptId);
            const val   = parseFloat(inp.value);
            if (!isNaN(val)) _finState.jabData.heatingManual[aptId] = val;
        });

        // Für Option B: Split-Werte einlesen und validieren
        if (_finState.jabData.heatingMode === 'B') {
            const sv = Number(document.getElementById('jab-heat-split-v')?.value) || _finState.jabData.heatSplitV;
            const sf = Number(document.getElementById('jab-heat-split-f')?.value) || _finState.jabData.heatSplitF;
            if (Math.round(sv + sf) !== 100) {
                showToast('Verbrauchs- und Flächenanteil müssen zusammen 100% ergeben.', 'error'); return;
            }
            _finState.jabData.heatSplitV = sv;
            _finState.jabData.heatSplitF = sf;
            await _calcHeatingCostsB();
        }

        // Soll-Ist-Abgleich laden
        await _finJABLoadSollIst();
        _finState.jabStep = 5;
        _finRenderJAB();

    } else if (fromStep === 5) {
        const d = _finState.jabData;
        const aptMap = {};
        for (const apt of (_finState.apartments||[])) aptMap[apt.id] = apt;

        // §35a Steuerbescheinigung aufbereiten
        const stMap = {};
        for (const e of (d.entries||[])) {
            if (Number(e.lohn_anteil_35a) > 0) {
                const row = d.sollIst?.find(r => r.apt_id == e.apartment_id);
                const key = e.apartment_id || 'allgemein';
                stMap[key] = (stMap[key] || 0) + Number(e.lohn_anteil_35a);
            }
        }
        d.steuerbescheinigung = Object.entries(stMap).map(([aptId, lohn35a]) => {
            const row = d.sollIst?.find(r => r.apt_id == aptId);
            return { apt_number: row?.apt_number || 'Allgemein', owner_name: row?.owner_name, lohn35a };
        });

        // Abrechnungssaldo pro Einheit berechnen (Ist-Kosten via Verteilerschlüssel)
        const accs = _finState.accounts || [];
        const dkList = _finState.distKeys || [];
        const dkMap = {};
        dkList.forEach(function(k) { dkMap[k.id] = k; });

        // Einheit-direkte vs. verteilbare Buchungen trennen
        const directSollPerAptAcc = {};   // [aptId][accId] = Betrag (Soll)
        const directHabenPerAptAcc = {};  // [aptId][accId] = Betrag (Haben)
        const sharedSoll = {}, sharedHaben = {};

        for (const e of (d.entries || [])) {
            if (e.apartment_id) {
                if (!directSollPerAptAcc[e.apartment_id])  directSollPerAptAcc[e.apartment_id]  = {};
                if (!directHabenPerAptAcc[e.apartment_id]) directHabenPerAptAcc[e.apartment_id] = {};
                directSollPerAptAcc[e.apartment_id][e.debit_account_id]   = (directSollPerAptAcc[e.apartment_id][e.debit_account_id]   || 0) + Number(e.amount);
                directHabenPerAptAcc[e.apartment_id][e.credit_account_id] = (directHabenPerAptAcc[e.apartment_id][e.credit_account_id] || 0) + Number(e.amount);
            } else {
                sharedSoll[e.debit_account_id]   = (sharedSoll[e.debit_account_id]   || 0) + Number(e.amount);
                sharedHaben[e.credit_account_id] = (sharedHaben[e.credit_account_id] || 0) + Number(e.amount);
            }
        }

        // Verteilbare Ist-Kosten nur aus Buchungen ohne Einheit
        const costItems = [];
        accs.forEach(function(acc) {
            const amt = (sharedSoll[acc.id] || 0) - (sharedHaben[acc.id] || 0);
            if (acc.account_type === 'expense' && amt !== 0) costItems.push({ account: acc, ist_amount: amt });
        });

        // DK-Unit-Werte laden (falls noch nicht geladen)
        let dkUnitMap = d._dkUnitMap;
        if (!dkUnitMap) {
            const { data: dkUnits } = await _supabase.from('distribution_key_units').select('distribution_key_id, apartment_id, value');
            dkUnitMap = {};
            (dkUnits || []).forEach(function(u) {
                if (!dkUnitMap[u.distribution_key_id]) dkUnitMap[u.distribution_key_id] = {};
                dkUnitMap[u.distribution_key_id][u.apartment_id] = Number(u.value) || 0;
            });
            d._dkUnitMap = dkUnitMap;
        }

        // Anteil pro Einheit berechnen
        function _calcShareForApt(costItem, aptId) {
            const acc = costItem.account;
            if (!acc || !acc.primary_key_id || !dkMap[acc.primary_key_id]) return 0;
            const pk = dkMap[acc.primary_key_id];
            const pkTotal = Number(pk.total_value) || 0;
            const pkVal = (dkUnitMap[pk.id] && dkUnitMap[pk.id][aptId]) || 0;
            if (pkTotal === 0) return 0;
            const total = Number(costItem.ist_amount || 0);
            if (acc.secondary_key_id && acc.secondary_key_percentage && dkMap[acc.secondary_key_id]) {
                const sk = dkMap[acc.secondary_key_id];
                const skTotal = Number(sk.total_value) || 0;
                const skVal = (dkUnitMap[sk.id] && dkUnitMap[sk.id][aptId]) || 0;
                const pct = acc.secondary_key_percentage;
                return total * (1 - pct / 100) * (pkVal / pkTotal) + (skTotal > 0 ? total * (pct / 100) * (skVal / skTotal) : 0);
            }
            return total * (pkVal / pkTotal);
        }

        d.abrechnungsSaldo = (d.sollIst || []).map(function(row) {
            // 1. Verteilbarer Anteil via Schlüssel
            let istKosten = 0;
            for (const ci of costItems) istKosten += _calcShareForApt(ci, row.apt_id);

            // 2. Direktkosten dieser Einheit (nur Aufwandskonten, identische Logik wie costItems)
            // Nur Soll−Haben von expense-Konten zählen — Balance-Sheet-Gegenspieler (z.B. 1420)
            // dürfen den Aufwand nicht wegkürzen, da sie kein Kostenkonto sind.
            const dSoll  = directSollPerAptAcc[row.apt_id]  || {};
            const dHaben = directHabenPerAptAcc[row.apt_id] || {};
            accs.forEach(function(acc) {
                if (acc.account_type !== 'expense') return;
                const net = (dSoll[acc.id] || 0) - (dHaben[acc.id] || 0);
                if (net !== 0) istKosten += net;
            });

            const spitze = istKosten - row.soll;
            const zahlDiff = row.soll - row.bezahlt;
            const saldo = spitze + zahlDiff;
            return { apt_id: row.apt_id, apt_number: row.apt_number, owner_name: row.owner_name, istKosten, soll: row.soll, bezahlt: row.bezahlt, spitze, zahlDiff, saldo };
        });

        _finState.jabStep = 6;
        _finRenderJAB();
    }
};

async function _finJABLoadSollIst() {
    const bid = _finState.buildingId;
    const d   = _finState.jabData;

    const [{ data: demands }, { data: sonderlev }, { data: ownerships }] = await Promise.all([
        _supabase.from('payment_demands').select('apartment_id, amount, status, demand_type')
            .eq('building_id', bid).eq('fiscal_year', d.fy).eq('demand_type', 'hausgeld'),
        _supabase.from('special_levies').select('*').eq('building_id', bid).eq('fiscal_year', d.fy),
        _supabase.from('ownerships').select('apartment_id, owner:persons!ownerships_owner_id_fkey(first_name, last_name)').eq('is_active', true),
    ]);

    // Per apartment aggregieren
    const aptMap = {};
    for (const apt of (_finState.apartments||[])) {
        aptMap[apt.id] = { apt_id: apt.id, apt_number: apt.apartment_number, soll: 0, bezahlt: 0, owner_name: '' };
    }
    for (const o of (ownerships||[])) {
        if (aptMap[o.apartment_id]) aptMap[o.apartment_id].owner_name = o.owner ? (o.owner.first_name + ' ' + o.owner.last_name) : '–';
    }
    for (const dem of (demands||[])) {
        if (!aptMap[dem.apartment_id]) aptMap[dem.apartment_id] = { apt_id: dem.apartment_id, apt_number: '?', soll: 0, bezahlt: 0, owner_name: '' };
        aptMap[dem.apartment_id].soll += Number(dem.amount);
        if (dem.status === 'paid') aptMap[dem.apartment_id].bezahlt += Number(dem.amount);
    }

    d.sollIst    = Object.values(aptMap).filter(r => r.soll > 0);
    d.sonderIst  = sonderlev || [];
}

async function _calcHeatingCostsB() {
    const bid = _finState.buildingId;
    const d   = _finState.jabData;
    const apts = _finState.apartments || [];
    const fy   = d.fy;

    // Heizungs-Zähler laden
    const aptIds = apts.map(a => a.id);
    const { data: heatingMeters } = await _supabase.from('meters')
        .select('id, apartment_id').in('apartment_id', aptIds).eq('meter_type', 'heating').eq('is_active', true);

    if (!heatingMeters?.length) return;

    const meterIds = heatingMeters.map(m => m.id);
    const [{ data: curReadings }, { data: prevReadings }] = await Promise.all([
        _supabase.from('meter_readings').select('meter_id, reading_value, reading_date')
            .in('meter_id', meterIds).gte('reading_date', `${fy}-01-01`).lte('reading_date', `${fy}-12-31`)
            .order('reading_date', { ascending: false }),
        _supabase.from('meter_readings').select('meter_id, reading_value, reading_date')
            .in('meter_id', meterIds).gte('reading_date', `${fy-1}-01-01`).lte('reading_date', `${fy-1}-12-31`)
            .order('reading_date', { ascending: false }),
    ]);

    // Letzten Wert pro Zähler
    const lastCur  = {}, lastPrev = {};
    for (const r of (curReadings||[]))  { if (!lastCur[r.meter_id])  lastCur[r.meter_id]  = r.reading_value; }
    for (const r of (prevReadings||[])) { if (!lastPrev[r.meter_id]) lastPrev[r.meter_id] = r.reading_value; }

    // Verbrauch pro Einheit (cur - prev, Schätzung wenn kein Wert)
    const aptVerbrauch = {};
    let totalVerbrauch = 0;
    for (const m of heatingMeters) {
        const cur  = lastCur[m.id];
        const prev = lastPrev[m.id];
        let verbrauch = cur != null && prev != null ? cur - prev : null;
        if (verbrauch == null) {
            // Schätzung: Durchschnitt aller vorhandenen Werte + 10%
            const known = Object.values(aptVerbrauch).filter(v => v !== null);
            verbrauch = known.length ? (known.reduce((s,v)=>s+v,0) / known.length) * 1.1 : 0;
            d.hasEstimates = true;
        }
        aptVerbrauch[m.apartment_id] = verbrauch;
        totalVerbrauch += verbrauch;
    }

    // Heizkosten aus Buchungen (Aufwandskonten)
    const heatingAmount = (d.entries||[])
        .filter(e => _finState.accounts.find(a => a.id == e.debit_account_id && a.account_type === 'expense'))
        .reduce((s, e) => s + Number(e.amount), 0);

    const splitV   = (d.heatSplitV ?? 70) / 100;
    const splitF   = (d.heatSplitF ?? 30) / 100;
    const totalSqm = apts.reduce((s, a) => s + Number(a.sq_meters||0), 0);
    for (const apt of apts) {
        const verbrauchAnteil = totalVerbrauch > 0 ? (aptVerbrauch[apt.id]||0) / totalVerbrauch : 0;
        const flaecheAnteil   = totalSqm > 0 ? Number(apt.sq_meters||0) / totalSqm : 0;
        d.heatingManual[apt.id] = heatingAmount * splitV * verbrauchAnteil + heatingAmount * splitF * flaecheAnteil;
    }
}

window._finJABAbschluss = async () => {
    if (!confirm('Abrechnung abschließen? Buchungen des Abrechnungszeitraums werden gesperrt.')) return;
    const d = _finState.jabData;

    // journal_entries is_locked setzen
    const { error } = await _supabase.from('journal_entries')
        .update({ is_locked: true })
        .eq('building_id', _finState.buildingId)
        .gte('entry_date', d.from)
        .lte('entry_date', d.to);
    if (error) { showToast('Fehler beim Sperren: ' + error.message, 'error'); return; }

    // Nachzahlungs-Demands erstellen
    const nachzRows = (d.sollIst||[]).filter(r => r.soll - r.bezahlt > 0.01);
    if (nachzRows.length) {
        const inserts = nachzRows.map(r => ({
            building_id:  _finState.buildingId,
            apartment_id: r.apt_id,
            demand_type:  'abrechnungsspitze',
            amount:       Math.round((r.soll - r.bezahlt) * 100) / 100,
            due_date:     new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
            fiscal_year:  d.fy,
            status:       'open',
        }));
        await _supabase.from('payment_demands').insert(inserts);
    }

    // budget_plan status=closed
    const plan = _finState.plans.find(p => p.fiscal_year == d.fy && p.building_id == _finState.buildingId);
    if (plan) await _supabase.from('budget_plans').update({ status: 'closed' }).eq('id', plan.id);

    showToast('Abrechnung abgeschlossen. Buchungen gesperrt, Abrechnungsspitzen angelegt.', 'success');
    _finJABRender(_finState.jabStep); // Buttons aktualisieren
};

// ─── Jahr wieder öffnen (WP + JAB) ──────────────────────────
window._finReopenYear = async (planId) => {
    if (!confirm('Wirtschaftsjahr wieder öffnen? Die Journal-Sperre wird aufgehoben.')) return;
    const { error } = await _supabase.from('budget_plans').update({ status: 'active' }).eq('id', planId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Wirtschaftsjahr wieder geöffnet.', 'success');
    await _finLoadWP();
};

window._finJABReopen = async () => {
    if (!confirm('Sperre aufheben? Buchungen können wieder bearbeitet werden.')) return;
    const d = _finState.jabData;
    const plan = _finState.plans.find(p => p.fiscal_year == d.fy && p.building_id == _finState.buildingId);
    if (plan) {
        await _supabase.from('budget_plans').update({ status: 'active' }).eq('id', plan.id);
    }
    // Journal-Sperre aufheben
    await _supabase.from('journal_entries')
        .update({ is_locked: false })
        .eq('building_id', _finState.buildingId)
        .gte('entry_date', d.from)
        .lte('entry_date', d.to);
    showToast('Sperre aufgehoben. Buchungen wieder bearbeitbar.', 'success');
    _finJABRender(_finState.jabStep); // Buttons aktualisieren
};

// ── Beschluss-Aktivierung (Post-ETV) ─────────────────────────
// Setzt neue Hausgeld-Werte aus WP, erstellt Sollstellungen für Abrechnungsspitzen,
// historisiert alte Hausgeld-Werte.
window._finActivateBeschluss = async () => {
    const bid = _finState.buildingId;
    const d   = _finState.jabData;
    if (!d?.fy) { showToast('Keine Abrechnungsdaten vorhanden. Bitte zuerst den Wizard durchlaufen.', 'error'); return; }

    const fy = d.fy;
    const nextFy = fy + 1;

    // Prüfen ob ein aktiver/approved WP für das Folgejahr existiert
    const nextPlan = _finState.plans.find(p => p.fiscal_year == nextFy && ['active', 'approved'].includes(p.status));
    const hasPlan = !!nextPlan;

    let confirmMsg = `Beschlüsse für WJ ${fy} aktivieren?\n\n`;
    confirmMsg += '1. Abrechnungsspitzen (Guthaben/Nachzahlungen) werden als Sollstellungen angelegt (Fälligkeit: 14 Tage).\n';
    if (hasPlan) {
        confirmMsg += `2. Neue Hausgeld-Beträge aus Wirtschaftsplan ${nextFy} werden in die Einheiten übernommen.\n`;
        confirmMsg += '3. Alte Hausgeld-Werte werden historisiert.\n';
    } else {
        confirmMsg += `2. Kein aktiver Wirtschaftsplan für ${nextFy} gefunden — Hausgeld wird NICHT aktualisiert.\n`;
    }
    if (!confirm(confirmMsg)) return;

    const apts = _finState.apartments || [];
    const saldoData = d.abrechnungsSaldo || [];
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    let errors = [];

    // ── 1. Sollstellungen für Abrechnungsspitzen ──────────────
    const spitzenInserts = [];
    for (const row of saldoData) {
        const saldo = Number(row.saldo || 0);
        if (Math.abs(saldo) < 0.01) continue;
        spitzenInserts.push({
            building_id:  bid,
            apartment_id: row.apt_id,
            demand_type:  saldo > 0 ? 'nachzahlung' : 'guthaben',
            amount:       Math.round(Math.abs(saldo) * 100) / 100,
            due_date:     dueDate,
            fiscal_year:  fy,
            status:       'open',
            created_at:   new Date().toISOString(),
        });
    }
    if (spitzenInserts.length) {
        const { error } = await _supabase.from('payment_demands').insert(spitzenInserts);
        if (error) errors.push('Sollstellungen: ' + error.message);
    }

    // ── 2. Hausgeld-Update aus neuem WP ──────────────────────
    let hausgeldUpdated = 0;
    if (hasPlan) {
        // WP-Positionen + Verteilerschlüssel laden
        const { data: planItems } = await _supabase.from('budget_plan_items')
            .select('planned_amount, account_id')
            .eq('budget_plan_id', nextPlan.id);
        const accs = _finState.accounts || [];
        const dkList = _finState.distKeys || [];
        const dkMap = {};
        dkList.forEach(function(k) { dkMap[k.id] = k; });
        const { data: dkUnits } = await _supabase.from('distribution_key_units')
            .select('distribution_key_id, apartment_id, value');
        const dkUnitMap = {};
        (dkUnits || []).forEach(function(u) {
            if (!dkUnitMap[u.distribution_key_id]) dkUnitMap[u.distribution_key_id] = {};
            dkUnitMap[u.distribution_key_id][u.apartment_id] = Number(u.value) || 0;
        });

        const historyInserts = [];

        for (const apt of apts) {
            // Anteil berechnen: Summe aller (planned_amount × unitValue / totalValue) / 12
            let totalYear = 0;
            for (const item of (planItems || [])) {
                const acc = accs.find(function(a) { return a.id == item.account_id; });
                const pkId = acc?.primary_key_id;
                if (!pkId || !dkMap[pkId]) continue;
                const pk = dkMap[pkId];
                const pkTotal = Number(pk.total_value) || 0;
                const pkVal = (dkUnitMap[pkId] && dkUnitMap[pkId][apt.id]) || 0;
                if (pkTotal === 0) continue;
                totalYear += Number(item.planned_amount) * pkVal / pkTotal;
            }
            const newHausgeld = totalYear > 0 ? Math.round(totalYear / 12 * 100) / 100 : null;
            if (newHausgeld == null) continue;

            const oldHausgeld = Number(apt.hausgeld) || 0;
            if (Math.abs(oldHausgeld - newHausgeld) < 0.01) continue; // Keine Änderung

            // Historisierung
            historyInserts.push({
                building_id:   bid,
                apartment_id:  apt.id,
                old_hausgeld:  oldHausgeld,
                new_hausgeld:  newHausgeld,
                change_reason: 'Wirtschaftsplan-Beschluss ' + nextFy,
                fiscal_year:   nextFy,
                changed_by:    currentUser.id,
            });

            // Hausgeld aktualisieren
            const { error } = await _supabase.from('apartments').update({ hausgeld: newHausgeld }).eq('id', apt.id);
            if (error) { errors.push('WE ' + apt.apartment_number + ': ' + error.message); }
            else { hausgeldUpdated++; }
        }

        // Historien-Einträge speichern
        if (historyInserts.length) {
            const { error } = await _supabase.from('hausgeld_history').insert(historyInserts);
            if (error) errors.push('Historisierung: ' + error.message);
        }
    }

    // ── 3. Ergebnis ──────────────────────────────────────────
    if (errors.length) {
        showToast('Teilweise Fehler: ' + errors[0], 'warning');
    } else {
        let msg = `Beschlüsse aktiviert: ${spitzenInserts.length} Sollstellungen (Fälligkeit ${dueDate}).`;
        if (hausgeldUpdated > 0) msg += ` ${hausgeldUpdated} Hausgeld-Werte aus WP ${nextFy} aktualisiert.`;
        showToast(msg, 'success');
    }
};

window._finJABExportCSV = () => {
    const d   = _finState.jabData;
    const rows = [['Einheit','Eigentümer','Soll-HG (€)','Bezahlt (€)','Differenz (€)','Typ']];
    for (const r of (d.sollIst||[])) {
        const diff = r.soll - r.bezahlt;
        rows.push([r.apt_number, r.owner_name||'', r.soll.toFixed(2), r.bezahlt.toFixed(2), diff.toFixed(2), diff>0?'Nachzahlung':diff<0?'Guthaben':'Ausgeglichen']);
    }
    for (const l of (d.sonderIst||[])) {
        rows.push([l.title,'','',Number(l.total_amount).toFixed(2),'','Sonderumlage']);
    }
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    _finDownloadFile(csv, `Jahresabrechnung_${d.fy}_${_finState.buildingId}.csv`, 'text/csv;charset=utf-8');
};

window._finJABExportPDF = async () => {
    var d = _finState.jabData;
    if (!d || !d.fy) { showToast('Keine Abrechnungsdaten vorhanden. Bitte zuerst den Wizard durchlaufen.', 'error'); return; }
    await generateJahresabrechnungPDF(_finState.buildingId, d.fy, d);
};

window._finJABSaveForETV = async () => {
    var d = _finState.jabData;
    if (!d || !d.fy) { showToast('Keine Abrechnungsdaten vorhanden. Bitte zuerst den Wizard durchlaufen.', 'error'); return; }
    await generateJahresabrechnungPDF(_finState.buildingId, d.fy, d, true);
};

// ============================================================
// ─── Tab 10: Mahnwesen ────────────────────────────────────────
// ============================================================

async function _finLoadMahnwesen() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const accounts = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accounts;

    // Finanz-Defaults aus global_settings laden
    const { data: gs } = await _supabase.from('global_settings').select('base_interest_rate, default_dunning_fee').eq('id', 1).single();
    const gsRate = gs?.base_interest_rate ?? 3.37;
    const gsVerzugszins = Math.round((gsRate + 5) * 100) / 100; // § 288 BGB: Basiszins + 5%
    const gsFee  = gs?.default_dunning_fee ?? 5;

    const today = new Date().toISOString().split('T')[0];
    const [{ data: overdue }, { data: notices }] = await Promise.all([
        _supabase.from('payment_demands')
            .select('id, apartment_id, person_id, amount, due_date, status, demand_type, apartment:apartments(apartment_number), person:persons(first_name, last_name)')
            .eq('building_id', bid)
            .or(`status.eq.overdue,and(status.eq.open,due_date.lt.${today})`)
            .order('due_date'),
        _supabase.from('dunning_notices')
            .select('*, person:persons(first_name, last_name), demand:payment_demands(apartment_id, apartment:apartments(apartment_number))')
            .eq('building_id', bid)
            .order('created_at', { ascending: false })
            .limit(50),
    ]);

    const overdueRows = (overdue||[]).map(d => {
        const days = Math.ceil((Date.now() - new Date(d.due_date).getTime()) / 86400000);
        return `<tr class="hover:bg-gray-50/60">
            <td class="px-3 py-3"><input type="checkbox" class="mahn-check" data-id="${d.id}" data-amount="${d.amount}" data-person-id="${d.person_id||''}" data-person="${d.person ? (d.person.first_name+' '+d.person.last_name) : ''}" data-apt="${d.apartment?.apartment_number||''}" data-apt-id="${d.apartment_id||''}"></td>
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(d.due_date)}</td>
            <td class="px-4 py-3 text-sm font-semibold">${d.apartment?.apartment_number||'–'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${d.person ? (d.person.first_name + ' ' + d.person.last_name) : '–'}</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(d.amount).toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-center"><span class="text-xs bg-hb-orange/10 text-hb-orange font-semibold px-2 py-0.5 rounded-md">${days} Tage</span></td>
        </tr>`;
    }).join('');

    const dunningBadge = l => l==1?'<span class="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">Stufe 1</span>'
        :l==2?'<span class="text-xs bg-hb-orange/15 text-hb-orange font-semibold px-2 py-0.5 rounded-md">Stufe 2</span>'
        :'<span class="text-xs bg-hb-error/12 text-hb-error font-semibold px-2 py-0.5 rounded-md">Stufe 3</span>';
    const noticeRows = (notices||[]).map(n => `
        <tr class="hover:bg-gray-50/60">
            <td class="px-4 py-3 text-sm text-gray-500">${_finFormatDate(n.created_at)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${n.person ? (n.person.first_name + ' ' + n.person.last_name) : '–'}</td>
            <td class="px-4 py-3 text-sm font-semibold">${n.demand?.apartment?.apartment_number||'–'}</td>
            <td class="px-4 py-3">${dunningBadge(n.dunning_level)}</td>
            <td class="px-4 py-3 text-sm text-right">${Number(n.overdue_amount||0).toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm text-right text-hb-orange">${Number(n.dunning_fee||0).toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-sm font-bold text-right">${Number(n.total_amount||0).toLocaleString('de-DE',{minimumFractionDigits:2})} €</td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    ${n.status==='paid'
                        ? `<span class="text-xs text-hb-success font-semibold">Bezahlt</span>
                           <button onclick="_finNoticeReverse(${n.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5">Stornieren</button>`
                        : n.status==='cancelled'
                        ? '<span class="text-xs text-gray-400 font-semibold">Storniert</span>'
                        : `<button onclick="_finNoticePaidModal(${n.id},${n.payment_demand_id||'null'},${Number(n.overdue_amount||0).toFixed(2)},${Number(n.interest_amount||0).toFixed(2)},${Number(n.dunning_fee||0).toFixed(2)},${n.demand?.apartment_id||'null'})" class="text-xs text-hb-olive bg-hb-ultralight px-2 py-1 rounded-lg hover:bg-gray-100">Bezahlt</button>`
                    }
                    <button onclick="_finMahnungPDF('${n.person_id}',${n.building_id})" class="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg hover:bg-gray-100" title="Sammel-PDF für diese Person">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </button>
                </div>
            </td>
        </tr>`).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Überfällige Posten -->
        <div class="card overflow-hidden mb-5">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Überfällige Sollstellungen (${(overdue||[]).length})</span>
                <button onclick="_finSelectAllChecks()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Alle auswählen</button>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-3 py-3 w-8"></th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Fälligkeit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Person</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-500">Überfällig</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${overdueRows||'<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Keine überfälligen Posten. ✓</td></tr>'}</tbody>
            </table>
        </div>

        <!-- Mahnlauf -->
        <div class="card p-5 mb-5">
            <h3 class="text-sm font-bold text-hb-offblack mb-3">Mahnlauf starten</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Mahnstufe</label>
                    <select id="mahn-level" class="text-sm">
                        <option value="1">Stufe 1 — Zahlungserinnerung</option>
                        <option value="2">Stufe 2 — Mahnung</option>
                        <option value="3">Stufe 3 — Letzte Mahnung</option>
                    </select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Verzugszinssatz (%/Jahr)</label>
                    <input id="mahn-rate" type="number" step="0.01" value="${gsVerzugszins}" class="text-sm">
                    <span class="text-xs text-gray-400 mt-0.5 block">Basiszins ${gsRate}% + 5% (§ 288 BGB)</span></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Mahngebühr (€)</label>
                    <input id="mahn-fee" type="number" step="0.01" value="0" class="text-sm"></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Fälligkeit Mahnung</label>
                    <input id="mahn-due" type="date" value="${new Date(Date.now()+14*86400000).toISOString().split('T')[0]}" class="text-sm"></div>
            </div>
            <div id="mahn-level-fee-hint" class="text-xs text-gray-400 mt-2">Stufe 1: 0 € | Stufe 2: ${gsFee} € | Stufe 3: ${gsFee * 2} € (aus Einstellungen, editierbar)</div>
            <div class="flex gap-3 mt-4">
                <button onclick="_finCreateDunning()" class="btn-primary text-sm px-5 py-2.5">Mahnungen erstellen</button>
            </div>
        </div>

        <!-- Mahnungs-Tabelle -->
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3">
                <span class="text-sm font-bold text-white">Mahnungsverlauf</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Datum</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Person</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Einheit</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Stufe</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Betrag</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Geb.+Zinsen</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Gesamt</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500"></th>
                    </tr></thead>
                    <tbody class="divide-y divide-hb-olive/10">${noticeRows||'<tr><td colspan="8" class="px-4 py-8 text-center text-sm text-gray-400">Keine Mahnungen vorhanden.</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    // Mahnstufe → Gebühr vorausfüllen (aus global_settings)
    document.getElementById('mahn-level')?.addEventListener('change', function() {
        const fees = {'1': '0', '2': String(gsFee), '3': String(gsFee * 2)};
        const feeEl = document.getElementById('mahn-fee');
        if (feeEl) feeEl.value = fees[this.value] || '0';
    });

    // Responsive tables
    document.querySelectorAll('#fin-content .card').forEach(c => makeTableResponsive(c));
}

window._finSelectAllChecks = () => {
    document.querySelectorAll('.mahn-check').forEach(c => c.checked = !c.checked);
};

window._finCreateDunning = async () => {
    const bid   = _finState.buildingId;
    const level = Number(document.getElementById('mahn-level')?.value) || 1;
    const rate  = parseFloat(document.getElementById('mahn-rate')?.value) || 0;
    const fee   = parseFloat(document.getElementById('mahn-fee')?.value) || 0;
    const due   = document.getElementById('mahn-due')?.value;

    const checked = [...document.querySelectorAll('.mahn-check:checked')];
    if (!checked.length) { showToast('Bitte mindestens einen Posten auswählen.', 'error'); return; }

    const today   = new Date();
    const inserts = [];
    const updateIds = [];

    for (const inp of checked) {
        const demandId = Number(inp.dataset.id);
        const amount   = parseFloat(inp.dataset.amount);
        const demandDate = inp.closest('tr')?.querySelector('td:nth-child(2)')?.textContent?.trim();
        const daysOverdue = demandDate ? Math.max(0, Math.ceil((today - new Date(demandDate)) / 86400000)) : 0;
        const interest = Math.round(amount * (rate/100) * daysOverdue / 365 * 100) / 100;
        const totalFee = fee + interest;

        inserts.push({
            payment_demand_id: demandId,
            building_id:       bid,
            person_id:         inp.dataset.personId || null,
            dunning_level:     level,
            dunning_date:      new Date().toISOString().split('T')[0],
            overdue_amount:    amount,
            dunning_fee:       fee,
            interest_rate:     rate,
            interest_amount:   interest,
            total_amount:      amount + fee + interest,
            status:            'draft',
            created_by:        currentUser.id,
        });
        updateIds.push(demandId);
    }

    const { error } = await _supabase.from('dunning_notices').insert(inserts);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    // payment_demands.status wird hier NICHT geändert — bleibt overdue/open.
    // Erst _finNoticePaidConfirm setzt status='paid' nach tatsächlichem Zahlungseingang.

    // Mahngebühr als Aufwand buchen: Debit 4201 (Mahngebühren, mit apartment_id) / Credit 1420 (Forderungen Mahnwesen)
    // Nur wenn Mahngebühr > 0 — so erscheint sie als Direktkosten in der Jahresabrechnung der verursachenden Einheit.
    // Journal-Sperre: Mahngebühr-Buchung prüfen (aktuelles FY)
    if (fee > 0 && await _finIsYearClosed(bid, new Date().getFullYear())) {
        showToast('Mahngebühr konnte nicht gebucht werden — Wirtschaftsjahr ist abgeschlossen.', 'error');
    } else if (fee > 0) {
        const accs = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
        _finState.accounts = accs;
        const getAId = function(num) { return (accs.find(function(a) { return a.account_number === num; }) || {}).id; };
        const acc4201 = getAId('4201');
        const acc1420 = getAId('1420');
        if (acc4201 && acc1420) {
            const todayStr = new Date().toISOString().split('T')[0];
            const fy = new Date().getFullYear();
            const feeEntries = checked.map(function(inp) {
                return {
                    building_id:       bid,
                    entry_date:        todayStr,
                    fiscal_year:       fy,
                    apartment_id:      inp.dataset.aptId || null,
                    debit_account_id:  acc4201,
                    credit_account_id: acc1420,
                    amount:            fee,
                    description:       'Mahngebühr (Stufe ' + level + ')',
                    entry_type:        'manual'
                };
            });
            const { error: feeErr } = await _supabase.from('journal_entries').insert(feeEntries);
            if (feeErr) showToast('Mahngebühr-Buchung fehlgeschlagen: ' + feeErr.message, 'error');
        } else {
            showToast('Konto 4201 oder 1420 nicht gefunden — Mahngebühr nicht gebucht.', 'error');
        }
    }

    showToast(`${inserts.length} Mahnung(en) erstellt.`, 'success');
    await _finLoadMahnwesen();
};

// Öffnet Zahlungs-Bestätigungs-Modal mit Buchungs-Split-Vorschau
window._finNoticePaidModal = (noticeId, demandId, overdueAmt, interestAmt, feeAmt, apartmentId) => {
    _finState._paidModal = { noticeId, demandId, overdueAmt, interestAmt, feeAmt, apartmentId: apartmentId || null };
    const today = new Date().toISOString().split('T')[0];
    const total = overdueAmt + interestAmt + feeAmt;
    const fmt = function(v) { return Number(v).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; };

    document.getElementById('fin-notice-paid-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'fin-notice-paid-modal';
    modal.innerHTML = `<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)document.getElementById('fin-notice-paid-modal').remove()">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 class="text-base font-bold text-hb-offblack mb-4">Zahlung erfassen</h3>
            <div class="mb-4">
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Zahlungsdatum</label>
                <input type="date" id="fin-paid-date" value="${today}" class="w-full rounded-lg border border-gray-200 bg-hb-ultralight px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hb-olive/10">
            </div>
            <div class="bg-gray-50 rounded-lg p-4 mb-5 text-sm">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Buchungs-Split (3 Sätze)</div>
                <div class="flex justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-600">Bank (1200) → Forderung HG (1400)</span>
                    <span class="font-semibold">${fmt(overdueAmt)}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-600">Bank (1200) → Verzugszinsen (8010)</span>
                    <span class="font-semibold">${fmt(interestAmt)}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-600">Bank (1200) → Forderung Mahnwesen (1420)</span>
                    <span class="font-semibold">${fmt(feeAmt)}</span>
                </div>
                <div class="flex justify-between py-1.5 font-bold text-hb-offblack mt-1">
                    <span>Gesamt</span>
                    <span class="text-hb-olive">${fmt(total)}</span>
                </div>
            </div>
            <div class="flex gap-3 justify-end">
                <button onclick="document.getElementById('fin-notice-paid-modal').remove()" class="btn-secondary text-sm px-4 py-2">Abbrechen</button>
                <button onclick="_finNoticePaidConfirm()" class="btn-primary text-sm px-5 py-2">Bestätigen & Buchen</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

// Buchung ausführen nach Bestätigung im Modal
window._finNoticePaidConfirm = async () => {
    const m = _finState._paidModal || {};
    if (!m.noticeId) return;
    const { noticeId, demandId, overdueAmt, interestAmt, feeAmt, apartmentId } = m;

    const date = document.getElementById('fin-paid-date')?.value || new Date().toISOString().split('T')[0];
    const fiscalYear = new Date(date).getFullYear();
    const bid  = _finState.buildingId;

    // Journal-Sperre: abgeschlossene Jahre blockieren
    if (await _finBlockIfYearClosed(bid, fiscalYear)) return;

    const accs = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accs;
    const getAccId = function(num) { return (accs.find(function(a) { return a.account_number === num; }) || {}).id; };

    document.getElementById('fin-notice-paid-modal')?.remove();
    delete _finState._paidModal;

    const acc1200 = getAccId('1200');
    const acc1400 = getAccId('1400');
    const acc8010 = getAccId('8010');
    const acc1420 = getAccId('1420');

    const entries = [];
    if (overdueAmt > 0) {
        if (!acc1200 || !acc1400) { showToast('Konto 1200 oder 1400 nicht gefunden.', 'error'); return; }
        entries.push({ building_id: bid, entry_date: date, fiscal_year: fiscalYear, apartment_id: apartmentId || null, debit_account_id: acc1200, credit_account_id: acc1400, amount: overdueAmt, description: 'Mahnzahlung: Hauptforderung', entry_type: 'manual' });
    }
    if (interestAmt > 0) {
        if (!acc8010) { showToast('Konto 8010 (Verzugszinsen) fehlt — bitte Migration ausführen.', 'error'); return; }
        entries.push({ building_id: bid, entry_date: date, fiscal_year: fiscalYear, apartment_id: null, debit_account_id: acc1200, credit_account_id: acc8010, amount: interestAmt, description: 'Mahnzahlung: Verzugszinsen', entry_type: 'manual' });
    }
    if (feeAmt > 0) {
        // Zahlung löscht die Forderung Mahnwesen (1420) — kein apartment_id, da Gegenbuchung zur Mahnung-Erstellung
        if (!acc1420) { showToast('Konto 1420 (Forderungen Mahnwesen) fehlt.', 'error'); return; }
        entries.push({ building_id: bid, entry_date: date, fiscal_year: fiscalYear, apartment_id: null, debit_account_id: acc1200, credit_account_id: acc1420, amount: feeAmt, description: 'Mahnzahlung: Forderung Mahnwesen (Gebühr)', entry_type: 'manual' });
    }

    // Bug 2 fix: Buchung ZUERST — nur bei Erfolg Status-Updates
    if (entries.length) {
        const { error: journalError } = await _supabase.from('journal_entries').insert(entries);
        if (journalError) { showToast('Buchung fehlgeschlagen: ' + journalError.message, 'error'); return; }
    }

    await _supabase.from('dunning_notices').update({ status: 'paid' }).eq('id', noticeId);
    if (demandId) await _supabase.from('payment_demands').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', demandId);

    showToast('Zahlung erfasst — ' + entries.length + ' Buchungssatz/-sätze erstellt.', 'success');
    if (feeAmt > 0) {
        setTimeout(() => showToast('Hinweis: Mahngebühr wurde auf dem WEG-Konto gutgeschrieben — bitte Überweisung auf Verwalterkonto veranlassen.', 'info'), 1500);
    }
    await _finLoadMahnwesen();
};

// Storno einer bezahlten Mahnung (GoBD: Gegenbuchungen, kein DELETE)
window._finNoticeReverse = async (noticeId) => {
    if (!confirm('Zahlung stornieren? Die zugehörigen Journal-Einträge werden durch Gegenbuchungen storniert.')) return;

    const bid  = _finState.buildingId;
    const accs = _finState.accounts || [];
    const getAccId = function(num) { return (accs.find(function(a) { return a.account_number === num; }) || {}).id; };

    const { data: notice, error } = await _supabase.from('dunning_notices')
        .select('overdue_amount, interest_amount, dunning_fee, payment_demand_id')
        .eq('id', noticeId).single();
    if (error || !notice) { showToast('Mahnung nicht gefunden.', 'error'); return; }

    const today  = new Date().toISOString().split('T')[0];
    const acc1200 = getAccId('1200');
    const acc1400 = getAccId('1400');
    const acc8010 = getAccId('8010');
    const acc8020 = getAccId('8020');
    const stornoEntries = [];

    if (Number(notice.overdue_amount) > 0 && acc1200 && acc1400)
        stornoEntries.push({ building_id: bid, entry_date: today, debit_account_id: acc1400, credit_account_id: acc1200, amount: Number(notice.overdue_amount), description: 'Storno: Mahnzahlung Hauptforderung', entry_type: 'storno' });
    if (Number(notice.interest_amount) > 0 && acc1200 && acc8010)
        stornoEntries.push({ building_id: bid, entry_date: today, debit_account_id: acc8010, credit_account_id: acc1200, amount: Number(notice.interest_amount), description: 'Storno: Mahnzahlung Verzugszinsen', entry_type: 'storno' });
    if (Number(notice.dunning_fee) > 0 && acc1200 && acc8020)
        stornoEntries.push({ building_id: bid, entry_date: today, debit_account_id: acc8020, credit_account_id: acc1200, amount: Number(notice.dunning_fee), description: 'Storno: Mahnzahlung Mahngebühr', entry_type: 'storno' });

    const ops = [_supabase.from('dunning_notices').update({ status: 'sent' }).eq('id', noticeId)];
    if (notice.payment_demand_id) ops.push(
        _supabase.from('payment_demands').update({ status: 'overdue', updated_at: new Date().toISOString() }).eq('id', notice.payment_demand_id)
    );
    if (stornoEntries.length) ops.push(_supabase.from('journal_entries').insert(stornoEntries));

    const results = await Promise.all(ops);
    const errs = results.filter(function(r) { return r && r.error; }).map(function(r) { return r.error.message; });
    if (errs.length) { showToast('Fehler: ' + errs[0], 'error'); return; }

    showToast('Storno erfasst — ' + stornoEntries.length + ' Gegenbuchung(en) erstellt.', 'success');
    await _finLoadMahnwesen();
};

// Sammel-PDF: alle offenen/draft notices einer Person im Gebäude
window._finMahnungPDF = async (personId, buildingId) => {
    const { data } = await _supabase.from('dunning_notices').select('id')
        .eq('person_id', personId).eq('building_id', buildingId).in('status', ['draft', 'sent']);
    const ids = (data || []).map(function(n) { return n.id; });
    if (!ids.length) { showToast('Keine offenen Mahnungen für diese Person.', 'error'); return; }
    await generateMahnungPDF(ids);
};

// ============================================================
// ─── Tab 11: DATEV-Export ────────────────────────────────────
// ============================================================

async function _finLoadDatev() {
    const bid = _finState.buildingId;
    const fy  = _finState.fiscalYear;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-[15px]">Kein Gebäude gewählt.</p>'; return; }

    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y==fy?'selected':''}>${y}</option>`).join('');

    document.getElementById('fin-content').innerHTML = `
        <div class="card p-6 max-w-lg">
            <h3 class="text-base font-extrabold text-hb-offblack mb-4">DATEV-Export konfigurieren</h3>
            <div class="space-y-3">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Wirtschaftsjahr</label>
                    <select id="datev-fy" class="text-sm">${fyOpts}</select></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Zeitraum von</label>
                        <input id="datev-from" type="date" value="${fy}-01-01"></div>
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Zeitraum bis</label>
                        <input id="datev-to" type="date" value="${fy}-12-31"></div>
                </div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Kontenrahmen</label>
                    <select id="datev-skr" class="text-sm">
                        <option value="SKR03" selected>SKR03</option>
                        <option value="SKR04">SKR04</option>
                    </select></div>
                <div class="bg-hb-ultralight border border-hb-olive/10 rounded-lg p-3 text-xs text-gray-500">
                    Export im DATEV Buchungsstapel-Format (UTF-8 mit BOM, Semikolon-getrennt). Kompatibel mit DATEV Unternehmen online und gängigen Steuerberater-Systemen.
                </div>
            </div>
            <div class="flex flex-col gap-3 mt-5">
                <button onclick="_finExportDatev()" class="btn-primary text-sm py-3">DATEV-Export generieren &amp; herunterladen</button>
                <button onclick="_fin35aExport()" class="text-xs text-hb-olive bg-hb-ultralight border border-hb-olive/12 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-center">
                    §35a EStG Steuerbescheinigung (separate CSV)
                </button>
            </div>
        </div>`;
}

window._finExportDatev = async () => {
    const bid  = _finState.buildingId;
    const from = document.getElementById('datev-from')?.value;
    const to   = document.getElementById('datev-to')?.value;
    const fy   = document.getElementById('datev-fy')?.value;
    const skr  = document.getElementById('datev-skr')?.value || 'SKR03';
    if (!from || !to) { showToast('Bitte Zeitraum angeben.', 'error'); return; }

    const accs = _finState.accounts.length ? _finState.accounts : await _finGetAccounts(bid);
    _finState.accounts = accs;
    const accMap = {};
    for (const a of accs) accMap[a.id] = a;

    const { data: entries } = await _supabase.from('journal_entries').select('*')
        .eq('building_id', bid).gte('entry_date', from).lte('entry_date', to)
        .order('entry_date');

    if (!entries?.length) { showToast('Keine Buchungen im Zeitraum.', 'error'); return; }

    // DATEV Buchungsstapel Header (vereinfacht)
    const datevHeader = [
        `"EXTF";700;21;"Buchungsstapel";2;${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)};;"";;"";1;${fy};4;${from.replace(/-/g,'')};${to.replace(/-/g,'')};;"${skr}";"";0;"";"";"Mieterportal";"";"";"";"";"";"";""`,
        '"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext"'
    ];

    const dataRows = entries.map(e => {
        const debitAcc  = accMap[e.debit_account_id];
        const creditAcc = accMap[e.credit_account_id];
        const dateParts = e.entry_date?.split('-') || ['','',''];
        const belegDat  = `${dateParts[2]}${dateParts[1]}`;     // DDMM for DATEV
        const amount    = Number(e.amount).toFixed(2).replace('.',',');
        const desc      = (e.description||'').replace(/"/g,'""').slice(0,60);
        const ref       = (e.reference_number||'').replace(/"/g,'""').slice(0,36);
        return `"${amount}";"S";"EUR";"";"";"";"${debitAcc?.account_number||''}";"${creditAcc?.account_number||''}";"";"${belegDat}";"${ref}";"";"0";"${desc}"`;
    });

    const csv = '\uFEFF' + datevHeader.join('\r\n') + '\r\n' + dataRows.join('\r\n');
    _finDownloadFile(csv, `DATEV_${skr}_${fy}_${from}_${to}.csv`, 'text/csv;charset=utf-8');
    showToast(`${entries.length} Buchungen als DATEV-CSV exportiert.`, 'success');
};

window._fin35aExport = async () => {
    const bid  = _finState.buildingId;
    const from = document.getElementById('datev-from')?.value;
    const to   = document.getElementById('datev-to')?.value;
    const fy   = document.getElementById('datev-fy')?.value;
    if (!from || !to) { showToast('Bitte Zeitraum angeben.', 'error'); return; }

    const { data: entries } = await _supabase.from('journal_entries')
        .select('entry_date, description, apartment_id, lohn_anteil_35a, apartment:apartments(apartment_number)')
        .eq('building_id', bid).gte('entry_date', from).lte('entry_date', to)
        .gt('lohn_anteil_35a', 0);

    if (!entries?.length) { showToast('Keine §35a-Buchungen im Zeitraum.', 'error'); return; }

    // Aggregieren nach Einheit
    const aptMap = {};
    for (const e of entries) {
        const key = e.apartment_id || 'allgemein';
        if (!aptMap[key]) aptMap[key] = { apt: e.apartment?.apartment_number || 'Allgemein', total: 0, rows: [] };
        aptMap[key].total += Number(e.lohn_anteil_35a);
        aptMap[key].rows.push(e);
    }

    const rows = [['Einheit','Beschreibung','Datum','Lohnanteil §35a (€)']];
    for (const [, v] of Object.entries(aptMap)) {
        for (const e of v.rows) {
            rows.push([v.apt, e.description, e.entry_date, Number(e.lohn_anteil_35a).toFixed(2)]);
        }
        rows.push([v.apt, 'GESAMT', '', v.total.toFixed(2)]);
    }

    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    _finDownloadFile(csv, `35a_Steuerbescheinigung_${fy}.csv`, 'text/csv;charset=utf-8');
    showToast('§35a-Bescheinigung exportiert.', 'success');
};

// ─── Hilfsfunktion: CSV-Download ─────────────────────────────

function _finDownloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════════════════════════
// TAB 12: CSV-BANKIMPORT (6.4)
// ═══════════════════════════════════════════════════════════════

const _csvState = {
    rows: [],       // parsed transactions
    accounts: [],   // accounts for building
    bankAccounts: [],
};

async function _finLoadCsvImport() {
    const el = document.getElementById('fin-content');
    const bid = _finState.buildingId;

    // load accounts + bank accounts
    const [accRes, bankRes] = await Promise.all([
        _supabase.from('accounts').select('id,account_number,account_name,account_type')
            .eq('building_id', bid).eq('is_active', true).order('sort_order'),
        _supabase.from('building_bank_accounts').select('id,account_type,bank_name,iban')
            .eq('building_id', bid),
    ]);
    _csvState.accounts    = accRes.data  || [];
    _csvState.bankAccounts = bankRes.data || [];
    _csvState.rows = [];

    const bankOpts = _csvState.bankAccounts.map(b =>
        `<option value="${b.id}">${b.bank_name} — ${b.iban}</option>`
    ).join('');

    el.innerHTML = `
        <div class="space-y-5">
            <!-- Header-Zeile -->
            <div class="card p-5">
                <div class="flex gap-4 flex-wrap">
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Bankkonto</label>
                        <select id="csv-bank-select" class="w-full text-sm">${bankOpts || '<option>Kein Bankkonto</option>'}</select>
                    </div>
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Format</label>
                        <select id="csv-format-select" class="w-full text-sm">
                            <option value="sparkasse">CSV Sparkasse</option>
                            <option value="volksbank">CSV Volksbank / DZ Bank</option>
                            <option value="generic">CSV allgemein (Datum;Betrag;Name;Zweck)</option>
                            <option value="mt940">MT940 (Swift)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Drop-Zone -->
            <div id="csv-dropzone"
                class="border-2 border-dashed border-hb-olive/30 rounded-2xl p-10 text-center cursor-pointer hover:border-hb-olive/60 hover:bg-hb-olive/5 transition-colors"
                onclick="document.getElementById('csv-file-input').click()"
                ondragover="event.preventDefault(); this.classList.add('border-hb-olive','bg-hb-olive/5')"
                ondragleave="this.classList.remove('border-hb-olive','bg-hb-olive/5')"
                ondrop="_csvHandleDrop(event)">
                <div class="text-4xl mb-3 text-hb-olive/40">↑</div>
                <p class="font-semibold text-hb-olive">Datei hierher ziehen</p>
                <p class="text-[15px] text-gray-400 mt-1">oder klicken zum Auswählen · CSV oder STA/MT940</p>
                <input id="csv-file-input" type="file" accept=".csv,.sta,.txt,.mt940" class="hidden"
                    onchange="_csvHandleFile(this.files[0])">
            </div>

            <!-- Preview-Tabelle (leer am Anfang) -->
            <div id="csv-preview"></div>
        </div>`;
}

window._csvHandleDrop = (e) => {
    e.preventDefault();
    document.getElementById('csv-dropzone').classList.remove('border-hb-olive','bg-hb-olive/5');
    const file = e.dataTransfer.files[0];
    if (file) _csvHandleFile(file);
};

window._csvHandleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const fmt  = document.getElementById('csv-format-select')?.value || 'sparkasse';
        try {
            _csvState.rows = _csvParse(text, fmt);
            _csvRenderPreview();
        } catch(err) {
            showToast('Fehler beim Parsen: ' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'UTF-8');
};

function _csvParse(text, fmt) {
    if (fmt === 'mt940') return _csvParseMt940(text);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (fmt === 'sparkasse')  return _csvParseSparkasse(lines);
    if (fmt === 'volksbank')  return _csvParseVolksbank(lines);
    return _csvParseGeneric(lines);
}

// Sparkasse: Auftragskonto;Buchungstag;Wertstellung;Buchungstext;Auftraggeber/Empfänger;Konto;BLZ;Betrag;...
function _csvParseSparkasse(lines) {
    const rows = [];
    // skip header row(s) — find data rows by checking for date pattern
    for (const line of lines) {
        const cols = _csvSplit(line);
        if (cols.length < 8) continue;
        const dateRaw = cols[1]; // Buchungstag DD.MM.YY or DD.MM.YYYY
        if (!dateRaw || !/\d{2}\.\d{2}/.test(dateRaw)) continue;
        const amount = parseFloat((cols[7] || '0').replace(/\./g,'').replace(',','.'));
        if (isNaN(amount)) continue;
        rows.push({
            date:     _csvParseDate(dateRaw),
            name:     (cols[4] || '').trim().replace(/^"|"$/g,''),
            purpose:  (cols[3] || '').trim().replace(/^"|"$/g,''),
            amount,
        });
    }
    return rows;
}

// Volksbank: ;Kontonummer;BIC;Kontoinhaber;Buchungstag;Valuta;Name;...;Verwendungszweck;Betrag;...
function _csvParseVolksbank(lines) {
    const rows = [];
    for (const line of lines) {
        const cols = _csvSplit(line);
        if (cols.length < 12) continue;
        const dateRaw = cols[4];
        if (!dateRaw || !/\d{2}\.\d{2}/.test(dateRaw)) continue;
        const amount = parseFloat((cols[11] || '0').replace(/\./g,'').replace(',','.'));
        if (isNaN(amount)) continue;
        rows.push({
            date:    _csvParseDate(dateRaw),
            name:    (cols[6] || '').trim().replace(/^"|"$/g,''),
            purpose: (cols[10] || '').trim().replace(/^"|"$/g,''),
            amount,
        });
    }
    return rows;
}

// Generic: Datum;Betrag;Name;Verwendungszweck (first row = header)
function _csvParseGeneric(lines) {
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = _csvSplit(lines[i]);
        if (cols.length < 2) continue;
        const dateRaw = cols[0];
        if (!dateRaw || !/\d/.test(dateRaw)) continue;
        const amount = parseFloat((cols[1] || '0').replace(/\./g,'').replace(',','.'));
        if (isNaN(amount)) continue;
        rows.push({
            date:    _csvParseDate(dateRaw),
            name:    (cols[2] || '').trim().replace(/^"|"$/g,''),
            purpose: (cols[3] || '').trim().replace(/^"|"$/g,''),
            amount,
        });
    }
    return rows;
}

// MT940 Swift parser
function _csvParseMt940(text) {
    const rows = [];
    const txBlocks = text.split(/:61:/);
    for (let i = 1; i < txBlocks.length; i++) {
        const block = txBlocks[i];
        // Date: YYMMDD in :61: line
        const dateMatch = block.match(/^(\d{6})/);
        if (!dateMatch) continue;
        const ds = dateMatch[1];
        const date = `20${ds.slice(0,2)}-${ds.slice(2,4)}-${ds.slice(4,6)}`;
        // Amount: C/D + amount
        const amtMatch = block.match(/\d{6}(?:\d{4})?[CD](\d+,\d{2})/);
        if (!amtMatch) continue;
        const sign   = block.includes('D') && !block.includes('C') ? -1 : 1;
        const amount = sign * parseFloat(amtMatch[1].replace(',','.'));
        // :86: Verwendungszweck
        const purposeMatch = block.match(/:86:([\s\S]*?)(?=:\d{2}[A-Z]?:|$)/);
        const purpose = purposeMatch ? purposeMatch[1].replace(/\r?\n/g,' ').trim().slice(0,120) : '';
        rows.push({ date, name: '', purpose, amount });
    }
    return rows;
}

function _csvSplit(line) {
    const result = [];
    let cur = '', inQ = false;
    for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ';' && !inQ) { result.push(cur); cur = ''; }
        else cur += ch;
    }
    result.push(cur);
    return result;
}

function _csvParseDate(raw) {
    // DD.MM.YYYY or DD.MM.YY
    const m = raw.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (!m) return raw;
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2]}-${m[1]}`;
}

function _csvRenderPreview() {
    const el = document.getElementById('csv-preview');
    const rows = _csvState.rows;
    if (!rows.length) {
        el.innerHTML = '<p class="text-[15px] text-gray-400 text-center py-6">Keine Buchungen gefunden.</p>';
        return;
    }

    const acctOpts = _csvState.accounts.map(a =>
        `<option value="${a.id}">${a.account_number} ${a.account_name}</option>`
    ).join('');

    const rowHtml = rows.map((r, i) => {
        const isCredit = r.amount >= 0;
        const colorClass = isCredit ? 'text-hb-success' : 'text-hb-error';
        return `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-center">
                <input type="checkbox" id="csv-chk-${i}" checked class="accent-hb-olive">
            </td>
            <td class="px-3 py-2 text-sm text-gray-600">${r.date}</td>
            <td class="px-3 py-2 text-sm font-medium">${_esc(r.name || '—')}</td>
            <td class="px-3 py-2 text-sm text-gray-500 max-w-[220px] truncate" title="${_esc(r.purpose)}">${_esc(r.purpose || '—')}</td>
            <td class="px-3 py-2 text-sm font-bold text-right ${colorClass}">${r.amount >= 0 ? '+' : ''}${r.amount.toFixed(2)} €</td>
            <td class="px-3 py-2">
                <select id="csv-acc-${i}" class="text-xs w-full">
                    <option value="">— Konto wählen —</option>
                    ${acctOpts}
                </select>
            </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">${rows.length} Buchungen gefunden</span>
                <div class="flex gap-2">
                    <button onclick="_csvSelectAll(true)"  class="text-xs bg-white text-hb-olive px-3 py-1 rounded-lg font-semibold">Alle</button>
                    <button onclick="_csvSelectAll(false)" class="text-xs bg-white/20 text-white px-3 py-1 rounded-lg font-semibold">Keine</button>
                    <button onclick="_csvImport()" class="text-xs bg-hb-orange text-white px-4 py-1 rounded-lg font-bold hover:opacity-90">Importieren</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full divide-y divide-hb-olive/10">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-center w-8"></th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Datum</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Name</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Verwendungszweck</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-right">Betrag</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Konto</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-hb-olive/10">${rowHtml}</tbody>
                </table>
            </div>
        </div>`;

    // Responsive tables
    makeTableResponsive(document.querySelector('#csv-preview .card'));
}

window._csvSelectAll = (checked) => {
    _csvState.rows.forEach((_, i) => {
        const chk = document.getElementById(`csv-chk-${i}`);
        if (chk) chk.checked = checked;
    });
};

window._csvImport = async () => {
    const bid      = _finState.buildingId;
    const bankId   = document.getElementById('csv-bank-select')?.value;
    const selected = _csvState.rows.filter((_, i) => document.getElementById(`csv-chk-${i}`)?.checked);

    if (!selected.length) { showToast('Keine Buchungen ausgewählt.', 'error'); return; }

    // build entries — only those with an account assigned
    const entries = [];
    for (let i = 0; i < _csvState.rows.length; i++) {
        if (!document.getElementById(`csv-chk-${i}`)?.checked) continue;
        const r      = _csvState.rows[i];
        const accId  = document.getElementById(`csv-acc-${i}`)?.value;
        if (!accId) continue;

        // cash account (1200) for the bank side
        const cashAcc = _csvState.accounts.find(a => a.account_number === '1200');
        const isCredit = r.amount >= 0;

        entries.push({
            building_id:       bid,
            entry_date:        r.date,
            description:       [r.name, r.purpose].filter(Boolean).join(' · ').slice(0,200) || 'CSV-Import',
            amount:            Math.abs(r.amount),
            debit_account_id:  isCredit ? (cashAcc?.id || Number(accId)) : Number(accId),
            credit_account_id: isCredit ? Number(accId) : (cashAcc?.id || Number(accId)),
            entry_type:        'csv_import',
            fiscal_year:       new Date(r.date).getFullYear(),
            reference_number:  r.purpose ? r.purpose.slice(0,50) : null,
        });
    }

    if (!entries.length) {
        showToast('Bitte jedem importierten Eintrag ein Konto zuweisen.', 'error');
        return;
    }

    // duplicate check: reference_number already in journal_entries
    const refs = entries.map(e => e.reference_number).filter(Boolean);
    if (refs.length) {
        const { data: existing } = await _supabase.from('journal_entries')
            .select('reference_number')
            .eq('building_id', bid)
            .in('reference_number', refs);
        const dupSet = new Set((existing || []).map(e => e.reference_number));
        const dupes  = entries.filter(e => e.reference_number && dupSet.has(e.reference_number));
        if (dupes.length) {
            showToast(`${dupes.length} Duplikat(e) übersprungen (Referenznummer bereits vorhanden).`, 'error');
            entries.splice(0, entries.length, ...entries.filter(e => !e.reference_number || !dupSet.has(e.reference_number)));
            if (!entries.length) return;
        }
    }

    const { error } = await _supabase.from('journal_entries').insert(entries);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    showToast(`${entries.length} Buchung(en) erfolgreich importiert.`, 'success');
    _csvState.rows = [];
    await _finLoadCsvImport();
};

function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ═══════════════════════════════════════════════════════════════
// TAB 13: SEPA-XML EXPORT (PAIN.008.003.02)
// ═══════════════════════════════════════════════════════════════

async function _finLoadSepaExport() {
    const el  = document.getElementById('fin-content');
    const bid = _finState.buildingId;

    // load building + bank accounts
    const [bldRes, bankRes] = await Promise.all([
        _supabase.from('buildings').select('name,creditor_id').eq('id', bid).single(),
        _supabase.from('building_bank_accounts').select('id,account_type,bank_name,iban,bic')
            .eq('building_id', bid),
    ]);
    const building   = bldRes.data  || {};
    const bankAccounts = bankRes.data || [];
    const giroAcc   = bankAccounts.find(b => b.account_type === 'giro') || bankAccounts[0] || {};

    const curYear = new Date().getFullYear();
    const yearOpts = [curYear - 1, curYear, curYear + 1].map(y =>
        `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`
    ).join('');

    const bankOpts = bankAccounts.map(b =>
        `<option value="${b.id}" ${b.id === giroAcc.id ? 'selected' : ''}
            data-iban="${b.iban}" data-bic="${b.bic || ''}">${b.bank_name} — ${b.iban}</option>`
    ).join('');

    el.innerHTML = `
        <div class="space-y-5">
            <!-- Einstellungen -->
            <div class="card p-5">
                <h3 class="text-sm font-bold text-hb-olive mb-4">SEPA-Lastschrift Einstellungen</h3>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Gläubiger-ID (Creditor ID)</label>
                        <input id="sepa-creditor-id" type="text" value="${building.creditor_id || ''}"
                            placeholder="DE98ZZZ09999999999"
                            class="w-full text-sm bg-hb-ultralight border border-gray-200 rounded-lg px-3 py-2">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Gläubiger-Konto (Zielkonto)</label>
                        <select id="sepa-bank-select" class="w-full text-sm">${bankOpts || '<option>Kein Konto</option>'}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Wirtschaftsjahr</label>
                        <select id="sepa-year-select" class="w-full text-sm">${yearOpts}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Fälligkeitsdatum (Requested Collection Date)</label>
                        <input id="sepa-due-date" type="date" class="w-full text-sm bg-hb-ultralight border border-gray-200 rounded-lg px-3 py-2"
                            value="${new Date(Date.now() + 5*86400000).toISOString().slice(0,10)}">
                    </div>
                </div>
                <button onclick="_sepaLoadPreview()"
                    class="px-4 py-2 bg-hb-olive text-white text-sm font-semibold rounded-lg hover:opacity-90">
                    Vorschau laden
                </button>
            </div>
            <div id="sepa-preview"></div>
        </div>`;
}

window._sepaLoadPreview = async () => {
    const el   = document.getElementById('sepa-preview');
    const bid  = _finState.buildingId;
    const year = Number(document.getElementById('sepa-year-select')?.value);

    el.innerHTML = `<div class="flex justify-center py-8"><div class="w-6 h-6 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    // open/overdue payment_demands + apartment → tenancy → persons → person_bank_accounts
    const { data: demands, error } = await _supabase
        .from('payment_demands')
        .select(`
            id, amount, due_date, demand_type,
            apartment:apartments(
                apartment_number,
                tenancies(
                    tenant:persons(
                        id, first_name, last_name,
                        person_bank_accounts(iban, bic, account_holder)
                    ),
                    end_date
                )
            )
        `)
        .eq('building_id', bid)
        .eq('fiscal_year', year)
        .in('status', ['open', 'overdue'])
        .order('due_date');

    if (error) { el.innerHTML = `<p class="text-hb-error text-sm p-4">${error.message}</p>`; return; }

    const rows = (demands || []).map(d => {
        const apt       = d.apartment;
        const activeTen = apt?.tenancies?.find(t => !t.end_date || new Date(t.end_date) >= new Date());
        const person    = activeTen?.tenant;
        const bankAcc   = person?.person_bank_accounts?.[0];
        return {
            demandId: d.id,
            aptNum:   apt?.apartment_number || '—',
            person:   person ? `${person.first_name} ${person.last_name}` : '—',
            amount:   d.amount,
            dueDate:  d.due_date,
            iban:     bankAcc?.iban || '',
            bic:      bankAcc?.bic  || '',
            holder:   bankAcc?.account_holder || (person ? `${person.first_name} ${person.last_name}` : ''),
            hasIban:  !!bankAcc?.iban,
        };
    });

    if (!rows.length) {
        el.innerHTML = '<div class="card p-8 text-center text-gray-400 text-sm">Keine offenen Sollstellungen für dieses Jahr.</div>';
        return;
    }

    const noIbanCount = rows.filter(r => !r.hasIban).length;
    const noIbanBanner = noIbanCount > 0 ? `
        <div class="flex items-center gap-2 bg-hb-orange/10 border border-hb-orange/30 rounded-lg px-4 py-2 text-sm text-hb-orange font-semibold mb-4">
            <span>⚠</span>
            <span>${noIbanCount} Eigentümer ohne hinterlegte IBAN — diese werden im XML nicht berücksichtigt.</span>
        </div>` : '';

    const rowHtml = rows.map((r, i) => `
        <tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-center">
                <input type="checkbox" id="sepa-chk-${i}" ${r.hasIban ? 'checked' : 'disabled'}
                    class="accent-hb-olive" ${!r.hasIban ? 'title="Keine IBAN hinterlegt"' : ''}>
            </td>
            <td class="px-3 py-2 text-sm">${_esc(r.aptNum)}</td>
            <td class="px-3 py-2 text-sm font-medium">${_esc(r.person)}</td>
            <td class="px-3 py-2 text-sm font-bold text-right">${r.amount.toFixed(2)} €</td>
            <td class="px-3 py-2 text-sm text-gray-500">${r.dueDate}</td>
            <td class="px-3 py-2 text-sm font-mono">
                ${r.hasIban
                    ? `<span class="text-gray-700">${r.iban}</span>`
                    : `<span class="inline-flex items-center gap-1 bg-hb-orange/15 text-hb-orange text-xs font-bold px-2 py-0.5 rounded-md">Keine IBAN</span>`}
            </td>
        </tr>`).join('');

    const total = rows.filter(r => r.hasIban).reduce((s, r) => s + r.amount, 0);

    el.innerHTML = `
        <div class="card overflow-hidden">
            ${noIbanBanner ? `<div class="px-5 pt-4">${noIbanBanner}</div>` : ''}
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">${rows.length} Sollstellungen · Gesamt: ${total.toFixed(2)} €</span>
                <div class="flex gap-2">
                    <button onclick="_sepaExportXml()" class="text-xs bg-white text-hb-olive px-4 py-1 rounded-lg font-bold hover:bg-gray-50">
                        XML herunterladen
                    </button>
                    <button onclick="_sepaMarkPaid()" class="text-xs bg-hb-orange text-white px-4 py-1 rounded-lg font-semibold hover:opacity-90">
                        Als bezahlt markieren
                    </button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full divide-y divide-hb-olive/10">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 w-8"></th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Einheit</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Eigentümer / Mieter</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-right">Betrag</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">Fälligkeit</th>
                            <th class="px-3 py-2 text-xs font-bold text-gray-500 text-left">IBAN</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-hb-olive/10">${rowHtml}</tbody>
                </table>
            </div>
        </div>`;

    // store rows on window for export
    window._sepaRows = rows;
    window._sepaDemandsRaw = demands || [];

    // Responsive tables
    makeTableResponsive(document.querySelector('#sepa-preview .card'));
};

window._sepaExportXml = () => {
    const rows     = (window._sepaRows || []).filter((r, i) => r.hasIban && document.getElementById(`sepa-chk-${i}`)?.checked);
    if (!rows.length) { showToast('Keine auswählbaren Einträge.', 'error'); return; }

    const creditorId  = document.getElementById('sepa-creditor-id')?.value || '';
    const dueDate     = document.getElementById('sepa-due-date')?.value    || new Date().toISOString().slice(0,10);
    const bankSel     = document.getElementById('sepa-bank-select');
    const selOpt      = bankSel?.options[bankSel.selectedIndex];
    const credIban    = selOpt?.dataset?.iban  || '';
    const credBic     = selOpt?.dataset?.bic   || '';
    const msgId       = `HBMP-${Date.now()}`;
    const now         = new Date().toISOString().slice(0,19);
    const totalAmt    = rows.reduce((s, r) => s + r.amount, 0).toFixed(2);
    const ctrlSum     = totalAmt;
    const bid = _finState.buildingId;
    const bldName     = _finState.buildings.find(b => b.id === bid)?.name || 'HB-Portal';

    const txXml = rows.map((r, i) => `
        <DrctDbtTxInf>
            <PmtId><EndToEndId>HBMP-${bid}-${r.demandId}</EndToEndId></PmtId>
            <InstdAmt Ccy="EUR">${r.amount.toFixed(2)}</InstdAmt>
            <DrctDbtTx>
                <MndtRltdInf>
                    <MndtId>MNDT-${r.demandId}</MndtId>
                    <DtOfSgntr>${dueDate}</DtOfSgntr>
                </MndtRltdInf>
                <CdtrSchmeId>
                    <Id><PrvtId><Othr>
                        <Id>${_xmlEsc(creditorId)}</Id>
                        <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
                    </Othr></PrvtId></Id>
                </CdtrSchmeId>
            </DrctDbtTx>
            <DbtrAgt><FinInstnId><BIC>${_xmlEsc(r.bic || 'NOTPROVIDED')}</BIC></FinInstnId></DbtrAgt>
            <Dbtr><Nm>${_xmlEsc(r.holder || r.person)}</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>${_xmlEsc(r.iban)}</IBAN></Id></DbtrAcct>
            <RmtInf><Ustrd>Hausgeld ${_xmlEsc(r.aptNum)} Faelligkeit ${r.dueDate}</Ustrd></RmtInf>
        </DrctDbtTxInf>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02 pain.008.003.02.xsd">
    <CstmrDrctDbtInitn>
        <GrpHdr>
            <MsgId>${msgId}</MsgId>
            <CreDtTm>${now}</CreDtTm>
            <NbOfTxs>${rows.length}</NbOfTxs>
            <CtrlSum>${ctrlSum}</CtrlSum>
            <InitgPty><Nm>${_xmlEsc(bldName)}</Nm></InitgPty>
        </GrpHdr>
        <PmtInf>
            <PmtInfId>${msgId}-001</PmtInfId>
            <PmtMtd>DD</PmtMtd>
            <NbOfTxs>${rows.length}</NbOfTxs>
            <CtrlSum>${ctrlSum}</CtrlSum>
            <PmtTpInf>
                <SvcLvl><Cd>SEPA</Cd></SvcLvl>
                <LclInstrm><Cd>CORE</Cd></LclInstrm>
                <SeqTp>RCUR</SeqTp>
            </PmtTpInf>
            <ReqdColltnDt>${dueDate}</ReqdColltnDt>
            <Cdtr><Nm>${_xmlEsc(bldName)}</Nm></Cdtr>
            <CdtrAcct><Id><IBAN>${_xmlEsc(credIban)}</IBAN></Id></CdtrAcct>
            <CdtrAgt><FinInstnId><BIC>${_xmlEsc(credBic || 'NOTPROVIDED')}</BIC></FinInstnId></CdtrAgt>
            ${txXml}
        </PmtInf>
    </CstmrDrctDbtInitn>
</Document>`;

    _finDownloadFile(xml, `SEPA_Lastschrift_${dueDate}.xml`, 'application/xml;charset=utf-8');
    showToast('SEPA-XML heruntergeladen.', 'success');
};

window._sepaMarkPaid = async () => {
    const rows    = (window._sepaRows || []).filter((r, i) => document.getElementById(`sepa-chk-${i}`)?.checked);
    const ids     = rows.map(r => r.demandId);
    if (!ids.length) { showToast('Keine Einträge ausgewählt.', 'error'); return; }
    const { error } = await _supabase.from('payment_demands')
        .update({ status: 'paid' })
        .in('id', ids);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast(`${ids.length} Sollstellung(en) als bezahlt markiert.`, 'success');
    await _sepaLoadPreview();
};

function _xmlEsc(s) {
    return String(s || '')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&apos;');
}
