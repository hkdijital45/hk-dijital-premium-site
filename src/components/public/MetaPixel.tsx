"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { META_PIXEL_ID, trackMetaContact, trackMetaPageView } from "@/lib/meta-pixel";

const privatePathPrefixes = [
  "/hk-admin",
  "/musteri-paneli",
  "/api",
  "/digital-center",
  "/giris",
  "/login",
  "/musteri-merkezi",
  "/hk-control",
  "/kurulum",
  "/super-admin-kurulum",
  "/sifre-sifirla"
];

function isPublicTrackedPath(pathname: string) {
  return !privatePathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function MetaPixel({ pixelId = META_PIXEL_ID }: { pixelId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pixelId || !pathname || !isPublicTrackedPath(pathname)) return;
    const query = window.location.search.replace(/^\?/, "");
    trackMetaPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, pixelId]);

  useEffect(() => {
    if (!pixelId) return undefined;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      const href = target?.getAttribute("href") || "";
      if (!href) return;
      const normalized = href.toLocaleLowerCase("tr");
      if (normalized.includes("wa.me") || normalized.includes("api.whatsapp") || normalized.includes("whatsapp")) {
        trackMetaContact({ source: "whatsapp_link", link_url: href });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pixelId]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
