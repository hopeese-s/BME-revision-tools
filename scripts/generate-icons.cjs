const fs = require('fs');
const zlib = require('zlib');

function createPNG(size, color) {
  const b = Buffer.alloc(4);
  b.writeUInt8(color.r, 0);
  b.writeUInt8(color.g, 1);
  b.writeUInt8(color.b, 2);
  b.writeUInt8(255, 3);

  const raw = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const off = y * size * 4 + x * 4;

      if (dist < r - 2) {
        b.copy(raw, off);
      } else if (dist < r) {
        raw.writeUInt8(Math.floor(color.r * 0.6), off);
        raw.writeUInt8(Math.floor(color.g * 0.6), off + 1);
        raw.writeUInt8(Math.floor(color.b * 0.6), off + 2);
        raw.writeUInt8(255, off + 3);
      } else {
        // Background: dark
        raw.writeUInt8(13, off);
        raw.writeUInt8(17, off + 1);
        raw.writeUInt8(23, off + 2);
        raw.writeUInt8(255, off + 3);
      }
    }
  }

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8);
  ihdr.writeUInt32BE(size, 12);
  ihdr.writeUInt8(8, 16);  // bit depth
  ihdr.writeUInt8(6, 17);  // color type RGBA
  ihdr.writeUInt8(0, 18);  // compression
  ihdr.writeUInt8(0, 19);  // filter
  ihdr.writeUInt8(0, 20);  // interlace

  // CRC-32 for IHDR
  const ihdrCrc = crc32(ihdr.subarray(4, 21));
  // CRC-32 must be written as unsigned 32-bit BE (it's unsigned internally)
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Filter byte for each row
  const filteredRows = [];
  for (let y = 0; y < size; y++) {
    filteredRows.push(0); // filter none
    for (let x = 0; x < size; x++) {
      const off = y * size * 4 + x * 4;
      filteredRows.push(raw[off], raw[off + 1], raw[off + 2], raw[off + 3]);
    }
  }
  const filtered = Buffer.from(filteredRows);

  const deflated = zlib.deflateSync(filtered, { level: 9 });

  // IDAT
  const idatHdr = Buffer.alloc(8);
  idatHdr.writeUInt32BE(deflated.length, 0);
  idatHdr.write('IDAT', 4);

  const idatAll = Buffer.concat([Buffer.from('IDAT'), deflated]);
  const idatCrcB = Buffer.alloc(4);
  idatCrcB.writeUInt32BE(crc32(idatAll), 0);

  // IEND
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  return Buffer.concat([sig, ihdr, idatHdr, deflated, idatCrcB, iend]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = ((crc >>> 1) ^ 0xEDB88320) >>> 0;
      } else {
        crc = (crc >>> 1) >>> 0;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const gold = { r: 212, g: 168, b: 67 };
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', createPNG(192, gold));
fs.writeFileSync('public/icons/icon-512.png', createPNG(512, gold));
console.log('Icons created: icon-192.png, icon-512.png');