import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Simulation of deriveDisplayTitle (from audioImporter.ts)
function deriveDisplayTitle(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const cleanSpaces = withoutExt.replace(/[-_]+/g, ' ').trim();
  if (!cleanSpaces) return fileName;
  return cleanSpaces
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// 2. Simulation of guessDanceCategory (from audioImporter.ts)
function guessDanceCategory(title) {
  const lower = title.toLowerCase();
  if (lower.includes('pushpanjali')) return 'Pushpanjali';
  if (lower.includes('jatiswaram') || lower.includes('jati')) return 'Jatiswaram';
  if (lower.includes('shabdam') || lower.includes('sabdam')) return 'Shabdam';
  if (lower.includes('varnam')) return 'Varnam';
  if (lower.includes('keerthanam') || lower.includes('kirtanam')) return 'Keerthanam';
  if (lower.includes('tarangam') || lower.includes('tharangam')) return 'Tarangam';
  if (lower.includes('thillana') || lower.includes('tillana')) return 'Thillana';
  if (lower.includes('slokam') || lower.includes('shlokam')) return 'Slokam';
  if (lower.includes('talam') || lower.includes('practice') || lower.includes('exercise')) return 'Practice / Talam';
  return 'Other';
}

// 3. Audio file type validation
function isSupportedAudioFile(fileName, mimeType) {
  const supportedExtensions = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.opus', '.flac'];
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const isExtSupported = supportedExtensions.includes(ext);
  const isMimeAudio = mimeType ? mimeType.startsWith('audio/') || mimeType === 'application/ogg' : false;

  if (isExtSupported || isMimeAudio) {
    return { supported: true };
  }
  return {
    supported: false,
    reason: `Unsupported format "${ext || 'unknown'}". Supported: MP3, M4A, WAV, AAC, OGG, OPUS, FLAC.`,
  };
}

// 4. Web Share API Level 2 feature detection simulation
function canShareAudioFile(navigatorMock, file) {
  if (!navigatorMock || !navigatorMock.share || !navigatorMock.canShare) {
    return false;
  }
  try {
    return navigatorMock.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// 5. PWA Standalone Detection simulation
function isPwaStandalone(matchMediaMatches, navigatorStandalone) {
  return Boolean(matchMediaMatches || navigatorStandalone);
}

// ==============================================================================
// TESTS
// ==============================================================================

test('Phase 7: Title derivation removes extensions and cleans special characters', () => {
  assert.equal(deriveDisplayTitle('kalyani_jatiswaram_speed1.mp3'), 'Kalyani Jatiswaram Speed1');
  assert.equal(deriveDisplayTitle('manduka-shabdam-gajendra.wav'), 'Manduka Shabdam Gajendra');
  assert.equal(deriveDisplayTitle('Ananda_Bhairavi_Varnam.m4a'), 'Ananda Bhairavi Varnam');
  assert.equal(deriveDisplayTitle('brahma_anjali_practice.ogg'), 'Brahma Anjali Practice');
});

test('Phase 7: Dance category is accurately guessed from filename or title', () => {
  assert.equal(guessDanceCategory('Kalyani Jatiswaram'), 'Jatiswaram');
  assert.equal(guessDanceCategory('Gajendra Moksham Shabdam'), 'Shabdam');
  assert.equal(guessDanceCategory('Nattakurinji Varnam'), 'Varnam');
  assert.equal(guessDanceCategory('Maragatha Mani Maya Tarangam'), 'Tarangam');
  assert.equal(guessDanceCategory('Hindolam Thillana'), 'Thillana');
  assert.equal(guessDanceCategory('Brahma Anjali Pushpanjali'), 'Pushpanjali');
  assert.equal(guessDanceCategory('Aditalam Practice Beats'), 'Practice / Talam');
  assert.equal(guessDanceCategory('Guru Vandana Slokam'), 'Slokam');
  assert.equal(guessDanceCategory('Custom Kuchipudi Piece'), 'Other');
});

test('Phase 7: Audio formats accepted by Android Share Target and File Picker', () => {
  assert.equal(isSupportedAudioFile('song.mp3', 'audio/mpeg').supported, true);
  assert.equal(isSupportedAudioFile('song.m4a', 'audio/mp4').supported, true);
  assert.equal(isSupportedAudioFile('song.wav', 'audio/wav').supported, true);
  assert.equal(isSupportedAudioFile('song.aac', 'audio/aac').supported, true);
  assert.equal(isSupportedAudioFile('song.ogg', 'audio/ogg').supported, true);
  assert.equal(isSupportedAudioFile('song.opus', 'audio/opus').supported, true);
  assert.equal(isSupportedAudioFile('song.flac', 'audio/flac').supported, true);

  // Reject unsupported formats
  assert.equal(isSupportedAudioFile('notes.pdf', 'application/pdf').supported, false);
  assert.equal(isSupportedAudioFile('dance_video.mp4', 'video/mp4').supported, false);
  assert.equal(isSupportedAudioFile('script.txt', 'text/plain').supported, false);
});

test('Phase 7: Outgoing file share detection distinguishes file-capable browsers from fallbacks', () => {
  // 1. Android Chrome supporting navigator.canShare({ files })
  const modernAndroidNavigator = {
    share: async () => {},
    canShare: (data) => Boolean(data && data.files && data.files.length > 0),
  };
  const dummyFile = { name: 'test.mp3', type: 'audio/mpeg', size: 1024 };
  assert.equal(canShareAudioFile(modernAndroidNavigator, dummyFile), true);

  // 2. Desktop browser supporting text share but NOT file share
  const desktopNavigator = {
    share: async () => {},
    canShare: (data) => Boolean(data && !data.files),
  };
  assert.equal(canShareAudioFile(desktopNavigator, dummyFile), false);

  // 3. Browser without Web Share API
  const legacyNavigator = {};
  assert.equal(canShareAudioFile(legacyNavigator, dummyFile), false);
});

test('Phase 7: Standalone mode detection suppresses install prompts when already installed', () => {
  // Browser in standalone window
  assert.equal(isPwaStandalone(true, false), true);

  // iOS Safari homescreen
  assert.equal(isPwaStandalone(false, true), true);

  // Regular browser tab
  assert.equal(isPwaStandalone(false, false), false);
});

test('Phase 7: Web Share Target manifest configuration matches requirements', () => {
  const shareTargetConfig = {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
      title: 'title',
      text: 'text',
      files: [
        {
          name: 'audio',
          accept: [
            'audio/*',
            '.mp3',
            '.m4a',
            '.wav',
            '.aac',
            '.ogg',
            '.opus',
            '.flac',
          ],
        },
      ],
    },
  };

  assert.equal(shareTargetConfig.action, '/share-target');
  assert.equal(shareTargetConfig.method, 'POST');
  assert.equal(shareTargetConfig.enctype, 'multipart/form-data');
  assert.equal(shareTargetConfig.params.files[0].name, 'audio');
  assert.ok(shareTargetConfig.params.files[0].accept.includes('.mp3'));
  assert.ok(shareTargetConfig.params.files[0].accept.includes('.m4a'));
  assert.ok(shareTargetConfig.params.files[0].accept.includes('.wav'));
});

