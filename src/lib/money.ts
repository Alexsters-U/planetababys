/** Formato de dinero (COP, precios almacenados en centavos) */

export function formatCOP(cents: number): string {
  // Consistent COP text in SSR and browsers with different ICU versions.
  const absolute = Math.abs(cents);
  const pesos = Math.trunc(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = absolute % 100;
  return `${cents < 0 ? "-" : ""}$ ${pesos}${fraction ? "," + String(fraction).padStart(2, "0") : ""}`;
}

export function formatDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
