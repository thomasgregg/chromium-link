"""Exercise destination validation and DevTools request encoding without HA."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest
from urllib.parse import unquote

PATH = Path(__file__).resolve().parents[1] / "custom_components/chromium_link/protocol.py"
SPEC = spec_from_file_location("chromium_link_protocol", PATH)
protocol = module_from_spec(SPEC)
SPEC.loader.exec_module(protocol)


class DestinationTests(unittest.TestCase):
    def test_new_tab_path_preserves_destination(self):
        for url in (
            "http://device.local/",
            "https://router.local:8443/a?x=%2B&q=a+b#status",
            "http://[fd00::1]/",
        ):
            with self.subTest(url=url):
                request = protocol.new_tab_path(url)
                path, query = request.split("?", 1)
                self.assertEqual(path, "/json/new")
                self.assertEqual(unquote(query), url)
                self.assertNotIn("&", query)
                self.assertNotIn("#", query)

    def test_rejects_invalid_or_non_web_destinations(self):
        for url in (
            "file:///etc/passwd",
            "javascript:alert(1)",
            "//device.local/",
            "http:///",
            "http://user:password@device.local/",
            "http://device.local:0/",
            "http://device.local:99999/",
            "http://device.local/wrong\npath",
            "http://device.local/has space",
            "http://device.local\\path",
            "https://device.local/" + "x" * 4096,
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                protocol.new_tab_path(url)
