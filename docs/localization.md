# Localization

English and Simplified Chinese use explicit semantic keys. The extension does not translate arbitrary DOM text, inspect user prompts, or patch native browser APIs. No runtime dependency is required.

## Resources and preferences

- `src/locales/en.json` is the default catalog. `es.json`, `fr.json`, `pt.json` and `zh-CN.json` contain the same keys and parameter names.
- `src/_locales/*/messages.json` supplies Chrome's native extension name, description and toolbar default. These follow the browser's language; the app's toolbar title follows its own preference after initialization.
- The `uiLanguage` local-storage preference accepts `auto`, `en`, `es`, `fr`, `pt` and `zh-CN`. Automatic uses Chrome's interface language, then navigator language. Other languages fall back to English.
- `OPMI18n.ready` completes initial catalog loading. Page and content entrypoints await it before constructing dynamic UI. Concurrent language loads cannot overwrite a newer choice; writes from one page are serialized.
- Missing translated keys fall back to English. Failed locale reads are retryable and time-limited; a failed Chinese catalog uses English and reports `lang="en"`. When neither resource is available, marked static HTML retains its English fallback. Normal page initialization reveals content after translation; a CSS fail-open also prevents permanent blank pages if scripts are unavailable.

## Static UI

Use `data-i18n="prompt.create"` on a **text-only leaf**, retaining an English fallback. Do not put text bindings on a button that also contains an icon.

Attributes use `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`, and `data-i18n-alt`. Bindings may supply `data-i18n-param-name="value"`. Extension pages are registered automatically; injected UI explicitly registers its own root. Localization does not traverse the host document.

## Dynamic UI

Use `OPMI18n.t('prompt.save')` for a one-time string, such as a blocking dialog or context-menu title. Use `OPMI18n.bind(element, key, params, attribute)` for nodes that remain visible during a language switch. The default attribute is `textContent`; the other supported targets match the static attributes above.

A binding's key changes with its state: an edit button uses `prompt.update`, not its create key. When a status stops displaying a translatable message, remove its `data-i18n` binding before writing literal text. Creation code applies marked subtrees explicitly; there is no translation MutationObserver. Existing observers used for input detection or layout are unrelated.

User prompt titles, bodies, tags, handles, variable names and input values remain plain text. Never send them through `t()` as a key or insert them as HTML. Parameters are formatted literally (not recursively interpreted). Action lookup uses stable IDs/data attributes, not translated accessibility labels.

## Rich sentences and changelog

A whole sentence uses `data-i18n-rich`, with named `{slots}` in its catalog entry. Existing children marked `data-i18n-slot` provide emphasis or links. A valid translation uses each slot exactly once. Language changes reuse those nodes and preserve their destinations and listeners; translations cannot create HTML. Invalid slot sets fall back to English without destroying existing links.

The changelog is packaged static HTML, not user data or a catalog string containing arbitrary markup. Its view loads the locale-specific file directly, ignores obsolete responses, and labels an English fallback explicitly. Upstream screenshots embedded in onboarding are illustrative images and remain unchanged; translating UI text does not rewrite text inside images.

## Adding a language or message

Choose a stable key that describes the UI's meaning rather than its English wording. Add matching keys/parameters to every catalog. Keep product names unchanged; variable examples use `#name#` because the parser accepts ASCII letters, digits and underscores. Add the locale to preference resolution and the selector when adding a new language.

Changing wording must not change layout, event destinations, permissions, prompt storage or business logic. On a language switch, update bindings rather than reconstructing editors or lists: drafts, selection and open action menus must survive.

## Verification

```sh
npm install --ignore-scripts
npm run test:i18n:unit
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm run test:i18n:browser
```

Unit tests cover catalog parity and references, language races, fallbacks, and the worker/menu lifecycle. Browser tests execute real page/content scripts with mocked Chrome APIs and blocked external requests, checking first visible content, preserved drafts/carets, user text, rich slots/links, transient UI and changelog races. They are not a substitute for native Chrome/Edge installation and live third-party input-field acceptance tests.
