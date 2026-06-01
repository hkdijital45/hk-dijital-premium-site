export type DiscoveredBusiness = {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  googleRating?: number | null;
  reviewCount?: number;
  placeId?: string;
  category?: string;
};

export function scoreDiscoveredBusiness(business: DiscoveredBusiness) {
  const digitalMaturityScore = Math.min(
    100,
    (business.website ? 35 : 0) +
      (business.phone ? 20 : 0) +
      (business.address ? 10 : 0) +
      (business.googleRating ? 15 : 0) +
      (Number(business.reviewCount || 0) >= 10 ? 10 : 0) +
      (Number(business.reviewCount || 0) >= 50 ? 10 : 0)
  );
  const rating = Number(business.googleRating || 0);
  const reviews = Number(business.reviewCount || 0);
  const leadHeatScore = Math.min(
    100,
    (business.phone ? 30 : 0) +
      (business.website ? 20 : 0) +
      (rating >= 4 ? 20 : rating > 0 ? 10 : 0) +
      (reviews >= 10 ? 15 : reviews > 0 ? 5 : 0) +
      (reviews >= 50 ? 15 : 0)
  );
  return { digitalMaturityScore, leadHeatScore };
}
