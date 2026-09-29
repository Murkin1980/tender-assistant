import { deflateRawSync, deflateSync, inflateRawSync, inflateSync } from 'node:zlib';
import type {
  LotDocument,
  LotRequirementCategory,
  LotRequirementItem,
  LotRequirements,
} from './lot';

/**
 * CP-12 deterministic requirements extraction.
 *
 * Format reconnaissance against official Goszakup procurement documents (`FileLots` and
 * `FileTrdBuy` from CP-11) verified two text-native formats served on the official portal:
 * 1. Text-native PDF (`%PDF-` signature with Flate/uncompressed text streams, such as portal-
 *    generated technical specifications and protocols under `/files/download_file/...`);
 * 2. OpenXML DOCX (`PK\x03\x04` ZIP archive containing `word/document.xml`, such as procurement
 *    documentation appendices under `/uploads/template/...` and `/files/download_file/...`).
 *
 * Format recognition relies on actual byte signatures and internal structure — never on filename
 * or MIME metadata alone. Scanned/image-only PDFs, legacy binary `.doc`/`.xls`, arbitrary archives
 * and unreadable files are never guessed or sent to OCR/LLM; they surface as explicit manual-
 * review warnings (`PARTIAL` or `UNAVAILABLE`).
 */

export const LOT_REQUIREMENT_CATEGORIES: readonly LotRequirementCategory[] = [
  'SUBJECT',
  'QUANTITY',
  'DIMENSIONS',
  'MATERIAL',
  'DELIVERY',
  'QUALIFICATION',
  'SUPPORTING_DOCUMENT',
  'OTHER',
];

/** Hard bound on uncompressed stream/XML size in memory (10 MB) to prevent decompression bombs. */
const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;

/** Hard bound on how many documents of one lot are inspected on a single detail request. */
export const MAX_EXTRACTED_DOCUMENTS = 10;

export type DocumentBytesResult =
  { status: 'OK'; bytes: Uint8Array } | { status: 'UNAVAILABLE'; reason?: string };

export type DocumentBytesLoader = (document: LotDocument) => Promise<DocumentBytesResult>;

export interface DocumentTextBlock {
  text: string;
  locator: string | null;
}

export type ParsedDocumentResult =
  | { kind: 'EMPTY' }
  | { kind: 'UNSUPPORTED_FORMAT' }
  | { kind: 'MALFORMED'; format: 'PDF' | 'DOCX' }
  | { kind: 'NO_TEXT_LAYER'; format: 'PDF' | 'DOCX' }
  | { kind: 'PARSED'; format: 'PDF' | 'DOCX'; blocks: DocumentTextBlock[] };

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: false });
const LATIN1_DECODER = new TextDecoder('latin1');

const CP1251_HIGH_CHARS =
  'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ\u00A0ЎўЈ¤Ґ¦§Ё©Є«¬\u00AD®Ї°±Ііґµ¶·ё№є»јЅѕї' +
  'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';

function decodeCp1251OrUtf8(bytes: Uint8Array): string {
  // Check if valid UTF-8 with at least one multi-byte sequence
  try {
    const strictUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (bytes.some((b) => b >= 0x80)) return strictUtf8;
  } catch {
    // Fallback to CP1251 below
  }
  let out = '';
  for (const byte of bytes) {
    if (byte < 0x80) {
      out += String.fromCharCode(byte);
    } else {
      out += CP1251_HIGH_CHARS[byte - 0x80] ?? '';
    }
  }
  return out;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.byteLength, 1024);
  for (let i = 0; i <= limit - 5; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

function hasZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 && // P
    bytes[1] === 0x4b && // K
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/**
 * Parses a ToUnicode CMap stream (`beginbfchar`/`beginbfrange`) into a lookup map from hex code
 * string (uppercase, e.g. `"0001"` or `"2A"`) to its decoded Unicode text.
 */
function parseToUnicodeCMap(cmapText: string, map: Map<string, string>): void {
  const bfcharBlocks = cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g);
  for (const block of bfcharBlocks) {
    const body = block[1] ?? '';
    const pairs = body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
    for (const pair of pairs) {
      const src = (pair[1] ?? '').toUpperCase();
      const dst = decodeHexUtf16Be(pair[2] ?? '');
      if (src && dst) map.set(src, dst);
    }
  }

  const bfrangeBlocks = cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g);
  for (const block of bfrangeBlocks) {
    const body = block[1] ?? '';
    const ranges = body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
    for (const range of ranges) {
      const startHex = range[1] ?? '';
      const endHex = range[2] ?? '';
      const dstHex = range[3] ?? '';
      const width = startHex.length;
      const start = Number.parseInt(startHex, 16);
      const end = Number.parseInt(endHex, 16);
      const dstStart = Number.parseInt(dstHex, 16);
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        Number.isNaN(dstStart) ||
        end < start ||
        end - start > 1024
      ) {
        continue;
      }
      for (let code = start; code <= end; code++) {
        const key = code.toString(16).toUpperCase().padStart(width, '0');
        map.set(key, String.fromCodePoint(dstStart + (code - start)));
      }
    }
  }
}

function decodeHexUtf16Be(hexClean: string): string {
  if (hexClean.length === 0) return '';
  if (hexClean.length % 4 === 0) {
    let out = '';
    for (let i = 0; i < hexClean.length; i += 4) {
      const code = Number.parseInt(hexClean.slice(i, i + 4), 16);
      if (!Number.isNaN(code) && code !== 0xfeff) {
        out += String.fromCharCode(code);
      }
    }
    return out;
  }
  const bytes = new Uint8Array(Math.floor(hexClean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hexClean.slice(i * 2, i * 2 + 2), 16);
  }
  return decodeCp1251OrUtf8(bytes);
}

function decodePdfHexString(rawHex: string, cmap: ReadonlyMap<string, string>): string {
  const hex = rawHex.replace(/\s+/g, '').toUpperCase();
  if (!hex) return '';

  if (hex.startsWith('FEFF')) {
    return decodeHexUtf16Be(hex.slice(4));
  }

  if (cmap.size > 0) {
    // Determine whether CMap keys are 4-hex-digit (2-byte) or 2-hex-digit (1-byte)
    const has4DigitKeys = [...cmap.keys()].some((k) => k.length === 4);
    const step = has4DigitKeys && hex.length % 4 === 0 ? 4 : 2;
    let mapped = '';
    let matchedCount = 0;
    for (let i = 0; i < hex.length; i += step) {
      const token = hex.slice(i, i + step);
      const hit = cmap.get(token);
      if (hit !== undefined) {
        mapped += hit;
        matchedCount++;
      } else if (step === 4) {
        const code = Number.parseInt(token, 16);
        if (!Number.isNaN(code)) mapped += String.fromCharCode(code);
      } else {
        const code = Number.parseInt(token, 16);
        if (!Number.isNaN(code)) mapped += String.fromCharCode(code);
      }
    }
    if (matchedCount > 0) return mapped;
  }

  return decodeHexUtf16Be(hex);
}

