import { COUNTRIES, guessCountry } from "@/components/PhoneOtp";

/* Split a stored E.164 number ("+19995550123") into [dialCode, nationalNumber] using the known country list. */
export const splitPhone = (phone) => {
  if (!phone) return [guessCountry(), ""];
  const codes = COUNTRIES.map((c) => c[0]).sort((a, b) => b.length - a.length);
  const cc = codes.find((c) => phone.startsWith(c));
  return cc ? [cc, phone.slice(cc.length)] : [guessCountry(), phone.replace(/^\+/, "")];
};

/* "+19995550123" -> "+1 999 555 0123" (groups of 3, last group keeps the remainder). */
export const formatPhone = (phone) => {
  if (!phone) return "";
  const [cc, rest] = splitPhone(phone);
  const groups = [];
  let i = 0;
  while (i < rest.length) {
    const left = rest.length - i;
    const take = left <= 4 ? left : 3;
    groups.push(rest.slice(i, i + take));
    i += take;
  }
  return `${cc} ${groups.join(" ")}`.trim();
};
