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
  #status;

  connectedCallback() {
    if (!this.#status) {
      this.style.display = "block";
      this.style.padding = "24px";
      this.#status = document.createElement("p");
      this.#status.setAttribute("role", "status");
      this.#status.textContent = "Opening in Chromium…";
      const home = document.createElement("a");
      home.href = "/";
      home.textContent = "Return to Home Assistant";
      this.append(this.#status, home);
    }
    void this.#open();
  }

  set hass(value) {
    this.#hass = value;
    void this.#open();
  }

  async #open() {
    if (!this.isConnected || this.#started || !this.#hass || !this.#status) return;
    this.#started = true;

    try {
      // The standard Navigate action stamps the previous HA route in history.
      // An external link into this route must not trigger a LAN browser request.
      const previous = window.history.state?.from;
      if (
        typeof previous !== "string" ||
        !previous.startsWith("/") ||
        previous.startsWith("//") ||
        previous.startsWith("/chromium-launch")
      ) {
        throw new Error("Open Chromium Link from a Home Assistant dashboard button.");
      }

      const launchedFrom = window.location.href;
      const url = readDestination(window.location);
      const result = await this.#hass.callWS({ type: "chromium_link/open", url });
      if (!this.isConnected || window.location.href !== launchedFrom) return;

      // Replace the temporary launcher page so Back returns to the dashboard.
      window.location.replace(result.panel_path);
    } catch (error) {
      this.#status.textContent = error?.message || "Could not open the device in Chromium.";
    }
  }
}

customElements.define("chromium-link-panel", ChromiumLinkPanel);
