import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true }
};

export default function HkAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
