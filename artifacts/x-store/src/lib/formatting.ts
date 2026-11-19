export const APP_NUMBER_LOCALE = 'ar-EG-u-nu-latn';
export const APP_SAUDI_DATE_LOCALE = 'ar-SA-u-nu-latn';
export const APP_EGYPT_DATE_LOCALE = 'ar-EG-u-nu-latn';

export function latinizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const offset = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - offset);
  });
}
