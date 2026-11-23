import {
  createEmptyOfflineState,
  isOfflineState,
  migrateOfflineState,
  type OfflineHardwareSnapshot,
  type OfflineState,
} from "./model";
import { verifyOfflineLicenseSignature } from "./licensing";

const STATE_KEY = "x-store-offline-state-v1";
const BACKUP_KEY = "x-store-offline-backup-v1";
const AUTO_BACKUP_KEY = "x-store-offline-auto-backup-v1";
const INSTALLATION_ID_KEY = "x-store-offline-installation-id-v1";

function isLanClient(): boolean {
  return !window.xStoreOffline && window.location.protocol === "http:" &&
    window.location.pathname.endsWith("/offline.html") &&
    window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
}

function lanApiUrl(path: string): string {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) throw new Error("رابط السيرفر المحلي غير صالح أو يفتقد رمز الوصول.");
  return path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

async function lanRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(lanApiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "تعذر الاتصال بسيرفر المتجر.");
  return payload;
}

export async function getOfflineInstallationId(): Promise<string> {
  if (window.xStoreOffline) return window.xStoreOffline.getInstallationId();
  let installationId = localStorage.getItem(INSTALLATION_ID_KEY);
  if (!installationId) {
    installationId = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_ID_KEY, installationId);
  }
  return installationId;
}

export async function getOfflineHardwareSnapshot(): Promise<OfflineHardwareSnapshot> {
  if (!window.xStoreOffline) {
    throw new Error("قراءة قطع الجهاز متاحة في نسخة Windows المثبتة فقط.");
  }
  return window.xStoreOffline.getHardwareFingerprint();
}

export function isDesktopEdition(): boolean {
  return Boolean(window.xStoreOffline);
}

export type OfflineBackupType = "full" | "invoices" | "inventory";

export async function getOfflineClockStatus(): Promise<{ valid: boolean; rollbackDetected: boolean; message: string }> {
  if (!window.xStoreOffline) return { valid: true, rollbackDetected: false, message: "" };
  return window.xStoreOffline.getClockStatus();
}

export async function loadOfflineState(): Promise<OfflineState> {
  if (window.xStoreOffline) {
    const raw = await window.xStoreOffline.getState();
    const state = await validateStoredLicense(migrateOfflineState(raw));
    if (!isOfflineState(state)) throw new Error("ملف بيانات النسخة الأوف لاين غير صالح.");
    return state.schemaVersion === raw.schemaVersion
      && !(raw.license && !state.license)
      ? state
      : window.xStoreOffline.saveState(state);
  }

  if (isLanClient()) {
    const raw = await lanRequest("/api/offline/state");
    const parsed = await validateStoredLicense(migrateOfflineState(raw));
    if (!isOfflineState(parsed)) throw new Error("بيانات سيرفر المتجر غير صالحة.");
    return parsed;
  }

  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return createEmptyOfflineState();
  const original = JSON.parse(raw);
  const parsed = await validateStoredLicense(migrateOfflineState(original));
  if (!isOfflineState(parsed)) {
    throw new Error("بيانات معاينة النسخة الأوف لاين غير صالحة.");
  }
  if (parsed.schemaVersion !== original.schemaVersion || (original.license && !parsed.license)) {
    localStorage.setItem(STATE_KEY, JSON.stringify(parsed));
  }
  return parsed;
}

export async function saveOfflineState(state: OfflineState): Promise<OfflineState> {
  const migrated = migrateOfflineState(state);
  if (!isOfflineState(migrated)) throw new Error("بيانات المتجر غير صالحة.");
  if (window.xStoreOffline) return window.xStoreOffline.saveState(migrated);
  if (isLanClient()) return lanRequest("/api/offline/state", { method: "PUT", body: JSON.stringify(migrated) });

  const saved: OfflineState = {
    ...migrated,
    backup: {
      ...migrated.backup,
      lastAutomaticBackupAt: new Date().toISOString(),
      lastError: null,
    },
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(saved));
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(saved));
  return saved;
}

export async function chooseOfflineBackupFolder(): Promise<string | null> {
  if (window.xStoreOffline) return window.xStoreOffline.chooseBackupFolder();
  return "نسخة معاينة داخل المتصفح — لا تمثل مجلد ويندوز";
}

