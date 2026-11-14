import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      if ((crc ^ byte) & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
      byte >>>= 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * Generate a PNG icon with solid full-bleed background for maskable/Apple touch
 * or rounded appearance for standard web icons.
 */
function generateIconPng(size, fullBleed = true) {
  const width = size;
  const height = size;
  const rowLen = 1 + width * 4; // 1 filter byte + RGBA
  const rawData = Buffer.alloc(rowLen * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.40;
  const innerRadius = width * 0.24;

  // Colors:
  // Sage background: #5E7A68 (94, 122, 104)
  // Deep Sage accent: #465E50 (70, 94, 80)
  // Ivory / Canvas: #FAF8F5 (250, 248, 245)
  // Gold / Amber accent: #D4AF37 (212, 175, 55)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter byte 0 = None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 94, g = 122, b = 104, a = 255;

      if (!fullBleed) {
        const cornerRadius = size * 0.22;
        const qx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
        const qy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        if (cornerDist > cornerRadius) {
          a = 0;
        }
      }

      if (a > 0) {
        // Subtle decorative outer ring (classical Natya motif within safe 80% zone)
        if (Math.abs(dist - radius) < size * 0.018) {
          const angle = Math.atan2(dy, dx);
          if (Math.sin(angle * 16) > 0) {
            r = 250; g = 248; b = 245; // Ivory beads
          }
        }

        // Inner circle backdrop
        if (dist < radius * 0.85) {
          r = 78; g = 104; b = 88; // Slightly deeper sage contrast
        }

        // Natya Bell / Diya / Anjali Mudra Motif in center
        const bellY = cy + size * 0.04;
        const bellDist = Math.sqrt(dx * dx + (y - bellY) * (y - bellY));

        if (bellDist < innerRadius * 0.65) {
          r = 250; g = 248; b = 245; // Ivory
          if (bellDist < innerRadius * 0.22) {
            r = 70; g = 94; b = 80; // Inner clapper
          }
        } else if (y < bellY && Math.abs(dx) < (bellY - y) * 0.45 && y > cy - innerRadius) {
          r = 250; g = 248; b = 245; // Flame / Mudra pinnacle
        }

        // Gold decorative accent at base of flame
        if (Math.abs(y - bellY) < size * 0.02 && Math.abs(dx) < innerRadius * 0.5) {
          r = 212; g = 175; b = 55; // Gold
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Full-bleed solid icons (essential for Android Maskable and Apple Touch)
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192x192.png'), generateIconPng(192, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512x512.png'), generateIconPng(512, true));
fs.writeFileSync(path.resolve('public', 'apple-touch-icon.png'), generateIconPng(192, true));

// 2. Standard icons (full-bleed solid background prevents any Android/Chrome black corner bugs)
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), generateIconPng(192, true));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), generateIconPng(512, true));
fs.writeFileSync(path.resolve('public', 'favicon.ico'), generateIconPng(64, false));

console.log('High quality PWA icons generated successfully.');
