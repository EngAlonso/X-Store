const { spawnSync } = require("node:child_process");

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
const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "desktop:build"]);
run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "electron-builder", "--win", mode === "portable" ? "portable" : "nsis", "--x64"]);
