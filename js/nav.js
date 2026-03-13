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

        document.getElementById('welcome-title').textContent = 'Hallo, ' + profile.full_name.split(' ')[0] + '!';

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
            <li><a onclick="loadNews();           setActiveNav(this)" class="nav-link">${icons.news}      Schwarzes Brett</a></li>
            <li><a onclick="loadTickets();        setActiveNav(this)" class="nav-link">${icons.tickets}   Ticket System</a></li>

            <li class="nav-section-title">Verwaltung</li>
            <li><a onclick="loadUserManagement(); setActiveNav(this)" class="nav-link">${icons.users}     Personen</a></li>
            <li><a onclick="loadTenants();        setActiveNav(this)" class="nav-link">${icons.buildings} Bestands-Objekte</a></li>

            <li class="nav-section-title">Finanzen</li>
            <li><a onclick="loadFinance();        setActiveNav(this)" class="nav-link">${icons.finance}   Abrechnungen</a></li>

            <li class="nav-section-title">Service & Dokumente</li>
            <li><a onclick="loadDocuments();      setActiveNav(this)" class="nav-link">${icons.docs}      Dokumenten Cloud</a></li>
            <li><a onclick="loadContacts();       setActiveNav(this)" class="nav-link">${icons.contact}   Kontaktbuch</a></li>
            <li><a onclick="loadSettings();       setActiveNav(this)" class="nav-link">${icons.settings}  Einstellungen</a></li>`;
    } else if (role === 'owner') {
        html += `
            <li class="nav-section-title">Mein Asset</li>
            <li><a onclick="loadMyUnits();   setActiveNav(this)" class="nav-link">${icons.buildings} Meine Einheiten</a></li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}      Dokumente</a></li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets}   Meine Tickets</a></li>

            <li class="nav-section-title">Vermieter-Bereich</li>
            <li><a onclick="loadMyTenants(); setActiveNav(this)" class="nav-link">${icons.users}    Meine Mieter</a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact}  Kontaktbuch</a></li>`;
    } else {
        // tenant
        html += `
            <li class="nav-section-title">Kommunikation</li>
            <li><a onclick="loadNews();      setActiveNav(this)" class="nav-link">${icons.news}    Schwarzes Brett</a></li>
            <li><a onclick="loadTickets();   setActiveNav(this)" class="nav-link">${icons.tickets} Meine Meldungen</a></li>

            <li class="nav-section-title">Service & Dokumente</li>
            <li><a onclick="loadDocuments(); setActiveNav(this)" class="nav-link">${icons.docs}    Meine Dokumente</a></li>
            <li><a onclick="loadContacts();  setActiveNav(this)" class="nav-link">${icons.contact} Kontaktbuch</a></li>`;
    }

    nav.innerHTML = html;
}

function setActiveNav(el) {
    document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active-link'));
    el.classList.add('active-link');
    if (window.innerWidth < 768) toggleMenu();
}

// App starten
init();
