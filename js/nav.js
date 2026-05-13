// ============================================================
// HB-Mieterportal | nav.js
// App-Initialisierung, Navigation & Routing (Multi-Page)
// Muss als letztes geladen werden (alle Module müssen bereit sein)
// ============================================================

// ─── Nav-Item Helper (Multi-Page-Aware) ─────────────────────
// Erzeugt <li><a ...> für Sidebar-Navigation.
// Auf Dashboard: SPA-Module → onclick, externe Seiten → href.
// Auf externen Seiten: alles → href (zurück zum Dashboard oder zur Zielseite).
function _navItem(fn, icon, label, badgeId) {
    const page = _getCurrentPage();
    const ext = EXTERNAL_PAGES[fn];
    const badge = badgeId ? ` <span id="${badgeId}" class="nav-badge"></span>` : '';

    if (ext) {
        // Externe Seite — immer als href-Link
        const pageName = ext.replace('.html', '');
        const isActive = page === pageName;
        return `<li><a href="${ext}" class="nav-link${isActive ? ' active-link' : ''}">${icon} ${label}${badge}</a></li>`;
    }

    if (page === 'dashboard') {
        // Auf Dashboard: SPA-Routing per onclick
        return `<li><a onclick="${fn}(); setActiveNav(this)" class="nav-link">${icon} ${label}${badge}</a></li>`;
    }

    // Auf externer Seite: Link zurück zum Dashboard mit Modul-Parameter
    return `<li><a href="dashboard.html?m=${fn}" class="nav-link">${icon} ${label}${badge}</a></li>`;
}

// ─── Init ────────────────────────────────────────────────────
async function init() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { window.location.href = 'index.html'; return; }
        currentUser = user;

        const { data: profile } = await _supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!profile) return;

        // Rollenbausteine: Advisory aus board_members ableiten
        profile._isLandlord = profile.is_landlord === true;
        profile._isAdvisory = false;
        if (profile.role === 'owner') {
            // RPC umgeht RLS — Owner hat ggf. keinen Lesezugriff auf board_members
            const { data: isAdvisory } = await _supabase.rpc('check_is_advisory');
            profile._isAdvisory = isAdvisory === true;
        }
        userProfile = profile;

        const page = _getCurrentPage();

        // Auth-Guard für rollengeschützte externe Seiten
        const allowedRoles = EXTERNAL_PAGE_ROLES[page];
        if (allowedRoles) {
            const hasAccess = allowedRoles.includes(profile.role) || (allowedRoles.includes('advisory') && profile._isAdvisory);
            if (!hasAccess) { window.location.href = 'dashboard.html'; return; }
        }

        // Role-Label: Kombination anzeigen
        let roleLabel = ROLE_LABELS[profile.role] || 'Nutzer Portal';
        if (profile._isLandlord && profile._isAdvisory) roleLabel = 'Vermieter & Beirat';
        else if (profile._isLandlord) roleLabel = 'Vermieter Cockpit';
        else if (profile._isAdvisory) roleLabel = 'Eigentümer & Beirat';

        // Header-Elemente befüllen
        document.getElementById('role-label').textContent = roleLabel;
        document.getElementById('user-avatar').textContent    = profile.full_name.charAt(0).toUpperCase();
        document.getElementById('dropdown-name').textContent  = profile.full_name;
        document.getElementById('dropdown-email').textContent = profile.email;

        renderNav(profile.role);
        renderBottomNav(profile.role);
        loadNavBadges();

        if (page === 'dashboard') {
            // Deep-Link: ?m=loadTickets → Modul direkt öffnen
            const moduleParam = new URLSearchParams(window.location.search).get('m');
            if (moduleParam && typeof window[moduleParam] === 'function') {
                window[moduleParam]();
                // Active-State für deep-linked Modul setzen
                const links = document.querySelectorAll('#nav-links a');
                const dashLink = links[0]; // Dashboard ist immer der erste Link
                if (dashLink) dashLink.classList.remove('active-link');
                links.forEach(a => {
                    if (a.getAttribute('onclick')?.includes(moduleParam + '(')) a.classList.add('active-link');
                });
                _syncBottomNav(moduleParam);
            } else {
                loadDashboard();
            }
        } else {
            // Externe Seite — Modul direkt initialisieren
            const PAGE_INIT = {
                'zeiterfassung': typeof loadZeiterfassung === 'function' ? loadZeiterfassung : null,
                'etv': () => {
                    const tabParam = new URLSearchParams(window.location.search).get('tab');
                    if (tabParam === 'beschluesse' && typeof loadBeschluesse === 'function') {
                        loadBeschluesse();
                    } else if (typeof loadETV === 'function') {
                        loadETV();
                    }
                },
                'finanzen':      typeof loadFinance       === 'function' ? loadFinance       : null,
            };
            if (PAGE_INIT[page]) PAGE_INIT[page]();
        }
    } catch (err) {
        console.error(err);
    }
}