function decodePdfLiteralString(content: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (ch !== '\\') {
      bytes.push(ch.charCodeAt(0) & 0xff);
      continue;
    }
    i++;
    if (i >= content.length) break;
    const esc = content[i]!;
    if (esc === 'n') bytes.push(0x0a);
    else if (esc === 'r') bytes.push(0x0d);
    else if (esc === 't') bytes.push(0x09);
    else if (esc === 'b') bytes.push(0x08);
    else if (esc === 'f') bytes.push(0x0c);
    else if (esc === '(') bytes.push(0x28);
    else if (esc === ')') bytes.push(0x29);
    else if (esc === '\\') bytes.push(0x5c);
    else if (esc === '\r') {
      if (content[i + 1] === '\n') i++;
    } else if (esc === '\n') {
      // line continuation
    } else if (esc >= '0' && esc <= '7') {
      let oct = esc;
      if (content[i + 1] && content[i + 1]! >= '0' && content[i + 1]! <= '7') {
        oct += content[++i]!;
        if (content[i + 1] && content[i + 1]! >= '0' && content[i + 1]! <= '7') {
          oct += content[++i]!;
        }
      }
      bytes.push(Number.parseInt(oct, 8) & 0xff);
    } else {
      bytes.push(esc.charCodeAt(0) & 0xff);
    }
  }
  return decodeCp1251OrUtf8(Uint8Array.from(bytes));
}

/**
 * Extracts text lines from a decoded PDF content stream (`BT ... ET` blocks).
 */
function extractLinesFromPdfContentStream(
  streamText: string,
  cmap: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [];
  const btBlocks = streamText.matchAll(/\bBT\b([\s\S]*?)\bET\b/g);

  for (const block of btBlocks) {
    const body = block[1] ?? '';
    let currentLine = '';
    let lastTmY: number | null = null;

    const flushLine = (): void => {
      const normalized = normalizeWhitespace(currentLine);
      if (normalized) lines.push(normalized);
      currentLine = '';
    };

    const appendFragment = (fragment: string): void => {
      if (!fragment) return;
      if (fragment.includes('\n') || fragment.includes('\r')) {
        const parts = fragment.split(/\r?\n/);
        for (let idx = 0; idx < parts.length; idx++) {
          if (idx > 0) flushLine();
          currentLine += parts[idx]!;
        }
      } else {
        currentLine += fragment;
      }
    };

    // Scan tokens inside BT ... ET in sequence
    let pos = 0;
    while (pos < body.length) {
      // Skip whitespace
      while (pos < body.length && /\s/.test(body[pos]!)) pos++;
      if (pos >= body.length) break;

      const ch = body[pos]!;

      // Literal string (...) followed by Tj, ', or "
      if (ch === '(') {
        const { value, nextPos } = readBalancedPdfLiteral(body, pos);
        pos = nextPos;
        const op = readNextPdfOperator(body, pos);
        if (op) {
          pos = op.nextPos;
          if (op.op === "'" || op.op === '"') flushLine();
          if (op.op === 'Tj' || op.op === "'" || op.op === '"') {
            appendFragment(decodePdfLiteralString(value));
          }
        }
        continue;
      }

      // Hex string <...> followed by Tj or '
      if (ch === '<' && body[pos + 1] !== '<') {
        const closeIdx = body.indexOf('>', pos + 1);
        if (closeIdx === -1) break;
        const rawHex = body.slice(pos + 1, closeIdx);
        pos = closeIdx + 1;
        const op = readNextPdfOperator(body, pos);
        if (op) {
          pos = op.nextPos;
          if (op.op === "'" || op.op === '"') flushLine();
          if (op.op === 'Tj' || op.op === "'" || op.op === '"') {
            appendFragment(decodePdfHexString(rawHex, cmap));
          }
        }
        continue;
      }

      // Array [...] followed by TJ
      if (ch === '[') {
        const { content, nextPos } = readBalancedPdfArray(body, pos);
        pos = nextPos;
        const op = readNextPdfOperator(body, pos);
        if (op) {
          pos = op.nextPos;
          if (op.op === 'TJ') {
            appendFragment(decodePdfTjArray(content, cmap));
          }
        }
        continue;
      }

      // Line positioning operators: T*, Td, TD, Tm
      const rest = body.slice(pos);
      const tStarMatch = rest.match(/^T\*(?![a-zA-Z])/);
      if (tStarMatch) {
        flushLine();
        pos += tStarMatch[0].length;
        continue;
      }

      const tdMatch = rest.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]\b/);
      if (tdMatch) {
        const ty = Number(tdMatch[2]);
        if (Math.abs(ty) > 0.5) {
          flushLine();
        } else if (currentLine && !currentLine.endsWith(' ')) {
          currentLine += ' ';
        }
        pos += tdMatch[0].length;
        continue;
      }

      const tmMatch = rest.match(
        /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm\b/,
      );
      if (tmMatch) {
        const y = Number(tmMatch[6]);
        if (lastTmY !== null && Math.abs(y - lastTmY) > 0.5) {
          flushLine();
        } else if (lastTmY !== null && currentLine && !currentLine.endsWith(' ')) {
          currentLine += ' ';
        }
        lastTmY = y;
        pos += tmMatch[0].length;
        continue;
      }

      // Advance past current token
      const tokenMatch = rest.match(/^[^\s()<>[\]]+/);
      pos += tokenMatch ? tokenMatch[0].length : 1;
    }

    flushLine();
  }

  return lines;
}

function readBalancedPdfLiteral(
  source: string,
  startPos: number,
): { value: string; nextPos: number } {
  let depth = 0;
  let i = startPos;
  for (; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { value: source.slice(startPos + 1, i), nextPos: i + 1 };
      }
    }
  }
  return { value: source.slice(startPos + 1), nextPos: source.length };
}

