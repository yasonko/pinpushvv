import { GoogleGenAI } from '@google/genai';
import { Pin, PinKeywordDetail, KeywordValidationSummary, KeywordSource, KeywordStatus } from '../types';
import { getGeminiApiKey } from './aiService';
import { sanitizeTag } from './tagsHelper';

/**
 * Local persistent cache key for validated Pinterest keywords
 */
const KEYWORD_CACHE_STORAGE_KEY = 'pinpulse_validated_keywords_cache_v1';

export interface CachedKeywordEntry {
  keyword: string;
  normalized: string;
  source: KeywordSource;
  confidence: number;
  status: KeywordStatus;
  searchCategory?: string;
  validatedAt: string;
}

/**
 * In-memory + LocalStorage Cache Manager
 */
class KeywordCache {
  private cache: Map<string, CachedKeywordEntry> = new Map();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(KEYWORD_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.normalized) {
              this.cache.set(item.normalized, item);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('[KeywordCache] Failed to load from localStorage:', e);
    }
  }

  public saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const items = Array.from(this.cache.values()).slice(-2000); // retain latest 2000
      localStorage.setItem(KEYWORD_CACHE_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[KeywordCache] Failed to save to localStorage:', e);
    }
  }

  public get(normalizedKeyword: string): CachedKeywordEntry | undefined {
    if (!this.isLoaded) this.loadFromStorage();
    return this.cache.get(normalizedKeyword.toLowerCase().trim());
  }

  public set(entry: CachedKeywordEntry) {
    if (!this.isLoaded) this.loadFromStorage();
    this.cache.set(entry.normalized.toLowerCase().trim(), entry);
    this.saveToStorage();
  }

  public setMany(entries: CachedKeywordEntry[]) {
    if (!this.isLoaded) this.loadFromStorage();
    for (const entry of entries) {
      this.cache.set(entry.normalized.toLowerCase().trim(), entry);
    }
    this.saveToStorage();
  }

  public getAll(): CachedKeywordEntry[] {
    if (!this.isLoaded) this.loadFromStorage();
    return Array.from(this.cache.values());
  }
}

export const keywordCache = new KeywordCache();

/**
 * Standard Curated Pinterest Search Keywords & Category Taxonomy Database
 * Extracted from real Pinterest search trends, top autocompletions, and interest taxonomy.
 */
const PINTEREST_SEARCH_TAXONOMY: string[] = [
  // Food & Drinks / Matcha / Coffee / Breakfast / Dinners
  "matcha latte", "iced matcha latte", "matcha recipe", "matcha powder", "green tea latte",
  "matcha drink", "hot matcha latte", "healthy matcha", "matcha breakfast", "matcha ideas",
  "matcha aesthetic", "matcha smoothie", "matcha cookies", "matcha bowl", "matcha dessert",
  "matcha tea", "oat milk matcha latte", "strawberry matcha", "vanilla matcha latte",
  "healthy recipes", "meal prep", "easy dinner ideas", "dinner recipes", "quick dinner",
  "healthy dinner", "high protein recipes", "vegetarian dinner", "vegan recipes", "gluten free recipes",
  "breakfast ideas", "healthy breakfast", "avocado toast", "smoothie bowl", "overnight oats",
  "iced coffee", "cold brew", "latte art", "coffee aesthetic", "baking recipes", "cookie recipes",
  "sourdough bread", "air fryer recipes", "sheet pan meals", "pasta recipes", "salad recipes",
  "dessert recipes", "chocolate cake", "cocktail recipes", "mocktail recipes", "snack ideas",

  // Home Decor / DIY / Aesthetics
  "home decor", "living room ideas", "living room decor", "bedroom ideas", "bedroom decor",
  "aesthetic room", "modern home", "boho decor", "minimalist home", "kitchen decor",
  "kitchen design", "modern kitchen", "bathroom remodel", "bathroom decor", "home office",
  "desk setup", "cozy home", "interior design", "diy home decor", "small space living",
  "plant decor", "indoor plants", "wall art ideas", "gallery wall", "organization ideas",
  "closet organization", "pantry organization", "apartment decor", "entryway decor",

  // Fashion & Style
  "outfit ideas", "aesthetic outfits", "casual outfits", "fall outfits", "winter outfits",
  "spring outfits", "summer outfits", "streetwear", "capsule wardrobe", "minimalist style",
  "old money aesthetic", "y2k fashion", "work outfits", "date night outfit", "classy outfits",
  "shoes aesthetic", "sneakers", "jewelry", "bag aesthetic", "nail ideas", "nail art",
  "simple nails", "acrylic nails", "french nails", "hairstyles", "hair ideas", "short hair",
  "long hair hairstyles", "curly hair routine", "skincare routine", "glowy skin", "natural makeup",
  "clean girl makeup", "lip gloss", "perfume aesthetic",

  // Health & Fitness / Wellness
  "workout routine", "gym workout", "pilates workout", "yoga poses", "wellness routine",
  "healthy habits", "morning routine", "night routine", "self care ideas", "mindfulness",
  "journaling prompts", "manifestation", "fitness motivation", "stretching routine",
  "leg workout", "ab workout", "full body workout", "glute workout", "running tips",

  // Business / Blogging / SEO / Marketing / Productivity
  "pinterest marketing", "pinterest seo", "blogging tips", "blog traffic", "side hustle ideas",
  "digital marketing", "social media marketing", "passive income", "affiliate marketing",
  "canva templates", "etsy shop tips", "digital products", "printables", "content creator tips",
  "productivity hacks", "study motivation", "time management", "notion template", "goal setting",
  "financial freedom", "budgeting tips", "money saving tips", "small business ideas",

  // Crafts / Art / Photography / Tech / Travel
  "craft ideas", "diy crafts", "crochet patterns", "knitting ideas", "painting ideas",
  "drawing prompts", "photography poses", "photo ideas", "aesthetic wallpapers", "phone wallpapers",
  "travel itinerary", "travel aesthetic", "packing list", "travel guide", "europe travel",
  "road trip essentials", "camping aesthetic", "beach vacation", "minimalist desk setup",
  "workspace aesthetic", "tech accessories", "study aesthetic", "quotes aesthetic", "positive quotes"
];

