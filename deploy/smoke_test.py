"""Public deployment checks for Pangtao. Credentials/tokens are never printed.

WHAT THIS SCRIPT DOES
    Intended to be called by .github/workflows/deploy.yml (#27, TBD) after a
    deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/v1/health -> {"status": "ok"}
         The handler runs `SELECT 1` (server/src/routes/health.routes.ts) and
         answers 503 {"status": "degraded"} when the database is unreachable, so
         this single read-only check proves both the service and the DB work.
      2. GET / -> HTML page (the same container serves the built React app)
      3. OPTIONAL login test -> POST /api/v1/auth/login, GET /api/v1/auth/me,
         POST /api/v1/auth/logout. Runs only if BOTH env vars SMOKE_EMAIL and
         SMOKE_PASSWORD are set (set both or neither). The session is always
         logged out, even if a check fails. For the seeded demo users use
         admin@example.test and the value of the pangtao-seed-password secret.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Mutating requests send an Origin header: the app rejects POST/PUT/PATCH/DELETE
    without a same-host Origin (CSRF guard, NFR-10 / AC-01.13).
    Offline unit tests: deploy/tests/test_smoke.py

REFERENCES
    - urllib.request : https://docs.python.org/3/library/urllib.request.html
    - unittest.mock  : https://docs.python.org/3/library/unittest.mock.html

CHANGE ME (if the endpoints move):
    - the paths and predicates in check() below
    - the login/logout endpoints and the session cookie name (`sid`)
"""
import json
import os
import sys
import time
import http.client
import urllib.error
import urllib.request

SESSION_COOKIE = 'sid'


# --- HTTP helper --------------------------------------------------------------
# Returns (body bytes, Set-Cookie headers). Raises on HTTP errors / timeouts.
def request(base, path, data=None, cookies=None):
    headers = {'Origin': base}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if cookies:
        headers['Cookie'] = '; '.join(f'{name}={value}' for name, value in cookies.items())
    req = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read(), response.headers.get_all('Set-Cookie') or []


def session_cookies(set_cookie_headers, cookies=None):
    """Merge Set-Cookie headers into a {name: value} dict (an empty value deletes)."""
    merged = dict(cookies or {})
    for header in set_cookie_headers:
        name, _, value = header.split(';', 1)[0].strip().partition('=')
        if value:
            merged[name] = value
        else:
            merged.pop(name, None)
    return merged


def check(base):
    # --- Public checks (read-only: health runs SELECT 1, / is static HTML) ----
    for path, predicate in (
        ('/api/v1/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/', lambda b: b'<html' in b.lower()),
    ):
        # Retry: a cold Cloud Run instance may need a few seconds to start.
        for attempt in range(5):
            try:
                body, _ = request(base, path)
                if not predicate(body):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError, http.client.HTTPException, ConnectionError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    # --- Optional login check (only when both credentials are provided) -------
    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    cookies = {}
    try:
        body, set_cookie = request(base, '/api/v1/auth/login', {'email': email, 'password': password})
        cookies = session_cookies(set_cookie)
        if not json.loads(body).get('user') or SESSION_COOKIE not in cookies:
            raise ValueError('Login did not return a session')
        body, _ = request(base, '/api/v1/auth/me', cookies=cookies)
        if not json.loads(body).get('user'):
            raise ValueError('No user in /api/v1/auth/me')
        print('PASS login and authenticated GET /api/v1/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, http.client.HTTPException, ConnectionError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed. A failure here
        # must not replace the original error, so it is reported separately.
        if cookies:
            try:
                request(base, '/api/v1/auth/logout', data={}, cookies=cookies)
                print('PASS logout')
            except (urllib.error.URLError, TimeoutError, ValueError, http.client.HTTPException, ConnectionError) as error:
                print('WARN logout failed: ' + type(error).__name__)


# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
