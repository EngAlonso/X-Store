import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "xstore_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_PASSWORD_HASH =
  "scrypt$v1$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  Buffer.alloc(PASSWORD_KEY_LENGTH).toString("base64");

export type LocalSession = {
  userId: string;
  sessionVersion: number;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured.");
  return secret;
}

export function normalizePhone(value: string): string {
  const ascii = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x660 && code <= 0x669 ? code - 0x660 : code - 0x6f0);
  });
  let phone = ascii.replace(/[()\s.-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!/^\+?\d{8,15}$/.test(phone)) {
    throw new Error("Enter a valid phone number with 8 to 15 digits.");
  }
  return phone;
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return [
    "scrypt",
    "v1",
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string | null | undefined,
): Promise<boolean> {
  const encoded = encodedHash ?? DUMMY_PASSWORD_HASH;
  const [algorithm, version, n, r, p, saltValue, keyValue] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    version !== "v1" ||
    n !== String(SCRYPT_OPTIONS.N) ||
    r !== String(SCRYPT_OPTIONS.r) ||
    p !== String(SCRYPT_OPTIONS.p) ||
    !saltValue ||
    !keyValue
  ) {
    await derivePasswordKey(password, Buffer.alloc(16));
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64");
    const expected = Buffer.from(keyValue, "base64");
    const actual = await derivePasswordKey(password, salt);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

export function createSessionToken(
  userId: string,
  sessionVersion: number,
): string {
  const payload: LocalSession = {
    userId,
    sessionVersion,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function readSessionToken(req: Request): LocalSession | null {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const value = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!value) return null;

  try {
    const [encoded, suppliedSignature, extra] = decodeURIComponent(value).split(".");
    if (!encoded || !suppliedSignature || extra) return null;
    const expectedSignature = createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest();
    const actualSignature = Buffer.from(suppliedSignature, "base64url");
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<LocalSession>;
    if (
      typeof payload.userId !== "string" ||
      !Number.isInteger(payload.sessionVersion) ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as LocalSession;
  } catch {
    return null;
  }
}

function cookieAttributes(): string {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

export function setSessionCookie(res: Response, token: string): void {
  res.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes()}; Max-Age=${SESSION_SECONDS}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; ${cookieAttributes()}; Max-Age=0`,
  );
}

export function getDummyPasswordHash(): string {
  return DUMMY_PASSWORD_HASH;
}
