/** How often an open app checks for a new service worker; 0 disables periodic checks. */
export const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Also check when the window regains focus or the tab becomes visible. */
export const SW_UPDATE_CHECK_ON_FOCUS = true;

/** Minimum time between focus/visibility-triggered checks. */
export const SW_UPDATE_CHECK_MIN_GAP_MS = 30 * 1000;

/** How long to wait before asking again after the user picks "Later". */
export const SW_UPDATE_REPROMPT_INTERVAL_MS = 15 * 60 * 1000;
