"use client";

import { House, Settings, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./shell.module.css";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/friends", label: "Friends", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavLinks({
  onNavigate,
  pendingFriendRequests = 0,
}: {
  onNavigate?: () => void;
  pendingFriendRequests?: number;
}) {
  const pathname = usePathname();

  return links.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        className={active ? styles.activeLink : styles.navLink}
        href={href}
        key={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
        {label === "Friends" && pendingFriendRequests > 0 ? (
          <b className={styles.navBadge} aria-label={`${pendingFriendRequests} pending requests`}>
            {pendingFriendRequests > 99 ? "99+" : pendingFriendRequests}
          </b>
        ) : null}
      </Link>
    );
  });
}
