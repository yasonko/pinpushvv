/**
 * Tags Utility & Sanitizer for Pinterest SEO Keywords
 * Consistently converts tags (arrays, JSON strings, dirty inputs) into
 * clean, comma-separated natural keyword phrases (no #, no dashes, no JSON artifacts).
 */

/**
 * Clean a single raw tag string into a natural keyword phrase:
 * 1. Remove '#' symbols
 * 2. Convert hyphens and underscores between words to natural spaces (e.g. "matcha-guide" -> "matcha guide")
 * 3. Remove quotes, brackets, braces, commas, slashes, colons, markdown artifacts
 * 4. Normalize multiple spaces to a single space
 * 5. Trim whitespace and lowercase
 */
export function sanitizeTag(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') return '';

  let cleaned = rawTag
    // Remove hashtags, JSON brackets, quotes, braces, slashes, commas, colons, markdown
    .replace(/[#"'`\[\]{}()\\\/,;:*~_]+/g, ' ')
    // Convert hyphens to spaces so "green-tea-recipe" becomes "green tea recipe"
    .replace(/-/g, ' ')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return cleaned;
}

/**
 * Sanitize an array or flexible input of raw tags:
 * - Handles string arrays, comma-delimited strings, or JSON strings
 * - Cleans each tag into a natural keyword phrase
 * - Removes empty tags
 * - Removes duplicates (case-insensitive)
 */
export function sanitizeTagList(rawTags: (string | null | undefined)[] | string): string[] {
  if (!rawTags) return [];

  let inputs: (string | null | undefined)[] = [];

  if (typeof rawTags === 'string') {
    const trimmed = rawTags.trim();
    // Check if it's a JSON array string e.g. '["tag1", "tag2"]'
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          inputs = parsed;
        } else {
          inputs = [trimmed];
        }
      } catch {
        inputs = trimmed.split(',');
      }
    } else {
      inputs = trimmed.split(',');
    }
  } else if (Array.isArray(rawTags)) {
    inputs = rawTags;
  }

  const seen = new Set<string>();
  const cleanedList: string[] = [];

  for (const raw of inputs) {
    if (!raw) continue;
    // In case individual item contains comma-separated keywords or JSON fragments
    const strVal = String(raw);
    const parts = strVal.split(/[,]+/);
    for (const part of parts) {
      const clean = sanitizeTag(part);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        cleanedList.push(clean);
      }
    }
  }

  return cleanedList;
}

/**
 * Main utility function required for Pinterest keyword formatting:
 * Converts tag array (or dirty tag inputs) into a clean, comma-separated string of natural keywords.
 * e.g., ["matcha-guide", "#how-to-make-matcha", "green-tea-recipe"] 
 *   --> "matcha guide, how to make matcha, green tea recipe"
 */
export function formatTagsForPinterest(tags: (string | null | undefined)[] | string): string {
  const cleaned = sanitizeTagList(tags);
  if (cleaned.length === 0) return '';
  return cleaned.join(', ');
}

/**
 * Format tag list with each tag on a separate new line for "Copy All":
 * e.g.,
 * matcha guide
 * how to make matcha
 * matcha whisking
 */
export function formatTagsAsLines(tags: (string | null | undefined)[] | string): string {
  const cleaned = sanitizeTagList(tags);
  if (cleaned.length === 0) return '';
  return cleaned.join('\n');
}

/**
 * Alias for backward compatibility across components
 */
export const formatTagsAsKeywords = formatTagsForPinterest;
export const formatTagsAsHashtags = formatTagsForPinterest;

/**
 * Keep Pinterest Description separate without injecting tags into it automatically
 */
export function formatPinterestDescription(description?: string, tags?: string[]): string {
  return (description || '').trim();
}
