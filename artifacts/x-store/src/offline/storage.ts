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
const INSTALLATION_ID_KEY = "x-store-offline-installation-id-v1";

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

  const saved: OfflineState = {
    ...migrated,
    backup: {
      ...migrated.backup,
      lastAutomaticBackupAt: new Date().toISOString(),
      lastError: null,
    },
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(saved));
  localStorage.setItem(BACKUP_KEY, JSON.stringify(saved));
  return saved;
}

export async function chooseOfflineBackupFolder(): Promise<string | null> {
  if (window.xStoreOffline) return window.xStoreOffline.chooseBackupFolder();
  return "نسخة معاينة داخل المتصفح — لا تمثل مجلد ويندوز";
}

export async function createManualOfflineBackup(): Promise<OfflineState> {
  if (window.xStoreOffline) return window.xStoreOffline.createBackup();
  const state = await loadOfflineState();
  const saved: OfflineState = {
    ...state,
    backup: {
      ...state.backup,
      lastAutomaticBackupAt: new Date().toISOString(),
      lastManualBackupAt: new Date().toISOString(),
      lastError: null,
    },
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(saved));
  localStorage.setItem(BACKUP_KEY, JSON.stringify(saved));
  return saved;
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
      return window.xStoreOffline.restoreState(migrated);
    }
    const restored = await window.xStoreOffline.restoreBackup();
    const validated = await validateStoredLicense(migrateOfflineState(restored));
    if (!isOfflineState(validated)) throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
    return restored.license && !validated.license
      ? window.xStoreOffline.saveState(validated)
      : validated;
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
  const restored: OfflineState = {
    ...candidate,
    backup: {
      ...candidate.backup,
      lastError: null,
    },
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
