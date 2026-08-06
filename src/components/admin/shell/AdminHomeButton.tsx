import Link from "next/link";
import { Home } from "lucide-react";

/**
 * Small, dedicated, always-visible shortcut back to /hk-admin. Lives inside
 * AdminTopHeader's sticky top row (not the scrollable mega-nav row below
 * it), so it stays reachable on every admin screen at every scroll
 * position — independent of the "Dashboard" item that also exists one
 * click deep inside the "Ana Merkez" group's mega-menu.
 *
 * Non-negotiable: Dashboard must be reachable in exactly 1 click from
 * anywhere, regardless of the logo slot's own link behavior (which differs
 * per shell — AdminDashboard vs AdminStandaloneShell).
 */
export function AdminHomeButton() {
  return (
    <Link
      href="/hk-admin"
      aria-label="Panele git"
      title="Panele git"
      className="admin-icon-action flex size-10 shrink-0 items-center justify-center gap-2 rounded-[10px] lg:size-auto lg:px-3.5"
    >
      <Home size={17} />
      <span className="hidden text-xs font-black lg:inline">Panel</span>
    </Link>
  );
}
