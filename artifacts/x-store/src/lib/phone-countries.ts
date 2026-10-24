export type PhoneCountry = {
  countryCode: string;
  name: string;
  callingCode: string;
  nationalTrunkPrefix?: string;
};

export const phoneCountries: PhoneCountry[] = [
  { countryCode: "EG", name: "مصر", callingCode: "20", nationalTrunkPrefix: "0" },
  { countryCode: "SA", name: "السعودية", callingCode: "966", nationalTrunkPrefix: "0" },
  { countryCode: "AE", name: "الإمارات", callingCode: "971", nationalTrunkPrefix: "0" },
  { countryCode: "KW", name: "الكويت", callingCode: "965", nationalTrunkPrefix: "0" },
  { countryCode: "QA", name: "قطر", callingCode: "974", nationalTrunkPrefix: "0" },
  { countryCode: "BH", name: "البحرين", callingCode: "973", nationalTrunkPrefix: "0" },
  { countryCode: "OM", name: "عُمان", callingCode: "968", nationalTrunkPrefix: "0" },
  { countryCode: "JO", name: "الأردن", callingCode: "962", nationalTrunkPrefix: "0" },
  { countryCode: "PS", name: "فلسطين", callingCode: "970", nationalTrunkPrefix: "0" },
  { countryCode: "LB", name: "لبنان", callingCode: "961", nationalTrunkPrefix: "0" },
  { countryCode: "IQ", name: "العراق", callingCode: "964", nationalTrunkPrefix: "0" },
  { countryCode: "YE", name: "اليمن", callingCode: "967", nationalTrunkPrefix: "0" },
  { countryCode: "SY", name: "سوريا", callingCode: "963", nationalTrunkPrefix: "0" },
  { countryCode: "MA", name: "المغرب", callingCode: "212", nationalTrunkPrefix: "0" },
  { countryCode: "DZ", name: "الجزائر", callingCode: "213", nationalTrunkPrefix: "0" },
  { countryCode: "TN", name: "تونس", callingCode: "216", nationalTrunkPrefix: "0" },
  { countryCode: "LY", name: "ليبيا", callingCode: "218", nationalTrunkPrefix: "0" },
  { countryCode: "SD", name: "السودان", callingCode: "249", nationalTrunkPrefix: "0" },
  { countryCode: "US", name: "الولايات المتحدة", callingCode: "1" },
  { countryCode: "CA", name: "كندا", callingCode: "1" },
  { countryCode: "GB", name: "المملكة المتحدة", callingCode: "44", nationalTrunkPrefix: "0" },
  { countryCode: "FR", name: "فرنسا", callingCode: "33", nationalTrunkPrefix: "0" },
  { countryCode: "DE", name: "ألمانيا", callingCode: "49", nationalTrunkPrefix: "0" },
  { countryCode: "IT", name: "إيطاليا", callingCode: "39", nationalTrunkPrefix: "0" },
  { countryCode: "ES", name: "إسبانيا", callingCode: "34" },
  { countryCode: "TR", name: "تركيا", callingCode: "90", nationalTrunkPrefix: "0" },
  { countryCode: "PK", name: "باكستان", callingCode: "92" },
  { countryCode: "IN", name: "الهند", callingCode: "91" },
];

export function getPhoneCountry(countryCode: string | null | undefined): PhoneCountry {
  return phoneCountries.find((country) => country.countryCode === countryCode) ?? phoneCountries[0]!;
}

function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x660 && code <= 0x669 ? code - 0x660 : code - 0x6f0);
  });
}

export function phoneNumberForCountry(countryCode: string, value: string): string {
  const normalized = asciiDigits(value.trim()).replace(/[()\s.-]/g, "");
  if (!normalized) return "";
  if (normalized.startsWith("+")) return `+${normalized.slice(1).replace(/\D/g, "")}`;
  if (normalized.startsWith("00")) return `+${normalized.slice(2).replace(/\D/g, "")}`;

  const country = getPhoneCountry(countryCode);
  let nationalNumber = normalized.replace(/\D/g, "");
  if (country.nationalTrunkPrefix && nationalNumber.startsWith(country.nationalTrunkPrefix)) {
    nationalNumber = nationalNumber.slice(country.nationalTrunkPrefix.length);
  }
  return nationalNumber ? `+${country.callingCode}${nationalNumber}` : "";
}

export function splitInternationalPhone(value: string | null | undefined): {
  countryCode: string | null;
  nationalNumber: string;
} {
  if (!value?.trim()) return { countryCode: null, nationalNumber: "" };

  const normalized = asciiDigits(value.trim()).replace(/[()\s.-]/g, "");
  const international = normalized.startsWith("00")
    ? `+${normalized.slice(2)}`
    : normalized;
  if (!international.startsWith("+")) {
    return { countryCode: null, nationalNumber: value };
  }

  const digits = international.slice(1).replace(/\D/g, "");
  const country = [...phoneCountries]
    .sort((left, right) => right.callingCode.length - left.callingCode.length)
    .find((candidate) => digits.startsWith(candidate.callingCode));
  if (!country) return { countryCode: null, nationalNumber: value };

  return {
    countryCode: country.countryCode,
    nationalNumber: digits.slice(country.callingCode.length),
  };
}
