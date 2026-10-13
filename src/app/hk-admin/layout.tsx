import type { Metadata } from "next";

// manifest + appleWebApp enable "Add to Home Screen" on iPhone Safari —
// a prerequisite for iOS Web Push (Safari only delivers push to a PWA
// installed to the Home Screen, never to a regular browser tab).
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  manifest: "/admin-manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HK Admin" }
};

export default function HkAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
