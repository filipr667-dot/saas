"""Backend API tests for Document Control Management System"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Shared session with cookies
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

class TestHealth:
    """Health check"""
    def test_health(self):
        r = session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestAuth:
    """Auth flow tests"""
    def test_login_success(self):
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com",
            "password": "Admin@12345"
        })
        assert r.status_code == 200
        data = r.json()
        # Login returns user object directly
        assert "email" in data
        assert data["role"] == "admin"
        print(f"Login success: {data['email']}")

    def test_get_me(self):
        # Login first
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@doccontrol.com"

    def test_login_invalid(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "wrongpassword"
        })
        assert r.status_code in [401, 403]


class TestDocuments:
    """Document CRUD tests"""
    def setup_method(self):
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })

    def test_list_documents(self):
        r = session.get(f"{BASE_URL}/api/documents")
        assert r.status_code == 200
        data = r.json()
        # Response has items key
        assert "items" in data or "documents" in data or isinstance(data, list)

    def test_create_document(self):
        # Get a valid doc_type_id first
        dt_r = session.get(f"{BASE_URL}/api/settings/doc-types")
        assert dt_r.status_code == 200
        doc_types = dt_r.json()
        doc_type_id = doc_types[0]["id"]

        r = session.post(f"{BASE_URL}/api/documents", json={
            "title": "TEST_Policy Document",
            "doc_type_id": doc_type_id,
            "description": "Test policy document"
        })
        assert r.status_code in [200, 201], f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "id" in data
        print(f"Created doc: {data.get('doc_number', data.get('id'))}")


class TestDashboard:
    """Dashboard stats"""
    def setup_method(self):
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })

    def test_dashboard_stats(self):
        r = session.get(f"{BASE_URL}/api/documents/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        print(f"Dashboard stats: {data}")


class TestUsers:
    """User management"""
    def setup_method(self):
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })

    def test_list_users(self):
        r = session.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or "users" in data

    def test_create_user(self):
        import time
        ts = int(time.time())
        r = session.post(f"{BASE_URL}/api/users", json={
            "email": f"TEST_user_{ts}@doccontrol.com",
            "name": "Test User",
            "role": "author",
            "department": "QA",
            "password": "Test@12345"
        })
        assert r.status_code in [200, 201], f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "id" in data


class TestAudit:
    """Audit trail"""
    def setup_method(self):
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })

    def test_audit_list(self):
        r = session.get(f"{BASE_URL}/api/audit")
        assert r.status_code == 200


class TestSettings:
    """Settings"""
    def setup_method(self):
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@doccontrol.com", "password": "Admin@12345"
        })

    def test_doc_types(self):
        r = session.get(f"{BASE_URL}/api/settings/doc-types")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        print(f"Doc types: {[d['prefix'] for d in data]}")
