import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { productUpdateSchema } from "../src/shared/validation";
import { isAllowedOrigin } from "../backend/src/security";
import { config } from "../backend/src/config";
import { db as securityDb } from "../backend/src/db";

if (process.env.APP_ENV !== "test" || !process.env.DATABASE_URL?.includes("/planetababys_test?")) throw new Error("Se requiere la base aislada planetababys_test");
const db = new PrismaClient();
const host = process.env.SITE_URL??"http://localhost:3100";
const prefix = "paginacion-" + randomUUID();
const ids = Array.from({ length: 325 }, () => randomUUID());
const orderIds = Array.from({ length: 31 }, () => randomUUID());
let cookie = "";
type Page = { products: { id: string; name: string; category: string; stock: number; priceCents: number; isActive: boolean }[]; total: number; page: number; pages: number; pageSize: number };
async function request(route: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return fetch(host + "/api" + route, { method, headers: { Origin: host, Cookie: cookie, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function products(query = "") {
  const response = await request("/admin/products?q=" + prefix + query);
  assert.equal(response.status, 200);
  return await response.json() as Page;
}
before(async () => {
  const response = await request("/auth/login", "POST", { email: "test@admin.com", password: "password" });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  cookie = header.split(";")[0];
  const createdAt = new Date();
  await db.product.createMany({ data: ids.map((id, i) => ({ id, slug: prefix + "-" + i, name: prefix + " " + String(i).padStart(3, "0"), priceCents: 10000 + i * 100, stock: i % 10, category: i % 2 ? "panales" : "ropa", isActive: false, createdAt })) });
  await db.order.createMany({ data: orderIds.map((id, i) => ({ id, reference: prefix + "-pedido-" + i, status: i % 2 ? "PAID" : "DELIVERED", totalCents: 10000, customerName: "Cliente Sintético", customerEmail: "fixture@example.com", customerPhone: "3001234567", shippingAddress: "Dirección de prueba", shippingCity: "Mocoa", stockReleased: true, createdAt })) });
});
after(async () => {
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  assert.equal(await db.product.count({ where: { id: { in: ids } } }), 0);
  assert.equal(await db.order.count({ where: { id: { in: orderIds } } }), 0);
  console.log("Limpieza verificada: 325 productos y 31 pedidos sintéticos eliminados por ID exacto.");
  await db.$disconnect();
  await securityDb.$disconnect();
});
test("325 productos: 13 páginas de 25 sin duplicados, orden estable con fechas iguales", async () => {
  const seen = new Set<string>();
  for (let page = 1; page <= 13; page++) {
    const result = await products("&page=" + page);
    assert.equal(result.total, 325); assert.equal(result.pages, 13); assert.equal(result.page, page); assert.equal(result.pageSize, 25);
    assert.equal(result.products.length, 25);
    for (const product of result.products) { assert.ok(!seen.has(product.id)); seen.add(product.id); }
  }
  assert.equal(seen.size, 325);
  assert.deepEqual([...seen].sort(), [...ids].sort());
  const first = await products();
  assert.deepEqual(first.products.map(p => p.id), (await products()).products.map(p => p.id));
});
test("Tamaño 100, última página, página fuera de rango y búsqueda vacía", async () => {
  const last = await products("&pageSize=100&page=999");
  assert.equal(last.pages, 4); assert.equal(last.page, 4); assert.equal(last.products.length, 25);
  const response = await request("/admin/products?q=" + prefix + "inexistente&page=500");
  const empty = await response.json() as Page;
  assert.equal(empty.total, 0); assert.equal(empty.pages, 1); assert.equal(empty.page, 1); assert.deepEqual(empty.products, []);
});
test("Filtros combinados de categoría, visibilidad, stock y búsqueda insensible a mayúsculas", async () => {
  const result = await products("&category=panales&visibility=hidden&stock=low&pageSize=100");
  const expected = await db.product.count({ where: { id: { in: ids }, category: "panales", isActive: false, stock: { gt: 0, lte: 5 } } });
  assert.equal(result.total, expected);
  for (const product of result.products) { assert.equal(product.category, "panales"); assert.equal(product.isActive, false); assert.ok(product.stock > 0 && product.stock <= 5); }
  assert.equal((await products("&visibility=visible")).total, 0);
  const upper = await request("/admin/products?q=" + prefix.toUpperCase());
  assert.equal((await upper.json()).total, 325);
  const zero = await products("&stock=empty&pageSize=100");
  assert.equal(zero.total, 33); assert.ok(zero.products.every(p => p.stock === 0));
});
test("Orden por precio y nombre y límites de parámetros", async () => {
  const asc = await products("&sort=priceAsc"), desc = await products("&sort=priceDesc");
  assert.equal(asc.products[0].priceCents, 10000); assert.equal(desc.products[0].priceCents, 42400);
  const byName = await products("&sort=name"); assert.match(byName.products[0].name, /000$/);
  for (const query of ["page=0", "pageSize=500", "category=foo", "visibility=foo", "stock=foo", "sort=foo", "q=" + "a".repeat(101)]) assert.equal((await request("/admin/products?" + query)).status, 422);
  assert.equal((await fetch(host + "/api/admin/products")).status, 401);
});
test("Pedidos: búsqueda, estado y paginación en servidor", async () => {
  let response = await request("/admin/orders?q=" + prefix + "&pageSize=10&page=99");
  let result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.total, 31); assert.equal(result.pages, 4); assert.equal(result.page, 4); assert.equal(result.orders.length, 1);
  response = await request("/admin/orders?q=" + prefix + "&status=PAID&pageSize=100");
  result = await response.json(); assert.equal(result.total, 15); assert.ok(result.orders.every((o: { status: string }) => o.status === "PAID"));
  assert.equal((await request("/admin/orders?status=INVALID")).status, 422);
});
test("Origen local: localhost, 127.0.0.1 y IPv6; sitios externos y otros puertos bloqueados", async () => {
  for (const origin of [host, `http://127.0.0.1:${new URL(host).port}`, `http://[::1]:${new URL(host).port}`]) {
    assert.ok(isAllowedOrigin(origin));
    assert.equal((await request("/auth/logout", "POST", undefined, { Origin: origin, Cookie: "" })).status, 200);
  }
  for (const origin of ["http://localhost:3000", "https://localhost:3100", "https://evil.example", "http://localhost.evil.example:3100", "null", ""]) {
    assert.equal((await request("/auth/logout", "POST", undefined, { Origin: origin, Cookie: "" })).status, 403);
  }
  assert.equal((await request("/auth/logout", "POST", undefined, { "Sec-Fetch-Site": "cross-site", Cookie: "" })).status, 403);
  const denied = await request("/auth/logout", "POST", undefined, { Origin: "http://localhost:3000", Cookie: "" });
  assert.ok((await denied.json()).error.includes(host));
  const previous = config.APP_ENV;
  try { config.APP_ENV = "production"; assert.ok(isAllowedOrigin(host)); assert.equal(isAllowedOrigin("http://127.0.0.1:3100"), false); }
  finally { config.APP_ENV = previous; }
});
test("Login real por proxy desde 127.0.0.1: cookie y acceso autenticado", async () => {
  const alias = host.replace("localhost","127.0.0.1");
  const response = await fetch(alias + "/api/auth/login", { method: "POST", headers: { Origin: alias, "Content-Type": "application/json" }, body: JSON.stringify({ email: "test@admin.com", password: "password" }) });
  assert.equal(response.status, 200);
  const token = response.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await fetch(alias + "/api/auth/me", { headers: { Cookie: token } })).status, 200);
  const panel = await fetch(alias + "/admin/productos", { headers: { Cookie: token }, redirect: "manual" });
  assert.equal(panel.status, 200);
});
test("Edición: acepta fotos del branding; rechaza rutas externas y traversal", () => {
  assert.ok(productUpdateSchema.safeParse({ imageUrl: "/images/products/branding-2026-10-02/tetero.webp" }).success);
  for (const imageUrl of ["https://evil.example/image.webp", "/images/products/../secret.webp", "/images/products/branding-2026-10-02/../../secret.webp"]) assert.equal(productUpdateSchema.safeParse({ imageUrl }).success, false);
});
