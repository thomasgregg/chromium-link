"""Set up Chromium Link."""

from homeassistant.config_entries import ConfigFlow


class ChromiumLinkConfigFlow(ConfigFlow, domain="chromium_link"):
    """Register a single launcher on this Home Assistant instance."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create the integration entry."""
        await self.async_set_unique_id("chromium_link")
        self._abort_if_unique_id_configured()
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title="Chromium Link", data={})
