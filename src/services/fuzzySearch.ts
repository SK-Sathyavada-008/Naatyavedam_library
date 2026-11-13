import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import type { Song } from '../types/index.ts';

export interface SearchResult {
  song: Song;
  matches?: FuseResult<Song>['matches'];
  score?: number;
}

const FUSE_OPTIONS: IFuseOptions<Song> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'originalFilename', weight: 0.25 },
    { name: 'category', weight: 0.15 },
    { name: 'ragam', weight: 0.1 },
    { name: 'talam', weight: 0.05 },
    { name: 'composer', weight: 0.05 },
  ],
  threshold: 0.38, // Tuned for good typo tolerance without false positives
  distance: 100,
  minMatchCharLength: 2,
  ignoreLocation: true,
  includeMatches: true,
  includeScore: true,
  shouldSort: true,
};

/**
 * Perform offline fuzzy search using Fuse.js.
 * Supports:
 * - Exact and partial names
 * - Typos and missing letters (e.g. "Krshna" -> "Krishna")
 * - Different word orders (e.g. "Shabdam Krishna" -> "Krishna Shabdam")
 * - Original phone filename as well as display title
 */
export function searchSongsFuzzy(songs: Song[], query: string): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return songs.map((song) => ({ song }));
  }

  const fuse = new Fuse(songs, FUSE_OPTIONS);

  // 1. Direct Fuse search
  const directResults = fuse.search(trimmed);
  if (directResults.length > 0) {
    return directResults.map((res) => ({
      song: res.item,
      matches: res.matches,
      score: res.score,
    }));
  }

  // 2. Multi-token search for varied word order (e.g. "Shabdam Krishna")
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 1) {
    const perWordResults = words.map((w) => fuse.search(w));

    // Candidates must match all tokens
    const firstWordMatches = perWordResults[0];
    const candidateMap = new Map<string, { song: Song; matches: FuseResult<Song>['matches'] }>();

    for (const r of firstWordMatches) {
      candidateMap.set(r.item.id, { song: r.item, matches: r.matches });
    }

    const matchedSongs: SearchResult[] = [];

    for (const [songId, data] of candidateMap.entries()) {
      const matchesAllWords = perWordResults.slice(1).every((wordRes) =>
        wordRes.some((r) => r.item.id === songId)
      );

      if (matchesAllWords) {
        matchedSongs.push({
          song: data.song,
          matches: data.matches,
          score: 0.25,
        });
      }
    }

    if (matchedSongs.length > 0) {
      return matchedSongs;
    }
  }

  return [];
}
