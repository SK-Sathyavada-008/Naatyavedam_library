import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSongsFuzzy } from '../src/services/fuzzySearch.ts';

const SAMPLE_SONGS = [
  {
    id: 's-1',
    title: 'Krishna Shabdam',
    originalFilename: 'krishna_gopika_shabdam.mp3',
    fileType: 'audio/mpeg',
    fileSize: 4000000,
    duration: 320,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isFavorite: false,
    isLocalAvailable: true,
    syncStatus: 'local_only',
    category: 'Shabdam',
    ragam: 'Ragamalika',
    talam: 'Misra Chapu',
    isDeleted: false,
  },
  {
    id: 's-2',
    title: 'Kalyani Jatiswaram',
    originalFilename: 'kalyani_jatiswaram_rupakam.mp3',
    fileType: 'audio/mpeg',
    fileSize: 5000000,
    duration: 280,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    isFavorite: true,
    isLocalAvailable: true,
    syncStatus: 'local_only',
    category: 'Jatiswaram',
    ragam: 'Kalyani',
    talam: 'Rupaka',
    isDeleted: false,
  },
  {
    id: 's-3',
    title: 'Sami Ninne Kori Varnam',
    originalFilename: 'shankarabharanam_varnam.mp3',
    fileType: 'audio/mpeg',
    fileSize: 8000000,
    duration: 650,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    isFavorite: false,
    isLocalAvailable: true,
    syncStatus: 'local_only',
    category: 'Varnam',
    ragam: 'Shankarabharanam',
    talam: 'Adi',
    isDeleted: false,
  },
];

test('Fuzzy Search - finds "Krishna Shabdam" with exact name "Krishna"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Krishna');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds "Krishna Shabdam" with typo "Krshna"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Krshna');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds "Krishna Shabdam" with partial name "Shabdam"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Shabdam');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds "Krishna Shabdam" with partial phrase "Krishna Shab"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Krishna Shab');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds "Krishna Shabdam" with short prefix "Shab"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Shab');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds "Krishna Shabdam" with inverted word order "Shabdam Krishna"', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'Shabdam Krishna');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-1');
});

test('Fuzzy Search - finds song by original filename', () => {
  const results = searchSongsFuzzy(SAMPLE_SONGS, 'shankarabharanam');
  assert.ok(results.length > 0);
  assert.equal(results[0].song.id, 's-3');
});

