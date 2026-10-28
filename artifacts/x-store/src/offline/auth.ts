const PIN_PATTERN = /^\d{6,12}$/;
const DEFAULT_ITERATIONS = 210_000;

export interface LocalPinCredential {
  pinSalt: string;
  pinHash: string;
  pinIterations: number;
}

export function isValidLocalPin(pin: string) {
  return PIN_PATTERN.test(pin);
}

export async function createLocalPinCredential(pin: string): Promise<LocalPinCredential> {
  if (!isValidLocalPin(pin)) throw new Error("رمز الدخول يجب أن يتكون من 6 إلى 12 رقمًا.");
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("ميزة حماية رمز الدخول غير متاحة في هذا النظام.");

  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await cryptoApi.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: DEFAULT_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return {
    pinSalt: bytesToHex(salt),
    pinHash: bytesToHex(new Uint8Array(hash)),
    pinIterations: DEFAULT_ITERATIONS,
  };
}

export async function verifyLocalPin(pin: string, credential: LocalPinCredential): Promise<boolean> {
  if (!PIN_PATTERN.test(pin) || !/^[a-f0-9]{32}$/i.test(credential.pinSalt) ||
    !/^[a-f0-9]{64}$/i.test(credential.pinHash) || !Number.isInteger(credential.pinIterations) ||
    credential.pinIterations < 100_000 || credential.pinIterations > 1_000_000) return false;

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("ميزة حماية رمز الدخول غير متاحة في هذا النظام.");
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = hexToBytes(credential.pinSalt);
  const hash = new Uint8Array(await cryptoApi.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: credential.pinIterations, hash: "SHA-256" },
    key,
    256,
  ));
  const expected = hexToBytes(credential.pinHash);
  let difference = hash.length ^ expected.length;
  for (let index = 0; index < Math.min(hash.length, expected.length); index += 1) {
    difference |= hash[index] ^ expected[index];
  }
  return difference === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  return new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}
