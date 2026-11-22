const LOADING_DELAY_MS = 300;
const MENU_ICON = "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z";

const PANEL = `
  <style>
    :host {
      display: block;
      height: 100%;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
    }
    [hidden] { display: none !important; }
    .panel { display: flex; flex-direction: column; min-height: 100%; }
    header {
      display: flex;
      align-items: center;
      min-height: var(--header-height, 56px);
      padding-block-start: var(--safe-area-inset-top, 0px);
      padding-inline: var(--ha-space-6, 24px);
      background: var(--app-header-background-color);
      color: var(--app-header-text-color);
      border-bottom: var(--app-header-border-bottom, 1px solid var(--divider-color));
      font-size: var(--ha-font-size-xl, 20px);
    }
    :host([narrow]) header { padding-inline: var(--ha-space-2, 8px); }
    ha-icon-button { display: none; margin-inline-end: var(--ha-space-2, 8px); }
    :host([narrow]) ha-icon-button { display: inline-flex; }
    main {
      display: grid;
      flex: 1;
      place-items: center;
      padding: var(--ha-space-4, 16px);
      font-size: var(--ha-font-size-m, 14px);
      line-height: var(--ha-line-height-normal, 20px);
    }
    .loading { display: flex; align-items: center; gap: var(--ha-space-3, 12px); }
    .failure { width: min(100%, 460px); }
    ha-alert {
      display: block;
      --ha-alert-icon-size: 0px;
      --ha-alert-padding: var(--ha-space-3, 12px) var(--ha-space-2, 8px);
    }
    /* The alert may be registered lazily by Home Assistant. */
    ha-alert:not(:defined) {
      padding: var(--ha-space-3, 12px) var(--ha-space-4, 16px);
      border-radius: var(--ha-border-radius-sm, 8px);
      background: color-mix(in srgb, var(--error-color) 12%, transparent);
    }
    .error-title { display: block; margin-bottom: 2px; }
    .actions { display: flex; justify-content: end; margin-top: var(--ha-space-2, 8px); }
  </style>
  <div class="panel" hidden>
    <header>
      <ha-icon-button label="Toggle sidebar"></ha-icon-button>
      Chromium Link
    </header>
    <main>
      <div class="loading" role="status" hidden>
        <ha-spinner size="small" aria-hidden="true"></ha-spinner>
        Opening in Chromium…
      </div>
      <div class="failure" hidden>
        <ha-alert alert-type="error" role="alert">
          <span slot="icon" hidden></span>
          <strong class="error-title">Couldn’t open Chromium</strong>
          <span class="error-message"></span>
        </ha-alert>
        <div class="actions">
          <ha-button appearance="plain" size="s">Back to dashboard</ha-button>
        </div>
      </div>
    </main>
  </div>
`;

function readDestination({ href, search }) {
  const prefix = "?url=";
  if (search.startsWith(prefix)) {
    // The pasted address can have its own query and fragment. Read both from href.
    const address = href.slice(href.indexOf("?") + prefix.length);
    if (/^https?:\/\//i.test(address)) return address;
  }

  // Keep accepting dashboard links that encoded the entire address.
  const destinations = new URLSearchParams(search).getAll("url");
  if (destinations.length !== 1 || !destinations[0]) {
    throw new Error("The dashboard button needs one device URL in its navigation path.");
  }
  return destinations[0];
}

class ChromiumLinkPanel extends HTMLElement {
  #hass;
  #started = false;

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" }).innerHTML = PANEL;
      const menu = this.shadowRoot.querySelector("ha-icon-button");
      menu.setAttribute("path", MENU_ICON);
      menu.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
      });
    }
    void this.#open();
  }

  set narrow(value) {
    this.toggleAttribute("narrow", value);
  }

  set hass(value) {
    this.#hass = value;
    void this.#open();
  }

  async #open() {
    if (!this.isConnected || this.#started || !this.#hass || !this.shadowRoot) return;
    this.#started = true;

    const launchedFrom = window.location.href;
    const isCurrent = () => this.isConnected && window.location.href === launchedFrom;
    const panel = this.shadowRoot.querySelector(".panel");
    const loading = this.shadowRoot.querySelector(".loading");
    const previous = window.history.state?.from;
    const fromDashboard = typeof previous === "string" &&
      /^\/(?!\/)[^\\\u0000-\u001f\u007f]*$/.test(previous) &&
      !/^\/chromium-link(?:[/?#]|$)/.test(previous);
    let loadingTimer;

    try {
      // The standard Navigate action stamps the previous HA route in history.
      // An external link into this route must not trigger a LAN browser request.
      if (!fromDashboard) {
        throw new Error("Open Chromium Link from a Home Assistant dashboard button.");
      }

      const url = readDestination(window.location);
      loadingTimer = window.setTimeout(() => {
        if (!isCurrent()) return;
        loading.hidden = false;
        panel.hidden = false;
      }, LOADING_DELAY_MS);
      const result = await this.#hass.callWS({ type: "chromium_link/open", url });
      if (!isCurrent()) return;

      // Replace the launcher route and let Home Assistant switch panels in place.
      window.history.replaceState(window.history.state, "", result.panel_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: true } }));
    } catch (error) {
      if (!isCurrent()) return;
      const message = this.shadowRoot.querySelector(".error-message");
      const back = this.shadowRoot.querySelector("ha-button");
      message.textContent = error?.message || "Return to the dashboard and try again.";
      back.setAttribute("href", fromDashboard ? previous : "/");
      loading.hidden = true;
      this.shadowRoot.querySelector(".failure").hidden = false;
      panel.hidden = false;
    } finally {
      window.clearTimeout(loadingTimer);
    }
  }
}

customElements.define("chromium-link-panel", ChromiumLinkPanel);
