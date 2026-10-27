import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedInputDraft as allowed, proposedInputValue } from "../src/shared/forms/input-restrictions";

test("La edición de nombre conserva tildes, ñ, apóstrofes y marcas combinadas", () => {
  for (const value of ["", "Ana María Muñoz", "Juan D'Angelo", "María-José D’Angelo.", "Jose\u0301", "Ana "]) assert.equal(allowed(value, "letters"), true, value);
  for (const value of ["Ana123", "Mocoa2", "😀", "Ana@", "123", "Ana\nGómez"]) assert.equal(allowed(value, "letters"), false, value);
});
test("La edición numérica permite borrar y terminar un decimal, sin letras ni exponentes", () => {
  for (const value of ["", "0", "25000", "25000,", "25000.", "25000,50", "25000.50"]) assert.equal(allowed(value, "decimal"), true, value);
  for (const value of ["25abc", "1e3", "-1", "+1", "2.500", "1,2.3", ".5", " 25"]) assert.equal(allowed(value, "decimal"), false, value);
  for (const value of ["", "0", "7", "100000"]) assert.equal(allowed(value, "integer"), true, value);
  for (const value of ["7x", "1e3", "1.5", "-1", "+1", "7 "]) assert.equal(allowed(value, "integer"), false, value);
});
test("Teléfono admite formato editable de +57, pero nunca letras", () => {
  for (const value of ["", "+", "+57", "+57 300 123 4567", "(+57) 300-123-4567", "(300) 123-4567"]) assert.equal(allowed(value, "phone"), true, value);
  for (const value of ["300abc1234567", "++57", "300+1234567", "300.123.4567"]) assert.equal(allowed(value, "phone"), false, value);
});
test("Se valida el reemplazo completo del rango seleccionado al escribir o pegar", () => {
  assert.equal(proposedInputValue("25000,50", 6, 8, "75"), "25000,75");
  assert.equal(allowed(proposedInputValue("25000,50", 6, 8, "75"), "decimal"), true);
  assert.equal(allowed(proposedInputValue("25000,50", 8, 8, "9"), "decimal"), false);
  assert.equal(proposedInputValue("Ana Gómez", 0, 3, "María"), "María Gómez");
  assert.equal(allowed(proposedInputValue("Ana Gómez", 0, 3, "Ana123"), "letters"), false);
});
