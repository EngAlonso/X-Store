const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildWindowsHardwareFingerprint,
  deviceIdFromMachineIdentity,
} = require("./device-id.cjs");

const baseHardware = {
  machineGuid: "01234567-89ab-4def-8123-456789abcdef",
  hardwareUuid: "10234567-89ab-4def-8123-456789abcdef",
  diskSerials: ["disk-serial-a"],
  memorySerials: ["memory-serial-a", "memory-serial-b"],
};

function fingerprint(hardware = baseHardware) {
  return buildWindowsHardwareFingerprint(hardware);
}

test("device IDs are stable and UUID-compatible for one machine identity", () => {
  const first = deviceIdFromMachineIdentity("windows:example-machine-guid");
  const second = deviceIdFromMachineIdentity("windows:example-machine-guid");

  assert.equal(first, second);
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("different machine identities produce different device IDs", () => {
  assert.notEqual(
    deviceIdFromMachineIdentity("windows:machine-one"),
    deviceIdFromMachineIdentity("windows:machine-two"),
  );
});

test("changing the board, disk, or RAM changes the device ID", () => {
  const original = fingerprint();
  assert.notEqual(
    fingerprint({ ...baseHardware, hardwareUuid: "20234567-89ab-4def-8123-456789abcdef" }).installationId,
    original.installationId,
  );
  assert.notEqual(
    fingerprint({ ...baseHardware, diskSerials: ["disk-serial-b"] }).installationId,
    original.installationId,
  );
  assert.notEqual(
    fingerprint({ ...baseHardware, memorySerials: ["memory-serial-a", "memory-serial-c"] }).installationId,
    original.installationId,
  );
});

test("hardware serial ordering does not change the device ID", () => {
  assert.deepEqual(
    fingerprint().deviceFingerprint,
    fingerprint({
      ...baseHardware,
      diskSerials: [...baseHardware.diskSerials].reverse(),
      memorySerials: [...baseHardware.memorySerials].reverse(),
    }).deviceFingerprint,
  );
});

test("component fingerprints are separate hashes and do not expose serials", () => {
  const result = fingerprint();
  assert.match(result.deviceFingerprint.windowsMachineGuid, /^[a-f0-9]{64}$/);
  assert.match(result.deviceFingerprint.motherboard, /^[a-f0-9]{64}$/);
  assert.match(result.deviceFingerprint.internalDisks[0], /^[a-f0-9]{64}$/);
  assert.match(result.deviceFingerprint.memoryModules[0], /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result.deviceFingerprint), /disk-serial|memory-serial/i);
});

test("missing or placeholder hardware serials fail closed", () => {
  assert.throws(
    () => buildWindowsHardwareFingerprint({ ...baseHardware, diskSerials: ["000000"] }),
    /الهارد الداخلي/,
  );
  assert.throws(
    () => buildWindowsHardwareFingerprint({ ...baseHardware, memorySerials: ["To Be Filled By O.E.M."] }),
    /الرامات/,
  );
  assert.throws(
    () => buildWindowsHardwareFingerprint({ ...baseHardware, memorySerials: [] }),
    /الرامات/,
  );
});

test("missing machine identity fails instead of falling back to app data", () => {
  assert.throws(() => deviceIdFromMachineIdentity("  "), /معرّف الجهاز/);
});
