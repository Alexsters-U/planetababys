// Dispatch a clipboard paste; Cypress has no native default paste action.
// For allowed pastes, simulate the browser insertion with the native setter
// and input event so React and form validation receive the real new value.
export function pasteInput(selector: string, text: string, selectAll = false) {
  return cy.get(selector).then($input => {
    const field = $input[0] as HTMLInputElement;
    const win = field.ownerDocument.defaultView! as Window & typeof globalThis;
    field.focus();
    if (selectAll) field.select();
    const from = field.selectionStart ?? field.value.length;
    const to = field.selectionEnd ?? from;
    const clipboard = new win.DataTransfer();
    clipboard.setData("text/plain", text);
    const accepted = field.dispatchEvent(new win.ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
    if (accepted) {
      const next = field.value.slice(0, from) + text + field.value.slice(to);
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(field, next);
      field.setSelectionRange(from + text.length, from + text.length);
      field.dispatchEvent(new win.InputEvent("input", { bubbles: true, data: text, inputType: "insertFromPaste" }));
    }
    return accepted;
  });
}

export function autofillInput(selector: string, value: string) {
  return cy.get(selector).then($input => {
    const field = $input[0] as HTMLInputElement;
    const win = field.ownerDocument.defaultView! as Window & typeof globalThis;
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: value }));
  });
}
