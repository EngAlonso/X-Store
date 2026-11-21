import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, xstorePlatformSettings } from "@workspace/db";
import { createXStorePlatformBackup } from "./xstore-platform-backup";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FOLDER_NAME = "X-Store Platform Backups";
const DRIVE_MIME = "application/json";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

function getClientId() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_ID;
  if (!value) throw new Error("GOOGLE_DRIVE_CLIENT_ID غير مضبوط على الخادم.");
  return value;
}
function getClientSecret() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!value) throw new Error("GOOGLE_DRIVE_CLIENT_SECRET غير مضبوط على الخادم.");
  return value;
}
function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured.");
  return createHash("sha256").update(secret).digest();
}
function getRedirectUri(origin?: string) {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI || (origin ? `${origin.replace(/\/$/, "")}/api/xstore/platform-backup/google/callback` : "");
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function decryptSecret(value: string): string {
  const raw = Buffer.from(value, "base64url");
  if (raw.length < 28) throw new Error("Google Drive token storage is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

function getSettings() {
  return db.select().from(xstorePlatformSettings).where(eq(xstorePlatformSettings.id, "global")).limit(1);
}
async function ensureSettings() {
  const [existing] = await getSettings();
  if (existing) return existing;
  const [created] = await db.insert(xstorePlatformSettings).values({ id: "global" }).returning();
  return created;
}

export function createGoogleOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(16).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyGoogleOAuthState(state: string, userId: string): boolean {
  try {
    const [payload, supplied] = state.split(".");
    if (!payload || !supplied) return false;
    const expected = createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest();
    const actual = Buffer.from(supplied, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {userId?:string;expiresAt?:number};
    return parsed.userId === userId && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch { return false; }
}

export function buildGoogleAuthorizationUrl(userId: string, origin?: string): string {
  const redirectUri = getRedirectUri(origin);
  if (!redirectUri) throw new Error("تعذر تحديد عنوان العودة من Google. اضبط GOOGLE_DRIVE_REDIRECT_URI.");
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: DRIVE_SCOPE,
    state: createGoogleOAuthState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code: string, origin?: string) {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getRedirectUri(origin),
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body,
  });
  const data = await response.json() as {access_token?:string;refresh_token?:string;error?:string;error_description?:string};
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "فشل الاتصال بحساب Google.");
  if (!data.refresh_token) throw new Error("Google لم يُرجع Refresh Token. أعد الموافقة على الوصول إلى Drive.");
  return data;
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body,
  });
  const data = await response.json() as {access_token?:string;refresh_token?:string;error?:string;error_description?:string};
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "انتهت صلاحية اتصال Google Drive.");
  return data;
}

async function driveRequest(accessToken: string, input: string | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive API ${response.status}: ${text.slice(0, 500)}`);
  }
  return response;
}

async function ensureDriveFolder(accessToken: string, existingFolderId?: string | null) {
  if (existingFolderId) {
    const response = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(existingFolderId)}?fields=id,name,mimeType,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const file = await response.json() as {id:string;name:string;mimeType:string;trashed:boolean};
      if (!file.trashed && file.mimeType === "application/vnd.google-apps.folder") return file.id;
    }
  }
  const response = await driveRequest(accessToken, DRIVE_FILES_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder"}),
  });
  const file = await response.json() as {id:string};
  return file.id;
}

async function uploadJson(accessToken: string, folderId: string, fileName: string, json: string) {
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: DRIVE_MIME,
  });
  const initResponse = await driveRequest(accessToken, `${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id,name,webViewLink,size,createdTime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": DRIVE_MIME,
      "X-Upload-Content-Length": String(Buffer.byteLength(json, "utf8")),
    },
    body: metadata,
  });
  const location = initResponse.headers.get("location");
  if (!location) throw new Error("Google Drive لم يُرجع رابط جلسة الرفع.");
  const uploadResponse = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Type": DRIVE_MIME,
      "Content-Length": String(Buffer.byteLength(json, "utf8")),
    },
    body: Buffer.from(json, "utf8"),
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`فشل رفع النسخة إلى Google Drive (${uploadResponse.status}): ${text.slice(0, 500)}`);
  }
  return await uploadResponse.json() as {id:string;name:string;webViewLink?:string;size?:string;createdTime?:string};
}

