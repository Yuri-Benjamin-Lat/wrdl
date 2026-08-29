"use client";

import { LogOut, Menu } from "lucide-react";
import { useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/avatar";
import type { ShellAccount } from "./app-shell";
import { NavLinks } from "./nav-links";
import styles from "./shell.module.css";

export function MobileDrawer({ account }: { account: ShellAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={styles.menuButton}
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.drawerLayer} onMouseDown={() => setOpen(false)}>
          <aside
            className={styles.drawer}
            aria-label="Mobile account navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.person}>
              <Avatar name={account.displayName} imageUrl={account.avatarUrl} />
              <span>
                <strong>{account.displayName}</strong>
                <small>@{account.username}</small>
              </span>
            </div>
            <nav>
              <NavLinks onNavigate={() => setOpen(false)} />
              <form action={signOutAction}>
                <button className={styles.signOut} type="submit">
                  <LogOut aria-hidden="true" />
                  Sign Out
                </button>
              </form>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
