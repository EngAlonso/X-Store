const fs = require("node:fs/promises");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");

const SCHEMA_VERSION = 2;
const BACKUP_PREFIX = "x-store-automatic-";
const MAX_DAILY_BACKUPS = 30;
const VALID_STORE_TYPES = new Set([
  "clothing_shoes",
  "grocery_supermarket",
  "electronics_accessories",
  "perfume_beauty",
  "cafe",
  "restaurant",
]);
const VALID_CURRENCIES = new Set(["EGP", "SAR", "AED", "USD", "EUR", "GBP"]);
const VALID_LICENSE_DURATIONS = new Set([1, 3, 6, 12, 24, 36]);
const VALID_PAYMENTS = new Set(["cash", "card", "wallet", "instapay", "transfer"]);
const VALID_SALE_TYPES = new Set(["retail", "wholesale"]);
const VALID_INVOICE_FORMATS = new Set(["wide", "thermal_80mm", "thermal_58mm"]);
const VALID_TEAM_PERMISSIONS = new Set([
  "retail_sales",
  "wholesale_sales",
  "warehouse_manager",
  "accountant",
]);
const EMPTY_STATE = {
  schemaVersion: SCHEMA_VERSION,
  setupComplete: false,
  store: null,
  license: null,
  products: [],
  sales: [],
  heldSales: [],
  returns: [],
  exchanges: [],
  teamMembers: [],
  auditLogs: [],
  backup: {
    backupFolder: null,
    lastAutomaticBackupAt: null,
    lastManualBackupAt: null,
    lastError: null,
  },
};

let statePath;
let writeQueue = Promise.resolve();

