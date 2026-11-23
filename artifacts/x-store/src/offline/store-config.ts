import { OFFLINE_STORE_TYPES, type OfflineStoreType } from "./model";

const configured = String(import.meta.env.VITE_OFFLINE_STORE_TYPE ?? "").trim();

export const CONFIGURED_OFFLINE_STORE_TYPE: OfflineStoreType =
  OFFLINE_STORE_TYPES.some((item) => item.value === configured)
    ? (configured as OfflineStoreType)
    : "clothing_shoes";

export function getConfiguredOfflineStoreType(): OfflineStoreType {
  return CONFIGURED_OFFLINE_STORE_TYPE;
}

export function getConfiguredOfflineStoreLabel(): string {
  return OFFLINE_STORE_TYPES.find((item) => item.value === CONFIGURED_OFFLINE_STORE_TYPE)?.label ?? "ملابس وأحذية";
}
