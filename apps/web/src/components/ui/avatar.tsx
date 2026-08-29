import { UserRound } from "lucide-react";
import styles from "./ui.module.css";

export function Avatar({
  name,
  imageUrl,
  size = "medium",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className={`${styles.avatar} ${styles[`avatar${size}`]}`}
      role="img"
      aria-label={`${name}'s avatar`}
    >
      {imageUrl ? (
        // Signed Supabase Storage URLs are short-lived and intentionally not optimized.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" />
      ) : (
        <UserRound aria-hidden="true" />
      )}
    </span>
  );
}
