import { UserRound } from "lucide-react";
import styles from "./ui.module.css";

export function Avatar({ name, size = "medium" }: { name: string; size?: "small" | "medium" }) {
  return (
    <span
      className={`${styles.avatar} ${styles[`avatar${size}`]}`}
      role="img"
      aria-label={`${name}'s default avatar`}
    >
      <UserRound aria-hidden="true" />
    </span>
  );
}