function readBalancedPdfArray(
  source: string,
  startPos: number,
): { content: string; nextPos: number } {
  let depth = 0;
  let inLiteral = 0;
  let i = startPos;
  for (; i < source.length; i++) {
    const ch = source[i]!;
    if (inLiteral > 0) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '(') inLiteral++;
      else if (ch === ')') inLiteral--;
      continue;
    }
    if (ch === '(') inLiteral = 1;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return { content: source.slice(startPos + 1, i), nextPos: i + 1 };
      }
    }
  }
  return { content: source.slice(startPos + 1), nextPos: source.length };
}

function readNextPdfOperator(
  source: string,
  startPos: number,
): { op: string; nextPos: number } | null {
  let pos = startPos;
  while (pos < source.length && /\s/.test(source[pos]!)) pos++;
  const rest = source.slice(pos);
  const match = rest.match(/^(Tj|TJ|'|"|[a-zA-Z*]+)/);
  if (!match || !match[1]) return null;
  return { op: match[1], nextPos: pos + match[1].length };
}

function decodePdfTjArray(content: string, cmap: ReadonlyMap<string, string>): string {
  let result = '';
  let pos = 0;
  while (pos < content.length) {
    while (pos < content.length && /\s/.test(content[pos]!)) pos++;
    if (pos >= content.length) break;
    const ch = content[pos]!;
    if (ch === '(') {
      const { value, nextPos } = readBalancedPdfLiteral(content, pos);
      result += decodePdfLiteralString(value);
      pos = nextPos;
    } else if (ch === '<') {
      const closeIdx = content.indexOf('>', pos + 1);
      if (closeIdx === -1) break;
      result += decodePdfHexString(content.slice(pos + 1, closeIdx), cmap);
      pos = closeIdx + 1;
    } else {
      const numMatch = content.slice(pos).match(/^(-?\d+(?:\.\d+)?)/);
      if (numMatch) {
        const kerning = Number(numMatch[1]);
        if (kerning <= -120 && result && !result.endsWith(' ')) {
          result += ' ';
        }
        pos += numMatch[0].length;
      } else {
        pos++;
      }
    }
  }
  return result;
}

function decompressPdfStream(rawBytes: Uint8Array, dictText: string): Uint8Array | null {
  const hasFlate = /\/FlateDecode\b/.test(dictText);
  const hasUnsupportedFilter =
    /\/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|Crypt|LZWDecode)\b/.test(dictText);
  if (hasUnsupportedFilter) return null;
  if (!hasFlate) return rawBytes;

  // Trim up to 2 trailing CRLF bytes before endstream if needed
  const candidates = [rawBytes];
  if (
    rawBytes.byteLength >= 2 &&
    rawBytes[rawBytes.byteLength - 2] === 0x0d &&
    rawBytes[rawBytes.byteLength - 1] === 0x0a
  ) {
    candidates.push(rawBytes.subarray(0, rawBytes.byteLength - 2));
  } else if (
    rawBytes.byteLength >= 1 &&
    (rawBytes[rawBytes.byteLength - 1] === 0x0a || rawBytes[rawBytes.byteLength - 1] === 0x0d)
  ) {
    candidates.push(rawBytes.subarray(0, rawBytes.byteLength - 1));
  }

  for (const candidate of candidates) {
    try {
      return new Uint8Array(inflateSync(candidate, { maxOutputLength: MAX_UNCOMPRESSED_BYTES }));
    } catch {
      try {
        return new Uint8Array(
          inflateRawSync(candidate, { maxOutputLength: MAX_UNCOMPRESSED_BYTES }),
        );
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}

/**
 * Deterministic text-native PDF parser.
 * Verifies PDF structure, decompresses Flate streams, applies ToUnicode CMaps and extracts text
 * lines grouped by 1-indexed page number (`Стр. 1`, `Стр. 2`, ...).
 */
export function parsePdfBytes(bytes: Uint8Array): ParsedDocumentResult {
  if (!hasPdfMagic(bytes)) return { kind: 'UNSUPPORTED_FORMAT' };

  const rawText = LATIN1_DECODER.decode(bytes);
  if (
    !/\d+\s+\d+\s+obj\b/.test(rawText) ||
    !/\bendobj\b/.test(rawText) ||
    !rawText.includes('%%EOF')
  ) {
    return { kind: 'MALFORMED', format: 'PDF' };
  }

  const objects = new Map<
    number,
    { dict: string; streamText: string | null; corrupted: boolean }
  >();
  const cmap = new Map<string, string>();
  let totalFlateStreams = 0;
  let corruptedFlateStreams = 0;

  const objMatches = rawText.matchAll(/(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g);
  for (const match of objMatches) {
    const objId = Number(match[1]);
    const body = match[3] ?? '';
    const bodyStartInFile = (match.index ?? 0) + match[0].indexOf(body);

    const streamMarker = body.match(/stream(?:\r\n|\n|\r)/);
    const endstreamIdx = body.lastIndexOf('endstream');

    if (!streamMarker || streamMarker.index === undefined || endstreamIdx <= streamMarker.index) {
      objects.set(objId, { dict: body, streamText: null, corrupted: false });
      continue;
    }

    const dict = body.slice(0, streamMarker.index);
    const streamDataStart = bodyStartInFile + streamMarker.index + streamMarker[0].length;
    const streamDataEnd = bodyStartInFile + endstreamIdx;
    const rawStreamBytes = bytes.subarray(streamDataStart, streamDataEnd);

    if (/\/FlateDecode\b/.test(dict)) totalFlateStreams++;
    const decompressed = decompressPdfStream(rawStreamBytes, dict);
    if (decompressed === null) {
      if (/\/FlateDecode\b/.test(dict)) corruptedFlateStreams++;
      objects.set(objId, { dict, streamText: null, corrupted: true });
      continue;
    }

    const streamText = LATIN1_DECODER.decode(decompressed);
    if (
      streamText.includes('beginbfchar') ||
      streamText.includes('beginbfrange') ||
      streamText.includes('begincmap')
    ) {
      parseToUnicodeCMap(streamText, cmap);
    }
    objects.set(objId, { dict, streamText, corrupted: false });
  }

  if (
    objects.size === 0 ||
    (totalFlateStreams > 0 && corruptedFlateStreams === totalFlateStreams)
  ) {
    return { kind: 'MALFORMED', format: 'PDF' };
  }

  // Locate `/Type /Page` objects to preserve exact page numbers (`Стр. 1`, `Стр. 2`, ...)
  const pageStreamIds: number[][] = [];
  const usedStreamIds = new Set<number>();

  for (const [, obj] of objects) {
    if (!/\/Type\s*\/Page\b(?!s)/.test(obj.dict)) continue;
    const ids: number[] = [];
    const arrayMatch = obj.dict.match(/\/Contents\s*\[([\s\S]*?)\]/);
    if (arrayMatch) {
      for (const ref of (arrayMatch[1] ?? '').matchAll(/(\d+)\s+\d+\s+R\b/g)) {
        const refId = Number(ref[1]);
        ids.push(refId);
        usedStreamIds.add(refId);
      }
    } else {
      const singleMatch = obj.dict.match(/\/Contents\s+(\d+)\s+\d+\s+R\b/);
      if (singleMatch) {
        const refId = Number(singleMatch[1]);
        ids.push(refId);
        usedStreamIds.add(refId);
      }
    }
    if (ids.length > 0) pageStreamIds.push(ids);
  }

  // Fallback if PDF embeds streams without indirect `/Contents` references
  if (pageStreamIds.length === 0) {
    for (const [objId, obj] of objects) {
      if (
        obj.streamText &&
        /\bBT\b[\s\S]*?\bET\b/.test(obj.streamText) &&
        !usedStreamIds.has(objId)
      ) {
        pageStreamIds.push([objId]);
      }
    }
  }

  const blocks: DocumentTextBlock[] = [];
  for (let pageIdx = 0; pageIdx < pageStreamIds.length; pageIdx++) {
    const pageNumber = pageIdx + 1;
    const streamIds = pageStreamIds[pageIdx]!;
    const combinedStream = streamIds
      .map((id) => objects.get(id)?.streamText ?? '')
      .filter(Boolean)
      .join('\n');
    if (!combinedStream) continue;

    const lines = extractLinesFromPdfContentStream(combinedStream, cmap);
    for (const line of lines) {
      const clauseLocator = extractClauseLocator(line);
      const locator = clauseLocator ? `Стр. ${pageNumber}, ${clauseLocator}` : `Стр. ${pageNumber}`;
      blocks.push({ text: line, locator });
    }
  }

  if (blocks.length === 0) {
    return { kind: 'NO_TEXT_LAYER', format: 'PDF' };
  }

  return { kind: 'PARSED', format: 'PDF', blocks };
}

interface ZipEntryMeta {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function findZipEntries(bytes: Uint8Array): ZipEntryMeta[] | null {
  // 1. Try End of Central Directory (EOCD: PK\x05\x06) first so bit-3 data-descriptor DOCX files work
  const minEocdOffset = Math.max(0, bytes.byteLength - 65_557);
  let eocdOffset = -1;
  for (let i = bytes.byteLength - 22; i >= minEocdOffset; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = readUint16LE(bytes, eocdOffset + 10);
    const cdSize = readUint32LE(bytes, eocdOffset + 12);
    const cdOffset = readUint32LE(bytes, eocdOffset + 16);
    if (cdOffset + cdSize <= bytes.byteLength) {
      const entries: ZipEntryMeta[] = [];
      let ptr = cdOffset;
      for (let idx = 0; idx < totalEntries && ptr + 46 <= bytes.byteLength; idx++) {
        if (
          bytes[ptr] !== 0x50 ||
          bytes[ptr + 1] !== 0x4b ||
          bytes[ptr + 2] !== 0x01 ||
          bytes[ptr + 3] !== 0x02
        ) {
          return null;
        }
        const compressionMethod = readUint16LE(bytes, ptr + 10);
        const compressedSize = readUint32LE(bytes, ptr + 20);
        const nameLen = readUint16LE(bytes, ptr + 28);
        const extraLen = readUint16LE(bytes, ptr + 30);
        const commentLen = readUint16LE(bytes, ptr + 32);
        const localHeaderOffset = readUint32LE(bytes, ptr + 42);
        if (ptr + 46 + nameLen > bytes.byteLength) return null;
        const name = UTF8_DECODER.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
        entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
        ptr += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    }
  }

  // 2. Fallback: walk sequential local file headers (PK\x03\x04)
  const entries: ZipEntryMeta[] = [];
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    if (
      bytes[offset] !== 0x50 ||
      bytes[offset + 1] !== 0x4b ||
      bytes[offset + 2] !== 0x03 ||
      bytes[offset + 3] !== 0x04
    ) {
      break;
    }
    const flags = readUint16LE(bytes, offset + 6);
    if ((flags & 0x0008) !== 0) return null; // data descriptor without EOCD is truncated
    const compressionMethod = readUint16LE(bytes, offset + 8);
    const compressedSize = readUint32LE(bytes, offset + 18);
    const nameLen = readUint16LE(bytes, offset + 26);
    const extraLen = readUint16LE(bytes, offset + 28);
    const dataStart = offset + 30 + nameLen + extraLen;
    if (dataStart + compressedSize > bytes.byteLength) return null;
    const name = UTF8_DECODER.decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset: offset });
    offset = dataStart + compressedSize;
  }

  return entries.length > 0 ? entries : null;
}

function extractZipEntryBytes(bytes: Uint8Array, entry: ZipEntryMeta): Uint8Array | null {
  const offset = entry.localHeaderOffset;
  if (
    offset + 30 > bytes.byteLength ||
    bytes[offset] !== 0x50 ||
    bytes[offset + 1] !== 0x4b ||
    bytes[offset + 2] !== 0x03 ||
    bytes[offset + 3] !== 0x04
  ) {
    return null;
  }
  const nameLen = readUint16LE(bytes, offset + 26);
  const extraLen = readUint16LE(bytes, offset + 28);
  const dataStart = offset + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.byteLength) return null;

  const rawData = bytes.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    if (rawData.byteLength > MAX_UNCOMPRESSED_BYTES) return null;
    return rawData;
  }
  if (entry.compressionMethod === 8) {
    try {
      return new Uint8Array(inflateRawSync(rawData, { maxOutputLength: MAX_UNCOMPRESSED_BYTES }));
    } catch {
      return null;
    }
  }
  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractOpenXmlParagraphText(pXml: string): string {
  const withBreaks = pXml.replace(/<w:tab\b[^>]*\/>/g, ' ').replace(/<w:(?:br|cr)\b[^>]*\/>/g, ' ');
  let out = '';
  for (const match of withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    out += decodeXmlEntities(match[1] ?? '');
  }
  return normalizeWhitespace(out);
}

/**
 * Deterministic OpenXML DOCX parser (`PK\x03\x04` archive containing `word/document.xml`).
 * Extracts paragraphs (`Абз. N`) and table rows (`Табл. N, стр. M`) in document order.
 */
export function parseDocxBytes(bytes: Uint8Array): ParsedDocumentResult {
  if (!hasZipMagic(bytes)) return { kind: 'UNSUPPORTED_FORMAT' };

  const entries = findZipEntries(bytes);
  if (!entries) return { kind: 'MALFORMED', format: 'DOCX' };

  const docEntry = entries.find((e) => e.name === 'word/document.xml');
  if (!docEntry) {
    // A valid ZIP without `word/document.xml` (e.g., plain ZIP or another container) is unsupported
    return { kind: 'UNSUPPORTED_FORMAT' };
  }

  const xmlBytes = extractZipEntryBytes(bytes, docEntry);
  if (!xmlBytes) return { kind: 'MALFORMED', format: 'DOCX' };

  const xml = UTF8_DECODER.decode(xmlBytes);
  if (!/<w:document\b/.test(xml) || !/<w:body\b[\s\S]*?<\/w:body>/.test(xml)) {
    return { kind: 'MALFORMED', format: 'DOCX' };
  }

  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch?.[1] ?? '';

  const blocks: DocumentTextBlock[] = [];
  let paragraphIndex = 0;
  let tableIndex = 0;

  const topElements = bodyXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g);
  for (const elem of topElements) {
    const token = elem[0];
    if (token.startsWith('<w:tbl')) {
      tableIndex++;
      let rowIndex = 0;
      for (const rowMatch of token.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
        rowIndex++;
        const cells: string[] = [];
        for (const cellMatch of rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
          const cellParagraphs: string[] = [];
          for (const pMatch of cellMatch[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
            const pText = extractOpenXmlParagraphText(pMatch[0]);
            if (pText) cellParagraphs.push(pText);
          }
          const cellText = cellParagraphs.join(' ').trim();
          if (cellText) cells.push(cellText);
        }
        if (cells.length === 0) continue;
        const rowText =
          cells.length === 2
            ? `${cells[0]!.replace(/:\s*$/, '')}: ${cells[1]!}`
            : cells.join(' | ');
        blocks.push({
          text: rowText,
          locator: `Табл. ${tableIndex}, стр. ${rowIndex}`,
        });
      }
    } else {
      const pText = extractOpenXmlParagraphText(token);
      if (!pText) continue;
      paragraphIndex++;
      const clauseLocator = extractClauseLocator(pText);
      const locator = clauseLocator
        ? `Абз. ${paragraphIndex} (${clauseLocator})`
        : `Абз. ${paragraphIndex}`;
      blocks.push({ text: pText, locator });
    }
  }

  if (blocks.length === 0) {
    return { kind: 'NO_TEXT_LAYER', format: 'DOCX' };
  }

  return { kind: 'PARSED', format: 'DOCX', blocks };
}

/**
 * Inspects actual document bytes to identify and deterministically parse supported text-native
 * formats (PDF and DOCX). Never trusts filename or MIME metadata.
 */
export function detectAndParseDocumentBytes(bytes: Uint8Array): ParsedDocumentResult {
  if (bytes.byteLength === 0) return { kind: 'EMPTY' };
  if (hasPdfMagic(bytes)) return parsePdfBytes(bytes);
  if (hasZipMagic(bytes)) return parseDocxBytes(bytes);
  return { kind: 'UNSUPPORTED_FORMAT' };
}

function extractClauseLocator(line: string): string | null {
  const sectionMatch = line.match(/^(?:раздел|пункт|п\.)\s*(\d+(?:\.\d+)*)\b/iu);
  if (sectionMatch?.[1]) return `п. ${sectionMatch[1]}`;
  const numberedMatch = line.match(/^(\d+(?:\.\d+)+[.)]?|\d+\))\s+\S/);
  if (numberedMatch?.[1]) return `п. ${numberedMatch[1].replace(/[.)]$/, '')}`;
  return null;
}

const HEADING_RULES: ReadonlyArray<{ pattern: RegExp; category: LotRequirementCategory | null }> = [
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:предмет\s+(?:закупки|поставки|договора)|наименование\s+закупаем\p{L}*\s+товар\p{L}*)$/iu,
    category: 'SUBJECT',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:количество\s+и\s+объ[её]м|объ[её]м\s+поставки|количественн\p{L}*\s+характеристик\p{L}*)$/iu,
    category: 'QUANTITY',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:габаритн\p{L}*\s+размер\p{L}*|размер\p{L}*\s+и\s+параметр\p{L}*)$/iu,
    category: 'DIMENSIONS',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:требования\s+к\s+материал\p{L}*|техническ\p{L}*\s+характеристик\p{L}*(\s+и\s+материал\p{L}*)?|материал\p{L}*\s+изготовления)$/iu,
    category: 'MATERIAL',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:условия(?:\s+и\s+сроки)?\s+поставки(?:\s+и\s+квалификаци\p{L}*)?|место\s+и\s+срок\p{L}*\s+поставки|поставка\s+и\s+при[её]мка|условия\s+договора(?:\s+и\s+при[её]мки)?)$/iu,
    category: 'DELIVERY',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:квалификационн\p{L}*\s+требовани\p{L}*|требования\s+к\s+(?:потенциальному\s+)?поставщику|сведения\s+о\s+квалификации)$/iu,
    category: 'QUALIFICATION',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:подтверждающ\p{L}*\s+документ\p{L}*|перечень\s+(?:подтверждающих\s+)?документов|требования\s+к\s+документации)$/iu,
    category: 'SUPPORTING_DOCUMENT',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)|(?:раздел\s+\d+[.:]?\s*))?(?:техническ\p{L}*\s+спецификаци\p{L}*|прочие\s+требования|общие\s+требования|дополнительные\s+требования|приложение\s+№?\s*\d+)$/iu,
    category: 'OTHER',
  },
];