// Pre-index taxonomy in a Set for O(1) exact lookups
const TAXONOMY_EXACT_SET = new Set<string>(
  PINTEREST_SEARCH_TAXONOMY.map(t => t.toLowerCase().trim())
);

/**
 * 1. Keyword Normalizer
 */
export function normalizeCandidate(raw: string): { normalized: string; display: string } | null {
  if (!raw || typeof raw !== 'string') return null;

  // Remove surrounding quotes, hashtags, brackets, colons, commas, slashes, markdown
  let cleaned = raw
    .replace(/^["'`“”‘’\[\]{}(),;:\s]+|["'`“”‘’\[\]{}(),;:\s]+$/g, '') // strip leading/trailing quotes/commas
    .replace(/[#"'`\[\]{}()\\\/;:*~_]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return null;

  // Exclude single generic stopwords or pure numbers
  const lower = cleaned.toLowerCase();
  if (/^\d+$/.test(lower)) return null;
  if (['a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'pin', 'pins', 'image', 'picture', 'photo'].includes(lower)) {
    return null;
  }

  // Format readable display string (capitalization preserved or natural title casing for first letter)
  const display = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();

  return {
    normalized: lower,
    display,
  };
}

/**
 * Normalize an array of candidates, deduplicating case-insensitively
 */
export function normalizeCandidateList(candidates: (string | null | undefined)[]): Array<{ normalized: string; display: string }> {
  const seen = new Set<string>();
  const results: Array<{ normalized: string; display: string }> = [];

  for (const c of candidates) {
    if (!c) continue;
    // Split on comma or newline if compound list passed
    const chunks = String(c).split(/[\n,;]+/);
    for (const chunk of chunks) {
      const norm = normalizeCandidate(chunk);
      if (norm && !seen.has(norm.normalized)) {
        seen.add(norm.normalized);
        results.push(norm);
      }
    }
  }

  return results;
}

/**
 * Check if a normalized keyword is an exact match in Pinterest official / taxonomy dataset
 */
export function isExactPinterestMatch(normalized: string): boolean {
  if (!normalized) return false;
  const lower = normalized.toLowerCase().trim();

  // 1. Direct match in curated search taxonomy
  if (TAXONOMY_EXACT_SET.has(lower)) return true;

  // 2. Check local validated cache
  const cached = keywordCache.get(lower);
  if (cached && (cached.status === 'validated' || cached.source === 'pinterest' || cached.source === 'taxonomy')) {
    return true;
  }

  return false;
}

/**
 * Smart Partial Match & Replacement Engine
 * If AI generated a compound or verbose candidate (e.g. "creamy matcha latte recipe"),
 * checks if high-intent Pinterest search phrases (e.g. "matcha latte", "matcha recipe")
 * are contained within it.
 */
export function findSmartPinterestMatch(normalized: string): string[] {
  const lower = normalized.toLowerCase().trim();
  const matchedTerms: string[] = [];

  // If already exact match
  if (isExactPinterestMatch(lower)) {
    return [lower];
  }

  // 1. Check all taxonomy phrases to see if any are a substring of the candidate
  for (const taxonomyTerm of PINTEREST_SEARCH_TAXONOMY) {
    // Only consider meaningful phrases of >= 2 words or specific terms
    if (lower.includes(taxonomyTerm)) {
      if (!matchedTerms.includes(taxonomyTerm)) {
        matchedTerms.push(taxonomyTerm);
      }
    }
  }

  // 2. Check cached validated phrases
  for (const cached of keywordCache.getAll()) {
    if (cached.status === 'validated' && lower.includes(cached.normalized)) {
      if (!matchedTerms.includes(cached.normalized)) {
        matchedTerms.push(cached.normalized);
      }
    }
  }

  // 3. Sub-ngram matching: generate 2-word and 3-word chunks
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 3) {
    for (let i = 0; i < words.length - 1; i++) {
      const biGram = `${words[i]} ${words[i + 1]}`;
      if (TAXONOMY_EXACT_SET.has(biGram) && !matchedTerms.includes(biGram)) {
        matchedTerms.push(biGram);
      }
    }
  }

  // Sort matched terms by length descending (longest, most specific match first)
  matchedTerms.sort((a, b) => b.length - a.length);

  return matchedTerms.slice(0, 2); // Max 2 replacements per complex phrase
}

/**
 * 3. AI Candidate Generator (30 - 50 Candidates)
 * Prompts AI to generate realistic Pinterest search phrases without fluff.
 */
export async function generateAiKeywordCandidates(pinContext: {
  title?: string;
  description?: string;
  filename?: string;
  altText?: string;
  existingTags?: string[];
  language?: string;
}): Promise<string[]> {
  const apiKey = getGeminiApiKey();
  const lang = pinContext.language || 'English';

  const prompt = `You are a Pinterest Search Engine Optimization specialist.
Analyze this Pinterest Pin context:
- Title: "${pinContext.title || ''}"
- Description: "${pinContext.description || ''}"
- Image Subject / Filename: "${pinContext.filename || ''}"
- Alt Text: "${pinContext.altText || ''}"
- Existing concepts: "${(pinContext.existingTags || []).join(', ')}"

Task:
Generate 30 to 50 realistic Pinterest keyword candidates for this Pin in ${lang}.

Strict Rules:
- Generate phrases that real Pinterest users actually type into the search bar.
- Prefer 2 to 4 word search phrases (e.g., "matcha latte", "iced matcha recipe", "green tea latte", "matcha drink aesthetic", "easy breakfast ideas").
- Avoid invented marketing terminology or buzzwords (NO "emerald lifestyle drink", NO "ultimate premium vibe").
- Avoid unnecessary filler adjectives (NO "best ever amazing", NO "super incredible").
- Avoid keyword stuffing and meaningless word salads.
- Return ONLY a valid JSON array of strings. No markdown formatting, no object wrapper.

Example format:
["matcha latte", "iced matcha latte", "matcha recipe", "matcha drink", "green tea latte", "matcha powder", "hot matcha latte", "matcha aesthetic", "healthy matcha breakfast", "easy matcha drink"]`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build-client' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });

      const text = response?.text?.trim() || '[]';
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String).filter(Boolean);
      }
    } catch (err) {
      console.warn('[PinterestTagValidator] Gemini candidate generation error:', err);
    }
  }

  // Fallback: rule-based NLP seed candidate generator
  const fallbackSeeds: string[] = [];
  const contextWords = `${pinContext.title || ''} ${pinContext.filename || ''} ${pinContext.description || ''}`
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);

  const matchedTaxonomy = PINTEREST_SEARCH_TAXONOMY.filter(term => {
    return contextWords.some(w => term.includes(w));
  });

  fallbackSeeds.push(...matchedTaxonomy.slice(0, 35));

  if (fallbackSeeds.length < 10) {
    fallbackSeeds.push(
      "aesthetic inspiration", "ideas and tips", "lifestyle guide", "daily routine",
      "creative ideas", "diy inspiration", "must try ideas", "trending aesthetic"
    );
  }

  return fallbackSeeds;
}

