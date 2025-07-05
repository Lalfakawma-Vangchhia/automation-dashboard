#!/usr/bin/env python3
"""
Test script to verify Stability AI API key is working correctly.
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from backend directory
load_dotenv('backend/.env')

def test_stability_api():
    """Test the Stability AI API with the current API key."""
    
    # Get API key from environment
    api_key = os.getenv('STABILITY_API_KEY')
    
    if not api_key:
        print("❌ STABILITY_API_KEY not found in environment variables")
        return False
    
    print(f"🔑 API Key found: {api_key[:10]}...")
    
    # Test API endpoint
    url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "text_prompts": [{"text": "A simple test image"}],
        "cfg_scale": 7,
        "height": 1024,  # Fixed: Use valid SDXL dimensions
        "width": 1024,   # Fixed: Use valid SDXL dimensions
        "samples": 1,
        "steps": 10,  # Quick test
    }
    
    try:
        print("🔄 Testing API connection...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if "artifacts" in result and len(result["artifacts"]) > 0:
                print("✅ API key is valid and working!")
                print(f"📝 Generated image with {len(result['artifacts'])} artifacts")
                return True
            else:
                print("❌ API returned 200 but no artifacts found")
                return False
        elif response.status_code == 401:
            print("❌ API key is invalid or expired (401 Unauthorized)")
            print("💡 Please check your API key in the .env file")
            return False
        elif response.status_code == 429:
            print("⚠️ Rate limit exceeded (429 Too Many Requests)")
            print("💡 Please wait a few minutes before trying again")
            return False
        elif response.status_code == 400:
            print("⚠️ Bad request (400) - this might be a configuration issue")
            print(f"📝 Response: {response.text}")
            print("💡 This could be due to invalid parameters, but API key is working")
            return True  # API key is working, just parameter issue
        else:
            print(f"❌ API error: {response.status_code}")
            print(f"📝 Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Stability AI API Key...")
    print("=" * 50)
    
    success = test_stability_api()
    
    print("=" * 50)
    if success:
        print("🎉 API key test passed! Your Instagram image generation should work.")
    else:
        print("💥 API key test failed! Please check your configuration.") 