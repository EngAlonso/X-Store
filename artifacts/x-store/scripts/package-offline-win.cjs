const { spawnSync } = require("node:child_process");
const { createPrivateKey, createPublicKey } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mode = process.argv[2] === "portable" ? "portable" : "installer";
const storeType = String(process.argv[3] || process.env.VITE_OFFLINE_STORE_TYPE || "").trim();
const valid = new Set([
  "clothing_shoes",
  "grocery_supermarket",
  "electronics_accessories",
  "perfume_beauty",
  "cafe",
  "restaurant",
]);

if (!valid.has(storeType)) {
  console.error("Usage: pnpm desktop:installer:win <store-type>");
  console.error("Supported: " + [...valid].join(", "));
  process.exit(1);
}

const env = { ...process.env, VITE_OFFLINE_STORE_TYPE: storeType };

function prepareOfflineLicensePublicKey() {
  const privateKeyText = String(process.env.XSTORE_OFFLINE_LICENSE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!privateKeyText) {
    console.error("XSTORE_OFFLINE_LICENSE_PRIVATE_KEY is missing.");
    process.exit(1);
  }
  let privateKey;
  try {
    privateKey = createPrivateKey(privateKeyText);
  } catch {
    console.error("XSTORE_OFFLINE_LICENSE_PRIVATE_KEY is invalid.");
    process.exit(1);
  }
  if (privateKey.asymmetricKeyType !== "ed25519") {
    console.error("XSTORE_OFFLINE_LICENSE_PRIVATE_KEY must be an Ed25519 private key.");
    process.exit(1);
  }
  const publicKey = createPublicKey(privateKey)
    .export({ format: "der", type: "spki" })
    .toString("base64");
  fs.writeFileSync(
    path.join(__dirname, "..", "electron", "license-public-key.cjs"),
    "module.exports = " + JSON.stringify({ OFFLINE_LICENSE_PUBLIC_KEY: publicKey }) + ";\n",
    { encoding: "utf8", mode: 0o600 },
  );
}

prepareOfflineLicensePublicKey();
const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "desktop:build"]);
run(process.platform === "win32" ? "node.exe" : "node", ["scripts/prepare-windows-icon.cjs"]);
run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "electron-builder", "--win", mode === "portable" ? "portable" : "nsis", "--x64"]);
