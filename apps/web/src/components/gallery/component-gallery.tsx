"use client";

import { Bell, Check, Settings } from "lucide-react";
import { useState } from "react";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GameBoard } from "@/components/ui/game-board";
import { Keyboard } from "@/components/ui/keyboard";
import {
  CopiedConfirmation,
  DialogSample,
  SelectField,
  Skeleton,
  StatusDot,
  Stepper,
  TextField,
  Toggle,
} from "@/components/ui/showcase-parts";
import styles from "./component-gallery.module.css";

const sampleTiles = [
  { letter: "W", state: "absent" as const },
  { letter: "R", state: "present" as const },
  { letter: "D", state: "correct" as const },
  { letter: "L", state: "absent" as const },
  { letter: "E", state: "filled" as const },
];

export function ComponentGallery() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <div>
          <WrdlLogo size="medium" withWordmark />
          <p>Private development component gallery</p>
        </div>
        <div className={styles.themeSwitch} aria-label="Preview theme">
          <button
            className={theme === "light" ? styles.selected : ""}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={theme === "dark" ? styles.selected : ""}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </header>
      <div className={styles.sections}>
        <section>
          <h2>Brand and actions</h2>
          <div className={styles.row}>
            <WrdlLogo size="small" />
            <WrdlLogo size="medium" />
            <WrdlLogo size="large" />
          </div>
          <div className={styles.row}>
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Leave</Button>
            <button className={styles.iconButton} aria-label="Settings">
              <Settings />
            </button>
          </div>
        </section>
        <section>
          <h2>Fields and choices</h2>
          <div className={styles.formGrid}>
            <TextField label="Username" value="Yuri25" helper="Username available" />
            <SelectField label="Theme" value="Follow device" />
          </div>
          <div className={styles.stack}>
            <Toggle label="Sound effects" checked />
            <Toggle label="High-contrast tiles" />
            <Stepper label="Round timer" value="3 min" />
          </div>
        </section>
        <section>
          <h2>Identity and feedback</h2>
          <div className={styles.row}>
            <Avatar name="Yuri" />
            <StatusDot online>Online now</StatusDot>
            <StatusDot online={false}>Last online 1 hour ago</StatusDot>
          </div>
          <div className={styles.row}>
            <CopiedConfirmation />
            <span className={styles.badge}>
              <Bell />3
            </span>
            <span className={styles.success}>
              <Check />
              Ready
            </span>
          </div>
        </section>
        <section>
          <h2>Loading and dialog</h2>
          <div className={styles.stack}>
            <Skeleton width="72%" />
            <Skeleton width="48%" />
            <Skeleton width="86%" />
          </div>
          <DialogSample />
        </section>
        <section className={styles.gameplay}>
          <h2>Gameplay foundation</h2>
          <div className={styles.boardComparison}>
            <figure>
              <GameBoard tiles={sampleTiles} compact />
              <figcaption>Standard tiles</figcaption>
            </figure>
            <figure>
              <GameBoard tiles={sampleTiles} compact highContrast />
              <figcaption>High contrast</figcaption>
            </figure>
          </div>
          <Keyboard />
        </section>
      </div>
    </main>
  );
}
