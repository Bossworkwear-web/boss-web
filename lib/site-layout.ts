/**
 * Horizontal inset: desktop matches legacy `calc(5cm/1.452)`; narrow phones/tablets use fluid caps
 * so side gutters never dominate small screens (see `.site-page-inset-x` in `app/globals.css`).
 */
export const SITE_PAGE_INSET_X_CLASS = "site-page-inset-x";

/** Full-width block under the nav with no max-width cap, only side gutters. */
export const SITE_PAGE_ROW_CLASS = `mx-auto w-full max-w-none ${SITE_PAGE_INSET_X_CLASS}`;

/**
 * Same width + horizontal padding as `.home-hero-strip-inner` (`app/globals.css` — max-width 2614px,
 * responsive padding). Use for the home main column directly under the hero.
 */
export const SITE_PAGE_INNER_SHELL_CLASS = "site-page-inner-shell";
