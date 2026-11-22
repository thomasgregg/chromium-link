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

function mount(search, previous, callWS) {
  let Panel;
  const navigations = [];
  const window = {
    history: { state: previous ? { from: previous } : null },
    location: {
      search,
      href: `http://homeassistant.local/chromium-launch${search}`,
      replace(path) { navigations.push(path); },
    },
  };
  class Element {
    style = {};
    isConnected = false;
    append(status) { this.status = status; }
  }
  vm.runInNewContext(source, {
    window,
    HTMLElement: Element,
    URLSearchParams,
    customElements: { define(_name, implementation) { Panel = implementation; } },
    document: { createElement: () => ({ setAttribute() {} }) },
  });
  const panel = new Panel();
  panel.hass = { callWS };
  panel.isConnected = true;
  panel.connectedCallback();
  return { panel, navigations };
}

test("opens the full destination and switches panels exactly once", async () => {
  const url = "http://device.local/?setting=a%2Bb&mode=2#status";
  let calls = 0;
  const hass = { async callWS(command) {
    calls += 1;
    assert.equal(command.type, "chromium_link/open");
    assert.equal(command.url, url);
    return { panel_path: "/49e24ccc_chromium" };
  } };
  const { panel, navigations } = mount(`?url=${encodeURIComponent(url)}`, "/dashboard", hass.callWS);
  panel.hass = hass;
  await settle();
  assert.equal(calls, 1);
  assert.deepEqual(navigations, ["/49e24ccc_chromium"]);
});

test("a pasted link or duplicate destination leaves Chromium alone", async () => {
  for (const [search, previous] of [
    ["?url=http://device.local/", null],
    ["?url=http://device.local/&url=http://other.local/", "/dashboard"],
  ]) {
    let calls = 0;
    const { panel, navigations } = mount(search, previous, async () => { calls += 1; });
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