const LABEL_CATEGORY_RULES: ReadonlyArray<{
  pattern: RegExp;
  category: LotRequirementCategory;
}> = [
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:предмет\s+(?:закупки|поставки)|наименование\s+(?:товара|работ\p{L}*|услуг\p{L}*|лота|закупаем\p{L}*)|объект\s+закупки|тауар\p{L}*\s+атауы|лоттың\s+атауы)\s*[:—-]\s*(.+)$/iu,
    category: 'SUBJECT',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:количество|объ[её]м\s+поставки|кол-во|комплектность|саны)\s*[:—-]\s*(.+)$/iu,
    category: 'QUANTITY',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:габаритн\p{L}*\s+размер\p{L}*|размер\p{L}*|габарит\p{L}*|толщина(?:\s+плиты|\s+столешницы)?|диаметр|высота|ширина|глубина)\s*[:—-]\s*(.+)$/iu,
    category: 'DIMENSIONS',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:материал(?:\s+изготовления)?|сырь[её]|покрытие|кромка|корпус(?:\s+и\s+фасад\p{L}*)?|каркас|цвет\s+и\s+материал)\s*[:—-]\s*(.+)$/iu,
    category: 'MATERIAL',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:место(?:\s+и\s+срок\p{L}*)?\s+поставки|срок\p{L}*\s+(?:поставки|выполнения|оказания)|условия\s+поставки|адрес\s+поставки|доставка(?:\s+и\s+сборка)?|гарантийн\p{L}*\s+срок|жеткізу\s+(?:орны|мерзімі))\s*[:—-]\s*(.+)$/iu,
    category: 'DELIVERY',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:квалификационн\p{L}*\s+требовани\p{L}*|опыт\s+работы|наличие\s+(?:материальн\p{L}*|трудов\p{L}*)\s+ресурсов|финансов\p{L}*\s+устойчивост\p{L}*|отсутствие\s+налогов\p{L}*\s+задолженност\p{L}*|требования\s+к\s+поставщику)\s*[:—-]\s*(.+)$/iu,
    category: 'QUALIFICATION',
  },
  {
    pattern:
      /^(?:(?:\d+(?:\.\d+)*[.)]?\s*)?)(?:подтверждающ\p{L}*\s+документ\p{L}*|сертификат\p{L}*|лицензи\p{L}*|разрешени\p{L}*|обеспечение\s+(?:заявки|исполнения\s+договора)|банковск\p{L}*\s+гаранти\p{L}*|паспорт\s+изделия|деклараци\p{L}*\s+о\s+соответствии)\s*[:—-]\s*(.+)$/iu,
    category: 'SUPPORTING_DOCUMENT',
  },
];

