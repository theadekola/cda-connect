import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("setup_turn", pathlib.Path(__file__).with_name("setup-turn.py"))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class TurnSetupTests(unittest.TestCase):
    def test_nat_mapping_and_authentication(self):
        config = setup.relay_config("relay.test.invalid", "8.8.8.8", "10.10.10.10", "a"*64, True)
        self.assertIn("external-ip=8.8.8.8/10.10.10.10\n", config)
        self.assertIn("use-auth-secret\n", config)
        self.assertIn("tls-listening-port=5349\n", config)
        self.assertIn("denied-peer-ip=10.0.0.0-10.255.255.255\n", config)
        self.assertIn("min-port=49160\n", config)

    def test_input_injection_and_private_public_addresses_rejected(self):
        for host in ["relay.test.invalid\nno-auth", "https://relay.test.invalid", "turn.example.com"]:
            with self.assertRaises(ValueError):
                setup.hostname(host)
        with self.assertRaises(ValueError):
            setup.shared_secret("bad\nno-auth")
        with self.assertRaises(ValueError):
            setup.relay_config("relay.test.invalid", "192.168.1.1", "10.10.10.10", "a"*64, False)

    def test_environment_update_preserves_other_settings_and_removes_duplicate_turn_keys(self):
        original = "DB_NAME=KeepMe\nJWT_ACCESS_SECRET=keep-me\nRTC_TURN_SECRET=old\nexport RTC_TURN_SECRET=duplicate\n# comment\n"
        values = setup.app_values("relay.test.invalid", "b"*64, False)
        updated = setup.update_env(original, values)
        self.assertIn("DB_NAME=KeepMe\nJWT_ACCESS_SECRET=keep-me\n", updated)
        self.assertEqual(updated.count("RTC_TURN_SECRET="), 1)
        self.assertNotIn("turns:", updated)
        self.assertIn("# comment", updated)


if __name__ == "__main__":
    unittest.main()
