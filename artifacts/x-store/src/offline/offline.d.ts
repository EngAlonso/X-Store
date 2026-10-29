import type { OfflineHardwareSnapshot, OfflineState } from "./model";

declare global {
  interface Window {
    xStoreOffline?: {
      getState(): Promise<OfflineState>;
      getInstallationId(): Promise<string>;
      getHardwareFingerprint(): Promise<OfflineHardwareSnapshot>;
      saveState(state: OfflineState): Promise<OfflineState>;
      chooseBackupFolder(): Promise<string | null>;
      createBackup(): Promise<OfflineState>;
      restoreBackup(): Promise<OfflineState>;
      restoreState(state: OfflineState): Promise<OfflineState>;
    };
  }
}

export {};
