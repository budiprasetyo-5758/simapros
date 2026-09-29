
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import logoRscm from '@/assets/logo-rscm.png';
import type { FollowUpTindakLanjut, FollowUpProgress } from '@/hooks/useTindakLanjut';
 
type ProgressById = Record<string, FollowUpProgress[]>;
 
// ── Konstanta template ──────────────────────────────────────────────────
 
const DOC_TITLE = 'NOTULEN RAPAT';
const DOC_ORG = 'RSUP NASIONAL DR. CIPTO MANGUNKUSUMO';
 
const COLUMNS = [
  'NO',
  'TOPIK',
  'MASALAH & RENCANA TINDAK LANJUT',
  'ACTION PLAN',
  'PROGRES TINDAK LANJUT',
  'BATAS WAKTU PENYELESAIAN',
  'PIC',
] as const;
 
/** w:tblGrid template (twips). Total 14355 twips = 9,97 inci. */
const COL_TWIPS = [586, 1572, 4454, 4057, 1324, 1336, 1026];
/** w:tcW — sama dengan gridCol. */
const CELL_TWIPS = COL_TWIPS;
/** w:tblW dan w:tblInd. */
const TABLE_W_TWIPS = 14355;
const TABLE_IND_TWIPS = -700;
 
/**
 * w:pgSz ditulis sebagai ukuran potret (Letter 12240 x 15840) karena pustaka
 * `docx` yang membalik lebar/tinggi saat orientasi landscape; hasil akhirnya
 * 15840 x 12240 seperti template.
 */
const PAGE_SHORT_TWIPS = 12240;
const PAGE_LONG_TWIPS = 15840;
/** w:pgMar. */
const PAGE_MARGIN_TWIPS = 1440;
const PAGE_HEADER_TWIPS = 720;
/** Margin efektif kiri/kanan tabel pada halaman = pgMar + tblInd. */
const TABLE_MARGIN_TWIPS = PAGE_MARGIN_TWIPS + TABLE_IND_TWIPS;
 
/** w:ind paragraf judul dan sel BATAS WAKTU PENYELESAIAN. */
const TITLE_IND_TWIPS = -720;
const DEADLINE_IND_TWIPS = 40;
/** Indentasi gantung daftar di dalam sel (16 pt, sama dengan versi HTML). */
const LIST_IND_TWIPS = 320;
 
/** w:trHeight per jenis baris. */
const ROW_H_HEADER = 690;
const ROW_H_BAND = 330;
const ROW_H_DATA = 1590;
 
/** w:sz w:tcBorders (satuan 1/8 pt) dan w:tcMar kiri/kanan. */
const BORDER_SZ = 5;
const BORDER_COLOR = '000000';
const CELL_MARGIN_TWIPS = 100;
 
/** docDefaults template: Arial 11 pt (w:sz 22 setengah-poin), line 276 auto. */
const BASE_FONT_NAME = 'Arial';
const BASE_FONT_HALF_PT = 22;
const TITLE_FONT_HALF_PT = 28;
const META_FONT_HALF_PT = 18;
const LINE_SPACING = 276;
 
/** Lebar kolom dalam point (1 pt = 20 twips) — dipakai HTML untuk PDF. */
const COL_PT = COL_TWIPS.map((tw) => tw / 20);
const TABLE_PT = TABLE_W_TWIPS / 20;
/** Lebar render HTML off-screen (px) = lebar tabel template pada 96 dpi. */
const RENDER_WIDTH_PX = Math.round((TABLE_PT * 4) / 3);
/** Lebar kolom Excel (satuan karakter) hasil konversi dari twips. */
const COL_WIDTHS_XLS = [5, 14, 41, 38, 12, 12, 9];
 
/** w:shd fill pita di bawah baris header. */
const BAND_FILL = '6AEFF0';
/** wp:extent logo pada word/header1.xml (EMU). 1 px @96dpi = 9525 EMU. */
const EMU_PER_PX = 9525;
const LOGO_W_PX = 1468967 / EMU_PER_PX;
const LOGO_H_PX = 956307 / EMU_PER_PX;
/** Versi bulat untuk atribut HTML & penempatan gambar Excel. */
const LOGO_W_PX_INT = Math.round(LOGO_W_PX);
const LOGO_H_PX_INT = Math.round(LOGO_H_PX);
 
