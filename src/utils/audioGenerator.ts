/**
 * Synthesizes a valid, playable WAV Audio Blob with classical Indian melodic tones.
 * Used for testing actual audio playback without needing external network downloads.
 */

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates a playable WAV audio blob with a specified duration and melodic frequency progression.
 * (e.g. classical Tanpura drone: Sa-Pa-Sa'-Madhya Sa)
 */
export function generateClassicalMelodyWav(
  durationSeconds = 12,
  droneFrequencies = [220, 329.63, 440] // Sa (A3), Pa (E4), Sa' (A4)
): Blob {
  const sampleRate = 22050; // Compact sample rate for small footprint
  const numChannels = 1;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // 1. RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // 2. fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // 3. data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio data: Harmonic classical chime/drone with gentle fade-in and fade-out
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Harmonic drone wave
    let sample = 0;
    droneFrequencies.forEach((freq, idx) => {
      // Gentle rhythmic pulsing
      const pulse = 0.8 + 0.2 * Math.sin(2 * Math.PI * 1.5 * t + idx);
      sample += Math.sin(2 * Math.PI * freq * t) * pulse * (0.28 / (idx + 1));
    });

    // Add rhythmic Talam bell chime every 2 seconds
    const beatPeriod = t % 2.0;
    if (beatPeriod < 0.3) {
      const bellFreq = 880; // High Ghungroo bell pitch
      const decay = Math.exp(-beatPeriod * 14);
      sample += Math.sin(2 * Math.PI * bellFreq * beatPeriod) * decay * 0.35;
    }

    // Envelope: 0.5s fade in, 1s fade out at end
    let envelope = 1;
    if (t < 0.5) envelope = t / 0.5;
    if (t > durationSeconds - 1) envelope = (durationSeconds - t) / 1.0;

    sample = Math.max(-1, Math.min(1, sample * envelope));
    // Convert float to 16-bit signed PCM
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
