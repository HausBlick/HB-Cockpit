// ============================================================
// HB-Cockpit | mod-crm-activity.js
// CRM Activity-Log (Konzept §4) — Single-Table, polymorph.
// Wiederverwendbar für entity_type: 'person' | 'object' | 'company'.
// Mount-Container muss id="crm-activity-container" haben.
// ============================================================

const CRM_ACTIVITY_CATEGORIES = ['Notiz', 'Telefonat', 'Gespräch', 'E-Mail'];

// Rendert Log + Eingabemaske in den Container.
window.renderCrmActivityLog = async (containerEl, entityType, entityId) => {
    if (!containerEl) return;
    containerEl.innerHTML = '<p class="text-xs text-gray-400 py-2">Lädt…</p>';

    const { data, error } = await _supabase
        .from('crm_activities')
        .select('id, category, description, created_at, author:profiles!crm_activities_created_by_fkey(full_name)')
        .eq('entity_type', entityType)
        .eq('entity_id', String(entityId))
        .order('created_at', { ascending: false });

    if (error) {
        containerEl.innerHTML = `<p class="text-sm text-hb-error py-2">Fehler: ${error.message}</p>`;
        return;
    }

    const items   = data || [];
    const catOpts = CRM_ACTIVITY_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    const esc     = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const list = items.length ? items.map(a => {
        const when = new Date(a.created_at).toLocaleString('de-DE');
        const who  = a.author?.full_name || '—';
        return `<div class="py-2 border-b border-gray-50 last:border-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-hb-olive/10 text-hb-olive">${esc(a.category || 'Notiz')}</span>
                <span class="text-[11px] text-gray-400">${when} · ${esc(who)}</span>
            </div>
            <p class="text-sm text-gray-700 mt-1 whitespace-pre-wrap">${esc(a.description)}</p>
        </div>`;
    }).join('') : '<p class="text-[15px] text-gray-400 text-center py-4">Noch keine Aktivitäten erfasst.</p>';

    containerEl.innerHTML = `
        <div class="space-y-3">
            <div class="bg-white border border-gray-100 rounded-xl p-3">
                <div class="flex flex-col md:flex-row gap-2 md:items-start">
                    <select id="crm-act-cat" class="text-sm h-11 md:w-40">${catOpts}</select>
                    <textarea id="crm-act-desc" rows="2" class="flex-grow text-sm" placeholder="Notiz / Aktivität erfassen…"></textarea>
                    <button type="button" onclick="addCrmActivity('${entityType}','${entityId}')"
                        class="btn-primary text-xs px-4 whitespace-nowrap h-11">Hinzufügen</button>
                </div>
            </div>
            <div class="bg-white border border-gray-100 rounded-xl p-4">${list}</div>
        </div>`;
};

// Activity-Log in einem Modal öffnen (z.B. aus Listen heraus).
window.showCrmActivityModal = (entityType, entityId, title = 'Aktivitäten') => {
    const safeTitle = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.getElementById('crm-activity-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'crm-activity-modal';
    modal.className = 'fixed inset-0 bg-hb-offblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
            <div class="p-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <h2 class="text-lg font-extrabold text-hb-offblack">${safeTitle}</h2>
                <button onclick="document.getElementById('crm-activity-modal').remove()"
                    class="text-gray-400 hover:text-hb-orange font-bold text-xl leading-none">✕</button>
            </div>
            <div class="p-5 overflow-y-auto flex-grow" id="crm-activity-container"></div>
        </div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
    window.renderCrmActivityLog(document.getElementById('crm-activity-container'), entityType, entityId);
};

// Manuelle Aktivität speichern, danach Log neu laden.
window.addCrmActivity = async (entityType, entityId) => {
    const cat  = document.getElementById('crm-act-cat')?.value || 'Notiz';
    const desc = document.getElementById('crm-act-desc')?.value?.trim();
    if (!desc) { showToast('Bitte eine Beschreibung eingeben.', 'error'); return; }

    const { error } = await _supabase.from('crm_activities').insert({
        entity_type: entityType,
        entity_id:   String(entityId),
        category:    cat,
        description: desc,
        created_by:  currentUser?.id || null,
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }

    showToast('Aktivität gespeichert.', 'success');
    const container = document.getElementById('crm-activity-container');
    if (container) window.renderCrmActivityLog(container, entityType, entityId);
};
