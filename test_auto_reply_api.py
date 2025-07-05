#!/usr/bin/env python3
"""
Simple test script to verify the auto-reply API endpoints work correctly.
Run this after starting the backend server.
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api"
LOGIN_EMAIL = "test@example.com"  # Replace with your test user email
LOGIN_PASSWORD = "testpassword"   # Replace with your test user password

def test_login():
    """Test login to get authentication token."""
    print("🔐 Testing login...")
    
    login_data = {
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"✅ Login successful! Token: {token[:20]}...")
        return token
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_get_posts_for_auto_reply(token, page_id):
    """Test getting posts for auto-reply selection."""
    print(f"\n📋 Testing get posts for auto-reply (page_id: {page_id})...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/social/facebook/posts-for-auto-reply/{page_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Found {data.get('total_count', 0)} posts")
        print(f"📝 Posts: {json.dumps(data.get('posts', [])[:2], indent=2)}")  # Show first 2 posts
        return data.get('posts', [])
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")
        return []

def test_toggle_auto_reply(token, page_id, enabled=True, selected_post_ids=None):
    """Test toggling auto-reply."""
    print(f"\n🔄 Testing toggle auto-reply (enabled: {enabled})...")
    
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "enabled": enabled,
        "page_id": page_id,
        "response_template": "Thank you for your comment! We appreciate your engagement. 😊",
        "selected_post_ids": selected_post_ids or []
    }
    
    response = requests.post(f"{BASE_URL}/social/facebook/auto-reply", json=data, headers=headers)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Success! {result.get('message', 'Auto-reply toggled')}")
        print(f"📊 Data: {json.dumps(result.get('data', {}), indent=2)}")
        return True
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")
        return False

def main():
    """Main test function."""
    print("🚀 Starting Auto-Reply API Tests")
    print("=" * 50)
    
    # Test login
    token = test_login()
    if not token:
        print("❌ Cannot proceed without authentication token")
        return
    
    # Test with a sample page ID (you'll need to replace this with a real page ID)
    page_id = "655661974536409"  # Replace with a real page ID from your Facebook connection
    
    # Test getting posts
    posts = test_get_posts_for_auto_reply(token, page_id)
    
    # Test enabling auto-reply with selected posts
    if posts:
        selected_ids = [posts[0]['id']]  # Select first post
        test_toggle_auto_reply(token, page_id, enabled=True, selected_post_ids=selected_ids)
    else:
        # Test without posts (should still work for disabling)
        test_toggle_auto_reply(token, page_id, enabled=False)
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    main() 