// ─── Sidebar Navigation ─────────────────────────────────────
function renderNav(role) {
    const nav = document.getElementById('nav-links');
    const page = _getCurrentPage();

    // Dashboard-Link (Sonderfall: auf Dashboard onclick, sonst href)
    let html;
    if (page === 'dashboard') {
        html = `<li><a onclick="loadDashboard(); setActiveNav(this)" class="nav-link active-link">${icons.dashboard} Dashboard</a></li>`;
    } else {
        html = `<li><a href="dashboard.html" class="nav-link">${icons.dashboard} Dashboard</a></li>`;
    }

    if (role === 'admin' || role === 'manager') {
        html += `<li class="nav-section-title">Kommunikation</li>`;
        html += _navItem('loadNews',           icons.news,      'Schwarzes Brett', 'nav-badge-news');
        html += _navItem('loadTickets',        icons.tickets,   'Tickets',         'nav-badge-tickets');
        html += _navItem('loadContacts',       icons.contact,   'Kontaktbuch');

        html += `<li class="nav-section-title">Verwaltung</li>`;
        html += _navItem('loadUserManagement', icons.users,     'Personen');
        html += _navItem('loadTenants',        icons.buildings,  'Gebäude &amp; Einheiten');

        html += `<li class="nav-section-title">Finanzen</li>`;
        html += _navItem('loadFinance',        icons.finance,   'Buchhaltung');
        html += _navItem('loadZeiterfassung',  icons.clock,     'Zeiterfassung');

        html += `<li class="nav-section-title">Service & Dokumente</li>`;
        html += _navItem('loadDocuments',      icons.docs,      'Dokumenten Cloud', 'nav-badge-docs');
        html += _navItem('loadCalendar',       icons.calendar,  'Kalender');
        html += _navItem('loadETV',            icons.users,     'Eigentümerversammlung');
        // Beschlusssammlung: auf etv.html per onclick, sonst href mit tab-Param
        const _bPage = _getCurrentPage();
        html += `<li><a ${_bPage === 'etv' ? `onclick="loadBeschluesse(); setActiveNav(this)"` : `href="etv.html?tab=beschluesse"`} class="nav-link">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            Beschlusssammlung <span id="nav-badge-beschluesse" class="nav-badge"></span>
        </a></li>`;
        html += _navItem('loadSettings',       icons.settings,  'Einstellungen');

    } else if (role === 'owner') {
        html += `<li class="nav-section-title">Mein Asset</li>`;
        html += _navItem('loadMyUnits',   icons.buildings, 'Meine Einheiten');
        if (userProfile?._isLandlord) {
            html += _navItem('loadMyTenants', icons.users, 'Meine Mieter');
        }
        html += _navItem('loadDocuments', icons.docs,      'Dokumente', 'nav-badge-docs');

        html += `<li class="nav-section-title">Kommunikation</li>`;
        html += _navItem('loadNews',     icons.news,    'Schwarzes Brett', 'nav-badge-news');
        html += _navItem('loadTickets',  icons.tickets, 'Meine Tickets', 'nav-badge-tickets');
        html += _navItem('loadContacts', icons.contact, 'Kontaktbuch');
        if (userProfile?._isAdvisory) {
            html += `<li class="nav-section-title">Finanzen</li>`;
            html += _navItem('loadFinance', icons.finance, 'Belegprüfung');
        }

    } else {
        // tenant
        html += `<li class="nav-section-title">Kommunikation</li>`;
        html += _navItem('loadNews',     icons.news,    'Schwarzes Brett', 'nav-badge-news');
        html += _navItem('loadTickets',  icons.tickets, 'Meine Tickets', 'nav-badge-tickets');
        html += _navItem('loadContacts', icons.contact, 'Kontaktbuch');

        html += `<li class="nav-section-title">Service & Dokumente</li>`;
        html += _navItem('loadDocuments', icons.docs, 'Meine Dokumente', 'nav-badge-docs');
    }

    nav.innerHTML = html;
}