export async function connectGoogleDrive(code: string, origin: string | undefined) {
  const tokens = await exchangeCode(code, origin);
  const current = await ensureSettings();
  const refreshToken = tokens.refresh_token!;
  const accessToken = tokens.access_token!;
  const folderId = await ensureDriveFolder(accessToken, current.googleDriveFolderId);
  await db.update(xstorePlatformSettings).set({
    googleDriveRefreshTokenEncrypted: encryptSecret(refreshToken),
    googleDriveFolderId: folderId,
    googleDriveConnectedAt: new Date(),
    backupLastError: null,
    updatedAt: new Date(),
  }).where(eq(xstorePlatformSettings.id, "global"));
}

export async function disconnectGoogleDrive() {
  await db.update(xstorePlatformSettings).set({
    googleDriveRefreshTokenEncrypted: null,
    googleDriveFolderId: null,
    googleDriveConnectedAt: null,
    backupEnabled: false,
    backupNextRunAt: null,
    updatedAt: new Date(),
  }).where(eq(xstorePlatformSettings.id, "global"));
}

export async function getAutoBackupStatus() {
  const [settings] = await getSettings();
  return {
    enabled: settings?.backupEnabled ?? false,
    frequencyPerDay: settings?.backupFrequencyPerDay ?? 1,
    nextRunAt: settings?.backupNextRunAt?.toISOString() ?? null,
    lastRunAt: settings?.backupLastRunAt?.toISOString() ?? null,
    lastStatus: settings?.backupLastStatus ?? null,
    lastError: settings?.backupLastError ?? null,
    googleDriveConnected: !!settings?.googleDriveRefreshTokenEncrypted,
    googleDriveConnectedAt: settings?.googleDriveConnectedAt?.toISOString() ?? null,
    googleDriveFolderName: DRIVE_FOLDER_NAME,
  };
}

function nextRunAtFrom(now: Date, frequencyPerDay: number) {
  return new Date(now.getTime() + (24 * 60 * 60 * 1000) / frequencyPerDay);
}

export async function saveAutoBackupSettings(enabled: boolean, frequencyPerDay: number) {
  if (!Number.isInteger(frequencyPerDay) || frequencyPerDay < 1 || frequencyPerDay > 24) {
    throw new Error("عدد النسخ يجب أن يكون بين 1 و24 مرة يومياً.");
  }
  const current = await ensureSettings();
  const next = enabled && current.googleDriveRefreshTokenEncrypted
    ? nextRunAtFrom(new Date(), frequencyPerDay)
    : null;
  await db.update(xstorePlatformSettings).set({
    backupEnabled: enabled,
    backupFrequencyPerDay: frequencyPerDay,
    backupNextRunAt: next,
    backupLastError: null,
    updatedAt: new Date(),
  }).where(eq(xstorePlatformSettings.id, "global"));
  return getAutoBackupStatus();
}

export async function runPlatformBackupToGoogleDrive() {
  const [settings] = await getSettings();
  if (!settings?.googleDriveRefreshTokenEncrypted) throw new Error("Google Drive غير متصل.");
  const refreshToken = decryptSecret(settings.googleDriveRefreshTokenEncrypted);
  const tokens = await refreshAccessToken(refreshToken);
  const accessToken = tokens.access_token!;
  const effectiveRefreshToken = tokens.refresh_token || refreshToken;
  const folderId = await ensureDriveFolder(accessToken, settings.googleDriveFolderId);
  const backup = await createXStorePlatformBackup();
  const json = JSON.stringify(backup);
  const timestamp = backup.createdAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const fileName = `xstore-platform-backup-${timestamp}.json`;
  const uploaded = await uploadJson(accessToken, folderId, fileName, json);
  await db.update(xstorePlatformSettings).set({
    googleDriveRefreshTokenEncrypted: effectiveRefreshToken === refreshToken ? settings.googleDriveRefreshTokenEncrypted : encryptSecret(effectiveRefreshToken),
    googleDriveFolderId: folderId,
    backupLastRunAt: new Date(),
    backupLastStatus: "success",
    backupLastError: null,
    updatedAt: new Date(),
  }).where(eq(xstorePlatformSettings.id, "global"));
  return uploaded;
}

export async function markAutoBackupFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "تعذر إنشاء النسخة الاحتياطية.";
  await db.update(xstorePlatformSettings).set({
    backupLastRunAt: new Date(),
    backupLastStatus: "error",
    backupLastError: message.slice(0, 1000),
    updatedAt: new Date(),
  }).where(eq(xstorePlatformSettings.id, "global"));
}