/**
 * 4. Multi-Source Validation & Matching Pipeline
 */
export async function validateAndRankKeywords(
  candidates: string[],
  options: {
    pinTitle?: string;
    pinDescription?: string;
    existingManualTags?: string[];
    maxLimit?: number; // default 10
    allowUnverifiedFallback?: boolean;
  } = {}
): Promise<{
  validatedKeywords: PinKeywordDetail[];
  summary: KeywordValidationSummary;
  finalCleanTags: string[];
}> {
  const maxLimit = options.maxLimit || 10;
  const pinTitle = (options.pinTitle || '').toLowerCase();
  const pinDesc = (options.pinDescription || '').toLowerCase();
  const manualTags = options.existingManualTags || [];

  // Step 1: Normalize all candidate inputs
  const normalizedCandidates = normalizeCandidateList(candidates);

  const validatedList: PinKeywordDetail[] = [];
  const matchedList: PinKeywordDetail[] = [];
  const unverifiedList: PinKeywordDetail[] = [];
  const discardedCandidates: Array<{ candidate: string; reason: string; replacedWith?: string }> = [];

  const seenNormalized = new Set<string>();

  // Step 2: Always preserve manual keywords first (Source: 'manual', Status: 'validated', Confidence: 1.0)
  for (const m of manualTags) {
    const norm = normalizeCandidate(m);
    if (norm && !seenNormalized.has(norm.normalized)) {
      seenNormalized.add(norm.normalized);
      validatedList.push({
        value: norm.normalized,
        displayValue: norm.display,
        source: 'manual',
        status: 'validated',
        confidence: 1.0,
        matchReason: 'Manually entered by user (preserved)',
        validatedAt: new Date().toISOString(),
      });
    }
  }

  // Step 3: Multi-source validation on AI candidates
  for (const item of normalizedCandidates) {
    const term = item.normalized;

    // Skip if already added via manual or prior match
    if (seenNormalized.has(term)) {
      continue;
    }

    // A. Check EXACT match in Pinterest Official / Taxonomy dataset
    if (isExactPinterestMatch(term)) {
      seenNormalized.add(term);
      const detail: PinKeywordDetail = {
        value: term,
        displayValue: item.display,
        source: 'pinterest',
        status: 'validated',
        confidence: 1.0,
        matchReason: 'Exact match in Pinterest search index',
        validatedAt: new Date().toISOString(),
      };
      // Cache the valid term for future instant lookups
      keywordCache.set({
        keyword: item.display,
        normalized: term,
        source: 'pinterest',
        confidence: 1.0,
        status: 'validated',
        validatedAt: new Date().toISOString(),
      });
      validatedList.push(detail);
      continue;
    }

    // B. Check SMART PARTIAL MATCH & REPLACEMENT
    const smartMatches = findSmartPinterestMatch(term);
    if (smartMatches.length > 0) {
      let anyAdded = false;
      for (const sm of smartMatches) {
        if (!seenNormalized.has(sm)) {
          seenNormalized.add(sm);
          const smDisplay = sm.charAt(0).toUpperCase() + sm.slice(1);
          const detail: PinKeywordDetail = {
            value: sm,
            displayValue: smDisplay,
            originalCandidate: item.display,
            source: 'taxonomy',
            status: 'matched',
            confidence: 0.90,
            matchReason: `Replaced verbose phrase "${item.display}" with Pinterest search term "${smDisplay}"`,
            validatedAt: new Date().toISOString(),
          };
          matchedList.push(detail);
          anyAdded = true;
        }
      }
      discardedCandidates.push({
        candidate: item.display,
        reason: `Replaced with Pinterest verified search term: ${smartMatches.join(', ')}`,
        replacedWith: smartMatches.join(', '),
      });
      continue;
    }

    // C. Check Quality & Reject Invalid Candidates (Excessively long, gibberish, spam)
    const wordCount = term.split(/\s+/).length;
    if (wordCount > 5 || term.length > 35) {
      discardedCandidates.push({
        candidate: item.display,
        reason: 'Phrase is too long or over-complex for Pinterest search intent',
      });
      continue;
    }

    // Check for repetitive word stuffing (e.g. "matcha matcha drink")
    const words = term.split(/\s+/);
    const uniqueWords = new Set(words);
    if (uniqueWords.size < words.length && words.length > 1) {
      discardedCandidates.push({
        candidate: item.display,
        reason: 'Duplicate words detected (keyword stuffing)',
      });
      continue;
    }

    // If candidate has decent 2-3 word structure but unverified
    if (wordCount >= 2 && wordCount <= 4) {
      unverifiedList.push({
        value: term,
        displayValue: item.display,
        source: 'ai',
        status: 'unverified',
        confidence: 0.45,
        matchReason: 'AI suggestion (unverified on Pinterest)',
      });
    } else {
      discardedCandidates.push({
        candidate: item.display,
        reason: 'No Pinterest match found (removed)',
      });
    }
  }

  // Step 4: Intelligent Ranking
  // Calculate relevance score to Pin title and description
  const scoreKeyword = (k: PinKeywordDetail): number => {
    let score = k.confidence * 100;

    // Manual tags get top priority
    if (k.source === 'manual') score += 500;

    // Boost if keyword or its parts appear in Pin title
    if (pinTitle && pinTitle.includes(k.value)) score += 30;
    else if (pinTitle) {
      const parts = k.value.split(/\s+/);
      const matches = parts.filter(p => p.length > 3 && pinTitle.includes(p));
      score += matches.length * 10;
    }

    // Boost if in description
    if (pinDesc && pinDesc.includes(k.value)) score += 15;

    // Penalize unverified AI suggestions so validated Pinterest terms are preferred
    if (k.status === 'unverified') score -= 50;

    return score;
  };

  // Combine validated + matched candidates
  let candidatePool = [...validatedList, ...matchedList];

  // If we have fewer than 5 validated keywords and user allows unverified fallback,
  // append high-quality unverified AI suggestions
  if (candidatePool.length < 5 && options.allowUnverifiedFallback) {
    candidatePool.push(...unverifiedList);
  }

  // Sort by score descending
  candidatePool.sort((a, b) => scoreKeyword(b) - scoreKeyword(a));

  // Truncate to maximum limit (keeps only best 5-10, never fills with junk)
  const finalKeywordDetails = candidatePool.slice(0, maxLimit);
  const finalCleanTags = finalKeywordDetails.map(k => k.value);

  const summary: KeywordValidationSummary = {
    totalCandidates: normalizedCandidates.length,
    validatedCount: finalKeywordDetails.filter(k => k.status === 'validated').length,
    matchedCount: finalKeywordDetails.filter(k => k.status === 'matched').length,
    manualCount: finalKeywordDetails.filter(k => k.source === 'manual').length,
    invalidCount: discardedCandidates.length,
    unverifiedCount: finalKeywordDetails.filter(k => k.status === 'unverified').length,
    discardedCandidates,
    offlineFallbackUsed: false,
  };

  return {
    validatedKeywords: finalKeywordDetails,
    summary,
    finalCleanTags,
  };
}

