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
  const timers = new Map();
  const elements = new Map();
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
    setTimeout(callback, delay) { timers.set(callback, delay); return callback; },
    clearTimeout(timer) { timers.delete(timer); },
    dispatchEvent(event) { events.push({ event, href: window.location.href }); },
  };
  class Element {
    isConnected = false;
    attachShadow() {
      this.shadowRoot = {
        querySelector(selector) {
          if (!elements.has(selector)) {
            elements.set(selector, {
              hidden: true,
              attributes: {},
              addEventListener() {},
              setAttribute(name, value) { this.attributes[name] = value; },
            });
          }
          return elements.get(selector);
        },
      };
      return this.shadowRoot;
    }
  }
  vm.runInNewContext(source, {
    window,
    HTMLElement: Element,
    CustomEvent,
    URLSearchParams,
    customElements: { define(_name, implementation) { Panel = implementation; } },
  });
  const panel = new Panel();
  panel.hass = { callWS };
  panel.isConnected = true;
  panel.connectedCallback();
  const get = (selector) => panel.shadowRoot.querySelector(selector);
  return { panel, navigations, events, timers, get };
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
    const { panel, navigations, events, timers, get } = mount(`?url=${address}`, "/chromium-link-demo", hass.callWS);
    panel.hass = hass;
    await settle();
    assert.deepEqual(calls, [{ type: "chromium_link/open", url: expected }]);
    assert.deepEqual(navigations, ["/49e24ccc_chromium"]);
    assert.equal(events.length, 1);
    assert.equal(events[0].event.type, "location-changed");
    assert.equal(events[0].event.detail.replace, true);
    assert.equal(events[0].href, "http://homeassistant.local/49e24ccc_chromium");
    assert.equal(get(".panel").hidden, true);
    assert.equal(timers.size, 0);
  }
});

test("direct visits, launcher navigation, and duplicate encoded destinations do not open tabs", async () => {
  for (const [suffix, previous] of [
    ["?url=http://device.local/", null],
    ["?url=http://device.local/", "/chromium-link?url=http://other.local/"],
    ["?url=http%3A%2F%2Fdevice.local%2F&url=http%3A%2F%2Fother.local%2F", "/dashboard"],
  ]) {
    let calls = 0;
    const { get, navigations } = mount(suffix, previous, async () => { calls += 1; });
    await settle();
    assert.equal(calls, 0);
    assert.deepEqual(navigations, []);
    assert.match(get(".error-message").textContent, /dashboard button/);
  }
});

test("a launch failure stays on the launcher and displays the cause", async () => {
  let fail;
  const launch = new Promise((_, reject) => { fail = reject; });
  const { get, navigations, timers } = mount("?url=http://device.local/", "/dashboard/devices", () => launch);
  const [[showLoading, delay]] = timers;
  assert.equal(delay, 300);
  assert.equal(get(".panel").hidden, true);
  showLoading();
  assert.equal(get(".loading").hidden, false);
  assert.equal(get(".failure").hidden, true);

  fail(new Error("Start Chromium"));
  await settle();
  assert.deepEqual(navigations, []);
  assert.equal(get(".loading").hidden, true);
  assert.equal(get(".failure").hidden, false);
  assert.equal(get(".error-message").textContent, "Start Chromium");
  assert.equal(get("ha-button").attributes.href, "/dashboard/devices");
});
