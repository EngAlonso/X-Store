const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");

const DEFAULT_PORT = 4175;
const MAX_BODY_BYTES = 20 * 1024 * 1024;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function getToken(req) {
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("token") || req.headers["x-xstore-server-token"] || "";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("الطلب كبير جدًا."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeStaticPath(root, requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/") pathname = "/offline.html";
  const candidate = path.resolve(root, "." + pathname);
  const relative = path.relative(root, candidate);
  if (relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) return null;
  return candidate;
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".svg": return "image/svg+xml";
    case ".ico": return "image/x-icon";
    case ".woff":
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}

function serializeLicensePayload(payload) {
  return JSON.stringify({
    version: payload.version,
    licenseId: payload.licenseId,
    installationId: payload.installationId,
    ...(payload.version === 2 && payload.deviceFingerprint
      ? { deviceFingerprint: {
          version: 1,
          windowsMachineGuid: payload.deviceFingerprint.windowsMachineGuid,
          motherboard: payload.deviceFingerprint.motherboard,
          internalDisks: [...payload.deviceFingerprint.internalDisks].sort(),
          memoryModules: [...payload.deviceFingerprint.memoryModules].sort(),
        } }
      : {}),
    storeName: payload.storeName,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}

function verifyLicenseSignature(license, publicKeyBase64) {
  if (!license || !license.payload || typeof publicKeyBase64 !== "string" || !publicKeyBase64) {
    throw new Error("تعذر التحقق من توقيع الترخيص.");
  }
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    throw new Error("مفتاح التحقق من الترخيص غير صالح.");
  }
  const signature = Buffer.from(String(license.signature || ""), "base64");
  const valid = crypto.verify(
    null,
    Buffer.from(serializeLicensePayload(license.payload), "utf8"),
    publicKey,
    signature,
  );
  if (!valid) throw new Error("الترخيص غير موثوق أو تم تعديله.");
}

function getLanAddresses(port, token) {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(
          "http://" + item.address + ":" + port + "/offline.html?token=" +
          encodeURIComponent(token),
        );
      }
    }
  }
  return [...new Set(addresses)];
}

async function startLanServer({ staticRoot, userDataPath, readState, saveState, getClockStatus, getHardwareFingerprint, licensePublicKey }) {
  const tokenPath = path.join(userDataPath, "lan-server-token.txt");
  let token;
  try {
    token = (await fsp.readFile(tokenPath, "utf8")).trim();
  } catch {
    token = crypto.randomBytes(32).toString("hex");
    await fsp.mkdir(userDataPath, { recursive: true });
    await fsp.writeFile(tokenPath, token, { encoding: "utf8", mode: 0o600 });
  }

  const authorized = (req) => getToken(req) === token;

  async function assertLicenseActive(state) {
    const license = state && state.license;
    if (!license || !license.payload) throw new Error("الترخيص غير مفعّل.");
    verifyLicenseSignature(license, licensePublicKey);
    if (license.payload.version !== 2 || !license.payload.deviceFingerprint) {
      throw new Error("هذا الترخيص قديم وغير صالح للنسخة المثبتة.");
    }
    if (typeof getHardwareFingerprint === "function") {
      const current = await getHardwareFingerprint();
      const expected = license.payload.deviceFingerprint;
      const same = expected.windowsMachineGuid === current.deviceFingerprint.windowsMachineGuid &&
        expected.motherboard === current.deviceFingerprint.motherboard &&
        [...expected.internalDisks].sort().join("|") === [...current.deviceFingerprint.internalDisks].sort().join("|") &&
        [...expected.memoryModules].sort().join("|") === [...current.deviceFingerprint.memoryModules].sort().join("|") &&
        license.payload.installationId === current.installationId;
      if (!same) throw new Error("الترخيص مرتبط بجهاز آخر.");
    }
    if (Date.parse(license.payload.issuedAt) > Date.now() + 5 * 60 * 1000) {
      throw new Error("تاريخ إصدار الترخيص لاحق لتاريخ هذا الجهاز.");
    }
    if (typeof getClockStatus === "function") {
      const clock = await getClockStatus();
      if (!clock.valid) throw new Error(clock.message || "تم اكتشاف رجوع ساعة Windows للخلف.");
    }
    if (license.payload.plan !== "lifetime") {
      const expiresAt = Date.parse(String(license.payload.expiresAt || "") + "T23:59:59");
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        throw new Error("انتهى ترخيص هذا المتجر. يجب إعادة التفعيل.");
      }
    }
  }

  async function saveClientState(nextState) {
    const current = await readState();
    await assertLicenseActive(current);
    const protectedState = {
      ...nextState,
      license: current.license,
      store: nextState && nextState.store
        ? { ...nextState.store, storeType: current.store?.storeType }
        : current.store,
    };
    return saveState(protectedState);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (url.pathname.startsWith("/api/offline/")) {
        if (!authorized(req)) return json(res, 401, { error: "غير مصرح." });

        if (req.method === "GET" && url.pathname === "/api/offline/state") {
          const state = await readState();
          await assertLicenseActive(state);
          return json(res, 200, state);
        }

        if (req.method === "PUT" && url.pathname === "/api/offline/state") {
          const raw = await readBody(req);
          const state = JSON.parse(raw);
          return json(res, 200, await saveClientState(state));
        }

        if (req.method === "POST" && url.pathname === "/api/offline/backup") {
          const backupType = url.searchParams.get("type") || "full";
          if (!["full", "invoices", "inventory"].includes(backupType)) {
            return json(res, 400, { error: "نوع النسخة الاحتياطية غير مدعوم." });
          }
          const state = await readState();
          await assertLicenseActive(state);
          const now = new Date().toISOString();
          const snapshot = backupType === "full"
            ? {
                ...state,
                backup: {
                  ...state.backup,
                  backupScope: "full",
                  lastManualBackupAt: now,
                  lastError: null,
                },
              }
            : {
                ...state,
                products: backupType === "inventory" ? state.products : [],
                sales: backupType === "invoices" ? state.sales : [],
                heldSales: backupType === "invoices" ? state.heldSales : [],
                returns: backupType === "invoices" ? state.returns : [],
                exchanges: backupType === "invoices" ? state.exchanges : [],
                backup: {
                  ...state.backup,
                  backupScope: backupType,
                  lastManualBackupAt: now,
                  lastError: null,
                },
              };
          return json(res, 200, snapshot);
        }

        return json(res, 404, { error: "المسار غير موجود." });
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return json(res, 405, { error: "طريقة الطلب غير مدعومة." });
      }

      const filePath = safeStaticPath(staticRoot, url.pathname);
      if (!filePath) return json(res, 400, { error: "مسار غير صالح." });

      let stat;
      try {
        stat = await fsp.stat(filePath);
      } catch {
        return json(res, 404, { error: "الملف غير موجود." });
      }

      if (!stat.isFile()) return json(res, 404, { error: "الملف غير موجود." });

      res.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
      });

      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Offline LAN server request failed:", error);
      if (!res.headersSent) json(res, 500, { error: "تعذر تنفيذ الطلب." });
      else res.destroy();
    }
  });

  let port = DEFAULT_PORT;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "0.0.0.0");
      });
      break;
    } catch (error) {
      if (error && error.code === "EADDRINUSE" && attempt < 9) {
        port += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    server,
    port,
    token,
    urls: getLanAddresses(port, token),
  };
}

module.exports = { startLanServer };
