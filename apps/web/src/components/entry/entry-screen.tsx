import type { ReactNode } from "react";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import styles from "./entry.module.css";

export function EntryScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      <section className={styles.center}>
        <WrdlLogo size="large" />
        <div className={styles.heading}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export { styles as entryStyles };