app.setName("X-Store Offline");
app.setPath("userData", path.join(app.getPath("appData"), "X-Store Offline"));
app.setAppUserModelId("com.xstore.offline");

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidState(value) {
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== SCHEMA_VERSION ||
    typeof value.setupComplete !== "boolean" ||
    !Array.isArray(value.products) ||
    !Array.isArray(value.sales) ||
    !Array.isArray(value.heldSales) ||
    !Array.isArray(value.returns) ||
    !Array.isArray(value.exchanges) ||
    !Array.isArray(value.teamMembers) ||
    !Array.isArray(value.auditLogs) ||
    !isPlainObject(value.backup)
  ) return false;

  if (value.store !== null && (
    !isPlainObject(value.store) ||
    typeof value.store.name !== "string" ||
    typeof value.store.businessType !== "string" ||
    !VALID_STORE_TYPES.has(value.store.storeType) ||
    !VALID_CURRENCIES.has(value.store.currency) ||
    !VALID_INVOICE_FORMATS.has(value.store.invoiceFormat) ||
    !Number.isFinite(value.store.vatRate) ||
    value.store.vatRate < 0 ||
    value.store.vatRate > 100 ||
    typeof value.store.wholesaleEnabled !== "boolean"
  )) return false;

  if (value.license !== null && (
    !isPlainObject(value.license) ||
    typeof value.license.startedAt !== "string" ||
    typeof value.license.expiresAt !== "string" ||
    !VALID_LICENSE_DURATIONS.has(value.license.months) ||
    !isDate(value.license.startedAt) ||
    !isDate(`${value.license.expiresAt}T12:00:00`)
  )) return false;

  const backupIsValid =
    (value.backup.backupFolder === null || typeof value.backup.backupFolder === "string") &&
    (value.backup.lastAutomaticBackupAt === null || isDate(value.backup.lastAutomaticBackupAt)) &&
    (value.backup.lastManualBackupAt === null || isDate(value.backup.lastManualBackupAt)) &&
    (value.backup.lastError === null || typeof value.backup.lastError === "string");
  const productsAreValid = value.products.every((product) =>
    isPlainObject(product) &&
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.sku === "string" &&
    typeof product.barcode === "string" &&
    typeof product.category === "string" &&
    Number.isFinite(product.costPrice) && product.costPrice >= 0 &&
    (product.price === null || (Number.isFinite(product.price) && product.price >= 0)) &&
    (product.wholesalePrice === null || (Number.isFinite(product.wholesalePrice) && product.wholesalePrice >= 0)) &&
    Number.isInteger(product.quantity) && product.quantity >= 0 &&
    typeof product.color === "string" &&
    typeof product.size === "string" &&
    typeof product.partNumber === "string" &&
    (product.expiresAt === null || isDate(`${product.expiresAt}T12:00:00`)) &&
    isDate(product.createdAt),
  );
  const validLine = (item) =>
    isPlainObject(item) &&
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    typeof item.sku === "string" &&
    Number.isInteger(item.quantity) && item.quantity > 0 &&
    Number.isFinite(item.unitPrice) && item.unitPrice >= 0 &&
    Number.isFinite(item.unitCost) && item.unitCost >= 0 &&
    Number.isFinite(item.lineTotal) && item.lineTotal >= 0 &&
    Number.isInteger(item.returnedQuantity) && item.returnedQuantity >= 0 &&
    item.returnedQuantity <= item.quantity;
  const salesAreValid = value.sales.every((sale) =>
    isPlainObject(sale) &&
    typeof sale.id === "string" &&
    typeof sale.invoiceNumber === "string" &&
    isDate(sale.createdAt) &&
    typeof sale.customerName === "string" &&
    typeof sale.customerPhone === "string" &&
    VALID_PAYMENTS.has(sale.paymentMethod) &&
    VALID_SALE_TYPES.has(sale.saleType) &&
    typeof sale.transferSender === "string" &&
    typeof sale.cashierName === "string" &&
    (sale.exchangeOfInvoiceNumber === null || typeof sale.exchangeOfInvoiceNumber === "string") &&
    Number.isFinite(sale.subtotal) && sale.subtotal >= 0 &&
    Number.isFinite(sale.discountAmount) && sale.discountAmount >= 0 && sale.discountAmount <= sale.subtotal &&
    Number.isFinite(sale.taxAmount) && sale.taxAmount >= 0 &&
    Number.isFinite(sale.total) && sale.total >= 0 &&
    Number.isFinite(sale.amountReceived) && sale.amountReceived >= 0 &&
    Number.isFinite(sale.changeAmount) && sale.changeAmount >= 0 &&
    Array.isArray(sale.items) && sale.items.length > 0 && sale.items.every(validLine),
  );
  const heldAreValid = value.heldSales.every((held) =>
    isPlainObject(held) &&
    typeof held.id === "string" &&
    typeof held.reference === "string" &&
    isDate(held.createdAt) &&
    typeof held.customerName === "string" &&
    typeof held.customerPhone === "string" &&
    VALID_PAYMENTS.has(held.paymentMethod) &&
    VALID_SALE_TYPES.has(held.saleType) &&
    typeof held.transferSender === "string" &&
    Number.isFinite(held.subtotal) &&
    Number.isFinite(held.discountAmount) &&
    Number.isFinite(held.taxAmount) &&
    Number.isFinite(held.estimatedTotal) &&
    Number.isFinite(held.amountReceived) &&
    Array.isArray(held.items) && held.items.length > 0 &&
    held.items.every((item) => validLine({ ...item, lineTotal: item.quantity * item.unitPrice, returnedQuantity: 0 })),
  );
  const returnsAreValid = value.returns.every((record) =>
    isPlainObject(record) &&
    typeof record.id === "string" &&
    typeof record.saleId === "string" &&
    typeof record.invoiceNumber === "string" &&
    isDate(record.createdAt) &&
    typeof record.reason === "string" &&
    typeof record.cashierName === "string" &&
    Number.isFinite(record.refundAmount) && record.refundAmount >= 0 &&
    Number.isFinite(record.costAmount) && record.costAmount >= 0 &&
    Array.isArray(record.items) && record.items.length > 0 &&
    record.items.every((item) => isPlainObject(item) && typeof item.productId === "string" && typeof item.name === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.refundAmount) && item.refundAmount >= 0 && Number.isFinite(item.costAmount) && item.costAmount >= 0),
  );
  const exchangesAreValid = value.exchanges.every((exchange) =>
    isPlainObject(exchange) &&
    typeof exchange.id === "string" &&
    typeof exchange.originalInvoiceNumber === "string" &&
    typeof exchange.replacementInvoiceNumber === "string" &&
    isDate(exchange.createdAt) &&
    Number.isFinite(exchange.returnedAmount) && exchange.returnedAmount >= 0 &&
    Number.isFinite(exchange.replacementAmount) && exchange.replacementAmount >= 0 &&
    Number.isFinite(exchange.balanceDue) &&
    Number.isFinite(exchange.changeAmount) && exchange.changeAmount >= 0,
  );
  const teamAreValid = value.teamMembers.every((member) =>
    isPlainObject(member) &&
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    typeof member.phone === "string" &&
    typeof member.email === "string" &&
    ["tenant_admin", "cashier", "warehouse_manager", "accountant", "custom"].includes(member.role) &&
    typeof member.roleName === "string" &&
    Array.isArray(member.permissions) &&
    member.permissions.every((permission) => VALID_TEAM_PERMISSIONS.has(permission)) &&
    typeof member.active === "boolean" &&
    ((member.pinSalt === null && member.pinHash === null && member.pinIterations === null) ||
      (typeof member.pinSalt === "string" && /^[a-f0-9]{32}$/i.test(member.pinSalt) &&
        typeof member.pinHash === "string" && /^[a-f0-9]{64}$/i.test(member.pinHash) &&
        Number.isInteger(member.pinIterations) && member.pinIterations >= 100000 && member.pinIterations <= 1000000)) &&
    isDate(member.createdAt),
  );
  const auditIsValid = value.auditLogs.every((entry) =>
    isPlainObject(entry) &&
    typeof entry.id === "string" &&
    typeof entry.actorName === "string" &&
    typeof entry.action === "string" &&
    typeof entry.entityType === "string" &&
    typeof entry.entityId === "string" &&
    typeof entry.details === "string" &&
    isDate(entry.createdAt),
  );

  return (!value.setupComplete || Boolean(value.store && value.license)) &&
    backupIsValid && productsAreValid && salesAreValid && heldAreValid &&
    returnsAreValid && exchangesAreValid && teamAreValid && auditIsValid;
}

