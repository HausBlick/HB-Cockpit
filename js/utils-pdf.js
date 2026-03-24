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
