const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("xStoreOffline", {
  getState: () => ipcRenderer.invoke("offline:get-state"),
  getInstallationId: () => ipcRenderer.invoke("offline:get-installation-id"),
  getHardwareFingerprint: () => ipcRenderer.invoke("offline:get-hardware-fingerprint"),
  saveState: (state) => ipcRenderer.invoke("offline:save-state", state),
  chooseBackupFolder: () =>
    ipcRenderer.invoke("offline:choose-backup-folder"),
  createBackup: () => ipcRenderer.invoke("offline:create-backup"),
  restoreBackup: () => ipcRenderer.invoke("offline:restore-backup"),
  restoreState: (state) => ipcRenderer.invoke("offline:restore-state", state),
});
