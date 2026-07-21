import type { ReactNode } from "react";

export function AdminAppShell({
  theme,
  mobileOperationMode,
  header,
  moduleToolbar,
  sidebar,
  mobileNav,
  overlays,
  children
}: {
  theme: "light" | "dark";
  mobileOperationMode: boolean;
  header: ReactNode;
  moduleToolbar?: ReactNode;
  sidebar: ReactNode;
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
        {moduleToolbar}
        {mobileNav}
        <div className="admin-desktop-body relative mx-auto grid w-full min-w-0 max-w-full gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch lg:px-6">
          {sidebar}
          <div className="min-w-0 lg:h-full lg:overflow-y-auto">{children}</div>
        </div>
      </div>
      {overlays}
    </main>
  );
}
