// ============================================================
// HB-Mieterportal | utils-pdf.js
// Official Letter Engine — PDF-Generierung via pdf-lib
// Abhängigkeit: pdf-lib (CDN, muss vor diesem Script geladen sein)
// ============================================================

// ─── Hilfsfunktionen ─────────────────────────────────────────

async function _pdfGetSettings() {
    const { data } = await _supabase.from('global_settings').select('*').eq('id', 1).single();
    return data || {};
}

function _pdfDownload(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Erstellt ein neues PDFDocument mit dem hochgeladenen Briefbogen als Hintergrund.
// Wirft einen Fehler, wenn kein Briefbogen hinterlegt ist.
async function _pdfCreateDoc(settings) {
    if (!settings.letterhead_pdf_url) {
        throw new Error('NO_LETTERHEAD');
    }

    const { PDFDocument } = PDFLib;

    // Signed URL für privaten Bucket erzeugen (60 Sekunden reichen zum Laden)
    const { data: signedData, error: signedErr } = await _supabase.storage
        .from('documents').createSignedUrl(settings.letterhead_pdf_url, 60);
    if (signedErr || !signedData?.signedUrl) throw new Error('FETCH_FAILED');

    const resp = await fetch(signedData.signedUrl);
    if (!resp.ok) throw new Error('FETCH_FAILED');

    const templateBytes = await resp.arrayBuffer();
    const templateDoc   = await PDFDocument.load(templateBytes);
    const pdfDoc        = await PDFDocument.create();
    const [copied]      = await pdfDoc.copyPages(templateDoc, [0]);
    const page          = pdfDoc.addPage(copied);

    return { pdfDoc, page };
}

// Zeichnet einen einfachen Briefkopf (falls kein Briefbogen-PDF hinterlegt)
async function _pdfDrawFallbackHeader(page, pdfDoc, settings) {
    const { StandardFonts, rgb } = PDFLib;
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { height } = page.getSize();

    const olive = rgb(0.408, 0.455, 0.318); // #687451

    // Firmenname
    if (settings.company_name) {
        page.drawText(settings.company_name, {
            x: 56.7, y: height - 42,
            size: 11, font: bold, color: olive,
        });
    }

    // Adresszeile
    const addrLine = [settings.street, settings.zip_city].filter(Boolean).join(' | ');
    if (addrLine) {
        page.drawText(addrLine, {
            x: 56.7, y: height - 58,
            size: 8, font: reg, color: rgb(0.4, 0.4, 0.4),
        });
    }

    // Trennlinie
    page.drawLine({
        start: { x: 56.7, y: height - 68 },
        end:   { x: 538.6, y: height - 68 },
        thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
    });

    return { bold, reg };
}

// ─── DIN-5008-konformes Adressfeld (Empfänger) ───────────────
// Fenster: 20mm links, 50mm von oben, 85mm × 45mm
function _pdfDrawAddressField(page, font, name, address1, address2) {
    const { height } = page.getSize();
    const x    = 56.7;          // 20mm
    const yTop = height - 141.8; // 50mm von oben (842 - 141.8)

    if (name) {
        page.drawText(name, { x, y: yTop, size: 10, font, color: PDFLib.rgb(0.22, 0.22, 0.22) });
    }
    if (address1) {
        page.drawText(address1, { x, y: yTop - 14, size: 10, font, color: PDFLib.rgb(0.22, 0.22, 0.22) });
    }
    if (address2) {
        page.drawText(address2, { x, y: yTop - 28, size: 10, font, color: PDFLib.rgb(0.22, 0.22, 0.22) });
    }
}

// ─── Absenderzeile (kleine Schrift über dem Adressfeld) ───────
function _pdfDrawSenderLine(page, font, settings) {
    const { height } = page.getSize();
    const senderText = [settings.company_name, settings.street, settings.zip_city].filter(Boolean).join(', ');
    if (senderText) {
        page.drawText(senderText, {
            x: 56.7, y: height - 121,
            size: 7, font, color: PDFLib.rgb(0.5, 0.5, 0.5),
        });
    }
}

// ─── Datum + Ort rechts ───────────────────────────────────────
function _pdfDrawDate(page, font, settings) {
    const { height } = page.getSize();
    const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    const place   = settings.zip_city ? settings.zip_city.replace(/^\d+\s*/, '') : '';
    const line    = place ? `${place}, ${dateStr}` : dateStr;
    page.drawText(line, {
        x: 340, y: height - 145,
        size: 9, font, color: PDFLib.rgb(0.3, 0.3, 0.3),
    });
}

// ─── Text-Wrap-Hilfsfunktion ──────────────────────────────────
// Bricht einen langen Text in Zeilen auf, die in maxWidth passen
function _pdfSplitText(text, font, fontSize, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

// ─── Mahnung als PDF generieren ───────────────────────────────
async function generateMahnungPDF(noticeId) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('PDF wird erstellt…');

    // Daten laden
    const [settingsRes, noticeRes] = await Promise.all([
        _pdfGetSettings(),
        _supabase.from('dunning_notices')
            .select('*, person:profiles(full_name, email), demand:payment_demands(due_date, demand_type, apartment:apartments(apartment_number, buildings(street, house_number, file_number, name)))')
            .eq('id', noticeId).single(),
    ]);

    const settings = settingsRes;
    const notice   = noticeRes.data;
    if (!notice) { showToast('Mahnung nicht gefunden.', 'error'); return; }

    const { StandardFonts, rgb } = PDFLib;
    let pdfDoc, page;
    try {
        ({ pdfDoc, page } = await _pdfCreateDoc(settings));
    } catch (e) {
        if (e.message === 'NO_LETTERHEAD')
            showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error');
        else
            showToast('Briefbogen konnte nicht geladen werden: ' + e.message, 'error');
        return;
    }
    const { height } = page.getSize();

    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Absender über Adressfeld
    _pdfDrawSenderLine(page, reg, settings);

    // Empfänger-Adressfeld
    const apt    = notice.demand?.apartment;
    const bld    = apt?.buildings;
    const addr1  = bld ? `${bld.street || ''} ${bld.house_number || ''}, WE ${apt.apartment_number || ''}`.trim() : '';
    const addr2  = bld ? formatBuildingName(bld) : '';
    _pdfDrawAddressField(page, reg, notice.person?.full_name || '—', addr1, addr2);

    // Datum
    _pdfDrawDate(page, reg, settings);

    // Betreff
    const levelText = notice.dunning_level === 1 ? 'Zahlungserinnerung'
        : notice.dunning_level === 2 ? '1. Mahnung' : 'Letzte Mahnung';
    const betreff = `${levelText} — Offene Hausgeld-Forderung`;
    page.drawText(betreff, {
        x: 56.7, y: height - 200, size: 11, font: bold, color: rgb(0.22, 0.22, 0.22),
    });

    // Anrede
    const anrede = notice.person?.full_name ? `Sehr geehrte Damen und Herren,` : 'Sehr geehrte Damen und Herren,';
    page.drawText(anrede, { x: 56.7, y: height - 230, size: 10, font: reg, color: rgb(0.22, 0.22, 0.22) });

    // Textblock
    const dueDateFmt = notice.demand?.due_date
        ? new Date(notice.demand.due_date).toLocaleDateString('de-DE') : '—';
    const totalAmt = (Number(notice.amount || 0) + Number(notice.fee || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 });

    const lines = [
        `trotz unserer Zahlungserinnerung haben wir bis heute keinen Zahlungseingang`,
        `für die unten genannte Forderung feststellen können. Wir bitten Sie, den`,
        `ausstehenden Betrag umgehend zu begleichen.`,
        '',
        `Fälligkeitsdatum:     ${dueDateFmt}`,
        `Offener Betrag:       ${Number(notice.amount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
        `Mahngebühr:           ${Number(notice.fee || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
        `Gesamtbetrag:         ${totalAmt} €`,
        '',
        `Bitte überweisen Sie den Gesamtbetrag von ${totalAmt} € binnen 7 Tagen`,
        `auf das Ihnen bekannte Konto der WEG.`,
        '',
        `Bei weiterer Nichtzahlung behalten wir uns vor, rechtliche Schritte einzuleiten.`,
        '',
        `Mit freundlichen Grüßen`,
    ];

    let y = height - 255;
    for (const line of lines) {
        if (line === '') { y -= 8; continue; }
        const isKey = line.includes(':') && !line.startsWith('Mit') && !line.startsWith('Bitte') && !line.startsWith('trotz') && !line.startsWith('für') && !line.startsWith('aus') && !line.startsWith('Bei');
        page.drawText(line, {
            x: 56.7, y, size: 10,
            font: isKey ? bold : reg,
            color: rgb(0.22, 0.22, 0.22),
        });
        y -= 15;
    }

    // Unterschrift-Bereich
    y -= 25;
    if (settings.company_name) {
        page.drawText(settings.company_name, { x: 56.7, y, size: 10, font: bold, color: rgb(0.22, 0.22, 0.22) });
    }
    if (settings.ceo_name) {
        page.drawText(settings.ceo_name, { x: 56.7, y: y - 15, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4) });
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `Mahnung_${levelText.replace(/ /g, '_')}_${notice.person?.full_name?.replace(/ /g, '_') || noticeId}.pdf`;
    _pdfDownload(pdfBytes, filename);
    showToast('PDF heruntergeladen.');
}

// ─── Wirtschaftsplan als PDF generieren ──────────────────────
async function generateWirtschaftsplanPDF(planId) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('PDF wird erstellt…');

    const [settingsRes, planRes, itemsRes] = await Promise.all([
        _pdfGetSettings(),
        _supabase.from('budget_plans').select('*, building:buildings(id, name, file_number, street, house_number)').eq('id', planId).single(),
        _supabase.from('budget_plan_items').select('*, account:accounts(account_number, account_name)').eq('budget_plan_id', planId).order('account_id'),
    ]);

    const settings  = settingsRes;
    const plan      = planRes.data;
    const planItems = itemsRes.data || [];

    if (!plan) { showToast('Wirtschaftsplan nicht gefunden.', 'error'); return; }

    const { StandardFonts, rgb } = PDFLib;
    let pdfDoc, page;
    try {
        ({ pdfDoc, page } = await _pdfCreateDoc(settings));
    } catch (e) {
        if (e.message === 'NO_LETTERHEAD')
            showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error');
        else
            showToast('Briefbogen konnte nicht geladen werden: ' + e.message, 'error');
        return;
    }
    const { height } = page.getSize();

    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const olive = rgb(0.408, 0.455, 0.318);

    _pdfDrawDate(page, reg, settings);

    // Titel
    const bld    = plan.building;
    const bldName = bld ? formatBuildingName(bld) : '—';
    page.drawText(`Wirtschaftsplan ${plan.fiscal_year}`, {
        x: 56.7, y: height - 105, size: 14, font: bold, color: rgb(0.22, 0.22, 0.22),
    });
    page.drawText(bldName, {
        x: 56.7, y: height - 124, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4),
    });

    const statusMap = { draft: 'Entwurf', approved: 'Beschlossen', active: 'Aktiv', closed: 'Abgeschlossen' };
    page.drawText(`Status: ${statusMap[plan.status] || plan.status}`, {
        x: 56.7, y: height - 140, size: 9, font: reg, color: rgb(0.5, 0.5, 0.5),
    });

    // Tabellen-Header
    const tableY = height - 168;
    page.drawRectangle({ x: 56.7, y: tableY - 4, width: 482, height: 18, color: olive });
    page.drawText('Konto', { x: 60, y: tableY, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Bezeichnung', { x: 110, y: tableY, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Vorjahr (€)', { x: 360, y: tableY, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Ansatz (€)', { x: 435, y: tableY, size: 8, font: bold, color: rgb(1, 1, 1) });

    // Zeilen
    let y = tableY - 20;
    let total = 0;
    for (const item of planItems) {
        if (y < 70) break; // Seitenrand
        const planned = Number(item.planned_amount || 0);
        total += planned;

        page.drawText(item.account?.account_number || '–', { x: 60, y, size: 8, font: reg, color: rgb(0.3, 0.3, 0.3) });
        page.drawText((item.account?.account_name || '–').substring(0, 42), { x: 110, y, size: 8, font: reg, color: rgb(0.22, 0.22, 0.22) });
        page.drawText(Number(item.prior_year_actual || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }), {
            x: 360, y, size: 8, font: reg, color: rgb(0.4, 0.4, 0.4),
        });
        page.drawText(planned.toLocaleString('de-DE', { minimumFractionDigits: 2 }), {
            x: 435, y, size: 8, font: bold, color: rgb(0.22, 0.22, 0.22),
        });

        // Trennlinie
        page.drawLine({ start: { x: 56.7, y: y - 5 }, end: { x: 538.6, y: y - 5 }, thickness: 0.3, color: rgb(0.9, 0.9, 0.9) });
        y -= 16;
    }

    // Summenzeile
    page.drawLine({ start: { x: 56.7, y: y + 4 }, end: { x: 538.6, y: y + 4 }, thickness: 1, color: olive });
    page.drawText('Gesamtansatz:', { x: 300, y: y - 8, size: 9, font: bold, color: rgb(0.22, 0.22, 0.22) });
    page.drawText(total.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €', {
        x: 435, y: y - 8, size: 9, font: bold, color: olive,
    });

    // Hinweis-Box (Signal-Orange, direkt unterhalb der Tabelle)
    const hintText = 'Dieser Wirtschaftsplan wurde maschinell erstellt und ist rechtlich bindend nach Beschlussfassung der WEG-Gemeinschaft. Die aus dem Wirtschaftsplan resultierenden monatlichen Hausgelder sind über den Planungszeitraum hinaus weiter zu zahlen, bis ein neuer Wirtschaftsplan beschlossen wurde.';
    const hintPad      = 10;
    const hintFontSize = 8;
    const hintLines    = _pdfSplitText(hintText, reg, hintFontSize, 482 - hintPad * 2);
    const hintLineH    = 12;
    const hintBoxH     = hintPad * 2 + hintLines.length * hintLineH;
    const hintTopY     = y - 24; // 24pt Abstand nach Summenzeile
    const orange       = rgb(0.922, 0.463, 0.176); // hb-orange

    page.drawRectangle({
        x: 56.7, y: hintTopY - hintBoxH,
        width: 482, height: hintBoxH,
        borderColor: orange, borderWidth: 1.5,
        color: rgb(1, 0.975, 0.965),
    });
    hintLines.forEach((line, i) => {
        page.drawText(line, {
            x: 56.7 + hintPad,
            y: hintTopY - hintPad - (i * hintLineH),
            size: hintFontSize, font: reg, color: rgb(0.22, 0.22, 0.22),
        });
    });

    const pdfBytes = await pdfDoc.save();
    const filename = `Wirtschaftsplan_${plan.fiscal_year}_${bldName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    _pdfDownload(pdfBytes, filename);
    showToast('PDF heruntergeladen.');
}

// ─── Inter-Font Loader (cached as Uint8Array) ──────────────
let _interFontsCache = null;
async function _pdfLoadInterFonts(pdfDoc) {
    if (!_interFontsCache) {
        // Resolve base path from current page location (works on GitHub Pages & local)
        const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        async function loadFont(file) {
            const url = base + 'fonts/' + file;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Font ${file}: HTTP ${resp.status} (${url})`);
            return new Uint8Array(await resp.arrayBuffer());
        }
        const [regBytes, semiBytes, boldBytes] = await Promise.all([
            loadFont('Inter-Regular.ttf'),
            loadFont('Inter-SemiBold.ttf'),
            loadFont('Inter-Bold.ttf'),
        ]);
        _interFontsCache = { regBytes, semiBytes, boldBytes };
    }
    // Copy bytes for each embed call (pdf-lib may consume the buffer)
    const reg  = await pdfDoc.embedFont(_interFontsCache.regBytes.slice());
    const semi = await pdfDoc.embedFont(_interFontsCache.semiBytes.slice());
    const bold = await pdfDoc.embedFont(_interFontsCache.boldBytes.slice());
    return { reg, semi, bold };
}

