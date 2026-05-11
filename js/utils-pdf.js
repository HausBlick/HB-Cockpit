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

async function _pdfSplitAndUpload(combinedBytes, pageRanges, buildingId, fiscalYear, docType) {
    const { PDFDocument } = PDFLib;
    const label = docType === 'wp' ? 'Wirtschaftsplan' : 'Jahresabrechnung';
    const labelPlural = docType === 'wp' ? 'Wirtschaftspläne' : 'Jahresabrechnungen';
    const category = docType === 'wp' ? 'Wirtschaftsplan' : 'Jahresabrechnung';
    let uploaded = 0;
    for (const range of pageRanges) {
        try {
            const srcDoc   = await PDFDocument.load(combinedBytes);
            const indivDoc = await PDFDocument.create();
            const indices  = [];
            for (let i = range.start; i <= range.end; i++) indices.push(i);
            const copied = await indivDoc.copyPages(srcDoc, indices);
            copied.forEach(p => indivDoc.addPage(p));
            const bytes = await indivDoc.save();
            const path  = `etv-staging/${buildingId}/${fiscalYear}/${docType}/${range.aptId}.pdf`;
            const { error } = await _supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
            if (error) { console.error('Storage-Upload Fehler WE', range.aptId, error); continue; }
            uploaded++;

            // DB-Eintrag: Dokument mit status=draft + metadata für spätere Freigabe
            const filename = `${label}_${fiscalYear}_WE${range.aptId}.pdf`;
            const docRow = {
                building_id:        buildingId,
                apartment_id:       range.aptId,
                title:              `${label} ${fiscalYear}`,
                document_title:     `${label} ${fiscalYear}`,
                original_filename:  filename,
                generated_filename: filename,
                file_path:          path,
                file_type:          'application/pdf',
                file_size:          bytes.byteLength,
                category:           category,
                year:               fiscalYear,
                visibility_scope:   'unit',
                status:             'draft',
                metadata:           { doc_type: docType, fiscal_year: fiscalYear, unit_id: range.aptId },
                uploaded_by:        (typeof currentUser !== 'undefined' && currentUser?.id) || null,
                updated_at:         new Date().toISOString(),
            };
            // Vorhandenes Dokument mit gleichem Pfad aktualisieren oder neu anlegen
            const { data: existing } = await _supabase.from('documents').select('id').eq('file_path', path).maybeSingle();
            if (existing) {
                await _supabase.from('documents').update(docRow).eq('id', existing.id);
            } else {
                await _supabase.from('documents').insert(docRow);
            }
        } catch(e) { console.error('ETV-Upload Fehler WE', range.aptId, e); }
    }
    showToast(`${uploaded} von ${pageRanges.length} ${labelPlural} als Entwurf gespeichert.`, uploaded === pageRanges.length ? 'success' : 'warning');
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
    // Zeilenumbrüche respektieren — jede Zeile separat umbrechen
    const paragraphs = String(text).split('\n');
    const allLines = [];
    for (const para of paragraphs) {
        if (para.trim() === '') { allLines.push(''); continue; }
        const words = para.split(' ');
        let current = '';
        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
                allLines.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) allLines.push(current);
    }
    return allLines;
}

// ─── Template-Engine: Platzhalter-Parser ─────────────────────
// Ersetzt {{variable_name}} im Text durch Werte aus dem data-Objekt.
// Unbekannte Platzhalter bleiben stehen (für Preview mit Dummy-Daten sichtbar).
function _pdfReplacePlaceholders(text, data) {
    if (!text || typeof text !== 'string') return text || '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data.hasOwnProperty(key) ? (data[key] ?? '') : match;
    });
}

// ─── Template-Engine: Block-Renderer ─────────────────────────
// Rendert ein Array von JSON-Blöcken auf ein pdf-lib Dokument.
// Unterstützte Blocktypen: heading, text, table, spacer, page_break, hint_box
//
// Parameter:
//   blocks  — Array von {type, ...props}
//   data    — Objekt mit Platzhalter-Werten (z.B. {anrede: 'Sehr geehrter Herr Müller,'})
//   tables  — Objekt mit Tabellendaten, key = source-Name → Array von Row-Objekten
//   options — {pdfDoc, page, fonts:{reg,semi,bold}, settings, useLetterhead, templateDoc}
//
// Gibt {pdfDoc, pdfBytes} zurück.
async function generateFromTemplate(blocks, data, tables, options) {
    const { PDFDocument, rgb } = PDFLib;
    const { pdfDoc, fonts, settings } = options;
    let { page } = options;
    const templateDoc = options.templateDoc || null;

    // Colors
    const olive    = rgb(0.408, 0.455, 0.318);
    const offblack = rgb(0.216, 0.216, 0.216);
    const orange   = rgb(0.922, 0.463, 0.176);
    const gray50   = rgb(0.5, 0.5, 0.5);
    const gray40   = rgb(0.4, 0.4, 0.4);
    const white    = rgb(1, 1, 1);

    const colorMap = {
        olive: olive, offblack: offblack, orange: orange,
        gray: gray50, gray50: gray50, gray40: gray40, white: white,
    };
    function resolveColor(c) {
        if (!c) return offblack;
        if (colorMap[c]) return colorMap[c];
        return offblack;
    }

    // Page layout
    const mLeft    = 56.7;
    const mRight   = 538.6;
    const contentW = mRight - mLeft; // 482pt
    const bottomMargin = 100; // Platz für Briefbogen-Fußzeile

    const { width, height } = page.getSize();
    const fReg  = fonts.reg;
    const fSemi = fonts.semi || fonts.reg;
    const fBold = fonts.bold;

    // Start-Y: nach Adressfeld + Datum (DIN 5008)
    let y = options.startY || (height - 200);

    // Helper: neue Seite anlegen (mit Briefbogen-Kopie wenn vorhanden)
    async function addPage() {
        if (templateDoc) {
            const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
            page = pdfDoc.addPage(copied);
        } else {
            page = pdfDoc.addPage([width, height]);
        }
        y = height - 80; // Kompakter Start auf Folgeseiten
        return page;
    }

    // Helper: Seitenumbruch wenn nicht genug Platz
    async function ensureSpace(needed) {
        if (y - needed < bottomMargin) {
            await addPage();
        }
    }

    // Helper: right-align text
    function drawR(text, xRight, yPos, size, font, color) {
        const w = font.widthOfTextAtSize(text, size);
        page.drawText(text, { x: xRight - w, y: yPos, size, font, color });
    }

    // Helper: Euro formatting (Number.EPSILON prevents floating-point display errors)
    function fmtEur(v) {
        const n = Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
        return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    // ── Block-Iteration ──────────────────────────────────────
    for (const block of blocks) {
        switch (block.type) {

        case 'heading': {
            const text = _pdfReplacePlaceholders(block.text || '', data);
            const size = block.size || 13;
            const font = block.bold !== false ? fBold : fReg;
            const color = resolveColor(block.color);
            const lineH = size + 4;
            const lines = _pdfSplitText(text, font, size, contentW);
            // Ensure heading + at least ~60pt for following content (prevents orphaned headings)
            await ensureSpace(lines.length * lineH + 60);
            for (const line of lines) {
                page.drawText(line, { x: mLeft, y, size, font, color });
                y -= lineH;
            }
            y -= (block.gap != null ? block.gap : 0);
            break;
        }

        case 'text': {
            const text = _pdfReplacePlaceholders(block.text || '', data);
            const size = block.size || 10;
            const font = block.bold ? fBold : fReg;
            const color = resolveColor(block.color);
            const lineH = size + 4;
            const lines = _pdfSplitText(text, font, size, contentW);
            for (const line of lines) {
                if (line === '') { y -= lineH * 0.5; continue; } // Leerzeile = halber Abstand
                if (y - lineH < bottomMargin) { await addPage(); }
                page.drawText(line, { x: mLeft, y, size, font, color });
                y -= lineH;
            }
            break;
        }

        case 'spacer': {
            const h = block.height || 10;
            y -= h;
            break;
        }

        case 'page_break': {
            await addPage();
            break;
        }

        case 'hint_box': {
            const text = _pdfReplacePlaceholders(block.text || '', data);
            const pad = 10;
            const fontSize = block.size || 8;
            const titleSize = block.title_size || fontSize;
            const maxW = contentW - pad * 2;

            // Strip ** markers for line-break calculation, render with bold segments later
            const plainText = text.replace(/\*\*/g, '');
            const lines = _pdfSplitText(plainText, fReg, fontSize, maxW);
            const lineH = fontSize + 3;
            const titleLineH = titleSize + 3;
            const titleH = block.title ? titleLineH : 0;
            const boxH = pad * 2 + titleH + lines.length * lineH;
            await ensureSpace(boxH + 10);

            page.drawRectangle({
                x: mLeft, y: y - boxH,
                width: contentW, height: boxH,
                borderColor: orange, borderWidth: 1.5,
                color: rgb(1, 0.975, 0.965),
            });

            // Helper: draw a line with **bold** inline segments
            function _drawBoldLine(lineText, lx, ly, sz, defaultFont, boldFont, clr) {
                const parts = lineText.split(/(\*\*.*?\*\*)/);
                let cx = lx;
                for (const part of parts) {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        const t = part.slice(2, -2);
                        page.drawText(t, { x: cx, y: ly, size: sz, font: boldFont, color: clr });
                        cx += boldFont.widthOfTextAtSize(t, sz);
                    } else if (part) {
                        page.drawText(part, { x: cx, y: ly, size: sz, font: defaultFont, color: clr });
                        cx += defaultFont.widthOfTextAtSize(part, sz);
                    }
                }
            }

            // Map plain-text lines back to original text with ** markers
            // Rebuild lines from original text preserving ** markers
            let remaining = text;
            const richLines = lines.map(plain => {
                // Find this plain line's content in the remaining original text
                let consumed = '';
                let pi = 0; // pointer into plain text
                let ri = 0; // pointer into remaining
                while (pi < plain.length && ri < remaining.length) {
                    if (remaining[ri] === '*' && remaining[ri + 1] === '*') {
                        consumed += '**';
                        ri += 2;
                    } else {
                        consumed += remaining[ri];
                        pi++;
                        ri++;
                    }
                }
                // Capture trailing ** at end of segment
                while (ri < remaining.length && remaining[ri] === '*' && remaining[ri + 1] === '*') {
                    consumed += '**';
                    ri += 2;
                }
                // Skip whitespace between lines
                if (remaining[ri] === ' ') ri++;
                remaining = remaining.slice(ri);
                return consumed;
            });

            const xPad = mLeft + pad;
            if (block.title) {
                const titleText = _pdfReplacePlaceholders(block.title, data);
                _drawBoldLine(titleText, xPad, y - pad - 2, titleSize, fBold, fBold, orange);
                richLines.forEach((line, i) => {
                    _drawBoldLine(line, xPad, y - pad - titleLineH - (i * lineH), fontSize, fReg, fBold, offblack);
                });
            } else {
                richLines.forEach((line, i) => {
                    _drawBoldLine(line, xPad, y - pad - (i * lineH), fontSize, fReg, fBold, offblack);
                });
            }
            y -= boxH + 5;
            break;
        }

        case 'info_box': {
            // Grüne Info-Box mit zentriertem Text (z.B. Termin/Ort)
            const pad = block.padding || 14;
            const fontSize = block.size || 10;
            const lineH = fontSize + 5;
            const font = block.bold !== false ? fBold : fReg;
            const color = resolveColor(block.color || 'offblack');
            // Hintergrund: helles Olive (ultralight-Grün) mit Olive-Border
            const bgColor = rgb(0.965, 0.973, 0.953);    // #F7F8F3
            const borderClr = rgb(0.408, 0.455, 0.318);   // hb-olive

            // Zeilen berechnen
            const rawLines = (block.lines || [block.text || '']).map(l => _pdfReplacePlaceholders(l, data));
            // Jede Zeile kann Umbrüche erfordern
            const allLines = [];
            for (const raw of rawLines) {
                const split = _pdfSplitText(raw, font, fontSize, contentW - pad * 2);
                allLines.push(...split);
            }
            const boxH = pad * 2 + allLines.length * lineH;
            await ensureSpace(boxH + 10);

            page.drawRectangle({
                x: mLeft, y: y - boxH,
                width: contentW, height: boxH,
                color: bgColor, borderColor: borderClr, borderWidth: 1,
            });

            for (let i = 0; i < allLines.length; i++) {
                const ly = y - pad - (i * lineH) - fontSize;
                if (block.align === 'center') {
                    const tw = font.widthOfTextAtSize(allLines[i], fontSize);
                    page.drawText(allLines[i], { x: mLeft + (contentW - tw) / 2, y: ly, size: fontSize, font, color });
                } else {
                    page.drawText(allLines[i], { x: mLeft + pad, y: ly, size: fontSize, font, color });
                }
            }
            y -= boxH + 5;
            break;
        }

        case 'table': {
            const source = block.source || '';
            const rows = (tables && tables[source]) || [];
            const cols = block.columns || [];
            if (!cols.length) break;

            const showHeader = block.show_header !== false;
            const highlightLast = block.highlight_last === true;
            const rowH = 20;
            const headerH = showHeader ? 22 : 0;

            // Helper: draw table header (olive bar with white labels)
            function _drawTableHeader() {
                page.drawRectangle({ x: mLeft, y: y - headerH, width: contentW, height: headerH, color: olive });
                const hY = y - headerH + 6;
                let colX = mLeft;
                for (const col of cols) {
                    const colW = contentW * (col.width || 0.25);
                    if (col.align === 'right') {
                        drawR(col.label || '', colX + colW - 6, hY, 9, fBold, white);
                    } else {
                        page.drawText(col.label || '', { x: colX + 6, y: hY, size: 9, font: fBold, color: white });
                    }
                    colX += colW;
                }
                y -= headerH;
            }

            // Ensure space for header + at least 1 row (start table on current page)
            await ensureSpace(headerH + rowH + 10);

            // Draw initial header
            if (showHeader) _drawTableHeader();

            // Rows — with per-row pagination
            for (let ri = 0; ri < rows.length; ri++) {
                const row = rows[ri];
                const isLast = ri === rows.length - 1;
                const isHighlighted = highlightLast && isLast;
                const neededH = rowH + (isHighlighted ? 4 : 0);

                // Page break before row if needed — re-draw header on new page
                if (y - neededH < bottomMargin) {
                    await addPage();
                    if (showHeader) _drawTableHeader();
                }

                // Separator
                page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

                if (isHighlighted) {
                    // Olive background for total row
                    page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 1, color: olive });
                    page.drawRectangle({ x: mLeft, y: y - rowH - 4, width: contentW, height: rowH + 4, color: rgb(0.969, 0.973, 0.961) });
                }

                const rY = y - rowH + 6;
                let colX = mLeft;
                for (const col of cols) {
                    const colW = contentW * (col.width || 0.25);
                    let val = row[col.key] ?? '';
                    if (col.format === 'eur' && typeof val === 'number') val = fmtEur(val);
                    const f = isHighlighted ? fBold : fReg;
                    const sz = isHighlighted ? 10 : 9;
                    const c = isHighlighted ? (col.align === 'right' ? olive : offblack) : offblack;

                    if (col.align === 'right') {
                        drawR(String(val), colX + colW - 6, rY, sz, f, c);
                    } else {
                        page.drawText(String(val), { x: colX + 6, y: rY, size: sz, font: f, color: c });
                    }
                    colX += colW;
                }
                y -= neededH;
            }

            // Bottom divider
            if (rows.length && !highlightLast) {
                page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
            }
            break;
        }

        case 'anlagen_list': {
            // Kompakte Anlagenliste (automatisch aus angehängten Dokumenten)
            const anlagen = (tables && tables['anlagen']) || [];
            if (!anlagen.length) break;
            const fontSize = block.size || 9;
            const font = block.bold ? fBold : fReg;
            const color = resolveColor(block.color || 'gray');
            const lineH = fontSize + 4;
            const titleText = _pdfReplacePlaceholders(block.title || '', data);

            if (titleText) {
                await ensureSpace(lineH * 2 + 10);
                page.drawText(titleText, { x: mLeft, y, size: block.title_size || fontSize, font: fBold, color: resolveColor(block.title_color || 'gray') });
                y -= (block.title_size || fontSize) + 5;
            }

            for (const item of anlagen) {
                const line = `–  ${item.name}`;
                const lines = _pdfSplitText(line, font, fontSize, contentW - 10);
                if (y - lines.length * lineH < bottomMargin) { await addPage(); }
                for (const l of lines) {
                    page.drawText(l, { x: mLeft + 8, y, size: fontSize, font, color });
                    y -= lineH;
                }
            }
            break;
        }

        case 'agenda_list': {
            // Kompakte Tagesordnungs-Liste (nur TOP-Nummern + Titel)
            const items = (tables && tables['tagesordnung']) || [];
            if (!items.length) break;
            const fontSize = block.size || 9.5;
            const font = block.bold ? fBold : fReg;
            const color = resolveColor(block.color);
            const lineH = fontSize + 4;
            const titleText = _pdfReplacePlaceholders(block.title || '', data);

            // Titel (z.B. "Tagesordnung:")
            if (titleText) {
                await ensureSpace(lineH * 2 + 10);
                page.drawText(titleText, { x: mLeft, y, size: block.title_size || fontSize + 1, font: fBold, color: resolveColor(block.title_color || 'offblack') });
                y -= (block.title_size || fontSize + 1) + 6;
            }

            for (const item of items) {
                const prefix = `TOP ${item.nr}: `;
                const prefixW = font.widthOfTextAtSize(prefix, fontSize);
                const titleLines = _pdfSplitText(item.titel, font, fontSize, contentW - prefixW);

                const itemH = titleLines.length * lineH;
                if (y - itemH < bottomMargin) { await addPage(); }

                // Erste Zeile mit "TOP X:" Prefix
                page.drawText(prefix, { x: mLeft, y, size: fontSize, font: fBold, color });
                page.drawText(titleLines[0], { x: mLeft + prefixW, y, size: fontSize, font, color });
                y -= lineH;

                // Folgezeilen (eingerückt)
                for (let li = 1; li < titleLines.length; li++) {
                    if (y < bottomMargin) { await addPage(); }
                    page.drawText(titleLines[li], { x: mLeft + prefixW, y, size: fontSize, font, color });
                    y -= lineH;
                }
            }
            break;
        }

        default:
            console.warn('Unbekannter Template-Block-Typ:', block.type);
        }
    }

    return { pdfDoc, page, y };
}

// ─── Template aus DB laden (cached pro Session) ──────────────
const _templateCache = {};
async function _pdfLoadTemplate(type) {
    if (_templateCache[type]) return _templateCache[type];
    const { data, error } = await _supabase
        .from('pdf_templates').select('*').eq('type', type).single();
    if (error || !data) return null;
    _templateCache[type] = data;
    return data;
}

// Cache invalidieren (z.B. nach Speichern im Designer)
function _pdfClearTemplateCache(type) {
    if (type) delete _templateCache[type];
    else Object.keys(_templateCache).forEach(k => delete _templateCache[k]);
}

// ─── Dummy-Daten für Live-Preview im Designer ───────────────
const PDF_PREVIEW_DUMMY_DATA = {
    mahnung: {
        placeholders: {
            mahnstufe: 'Zahlungserinnerung',
            anrede: 'Sehr geehrter Herr Mustermann,',
            einheit_nr: 'WE-01',
            weg_name: 'WEG Musterstraße 12',
            gesamtbetrag: '1.250,00 €',
            firma: 'HausBlick Verwaltungs GmbH',
            geschaeftsfuehrer: 'Max Mustermann',
            empfaenger_name: 'Hans Mustermann',
            empfaenger_strasse: 'Beispielweg 5',
            empfaenger_plz_ort: '12345 Berlin',
        },
        tables: {
            offene_posten: [
                { bezeichnung: 'Hausgeld WE-01 Januar 2026', faelligkeit: '01.01.2026', betrag: 350.00 },
                { bezeichnung: 'Hausgeld WE-01 Februar 2026', faelligkeit: '01.02.2026', betrag: 350.00 },
                { bezeichnung: 'Hausgeld WE-01 März 2026', faelligkeit: '01.03.2026', betrag: 350.00 },
            ],
            zusammenfassung: [
                { label: 'Zwischensumme', betrag: 1050.00 },
                { label: 'Mahngebühr', betrag: 5.00 },
                { label: 'Verzugszinsen (3,37 %)', betrag: 12.50 },
                { label: 'Gesamtbetrag', betrag: 1067.50 },
            ],
        },
    },
    einzelwirtschaftsplan: {
        placeholders: {
            plan_jahr: '2026',
            einheit_nummer: 'WE-01',
            eigentuemer_name: 'Hans Mustermann',
            eigentuemer_adresse: 'Beispielweg 5, 12345 Berlin',
            hausgeld_monat: '285,00 €',
            hausgeld_jahr: '3.420,00 €',
            weg_name: 'WEG Musterstraße 12',
            objekt_adresse: 'Musterstraße 12, 88045 Friedrichshafen',
            planzeitraum: '01.01.2026 – 31.12.2026',
            verwalter_firma: 'HausBlick Verwaltungs GmbH',
            verwalter_adresse: 'Verwaltungsweg 1, 88045 Friedrichshafen',
            verwalter_steuernr: 'St.-Nr. 12/345/67890',
            mea: '85,50',
            flaeche: '72,5 m²',
            datum: '02.04.2026',
            gesamt_hausgeld_jahr: '36.000,00 €',
            gesamt_hausgeld_monat: '3.000,00 €',
        },
        tables: {
            hausgeld_summary: [
                { label: 'Jahres-Hausgeld', gesamt: 36000.00, anteil: 3420.00 },
                { label: 'Monatliches Hausgeld', gesamt: 3000.00, anteil: 285.00 },
            ],
            umlageschluessel: [
                { nr: '1', name: 'MEA (Miteigentumsanteile)', typ: 'MEA', zeitraum: '01.01.–31.12.2026', tage: '365', gesamt: '1.000,0000', anteil: '85,5000' },
                { nr: '2', name: 'Wohnfläche (m²)', typ: 'Fläche (m²)', zeitraum: '01.01.–31.12.2026', tage: '365', gesamt: '850,00', anteil: '72,50' },
                { nr: '3', name: 'Einheiten', typ: 'Einheiten', zeitraum: '01.01.–31.12.2026', tage: '365', gesamt: '12,00', anteil: '1,00' },
            ],
            verteilung: [
                { konto: '4100', bezeichnung: 'Allgemeinstrom', schluessel: 'MEA', gesamt: 2400.00, anteil: 205.20 },
                { konto: '4110', bezeichnung: 'Wasser / Abwasser', schluessel: 'Wohnfläche (m²)', gesamt: 3600.00, anteil: 306.88 },
                { konto: '4120', bezeichnung: 'Müllabfuhr', schluessel: 'Einheiten', gesamt: 1800.00, anteil: 150.00 },
                { konto: '4130', bezeichnung: 'Gebäudeversicherung', schluessel: 'MEA', gesamt: 4200.00, anteil: 359.10 },
                { konto: '4200', bezeichnung: 'Erhaltungsrücklage', schluessel: 'MEA', gesamt: 24000.00, anteil: 2052.00 },
                { konto: '', bezeichnung: 'Gesamt Jahres-Hausgeld', schluessel: '', gesamt: 36000.00, anteil: 3420.00 },
            ],
        },
    },
    jahresabrechnung: {
        placeholders: {
            abrechnungs_jahr: '2025',
            abrechnungs_zeitraum: '01.01.2025 – 31.12.2025',
            einheit_nummer: 'WE-01',
            eigentuemer_name: 'Hans Mustermann',
            eigentuemer_adresse: 'Beispielweg 5, 12345 Berlin',
            anrede: 'Sehr geehrter Herr Mustermann,',
            weg_name: 'WEG Musterstraße 12',
            objekt_adresse: 'Musterstraße 12, 88045 Friedrichshafen',
            verwalter_firma: 'HausBlick Verwaltungs GmbH',
            verwalter_adresse: 'Verwaltungsweg 1, 88045 Friedrichshafen',
            mea: '85,50',
            flaeche: '72,5 m²',
            datum: '02.04.2026',
            firma: 'HausBlick Verwaltungs GmbH',
            geschaeftsfuehrer: 'Max Mustermann',
            empfaenger_name: 'Hans Mustermann',
            empfaenger_strasse: 'Beispielweg 5',
            empfaenger_plz_ort: '12345 Berlin',
            ist_kosten_anteil: '3.180,50 €',
            voraus_zahlungen: '3.420,00 €',
            abrechnungs_saldo: '239,50 €',
            saldo_label: 'Guthaben',
            saldo_info: 'Aus der Abrechnung ergibt sich ein Guthaben zu Ihren Gunsten.',
            bgh_hinweis: 'Zur Beschlussfassung steht ausschließlich die Abrechnungsspitze. Etwaige Zahlungsrückstände basieren auf dem Wirtschaftsplan des Vorjahres. Der Abrechnungssaldo dient lediglich der Information. (BGH-Urteil v. 09.03.2012 V ZR 147/11)',
        },
        tables: {
            abrechnungsergebnis: [
                { label: 'Gesamtkosten', gesamt: 33500.00, anteil: 3180.50 },
                { label: '– HG-Vorschuss Soll', gesamt: 36000.00, anteil: 3420.00 },
                { label: '= Abrechnungsspitze (Überdeckung)', gesamt: -2500.00, anteil: -239.50 },
                { label: 'HG-Vorschuss Soll', gesamt: 36000.00, anteil: 3420.00 },
                { label: '– HG-Vorschuss Ist', gesamt: 36000.00, anteil: 3420.00 },
                { label: '= Zahlungsdifferenz (Planerfüllung)', gesamt: 0.00, anteil: 0.00 },
                { label: 'Abrechnungssaldo: Guthaben', gesamt: '', anteil: 239.50 },
            ],
            jab_monats_matrix: [
                { monat: 'Jan 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Feb 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Mär 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Apr 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Mai 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Jun 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Jul 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Aug 2025', soll: 285.00, ist: 0.00, differenz: -285.00 },
                { monat: 'Sep 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Okt 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Nov 2025', soll: 285.00, ist: 570.00, differenz: 285.00 },
                { monat: 'Dez 2025', soll: 285.00, ist: 285.00, differenz: 0.00 },
                { monat: 'Gesamt', soll: 3420.00, ist: 3420.00, differenz: 0.00 },
            ],
            umlageschluessel: [
                { nr: '1', name: 'MEA (Miteigentumsanteile)', typ: 'MEA', zeitraum: '01.01.–31.12.2025', tage: '365', gesamt: '1.000,0000', anteil: '85,5000' },
                { nr: '2', name: 'Wohnfläche (m²)', typ: 'Fläche (m²)', zeitraum: '01.01.–31.12.2025', tage: '365', gesamt: '850,00', anteil: '72,50' },
            ],
            verteilung: [
                { konto: '4100', bezeichnung: 'Allgemeinstrom', schluessel: 'MEA', gesamt: 2280.00, anteil: 194.94 },
                { konto: '4110', bezeichnung: 'Wasser / Abwasser', schluessel: 'Wohnfläche (m²)', gesamt: 3450.00, anteil: 294.18 },
                { konto: '4120', bezeichnung: 'Müllabfuhr', schluessel: 'Einheiten', gesamt: 1740.00, anteil: 145.00 },
                { konto: '4130', bezeichnung: 'Gebäudeversicherung', schluessel: 'MEA', gesamt: 4080.00, anteil: 348.84 },
                { konto: '4200', bezeichnung: 'Erhaltungsrücklage', schluessel: 'MEA', gesamt: 21950.00, anteil: 1876.73 },
                { konto: '', bezeichnung: 'Gesamt Ist-Kosten', schluessel: '', gesamt: 33500.00, anteil: 3180.50 },
            ],
            vermoegen_konten: [
                { konto: '1200', bezeichnung: 'Hausgeldkonto (Sparkasse)', saldo: 12450.80, status: 'Geprüft ✓' },
                { konto: '1210', bezeichnung: 'Rücklagenkonto (Tagesgeld)', saldo: 45000.00, status: 'Geprüft ✓' },
            ],
            vermoegen_forderungen: [
                { einheit: 'WE-03', eigentuemer: 'Fritz Beispiel', betrag: 570.00, typ: 'Hausgeldrückstand' },
                { einheit: 'WE-07', eigentuemer: 'Anna Test', betrag: 285.00, typ: 'Hausgeldrückstand' },
                { einheit: '', eigentuemer: 'Gesamt offene Forderungen', betrag: 855.00, typ: '' },
            ],
        },
    },
    etv_einladung: {
        placeholders: {
            anrede: 'geehrter Herr',
            nachname: 'Mustermann',
            vorname: 'Hans',
            gebaeude_name: 'WEG Musterstraße 12',
            gebaeude_adresse: 'Musterstraße 12, 12345 Berlin',
            datum: '15.06.2026',
            uhrzeit: '18:00',
            ort: 'Gemeinschaftsraum, Musterstraße 12',
            wirtschaftsjahr: '2025',
            einheit: 'WE-01',
            firma: 'HausBlick Verwaltungs GmbH',
            empfaenger_name: 'Hans Mustermann',
            empfaenger_strasse: 'Beispielweg 5',
            empfaenger_plz_ort: '12345 Berlin',
        },
        tables: {
            anlagen: [
                { name: 'Einzelwirtschaftsplan 2025' },
                { name: 'Jahresabrechnung 2025' },
                { name: 'Kostenvoranschlag_Dachsanierung.pdf' },
            ],
            tagesordnung: [
                { nr: '1', titel: 'Bericht der Verwaltung' },
                { nr: '2', titel: 'Abrechnung 2024' },
                { nr: '3', titel: 'Entlastungsbeschluss HV 2024' },
                { nr: '4', titel: 'Entlastungsbeschluss Beiräte 2024' },
                { nr: '5', titel: 'Verwalterbestellung (Wiederbestellung) vom 01.01.2026 bis zum 31.12.2027' },
                { nr: '6', titel: 'Plan Vorschuss und Plan Erhaltungsrücklage 2026' },
                { nr: '7', titel: 'Finanzierung von Instandhaltungsmaßnahmen' },
                { nr: '7.1', titel: 'Dachreparatur um Bereich Wohnung 45/46' },
                { nr: '7.2', titel: 'Befestigung Steine im Laubengang' },
                { nr: '8', titel: 'Verschiedenes' },
            ],
        },
    },
};

