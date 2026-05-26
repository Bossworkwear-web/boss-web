import {
  applyAp2211GalleryAdjustments,
  isStorefrontAp2211Slug,
} from "@/lib/ap-2211-storefront";
import {
  ap2311ColorsSortedFullForGalleryCounts,
  filterAp2311ColorImageCounts,
  isStorefrontAp2311Slug,
} from "@/lib/ap-2311-storefront";
import { stripApGalleryColorCountsHash } from "@/lib/ap-gallery-color-counts";

/**
 * Aussie Pacific PDP: read `#apcc=` from the first gallery URL (sync colour-block sizes), strip it from
 * `image_urls`, and align counts with storefront colour chips (e.g. 2211 hides `BLACK`, 2311 hides `NAVY`).
 */
export function resolveApPdpGalleryState(
  imageUrls: readonly string[],
  slug: string | null | undefined,
  colorOptionsEffective: readonly string[],
): { imageUrls: string[]; apColorImageCounts: number[] | null } {
  const urls = imageUrls.map(String);
  if (!urls.length) {
    return { imageUrls: [], apColorImageCounts: null };
  }

  const strippedFirst = stripApGalleryColorCountsHash(urls[0] ?? "");
  let apColorImageCounts = strippedFirst.counts;
  urls[0] = strippedFirst.url;

  if (isStorefrontAp2211Slug(slug) && apColorImageCounts) {
    const adjusted = applyAp2211GalleryAdjustments(urls, apColorImageCounts, colorOptionsEffective);
    return { imageUrls: adjusted.imageUrls, apColorImageCounts: adjusted.apColorImageCounts };
  } else if (isStorefrontAp2311Slug(slug) && apColorImageCounts) {
    const sortedFull = ap2311ColorsSortedFullForGalleryCounts(colorOptionsEffective, apColorImageCounts);
    apColorImageCounts = filterAp2311ColorImageCounts(sortedFull, apColorImageCounts);
  }

  return { imageUrls: urls, apColorImageCounts };
}
