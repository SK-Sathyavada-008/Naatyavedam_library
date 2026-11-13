import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupportedAudioFile,
  deriveDisplayTitle,
  guessDanceCategory,
} from '../src/services/audioImporter.ts';
import { generateClassicalMelodyWav } from '../src/utils/audioGenerator.ts';

test('Audio Importer - validates supported extensions and mime types', () => {
  // Mock File objects
  const validMp3 = { name: 'kalyani_jatiswaram.mp3', size: 1024, type: 'audio/mpeg' };
  const validM4a = { name: 'thillana.m4a', size: 2048, type: 'audio/mp4' };
  const validWav = { name: 'shabdam.wav', size: 4096, type: 'audio/wav' };
  const validAac = { name: 'varnam.aac', size: 3000, type: 'audio/aac' };
  const validOgg = { name: 'slokam.ogg', size: 1500, type: 'audio/ogg' };

  assert.equal(isSupportedAudioFile(validMp3).supported, true);
  assert.equal(isSupportedAudioFile(validM4a).supported, true);
  assert.equal(isSupportedAudioFile(validWav).supported, true);
  assert.equal(isSupportedAudioFile(validAac).supported, true);
  assert.equal(isSupportedAudioFile(validOgg).supported, true);

  // Invalid formats
  const invalidPdf = { name: 'dance_notes.pdf', size: 5000, type: 'application/pdf' };
  const invalidEmpty = { name: 'empty.mp3', size: 0, type: 'audio/mpeg' };

  assert.equal(isSupportedAudioFile(invalidPdf).supported, false);
  assert.equal(isSupportedAudioFile(invalidEmpty).supported, false);
});

test('Audio Importer - derives clean display title from filename', () => {
  assert.equal(deriveDisplayTitle('kalyani_jatiswaram_rupakam.mp3'), 'Kalyani Jatiswaram Rupakam');
  assert.equal(deriveDisplayTitle('manduka-shabdam-fast.m4a'), 'Manduka Shabdam Fast');
  assert.equal(deriveDisplayTitle('Sami_Ninne_Kori_Varnam.wav'), 'Sami Ninne Kori Varnam');
});

test('Audio Importer - guesses Kuchipudi dance categories', () => {
  assert.equal(guessDanceCategory('Kalyani Jatiswaram'), 'Jatiswaram');
  assert.equal(guessDanceCategory('Manduka Shabdam'), 'Shabdam');
  assert.equal(guessDanceCategory('Sami Ninne Kori Varnam'), 'Varnam');
  assert.equal(guessDanceCategory('Marakatha Mani Maya Tarangam'), 'Tarangam');
  assert.equal(guessDanceCategory('Dhanashree Thillana'), 'Thillana');
  assert.equal(guessDanceCategory('Gambhira Nattai Pushpanjali'), 'Pushpanjali');
  assert.equal(guessDanceCategory('Angikam Bhuvanam Slokam'), 'Slokam');
  assert.equal(guessDanceCategory('Adi Talam Korvai 1'), 'Practice / Talam');
});

test('Audio Generator - creates valid playable WAV Blob with RIFF header', async () => {
  const wavBlob = generateClassicalMelodyWav(2);
  assert.equal(wavBlob.type, 'audio/wav');
  assert.ok(wavBlob.size > 44);

  const arrayBuffer = await wavBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // RIFF header
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  assert.equal(riff, 'RIFF');
  // WAVE format
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  assert.equal(wave, 'WAVE');
});
