export const CATEGORY_LABELS: Record<string, string> = {
  panales: "Pañales y toallas",
  lactancia: "Lactancia",
  ropa: "Ropa",
  higiene: "Higiene",
  juguetes: "Juguetes",
  accesorios: "Accesorios",
  general: "General",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Recibido",
  PACKED: "Empacado",
  SHIPPED: "Enviado",
  VOIDED: "Anulado",
  DECLINED: "Rechazado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  DECLINED: "Rechazado",
  VOIDED: "Anulado",
  ERROR: "Error",
};

export function orderStatusLabel(s: string): string {
  return ORDER_STATUS_LABELS[s] ?? s;
}

export function paymentStatusLabel(s: string): string {
  return PAYMENT_STATUS_LABELS[s] ?? s;
}
