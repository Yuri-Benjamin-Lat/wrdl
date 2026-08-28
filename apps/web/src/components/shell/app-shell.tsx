import { House, Settings, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Avatar } from "@/components/ui/avatar";
import { MobileDrawer } from "./mobile-drawer";
import styles from "./shell.module.css";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/friends", label: "Friends", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link href="/" aria-label="WRDL Home">
            <WrdlLogo size="small" />
          </Link>
          <MobileDrawer />
        </header>
        <div className={styles.content}>{children}</div>
      </main>
      <aside className={styles.sidebar} aria-label="Account navigation">
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
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
