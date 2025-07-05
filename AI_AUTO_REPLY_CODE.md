# AI Auto-Reply System: Full Code Reference

This file contains the full code for the AI Auto-Reply feature for Facebook. Use this as a reference to adapt the logic for Instagram.

---

## 1. Backend API Endpoint (social_media.py)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.automation_rule import AutomationRule, RuleType, TriggerType
from app.models.social_account import SocialAccount
from app.models.post import Post, PostStatus
from app.schemas.social_media import AutoReplyToggleRequest
from app.api.dependencies import get_current_user, get_db
from app.services.facebook_service import facebook_service
from app.schemas.common import SuccessResponse
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/facebook/auto-reply")
async def toggle_auto_reply(
    request: AutoReplyToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle auto-reply for Facebook page with AI integration and post selection."""
    try:
        # Find the Facebook account/page
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.platform_user_id == request.page_id
        ).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facebook page not found")

        # Validate selected posts if any
        selected_posts = []
        if request.selected_post_ids:
            posts = db.query(Post).filter(
                Post.id.in_(request.selected_post_ids),
                Post.social_account_id == account.id
            ).all()
            selected_posts = [post.platform_post_id for post in posts if post.platform_post_id]
            logger.info(f"Selected posts: {request.selected_post_ids}")
            logger.info(f"Facebook post IDs: {selected_posts}")
        else:
            logger.info("No selected post IDs in request")

        # Use Facebook service to setup auto-reply
        facebook_result = await facebook_service.setup_auto_reply(
            page_id=request.page_id,
            access_token=account.access_token,
            enabled=request.enabled,
            template=request.response_template
        )

        # Find or create auto-reply rule in database
        auto_reply_rule = db.query(AutomationRule).filter(
            AutomationRule.user_id == current_user.id,
            AutomationRule.social_account_id == account.id,
            AutomationRule.rule_type == RuleType.AUTO_REPLY
        ).first()

        rule_actions = {
            "response_template": request.response_template,
            "ai_enabled": True,
            "facebook_setup": facebook_result,
            "selected_post_ids": request.selected_post_ids,
            "selected_facebook_post_ids": selected_posts
        }

        if auto_reply_rule:
            auto_reply_rule.is_active = request.enabled
            auto_reply_rule.actions = rule_actions
            logger.info(f"🔄 Updated existing rule {auto_reply_rule.id} with actions: {rule_actions}")
        else:
            auto_reply_rule = AutomationRule(
                user_id=current_user.id,
                social_account_id=account.id,
                name=f"Auto Reply - {account.display_name}",
                rule_type=RuleType.AUTO_REPLY,
                trigger_type=TriggerType.ENGAGEMENT_BASED,
                trigger_conditions={
                    "event": "comment",
                    "selected_posts": selected_posts
                },
                actions=rule_actions,
                is_active=request.enabled
            )
            db.add(auto_reply_rule)
            logger.info(f"🆕 Created new rule with actions: {rule_actions}")

        db.commit()
        logger.info(f"💾 Committed rule to database. Rule ID: {auto_reply_rule.id}")
        logger.info(f"💾 Final rule actions: {auto_reply_rule.actions}")

        return SuccessResponse(
            message=f"Auto-reply {'enabled' if request.enabled else 'disabled'} successfully with AI integration",
            data={
                "rule_id": auto_reply_rule.id,
                "enabled": request.enabled,
                "ai_enabled": True,
                "page_name": account.display_name,
                "facebook_setup": facebook_result,
                "selected_posts_count": len(selected_posts),
                "selected_post_ids": request.selected_post_ids
            }
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to toggle auto-reply: {str(e)}")
```

---

## 2. AutoReplyService (auto_reply_service.py)

```python
import logging
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.automation_rule import AutomationRule, RuleType
from app.models.social_account import SocialAccount
from app.models.post import Post
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)

class AutoReplyService:
    def __init__(self):
        self.graph_api_base = "https://graph.facebook.com/v18.0"

    async def process_auto_replies(self, db: Session):
        auto_reply_rules = db.query(AutomationRule).filter(
            AutomationRule.rule_type == RuleType.AUTO_REPLY,
            AutomationRule.is_active == True
        ).all()
        logger.info(f"🔄 Processing auto-replies for {len(auto_reply_rules)} active rules")
        for rule in auto_reply_rules:
            await self._process_rule_auto_replies(rule, db)

    async def _process_rule_auto_replies(self, rule: AutomationRule, db: Session):
        social_account = db.query(SocialAccount).filter(
            SocialAccount.id == rule.social_account_id
        ).first()
        if not social_account or not social_account.is_connected:
            logger.warning(f"⚠️ Social account {rule.social_account_id} not found or not connected")
            return
        selected_post_ids = rule.actions.get("selected_facebook_post_ids", [])
        logger.info(f"🔍 Rule actions: {rule.actions}")
        logger.info(f"🔍 Selected Facebook post IDs: {selected_post_ids}")
        if not selected_post_ids:
            logger.info(f"📭 No selected posts for rule {rule.id}")
            return
        last_check = rule.last_execution_at or (datetime.utcnow() - timedelta(minutes=10))
        for post_id in selected_post_ids:
            await self._process_post_comments(
                post_id=post_id,
                page_id=social_account.platform_user_id,
                access_token=social_account.access_token,
                rule=rule,
                last_check=last_check,
                db=db
            )
        rule.last_execution_at = datetime.utcnow()
        db.commit()

    async def _process_post_comments(self, post_id: str, page_id: str, access_token: str, rule: AutomationRule, last_check: datetime, db: Session):
        since_param = int(last_check.timestamp())
        async with httpx.AsyncClient() as client:
            comments_resp = await client.get(
                f"{self.graph_api_base}/{post_id}/comments",
                params={
                    "access_token": access_token,
                    "since": since_param,
                    "fields": "id,message,from,created_time,parent"
                }
            )
            if comments_resp.status_code != 200:
                logger.error(f"Failed to get comments for post {post_id}: {comments_resp.text}")
                return
            comments_data = comments_resp.json()
            comments = comments_data.get("data", [])
            conversation_threads = self._group_comments_by_thread(comments)
            for thread_id, thread_comments in conversation_threads.items():
                latest_comment = thread_comments[-1]
                if latest_comment["from"]["id"] == page_id:
                    continue
                should_reply = await self._should_reply_to_comment(
                    latest_comment, thread_comments, access_token, page_id
                )
                if should_reply:
                    await self._generate_and_post_reply(
                        comment=latest_comment,
                        access_token=access_token,
                        rule=rule,
                        page_id=page_id
                    )

    def _group_comments_by_thread(self, comments: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        threads = {}
        for comment in comments:
            if comment.get("parent"):
                parent_id = comment["parent"]["id"]
                if parent_id not in threads:
                    threads[parent_id] = []
                threads[parent_id].append(comment)
            else:
                thread_id = comment["id"]
                if thread_id not in threads:
                    threads[thread_id] = []
                threads[thread_id].append(comment)
        return threads

    async def _should_reply_to_comment(self, latest_comment: Dict[str, Any], thread_comments: List[Dict[str, Any]], access_token: str, page_id: str) -> bool:
        comment_id = latest_comment["id"]
        if await self._has_replied_to_comment(comment_id, access_token):
            return False
        if not latest_comment.get("parent"):
            return True
        parent_id = latest_comment["parent"]["id"]
        async with httpx.AsyncClient() as client:
            parent_resp = await client.get(
                f"{self.graph_api_base}/{parent_id}",
                params={
                    "access_token": access_token,
                    "fields": "from,message"
                }
            )
            if parent_resp.status_code == 200:
                parent_data = parent_resp.json()
                parent_from_id = parent_data.get("from", {}).get("id")
                parent_message = parent_data.get("message", "")
                if parent_from_id == page_id and self._is_ai_response(parent_message):
                    return True
                else:
                    return False
            else:
                return False

    def _is_ai_response(self, message: str) -> bool:
        if not message:
            return False
        ai_indicators = [
            "thanks for your comment", "we appreciate your engagement",
            "thank you for", "we're glad", "thanks for sharing",
            "we love hearing from you", "you're welcome"
        ]
        message_lower = message.lower()
        return any(indicator in message_lower for indicator in ai_indicators) or message.strip().startswith('@')

    async def _has_replied_to_comment(self, comment_id: str, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            replies_resp = await client.get(
                f"{self.graph_api_base}/{comment_id}/comments",
                params={
                    "access_token": access_token,
                    "fields": "from,message"
                }
            )
            if replies_resp.status_code == 200:
                replies_data = replies_resp.json()
                replies = replies_data.get("data", [])
                for reply in replies:
                    reply_message = reply.get("message", "")
                    if self._is_ai_response(reply_message):
                        return True
            return False

    async def _generate_and_post_reply(self, comment: Dict[str, Any], access_token: str, rule: AutomationRule, page_id: str):
        comment_text = comment.get("message", "")
        commenter_name = comment["from"].get("name", "there")
        comment_id = comment["id"]
        reply_text = await self._generate_ai_reply(
            comment_text=comment_text,
            commenter_name=commenter_name,
            template=rule.actions.get("response_template")
        )
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.graph_api_base}/{comment_id}/comments",
                data={
                    "access_token": access_token,
                    "message": reply_text
                }
            )

    async def _generate_ai_reply(self, comment_text: str, commenter_name: str, template: Optional[str] = None) -> str:
        context = f"Comment by {commenter_name}: {comment_text}"
        if template:
            ai_prompt = f"""
            Generate a friendly, engaging reply to this comment. 
            The reply should mention the commenter by name and be contextual to their comment.
            Template guide: {template}
            Comment: {comment_text}
            Commenter: {commenter_name}
            Generate a natural, conversational reply that mentions the commenter.
            Keep it under 200 characters and use appropriate emojis sparingly.
            """
        else:
            ai_prompt = f"""
            Generate a friendly, engaging reply to this Facebook comment.
            The reply should:
            1. Mention the commenter by name (e.g., "@{commenter_name}" or "Hey {commenter_name}")
            2. Be contextual and relevant to their comment
            3. Be warm, professional, and encouraging
            4. Keep it under 200 characters
            5. Use appropriate emojis sparingly
            6. Feel natural and conversational
            Comment: {comment_text}
            Commenter: {commenter_name}
            Generate a natural, conversational reply that feels like a real person responding.
            """
        ai_result = await groq_service.generate_auto_reply(comment_text, context)
        if ai_result["success"]:
            reply_content = ai_result["content"]
            if commenter_name.lower() not in reply_content.lower():
                reply_content = f"@{commenter_name} {reply_content}"
            return reply_content
        else:
            return f"@{commenter_name} Thanks for your comment! We appreciate your engagement. 😊"

# Singleton instance
auto_reply_service = AutoReplyService()
```

---

## 3. SchedulerService (scheduler_service.py)

```python
import asyncio
import logging
from app.database import get_db
from app.services.auto_reply_service import auto_reply_service

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.running = False
        self.check_interval = 30

    async def start(self):
        if self.running:
            return
        self.running = True
        while self.running:
            try:
                await self.process_auto_replies()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(self.check_interval)

    async def process_auto_replies(self):
        db = next(get_db())
        await auto_reply_service.process_auto_replies(db)
        db.close()

scheduler_service = SchedulerService()
```

---

## 4. Frontend Handler (FacebookPage.js)

```javascript
// ... inside your React component ...
const handleAutoReplyToggle = async () => {
  if (!selectedPage) return;
  if (!autoReplySettings.enabled && autoReplySettings.selectedPostIds.length === 0) {
    setConnectionStatus('Please select at least one post to enable auto-reply');
    return;
  }
  setAutoReplySettings(prev => ({ ...prev, isLoading: true }));
  setConnectionStatus(autoReplySettings.enabled ? 'Disabling auto-reply...' : 'Enabling auto-reply...');
  const response = await apiClient.toggleAutoReply(
    selectedPage.id,
    !autoReplySettings.enabled,
    autoReplySettings.template || '',
    autoReplySettings.selectedPostIds
  );
  if (response.success) {
    setAutoReplySettings(prev => ({
      ...prev,
      enabled: !prev.enabled,
      isLoading: false,
      ruleId: response.data?.rule_id || prev.ruleId
    }));
    setConnectionStatus(
      !autoReplySettings.enabled 
        ? `Auto-reply enabled successfully for ${response.data?.selected_posts_count || 0} post(s)! AI will automatically reply to comments mentioning the commenter.` 
        : 'Auto-reply disabled successfully.'
    );
  } else {
    setConnectionStatus('Failed to update auto-reply: ' + (response.error || 'Unknown error'));
    setAutoReplySettings(prev => ({ ...prev, isLoading: false }));
  }
};
```

---

## 5. Models & Schemas (automation_rule.py, post.py, social_media.py)

```python
# backend/app/models/automation_rule.py
from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class RuleType(str, enum.Enum):
    AUTO_REPLY = "AUTO_REPLY"
    # ... other types ...

class TriggerType(str, enum.Enum):
    ENGAGEMENT_BASED = "ENGAGEMENT_BASED"
    # ... other types ...

class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    social_account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=False)
    name = Column(String, nullable=False)
    rule_type = Column(Enum(RuleType), nullable=False)
    trigger_type = Column(Enum(TriggerType), nullable=False)
    trigger_conditions = Column(JSON, nullable=True)
    actions = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    last_execution_at = Column(DateTime, nullable=True)
    # ... other fields ...

# backend/app/models/post.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, JSON, Boolean
from app.database import Base
import enum

class PostStatus(str, enum.Enum):
    PUBLISHED = "PUBLISHED"
    SCHEDULED = "SCHEDULED"
    FAILED = "FAILED"

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    social_account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=False)
    content = Column(String, nullable=False)
    platform_post_id = Column(String, nullable=True)
    status = Column(Enum(PostStatus), default=PostStatus.PUBLISHED)
    created_at = Column(DateTime)
    # ... other fields ...

# backend/app/schemas/social_media.py
from pydantic import BaseModel, Field
from typing import List, Optional

class AutoReplyToggleRequest(BaseModel):
    enabled: bool
    page_id: str
    response_template: Optional[str] = "Thank you for your comment! We'll get back to you soon."
    selected_post_ids: Optional[List[int]] = Field(default=[], description="List of post IDs to enable auto-reply for")
```

---

**Use this code as a reference to implement the same feature for Instagram!** 