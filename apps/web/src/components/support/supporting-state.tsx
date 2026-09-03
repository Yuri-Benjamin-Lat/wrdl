"use client";

import { RefreshCw, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Button } from "@/components/ui/button";
import styles from "./supporting-states.module.css";

export function SupportingError({
  title = "We couldn't load this page",
  description = "Something went wrong. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  return (
    <main className={styles.supportPage}>
      <section className={styles.supportCard}>
        <span className={`${styles.supportMark} ${styles.danger}`} aria-hidden="true">
          <TriangleAlert />
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.supportActions}>
          {onRetry ? <Button onClick={onRetry}>Try Again</Button> : null}
          <Button variant="secondary" onClick={() => router.push("/")}>
            Return Home
          </Button>
        </div>
      </section>
    </main>
  );
}

export function MaintenanceState() {
  return (
    <main className={styles.maintenancePage}>
      <section>
        <WrdlLogo />
        <span className={styles.maintenanceMark} aria-hidden="true">
          <Wrench />
        </span>
        <h1>WRDL is temporarily unavailable</h1>
        <p>We&apos;re performing maintenance. Please try again shortly.</p>
        <Button icon={<RefreshCw />} onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </section>
    </main>
  );
}

export function PageSkeleton({
  title,
  variant = "list",
}: {
  title: string;
  variant?: "list" | "profile" | "leaderboard";
}) {
  const rows = variant === "profile" ? 3 : variant === "leaderboard" ? 4 : 5;
  return (
    <main className={styles.skeletonPage} aria-label={`${title} is loading`} aria-busy="true">
      <header>
        <Link href="/" aria-label="WRDL Home">
          <WrdlLogo size="small" />
        </Link>
      </header>
      <section>
        <div className={styles.skeletonTitle} />
        {variant === "profile" ? <div className={styles.skeletonProfile} /> : null}
        <div className={styles.skeletonList}>
          {Array.from({ length: rows }, (_, index) => (
            <div className={styles.skeletonRow} key={index}>
              <span />
              <div>
                <i />
                <i />
              </div>
              <i />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