export async function createManualOfflineBackup(backupType: OfflineBackupType = "full"): Promise<OfflineState> {
  if (window.xStoreOffline) return window.xStoreOffline.createBackup(backupType);
  if (isLanClient()) return lanRequest("/api/offline/backup?type=" + encodeURIComponent(backupType), { method: "POST" });
  const state = await loadOfflineState();
  const now = new Date().toISOString();
  const snapshot: OfflineState = backupType === "full"
    ? {
      ...state,
      backup: { ...state.backup, backupScope: "full", lastAutomaticBackupAt: now, lastManualBackupAt: now, lastError: null },
    }
    : {
      ...state,
      products: backupType === "inventory" ? state.products : [],
      sales: backupType === "invoices" ? state.sales : [],
      heldSales: backupType === "invoices" ? state.heldSales : [],
      returns: backupType === "invoices" ? state.returns : [],
      exchanges: backupType === "invoices" ? state.exchanges : [],
      backup: { ...state.backup, backupScope: backupType, lastAutomaticBackupAt: now, lastManualBackupAt: now, lastError: null },
    };
  localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
  return {
    ...state,
    backup: {
      ...state.backup,
      backupScope: backupType,
      lastAutomaticBackupAt: now,
      lastManualBackupAt: now,
      lastError: null,
    },
  };
}

export async function restoreOfflineBackup(
  importedState?: OfflineState,
): Promise<OfflineState> {
  if (window.xStoreOffline) {
    if (importedState) {
      const migrated = await validateStoredLicense(migrateOfflineState(importedState));
      if (!isOfflineState(migrated)) {
        throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
      }
      const current = await loadOfflineState();
      const scope = migrated.backup.backupScope ?? "full";
      const merged: OfflineState = scope === "full"
        ? { ...migrated, backup: { ...current.backup, ...migrated.backup, lastError: null, backupScope: "full" } }
        : {
          ...current,
          ...(scope === "inventory" ? { products: migrated.products } : {
            sales: migrated.sales,
            heldSales: migrated.heldSales,
            returns: migrated.returns,
            exchanges: migrated.exchanges,
          }),
          backup: { ...current.backup, lastError: null, backupScope: scope },
        };
      return window.xStoreOffline.restoreState(merged);
    }
    const restored = await window.xStoreOffline.restoreBackup();
    const validated = await validateStoredLicense(migrateOfflineState(restored));
    if (!isOfflineState(validated)) throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
    const current = await loadOfflineState();
    const scope = validated.backup.backupScope ?? "full";
    if (scope === "full") {
      return restored.license && !validated.license ? window.xStoreOffline.saveState(validated) : validated;
    }
    const merged: OfflineState = {
      ...current,
      ...(scope === "inventory" ? { products: validated.products } : {
        sales: validated.sales,
        heldSales: validated.heldSales,
        returns: validated.returns,
        exchanges: validated.exchanges,
      }),
      backup: { ...current.backup, lastError: null, backupScope: scope },
    };
    return window.xStoreOffline.restoreState(merged);
  }

  if (isLanClient() && importedState) {
    const migrated = await validateStoredLicense(migrateOfflineState(importedState));
    if (!isOfflineState(migrated)) throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
    const current = await loadOfflineState();
    const scope = migrated.backup.backupScope ?? "full";
    const restored: OfflineState = scope === "full"
      ? { ...migrated, backup: { ...current.backup, ...migrated.backup, lastError: null, backupScope: "full" } }
      : {
        ...current,
        ...(scope === "inventory" ? { products: migrated.products } : {
          sales: migrated.sales,
          heldSales: migrated.heldSales,
          returns: migrated.returns,
          exchanges: migrated.exchanges,
        }),
        backup: { ...current.backup, lastError: null, backupScope: scope },
      };
    return lanRequest("/api/offline/state", { method: "PUT", body: JSON.stringify(restored) });
  }

  const candidate = await validateStoredLicense(
    migrateOfflineState(importedState) ??
    (() => {
      const raw = localStorage.getItem(BACKUP_KEY);
      return raw ? migrateOfflineState(JSON.parse(raw)) : null;
    })(),
  );
  if (!isOfflineState(candidate)) {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
  }
  const current = await loadOfflineState();
  const scope = candidate.backup.backupScope ?? "full";
  const restored: OfflineState = scope === "full"
    ? {
      ...candidate,
      backup: { ...current.backup, ...candidate.backup, lastError: null, backupScope: "full" },
    }
    : {
      ...current,
      ...(scope === "inventory" ? { products: candidate.products } : {
        sales: candidate.sales,
        heldSales: candidate.heldSales,
        returns: candidate.returns,
        exchanges: candidate.exchanges,
      }),
      backup: { ...current.backup, lastError: null, backupScope: scope },
    };
  localStorage.setItem(STATE_KEY, JSON.stringify(restored));
  return restored;
}

async function validateStoredLicense(
  state: OfflineState | null,
): Promise<OfflineState | null> {
  if (!state?.license) return state;
  try {
    await verifyOfflineLicenseSignature(state.license);
    return state;
  } catch {
    return { ...state, license: null };
  }
}
