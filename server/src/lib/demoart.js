import zlib from 'node:zlib';

/* Generadores de imágenes y audio para el contenido de demostración (sin dependencias externas). */

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Imagen abstracta: degradado + manchas de luz suaves. */
export function artPng({ width, height, colors, seed = 1 }) {
  const rnd = seeded(seed);
  const [c0, c1, ...spots] = colors.map(hex);
  const blobs = spots.map((c) => ({ c, x: rnd() * width, y: rnd() * height, r: (0.25 + rnd() * 0.35) * Math.max(width, height) }));
  const angle = rnd() * Math.PI;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const t = Math.min(1, Math.max(0, ((x / width - 0.5) * dx + (y / height - 0.5) * dy) + 0.5));
      let r = c0[0] + (c1[0] - c0[0]) * t;
      let g = c0[1] + (c1[1] - c0[1]) * t;
      let b = c0[2] + (c1[2] - c0[2]) * t;
      for (const bl of blobs) {
        const d = Math.hypot(x - bl.x, y - bl.y) / bl.r;
        const w = Math.max(0, 1 - d * d) ** 2 * 0.85;
        r += (bl.c[0] - r) * w;
        g += (bl.c[1] - g) * w;
        b += (bl.c[2] - b) * w;
      }
      raw[o++] = Math.max(0, Math.min(255, r));
      raw[o++] = Math.max(0, Math.min(255, g));
      raw[o++] = Math.max(0, Math.min(255, b));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Pequeña melodía en WAV (mono, 16 bits) y su forma de onda resumida. */
export function melodyWav({ notes, beat = 0.32, rate = 22050 }) {
  const total = Math.ceil(notes.length * beat * rate + rate * 0.6);
  const samples = new Float32Array(total);
  notes.forEach((midi, i) => {
    if (midi == null) return;
    const f = 440 * 2 ** ((midi - 69) / 12);
    const start = Math.floor(i * beat * rate);
    const len = Math.floor(beat * 1.8 * rate);
    for (let k = 0; k < len && start + k < total; k++) {
      const t = k / rate;
      const env = Math.min(1, t * 60) * Math.exp(-t * 3.2);
      samples[start + k] += env * 0.32 * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
    }
  });
  const data = Buffer.alloc(total * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32000, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(data.length, 40);
  const bars = 40;
  const per = Math.floor(total / bars);
  const peaks = Array.from({ length: bars }, (_, i) => {
    let m = 0;
    for (let k = i * per; k < (i + 1) * per; k++) m = Math.max(m, Math.abs(samples[k]));
    return m;
  });
  const max = Math.max(...peaks) || 1;
  return { wav: Buffer.concat([header, data]), durationMs: Math.round((total / rate) * 1000), waveform: peaks.map((p) => 0.15 + 0.85 * (p / max)) };
}
