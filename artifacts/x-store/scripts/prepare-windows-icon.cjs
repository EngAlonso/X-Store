const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const encodedIcon = fs.readFileSync(path.join(packageRoot, "build", "x-store.ico.base64"), "utf8").replace(/\\s/g, "");
const icon = Buffer.from(encodedIcon, "base64");
if (icon.length < 22 || icon.readUInt16LE(0) !== 0 || icon.readUInt16LE(2) !== 1) {
  throw new Error("The X-Store Windows icon is invalid.");
}
fs.writeFileSync(path.join(packageRoot, "build", "x-store.ico"), icon);
