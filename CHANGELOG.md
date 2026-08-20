# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog],
and this project adheres to [Semantic Versioning].

## [3.0.1] - 2026-08-20

### Changed

- Catalog import on the website uses `externally_connectable` for store installs; the bridge is registered after the user grants optional catalog access. This avoids a required host-permission warning on update.

## [3.0.0] - 2026-08-20

### Added

- Share local prompts to the Open Prompt Database from the side panel, including copies of imported community prompts.
- Publisher handle check and registration with clearer catalog-permission errors.
- Click a prompt in the side panel to insert it into the chat input on an enabled site.
- Fill `#variables#` in the side panel before insert; if the site has no input yet, the field picker opens and inserts after you pin.
- Hide the in-page launcher while the side panel is open.
- Remember the last successful chat input per site (learned selectors).
- First-run onboarding: pick a launcher, then click an assistant to grant access, open the site, and open the side panel.
- Onboarding Features section links to Community prompts and includes an Enable sharing toggle.

### Fixed

- Prompt insert no longer posts twice on ChatGPT and Perplexity.
- Sharing an imported catalog prompt now publishes your copy instead of linking the original row.
- Re-importing a catalog prompt that is already in the library no longer increments the import counter.
- The side panel shows an error toast when Share to Open Prompt Database fails.
- The in-page keyboard shortcut requires an exact Shift match (`Ctrl+M` no longer also matches `Ctrl+Shift+M`).
- Clicking an assistant on first run requests site access on that click, then opens the side panel.
- Sharing an imported catalog prompt now keeps a local copy that re-import cannot overwrite.
- Variable prompts re-detect the chat input before inserting, so SPA composer replacements do not swallow the filled prompt.
- Perplexity apex host `perplexity.ai` is recognized for injection and permissions, not only `www.perplexity.ai`.
- Tag input, shortcut recorder, and reorder-drag listeners are removed when the in-page panel changes view.
- Hot-corner hover on first page load uses the corner hit target, not the still-invisible in-page panel.

## [2.9.1]

### Added

- Share local prompts to the Open Prompt Database from the side panel.
- Publisher handle and publish toggle in Open Prompt Database settings.

## [2.9] - 2026-05-25

### Added

- Import community prompts from the Open Prompt Database into the local library.
- Stable `opd:` ids so re-import updates the same prompt when the catalog entry changes.
- Duplicate detection on the catalog site (“Already in library”).
- Settings link to browse the community catalog.

## [2.8] - 2026-05-25

### Added

- Unified settings page in the side panel: launcher mode, preferences, tag management, import/export, permissions editor, and custom open shortcut.
- Custom keyboard shortcut recorder for opening/closing the in-page prompt panel.
- Full v2 backup export (prompts, folders, and tag metadata).
- Support & links section in settings (GitHub, Chrome Web Store review, Buy Me a Coffee).

### Changed

- Settings available in both the in-page panel and the side panel settings page, synced via the same storage keys.
- In-page settings restored with shortcut recording, unified export/import, and sidebar-matching community link icons.
- Settings page layout: scrollable page and tighter section spacing.

### Fixed

- Tag management section empty on the settings page when tags were enabled.
- Export/import now handles full v2 backup objects (not prompts-only arrays).

## [2.7] - 2026-05-23

### Added

- Side panel search and tag filter bar, synced with the in-page prompt panel.
- Tag input with suggestions on create/edit forms in the side panel.
- Expanded prompt lab tab with a close button and layout polish.

### Changed

- Smooth animated panel resizing when switching between list, create, variable, and edit views.
- List panel height is based on total prompt count so tag filtering no longer causes layout jumps.
- Variable and edit forms keep the bottom menu visible with improved label/input layout.
- Edit prompt flow routes through the panel router for consistent transitions.
- Hovering the launcher button reopens the panel after auto-close and preserves in-progress forms.

### Fixed

- Expanded-tab close now uses the sender tab for reliable dismissal.
- Script re-injection guard improvements for SPA navigations.

## [2.2.1]

### Added

- Responsive Sidebar design instead of popup
- Permissions manager
- Support for 11 new platforms
- Copy to clipboard from context menu
- Copy to cipboard from Sidebar
- Refactored content.js, storagemanager.js, and more
- Improved onboarding
- Improved design

## [1.9.7] - 2025-04-20

### Added

- Added support for Side Panel.
- Added Permissions Manager.
- Copy prompts to clipboard.

### Fixed

- Bug fix for the import/export feature.

### Removed

- Popup window

## [1.9.6] - 2025-03-30

### Added

- Implemented automated end-to-end tests using Puppeteer
- Implemented a prompt lab page to manage prompts in full page

## [1.9.5] - 2025-03-22

### Added

- Added Hot Corner mode - Hover over the bottom right corner of the screen to open the prompt manager
- Added a new settings view to manage extension preferences - more to come!

## [1.9.3] - 2025-03-19

### Added

- Added support for abacus.ai's ChatLLM

### Changed

- Replaced inline SVG icons with Material UI icons
- Improved UX/UI by updating icons and adding descriptive tooltips for better clarity and navigation

### Fixed

- Fixed a start-up issue to ensure saved prompts are properly loaded on initialization
- Resolved the Import/Export icon issue in the site popup view for better usability

<!-- Links -->

[keep a changelog]: https://keepachangelog.com/en/1.1.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html

<!-- Versions -->

[unreleased]: https://github.com/Author/Repository/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/Author/Repository/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/Author/Repository/releases/tag/v0.0.1
