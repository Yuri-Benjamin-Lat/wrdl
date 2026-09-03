"use client";

import { ChevronLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Avatar } from "@/components/ui/avatar";
import { ActivityHeartbeat } from "./activity-heartbeat";
import { MobileDrawer } from "./mobile-drawer";
import { NavLinks } from "./nav-links";
import { PreferencesSync } from "./preferences-sync";
import { InvitationControl } from "./invitation-control";
import styles from "./shell.module.css";
import type { WrdlTheme } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export type ShellAccount = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  theme: WrdlTheme;
  highContrast: boolean;
  pendingFriendRequests?: number;
};

let desktopSidebarOpen = false;

export function AppShell({ children, account }: { children: ReactNode; account: ShellAccount }) {
  const [sidebarOpen, setSidebarOpen] = useState(desktopSidebarOpen);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(
    account.pendingFriendRequests ?? 0,
  );

  useEffect(() => {
    let active = true;
    void getSupabaseBrowserClient()
      .rpc("get_my_pending_friend_request_count", {})
      .then(({ data }) => {
        if (active && typeof data === "number") setPendingFriendRequests(data);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateSidebar(open: boolean) {
    desktopSidebarOpen = open;
    setSidebarOpen(open);
  }

  return (
    <div className={`${styles.shell} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <PreferencesSync theme={account.theme} highContrast={account.highContrast} />
      <ActivityHeartbeat />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link href="/" aria-label="WRDL Home">
            <WrdlLogo size="small" />
          </Link>
          <MobileDrawer account={{ ...account, pendingFriendRequests }} />
        </header>
        <div className={styles.content}>{children}</div>
        <InvitationControl />
      </main>
      <aside
        className={styles.sidebar}
        aria-label="Account navigation"
        onPointerEnter={() => updateSidebar(true)}
        onPointerLeave={() => updateSidebar(false)}
      >
        <div className={styles.sidebarCue} aria-hidden="true">
          <ChevronLeft />
        </div>
        <div className={styles.sidebarContent}>
          <div className={styles.person}>
            <Avatar name={account.displayName} imageUrl={account.avatarUrl} />
            <span>
              <strong>{account.displayName}</strong>
              <small>@{account.username}</small>
            </span>
          </div>
          <nav>
            <NavLinks pendingFriendRequests={pendingFriendRequests} />
            <form action={signOutAction}>
              <button className={styles.signOut} type="submit">
                <LogOut aria-hidden="true" />
                Sign Out
              </button>
            </form>
          </nav>
        </div>
      </aside>
    </div>
  );
}
