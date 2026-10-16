import importlib.util
from pathlib import Path
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('setup_ai', Path(__file__).resolve().parents[1]/'deploy/setup-ai.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

class SetupTests(unittest.TestCase):
    def test_defaults_preserve_credentials_and_share_one_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'backend.env').write_text('DB_NAME=KeepMe\nJWT_ACCESS_SECRET=unchanged\n')
            setup.configure(root, defaults=True)
            first = setup.values(root/'backend.env')
            self.assertEqual(first['DB_NAME'], 'KeepMe')
            self.assertEqual(first['JWT_ACCESS_SECRET'], 'unchanged')
            self.assertEqual(first['AI_SERVICE_URL'], 'http://127.0.0.1:8001/answer')
            self.assertGreaterEqual(len(first['AI_SERVICE_API_KEY']), 32)
            self.assertEqual(first['AI_SERVICE_API_KEY'], setup.values(root/'ai.env')['AI_SERVICE_API_KEY'])
            setup.configure(root, defaults=True)
            self.assertEqual(setup.values(root/'backend.env'), first)
            self.assertEqual((root/'ai.env').stat().st_mode & 0o777, 0o600)

    def test_existing_adapters_are_not_silently_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'backend.env').write_text('AI_SERVICE_URL=https://adapter.example.test/answer\n')
            setup.configure(root, defaults=True)
            self.assertEqual(setup.values(root/'backend.env')['AI_SERVICE_URL'], 'https://adapter.example.test/answer')
