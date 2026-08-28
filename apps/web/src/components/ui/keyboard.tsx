import { Delete } from "lucide-react";
import styles from "./ui.module.css";

const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

export function Keyboard() {
  return (
    <div className={styles.keyboard} aria-label="On-screen keyboard">
      {rows.map((row, rowIndex) => (
        <div className={styles.keyRow} key={row}>
          {rowIndex === 2 ? (
            <button className={styles.keyWide} type="button">
              Enter
            </button>
          ) : null}
          {row.split("").map((letter) => (
            <button className={styles.key} type="button" key={letter} aria-label={letter}>
              {letter}
            </button>
          ))}
          {rowIndex === 2 ? (
            <button className={styles.keyWide} type="button" aria-label="Erase">
              <Delete aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
