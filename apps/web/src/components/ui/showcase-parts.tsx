import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./showcase-parts.module.css";

export function TextField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input defaultValue={value} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

export function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.selectWrap}>
        <select defaultValue={value}>
          <option>{value}</option>
          <option>Alternative</option>
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}

export function Toggle({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <label className={styles.toggleRow}>
      <span>{label}</span>
      <input type="checkbox" defaultChecked={checked} />
      <span className={styles.toggle} aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

export function Stepper({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stepperRow}>
      <span>{label}</span>
      <div className={styles.stepper}>
        <button type="button" aria-label={`Previous ${label}`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>{value}</strong>
        <button type="button" aria-label={`Next ${label}`}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function StatusDot({ online, children }: { online: boolean; children: ReactNode }) {
  return (
    <span className={styles.status}>
      <span className={online ? styles.online : styles.offline} />
      {children}
    </span>
  );
}

export function CopiedConfirmation() {
  return (
    <div className={styles.confirmation} role="status">
      <span className={styles.flipTile}>
        <Check aria-hidden="true" />
      </span>
      <span>Copied to clipboard</span>
    </div>
  );
}

export function Skeleton({ width = "100%" }: { width?: string }) {
  return <span className={styles.skeleton} style={{ width }} aria-hidden="true" />;
}

export function DialogSample() {
  return (
    <div className={styles.dialog}>
      <strong>Leave this game?</strong>
      <p>Your current Free Play progress will restart.</p>
      <div>
        <button type="button">Cancel</button>
        <button type="button" className={styles.dialogPrimary}>
          Leave
        </button>
      </div>
    </div>
  );
}
