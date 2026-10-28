import { createPrivateKey, createPublicKey } from "node:crypto";

export function offlineLicensePublicKeyDefine() {
  const privateKeyText = process.env.XSTORE_OFFLINE_LICENSE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();
  if (!privateKeyText) {
    return {
      __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(""),
    };
  }

  try {
    const privateKey = createPrivateKey(privateKeyText);
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new Error("Expected an Ed25519 key.");
    }
    const publicKey = createPublicKey(privateKey)
      .export({ format: "der", type: "spki" })
      .toString("base64");
    return {
      __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(publicKey),
    };
  } catch {
    throw new Error(
      "XSTORE_OFFLINE_LICENSE_PRIVATE_KEY must contain a valid Ed25519 private key.",
    );
  }
}
