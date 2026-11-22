const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { setImmediate: settle } = require("node:timers/promises");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(
  resolve(__dirname, "../custom_components/chromium_link/panel.js"),
  "utf8",
);

function mount(suffix, previous, callWS) {
  let Panel;
  const navigations = [];
  const events = [];
  const location = new URL(`/chromium-link${suffix}`, "http://homeassistant.local");
  const initialState = previous ? { from: previous, dashboardState: true } : null;
  const window = {
    history: {
      state: initialState,
      replaceState(state, _unused, path) {
        assert.equal(state, initialState);
        navigations.push(path);
        window.location.href = new URL(path, location).href;
      },
    },
    location: {
      search: location.search,
      href: location.href,
    },
    dispatchEvent(event) { events.push({ event, href: window.location.href }); },
  };
  class Element {
    style = {};
    isConnected = false;
    append(status) { this.status = status; }
  }
  vm.runInNewContext(source, {
    window,
    HTMLElement: Element,
    CustomEvent,
    URLSearchParams,
    customElements: { define(_name, implementation) { Panel = implementation; } },
    document: { createElement: () => ({ setAttribute() {} }) },
  });
  const panel = new Panel();
  panel.hass = { callWS };
  panel.isConnected = true;
  panel.connectedCallback();
  return { panel, navigations, events };
}

test("opens the full destination and switches panels exactly once", async () => {
  const url = "http://device.local/settings?setting=a%2Bb+c&mode=2&url=local#status";
  const fragmentUrl = "https://device.local/#/network?tab=wifi";
  for (const [address, expected] of [
    [url, url],
    [fragmentUrl, fragmentUrl],
    [encodeURIComponent(url), url],
  ]) {
    const calls = [];
    const hass = { async callWS(command) {
      calls.push({ ...command });
      return { panel_path: "/49e24ccc_chromium" };
    } };
    const { panel, navigations, events } = mount(`?url=${address}`, "/chromium-link-demo", hass.callWS);
    panel.hass = hass;
    await settle();
    assert.deepEqual(calls, [{ type: "chromium_link/open", url: expected }]);
    assert.deepEqual(navigations, ["/49e24ccc_chromium"]);
    assert.equal(events.length, 1);
    assert.equal(events[0].event.type, "location-changed");
    assert.equal(events[0].event.detail.replace, true);
    assert.equal(events[0].href, "http://homeassistant.local/49e24ccc_chromium");
  }
});

test("direct visits, launcher navigation, and duplicate encoded destinations do not open tabs", async () => {
  for (const [suffix, previous] of [
    ["?url=http://device.local/", null],
    ["?url=http://device.local/", "/chromium-link?url=http://other.local/"],
    ["?url=http%3A%2F%2Fdevice.local%2F&url=http%3A%2F%2Fother.local%2F", "/dashboard"],
  ]) {
    let calls = 0;
    const { panel, navigations } = mount(suffix, previous, async () => { calls += 1; });
    await settle();
    assert.equal(calls, 0);
    assert.deepEqual(navigations, []);
    assert.match(panel.status.textContent, /dashboard button/);
  }
});

test("a launch failure stays on the launcher and displays the cause", async () => {
  const { panel, navigations } = mount("?url=http://device.local/", "/dashboard", async () => {
    throw new Error("Start Chromium");
  });
  await settle();
  assert.deepEqual(navigations, []);
  assert.equal(panel.status.textContent, "Start Chromium");
});
