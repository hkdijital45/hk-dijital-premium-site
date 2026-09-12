// Deduplicates raw Google Places Text Search results by place_id when
// merging multiple pages fetched for the "up to 100 candidates" discovery
// flow (see /api/admin/business-discovery). Google's own pagination should
// not repeat a place_id across pages in practice, but a result with no
// place_id at all (never seen in real Places API responses, but not
// contractually guaranteed) is kept rather than silently dropped — dedup
// only ever removes a result it can positively identify as a repeat.
export function dedupePlacesById<T extends { place_id?: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const place of results) {
    const id = place.place_id;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    unique.push(place);
  }
  return unique;
}
