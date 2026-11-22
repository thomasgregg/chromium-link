# Marketplace and releases

Chromium Link uses the [Home Assistant Marketplace integration layout](https://contributors.home-assistant.io/marketplace/guides/integrations/). The runtime lives in `custom_components/chromium_link`, and `hacs.json` sets the minimum Home Assistant version. The README’s Marketplace link opens this project as a custom repository. A catalog listing is a separate review.

## Before publishing

- [ ] Install the exact release candidate through Marketplace on a Home Assistant OS instance running the minimum supported version.
- [ ] Add Chromium Link through **Devices & services** and confirm the setup has no fields. Restart HA and confirm the integration loads again.
- [ ] Verify the Mincka Chromium app is running, its host DevTools port mapping is blank, and Chromium Link can reach DevTools internally.
- [ ] Use ordinary dashboard buttons to open two different LAN pages. Paste a full device URL with query parameters and a fragment after `?url=`. Confirm that the requested tab is visible and **Back** returns to the dashboard. Also try a link with the full device URL percent-encoded for compatibility.
- [ ] Repeat through Nabu Casa with the client device off the home LAN. Check that an ordinary non-admin account cannot launch a tab.
- [ ] Confirm the integration shows a useful error when Chromium is stopped or DevTools is disabled.
- [ ] Confirm that **Tests**, **HACS validation**, and **hassfest** pass on the intended release commit. Save the run links for the catalog submission.
- [ ] Match the manifest version, changelog heading, and GitHub tag. Publish a full GitHub release with notes when the checks above pass.

## Package the release

From the validated release commit, build the ZIP from the integration directory so `manifest.json` is at the archive root.

```bash
git archive --format=zip --output=/tmp/chromium_link.zip HEAD:custom_components/chromium_link
unzip -t /tmp/chromium_link.zip
```

Attach `chromium_link.zip` to the GitHub release before publishing. Marketplace installs this asset, and HACS Downloads reads its GitHub download counter. Keep the filename in sync with `hacs.json` and the tracker configuration.

## Submit to the catalog

The repository owner or a major contributor can submit. Follow the [Marketplace catalog guide](https://contributors.home-assistant.io/marketplace/guides/catalog/) and open a PR to [hacs/default](https://github.com/hacs/default). Add `thomasgregg/chromium-link` alphabetically to the `integration` list and include the release and passing HACS and hassfest runs. The Marketplace shows the project in its default catalog after approval and indexing.

## Updating compatibility

Run the smoke test on supported Home Assistant and Chromium updates. Update `hacs.json` if a new release requires a more recent Home Assistant. The navigation handoff uses Home Assistant’s regular dashboard route and the installed add-on’s existing panel. The local tests cover destination parsing and route handoff with a simulated Home Assistant connection.
