"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { isAllowedInputDraft, proposedInputValue, type InputRestriction } from "./input-restrictions";
import { updateSpanishValidation } from "./spanish-validation";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "onPaste" | "onCompositionStart" | "onCompositionEnd"> & {
  restriction: InputRestriction;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export default function RestrictedInput({ restriction, value, defaultValue = "", onValueChange, ...props }: Props) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const [compositionValue, setCompositionValue] = useState<string | null>(null);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const acceptedValue = value ?? localValue;

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    function beforeInput(event: InputEvent) {
      if (!field || composing.current || event.isComposing) return;
      selection.current = { start: field.selectionStart, end: field.selectionEnd };
      if (!event.inputType.startsWith("insert") || event.data === null) return;
      const candidate = proposedInputValue(field.value, field.selectionStart, field.selectionEnd, event.data);
      if (!isAllowedInputDraft(candidate, restriction)) event.preventDefault();
    }
    field.addEventListener("beforeinput", beforeInput);
    return () => field.removeEventListener("beforeinput", beforeInput);
  }, [restriction]);

  function commit(field: HTMLInputElement) {
    if (isAllowedInputDraft(field.value, restriction)) {
      if (value === undefined) setLocalValue(field.value);
      onValueChange?.(field.value);
    } else {
      // Autofill/non-cancelable input must also keep the last accepted value.
      field.value = acceptedValue;
      const start = Math.min(selection.current.start ?? acceptedValue.length, acceptedValue.length);
      const end = Math.min(selection.current.end ?? start, acceptedValue.length);
      field.setSelectionRange(start, end);
    }
    updateSpanishValidation(field);
  }

  return <input {...props} ref={inputRef} value={compositionValue ?? acceptedValue}
    onPaste={event => {
      const field = event.currentTarget;
      selection.current = { start: field.selectionStart, end: field.selectionEnd };
      const candidate = proposedInputValue(field.value, field.selectionStart, field.selectionEnd, event.clipboardData.getData("text"));
      // Reject the entire invalid paste instead of silently altering its data.
      if (!isAllowedInputDraft(candidate, restriction)) event.preventDefault();
    }}
    onChange={event => {
      if (composing.current) setCompositionValue(event.currentTarget.value);
      else commit(event.currentTarget);
    }}
    onCompositionStart={event => {
      composing.current = true;
      setCompositionValue(event.currentTarget.value);
    }}
    onCompositionEnd={event => {
      composing.current = false;
      setCompositionValue(null);
      commit(event.currentTarget);
    }} />;
}
