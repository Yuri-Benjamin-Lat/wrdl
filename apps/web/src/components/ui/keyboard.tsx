import { Delete } from "lucide-react";
import styles from "./ui.module.css";

const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

type KeyState = "correct" | "present" | "absent";

export function Keyboard({
  onKey,
  letterStates = {},
  disabled = false,
}: {
  onKey?: (key: string) => void;
  letterStates?: Readonly<Record<string, KeyState>>;
  disabled?: boolean;
}) {
  return (
    <div className={styles.keyboard} aria-label="On-screen keyboard">
      {rows.map((row, rowIndex) => (
        <div className={styles.keyRow} key={row}>
          {rowIndex === 2 ? (
            <button
              className={styles.keyWide}
              type="button"
              disabled={disabled}
              onClick={() => onKey?.("Enter")}
            >
              Enter
            </button>
          ) : null}
          {row.split("").map((letter) => {
            const state = letterStates[letter.toLocaleLowerCase("en-US")];
            return (
              <button
                className={`${styles.key} ${state ? styles[`key${state}`] : ""}`}
                type="button"
                key={letter}
                aria-label={letter}
                disabled={disabled}
                onClick={() => onKey?.(letter)}
              >
                {letter}
              </button>
            );
          })}
          {rowIndex === 2 ? (
            <button
              className={styles.keyWide}
              type="button"
              aria-label="Erase"
              disabled={disabled}
              onClick={() => onKey?.("Backspace")}
            >
              <Delete aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