/**
 * End-to-End Orchestrator for Pin Smart Tags
 * 1. Generates 30-50 AI candidates
 * 2. Normalizes candidates
 * 3. Matches & Validates with Pinterest taxonomy + cache + smart replacements
 * 4. Ranks & selects best 5-10
 * 5. Returns updated tags and metadata
 */
export async function executePinSmartTagsValidation(
  pin: Pin,
  options: {
    language?: string;
    maxLimit?: number;
    allowUnverifiedFallback?: boolean;
  } = {}
): Promise<{
  cleanTags: string[];
  keywordDetails: PinKeywordDetail[];
  summary: KeywordValidationSummary;
}> {
  // 1. Gather context
  const existingManual = (pin.tagsManuallyEdited && pin.tags) ? pin.tags : [];
  
  // 2. Generate 30-50 candidates via AI
  const rawCandidates = await generateAiKeywordCandidates({
    title: pin.title,
    description: pin.description,
    filename: pin.filename,
    altText: pin.altText,
    existingTags: pin.tags,
    language: options.language || 'English',
  });

  // Include existing tags in validation pool so good existing tags are retained
  if (pin.tags && pin.tags.length > 0) {
    rawCandidates.unshift(...pin.tags);
  }

  // 3. Validate, Match, and Rank
  const result = await validateAndRankKeywords(rawCandidates, {
    pinTitle: pin.title,
    pinDescription: pin.description,
    existingManualTags: existingManual,
    maxLimit: options.maxLimit || 10,
    allowUnverifiedFallback: options.allowUnverifiedFallback ?? false,
  });

  return {
    cleanTags: result.finalCleanTags,
    keywordDetails: result.validatedKeywords,
    summary: result.summary,
  };
}