const UNCERTAINTY_PATTERN =
  /(?:согласно\s+(?:чертеж\p{L}*|схем\p{L}*|рисунк\p{L}*|эскиз\p{L}*)|см\.\s*(?:чертеж\p{L}*|рисунок|схему|графическ\p{L}*\s+приложени\p{L}*)|на\s+(?:графическ\p{L}*\s+схем\p{L}*|чертеж\p{L}*|рисунк\p{L}*)|уточняется\s+(?:отдельным\s+)?приложением|\[?\s*неразборчиво\s*\]?|требуется\s+ручная\s+проверка)/iu;

const BLANK_TEMPLATE_VALUE = /^[_.\-\s/\\()]+$/;

function classifyStatementByKeywords(
  text: string,
  activeHeading: LotRequirementCategory | null,
): LotRequirementCategory | null {
  if (
    /(?:\b\d{2,4}\s*[xх×*]\s*\d{2,4}(?:\s*[xх×*]\s*\d{2,4})?\s*(?:мм|см|м)\b)|(?:\b(?:габарит\p{L}*|размер\p{L}*|толщин\p{L}*|диаметр|высота|ширина|глубина)\b[\s\S]*?\b\d+(?:[.,]\d+)?\s*(?:мм|см|м)\b)/iu.test(
      text,
    )
  ) {
    return 'DIMENSIONS';
  }
  if (
    /\b(?:количеств\p{L}*|в\s+количестве|объ[её]м\s+поставки|кол-во|комплектност\p{L}*)\b[\s\S]*?\b\d+\s*(?:шт\p{L}*|компл\p{L}*|единиц\p{L}*|ед\.|набор\p{L}*|упак\p{L}*|м[23²³]|кг|т\b|п\.?\s*м)/iu.test(
      text,
    )
  ) {
    return 'QUANTITY';
  }
  if (
    /\b(?:лдсп|ldsp|мдф|кромк\p{L}*\s+пвх|класс\p{L}*\s+эмиссии\s+е1|листов\p{L}*\s+стал\p{L}*|порошков\p{L}*\s+покрыт\p{L}*|материал\s+изготовления|изготовлен\p{L}*\s+из\s+(?:лдсп|стали|металла|дерева|массива))\b/iu.test(
      text,
    )
  ) {
    return 'MATERIAL';
  }
  if (
    /\b(?:сертификат\p{L}*\s+(?:соответствия|о\s+поверке|качества|происхождения)|ст-kz|индустриальн\p{L}*\s+сертификат|паспорт\p{L}*\s+(?:изделия|качества)|лицензи\p{L}*|разрешени\p{L}*\s+\(?уведомлени|обеспечени\p{L}*\s+заявки|банковск\p{L}*\s+гаранти\p{L}*|подтверждающ\p{L}*\s+документ\p{L}*)\b/iu.test(
      text,
    )
  ) {
    return 'SUPPORTING_DOCUMENT';
  }
  if (
    /\b(?:квалификационн\p{L}*\s+требовани\p{L}*|опыт\p{L}*\s+(?:работы|поставки)|налогов\p{L}*\s+задолженност\p{L}*|финансов\p{L}*\s+устойчивост\p{L}*|материальн\p{L}*\s+ресурс\p{L}*|трудов\p{L}*\s+ресурс\p{L}*|не\s+является\s+банкротом|специалист\p{L}*,\s+имеющ\p{L}*)\b/iu.test(
      text,
    )
  ) {
    return 'QUALIFICATION';
  }
  if (
    /\b(?:срок\p{L}*\s+поставки|место\s+поставки|адрес\s+поставки|условия\s+поставки|доставк\p{L}*\s+и\s+сборк\p{L}*|гарантийн\p{L}*\s+срок|в\s+течение\s+\d+\s+(?:календарн\p{L}*|рабоч\p{L}*)\s+дн\p{L}*|со\s+дня\s+подписания\s+акта)\b/iu.test(
      text,
    )
  ) {
    return 'DELIVERY';
  }
  if (
    /\b(?:предмет\s+(?:закупки|поставки)|поставка\s+(?:столов|стеллажей|мебели|шкафов|тумб|компьютеров|оборудования))\b/iu.test(
      text,
    )
  ) {
    return 'SUBJECT';
  }

  // Inside a recognized requirement section heading, numbered or obligatory clauses inherit the section category
  if (
    activeHeading !== null &&
    /(?:^(?:\d+(?:\.\d+)*[.)]|[-•])\s+\S)|(?:\b(?:долж(?:ен|на|но|ны)|обязан\p{L}*|требуется|не\s+менее|не\s+более|соответствовать\s+гост)\b)/iu.test(
      text,
    )
  ) {
    return activeHeading;
  }

  return null;
}

