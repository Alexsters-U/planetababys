export type InputRestriction = "letters" | "phone" | "decimal" | "integer";

// Editing permits empty/incomplete values; required, format and ranges are
// checked separately by the existing Spanish validation and API schemas.
const drafts: Record<InputRestriction, RegExp> = {
  letters: /^[\p{L}\p{M}\p{Zs}.'’\-]*$/u,
  phone: /^[ ()\-]*\+?[0-9 ()\-]*$/u,
  decimal: /^(?:[0-9]+(?:[.,][0-9]{0,2})?)?$/u,
  integer: /^[0-9]*$/u,
};

export function isAllowedInputDraft(value: string, restriction: InputRestriction) {
  return drafts[restriction].test(value);
}

export function proposedInputValue(value: string, start: number | null, end: number | null, inserted: string) {
  const from = start ?? value.length;
  const to = end ?? from;
  return value.slice(0, from) + inserted + value.slice(to);
}
