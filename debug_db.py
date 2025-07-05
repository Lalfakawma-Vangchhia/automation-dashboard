#!/usr/bin/env python3
"""
Simple script to check the database directly for automation rules.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.database import get_db
from backend.app.models.automation_rule import AutomationRule
from backend.app.models.social_account import SocialAccount
from backend.app.models.post import Post

def debug_database():
    """Check the database for automation rules and posts."""
    print("🔍 Debugging Database")
    
    try:
        db = next(get_db())
        
        # Check automation rules
        print("\n1️⃣ Automation Rules:")
        rules = db.query(AutomationRule).all()
        print(f"Found {len(rules)} automation rules")
        
        for rule in rules:
            print(f"\nRule ID: {rule.id}")
            print(f"Name: {rule.name}")
            print(f"Type: {rule.rule_type}")
            print(f"Active: {rule.is_active}")
            print(f"Actions: {rule.actions}")
            print(f"Trigger Conditions: {rule.trigger_conditions}")
            print("-" * 50)
        
        # Check social accounts
        print("\n2️⃣ Social Accounts:")
        accounts = db.query(SocialAccount).all()
        print(f"Found {len(accounts)} social accounts")
        
        for account in accounts:
            print(f"\nAccount ID: {account.id}")
            print(f"Platform: {account.platform}")
            print(f"Display Name: {account.display_name}")
            print(f"Platform User ID: {account.platform_user_id}")
            print(f"Connected: {account.is_connected}")
            print("-" * 50)
        
        # Check posts
        print("\n3️⃣ Posts:")
        posts = db.query(Post).all()
        print(f"Found {len(posts)} posts")
        
        for post in posts:
            print(f"\nPost ID: {post.id}")
            print(f"Content: {post.content[:50]}...")
            print(f"Platform Post ID: {post.platform_post_id}")
            print(f"Status: {post.status}")
            print(f"Social Account ID: {post.social_account_id}")
            print("-" * 50)
        
        db.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_database() 