import {z} from "zod";

// Los mensajes de negocio definidos en cada campo tienen prioridad.
z.config({customError:issue=>{
  switch(issue.code){
    case "invalid_type":return issue.input===undefined?"Este campo es obligatorio.":issue.expected==="number"||issue.expected==="int"?"Ingresa un número válido.":"Ingresa un valor válido.";
    case "invalid_format":return issue.format==="email"?"Ingresa un correo electrónico válido.":issue.format==="url"?"Ingresa una dirección web válida.":"Revisa el formato de este campo.";
    case "too_small":return issue.origin==="string"?`Ingresa al menos ${issue.minimum} caracteres.`:issue.origin==="array"?`Selecciona al menos ${issue.minimum} elemento(s).`:`Ingresa un valor ${issue.inclusive?"igual o mayor":"mayor"} que ${issue.minimum}.`;
    case "too_big":return issue.origin==="string"?`Ingresa como máximo ${issue.maximum} caracteres.`:issue.origin==="array"?`Selecciona como máximo ${issue.maximum} elemento(s).`:`Ingresa un valor ${issue.inclusive?"igual o menor":"menor"} que ${issue.maximum}.`;
    case "invalid_value":return "Selecciona una opción válida.";
    case "unrecognized_keys":return "Se recibieron campos no permitidos.";
    default:return "Revisa los datos ingresados.";
  }
}});
