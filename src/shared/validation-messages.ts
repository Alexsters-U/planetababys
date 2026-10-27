import { z, type ZodErrorMap } from "zod";

// App-wide Spanish fallback for schema errors; explicit business messages win.
const spanishErrorMap: ZodErrorMap = issue => {
  let message = "Revisa los datos ingresados.";
  switch (issue.code) {
    case "invalid_type":
      message = issue.received === "undefined" ? "Este campo es obligatorio."
        : issue.expected === "number" || issue.expected === "integer" ? "Ingresa un número válido."
        : "Ingresa un valor válido.";
      break;
    case "invalid_string":
      message = issue.validation === "email" ? "Ingresa un correo electrónico válido."
        : issue.validation === "url" ? "Ingresa una dirección web válida." : "Revisa el formato de este campo.";
      break;
    case "too_small":
      message = issue.type === "string" ? `Ingresa al menos ${issue.minimum} caracteres.`
        : issue.type === "array" ? `Selecciona al menos ${issue.minimum} elemento(s).`
        : issue.type === "number" ? `Ingresa un valor ${issue.inclusive ? "igual o mayor" : "mayor"} que ${issue.minimum}.` : message;
      break;
    case "too_big":
      message = issue.type === "string" ? `Ingresa como máximo ${issue.maximum} caracteres.`
        : issue.type === "array" ? `Selecciona como máximo ${issue.maximum} elemento(s).`
        : issue.type === "number" ? `Ingresa un valor ${issue.inclusive ? "igual o menor" : "menor"} que ${issue.maximum}.` : message;
      break;
    case "invalid_enum_value": case "invalid_literal":
      message = "Selecciona una opción válida.";
      break;
    case "unrecognized_keys":
      message = "Se recibieron campos no permitidos.";
      break;
    case "not_finite":
      message = "Ingresa un número válido.";
      break;
  }
  return { message };
};

z.setErrorMap(spanishErrorMap);
