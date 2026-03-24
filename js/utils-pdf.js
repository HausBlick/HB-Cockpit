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
    // Helper: format EUR
    function eur(val) { return Number(val || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }); }

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

    // Helper: draw olive table header row
    function drawTableHeader(page, y, cols, headerH) {
        page.drawRectangle({ x: mLeft, y: y - headerH + 4, width: contentW, height: headerH, color: olive });
        cols.forEach(c => {
            if (c.align === 'right') {
                drawR(page, c.label, c.x, y, 7.5, fBold, white);
            } else {
                page.drawText(c.label, { x: c.x, y, size: 7.5, font: fBold, color: white });
            }
        });
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

        const summHeaderH = 18;
        const summRowH    = 16;

        // Section label
        page.drawText('Hausgeld-Übersicht', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        // Header
        const summCols = [
            { x: mLeft + 4, label: 'Hausgeld', align: 'left' },
            { x: mLeft + contentW * 0.55, label: 'Objekt gesamt', align: 'right' },
            { x: mRight - 4, label: 'Ihr Anteil', align: 'right' },
        ];
        drawTableHeader(page, y, summCols, summHeaderH);
        y -= summHeaderH + 2;

        // Row: Jahres-Hausgeld
        page.drawText('Jahres-Hausgeld', { x: mLeft + 4, y, size: 8.5, font: fReg, color: offblack });
        drawR(page, eur(totalPlanned) + ' €', mLeft + contentW * 0.55, y, 8.5, fReg, gray40);
        drawR(page, eur(totalShare) + ' €', mRight - 4, y, 8.5, fSemi, offblack);
        y -= summRowH;

        // Divider
        page.drawLine({ start: { x: mLeft, y: y + 5 }, end: { x: mRight, y: y + 5 }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });

        // Row: Monatliches Hausgeld (bold, olive highlight)
        page.drawRectangle({ x: mLeft, y: y - 4, width: contentW, height: summRowH, color: rgb(0.94, 0.95, 0.93) });
        page.drawText('Monatliches Hausgeld', { x: mLeft + 4, y, size: 8.5, font: fBold, color: offblack });
        drawR(page, eur(totalPlanned / 12) + ' €', mLeft + contentW * 0.55, y, 8.5, fReg, gray40);
        drawR(page, eur(totalShare / 12) + ' €', mRight - 4, y, 8.5, fBold, olive);
        y -= summRowH + 14;

        // ── BLOCK 3: UMLAGESCHLÜSSEL-TABELLE ────────────────────
        const usedKeys = collectUsedKeys(apt.id);

        page.drawText('Umlageschlüssel', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        const dkHeaderH = 18;
        const dkRowH    = 14;
        const dkCols = [
            { x: mLeft + 4,              label: 'Nr.',           align: 'left' },
            { x: mLeft + 30,             label: 'Schlüssel',     align: 'left' },
            { x: mLeft + contentW * 0.35, label: 'Umlage-Typ',  align: 'left' },
            { x: mLeft + contentW * 0.52, label: 'Zeitraum',     align: 'left' },
            { x: mLeft + contentW * 0.66, label: 'Tage',         align: 'right' },
            { x: mLeft + contentW * 0.80, label: 'Gesamtumlage', align: 'right' },
            { x: mRight - 4,              label: 'Ihr Anteil',   align: 'right' },
        ];
        drawTableHeader(page, y, dkCols, dkHeaderH);
        y -= dkHeaderH + 2;

        const zeitraum = `01.01.–31.12.${plan.fiscal_year}`;
        for (let ki = 0; ki < usedKeys.length; ki++) {
            if (y < 90) break;
            const uk = usedKeys[ki];

            if (ki % 2 === 1) {
                page.drawRectangle({ x: mLeft, y: y - 4, width: contentW, height: dkRowH, color: rgb(0.976, 0.98, 0.973) });
            }

            page.drawText(`${uk.nr}`, { x: mLeft + 4, y, size: 7.5, font: fReg, color: gray40 });
            page.drawText(uk.key.name.substring(0, 20), { x: mLeft + 30, y, size: 7.5, font: fReg, color: offblack });
            page.drawText(typeLabels[uk.key.type] || uk.key.type, { x: mLeft + contentW * 0.35, y, size: 7.5, font: fReg, color: gray50 });
            page.drawText(zeitraum, { x: mLeft + contentW * 0.52, y, size: 7, font: fReg, color: gray50 });
            drawR(page, '365', mLeft + contentW * 0.66, y, 7.5, fReg, gray50);
            drawR(page, eur(uk.total), mLeft + contentW * 0.80, y, 7.5, fReg, gray40);
            drawR(page, eur(uk.unitVal), mRight - 4, y, 7.5, fSemi, offblack);

            page.drawLine({ start: { x: mLeft, y: y - 4 }, end: { x: mRight, y: y - 4 }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });
            y -= dkRowH;
        }

        y -= 14;

        // ── BLOCK 4: VERTEILUNGSERGEBNIS (Kostentabelle) ────────
        page.drawText('Verteilungsergebnis', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 16;

        const costHeaderH = 18;
        const costRowH    = 15;
        // Column positions: Konto ~12%, Bezeichnung ~33%, Schlüssel ~25%, Gesamtkosten, Ihr Anteil
        const cKonto  = mLeft + 4;
        const cBez    = mLeft + contentW * 0.12;
        const cKey    = mLeft + contentW * 0.45;
        const cGesamt = mLeft + contentW * 0.74;
        const cAnteil = mRight - 4;

        const costCols = [
            { x: cKonto,  label: 'Konto',        align: 'left' },
            { x: cBez,    label: 'Bezeichnung',   align: 'left' },
            { x: cKey,    label: 'Schlüssel',     align: 'left' },
            { x: cGesamt, label: 'Gesamtkosten',  align: 'right' },
            { x: cAnteil, label: 'Ihr Anteil',    align: 'right' },
        ];
        drawTableHeader(page, y, costCols, costHeaderH);
        y -= costHeaderH + 2;

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
            let y = startY;
            let ri = startIdx;
            let sectionTotal = 0;
            let sectionShare = 0;

            // Section header
            page.drawRectangle({ x: mLeft, y: y - 3, width: contentW, height: 14, color: rgb(0.94, 0.95, 0.93) });
            page.drawText(label, { x: mLeft + 4, y: y + 1, size: 7.5, font: fSemi, color: olive });
            y -= 16;

            for (const item of items) {
                if (y < 80) break;
                const planned = Number(item.planned_amount || 0);
                const { share, keyName } = calcShare(item, apt.id);
                sectionTotal += planned;
                sectionShare += share;

                // Zebra
                if (ri % 2 === 1) {
                    page.drawRectangle({ x: mLeft, y: y - 4, width: contentW, height: costRowH, color: rgb(0.976, 0.98, 0.973) });
                }

                page.drawText(item.account?.account_number || '–', { x: cKonto, y, size: 7.5, font: fReg, color: gray40 });
                page.drawText((item.account?.account_name || '–').substring(0, 30), { x: cBez, y, size: 7.5, font: fReg, color: offblack });
                page.drawText(keyName.substring(0, 22), { x: cKey, y, size: 7, font: fReg, color: gray50 });
                drawR(page, eur(planned), cGesamt, y, 7.5, fReg, gray40);

                const shareFont  = share > 0 ? fSemi : fReg;
                const shareColor = share > 0 ? offblack : rgb(0.6, 0.6, 0.6);
                drawR(page, eur(share), cAnteil, y, 7.5, shareFont, shareColor);

                page.drawLine({ start: { x: mLeft, y: y - 4 }, end: { x: mRight, y: y - 4 }, thickness: 0.3, color: rgb(0.88, 0.89, 0.86) });
                y -= costRowH;
                ri++;
            }

            // Subtotal
            page.drawRectangle({ x: mLeft, y: y - 3, width: contentW, height: 14, color: rgb(0.94, 0.95, 0.93) });
            page.drawText(`Zwischensumme ${label}`, { x: mLeft + 4, y: y + 1, size: 7.5, font: fSemi, color: offblack });
            drawR(page, eur(sectionTotal), cGesamt, y + 1, 7.5, fSemi, gray40);
            drawR(page, eur(sectionShare), cAnteil, y + 1, 7.5, fBold, olive);
            y -= 16;

            return { y, ri, total: sectionTotal, share: sectionShare };
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

        // Grand total row
        page.drawRectangle({ x: mLeft, y: y - 4, width: contentW, height: 18, color: olive });
        page.drawText('Gesamt Jahres-Hausgeld', { x: mLeft + 4, y: y, size: 8, font: fBold, color: white });
        drawR(page, eur(grandTotal) + ' €', cGesamt, y, 8, fBold, white);
        drawR(page, eur(grandShare) + ' €', cAnteil, y, 8, fBold, white);
        y -= 24;

        // ── BLOCK 5: RECHTLICHER HINWEIS ────────────────────────
        const hintText = 'Dieser Wirtschaftsplan wurde maschinell erstellt und ist rechtlich bindend nach Beschlussfassung der WEG-Gemeinschaft. Die aus dem Wirtschaftsplan resultierenden monatlichen Hausgelder sind über den Planungszeitraum hinaus weiter zu zahlen, bis ein neuer Wirtschaftsplan beschlossen wurde.';
        const hintPad = 10;
        const hintFS  = 8;
        const hintMaxW = contentW - hintPad * 2;
        const hintLines = _pdfSplitText(hintText, fReg, hintFS, hintMaxW);
        const hintLineH = 12;
        const hintBoxH  = hintPad * 2 + hintLines.length * hintLineH;

        // Ensure hint box fits on page
        const hintTopY = Math.max(y, hintBoxH + 30);

        page.drawRectangle({
            x: mLeft, y: hintTopY - hintBoxH,
            width: contentW, height: hintBoxH,
            borderColor: orange, borderWidth: 1,
            color: rgb(0.992, 0.965, 0.945),
        });
        hintLines.forEach((line, i) => {
            page.drawText(line, {
                x: mLeft + hintPad,
                y: hintTopY - hintPad - (i * hintLineH),
                size: hintFS, font: fReg, color: offblack,
            });
        });
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `Einzelwirtschaftsplaene_${plan.fiscal_year}_${bldName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    _pdfDownload(pdfBytes, filename);
    showToast(`${apts.length} Einzelwirtschaftspläne als PDF heruntergeladen.`);
}
