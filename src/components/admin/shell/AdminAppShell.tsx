import type { ReactNode } from "react";

export function AdminAppShell({
  theme,
  mobileOperationMode,
  header,
  mobileNav,
  overlays,
  children
}: {
  theme: "light" | "dark";
  mobileOperationMode: boolean;
  header: ReactNode;
  mobileNav: ReactNode;
  overlays?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      data-admin="true"
      data-theme={theme}
      data-mobile-operation-mode={mobileOperationMode ? "true" : "false"}
      className={`admin-app-shell admin-shell hk-admin relative min-h-screen w-full min-w-0 max-w-full lg:h-screen lg:overflow-hidden ${theme === "light" ? "admin-light" : ""} ${mobileOperationMode ? "hk-mobile-operation-mode" : ""}`}
    >
      <div className="admin-ambient pointer-events-none absolute inset-0" />
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="admin-desktop-frame relative lg:h-full">
        {header}
        {mobileNav}
        {/* No persistent sidebar column by default — the top mega-nav (inside
            `header`) is the primary desktop navigation surface, so content
            is full-width here. Below lg, AdminMobileNavigation's drawer
            (rendered via `mobileNav`, a fixed overlay) covers navigation. */}
        <div className="admin-desktop-body relative mx-auto w-full min-w-0 max-w-full px-3 py-4 sm:px-4 lg:px-6">
          <div className="min-w-0 lg:h-full lg:overflow-y-auto">{children}</div>
        </div>
      </div>
      {overlays}
    </main>
  );
}
