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

function generateIconPng(size) {
  const width = size;
  const height = size;
  const rowLen = 1 + width * 4; // 1 filter byte + RGBA
  const rawData = Buffer.alloc(rowLen * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;
  const innerRadius = width * 0.28;

  // Background color: Sage #5E7A68 -> 94, 122, 104, 255
  // Light color: Warm Ivory #FAF8F5 -> 250, 248, 245, 255
  // Deep Sage: #445D4D -> 68, 93, 77, 255

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter byte 0 = None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Squircle background corner calculation
      const cornerRadius = size * 0.22;
      const qx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
      const qy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);

      if (cornerDist > cornerRadius) {
        // Transparent outside rounded squircle
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      } else {
        // Base sage background
        let r = 94, g = 122, b = 104;

        // Classical ring motif
        if (Math.abs(dist - radius * 0.7) < size * 0.015) {
          // Dash pattern
          const angle = Math.atan2(dy, dx);
          if (Math.sin(angle * 14) > 0) {
            r = 235; g = 241; b = 237; // Ivory accent
          }
        }

        // Center Natya bell / flame icon
        const bellY = cy + size * 0.05;
        const bellDist = Math.sqrt(dx * dx + (y - bellY) * (y - bellY));
        if (bellDist < innerRadius * 0.6) {
          r = 250; g = 248; b = 245; // Ivory
          if (bellDist < innerRadius * 0.2) {
            r = 68; g = 93; b = 77; // Inner bell aperture
          }
        } else if (y < bellY && Math.abs(dx) < (bellY - y) * 0.4 && y > cy - innerRadius) {
          // Flame tip upwards
          r = 250; g = 248; b = 245;
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

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

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), generateIconPng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), generateIconPng(512));
fs.writeFileSync(path.resolve('public', 'apple-touch-icon.png'), generateIconPng(192));
fs.writeFileSync(path.resolve('public', 'favicon.ico'), generateIconPng(64));
console.log('PNG icons created successfully.');

