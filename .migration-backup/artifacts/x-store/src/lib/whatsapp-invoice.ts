export function getWhatsAppDigits(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const ascii = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x660 && code <= 0x669 ? code - 0x660 : code - 0x6f0);
  });
  let phone = ascii.replace(/[()\s.-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;

  return phone.slice(1);
}

export function createWhatsAppInvoiceUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const digits = getWhatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
