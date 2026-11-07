import PDFDocument from 'pdfkit';

/**
 * Génération PDF côté serveur (aucune dépendance à un service externe).
 *
 * Utilisée pour : factures (BIL-01), rapports de précision (S4) et tout document
 * qui doit porter une mention légale visible. Les mentions obligatoires sont
 * passées en `footer` et répétées sur chaque page : elles ne peuvent pas être
 * tronquées à l'affichage.
 */

const COLORS = { ink: '#111827', muted: '#6B7280', line: '#E5E7EB', accent: '#166534' };

export const contentType = 'application/pdf';

/**
 * @param {object} doc
 * @param {string} doc.title
 * @param {string} [doc.subtitle]
 * @param {Array<{heading?: string, rows?: Array<[string, string]>, text?: string}>} doc.sections
 * @param {string} [doc.footer] mention légale répétée en pied de page
 * @param {Array<Array<string>>} [doc.table] lignes d'un tableau simple (1re ligne = en-têtes)
 * @param {string} [doc.reference]
 * @returns {Promise<Buffer>}
 */
export const buildPdf = (doc) =>
  new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 48, info: { Title: doc.title } });
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const footer = doc.footer ?? 'Document généré par AGRIKONNECT AFRICA';

    /**
     * Le pied de page est écrit DANS la marge : on neutralise temporairement la
     * marge basse, sinon PDFKit ajoute une page à chaque pied de page (boucle
     * infinie). Le garde-fou `writingFooter` empêche toute récursion.
     */
    let writingFooter = false;
    const writeFooter = () => {
      if (writingFooter || !pdf.page) return;
      writingFooter = true;
      const bottomMargin = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(footer, 48, pdf.page.height - 36, {
          width: pdf.page.width - 96,
          align: 'center',
          lineBreak: false,
        });
      pdf.page.margins.bottom = bottomMargin;
      writingFooter = false;
    };

    pdf.on('pageAdded', () => {
      // Le contenu d'une nouvelle page commence après l'en-tête précédent :
      // on réécrit simplement le pied de page de la nouvelle page.
      writeFooter();
      pdf.y = pdf.page.margins.top;
    });

    pdf.fontSize(18).fillColor(COLORS.accent).text('AGRIKONNECT AFRICA');
    pdf.moveDown(0.2);
    pdf.fontSize(15).fillColor(COLORS.ink).text(doc.title);
    if (doc.subtitle) pdf.fontSize(10).fillColor(COLORS.muted).text(doc.subtitle);

    if (doc.reference) {
      pdf.moveDown(0.3);
      pdf.fontSize(9).fillColor(COLORS.muted).text(`Référence : ${doc.reference}`);
    }

    pdf.moveDown(0.8);

    for (const section of doc.sections ?? []) {
      if (section.heading) {
        pdf.fontSize(12).fillColor(COLORS.ink).text(section.heading);
        pdf.moveDown(0.25);
      }
      for (const [label, value] of section.rows ?? []) {
        pdf.fontSize(9.5).fillColor(COLORS.muted).text(`${label} : `, { continued: true });
        pdf.fillColor(COLORS.ink).text(String(value ?? '—'));
      }
      if (section.text) {
        pdf.fontSize(9.5).fillColor(COLORS.ink).text(section.text, { align: 'justify' });
      }
      pdf.moveDown(0.5);
    }

    if (doc.table?.length) {
      const [header, ...rows] = doc.table;
      const colWidth = (pdf.page.width - 96) / header.length;
      const drawRow = (cells, bold = false) => {
        const y = pdf.y;
        cells.forEach((cell, index) => {
          pdf
            .fontSize(9)
            .fillColor(bold ? COLORS.ink : COLORS.muted)
            .text(String(cell ?? ''), 48 + index * colWidth, y, { width: colWidth - 6 });
        });
        pdf.y = y + 16;
        pdf
          .moveTo(48, pdf.y - 4)
          .lineTo(pdf.page.width - 48, pdf.y - 4)
          .strokeColor(COLORS.line)
          .stroke();
      };
      drawRow(header, true);
      rows.forEach((row) => drawRow(row));
      pdf.moveDown(0.6);
    }

    if (doc.total) {
      pdf.fontSize(11).fillColor(COLORS.ink).text(doc.total, { align: 'right' });
    }

    writeFooter();
    pdf.end();
  });

export const sendPdf = (res, buffer, filename) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.end(buffer);
};