function normalizeState(value) {
  if (!isPlainObject(value) || ![1, 2].includes(value.schemaVersion)) return null;
  const normalized = {
    ...structuredClone(EMPTY_STATE),
    ...value,
    schemaVersion: SCHEMA_VERSION,
    store: value.store && isPlainObject(value.store)
      ? { ...value.store, invoiceFormat: value.store.invoiceFormat || "wide" }
      : value.store,
    products: Array.isArray(value.products) ? value.products.map((product) => isPlainObject(product)
      ? { ...product, price: product.price ?? null, color: product.color || "", size: product.size || "", partNumber: product.partNumber || "", expiresAt: product.expiresAt || null }
      : product) : value.products,
    sales: Array.isArray(value.sales) ? value.sales.map((sale) => isPlainObject(sale)
      ? {
        ...sale,
        customerPhone: sale.customerPhone || "",
        transferSender: sale.transferSender || "",
        discountAmount: sale.discountAmount ?? 0,
        amountReceived: sale.amountReceived ?? sale.total ?? 0,
        changeAmount: sale.changeAmount ?? 0,
        cashierName: sale.cashierName || "صاحب المتجر",
        exchangeOfInvoiceNumber: sale.exchangeOfInvoiceNumber ?? null,
        items: Array.isArray(sale.items) ? sale.items.map((item) => isPlainObject(item)
          ? { ...item, unitCost: item.unitCost ?? 0, returnedQuantity: item.returnedQuantity ?? 0 }
          : item) : sale.items,
      }
      : sale) : value.sales,
    heldSales: value.heldSales ?? [],
    returns: value.returns ?? [],
    exchanges: value.exchanges ?? [],
    teamMembers: Array.isArray(value.teamMembers) ? value.teamMembers.map((member) => isPlainObject(member)
      ? { ...member, pinSalt: member.pinSalt ?? null, pinHash: member.pinHash ?? null, pinIterations: member.pinIterations ?? null }
      : member) : [],
    auditLogs: value.auditLogs ?? [],
    backup: { ...EMPTY_STATE.backup, ...(isPlainObject(value.backup) ? value.backup : {}) },
  };
  return isValidState(normalized) ? normalized : null;
}

