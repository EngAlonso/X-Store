import {
  createEmptyOfflineState,
  isOfflineState,
  migrateOfflineState,
  type OfflineState,
} from "./model";

const STATE_KEY = "x-store-offline-state-v1";
const BACKUP_KEY = "x-store-offline-backup-v1";

export function isDesktopEdition(): boolean {
  return Boolean(window.xStoreOffline);
}

export async function loadOfflineState(): Promise<OfflineState> {
  if (window.xStoreOffline) {
    const raw = await window.xStoreOffline.getState();
    const state = migrateOfflineState(raw);
    if (!isOfflineState(state)) throw new Error("ملف بيانات النسخة الأوف لاين غير صالح.");
    return state.schemaVersion === raw.schemaVersion
      ? state
      : window.xStoreOffline.saveState(state);
  }

  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return createEmptyOfflineState();
  const parsed = migrateOfflineState(JSON.parse(raw));
  if (!isOfflineState(parsed)) {
    throw new Error("بيانات معاينة النسخة الأوف لاين غير صالحة.");
  }
  if (parsed.schemaVersion !== JSON.parse(raw).schemaVersion) {
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
      const migrated = migrateOfflineState(importedState);
      if (!isOfflineState(migrated)) {
        throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
      }
      return window.xStoreOffline.restoreState(migrated);
    }
    return window.xStoreOffline.restoreBackup();
  }

  const candidate =
    migrateOfflineState(importedState) ??
    (() => {
      const raw = localStorage.getItem(BACKUP_KEY);
      return raw ? migrateOfflineState(JSON.parse(raw)) : null;
    })();
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
