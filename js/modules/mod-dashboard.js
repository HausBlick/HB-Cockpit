// ============================================================
// HB-Mieterportal | mod-dashboard.js
// Dashboard — rollenbasierte KPIs, Quick-Actions & Widgets
// ============================================================

// ─── Hilfsfunktionen ──────────────────────────────────────────

function _dashRelTime(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000)     return 'gerade eben';
    if (diff < 3_600_000)  return `vor ${Math.floor(diff / 60_000)} Min.`;
    if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`;
    return `vor ${Math.floor(diff / 86_400_000)} Tagen`;
}

function _dashDaysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function _dashDeadlineBadge(days) {
    if (days === null) return '—';
    if (days < 0)                            return '<span class="text-[10px] font-black uppercase bg-hb-error/12 text-hb-error px-1.5 py-0.5 rounded">Überfällig</span>';
    if (days < DEADLINE_THRESHOLDS.critical) return '<span class="text-[10px] font-black uppercase bg-hb-error/12 text-hb-error px-1.5 py-0.5 rounded">Kritisch</span>';
    if (days <= DEADLINE_THRESHOLDS.warning) return '<span class="text-[10px] font-black uppercase bg-hb-orange/10 text-hb-orange px-1.5 py-0.5 rounded">Bald</span>';
    return '<span class="text-[10px] font-black uppercase bg-hb-success/12 text-hb-success px-1.5 py-0.5 rounded">OK</span>';
}

function _dashKpi(icon, label, value, highlight, onclickAttr) {
    const numClass = highlight ? 'text-hb-orange' : 'text-hb-offblack';
    const cursor   = onclickAttr ? 'cursor-pointer hover:shadow-md transition-all' : '';
    return `
        <div class="card p-5 ${cursor}" ${onclickAttr ? `onclick="${onclickAttr}"` : ''}>
            <div class="text-xl mb-2">${icon}</div>
            <div class="text-[32px] font-bold ${numClass} leading-none mb-1.5">${value}</div>
            <div class="text-xs text-gray-500 font-semibold leading-snug">${label}</div>
        </div>`;
}

// ─── Hausgeld-Kachel State & Render ───────────────────────────

let _dashHgState = { units: [], idx: 0 };

function _dashRenderHausgeldKachel() {
    const { units, idx } = _dashHgState;
    if (!units.length) {
        return `<div class="card p-5">
            <div class="text-xl mb-2">💶</div>
            <div class="text-[32px] font-bold text-hb-offblack leading-none mb-1.5">—</div>
            <div class="text-xs text-gray-500 font-semibold leading-snug">Keine Einheit zugeordnet</div>
        </div>`;
    }
    const u = units[idx];
    const amountStr  = u.amount ? `${Number(u.amount).toFixed(2).replace('.', ',')} €` : '—';
    const aptLabel   = [u.apt.apartment_number, u.building ? formatBuildingName(u.building) : ''].filter(Boolean).join(' · ');
    const validFrom  = u.validFrom ? new Date(u.validFrom).toLocaleDateString('de-DE') : null;
    const multi      = units.length > 1;
    return `<div class="card p-5" id="dash-hg-kachel">
        <div class="flex items-start justify-between mb-2">
            <div class="text-xl">💶</div>
            ${multi ? `<div class="flex gap-0.5">
                <button onclick="_dashHausgeldPage(-1)" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-hb-olive hover:bg-hb-olive/10 transition-colors font-bold">‹</button>
                <button onclick="_dashHausgeldPage(1)"  class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-hb-olive hover:bg-hb-olive/10 transition-colors font-bold">›</button>
            </div>` : ''}
        </div>
        <div class="text-[32px] font-bold text-hb-offblack leading-none mb-1.5">${amountStr}</div>
        <div class="text-xs text-gray-500 font-semibold leading-snug">Hausgeld</div>
        <div class="text-[11px] text-gray-400 mt-1 truncate">${aptLabel}</div>
        ${validFrom ? `<div class="text-[11px] text-gray-400">Gültig ab ${validFrom}</div>` : ''}
        ${multi ? `<div class="text-[10px] text-gray-300 mt-1">${idx + 1} / ${units.length}</div>` : ''}
    </div>`;
}

window._dashHausgeldPage = (dir) => {
    const len = _dashHgState.units.length;
    if (!len) return;
    _dashHgState.idx = (_dashHgState.idx + dir + len) % len;
    const el = document.getElementById('dash-hg-kachel');
    if (el) el.outerHTML = _dashRenderHausgeldKachel();
};

// ─── Navigation helpers ───────────────────────────────────────

function _dashNavTo(loadFn) {
    const keyword = { loadTickets: 'Ticket', loadDocuments: 'Dokument', loadNews: 'Brett', loadContacts: 'Kontakt', loadCalendar: 'Kalender', loadFinance: 'Buchhaltung' }[loadFn.name];
    if (!keyword) return;
    const el = Array.from(document.querySelectorAll('#nav-links a')).find(a => a.textContent.includes(keyword));
    if (el) setActiveNav(el);
}

window._dashNewTicket = async () => {
    _dashNavTo(loadTickets); await loadTickets(); showCreateTicketModal();
};
window._dashGoTickets = async (filter) => {
    _dashNavTo(loadTickets); await loadTickets();
    if (filter) await setTicketFilter(filter);
};
window._dashGoDocUpload = async () => {
    _dashNavTo(loadDocuments); await loadDocuments(); _openUploadModal();
};
window._dashGoDocs = async () => {
    _dashNavTo(loadDocuments); await loadDocuments();
};
window._dashGoNewNews = async () => {
    _dashNavTo(loadNews); await loadNews(); showCreateNewsModal();
};
window._dashGoContacts = async () => {
    _dashNavTo(loadContacts); await loadContacts();
};
window._dashGoNewContact = async () => {
    _dashNavTo(loadContacts); await loadContacts(); showContactForm();
};
window._dashOpenTicket = async (ticketId) => {
    _dashNavTo(loadTickets); await loadTickets(); openTicketDetail(ticketId);
};
window._dashOpenNews = async (newsId) => {
    _dashNavTo(loadNews); await loadNews(); openNewsModal(newsId);
};
window._dashDownloadDoc = async (docId) => {
    const { data: doc } = await _supabase.from('documents')
        .select('file_path, generated_filename, document_title, title').eq('id', docId).single();
    if (!doc?.file_path) { showToast('Kein Dateipfad hinterlegt.', 'error'); return; }
    const { data } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (!data?.signedUrl) { showToast('Download-Link nicht erstellbar.', 'error'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = doc.generated_filename || doc.document_title || doc.title;
    a.click();
    await _supabase.from('document_reads').upsert(
        { document_id: Number(docId), user_id: currentUser.id, read_at: new Date().toISOString() },
        { onConflict: 'document_id,user_id' }
    );
    window.refreshNavBadges?.();
};

// ─── Entry Point ──────────────────────────────────────────────

async function loadDashboard() {
    const role = userProfile?.role;
    if (role === 'admin' || role === 'manager') {
        await _renderAdminDashboard();
    } else {
        // owner, tenant (+ Landlord/Advisory Features additiv)
        await _renderUserDashboard();
    }
}

// ─── ADMIN / MANAGER DASHBOARD ────────────────────────────────

async function _renderAdminDashboard() {
    const ca = document.getElementById('content-area');
    ca.innerHTML = `<div class="space-y-6 py-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">${Array.from({length:4}, () => '<div class="skeleton h-24"></div>').join('')}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${Array.from({length:4}, () => '<div class="skeleton h-48"></div>').join('')}</div>
    </div>`;

    const [
        openTickRes, wipTickRes, draftCountRes,
        buildingsRes, priorityTickRes, draftDocsRes,
        msgRes, newsActRes, docActRes,
    ] = await Promise.all([
        _supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'Offen'),
        _supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'In Bearbeitung'),
        _supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('is_deleted', false),
        _supabase.from('buildings').select('id, name, file_number, street, house_number, energy_certificate_expiry, next_fire_safety_check, drinking_water_analysis_due, last_legionella_check, legionella_check_interval_months'),
        _supabase.from('tickets')
            .select(`id, title, status, created_at, buildings(file_number, street, house_number, name), creator:profiles!tickets_creator_id_fkey(full_name)`)
            .in('status', ['Offen', 'In Bearbeitung'])
            .order('created_at', { ascending: false }).limit(5),
        _supabase.from('documents')
            .select(`id, title, document_title, generated_filename, category, created_at, buildings(file_number, street, house_number, name), profiles!uploaded_by(full_name)`)
            .eq('status', 'draft').eq('is_deleted', false)
            .order('created_at', { ascending: false }),
        _supabase.from('ticket_messages')
            .select(`id, message, created_at, tickets(title), sender:profiles!ticket_messages_sender_id_fkey(full_name)`)
            .eq('is_system_message', false)
            .order('created_at', { ascending: false }).limit(6),
        _supabase.from('news')
            .select(`id, title, created_at, author:profiles!news_author_id_fkey(full_name)`)
            .order('created_at', { ascending: false }).limit(5),
        _supabase.from('documents')
            .select(`id, title, document_title, generated_filename, created_at, uploader:profiles!uploaded_by(full_name)`)
            .eq('status', 'active').eq('is_deleted', false)
            .order('created_at', { ascending: false }).limit(5),
    ]);

    // ── Fristen (≤ 30 Tage) ──
    // DEADLINE_TYPES → definiert in config.js
    const deadlines = [];
    for (const b of (buildingsRes.data || [])) {
        for (const dt of DEADLINE_TYPES) {
            if (!b[dt.key]) continue;
            const days = _dashDaysUntil(b[dt.key]);
            if (days !== null && days <= 30) deadlines.push({ building: formatBuildingName(b), label: dt.label, date: b[dt.key], days });
        }
        if (b.last_legionella_check && b.legionella_check_interval_months) {
            const due = new Date(b.last_legionella_check);
            due.setMonth(due.getMonth() + Number(b.legionella_check_interval_months));
            const days = _dashDaysUntil(due.toISOString());
            if (days !== null && days <= 30)
                deadlines.push({ building: formatBuildingName(b), label: 'Legionellenprüfung', date: due.toISOString().split('T')[0], days });
        }
    }
    deadlines.sort((a, b) => a.days - b.days);

    // ── KPI-Werte ──
    const openCount  = openTickRes.count  || 0;
    const wipCount   = wipTickRes.count   || 0;
    const draftCount = draftCountRes.count || 0;
    const dlineCount = deadlines.length;

    // ── Aktivitäten-Feed zusammenführen ──
    const activities = [
        ...(msgRes.data || []).map(m => ({
            ts: m.created_at,
            icon: '💬',
            text: `<b>${m.sender?.full_name || '—'}</b> hat Ticket <b>${m.tickets?.title || '—'}</b> kommentiert`,
        })),
        ...(newsActRes.data || []).map(n => ({
            ts: n.created_at,
            icon: '📰',
            text: `<b>${n.author?.full_name || '—'}</b> hat News <b>${n.title}</b> veröffentlicht`,
        })),
        ...(docActRes.data || []).map(d => ({
            ts: d.created_at,
            icon: '📄',
            text: `<b>${d.uploader?.full_name || '—'}</b> hat <b>${d.generated_filename || d.document_title || d.title}</b> freigegeben`,
        })),
    ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10);

    const firstName = userProfile.full_name?.split(' ')[0] || 'Willkommen';

    // ── Render ──
    ca.innerHTML = `
        <!-- Begrüßung -->
        <div class="mb-6">
            <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Hallo, ${firstName}!</h2>
        </div>

        <!-- Quick-Actions -->
        <div class="flex flex-wrap gap-3 mb-6">
            <button onclick="_dashNewTicket()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Neues Ticket
            </button>
            <button onclick="_dashGoDocUpload()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                Dokument hochladen
            </button>
            <button onclick="_dashGoNewNews()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                News verfassen
            </button>
            <button onclick="_dashGoNewContact()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                Kontakt anlegen
            </button>
        </div>

        <!-- KPI-Karten -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            ${_dashKpi('🚨', 'Offene Tickets',         openCount,  openCount > 0,   "_dashGoTickets('Offen')")}
            ${_dashKpi('📋', 'Tickets in Bearbeitung', wipCount,   false,            "_dashGoTickets('In Bearbeitung')")}
            ${_dashKpi('📄', 'Dokumente im Entwurf',   draftCount, draftCount > 0,  "_dashGoDocs()")}
            ${_dashKpi('⏳', 'Anstehende Fristen',     dlineCount, dlineCount > 0,  "_dashNavTo(loadCalendar); loadCalendar()")}
        </div>

        <!-- Widgets -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <!-- Widget 1: Prioritäts-Tickets -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive flex justify-between items-center">
                    <h3 class="text-sm font-bold text-white">Prioritäts-Tickets</h3>
                    <button onclick="_dashGoTickets('Offen')" class="text-[11px] text-white/70 hover:text-white transition-colors">Alle ansehen →</button>
                </div>
                ${(priorityTickRes.data || []).length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine offenen Tickets.</p>'
                    : `<div class="overflow-x-auto"><table class="w-full text-sm">
                        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
                            <th class="p-3 text-left">Betreff</th>
                            <th class="p-3 text-left">Gebäude</th>
                            <th class="p-3 text-left">Status</th>
                        </tr></thead>
                        <tbody class="divide-y divide-hb-olive/10">
                            ${(priorityTickRes.data || []).map(t => `
                                <tr onclick="_dashOpenTicket('${t.id}')" class="cursor-pointer hover:bg-gray-50 transition-colors">
                                    <td class="p-3">
                                        <div class="font-semibold text-hb-offblack truncate max-w-[180px]">${t.title}</div>
                                        <div class="text-xs text-gray-400">${t.creator?.full_name || '—'}</div>
                                    </td>
                                    <td class="p-3 text-xs text-gray-600">${formatBuildingName(t.buildings)}</td>
                                    <td class="p-3"><span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLE[t.status] || ''}">${t.status}</span></td>
                                </tr>`).join('')}
                        </tbody></table></div>`}
            </div>

            <!-- Widget 2: Warten auf Freigabe -->
            <div class="card overflow-hidden" id="dash-draft-docs">
                <div class="px-4 py-3 bg-hb-olive flex justify-between items-center">
                    <h3 class="text-sm font-bold text-white">Warten auf Freigabe</h3>
                    <button onclick="_dashGoDocs()" class="text-[11px] text-white/70 hover:text-white transition-colors">Alle ansehen →</button>
                </div>
                <div id="dash-draft-body">
                    ${_dashDraftDocsHtml(draftDocsRes.data || [])}
                </div>
            </div>

            <!-- Widget 3: Ablaufende Fristen -->
            <div class="card overflow-hidden" id="dash-fristen">
                <div class="px-4 py-3 bg-hb-olive">
                    <h3 class="text-sm font-bold text-white">Ablaufende Fristen</h3>
                </div>
                ${deadlines.length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine Fristen in den nächsten 30 Tagen.</p>'
                    : `<div class="overflow-x-auto"><table class="w-full text-sm">
                        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
                            <th class="p-3 text-left">Gebäude</th>
                            <th class="p-3 text-left">Frist-Typ</th>
                            <th class="p-3 text-left">Datum</th>
                            <th class="p-3 text-left">Status</th>
                        </tr></thead>
                        <tbody class="divide-y divide-hb-olive/10">
                            ${deadlines.map(d => `
                                <tr>
                                    <td class="p-3 text-xs font-semibold">${d.building}</td>
                                    <td class="p-3 text-xs text-gray-600">${d.label}</td>
                                    <td class="p-3 text-xs text-gray-600">${new Date(d.date).toLocaleDateString('de-DE')}</td>
                                    <td class="p-3">${_dashDeadlineBadge(d.days)}</td>
                                </tr>`).join('')}
                        </tbody></table></div>`}
            </div>

            <!-- Widget 4: Letzte Aktivitäten -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive">
                    <h3 class="text-sm font-bold text-white">Letzte Aktivitäten</h3>
                </div>
                ${activities.length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine Aktivitäten.</p>'
                    : `<div class="divide-y divide-hb-olive/10">
                        ${activities.map(a => `
                            <div class="px-4 py-3 flex gap-3 items-start">
                                <span class="text-base flex-shrink-0 mt-0.5">${a.icon}</span>
                                <p class="flex-1 text-xs text-hb-offblack leading-relaxed min-w-0">${a.text}</p>
                                <span class="text-[11px] text-gray-400 flex-shrink-0 ml-2 whitespace-nowrap">${_dashRelTime(a.ts)}</span>
                            </div>`).join('')}
                    </div>`}
            </div>

        </div>`;

    // Responsive tables
    document.querySelectorAll('#content-area .card table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });
}

function _dashDraftDocsHtml(docs) {
    if (!docs.length) return '<p class="p-6 text-[15px] text-gray-400 text-center">Keine Entwürfe vorhanden.</p>';
    return `<div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
            <th class="p-3 text-left">Datei</th>
            <th class="p-3 text-left">Gebäude</th>
            <th class="p-3 text-left">Kategorie</th>
            <th class="p-3 text-left">Von</th>
            <th class="p-3 text-left">Datum</th>
            <th class="p-3"></th>
        </tr></thead>
        <tbody class="divide-y divide-hb-olive/10" id="dash-draft-tbody">
            ${docs.map(d => _dashDraftRowHtml(d)).join('')}
        </tbody></table></div>`;
}

function _dashDraftRowHtml(d) {
    const name = d.generated_filename || d.document_title || d.title;
    return `<tr id="dash-draft-row-${d.id}">
        <td class="p-3 font-semibold text-hb-offblack">
            <div class="truncate max-w-[150px]" title="${name}">${name}</div>
        </td>
        <td class="p-3 text-xs text-gray-600">${formatBuildingName(d.buildings)}</td>
        <td class="p-3 text-xs text-gray-600">${d.category || '—'}</td>
        <td class="p-3 text-xs text-gray-600">${d.profiles?.full_name || '—'}</td>
        <td class="p-3 text-xs text-gray-400">${new Date(d.created_at).toLocaleDateString('de-DE')}</td>
        <td class="p-3 text-right">
            <button onclick="_dashPublishDoc(${d.id})"
                class="text-xs text-white bg-hb-olive px-3 py-1.5 rounded-lg hover:bg-hb-olive/80 transition-colors font-semibold whitespace-nowrap">
                Freigeben
            </button>
        </td>
    </tr>`;
}

window._dashPublishDoc = async (docId) => {
    const { error } = await _supabase.from('documents').update({ status: 'active' }).eq('id', docId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Dokument freigegeben.', 'success');
    document.getElementById(`dash-draft-row-${docId}`)?.remove();
    const tbody = document.getElementById('dash-draft-tbody');
    if (tbody && tbody.children.length === 0) {
        document.getElementById('dash-draft-body').innerHTML =
            '<p class="p-6 text-[15px] text-gray-400 text-center">Keine Entwürfe vorhanden.</p>';
    }
    window.refreshNavBadges?.();
};

// ─── TENANT / OWNER DASHBOARD ─────────────────────────────────

async function _renderUserDashboard() {
    const ca   = document.getElementById('content-area');
    ca.innerHTML = `<div class="space-y-6 py-4">
        <div class="grid grid-cols-2 gap-4">${Array.from({length:4}, () => '<div class="skeleton h-24"></div>').join('')}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${Array.from({length:2}, () => '<div class="skeleton h-48"></div>').join('')}</div>
    </div>`;

    const uid  = currentUser.id;
    const role = userProfile.role;
    const name = userProfile.full_name?.split(' ')[0] || 'Willkommen';

    // ── Einheit & Gebäude ermitteln ──
    let buildingId = null;
    let aptData    = null;
    if (userProfile.apartment_id) {
        const { data: apt } = await _supabase.from('apartments')
            .select('id, building_id, hausgeld, rent_amount, utilities_amount')
            .eq('id', userProfile.apartment_id).single();
        aptData    = apt;
        buildingId = apt?.building_id || null;
    }

    // ── Parallele Queries ──
    const [
        openTickRes,
        allDocsRes, docReadsRes,
        allNewsRes, newsReadsRes,
        myTickRes, newDocsListRes,
        contactsRes,
    ] = await Promise.all([
        _supabase.from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('creator_id', uid).eq('status', 'Offen'),

        _supabase.from('documents').select('id').eq('status', 'active').eq('is_deleted', false),
        _supabase.from('document_reads').select('document_id').eq('user_id', uid),

        _supabase.from('news').select('id'),
        _supabase.from('news_reads').select('news_id').eq('user_id', uid),

        _supabase.from('tickets')
            .select('id, title, category, status, created_at')
            .eq('creator_id', uid).neq('status', 'Erledigt')
            .order('created_at', { ascending: false }),

        _supabase.from('documents')
            .select('id, title, document_title, generated_filename, category, created_at, file_path')
            .eq('status', 'active').eq('is_deleted', false)
            .order('created_at', { ascending: false }).limit(20),

        _supabase.from('contacts')
            .select('id, company, contact_person, is_company, phone, mobile, email, category, building_ids, logo_url')
            .in('category', ['Verwalter', 'Hausmeister']),
    ]);

    // ── Owner: Alle Einheiten für Hausgeld-Kachel laden ──
    _dashHgState = { units: [], idx: 0 };
    if (role === 'owner') {
        const { data: personData } = await _supabase
            .from('persons').select('id').eq('auth_user_id', uid).maybeSingle();
        if (personData?.id) {
            const { data: owData } = await _supabase
                .from('ownerships')
                .select('apartments!inner(id, building_id, apartment_number, hausgeld)')
                .eq('owner_id', personData.id)
                .eq('is_active', true);
            const ownerApts = (owData || []).map(o => o.apartments).filter(Boolean);
            const bldIds = [...new Set(ownerApts.map(a => a.building_id))];
            if (bldIds.length) {
                const [bldRes, planRes] = await Promise.all([
                    _supabase.from('buildings').select('id, name, file_number, street, house_number').in('id', bldIds),
                    _supabase.from('budget_plans').select('building_id, valid_from').in('building_id', bldIds).eq('status', 'active'),
                ]);
                const bldMap  = Object.fromEntries((bldRes.data  || []).map(b => [b.id, b]));
                const planMap = Object.fromEntries((planRes.data || []).map(p => [p.building_id, p]));
                _dashHgState.units = await Promise.all(ownerApts.map(async apt => {
                    const dynHG   = await getMonthlyHausgeld(apt.id, apt.building_id);
                    const amount  = dynHG ?? apt.hausgeld;
                    const validFrom = (dynHG !== null && dynHG !== undefined)
                        ? (planMap[apt.building_id]?.valid_from || null)
                        : null;
                    return { apt, building: bldMap[apt.building_id] || null, amount, validFrom };
                }));
            }
        }
        if (!buildingId && _dashHgState.units.length) {
            buildingId = _dashHgState.units[0].building?.id || null;
        }
    }

    // ── KPI-Berechnungen ──
    const openCount   = openTickRes.count || 0;
    const readDocSet  = new Set((docReadsRes.data || []).map(r => r.document_id));
    const newDocCount = (allDocsRes.data || []).filter(d => !readDocSet.has(d.id)).length;
    const readNewsSet = new Set((newsReadsRes.data || []).map(r => r.news_id));
    const newNewsCount = (allNewsRes.data || []).filter(n => !readNewsSet.has(n.id)).length;

    // ── Warmmiete (tenant only) ──
    let finLabel = 'Warmmiete / Monat', finValue = '—';
    if (aptData && role === 'tenant') {
        const total = (Number(aptData.rent_amount) || 0) + (Number(aptData.utilities_amount) || 0);
        if (total > 0) { finValue = `${total.toFixed(2).replace('.', ',')} €`; }
    }

    // ── Ungelesene Dokumente für Widget 3 ──
    const unreadDocs = (newDocsListRes.data || []).filter(d => !readDocSet.has(d.id)).slice(0, 5);

    // ── Letzte News für Widget 1 (bausteinspezifisch wenn möglich) ──
    let latestNews = [];
    if (buildingId) {
        const { data } = await _supabase.from('news')
            .select('id, title, content, created_at')
            .eq('building_id', buildingId)
            .order('created_at', { ascending: false }).limit(3);
        latestNews = data || [];
    }
    if (!latestNews.length) {
        const { data } = await _supabase.from('news')
            .select('id, title, content, created_at')
            .order('created_at', { ascending: false }).limit(3);
        latestNews = data || [];
    }

    // ── Ansprechpartner: Verwalter bevorzugt, sonst Hausmeister ──
    const allContacts = contactsRes.data || [];
    const contact = (
        (buildingId
            ? allContacts.find(c => (c.building_ids || []).map(String).includes(String(buildingId)) && c.category === 'Verwalter')
              || allContacts.find(c => (c.building_ids || []).map(String).includes(String(buildingId)))
            : null)
        || allContacts.find(c => c.category === 'Verwalter')
        || allContacts[0]
        || null
    );

    const roleLabel = ROLE_LABELS[role] || 'Nutzer-Portal';

    // ── Render ──
    ca.innerHTML = `
        <!-- Begrüßung -->
        <div class="mb-6">
            <h2 class="text-[28px] font-bold text-hb-offblack tracking-tight">Hallo, ${name}!</h2>
            <p class="text-xs uppercase tracking-widest font-bold text-hb-orange mt-1">${roleLabel}</p>
        </div>

        <!-- Quick-Actions -->
        <div class="flex flex-wrap gap-3 mb-6">
            <button onclick="_dashNewTicket()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Neues Ticket
            </button>
            <button onclick="_dashGoDocs()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Dokumente ansehen
            </button>
            <button onclick="_dashGoContacts()" class="btn-primary text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                Zum Kontaktbuch
            </button>
        </div>

        <!-- KPI-Karten -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            ${_dashKpi('🚨', 'Meine offenen Tickets', openCount,    openCount > 0,    "_dashGoTickets('mine')")}
            ${_dashKpi('📄', 'Neue Dokumente',        newDocCount,  newDocCount > 0,  '_dashGoDocs()')}
            ${_dashKpi('📰', 'Ungelesene News',       newNewsCount, newNewsCount > 0, '_dashNavToNews()')}
            ${role === 'owner' ? _dashRenderHausgeldKachel() : _dashKpi('💶', finLabel, finValue, false, null)}
        </div>

        <!-- Widgets -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <!-- Widget 1: Aktuelle Meldungen -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive flex justify-between items-center">
                    <h3 class="text-sm font-bold text-white">Aktuelle Meldungen</h3>
                    <button onclick="_dashNavToNews()" class="text-[11px] text-white/70 hover:text-white transition-colors">Alle ansehen →</button>
                </div>
                ${latestNews.length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine aktuellen Meldungen.</p>'
                    : latestNews.map(n => {
                        const preview = (n.content || '').replace(/<[^>]*>/g, '').slice(0, 90);
                        return `<div onclick="_dashOpenNews('${n.id}')" class="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-hb-olive/10 last:border-0">
                            <div class="font-semibold text-hb-offblack text-sm mb-1">${n.title}</div>
                            <p class="text-xs text-gray-500 line-clamp-2">${preview}${preview.length >= 90 ? '…' : ''}</p>
                            <p class="text-[11px] text-gray-400 mt-1.5">${_dashRelTime(n.created_at)}</p>
                        </div>`;
                    }).join('')}
            </div>

            <!-- Widget 2: Meine Tickets -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive flex justify-between items-center">
                    <h3 class="text-sm font-bold text-white">Meine Tickets</h3>
                    <button onclick="_dashGoTickets('mine')" class="text-[11px] text-white/70 hover:text-white transition-colors">Alle ansehen →</button>
                </div>
                ${(myTickRes.data || []).length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine offenen Tickets.</p>'
                    : `<div class="overflow-x-auto"><table class="w-full text-sm">
                        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
                            <th class="p-3 text-left">Betreff</th>
                            <th class="p-3 text-left">Kategorie</th>
                            <th class="p-3 text-left">Status</th>
                        </tr></thead>
                        <tbody class="divide-y divide-hb-olive/10">
                            ${(myTickRes.data || []).map(t => `
                                <tr onclick="_dashOpenTicket('${t.id}')" class="cursor-pointer hover:bg-gray-50 transition-colors">
                                    <td class="p-3 font-semibold text-hb-offblack truncate max-w-[180px]">${t.title}</td>
                                    <td class="p-3 text-xs text-gray-600">${t.category || '—'}</td>
                                    <td class="p-3"><span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLE[t.status] || ''}">${t.status}</span></td>
                                </tr>`).join('')}
                        </tbody></table></div>`}
            </div>

            <!-- Widget 3: Neue Dokumente -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive flex justify-between items-center">
                    <h3 class="text-sm font-bold text-white">Neue Dokumente</h3>
                    <button onclick="_dashGoDocs()" class="text-[11px] text-white/70 hover:text-white transition-colors">Alle ansehen →</button>
                </div>
                ${unreadDocs.length === 0
                    ? '<p class="p-6 text-[15px] text-gray-400 text-center">Keine neuen Dokumente.</p>'
                    : `<div class="overflow-x-auto"><table class="w-full text-sm">
                        <thead><tr class="bg-gray-50 text-xs font-bold text-gray-500">
                            <th class="p-3 text-left">Titel</th>
                            <th class="p-3 text-left">Kategorie</th>
                            <th class="p-3 text-left">Datum</th>
                            <th class="p-3"></th>
                        </tr></thead>
                        <tbody class="divide-y divide-hb-olive/10">
                            ${unreadDocs.map(d => `
                                <tr>
                                    <td class="p-3 font-semibold text-hb-offblack">
                                        <div class="truncate max-w-[160px]">${d.generated_filename || d.document_title || d.title}</div>
                                    </td>
                                    <td class="p-3 text-xs text-gray-600">${d.category || '—'}</td>
                                    <td class="p-3 text-xs text-gray-400">${new Date(d.created_at).toLocaleDateString('de-DE')}</td>
                                    <td class="p-3 text-right">
                                        <button onclick="_dashDownloadDoc(${d.id})" title="Herunterladen"
                                            class="p-2 text-hb-olive bg-hb-ultralight rounded-lg hover:bg-gray-100 transition-colors">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody></table></div>`}
            </div>

            <!-- Widget 4: Mein Ansprechpartner -->
            <div class="card overflow-hidden">
                <div class="px-4 py-3 bg-hb-olive">
                    <h3 class="text-sm font-bold text-white">Mein Ansprechpartner</h3>
                </div>
                ${contact ? `
                    <div class="p-5">
                        <div class="flex items-start gap-4">
                            ${contact.logo_url
                                ? `<img src="${contact.logo_url}" class="w-12 h-12 rounded-full object-cover flex-shrink-0" alt="">`
                                : `<div class="w-12 h-12 rounded-full bg-hb-olive/10 text-hb-olive flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                                ${(contact.company || contact.contact_person || '?').charAt(0).toUpperCase()}
                            </div>`}
                            <div class="flex-1 min-w-0">
                                <div class="font-bold text-hb-offblack leading-tight">
                                    ${contact.company || contact.contact_person || '—'}
                                </div>
                                <span class="text-[10px] font-black uppercase bg-hb-olive/10 text-hb-olive px-1.5 py-0.5 rounded mt-1 inline-block">${contact.category}</span>
                                ${(contact.phone || contact.mobile) ? `
                                    <a href="tel:${contact.phone || contact.mobile}" class="flex items-center gap-2 text-sm text-gray-600 hover:text-hb-olive mt-3 transition-colors">
                                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                        ${contact.phone || contact.mobile}
                                    </a>` : ''}
                                ${contact.email ? `
                                    <a href="mailto:${contact.email}" class="flex items-center gap-2 text-sm text-gray-600 hover:text-hb-olive mt-2 transition-colors">
                                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                        ${contact.email}
                                    </a>` : ''}
                            </div>
                        </div>
                    </div>` : '<p class="p-6 text-[15px] text-gray-400 text-center">Noch kein Ansprechpartner hinterlegt.</p>'}
            </div>

        </div>`;

    // Responsive tables
    document.querySelectorAll('#content-area .card table').forEach(t => {
        makeTableResponsive(t.closest('.card') || t.parentElement);
    });
}

// Hilfsfunktion für News-Navigation (wird im onclick-String verwendet)
window._dashNavToNews = () => { _dashNavTo(loadNews); loadNews(); };