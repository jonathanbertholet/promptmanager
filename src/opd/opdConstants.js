/**
 * Open Prompt Database — canonical public site URL.
 * Keep in sync with externally_connectable.matches in manifest.json.
 */
export const OPD_CATALOG_URL = 'https://openpromptdatabase.com';

/** Same id as Chrome Web Store listing; OPD site uses this for chrome.runtime.sendMessage. */
export const OPM_EXTENSION_ID = 'gmhaghdbihgenofhnmdbglbkbplolain';

/** Service worker message types for publish infra (UI wires these later). */
export const OPD_MSG = {
  PUBLISH_STATUS: 'OPD_PUBLISH_STATUS',
  PUBLISH_ENABLE: 'OPD_PUBLISH_ENABLE',
  HANDLE_AVAILABLE: 'OPD_HANDLE_AVAILABLE',
  PUBLISH_REGISTER: 'OPD_PUBLISH_REGISTER',
  PUBLISH_PROMPT: 'OPD_PUBLISH_PROMPT',
  PUBLISH_DELETE: 'OPD_PUBLISH_DELETE',
};
