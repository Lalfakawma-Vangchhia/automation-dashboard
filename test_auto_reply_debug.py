#!/usr/bin/env python3
"""
Debug script to test the auto-reply system and see what's happening.
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000/api"
LOGIN_EMAIL = "test@example.com"  # Replace with your test user email
LOGIN_PASSWORD = "testpassword"   # Replace with your test user password

def test_auto_reply_debug():
    """Test the auto-reply system and debug issues."""
    print("🔍 Testing Auto-Reply System Debug")
    
    # Step 1: Login
    print("\n1️⃣ Logging in...")
    login_data = {
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Login successful, token: {token[:20]}...")
    
    # Step 2: Get Facebook status
    print("\n2️⃣ Getting Facebook status...")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/social/facebook/status", headers=headers)
    
    if response.status_code == 200:
        status_data = response.json()
        print(f"✅ Facebook status: {json.dumps(status_data, indent=2)}")
        
        if status_data.get("connected"):
            pages = status_data.get("pages", [])
            if pages:
                page = pages[0]  # Use first page
                page_id = page.get("id")
                print(f"📄 Using page: {page.get('name')} (ID: {page_id})")
                
                # Step 3: Get posts for auto-reply
                print(f"\n3️⃣ Getting posts for auto-reply...")
                response = requests.get(f"{BASE_URL}/social/facebook/posts-for-auto-reply/{page_id}", headers=headers)
                
                if response.status_code == 200:
                    posts_data = response.json()
                    posts = posts_data.get("posts", [])
                    print(f"✅ Found {len(posts)} posts for auto-reply")
                    
                    if posts:
                        # Step 4: Enable auto-reply with first post
                        post = posts[0]
                        post_id = post.get("id")
                        facebook_post_id = post.get("facebook_post_id")
                        
                        print(f"\n4️⃣ Enabling auto-reply for post: {post.get('content', '')[:50]}...")
                        print(f"📝 Post ID: {post_id}, Facebook Post ID: {facebook_post_id}")
                        
                        auto_reply_data = {
                            "enabled": True,
                            "page_id": page_id,
                            "response_template": "Thank you for your comment! We appreciate your engagement.",
                            "selected_post_ids": [post_id]
                        }
                        
                        response = requests.post(f"{BASE_URL}/social/facebook/auto-reply", 
                                               json=auto_reply_data, headers=headers)
                        
                        if response.status_code == 200:
                            result = response.json()
                            print(f"✅ Auto-reply enabled: {json.dumps(result, indent=2)}")
                            
                            # Step 5: Get automation rules
                            print(f"\n5️⃣ Getting automation rules...")
                            response = requests.get(f"{BASE_URL}/social/automation-rules", headers=headers)
                            
                            if response.status_code == 200:
                                rules_data = response.json()
                                print(f"✅ Found {len(rules_data)} automation rules")
                                
                                for rule in rules_data:
                                    if rule.get("rule_type") == "AUTO_REPLY":
                                        print(f"🤖 Auto-reply rule: {json.dumps(rule, indent=2)}")
                        else:
                            print(f"❌ Failed to enable auto-reply: {response.status_code}")
                            print(response.text)
                    else:
                        print("❌ No posts found for auto-reply")
                else:
                    print(f"❌ Failed to get posts: {response.status_code}")
                    print(response.text)
            else:
                print("❌ No Facebook pages found")
        else:
            print("❌ Facebook not connected")
    else:
        print(f"❌ Failed to get Facebook status: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_auto_reply_debug() 