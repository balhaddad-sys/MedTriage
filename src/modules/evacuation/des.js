// DES / 3DES crypto wrapper for ICAO BAC authentication
//
// Uses the well-tested `des.js` npm package for core DES operations,
// with our own CBC mode and ISO 9797-1 retail MAC on top.
//
// The `des.js` package is a pure-JS DES implementation that works in
// both Node.js and browser environments (bundled by Vite).

import DES from 'des.js';

// ====== SINGLE-BLOCK OPERATIONS ======

// Run a cipher, concatenating update() and final() results
function cipherRun(cipher, data) {
  const u = cipher.update(Array.from(data));
  const f = cipher.final();
  return new Uint8Array([...u, ...f]);
}

// Build 24-byte key from 16-byte key (K1+K2+K1 for EDE2)
function makeKey24(key16) {
  const key24 = new Uint8Array(24);
  key24.set(key16.slice(0, 8), 0);
  key24.set(key16.slice(8, 16), 8);
  key24.set(key16.slice(0, 8), 16);
  return key24;
}

// Single DES encrypt an 8-byte block
export function desEncrypt(key, block) {
  const c = DES.DES.create({ type: 'encrypt', key: Array.from(key) });
  return new Uint8Array(c.update(Array.from(block)));
}

// Single DES decrypt an 8-byte block
export function desDecrypt(key, block) {
  // des.js buffers the last block during decrypt (for padding); use final() to flush
  const c = DES.DES.create({ type: 'decrypt', key: Array.from(key), padding: false });
  const u = c.update(Array.from(block));
  const f = c.final();
  return new Uint8Array([...u, ...f]);
}

// 3DES-EDE2 encrypt (K1, K2, K1): key is 16 bytes
export function des3Encrypt(key16, block) {
  const c = DES.EDE.create({ type: 'encrypt', key: Array.from(makeKey24(key16)) });
  return new Uint8Array(c.update(Array.from(block)));
}

// 3DES-EDE2 decrypt
export function des3Decrypt(key16, block) {
  const c = DES.EDE.create({ type: 'decrypt', key: Array.from(makeKey24(key16)), padding: false });
  const u = c.update(Array.from(block));
  const f = c.final();
  return new Uint8Array([...u, ...f]);
}

// ====== CBC MODE ======

function xorBytes(a, b) {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = a[i] ^ b[i];
  return out;
}

// 3DES-CBC encrypt (key=16 bytes, data=multiple of 8, iv=8 bytes)
export function des3CbcEncrypt(key16, data, iv) {
  const blocks = data.length / 8;
  const result = new Uint8Array(data.length);
  let prev = iv ? new Uint8Array(iv) : new Uint8Array(8);

  for (let i = 0; i < blocks; i++) {
    const block = data.slice(i * 8, (i + 1) * 8);
    const xored = xorBytes(block, prev);
    const enc = des3Encrypt(key16, xored);
    result.set(enc, i * 8);
    prev = enc;
  }
  return result;
}

// 3DES-CBC decrypt
export function des3CbcDecrypt(key16, data, iv) {
  const blocks = data.length / 8;
  const result = new Uint8Array(data.length);
  let prev = iv ? new Uint8Array(iv) : new Uint8Array(8);

  for (let i = 0; i < blocks; i++) {
    const block = data.slice(i * 8, (i + 1) * 8);
    const dec = des3Decrypt(key16, block);
    const plain = xorBytes(dec, prev);
    result.set(plain, i * 8);
    prev = block;
  }
  return result;
}

// ====== ISO 9797-1 MAC ======

// ISO 9797-1 padding method 2: append 0x80 then zeros to fill 8-byte block
export function padISO9797(data) {
  const padLen = 8 - ((data.length + 1) % 8);
  const padded = new Uint8Array(data.length + 1 + (padLen === 8 ? 0 : padLen));
  padded.set(data);
  padded[data.length] = 0x80;
  return padded;
}

// Remove ISO 9797-1 padding
export function unpadISO9797(data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] === 0x80) return data.slice(0, i);
    if (data[i] !== 0x00) return data; // No valid padding
  }
  return data;
}

// ISO 9797-1 MAC Algorithm 3 (Retail MAC) with 3DES
export function retailMac(key16, data) {
  const k1 = key16.slice(0, 8);

  // Pad data
  const padded = padISO9797(data);
  const blocks = padded.length / 8;

  // Process all blocks with single DES using K1
  let mac = new Uint8Array(8);
  for (let i = 0; i < blocks; i++) {
    const block = padded.slice(i * 8, (i + 1) * 8);
    const xored = xorBytes(mac, block);
    mac = desEncrypt(k1, xored);
  }

  // Final block: decrypt with K2, then encrypt with K1 (= 3DES on the last result)
  mac = des3Encrypt(key16, mac);
  return mac;
}

// ====== KEY UTILITIES ======

// Adjust DES key parity bits (each byte's LSB is odd parity)
export function adjustParity(key) {
  const adjusted = new Uint8Array(key.length);
  for (let i = 0; i < key.length; i++) {
    let b = key[i] & 0xFE;
    let bits = 0;
    let v = b;
    while (v) { bits += v & 1; v >>= 1; }
    adjusted[i] = bits % 2 === 0 ? b | 1 : b;
  }
  return adjusted;
}
