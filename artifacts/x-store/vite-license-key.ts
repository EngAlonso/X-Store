import { createPrivateKey, createPublicKey } from "node:crypto";

export function offlineLicensePublicKeyDefine(options: { required?: boolean } = {}) {
  const privateKeyText = process.env.XSTORE_OFFLINE_LICENSE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();
  if (!privateKeyText) {
    if (options.required) {
      throw new Error(
        "XSTORE_OFFLINE_LICENSE_PRIVATE_KEY must contain a valid Ed25519 PKCS#8 private key.",
      );
    }
    return {
      __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(""),
    };
  }

  let privateKey;
  try {
    privateKey = createPrivateKey(privateKeyText);
  } catch {
    if (options.required) {
      throw new Error(
        "XSTORE_OFFLINE_LICENSE_PRIVATE_KEY must contain a valid Ed25519 PKCS#8 private key.",
      );
    }
    return {
      __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(""),
    };
  }

  if (privateKey.asymmetricKeyType !== "ed25519") {
    if (options.required) {
      throw new Error(
        "XSTORE_OFFLINE_LICENSE_PRIVATE_KEY must contain a valid Ed25519 PKCS#8 private key.",
      );
    }
    return {
      __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(""),
    };
  }

  const publicKey = createPublicKey(privateKey)
    .export({ format: "der", type: "spki" })
    .toString("base64");
  return {
    __XSTORE_OFFLINE_LICENSE_PUBLIC_KEY__: JSON.stringify(publicKey),
  };
}
