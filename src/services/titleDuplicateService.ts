import { GoogleGenAI } from '@google/genai';
import { Pin } from '../types';
import { getGeminiApiKey } from './aiService';

/**
 * Normalizes a title for strict comparison:
 * - Trims leading and trailing whitespace
 * - Collapses multiple spaces, tabs, or newlines into a single space
 * - Strips outer quotes and punctuation artifacts
 * - Compares case-insensitively (lowercase)
 */
export function normalizeTitleForComparison(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';

  return title
    .replace(/^["'`“”‘’\s]+|["'`“”‘’\s]+$/g, '') // remove outer quotes/whitespace
    .replace(/\s+/g, ' ')                        // collapse repeated spaces
    .replace(/[.]+$/g, '')                       // remove trailing dot
    .trim()
    .toLowerCase();
}

export interface DuplicateGroup {
  normalizedTitle: string;
  originalTitle: string;
  originalPin: Pin;
  originalIndex: number;
  duplicatePins: Array<{ pin: Pin; index: number }>;
  allPins: Array<{ pin: Pin; index: number }>;
}

export interface DuplicateTitleScanResult {
  hasDuplicates: boolean;
  totalPins: number;
  uniqueTitlesCount: number;
  duplicatesCount: number; // Number of duplicate pins that need re-titling (excluding first occurrence)
  duplicateGroups: Map<string, DuplicateGroup>;
  duplicatePinIds: Set<string>;
  pinStatusMap: Map<string, { isDuplicate: boolean; isOriginal: boolean; groupNormalizedTitle?: string }>;
}

export interface TitleChangeRecord {
  pinId: string;
  pinIndex: number;
  filename: string;
  originalTitle: string;
  newTitle: string;
  reason: string;
  characterCount: number;
  isUserModified?: boolean;
}

/**
 * Scans an array of Pins for exact or case-insensitive duplicate titles.
 * The first occurrence of any title is deemed the "Original" (remains unchanged).
 * Subsequent occurrences are marked as "Duplicates" needing auto-fix.
 */
export function detectDuplicateTitles(pins: Pin[]): DuplicateTitleScanResult {
  const duplicateGroups = new Map<string, DuplicateGroup>();
  const seenFirstIndex = new Map<string, number>();
  const duplicatePinIds = new Set<string>();
  const pinStatusMap = new Map<string, { isDuplicate: boolean; isOriginal: boolean; groupNormalizedTitle?: string }>();

  let duplicatesCount = 0;

  pins.forEach((pin, index) => {
    const rawTitle = (pin.title || pin.filename || `Pin #${index + 1}`).trim();
    const normalized = normalizeTitleForComparison(rawTitle);

    if (!duplicateGroups.has(normalized)) {
      // First occurrence
      duplicateGroups.set(normalized, {
        normalizedTitle: normalized,
        originalTitle: rawTitle,
        originalPin: pin,
        originalIndex: index,
        duplicatePins: [],
        allPins: [{ pin, index }],
      });
      seenFirstIndex.set(normalized, index);
      pinStatusMap.set(pin.id, { isDuplicate: false, isOriginal: true, groupNormalizedTitle: normalized });
    } else {
      // Duplicate occurrence!
      const group = duplicateGroups.get(normalized)!;
      group.duplicatePins.push({ pin, index });
      group.allPins.push({ pin, index });
      duplicatePinIds.add(pin.id);
      duplicatesCount++;
      pinStatusMap.set(pin.id, { isDuplicate: true, isOriginal: false, groupNormalizedTitle: normalized });
    }
  });

  const uniqueTitlesCount = duplicateGroups.size;
  const hasDuplicates = duplicatesCount > 0;

  return {
    hasDuplicates,
    totalPins: pins.length,
    uniqueTitlesCount,
    duplicatesCount,
    duplicateGroups,
    duplicatePinIds,
    pinStatusMap,
  };
}

/**
 * Truncates a title cleanly to Pinterest's strict 100 character limit without breaking words
 */
export function clampTitleLength(title: string, maxLength: number = 100): string {
  let cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;

  // Cut at last space before maxLength
  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 40) {
    cleaned = cut.slice(0, lastSpace).trim();
  } else {
    cleaned = cut.trim();
  }

  // Remove dangling punctuation
  cleaned = cleaned.replace(/[,-:;|/]+$/g, '').trim();
  return cleaned;
}

/**
 * High-performing Pinterest SEO Title variation templates for algorithmic fallback
 */
const SEO_TITLE_PATTERNS = [
  (topic: string) => `Easy ${topic} Recipe for Beginners`,
  (topic: string) => `How to Make the Best ${topic} at Home`,
  (topic: string) => `Simple 5-Step ${topic} Guide`,
  (topic: string) => `Homemade ${topic} Step by Step`,
  (topic: string) => `Ultimate ${topic} Recipe & Tips`,
  (topic: string) => `Quick and Easy ${topic} Ideas`,
  (topic: string) => `Delicious ${topic} You Need to Try`,
  (topic: string) => `Best ${topic} Inspiration & Recipe`,
  (topic: string) => `Perfect ${topic} Made Simple`,
  (topic: string) => `The Secret to Amazing ${topic}`,
  (topic: string) => `Must-Try ${topic} Guide for Beginners`,
  (topic: string) => `Fresh & Easy ${topic} Recipe`,
  (topic: string) => `Step-by-Step ${topic} at Home`,
  (topic: string) => `Trending ${topic} Ideas You'll Love`,
  (topic: string) => `Crispy & Creamy ${topic} Recipe`,
  (topic: string) => `Healthy & Delicious ${topic} Guide`,
  (topic: string) => `Quick 10-Minute ${topic} at Home`,
  (topic: string) => `Creative ${topic} Ideas & Tutorial`,
  (topic: string) => `Classic Homemade ${topic} Recipe`,
  (topic: string) => `Super Easy ${topic} Step-by-Step`,
];

/**
 * Extracts the clean core subject matter of a title
 */
function extractCoreTopic(rawTitle: string): string {
  return rawTitle
    .replace(/^(how to make|how to create|how to bake|the best|easy|simple|ultimate|guide to|homemade|quick|delicious)\s+/i, '')
    .replace(/\s+(recipe|guide|tutorial|ideas|step by step|for beginners|at home)$/i, '')
    .replace(/[-|:;].*$/, '') // remove subtitle after dash/colon
    .trim();
}

/**
 * Generates an intelligent, unique SEO alternative title for a duplicate Pin
 * Uses Gemini AI if available with strict Pinterest search rules, with an NLP algorithmic fallback.
 */
export async function generateUniqueAlternativeTitle(
  pin: Pin,
  usedNormalizedTitles: Set<string>,
  duplicateOccurrenceIndex: number = 1
): Promise<string> {
  const originalTitle = (pin.title || pin.filename || 'Pin').trim();
  const description = (pin.description || '').trim();
  const tags = (pin.tags || []).filter(Boolean);
  const apiKey = getGeminiApiKey();

  // Try AI Generation first
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build-client' } },
      });

      const prompt = `You are a Pinterest SEO copywriter.
A Pinterest Bulk Upload CSV was rejected because multiple Pins share the exact same title:
"${originalTitle}"

Generate 5 distinct, engaging, SEO-friendly alternative Pinterest titles for this Pin.

Pin Context:
- Description: "${description.slice(0, 300)}"
- Keywords: "${tags.join(', ')}"
- Filename/Image: "${pin.filename || ''}"
- Destination URL / Article: "${pin.destinationUrl || ''}"

STRICT RULES:
1. Do NOT append numbers (NO "(1)", "(2)", "- 1", "Part 1", "v2").
2. Max 100 characters per title.
3. Keep the exact same topic and search intent.
4. Use authentic Pinterest high-CTR phrasing (e.g., "Easy 5-Step...", "Homemade... for Beginners", "Best... at Home", "Quick & Simple...").
5. Return ONLY a valid JSON array of 5 strings.`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const text = res?.text?.trim() || '[]';
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const candidates = JSON.parse(cleanJson);

      if (Array.isArray(candidates) && candidates.length > 0) {
        for (const rawCandidate of candidates) {
          const candidate = clampTitleLength(String(rawCandidate).trim(), 100);
          const normalized = normalizeTitleForComparison(candidate);
          if (candidate && normalized && !usedNormalizedTitles.has(normalized)) {
            return candidate;
          }
        }
      }
    } catch (e) {
      console.warn('[DuplicateTitleService] AI alternative title generation error:', e);
    }
  }

  // NLP Algorithmic Fallback: Craft rich unique SEO variations
  const coreTopic = extractCoreTopic(originalTitle) || originalTitle;
  const primaryTag = tags.length > 0 ? tags[0] : '';
  const secondaryTag = tags.length > 1 ? tags[1] : '';

  const fallbackCandidates: string[] = [];

  // Try pattern with core topic
  for (let i = 0; i < SEO_TITLE_PATTERNS.length; i++) {
    const patternFn = SEO_TITLE_PATTERNS[(i + duplicateOccurrenceIndex - 1) % SEO_TITLE_PATTERNS.length];
    fallbackCandidates.push(patternFn(coreTopic));
  }

  // Try patterns with primary tag
  if (primaryTag && primaryTag.toLowerCase() !== coreTopic.toLowerCase()) {
    for (let i = 0; i < 5; i++) {
      const patternFn = SEO_TITLE_PATTERNS[i % SEO_TITLE_PATTERNS.length];
      fallbackCandidates.push(patternFn(primaryTag));
    }
  }

  // Try patterns combining core topic + secondary descriptor
  if (secondaryTag) {
    fallbackCandidates.push(`Easy ${coreTopic} with ${secondaryTag}`);
    fallbackCandidates.push(`Homemade ${coreTopic} & ${secondaryTag} Ideas`);
    fallbackCandidates.push(`The Ultimate ${coreTopic} (${secondaryTag})`);
  }

  // Find the first candidate that hasn't been used yet
  for (const rawCand of fallbackCandidates) {
    const cand = clampTitleLength(rawCand, 100);
    const norm = normalizeTitleForComparison(cand);
    if (cand && norm && !usedNormalizedTitles.has(norm)) {
      return cand;
    }
  }

  // Ultimate fallback (guaranteed distinct SEO formulation)
  const safeFallback = clampTitleLength(
    `Delicious Homemade ${coreTopic} Recipe and Guide`,
    100
  );
  return safeFallback;
}

