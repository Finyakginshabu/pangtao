"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'

Covers: public checks pass + login skipped without credentials; a database that
is not ready fails even if HTTP answers; the session is logged out even if a
check fails; a failing logout neither hides the original error nor prints PASS.
CHANGE ME: if you change the endpoints in smoke_test.py, update `response()` below.
"""
import importlib.util
from contextlib import redirect_stdout
import io
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, cookies=None):
        bodies = {
            '/api/v1/health': b'{"status":"ok"}',
            '/': b'<html></html>',
            '/api/v1/auth/login': b'{"user":{"email":"admin@example.test"}}',
            '/api/v1/auth/me': b'{"user":{"email":"admin@example.test"}}',
            '/api/v1/auth/logout': b'',
        }
        set_cookie = ['sid=test-session; Path=/; HttpOnly; Secure'] if path == '/api/v1/auth/login' else []
        return bodies[path], set_cookie

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 2)

    @patch.dict('os.environ', {}, clear=True)
    def test_unhealthy_database_fails_even_when_http_responds(self):
        def degraded(base, path, **kwargs):
            if path == '/api/v1/health':
                return b'{"status":"degraded"}', []
            return self.response(base, path, **kwargs)
        with patch.object(smoke, 'request', side_effect=degraded), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/v1/health'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'admin@example.test', 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_session_is_logged_out_even_if_me_fails(self):
        def broken_me(base, path, data=None, cookies=None):
            if path == '/api/v1/auth/me':
                raise ValueError('Broken response')
            return self.response(base, path, data, cookies)
        with patch.object(smoke, 'request', side_effect=broken_me) as req:
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
            self.assertEqual(req.call_args.args[1], '/api/v1/auth/logout')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'admin@example.test', 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_failing_logout_keeps_original_error_and_does_not_print_pass(self):
        logout_error = smoke.urllib.error.HTTPError('/api/v1/auth/logout', 401, 'Unauthorized', {}, io.BytesIO(b''))

        def broken_me_and_logout(base, path, data=None, cookies=None):
            if path == '/api/v1/auth/me':
                raise ValueError('Broken response')
            if path == '/api/v1/auth/logout':
                raise logout_error
            return self.response(base, path, data, cookies)
        output = io.StringIO()
        try:
            with patch.object(smoke, 'request', side_effect=broken_me_and_logout), \
                    redirect_stdout(output):
                with self.assertRaisesRegex(RuntimeError, 'Login smoke') as caught:
                    smoke.check('https://demo.test')
        finally:
            logout_error.close()
        self.assertNotIsInstance(caught.exception.__cause__, smoke.urllib.error.HTTPError)
        self.assertNotIn('PASS logout', output.getvalue())
        self.assertIn('WARN logout failed', output.getvalue())


if __name__ == '__main__':
    unittest.main()
