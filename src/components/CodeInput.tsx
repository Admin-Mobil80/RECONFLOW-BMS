import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface Props {
  /** Digits entered so far, at most `length` of them. */
  value: string;
  onChange(value: string): void;
  /** Called once when the last digit lands, with the full code. */
  onComplete?(value: string): void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * One box per digit: digits only, auto-advance, backspace steps back, a pasted
 * code fills every box. The boxes are real inputs so the browser's own
 * one-time-code autofill (from SMS or Mail) works on the first one.
 */
export default function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
}: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.replace(/\D/g, "").slice(0, length);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    const focusIndex = Math.min(clean.length, length - 1);
    boxes.current[focusIndex]?.focus();
    if (clean.length === length && clean !== digits) onComplete?.(clean);
  }

  function handleInput(index: number, raw: string) {
    // A box only ever holds one digit, but autofill and some keyboards
    // deliver several at once; treat any multi-character input as a paste.
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    if (typed.length > 1) {
      commit(digits.slice(0, index) + typed);
      return;
    }
    commit(digits.slice(0, index) + typed + digits.slice(index + 1));
  }

  function handleKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        commit(digits.slice(0, index) + digits.slice(index + 1));
        boxes.current[index]?.focus();
      } else if (index > 0) {
        commit(digits.slice(0, index - 1) + digits.slice(index));
        boxes.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    commit(event.clipboardData.getData("text"));
  }

  return (
    <div className="code-input" role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${index + 1}`}
          value={digits[index] ?? ""}
          disabled={disabled}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKey(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
