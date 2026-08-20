// COMMENT: Local development toggles — keep every flag false before shipping.
// opmDevForceOnboarding in storage only re-shows the in-page "Hover to Start" tooltip (not a new tab).

/** chrome.storage.local key — set via permissions.html?reset=1 to force the in-page onboarding tooltip. */
export const OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY = 'opmDevForceOnboarding';
