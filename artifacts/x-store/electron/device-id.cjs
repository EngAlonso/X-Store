const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");

function deviceIdFromMachineIdentity(machineIdentity) {
  if (typeof machineIdentity !== "string" || !machineIdentity.trim()) {
    throw new Error("تعذر قراءة معرّف الجهاز.");
  }

  const digest = crypto
    .createHash("sha256")
    .update(`com.xstore.offline/device-id/v2\0${machineIdentity.trim().toLowerCase()}`)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isValidHardwareUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value) &&
    !/^f{8}-f{4}-f{4}-f{4}-f{12}$/i.test(value);
}

function normalizeHardwareSerial(value, component) {
  const serial = String(value ?? "").trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (
    !serial ||
    /^(?:0+|F+|UNKNOWN|NONE|NA|NOTAVAILABLE|DEFAULTSTRING|SYSTEMSERIALNUMBER|TOBEFILLEDBYOEM|SERIALNUMBER|UNSPECIFIED|123456789)$/i.test(serial)
  ) {
    throw new Error(`تعذر قراءة الرقم التسلسلي لـ${component}. لن يتم تفعيل البرنامج على هذا الجهاز.`);
  }
  return serial;
}

function normalizeSerialList(value, component) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  if (values.length === 0) {
    throw new Error(`تعذر قراءة الرقم التسلسلي لـ${component}. لن يتم تفعيل البرنامج على هذا الجهاز.`);
  }
  return values.map((serial) => normalizeHardwareSerial(serial, component)).sort();
}

function buildWindowsMachineIdentity({
  machineGuid,
  hardwareUuid,
  diskSerials,
  memorySerials,
}) {
  const normalizedMachineGuid = String(machineGuid ?? "").trim().replace(/[{}]/g, "");
  const normalizedHardwareUuid = String(hardwareUuid ?? "").trim().replace(/[{}]/g, "");
  if (!isValidHardwareUuid(normalizedMachineGuid) || !isValidHardwareUuid(normalizedHardwareUuid)) {
    throw new Error("تعذر قراءة معرّفات البوردة وWindows. لن يتم تفعيل البرنامج على هذا الجهاز.");
  }

  const disks = normalizeSerialList(diskSerials, "الهارد الداخلي");
  const memory = normalizeSerialList(memorySerials, "الرامات");
  return [
    `windows-guid:${normalizedMachineGuid.toLowerCase()}`,
    `firmware-uuid:${normalizedHardwareUuid.toLowerCase()}`,
    `disk-serials:${JSON.stringify(disks)}`,
    `memory-serials:${JSON.stringify(memory)}`,
  ].join("|");
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

  let hardware;
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        [
          "$ErrorActionPreference = 'Stop'",
          "$board = (Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction Stop).UUID",
          "$disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction Stop | Where-Object { $_.InterfaceType -ne 'USB' -and $_.PNPDeviceID -notmatch 'USBSTOR' } | ForEach-Object { [string]$_.SerialNumber })",
          "$memory = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction Stop | ForEach-Object { [string]$_.SerialNumber })",
          "[PSCustomObject]@{ hardwareUuid = $board; diskSerials = $disks; memorySerials = $memory } | ConvertTo-Json -Compress -Depth 4",
        ].join("; "),
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    hardware = JSON.parse(output.trim());
  } catch {
    throw new Error("تعذر قراءة بيانات البوردة والهارد والرامات من Windows. لن يتم تفعيل البرنامج على هذا الجهاز.");
  }

  return buildWindowsMachineIdentity({
    machineGuid,
    hardwareUuid: hardware?.hardwareUuid,
    diskSerials: hardware?.diskSerials,
    memorySerials: hardware?.memorySerials,
  });
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

module.exports = {
  buildWindowsMachineIdentity,
  deviceIdFromMachineIdentity,
  getDeviceId,
};
