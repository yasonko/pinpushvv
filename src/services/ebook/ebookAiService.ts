import { EbookGroup, EbookMetadata, PdfSettings } from '../../types/ebook';
import { deriveTitleFromFilename } from './imageSorter';

export interface EbookAiOptions {
  language?: string;
  provider?: 'auto' | 'gemini' | 'pollinations';
  model?: string;
  maxRetries?: number;
}

/**
 * Generates structured AI metadata for a single eBook group.
 * Reuses existing image titles and filenames where available.
 */
export async function generateGroupMetadata(
  group: EbookGroup,
  settings: PdfSettings,
  options: EbookAiOptions = {}
): Promise<EbookMetadata> {
  const maxRetries = options.maxRetries ?? 2;
  const filenames = group.imageItems.map((i) => i.filename);
  
  // Collect existing titles or derive from filenames
  const existingTitles = group.imageItems
    .map((i) => i.title || deriveTitleFromFilename(i.filename))
    .filter(Boolean);

  // Optional sample image thumbnail
  const sampleItem = group.imageItems[0];
  const sampleImageBase64 = sampleItem?.dataUrl || sampleItem?.previewUrl || '';

  const payload = {
    pdfNumber: group.pdfNumberFormatted,
    namingPrefix: settings.namingPrefix || 'eBook',
    filenames,
    existingTitles,
    sampleImageBase64: sampleImageBase64.startsWith('data:image') ? sampleImageBase64 : '',
    language: options.language || 'English',
    provider: options.provider || 'auto',
    model: options.model || 'gemini-3.8-flash',
  };

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const res = await fetch('/api/ai/analyze-ebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }

      const json = await res.json();
      if (json && json.metadata && json.metadata.ebookTitle) {
        return json.metadata as EbookMetadata;
      }
      throw new Error('Invalid JSON structure returned by eBook metadata API');
    } catch (err: any) {
      lastError = err;
      console.warn(`[Ebook AI Engine] Attempt ${attempt}/${maxRetries + 1} failed for group ${group.pdfNumberFormatted}:`, err.message);
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  // Graceful deterministic fallback
  const fallbackSubject = settings.namingPrefix
    ? settings.namingPrefix.replace(/[_\-]+/g, ' ')
    : existingTitles[0] || 'Curated Collection';

  return {
    ebookTitle: `${fallbackSubject} Vol. ${group.pdfNumberFormatted}`,
    subtitle: `Complete ${group.imageCount}-Page Digital Collection`,
    shortDescription: `A high-quality printable collection of ${group.imageCount} curated pages for inspiration and creative projects.`,
    longDescription: `Explore this comprehensive digital eBook featuring ${group.imageCount} hand-selected pages. Ideal for personal inspiration, printables, and creative work.`,
    mainTopic: fallbackSubject,
    audience: 'General Digital Creators & Enthusiasts',
    category: 'Digital Printables & Guides',
    seoKeywords: [fallbackSubject.toLowerCase(), 'printable pdf', 'digital ebook', 'collection', 'creative guide'],
    pinterestKeywords: [fallbackSubject.toLowerCase(), 'printable pdf', 'digital guide', 'ideas and inspiration'],
    pinterestTitle: `${fallbackSubject} Printable PDF Collection #${group.pdfNumberFormatted}`,
    pinterestDescription: `Download this stunning ${group.imageCount}-page digital collection! Visit our website to explore the full PDF eBook and more creative ideas.`,
  };
}
