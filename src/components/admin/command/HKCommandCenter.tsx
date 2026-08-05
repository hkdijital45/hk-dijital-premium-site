"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Home, LayoutGrid, Search, Star } from "lucide-react";

export interface HKCommandCenterAction {
  label: string;
  href: string;
  detail?: string;
}

export interface HKCommandCenterGroup {
  label: string;
  href: string;
}

interface HKSearchResult {
  id: string;
  href: string;
  title: string;
  detail?: string;
  type?: string;
}

/**
 * HK Mission Control — the signature global entry point for HK Operating
 * System, top-left of every admin screen. One button, one ⌘K palette that
 * reaches search, quick actions, favorites, recent customers and every
 * module group. Absorbs the previous inline GlobalAdminSearch (same search
 * API/shortcut), so there is exactly one command surface app-wide.
 */
export function HKCommandCenter({
  quickActions,
  favorites = [],
  recentCustomers = [],
  groups = []
}: {
  quickActions: HKCommandCenterAction[];
  favorites?: HKCommandCenterAction[];
  recentCustomers?: HKCommandCenterAction[];
  groups?: HKCommandCenterGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HKSearchResult[]>([]);

  function openPalette() {
    setOpen(true);
    window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") close();
    }
    const removeDesktopListener = (window as unknown as { hkDesktop?: { onFocusSearch?: (fn: () => void) => () => void } }).hkDesktop?.onFocusSearch?.(openPalette);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      removeDesktopListener?.();
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const clearTimer = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(clearTimer);
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json().catch(() => ({}));
        setResults(response.ok ? data.results || [] : []);
      } catch {
        setResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const showBrowse = query.trim().length < 2;

  return (
    <>
      <button type="button" onClick={openPalette} className="hk-command-trigger" aria-label="HK Mission Control'ı aç (⌘K)">
        <span className="hk-command-trigger-icon"><Home size={17} /></span>
        <span className="hk-command-trigger-label">HK Mission Control</span>
        <kbd className="hk-command-trigger-kbd">⌘K</kbd>
      </button>
      {open && (
        <div className="hk-command-overlay" onMouseDown={close}>
          <div
            className="hk-command-panel"
            role="dialog"
            aria-modal="true"
            aria-label="HK Mission Control"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label className="hk-command-search-row">
              <Search size={18} />
              <input
                id="hk-command-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Her yerde ara, modül aç veya hızlı aksiyon seç..."
                className="hk-command-input"
              />
              <button type="button" onClick={close} className="hk-command-esc">ESC</button>
            </label>
            <div className="hk-command-body premium-scrollbar">
              {!showBrowse && (
                <>
                  {results.map((result) => (
                    <Link key={result.id} href={result.href} onClick={close} className="hk-command-result">
                      {result.type && <span className="hk-command-result-type">{result.type}</span>}
                      <span className="hk-command-result-text">
                        <strong>{result.title}</strong>
                        {result.detail && <span>{result.detail}</span>}
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                  {!results.length && <p className="hk-command-empty">Eşleşen sonuç bulunamadı.</p>}
                </>
              )}
              {showBrowse && (
                <>
                  {favorites.length > 0 && (
                    <div className="hk-command-section">
                      <p className="hk-command-section-title"><Star size={12} /> Favoriler</p>
                      <div className="hk-command-grid">
                        {favorites.map((item) => (
                          <Link key={item.href} href={item.href} onClick={close} className="hk-command-chip">{item.label}</Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {recentCustomers.length > 0 && (
                    <div className="hk-command-section">
                      <p className="hk-command-section-title"><Clock size={12} /> Son Müşteriler</p>
                      <div className="hk-command-grid">
                        {recentCustomers.map((item) => (
                          <Link key={item.href} href={item.href} onClick={close} className="hk-command-chip">{item.label}</Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="hk-command-section">
                    <p className="hk-command-section-title"><LayoutGrid size={12} /> Hızlı Aksiyon</p>
                    <div className="hk-command-actions-grid">
                      {quickActions.map((item) => (
                        <Link key={item.label} href={item.href} onClick={close} className="hk-command-action">
                          <strong>{item.label}</strong>
                          {item.detail && <span>{item.detail}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                  {groups.length > 0 && (
                    <div className="hk-command-section">
                      <p className="hk-command-section-title">Çalışma Alanları</p>
                      <div className="hk-command-grid">
                        {groups.map((group) => (
                          <Link key={group.label} href={group.href} onClick={close} className="hk-command-chip">{group.label}</Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="hk-command-hint">Aramak için en az iki karakter yazın. Müşteri, lead, kampanya, görev, tahsilat, belge, rapor ve log kayıtları taranır.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
