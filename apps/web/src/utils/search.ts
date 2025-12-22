/**
 * Shared search utilities for fuzzy matching, highlighting, and normalization
 */

/**
 * Normalizes text for consistent matching:
 * - Lowercases
 * - Removes accents/diacritics
 * - Trims whitespace
 * - Removes special characters that interfere with matching
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  
  return value
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Simple fuzzy scoring algorithm:
 * - Exact matches get highest score
 * - Substring matches get good score
 * - Token-based partial matches get medium score
 * - Edit distance penalty for typos
 * 
 * Returns a score from 0-100, higher is better
 */
export function fuzzyScore(text: string, query: string): number {
  if (!text || !query) return 0;
  
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  
  // Exact match
  if (normalizedText === normalizedQuery) return 100;
  
  // Starts with query
  if (normalizedText.startsWith(normalizedQuery)) return 90;
  
  // Contains query as substring
  if (normalizedText.includes(normalizedQuery)) return 80;
  
  // Token-based matching (split by spaces/numbers)
  const textTokens = normalizedText.split(/[\s\-_]+/);
  const queryTokens = normalizedQuery.split(/[\s\-_]+/);
  
  let tokenScore = 0;
  let matchedTokens = 0;
  
  for (const queryToken of queryTokens) {
    for (const textToken of textTokens) {
      if (textToken.startsWith(queryToken)) {
        tokenScore += 30;
        matchedTokens++;
        break;
      } else if (textToken.includes(queryToken)) {
        tokenScore += 20;
        matchedTokens++;
        break;
      }
    }
  }
  
  if (matchedTokens === queryTokens.length) {
    tokenScore = Math.min(70, tokenScore);
  } else if (matchedTokens > 0) {
    tokenScore = Math.min(50, tokenScore);
  }
  
  // Character-based similarity (simple Levenshtein-like)
  const similarity = calculateSimilarity(normalizedText, normalizedQuery);
  const similarityScore = similarity * 30;
  
  return Math.max(tokenScore, similarityScore);
}

/**
 * Calculate simple character similarity (0-1)
 * Uses longest common subsequence approach
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // Count matching characters in order
  let matches = 0;
  let str2Index = 0;
  
  for (let i = 0; i < str1.length && str2Index < str2.length; i++) {
    if (str1[i] === str2[str2Index]) {
      matches++;
      str2Index++;
    }
  }
  
  // Normalize by average length
  const avgLength = (str1.length + str2.length) / 2;
  return matches / Math.max(avgLength, 1);
}

/**
 * Highlight segment for rendering
 */
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Splits text into segments for highlighting
 * Returns an array of segments that can be rendered with mark tags
 */
export function highlightMatch(text: string | null | undefined, query: string): HighlightSegment[] {
  if (!text || !query) return [{ text: text || '', isMatch: false }];
  
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  
  if (!normalizedQuery || !normalizedText.includes(normalizedQuery)) {
    return [{ text, isMatch: false }];
  }
  
  // Find all matches (case-insensitive)
  const regex = new RegExp(`(${escapeRegex(normalizedQuery)})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map(part => ({
    text: part,
    isMatch: normalizeText(part) === normalizedQuery,
  }));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Simple phonetic key generator (Soundex-like)
 * Used as fallback when direct/fuzzy matches are poor
 */
export function getPhoneticKey(text: string | null | undefined): string {
  if (!text) return '';
  
  const normalized = normalizeText(text);
  if (normalized.length === 0) return '';
  
  // Keep first letter
  let key = normalized[0].toUpperCase();
  
  // Map similar-sounding consonants
  const map: Record<string, string> = {
    'b': '1', 'f': '1', 'p': '1', 'v': '1',
    'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
    'd': '3', 't': '3',
    'l': '4',
    'm': '5', 'n': '5',
    'r': '6'
  };
  
  let lastCode = '';
  for (let i = 1; i < normalized.length && key.length < 4; i++) {
    const char = normalized[i];
    const code = map[char] || '';
    
    // Skip duplicates and vowels (except first letter)
    if (code && code !== lastCode) {
      key += code;
      lastCode = code;
    }
  }
  
  // Pad to 4 characters
  while (key.length < 4) {
    key += '0';
  }
  
  return key.substring(0, 4);
}

/**
 * Search result item with score for sorting
 */
export interface ScoredResult<T> {
  item: T;
  score: number;
  matchedFields: string[];
}

/**
 * Score and sort search results
 */
export function scoreAndSort<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string[]
): ScoredResult<T>[] {
  if (!query.trim()) return [];
  
  const scored: ScoredResult<T>[] = items.map(item => {
    const searchableTexts = getSearchableText(item);
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const text of searchableTexts) {
      const score = fuzzyScore(text, query);
      if (score > maxScore) {
        maxScore = score;
      }
      if (score > 20) {
        matchedFields.push(text);
      }
    }
    
    return { item, score: maxScore, matchedFields };
  });
  
  // Filter out very low scores and sort by score descending
  return scored
    .filter(result => result.score > 10) // Minimum threshold
    .sort((a, b) => b.score - a.score);
}

