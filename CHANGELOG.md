# Changelog

## 0.2.1

- Open Chromium immediately when it is ready. Show a Home Assistant spinner only if opening takes more than 300 ms.
- Show an error with the cause and a **Back to dashboard** action when Chromium Link cannot open the tab.

## 0.2.0

- Changed the dashboard navigation path to `/chromium-link?url=`. Update any buttons that use `/chromium-launch?url=` after installing this release.

## 0.1.0

- Added one-tap links from standard Home Assistant dashboard buttons to local device pages in the Mincka Chromium app.
- Added setup through Devices & services with no device list or integration settings.
- Added admin-only launching and destination validation. Device URLs can be pasted as copied, including query parameters and fragments.
- Switch to Chromium within Home Assistant so the sidebar stays in place during launch.
