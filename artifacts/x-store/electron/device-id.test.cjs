const assert = require("node:assert/strict");
const test = require("node:test");
const { deviceIdFromMachineIdentity } = require("./device-id.cjs");

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

test("missing machine identity fails instead of falling back to app data", () => {
  assert.throws(() => deviceIdFromMachineIdentity("  "), /معرّف الجهاز/);
});
