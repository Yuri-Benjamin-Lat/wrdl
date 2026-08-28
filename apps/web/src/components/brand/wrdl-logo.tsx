import styles from "./wrdl-logo.module.css";

type WrdlLogoProps = {
  size?: "small" | "medium" | "large";
  withWordmark?: boolean;
  className?: string;
};

export function WrdlLogo({ size = "medium", withWordmark = false, className }: WrdlLogoProps) {
  const rootClassName = [styles.lockup, className].filter(Boolean).join(" ");

  return (
    <span className={rootClassName} aria-label="WRDL">
      <span className={`${styles.mark} ${styles[size]}`} aria-hidden="true">
        <span>W</span>
        <span>R</span>
        <span>D</span>
        <span>L</span>
      </span>
      {withWordmark ? <span className={styles.wordmark}>WRDL</span> : null}
    </span>
  );
}