// ─── Bottom Navigation (Mobile) ─────────────────────────────
function renderBottomNav(role) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    const moreIcon = icons.more || `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>`;
    const page = _getCurrentPage();

    let items;
    if (role === 'admin' || role === 'manager') {
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Tickets',   fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.news,      label: 'News',      fn: 'loadNews',      badge: 'bnav-badge-news' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: moreIcon,        label: 'Mehr',      fn: '_more' },
        ];
    } else if (role === 'tenant') {
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Tickets', fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.news,      label: 'News',      fn: 'loadNews',      badge: 'bnav-badge-news' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: moreIcon,        label: 'Mehr',      fn: '_more' },
        ];
    } else {
        // owner (+ landlord/advisory Features additiv via Sidebar "Mehr")
        items = [
            { icon: icons.dashboard, label: 'Home',      fn: 'loadDashboard' },
            { icon: icons.tickets,   label: 'Tickets',   fn: 'loadTickets',   badge: 'bnav-badge-tickets' },
            { icon: icons.docs,      label: 'Dokumente', fn: 'loadDocuments', badge: 'bnav-badge-docs' },
            { icon: icons.contact,   label: 'Kontakte',  fn: 'loadContacts' },
            { icon: moreIcon,        label: 'Mehr',      fn: '_more' },
        ];
    }

    // Auf externen Seiten: kein Bottom-Nav-Item ist initial aktiv (→ "Mehr" hervorheben)
    const initialActive = (page === 'dashboard') ? 0 : -1;

    try {
        nav.innerHTML = items.map((item, i) => `
            <button class="bnav-item flex flex-col items-center justify-center flex-1 pt-2 pb-1.5 relative${i === initialActive ? ' bnav-active' : ''}"
                    onclick="${item.fn === '_more' ? 'toggleMenu()' : `bottomNavGo('${item.fn}', this)`}"
                    data-fn="${item.fn}">
                <span class="relative">
                    ${(item.icon || '').replace(/w-5 h-5/g, 'w-6 h-6')}
                    ${item.badge ? `<span id="${item.badge}" class="absolute -top-1.5 -right-2.5 text-[8px] font-black bg-hb-orange text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 leading-none" style="display:none"></span>` : ''}
                </span>
                <span class="text-[10px] font-semibold mt-0.5 leading-tight">${item.label}</span>
                <span class="bnav-dot"></span>
            </button>
        `).join('');

        // Auf externen Seiten: "Mehr"-Item hervorheben
        if (page !== 'dashboard') {
            const mehr = nav.querySelector('[data-fn="_more"]');
            if (mehr) mehr.classList.add('bnav-active');
        }
    } catch (e) {
        console.error('renderBottomNav error:', e);
        nav.innerHTML = '<div class="text-xs text-hb-error p-2">Nav-Fehler — bitte Seite neu laden</div>';
    }
}

// ─── Bottom-Nav Routing (Multi-Page-Aware) ──────────────────
function bottomNavGo(fnName, el) {
    const page = _getCurrentPage();

    // Ziel ist eine externe Seite → navigieren
    if (EXTERNAL_PAGES[fnName]) {
        const target = EXTERNAL_PAGES[fnName];
        if (!window.location.pathname.endsWith(target)) {
            _syncBuildingToSession();
            window.location.href = target;
            return;
        }
        // Bereits auf der Seite → Modul neu laden
        if (typeof window[fnName] === 'function') window[fnName]();
    } else if (page !== 'dashboard') {
        // SPA-Modul, aber wir sind auf externer Seite → zurück zum Dashboard
        _syncBuildingToSession();
        if (fnName === 'loadDashboard') {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = `dashboard.html?m=${fnName}`;
        }
        return;
    } else {
        // Normales SPA-Routing auf dem Dashboard
        if (typeof window[fnName] === 'function') window[fnName]();
    }

    // Bottom-Nav Active-State
    const allBnav = document.querySelectorAll('.bnav-item');
    allBnav.forEach(b => b.classList.remove('bnav-active'));
    if (el) {
        el.classList.add('bnav-active');
    } else {
        allBnav.forEach(b => { if (b.dataset.fn === fnName) b.classList.add('bnav-active'); });
    }

    // Sidebar Active-State synchronisieren
    const sidebarLinks = document.querySelectorAll('#nav-links a');
    sidebarLinks.forEach(a => a.classList.remove('active-link'));
    sidebarLinks.forEach(a => {
        if (a.getAttribute('onclick')?.includes(fnName + '(')) a.classList.add('active-link');
        if (EXTERNAL_PAGES[fnName] && a.getAttribute('href') === EXTERNAL_PAGES[fnName]) a.classList.add('active-link');
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

    const isAdminOrManager = role === 'admin' || role === 'manager';
    const [newsRes, readsRes, ticketRes, docsRes, docReadsRes, beschAnfragenRes] = await Promise.all([
        _supabase.from('news').select('id, created_at, updated_at'),
        _supabase.from('news_reads').select('news_id, read_at').eq('user_id', uid),
        isAdminOrManager
            ? _supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'Offen').neq('category', 'Beschlusssammlung-Anfrage')
            : _supabase.from('tickets').select('id', { count: 'exact', head: true })
                .or(`creator_id.eq.${uid},assigned_to.eq.${uid}`).eq('status', 'Offen'),
        _supabase.from('documents').select('id').eq('status', 'active').eq('is_deleted', false),
        _supabase.from('document_reads').select('document_id').eq('user_id', uid),
        isAdminOrManager
            ? _supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'Offen').eq('category', 'Beschlusssammlung-Anfrage')
            : Promise.resolve({ count: 0 }),
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

    const beschAnfragenCount = beschAnfragenRes?.count || 0;

    _setNavBadge('nav-badge-news',        newsCount);
    _setNavBadge('nav-badge-tickets',     ticketCount);
    _setNavBadge('nav-badge-docs',        docsCount);
    _setNavBadge('nav-badge-beschluesse', beschAnfragenCount);

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
