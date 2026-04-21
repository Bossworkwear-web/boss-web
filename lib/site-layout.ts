/** Horizontal inset from the viewport — use on header, footer, and main content rows. */
export const SITE_PAGE_INSET_X_CLASS = "px-[5cm]";

/** Full-width block under the nav with no max-width cap, only side gutters. */
export const SITE_PAGE_ROW_CLASS = `mx-auto w-full max-w-none ${SITE_PAGE_INSET_X_CLASS}`;

/**
 * Same width + horizontal padding as `.home-hero-strip-inner` (`app/globals.css` — max-width 120rem,
 * responsive padding). Use for the home main column directly under the hero.
 */
export const SITE_PAGE_INNER_SHELL_CLASS = "site-page-inner-shell";
