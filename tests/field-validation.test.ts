import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutSchema, productCreateSchema, priceInputSchema, stockInputSchema, quantityInputSchema, LETTERS_PATTERN, PHONE_PATTERN, PRICE_PATTERN, INTEGER_PATTERN } from "../src/shared/validation";

const input = { items: [{ productId: "fixture", quantity: 1 }], customer: {
  name: "Ana María Gómez", phone: "3001234567", email: "ana302@example.com",
  city: "Mocoa", address: "Calle 12 # 5-34, apartamento 302", notes: "Entregar después de las 5, apto 302.",
}, dataConsent: true, termsAccepted: true };
const customer = (change: Partial<typeof input.customer>) => checkoutSchema.safeParse({ ...input, customer: { ...input.customer, ...change } });

test("Nombre y ciudad permiten letras Unicode y separadores, rechazan números", () => {
  for (const name of ["Ana María Gómez", "Juan D’Angelo", "Jose\u0301 Pérez", "María-José Muñoz"]) assert.equal(customer({ name }).success, true, name);
  for (const name of ["Ana123 Gómez", "Ana Gómez 2", "😀 Gómez", "... ...", "Ana <Gómez>"]) assert.equal(customer({ name }).success, false, name);
  for (const city of ["Mocoa", "Puerto Asís", "Bogotá D.C.", "Villagarzón"]) assert.equal(customer({ city }).success, true, city);
  for (const city of ["Mocoa123", "123", "...", "Otra ciudad"]) assert.equal(customer({ city }).success, false, city);
  const result = checkoutSchema.parse(input);
  assert.equal(result.customer.address, input.customer.address);
  assert.equal(result.customer.notes, input.customer.notes);
});

test("Teléfono valida antes de normalizar: formatos +57 válidos y letras rechazadas", () => {
  for (const phone of ["3001234567", "+57 300 123 4567", "573001234567", "(300) 123-4567"]) {
    const result = customer({ phone }); assert.equal(result.success, true, phone);
    if (result.success) assert.equal(result.data.customer.phone, "3001234567");
  }
  for (const phone of ["300abc1234567", "abc3001234567", "3001234567abc", "++573001234567", "2001234567", "300123456", "30012345678", "300.123.4567"]) assert.equal(customer({ phone }).success, false, phone);
});

test("Precio convierte pesos y centavos exactos sin borrar letras ni interpretar exponentes", () => {
  for (const [value, cents] of [["25000", 2500000], ["25000,50", 2500050], ["25000.50", 2500050], ["1,01", 101], ["20000000", 2000000000]] as const) assert.equal(priceInputSchema.parse(value), cents);
  for (const value of ["25abc", "abc25000", "1e3", "-25000", "+25000", "2.500", "25,000.50", "0,01", "20000000,01", "", "Infinity"]) assert.equal(priceInputSchema.safeParse(value).success, false, value);
});

test("Inventario y cantidades admiten solo enteros dentro de sus límites", () => {
  assert.equal(stockInputSchema.parse("0"), 0); assert.equal(stockInputSchema.parse("100000"), 100000);
  for (const value of ["7x", "1.5", "1e3", "-1", "+1", "", "100001"]) assert.equal(stockInputSchema.safeParse(value).success, false, value);
  assert.equal(quantityInputSchema.parse("1"), 1); assert.equal(quantityInputSchema.parse("50"), 50);
  for (const value of ["abc", "1e2", "1.5", "0", "51", "", "-1"]) assert.equal(quantityInputSchema.safeParse(value).success, false, value);
  const product = { name: "Pañales Etapa 2 (x40)", description: "Talla 2, paquete de 40 unidades.", priceCents: 2500050, stock: 7 };
  assert.equal(productCreateSchema.safeParse(product).success, true);
  for (const change of [{ priceCents: "2500050" }, { stock: "7" }, { stock: 1.5 }, { priceCents: 100.5 }]) assert.equal(productCreateSchema.safeParse({ ...product, ...change }).success, false);
});

test("Los patrones compartidos son válidos tanto con Unicode u como con HTML v", () => {
  for (const flag of ["u", "v"]) {
    for (const [pattern, valid, invalid] of [[LETTERS_PATTERN, "Ana María Gómez", "Ana123 Gómez"], [PHONE_PATTERN, "+57 300 123 4567", "300abc1234567"], [PRICE_PATTERN, "25000,50", "25abc"], [INTEGER_PATTERN, "7", "7x"]]) {
      const regex = new RegExp(`^(?:${pattern})$`, flag);
      assert.equal(regex.test(valid), true); assert.equal(regex.test(invalid), false);
    }
  }
});
