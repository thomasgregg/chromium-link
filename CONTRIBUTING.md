# Contributing

Chromium Link has two parts. The Home Assistant integration validates destinations and opens tabs through Chromium’s DevTools interface. The launch panel reads the dashboard URL, makes the authenticated request, and hands the page back to Home Assistant’s Chromium panel.

## Run the local checks

From the repository root, run the same tests as the **Tests** job in GitHub Actions. They use Python and Node.js standard libraries.

```sh
python3 -m unittest discover -s tests -v
node --test tests/panel.test.cjs
```

For changes to installation or routing behavior, also run the [Home Assistant OS smoke test](docs/marketplace.md#before-publishing). Keep the standard Button card syntax working for pasted addresses with query strings and fragments, as well as existing links with fully encoded addresses. Use example hostnames in public test output and screenshots.
