"""
Test script for JWT authentication endpoints.
Tests login and protected API endpoints.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_login():
    """Test the login endpoint."""
    print("\n=== Testing Login ===")
    
    # Test successful login
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login successful!")
        print(f"Access Token: {data['access_token'][:50]}...")
        print(f"User: {data['user']}")
        return data['access_token']
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

def test_protected_endpoint(token):
    """Test accessing a protected endpoint."""
    print("\n=== Testing Protected Endpoint (/api/live) ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/live", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Successfully accessed protected endpoint!")
        print(f"Devices: {list(data.keys())}")
        for device_id, info in data.items():
            print(f"  - {device_id}: Online={info['online']}, Lat={info['latitude']}, Lng={info['longitude']}")
    else:
        print(f"❌ Failed to access protected endpoint: {response.status_code}")
        print(response.text)

def test_without_token():
    """Test accessing protected endpoint without token."""
    print("\n=== Testing Without Token (Should Fail) ===")
    
    response = requests.get(f"{BASE_URL}/api/live")
    
    if response.status_code == 403:
        print("✅ Correctly rejected request without token")
        print(f"Status: {response.status_code}")
    else:
        print(f"⚠️ Unexpected response: {response.status_code}")
        print(response.text)

def test_invalid_credentials():
    """Test login with invalid credentials."""
    print("\n=== Testing Invalid Credentials ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": "admin", "password": "wrongpassword"}
    )
    
    if response.status_code == 401:
        print("✅ Correctly rejected invalid credentials")
        print(f"Status: {response.status_code}")
    else:
        print(f"⚠️ Unexpected response: {response.status_code}")

def test_user_info(token):
    """Test getting current user info."""
    print("\n=== Testing User Info Endpoint ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Successfully retrieved user info!")
        print(f"User Info: {json.dumps(data, indent=2)}")
    else:
        print(f"❌ Failed: {response.status_code}")

if __name__ == "__main__":
    print("🧪 JWT Authentication Test Suite")
    print("=" * 60)
    
    # Test 1: Invalid credentials
    test_invalid_credentials()
    
    # Test 2: Access without token
    test_without_token()
    
    # Test 3: Successful login
    token = test_login()
    
    if token:
        # Test 4: Access protected endpoint with token
        test_protected_endpoint(token)
        
        # Test 5: Get user info
        test_user_info(token)
    
    print("\n" + "=" * 60)
    print("✨ Test suite completed!")
    print("\nDefault credentials:")
    print("  - admin/admin123 (full access)")
    print("  - driver/driver123 (driver access)")
    print("  - parent/parent123 (parent access)")
