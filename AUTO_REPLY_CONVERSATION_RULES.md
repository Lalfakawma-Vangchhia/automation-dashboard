# AI Auto-Reply Conversation Rules

## Overview
The AI auto-reply system now follows intelligent conversation patterns to provide natural, contextual responses while avoiding spam.

## Conversation Rules

### 1. **One Reply Per Comment**
- AI replies **once** to each new comment
- No multiple replies to the same comment
- Tracks which comments have been replied to

### 2. **Conversation Continuation**
- If someone replies to the AI's response → AI replies back
- If someone replies to someone else → AI doesn't reply
- AI only engages in direct conversations

### 3. **Natural Conversation Flow**
```
User: "Great post!" 
AI: "@User Thanks! We're glad you liked it 😊"

User: "Where can I buy this?"
AI: "@User You can find it on our website! Check the link in our bio 🔗"

User: "Thanks!"
AI: "@User You're welcome! Let us know if you need anything else 👍"
```

### 4. **Stop When They Stop**
- If the user stops replying → AI stops too
- No endless conversation loops
- Respects natural conversation boundaries

## Technical Implementation

### Conversation Threading
- Groups comments by conversation threads
- Tracks parent-child relationships
- Only processes the most recent comment in each thread

### AI Response Detection
- Identifies AI responses by content patterns
- Prevents AI from replying to itself
- Maintains conversation context

### Context Awareness
- AI considers conversation history
- Generates contextual responses
- Maintains conversation flow naturally

## Example Scenarios

### Scenario 1: New Comment
```
John: "This looks amazing!"
AI: "@John Thanks for your comment! We're excited about this too 😊"
Result: Conversation ends here
```

### Scenario 2: Continuing Conversation
```
John: "This looks amazing!"
AI: "@John Thanks for your comment! We're excited about this too 😊"
John: "Where can I buy it?"
AI: "@John You can find it on our website! Check the link in our bio 🔗"
John: "Perfect, thanks!"
AI: "@John You're welcome! Let us know if you need anything else 👍"
Result: Conversation ends here
```

### Scenario 3: Multiple Users
```
John: "This looks amazing!"
AI: "@John Thanks for your comment! We're excited about this too 😊"
Sarah: "I agree with John!"
AI: "@Sarah Thanks Sarah! We're glad you think so too 😊"
John: "Where can I buy it?"
AI: "@John You can find it on our website! Check the link in our bio 🔗"
Result: Each user gets their own conversation thread
```

## Benefits

1. **Natural Conversations**: AI responses feel human and contextual
2. **No Spam**: One reply per comment, no endless loops
3. **Engagement**: Encourages continued interaction
4. **Efficiency**: Only replies when appropriate
5. **Context Awareness**: Understands conversation flow

## Configuration

- **Template (Optional)**: Guide AI response style
- **Post Selection**: Choose which posts to monitor
- **Auto-Enable**: Works immediately after setup
- **Real-time**: Checks every 30 seconds for new comments 