const FONT_STACK = `Arial, Helvetica, sans-serif`;
/** Padanan w:sz 5 (5/8 pt ≈ 0,83 px @96dpi) di HTML: garis 1 px yang utuh. */
const BORDER = `1px solid #${BORDER_COLOR}`;
/** Padanan w:tcMar template: atas/bawah 0, kiri/kanan 100 twips = 5 pt. */
const CELL_PADDING = `0 ${CELL_MARGIN_TWIPS / 20}pt`;
 
// ── Helper data ─────────────────────────────────────────────────────────
 
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'd MMM yyyy', { locale: localeId });
  } catch {
    return dateStr;
  }
}
 
/** Pecah teks bebas menjadi item daftar; buang penomoran/bullet yang sudah ada. */
function splitItems(text: string | null | undefined): string[] {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
}
 
function progressLines(entries: FollowUpProgress[] | undefined): string[] {
  if (!entries || entries.length === 0) return [];
  return entries.map((p) => `${fmtDate(p.progress_date)} — ${p.note}`);
}
 
function picNames(row: FollowUpTindakLanjut): string[] {
  // Nama saja, urutan Direksi lalu PIC. Coresec TIDAK disertakan.
  return [...(row.direksi ?? []), ...(row.pic ?? [])].filter(Boolean);
}
 
function safeFileName(label: string): string {
  return label.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Notulensi';
}
 
function printedOn(): string {
  return format(new Date(), 'd MMMM yyyy', { locale: localeId });
}
 
/** Satu blok isi sel: daftar bernomor / bertanda, dengan label opsional. */
type CellBlock = { label?: string; items: string[]; ordered: boolean };
 
/** Kolom MASALAH & RENCANA TINDAK LANJUT = masalah, lalu upaya tindak lanjut. */
function masalahBlocks(row: FollowUpTindakLanjut): CellBlock[] {
  const blocks: CellBlock[] = [];
  const masalah = splitItems(row.masalah);
  if (masalah.length) blocks.push({ items: masalah, ordered: true });
 
  const upaya = splitItems(row.upaya_tindak_lanjut);
  if (upaya.length) blocks.push({ label: 'Rencana Tindak Lanjut', items: upaya, ordered: true });
 
  return blocks;
}
 
/** Kolom ACTION PLAN. */
function actionBlocks(row: FollowUpTindakLanjut): CellBlock[] {
  const items = splitItems(row.action_plan);
  return items.length ? [{ items, ordered: true }] : [];
}
 
/** Kolom PROGRES TINDAK LANJUT. */
function progresBlocks(progress: FollowUpProgress[] | undefined): CellBlock[] {
  const items = progressLines(progress);
  return items.length ? [{ items, ordered: false }] : [];
}
 
function blocksToText(blocks: CellBlock[]): string {
  return blocks
    .map((b) => {
      // Satu butir tanpa label ditulis polos, tanpa nomor "1." yang mubazir.
      const body =
        b.items.length === 1 && b.ordered && !b.label
          ? b.items[0]
          : b.items.map((it, i) => (b.ordered ? `${i + 1}. ${it}` : `• ${it}`)).join('\n');
      return b.label ? `${b.label}:\n${body}` : body;
    })
    .join('\n\n');
}
 
// ── Builder HTML (dipakai oleh PDF) ─────────────────────────────────────
 
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
 
const CELL_BASE = `border:${BORDER};padding:${CELL_PADDING};font-family:${FONT_STACK};font-size:${BASE_FONT_HALF_PT / 2}pt;line-height:${LINE_SPACING / 240};`;
const TH_STYLE = `${CELL_BASE}font-weight:bold;text-align:center;vertical-align:middle;`;
const TD_STYLE = `${CELL_BASE}vertical-align:top;word-wrap:break-word;`;
const LIST_STYLE = `margin:0;padding-left:${LIST_IND_TWIPS / 20}pt;`;
const LABEL_STYLE = 'margin:6pt 0 2pt 0;font-weight:bold;';
 