function enqueueWrite(operation) {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function atomicWrite(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

async function readState() {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);
    if (!normalized) {
      throw new Error("ملف بيانات المتجر تالف أو غير متوافق.");
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      await atomicWrite(statePath, `${JSON.stringify(normalized, null, 2)}\n`);
    }
    return normalized;
  } catch (error) {
    if (error && error.code === "ENOENT") return structuredClone(EMPTY_STATE);
    throw error;
  }
}

function dateStamp(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function trimDailyBackups(folder) {
  const names = (await fs.readdir(folder)).filter(
    (name) =>
      name.startsWith(BACKUP_PREFIX) &&
      name.endsWith(".json") &&
      /^\d{4}-\d{2}-\d{2}$/.test(name.slice(BACKUP_PREFIX.length, -5)),
  );
  names.sort().reverse();
  await Promise.all(
    names.slice(MAX_DAILY_BACKUPS).map((name) => fs.rm(path.join(folder, name))),
  );
}

async function writeAutomaticBackup(state) {
  const folder = state.backup.backupFolder;
  if (!folder) {
    return {
      ...state,
      backup: {
        ...state.backup,
        lastError: "مجلد النسخ الاحتياطي غير محدد.",
      },
    };
  }

  const now = new Date();
  const backupState = {
    ...state,
    backup: {
      ...state.backup,
      lastAutomaticBackupAt: now.toISOString(),
      lastError: null,
    },
  };
  try {
    await fs.mkdir(folder, { recursive: true });
    const json = `${JSON.stringify(backupState, null, 2)}\n`;
    await atomicWrite(path.join(folder, "x-store-latest-backup.json"), json);
    const dailyPath = path.join(folder, `${BACKUP_PREFIX}${dateStamp(now)}.json`);
    try {
      await fs.access(dailyPath);
    } catch {
      await atomicWrite(dailyPath, json);
      await trimDailyBackups(folder);
    }
    return backupState;
  } catch (error) {
    return {
      ...state,
      backup: {
        ...state.backup,
        lastError: `تعذر حفظ النسخة الاحتياطية: ${error.message || "خطأ في المجلد"}`,
      },
    };
  }
}

async function saveState(nextState) {
  const normalized = normalizeState(nextState);
  if (!normalized) {
    throw new Error("رفض حفظ بيانات غير صالحة.");
  }
  if (app.isPackaged && normalized.backup.backupFolder) {
    const installRoot = path.resolve(
      path.dirname(path.dirname(app.getAppPath())),
    );
    const backupFolder = path.resolve(normalized.backup.backupFolder);
    const relative = path.relative(installRoot, backupFolder);
    const isInsideInstall =
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative));
    if (isInsideInstall) {
      throw new Error("اختر مجلدًا خارج مجلد تثبيت البرنامج.");
    }
  }
  let current = structuredClone(normalized);
  await atomicWrite(statePath, `${JSON.stringify(current, null, 2)}\n`);
  current = await writeAutomaticBackup(current);
  await atomicWrite(statePath, `${JSON.stringify(current, null, 2)}\n`);
  return current;
}

async function saveStateSafely(nextState) {
  return enqueueWrite(() => saveState(nextState));
}

async function createBackup(manual = true) {
  return enqueueWrite(async () => {
    const current = await readState();
    const folder = current.backup.backupFolder;
    if (!folder) throw new Error("حدد مجلد النسخ الاحتياطي أولاً.");
    await fs.mkdir(folder, { recursive: true });
    const now = new Date();
    const timestamped = path.join(
      folder,
      `x-store-manual-${timeStamp(now)}.json`,
    );
    const backupState = {
      ...current,
      backup: {
        ...current.backup,
        lastAutomaticBackupAt: current.backup.lastAutomaticBackupAt,
        lastManualBackupAt: manual ? now.toISOString() : current.backup.lastManualBackupAt,
        lastError: null,
      },
    };
    const json = `${JSON.stringify(backupState, null, 2)}\n`;
    await atomicWrite(timestamped, json);
    await atomicWrite(path.join(folder, "x-store-latest-backup.json"), json);
    await atomicWrite(statePath, `${JSON.stringify(backupState, null, 2)}\n`);
    return backupState;
  });
}

