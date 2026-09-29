import type { LotDocument } from '../src/modules/tender/lot';
import {
  buildImageOnlyPdfBytes,
  buildSingleEntryZipBytes,
  buildTextNativeDocxBytes,
  buildTextNativePdfBytes,
  detectAndParseDocumentBytes,
  extractLotRequirements,
} from '../src/modules/tender/lot-requirements';

const makeDoc = (overrides: Partial<LotDocument> = {}): LotDocument => ({
  id: 'doc-1',
  name: 'Техническая спецификация.pdf',
  type: null,
  mimeType: 'application/pdf',
  sizeBytes: null,
  sourceUrl: 'https://goszakup.gov.kz/files/download_file/1/tech-spec.pdf',
  ...overrides,
});

describe('CP-12 deterministic document format reconnaissance & requirements extraction', () => {
  it('extracts source-linked requirements from a multi-page text-native PDF', async () => {
    const pdfBytes = buildTextNativePdfBytes([
      [
        '1. Предмет закупки',
        'Наименование товара: Столы письменные из ЛДСП',
        'Количество: 6 комплектов',
        'Габаритные размеры: 1200х600х750 мм',
        'Материал изготовления: ЛДСП 16 мм класса Е1, кромка ПВХ 2 мм',
      ],
      [
        '2. Условия поставки и квалификация',
        'Место и срок поставки: г. Алматы, Алатауский район, в течение 15 календарных дней',
        'Квалификационные требования: опыт поставки мебели не менее 1 года',
        'Подтверждающие документы: сертификат соответствия ЕАЭС и паспорт изделия',
      ],
    ]);

    const doc = makeDoc({ id: 'pdf-doc-101', name: 'Техническая спецификация' });
    const result = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: pdfBytes,
    }));

    expect(result.status).toBe('AVAILABLE');
    expect(result.warnings).toEqual([]);
    expect(result.items).toEqual([
      {
        category: 'SUBJECT',
        text: 'Наименование товара: Столы письменные из ЛДСП',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'QUANTITY',
        text: 'Количество: 6 комплектов',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'DIMENSIONS',
        text: 'Габаритные размеры: 1200х600х750 мм',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'MATERIAL',
        text: 'Материал изготовления: ЛДСП 16 мм класса Е1, кромка ПВХ 2 мм',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'DELIVERY',
        text: 'Место и срок поставки: г. Алматы, Алатауский район, в течение 15 календарных дней',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 2',
      },
      {
        category: 'QUALIFICATION',
        text: 'Квалификационные требования: опыт поставки мебели не менее 1 года',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 2',
      },
      {
        category: 'SUPPORTING_DOCUMENT',
        text: 'Подтверждающие документы: сертификат соответствия ЕАЭС и паспорт изделия',
        sourceDocumentId: 'pdf-doc-101',
        sourceLocator: 'Стр. 2',
      },
    ]);
  });

  it('parses PDF streams using ToUnicode CMap mappings and TJ arrays', async () => {
    // Construct a PDF with a ToUnicode CMap where <0001><0002><0003> maps to "Количество: 5 шт"
    const target = 'Количество: 5 шт';
    const bfcharLines = [...target]
      .map((ch, idx) => {
        const key = (idx + 1).toString(16).toUpperCase().padStart(4, '0');
        const val = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
        return `<${key}> <${val}>`;
      })
      .join('\n');
    const hexEncoded = [...target]
      .map((_, idx) => (idx + 1).toString(16).toUpperCase().padStart(4, '0'))
      .join('');

    const cmapStream = `begincmap\n${target.length} beginbfchar\n${bfcharLines}\nendbfchar\nendcmap`;
    const contentStream = `BT\n/F1 11 Tf\n[<${hexEncoded}>] TJ\nET`;
    const rawPdf = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [ 3 0 R ] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj',
      `4 0 obj << /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
      `5 0 obj << /Length ${cmapStream.length} >>\nstream\n${cmapStream}\nendstream\nendobj`,
      '%%EOF',
    ].join('\n');

    const parsed = detectAndParseDocumentBytes(new TextEncoder().encode(rawPdf));
    expect(parsed).toEqual({
      kind: 'PARSED',
      format: 'PDF',
      blocks: [{ text: 'Количество: 5 шт', locator: 'Стр. 1' }],
    });
  });

  it('extracts source-linked requirements from a text-native DOCX even when mimeType is null and filename has no extension', async () => {
    const docxBytes = buildTextNativeDocxBytes({
      tables: [
        [
          ['Предмет закупки', 'Тумбы приставные офисные из ЛДСП'],
          ['Количество', '12 штук'],
          ['Материал', 'ЛДСП толщиной 16 мм, кромка ПВХ'],
        ],
      ],
      paragraphs: ['Срок поставки: в течение 10 рабочих дней со дня подписания договора.'],
    });

    const doc = makeDoc({
      id: 'docx-untyped-1',
      name: 'Приложение без расширения',
      mimeType: null,
    });
    const result = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: docxBytes,
    }));

    expect(result.status).toBe('AVAILABLE');
    expect(result.warnings).toEqual([]);
    expect(result.items).toEqual([
      {
        category: 'SUBJECT',
        text: 'Предмет закупки: Тумбы приставные офисные из ЛДСП',
        sourceDocumentId: 'docx-untyped-1',
        sourceLocator: 'Табл. 1, стр. 1',
      },
      {
        category: 'QUANTITY',
        text: 'Количество: 12 штук',
        sourceDocumentId: 'docx-untyped-1',
        sourceLocator: 'Табл. 1, стр. 2',
      },
      {
        category: 'MATERIAL',
        text: 'Материал: ЛДСП толщиной 16 мм, кромка ПВХ',
        sourceDocumentId: 'docx-untyped-1',
        sourceLocator: 'Табл. 1, стр. 3',
      },
      {
        category: 'DELIVERY',
        text: 'Срок поставки: в течение 10 рабочих дней со дня подписания договора.',
        sourceDocumentId: 'docx-untyped-1',
        sourceLocator: 'Абз. 1',
      },
    ]);
  });

  it('never trusts filename or mimeType when actual bytes are an unsupported format', async () => {
    // Legacy OLE2 (.doc / .xls) magic bytes disguised as .pdf
    const ole2Bytes = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    const disguisedPdf = makeDoc({
      id: 'fake-pdf',
      name: 'tech-spec.pdf',
      mimeType: 'application/pdf',
    });

    // Plain ZIP archive without word/document.xml disguised as .docx
    const plainZipBytes = buildSingleEntryZipBytes(
      'notes/readme.txt',
      new TextEncoder().encode('Количество: 100 шт.'),
    );
    const disguisedDocx = makeDoc({
      id: 'fake-docx',
      name: 'appendix.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const result = await extractLotRequirements([disguisedPdf, disguisedDocx], async (doc) => ({
      status: 'OK',
      bytes: doc.id === 'fake-pdf' ? ole2Bytes : plainZipBytes,
    }));

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.items).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('не поддерживается детерминированным парсером');
    expect(result.warnings[1]).toContain('не поддерживается детерминированным парсером');
  });

  it('handles an empty document safely with UNAVAILABLE and a manual-review warning', async () => {
    const doc = makeDoc({ id: 'empty-doc', name: 'Пустой файл.pdf' });
    const result = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: new Uint8Array(0),
    }));

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      'Документ «Пустой файл.pdf»: файл пуст — нужно проверить вручную.',
    ]);
  });

  it('handles malformed PDF and malformed DOCX bytes safely without throwing', async () => {
    const malformedPdf = new TextEncoder().encode('%PDF-1.4\ntruncated broken file without obj');
    const malformedDocx = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]);

    const docs = [
      makeDoc({ id: 'bad-pdf', name: 'Битый.pdf' }),
      makeDoc({ id: 'bad-docx', name: 'Битый.docx' }),
    ];

    const result = await extractLotRequirements(docs, async (doc) => ({
      status: 'OK',
      bytes: doc.id === 'bad-pdf' ? malformedPdf : malformedDocx,
    }));

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      'Документ «Битый.pdf»: структура файла PDF повреждена или не читается — нужно проверить вручную.',
      'Документ «Битый.docx»: структура файла DOCX повреждена или не читается — нужно проверить вручную.',
    ]);
  });

  it('marks scanned/image-only PDF without a text layer as UNAVAILABLE with manual-review warning and no OCR', async () => {
    const scannedPdf = buildImageOnlyPdfBytes();
    const doc = makeDoc({ id: 'scan-1', name: 'Скан спецификации.pdf' });

    const result = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: scannedPdf,
    }));

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      'Документ «Скан спецификации.pdf»: текстовый слой в PDF отсутствует (возможно, скан без текстового слоя; OCR не используется) — нужно проверить вручную.',
    ]);
  });

  it('never produces a requirement without source text evidence (headings and blank templates only)', async () => {
    const templateDocx = buildTextNativeDocxBytes({
      paragraphs: [
        '1. Предмет закупки',
        'Наименование заказчика ________________________',
        'Наименование лота _____________________________',
        '2. Квалификационные требования',
        'Подпись поставщика ____________________________',
      ],
    });

    const doc = makeDoc({ id: 'blank-template', name: 'Шаблон заявки.docx' });
    const result = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: templateDocx,
    }));

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      'Документ «Шаблон заявки.docx»: явные структурированные требования в тексте не обнаружены — нужно проверить вручную.',
    ]);
  });

  it('behaves deterministically on repeated headings/sections and deduplicates identical lines', async () => {
    const pdfBytes = buildTextNativePdfBytes([
      [
        '1. Технические характеристики и материалы',
        'Материал изготовления: ЛДСП 16 мм класса Е1',
        'Материал изготовления: ЛДСП 16 мм класса Е1',
        '1. Технические характеристики и материалы',
        'Габаритные размеры: 1400х700х750 мм',
        '2. Условия и сроки поставки',
        '1.1. Поставщик обязан обеспечить разгрузку и сборку мебели на этаже заказчика.',
      ],
    ]);

    const doc = makeDoc({ id: 'repeat-doc', name: 'Спецификация.pdf' });
    const firstRun = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: pdfBytes,
    }));
    const secondRun = await extractLotRequirements([doc], async () => ({
      status: 'OK',
      bytes: pdfBytes,
    }));

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.status).toBe('AVAILABLE');
    expect(firstRun.items).toEqual([
      {
        category: 'MATERIAL',
        text: 'Материал изготовления: ЛДСП 16 мм класса Е1',
        sourceDocumentId: 'repeat-doc',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'DIMENSIONS',
        text: 'Габаритные размеры: 1400х700х750 мм',
        sourceDocumentId: 'repeat-doc',
        sourceLocator: 'Стр. 1',
      },
      {
        category: 'DELIVERY',
        text: '1.1. Поставщик обязан обеспечить разгрузку и сборку мебели на этаже заказчика.',
        sourceDocumentId: 'repeat-doc',
        sourceLocator: 'Стр. 1, п. 1.1',
      },
    ]);
  });

  it('returns PARTIAL with warnings when some requirements are extracted and uncertainty or a second unreadable document exists', async () => {
    const partialPdf = buildTextNativePdfBytes([
      [
        'Наименование товара: Стеллажи архивные из ЛДСП',
        'Количество: 8 штук',
        'Конструкция полок и схема крепления выполняются согласно чертежу в приложении.',
      ],
    ]);

    const docs = [
      makeDoc({ id: 'doc-ok', name: 'Спецификация.pdf' }),
      makeDoc({ id: 'doc-missing', name: 'Чертеж.dwg' }),
    ];

    const result = await extractLotRequirements(docs, async (doc) => {
      if (doc.id === 'doc-ok') return { status: 'OK', bytes: partialPdf };
      return { status: 'OK', bytes: new TextEncoder().encode('AC1027 binary dwg') };
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.sourceDocumentId === 'doc-ok')).toBe(true);
    expect(result.warnings).toEqual([
      'Документ «Спецификация.pdf» (Стр. 1): обнаружена отсылка к чертежу, схеме или неполным данным — нужно проверить вручную.',
      'Документ «Чертеж.dwg»: формат файла не поддерживается детерминированным парсером (поддерживаются текстовые PDF и DOCX) — нужно проверить вручную.',
    ]);
  });
});