// ─── Verfügbare Platzhalter pro Template-Typ ─────────────────
const PDF_TEMPLATE_VARIABLES = {
    mahnung: [
        { key: 'mahnstufe', label: 'Mahnstufe (z.B. Zahlungserinnerung)' },
        { key: 'anrede', label: 'Anrede (Sehr geehrte/r...)' },
        { key: 'einheit_nr', label: 'Einheitennummer' },
        { key: 'weg_name', label: 'WEG-Name' },
        { key: 'gesamtbetrag', label: 'Gesamtbetrag (formatiert)' },
        { key: 'firma', label: 'Firmenname' },
        { key: 'geschaeftsfuehrer', label: 'Geschäftsführer' },
        { key: 'empfaenger_name', label: 'Empfänger Name' },
        { key: 'empfaenger_strasse', label: 'Empfänger Straße' },
        { key: 'empfaenger_plz_ort', label: 'Empfänger PLZ Ort' },
    ],
    einzelwirtschaftsplan: [
        { key: 'plan_jahr', label: 'Planjahr (z.B. 2026)' },
        { key: 'einheit_nummer', label: 'Einheitennummer (z.B. WE-01)' },
        { key: 'eigentuemer_name', label: 'Eigentümer Name' },
        { key: 'eigentuemer_adresse', label: 'Eigentümer Adresse' },
        { key: 'hausgeld_monat', label: 'Monatliches Hausgeld (Anteil)' },
        { key: 'hausgeld_jahr', label: 'Jahres-Hausgeld (Anteil)' },
        { key: 'weg_name', label: 'WEG-Name' },
        { key: 'objekt_adresse', label: 'Objekt-Adresse' },
        { key: 'planzeitraum', label: 'Planzeitraum' },
        { key: 'verwalter_firma', label: 'Verwalter Firma' },
        { key: 'verwalter_adresse', label: 'Verwalter Adresse' },
        { key: 'verwalter_steuernr', label: 'Verwalter Steuernummer' },
        { key: 'mea', label: 'MEA der Einheit' },
        { key: 'flaeche', label: 'Fläche der Einheit' },
        { key: 'datum', label: 'Erstellungsdatum' },
        { key: 'gesamt_hausgeld_jahr', label: 'Gesamtes Jahres-Hausgeld (Objekt)' },
        { key: 'gesamt_hausgeld_monat', label: 'Gesamtes Monats-Hausgeld (Objekt)' },
    ],
    jahresabrechnung: [
        { key: 'abrechnungs_jahr', label: 'Abrechnungsjahr (z.B. 2025)' },
        { key: 'abrechnungs_zeitraum', label: 'Abrechnungszeitraum' },
        { key: 'einheit_nummer', label: 'Einheitennummer (z.B. WE-01)' },
        { key: 'eigentuemer_name', label: 'Eigentümer Name' },
        { key: 'eigentuemer_adresse', label: 'Eigentümer Adresse' },
        { key: 'anrede', label: 'Anrede (Sehr geehrte/r...)' },
        { key: 'weg_name', label: 'WEG-Name' },
        { key: 'objekt_adresse', label: 'Objekt-Adresse' },
        { key: 'verwalter_firma', label: 'Verwalter Firma' },
        { key: 'verwalter_adresse', label: 'Verwalter Adresse' },
        { key: 'mea', label: 'MEA der Einheit' },
        { key: 'flaeche', label: 'Fläche der Einheit' },
        { key: 'datum', label: 'Erstellungsdatum' },
        { key: 'firma', label: 'Firmenname' },
        { key: 'geschaeftsfuehrer', label: 'Geschäftsführer' },
        { key: 'empfaenger_name', label: 'Empfänger Name' },
        { key: 'empfaenger_strasse', label: 'Empfänger Straße' },
        { key: 'empfaenger_plz_ort', label: 'Empfänger PLZ Ort' },
        { key: 'ist_kosten_anteil', label: 'Ist-Kosten Anteil (formatiert)' },
        { key: 'voraus_zahlungen', label: 'Voraus-Zahlungen (formatiert)' },
        { key: 'abrechnungs_saldo', label: 'Abrechnungssaldo (formatiert, absolut)' },
        { key: 'saldo_label', label: 'Saldo-Label (Guthaben/Nachzahlung/Ausgeglichen)' },
        { key: 'saldo_info', label: 'Saldo-Info-Satz (ergibt sich ein...)' },
        { key: 'bgh_hinweis', label: 'BGH-Hinweis (rechtlicher Hinweis)' },
    ],
    etv_einladung: [
        { key: 'anrede', label: 'Anrede (geehrter Herr / geehrte Frau)' },
        { key: 'nachname', label: 'Nachname' },
        { key: 'vorname', label: 'Vorname' },
        { key: 'gebaeude_name', label: 'Gebäude-Name' },
        { key: 'gebaeude_adresse', label: 'Gebäude-Adresse' },
        { key: 'datum', label: 'Versammlungsdatum' },
        { key: 'uhrzeit', label: 'Uhrzeit' },
        { key: 'ort', label: 'Versammlungsort' },
        { key: 'wirtschaftsjahr', label: 'Wirtschaftsjahr' },
        { key: 'einheit', label: 'Einheitennummer' },
        { key: 'firma', label: 'Firmenname' },
        { key: 'empfaenger_name', label: 'Empfänger Name' },
        { key: 'empfaenger_strasse', label: 'Empfänger Straße' },
        { key: 'empfaenger_plz_ort', label: 'Empfänger PLZ Ort' },
    ],
};

// ─── Verfügbare Tabellen-Quellen pro Template-Typ ────────────
const PDF_TEMPLATE_TABLES = {
    mahnung: [
        { key: 'offene_posten', label: 'Offene Posten', columns: ['bezeichnung', 'faelligkeit', 'betrag'] },
        { key: 'zusammenfassung', label: 'Zusammenfassung (Gebühren + Gesamtbetrag)', columns: ['label', 'betrag'] },
    ],
    einzelwirtschaftsplan: [
        { key: 'hausgeld_summary', label: 'Hausgeld-Übersicht (Jahres-/Monatshausgeld)', columns: ['label', 'gesamt', 'anteil'] },
        { key: 'umlageschluessel', label: 'Umlageschlüssel (Verteilerschlüssel je Einheit)', columns: ['nr', 'name', 'typ', 'zeitraum', 'tage', 'gesamt', 'anteil'] },
        { key: 'verteilung', label: 'Verteilungsergebnis (Kostenpositionen + Gesamt)', columns: ['konto', 'bezeichnung', 'schluessel', 'gesamt', 'anteil'] },
    ],
    jahresabrechnung: [
        { key: 'abrechnungsergebnis', label: 'Abrechnungsergebnis (Soll/Ist/Saldo)', columns: ['label', 'gesamt', 'anteil'] },
        { key: 'jab_monats_matrix', label: 'Hausgeld-Monatsübersicht (12 Monate Soll/Ist/Differenz)', columns: ['monat', 'soll', 'ist', 'differenz'] },
        { key: 'umlageschluessel', label: 'Umlageschlüssel (Verteilerschlüssel je Einheit)', columns: ['nr', 'name', 'typ', 'zeitraum', 'tage', 'gesamt', 'anteil'] },
        { key: 'verteilung', label: 'Verteilungsergebnis (Ist-Kosten + Gesamt)', columns: ['konto', 'bezeichnung', 'schluessel', 'gesamt', 'anteil'] },
        { key: 'vermoegen_konten', label: 'Vermögensbericht: Kontensalden (Bank & Rücklage)', columns: ['konto', 'bezeichnung', 'saldo', 'status'] },
        { key: 'vermoegen_forderungen', label: 'Vermögensbericht: Offene Forderungen', columns: ['einheit', 'eigentuemer', 'betrag', 'typ'] },
    ],
    etv_einladung: [
        { key: 'tagesordnung', label: 'Tagesordnung (TOP-Nr. + Titel)', columns: ['nr', 'titel'] },
        { key: 'anlagen', label: 'Anlagen (Dateinamen)', columns: ['name'] },
    ],
};

