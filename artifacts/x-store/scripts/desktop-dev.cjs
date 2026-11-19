const { spawn } = require("node:child_process");

const children = [];
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const vite = spawn(
  packageManager,
  [
    "exec",
    "vite",
    "--config",
    "vite.offline.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
children.push(vite);

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 150);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
vite.on("exit", (code) => {
  if (!shuttingDown) stopAll(code || 0);
});
vite.on("error", (error) => {
  console.error("Unable to start the offline preview server:", error);
  stopAll(1);
});

async function waitForRenderer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45_000) {
    if (shuttingDown) return;
    try {
      const response = await fetch("http://127.0.0.1:4174/offline.html");
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error("The offline renderer did not start on port 4174.");
}

waitForRenderer()
  .then(() => {
    const electron = spawn(
      packageManager,
      ["exec", "electron", "electron/main.cjs"],
      {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, NODE_ENV: "development" },
      },
    );
    children.push(electron);
    electron.on("exit", (code) => stopAll(code || 0));
    electron.on("error", (error) => {
      console.error("Unable to launch X-Store Offline:", error);
      stopAll(1);
    });
  })
  .catch((error) => {
    console.error(error.message);
    stopAll(1);
  });