/**
 * Extracts deterministic requirement items and warnings from the parsed text blocks of a single
 * official document.
 */
export function extractDocumentRequirements(
  document: Pick<LotDocument, 'id' | 'name'>,
  blocks: readonly DocumentTextBlock[],
): { items: LotRequirementItem[]; warnings: string[] } {
  const items: LotRequirementItem[] = [];
  const warnings: string[] = [];
  const seenKeys = new Set<string>();
  let activeHeading: LotRequirementCategory | null = null;

  for (const block of blocks) {
    const line = normalizeWhitespace(block.text);
    if (!line || BLANK_TEMPLATE_VALUE.test(line)) continue;

    // 1. Check if the line is a standalone section heading
    const matchedHeading = HEADING_RULES.find((rule) => rule.pattern.test(line));
    if (matchedHeading) {
      activeHeading = matchedHeading.category;
      continue;
    }

    // 2. Check for explicit uncertainty / drawing / non-text reference
    if (UNCERTAINTY_PATTERN.test(line)) {
      const loc = block.locator ? ` (${block.locator})` : '';
      warnings.push(
        `Документ «${document.name}»${loc}: обнаружена отсылка к чертежу, схеме или неполным данным — нужно проверить вручную.`,
      );
      continue;
    }

    // 3. Check explicit Label: Value rules
    let category: LotRequirementCategory | null = null;
    for (const rule of LABEL_CATEGORY_RULES) {
      const match = line.match(rule.pattern);
      if (match) {
        const valuePart = (match[1] ?? '').trim();
        if (valuePart && !BLANK_TEMPLATE_VALUE.test(valuePart)) {
          category = rule.category;
        }
        break;
      }
    }

    // 4. Otherwise check deterministic keyword/section rules
    if (!category) {
      // Skip lines that end with blank form underscores (`Наименование заказчика _____`)
      if (/_{3,}/.test(line)) continue;
      category = classifyStatementByKeywords(line, activeHeading);
    }

    if (!category) continue;

    const dedupKey = `${category}::${line.toLocaleLowerCase('ru')}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    items.push({
      category,
      text: line,
      sourceDocumentId: document.id,
      sourceLocator: block.locator ?? null,
    });
  }

  return { items, warnings };
}

/**
 * Orchestrates bounded byte loading, byte-signature format verification, plain-text parsing and
 * deterministic requirement extraction for all documents of one selected lot.
 */
export async function extractLotRequirements(
  documents: readonly LotDocument[],
  loadBytes: DocumentBytesLoader,
): Promise<LotRequirements> {
  if (documents.length === 0) {
    return {
      status: 'UNAVAILABLE',
      items: [],
      warnings: [
        'Официальные документы закупки отсутствуют — нужно проверить вручную в источнике.',
      ],
    };
  }

  const items: LotRequirementItem[] = [];
  const warnings: string[] = [];
  const boundedDocs = documents.slice(0, MAX_EXTRACTED_DOCUMENTS);

  if (documents.length > MAX_EXTRACTED_DOCUMENTS) {
    warnings.push(
      `Проверены первые ${MAX_EXTRACTED_DOCUMENTS} из ${documents.length} документов — остальные нужно проверить вручную.`,
    );
  }

  for (const doc of boundedDocs) {
    let loaded: DocumentBytesResult;
    try {
      loaded = await loadBytes(doc);
    } catch {
      loaded = {
        status: 'UNAVAILABLE',
        reason: 'не удалось безопасно получить байты файла из источника',
      };
    }

    if (loaded.status !== 'OK') {
      const detail = loaded.reason || 'не удалось безопасно получить байты файла из источника';
      warnings.push(`Документ «${doc.name}»: ${detail} — нужно проверить вручную.`);
      continue;
    }

    const parsed = detectAndParseDocumentBytes(loaded.bytes);
    if (parsed.kind === 'EMPTY') {
      warnings.push(`Документ «${doc.name}»: файл пуст — нужно проверить вручную.`);
      continue;
    }
    if (parsed.kind === 'UNSUPPORTED_FORMAT') {
      warnings.push(
        `Документ «${doc.name}»: формат файла не поддерживается детерминированным парсером (поддерживаются текстовые PDF и DOCX) — нужно проверить вручную.`,
      );
      continue;
    }
    if (parsed.kind === 'MALFORMED') {
      warnings.push(
        `Документ «${doc.name}»: структура файла ${parsed.format} повреждена или не читается — нужно проверить вручную.`,
      );
      continue;
    }
    if (parsed.kind === 'NO_TEXT_LAYER') {
      warnings.push(
        `Документ «${doc.name}»: текстовый слой в ${parsed.format} отсутствует (возможно, скан без текстового слоя; OCR не используется) — нужно проверить вручную.`,
      );
      continue;
    }

    const extracted = extractDocumentRequirements(doc, parsed.blocks);
    items.push(...extracted.items);
    warnings.push(...extracted.warnings);

    if (extracted.items.length === 0 && extracted.warnings.length === 0) {
      warnings.push(
        `Документ «${doc.name}»: явные структурированные требования в тексте не обнаружены — нужно проверить вручную.`,
      );
    }
  }

  const status = items.length === 0 ? 'UNAVAILABLE' : warnings.length > 0 ? 'PARTIAL' : 'AVAILABLE';

  return { status, items, warnings };
}

function encodeUtf16BeHex(text: string, includeBom = true): string {
  let hex = includeBom ? 'FEFF' : '';
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return hex;
}

/**
 * Builds a deterministic, valid text-native PDF byte buffer (`%PDF-1.4`) for fixtures and offline
 * tests. Supports multi-page documents and `/FlateDecode` compressed content streams.
 */
export function buildTextNativePdfBytes(
  pages: readonly (readonly string[])[],
  options?: { compress?: boolean },
): Uint8Array {
  const compress = options?.compress ?? true;
  const chunks: Uint8Array[] = [];
  const encodeAscii = (str: string): Uint8Array => new TextEncoder().encode(str);

  chunks.push(encodeAscii('%PDF-1.4\n'));

  const pageCount = pages.length;
  const pageObjIds = pages.map((_, idx) => 3 + idx * 2);
  const streamObjIds = pages.map((_, idx) => 4 + idx * 2);

  chunks.push(encodeAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  chunks.push(
    encodeAscii(
      `2 0 obj\n<< /Type /Pages /Kids [ ${pageObjIds.map((id) => `${id} 0 R`).join(' ')} ] /Count ${pageCount} >>\nendobj\n`,
    ),
  );

  for (let i = 0; i < pageCount; i++) {
    const pageObjId = pageObjIds[i]!;
    const streamObjId = streamObjIds[i]!;
    const lines = pages[i]!;

    const ops: string[] = ['BT', '/F1 11 Tf', '50 780 Td'];
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (lineIdx > 0) ops.push('0 -16 Td');
      ops.push(`<${encodeUtf16BeHex(lines[lineIdx]!)}> Tj`);
    }
    ops.push('ET');
    const rawStream = encodeAscii(ops.join('\n'));
    const payload = compress ? new Uint8Array(deflateSync(rawStream)) : rawStream;
    const filterPart = compress ? ' /Filter /FlateDecode' : '';

    chunks.push(
      encodeAscii(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /Contents ${streamObjId} 0 R >>\nendobj\n`,
      ),
    );
    chunks.push(
      encodeAscii(
        `${streamObjId} 0 obj\n<< /Length ${payload.byteLength}${filterPart} >>\nstream\n`,
      ),
    );
    chunks.push(payload);
    chunks.push(encodeAscii('\nendstream\nendobj\n'));
  }

  chunks.push(encodeAscii('%%EOF\n'));

  const totalLength = chunks.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/**
 * Builds a valid `%PDF-1.4` byte buffer that contains an image XObject and no text streams,
 * representing a scanned/image-only PDF where OCR would be required.
 */
