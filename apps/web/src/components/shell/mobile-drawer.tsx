"use client";

import { House, LogOut, Menu, Settings, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import styles from "./shell.module.css";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/friends", label: "Friends", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileDrawer() {
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
              <Avatar name="Yuri" />
              <span>
                <strong>Yuri</strong>
                <small>@yuri</small>
              </span>
            </div>
            <nav>
              {links.map(({ href, label, icon: Icon }, index) => (
                <Link
                  className={index === 0 ? styles.activeLink : styles.navLink}
                  href={href}
                  key={href}
                  onClick={() => setOpen(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {label === "Friends" ? <b>3</b> : null}
                </Link>
              ))}
              <button className={styles.signOut} type="button">
                <LogOut aria-hidden="true" />
                Sign Out
              </button>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
