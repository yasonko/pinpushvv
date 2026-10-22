const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA (color type 6)
  ihdr.writeUInt8(0, 10); // Compression method
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace method
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0; // Filter: None
    const rowData = rgbaBuffer.subarray(y * width * 4, (y + 1) * width * 4);
    rowData.copy(scanlines, scanlineOffset + 1);
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Draw a high-contrast, modern Pinterest Assistant icon onto RGBA buffer
 */
function generateIconRGBA(size) {
  const buf = Buffer.alloc(size * size * 4, 0); // initial transparent black (0,0,0,0)

  const center = size / 2;
  const radius = size * 0.46; // circle radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Antialiased Circle Badge background
      if (dist <= radius + 0.6) {
        let alpha = 1;
        if (dist > radius - 0.6) {
          alpha = Math.max(0, Math.min(1, (radius + 0.6 - dist) / 1.2));
        }

        // Pinterest Red (#E60023 -> #CC001E gradient / rich red)
        const gradT = (y / size);
        const r = Math.round(230 - gradT * 20);
        const g = Math.round(0);
        const b = Math.round(35 - gradT * 15);

        // Check if inside Pinterest 'P' icon
        // Normalized coordinates in [-1, 1] relative to center
        const nx = (x + 0.5 - center) / (size * 0.42);
        const ny = (y + 0.5 - center) / (size * 0.42);

        // Pinterest "P" shape logic
        // 1. Stem: vertical stroke with smooth curve at bottom right
        // Stem center ~ nx = -0.15, width = 0.28, ny from -0.6 to +0.72
        const inStemX = nx >= -0.32 && nx <= 0.02;
        const inStemY = ny >= -0.62 && ny <= 0.72;
        let isP = false;

        if (inStemX && inStemY) {
          // Bottom taper/point of pin
          if (ny > 0.45) {
            const taper = (0.72 - ny) / 0.27; // 1 at 0.45, 0 at 0.72
            const midX = -0.15 - (ny - 0.45) * 0.2;
            const w = 0.16 * taper;
            if (nx >= midX - w && nx <= midX + w) {
              isP = true;
            }
          } else {
            isP = true;
          }
        }

        // 2. Loop of P: outer oval centered around (0.1, -0.18), inner hole
        const loopDx = (nx - 0.08) / 0.50;
        const loopDy = (ny + 0.16) / 0.44;
        const loopDist = loopDx * loopDx + loopDy * loopDy;

        if (loopDist <= 1.0 && nx >= -0.25) {
          // Inner hole of the P loop
          const holeDx = (nx - 0.06) / 0.22;
          const holeDy = (ny + 0.16) / 0.20;
          const holeDist = holeDx * holeDx + holeDy * holeDy;

          if (holeDist >= 1.0) {
            isP = true;
          }
        }

        // 3. Small Assistant Sparkle / Star at top-right (on 48 and 128 sizes)
        if (size >= 32) {
          const spDx = (nx - 0.62);
          const spDy = (ny + 0.52);
          const spDist = Math.abs(spDx) + Math.abs(spDy); // diamond / star
          if (spDist <= 0.28) {
            isP = true;
          }
        }

        if (isP) {
          // Crisp White foreground (#FFFFFF)
          buf[idx] = 255;
          buf[idx + 1] = 255;
          buf[idx + 2] = 255;
          buf[idx + 3] = Math.round(255 * alpha);
        } else {
          // Red Badge Background
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = Math.round(255 * alpha);
        }
      }
    }
  }

  return buf;
}

// Generate for 16, 48, 128
const sizes = [16, 48, 128];
const outputDirs = [
  path.join(__dirname, 'extension', 'icons'),
  path.join(__dirname, 'pinterest-extension', 'icons'),
  path.join(__dirname, 'public', 'icons')
];

outputDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const base64Icons = {};

sizes.forEach(size => {
  const rgba = generateIconRGBA(size);
  const png = encodeRGBAtoPNG(size, size, rgba);
  base64Icons[size] = png.toString('base64');

  outputDirs.forEach(dir => {
    const filename = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(filename, png);
    console.log(`Generated: ${filename} (${png.length} bytes)`);
  });
});

fs.writeFileSync(
  path.join(__dirname, 'src', 'services', 'extensionSource', 'iconsBase64.ts'),
  `// Pre-encoded icons for standalone JSZip packaging without disk I/O\nexport const iconBase64Map: Record<number, string> = ${JSON.stringify(base64Icons, null, 2)};\n`
);

console.log('Successfully generated all icon assets!');