export function buildImageOnlyPdfBytes(): Uint8Array {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [ 3 0 R ] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 4 0 R >> >> >> endobj',
    '4 0 obj << /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>',
    'stream',
    '\u0000',
    'endstream',
    'endobj',
    '%%EOF',
  ].join('\n');
  return new TextEncoder().encode(pdf);
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeUint16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

/**
 * Builds a deterministic OpenXML DOCX (`PK\x03\x04` ZIP archive containing `word/document.xml`)
 * byte buffer for fixtures and offline tests.
 */
export function buildTextNativeDocxBytes(content: {
  paragraphs?: readonly string[];
  tables?: readonly (readonly (readonly string[])[])[];
}): Uint8Array {
  const bodyParts: string[] = [];

  for (const table of content.tables ?? []) {
    const rowsXml = table
      .map((row) => {
        const cellsXml = row
          .map((cell) => `<w:tc><w:p><w:r><w:t>${escapeXmlText(cell)}</w:t></w:r></w:p></w:tc>`)
          .join('');
        return `<w:tr>${cellsXml}</w:tr>`;
      })
      .join('');
    bodyParts.push(`<w:tbl>${rowsXml}</w:tbl>`);
  }

  for (const p of content.paragraphs ?? []) {
    bodyParts.push(`<w:p><w:r><w:t>${escapeXmlText(p)}</w:t></w:r></w:p>`);
  }

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${bodyParts.join('')}</w:body>` +
    '</w:document>';

  return buildSingleEntryZipBytes('word/document.xml', new TextEncoder().encode(documentXml));
}

/**
 * Wraps one named entry in a standard Deflate-compressed ZIP container (`PK\x03\x04` + Central
 * Directory `PK\x01\x02` + EOCD `PK\x05\x06`).
 */
export function buildSingleEntryZipBytes(entryName: string, uncompressed: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(entryName);
  const compressed = new Uint8Array(deflateRawSync(uncompressed));

  const localHeaderLen = 30 + nameBytes.byteLength;
  const cdOffset = localHeaderLen + compressed.byteLength;
  const cdHeaderLen = 46 + nameBytes.byteLength;
  const eocdOffset = cdOffset + cdHeaderLen;
  const totalLen = eocdOffset + 22;

  const out = new Uint8Array(totalLen);

  // Local file header (PK\x03\x04)
  out[0] = 0x50;
  out[1] = 0x4b;
  out[2] = 0x03;
  out[3] = 0x04;
  writeUint16LE(out, 4, 20); // version needed
  writeUint16LE(out, 6, 0); // flags
  writeUint16LE(out, 8, 8); // compression method: deflate
  writeUint32LE(out, 18, compressed.byteLength);
  writeUint32LE(out, 22, uncompressed.byteLength);
  writeUint16LE(out, 26, nameBytes.byteLength);
  writeUint16LE(out, 28, 0);
  out.set(nameBytes, 30);
  out.set(compressed, localHeaderLen);

  // Central directory file header (PK\x01\x02)
  out[cdOffset] = 0x50;
  out[cdOffset + 1] = 0x4b;
  out[cdOffset + 2] = 0x01;
  out[cdOffset + 3] = 0x02;
  writeUint16LE(out, cdOffset + 4, 20);
  writeUint16LE(out, cdOffset + 6, 20);
  writeUint16LE(out, cdOffset + 8, 0);
  writeUint16LE(out, cdOffset + 10, 8);
  writeUint32LE(out, cdOffset + 20, compressed.byteLength);
  writeUint32LE(out, cdOffset + 24, uncompressed.byteLength);
  writeUint16LE(out, cdOffset + 28, nameBytes.byteLength);
  writeUint32LE(out, cdOffset + 42, 0); // local header offset
  out.set(nameBytes, cdOffset + 46);

  // End of Central Directory (PK\x05\x06)
  out[eocdOffset] = 0x50;
  out[eocdOffset + 1] = 0x4b;
  out[eocdOffset + 2] = 0x05;
  out[eocdOffset + 3] = 0x06;
  writeUint16LE(out, eocdOffset + 8, 1);
  writeUint16LE(out, eocdOffset + 10, 1);
  writeUint32LE(out, eocdOffset + 12, cdHeaderLen);
  writeUint32LE(out, eocdOffset + 16, cdOffset);
  writeUint16LE(out, eocdOffset + 20, 0);

  return out;
}
