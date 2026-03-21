// Pure JavaScript DES / 3DES implementation for ICAO BAC authentication
//
// Implements:
// - DES block cipher (encrypt / decrypt 8-byte blocks)
// - 3DES-EDE2 (two-key Triple DES: K1-K2-K1)
// - CBC mode encryption / decryption
// - Retail MAC (ISO 9797-1 Algorithm 3)
// - DES key parity bit adjustment
//
// Reference: FIPS 46-3, ISO 9797-1

// ====== DES STANDARD TABLES ======

// Initial Permutation
const IP = [
  58,50,42,34,26,18,10,2, 60,52,44,36,28,20,12,4,
  62,54,46,38,30,22,14,6, 64,56,48,40,32,24,16,8,
  57,49,41,33,25,17, 9,1, 59,51,43,35,27,19,11,3,
  61,53,45,37,29,21,13,5, 63,55,47,39,31,23,15,7,
];

// Final Permutation (IP^-1)
const FP = [
  40,8,48,16,56,24,64,32, 39,7,47,15,55,23,63,31,
  38,6,46,14,54,22,62,30, 37,5,45,13,53,21,61,29,
  36,4,44,12,52,20,60,28, 35,3,43,11,51,19,59,27,
  34,2,42,10,50,18,58,26, 33,1,41, 9,49,17,57,25,
];

// Expansion permutation
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
   8, 9,10,11,12,13,12,13,14,15,16,17,
  16,17,18,19,20,21,20,21,22,23,24,25,
  24,25,26,27,28,29,28,29,30,31,32, 1,
];

// P-box permutation
const P = [
  16, 7,20,21,29,12,28,17, 1,15,23,26, 5,18,31,10,
   2, 8,24,14,32,27, 3, 9,19,13,30, 6,22,11, 4,25,
];

// S-boxes
const S = [
  [
    14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,
    0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,
    4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,
    15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13,
  ],[
    15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,
    3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,
    0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,
    13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9,
  ],[
    10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,
    13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,
    13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,
    1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12,
  ],[
    7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,
    13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,
    10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,
    3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14,
  ],[
    2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,
    14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,
    4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,
    11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3,
  ],[
    12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,
    10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,
    9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,
    4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13,
  ],[
    4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,
    13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,
    1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,
    6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12,
  ],[
    13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,
    1,15,13,8,10,3,7,4,12,5,6,2,0,14,9,11,
    7,0,1,3,13,4,9,10,14,8,2,11,6,5,12,15,
    2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11,
  ],
];

// Permuted Choice 1
const PC1 = [
  57,49,41,33,25,17, 9, 1,58,50,42,34,26,18,
  10, 2,59,51,43,35,27,19,11, 3,60,52,44,36,
  63,55,47,39,31,23,15, 7,62,54,46,38,30,22,
  14, 6,61,53,45,37,29,21,13, 5,28,20,12, 4,
];

// Permuted Choice 2
const PC2 = [
  14,17,11,24, 1, 5, 3,28,15, 6,21,10,
  23,19,12, 4,26, 8,16, 7,27,20,13, 2,
  41,52,31,37,47,55,30,40,51,45,33,48,
  44,49,39,56,34,53,46,42,50,36,29,32,
];

// Left rotations per round
const ROTATIONS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];

// ====== BIT MANIPULATION HELPERS ======

function getBit(data, bitPos) {
  const byteIdx = (bitPos - 1) >> 3;
  const bitIdx = 7 - ((bitPos - 1) & 7);
  return (data[byteIdx] >> bitIdx) & 1;
}

function permute(data, table) {
  const outBits = table.length;
  const out = new Uint8Array(Math.ceil(outBits / 8));
  for (let i = 0; i < outBits; i++) {
    if (getBit(data, table[i])) {
      out[i >> 3] |= 1 << (7 - (i & 7));
    }
  }
  return out;
}

function xorBytes(a, b, len) {
  const out = new Uint8Array(len || Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i++) {
    out[i] = a[i] ^ b[i];
  }
  return out;
}

