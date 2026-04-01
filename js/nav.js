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

        // ROLE_LABELS → definiert in config.js
        const roleLabel = ROLE_LABELS[profile.role] || 'Nutzer Portal';
        document.getElementById('role-label').textContent     = roleLabel;
        const roleMobile = document.getElementById('role-label-mobile');
        if (roleMobile) roleMobile.textContent = roleLabel;
        document.getElementById('user-avatar').textContent    = profile.full_name.charAt(0).toUpperCase();
        document.getElementById('dropdown-name').textContent  = profile.full_name;
        document.getElementById('dropdown-email').textContent = profile.email;

        renderNav(profile.role);
        renderBottomNav(profile.role);
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
            <li><a onclick="loadZeiterfassung();  setActiveNav(this)" class="nav-link">${icons.clock}     Zeiterfassung</a></li>

            <li class="nav-section-title">Service & Dokumente</li>
            <li><a onclick="loadDocuments();      setActiveNav(this)" class="nav-link">${icons.docs}      Dokumenten Cloud <span id="nav-badge-docs" class="nav-badge"></span></a></li>
            <li><a onclick="loadCalendar();       setActiveNav(this)" class="nav-link">${icons.calendar}  Kalender</a></li>
            <li><a onclick="loadETV();            setActiveNav(this)" class="nav-link">${icons.users}     Eigentümerversammlung</a></li>
            <li><a onclick="loadSettings();       setActiveNav(this)" class="nav-link">${icons.settings}  Einstellungen</a></li>`;
    } else if (role === 'owner') {
        html += `
            <li class="nav-section-title">Mein Asset</li>
            <li><a onclick="loadMyUnits();   setActiveNav(this)" class="nav-link">${icons.buildings} Meine Einheiten</a></li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}      Dokumente <span id="nav-badge-docs" class="nav-badge"></span></a></li>

            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets}   Meine Tickets <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact}  Kontaktbuch</a></li>`;
    } else if (role === 'landlord') {
        html += `
            <li class="nav-section-title">Mein Asset</li>
            <li><a onclick="loadMyUnits();   setActiveNav(this)" class="nav-link">${icons.buildings} Meine Einheiten</a></li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}      Dokumente <span id="nav-badge-docs" class="nav-badge"></span></a></li>

            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets}   Meine Tickets <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact}  Kontaktbuch</a></li>

            <li class="nav-section-title">Vermieter-Bereich</li>
            <li><a onclick="loadMyTenants(); setActiveNav(this)" class="nav-link">${icons.users}    Meine Mieter</a></li>`;
    } else if (role === 'advisory') {
        html += `
            <li class="nav-section-title">Mein Asset</li>
            <li><a onclick="loadMyUnits();   setActiveNav(this)" class="nav-link">${icons.buildings} Meine Einheiten</a></li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}      Dokumente <span id="nav-badge-docs" class="nav-badge"></span></a></li>

            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets}   Meine Tickets <span id="nav-badge-tickets" class="nav-badge"></span></a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact}  Kontaktbuch</a></li>

            <li class="nav-section-title">Finanzen</li>
            <li><a onclick="loadFinance();   setActiveNav(this)" class="nav-link">${icons.finance}  Belegprüfung</a></li>`;
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

// ─── Bottom Navigation (Mobile) ─────────────────────────────
function renderBottomNav(role) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    let items;
    if (role === 'admin' || role === 'manager') {
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Tickets',   fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.news,      label: 'News',      fn: 'loadNews',      badge: 'bnav-badge-news' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: icons.more,      label: 'Mehr',      fn: '_more' },
        ];
    } else if (role === 'tenant') {
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Meldungen', fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.news,      label: 'News',      fn: 'loadNews',      badge: 'bnav-badge-news' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: icons.more,      label: 'Mehr',      fn: '_more' },
        ];
    } else {
        // owner, landlord, advisory
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Tickets',   fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: icons.contact,   label: 'Kontakte',  fn: 'loadContacts' },
            { icon: icons.more,      label: 'Mehr',      fn: '_more' },
        ];
    }

    nav.innerHTML = items.map((item, i) => `
        <button class="bnav-item flex flex-col items-center justify-center flex-1 pt-2 pb-1.5 relative${i === 0 ? ' bnav-active' : ''}"
                onclick="${item.fn === '_more' ? 'toggleMenu()' : `bottomNavGo('${item.fn}', this)`}"
                data-fn="${item.fn}">
            <span class="relative">
                ${item.icon.replace(/w-5 h-5/g, 'w-6 h-6')}
                ${item.badge ? `<span id="${item.badge}" class="absolute -top-1.5 -right-2.5 text-[8px] font-black bg-hb-orange text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 leading-none" style="display:none"></span>` : ''}
            </span>
            <span class="text-[10px] font-semibold mt-0.5 leading-tight">${item.label}</span>
            <span class="bnav-dot"></span>
        </button>
    `).join('');
}

function bottomNavGo(fnName, el) {
    // Aufrufen der Lade-Funktion
    if (typeof window[fnName] === 'function') window[fnName]();

    // Bottom-Nav Active-State
    const allBnav = document.querySelectorAll('.bnav-item');
    allBnav.forEach(b => b.classList.remove('bnav-active'));
    if (el) {
        el.classList.add('bnav-active');
    } else {
        // Kein Element → Match per fnName (z.B. Logo-Klick)
        allBnav.forEach(b => { if (b.dataset.fn === fnName) b.classList.add('bnav-active'); });
    }

    // Sidebar Active-State synchronisieren
    const sidebarLinks = document.querySelectorAll('#nav-links a');
    sidebarLinks.forEach(a => a.classList.remove('active-link'));
    sidebarLinks.forEach(a => {
        if (a.getAttribute('onclick')?.includes(fnName + '(')) a.classList.add('active-link');
    });
}

function _syncBottomNav(fnName) {
    const items = document.querySelectorAll('.bnav-item');
    const matched = [...items].find(b => b.dataset.fn === fnName);
    items.forEach(b => b.classList.remove('bnav-active'));
    if (matched) {
        matched.classList.add('bnav-active');
    } else {
        // Kein Match → "Mehr" hervorheben
        const mehr = [...items].find(b => b.dataset.fn === '_more');
        if (mehr) mehr.classList.add('bnav-active');
    }
}

function setActiveNav(el) {
    document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active-link'));
    el.classList.add('active-link');

    // Bottom-Nav synchronisieren
    const match = el.getAttribute('onclick')?.match(/^(\w+)\(/);
    if (match) _syncBottomNav(match[1]);

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

    // Bottom-Nav Badges
    _setBnavBadge('bnav-badge-news',    newsCount);
    _setBnavBadge('bnav-badge-tickets', ticketCount);
    _setBnavBadge('bnav-badge-docs',    docsCount);
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

function _setBnavBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.textContent = count > 99 ? '99+' : count;
        el.style.display = 'flex';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

// Badges nach Modulwechsel aktualisieren (wird von mod-news/mod-tickets aufgerufen)
window.refreshNavBadges = () => loadNavBadges();

// App starten
init();
