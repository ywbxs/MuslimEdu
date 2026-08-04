// Minimal hand-rolled PDF writer.
//
// This is a bare RN app with no android/ or ios/ native project folders to
// link a new native module into, so a PDF library (react-native-html-to-pdf,
// react-native-pdf-lib, etc.) can't be added this round. PDF's actual file
// format for a simple paginated text table - the Catalog/Pages/Page objects,
// a Helvetica base-14 font (no embedding needed), a plain-text content
// stream of Td/Tj operators, and an xref table - is a well-documented,
// static structure, so it's built here by hand instead of silently
// substituting an image/screenshot for "PDF export".
//
// Deliberately text-only, one exported table shape: a title, a header row,
// and left-aligned data rows across a fixed set of columns. Good enough for
// a printable schedule/report; not a general PDF layout engine.

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 18;
const HEADER_FONT_SIZE = 9;
const DATA_FONT_SIZE = 9;
const TITLE_FONT_SIZE = 16;

export interface PdfColumn {
  label: string;
  width: number; // points - callers should make these sum to <= USABLE_WIDTH (~532)
}

// PDF string literals only escape ( ) \ - everything else is passed through
// as-is, but the standard Helvetica font only has real glyphs for
// WinAnsiEncoding's Latin-1-ish range, so anything outside it (Arabic
// names, emoji, etc.) is replaced with '?' rather than corrupting the file
// or silently rendering as tofu/garbage in whatever PDF viewer opens it.
function pdfEscape(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, '?');
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function textOp(x: number, y: number, size: number, font: 'F1' | 'F2', text: string): string {
  return `BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(text)}) Tj ET\n`;
}

function truncateToWidth(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return maxChars > 1 ? `${text.slice(0, maxChars - 1)}…` : text.slice(0, maxChars);
}

/**
 * Builds a complete PDF file as a raw byte string (Latin-1/ASCII range only -
 * write it with RNFS using 'ascii' encoding, not 'utf8', or the byte offsets
 * in the xref table below will no longer line up with the actual file).
 */
export function buildTablePdf(title: string, columns: PdfColumn[], rows: string[][]): string {
  const rowsPerPage = Math.max(1, Math.floor((PAGE_HEIGHT - MARGIN * 2 - 70) / ROW_HEIGHT));
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
  const catalogNum = 1;
  const pagesNum = 2;
  const fontRegularNum = 3;
  const fontBoldNum = 4;
  const firstDynamicNum = 5;

  const pageNums: number[] = [];
  const contentNums: number[] = [];
  for (let p = 0; p < pageCount; p++) {
    pageNums.push(firstDynamicNum + p * 2);
    contentNums.push(firstDynamicNum + p * 2 + 1);
  }

  objects[catalogNum] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;
  objects[pagesNum] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  objects[fontRegularNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[fontBoldNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const colX: number[] = [];
  let acc = MARGIN;
  for (const col of columns) {
    colX.push(acc);
    acc += col.width;
  }
  const charWidth = DATA_FONT_SIZE * 0.55; // rough average glyph width for Helvetica at this size

  for (let p = 0; p < pageCount; p++) {
    let stream = '';
    let y = PAGE_HEIGHT - MARGIN;

    stream += textOp(MARGIN, y, TITLE_FONT_SIZE, 'F2', pageCount > 1 ? `${title} (page ${p + 1} of ${pageCount})` : title);
    y -= TITLE_FONT_SIZE + 18;

    columns.forEach((col, i) => {
      stream += textOp(colX[i], y, HEADER_FONT_SIZE, 'F2', col.label.toUpperCase());
    });
    y -= 6;
    stream += `${MARGIN.toFixed(1)} ${(y - 2).toFixed(1)} m ${(PAGE_WIDTH - MARGIN).toFixed(1)} ${(y - 2).toFixed(1)} l S\n`;
    y -= ROW_HEIGHT - 2;

    const pageRows = rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    for (const row of pageRows) {
      columns.forEach((col, i) => {
        const maxChars = Math.max(3, Math.floor(col.width / charWidth));
        stream += textOp(colX[i], y, DATA_FONT_SIZE, 'F1', truncateToWidth(row[i] ?? '', maxChars));
      });
      y -= ROW_HEIGHT;
    }

    if (rows.length === 0) {
      stream += textOp(MARGIN, y, DATA_FONT_SIZE, 'F1', 'Nothing to show yet.');
    }

    objects[pageNums[p]] =
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R >> >> /Contents ${contentNums[p]} 0 R >>`;
    objects[contentNums[p]] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  }

  // Assemble, tracking byte offsets for the xref table as we go - every
  // object must report exactly where it starts in the final file.
  let body = '%PDF-1.4\n';
  const offsets: number[] = [0]; // index 0 is the free-list head, never used
  const totalObjects = objects.length - 1; // objects[] is 1-indexed, slot 0 unused

  for (let n = 1; n <= totalObjects; n++) {
    offsets[n] = body.length;
    body += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjects; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return body + xref + trailer;
}
