import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("setup_app_links", Path(__file__).with_name("setup-app-links.py"))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class AppLinkSetupTests(unittest.TestCase):
    def test_signing_identifiers_are_validated_and_deduplicated(self):
        fingerprint = ":".join(["ab"]*32)
        result = setup.association_values("TESTTEAM12.org.cdaconnect.app", fingerprint+","+fingerprint)
        self.assertEqual(result["ANDROID_APP_LINK_SHA256"], fingerprint.upper())

    def test_environment_injection_and_wrong_bundle_are_rejected(self):
        fingerprint = ":".join(["AB"]*32)
        for apple in ["TESTTEAM12.evil.app", "TEAM.org.cdaconnect.app", "TESTTEAM12.org.cdaconnect.app\nJWT_ACCESS_SECRET=x"]:
            with self.assertRaises(ValueError):
                setup.association_values(apple, fingerprint)
        for value in ["AB:CD", fingerprint+"\nOTHER=x", ""]:
            with self.assertRaises(ValueError):
                setup.association_values("TESTTEAM12.org.cdaconnect.app", value)

    def test_update_is_private_and_preserves_existing_server_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"backend.env"
            path.write_text("# Existing configuration\nCORS_ORIGIN=https://cdaconnect.org\nJWT_ACCESS_SECRET=unchanged\nIOS_APP_ID=old\n")
            setup.save(path, {"IOS_APP_ID": "TESTTEAM12.org.cdaconnect.app"})
            self.assertIn("JWT_ACCESS_SECRET=unchanged\n", path.read_text())
            self.assertIn("CORS_ORIGIN=https://cdaconnect.org\n", path.read_text())
            self.assertNotIn("IOS_APP_ID=old", path.read_text())
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_missing_configuration_is_not_replaced_with_partial_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                setup.save(Path(directory)/"missing.env", {})

    def test_platform_setup_does_not_require_or_overwrite_other_platform(self):
        fingerprint = ":".join(["AB"]*32)
        self.assertEqual(setup.association_values("", fingerprint, "android"), {"ANDROID_APP_LINK_SHA256": fingerprint})
        self.assertEqual(setup.association_values("TESTTEAM12.org.cdaconnect.app", "", "ios"), {"IOS_APP_ID": "TESTTEAM12.org.cdaconnect.app"})