// ─── Mahnung als PDF generieren (Sammel-PDF pro Person) ──────
// Akzeptiert: einzelne noticeId ODER Array von noticeIds
// Nutzt das Template-System wenn ein 'mahnung'-Template in pdf_templates existiert.
// Fallback: hardcoded Layout (Legacy).
async function generateMahnungPDF(noticeIdOrIds) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('PDF wird erstellt…');

    const ids = Array.isArray(noticeIdOrIds) ? noticeIdOrIds : [noticeIdOrIds];

    // Alle notices laden (ggf. mehrere pro Person)
    const [settingsRes, noticesRes, template] = await Promise.all([
        _pdfGetSettings(),
        _supabase.from('dunning_notices')
            .select('*, person:persons(first_name, last_name, salutation, email, street, house_number, zip_code, city), demand:payment_demands(due_date, demand_type, apartment:apartments(apartment_number, buildings(street, house_number, file_number, name)))')
            .in('id', ids),
        _pdfLoadTemplate('mahnung'),
    ]);

    const settings = settingsRes;
    const notices  = noticesRes.data || [];
    if (!notices.length) { showToast('Keine Mahnungen gefunden.', 'error'); return; }

    // Daten aufbereiten
    const maxLevel = Math.max(...notices.map(function(n) { return n.dunning_level || 1; }));
    const levelText = DUNNING_LEVEL_LABELS[maxLevel] || 'Mahnung';

    const notice0 = notices[0];
    const person  = notice0.person;
    const apt     = notice0.demand?.apartment;
    const bld     = apt?.buildings;

    const personName = person ? (person.first_name + ' ' + person.last_name) : '—';
    const personAddr = person ? ((person.street || '') + ' ' + (person.house_number || '')).trim() : '';
    const personCity = person ? ((person.zip_code || '') + ' ' + (person.city || '')).trim() : '';
    const weNr    = apt?.apartment_number || '–';
    const wegName = bld ? ('WEG ' + (bld.street || '') + ' ' + (bld.house_number || '')).trim() : '–';

    let anrede = 'Sehr geehrte Damen und Herren,';
    if (person && person.salutation && person.last_name) {
        if (person.salutation === 'Herr') anrede = 'Sehr geehrter Herr ' + person.last_name + ',';
        else if (person.salutation === 'Frau') anrede = 'Sehr geehrte Frau ' + person.last_name + ',';
        else if (person.salutation === 'Eheleute') anrede = 'Sehr geehrte Eheleute ' + person.last_name + ',';
        else if (person.salutation === 'Familie') anrede = 'Sehr geehrte Familie ' + person.last_name + ',';
    }

    var fmtAmt = function(v) { return Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }); };

    // Tabellen-Daten aufbereiten
    var subtotal = 0, totalFee = 0, totalInterest = 0;
    var offenePosten = [];
    for (var ni = 0; ni < notices.length; ni++) {
        var n = notices[ni];
        var dueFmt = n.demand?.due_date ? new Date(n.demand.due_date).toLocaleDateString('de-DE') : '–';
        var aptNr  = n.demand?.apartment?.apartment_number || '';
        var monthLabel = n.demand?.due_date ? new Date(n.demand.due_date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : '';
        var amt = Number(n.overdue_amount || 0);
        subtotal += amt;
        totalFee += Number(n.dunning_fee || 0);
        totalInterest += Number(n.interest_amount || 0);
        offenePosten.push({
            bezeichnung: ('Hausgeld ' + aptNr + ' ' + monthLabel).trim(),
            faelligkeit: dueFmt,
            betrag: amt,
        });
    }
    var grandTotal = subtotal + totalFee + totalInterest;

    // Zusammenfassung (conditional rows)
    var zusammenfassung = [];
    if (notices.length > 1) zusammenfassung.push({ label: 'Zwischensumme', betrag: subtotal });
    if (totalFee > 0) zusammenfassung.push({ label: 'Mahngebühr', betrag: totalFee });
    if (totalInterest > 0) {
        var rateStr = Number(notices[0].interest_rate || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 });
        zusammenfassung.push({ label: 'Verzugszinsen (' + rateStr + ' %)', betrag: totalInterest });
    }
    zusammenfassung.push({ label: 'Gesamtbetrag', betrag: grandTotal });

    // ─── Template-Pfad (bevorzugt) ───
    if (template && Array.isArray(template.content) && template.content.length) {
        const { PDFDocument, rgb } = PDFLib;

        // PDF-Dokument mit Briefbogen erstellen
        let pdfDoc, page, templateDoc = null;
        const useLetterhead = template.use_letterhead !== false;

        if (useLetterhead && settings.letterhead_pdf_url) {
            try {
                ({ pdfDoc, page } = await _pdfCreateDoc(settings));
                // templateDoc für Folgeseiten laden
                const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 60);
                if (sd?.signedUrl) {
                    const resp = await fetch(sd.signedUrl);
                    if (resp.ok) templateDoc = await PDFDocument.load(await resp.arrayBuffer());
                }
            } catch (e) {
                if (e.message === 'NO_LETTERHEAD')
                    showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error');
                else
                    showToast('Briefbogen konnte nicht geladen werden: ' + e.message, 'error');
                return;
            }
        } else {
            pdfDoc = await PDFDocument.create();
            page = pdfDoc.addPage([595.28, 841.89]);
        }

        const { height } = page.getSize();

        // Fonts
        let fonts;
        try {
            pdfDoc.registerFontkit(fontkit);
            fonts = await _pdfLoadInterFonts(pdfDoc);
        } catch (_) {
            const { StandardFonts } = PDFLib;
            const regF  = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldF = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            fonts = { reg: regF, semi: regF, bold: boldF };
        }

        // DIN 5008 Elemente
        _pdfDrawSenderLine(page, fonts.reg, settings);
        _pdfDrawAddressField(page, fonts.reg, personName, personAddr, personCity);
        _pdfDrawDate(page, fonts.reg, settings);

        // Platzhalter-Daten
        const data = {
            mahnstufe: levelText,
            anrede: anrede,
            einheit_nr: weNr,
            weg_name: wegName,
            gesamtbetrag: fmtAmt(grandTotal) + ' €',
            firma: settings.company_name || '',
            geschaeftsfuehrer: settings.ceo_name || '',
            empfaenger_name: personName,
            empfaenger_strasse: personAddr,
            empfaenger_plz_ort: personCity,
        };

        const tables = {
            offene_posten: offenePosten,
            zusammenfassung: zusammenfassung,
        };

        await generateFromTemplate(template.content, data, tables, {
            pdfDoc, page, fonts, settings, templateDoc,
            startY: height - 200,
        });

        var pdfBytes = await pdfDoc.save();
        var filename = 'Mahnung_' + levelText.replace(/ /g, '_') + '_' + personName.replace(/ /g, '_') + '.pdf';
        _pdfDownload(pdfBytes, filename);
        showToast('PDF heruntergeladen.');
        return;
    }

    // ─── Legacy-Fallback (hardcoded Layout) ───
    const { rgb } = PDFLib;
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
    const { width, height } = page.getSize();

    let bold, reg;
    try {
        const interFonts = await _pdfLoadInterFonts(pdfDoc);
        reg  = interFonts.reg;
        bold = interFonts.bold;
    } catch (_) {
        const { StandardFonts } = PDFLib;
        bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const mLeft  = 56.7;
    const mRight = width - 56.7;

    _pdfDrawSenderLine(page, reg, settings);
    _pdfDrawAddressField(page, reg, personName, personAddr, personCity);
    _pdfDrawDate(page, reg, settings);

    const betreff = levelText + ' — Offene Hausgeld-Forderung';
    page.drawText(betreff, { x: mLeft, y: height - 200, size: 11, font: bold, color: rgb(0.22, 0.22, 0.22) });
    page.drawText(anrede, { x: mLeft, y: height - 230, size: 10, font: reg, color: rgb(0.22, 0.22, 0.22) });

    let y = height - 255;
    const introLines = [
        'für Ihre Einheit ' + weNr + ' in der ' + wegName + ' haben wir folgende offene',
        'Hausgeld-Forderungen festgestellt, die trotz Fälligkeit noch nicht beglichen wurden:',
    ];
    for (var li = 0; li < introLines.length; li++) {
        page.drawText(introLines[li], { x: mLeft, y: y, size: 10, font: reg, color: rgb(0.22, 0.22, 0.22) });
        y -= 15;
    }
    y -= 10;

    var colBez = mLeft;
    var colDue = mLeft + 220;
    var colAmt = mRight;
    var rowH   = 20;
    var olive  = rgb(0.408, 0.455, 0.318);

    var headerH = 22;
    page.drawRectangle({ x: mLeft, y: y - headerH, width: mRight - mLeft, height: headerH, color: olive });
    var hY = y - headerH + 6;
    page.drawText('Bezeichnung', { x: colBez + 6, y: hY, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Fälligkeit', { x: colDue + 6, y: hY, size: 9, font: bold, color: rgb(1, 1, 1) });
    var amtHdrTxt = 'Betrag';
    var amtHdrW = bold.widthOfTextAtSize(amtHdrTxt, 9);
    page.drawText(amtHdrTxt, { x: colAmt - 6 - amtHdrW, y: hY, size: 9, font: bold, color: rgb(1, 1, 1) });
    y -= headerH;

    for (var pi = 0; pi < offenePosten.length; pi++) {
        var p = offenePosten[pi];
        page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
        var rY = y - rowH + 6;
        page.drawText(p.bezeichnung, { x: colBez + 6, y: rY, size: 9, font: reg, color: rgb(0.22, 0.22, 0.22) });
        page.drawText(p.faelligkeit, { x: colDue + 6, y: rY, size: 9, font: reg, color: rgb(0.4, 0.4, 0.4) });
        var amtStr = fmtAmt(p.betrag) + ' €';
        var amtW   = reg.widthOfTextAtSize(amtStr, 9);
        page.drawText(amtStr, { x: colAmt - 6 - amtW, y: rY, size: 9, font: reg, color: rgb(0.22, 0.22, 0.22) });
        y -= rowH;
    }

    page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

    var drawSumRow = function(label, value, useBold, pad) {
        if (pad) y -= pad;
        y -= rowH;
        var sY = y + 6;
        var f  = useBold ? bold : reg;
        var sz = useBold ? 10 : 9;
        var c  = useBold ? rgb(0.22, 0.22, 0.22) : rgb(0.4, 0.4, 0.4);
        page.drawText(label, { x: colDue + 6, y: sY, size: sz, font: f, color: c });
        var vStr = fmtAmt(value) + ' €';
        var vW   = f.widthOfTextAtSize(vStr, sz);
        page.drawText(vStr, { x: colAmt - 6 - vW, y: sY, size: sz, font: f, color: c });
    };

    if (notices.length > 1) drawSumRow('Zwischensumme', subtotal, true, 2);
    if (totalFee > 0) drawSumRow('Mahngebühr', totalFee, false, notices.length > 1 ? 0 : 2);
    if (totalInterest > 0) {
        var rateStr2 = Number(notices[0].interest_rate || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 });
        drawSumRow('Verzugszinsen (' + rateStr2 + ' %)', totalInterest, false, 0);
    }

    y -= 4;
    var totalRowH = 24;
    page.drawRectangle({ x: mLeft, y: y - totalRowH, width: mRight - mLeft, height: totalRowH, color: rgb(0.969, 0.973, 0.961) });
    page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 1, color: olive });
    var tY = y - totalRowH + 7;
    page.drawText('Gesamtbetrag', { x: colDue + 6, y: tY, size: 10, font: bold, color: rgb(0.22, 0.22, 0.22) });
    var gtStr = fmtAmt(grandTotal) + ' €';
    var gtW   = bold.widthOfTextAtSize(gtStr, 10);
    page.drawText(gtStr, { x: colAmt - 6 - gtW, y: tY, size: 10, font: bold, color: olive });
    y -= totalRowH;

    y -= 25;
    var closingLines = [
        'Bitte überweisen Sie den Gesamtbetrag von ' + fmtAmt(grandTotal) + ' € binnen 7 Tagen',
        'auf das Ihnen bekannte Konto der WEG.',
        '',
        'Bei weiterer Nichtzahlung behalten wir uns vor, rechtliche Schritte einzuleiten.',
        '',
        'Mit freundlichen Grüßen',
    ];
    for (var ci = 0; ci < closingLines.length; ci++) {
        if (closingLines[ci] === '') { y -= 8; continue; }
        page.drawText(closingLines[ci], { x: mLeft, y: y, size: 10, font: reg, color: rgb(0.22, 0.22, 0.22) });
        y -= 15;
    }

    y -= 25;
    if (settings.company_name) page.drawText(settings.company_name, { x: mLeft, y: y, size: 10, font: bold, color: rgb(0.22, 0.22, 0.22) });
    if (settings.ceo_name) page.drawText(settings.ceo_name, { x: mLeft, y: y - 15, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4) });

    var pdfBytes = await pdfDoc.save();
    var filename = 'Mahnung_' + levelText.replace(/ /g, '_') + '_' + personName.replace(/ /g, '_') + '.pdf';
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

    page.drawText(`Status: ${BUDGET_PLAN_STATUSES[plan.status] || plan.status}`, {
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
async function generateEinzelwirtschaftsplanPDF(planId, saveForETV = false) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('Einzelwirtschaftspläne werden erstellt…');

    const settings = await _pdfGetSettings();
    const { data: plan } = await _supabase.from('budget_plans')
        .select('*, building:buildings(id, name, file_number, street, house_number, zip_code, city)')
        .eq('id', planId).single();
    if (!plan) { showToast('Wirtschaftsplan nicht gefunden.', 'error'); return; }

    const bid = plan.building_id;
    const [itemsRes, aptsRes, accsRes, dkRes, dkuRes, ownRes, wpTemplate] = await Promise.all([
        _supabase.from('budget_plan_items').select('*, account:accounts(id, account_number, account_name, account_type, is_allocatable, primary_key_id, secondary_key_id, secondary_key_percentage)').eq('budget_plan_id', planId).order('account_id'),
        _supabase.from('apartments').select('id, apartment_number, floor, sq_meters, mea, hausgeld').eq('building_id', bid).order('apartment_number'),
        _supabase.from('accounts').select('id, account_number, account_name, account_type, is_allocatable, primary_key_id, secondary_key_id, secondary_key_percentage').eq('building_id', bid).eq('is_active', true),
        _supabase.from('distribution_keys').select('id, name, type, total_value, heiz_split_percent').eq('building_id', bid),
        _supabase.from('distribution_key_units').select('distribution_key_id, apartment_id, value'),
        _supabase.from('ownerships').select('apartment_id, owner:persons!ownerships_owner_id_fkey(first_name, last_name, street, house_number, zip_code, city)').eq('is_active', true),
        _pdfLoadTemplate('einzelwirtschaftsplan'),
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
    const aptIds = new Set(apts.map(a => a.id));
    owners.forEach(o => {
        if (o.owner && aptIds.has(o.apartment_id)) {
            const p = o.owner;
            ownerMap[o.apartment_id] = {
                name: [p.first_name, p.last_name].filter(Boolean).join(' '),
                street: [p.street, p.house_number].filter(Boolean).join(' '),
                zip_code: p.zip_code,
                city: p.city,
            };
        }
    });

    // ─── Template-Pfad (bevorzugt) ───────────────────────────
    if (wpTemplate && Array.isArray(wpTemplate.content) && wpTemplate.content.length) {
        const { PDFDocument, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        let fonts;
        try {
            fonts = await _pdfLoadInterFonts(pdfDoc);
        } catch (e) {
            console.error('Inter font load error:', e);
            showToast('Inter-Schriftart konnte nicht geladen werden: ' + e.message, 'error'); return;
        }

        // Letterhead als templateDoc für Seitenerstellung
        let templateDoc = null;
        const useLetterhead = wpTemplate.use_letterhead !== false;
        if (useLetterhead && settings.letterhead_pdf_url) {
            try {
                const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
                if (sd?.signedUrl) {
                    const resp = await fetch(sd.signedUrl);
                    if (resp.ok) templateDoc = await PDFDocument.load(await resp.arrayBuffer());
                }
            } catch (_) { /* fallback: ohne Briefbogen */ }
            if (!templateDoc) {
                showToast('Briefbogen konnte nicht geladen werden.', 'error'); return;
            }
        }

        // Shared helpers + strings
        const bldName = plan.building ? formatBuildingName(plan.building) : '—';
        const bldAddr = plan.building ? `${plan.building.street || ''} ${plan.building.house_number || ''}`.trim() : '';
        const bldZipCity = plan.building ? `${plan.building.zip_code || ''} ${plan.building.city || ''}`.trim() : '';
        const bldFullAddr = [bldAddr, bldZipCity].filter(Boolean).join(', ');
        const planZeitraum = `01.01.${plan.fiscal_year} – 31.12.${plan.fiscal_year}`;
        const dkZeitraum = `01.01.–31.12.${plan.fiscal_year}`;
        const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const _typeLabels = DISTRIBUTION_KEY_LABELS;

        function _fmtEur(v) {
            const r = Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
            return r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        }
        function _fmtVal(v) {
            return Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        }

        // calcShare: Anteil einer WP-Position für eine Einheit
        function _calcShare(item, aptId) {
            const acc = item.account || accounts.find(a => a.id === item.account_id);
            if (!acc) return { share: 0, keyName: '—' };
            const pkId = acc.primary_key_id;
            const skId = acc.secondary_key_id;
            const skPct = acc.secondary_key_percentage;
            const planned = Number(item.planned_amount || 0);
            if (!pkId || !dkMap[pkId]) return { share: 0, keyName: '—' };
            const pk = dkMap[pkId];
            const pkTotal = Number(pk.total_value) || 0;
            const pkVal = (dkUnitMap[pkId] && dkUnitMap[pkId][aptId]) || 0;
            let keyName = pk.name;
            if (pkTotal === 0) return { share: 0, keyName };
            if (skId && skPct && dkMap[skId]) {
                const sk = dkMap[skId];
                const skTotal = Number(sk.total_value) || 0;
                const skVal = (dkUnitMap[skId] && dkUnitMap[skId][aptId]) || 0;
                const primaryShare = planned * (1 - skPct / 100) * (pkVal / pkTotal);
                const secondaryShare = skTotal > 0 ? planned * (skPct / 100) * (skVal / skTotal) : 0;
                keyName = `${pk.name}/${sk.name}`;
                return { share: primaryShare + secondaryShare, keyName };
            }
            return { share: planned * (pkVal / pkTotal), keyName };
        }

        // Verwendete Verteilerschlüssel sammeln
        function _collectUsedKeys(aptId) {
            const seen = new Set();
            const result = [];
            for (const item of planItems) {
                const acc = item.account || accounts.find(a => a.id === item.account_id);
                if (!acc || !acc.primary_key_id || !dkMap[acc.primary_key_id]) continue;
                const pk = dkMap[acc.primary_key_id];
                if (seen.has(pk.id)) continue;
                seen.add(pk.id);
                const pkTotal = Number(pk.total_value) || 0;
                const pkVal = (dkUnitMap[pk.id] && dkUnitMap[pk.id][aptId]) || 0;
                result.push({ nr: result.length + 1, key: pk, unitVal: pkVal, total: pkTotal });
                if (acc.secondary_key_id && dkMap[acc.secondary_key_id]) {
                    const sk = dkMap[acc.secondary_key_id];
                    if (!seen.has(sk.id)) {
                        seen.add(sk.id);
                        const skTotal = Number(sk.total_value) || 0;
                        const skVal = (dkUnitMap[sk.id] && dkUnitMap[sk.id][aptId]) || 0;
                        result.push({ nr: result.length + 1, key: sk, unitVal: skVal, total: skTotal });
                    }
                }
            }
            return result;
        }

        // ── Seiten je Einheit generieren ─────────────────────
        const aptPageRanges = [];
        for (const apt of apts) {
            const aptPageStart = pdfDoc.getPageCount();
            const owner = ownerMap[apt.id] || {};
            const ownerName = owner.name || 'Eigentümergemeinschaft (Leerstand)';

            // Erste Seite erstellen
            let firstPage;
            if (templateDoc) {
                const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
                firstPage = pdfDoc.addPage(copied);
            } else {
                firstPage = pdfDoc.addPage([595.28, 841.89]);
            }
            const pgH = firstPage.getSize().height;

            // Hausgeld-Summen berechnen
            let totalPlanned = 0, totalShare = 0;
            for (const item of planItems) {
                totalPlanned += Number(item.planned_amount || 0);
                totalShare += _calcShare(item, apt.id).share;
            }

            // Platzhalter-Daten
            const data = {
                plan_jahr: String(plan.fiscal_year),
                einheit_nummer: apt.apartment_number || '–',
                eigentuemer_name: ownerName,
                eigentuemer_adresse: [owner.street, [owner.zip_code, owner.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
                hausgeld_monat: _fmtEur(totalShare / 12),
                hausgeld_jahr: _fmtEur(totalShare),
                weg_name: bldName,
                objekt_adresse: bldFullAddr || bldName,
                planzeitraum: planZeitraum,
                verwalter_firma: settings.company_name || '',
                verwalter_adresse: [settings.street, settings.zip_city].filter(Boolean).join(', '),
                verwalter_steuernr: settings.tax_number ? 'St.-Nr. ' + settings.tax_number : '',
                mea: apt.mea || '—',
                flaeche: apt.sq_meters ? apt.sq_meters + ' m²' : '—',
                datum: dateStr,
                gesamt_hausgeld_jahr: _fmtEur(totalPlanned),
                gesamt_hausgeld_monat: _fmtEur(totalPlanned / 12),
            };

            // Tabellen-Daten: Hausgeld-Summary
            const hausgeldSummary = [
                { label: 'Jahres-Hausgeld', gesamt: totalPlanned, anteil: totalShare },
                { label: 'Monatliches Hausgeld', gesamt: totalPlanned / 12, anteil: totalShare / 12 },
            ];

            // Tabellen-Daten: Umlageschlüssel
            const usedKeys = _collectUsedKeys(apt.id);
            const umlageschluessel = usedKeys.map(uk => ({
                nr: String(uk.nr),
                name: uk.key.name,
                typ: _typeLabels[uk.key.type] || uk.key.type,
                zeitraum: dkZeitraum,
                tage: '365',
                gesamt: _fmtVal(uk.total),
                anteil: _fmtVal(uk.unitVal),
            }));

            // Tabellen-Daten: Verteilung (flach mit Grand-Total als letzte Zeile)
            const verteilung = [];
            let grandTotalP = 0, grandTotalS = 0;
            for (const item of planItems) {
                const { share, keyName } = _calcShare(item, apt.id);
                const planned = Number(item.planned_amount || 0);
                grandTotalP += planned;
                grandTotalS += share;
                verteilung.push({
                    konto: item.account?.account_number || '–',
                    bezeichnung: item.account?.account_name || '–',
                    schluessel: keyName,
                    gesamt: planned,
                    anteil: share,
                });
            }
            verteilung.push({
                konto: '',
                bezeichnung: 'Gesamt Jahres-Hausgeld',
                schluessel: '',
                gesamt: grandTotalP,
                anteil: grandTotalS,
            });

            const tables = {
                hausgeld_summary: hausgeldSummary,
                umlageschluessel: umlageschluessel,
                verteilung: verteilung,
            };

            await generateFromTemplate(wpTemplate.content, data, tables, {
                pdfDoc, page: firstPage, fonts, settings, templateDoc,
                startY: pgH - 100,
            });

            aptPageRanges.push({ aptId: apt.id, start: aptPageStart, end: pdfDoc.getPageCount() - 1 });
        }

        const pdfBytes = await pdfDoc.save();
        if (saveForETV) {
            await _pdfSplitAndUpload(pdfBytes, aptPageRanges, plan.building_id, plan.fiscal_year, 'wp');
        } else {
            const filename = `Einzelwirtschaftsplaene_${plan.fiscal_year}_${bldName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            _pdfDownload(pdfBytes, filename);
            showToast(`${apts.length} Einzelwirtschaftspläne als PDF heruntergeladen.`);
        }
        return;
    }

    // ─── Legacy-Fallback (hardcoded Layout) ──────────────────
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

    // Helper: format dimensionless value (no € suffix)
    function fmtVal(v) {
        const r = Number(v || 0);
        return r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }

    // Helper: distribution key type labels
    const typeLabels = DISTRIBUTION_KEY_LABELS;

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
    const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const bldAddr = plan.building ? `${plan.building.street || ''} ${plan.building.house_number || ''}`.trim() : '';
    const bldZipCity = plan.building ? `${plan.building.zip_code || ''} ${plan.building.city || ''}`.trim() : '';
    const bldFullAddr = [bldAddr, bldZipCity].filter(Boolean).join(', ');
    const zeitraum = `01.01.${plan.fiscal_year}`;
    const zeitraumEnd = `31.12.${plan.fiscal_year}`;
    const planZeitraum = `${zeitraum} – ${zeitraumEnd}`;

    // WEG header line for all pages
    const wegHeaderText = `Wirtschaftsplan | WEG ${bldFullAddr}`;

    // Shared table constants
    const padV = 4;
    const minRowH = 18;
    const sectionH  = 16;
    const subtotalH = 20;
    const grandTotalH = 22;

    // Table drawing helpers (defined once, reused across pages)
    function splitLines(text, font, fs, maxW, maxL) {
        const all = _pdfSplitText(text, font, fs, maxW);
        if (all.length <= maxL) return all;
        const out = all.slice(0, maxL);
        let last = out[maxL - 1];
        while (last.length > 3 && font.widthOfTextAtSize(last + '…', fs) > maxW) last = last.slice(0, -1);
        out[maxL - 1] = last + '…';
        return out;
    }
    function drawCell(pg, lines, x, cellTop, lineH, fs, font, color) {
        let textY = cellTop - padV - lineH;
        for (const line of lines) {
            pg.drawText(line, { x: x + 2, y: textY, size: fs, font, color });
            textY -= lineH;
        }
    }
    function drawCellSingle(pg, text, x, cellTop, lineH, fs, font, color) {
        pg.drawText(text, { x: x + 2, y: cellTop - padV - lineH, size: fs, font, color });
    }
    function drawCellR(pg, text, xRight, cellTop, lineH, fs, font, color) {
        const w = font.widthOfTextAtSize(text, fs);
        pg.drawText(text, { x: xRight - w - 2, y: cellTop - padV - lineH, size: fs, font, color });
    }

    // Cost table column positions
    const bezFS  = 9;
    const keyFS  = 7.5;
    const costLH = Math.ceil(bezFS * 1.3);
    const cKonto   = mLeft + 2;
    const cBez     = mLeft + 39;
    const cBezW    = 138;
    const cKey     = mLeft + 183;
    const cKeyW    = 108;
    const cGesamtR = mLeft + 380;
    const cAnteilR = mRight - 2;

    // Umlageschlüssel table column positions
    const dkFS  = 7.5;
    const dkLH  = Math.ceil(dkFS * 1.3);
    const dk0   = mLeft + 2;
    const dk1   = mLeft + 30;
    const dk1W  = 115;
    const dk2   = mLeft + 149;
    const dk3   = mLeft + 211;
    const dk4r  = mLeft + 344;
    const dk5r  = mLeft + 415;
    const dk6r  = mRight - 2;

    const dividerColor = rgb(0.88, 0.89, 0.86);
    const zebraColor   = rgb(0.976, 0.98, 0.973);
    const grayDeemph   = rgb(0.612, 0.639, 0.682);
    const mBottom = 100; // min. bottom margin — Platz für Briefbogen-Fußzeile

    // ── PAGE CREATION HELPERS ────────────────────────────────
    const contentStartY = 100; // offset from top — below letterhead logo (~85-90pt)

    // Draw compact header for continuation pages (Seite 2+)
    function drawPageHeaderCompact(pg, pgHeight) {
        const headerY = pgHeight - contentStartY;
        pg.drawText(wegHeaderText, { x: mLeft, y: headerY, size: 8.5, font: fBold, color: offblack });
        drawR(pg, dateStr, mRight, headerY, 8.5, fReg, gray50);
        pg.drawLine({ start: { x: mLeft, y: headerY - 6 }, end: { x: mRight, y: headerY - 6 }, thickness: 0.5, color: dividerColor });
        return headerY - 16;
    }

    // Create continuation page (Seite 2+): letterhead + compact header
    async function addPage() {
        const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
        const pg = pdfDoc.addPage(copied);
        const pgH = pg.getSize().height;
        const startY = drawPageHeaderCompact(pg, pgH);
        return { page: pg, height: pgH, y: startY };
    }

    // Create first page: letterhead, NO compact header line, only date
    async function addFirstPage() {
        const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
        const pg = pdfDoc.addPage(copied);
        const pgH = pg.getSize().height;
        const startY = pgH - contentStartY;
        // Only date, right-aligned, no header text or line
        drawR(pg, dateStr, mRight, startY, 8.5, fReg, gray50);
        return { page: pg, height: pgH, y: startY };
    }

    // ── Generate pages per apartment ─────────────────────────
    const aptPageRanges = [];
    for (const apt of apts) {
        const aptPageStart = pdfDoc.getPageCount();
        const owner = ownerMap[apt.id] || {};
        const ownerName = owner.name || 'Eigentümergemeinschaft (Leerstand)';

        // ── PAGE 1: Full header (no compact header line) ─────
        let { page, height, y } = await addFirstPage();

        // ── TITEL ────────────────────────────────────────────
        page.drawText('Wirtschaftsplan', { x: mLeft, y, size: 16, font: fBold, color: offblack });
        y -= 18;
        page.drawText('Einzelwirtschaftsplan', { x: mLeft, y, size: 12, font: fSemi, color: gray50 });
        y -= 22;

        // ── OBJEKT- & VERWALTER-BLOCK (zweispaltig, Box) ─────
        const boxTop = y;
        const boxPad = 6;
        const halfW  = (contentW - 8) / 2;

        // Pre-calc box height
        const rColX = mLeft + halfW + 8;
        let lH = boxPad + 10 + 10 + 12 + 10; // Objekt label+value + Planzeitraum label+value
        let rH = boxPad + 10 + 10; // Verwalter label + company
        if (settings.street) rH += 10;
        if (settings.zip_city) rH += 10;
        if (settings.tax_number) rH += 10;
        const boxH = Math.max(lH, rH) + boxPad;
        const boxBottom = boxTop - boxH;

        // Draw box first, then text
        page.drawRectangle({ x: mLeft, y: boxBottom, width: contentW, height: boxH, borderColor: dividerColor, borderWidth: 0.75, color: rgb(1, 1, 1) });
        page.drawLine({ start: { x: mLeft + halfW, y: boxTop - 3 }, end: { x: mLeft + halfW, y: boxBottom + 3 }, thickness: 0.5, color: dividerColor });

        // Left: Objekt
        let lY = boxTop - boxPad - 7;
        page.drawText('Objekt', { x: mLeft + boxPad, y: lY, size: 6.5, font: fBold, color: gray50 });
        lY -= 10;
        page.drawText(bldFullAddr || bldName, { x: mLeft + boxPad, y: lY, size: 8.5, font: fSemi, color: offblack });
        lY -= 12;
        page.drawText('Planzeitraum', { x: mLeft + boxPad, y: lY, size: 6.5, font: fBold, color: gray50 });
        lY -= 10;
        page.drawText(planZeitraum, { x: mLeft + boxPad, y: lY, size: 8.5, font: fReg, color: offblack });

        // Right: Verwalter
        let rY = boxTop - boxPad - 7;
        page.drawText('Verwalter', { x: rColX, y: rY, size: 6.5, font: fBold, color: gray50 });
        rY -= 10;
        if (settings.company_name) { page.drawText(settings.company_name, { x: rColX, y: rY, size: 8.5, font: fSemi, color: offblack }); rY -= 10; }
        if (settings.street)       { page.drawText(settings.street, { x: rColX, y: rY, size: 8, font: fReg, color: gray40 }); rY -= 10; }
        if (settings.zip_city)     { page.drawText(settings.zip_city, { x: rColX, y: rY, size: 8, font: fReg, color: gray40 }); rY -= 10; }
        if (settings.tax_number)   { page.drawText('St.-Nr. ' + settings.tax_number, { x: rColX, y: rY, size: 7.5, font: fReg, color: gray50 }); rY -= 10; }

        y = boxBottom - 8;

        // ── EIGENTÜMER-BOX (umrandet, kompakt) ─────────────
        const ownBoxTop = y;
        let ownH = boxPad + 7 + 10; // label + name
        if (owner.street) ownH += 10;
        if (owner.zip_code || owner.city) ownH += 10;
        ownH += 11 + 10 + boxPad; // VE label + value + bottom pad
        const ownBoxBottom = ownBoxTop - ownH;

        page.drawRectangle({ x: mLeft, y: ownBoxBottom, width: contentW, height: ownH, borderColor: olive, borderWidth: 0.75, color: rgb(1, 1, 1) });

        let oY = ownBoxTop - boxPad - 7;
        page.drawText('Eigentümer:', { x: mLeft + boxPad, y: oY, size: 6.5, font: fBold, color: gray50 });
        oY -= 10;
        page.drawText(ownerName, { x: mLeft + boxPad, y: oY, size: 9, font: fBold, color: offblack });
        if (owner.street) { oY -= 10; page.drawText(owner.street, { x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: gray40 }); }
        if (owner.zip_code || owner.city) { oY -= 10; page.drawText([owner.zip_code, owner.city].filter(Boolean).join(' '), { x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: gray40 }); }
        oY -= 11;
        page.drawText('Verwaltungseinheit:', { x: mLeft + boxPad, y: oY, size: 6.5, font: fBold, color: gray50 });
        oY -= 10;
        page.drawText(`WE ${apt.apartment_number}${apt.floor ? ' – ' + apt.floor : ''}    |    MEA: ${apt.mea || '—'}    |    Fläche: ${apt.sq_meters ? apt.sq_meters + ' m²' : '—'}`, {
            x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: offblack });

        y = ownBoxBottom - 12;

        // ── BLOCK 2: HAUSGELD-SUMMARY ───────────────────────
        let totalPlanned = 0;
        let totalShare   = 0;
        for (const item of planItems) {
            totalPlanned += Number(item.planned_amount || 0);
            totalShare   += calcShare(item, apt.id).share;
        }

        page.drawText('Hausgeld-Übersicht', { x: mLeft, y, size: 10, font: fBold, color: olive });
        y -= 10;

        y -= drawTableHeader(page, y, [
            { x: mLeft + 4, label: 'Hausgeld', align: 'left' },
            { x: mLeft + contentW * 0.55, label: 'Objekt gesamt', align: 'right' },
            { x: mRight - 4, label: 'Ihr Anteil', align: 'right' },
        ]);

        // Row 1: Jahres-Hausgeld (dezent)
        const jr1base = y - padV - Math.ceil(8.5 * 1.3);
        page.drawText('Jahres-Hausgeld', { x: mLeft + 4, y: jr1base, size: 8.5, font: fReg, color: grayDeemph });
        drawR(page, fmt(totalPlanned), mLeft + contentW * 0.55, jr1base, 9, fReg, grayDeemph);
        drawR(page, fmt(totalShare), mRight - 4, jr1base, 9, fReg, grayDeemph);
        y -= minRowH;

        page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.3, color: dividerColor });

        // Row 2: Monatliches Hausgeld (prominent, olive)
        const summRow2H = 24;
        page.drawRectangle({ x: mLeft, y: y - summRow2H, width: contentW, height: summRow2H, color: zebraColor });
        const jr2base = y - padV - Math.ceil(10 * 1.3);
        page.drawText('Monatliches Hausgeld', { x: mLeft + 4, y: jr2base, size: 10, font: fSemi, color: olive });
        drawR(page, fmt(totalPlanned / 12), mLeft + contentW * 0.55, jr2base, 10, fSemi, olive);
        drawR(page, fmt(totalShare / 12), mRight - 4, jr2base, 10, fBold, olive);
        y -= summRow2H + 20;

        // ── BLOCK 3: UMLAGESCHLÜSSEL-TABELLE ────────────────
        const usedKeys = collectUsedKeys(apt.id);

        // Check if enough space for header + at least 2 rows
        if (y - 60 < mBottom) {
            ({ page, height, y } = await addPage());
        }

        page.drawText('Umlageschlüssel', { x: mLeft, y, size: 10, font: fBold, color: olive });
        y -= 10;

        y -= drawTableHeader(page, y, [
            { x: dk0,  label: 'Nr.',           align: 'left' },
            { x: dk1,  label: 'Schlüssel',     align: 'left' },
            { x: dk2,  label: 'Umlage-Typ',    align: 'left' },
            { x: dk3,  label: 'Zeitraum',       align: 'left' },
            { x: dk4r, label: 'Tage',           align: 'right' },
            { x: dk5r, label: 'Gesamtumlage',   align: 'right' },
            { x: dk6r, label: 'Ihr Anteil',     align: 'right' },
        ]);

        const dkZeitraum = `01.01.–31.12.${plan.fiscal_year}`;
        const dkPreCalc = usedKeys.map(uk => {
            const nameLines = splitLines(uk.key.name, fReg, dkFS, dk1W - 4, 2);
            const nLines = Math.max(nameLines.length, 1);
            const rowH = Math.max(minRowH, nLines * dkLH + padV * 2);
            return { uk, nameLines, rowH };
        });

        for (let ki = 0; ki < dkPreCalc.length; ki++) {
            const row = dkPreCalc[ki];
            if (y - row.rowH < mBottom) {
                ({ page, height, y } = await addPage());
                y -= drawTableHeader(page, y, [
                    { x: dk0,  label: 'Nr.',           align: 'left' },
                    { x: dk1,  label: 'Schlüssel',     align: 'left' },
                    { x: dk2,  label: 'Umlage-Typ',    align: 'left' },
                    { x: dk3,  label: 'Zeitraum',       align: 'left' },
                    { x: dk4r, label: 'Tage',           align: 'right' },
                    { x: dk5r, label: 'Gesamtumlage',   align: 'right' },
                    { x: dk6r, label: 'Ihr Anteil',     align: 'right' },
                ]);
            }
            const cellTop = y;
            if (ki % 2 === 1) {
                page.drawRectangle({ x: mLeft, y: cellTop - row.rowH, width: contentW, height: row.rowH, color: zebraColor });
            }
            drawCellSingle(page, `${row.uk.nr}`, dk0, cellTop, dkLH, dkFS, fReg, gray40);
            drawCell(page, row.nameLines, dk1, cellTop, dkLH, dkFS, fReg, offblack);
            drawCellSingle(page, typeLabels[row.uk.key.type] || row.uk.key.type, dk2, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellSingle(page, dkZeitraum, dk3, cellTop, dkLH, 7, fReg, gray50);
            drawCellR(page, '365',                dk4r, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellR(page, fmtVal(row.uk.total),    dk5r, cellTop, dkLH, dkFS, fReg, gray40);
            drawCellR(page, fmtVal(row.uk.unitVal),  dk6r, cellTop, dkLH, dkFS, fSemi, offblack);
            page.drawLine({ start: { x: mLeft, y: cellTop - row.rowH }, end: { x: mRight, y: cellTop - row.rowH }, thickness: 0.3, color: dividerColor });
            y -= row.rowH;
        }
        y -= 20;

        // ── BLOCK 4: VERTEILUNGSERGEBNIS (Kostentabelle) ────
        const expenseItems = planItems.filter(it => {
            const acc = it.account || accounts.find(a => a.id === it.account_id);
            return acc && acc.is_allocatable;
        });
        const otherItems = planItems.filter(it => {
            const acc = it.account || accounts.find(a => a.id === it.account_id);
            return !acc || !acc.is_allocatable;
        });

        // Check space for section header + table header + 1 row min
        if (y - 70 < mBottom) {
            ({ page, height, y } = await addPage());
        }

        page.drawText('Verteilungsergebnis', { x: mLeft, y, size: 10, font: fBold, color: olive });
        y -= 10;

        const costCols = [
            { x: cKonto,    label: 'Konto',        align: 'left' },
            { x: cBez,      label: 'Bezeichnung',   align: 'left' },
            { x: cKey,      label: 'Schlüssel',     align: 'left' },
            { x: cGesamtR,  label: 'Gesamtkosten',  align: 'right' },
            { x: cAnteilR,  label: 'Ihr Anteil',    align: 'right' },
        ];
        y -= drawTableHeader(page, y, costCols);

        // Draw cost section with page-break support
        const drawCostSection = async function(label, items, startY, startIdx) {
            let cy = startY;
            let ri = startIdx;
            let sTotal = 0, sShare = 0;
            let curPage = page;

            // Section header
            if (cy - sectionH < mBottom) {
                const np = await addPage();
                curPage = np.page; page = np.page; height = np.height; cy = np.y;
                cy -= drawTableHeader(curPage, cy, costCols);
            }
            curPage.drawRectangle({ x: mLeft, y: cy - sectionH, width: contentW, height: sectionH, color: rgb(0.94, 0.95, 0.93) });
            curPage.drawText(label, { x: mLeft + 4, y: cy - sectionH + 4, size: 8, font: fSemi, color: olive });
            cy -= sectionH;

            const rowData = items.map(item => {
                const planned = Number(item.planned_amount || 0);
                const { share, keyName } = calcShare(item, apt.id);
                const bezLines = splitLines(item.account?.account_name || '–', fReg, bezFS, cBezW, 2);
                const keyLines = splitLines(keyName, fReg, keyFS, cKeyW, 2);
                const maxLines = Math.max(bezLines.length, keyLines.length, 1);
                const rowH = Math.max(minRowH, maxLines * costLH + padV * 2);
                return { item, planned, share, bezLines, keyLines, rowH };
            });

            for (const rd of rowData) {
                if (cy - rd.rowH < mBottom) {
                    const np = await addPage();
                    curPage = np.page; page = np.page; height = np.height; cy = np.y;
                    cy -= drawTableHeader(curPage, cy, costCols);
                }
                sTotal += rd.planned;
                sShare += rd.share;
                const cellTop = cy;

                if (ri % 2 === 1) {
                    curPage.drawRectangle({ x: mLeft, y: cellTop - rd.rowH, width: contentW, height: rd.rowH, color: zebraColor });
                }
                drawCellSingle(curPage, rd.item.account?.account_number || '–', cKonto, cellTop, costLH, 8, fReg, gray40);
                drawCell(curPage, rd.bezLines, cBez, cellTop, costLH, bezFS, fReg, offblack);
                drawCell(curPage, rd.keyLines, cKey, cellTop, costLH, keyFS, fReg, gray50);
                drawCellR(curPage, fmt(rd.planned), cGesamtR, cellTop, costLH, 8, fReg, gray40);

                const sFont  = rd.share > 0 ? fSemi : fReg;
                const sColor = rd.share > 0 ? offblack : rgb(0.6, 0.6, 0.6);
                drawCellR(curPage, fmt(rd.share), cAnteilR, cellTop, costLH, 8, sFont, sColor);

                curPage.drawLine({ start: { x: mLeft, y: cellTop - rd.rowH }, end: { x: mRight, y: cellTop - rd.rowH }, thickness: 0.3, color: dividerColor });
                cy -= rd.rowH;
                ri++;
            }

            // Subtotal
            if (cy - subtotalH < mBottom) {
                const np = await addPage();
                curPage = np.page; page = np.page; height = np.height; cy = np.y;
            }
            curPage.drawRectangle({ x: mLeft, y: cy - subtotalH, width: contentW, height: subtotalH, color: rgb(0.94, 0.95, 0.93) });
            curPage.drawText(`Zwischensumme ${label}`, { x: mLeft + 4, y: cy - subtotalH + 5, size: 8, font: fSemi, color: offblack });
            drawR(curPage, fmt(sTotal), cGesamtR - 2, cy - subtotalH + 5, 8, fSemi, gray40);
            drawR(curPage, fmt(sShare), cAnteilR - 2, cy - subtotalH + 5, 8, fBold, olive);
            cy -= subtotalH;

            return { y: cy, ri, total: sTotal, share: sShare };
        };

        let costIdx = 0;
        let grandTotal = 0, grandShare = 0;

        if (expenseItems.length) {
            const res = await drawCostSection('Umlagefähige Kosten', expenseItems, y, costIdx);
            y = res.y; costIdx = res.ri; grandTotal += res.total; grandShare += res.share;
        }
        if (otherItems.length) {
            const res = await drawCostSection('Nicht umlagefähige Kosten', otherItems, y, costIdx);
            y = res.y; costIdx = res.ri; grandTotal += res.total; grandShare += res.share;
        }

        // Grand total row
        if (y - grandTotalH < mBottom) {
            ({ page, height, y } = await addPage());
        }
        page.drawRectangle({ x: mLeft, y: y - grandTotalH, width: contentW, height: grandTotalH, color: olive });
        page.drawText('Gesamt Jahres-Hausgeld', { x: mLeft + 4, y: y - grandTotalH + 6, size: 8.5, font: fBold, color: white });
        drawR(page, fmt(grandTotal), cGesamtR - 2, y - grandTotalH + 6, 8.5, fBold, white);
        drawR(page, fmt(grandShare), cAnteilR - 2, y - grandTotalH + 6, 8.5, fBold, white);
        y -= grandTotalH + 16;

        // ── BLOCK 5: RECHTLICHER HINWEIS ────────────────────
        const hintText = 'Dieser Wirtschaftsplan wurde maschinell erstellt und ist rechtlich bindend nach Beschlussfassung der WEG-Gemeinschaft. Die aus dem Wirtschaftsplan resultierenden monatlichen Hausgelder sind über den Planungszeitraum hinaus weiter zu zahlen, bis ein neuer Wirtschaftsplan beschlossen wurde.';
        const hintPad    = 10;
        const hintFS     = 9.5;
        const hintLH     = Math.ceil(hintFS * 1.3);
        const hintIconD  = 10;
        const hintIconGap = 6;
        const hintIconArea = hintPad + hintIconD + hintIconGap;
        const hintTextW  = contentW - hintIconArea - hintPad;
        const hintLines  = _pdfSplitText(hintText, fReg, hintFS, hintTextW);
        const hintBoxH   = hintPad * 2 + hintLines.length * hintLH;

        if (y - hintBoxH < mBottom) {
            ({ page, height, y } = await addPage());
        }

        page.drawRectangle({
            x: mLeft, y: y - hintBoxH,
            width: contentW, height: hintBoxH,
            borderColor: orange, borderWidth: 1,
            color: rgb(0.996, 0.972, 0.958),
        });

        const iconCX = mLeft + hintPad + hintIconD / 2;
        const iconCY = y - hintPad - hintLH / 2;
        page.drawCircle({ x: iconCX, y: iconCY, size: hintIconD / 2, color: orange });
        const iCharW = fBold.widthOfTextAtSize('i', 7);
        page.drawText('i', { x: iconCX - iCharW / 2, y: iconCY - 2.5, size: 7, font: fBold, color: white });

        const hintTextX = mLeft + hintIconArea;
        hintLines.forEach((line, i) => {
            page.drawText(line, {
                x: hintTextX,
                y: y - hintPad - hintLH * 0.85 - (i * hintLH),
                size: hintFS, font: fReg, color: offblack,
            });
        });
        aptPageRanges.push({ aptId: apt.id, start: aptPageStart, end: pdfDoc.getPageCount() - 1 });
    }

    const pdfBytes = await pdfDoc.save();
    if (saveForETV) {
        await _pdfSplitAndUpload(pdfBytes, aptPageRanges, plan.building_id, plan.fiscal_year, 'wp');
    } else {
        const filename = `Einzelwirtschaftsplaene_${plan.fiscal_year}_${bldName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        _pdfDownload(pdfBytes, filename);
        showToast(`${apts.length} Einzelwirtschaftspläne als PDF heruntergeladen.`);
    }
}

// ─── Jahresabrechnung als Bulk-PDF (Anschreiben + Einzelabrechnung je WE) ────
async function generateJahresabrechnungPDF(buildingId, fiscalYear, jabData, saveForETV = false) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }

    showToast('Jahresabrechnungen werden erstellt…');

    const settings = await _pdfGetSettings();
    const bid = buildingId;
    const fy  = fiscalYear;

    // Load building, apartments, accounts, distribution keys, ownerships
    const [bldRes, aptsRes, accsRes, dkRes, dkuRes, ownRes, jabTemplate] = await Promise.all([
        _supabase.from('buildings').select('id, name, file_number, street, house_number, zip_code, city').eq('id', bid).single(),
        _supabase.from('apartments').select('id, apartment_number, floor, sq_meters, mea, hausgeld').eq('building_id', bid).order('apartment_number'),
        _supabase.from('accounts').select('id, account_number, account_name, account_type, is_allocatable, primary_key_id, secondary_key_id, secondary_key_percentage').eq('building_id', bid).eq('is_active', true),
        _supabase.from('distribution_keys').select('id, name, type, total_value, heiz_split_percent').eq('building_id', bid),
        _supabase.from('distribution_key_units').select('distribution_key_id, apartment_id, value'),
        _supabase.from('ownerships').select('apartment_id, owner:persons!ownerships_owner_id_fkey(first_name, last_name, salutation, street, house_number, zip_code, city)').eq('is_active', true),
        _pdfLoadTemplate('jahresabrechnung'),
    ]);

    var bld       = bldRes.data;
    var apts      = aptsRes.data || [];
    var accounts  = accsRes.data || [];
    var distKeys  = dkRes.data || [];
    var dkUnits   = dkuRes.data || [];
    var owners    = ownRes.data || [];

    if (!bld) { showToast('Gebäude nicht gefunden.', 'error'); return; }
    if (!apts.length) { showToast('Keine Einheiten vorhanden.', 'error'); return; }

    // Lookup maps
    var dkMap = {};
    distKeys.forEach(function(k) { dkMap[k.id] = k; });
    var dkUnitMap = {};
    dkUnits.forEach(function(u) {
        if (!dkUnitMap[u.distribution_key_id]) dkUnitMap[u.distribution_key_id] = {};
        dkUnitMap[u.distribution_key_id][u.apartment_id] = Number(u.value) || 0;
    });
    var ownerMap = {};
    var aptIdSet = new Set(apts.map(function(a) { return a.id; }));
    owners.forEach(function(o) {
        if (o.owner && aptIdSet.has(o.apartment_id)) {
            var p = o.owner;
            ownerMap[o.apartment_id] = {
                name: [p.first_name, p.last_name].filter(Boolean).join(' '),
                salutation: p.salutation,
                lastName: p.last_name,
                street: [p.street, p.house_number].filter(Boolean).join(' '),
                zip_code: p.zip_code,
                city: p.city,
            };
        }
    });

    // Aggregate Ist-Kosten aus jabData.entries pro Konto (Aufwandskonten: Soll-Seite)
    var entries = jabData.entries || [];
    var accMap = {};
    accounts.forEach(function(a) { accMap[a.id] = a; });

    var sollPerAcc = {};
    var habenPerAcc = {};
    // Direktkosten (apartment_id gesetzt): pro Konto + Einheit tracken
    var direktDebitPerAcc  = {}; // { accId: { aptId: amount } }
    var verteilSollPerAcc  = {};
    var verteilHabenPerAcc = {};

    for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei];
        sollPerAcc[e.debit_account_id]   = (sollPerAcc[e.debit_account_id]   || 0) + Number(e.amount);
        habenPerAcc[e.credit_account_id] = (habenPerAcc[e.credit_account_id] || 0) + Number(e.amount);
        if (e.apartment_id) {
            if (!direktDebitPerAcc[e.debit_account_id]) direktDebitPerAcc[e.debit_account_id] = {};
            direktDebitPerAcc[e.debit_account_id][e.apartment_id] =
                (direktDebitPerAcc[e.debit_account_id][e.apartment_id] || 0) + Number(e.amount);
        } else {
            verteilSollPerAcc[e.debit_account_id]   = (verteilSollPerAcc[e.debit_account_id]   || 0) + Number(e.amount);
            verteilHabenPerAcc[e.credit_account_id] = (verteilHabenPerAcc[e.credit_account_id] || 0) + Number(e.amount);
        }
    }

    // Build cost items: Aufwandskonten immer; Ertragskonten nur wenn Verteilerschlüssel gesetzt (erscheinen als negative Kosten)
    var costItems = [];
    accounts.forEach(function(acc) {
        var amount = (sollPerAcc[acc.id] || 0) - (habenPerAcc[acc.id] || 0);
        var isExpense = acc.account_type === 'expense';
        var isKeyedRevenue = acc.account_type === 'revenue' && acc.primary_key_id;
        if (amount !== 0 && (isExpense || isKeyedRevenue)) {
            var verteilAmount = (verteilSollPerAcc[acc.id] || 0) - (verteilHabenPerAcc[acc.id] || 0);
            costItems.push({ account: acc, ist_amount: amount, verteil_amount: verteilAmount });
        }
    });

    // sollIst from jabData for Soll-Ist-Abgleich per apartment
    var sollIst = jabData.sollIst || [];

    // ─── Template-Pfad (bevorzugt) ───────────────────────────
    if (jabTemplate && Array.isArray(jabTemplate.content) && jabTemplate.content.length) {
        var PDFDocument = PDFLib.PDFDocument;
        var rgb = PDFLib.rgb;
        var pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        var fonts;
        try {
            fonts = await _pdfLoadInterFonts(pdfDoc);
        } catch (e) {
            console.error('Inter font load error:', e);
            showToast('Inter-Schriftart konnte nicht geladen werden: ' + e.message, 'error'); return;
        }

        // Letterhead als templateDoc für Seitenerstellung
        var templateDoc = null;
        var useLetterhead = jabTemplate.use_letterhead !== false;
        if (useLetterhead && settings.letterhead_pdf_url) {
            try {
                var sdRes = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
                if (sdRes.data?.signedUrl) {
                    var resp = await fetch(sdRes.data.signedUrl);
                    if (resp.ok) templateDoc = await PDFDocument.load(await resp.arrayBuffer());
                }
            } catch (_) { /* fallback: ohne Briefbogen */ }
            if (!templateDoc) {
                showToast('Briefbogen konnte nicht geladen werden.', 'error'); return;
            }
        }

        // Shared strings
        var bldName = formatBuildingName(bld);
        var bldAddr = (bld.street || '') + ' ' + (bld.house_number || '');
        var bldZipCity = (bld.zip_code || '') + ' ' + (bld.city || '');
        var bldFullAddr = [bldAddr.trim(), bldZipCity.trim()].filter(Boolean).join(', ');
        var dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        var zeitraum = '01.01.' + fy + ' – 31.12.' + fy;
        var dkZeitraum = '01.01.–31.12.' + fy;
        var _typeLabels = DISTRIBUTION_KEY_LABELS;
        var bghText = 'Zur Beschlussfassung steht ausschließlich die Abrechnungsspitze. Etwaige Zahlungsrückstände basieren auf dem Wirtschaftsplan des Vorjahres. Der Abrechnungssaldo dient lediglich der Information. (BGH-Urteil v. 09.03.2012 V ZR 147/11)';
        var monatNamen = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

        // Monats-Daten laden: Soll (payment_demands) + Ist (Journal Konto 1200←1400)
        var { data: monthlyDemands } = await _supabase.from('payment_demands')
            .select('apartment_id, amount, due_date, status')
            .eq('building_id', bid).eq('fiscal_year', fy).eq('demand_type', 'hausgeld');
        var { data: monthlyPayments } = await _supabase.from('journal_entries')
            .select('apartment_id, amount, entry_date, credit_account_id')
            .eq('building_id', bid).eq('fiscal_year', fy)
            .in('entry_type', ['manual', 'sollstellung']);

        // Lookup: Konto 1400 (Forderungen HG) → Zahlungen sind Credits auf 1400
        var acc1400Id = (accounts.find(function(a) { return a.account_number === '1400'; }) || {}).id;

        // Monats-Matrix pro Einheit aufbauen
        function _buildMonatsMatrix(aptId) {
            var rows = [];
            var sollTotal = 0, istTotal = 0;
            for (var m = 0; m < 12; m++) {
                var monthStr = String(m + 1).padStart(2, '0');
                var monthStart = fy + '-' + monthStr + '-01';
                var monthEnd = fy + '-' + monthStr + '-31';
                // Soll: payment_demands für diesen Monat
                var sollMonth = (monthlyDemands || []).filter(function(d) {
                    return d.apartment_id == aptId && d.due_date >= monthStart && d.due_date <= monthEnd;
                }).reduce(function(s, d) { return s + Number(d.amount); }, 0);
                // Ist: Zahlungen (Credits auf Konto 1400 mit apartment_id)
                var istMonth = acc1400Id ? (monthlyPayments || []).filter(function(e) {
                    return e.apartment_id == aptId && e.credit_account_id == acc1400Id
                        && e.entry_date >= monthStart && e.entry_date <= monthEnd;
                }).reduce(function(s, e) { return s + Number(e.amount); }, 0) : 0;
                sollTotal += sollMonth;
                istTotal += istMonth;
                rows.push({
                    monat: monatNamen[m] + ' ' + fy,
                    soll: sollMonth,
                    ist: istMonth,
                    differenz: istMonth - sollMonth,
                });
            }
            rows.push({ monat: 'Gesamt', soll: sollTotal, ist: istTotal, differenz: istTotal - sollTotal });
            return rows;
        }

        function _fmtEur(v) {
            var r = Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
            return r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        }
        function _fmtVal(v) {
            return Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        }

        // calcShare für JAB: nutzt verteil_amount (nur verteilbare Buchungen)
        function _calcShare(costItem, aptId) {
            var acc = costItem.account;
            if (!acc) return { share: 0, keyName: '—' };
            var pkId = acc.primary_key_id;
            var skId = acc.secondary_key_id;
            var skPct = acc.secondary_key_percentage;
            var total = Number(costItem.verteil_amount !== undefined ? costItem.verteil_amount : (costItem.ist_amount || 0));
            if (!pkId || !dkMap[pkId]) return { share: 0, keyName: '—' };
            var pk = dkMap[pkId];
            var pkTotal = Number(pk.total_value) || 0;
            var pkVal = (dkUnitMap[pkId] && dkUnitMap[pkId][aptId]) || 0;
            var keyName = pk.name;
            if (pkTotal === 0) return { share: 0, keyName: keyName };
            if (skId && skPct && dkMap[skId]) {
                var sk = dkMap[skId];
                var skTotal = Number(sk.total_value) || 0;
                var skVal = (dkUnitMap[skId] && dkUnitMap[skId][aptId]) || 0;
                var primaryShare = total * (1 - skPct / 100) * (pkVal / pkTotal);
                var secondaryShare = skTotal > 0 ? total * (skPct / 100) * (skVal / skTotal) : 0;
                keyName = pk.name + '/' + sk.name;
                return { share: primaryShare + secondaryShare, keyName: keyName };
            }
            return { share: total * (pkVal / pkTotal), keyName: keyName };
        }

        // Direktkosten für eine Einheit
        function _getDirektShare(accId, aptId) {
            return (direktDebitPerAcc[accId] && direktDebitPerAcc[accId][aptId]) || 0;
        }

        // Verwendete Verteilerschlüssel sammeln
        function _collectUsedKeys(aptId) {
            var seen = new Set();
            var result = [];
            for (var ci = 0; ci < costItems.length; ci++) {
                var acc = costItems[ci].account;
                if (!acc || !acc.primary_key_id || !dkMap[acc.primary_key_id]) continue;
                var pk = dkMap[acc.primary_key_id];
                if (seen.has(pk.id)) continue;
                seen.add(pk.id);
                var pkTotal = Number(pk.total_value) || 0;
                var pkVal = (dkUnitMap[pk.id] && dkUnitMap[pk.id][aptId]) || 0;
                result.push({ nr: result.length + 1, key: pk, unitVal: pkVal, total: pkTotal });
                if (acc.secondary_key_id && dkMap[acc.secondary_key_id]) {
                    var sk = dkMap[acc.secondary_key_id];
                    if (!seen.has(sk.id)) {
                        seen.add(sk.id);
                        var skTotal = Number(sk.total_value) || 0;
                        var skVal = (dkUnitMap[sk.id] && dkUnitMap[sk.id][aptId]) || 0;
                        result.push({ nr: result.length + 1, key: sk, unitVal: skVal, total: skTotal });
                    }
                }
            }
            return result;
        }

        // Object-level aggregates (same for all apartments)
        var totalCostsAll = costItems.reduce(function(s, ci) { return s + Number(ci.ist_amount); }, 0);
        var sollAll = sollIst.reduce(function(s, r) { return s + Number(r.soll); }, 0);
        var istAll = sollIst.reduce(function(s, r) { return s + Number(r.bezahlt); }, 0);
        var spitzeAll = totalCostsAll - sollAll;
        var zahlDiffAll = sollAll - istAll;

        // ── Vermögensbericht-Daten laden (einmalig für alle Einheiten) ──
        var _jabVermoegenKonten = [];
        var _jabVermoegenFord = [];
        try {
            // Kontensalden aus financial_statements
            var { data: fsData } = await _supabase.from('financial_statements')
                .select('account_id, system_balance, statement_balance, is_validated')
                .eq('building_id', bid).eq('fiscal_year', fy);
            var accLookup = {};
            accounts.forEach(function(a) { accLookup[a.id] = a; });
            var fsTotalSaldo = 0;
            _jabVermoegenKonten = (fsData || []).map(function(fs) {
                var acc = accLookup[fs.account_id];
                var saldo = Number(fs.statement_balance != null ? fs.statement_balance : fs.system_balance);
                fsTotalSaldo += saldo;
                return {
                    konto: acc?.account_number || '–',
                    bezeichnung: acc?.account_name || '–',
                    saldo: saldo,
                    status: fs.is_validated ? 'Geprüft' : 'Ausstehend',
                };
            });
            if (_jabVermoegenKonten.length > 1) {
                _jabVermoegenKonten.push({ konto: '', bezeichnung: 'Gesamt Vermögen (Konten)', saldo: fsTotalSaldo, status: '' });
            }

            // Offene Forderungen zum Stichtag
            var { data: openDemands } = await _supabase.from('payment_demands')
                .select('amount, demand_type, apartment:apartments(apartment_number), person:persons(first_name, last_name)')
                .eq('building_id', bid).lte('due_date', fy + '-12-31').in('status', ['open', 'overdue']);
            var fordTotal = 0;
            _jabVermoegenFord = (openDemands || []).map(function(d) {
                var amt = Number(d.amount);
                fordTotal += amt;
                return {
                    einheit: d.apartment?.apartment_number || '–',
                    eigentuemer: d.person ? [d.person.first_name, d.person.last_name].filter(Boolean).join(' ') : '–',
                    betrag: amt,
                    typ: d.demand_type === 'hausgeld' ? 'Hausgeldrückstand' : d.demand_type || '–',
                };
            });
            if (_jabVermoegenFord.length) {
                _jabVermoegenFord.push({ einheit: '', eigentuemer: 'Gesamt offene Forderungen', betrag: fordTotal, typ: '' });
            }
        } catch (e) { console.error('Vermögensbericht-Daten laden:', e); }

        // ── Seiten je Einheit generieren ─────────────────────
        var aptPageRangesJAB = [];
        for (var ai = 0; ai < apts.length; ai++) {
            var apt = apts[ai];
            var aptPageStartJAB = pdfDoc.getPageCount();
            var owner = ownerMap[apt.id] || {};
            var ownerName = owner.name || 'Eigentümergemeinschaft (Leerstand)';

            // Soll-Ist for this apartment
            var aptSollIst = sollIst.find(function(r) { return r.apt_id === apt.id; }) || { soll: 0, bezahlt: 0 };

            // Total costs for this unit
            var totalCostsUnit = 0;
            for (var ci2 = 0; ci2 < costItems.length; ci2++) {
                totalCostsUnit += _calcShare(costItems[ci2], apt.id).share;
                totalCostsUnit += _getDirektShare(costItems[ci2].account.id, apt.id);
            }
            var sollVorschuesse = Number(aptSollIst.soll) || 0;
            var istBezahlt = Number(aptSollIst.bezahlt) || 0;
            var spitze = totalCostsUnit - sollVorschuesse;
            var zahlDiffUnit = sollVorschuesse - istBezahlt;
            var saldoUnit = spitze + zahlDiffUnit;

            // Labels
            var saldoLabel = saldoUnit > 0 ? 'Nachzahlung' : saldoUnit < 0 ? 'Guthaben' : 'Ausgeglichen';
            var spitzeLabel = spitze > 0 ? 'Unterdeck.' : spitze < 0 ? 'Überdeck.' : 'Ausgeglichen';
            var zdLabel = zahlDiffUnit > 0 ? 'Rückstand' : zahlDiffUnit < 0 ? 'Überzahlung' : 'Planerfüllung';

            var saldoInfo = '';
            if (saldoUnit > 0) saldoInfo = 'Aus der Abrechnung ergibt sich eine Nachzahlung zu Ihren Lasten.';
            else if (saldoUnit < 0) saldoInfo = 'Aus der Abrechnung ergibt sich ein Guthaben zu Ihren Gunsten.';
            else saldoInfo = 'Ihre geleisteten Vorschüsse entsprechen den tatsächlichen Kosten.';

            // Anrede
            var anrede = 'Sehr geehrte Damen und Herren,';
            if (owner.salutation && owner.lastName) {
                if (owner.salutation === 'Herr') anrede = 'Sehr geehrter Herr ' + owner.lastName + ',';
                else if (owner.salutation === 'Frau') anrede = 'Sehr geehrte Frau ' + owner.lastName + ',';
                else if (owner.salutation === 'Eheleute') anrede = 'Sehr geehrte Eheleute ' + owner.lastName + ',';
                else if (owner.salutation === 'Familie') anrede = 'Sehr geehrte Familie ' + owner.lastName + ',';
            }

            // Erste Seite erstellen (Anschreiben)
            var firstPage;
            if (templateDoc) {
                var copied = (await pdfDoc.copyPages(templateDoc, [0]))[0];
                firstPage = pdfDoc.addPage(copied);
            } else {
                firstPage = pdfDoc.addPage([595.28, 841.89]);
            }
            var pgH = firstPage.getSize().height;

            // DIN 5008: Absender, Empfänger, Datum
            _pdfDrawSenderLine(firstPage, fonts.reg, settings);
            _pdfDrawAddressField(firstPage, fonts.reg, ownerName, owner.street || '', [owner.zip_code, owner.city].filter(Boolean).join(' '));
            _pdfDrawDate(firstPage, fonts.reg, settings);

            // Platzhalter-Daten
            var data = {
                abrechnungs_jahr: String(fy),
                abrechnungs_zeitraum: zeitraum,
                einheit_nummer: apt.apartment_number || '–',
                eigentuemer_name: ownerName,
                eigentuemer_adresse: [owner.street, [owner.zip_code, owner.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
                anrede: anrede,
                weg_name: 'WEG ' + bldAddr.trim(),
                objekt_adresse: bldFullAddr || bldName,
                verwalter_firma: settings.company_name || '',
                verwalter_adresse: [settings.street, settings.zip_city].filter(Boolean).join(', '),
                mea: apt.mea || '—',
                flaeche: apt.sq_meters ? apt.sq_meters + ' m²' : '—',
                datum: dateStr,
                firma: settings.company_name || '',
                geschaeftsfuehrer: settings.ceo_name || '',
                empfaenger_name: ownerName,
                empfaenger_strasse: owner.street || '',
                empfaenger_plz_ort: [owner.zip_code, owner.city].filter(Boolean).join(' '),
                ist_kosten_anteil: _fmtEur(totalCostsUnit),
                voraus_zahlungen: _fmtEur(sollVorschuesse),
                abrechnungs_saldo: _fmtEur(Math.abs(saldoUnit)),
                saldo_label: saldoLabel,
                saldo_info: saldoInfo,
                bgh_hinweis: bghText,
            };

            // Tabellen-Daten: Abrechnungsergebnis
            var abrechnungsergebnis = [
                { label: 'Gesamtkosten', gesamt: totalCostsAll, anteil: totalCostsUnit },
                { label: '– HG-Vorschuss Soll', gesamt: sollAll, anteil: sollVorschuesse },
                { label: '= Abrechnungsspitze (' + spitzeLabel + ')', gesamt: spitzeAll, anteil: spitze },
                { label: 'HG-Vorschuss Soll', gesamt: sollAll, anteil: sollVorschuesse },
                { label: '– HG-Vorschuss Ist', gesamt: istAll, anteil: istBezahlt },
                { label: '= Zahlungsdifferenz (' + zdLabel + ')', gesamt: zahlDiffAll, anteil: zahlDiffUnit },
                { label: 'Abrechnungssaldo: ' + saldoLabel, gesamt: '', anteil: Math.abs(saldoUnit) },
            ];

            // Tabellen-Daten: Umlageschlüssel
            var usedKeys = _collectUsedKeys(apt.id);
            var umlageschluessel = usedKeys.map(function(uk) {
                return {
                    nr: String(uk.nr),
                    name: uk.key.name,
                    typ: _typeLabels[uk.key.type] || uk.key.type,
                    zeitraum: dkZeitraum,
                    tage: '365',
                    gesamt: _fmtVal(uk.total),
                    anteil: _fmtVal(uk.unitVal),
                };
            });

            // Tabellen-Daten: Verteilung (flach mit Grand-Total als letzte Zeile)
            var verteilung = [];
            var grandTotalIst = 0, grandTotalShare = 0;
            for (var ci3 = 0; ci3 < costItems.length; ci3++) {
                var item = costItems[ci3];
                var shareRes = _calcShare(item, apt.id);
                var totalShare = shareRes.share + _getDirektShare(item.account.id, apt.id);
                var istAmt = Number(item.ist_amount || 0);
                grandTotalIst += istAmt;
                grandTotalShare += totalShare;
                verteilung.push({
                    konto: item.account?.account_number || '–',
                    bezeichnung: item.account?.account_name || '–',
                    schluessel: shareRes.keyName,
                    gesamt: istAmt,
                    anteil: totalShare,
                });
            }
            verteilung.push({
                konto: '',
                bezeichnung: 'Gesamt Ist-Kosten',
                schluessel: '',
                gesamt: grandTotalIst,
                anteil: grandTotalShare,
            });

            var jabMonatsMatrix = _buildMonatsMatrix(apt.id);

            // Vermögensbericht-Tabellen (gleich für alle Einheiten im Gebäude)
            var vermoegenKonten = _jabVermoegenKonten || [];
            var vermoegenForderungen = _jabVermoegenFord || [];

            var tables = {
                abrechnungsergebnis: abrechnungsergebnis,
                jab_monats_matrix: jabMonatsMatrix,
                umlageschluessel: umlageschluessel,
                verteilung: verteilung,
                vermoegen_konten: vermoegenKonten,
                vermoegen_forderungen: vermoegenForderungen,
            };

            await generateFromTemplate(jabTemplate.content, data, tables, {
                pdfDoc: pdfDoc, page: firstPage, fonts: fonts, settings: settings, templateDoc: templateDoc,
                startY: pgH - 200,
            });

            aptPageRangesJAB.push({ aptId: apt.id, start: aptPageStartJAB, end: pdfDoc.getPageCount() - 1 });
        }

        var pdfBytes = await pdfDoc.save();
        if (saveForETV) {
            await _pdfSplitAndUpload(pdfBytes, aptPageRangesJAB, bid, fy, 'jab');
        } else {
            var filename = 'Jahresabrechnung_' + fy + '_' + bldName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
            _pdfDownload(pdfBytes, filename);
            showToast(apts.length + ' Einzelabrechnungen als PDF heruntergeladen.');
        }
        return;
    }

    // ─── Legacy-Fallback (hardcoded Layout) ──────────────────
    // Letterhead template
    var PDFDocument = PDFLib.PDFDocument;
    var rgb = PDFLib.rgb;
    if (!settings.letterhead_pdf_url) {
        showToast('Kein Briefbogen hinterlegt. Bitte unter Einstellungen → Briefpapier & Logo hochladen.', 'error'); return;
    }
    var signedRes = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
    if (!signedRes.data?.signedUrl) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
    var lhResp = await fetch(signedRes.data.signedUrl);
    if (!lhResp.ok) { showToast('Briefbogen konnte nicht geladen werden.', 'error'); return; }
    var templateBytes = await lhResp.arrayBuffer();
    var templateDoc   = await PDFDocument.load(templateBytes);

    var pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Embed Inter fonts
    var fReg, fSemi, fBold;
    try {
        var fonts = await _pdfLoadInterFonts(pdfDoc);
        fReg = fonts.reg; fSemi = fonts.semi; fBold = fonts.bold;
    } catch (err) {
        console.error('Inter font load error:', err);
        showToast('Inter-Schriftart konnte nicht geladen werden: ' + err.message, 'error'); return;
    }

    // Colors
    var olive    = rgb(0.408, 0.455, 0.318);
    var offblack = rgb(0.216, 0.216, 0.216);
    var orange   = rgb(0.922, 0.463, 0.176);
    var gray50   = rgb(0.5, 0.5, 0.5);
    var gray40   = rgb(0.4, 0.4, 0.4);
    var white    = rgb(1, 1, 1);

    // Page margins
    var mLeft    = 56.7;
    var mRight   = 538.6;
    var contentW = mRight - mLeft;
    var mBottom  = 100;
    var contentStartY = 100;

    var bldName   = formatBuildingName(bld);
    var bldAddr   = (bld.street || '') + ' ' + (bld.house_number || '');
    var bldZipCity = (bld.zip_code || '') + ' ' + (bld.city || '');
    var bldFullAddr = [bldAddr.trim(), bldZipCity.trim()].filter(Boolean).join(', ');
    var dateStr    = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var zeitraum   = '01.01.' + fy + ' – 31.12.' + fy;

    // Header text for continuation pages
    var wegHeaderText = 'Hausgeldabrechnung | WEG ' + bldFullAddr;

    // Helpers
    function drawR(pg, text, xRight, yPos, size, font, color) {
        var w = font.widthOfTextAtSize(text, size);
        pg.drawText(text, { x: xRight - w, y: yPos, size: size, font: font, color: color });
    }
    function fmt(v) {
        var r = Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
        return r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
    function fmtVal(v) {
        return Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    var typeLabels = DISTRIBUTION_KEY_LABELS;

    // Distribution key share calculation
    function calcShare(costItem, aptId) {
        var acc = costItem.account;
        if (!acc) return { share: 0, keyName: '—' };
        var pkId = acc.primary_key_id;
        var skId = acc.secondary_key_id;
        var skPct = acc.secondary_key_percentage;
        var total = Number(costItem.verteil_amount !== undefined ? costItem.verteil_amount : (costItem.ist_amount || 0));
        if (!pkId || !dkMap[pkId]) return { share: 0, keyName: '—' };
        var pk = dkMap[pkId];
        var pkTotal = Number(pk.total_value) || 0;
        var pkVal   = (dkUnitMap[pkId] && dkUnitMap[pkId][aptId]) || 0;
        var keyName = pk.name;
        if (pkTotal === 0) return { share: 0, keyName: keyName };
        if (skId && skPct && dkMap[skId]) {
            var sk = dkMap[skId];
            var skTotal = Number(sk.total_value) || 0;
            var skVal   = (dkUnitMap[skId] && dkUnitMap[skId][aptId]) || 0;
            var primaryShare   = total * (1 - skPct / 100) * (pkVal / pkTotal);
            var secondaryShare = skTotal > 0 ? total * (skPct / 100) * (skVal / skTotal) : 0;
            keyName = pk.name + '/' + sk.name;
            return { share: primaryShare + secondaryShare, keyName: keyName };
        }
        return { share: total * (pkVal / pkTotal), keyName: keyName };
    }

    // Direktkosten für eine Einheit: apartment_id-gebuchte Aufwände (nicht über Schlüssel verteilt)
    function getDirektShare(accId, aptId) {
        return (direktDebitPerAcc[accId] && direktDebitPerAcc[accId][aptId]) || 0;
    }

    // Table helpers
    var hdrFS = 8;
    var padV = 4;
    var minRowH = 18;
    var sectionH = 16;
    var subtotalH = 20;
    var grandTotalH = 22;
    var dividerColor = rgb(0.88, 0.89, 0.86);
    var zebraColor   = rgb(0.976, 0.98, 0.973);
    var grayDeemph   = rgb(0.612, 0.639, 0.682);

    function drawTableHeader(pg, yPos, cols) {
        var hH = Math.max(22, hdrFS * 1.35 + 8);
        pg.drawRectangle({ x: mLeft, y: yPos - hH, width: contentW, height: hH, color: olive });
        var baseY = yPos - 5 - hdrFS;
        cols.forEach(function(c) {
            if (c.align === 'right') drawR(pg, c.label, c.x, baseY, hdrFS, fBold, white);
            else pg.drawText(c.label, { x: c.x, y: baseY, size: hdrFS, font: fBold, color: white });
        });
        return hH;
    }
    function splitLines(text, font, fs, maxW, maxL) {
        var all = _pdfSplitText(text, font, fs, maxW);
        if (all.length <= maxL) return all;
        var out = all.slice(0, maxL);
        var last = out[maxL - 1];
        while (last.length > 3 && font.widthOfTextAtSize(last + '…', fs) > maxW) last = last.slice(0, -1);
        out[maxL - 1] = last + '…';
        return out;
    }
    function drawCell(pg, lines, x, cellTop, lineH, fs, font, color) {
        var textY = cellTop - padV - lineH;
        for (var li = 0; li < lines.length; li++) {
            pg.drawText(lines[li], { x: x + 2, y: textY, size: fs, font: font, color: color });
            textY -= lineH;
        }
    }
    function drawCellSingle(pg, text, x, cellTop, lineH, fs, font, color) {
        pg.drawText(text, { x: x + 2, y: cellTop - padV - lineH, size: fs, font: font, color: color });
    }
    function drawCellR(pg, text, xRight, cellTop, lineH, fs, font, color) {
        var w = font.widthOfTextAtSize(text, fs);
        pg.drawText(text, { x: xRight - w - 2, y: cellTop - padV - lineH, size: fs, font: font, color: color });
    }

    // Cost table column positions
    var bezFS  = 9;
    var keyFS  = 7.5;
    var costLH = Math.ceil(bezFS * 1.3);
    var cKonto   = mLeft + 2;
    var cBez     = mLeft + 39;
    var cBezW    = 138;
    var cKey     = mLeft + 183;
    var cKeyW    = 108;
    var cGesamtR = mLeft + 380;
    var cAnteilR = mRight - 2;

    // Umlageschlüssel table columns
    var dkFS  = 7.5;
    var dkLH  = Math.ceil(dkFS * 1.3);
    var dk0   = mLeft + 2;
    var dk1   = mLeft + 30;
    var dk1W  = 115;
    var dk2   = mLeft + 149;
    var dk3   = mLeft + 211;
    var dk4r  = mLeft + 344;
    var dk5r  = mLeft + 415;
    var dk6r  = mRight - 2;

    // Page creation helpers
    function drawPageHeaderCompact(pg, pgHeight) {
        var headerY = pgHeight - contentStartY;
        pg.drawText(wegHeaderText, { x: mLeft, y: headerY, size: 8.5, font: fBold, color: offblack });
        drawR(pg, dateStr, mRight, headerY, 8.5, fReg, gray50);
        pg.drawLine({ start: { x: mLeft, y: headerY - 6 }, end: { x: mRight, y: headerY - 6 }, thickness: 0.5, color: dividerColor });
        return headerY - 16;
    }
    async function addPage() {
        var copied = (await pdfDoc.copyPages(templateDoc, [0]))[0];
        var pg = pdfDoc.addPage(copied);
        var pgH = pg.getSize().height;
        var startY = drawPageHeaderCompact(pg, pgH);
        return { page: pg, height: pgH, y: startY };
    }
    async function addFirstPage() {
        var copied = (await pdfDoc.copyPages(templateDoc, [0]))[0];
        var pg = pdfDoc.addPage(copied);
        var pgH = pg.getSize().height;
        var startY = pgH - contentStartY;
        drawR(pg, dateStr, mRight, startY, 8.5, fReg, gray50);
        return { page: pg, height: pgH, y: startY };
    }

    // Collect unique distribution keys used by cost items
    function collectUsedKeys(aptId) {
        var seen = new Set();
        var result = [];
        for (var ci = 0; ci < costItems.length; ci++) {
            var acc = costItems[ci].account;
            if (!acc || !acc.primary_key_id || !dkMap[acc.primary_key_id]) continue;
            var pk = dkMap[acc.primary_key_id];
            if (seen.has(pk.id)) continue;
            seen.add(pk.id);
            var pkTotal = Number(pk.total_value) || 0;
            var pkVal   = (dkUnitMap[pk.id] && dkUnitMap[pk.id][aptId]) || 0;
            result.push({ nr: result.length + 1, key: pk, unitVal: pkVal, total: pkTotal });
            if (acc.secondary_key_id && dkMap[acc.secondary_key_id]) {
                var sk = dkMap[acc.secondary_key_id];
                if (!seen.has(sk.id)) {
                    seen.add(sk.id);
                    var skTotal = Number(sk.total_value) || 0;
                    var skVal   = (dkUnitMap[sk.id] && dkUnitMap[sk.id][aptId]) || 0;
                    result.push({ nr: result.length + 1, key: sk, unitVal: skVal, total: skTotal });
                }
            }
        }
        return result;
    }

    // ── Generate pages per apartment ─────────────────────────
    var aptPageRangesJAB = [];
    for (var ai = 0; ai < apts.length; ai++) {
        var apt = apts[ai];
        var aptPageStartJAB = pdfDoc.getPageCount();
        var owner = ownerMap[apt.id] || {};
        var ownerName = owner.name || 'Eigentümergemeinschaft (Leerstand)';

        // Soll-Ist for this apartment
        var aptSollIst = sollIst.find(function(r) { return r.apt_id === apt.id; }) || { soll: 0, bezahlt: 0 };

        // Total costs for this unit (distributed via keys)
        var totalCostsUnit = 0;
        for (var ci2 = 0; ci2 < costItems.length; ci2++) {
            totalCostsUnit += calcShare(costItems[ci2], apt.id).share;
            totalCostsUnit += getDirektShare(costItems[ci2].account.id, apt.id);
        }
        var sollVorschuesse = Number(aptSollIst.soll) || 0;
        var istBezahlt      = Number(aptSollIst.bezahlt) || 0;
        var spitze          = totalCostsUnit - sollVorschuesse; // positiv = Nachzahlung
        var zahlDiffUnit    = sollVorschuesse - istBezahlt;     // positiv = Rückstand
        var saldoUnit       = spitze + zahlDiffUnit;            // das zahlt/bekommt der Eigentümer

        // ══════════════════════════════════════════════════════════
        // ── SEITE 1: ANSCHREIBEN ─────────────────────────────────
        // ══════════════════════════════════════════════════════════
        var pg1 = await addFirstPage();
        var page = pg1.page;
        var height = pg1.height;
        var y = pg1.y;

        // Absender-Zeile
        _pdfDrawSenderLine(page, fReg, settings);

        // Empfänger-Adressfeld
        var addrName = ownerName;
        var addrStreet = owner.street || '';
        var addrCity = [owner.zip_code, owner.city].filter(Boolean).join(' ');
        _pdfDrawAddressField(page, fReg, addrName, addrStreet, addrCity);

        // Datum
        _pdfDrawDate(page, fReg, settings);

        // Betreff
        page.drawText('Hausgeldabrechnung für das Jahr ' + fy, {
            x: mLeft, y: height - 200, size: 11, font: fBold, color: offblack,
        });

        // Anrede
        var anrede = 'Sehr geehrte Damen und Herren,';
        if (owner.salutation && owner.lastName) {
            if (owner.salutation === 'Herr') anrede = 'Sehr geehrter Herr ' + owner.lastName + ',';
            else if (owner.salutation === 'Frau') anrede = 'Sehr geehrte Frau ' + owner.lastName + ',';
            else if (owner.salutation === 'Eheleute') anrede = 'Sehr geehrte Eheleute ' + owner.lastName + ',';
            else if (owner.salutation === 'Familie') anrede = 'Sehr geehrte Familie ' + owner.lastName + ',';
        }
        page.drawText(anrede, { x: mLeft, y: height - 230, size: 10, font: fReg, color: offblack });

        // Einleitungstext
        var weNr = apt.apartment_number || '–';
        var wegLabel = 'WEG ' + bldAddr.trim();
        y = height - 255;
        var introStr = 'für Ihre Einheit ' + weNr + ' in der ' + wegLabel + ' übersenden wir Ihnen die Hausgeldabrechnung für das Wirtschaftsjahr ' + fy + '. ';
        if (saldoUnit > 0) {
            introStr += 'Aus der Abrechnung ergibt sich eine Nachzahlung zu Ihren Lasten.';
        } else if (saldoUnit < 0) {
            introStr += 'Aus der Abrechnung ergibt sich ein Guthaben zu Ihren Gunsten.';
        } else {
            introStr += 'Ihre geleisteten Vorschüsse entsprechen den tatsächlichen Kosten.';
        }
        var introLines = _pdfSplitText(introStr, fReg, 10, contentW);
        for (var ti = 0; ti < introLines.length; ti++) {
            page.drawText(introLines[ti], { x: mLeft, y: y, size: 10, font: fReg, color: offblack });
            y -= 15;
        }
        y -= 15;

        // Ergebnis-Highlight-Box (Abrechnungssaldo)
        var saldoLabel1 = saldoUnit > 0 ? 'Nachzahlung' : saldoUnit < 0 ? 'Guthaben' : 'Ausgeglichen';
        var saldoColor1 = saldoUnit > 0 ? orange : saldoUnit < 0 ? olive : gray50;
        var boxH = 52;
        page.drawRectangle({ x: mLeft, y: y - boxH, width: contentW, height: boxH, color: rgb(0.969, 0.973, 0.961), borderColor: olive, borderWidth: 0.75 });
        var boxMid = y - boxH / 2;
        page.drawText('Abrechnungssaldo:', { x: mLeft + 12, y: boxMid + 6, size: 9, font: fSemi, color: gray50 });
        page.drawText(saldoLabel1, { x: mLeft + 12, y: boxMid - 10, size: 10, font: fSemi, color: saldoColor1 });
        drawR(page, fmt(Math.abs(saldoUnit)), mRight - 12, boxMid - 2, 16, fBold, saldoColor1);
        y -= boxH + 20;

        // Schlusstext
        var closingLines = [
            'Die Abrechnung wird der nächsten Eigentümerversammlung zur',
            'Beschlussfassung vorgelegt. Bis dahin gilt der aktuelle Wirtschaftsplan.',
            '',
            'Die detaillierte Einzelabrechnung finden Sie auf der folgenden Seite.',
            '',
            'Mit freundlichen Grüßen',
        ];
        for (var cli = 0; cli < closingLines.length; cli++) {
            if (closingLines[cli] === '') { y -= 8; continue; }
            page.drawText(closingLines[cli], { x: mLeft, y: y, size: 10, font: fReg, color: offblack });
            y -= 15;
        }
        y -= 25;
        if (settings.company_name) {
            page.drawText(settings.company_name, { x: mLeft, y: y, size: 10, font: fBold, color: offblack });
        }
        if (settings.ceo_name) {
            page.drawText(settings.ceo_name, { x: mLeft, y: y - 15, size: 10, font: fReg, color: gray40 });
        }

        // ══════════════════════════════════════════════════════════
        // ── SEITE 2+: EINZELABRECHNUNG (wie Einzelwirtschaftsplan)
        // ══════════════════════════════════════════════════════════
        var pg2 = await addFirstPage();
        page = pg2.page; height = pg2.height; y = pg2.y;

        // Titel
        page.drawText('Hausgeldabrechnung ' + fy, { x: mLeft, y: y, size: 16, font: fBold, color: offblack });
        y -= 18;
        page.drawText('Einzelabrechnung', { x: mLeft, y: y, size: 12, font: fSemi, color: gray50 });
        y -= 22;

        // Objekt- & Verwalter-Block (zweispaltig)
        var boxPad = 6;
        var halfW  = (contentW - 8) / 2;
        var rColX  = mLeft + halfW + 8;
        var lH2 = boxPad + 10 + 10 + 12 + 10;
        var rH2 = boxPad + 10 + 10;
        if (settings.street) rH2 += 10;
        if (settings.zip_city) rH2 += 10;
        if (settings.tax_number) rH2 += 10;
        var boxH2 = Math.max(lH2, rH2) + boxPad;
        var boxBottom2 = y - boxH2;

        page.drawRectangle({ x: mLeft, y: boxBottom2, width: contentW, height: boxH2, borderColor: dividerColor, borderWidth: 0.75, color: white });
        page.drawLine({ start: { x: mLeft + halfW, y: y - 3 }, end: { x: mLeft + halfW, y: boxBottom2 + 3 }, thickness: 0.5, color: dividerColor });

        var lY2 = y - boxPad - 7;
        page.drawText('Objekt', { x: mLeft + boxPad, y: lY2, size: 6.5, font: fBold, color: gray50 }); lY2 -= 10;
        page.drawText(bldFullAddr || bldName, { x: mLeft + boxPad, y: lY2, size: 8.5, font: fSemi, color: offblack }); lY2 -= 12;
        page.drawText('Abrechnungszeitraum', { x: mLeft + boxPad, y: lY2, size: 6.5, font: fBold, color: gray50 }); lY2 -= 10;
        page.drawText(zeitraum, { x: mLeft + boxPad, y: lY2, size: 8.5, font: fReg, color: offblack });

        var rY2 = y - boxPad - 7;
        page.drawText('Verwalter', { x: rColX, y: rY2, size: 6.5, font: fBold, color: gray50 }); rY2 -= 10;
        if (settings.company_name) { page.drawText(settings.company_name, { x: rColX, y: rY2, size: 8.5, font: fSemi, color: offblack }); rY2 -= 10; }
        if (settings.street)       { page.drawText(settings.street, { x: rColX, y: rY2, size: 8, font: fReg, color: gray40 }); rY2 -= 10; }
        if (settings.zip_city)     { page.drawText(settings.zip_city, { x: rColX, y: rY2, size: 8, font: fReg, color: gray40 }); rY2 -= 10; }
        if (settings.tax_number)   { page.drawText('St.-Nr. ' + settings.tax_number, { x: rColX, y: rY2, size: 7.5, font: fReg, color: gray50 }); }

        y = boxBottom2 - 8;

        // Eigentümer-Box
        var ownBoxTop = y;
        var ownH = boxPad + 7 + 10;
        if (owner.street) ownH += 10;
        if (owner.zip_code || owner.city) ownH += 10;
        ownH += 11 + 10 + boxPad;
        var ownBoxBottom = ownBoxTop - ownH;

        page.drawRectangle({ x: mLeft, y: ownBoxBottom, width: contentW, height: ownH, borderColor: olive, borderWidth: 0.75, color: white });
        var oY = ownBoxTop - boxPad - 7;
        page.drawText('Eigentümer:', { x: mLeft + boxPad, y: oY, size: 6.5, font: fBold, color: gray50 }); oY -= 10;
        page.drawText(ownerName, { x: mLeft + boxPad, y: oY, size: 9, font: fBold, color: offblack });
        if (owner.street) { oY -= 10; page.drawText(owner.street, { x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: gray40 }); }
        if (owner.zip_code || owner.city) { oY -= 10; page.drawText([owner.zip_code, owner.city].filter(Boolean).join(' '), { x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: gray40 }); }
        oY -= 11;
        page.drawText('Verwaltungseinheit:', { x: mLeft + boxPad, y: oY, size: 6.5, font: fBold, color: gray50 }); oY -= 10;
        page.drawText('WE ' + apt.apartment_number + (apt.floor ? ' – ' + apt.floor : '') + '    |    MEA: ' + (apt.mea || '—') + '    |    Fläche: ' + (apt.sq_meters ? apt.sq_meters + ' m²' : '—'), {
            x: mLeft + boxPad, y: oY, size: 8, font: fReg, color: offblack });

        y = ownBoxBottom - 12;

        // ── BLOCK 2: ZUSAMMENFASSUNG (Dreispaltig) ─────────────
        page.drawText('Abrechnungsergebnis', { x: mLeft, y: y, size: 10, font: fBold, color: olive }); y -= 10;

        var totalCostsAll = costItems.reduce(function(s, ci3) { return s + Number(ci3.ist_amount); }, 0);
        var sollAll = sollIst.reduce(function(s, r) { return s + Number(r.soll); }, 0);
        var istAll  = sollIst.reduce(function(s, r) { return s + Number(r.bezahlt); }, 0);
        var spitzeAll = totalCostsAll - sollAll;
        var zahlDiffAll  = sollAll - istAll;

        var colObjR  = mLeft + contentW * 0.62;
        var colUnitR = mRight - 4;
        var summCols = [
            { x: mLeft + 4, label: 'Berechnung Ihres Anteils', align: 'left' },
            { x: colObjR, label: 'Objekt gesamt', align: 'right' },
            { x: colUnitR, label: 'Ihr Anteil', align: 'right' },
        ];
        y -= drawTableHeader(page, y, summCols);

        var summFS  = 8.5;
        var summLH  = Math.ceil(summFS * 1.3);
        var summRH  = 18;
        var summTRH = 32; // result rows with label + amount

        // Helper: draw a normal summary row
        var drawSummRow = function(label, objVal, unitVal, isSubtract) {
            var prefix = isSubtract ? '–  ' : '   ';
            var rowBase2 = y - padV - summLH;
            page.drawText(prefix + label, { x: mLeft + 4, y: rowBase2, size: summFS, font: fReg, color: offblack });
            if (objVal !== null) drawR(page, fmt(objVal), colObjR, rowBase2, summFS, fReg, grayDeemph);
            drawR(page, fmt(unitVal), colUnitR, rowBase2, summFS, fReg, offblack);
            y -= summRH;
            page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 0.3, color: dividerColor });
        };

        // Helper: draw a result row (label on first line, amount on second)
        var drawResultRow = function(label, objVal, unitLabel, unitVal, resultColor) {
            page.drawRectangle({ x: mLeft, y: y - summTRH, width: contentW, height: summTRH, color: zebraColor });
            page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 0.8, color: olive });
            var line1Y = y - padV - summLH;
            page.drawText('=  ' + label, { x: mLeft + 4, y: line1Y, size: summFS, font: fSemi, color: olive });
            if (objVal !== null) drawR(page, fmt(objVal), colObjR, line1Y, summFS, fSemi, grayDeemph);
            drawR(page, unitLabel, colUnitR, line1Y, summFS, fSemi, resultColor);
            var line2Y = line1Y - summLH - 1;
            drawR(page, fmt(Math.abs(unitVal)), colUnitR, line2Y, 9, fBold, resultColor);
            y -= summTRH;
            page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 0.3, color: dividerColor });
        };

        // Row 1: Gesamtkosten
        drawSummRow('Gesamtkosten', totalCostsAll, totalCostsUnit, false);
        // Row 2: - HG-Vorschuss Soll
        drawSummRow('HG-Vorschuss Soll', sollAll, sollVorschuesse, true);
        // Row 3: = Abrechnungsspitze
        var spLabel1 = spitze > 0 ? 'Unterdeck.' : spitze < 0 ? 'Überdeck.' : 'Ausgeglichen';
        var spitzeColor = spitze > 0 ? orange : spitze < 0 ? olive : gray50;
        drawResultRow('Abrechnungsspitze', spitzeAll, spLabel1, spitze, spitzeColor);

        y -= 4;
        // Row 4: HG-Vorschuss Soll
        drawSummRow('HG-Vorschuss Soll', sollAll, sollVorschuesse, false);
        // Row 5: - HG-Vorschuss Ist
        drawSummRow('HG-Vorschuss Ist', istAll, istBezahlt, true);
        // Row 6: = Zahlungsdifferenz
        var zdLabel = zahlDiffUnit > 0 ? 'Rückstand' : zahlDiffUnit < 0 ? 'Überzahlung' : 'Planerfüllung';
        var zdColor = zahlDiffUnit > 0 ? orange : zahlDiffUnit < 0 ? olive : gray50;
        drawResultRow('Zahlungsdifferenz', zahlDiffAll, zdLabel, zahlDiffUnit, zdColor);

        y -= 4;
        // Row 7: = Abrechnungssaldo (grand total)
        var saldoLabel = saldoUnit > 0 ? 'Nachzahlung' : saldoUnit < 0 ? 'Guthaben' : 'Ausgeglichen';
        var saldoColor = saldoUnit > 0 ? orange : saldoUnit < 0 ? olive : gray50;
        var saldoRowH  = 28;
        page.drawRectangle({ x: mLeft, y: y - saldoRowH, width: contentW, height: saldoRowH, color: olive });
        page.drawLine({ start: { x: mLeft, y: y }, end: { x: mRight, y: y }, thickness: 1.5, color: olive });
        var sLine1Y = y - padV - summLH;
        page.drawText('=  Abrechnungssaldo', { x: mLeft + 4, y: sLine1Y, size: 9, font: fBold, color: white });
        drawR(page, saldoLabel + '  ' + fmt(Math.abs(saldoUnit)), colUnitR, sLine1Y, 9, fBold, white);
        y -= saldoRowH;

        // BGH-Hinweis unter Summary
        y -= 10;
        var bghText = 'Zur Beschlussfassung steht ausschließlich die Abrechnungsspitze. Etwaige Zahlungsrückstände basieren auf dem Wirtschaftsplan des Vorjahres. Der Abrechnungssaldo dient lediglich der Information. (BGH-Urteil v. 09.03.2012 V ZR 147/11)';
        var bghFS = 7.5;
        var bghLH = Math.ceil(bghFS * 1.3);
        var bghLines = _pdfSplitText(bghText, fReg, bghFS, contentW - 8);
        var bghBoxH  = 8 + bghLines.length * bghLH + 6;
        page.drawRectangle({ x: mLeft, y: y - bghBoxH, width: contentW, height: bghBoxH, borderColor: dividerColor, borderWidth: 0.5, color: rgb(0.98, 0.98, 0.98) });
        for (var bgi = 0; bgi < bghLines.length; bgi++) {
            page.drawText(bghLines[bgi], { x: mLeft + 4, y: y - 8 - bgi * bghLH, size: bghFS, font: fReg, color: gray50 });
        }
        y -= bghBoxH + 16;

        // ── BLOCK 3: UMLAGESCHLÜSSEL-TABELLE ──────────────────
        var usedKeys = collectUsedKeys(apt.id);
        if (y - 60 < mBottom) {
            var np = await addPage();
            page = np.page; height = np.height; y = np.y;
        }
        page.drawText('Umlageschlüssel', { x: mLeft, y: y, size: 10, font: fBold, color: olive }); y -= 10;

        var dkCols = [
            { x: dk0, label: 'Nr.', align: 'left' },
            { x: dk1, label: 'Schlüssel', align: 'left' },
            { x: dk2, label: 'Umlage-Typ', align: 'left' },
            { x: dk3, label: 'Zeitraum', align: 'left' },
            { x: dk4r, label: 'Tage', align: 'right' },
            { x: dk5r, label: 'Gesamtumlage', align: 'right' },
            { x: dk6r, label: 'Ihr Anteil', align: 'right' },
        ];
        y -= drawTableHeader(page, y, dkCols);

        var dkZeitraum = '01.01.–31.12.' + fy;
        for (var ki = 0; ki < usedKeys.length; ki++) {
            var uk = usedKeys[ki];
            var nameLines = splitLines(uk.key.name, fReg, dkFS, dk1W - 4, 2);
            var nLines = Math.max(nameLines.length, 1);
            var dkRowH = Math.max(minRowH, nLines * dkLH + padV * 2);
            if (y - dkRowH < mBottom) {
                var np2 = await addPage();
                page = np2.page; height = np2.height; y = np2.y;
                y -= drawTableHeader(page, y, dkCols);
            }
            var cellTop = y;
            if (ki % 2 === 1) page.drawRectangle({ x: mLeft, y: cellTop - dkRowH, width: contentW, height: dkRowH, color: zebraColor });
            drawCellSingle(page, '' + uk.nr, dk0, cellTop, dkLH, dkFS, fReg, gray40);
            drawCell(page, nameLines, dk1, cellTop, dkLH, dkFS, fReg, offblack);
            drawCellSingle(page, typeLabels[uk.key.type] || uk.key.type, dk2, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellSingle(page, dkZeitraum, dk3, cellTop, dkLH, 7, fReg, gray50);
            drawCellR(page, '365', dk4r, cellTop, dkLH, dkFS, fReg, gray50);
            drawCellR(page, fmtVal(uk.total), dk5r, cellTop, dkLH, dkFS, fReg, gray40);
            drawCellR(page, fmtVal(uk.unitVal), dk6r, cellTop, dkLH, dkFS, fSemi, offblack);
            page.drawLine({ start: { x: mLeft, y: cellTop - dkRowH }, end: { x: mRight, y: cellTop - dkRowH }, thickness: 0.3, color: dividerColor });
            y -= dkRowH;
        }
        y -= 20;

        // ── BLOCK 4: VERTEILUNGSERGEBNIS ──────────────────────
        var expenseItems = costItems.filter(function(it) { return it.account && it.account.is_allocatable; });
        var otherItems   = costItems.filter(function(it) { return !it.account || !it.account.is_allocatable; });

        if (y - 70 < mBottom) {
            var np3 = await addPage();
            page = np3.page; height = np3.height; y = np3.y;
        }
        page.drawText('Verteilungsergebnis', { x: mLeft, y: y, size: 10, font: fBold, color: olive }); y -= 10;

        var costCols = [
            { x: cKonto, label: 'Konto', align: 'left' },
            { x: cBez, label: 'Bezeichnung', align: 'left' },
            { x: cKey, label: 'Schlüssel', align: 'left' },
            { x: cGesamtR, label: 'Ist-Kosten', align: 'right' },
            { x: cAnteilR, label: 'Ihr Anteil', align: 'right' },
        ];
        y -= drawTableHeader(page, y, costCols);

        // Draw cost section with page-break support
        var drawCostSection = async function(sectionLabel, items, startY, startIdx) {
            var cy = startY;
            var ri = startIdx;
            var sTotal = 0, sShare = 0;
            var curPage = page;

            // Section header
            if (cy - sectionH < mBottom) {
                var npc = await addPage();
                curPage = npc.page; page = npc.page; height = npc.height; cy = npc.y;
                cy -= drawTableHeader(curPage, cy, costCols);
            }
            curPage.drawRectangle({ x: mLeft, y: cy - sectionH, width: contentW, height: sectionH, color: rgb(0.94, 0.95, 0.93) });
            curPage.drawText(sectionLabel, { x: mLeft + 4, y: cy - sectionH + 4, size: 8, font: fSemi, color: olive });
            cy -= sectionH;

            var rowData = items.map(function(costItem) {
                var istAmt = Number(costItem.ist_amount || 0);
                var shareRes = calcShare(costItem, apt.id);
                var totalShare = shareRes.share + getDirektShare(costItem.account.id, apt.id);
                var bezLines2 = splitLines(costItem.account?.account_name || '–', fReg, bezFS, cBezW, 2);
                var keyLines2 = splitLines(shareRes.keyName, fReg, keyFS, cKeyW, 2);
                var maxLines2 = Math.max(bezLines2.length, keyLines2.length, 1);
                var rowH2 = Math.max(minRowH, maxLines2 * costLH + padV * 2);
                return { item: costItem, istAmt: istAmt, share: totalShare, bezLines: bezLines2, keyLines: keyLines2, rowH: rowH2 };
            });

            for (var rdi = 0; rdi < rowData.length; rdi++) {
                var rd = rowData[rdi];
                if (cy - rd.rowH < mBottom) {
                    var npc2 = await addPage();
                    curPage = npc2.page; page = npc2.page; height = npc2.height; cy = npc2.y;
                    cy -= drawTableHeader(curPage, cy, costCols);
                }
                sTotal += rd.istAmt;
                sShare += rd.share;
                var ct = cy;
                if (ri % 2 === 1) curPage.drawRectangle({ x: mLeft, y: ct - rd.rowH, width: contentW, height: rd.rowH, color: zebraColor });
                drawCellSingle(curPage, rd.item.account?.account_number || '–', cKonto, ct, costLH, 8, fReg, gray40);
                drawCell(curPage, rd.bezLines, cBez, ct, costLH, bezFS, fReg, offblack);
                drawCell(curPage, rd.keyLines, cKey, ct, costLH, keyFS, fReg, gray50);
                drawCellR(curPage, fmt(rd.istAmt), cGesamtR, ct, costLH, 8, fReg, gray40);
                var sFont  = rd.share > 0 ? fSemi : fReg;
                var sColor = rd.share > 0 ? offblack : rgb(0.6, 0.6, 0.6);
                drawCellR(curPage, fmt(rd.share), cAnteilR, ct, costLH, 8, sFont, sColor);
                curPage.drawLine({ start: { x: mLeft, y: ct - rd.rowH }, end: { x: mRight, y: ct - rd.rowH }, thickness: 0.3, color: dividerColor });
                cy -= rd.rowH;
                ri++;
            }

            // Subtotal
            if (cy - subtotalH < mBottom) {
                var npc3 = await addPage();
                curPage = npc3.page; page = npc3.page; height = npc3.height; cy = npc3.y;
            }
            curPage.drawRectangle({ x: mLeft, y: cy - subtotalH, width: contentW, height: subtotalH, color: rgb(0.94, 0.95, 0.93) });
            curPage.drawText('Zwischensumme ' + sectionLabel, { x: mLeft + 4, y: cy - subtotalH + 5, size: 8, font: fSemi, color: offblack });
            drawR(curPage, fmt(sTotal), cGesamtR - 2, cy - subtotalH + 5, 8, fSemi, gray40);
            drawR(curPage, fmt(sShare), cAnteilR - 2, cy - subtotalH + 5, 8, fBold, olive);
            cy -= subtotalH;
            return { y: cy, ri: ri, total: sTotal, share: sShare };
        };

        var costIdx = 0;
        var grandTotal = 0, grandShare = 0;
        if (expenseItems.length) {
            var res1 = await drawCostSection('Umlagefähige Kosten', expenseItems, y, costIdx);
            y = res1.y; costIdx = res1.ri; grandTotal += res1.total; grandShare += res1.share;
        }
        if (otherItems.length) {
            var res2 = await drawCostSection('Nicht umlagefähige Kosten', otherItems, y, costIdx);
            y = res2.y; costIdx = res2.ri; grandTotal += res2.total; grandShare += res2.share;
        }

        // Grand total row
        if (y - grandTotalH < mBottom) {
            var np4 = await addPage();
            page = np4.page; height = np4.height; y = np4.y;
        }
        page.drawRectangle({ x: mLeft, y: y - grandTotalH, width: contentW, height: grandTotalH, color: olive });
        page.drawText('Gesamt Ist-Kosten', { x: mLeft + 4, y: y - grandTotalH + 6, size: 8.5, font: fBold, color: white });
        drawR(page, fmt(grandTotal), cGesamtR - 2, y - grandTotalH + 6, 8.5, fBold, white);
        drawR(page, fmt(grandShare), cAnteilR - 2, y - grandTotalH + 6, 8.5, fBold, white);
        y -= grandTotalH + 16;

        // ── BLOCK 5: RECHTLICHER HINWEIS ──────────────────────
        var hintText = 'Diese Hausgeldabrechnung wurde maschinell erstellt. Die Abrechnung ist gemäß § 28 Abs. 2 WEG durch Beschluss der Eigentümerversammlung zu genehmigen. Etwaige Nachzahlungen bzw. Guthaben werden nach Beschlussfassung fällig bzw. erstattet.';
        var hintPad    = 10;
        var hintFS     = 9.5;
        var hintLH     = Math.ceil(hintFS * 1.3);
        var hintIconD  = 10;
        var hintIconGap = 6;
        var hintIconArea = hintPad + hintIconD + hintIconGap;
        var hintTextW  = contentW - hintIconArea - hintPad;
        var hintLines  = _pdfSplitText(hintText, fReg, hintFS, hintTextW);
        var hintBoxH   = hintPad * 2 + hintLines.length * hintLH;

        if (y - hintBoxH < mBottom) {
            var np5 = await addPage();
            page = np5.page; height = np5.height; y = np5.y;
        }
        page.drawRectangle({ x: mLeft, y: y - hintBoxH, width: contentW, height: hintBoxH, borderColor: orange, borderWidth: 1, color: rgb(0.996, 0.972, 0.958) });
        var iconCX = mLeft + hintPad + hintIconD / 2;
        var iconCY = y - hintPad - hintLH / 2;
        page.drawCircle({ x: iconCX, y: iconCY, size: hintIconD / 2, color: orange });
        var iCharW = fBold.widthOfTextAtSize('i', 7);
        page.drawText('i', { x: iconCX - iCharW / 2, y: iconCY - 2.5, size: 7, font: fBold, color: white });
        var hintTextX = mLeft + hintIconArea;
        for (var hi = 0; hi < hintLines.length; hi++) {
            page.drawText(hintLines[hi], { x: hintTextX, y: y - hintPad - hintLH * 0.85 - (hi * hintLH), size: hintFS, font: fReg, color: offblack });
        }
        aptPageRangesJAB.push({ aptId: apt.id, start: aptPageStartJAB, end: pdfDoc.getPageCount() - 1 });
    }

    var pdfBytes = await pdfDoc.save();
    if (saveForETV) {
        await _pdfSplitAndUpload(pdfBytes, aptPageRangesJAB, bid, fy, 'jab');
    } else {
        var filename = 'Jahresabrechnung_' + fy + '_' + bldName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
        _pdfDownload(pdfBytes, filename);
        showToast(apts.length + ' Einzelabrechnungen als PDF heruntergeladen.');
    }
}

// ─── ETV PDF SHARED HELPERS ──────────────────────────────────
// Gemeinsam genutzt von Einladungs- und Protokoll-PDF

/**
 * Zeichnet einen TOP-Header-Balken (olive, weiße Schrift, dynamische Höhe).
 * Gibt das neue y zurück.
 */
function _pdfDrawTopHeader(page, y, item, { fBold, white, olive }, { mLeft, contentW }) {
    const topLabel = `TOP ${item.sort_order}  `;
    const labelW   = fBold.widthOfTextAtSize(topLabel, 9.5);
    const titleLines = _pdfSplitText(item.title, fBold, 9.5, contentW - labelW - 16);
    const barH = Math.max(24, 10 + titleLines.length * 14);
    page.drawRectangle({ x: mLeft, y: y - barH, width: contentW, height: barH, color: olive });
    const baseY = y - barH + (barH - 10) / 2;
    page.drawText(topLabel, {
        x: mLeft + 8,
        y: baseY + (titleLines.length > 1 ? (titleLines.length - 1) * 7 : 0),
        size: 9.5, font: fBold, color: white
    });
    titleLines.forEach((l, i) => {
        page.drawText(l, {
            x: mLeft + 8 + labelW,
            y: baseY + (titleLines.length - 1 - i) * 14,
            size: 9.5, font: fBold, color: white
        });
    });
    return y - barH - 14;
}

/**
 * Zeichnet ein Label + mehrzeiliges Textblock-Paar.
 * Gibt [page, y] zurück (behandelt Seitenumbrüche via checkBreakFn).
 */
async function _pdfDrawSection(page, y, label, text, { fBold, fReg, olive, offblack }, { mLeft, mBottom }, checkBreakFn, textColor = null) {
    if (!text) return [page, y];
    [page, y] = await checkBreakFn(page, y, 30);
    page.drawText(label + ':', { x: mLeft + 10, y, size: 11, font: fBold, color: olive });
    y -= 16;
    const lines = _pdfSplitText(text, fReg, 9, 450);
    for (const line of lines) {
        [page, y] = await checkBreakFn(page, y, 14);
        page.drawText(line, { x: mLeft + 10, y, size: 9, font: fReg, color: textColor || offblack });
        y -= 13;
    }
    y -= 4;
    return [page, y];
}

// ─── ETV-PROTOKOLL GENERIERUNG ───────────────────────────────
async function generateETVProtokollPDF(sessionId, options = {}) {
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }
    const { signatories = {}, publishNow = false } = options;

    showToast('ETV-Protokoll wird erstellt…');

    const settings = await _pdfGetSettings();
    const { data: session } = await _supabase
        .from('etv_sessions')
        .select('*, building:buildings(id, name, file_number, street, house_number, zip_code, city)')
        .eq('id', sessionId).single();
    if (!session) { showToast('Versammlung nicht gefunden.', 'error'); return; }

    const fy  = session.fiscal_year;
    const bld = session.building;

    const agendaIds = (await _supabase.from('etv_agenda_items').select('id').eq('session_id', sessionId)).data?.map(i => i.id) || [];
    const [agendaRes, attRes, votesRes, allAptsRes] = await Promise.all([
        _supabase.from('etv_agenda_items').select('*').eq('session_id', sessionId),
        _supabase.from('etv_attendance').select('*, apartment:apartments(mea_numerator)').eq('session_id', sessionId),
        agendaIds.length ? _supabase.from('etv_votes').select('*').in('agenda_item_id', agendaIds) : Promise.resolve({ data: [] }),
        _supabase.from('apartments').select('id, mea_numerator').eq('building_id', bld.id),
    ]);

    const _sortOrder = (a, b) => { const pa = String(a.sort_order).split('.').map(Number), pb = String(b.sort_order).split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const va = pa[i] ?? -1, vb = pb[i] ?? -1; if (va !== vb) return va - vb; } return 0; };
    const agenda   = (agendaRes.data || []).sort(_sortOrder);
    const att      = attRes.data || [];
    const votes    = votesRes.data || [];
    const allApts  = allAptsRes.data || [];

    // Quorum-Berechnung
    const totalUnits = allApts.length;
    const totalMEA   = allApts.reduce((s, a) => s + (Number(a.mea_numerator) || 0), 0) || 1000;
    const present    = att.filter(a => a.is_present);
    const presentMEA = present.reduce((s, a) => s + (Number(a.apartment?.mea_numerator) || 0), 0);
    const presentPct = totalMEA > 0 ? (presentMEA / totalMEA * 100) : 0;
    const quorumPct  = session.quorum_percent ?? 50;
    const isQuorate  = presentPct >= quorumPct;
    const approvedCount = agenda.filter(a => a.result_status === 'approved').length;
    const totalCount    = agenda.length;

    const { PDFDocument, rgb } = PDFLib;
    let templateDoc = null;
    if (settings.letterhead_pdf_url) {
        try {
            const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
            if (sd?.signedUrl) templateDoc = await PDFDocument.load(await (await fetch(sd.signedUrl)).arrayBuffer());
        } catch(e) {}
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const { reg: fReg, semi: fSemi, bold: fBold } = await _pdfLoadInterFonts(pdfDoc);

    // Colors & Layout
    const olive    = rgb(0.408, 0.455, 0.318);
    const offblack = rgb(0.216, 0.216, 0.216);
    const orange   = rgb(0.922, 0.463, 0.176);
    const green    = rgb(0.290, 0.486, 0.349);
    const gray50   = rgb(0.5, 0.5, 0.5);
    const gray30   = rgb(0.3, 0.3, 0.3);
    const white    = rgb(1, 1, 1);
    const oliveLight = rgb(0.957, 0.961, 0.949);
    const mLeft = 56.7, mRight = 538.6, mBottom = 80;
    const contentW = mRight - mLeft;
    const pageH = 841.89;
    const todayStr  = new Date().toLocaleDateString('de-DE');
    const dateStr   = new Date(session.meeting_date).toLocaleDateString('de-DE');
    const timeStr   = new Date(session.meeting_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const bldName   = formatBuildingName(bld);
    const bldAddr   = `${bld.street || ''} ${bld.house_number || ''}, ${bld.zip_code || ''} ${bld.city || ''}`.trim().replace(/^,\s*/, '');
    const fmtMEA    = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const fmtPct    = (v) => `${Number(v).toFixed(2).replace('.', ',')} %`;

    let pageNum = 0;

    const addPage = async () => {
        pageNum++;
        if (templateDoc) {
            const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
            return pdfDoc.addPage(copied);
        }
        const pg = pdfDoc.addPage([595.28, pageH]);
        pg.drawText(settings.company_name || 'Hausverwaltung', { x: mLeft, y: pageH - 45, size: 11, font: fBold, color: olive });
        return pg;
    };

    // Running header für Protokoll-Seiten (ab Seite 2)
    // Positioniert UNTERHALB des Briefbogen-Logo-Bereichs (~740pt Grenze)
    const CONTENT_TOP = 710; // Inhalt-Start unterhalb Logo + Running-Header
    const drawRunningHeader = (pg, pNum) => {
        const hY = 730; // Unterhalb der ~740pt Briefbogen-Grenze
        pg.drawLine({ start: { x: mLeft, y: hY + 8 }, end: { x: mRight, y: hY + 8 }, thickness: 0.3, color: olive });
        pg.drawText(`ETV ${fy} Protokoll  |  ${bldName}`, { x: mLeft, y: hY, size: 7, font: fReg, color: gray50 });
        const pStr = `${dateStr}  |  Seite ${pNum}`;
        pg.drawText(pStr, { x: mRight - fReg.widthOfTextAtSize(pStr, 7), y: hY, size: 7, font: fReg, color: gray50 });
    };

    // Seitenumbruch-Helfer: prüft ob y zu tief, gibt ggf. neue Seite + Reset-Y zurück
    const checkBreak = async (pg, y, needed = 80) => {
        if (y < mBottom + needed) {
            const newPg = await addPage();
            drawRunningHeader(newPg, pageNum);
            return [newPg, CONTENT_TOP];
        }
        return [pg, y];
    };

    // Text-Block zeichnen (mehrzeilig, optional eingerückt), gibt neues y zurück
    const drawBlock = async (pg, y, text, font, size, color, indent = 0, lineH = null) => {
        const lh = lineH || (size * 1.5);
        const lines = _pdfSplitText(text || '', font, size, contentW - indent - 2);
        for (const line of lines) {
            [pg, y] = await checkBreak(pg, y, 30);
            pg.drawText(line, { x: mLeft + indent, y, size, font, color });
            y -= lh;
        }
        return [pg, y];
    };

    // ════════════════════════════════════════════════════════════
    // SEITE 1 — ANSCHREIBEN
    // ════════════════════════════════════════════════════════════
    let page = await addPage();
    let y = 740;

    // DIN 5008: Adressfeld (generisch für alle Eigentümer)
    const addrBlock = [
        settings.company_name || 'Hausverwaltung',
        `${bldName}`,
        'An alle Wohnungseigentümer',
    ];
    addrBlock.forEach((line, i) => {
        page.drawText(line, { x: mLeft, y: y - i * 14, size: 10, font: i === 0 ? fSemi : fReg, color: offblack });
    });
    y -= addrBlock.length * 14 + 28;

    // Datum rechtsbündig
    const dW = fReg.widthOfTextAtSize(todayStr, 10);
    page.drawText(todayStr, { x: mRight - dW, y: y + 14, size: 10, font: fReg, color: gray50 });

    // Betreff
    page.drawText(`${bldName}  —  Übersendung Protokoll`, { x: mLeft, y, size: 12, font: fBold, color: offblack });
    y -= 16;
    page.drawText(`Eigentümerversammlung vom ${dateStr}  |  Wirtschaftsjahr ${fy}`, { x: mLeft, y, size: 9, font: fSemi, color: olive });
    y -= 28;

    // Brieftext
    const anschreiben = `in der Anlage erhalten Sie das Protokoll der Eigentümerversammlung vom ${dateStr} zur Kenntnisnahme und für Ihre Unterlagen.\n\nDas unterschriebene Originalprotokoll ist bei der Verwaltung hinterlegt und kann dort auf Anfrage eingesehen werden (§ 24 Abs. 6 WEG).`;
    page.drawText('Sehr geehrte Eigentümerinnen und Eigentümer,', { x: mLeft, y, size: 10, font: fReg, color: offblack });
    y -= 16;
    for (const para of anschreiben.split('\n\n')) {
        const lines = _pdfSplitText(para, fReg, 10, contentW);
        for (const line of lines) { page.drawText(line, { x: mLeft, y, size: 10, font: fReg, color: offblack }); y -= 14; }
        y -= 6;
    }
    y -= 16;
    page.drawText('Vielen Dank', { x: mLeft, y, size: 10, font: fReg, color: offblack }); y -= 20;
    page.drawText('Mit freundlichen Grüßen', { x: mLeft, y, size: 10, font: fReg, color: offblack }); y -= 20;
    page.drawText(settings.company_name || 'Hausverwaltung', { x: mLeft, y, size: 10, font: fBold, color: offblack });
    y -= 40;

    // Anlage
    page.drawLine({ start: { x: mLeft, y: y + 8 }, end: { x: mLeft + 80, y: y + 8 }, thickness: 0.5, color: olive });
    page.drawText('Anlage', { x: mLeft, y, size: 9, font: fBold, color: offblack }); y -= 14;
    page.drawText(`•  Protokoll der Eigentümerversammlung vom ${dateStr}`, { x: mLeft + 8, y, size: 9, font: fReg, color: offblack });

    // ════════════════════════════════════════════════════════════
    // SEITE 2 — PROTOKOLL-KOPF
    // ════════════════════════════════════════════════════════════
    page = await addPage();
    drawRunningHeader(page, pageNum);
    y = CONTENT_TOP;

    // Protokoll-Titel
    page.drawText(`ETV ${fy} (ordentliche Eigentümerversammlung)`, { x: mLeft, y, size: 16, font: fBold, color: offblack });
    y -= 18;
    page.drawText('Protokoll Eigentümerversammlung', { x: mLeft, y, size: 11, font: fSemi, color: gray50 });
    y -= 14;
    page.drawText(`WEG ${bldAddr}`, { x: mLeft, y, size: 10, font: fReg, color: offblack });
    y -= 22;

    // ── Formalia-Box ──────────────────────────────────────────
    const fmtTime = (t) => t ? t.slice(0, 5) : '—';
    const formaliaRows = [
        ['Versammlungsbeginn', s => s.actual_start_time ? `${dateStr}, ${fmtTime(s.actual_start_time)} Uhr` : dateStr],
        ['Versammlungsort',    s => s.location || '—'],
        ['Versammlungsende',   s => s.actual_end_time   ? `${dateStr}, ${fmtTime(s.actual_end_time)} Uhr`  : '—'],
        ['Versammlungsleitung', s => s.chairman_name || signatories.vl || '—'],
        ['Protokollführung',   s => s.secretary_name || signatories.pf || '—'],
        ['Einladung fristgemäß', () => 'Ja, gemäß § 24 Abs. 4 Satz 2 WEG'],
    ];
    const fBoxH = formaliaRows.length * 18 + 16;
    page.drawRectangle({ x: mLeft, y: y - fBoxH, width: contentW, height: fBoxH, borderColor: olive, borderWidth: 0.5, color: rgb(0.99, 0.99, 0.98) });
    let fY = y - 12;
    for (const [label, valFn] of formaliaRows) {
        page.drawText(label + ':', { x: mLeft + 8, y: fY, size: 8.5, font: fBold, color: gray30 });
        page.drawText(valFn(session), { x: mLeft + 170, y: fY, size: 8.5, font: fReg, color: offblack });
        fY -= 18;
    }
    y -= fBoxH + 18;

    // ── Beschlussfähigkeits-Tabelle ───────────────────────────
    page.drawText('Feststellung der Beschlussfähigkeit bei Versammlungsbeginn', { x: mLeft, y, size: 9.5, font: fBold, color: offblack });
    y -= 14;

    const tCols = [mLeft, mLeft + 200, mLeft + 300, mLeft + 400];
    const tW    = [200, 100, 100, 100];
    const headers = ['', 'MEA', 'Einheiten', 'Anteil'];
    // Header-Zeile
    page.drawRectangle({ x: mLeft, y: y - 16, width: contentW, height: 16, color: olive });
    headers.forEach((h, i) => {
        if (h) page.drawText(h, { x: tCols[i] + 4, y: y - 12, size: 8, font: fBold, color: white });
    });
    y -= 16;

    const tRows = [
        ['Summe anwesend (u. vertreten)', fmtMEA(presentMEA), `${present.length}`, fmtPct(presentPct)],
        ['von insgesamt',                 fmtMEA(totalMEA),   `${totalUnits}`,      ''],
        ['Summe abwesend',                fmtMEA(totalMEA - presentMEA), `${totalUnits - present.length}`, ''],
        ['Gesamtsumme',                   fmtMEA(totalMEA),   `${totalUnits}`,      '100,00 %'],
    ];
    tRows.forEach((row, ri) => {
        const rowBg = ri % 2 === 0 ? rgb(0.99, 0.99, 0.98) : white;
        page.drawRectangle({ x: mLeft, y: y - 14, width: contentW, height: 14, color: rowBg, borderColor: rgb(0.92, 0.93, 0.90), borderWidth: 0.3 });
        row.forEach((cell, ci) => {
            const isFirst = ci === 0;
            page.drawText(cell, { x: tCols[ci] + 4, y: y - 10, size: 8, font: isFirst ? fSemi : fReg, color: offblack });
        });
        y -= 14;
    });
    y -= 16;

    // Beschlussfähigkeit-Zeile
    const quorText = `Die Eigentümerversammlung ist beschlussfähig:`;
    page.drawText(quorText, { x: mLeft, y, size: 9, font: fBold, color: offblack });
    const quorVal = isQuorate ? 'Ja' : 'Nein';
    const quorColor = isQuorate ? green : orange;
    page.drawText(quorVal, { x: mLeft + fBold.widthOfTextAtSize(quorText, 9) + 6, y, size: 9, font: fBold, color: quorColor });
    y -= 14;
    page.drawText('Die Teilnehmerliste liegt im Original beim Verwalter vor.', { x: mLeft, y, size: 8, font: fReg, color: gray50 });
    y -= 28;

    // Tagesordnungs-Kurzübersicht
    page.drawLine({ start: { x: mLeft, y: y + 6 }, end: { x: mRight, y: y + 6 }, thickness: 0.3, color: olive });
    y -= 6;
    page.drawText(`Tagesordnungspunkte  (${totalCount} gesamt  /  ${approvedCount} Beschlüsse gefasst)`, { x: mLeft, y, size: 9.5, font: fBold, color: offblack });
    y -= 26;

    // ════════════════════════════════════════════════════════════
    // SEITEN 2ff — TAGESORDNUNGSPUNKTE (Design analog Einladungs-PDF)
    // ════════════════════════════════════════════════════════════
    const majorityLabels = { simple: 'Einfache Mehrheit', qualified: 'Qualifizierte Mehrheit', double_qualified: 'Doppelt qualifizierte Mehrheit', unanimous: 'Allstimmigkeit', none: '—' };
    const votingLabels   = { mea: 'Wertprinzip (MEA)', heads: 'Kopfprinzip', object: 'Objektprinzip', none: '—' };
    const sharedFonts    = { fBold, fSemi, fReg, white, olive, offblack };
    const sharedLayout   = { mLeft, mRight, mBottom, contentW };
    const cbFn           = checkBreak; // alias für _pdfDrawSection

    for (const item of agenda) {
        [page, y] = await checkBreak(page, y, 60);

        // TOP-Header — olive Balken, dynamische Höhe (shared helper, identisch zur Einladung)
        y = _pdfDrawTopHeader(page, y, item, sharedFonts, sharedLayout);

        // Vorbemerkung
        [page, y] = await _pdfDrawSection(page, y, 'Vorbemerkung', item.preliminary_remark, sharedFonts, sharedLayout, cbFn, gray50);

        // Inhalt / Beschlussantrag
        const resLabel = item.voting_type === 'none' ? 'Inhalt' : 'Beschlussantrag';
        [page, y] = await _pdfDrawSection(page, y, resLabel, item.proposed_resolution || 'Kein Text hinterlegt.', sharedFonts, sharedLayout, cbFn);

        // Feststellung und Verkündung (nur bei Beschluss-TOPs)
        if (item.voting_type !== 'none') {
            [page, y] = await checkBreak(page, y, 60);

            const itemVotes = votes.filter(v => v.agenda_item_id === item.id);
            const yesMEA = itemVotes.filter(v => v.vote === 'yes').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
            const noMEA  = itemVotes.filter(v => v.vote === 'no').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
            const absMEA = itemVotes.filter(v => v.vote === 'abstain').reduce((s,v) => s + (Number(v.weight_mea)||0), 0);
            const yesObj = itemVotes.filter(v => v.vote === 'yes').length;
            const noObj  = itemVotes.filter(v => v.vote === 'no').length;
            const absObj = itemVotes.filter(v => v.vote === 'abstain').length;
            const totMEA = yesMEA + noMEA + absMEA;
            const yesPct = totMEA > 0 ? (yesMEA / totMEA * 100) : 0;

            // Label wie in der Einladung (olive, size 11)
            page.drawText('Feststellung und Verkündung:', { x: mLeft + 10, y, size: 11, font: fBold, color: olive });
            y -= 18;

            // Metadaten-Zeilen (Beschlussregel, Prinzip, Abstimmung)
            const metaRows = [
                ['Beschlussregel', majorityLabels[item.majority_type] || '—'],
                ['Prinzip',        votingLabels[item.voting_type]     || '—'],
                ['Abstimmung',     'Offen'],
            ];
            for (const [lbl, val] of metaRows) {
                page.drawText(lbl + ':', { x: mLeft + 18, y, size: 9, font: fBold, color: gray50 });
                page.drawText(val,        { x: mLeft + 130, y, size: 9, font: fReg, color: offblack });
                y -= 13;
            }
            y -= 4;

            // Abstimmungsergebnis-Zeilen
            page.drawText('Abstimmungsergebnis:', { x: mLeft + 18, y, size: 9, font: fBold, color: gray50 });
            y -= 13;
            const ergebnis = [
                ['abgegebene MEA', fmtMEA(totMEA), ''],
                ['MEA ja',         fmtMEA(yesMEA), `(${yesObj} Einheiten)`],
                ['MEA nein',       fmtMEA(noMEA),  `(${noObj} Einheiten)`],
                ['MEA enthalten',  fmtMEA(absMEA), `(${absObj} Einheiten)`],
            ];
            for (const [lbl, val, note] of ergebnis) {
                [page, y] = await checkBreak(page, y, 14);
                page.drawText(lbl,  { x: mLeft + 26, y, size: 9, font: fReg,  color: gray50   });
                page.drawText(`= ${val}`, { x: mLeft + 130, y, size: 9, font: fSemi, color: offblack });
                if (note) page.drawText(note, { x: mLeft + 250, y, size: 8, font: fReg, color: gray50 });
                y -= 12;
            }
            page.drawText(`${fmtPct(yesPct)} der abgegebenen MEA stimmten ja.`, { x: mLeft + 26, y, size: 8.5, font: fReg, color: gray50 });
            y -= 16;

            // Ergebnis-Banner (wie in Einladung — farbiger Balken)
            [page, y] = await checkBreak(page, y, 22);
            const isApproved = item.result_status === 'approved';
            const isRejected = item.result_status === 'rejected';
            const bannerBg    = isApproved ? rgb(0.882, 0.937, 0.898) : isRejected ? rgb(0.961, 0.882, 0.878) : rgb(0.94, 0.94, 0.94);
            const bannerText  = isApproved ? 'Der Beschluss wurde angenommen.' : isRejected ? 'Der Beschluss wurde abgelehnt.' : 'Abstimmung ausstehend.';
            const bannerColor = isApproved ? green : isRejected ? rgb(0.769, 0.271, 0.239) : gray50;
            page.drawRectangle({ x: mLeft + 10, y: y - 18, width: contentW - 10, height: 18, color: bannerBg });
            page.drawText(bannerText, { x: mLeft + 18, y: y - 12, size: 9, font: fBold, color: bannerColor });
            y -= 24;
        }

        // Diskussionsnotiz (= result_note aus Tab 2)
        [page, y] = await _pdfDrawSection(page, y, 'Diskussionsnotiz', item.result_note, sharedFonts, sharedLayout, cbFn, gray50);

        // Trennlinie zwischen TOPs
        [page, y] = await checkBreak(page, y, 20);
        page.drawLine({ start: { x: mLeft, y: y + 6 }, end: { x: mRight, y: y + 6 }, thickness: 0.3, color: rgb(0.9, 0.92, 0.88) });
        y -= 10;
    }

    // ════════════════════════════════════════════════════════════
    // LETZTE SEITE — UNTERSCHRIFTEN-BLOCK
    // ════════════════════════════════════════════════════════════
    if (y < mBottom + 200) { page = await addPage(); drawRunningHeader(page, pageNum); y = pageH - 70; }

    y -= 20;
    page.drawLine({ start: { x: mLeft, y: y + 10 }, end: { x: mRight, y: y + 10 }, thickness: 0.5, color: olive });

    const signIntro = `Dieses Protokoll wurde am ${dateStr} in ${session.location || 'Versammlungsort'} aufgenommen. Die Richtigkeit der vorstehenden Feststellungen wird durch die nachstehenden Unterschriften gemäß § 24 Abs. 6 WEG bestätigt.`;
    [page, y] = await drawBlock(page, y, signIntro, fReg, 9, gray30);
    y -= 20;

    // 2×2 Unterschriften-Felder
    const placeholder = '______ (Hier Name in Druckbuchstaben einfügen)';
    const signFields = [
        { label: 'Versammlungsleiter',   name: signatories.vl || session.chairman_name  || null, x: mLeft,       },
        { label: 'Protokollführer',       name: signatories.pf || session.secretary_name || null, x: mLeft + 248, },
    ];
    const signFields2 = [
        { label: 'Beirat / Eigentümer',  name: signatories.b1 || session.beirat_signatory_1 || null, x: mLeft,       },
        { label: 'Beirat / Eigentümer',  name: signatories.b2 || session.beirat_signatory_2 || null, x: mLeft + 248, },
    ];

    const drawSignRow = (pg, fy2, fields) => {
        for (const f of fields) {
            const lineW = 175;
            pg.drawLine({ start: { x: f.x, y: fy2 }, end: { x: f.x + lineW, y: fy2 }, thickness: 0.5, color: offblack });
            if (f.name) {
                pg.drawText(f.name, { x: f.x, y: fy2 - 12, size: 8, font: fSemi, color: offblack });
            } else {
                pg.drawText(placeholder, { x: f.x, y: fy2 - 12, size: 7, font: fReg, color: gray50 });
            }
            pg.drawText(f.label, { x: f.x, y: fy2 - 24, size: 7, font: fBold, color: gray50 });
            pg.drawText(`Datum: ____________________`, { x: f.x, y: fy2 - 36, size: 7, font: fReg, color: gray50 });
        }
    };

    drawSignRow(page, y, signFields);
    y -= 55;
    drawSignRow(page, y, signFields2);
    y -= 55;

    // Hinweis Original beim Verwalter
    [page, y] = await checkBreak(page, y, 60);
    y -= 10;
    page.drawRectangle({ x: mLeft, y: y - 52, width: contentW, height: 52, color: oliveLight, borderColor: olive, borderWidth: 0.5 });
    page.drawText('Hinweis gemäß § 24 Abs. 6 WEG', { x: mLeft + 10, y: y - 14, size: 8, font: fBold, color: olive });
    const hintText = 'Das Original dieses Protokolls mit den handschriftlichen Unterschriften verbleibt beim Verwalter und kann dort auf Anfrage eingesehen werden. Im Portal wird ausschließlich die elektronische Fassung veröffentlicht.';
    const hintLines = _pdfSplitText(hintText, fReg, 8, contentW - 20);
    hintLines.forEach((l, i) => page.drawText(l, { x: mLeft + 10, y: y - 26 - i * 11, size: 8, font: fReg, color: gray30 }));

    // ════════════════════════════════════════════════════════════
    // SPEICHERN / VERÖFFENTLICHEN / DOWNLOAD
    // ════════════════════════════════════════════════════════════
    const pdfBytes = await pdfDoc.save();
    const safeName = bldName.replace(/[^a-z0-9äöüß]/gi, '_');
    const filename = `Protokoll_ETV_${fy}_${safeName}.pdf`;

    if (publishNow) {
        try {
            const storagePath = `${bld.id}/Protokoll_ETV_${fy}.pdf`;
            await _supabase.storage.from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
            // Dokument-Eintrag (upsert über storage_path)
            const { data: existing } = await _supabase.from('documents').select('id').eq('storage_path', storagePath).maybeSingle();
            if (existing) {
                await _supabase.from('documents').update({ status: 'released', updated_at: new Date().toISOString() }).eq('id', existing.id);
            } else {
                await _supabase.from('documents').insert({
                    building_id: bld.id,
                    file_name: filename,
                    original_filename: filename,
                    document_title: `Protokoll ETV ${fy}`,
                    storage_path: storagePath,
                    file_type: 'application/pdf',
                    category: 'Protokoll',
                    visibility_scope: 'building',
                    status: 'released',
                });
            }
            showToast(`Protokoll generiert & im Portal freigegeben.`, 'success');
        } catch(e) {
            showToast('PDF erstellt, aber Freigabe fehlgeschlagen. Bitte manuell freigeben.', 'error');
        }
    } else {
        showToast('Protokoll erfolgreich generiert.');
    }

    _pdfDownload(pdfBytes, filename);
}

// ─── ETV Einladungs-PDF ───────────────────────────────────────

async function generateETVEinladungPDF(sessionId, options = {}) {
    const isDraft = !!options.draft;
    if (typeof PDFLib === 'undefined') {
        showToast('PDF-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error'); return;
    }
    showToast(isDraft ? 'Entwurf wird erstellt…' : 'Einladungen werden erstellt…');

    const settings = await _pdfGetSettings();
    const { data: session } = await _supabase
        .from('etv_sessions')
        .select('*, building:buildings(id, name, file_number, street, house_number, zip_code, city)')
        .eq('id', sessionId).single();
    if (!session) { showToast('Versammlung nicht gefunden.', 'error'); return; }

    const { data: buildingApts } = await _supabase
        .from('apartments').select('id').eq('building_id', session.building_id);
    const aptIds = (buildingApts || []).map(a => a.id);

    const [agendaRes, ownRes] = await Promise.all([
        _supabase.from('etv_agenda_items').select('*').eq('session_id', sessionId),
        aptIds.length > 0
            ? _supabase.from('ownerships')
                .select('apartment_id, person:persons!ownerships_owner_id_fkey(id, first_name, last_name, salutation, street, house_number, zip_code, city), apartment:apartments(apartment_number, mea_numerator, mea_denominator)')
                .in('apartment_id', aptIds)
                .eq('is_active', true)
            : Promise.resolve({ data: [] })
    ]);

    const _sortOrder = (a, b) => { const pa = String(a.sort_order).split('.').map(Number), pb = String(b.sort_order).split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const va = pa[i] ?? -1, vb = pb[i] ?? -1; if (va !== vb) return va - vb; } return 0; };
    const agenda = (agendaRes.data || []).sort(_sortOrder);
    const owners = ownRes.data || [];
    if (owners.length === 0) { showToast('Keine aktiven Eigentümer für dieses Gebäude gefunden.', 'error'); return; }

    // TOP-Dokumente laden
    const agendaIds = agenda.map(a => a.id);
    let agendaDocs = [];
    if (agendaIds.length) {
        const { data } = await _supabase.from('etv_agenda_documents').select('*').in('agenda_item_id', agendaIds);
        agendaDocs = data || [];
    }

    // TOP-Dokument-PDFs vorab laden (einmalig, nicht pro Eigentümer)
    const _loadedDocPDFs = {};
    for (const doc of agendaDocs) {
        try {
            const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
            if (sd?.signedUrl) {
                const resp = await fetch(sd.signedUrl);
                if (resp.ok) _loadedDocPDFs[doc.id] = await resp.arrayBuffer();
            }
        } catch(e) { /* Dokument nicht verfügbar */ }
    }

    const { PDFDocument, rgb } = PDFLib;
    let templateDoc = null;
    if (settings.letterhead_pdf_url) {
        try {
            const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(settings.letterhead_pdf_url, 120);
            if (sd?.signedUrl) {
                templateDoc = await PDFDocument.load(await (await fetch(sd.signedUrl)).arrayBuffer());
            }
        } catch(e) { /* kein Briefbogen */ }
    }

    const bld     = session.building;
    const bldName = formatBuildingName(bld);
    const bldAddr = `${bld.street || ''} ${bld.house_number || ''}, ${bld.zip_code || ''} ${bld.city || ''}`.trim().replace(/^,\s*/, '');
    const dateStr = new Date(session.meeting_date).toLocaleDateString('de-DE');
    const timeStr = new Date(session.meeting_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const fy      = session.fiscal_year;
    const todayStr = new Date().toLocaleDateString('de-DE');

    const olive    = rgb(0.408, 0.455, 0.318);
    const offblack = rgb(0.216, 0.216, 0.216);
    const orange   = rgb(0.922, 0.463, 0.176);
    const gray50   = rgb(0.5, 0.5, 0.5);
    const divider  = rgb(0.9, 0.92, 0.88);
    const mLeft = 56.7, mRight = 538.6, mBottom = 80;
    const contentW = mRight - mLeft;
    const pageH = 841.89;

    // Staged Anlagen (WP + JAB) vorab laden — nur im Final-Modus
    const _loadedStaging = {};
    if (!isDraft) {
        for (const own of owners) {
            for (const docType of ['wp', 'jab']) {
                const storagePath = `etv-staging/${bld.id}/${fy}/${docType}/${own.apartment_id}.pdf`;
                try {
                    const { data: sd } = await _supabase.storage.from('documents').createSignedUrl(storagePath, 300);
                    if (sd?.signedUrl) {
                        const resp = await fetch(sd.signedUrl);
                        if (resp.ok) _loadedStaging[`${own.apartment_id}_${docType}`] = await resp.arrayBuffer();
                    }
                } catch(e) { /* kein Staging-Dokument */ }
            }
        }
    }

    // ── Pro Eigentümer ein separates PDF ─────────────────────
    const zipFiles = [];

    // Template laden (falls vorhanden)
    let etvTemplate = null;
    try { etvTemplate = await _pdfLoadTemplate('etv_einladung'); } catch(e) {}

    for (const own of owners) {
        const person = own.person;
        const apt    = own.apartment;
        if (!person) continue;

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const { reg: fReg, semi: fSemi, bold: fBold } = await _pdfLoadInterFonts(pdfDoc);
        const fonts = { reg: fReg, semi: fSemi, bold: fBold };
        const white = rgb(1, 1, 1);

        const addPage = async () => {
            if (templateDoc) {
                const [copied] = await pdfDoc.copyPages(templateDoc, [0]);
                return pdfDoc.addPage(copied);
            }
            const pg = pdfDoc.addPage([595.28, pageH]);
            pg.drawText(settings.company_name || 'Hausverwaltung', { x: mLeft, y: pageH - 50, size: 11, font: fBold, color: olive });
            return pg;
        };

        const fullName = `${person.first_name} ${person.last_name}`;
        const salut    = person.salutation === 'Herr' ? 'geehrter Herr' : person.salutation === 'Frau' ? 'geehrte Frau' : person.salutation === 'Eheleute' ? 'geehrte Eheleute' : person.salutation === 'Familie' ? 'geehrte Familie' : 'geehrte(r)';
        const addrLines = [
            fullName,
            `${person.street || ''} ${person.house_number || ''}`.trim(),
            `${person.zip_code || ''} ${person.city || ''}`.trim()
        ].filter(l => l.length > 0);
        const ownerPersonId = own.person?.id;

        // ── SEITE 1: ANSCHREIBEN (DIN 5008 + Template) ──────────
        let page = await addPage();
        let y = 740;

        // DIN 5008: Adressfeld
        addrLines.forEach((line, i) => {
            page.drawText(line, { x: mLeft, y: y - i * 14, size: 10, font: i === 0 ? fSemi : fReg, color: offblack });
        });
        y -= addrLines.length * 14 + 28;

        // DIN 5008: Datum rechtsbündig
        const dW = fReg.widthOfTextAtSize(todayStr, 10);
        page.drawText(todayStr, { x: mRight - dW, y: y + 14, size: 10, font: fReg, color: gray50 });

        // DIN 5008: Betreff
        page.drawText('Einladung zur Eigentümerversammlung', { x: mLeft, y, size: 13, font: fBold, color: offblack });
        y -= 17;
        page.drawText(`Wirtschaftsjahr ${fy}  |  ${bldName}`, { x: mLeft, y, size: 9, font: fSemi, color: olive });
        y -= 24;

        // Info-Box nur im Legacy-Modus (Template hat eigene info_box)
        if (!etvTemplate) {
            const boxH = 50;
            page.drawRectangle({ x: mLeft, y: y - boxH, width: contentW, height: boxH, color: rgb(0.98, 0.98, 0.96), borderColor: divider, borderWidth: 0.5 });
            page.drawText('Termin:', { x: mLeft + 10, y: y - 16, size: 8, font: fBold, color: gray50 });
            page.drawText(`${dateStr}  um  ${timeStr} Uhr`, { x: mLeft + 48, y: y - 16, size: 9, font: fSemi, color: offblack });
            page.drawText('Ort:', { x: mLeft + 10, y: y - 32, size: 8, font: fBold, color: gray50 });
            page.drawText(session.location || '—', { x: mLeft + 48, y: y - 32, size: 9, font: fReg, color: offblack });
            page.drawText('Objekt:', { x: mLeft + 240, y: y - 16, size: 8, font: fBold, color: gray50 });
            const bldAddrSplit = _pdfSplitText(bldAddr, fReg, 8.5, contentW - 260);
            bldAddrSplit.forEach((l, i) => page.drawText(l, { x: mLeft + 278, y: y - 16 - i * 12, size: 8.5, font: fReg, color: offblack }));
            y -= boxH + 16;
        }

        // Template-Body (editierbar im Designer) oder Legacy-Fallback
        if (etvTemplate) {
            const tplData = {
                anrede: salut, nachname: person.last_name, vorname: person.first_name,
                gebaeude_name: bldName, gebaeude_adresse: bldAddr,
                datum: dateStr, uhrzeit: timeStr, ort: session.location || 'Versammlungsort',
                wirtschaftsjahr: String(fy), einheit: apt?.apartment_number || '—',
                firma: settings.company_name || '', empfaenger_name: fullName,
                empfaenger_strasse: `${person.street || ''} ${person.house_number || ''}`.trim(),
                empfaenger_plz_ort: `${person.zip_code || ''} ${person.city || ''}`.trim(),
            };
            // Anlagen-Daten zusammenstellen (in TOP-Reihenfolge)
            const anlagenItems = [];
            for (const it of agenda) {
                const topDocs = agendaDocs.filter(d =>
                    d.agenda_item_id === it.id &&
                    (d.scope === 'building' || (d.scope === 'owner' && d.owner_person_id === ownerPersonId))
                );
                for (const d of topDocs) anlagenItems.push({ name: `TOP ${it.sort_order} — ${d.file_name}` });
            }
            if (!isDraft) {
                if (_loadedStaging[`${own.apartment_id}_wp`])  anlagenItems.push({ name: 'Einzelwirtschaftsplan ' + fy });
                if (_loadedStaging[`${own.apartment_id}_jab`]) anlagenItems.push({ name: 'Jahresabrechnung ' + fy });
            }

            const tplTables = {
                tagesordnung: agenda.map(a => ({ nr: a.sort_order, titel: a.title })),
                anlagen: anlagenItems,
            };
            await generateFromTemplate(etvTemplate.content, tplData, tplTables, {
                pdfDoc, page, fonts, settings, templateDoc, startY: y,
            });
        } else {
            // Legacy-Fallback
            page.drawText(`Sehr ${salut} ${person.last_name},`, { x: mLeft, y, size: 10, font: fReg, color: offblack });
            y -= 16;
            const intro = `hiermit laden wir Sie herzlich zur Eigentümerversammlung der WEG ${bldAddr} ein. Die Versammlung findet am ${dateStr} um ${timeStr} Uhr statt (${session.location || 'Versammlungsort'}). Wir bitten um pünktliches Erscheinen.`;
            for (const line of _pdfSplitText(intro, fReg, 9.5, contentW)) {
                page.drawText(line, { x: mLeft, y, size: 9.5, font: fReg, color: offblack });
                y -= 13;
            }
            y -= 14;
            page.drawText('Mit freundlichen Grüßen', { x: mLeft, y, size: 9.5, font: fReg, color: offblack });
            y -= 20;
            page.drawText(settings.company_name || 'Hausverwaltung', { x: mLeft, y, size: 9.5, font: fBold, color: offblack });
        }

        // ── SEITE 2+: TAGESORDNUNG ──────────────────────────────
        page = await addPage();
        y = 740;

        page.drawText('TAGESORDNUNG', { x: mLeft, y, size: 14, font: fBold, color: olive });
        y -= 8;
        page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.5, color: olive });
        y -= 18;

        for (const item of agenda) {
            // TOP-Titel mit Textumbruch berechnen
            const topLabel = `TOP ${item.sort_order}: `;
            const labelW = fBold.widthOfTextAtSize(topLabel, 9.5);
            const titleLines = _pdfSplitText(item.title, fBold, 9.5, contentW - labelW - 16);
            const topBarH = Math.max(24, 10 + titleLines.length * 14);

            // Platz berechnen: TOP-Bar + Vorbemerkung + Beschlussantrag + Anlagen + Abstand
            const premLines = item.preliminary_remark ? _pdfSplitText(item.preliminary_remark, fReg, 9, contentW - 24) : [];
            const resLines  = item.proposed_resolution ? _pdfSplitText(item.proposed_resolution, fReg, 9, contentW - 24) : [];
            const topItemDocs = agendaDocs.filter(d =>
                d.agenda_item_id === item.id &&
                (d.scope === 'building' || (d.scope === 'owner' && d.owner_person_id === ownerPersonId))
            );
            const minNeeded = topBarH + 20; // mindestens Bar + etwas Inhalt
            if (y < mBottom + minNeeded) { page = await addPage(); y = 740; }

            // TOP-Header-Bar (hb-olive, weiße Schrift)
            page.drawRectangle({ x: mLeft, y: y - topBarH, width: contentW, height: topBarH, color: olive });
            page.drawText(topLabel, { x: mLeft + 8, y: y - topBarH + (topBarH - 10) / 2 + (titleLines.length > 1 ? (titleLines.length - 1) * 7 : 0), size: 9.5, font: fBold, color: white });
            titleLines.forEach((l, i) => {
                const ly = y - topBarH + (topBarH - 10) / 2 + (titleLines.length - 1 - i) * 14;
                page.drawText(l, { x: mLeft + 8 + labelW, y: ly, size: 9.5, font: fBold, color: white });
            });
            y -= topBarH + 6;

            // Vorbemerkung
            if (premLines.length) {
                y -= 6; // Abstand zur TOP-Bar
                if (y < mBottom + 30) { page = await addPage(); y = 740; }
                page.drawText('Vorbemerkung:', { x: mLeft + 10, y, size: 11, font: fBold, color: olive });
                y -= 16;
                for (const line of premLines) {
                    if (y < mBottom + 14) { page = await addPage(); y = 740; }
                    page.drawText(line, { x: mLeft + 10, y, size: 9, font: fReg, color: gray50 });
                    y -= 13;
                }
                y -= 4;
            }

            // Beschlussantrag
            if (resLines.length) {
                y -= 4; // Abstand zur Vorbemerkung
                if (y < mBottom + 30) { page = await addPage(); y = 740; }
                page.drawText('Beschlussantrag:', { x: mLeft + 10, y, size: 11, font: fBold, color: olive });
                y -= 16;
                for (const line of resLines) {
                    if (y < mBottom + 14) { page = await addPage(); y = 740; }
                    page.drawText(line, { x: mLeft + 10, y, size: 9, font: fReg, color: offblack });
                    y -= 13;
                }
                y -= 4;
            }

            // TOP-Anlagen
            if (topItemDocs.length) {
                y -= 4;
                if (y < mBottom + 20) { page = await addPage(); y = 740; }
                page.drawText('Anlagen:', { x: mLeft + 10, y, size: 11, font: fBold, color: olive });
                y -= 16;
                for (const td of topItemDocs) {
                    if (y < mBottom + 14) { page = await addPage(); y = 740; }
                    page.drawText(`→ ${td.file_name}`, { x: mLeft + 18, y, size: 8, font: fReg, color: olive });
                    y -= 11;
                }
            }

            y -= 14;
        }

        // ── VOLLMACHT (neue Seite) ────────────────────────────
        page = await addPage();
        y = 740;

        // Titel
        page.drawText('Vollmacht zur Eigentümerversammlung', { x: mLeft, y, size: 16, font: fBold, color: olive });
        y -= 10;
        page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 1, color: olive });
        y -= 24;

        // Intro-Text
        const vollIntro = 'hiermit übertrage(n) ich/wir meine/unsere Vollmacht zur Eigentümerversammlung.';
        page.drawText(vollIntro, { x: mLeft, y, size: 9.5, font: fReg, color: offblack });
        y -= 20;

        // ── Info-Box (Objekt, Datum, Vollmachtgeber, Vollmachtnehmer) ──
        const vBoxPad = 10;
        const halfW = (contentW - 10) / 2;
        const vFieldH = 14;

        // Zeile 1: ETV + ETV-Datum
        page.drawRectangle({ x: mLeft, y: y - 34, width: halfW, height: 34, borderColor: gray50, borderWidth: 0.5 });
        page.drawRectangle({ x: mLeft + halfW + 10, y: y - 34, width: halfW, height: 34, borderColor: gray50, borderWidth: 0.5 });
        page.drawText('ETV', { x: mLeft + vBoxPad, y: y - 10, size: 7, font: fBold, color: gray50 });
        page.drawText(`${bldName} — WJ ${fy}`, { x: mLeft + vBoxPad, y: y - 24, size: 9, font: fSemi, color: offblack });
        page.drawText('Datum / Uhrzeit', { x: mLeft + halfW + 10 + vBoxPad, y: y - 10, size: 7, font: fBold, color: gray50 });
        page.drawText(`${dateStr}  um  ${timeStr} Uhr`, { x: mLeft + halfW + 10 + vBoxPad, y: y - 24, size: 9, font: fSemi, color: offblack });
        y -= 38;

        // Zeile 2: Vollmachtgeber (vorbefüllt)
        const vgLines = addrLines;
        const vgBoxH = 14 + vgLines.length * 13;
        page.drawRectangle({ x: mLeft, y: y - vgBoxH, width: halfW, height: vgBoxH, borderColor: gray50, borderWidth: 0.5 });
        page.drawText('Vollmachtgeber', { x: mLeft + vBoxPad, y: y - 10, size: 7, font: fBold, color: gray50 });
        vgLines.forEach((l, i) => page.drawText(l, { x: mLeft + vBoxPad, y: y - 22 - i * 13, size: 9, font: fReg, color: offblack }));

        // Zeile 2: Vollmachtnehmer (leer zum Ausfüllen)
        page.drawRectangle({ x: mLeft + halfW + 10, y: y - vgBoxH, width: halfW, height: vgBoxH, borderColor: gray50, borderWidth: 0.5 });
        page.drawText('Vollmachtnehmer', { x: mLeft + halfW + 10 + vBoxPad, y: y - 10, size: 7, font: fBold, color: gray50 });
        // Linien zum Ausfüllen
        for (let li = 0; li < Math.min(vgLines.length, 3); li++) {
            const ly = y - 24 - li * 13;
            page.drawLine({ start: { x: mLeft + halfW + 10 + vBoxPad, y: ly }, end: { x: mLeft + halfW + 10 + halfW - vBoxPad, y: ly }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
        }
        y -= vgBoxH + 10;

        // ── Stimmrechts-Optionen (Checkboxen) ──────────────────
        page.drawText('Bei der Ausübung des Stimmrechts sind folgende Weisungen zu beachten:', { x: mLeft, y, size: 9, font: fBold, color: offblack });
        y -= 18;

        const cbSize = 10;
        const cbOpts = [
            'Ich/Wir ermächtige(n) die/den Bevollmächtigte/n sämtliche Abstimmungen vorbehaltlos nach ihrem/seinem Ermessen vorzunehmen.',
            'Ich/Wir erteile(n) der/dem Bevollmächtigten Stimmrechtsanweisungen für die angeführten Tagesordnungspunkte (siehe Tabelle).',
            'Ich/Wir bevollmächtige(n) die Hausverwaltung, die nachfolgenden Stimmrechtsanweisungen als Vertreter wahrzunehmen.',
        ];
        for (const opt of cbOpts) {
            const optLines = _pdfSplitText(opt, fReg, 8.5, contentW - cbSize - 12);
            const optH = optLines.length * 12;
            if (y - optH < mBottom + 20) { page = await addPage(); y = 740; }
            // Checkbox
            page.drawRectangle({ x: mLeft, y: y - cbSize, width: cbSize, height: cbSize, borderColor: gray50, borderWidth: 0.5 });
            optLines.forEach((l, i) => {
                page.drawText(l, { x: mLeft + cbSize + 8, y: y - 2 - i * 12, size: 8.5, font: fReg, color: offblack });
            });
            y -= Math.max(optH, cbSize) + 8;
        }
        y -= 6;

        // ── Abstimmungstabelle ──────────────────────────────────
        // Nur abstimmungsrelevante TOPs (nicht "none")
        const voteTops = agenda.filter(a => a.voting_type !== 'none');
        if (voteTops.length) {
            const colTop = 55;
            const colTitle = contentW - colTop - 120;
            const colVote = 40;
            const rowH = 20;

            // Header
            const headerH = 20;
            if (y - headerH < mBottom + 20) { page = await addPage(); y = 740; }
            page.drawRectangle({ x: mLeft, y: y - headerH, width: contentW, height: headerH, color: olive });
            page.drawText('Top', { x: mLeft + 6, y: y - headerH + 6, size: 8, font: fBold, color: white });
            page.drawText('Titel', { x: mLeft + colTop + 6, y: y - headerH + 6, size: 8, font: fBold, color: white });
            const vx = mLeft + colTop + colTitle;
            page.drawText('ja', { x: vx + 12, y: y - headerH + 6, size: 8, font: fBold, color: white });
            page.drawText('nein', { x: vx + colVote + 7, y: y - headerH + 6, size: 8, font: fBold, color: white });
            page.drawText('enthalten', { x: vx + colVote * 2 + 2, y: y - headerH + 6, size: 8, font: fBold, color: white });
            y -= headerH;

            for (const item of voteTops) {
                const titleText = item.title;
                const tLines = _pdfSplitText(titleText, fReg, 8.5, colTitle - 10);
                const rH = Math.max(rowH, tLines.length * 12 + 8);

                if (y - rH < mBottom + 10) {
                    page = await addPage(); y = 740;
                    // Header wiederholen
                    page.drawRectangle({ x: mLeft, y: y - headerH, width: contentW, height: headerH, color: olive });
                    page.drawText('Top', { x: mLeft + 6, y: y - headerH + 6, size: 8, font: fBold, color: white });
                    page.drawText('Titel', { x: mLeft + colTop + 6, y: y - headerH + 6, size: 8, font: fBold, color: white });
                    const vx2 = mLeft + colTop + colTitle;
                    page.drawText('ja', { x: vx2 + 12, y: y - headerH + 6, size: 8, font: fBold, color: white });
                    page.drawText('nein', { x: vx2 + colVote + 7, y: y - headerH + 6, size: 8, font: fBold, color: white });
                    page.drawText('enthalten', { x: vx2 + colVote * 2 + 2, y: y - headerH + 6, size: 8, font: fBold, color: white });
                    y -= headerH;
                }

                // Trennlinie
                page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });

                // TOP-Nr
                page.drawText(`Top ${item.sort_order}`, { x: mLeft + 6, y: y - rH + (rH - 8) / 2 + (tLines.length > 1 ? (tLines.length - 1) * 6 : 0), size: 8.5, font: fBold, color: offblack });

                // Titel (mehrzeilig)
                tLines.forEach((l, i) => {
                    page.drawText(l, { x: mLeft + colTop + 6, y: y - 12 - i * 12, size: 8.5, font: fReg, color: offblack });
                });

                // Checkboxen (ja/nein/enthalten)
                const cbY = y - rH + (rH - cbSize) / 2 + (tLines.length > 1 ? (tLines.length - 1) * 6 : 0);
                const vx3 = mLeft + colTop + colTitle;
                page.drawRectangle({ x: vx3 + 10, y: cbY, width: cbSize, height: cbSize, borderColor: gray50, borderWidth: 0.5 });
                page.drawRectangle({ x: vx3 + colVote + 10, y: cbY, width: cbSize, height: cbSize, borderColor: gray50, borderWidth: 0.5 });
                page.drawRectangle({ x: vx3 + colVote * 2 + 10, y: cbY, width: cbSize, height: cbSize, borderColor: gray50, borderWidth: 0.5 });

                y -= rH;
            }
            // Untere Trennlinie
            page.drawLine({ start: { x: mLeft, y }, end: { x: mRight, y }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
        }
        y -= 16;

        // ── Unterschrift (Linien) ────────────────────────────────
        if (y < mBottom + 40) { page = await addPage(); y = 740; }
        y -= 24;
        page.drawLine({ start: { x: mLeft, y }, end: { x: mLeft + halfW - 10, y }, thickness: 0.5, color: offblack });
        page.drawLine({ start: { x: mLeft + halfW + 10, y }, end: { x: mRight, y }, thickness: 0.5, color: offblack });
        page.drawText('Ort, Datum', { x: mLeft, y: y - 12, size: 7, font: fReg, color: gray50 });
        page.drawText('Unterschrift', { x: mLeft + halfW + 10, y: y - 12, size: 7, font: fReg, color: gray50 });

        // ── Staged Anlagen (WP + JAB) anhängen ───────────────
        for (const docType of ['wp', 'jab']) {
            const key = `${own.apartment_id}_${docType}`;
            if (_loadedStaging[key]) {
                try {
                    const annexDoc = await PDFDocument.load(_loadedStaging[key]);
                    const count    = annexDoc.getPageCount();
                    const copied   = await pdfDoc.copyPages(annexDoc, [...Array(count).keys()]);
                    copied.forEach(p => pdfDoc.addPage(p));
                } catch(e) { /* Fehler beim Merge */ }
            }
        }

        // ── TOP-Dokumente anhängen in TOP-Reihenfolge (building-scope + owner-scope) ──
        for (const item of agenda) {
            const topDocs = agendaDocs.filter(d =>
                d.agenda_item_id === item.id &&
                (d.scope === 'building' || (d.scope === 'owner' && d.owner_person_id === ownerPersonId))
            );
            for (const doc of topDocs) {
                if (_loadedDocPDFs[doc.id]) {
                    try {
                        const annexDoc = await PDFDocument.load(_loadedDocPDFs[doc.id]);
                        const count    = annexDoc.getPageCount();
                        const copied   = await pdfDoc.copyPages(annexDoc, [...Array(count).keys()]);
                        copied.forEach(p => pdfDoc.addPage(p));
                    } catch(e) { /* Fehler beim Merge */ }
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        const safeName = fullName.replace(/[^a-z0-9äöüß]/gi, '_');
        const draftTag = isDraft ? 'ENTWURF_' : '';
        const fileName = `${draftTag}Einladung_ETV_${fy}_${safeName}.pdf`;
        zipFiles.push({ name: fileName, data: pdfBytes });
    }

    // ── Export: ZIP oder Einzel-PDF ──────────────────────────
    if (zipFiles.length === 1) {
        // Nur 1 Eigentümer → direkt als PDF
        _pdfDownload(zipFiles[0].data, zipFiles[0].name);
    } else if (typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        for (const f of zipFiles) zip.file(f.name, f.data);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${isDraft ? 'ENTWURF_' : ''}Einladungen_ETV_${fy}_${bldName.replace(/[^a-z0-9]/gi, '_')}.zip`;
        a.click(); URL.revokeObjectURL(url);
    } else {
        // Fallback ohne JSZip: alle als einzelne Downloads
        for (const f of zipFiles) _pdfDownload(f.data, f.name);
    }

    if (isDraft) {
        showToast(`Entwurf für ${zipFiles.length} Eigentümer erstellt (ohne Staging/Freigabe).`, 'success');
        return;
    }

    // Status-Trigger: Verknüpfte Dokumente (JAB/WP) von draft → released schalten
    try {
        const { data: draftDocs } = await _supabase.from('documents')
            .select('id')
            .eq('building_id', session.building_id)
            .eq('status', 'draft')
            .in('category', ['Wirtschaftsplan', 'Jahresabrechnung']);
        if (draftDocs && draftDocs.length) {
            const docIds = draftDocs.map(function(d) { return d.id; });
            await _supabase.from('documents')
                .update({ status: 'released', updated_at: new Date().toISOString() })
                .in('id', docIds);
            showToast(`${zipFiles.length} Einladungen generiert. ${draftDocs.length} Dokumente freigeschaltet.`, 'success');
        } else {
            showToast(`${zipFiles.length} Einladungen erfolgreich generiert.`, 'success');
        }
    } catch(e) {
        console.error('Status-Trigger Fehler:', e);
        showToast(`${zipFiles.length} Einladungen generiert. Dokument-Freigabe fehlgeschlagen.`, 'warning');
    }
}