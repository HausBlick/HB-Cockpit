// ============================================================
// HB-Mieterportal | mod-finanzen.js
// Buchhaltung: Übersicht, Buchungen, Zählerstände, Sollstellungen, Onboarding
// Nur für admin & manager
// ============================================================

let _finState = {
    tab:            'uebersicht',
    buildingId:     null,
    buildings:      [],
    accounts:       [],
    entries:        [],
    demands:        [],
    apartments:     [],
    meters:         [],
    lastReadings:   {},   // { meterId: reading_value }
    fiscalYear:     new Date().getFullYear(),
    onboardStep:    1,
    onboardBankRows: [],
    onboardOwnerRows: [],
};

// ─── Entry Point ──────────────────────────────────────────────

async function loadFinance() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-4 border-hb-olive border-t-transparent rounded-full animate-spin"></div></div>`;

    const { data: buildings } = await _supabase.from('buildings').select('id, name').order('name');
    _finState.buildings = buildings || [];
    if (!_finState.buildingId && _finState.buildings.length > 0) {
        _finState.buildingId = _finState.buildings[0].id;
    }

    _finRenderShell();
    await _finLoadTab(_finState.tab);
}

// ─── Shell & Tab-Navigation ───────────────────────────────────

function _finRenderShell() {
    const tabs = [
        { key: 'uebersicht',   label: 'Übersicht' },
        { key: 'buchungen',    label: 'Buchungen' },
        { key: 'zaehler',      label: 'Zählerstände' },
        { key: 'sollstellung', label: 'Sollstellungen' },
        { key: 'onboarding',   label: 'Onboarding' },
    ];

    const buildingOpts = _finState.buildings.map(b =>
        `<option value="${b.id}" ${b.id == _finState.buildingId ? 'selected' : ''}>${b.name}</option>`
    ).join('');

    const tabHtml = tabs.map(t => `
        <button onclick="_finSwitchTab('${t.key}')" id="fin-tab-${t.key}"
            class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${_finState.tab === t.key ? 'bg-hb-olive text-white' : 'text-hb-olive hover:bg-hb-olive/10'}">
            ${t.label}
        </button>`).join('');

    document.getElementById('content-area').innerHTML = `
        <div class="flex justify-between items-end mb-6">
            <div>
                <h2 class="text-2xl font-extrabold text-hb-olive tracking-tight">Buchhaltung</h2>
                <p class="text-sm text-gray-500 mt-1">Konten, Buchungen, Zählerstände & Sollstellungen.</p>
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

    if (tab === 'uebersicht')   await _finLoadOverview();
    else if (tab === 'buchungen')    await _finLoadBookings();
    else if (tab === 'zaehler')      await _finLoadMeters();
    else if (tab === 'sollstellung') await _finLoadDemands();
    else if (tab === 'onboarding')   _finRenderOnboarding();
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
        is_system_account: false,
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
        .order('sort_order');
    return data || [];
}

// ─── Tab 1: Übersicht ─────────────────────────────────────────

async function _finLoadOverview() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-sm">Kein Gebäude gewählt.</p>'; return; }

    const [accounts, { data: debits }, { data: credits }] = await Promise.all([
        _finGetAccounts(bid),
        _supabase.from('journal_entries').select('debit_account_id, amount').eq('building_id', bid),
        _supabase.from('journal_entries').select('credit_account_id, amount').eq('building_id', bid),
    ]);
    _finState.accounts = accounts;

    // Saldo pro Konto berechnen
    const saldoMap = {};
    for (const a of accounts) saldoMap[a.id] = 0;
    for (const e of (debits || []))  if (saldoMap[e.debit_account_id]  !== undefined) saldoMap[e.debit_account_id]  += Number(e.amount);
    for (const e of (credits || [])) if (saldoMap[e.credit_account_id] !== undefined) saldoMap[e.credit_account_id] -= Number(e.amount);

    const typeLabels = { asset: 'Aktiva', liability: 'Passiva', equity: 'Eigenkapital', revenue: 'Ertrag', expense: 'Aufwand' };
    const typeBadge  = { asset: 'bg-blue-50 text-blue-700', liability: 'bg-purple-50 text-purple-700', equity: 'bg-hb-olive/10 text-hb-olive', revenue: 'bg-green-50 text-green-700', expense: 'bg-hb-orange/10 text-hb-orange' };

    const rows = accounts.map(a => {
        const saldo = saldoMap[a.id] ?? 0;
        const saldoCls = saldo < 0 ? 'text-red-600' : saldo > 0 ? 'text-green-700' : 'text-gray-400';
        return `<tr class="hover:bg-gray-50/60 transition-colors">
            <td class="px-4 py-3 text-sm font-mono text-gray-500">${a.account_number}</td>
            <td class="px-4 py-3 text-sm font-semibold text-hb-offblack">${a.account_name}${a.reserve_label ? `<span class="ml-2 text-xs text-gray-400">(${a.reserve_label})</span>` : ''}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-md ${typeBadge[a.account_type] || 'bg-gray-100 text-gray-600'}">${typeLabels[a.account_type] || a.account_type}</span></td>
            <td class="px-4 py-3 text-sm font-bold text-right ${saldoCls}">${saldo.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
        </tr>`;
    }).join('');

    document.getElementById('fin-content').innerHTML = `
        <div class="card overflow-hidden">
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Kontenblatt</span>
                <button onclick="_finOpenNewAccountModal()" class="bg-white text-hb-olive text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">+ Konto anlegen</button>
            </div>
            <table class="w-full">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Nr.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Bezeichnung</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500">Typ</th>
                    <th class="px-4 py-3 text-right text-xs font-bold text-gray-500">Saldo</th>
                </tr></thead>
                <tbody class="divide-y divide-hb-olive/10">${rows || '<tr><td colspan="4" class="px-4 py-8 text-center text-sm text-gray-400">Keine Konten vorhanden.</td></tr>'}</tbody>
            </table>
        </div>

        <!-- Modal Neues Konto -->
        <div id="fin-account-modal" class="hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-[15px] shadow-2xl w-full max-w-md p-6">
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
                    <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Rücklage-Label (optional)</label>
                        <input id="fin-acc-reserve" type="text" placeholder="z.B. Instandhaltungsrücklage"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="_finSaveAccount()" class="btn-primary flex-1 text-sm py-2.5">Speichern</button>
                    <button onclick="document.getElementById('fin-account-modal').classList.add('hidden')" class="btn-secondary flex-1 text-sm py-2.5">Abbrechen</button>
                </div>
            </div>
        </div>`;
}

window._finOpenNewAccountModal = () => {
    document.getElementById('fin-account-modal')?.classList.remove('hidden');
};

window._finSaveAccount = async () => {
    const number  = document.getElementById('fin-acc-number')?.value.trim();
    const name    = document.getElementById('fin-acc-name')?.value.trim();
    const type    = document.getElementById('fin-acc-type')?.value;
    const reserve = document.getElementById('fin-acc-reserve')?.value.trim();
    if (!number || !name) { showToast('Kontonummer und Bezeichnung sind Pflicht.', 'error'); return; }

    const { error } = await _supabase.from('accounts').insert({
        building_id:   _finState.buildingId,
        account_number: number,
        account_name:  name,
        account_type:  type,
        reserve_label: reserve || null,
        is_active:     true,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('fin-account-modal')?.classList.add('hidden');
    showToast('Konto angelegt.', 'success');
    _finState.accounts = [];
    await _finLoadOverview();
};

// ─── Tab 2: Buchungen ─────────────────────────────────────────

async function _finLoadBookings() {
    const bid = _finState.buildingId;
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-sm">Kein Gebäude gewählt.</p>'; return; }

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
        .select('*, debit_account:accounts!debit_account_id(account_number,account_name), credit_account:accounts!credit_account_id(account_number,account_name)')
        .eq('building_id', bid)
        .eq('fiscal_year', fy)
        .order('entry_date', { ascending: false });
    _finState.entries = entries || [];

    const accOpts = accounts.map(a => `<option value="${a.id}">${a.account_number} – ${a.account_name}</option>`).join('');
    const aptOpts = '<option value="">– Keine Einheit –</option>' + _finState.apartments.map(a => `<option value="${a.id}">${a.apartment_number}</option>`).join('');

    const fyOpts = [fy+1, fy, fy-1, fy-2].map(y => `<option value="${y}" ${y===fy?'selected':''}>${y}</option>`).join('');

    const entryRows = _finState.entries.map(e => {
        const isStorno = e.entry_type === 'storno';
        const hasStorno = _finState.entries.some(x => x.storno_of == e.id);
        const canStorno = !isStorno && !hasStorno && !e.is_locked;
        return `<tr class="hover:bg-gray-50/60 transition-colors ${isStorno ? 'opacity-60' : ''}">
            <td class="px-4 py-3 text-sm text-gray-500">${e.entry_date}</td>
            <td class="px-4 py-3 text-sm text-hb-offblack max-w-[200px] truncate" title="${e.description}">${e.description}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.debit_account?.account_number} ${e.debit_account?.account_name}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${e.credit_account?.account_number} ${e.credit_account?.account_name}</td>
            <td class="px-4 py-3 text-sm font-semibold text-right">${Number(e.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
            <td class="px-4 py-3 text-center">
                ${e.attachment_path ? `<button onclick="_finPreviewAttachment('${e.attachment_path}')" title="Beleg anzeigen" class="text-hb-olive hover:text-hb-olive/70"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>` : ''}
                ${e.lohn_anteil_35a > 0 ? `<span class="text-xs bg-hb-orange/10 text-hb-orange font-semibold px-1.5 py-0.5 rounded ml-1">§35a</span>` : ''}
            </td>
            <td class="px-4 py-3 text-right">
                ${isStorno ? '<span class="text-xs text-gray-400">Storno</span>' : ''}
                ${canStorno ? `<button onclick="_finStorno(${e.id})" class="text-xs text-hb-orange px-2 py-1 rounded-lg hover:bg-hb-orange/5 transition-colors">Storno</button>` : ''}
            </td>
        </tr>`;
    }).join('');

    document.getElementById('fin-content').innerHTML = `
        <!-- Buchungsmaske -->
        <div class="card p-5 mb-5">
            <h3 class="text-sm font-bold text-hb-offblack mb-4">Neue Buchung erfassen</h3>
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
            <div class="bg-hb-olive px-5 py-3 flex justify-between items-center">
                <span class="text-sm font-bold text-white">Buchungsjournal</span>
                <select onchange="_finChangeFY(this.value)" class="text-xs bg-white text-hb-olive font-bold px-2 py-1 rounded-lg border-0 cursor-pointer">${fyOpts}</select>
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
                    <tbody class="divide-y divide-hb-olive/10">${entryRows || '<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Keine Buchungen für ' + fy + '.</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;
}

window._finChangeFY = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finRenderBookings();
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
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-sm">Kein Gebäude gewählt.</p>'; return; }

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
    if (!bid) { document.getElementById('fin-content').innerHTML = '<p class="text-gray-400 text-sm">Kein Gebäude gewählt.</p>'; return; }

    const [{ data: demands }, { data: apts }] = await Promise.all([
        _supabase.from('payment_demands')
            .select('*, apartment:apartments(apartment_number), person:profiles(full_name)')
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
        if (d.status === 'paid') return '<span class="text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-md">Bezahlt</span>';
        if (d.due_date < today) return '<span class="text-xs bg-hb-orange/15 text-hb-orange font-semibold px-2 py-0.5 rounded-md">Überfällig</span>';
        return '<span class="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">Offen</span>';
    };

    const rows = demands.map(d => `
        <tr class="hover:bg-gray-50/60 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-500">${d.due_date}</td>
            <td class="px-4 py-3 text-sm font-semibold">${d.apartment?.apartment_number || '–'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${d.person?.full_name || '–'}</td>
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
}

window._finChangeFySolls = async (val) => {
    _finState.fiscalYear = Number(val);
    await _finLoadDemands();
};

window._finGenerateDemands = async () => {
    const bid = _finState.buildingId;
    const fy  = Number(document.getElementById('fin-s-fy')?.value) || _finState.fiscalYear;
    const day = Number(document.getElementById('fin-s-day')?.value) || 1;

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
        const hausgeld = Number(o.apartment?.hausgeld || 0);
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
            `<option value="${b.id}" ${b.id == bid ? 'selected' : ''}>${b.name}</option>`
        ).join('');
        stepContent = `
            <div class="max-w-md mx-auto space-y-4">
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Gebäude</label>
                    <select id="ob-building" onchange="_finOnBuildingChange(this.value)">${buildingOpts}</select></div>
                <div><label class="text-xs font-semibold text-gray-500 mb-1 block">Stichtag</label>
                    <input id="ob-date" type="date" value="${new Date().getFullYear()}-01-01"></div>
                <div class="bg-hb-olive/5 border border-hb-olive/20 rounded-[15px] p-4 text-sm text-gray-600">
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
            <p class="text-sm text-gray-400 mb-5">Eröffnungssalden und Altbestände erfassen.</p>
            <div class="flex items-center gap-1 mb-6">${stepDots}</div>
            ${stepContent}
        </div>`;
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
            .select('id, owner_id, apartment_id, apartment:apartments(apartment_number, hausgeld, building_id), owner:profiles(full_name)')
            .eq('is_active', true);
        _finState.onboardOwnerRows = (ownerships || [])
            .filter(o => o.apartment?.building_id == bid)
            .map(o => ({
                ownership_id:    o.id,
                owner_id:        o.owner_id,
                apartment_id:    o.apartment_id,
                apartment_number: o.apartment?.apartment_number,
                owner_name:      o.owner?.full_name || '–',
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