function blocksHtml(blocks: CellBlock[]): string {
  if (blocks.length === 0) return '&nbsp;';
  return blocks
    .map((b) => {
      const label = b.label ? `<p style="${LABEL_STYLE}">${esc(b.label)}:</p>` : '';
      // Satu butir tanpa label ditulis polos, tanpa nomor "1." yang mubazir.
      if (b.items.length === 1 && b.ordered && !b.label) return `<p style="margin:0;">${esc(b.items[0])}</p>`;
      const tag = b.ordered ? 'ol' : 'ul';
      const items = b.items.map((it) => `<li>${esc(it)}</li>`).join('');
      return `${label}<${tag} style="${LIST_STYLE}">${items}</${tag}>`;
    })
    .join('');
}
 
function linesHtml(lines: string[]): string {
  return lines.length ? lines.map((l) => esc(l)).join('<br/>') : '&nbsp;';
}
 
function kopHtml(categoryLabel: string, logoSrc: string | null): string {
  const logo = logoSrc
    ? `<img src="${logoSrc}" width="${LOGO_W_PX_INT}" height="${LOGO_H_PX_INT}" style="width:${LOGO_W_PX_INT}px;height:${LOGO_H_PX_INT}px;display:block;border:0;" alt="RSUP Nasional Dr. Cipto Mangunkusumo" />`
    : '';
  return `<div style="font-family:${FONT_STACK};color:#000000;">
    ${logo}
    <p style="margin:10pt 0 0 0;font-size:${TITLE_FONT_HALF_PT / 2}pt;font-weight:bold;">${esc(DOC_TITLE)}</p>
    <p style="margin:0;font-size:${TITLE_FONT_HALF_PT / 2}pt;font-weight:bold;">${esc(DOC_ORG)}</p>
    <p style="margin:4pt 0 0 0;font-size:${META_FONT_HALF_PT / 2}pt;color:#333333;">${esc(categoryLabel)} &middot; Dicetak ${esc(printedOn())}</p>
  </div>`;
}
 
