-- Migration: Zeiterfassung (Time Tracking)
-- Beschreibung: Tabellen für Projekte, Arbeitspakete und Zeiteinträge

-- 1. Tabellen erstellen
CREATE TABLE IF NOT EXISTS time_projects (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    hourly_rate NUMERIC(10, 2) DEFAULT 0,
    billing_increment_min INTEGER DEFAULT 1 CHECK (billing_increment_min IN (1, 15, 30, 60)),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS time_work_packages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES time_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    work_package_id INTEGER REFERENCES time_work_packages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ, -- NULL bedeutet Timer läuft
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS aktivieren
ALTER TABLE time_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- 3. Policies für admin und manager (Vollzugriff)
-- Hinweis: Wir nutzen existierende Muster für admin/manager Zugriff

CREATE POLICY "Admins/Managers full access on projects" ON time_projects
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins/Managers full access on work packages" ON time_work_packages
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins/Managers full access on entries" ON time_entries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- 4. Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_time_projects_building ON time_projects(building_id);
CREATE INDEX IF NOT EXISTS idx_time_work_packages_project ON time_work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_wp ON time_entries(work_package_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
