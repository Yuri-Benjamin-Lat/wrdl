import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Avatar } from "@/components/ui/avatar";
import { ActivityHeartbeat } from "./activity-heartbeat";
import { MobileDrawer } from "./mobile-drawer";
import { NavLinks } from "./nav-links";
import { PreferencesSync } from "./preferences-sync";
import styles from "./shell.module.css";
import type { WrdlTheme } from "@/lib/database.types";

export type ShellAccount = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  theme: WrdlTheme;
  highContrast: boolean;
};

export function AppShell({ children, account }: { children: ReactNode; account: ShellAccount }) {
  return (
    <div className={styles.shell}>
      <PreferencesSync theme={account.theme} highContrast={account.highContrast} />
      <ActivityHeartbeat />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link href="/" aria-label="WRDL Home">
            <WrdlLogo size="small" />
          </Link>
          <MobileDrawer account={account} />
        </header>
        <div className={styles.content}>{children}</div>
      </main>
      <aside className={styles.sidebar} aria-label="Account navigation">
        <div className={styles.person}>
          <Avatar name={account.displayName} imageUrl={account.avatarUrl} />
          <span>
            <strong>{account.displayName}</strong>
            <small>@{account.username}</small>
          </span>
        </div>
        <nav>
          <NavLinks />
          <form action={signOutAction}>
            <button className={styles.signOut} type="submit">
              <LogOut aria-hidden="true" />
              Sign Out
            </button>
          </form>
        </nav>
      </aside>
    </div>
  );
}
