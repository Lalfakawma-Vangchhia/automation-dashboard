import requests
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from app.config import get_settings
from app.services.groq_service import groq_service
from app.services.stability_service import stability_service

logger = logging.getLogger(__name__)
settings = get_settings()


class InstagramService:
    """Service for Instagram API operations and integrations."""
    
    def __init__(self):
        self.graph_url = "https://graph.facebook.com/v18.0"
        self.app_id = settings.facebook_app_id  # Instagram uses Facebook App ID
        self.app_secret = settings.facebook_app_secret
    
    def exchange_for_long_lived_token(self, short_lived_token: str, app_id: str, app_secret: str) -> Tuple[str, datetime]:
        """Exchange short-lived token for long-lived token (60 days)"""
        try:
            url = f"{self.graph_url}/oauth/access_token"
            params = {
                'grant_type': 'fb_exchange_token',
                'client_id': app_id,
                'client_secret': app_secret,
                'fb_exchange_token': short_lived_token
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            long_lived_token = data['access_token']
            expires_in = data.get('expires_in', 5184000)  # Default 60 days
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            logger.info("Successfully exchanged for long-lived token")
            return long_lived_token, expires_at
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Token exchange failed: {e}")
            raise Exception(f"Failed to exchange token: {str(e)}")
    
    def verify_token_permissions(self, access_token: str) -> Dict:
        """Verify token has required permissions"""
        try:
            url = f"{self.graph_url}/me/permissions"
            params = {'access_token': access_token}
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            permissions_data = response.json()
            granted_permissions = [
                perm['permission'] for perm in permissions_data.get('data', [])
                if perm.get('status') == 'granted'
            ]
            
            required_permissions = [
                'pages_show_list',
                'instagram_basic', 
                'pages_read_engagement',
                'business_management'
            ]
            
            missing_permissions = [
                perm for perm in required_permissions 
                if perm not in granted_permissions
            ]
            
            return {
                'granted': granted_permissions,
                'missing': missing_permissions,
                'has_all_required': len(missing_permissions) == 0
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Permission verification failed: {e}")
            raise Exception(f"Failed to verify permissions: {str(e)}")
    
    def get_facebook_pages_with_instagram(self, access_token: str) -> List[Dict]:
        """Get Facebook Pages with Instagram Business accounts"""
        try:
            # First verify permissions
            perm_check = self.verify_token_permissions(access_token)
            if not perm_check['has_all_required']:
                missing = ', '.join(perm_check['missing'])
                raise Exception(f"Missing required permissions: {missing}. Please re-authorize the app.")
            
            # Get user's Facebook Pages
            url = f"{self.graph_url}/me/accounts"
            params = {
                'access_token': access_token,
                'fields': 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            pages_data = response.json()
            pages = pages_data.get('data', [])
            
            if not pages:
                raise Exception("No Facebook Pages found. You need Admin access to at least one Facebook Page.")
            
            instagram_accounts = []
            pages_without_instagram = []
            
            for page in pages:
                page_name = page.get('name', 'Unknown Page')
                instagram_account = page.get('instagram_business_account')
                
                if instagram_account:
                    # Get additional Instagram account details using page access token
                    page_token = page.get('access_token')
                    if page_token:
                        enhanced_account = self._get_enhanced_instagram_details(
                            instagram_account['id'], 
                            page_token
                        )
                        
                        instagram_accounts.append({
                            'platform_id': instagram_account['id'],
                            'username': instagram_account.get('username', ''),
                            'display_name': instagram_account.get('name', ''),
                            'page_name': page_name,
                            'page_id': page['id'],
                            'followers_count': enhanced_account.get('followers_count', 0),
                            'media_count': enhanced_account.get('media_count', 0),
                            'profile_picture': enhanced_account.get('profile_picture_url', ''),
                            'page_access_token': page_token
                        })
                else:
                    pages_without_instagram.append(page_name)
            
            if not instagram_accounts:
                troubleshooting_msg = self._generate_troubleshooting_message(pages_without_instagram)
                raise Exception(troubleshooting_msg)
            
            logger.info(f"Found {len(instagram_accounts)} Instagram Business accounts")
            return instagram_accounts
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch Instagram accounts: {e}")
            if hasattr(e, 'response') and e.response:
                error_data = e.response.json() if e.response.content else {}
                error_msg = error_data.get('error', {}).get('message', str(e))
                raise Exception(f"Graph API Error: {error_msg}")
            raise Exception(f"Network error: {str(e)}")
    
    def _get_enhanced_instagram_details(self, instagram_user_id: str, page_access_token: str) -> Dict:
        """Get additional Instagram account details"""
        try:
            url = f"{self.graph_url}/{instagram_user_id}"
            params = {
                'access_token': page_access_token,
                'fields': 'followers_count,media_count,profile_picture_url,biography'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to get enhanced Instagram details: {e}")
            return {}
    
    def _generate_troubleshooting_message(self, pages_without_instagram: List[str]) -> str:
        """Generate helpful troubleshooting message"""
        base_msg = "No Instagram Business accounts found."
        
        if pages_without_instagram:
            pages_list = ", ".join(pages_without_instagram)
            base_msg += f" Found Facebook Pages ({pages_list}) but no Instagram accounts connected."
        
        troubleshooting_steps = [
            "1. Convert your Instagram to Business/Creator account",
            "2. Go to Facebook Page Settings → Instagram → Connect Account", 
            "3. Ensure you have Admin/Editor role on the Facebook Page",
            "4. Verify Facebook Page is published (not draft)",
            "5. Wait 5-10 minutes after connecting for systems to sync",
            "6. Re-authorize this app if the connection is old"
        ]
        
        return f"{base_msg}\n\nTroubleshooting steps:\n" + "\n".join(troubleshooting_steps)
    
    async def create_post(self, instagram_user_id: str, page_access_token: str, 
                   caption: str, image_url: Optional[str] = None, video_url: Optional[str] = None) -> Dict:
        """Create Instagram post with image or video"""
        try:
            # Debug logging
            logger.info(f"Instagram create_post called with: user_id={instagram_user_id}, "
                       f"caption={caption}, image_url={image_url}, video_url={video_url}")
            
            # Validate required parameters
            if not instagram_user_id:
                return {"success": False, "error": "Instagram user ID is required"}
            if not page_access_token:
                return {"success": False, "error": "Page access token is required"}
            if not caption:
                return {"success": False, "error": "Caption is required"}
            if not image_url and not video_url:
                return {"success": False, "error": "Either image_url or video_url is required"}
            
            # Validate caption length (Instagram limit is 2200 characters)
            if len(caption) > 2200:
                return {"success": False, "error": f"Caption too long ({len(caption)} chars). Instagram limit is 2200 characters."}
            
            # Step 1: Create media object
            media_url = f"{self.graph_url}/{instagram_user_id}/media"
            media_params = {
                'access_token': page_access_token,
                'caption': caption
            }
            
            if image_url:
                # Validate image URL
                if not image_url.startswith(('http://', 'https://')):
                    return {"success": False, "error": "Image URL must be a valid HTTP/HTTPS URL"}
                media_params['image_url'] = image_url
                logger.info(f"Creating Instagram image post with URL: {image_url}")
            elif video_url:
                if video_url.startswith('data:video/'):
                    # Handle base64 video data
                    # For now, we'll need to upload to a hosting service first
                    # This is a placeholder - you might want to use Cloudinary for video uploads
                    logger.warning("Base64 video upload not yet implemented. Please use a video URL.")
                    return {"success": False, "error": "Base64 video upload not yet implemented. Please use a video URL."}
                else:
                    # Validate video URL
                    if not video_url.startswith(('http://', 'https://')):
                        return {"success": False, "error": "Video URL must be a valid HTTP/HTTPS URL"}
                    media_params['video_url'] = video_url
                    logger.info(f"Creating Instagram video post with URL: {video_url}")
            
            logger.info(f"Instagram media creation params: {media_params}")
            
            media_response = requests.post(media_url, data=media_params)
            
            # Log the response for debugging
            logger.info(f"Instagram API response status: {media_response.status_code}")
            logger.info(f"Instagram API response text: {media_response.text}")
            
            if not media_response.ok:
                error_data = media_response.json() if media_response.content else {}
                error_msg = error_data.get('error', {}).get('message', f"HTTP {media_response.status_code}")
                logger.error(f"Instagram media creation failed: {error_msg}")
                return {"success": False, "error": f"Instagram API error: {error_msg}"}
            
            media_data = media_response.json()
            creation_id = media_data.get('id')
            
            if not creation_id:
                return {"success": False, "error": "No creation ID returned from Instagram API"}
            
            # Step 2: Publish the media
            publish_url = f"{self.graph_url}/{instagram_user_id}/media_publish"
            publish_params = {
                'access_token': page_access_token,
                'creation_id': creation_id
            }
            
            logger.info(f"Publishing Instagram media with creation ID: {creation_id}")
            publish_response = requests.post(publish_url, data=publish_params)
            
            if not publish_response.ok:
                error_data = publish_response.json() if publish_response.content else {}
                error_msg = error_data.get('error', {}).get('message', f"HTTP {publish_response.status_code}")
                logger.error(f"Instagram media publishing failed: {error_msg}")
                return {"success": False, "error": f"Instagram publishing error: {error_msg}"}
            
            publish_data = publish_response.json()
            
            logger.info(f"Successfully created Instagram post: {publish_data.get('id')}")
            return {
                'success': True,
                'post_id': publish_data.get('id'),
                'creation_id': creation_id
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error creating Instagram post: {e}")
            return {"success": False, "error": f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Unexpected error creating Instagram post: {e}")
            return {"success": False, "error": f"Unexpected error: {str(e)}"}
    
    def get_user_media(self, instagram_user_id: str, page_access_token: str, limit: int = 25) -> List[Dict]:
        """Get user's Instagram media"""
        try:
            url = f"{self.graph_url}/{instagram_user_id}/media"
            params = {
                'access_token': page_access_token,
                'fields': 'id,media_type,media_url,thumbnail_url,caption,timestamp,permalink',
                'limit': limit
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            media_data = response.json()
            return media_data.get('data', [])
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get user media: {e}")
            return []
    
    async def create_ai_generated_post(
        self,
        instagram_user_id: str,
        access_token: str,
        prompt: str,
        image_url: str
    ) -> Dict[str, Any]:
        """
        Create an Instagram post with AI-generated caption.
        
        Args:
            instagram_user_id: Instagram Business account ID
            access_token: Access token
            prompt: User prompt for AI generation
            image_url: URL of the image to post
            
        Returns:
            Dict containing post creation result
        """
        try:
            # Generate caption using Groq AI
            ai_result = await groq_service.generate_instagram_post(prompt)
            
            if not ai_result["success"]:
                return {
                    "success": False,
                    "error": f"AI generation failed: {ai_result.get('error', 'Unknown error')}"
                }
            
            generated_caption = ai_result["content"]
            
            # Create the post with generated caption
            post_result = await self.create_post(
                instagram_user_id=instagram_user_id,
                access_token=access_token,
                image_url=image_url,
                caption=generated_caption
            )
            
            # Add AI metadata to response
            if post_result["success"]:
                post_result["ai_generated"] = True
                post_result["generated_caption"] = generated_caption
                post_result["original_prompt"] = prompt
            
            return post_result
            
        except Exception as e:
            logger.error(f"Error creating AI-generated Instagram post: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def generate_instagram_image_with_ai(
        self,
        prompt: str,
        post_type: str = "feed"
    ) -> Dict[str, Any]:
        """
        Generate an image optimized for Instagram using Stability AI.
        
        Args:
            prompt: Text description of the image
            post_type: Type of Instagram post (feed, story, square)
            
        Returns:
            Dict containing generation result
        """
        try:
            # Instagram-optimized dimensions (using Stability AI allowed dimensions)
            # Allowed SDXL dimensions: 1024x1024, 1152x896, 1216x832, 1344x768, 1536x640, 640x1536, 768x1344, 832x1216, 896x1152
            dimensions = {
                "feed": (1024, 1024),    # Square post (Instagram standard)
                "story": (832, 1216),     # Instagram Story (close to 1080x1920)
                "square": (1024, 1024),   # Square post (Instagram standard)
                "portrait": (896, 1152),  # Portrait post (close to 1080x1350)
                "landscape": (1152, 896)  # Landscape post (close to 1350x1080)
            }
            
            width, height = dimensions.get(post_type, dimensions["feed"])
            
            # Validate dimensions are allowed by Stability AI
            allowed_dimensions = [
                (1024, 1024), (1152, 896), (1216, 832), (1344, 768), (1536, 640),
                (640, 1536), (768, 1344), (832, 1216), (896, 1152)
            ]
            
            if (width, height) not in allowed_dimensions:
                logger.warning(f"Requested dimensions {width}x{height} not in allowed list, using 1024x1024")
                width, height = 1024, 1024
            
            # Enhance prompt for Instagram
            enhanced_prompt = f"High-quality, Instagram-worthy image: {prompt}, vibrant colors, good lighting, visually appealing, social media optimized"
            
            # Add negative prompt for better quality
            negative_prompt = "blurry, low quality, distorted, text overlay, watermark, ugly, bad anatomy, low resolution"
            
            # Generate image using Stability AI
            image_result = await stability_service.generate_image(
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                cfg_scale=8.0,  # Higher for better prompt adherence
                steps=40,       # More steps for better quality
                samples=1
            )
            
            if not image_result["success"]:
                return {
                    "success": False,
                    "error": f"Image generation failed: {image_result.get('error', 'Unknown error')}"
                }
            
            return {
                "success": True,
                "image_base64": image_result["image_base64"],
                "prompt": prompt,
                "enhanced_prompt": enhanced_prompt,
                "width": width,
                "height": height,
                "post_type": post_type
            }
            
        except Exception as e:
            logger.error(f"Error generating Instagram image with AI: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def generate_carousel_images_with_ai(
        self,
        prompt: str,
        count: int = 3,
        post_type: str = "feed"
    ) -> Dict[str, Any]:
        """
        Generate multiple images for Instagram carousel using Stability AI.
        
        Args:
            prompt: Text description of the images
            count: Number of images to generate (3-7)
            post_type: Type of Instagram post (feed, story, square)
            
        Returns:
            Dict containing generation result with multiple image URLs
        """
        try:
            # Validate count
            if count < 3 or count > 7:
                return {
                    "success": False,
                    "error": "Carousel must have between 3 and 7 images"
                }
            
            # Instagram-optimized dimensions
            dimensions = {
                "feed": (1024, 1024),    # Square post (Instagram standard)
                "story": (832, 1216),     # Instagram Story
                "square": (1024, 1024),   # Square post
                "portrait": (896, 1152),  # Portrait post
                "landscape": (1152, 896)  # Landscape post
            }
            
            width, height = dimensions.get(post_type, dimensions["feed"])
            
            # Validate dimensions are allowed by Stability AI
            allowed_dimensions = [
                (1024, 1024), (1152, 896), (1216, 832), (1344, 768), (1536, 640),
                (640, 1536), (768, 1344), (832, 1216), (896, 1152)
            ]
            
            if (width, height) not in allowed_dimensions:
                logger.warning(f"Requested dimensions {width}x{height} not in allowed list, using 1024x1024")
                width, height = 1024, 1024
            
            # Generate multiple images
            image_urls = []
            for i in range(count):
                # Create variation of prompt for each image
                variation_prompt = f"{prompt} - variation {i+1}, unique composition, different angle or perspective"
                enhanced_prompt = f"High-quality, Instagram-worthy image: {variation_prompt}, vibrant colors, good lighting, visually appealing, social media optimized"
                
                # Add negative prompt for better quality
                negative_prompt = "blurry, low quality, distorted, text overlay, watermark, ugly, bad anatomy, low resolution"
                
                # Generate image using Stability AI
                image_result = await stability_service.generate_image(
                    prompt=enhanced_prompt,
                    negative_prompt=negative_prompt,
                    width=width,
                    height=height,
                    cfg_scale=8.0,
                    steps=40,
                    samples=1
                )
                
                if not image_result["success"]:
                    return {
                        "success": False,
                        "error": f"Image {i+1} generation failed: {image_result.get('error', 'Unknown error')}"
                    }
                
                # Upload to Cloudinary
                from app.services.cloudinary_service import cloudinary_service
                upload_result = cloudinary_service.upload_image_with_instagram_transform(
                    f"data:image/png;base64,{image_result['image_base64']}"
                )
                
                if not upload_result["success"]:
                    return {
                        "success": False,
                        "error": f"Image {i+1} upload failed: {upload_result.get('error', 'Unknown error')}"
                    }
                
                image_urls.append(upload_result["url"])
            
            # Generate caption for carousel
            caption_result = await groq_service.generate_instagram_post(prompt)
            caption = caption_result.get("content", f"Check out this amazing carousel! {prompt}") if caption_result.get("success") else f"Check out this amazing carousel! {prompt}"
            
            return {
                "success": True,
                "image_urls": image_urls,
                "caption": caption,
                "count": count,
                "prompt": prompt,
                "width": width,
                "height": height,
                "post_type": post_type
            }
            
        except Exception as e:
            logger.error(f"Error generating carousel images with AI: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def create_carousel_post(
        self,
        instagram_user_id: str,
        page_access_token: str,
        caption: str,
        image_urls: List[str]
    ) -> Dict[str, Any]:
        """
        Create an Instagram carousel post with multiple images.
        
        Args:
            instagram_user_id: Instagram user ID
            page_access_token: Page access token
            caption: Post caption
            image_urls: List of image URLs (3-7 images)
            
        Returns:
            Dict containing post creation result
        """
        try:
            # Validate inputs
            if not instagram_user_id:
                return {"success": False, "error": "Instagram user ID is required"}
            if not page_access_token:
                return {"success": False, "error": "Page access token is required"}
            if not caption:
                return {"success": False, "error": "Caption is required"}
            if not image_urls or len(image_urls) < 3 or len(image_urls) > 7:
                return {"success": False, "error": "Carousel must have between 3 and 7 images"}
            
            # Validate caption length
            if len(caption) > 2200:
                return {"success": False, "error": f"Caption too long ({len(caption)} chars). Instagram limit is 2200 characters."}
            
            # Validate image URLs
            for i, url in enumerate(image_urls):
                if not url.startswith(('http://', 'https://')):
                    return {"success": False, "error": f"Image {i+1} URL must be a valid HTTP/HTTPS URL"}
            
            logger.info(f"Creating Instagram carousel with {len(image_urls)} images")
            
            # Use the working carousel implementation from the reference file
            # Step 1: Create media object
            media_url = f"{self.graph_url}/{instagram_user_id}/media"
            media_params = {
                'access_token': page_access_token,
                'caption': caption
            }
            
            # GRAPH API requires creating child containers first for carousel
            children_creation_ids = []
            for url in image_urls:
                child_resp = requests.post(
                    f"{self.graph_url}/{instagram_user_id}/media",
                    data={
                        'access_token': page_access_token,
                        'image_url': url,
                        'is_carousel_item': 'true'
                    }
                )
                child_resp.raise_for_status()
                children_creation_ids.append(child_resp.json()['id'])
            
            # Now create carousel container
            media_params['media_type'] = 'CAROUSEL'
            # children param is comma-separated list of IDs
            for idx, cid in enumerate(children_creation_ids):
                media_params[f'children[{idx}]'] = cid
            
            logger.debug("Instagram carousel media_params: %s", media_params)
            media_response = requests.post(media_url, data=media_params)
            media_response.raise_for_status()
            
            media_data = media_response.json()
            creation_id = media_data['id']
            
            # Step 2: Publish the carousel
            publish_url = f"{self.graph_url}/{instagram_user_id}/media_publish"
            publish_params = {
                'access_token': page_access_token,
                'creation_id': creation_id
            }
            
            publish_response = requests.post(publish_url, data=publish_params)
            publish_response.raise_for_status()
            
            publish_data = publish_response.json()
            
            logger.info(f"Successfully created Instagram carousel: {publish_data['id']}")
            return {
                'success': True,
                'post_id': publish_data['id'],
                'creation_id': creation_id,
                'image_count': len(image_urls)
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create Instagram carousel: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json() if e.response.content else {}
                except ValueError:
                    error_data = {}

                graph_error = error_data.get('error', {}) if isinstance(error_data, dict) else {}
                error_msg = graph_error.get('message') or graph_error.get('error_user_msg') or str(e)
                error_type = graph_error.get('type')
                error_code = graph_error.get('code')

                detailed_msg = f"{error_type} (code {error_code}): {error_msg}" if error_code else error_msg

                return {
                    'success': False,
                    'error': f"Carousel creation failed: {detailed_msg}"
                }
            # No response at all -> network error
            return {
                'success': False,
                'error': f"Network error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error creating Instagram carousel: {e}")
            logger.error(f"Error details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return {"success": False, "error": f"Unexpected error: {str(e)}"}
    
    def is_configured(self) -> bool:
        """Check if Instagram service is properly configured."""
        return bool(self.app_id and self.app_secret)


# Global service instance
instagram_service = InstagramService() 