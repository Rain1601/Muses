from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import AuthService, get_db, router, settings


@pytest.mark.parametrize("provider", ["github", "google"])
def test_oauth_callback_redirects_new_and_returning_users_to_dashboard(monkeypatch, provider):
    exchange = AsyncMock(side_effect=[(None, "first-login-token", True), (None, "returning-token", False)])
    monkeypatch.setattr(AuthService, f"{provider}_oauth_callback", exchange)
    app = FastAPI()
    app.include_router(router, prefix="/api/auth")
    app.dependency_overrides[get_db] = lambda: None

    with TestClient(app, follow_redirects=False) as client:
        first_login = client.get(f"/api/auth/{provider}/callback", params={"code": "first-code"})
        returning_login = client.get(f"/api/auth/{provider}/callback", params={"code": "returning-code"})

    assert first_login.status_code == returning_login.status_code == 307
    assert first_login.headers["location"] == f"{settings.frontend_url}/dashboard?token=first-login-token"
    assert returning_login.headers["location"] == f"{settings.frontend_url}/dashboard?token=returning-token"