async function restoreState(importedState) {
  const normalizedImport = normalizeState(importedState);
  if (!normalizedImport) {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو غير متوافق.");
  }
  return enqueueWrite(async () => {
    const current = await readState();
    if (current.backup.backupFolder) {
      const safeguard = {
        ...current,
        backup: { ...current.backup, lastError: null },
      };
      try {
        await fs.mkdir(current.backup.backupFolder, { recursive: true });
        await atomicWrite(
          path.join(
            current.backup.backupFolder,
            `x-store-before-restore-${timeStamp()}.json`,
          ),
          `${JSON.stringify(safeguard, null, 2)}\n`,
        );
      } catch {
        // Restore remains possible if the configured backup drive is unavailable.
      }
    }
    const restored = {
      ...structuredClone(normalizedImport),
      backup: {
        ...normalizedImport.backup,
        backupFolder:
          current.backup.backupFolder || normalizedImport.backup.backupFolder,
        lastError: null,
      },
    };
    return saveState(restored);
  });
}

async function chooseBackupFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "اختيار مجلد النسخ الاحتياطي",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0] || null;
}

async function restoreBackupFromFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "اختيار ملف النسخة الاحتياطية",
    properties: ["openFile"],
    filters: [{ name: "نسخة X-Store", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) return readState();
  const imported = JSON.parse(await fs.readFile(result.filePaths[0], "utf8"));
  return restoreState(imported);
}

let mainWindow;
let dailyBackupTimer;

function installNetworkBlock() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let allowedDevRequest = false;
    if (!app.isPackaged) {
      try {
        const url = new URL(details.url);
        allowedDevRequest =
          url.protocol === "http:" &&
          url.hostname === "127.0.0.1" &&
          url.port === "4174";
      } catch {
        allowedDevRequest = false;
      }
    }
    const networkProtocol = /^(https?|wss?):/i.test(details.url);
    callback({ cancel: networkProtocol && !allowedDevRequest });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f3f7f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const isDevOrigin =
      !app.isPackaged && targetUrl.startsWith("http://127.0.0.1:4174/");
    const isPackagedFile = app.isPackaged && targetUrl.startsWith("file://");
    if (!isDevOrigin && !isPackagedFile) event.preventDefault();
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "offline", "offline.html"),
    );
  } else {
    void mainWindow.loadURL("http://127.0.0.1:4174/offline.html");
  }
}

function registerIpc() {
  ipcMain.handle("offline:get-state", () => readState());
  ipcMain.handle("offline:save-state", (_event, state) => saveStateSafely(state));
  ipcMain.handle("offline:choose-backup-folder", () => chooseBackupFolder());
  ipcMain.handle("offline:create-backup", () => createBackup(true));
  ipcMain.handle("offline:restore-backup", () => restoreBackupFromFile());
  ipcMain.handle("offline:restore-state", (_event, state) => restoreState(state));
}

app.whenReady().then(async () => {
  statePath = path.join(app.getPath("userData"), "store-data.json");
  installNetworkBlock();
  registerIpc();
  createWindow();
  dailyBackupTimer = setInterval(() => {
    void enqueueWrite(async () => {
      const current = await readState();
      if (!current.setupComplete) return current;
      const backedUp = await writeAutomaticBackup(current);
      await atomicWrite(statePath, `${JSON.stringify(backedUp, null, 2)}\n`);
      return backedUp;
    });
  }, 24 * 60 * 60 * 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (dailyBackupTimer) clearInterval(dailyBackupTimer);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("render-process-gone", (_event, _webContents, details) => {
  console.error("Offline renderer stopped:", details.reason);
});
