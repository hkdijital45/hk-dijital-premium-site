"use client";

import { useEffect, useState } from "react";

// "Teklif Durumları" donut's real data source: the persisted proposals
// table isn't part of the big admin content blob (admin-page-data.ts),
// so this self-fetches against the existing /api/admin/proposals/v2
// count endpoint — same fetch-on-mount convention already established by
// MissionControl.tsx's AiTeamWidget. Four small count-only requests
// (limit=1, real PROPOSAL_STATUSES filters), never a full record dump;
// re-fetches only when the caller's own date range changes.
export function useProposalStatusCounts(createdFrom: string, createdTo: string) {
  // Loading state is `counts === null` (reset to null at the top of the
  // effect's async work, not via a separate setLoading(true) call in the
  // effect body, to satisfy the set-state-in-effect lint rule).
  const [counts, setCounts] = useState<{ won: number; lost: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = (extra: string) => {
      const params = new URLSearchParams({ limit: "1" });
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      return `/api/admin/proposals/v2?${params.toString()}${extra}`;
    };
    Promise.all([
      fetch(qs("")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=Kabul%20Edildi")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=Reddedildi")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=S%C3%BCresi%20Doldu")).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([all, won, rejected, expired]) => {
      if (cancelled || !all) return;
      setCounts({
        total: Number(all.total || 0),
        won: Number(won?.total || 0),
        lost: Number(rejected?.total || 0) + Number(expired?.total || 0)
      });
    });
    return () => { cancelled = true; };
  }, [createdFrom, createdTo]);

  const loading = counts === null;
  const data = counts ? [
    { label: "Kazanıldı", value: counts.won, color: "#0AA66A" },
    { label: "Beklemede", value: Math.max(0, counts.total - counts.won - counts.lost), color: "#F4B400" },
    { label: "Kaybedildi", value: counts.lost, color: "#E53935" }
  ] : [];

  return { data, loading };
}
