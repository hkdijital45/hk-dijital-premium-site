import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { CinematicHomepage } from "@/components/public/CinematicHomepage";
import { PublicShell } from "@/components/public/Shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <CinematicHomepage content={content} />
    </PublicShell>
  );
}
