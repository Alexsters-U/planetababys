/** Public business details confirmed by the owner; no payment credentials. */
export const POLICY_VERSION = "2026-10-08";
export const storeProfile = {
  name: "Yesica Lorena Zuluaga Trujillo",
  taxId: "1052406922",
  address: "Centro, 860001, Mocoa, Putumayo",
  email: "Planetababys2026@gmail.com",
  phone: "322 2447982",
};
export function contactWhatsApp(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("57") ? digits : "57" + digits}${message ? "?text=" + encodeURIComponent(message) : ""}`;
}