/**
 * Main Auto-Fix Pipeline for Duplicate Titles:
 * 1. Identifies all duplicates across all Pins.
 * 2. Keeps the first Pin of each group unchanged.
 * 3. Rewrites subsequent duplicates to unique SEO-friendly titles.
 * 4. Runs a second validation pass to ensure 100% uniqueness across all rows.
 */
export async function autoFixDuplicateTitles(
  pins: Pin[],
  onProgress?: (current: number, total: number, originalTitle: string, newTitle: string) => void
): Promise<{
  updatedPins: Pin[];
  changes: TitleChangeRecord[];
  duplicatesDetected: number;
  isAllUnique: boolean;
}> {
  const scan = detectDuplicateTitles(pins);

  if (!scan.hasDuplicates) {
    return {
      updatedPins: pins,
      changes: [],
      duplicatesDetected: 0,
      isAllUnique: true,
    };
  }

  const updatedPins: Pin[] = [...pins];
  const changes: TitleChangeRecord[] = [];
  const usedNormalizedTitles = new Set<string>();

  // Seed with all original/unique titles that will stay unchanged
  scan.duplicateGroups.forEach((group) => {
    usedNormalizedTitles.add(group.normalizedTitle);
  });

  let processedCount = 0;
  const totalDuplicates = scan.duplicatesCount;

  // Process all duplicate groups
  for (const [, group] of scan.duplicateGroups) {
    // group.originalPin (group.originalIndex) stays UNCHANGED!

    // Loop through duplicates in this group (index 1, 2, ...)
    for (let dupIdx = 0; dupIdx < group.duplicatePins.length; dupIdx++) {
      const { pin: dupPin, index: pinIndex } = group.duplicatePins[dupIdx];
      processedCount++;

      // Generate a distinct SEO alternative title
      const newTitle = await generateUniqueAlternativeTitle(
        dupPin,
        usedNormalizedTitles,
        dupIdx + 1
      );

      const normNew = normalizeTitleForComparison(newTitle);
      usedNormalizedTitles.add(normNew);

      // Create updated pin with new title
      const updatedPin: Pin = {
        ...dupPin,
        title: newTitle,
        titleManuallyEdited: false,
      };

      updatedPins[pinIndex] = updatedPin;

      changes.push({
        pinId: dupPin.id,
        pinIndex,
        filename: dupPin.filename || `pin_${pinIndex + 1}.jpg`,
        originalTitle: dupPin.title || group.originalTitle,
        newTitle,
        reason: `Auto-rewritten from duplicate of Pin #${group.originalIndex + 1}`,
        characterCount: newTitle.length,
      });

      if (onProgress) {
        onProgress(processedCount, totalDuplicates, dupPin.title || group.originalTitle, newTitle);
      }
    }
  }

  // Second validation check: run scan again to guarantee 100% uniqueness
  const secondScan = detectDuplicateTitles(updatedPins);

  return {
    updatedPins,
    changes,
    duplicatesDetected: scan.duplicatesCount,
    isAllUnique: !secondScan.hasDuplicates,
  };
}