function tableHtml(rows: FollowUpTindakLanjut[], progressById: ProgressById): string {
  const colgroup = COL_PT.map((pt) => `<col style="width:${pt}pt" width="${Math.round((pt * 4) / 3)}" />`).join('');
 
  const headerCells = COLUMNS.map(
    (c, i) => `<th style="${TH_STYLE}width:${COL_PT[i]}pt;height:${ROW_H_HEADER / 20}pt;">${esc(c)}</th>`,
  ).join('');
  const bandCells = COL_PT.map(
    (pt) => `<td style="${TD_STYLE}width:${pt}pt;height:${ROW_H_BAND / 20}pt;background:#${BAND_FILL};">&nbsp;</td>`,
  ).join('');
 
  const body =
    rows.length === 0
      ? `<tr><td colspan="${COLUMNS.length}" style="${TD_STYLE}text-align:center;font-style:italic;color:#555555;">Belum ada tindak lanjut.</td></tr>`
      : rows
          .map((row, idx) => {
            return `<tr>
        <td style="${TD_STYLE}text-align:center;">${idx + 1}</td>
        <td style="${TD_STYLE}font-weight:bold;">${esc(row.topik || '')}</td>
        <td style="${TD_STYLE}text-align:justify;">${blocksHtml(masalahBlocks(row))}</td>
        <td style="${TD_STYLE}text-align:justify;">${blocksHtml(actionBlocks(row))}</td>
        <td style="${TD_STYLE}">${blocksHtml(progresBlocks(progressById[row.id]))}</td>
        <td style="${TD_STYLE}text-align:center;padding-left:${DEADLINE_IND_TWIPS / 20}pt;">${esc(fmtDate(row.deadline))}</td>
        <td style="${TD_STYLE}text-align:center;">${linesHtml(picNames(row))}</td>
      </tr>`;
          })
          .join('');
 
  return `<table cellspacing="0" cellpadding="0" style="width:${TABLE_PT}pt;border-collapse:collapse;table-layout:fixed;">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headerCells}</tr><tr>${bandCells}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}
 
// ── Logo ────────────────────────────────────────────────────────────────
 
let logoDataUrl: string | null | undefined;
let logoBytes: Uint8Array | null | undefined;
 
/** Logo sebagai data URL supaya ikut ter-embed di file Excel/PDF. */
async function getLogoDataUrl(): Promise<string | null> {
  if (logoDataUrl !== undefined) return logoDataUrl;
  try {
    const res = await fetch(logoRscm);
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    logoDataUrl = null;
  }
  return logoDataUrl;
}
 
/** Logo sebagai byte mentah — bentuk yang diminta ImageRun pustaka `docx`. */
async function getLogoBytes(): Promise<Uint8Array | null> {
  if (logoBytes !== undefined) return logoBytes;
  try {
    const res = await fetch(logoRscm);
    logoBytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    logoBytes = null;
  }
  return logoBytes;
}
 
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
 
function fileStem(categoryLabel: string): string {
  return `Notulen_Rapat_${safeFileName(categoryLabel)}_${format(new Date(), 'yyyyMMdd')}`;
}
 
// ── Word (.docx OOXML asli, mengikuti Notulen.docx) ─────────────────────
 
type DocxModule = typeof import('docx');
type DocxParagraph = import('docx').Paragraph;
type DocxTableCell = import('docx').TableCell;
type DocxTableRow = import('docx').TableRow;
type DocxAlignment = (typeof import('docx').AlignmentType)[keyof typeof import('docx').AlignmentType];
 
/** Nama referensi penomoran/bullet untuk daftar di dalam sel. */
const NUM_ORDERED = 'notulen-ordered';
const NUM_BULLET = 'notulen-bullet';
 
const CELL_MARGINS = {
  top: 0,
  bottom: 0,
  left: CELL_MARGIN_TWIPS,
  right: CELL_MARGIN_TWIPS,
} as const;
 
/**
 * w:tcBorders template memakai garis bersama: hanya sel pertama pada sebuah
 * baris yang menggambar sisi kiri, dan hanya baris pertama yang menggambar sisi
 * atas. Sisanya "nil" supaya garis tidak menebal ganda.
 */
function cellBorders(d: DocxModule, firstRow: boolean, firstCol: boolean) {
  const line = { style: d.BorderStyle.SINGLE, size: BORDER_SZ, color: BORDER_COLOR };
  const none = { style: d.BorderStyle.NIL };
  return {
    top: firstRow ? line : none,
    left: firstCol ? line : none,
    bottom: line,
    right: line,
  };
}
 
function docxCell(
  d: DocxModule,
  index: number,
  firstRow: boolean,
  children: DocxParagraph[],
  opts: { band?: boolean; middle?: boolean } = {},
): DocxTableCell {
  return new d.TableCell({
    width: { size: CELL_TWIPS[index], type: d.WidthType.DXA },
    borders: cellBorders(d, firstRow, index === 0),
    margins: CELL_MARGINS,
    ...(opts.middle ? { verticalAlign: d.VerticalAlign.CENTER } : {}),
    ...(opts.band ? { shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: BAND_FILL } } : {}),
    children,
  });
}
 
/** Paragraf isi sel biasa. Teks kosong tetap menghasilkan satu paragraf,
 *  karena sel Word tanpa paragraf membuat dokumen dianggap rusak. */
function docxPara(
  d: DocxModule,
  text: string,
  opts: { align?: DocxAlignment; bold?: boolean; indent?: number } = {},
): DocxParagraph {
  return new d.Paragraph({
    ...(opts.align ? { alignment: opts.align } : {}),
    ...(opts.indent ? { indent: { left: opts.indent } } : {}),
    children: text ? [new d.TextRun({ text, bold: opts.bold })] : [],
  });
}
 
/**
 * Blok isi sel menjadi paragraf Word. Setiap daftar bernomor memakai instance
 * penomoran tersendiri (w:num + w:startOverride) supaya nomor selalu mulai dari
 * 1 di tiap sel, bukan lanjut dari baris sebelumnya.
 */
function blocksToParagraphs(
  d: DocxModule,
  blocks: CellBlock[],
  nextInstance: () => number,
  align?: DocxAlignment,
): DocxParagraph[] {
  if (blocks.length === 0) return [docxPara(d, '', { align })];
 
  const out: DocxParagraph[] = [];
  for (const block of blocks) {
    if (block.label) {
      out.push(
        new d.Paragraph({
          spacing: { before: 120, after: 40 },
          children: [new d.TextRun({ text: `${block.label}:`, bold: true })],
        }),
      );
    }
    // Satu butir tanpa label ditulis polos, tanpa nomor "1." yang mubazir.
    if (block.items.length === 1 && block.ordered && !block.label) {
      out.push(docxPara(d, block.items[0], { align }));
      continue;
    }
    const instance = nextInstance();
    for (const item of block.items) {
      out.push(
        new d.Paragraph({
          ...(align ? { alignment: align } : {}),
          numbering: { reference: block.ordered ? NUM_ORDERED : NUM_BULLET, level: 0, instance },
          children: [new d.TextRun(item)],
        }),
      );
    }
  }
  return out;
}
 
/** Paragraf judul: w:ind left -720, tebal 14 pt, w:spacing line 240 auto. */
function titleParagraph(d: DocxModule, text: string): DocxParagraph {
  return new d.Paragraph({
    widowControl: false,
    indent: { left: TITLE_IND_TWIPS },
    spacing: { line: 240, lineRule: d.LineRuleType.AUTO },
    children: [new d.TextRun({ text, bold: true, size: TITLE_FONT_HALF_PT })],
  });
}
 
export async function exportNotulensiWord(
  categoryLabel: string,
  rows: FollowUpTindakLanjut[],
  progressById: ProgressById,
): Promise<void> {
  const [d, logo] = await Promise.all([import('docx'), getLogoBytes()]);
 
  let instanceSeq = 0;
  const nextInstance = () => (instanceSeq += 1);
 
  const headerRow = new d.TableRow({
    tableHeader: true,
    height: { value: ROW_H_HEADER, rule: d.HeightRule.ATLEAST },
    children: COLUMNS.map((label, i) =>
      docxCell(
        d,
        i,
        true,
        [
          new d.Paragraph({
            alignment: d.AlignmentType.CENTER,
            children: [new d.TextRun({ text: label, bold: true })],
          }),
        ],
        { middle: true },
      ),
    ),
  });
 
  const bandRow = new d.TableRow({
    tableHeader: true,
    height: { value: ROW_H_BAND, rule: d.HeightRule.ATLEAST },
    children: COLUMNS.map((_, i) =>
      docxCell(d, i, false, [new d.Paragraph({ children: [new d.TextRun(' ')] })], { band: true }),
    ),
  });
 
  const emptyRow = (): DocxTableRow =>
    new d.TableRow({
      height: { value: ROW_H_BAND, rule: d.HeightRule.ATLEAST },
      children: [
        new d.TableCell({
          columnSpan: COLUMNS.length,
          width: { size: TABLE_W_TWIPS, type: d.WidthType.DXA },
          borders: cellBorders(d, false, true),
          margins: CELL_MARGINS,
          children: [
            new d.Paragraph({
              alignment: d.AlignmentType.CENTER,
              children: [new d.TextRun({ text: 'Belum ada tindak lanjut.', italics: true, color: '555555' })],
            }),
          ],
        }),
      ],
    });
 
  const dataRow = (row: FollowUpTindakLanjut, idx: number): DocxTableRow => {
    const names = picNames(row);
    return new d.TableRow({
      height: { value: ROW_H_DATA, rule: d.HeightRule.ATLEAST },
      children: [
        docxCell(d, 0, false, [docxPara(d, String(idx + 1), { align: d.AlignmentType.CENTER })]),
        docxCell(d, 1, false, [docxPara(d, row.topik || '', { bold: true })]),
        docxCell(d, 2, false, blocksToParagraphs(d, masalahBlocks(row), nextInstance, d.AlignmentType.BOTH)),
        docxCell(d, 3, false, blocksToParagraphs(d, actionBlocks(row), nextInstance, d.AlignmentType.BOTH)),
        docxCell(d, 4, false, blocksToParagraphs(d, progresBlocks(progressById[row.id]), nextInstance)),
        docxCell(d, 5, false, [
          docxPara(d, fmtDate(row.deadline), { align: d.AlignmentType.CENTER, indent: DEADLINE_IND_TWIPS }),
        ]),
        docxCell(
          d,
          6,
          false,
          names.length
            ? names.map((name) => docxPara(d, name, { align: d.AlignmentType.CENTER }))
            : [docxPara(d, '', { align: d.AlignmentType.CENTER })],
        ),
      ],
    });
  };
 
  const table = new d.Table({
    width: { size: TABLE_W_TWIPS, type: d.WidthType.DXA },
    indent: { size: TABLE_IND_TWIPS, type: d.WidthType.DXA },
    layout: d.TableLayoutType.FIXED,
    columnWidths: COL_TWIPS,
    // w:tblBorders template semuanya nil; garis digambar per sel.
    borders: {
      top: { style: d.BorderStyle.NIL },
      bottom: { style: d.BorderStyle.NIL },
      left: { style: d.BorderStyle.NIL },
      right: { style: d.BorderStyle.NIL },
      insideHorizontal: { style: d.BorderStyle.NIL },
      insideVertical: { style: d.BorderStyle.NIL },
    },
    rows: [headerRow, bandRow, ...(rows.length === 0 ? [emptyRow()] : rows.map((r, i) => dataRow(r, i)))],
  });
 
  const listLevel = (format: (typeof d.LevelFormat)[keyof typeof d.LevelFormat], text: string, font?: string) => ({
    level: 0,
    format,
    text,
    alignment: d.AlignmentType.START,
    style: {
      paragraph: { indent: { left: LIST_IND_TWIPS, hanging: LIST_IND_TWIPS } },
      ...(font ? { run: { font } } : {}),
    },
  });
 
  const doc = new d.Document({
    creator: 'SIMAPROS',
    title: `${DOC_TITLE} — ${categoryLabel}`,
    styles: {
      default: {
        document: {
          run: { font: BASE_FONT_NAME, size: BASE_FONT_HALF_PT },
          paragraph: { spacing: { line: LINE_SPACING, lineRule: d.LineRuleType.AUTO } },
        },
      },
    },
    numbering: {
      config: [
        { reference: NUM_ORDERED, levels: [listLevel(d.LevelFormat.DECIMAL, '%1.')] },
        { reference: NUM_BULLET, levels: [listLevel(d.LevelFormat.BULLET, '\u2022', 'Symbol')] },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_SHORT_TWIPS,
              height: PAGE_LONG_TWIPS,
              orientation: d.PageOrientation.LANDSCAPE,
            },
            margin: {
              top: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS,
              header: PAGE_HEADER_TWIPS,
              footer: PAGE_HEADER_TWIPS,
            },
          },
        },
        // Logo tinggal di header halaman seperti template, jadi ikut tercetak
        // di setiap halaman tanpa perlu diduplikasi di badan dokumen.
        headers: {
          default: new d.Header({
            children: [
              new d.Paragraph({
                children: logo
                  ? [
                      new d.ImageRun({
                        type: 'png',
                        data: logo,
                        transformation: { width: LOGO_W_PX, height: LOGO_H_PX },
                      }),
                    ]
                  : [],
              }),
            ],
          }),
        },
        children: [
          new d.Paragraph({ children: [] }),
          titleParagraph(d, DOC_TITLE),
          titleParagraph(d, DOC_ORG),
          new d.Paragraph({
            indent: { left: TITLE_IND_TWIPS },
            children: [
              new d.TextRun({
                text: `${categoryLabel} · Dicetak ${printedOn()}`,
                size: META_FONT_HALF_PT,
                color: '333333',
              }),
            ],
          }),
          new d.Paragraph({ children: [] }),
          table,
          new d.Paragraph({ children: [] }),
        ],
      },
    ],
  });
 
  downloadBlob(await d.Packer.toBlob(doc), `${fileStem(categoryLabel)}.docx`);
}
 
// ── PDF ─────────────────────────────────────────────────────────────────
 
/** Potong kanvas besar pada rentang baris [top, bottom) menjadi kanvas baru. */
function cropCanvas(src: HTMLCanvasElement, top: number, bottom: number): HTMLCanvasElement {
  const height = Math.max(1, Math.round(bottom - top));
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, height);
    ctx.drawImage(src, 0, Math.round(top), src.width, height, 0, 0, src.width, height);
  }
  return out;
}
 
async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
}
 
export async function exportNotulensiPdf(
  categoryLabel: string,
  rows: FollowUpTindakLanjut[],
  progressById: ProgressById,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }, logo] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
    getLogoDataUrl(),
  ]);
 
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = `${RENDER_WIDTH_PX}px`;
  container.style.background = '#ffffff';
  container.innerHTML = `<div id="notulen-kop">${kopHtml(categoryLabel, logo)}</div><div id="notulen-tabel">${tableHtml(rows, progressById)}</div>`;
  document.body.appendChild(container);
 
  try {
    await waitForImages(container);
 
    const kopEl = container.querySelector<HTMLElement>('#notulen-kop');
    const tableEl = container.querySelector<HTMLElement>('#notulen-tabel table');
    if (!kopEl || !tableEl) return;
 
    const [kopCanvas, tableCanvas] = await Promise.all([
      html2canvas(kopEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true }),
      html2canvas(tableEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true }),
    ]);
 
    // Batas tiap baris dalam koordinat kanvas, agar pemotongan halaman jatuh
    // tepat di garis antar-baris (tidak memotong teks).
    const tableRect = tableEl.getBoundingClientRect();
    const scale = tableRect.height > 0 ? tableCanvas.height / tableRect.height : 2;
    const bodyRows = Array.from(tableEl.querySelectorAll<HTMLElement>('tbody > tr'));
    const rowBottoms = bodyRows.map((tr) => (tr.getBoundingClientRect().bottom - tableRect.top) * scale);
    const headerHeight = bodyRows.length
      ? (bodyRows[0].getBoundingClientRect().top - tableRect.top) * scale
      : tableCanvas.height;
 
    const pdf = new jsPDF('l', 'mm', 'letter');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Margin = posisi tabel pada template (pgMar 1440 + tblInd -700 = 740 twips
    // = 0,514 inci), sehingga lebar cetak persis selebar tabel template.
    const margin = (TABLE_MARGIN_TWIPS / 1440) * 25.4;
    const contentW = pageW - margin * 2;
    const bottomLimit = pageH - margin;
 
    const pxToMm = contentW / tableCanvas.width;
    const kopImg = kopCanvas.toDataURL('image/png');
    const kopH = (kopCanvas.height * contentW) / kopCanvas.width;
    const headerImg = cropCanvas(tableCanvas, 0, headerHeight).toDataURL('image/png');
    const headerH = headerHeight * pxToMm;
 
    let cursor = headerHeight; // posisi kanvas untuk konten berikutnya
    let rowIdx = 0;
    let firstPage = true;
 
    while (firstPage || cursor < tableCanvas.height - 0.5) {
      if (!firstPage) pdf.addPage();
 
      let y = margin;
      if (firstPage) {
        pdf.addImage(kopImg, 'PNG', margin, y, contentW, kopH);
        y += kopH + 4;
      }
      pdf.addImage(headerImg, 'PNG', margin, y, contentW, headerH);
      y += headerH;
 
      const availablePx = Math.max(0, (bottomLimit - y) / pxToMm);
      let end = cursor;
      while (rowIdx < rowBottoms.length && rowBottoms[rowIdx] - cursor <= availablePx) {
        end = rowBottoms[rowIdx];
        rowIdx += 1;
      }
      if (end <= cursor) {
        // Satu baris lebih tinggi dari satu halaman: potong paksa.
        end = Math.min(cursor + availablePx, tableCanvas.height);
        if (rowIdx < rowBottoms.length && end >= rowBottoms[rowIdx]) {
          end = rowBottoms[rowIdx];
          rowIdx += 1;
        }
      }
      if (end <= cursor) break;
 
      pdf.addImage(
        cropCanvas(tableCanvas, cursor, end).toDataURL('image/png'),
        'PNG',
        margin,
        y,
        contentW,
        (end - cursor) * pxToMm,
      );
      cursor = end;
      firstPage = false;
    }
 
    pdf.save(`${fileStem(categoryLabel)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
 
// ── Excel ───────────────────────────────────────────────────────────────
 
const THIN_BLACK = { style: 'thin' as const, color: { argb: `FF${BORDER_COLOR}` } };
const BORDER_ALL = { top: THIN_BLACK, left: THIN_BLACK, bottom: THIN_BLACK, right: THIN_BLACK };
const BASE_FONT = { name: BASE_FONT_NAME, size: BASE_FONT_HALF_PT / 2 };
 
export async function exportNotulensiExcel(
  categoryLabel: string,
  rows: FollowUpTindakLanjut[],
  progressById: ProgressById,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Notulen Rapat');
 
  // Object.assign dipakai agar nilai paperSize numerik (1 = Letter) tidak
  // ditolak oleh enum PaperSize bawaan ExcelJS yang tidak memuat Letter.
  Object.assign(ws.pageSetup, {
    orientation: 'landscape',
    paperSize: 1, // Letter, sesuai w:pgSz template (15840 x 12240 twips)
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: false,
    // Margin efektif tabel template (pgMar 1440 + tblInd -700 = 740 twips).
    margins: (() => {
      const inch = TABLE_MARGIN_TWIPS / 1440;
      return { left: inch, right: inch, top: inch, bottom: inch, header: 0.3, footer: 0.3 };
    })(),
  });
 
  COL_WIDTHS_XLS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
 
  // Kop: 4 baris untuk logo, lalu judul.
  const logo = await getLogoDataUrl();
  for (let r = 1; r <= 4; r += 1) ws.getRow(r).height = 19;
  if (logo) {
    const imageId = wb.addImage({ base64: logo, extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: LOGO_W_PX_INT, height: LOGO_H_PX_INT },
      editAs: 'oneCell',
    });
  }
 
  const addTitle = (text: string, size: number, italic = false) => {
    const row = ws.addRow([text]);
    ws.mergeCells(`A${row.number}:G${row.number}`);
    row.getCell(1).font = { name: BASE_FONT_NAME, size, bold: !italic, italic };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    return row;
  };
 
  addTitle(DOC_TITLE, TITLE_FONT_HALF_PT / 2);
  addTitle(DOC_ORG, TITLE_FONT_HALF_PT / 2);
  addTitle(`${categoryLabel} · Dicetak ${printedOn()}`, META_FONT_HALF_PT / 2, true);
  ws.addRow([]);
 
  const headerRow = ws.addRow([...COLUMNS]);
  headerRow.height = ROW_H_HEADER / 20; // trHeight 690 twips
  headerRow.eachCell((cell) => {
    cell.font = { ...BASE_FONT, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER_ALL;
  });
 
  const bandRow = ws.addRow(['', '', '', '', '', '', '']);
  bandRow.height = ROW_H_BAND / 20; // trHeight 330 twips
  bandRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BAND_FILL}` } };
    cell.border = BORDER_ALL;
  });
 
  rows.forEach((row, idx) => {
    const dataRow = ws.addRow([
      idx + 1,
      row.topik || '',
      blocksToText(masalahBlocks(row)),
      blocksToText(actionBlocks(row)),
      blocksToText(progresBlocks(progressById[row.id])),
      fmtDate(row.deadline),
      picNames(row).join('\n'),
    ]);
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { ...BASE_FONT, bold: colNumber === 2 };
      cell.alignment = {
        vertical: 'top',
        wrapText: true,
        horizontal: colNumber === 1 || colNumber === 6 || colNumber === 7 ? 'center' : 'left',
      };
      cell.border = BORDER_ALL;
    });
  });
 
  if (rows.length === 0) {
    const emptyRow = ws.addRow(['', 'Belum ada tindak lanjut.', '', '', '', '', '']);
    ws.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
    emptyRow.getCell(1).font = { ...BASE_FONT, italic: true, color: { argb: 'FF555555' } };
    emptyRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_ALL;
    });
  }
 
  // Ulang baris header + pita di tiap halaman cetak (padanan w:tblHeader).
  ws.pageSetup.printTitlesRow = `${headerRow.number}:${bandRow.number}`;
  ws.views = [{ state: 'frozen', ySplit: bandRow.number }];
 
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${fileStem(categoryLabel)}.xlsx`);
}