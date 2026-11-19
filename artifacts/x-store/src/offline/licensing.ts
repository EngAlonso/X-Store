import {
  isOfflineLicense,
  OFFLINE_LICENSE_PLANS,
  type OfflineHardwareChange,
  type OfflineHardwareFingerprint,
  type OfflineHardwareSnapshot,
  type OfflineLicense,
  type OfflineLicensePayload,
} from "./model";

declare const __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: string;

export interface OfflineActivationRequest {
  format: "xstore-offline-activation-request";
  version: 2;
  installationId: string;
  deviceFingerprint: OfflineHardwareFingerprint;
  storeName: string;
  requestedAt: string;
}

export function createOfflineActivationRequest(
  device: OfflineHardwareSnapshot,
  storeName: string,
): OfflineActivationRequest {
  return {
    format: "xstore-offline-activation-request",
    version: 2,
    installationId: device.installationId,
    deviceFingerprint: canonicalizeHardwareFingerprint(device.deviceFingerprint),
    storeName: storeName.trim(),
    requestedAt: new Date().toISOString(),
  };
}

export function serializeOfflineLicensePayload(payload: OfflineLicensePayload): string {
  const signedPayload = {
    version: payload.version,
    licenseId: payload.licenseId,
    installationId: payload.installationId,
    ...(payload.version === 2 && payload.deviceFingerprint
      ? { deviceFingerprint: canonicalizeHardwareFingerprint(payload.deviceFingerprint) }
      : {}),
    storeName: payload.storeName,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  return JSON.stringify(signedPayload);
}

export async function readAndVerifyOfflineLicense(
  file: File,
  currentDevice: OfflineHardwareSnapshot,
): Promise<OfflineLicense> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("ملف التفعيل ليس بصيغة JSON صالحة.");
  }
  if (!isOfflineLicense(parsed)) {
    throw new Error("ملف التفعيل غير صالح أو غير متوافق.");
  }
  if (!OFFLINE_LICENSE_PLANS.includes(parsed.payload.plan)) {
    throw new Error("خطة الترخيص غير مدعومة.");
  }
  await verifyOfflineLicense(parsed, currentDevice);
  return parsed;
}

export async function verifyOfflineLicense(
  license: OfflineLicense,
  currentDevice: OfflineHardwareSnapshot,
): Promise<void> {
  await verifyOfflineLicenseSignature(license);
  const changes = getOfflineLicenseDeviceChanges(license, currentDevice);
  if (changes.length > 0) {
    throw new Error(`ملف التفعيل لا يطابق هذا الجهاز. التغييرات: ${changes.map(hardwareChangeLabel).join("، ")}.`);
  }
}

export async function verifyOfflineLicenseSignature(license: OfflineLicense): Promise<void> {
  if (!isOfflineLicense(license)) {
    throw new Error("ملف التفعيل غير صالح أو غير متوافق.");
  }
  const publicKey = typeof __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__ === "string"
    ? __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__
    : "";
  if (!publicKey) {
    throw new Error("مفتاح التحقق غير مهيأ. أعد بناء نسخة البرنامج بعد إعداد مفتاح الترخيص.");
  }

  try {
    const key = await crypto.subtle.importKey(
      "spki",
      decodeBase64(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      decodeBase64(license.signature),
      new TextEncoder().encode(serializeOfflineLicensePayload(license.payload)),
    );
    if (!valid) throw new Error("التوقيع غير مطابق.");
  } catch (error) {
    if (error instanceof Error && error.message === "التوقيع غير مطابق.") {
      throw new Error("ملف التفعيل غير موثوق أو تم تعديله.");
    }
    throw new Error("تعذر التحقق من ملف التفعيل. تأكد من إعداد مفتاح الترخيص.");
  }

  if (Date.parse(license.payload.issuedAt) > Date.now() + 5 * 60 * 1000) {
    throw new Error("تاريخ إصدار ملف التفعيل لاحق لتاريخ هذا الجهاز.");
  }
}

export function getOfflineLicenseDeviceChanges(
  license: OfflineLicense,
  currentDevice: OfflineHardwareSnapshot,
): OfflineHardwareChange[] {
  const expected = license.payload.deviceFingerprint;
  if (license.payload.version !== 2 || !expected) return ["baseline"];

  const changes: OfflineHardwareChange[] = [];
  const current = currentDevice.deviceFingerprint;
  if (expected.windowsMachineGuid !== current.windowsMachineGuid) changes.push("windows");
  if (expected.motherboard !== current.motherboard) changes.push("motherboard");
  if (!sameSortedValues(expected.internalDisks, current.internalDisks)) changes.push("internalDisks");
  if (!sameSortedValues(expected.memoryModules, current.memoryModules)) changes.push("memoryModules");
  if (license.payload.installationId !== currentDevice.installationId && changes.length === 0) {
    changes.push("installationId");
  }
  return changes;
}

export function hardwareChangeLabel(change: OfflineHardwareChange): string {
  switch (change) {
    case "windows": return "Windows أو إعادة تثبيته";
    case "motherboard": return "البوردة";
    case "internalDisks": return "الهارد الداخلي";
    case "memoryModules": return "الرامات";
    case "installationId": return "معرّف الجهاز";
    case "baseline": return "الرخصة قديمة ولا تحتوي على تقرير القطع";
  }
}

export function downloadOfflineActivationRequest(
  request: OfflineActivationRequest,
): void {
  const blob = new Blob([`${JSON.stringify(request, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `x-store-activation-request-${request.installationId.slice(0, 8)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canonicalizeHardwareFingerprint(
  fingerprint: OfflineHardwareFingerprint,
): OfflineHardwareFingerprint {
  return {
    version: 1,
    windowsMachineGuid: fingerprint.windowsMachineGuid,
    motherboard: fingerprint.motherboard,
    internalDisks: [...fingerprint.internalDisks].sort(),
    memoryModules: [...fingerprint.memoryModules].sort(),
  };
}

function sameSortedValues(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index]);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
