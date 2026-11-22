"""Open dashboard URLs in the installed Mincka Chromium add-on."""

import asyncio
from pathlib import Path
from typing import Any

import aiohttp
from aiohasupervisor import SupervisorError
import probatio as pb
from yarl import URL

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.hassio import get_supervisor_client
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType

from .protocol import new_tab_path

DOMAIN = "chromium_link"
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PANEL_PATH = "chromium-link"
MODULE_URL = "/api/chromium_link/panel.js"
# Supervisor derives this ID from the published Mincka repository and app slug.
CHROMIUM_APP = "49e24ccc_chromium"
CHROMIUM_HOST = CHROMIUM_APP.replace("_", "-")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the launch command and its panel's frontend module once."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(MODULE_URL, str(Path(__file__).with_name("panel.js")), False)]
    )
    websocket_api.async_register_command(hass, websocket_open)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Register an admin-only route without a sidebar entry."""
    await panel_custom.async_register_panel(
        hass,
        PANEL_PATH,
        "chromium-link-panel",
        module_url=MODULE_URL,
        require_admin=True,
    )
    hass.data[DOMAIN] = entry.entry_id
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove the launch route and disable the command."""
    hass.data.pop(DOMAIN, None)
    frontend.async_remove_panel(hass, PANEL_PATH)
    return True


@websocket_api.require_admin
@websocket_api.websocket_command(
    {pb.Required("type"): "chromium_link/open", pb.Required("url"): str}
)
@websocket_api.async_response
async def websocket_open(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Open one tab via the internal Chromium endpoint."""
    request_id = msg["id"]
    if DOMAIN not in hass.data:
        connection.send_error(
            request_id, "not_enabled", "Add Chromium Link in Devices & services."
        )
        return

    try:
        path = new_tab_path(msg["url"])
    except ValueError as err:
        connection.send_error(request_id, "invalid_url", str(err))
        return

    try:
        addon = await get_supervisor_client(hass).addons.addon_info(CHROMIUM_APP)
    except SupervisorError:
        connection.send_error(
            request_id, "addon_unavailable",
            "Home Assistant could not find the Mincka Chromium app.",
        )
        return

    if addon.state != "started" or not addon.ingress_url:
        connection.send_error(
            request_id, "addon_not_running",
            "Start Chromium in Settings → Apps, then try again.",
        )
        return

    debugging_enabled = str(addon.options.get("CHROMIUM_REMOTE_DEBUGGING", "0")).lower()
    if debugging_enabled not in {"1", "true", "yes", "on"}:
        connection.send_error(
            request_id, "debugging_disabled",
            "Enable CHROMIUM_REMOTE_DEBUGGING in Chromium and restart it.",
        )
        return

    try:
        port = int(addon.options.get("CHROMIUM_REMOTE_DEBUGGING_PORT", 9222))
        if not 1 <= port < 65535:
            raise ValueError
    except (TypeError, ValueError):
        connection.send_error(
            request_id, "invalid_port", "Set a valid internal DevTools port in Chromium."
        )
        return

    # Use the Supervisor's internal DNS name. Chromium accepts localhost in the
    # HTTP Host header as well as an IP, but rejects ordinary DNS names there.
    endpoint = URL(f"http://{CHROMIUM_HOST}:{port}{path}", encoded=True)
    session = async_get_clientsession(hass)
    try:
        async with session.put(
            endpoint,
            headers={"Host": f"localhost:{port}"},
            allow_redirects=False,
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            if response.status != 200:
                raise ValueError("DevTools rejected the request")
            result = await response.json()
            if not isinstance(result, dict) or not result.get("id"):
                raise ValueError("DevTools did not return a tab ID")
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        connection.send_error(
            request_id,
            "chromium_unreachable",
            "Chromium did not confirm that it opened the tab. "
            "Check its internal DevTools connection.",
        )
        return

    connection.send_result(request_id, {"panel_path": f"/{CHROMIUM_APP}"})
