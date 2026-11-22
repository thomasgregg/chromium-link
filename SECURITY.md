# Reporting a security issue

Use [GitHub’s private vulnerability reporting](https://github.com/thomasgregg/chromium-link/security/advisories/new) to describe a security issue and how to reproduce it. Include the Chromium Link, Home Assistant, and Chromium app versions. Redact credentials, tokens, and private addresses from any logs or screenshots.

Chromium Link opens tabs via the Mincka app’s internal DevTools connection. The app exposes that connection to other apps on the internal Home Assistant network when debugging is enabled. Keep the host port unmapped and review which apps can reach the network.