// ─── Einzelwirtschaftspläne als Bulk-PDF (1 Seite je WE) ────
async function generateEinzelwirtschaftsplanPDF(planId) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('Einzelwirtschaftspläne werden erstellt…');

    const settings = await _pdfGetSettings();
    const { data: plan } = await _supabase.from('budget_plans')
        .select('*, building:buildings(id, name, file_number, street, house_number)')
        .eq('id', planId).single();
    if (!plan) { showToast('Wirtschaftsplan nicht gefunden.', 'error'); return; }

    const bid = plan.building_id;
    const [itemsRes, aptsRes, accsRes, dkRes, dkuRes, ownRes] = await Promise.all([
        _supabase.from('budget_plan_items').select('*, account:accounts(id, account_number, account_name, account_type, primary_key_id, secondary_key_id, secondary_key_percentage)').eq('budget_plan_id', planId).order('account_id'),
        _supabase.from('apartments').select('id, apartment_number, floor, sq_meters, mea, hausgeld').eq('building_id', bid).order('apartment_number'),
        _supabase.from('accounts').select('id, account_number, account_name, account_type, primary_key_id, secondary_key_id, secondary_key_percentage').eq('building_id', bid).eq('is_active', true),
        _supabase.from('distribution_keys').select('id, name, type, total_value, heiz_split_percent').eq('building_id', bid),
        _supabase.from('distribution_key_units').select('distribution_key_id, apartment_id, value'),
        _supabase.from('ownerships').select('apartment_id, person:persons(full_name, street, zip_code, city)').eq('active', true),
    ]);

    const planItems = itemsRes.data || [];
    const apts      = aptsRes.data || [];
    const accounts  = accsRes.data || [];
    const distKeys  = dkRes.data || [];
    const dkUnits   = dkuRes.data || [];
    const owners    = ownRes.data || [];

    if (!apts.length) { showToast('Keine Einheiten vorhanden.', 'error'); return; }
    if (!distKeys.length) { showToast('Keine Verteilerschlüssel konfiguriert. Bitte zuerst unter Gebäude → Verteilerschlüssel anlegen.', 'error'); return; }

    // Lookup-Maps
    const dkMap = {};
    distKeys.forEach(k => { dkMap[k.id] = k; });
    const dkUnitMap = {};
    dkUnits.forEach(u => {
        if (!dkUnitMap[u.distribution_key_id]) dkUnitMap[u.distribution_key_id] = {};
        dkUnitMap[u.distribution_key_id][u.apartment_id] = Number(u.value) || 0;
    });
    const ownerMap = {};
    owners.forEach(o => { if (o.person) ownerMap[o.apartment_id] = o.person; });

    // Load letterhead template
    const { PDFDocument, rgb } = PDFLib;
    if (!settings.letterhead_pdf_url) {
        showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error'); return;
    }
    const { data: signedData } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
    if (!signedData?.signedUrl) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
    const lhResp = await fetch(signedData.signedUrl);
    if (!lhResp.ok) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
    const templateBytes = await lhResp.arrayBuffer();
    const templateDoc   = await PDFDocument.load(templateBytes);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Embed Inter fonts (Regular 400, SemiBold 600, Bold 700)
    let fReg, fSemi, fBold;
    try {
        ({ reg: fReg, semi: fSemi, bold: fBold } = await _pdfLoadInterFonts(pdfDoc));
    } catch (e) {
        console.error('Inter font load error:', e);
        showToast('Inter-Schriftart konnte nicht geladen werden: ' + e.message, 'error'); return;
    }

    // Colors
    const olive    = rgb(0.408, 0.455, 0.318); // #687451
    const offblack = rgb(0.216, 0.216, 0.216); // #373737
    const orange   = rgb(0.922, 0.463, 0.176); // #EB762D
    const gray50   = rgb(0.5, 0.5, 0.5);
    const gray40   = rgb(0.4, 0.4, 0.4);
    const white    = rgb(1, 1, 1);

    // Page margins
    const mLeft    = 56.7;  // ~20mm
    const mRight   = 538.6; // ~190mm
    const contentW = mRight - mLeft; // 482pt

    const bldName = plan.building ? formatBuildingName(plan.building) : '—';
    const bldStreet = plan.building ? `${plan.building.street || ''} ${plan.building.house_number || ''}`.trim() : '';

    // Helper: right-align
    function drawR(page, text, xRight, y, size, font, color) {
        const w = font.widthOfTextAtSize(text, size);
        page.drawText(text, { x: xRight - w, y, size, font, color });
    }
    // Helper: format EUR (exact 2 decimals, with €)
    function fmt(v) {
        const r = Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
        return r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    // Helper: distribution key type labels
    const typeLabels = { mea: 'MEA', sqm: 'Fläche (m²)', units: 'Einheiten', consumption: 'Verbrauch', persons: 'Personen', heizkosten: 'HeizKV', custom: 'Individuell' };

    // Helper: calc apartment share for one budget item
    function calcShare(item, aptId) {
        const acc = item.account || accounts.find(a => a.id === item.account_id);
        if (!acc) return { share: 0, keyName: '—', keyId: null };
        const pkId = acc.primary_key_id;
        const skId = acc.secondary_key_id;
        const skPct = acc.secondary_key_percentage;
        const planned = Number(item.planned_amount || 0);
        if (!pkId || !dkMap[pkId]) return { share: 0, keyName: '—', keyId: null };
        const pk = dkMap[pkId];
        const pkTotal = Number(pk.total_value) || 0;
        const pkVal   = (dkUnitMap[pkId] && dkUnitMap[pkId][aptId]) || 0;
        let keyName   = pk.name;
        if (pkTotal === 0) return { share: 0, keyName, keyId: pkId };
        if (skId && skPct && dkMap[skId]) {
            const sk = dkMap[skId];
            const skTotal = Number(sk.total_value) || 0;
            const skVal   = (dkUnitMap[skId] && dkUnitMap[skId][aptId]) || 0;
            const primaryShare   = planned * (1 - skPct / 100) * (pkVal / pkTotal);
            const secondaryShare = skTotal > 0 ? planned * (skPct / 100) * (skVal / skTotal) : 0;
            keyName = `${pk.name}/${sk.name}`;
            return { share: primaryShare + secondaryShare, keyName, keyId: pkId };
        }
        return { share: planned * (pkVal / pkTotal), keyName, keyId: pkId };
    }

    // Helper: draw olive table header row (FIX 2: min height + correct baseline)
    const hdrFS = 8;
    function drawTableHeader(page, y, cols) {
        const hH = Math.max(22, hdrFS * 1.35 + 8);
        page.drawRectangle({ x: mLeft, y: y - hH, width: contentW, height: hH, color: olive });
        const baseY = y - 5 - hdrFS;
        cols.forEach(c => {
            if (c.align === 'right') {
                drawR(page, c.label, c.x, baseY, hdrFS, fBold, white);
            } else {
                page.drawText(c.label, { x: c.x, y: baseY, size: hdrFS, font: fBold, color: white });
            }
        });
        return hH;
    }

    // Collect unique distribution keys used by plan items (for Umlageschlüssel table)
    function collectUsedKeys(aptId) {
        const seen = new Set();
        const result = [];
        for (const item of planItems) {
            const acc = item.account || accounts.find(a => a.id === item.account_id);
            if (!acc || !acc.primary_key_id || !dkMap[acc.primary_key_id]) continue;
            const pk = dkMap[acc.primary_key_id];
            if (seen.has(pk.id)) continue;
            seen.add(pk.id);
            const pkTotal = Number(pk.total_value) || 0;
            const pkVal   = (dkUnitMap[pk.id] && dkUnitMap[pk.id][aptId]) || 0;
            result.push({ nr: result.length + 1, key: pk, unitVal: pkVal, total: pkTotal });
            // Secondary key
            if (acc.secondary_key_id && dkMap[acc.secondary_key_id]) {
                const sk = dkMap[acc.secondary_key_id];
                if (!seen.has(sk.id)) {
                    seen.add(sk.id);
                    const skTotal = Number(sk.total_value) || 0;
                    const skVal   = (dkUnitMap[sk.id] && dkUnitMap[sk.id][aptId]) || 0;
                    result.push({ nr: result.length + 1, key: sk, unitVal: skVal, total: skTotal });
                }
            }
        }
        return result;
    }

    // Date string
    const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    const place   = settings.zip_city ? settings.zip_city.replace(/^\d+\s*/, '') : '';

    // ── Generate one page per apartment ─────────────────────────
    for (const apt of apts) {
        const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
        const page     = pdfDoc.addPage(copied);
        const { height } = page.getSize();

        const owner = ownerMap[apt.id] || {};
        const ownerName = owner.full_name || 'Leerstand (Eigentümergemeinschaft)';

        // ── BLOCK 1: META-HEADER ────────────────────────────────
        // Title
        page.drawText(`Einzelwirtschaftsplan ${plan.fiscal_year}`, {
            x: mLeft, y: height - 98, size: 14, font: fBold, color: offblack,
        });

        // Left: Owner name + address
        let leftY = height - 118;
        page.drawText(ownerName, { x: mLeft, y: leftY, size: 9, font: fSemi, color: offblack });
        if (owner.street) {
            leftY -= 13;
            page.drawText(owner.street, { x: mLeft, y: leftY, size: 8.5, font: fReg, color: gray50 });
        }
        if (owner.zip_code || owner.city) {
            leftY -= 13;
            page.drawText([owner.zip_code, owner.city].filter(Boolean).join(' '), { x: mLeft, y: leftY, size: 8.5, font: fReg, color: gray50 });
        }

        // Right: Info block (right-aligned key-value pairs)
        const rX = mRight;
        let rightY = height - 118;
        const infoRows = [
            ['Datum', place ? `${place}, ${dateStr}` : dateStr],
            ['Wirtschaftsplan', `${plan.fiscal_year}`],
            ['Einheit', `WE ${apt.apartment_number}${apt.floor ? ' – ' + apt.floor : ''}`],
            ['Gebäude', bldStreet || bldName],
            ['MEA', apt.mea ? `${apt.mea}` : '—'],
            ['Wohnfläche', apt.sq_meters ? `${apt.sq_meters} m²` : '—'],
        ];
        for (const [label, value] of infoRows) {
            const labelW = fReg.widthOfTextAtSize(label + ':  ', 8);
            drawR(page, value, rX, rightY, 8, fSemi, offblack);
            const valW = fSemi.widthOfTextAtSize(value, 8);
            page.drawText(label + ':', { x: rX - valW - labelW, y: rightY, size: 8, font: fReg, color: gray50 });
            rightY -= 12;
        }

        // Divider line after header
        const dividerY = Math.min(leftY, rightY) - 6;
        page.drawLine({ start: { x: mLeft, y: dividerY }, end: { x: mRight, y: dividerY }, thickness: 0.5, color: rgb(0.88, 0.89, 0.86) });

        let y = dividerY - 14;

        // ── BLOCK 2: HAUSGELD-SUMMARY ───────────────────────────
        // Pre-calculate totals for this apartment
        let totalPlanned = 0;
        let totalShare   = 0;
        for (const item of planItems) {
            totalPlanned += Number(item.planned_amount || 0);
            totalShare   += calcShare(item, apt.id).share;
        }

        // Section label
        page.drawText('Hausgeld-Übersicht', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        // Header
        const summCols = [
            { x: mLeft + 4, label: 'Hausgeld', align: 'left' },
            { x: mLeft + contentW * 0.55, label: 'Objekt gesamt', align: 'right' },
            { x: mRight - 4, label: 'Ihr Anteil', align: 'right' },
        ];
        y -= drawTableHeader(page, y, summCols);

        // FIX 4: Row 1 "Jahres-Hausgeld" — dezent, grau
        const summRow1H = minRowH;
        const grayDeemph = rgb(0.612, 0.639, 0.682); // #9ca3af
        const jr1base = y - padV - Math.ceil(8.5 * 1.3);
        page.drawText('Jahres-Hausgeld', { x: mLeft + 4, y: jr1base, size: 8.5, font: fReg, color: grayDeemph });
        drawR(page, fmt(totalPlanned), mLeft + contentW * 0.55, jr1base, 9, fReg, grayDeemph);
        drawR(page, fmt(totalShare), mRight - 4, jr1base, 9, fReg, grayDeemph);
        y -= summRow1H;

        // Divider
        page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });

        // FIX 4: Row 2 "Monatliches Hausgeld" — PROMINENT, 24pt height
        const summRow2H = 24;
        page.drawRectangle({ x: mLeft, y: y - summRow2H, width: contentW, height: summRow2H, color: rgb(0.976, 0.98, 0.973) }); // hb-ultralight
        const jr2base = y - padV - Math.ceil(10 * 1.3);
        page.drawText('Monatliches Hausgeld', { x: mLeft + 4, y: jr2base, size: 10, font: fSemi, color: offblack });
        drawR(page, fmt(totalPlanned / 12), mLeft + contentW * 0.55, jr2base, 10, fSemi, offblack);
        drawR(page, fmt(totalShare / 12), mRight - 4, jr2base, 11, fBold, olive);
        y -= summRow2H + 14;

        // ── TABLE DRAWING ENGINE (Pflicht-Algorithmus) ────────────
        // Shared constants (FIX 3: unified row heights)
        const padV = 4;          // vertical cell padding
        const minRowH = 18;      // minimum row height
        const sectionH  = 16;    // section header height
        const subtotalH = 20;    // subtotal row height
        const grandTotalH = 22;  // grand total row height

        // Split text into lines that fit maxWidth; max N lines, truncate with "…"
        function splitLines(text, font, fs, maxW, maxL) {
            const all = _pdfSplitText(text, font, fs, maxW);
            if (all.length <= maxL) return all;
            const out = all.slice(0, maxL);
            let last = out[maxL - 1];
            while (last.length > 3 && font.widthOfTextAtSize(last + '…', fs) > maxW) last = last.slice(0, -1);
            out[maxL - 1] = last + '…';
            return out;
        }

        // Draw multi-line text inside a cell, vertically centered
        function drawCell(pg, lines, x, cellTop, lineH, fs, font, color) {
            let textY = cellTop - padV - lineH;
            for (const line of lines) {
                pg.drawText(line, { x: x + 2, y: textY, size: fs, font, color });
                textY -= lineH;
            }
        }
        // Draw single-line text at first-line baseline of cell
        function drawCellSingle(pg, text, x, cellTop, lineH, fs, font, color) {
            pg.drawText(text, { x: x + 2, y: cellTop - padV - lineH, size: fs, font, color });
        }
        // Draw single-line right-aligned at first-line baseline of cell
        function drawCellR(pg, text, xRight, cellTop, lineH, fs, font, color) {
            const w = font.widthOfTextAtSize(text, fs);
            pg.drawText(text, { x: xRight - w - 2, y: cellTop - padV - lineH, size: fs, font, color });
        }

        // ── BLOCK 3: UMLAGESCHLÜSSEL-TABELLE ────────────────────
        const usedKeys = collectUsedKeys(apt.id);
        page.drawText('Umlageschlüssel', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        // (dkHeaderH computed by drawTableHeader)
        const dkFS  = 7.5;
        const dkLH  = Math.ceil(dkFS * 1.3); // 10pt
        const dk0   = mLeft + 2;
        const dk1   = mLeft + 30;
        const dk1W  = 115;          // Schlüssel text width
        const dk2   = mLeft + 149;
        const dk3   = mLeft + 211;
        const dk4r  = mLeft + 344;
        const dk5r  = mLeft + 415;
        const dk6r  = mRight - 2;

        y -= drawTableHeader(page, y, [
            { x: dk0,  label: 'Nr.',           align: 'left' },
            { x: dk1,  label: 'Schlüssel',     align: 'left' },
            { x: dk2,  label: 'Umlage-Typ',    align: 'left' },
            { x: dk3,  label: 'Zeitraum',       align: 'left' },
            { x: dk4r, label: 'Tage',           align: 'right' },
            { x: dk5r, label: 'Gesamtumlage',   align: 'right' },
            { x: dk6r, label: 'Ihr Anteil',     align: 'right' },
        ]);

        const zeitraum = `01.01.–31.12.${plan.fiscal_year}`;

        // SCHRITT 1+2: Pre-calc ALL row heights, then draw with accumulated y
        const dkPreCalc = usedKeys.map(uk => {
            const nameLines = splitLines(uk.key.name, fReg, dkFS, dk1W - 4, 2);
            const nLines = Math.max(nameLines.length, 1);
            const rowH = Math.max(minRowH, nLines * dkLH + padV * 2);
            return { uk, nameLines, rowH };
        });

        let dkY = y;
        dkPreCalc.forEach((row, ki) => {
            if (dkY - row.rowH < 80) return;
            const cellTop = dkY;

            // Zebra bg
            if (ki % 2 === 1) {
                page.drawRectangle({ x: mLeft, y: cellTop - row.rowH, width: contentW, height: row.rowH, color: rgb(0.976, 0.98, 0.973) });
            }

            // SCHRITT 3: draw each cell at cellTop
            drawCellSingle(page, `${row.uk.nr}`, dk0, cellTop, dkLH, dkFS, fReg, gray40);
            drawCell(page, row.nameLines, dk1, cellTop, dkLH, dkFS, fReg, offblack);
            drawCellSingle(page, typeLabels[row.uk.key.type] || row.uk.key.type, dk2, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellSingle(page, zeitraum, dk3, cellTop, dkLH, 7, fReg, gray50);
            drawCellR(page, '365',                dk4r, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellR(page, fmt(row.uk.total),    dk5r, cellTop, dkLH, dkFS, fReg, gray40);
            drawCellR(page, fmt(row.uk.unitVal),  dk6r, cellTop, dkLH, dkFS, fSemi, offblack);

            // Divider at bottom of row
            page.drawLine({ start: { x: mLeft, y: cellTop - row.rowH }, end: { x: mRight, y: cellTop - row.rowH }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });
            dkY -= row.rowH;
        });
        y = dkY - 14;

        // ── BLOCK 4: VERTEILUNGSERGEBNIS (Kostentabelle) ────────
        // Konto 13mm | Bezeichnung 50mm | Schlüssel 40mm | Gesamtkosten 30mm | Ihr Anteil 30mm
        page.drawText('Verteilungsergebnis', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        // (costHeaderH computed by drawTableHeader)
        const bezFS  = 9;
        const keyFS  = 7.5;
        const costLH = Math.ceil(bezFS * 1.3); // 12pt (use the larger fontSize for row lineH)

        const cKonto   = mLeft + 2;
        const cBez     = mLeft + 39;
        const cBezW    = 138;          // 50mm - 4pt cell padding
        const cKey     = mLeft + 183;
        const cKeyW    = 108;          // 38mm text area
        const cGesamtR = mLeft + 380;
        const cAnteilR = mRight - 2;

        y -= drawTableHeader(page, y, [
            { x: cKonto,    label: 'Konto',        align: 'left' },
            { x: cBez,      label: 'Bezeichnung',   align: 'left' },
            { x: cKey,      label: 'Schlüssel',     align: 'left' },
            { x: cGesamtR,  label: 'Gesamtkosten',  align: 'right' },
            { x: cAnteilR,  label: 'Ihr Anteil',    align: 'right' },
        ]);

        // Split items into umlagefähig (expense) and nicht umlagefähig (other)
        const expenseItems = planItems.filter(it => {
            const acc = it.account || accounts.find(a => a.id === it.account_id);
            return acc && acc.account_type === 'expense';
        });
        const otherItems = planItems.filter(it => {
            const acc = it.account || accounts.find(a => a.id === it.account_id);
            return !acc || acc.account_type !== 'expense';
        });

        function drawCostSection(page, label, items, startY, startIdx) {
            let cy = startY;
            let ri = startIdx;
            let sectionTotal = 0;
            let sectionShare = 0;

            // Section header: fixed 16pt, full-width colspan
            page.drawRectangle({ x: mLeft, y: cy - sectionH, width: contentW, height: sectionH, color: rgb(0.94, 0.95, 0.93) });
            page.drawText(label, { x: mLeft + 4, y: cy - sectionH + 4, size: 8, font: fSemi, color: olive });
            cy -= sectionH;

            // SCHRITT 1: Pre-calc ALL data row heights
            const rowData = items.map(item => {
                const planned = Number(item.planned_amount || 0);
                const { share, keyName } = calcShare(item, apt.id);
                const bezLines = splitLines(item.account?.account_name || '–', fReg, bezFS, cBezW, 2);
                const keyLines = splitLines(keyName, fReg, keyFS, cKeyW, 2);
                const maxLines = Math.max(bezLines.length, keyLines.length, 1);
                const rowH = Math.max(minRowH, maxLines * costLH + padV * 2);
                return { item, planned, share, bezLines, keyLines, rowH };
            });

            // SCHRITT 2: Draw rows with accumulated y
            for (const rd of rowData) {
                if (cy - rd.rowH < 80) break;
                sectionTotal += rd.planned;
                sectionShare += rd.share;
                const cellTop = cy;

                // Zebra bg
                if (ri % 2 === 1) {
                    page.drawRectangle({ x: mLeft, y: cellTop - rd.rowH, width: contentW, height: rd.rowH, color: rgb(0.976, 0.98, 0.973) });
                }

                // SCHRITT 3: Draw each cell, text inside cell bounds
                drawCellSingle(page, rd.item.account?.account_number || '–', cKonto, cellTop, costLH, 8, fReg, gray40);
                drawCell(page, rd.bezLines, cBez, cellTop, costLH, bezFS, fReg, offblack);
                drawCell(page, rd.keyLines, cKey, cellTop, costLH, keyFS, fReg, gray50);
                drawCellR(page, fmt(rd.planned), cGesamtR, cellTop, costLH, 8, fReg, gray40);

                const sFont  = rd.share > 0 ? fSemi : fReg;
                const sColor = rd.share > 0 ? offblack : rgb(0.6, 0.6, 0.6);
                drawCellR(page, fmt(rd.share), cAnteilR, cellTop, costLH, 8, sFont, sColor);

                // Divider at exact bottom of row
                page.drawLine({ start: { x: mLeft, y: cellTop - rd.rowH }, end: { x: mRight, y: cellTop - rd.rowH }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });
                cy -= rd.rowH;
                ri++;
            }

            // Subtotal: fixed 18pt, full-width colspan, bold
            page.drawRectangle({ x: mLeft, y: cy - subtotalH, width: contentW, height: subtotalH, color: rgb(0.94, 0.95, 0.93) });
            page.drawText(`Zwischensumme ${label}`, { x: mLeft + 4, y: cy - subtotalH + 5, size: 8, font: fSemi, color: offblack });
            drawR(page, fmt(sectionTotal), cGesamtR - 2, cy - subtotalH + 5, 8, fSemi, gray40);
            drawR(page, fmt(sectionShare), cAnteilR - 2, cy - subtotalH + 5, 8, fBold, olive);
            cy -= subtotalH;

            return { y: cy, ri, total: sectionTotal, share: sectionShare };
        }

        let costIdx = 0;
        let grandTotal = 0, grandShare = 0;

        if (expenseItems.length) {
            const res = drawCostSection(page, 'Umlagefähige Kosten', expenseItems, y, costIdx);
            y = res.y; costIdx = res.ri; grandTotal += res.total; grandShare += res.share;
        }
        if (otherItems.length) {
            const res = drawCostSection(page, 'Nicht umlagefähige Kosten', otherItems, y, costIdx);
            y = res.y; costIdx = res.ri; grandTotal += res.total; grandShare += res.share;
        }

        // Grand total row (full-width, olive bg)
        const gtH = grandTotalH;
        page.drawRectangle({ x: mLeft, y: y - gtH, width: contentW, height: gtH, color: olive });
        page.drawText('Gesamt Jahres-Hausgeld', { x: mLeft + 4, y: y - gtH + 6, size: 8.5, font: fBold, color: white });
        drawR(page, fmt(grandTotal), cGesamtR - 2, y - gtH + 6, 8.5, fBold, white);
        drawR(page, fmt(grandShare), cAnteilR - 2, y - gtH + 6, 8.5, fBold, white);
        y -= gtH + 16;

        // ── BLOCK 5: RECHTLICHER HINWEIS (FIX 5: exakte Höhe) ───
        const hintText = 'Dieser Wirtschaftsplan wurde maschinell erstellt und ist rechtlich bindend nach Beschlussfassung der WEG-Gemeinschaft. Die aus dem Wirtschaftsplan resultierenden monatlichen Hausgelder sind über den Planungszeitraum hinaus weiter zu zahlen, bis ein neuer Wirtschaftsplan beschlossen wurde.';
        const hintFS     = 9.5;
        const hintLH     = Math.ceil(hintFS * 1.3); // 13pt
        const hintIconW  = 16;       // icon area width
        const hintIconGap = 8;       // gap icon → text
        const hintTextW  = contentW - hintIconW - hintIconGap; // verfügbreite = boxWidth - 24
        const hintLines  = _pdfSplitText(hintText, fReg, hintFS, hintTextW);
        const hintBoxH   = hintLines.length * hintLH + 12; // 6pt oben + 6pt unten, strikt

        const hintTopY = Math.max(y, hintBoxH + 30);

        // Box: hb-orange/8% on white
        page.drawRectangle({
            x: mLeft, y: hintTopY - hintBoxH,
            width: contentW, height: hintBoxH,
            borderColor: orange, borderWidth: 1,
            color: rgb(0.996, 0.972, 0.958),
        });

        // "i" icon: orange circle (10pt), white "i" (7pt), centered to first text line
        const iconCX = mLeft + 8; // center of 16pt icon area
        const firstTextY = hintTopY - 6 - hintLH; // 6pt top padding
        const iconCY = firstTextY + hintLH * 0.4;
        page.drawCircle({ x: iconCX, y: iconCY, size: 5, color: orange });
        const iCharW = fBold.widthOfTextAtSize('i', 7);
        page.drawText('i', { x: iconCX - iCharW / 2, y: iconCY - 2.5, size: 7, font: fBold, color: white });

        // Text lines
        const hintTextX = mLeft + hintIconW + hintIconGap;
        hintLines.forEach((line, i) => {
            page.drawText(line, {
                x: hintTextX,
                y: hintTopY - 6 - hintLH - (i * hintLH),
                size: hintFS, font: fReg, color: offblack,
            });
        });
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `Einzelwirtschaftsplaene_${plan.fiscal_year}_${bldName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    _pdfDownload(pdfBytes, filename);
    showToast(`${apts.length} Einzelwirtschaftspläne als PDF heruntergeladen.`);
}
