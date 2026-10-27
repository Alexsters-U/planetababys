import type { SyntheticEvent } from "react";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function updateSpanishValidation(field: Field) {
  // Remove our previous message before reading native constraints again.
  field.setCustomValidity("");
  if (!field.willValidate) return;
  const validity = field.validity;
  const type = field instanceof HTMLInputElement ? field.type : "";
  const textField = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement;
  // Check declared length limits for edited/autofilled values as well.
  const tooShort = validity.tooShort || (textField && field.value.length > 0 && field.minLength > 0 && field.value.length < field.minLength);
  const tooLong = validity.tooLong || (textField && field.maxLength >= 0 && field.value.length > field.maxLength);
  let message = "";
  if (validity.valueMissing) {
    message = field.dataset.requiredMessage ?? (type === "checkbox" ? "Marca esta casilla para continuar."
      : type === "radio" || field instanceof HTMLSelectElement ? "Selecciona una opción."
      : "Completa este campo.");
  } else if (validity.badInput) message = "Ingresa un número válido.";
  else if (validity.typeMismatch) message = type === "email" ? "Ingresa un correo electrónico válido." : "Ingresa una dirección web válida.";
  else if (tooShort) message = `Ingresa al menos ${field.getAttribute("minlength")} caracteres.`;
  else if (tooLong) message = `Ingresa como máximo ${field.getAttribute("maxlength")} caracteres.`;
  else if (validity.rangeUnderflow) message = `Ingresa un valor igual o mayor que ${field.getAttribute("min")}.`;
  else if (validity.rangeOverflow) message = `Ingresa un valor igual o menor que ${field.getAttribute("max")}.`;
  else if (validity.stepMismatch) message = "Ingresa un valor válido para este campo.";
  else if (validity.patternMismatch) message = field.dataset.formatMessage ?? "Revisa el formato de este campo.";
  field.setCustomValidity(message);
  field.setAttribute("aria-invalid", message ? "true" : "false");
}

function localizeValidation(event: SyntheticEvent<HTMLFormElement>) {
  const field = event.target;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) updateSpanishValidation(field);
}

// Capture invalid (it does not bubble natively), and update after edits/autofill.
export const spanishValidation = {
  onInvalidCapture: localizeValidation,
  onInputCapture: localizeValidation,
  onChangeCapture: localizeValidation,
};
