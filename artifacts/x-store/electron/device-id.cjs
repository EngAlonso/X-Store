const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");

function deviceIdFromMachineIdentity(machineIdentity) {
  if (typeof machineIdentity !== "string" || !machineIdentity.trim()) {
    throw new Error("تعذر قراءة معرّف الجهاز.");
  }

  const digest = crypto
    .createHash("sha256")
    .update(`com.xstore.offline/device-id/v1\0${machineIdentity.trim().toLowerCase()}`)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readWindowsMachineIdentity() {
  let machineGuid;
  try {
    const output = execFileSync(
      "reg.exe",
      [
        "query",
        "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid",
      ],
      {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    machineGuid = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim();
  } catch {
    // Report a clear error below instead of using a copyable app-data ID.
  }

  let hardwareUuid;
  try {
    hardwareUuid = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction Stop).UUID",
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    // The motherboard identifier is required for resistance to disk cloning.
  }

  const validUuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value) &&
    !/^f{8}-f{4}-f{4}-f{4}-f{12}$/i.test(value);
  if (validUuid(machineGuid) && validUuid(hardwareUuid)) {
    return `windows-guid:${machineGuid.toLowerCase()}|firmware-uuid:${hardwareUuid.toLowerCase()}`;
  }

  throw new Error("تعذر قراءة معرّفات الجهاز من Windows. تحقق من معلومات الجهاز ثم تواصل مع الدعم.");
}

function readMacMachineIdentity() {
  try {
    const output = execFileSync(
      "ioreg",
      ["-rd1", "-c", "IOPlatformExpertDevice"],
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const identity = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1]?.trim();
    if (identity) return identity;
  } catch {
    // Report a clear error below instead of using a copyable app-data ID.
  }

  throw new Error("تعذر قراءة معرّف الجهاز من النظام. تواصل مع الدعم.");
}

async function readLinuxMachineIdentity() {
  for (const filePath of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      const identity = (await fs.readFile(filePath, "utf8")).trim();
      if (identity && !/^0+$/.test(identity)) return identity;
    } catch {
      // Try the standard alternate location before reporting an error.
    }
  }

  throw new Error("تعذر قراءة معرّف الجهاز من النظام. تواصل مع الدعم.");
}

async function getDeviceId(platform = process.platform) {
  let machineIdentity;
  if (platform === "win32") {
    machineIdentity = readWindowsMachineIdentity();
  } else if (platform === "darwin") {
    machineIdentity = readMacMachineIdentity();
  } else if (platform === "linux") {
    machineIdentity = await readLinuxMachineIdentity();
  } else {
    throw new Error("هذا النظام غير مدعوم لتفعيل النسخة الأوفلاين.");
  }

  return deviceIdFromMachineIdentity(`${platform}:${machineIdentity}`);
}

module.exports = { deviceIdFromMachineIdentity, getDeviceId };
