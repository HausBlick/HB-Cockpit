// ============================================================
// HB-Mieterportal | nav.js
// App-Initialisierung, Navigation & Routing
// Muss als letztes geladen werden (alle Module müssen bereit sein)
// ============================================================

async function init() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { window.location.href = 'index.html'; return; }
        currentUser = user;

        const { data: profile } = await _supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!profile) return;
        userProfile = profile;

        document.getElementById('welcome-title').textContent = profile.full_name.split(' ')[0];

        const roleLabels = {
            'admin':   'Verwalter Cockpit',
            'manager': 'Objektbetreuer',
            'owner':   'Eigentümer Cockpit',
            'tenant':  'Mieter Portal'
        };
        document.getElementById('role-label').textContent    = roleLabels[profile.role] || 'Nutzer Portal';
        document.getElementById('user-avatar').textContent   = profile.full_name.charAt(0).toUpperCase();
        document.getElementById('dropdown-name').textContent  = profile.full_name;
        document.getElementById('dropdown-email').textContent = profile.email;

        renderNav(profile.role);
        loadDashboard();
        loadNavBadges();
    } catch (err) {
        console.error(err);
    }
}

function renderNav(role) {
    const nav = document.getElementById('nav-links');
    let html = `<li><a onclick="loadDashboard(); setActiveNav(this)" class="nav-link active-link">${icons.dashboard} Dashboard</a></li>`;

    if (role === 'admin' || role === 'manager') {
        html += `
            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadNews();           setActiveNav(this)" class="nav-link">${icons.news}      Schwarzes Brett <span id="nav-badge-news"  class="nav-badge"></span></a></li>
            <li><a onclick="loadTickets();        setActiveNav(this)" class="nav-link">${icons.tickets}   Tickets         <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();       setActiveNav(this)" class="nav-link">${icons.contact}   Kontaktbuch</a></li>

            <li class="nav-section-title">Verwaltung</li>
            <li><a onclick="loadUserManagement(); setActiveNav(this)" class="nav-link">${icons.users}     Personen</a></li>
            <li><a onclick="loadTenants();        setActiveNav(this)" class="nav-link">${icons.buildings} Gebäude &amp; Einheiten</a></li>

            <li class="nav-section-title">Finanzen</li>
            <li><a onclick="loadFinance();        setActiveNav(this)" class="nav-link">${icons.finance}   Buchhaltung</a></li>

            <li class="nav-section-title">Service & Dokumente</li>
            <li><a onclick="loadDocuments();      setActiveNav(this)" class="nav-link">${icons.docs}      Dokumenten Cloud <span id="nav-badge-docs" class="nav-badge"></span></a></li>
            <li><a onclick="loadCalendar();       setActiveNav(this)" class="nav-link">${icons.calendar}  Kalender</a></li>
            <li><a onclick="loadSettings();       setActiveNav(this)" class="nav-link">${icons.settings}  Einstellungen</a></li>`;
    } else if (role === 'owner') {
        html += `
            <li class="nav-section-title">Mein Asset</li>
            <li><a onclick="loadMyUnits();   setActiveNav(this)" class="nav-link">${icons.buildings} Meine Einheiten</a></li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}      Dokumente <span id="nav-badge-docs" class="nav-badge"></span></a></li>

            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets}   Meine Tickets <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact}  Kontaktbuch</a></li>

            <li class="nav-section-title">Vermieter-Bereich</li>
            <li><a onclick="loadMyTenants(); setActiveNav(this)" class="nav-link">${icons.users}    Meine Mieter</a></li>`;
    } else {
        // tenant
        html += `
            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadNews();      setActiveNav(this)" class="nav-link">${icons.news}    Schwarzes Brett <span id="nav-badge-news"  class="nav-badge"></span></a></li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets} Meine Meldungen <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact} Kontaktbuch</a></li>

            <li class="nav-section-title">Service & Dokumente</li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}    Meine Dokumente <span id="nav-badge-docs" class="nav-badge"></span></a></li>`;
    }

    nav.innerHTML = html;
}

function setActiveNav(el) {
    document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active-link'));
    el.classList.add('active-link');
    if (window.innerWidth < 768) toggleMenu();
}

// ─── Nav-Badges ───────────────────────────────────────────────
async function loadNavBadges() {
    const role = userProfile?.role;
    const uid  = currentUser?.id;
    if (!uid) return;

    const [newsRes, readsRes, ticketRes, docsRes, docReadsRes] = await Promise.all([
        _supabase.from('news').select('id, created_at, updated_at'),
        _supabase.from('news_reads').select('news_id, read_at').eq('user_id', uid),
        role === 'admin' || role === 'manager'
            ? _supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'Offen')
            : _supabase.from('tickets').select('id', { count: 'exact', head: true })
                .or(`creator_id.eq.${uid},assigned_to.eq.${uid}`).eq('status', 'Offen'),
        _supabase.from('documents').select('id').eq('status', 'active').eq('is_deleted', false),
        _supabase.from('document_reads').select('document_id').eq('user_id', uid),
    ]);

    // News-Badge: ungelesen + seit letztem Lesen aktualisiert
    const readMap = new Map((readsRes.data || []).map(r => [r.news_id, new Date(r.read_at)]));
    const newsCount = (newsRes.data || []).filter(n => {
        const readAt    = readMap.get(n.id);
        const updatedAt = n.updated_at ? new Date(n.updated_at) : null;
        const wasEdited = updatedAt && (updatedAt - new Date(n.created_at)) > 60_000;
        return !readAt || (wasEdited && updatedAt > readAt);
    }).length;

    const ticketCount = ticketRes.count || 0;

    const docReadSet = new Set((docReadsRes.data || []).map(r => r.document_id));
    const docsCount  = (docsRes.data || []).filter(d => !docReadSet.has(d.id)).length;

    _setNavBadge('nav-badge-news',    newsCount);
    _setNavBadge('nav-badge-tickets', ticketCount);
    _setNavBadge('nav-badge-docs',    docsCount);
}

function _setNavBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.textContent = count > 99 ? '99+' : count;
        el.className = 'nav-badge ml-auto text-[9px] font-black bg-hb-orange text-white rounded-md flex items-center justify-center'
            + ' min-w-[18px] h-[18px] px-1';
    } else {
        el.textContent = '';
        el.className = 'nav-badge';
    }
}

// Badges nach Modulwechsel aktualisieren (wird von mod-news/mod-tickets aufgerufen)
window.refreshNavBadges = () => loadNavBadges();

// App starten
init();