function leftShift28(half, count) {
  // half is 4 bytes but only 28 bits matter (bits 0-27)
  let val = ((half[0] << 24) | (half[1] << 16) | (half[2] << 8) | half[3]) >>> 0;
  // Only top 28 bits of the 32-bit integer
  for (let i = 0; i < count; i++) {
    const msb = (val >> 27) & 1;
    val = ((val << 1) | msb) >>> 0;
  }
  val = (val & 0xFFFFFFF0) >>> 0; // Clear bottom 4 bits
  return new Uint8Array([(val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF]);
}

// ====== DES KEY SCHEDULE ======

function generateSubKeys(key) {
  // Apply PC-1 to get 56-bit key
  const pc1Key = permute(key, PC1); // 7 bytes = 56 bits

  // Split into C and D halves (28 bits each)
  let C = new Uint8Array(4);
  let D = new Uint8Array(4);
  // C = bits 0-27 of pc1Key, D = bits 28-55
  C[0] = pc1Key[0]; C[1] = pc1Key[1]; C[2] = pc1Key[2]; C[3] = pc1Key[3] & 0xF0;
  D[0] = ((pc1Key[3] & 0x0F) << 4) | ((pc1Key[4] >> 4) & 0x0F);
  D[1] = ((pc1Key[4] & 0x0F) << 4) | ((pc1Key[5] >> 4) & 0x0F);
  D[2] = ((pc1Key[5] & 0x0F) << 4) | ((pc1Key[6] >> 4) & 0x0F);
  D[3] = ((pc1Key[6] & 0x0F) << 4);

  const subKeys = [];
  for (let round = 0; round < 16; round++) {
    C = leftShift28(C, ROTATIONS[round]);
    D = leftShift28(D, ROTATIONS[round]);

    // Combine C and D into 56 bits, then apply PC-2 for 48-bit subkey
    const CD = new Uint8Array(7);
    CD[0] = C[0]; CD[1] = C[1]; CD[2] = C[2];
    CD[3] = (C[3] & 0xF0) | ((D[0] >> 4) & 0x0F);
    CD[4] = ((D[0] & 0x0F) << 4) | ((D[1] >> 4) & 0x0F);
    CD[5] = ((D[1] & 0x0F) << 4) | ((D[2] >> 4) & 0x0F);
    CD[6] = ((D[2] & 0x0F) << 4) | ((D[3] >> 4) & 0x0F);

    subKeys.push(permute(CD, PC2)); // 6 bytes = 48 bits
  }
  return subKeys;
}

// ====== DES FEISTEL FUNCTION ======

function feistel(halfBlock, subKey) {
  // Expand 32 bits to 48 bits
  const expanded = permute(halfBlock, E); // 6 bytes

  // XOR with subkey
  const xored = xorBytes(expanded, subKey, 6);

  // S-box substitution: 48 bits → 32 bits
  const sboxOut = new Uint8Array(4);
  for (let i = 0; i < 8; i++) {
    // Extract 6 bits for each S-box
    const bitOffset = i * 6;
    const byteIdx = bitOffset >> 3;
    const bitShift = bitOffset & 7;

    let sixBits;
    if (bitShift <= 2) {
      sixBits = (xored[byteIdx] >> (2 - bitShift)) & 0x3F;
    } else {
      sixBits = ((xored[byteIdx] << (bitShift - 2)) | (xored[byteIdx + 1] >> (10 - bitShift))) & 0x3F;
    }

    const row = ((sixBits >> 4) & 0x02) | (sixBits & 0x01);
    const col = (sixBits >> 1) & 0x0F;
    const val = S[i][row * 16 + col];

    // Pack 4-bit result
    if (i & 1) {
      sboxOut[i >> 1] |= val;
    } else {
      sboxOut[i >> 1] |= val << 4;
    }
  }

  // Apply P-box permutation
  return permute(sboxOut, P);
}

// ====== DES BLOCK CIPHER ======

function desBlock(block, subKeys, decrypt) {
  // Initial permutation
  const ip = permute(block, IP);

  // Split into L and R (32 bits each)
  let L = ip.slice(0, 4);
  let R = ip.slice(4, 8);

  // 16 Feistel rounds
  for (let i = 0; i < 16; i++) {
    const keyIdx = decrypt ? 15 - i : i;
    const f = feistel(R, subKeys[keyIdx]);
    const newR = xorBytes(L, f, 4);
    L = R;
    R = newR;
  }

  // Combine R || L (swapped) and apply final permutation
  const combined = new Uint8Array(8);
  combined.set(R, 0);
  combined.set(L, 4);
  return permute(combined, FP);
}

// ====== PUBLIC API ======

// Single DES encrypt a single 8-byte block
export function desEncrypt(key, block) {
  const subKeys = generateSubKeys(key);
  return desBlock(block, subKeys, false);
}

// Single DES decrypt a single 8-byte block
export function desDecrypt(key, block) {
  const subKeys = generateSubKeys(key);
  return desBlock(block, subKeys, true);
}

// 3DES-EDE2 encrypt (K1, K2, K1): key is 16 bytes (K1=first 8, K2=last 8)
export function des3Encrypt(key16, block) {
  const k1 = key16.slice(0, 8);
  const k2 = key16.slice(8, 16);
  const sk1 = generateSubKeys(k1);
  const sk2 = generateSubKeys(k2);
  let result = desBlock(block, sk1, false);  // E with K1
  result = desBlock(result, sk2, true);       // D with K2
  result = desBlock(result, sk1, false);      // E with K1
  return result;
}

// 3DES-EDE2 decrypt (K1, K2, K1)
export function des3Decrypt(key16, block) {
  const k1 = key16.slice(0, 8);
  const k2 = key16.slice(8, 16);
  const sk1 = generateSubKeys(k1);
  const sk2 = generateSubKeys(k2);
  let result = desBlock(block, sk1, true);   // D with K1
  result = desBlock(result, sk2, false);      // E with K2
  result = desBlock(result, sk1, true);       // D with K1
  return result;
}

// 3DES-CBC encrypt (key=16 bytes, data=multiple of 8, iv=8 bytes)
export function des3CbcEncrypt(key16, data, iv) {
  const blocks = data.length / 8;
  const result = new Uint8Array(data.length);
  let prev = iv ? new Uint8Array(iv) : new Uint8Array(8);

  for (let i = 0; i < blocks; i++) {
    const block = data.slice(i * 8, (i + 1) * 8);
    const xored = xorBytes(block, prev, 8);
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
    const plain = xorBytes(dec, prev, 8);
    result.set(plain, i * 8);
    prev = block;
  }
  return result;
}

// ISO 9797-1 MAC Algorithm 3 (Retail MAC) with 3DES
// Pads with 0x80 00 ... 00 (ISO 9797-1 padding method 2)
export function retailMac(key16, data) {
  const k1 = key16.slice(0, 8);
  const k2 = key16.slice(8, 16);
  const sk1 = generateSubKeys(k1);
  const sk2 = generateSubKeys(k2);

  // Pad data: append 0x80, then zeros to fill last 8-byte block
  const padded = padISO9797(data);
  const blocks = padded.length / 8;

  // Process all blocks with single DES using K1
  let mac = new Uint8Array(8); // IV = 0
  for (let i = 0; i < blocks; i++) {
    const block = padded.slice(i * 8, (i + 1) * 8);
    const xored = xorBytes(mac, block, 8);
    mac = desBlock(xored, sk1, false);
  }

  // Final block: decrypt with K2, then encrypt with K1
  mac = desBlock(mac, sk2, true);
  mac = desBlock(mac, sk1, false);

  return mac;
}

// ISO 9797-1 padding method 2: append 0x80 then zeros
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
    if (data[i] !== 0x00) return data; // No padding found
  }
  return data;
}

// Adjust DES key parity bits (each byte's LSB is parity)
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
