# Firefox and shared browser builds

Chrome and Firefox desktop share `src/`. `src/manifest.json` remains a directly loadable Chrome MV3 manifest. `manifests/firefox.json` overlays Firefox's native sidebar, module event page, stable add-on ID, minimum version, and data declarations. The packager removes Chrome-only manifest fields for Firefox and adds its `clipboardWrite` permission so copying after asynchronous publishing also works.

## Build and load

With Node.js 18+ and the `zip` command available:

```sh
npm run build
# Or: npm run build:chrome / npm run build:firefox
```

The unpacked applications are `dist/chrome/` and `dist/firefox/`. Versioned upload packages are under `artifacts/`. Generated output is ignored by Git. Building never overwrites the source manifest.

In Chrome, use **Load unpacked** in `chrome://extensions` and select `dist/chrome/`. In Firefox 140 or later, use **Load Temporary Add-on** in `about:debugging#/runtime/this-firefox` and select `dist/firefox/manifest.json`. Temporary installation lasts until Firefox restarts. Release and beta Firefox require a Mozilla-signed package for ordinary installation.

## Browser integration

`platform.js` loads before application code in each context. Chrome uses its native `chrome` API object. Firefox routes callback calls through `chrome` and promise calls through `browser`; the facade never replaces either native namespace. Calls enter the native API synchronously, preserving user activation for permission prompts and opening sidebars.

The shared sidebar UI lives at `sidepanel/index.html`. Chrome uses `sidePanel`; Firefox uses `sidebarAction`. A toolbar click toggles the Firefox sidebar. Onboarding opens it on the original click, before asynchronous permission requests. Presence ports, including Firefox settings subpages, track sidebar visibility; the Firefox background also checks `sidebarAction.isOpen` for the relevant window.

Content scripts load the platform adapter first and use `globalThis.OPMI18n` consistently because Firefox distinguishes `globalThis` from `window`. Closed shadow roots use Firefox's `element.openOrClosedShadowRoot` or Chrome's `dom.openOrClosedShadowRoot`. The existing editor insertion, append mode, picker, remembered inputs, and retry logic are shared.

Firefox's default in-page shortcut is **Ctrl+Shift+Space** on all desktop platforms, avoiding Chrome defaults that conflict with Firefox shortcuts. Stored custom shortcuts remain authoritative. Chrome keeps Command+Shift+P on macOS and Ctrl+M elsewhere.

Firefox uses bundled assistant icons, with a generic website icon where no logo is bundled, so custom hostnames are not sent to remote favicon services before consent. Chrome retains its existing provider icons and fallback behavior.

## Community catalog and consent

Firefox cannot receive direct messages from ordinary websites through `externally_connectable`. Grant catalog access from the extension's Community Prompts button or Settings to install the origin-restricted content-script bridge. It is safe to inject repeatedly and is registered for subsequent visits. Chrome retains direct store-extension messaging, with the same bridge as its unpacked-install fallback.

Firefox declares no required data collection. First enabling sharing, confirming a publisher handle, or sharing a prompt requests optional `authenticationInfo` and `websiteContent` consent together with catalog host access. These cover the publisher identity and the prompt selected for publication. The API client checks consent before authenticated or publishing requests and stops sending the publisher token if consent is revoked. Import counters remain anonymous without that consent. Local library features and catalog imports do not require publishing consent.

API calls continue to originate in the background context, using catalog host permission. Firefox does not require adding a wildcard `moz-extension` origin to the catalog's CORS allowlist.

## Release configuration

The stable Firefox add-on ID is `open-prompt-manager@openpromptdatabase.com`. Keep it unchanged: Firefox sync storage depends on it. Submit the Firefox ZIP to Mozilla for signing and distribution. An AMO account and listing have not been created by this port.

Until a Firefox listing exists, Firefox extension links point to the GitHub releases page. Once Mozilla supplies the listing URL, build with it:

```sh
FIREFOX_STORE_URL=https://addons.mozilla.org/firefox/addon/YOUR-LISTING/ npm run build:firefox
```

Set the same URL in the catalog repository's `public/assets/opm-browser.js`, then build and deploy the catalog. Both browsers continue to share one source tree; the catalog source changes also need deployment before its Firefox-specific install hints appear on the live website.

## Moving from Chrome

Export a JSON backup from Chrome and import it in Firefox to move prompts, folders, and tag metadata. Browser-specific permissions, input mappings, preferences, and publisher credentials are not in that backup. Chrome and Firefox sync services are separate, so publisher handles do not migrate automatically. The Firefox port does not export the publisher secret into ordinary library backups.

This port has not been functionally tested. Browser and assistant-site testing is left to the maintainer, including multiline insertion, overwrite/append behavior, custom input picking, sidebar visibility across windows, and catalog sharing.
