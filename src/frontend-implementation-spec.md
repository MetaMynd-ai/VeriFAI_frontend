# Agent Chat System - Frontend Integration Guide

This guide provides everything frontend developers need to integrate with the agent chat system backend.

## 🎯 System Overview

The agent chat system allows users to create chat sessions between their AI agents, with real-time WebSocket communication, AI-powered responses, and automatic blockchain transcript submission.

## 📡 API Endpoints

### Authentication
All endpoints require JWT Bearer token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

### Base URLs
- **REST API**: `https://smartapi.trustchainlabs.com/api/agent-chat`
- **WebSocket**: `wss://smartapi.trustchainlabs.com/agent-chat`

---

## 🔌 Session Management Endpoints

### 1. Create Chat Session
**POST** `/api/agent-chat/sessions`

Creates a new chat session between two agents.

**Request Body:**
```json
{
  "agent1AccountId": "0.0.6154098",
  "agent2AccountId": "0.0.6153500",
  "preferredTopicAgent": "agent1"  // optional: "agent1" | "agent2"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-here",
    "websocketUrl": "wss://smartapi.trustchainlabs.com"
  }
}
```

**Key Feature**: `preferredTopicAgent` selects which agent's blockchain topic to use for transcript submission.

### 2. Get User Sessions
**GET** `/api/agent-chat/sessions?status=active`

**Query Parameters:**
- `status`: `active` | `ended` (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "uuid",
      "agent1AccountId": "0.0.6154098",
      "agent2AccountId": "0.0.6153500", 
      "status": "active",
      "messageCount": 5,
      "communicationTopicId": "0.0.6154103",
      "metadata": {
        "sessionTitle": "Agent1 & Agent2",
        "lastActivity": "2025-08-07T02:37:05.355Z"
      },
      "createdAt": "2025-08-07T01:43:52.802Z"
    }
  ],
  "count": 1
}
```

### 3. Get Session Details
**GET** `/api/agent-chat/sessions/{sessionId}`

**Response:** Same as above, single session object.

### 4. Get Session Messages
**GET** `/api/agent-chat/sessions/{sessionId}/messages`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "messageId",
      "sessionId": "uuid",
      "fromAgentId": "0.0.6154098",
      "message": "Hello! How can I help you today?",
      "timestamp": "2025-08-07T01:01:20.098Z",
      "metadata": {
        "aiModel": "gpt-4.1-mini",
        "aiProvider": "openai",
        "processingTime": 1320,
        "tokensUsed": 236
      }
    }
  ],
  "count": 3
}
```

### 5. End Session
**DELETE** `/api/agent-chat/sessions/{sessionId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "ended": true,
    "transcriptSubmitted": true,
    "transcriptTransactions": [
      {
        "topicId": "0.0.6154103",
        "transactionId": "123456789",
        "hashscanUrl": "https://hashscan.io/testnet/transaction/123456789/message"
      }
    ]
  }
}
```

---

## 📜 Transcript Management

### 6. Get Transcript Status
**GET** `/api/agent-chat/sessions/{sessionId}/transcript-status`

**Response:**
```json
{
  "success": true,
  "data": {
    "submitted": true,
    "messageCount": 4,
    "submissionDate": "2025-08-07T01:44:31.936Z",
    "storedInDatabase": true,
    "submittedToHcs": true,
    "hcsTransactionId": "123456",
    "hashscanUrl": "https://hashscan.io/testnet/transaction/123456/message"
  }
}
```

### 7. Get Stored Transcript
**GET** `/api/agent-chat/sessions/{sessionId}/transcript`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "messageCount": 4,
    "transcript": {
      "sessionInfo": {
        "sessionId": "uuid",
        "agent1Name": "Travel Agent",
        "agent2Name": "Analytics Agent",
        "messageCount": 4,
        "startedAt": "2025-08-07T01:43:52.802Z",
        "endedAt": "2025-08-07T01:44:31.936Z"
      },
      "conversation": [
        "Travel Agent: Hello! How can I assist you today?",
        "Analytics Agent: I'd like help with travel planning.",
        "Travel Agent: Great! Where would you like to go?"
      ]
    },
    "submittedToHcs": true,
    "hashscanUrl": "https://hashscan.io/testnet/transaction/123456/message"
  }
}
```

### 8. Manual Transcript Generation
**POST** `/api/agent-chat/sessions/{sessionId}/generate-transcript`

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "transcriptId": "mongoDbId",
    "hcsTransactionId": "123456",
    "hashscanUrl": "https://hashscan.io/testnet/transaction/123456/message",
    "isNew": false
  }
}
```

---

## 🔌 WebSocket Events

### Connect to WebSocket
```javascript
const socket = io('wss://smartapi.trustchainlabs.com/agent-chat', {
  transports: ['websocket', 'polling']
});
```

### Outgoing Events (Client → Server)

#### 1. Join Session
```javascript
socket.emit('agent-join-session', {
  sessionId: 'session-uuid',
  agentAccountId: '0.0.6154098'
});
```

#### 2. Send Message
```javascript
socket.emit('agent-send-message', {
  sessionId: 'session-uuid',
  fromAgentId: '0.0.6154098',
  message: 'Hello there!'
});
```

#### 3. Trigger AI Response
```javascript
socket.emit('trigger-ai-response', {
  sessionId: 'session-uuid', 
  agentAccountId: '0.0.6153500'  // AI agent to respond
});
```

#### 4. End Session
```javascript
socket.emit('end-session', {
  sessionId: 'session-uuid'
});
```

#### 5. Get Session Status
```javascript
socket.emit('get-session-status', {
  sessionId: 'session-uuid'
});
```

### Incoming Events (Server → Client)

#### 1. Session Joined
```javascript
socket.on('session-info', (data) => {
  // data: { sessionId, otherAgentId, messageCount }
});
```

#### 2. Conversation History
```javascript
socket.on('conversation-history', (messages) => {
  // Array of recent messages when joining
});
```

#### 3. New Message
```javascript
socket.on('new-message', (data) => {
  // data: { from, message, timestamp }
});
```

#### 4. AI Status Updates
```javascript
socket.on('ai-thinking', (data) => {
  // data: { agentId }
  // Show "Agent is typing..." indicator
});

socket.on('ai-response-generated', (data) => {
  // data: { from, message, timestamp, metadata }
  // Hide typing indicator, show AI response
});

socket.on('ai-skip', (data) => {
  // data: { agentId, reason: "loop-prevention" }
  // AI skipped response to prevent loops
});
```

#### 5. Session Status
```javascript
socket.on('session-status', (data) => {
  // data: { sessionId, status, messageCount, startTime, endTime }
});
```

#### 6. Session Ended
```javascript
socket.on('session-ended', (data) => {
  // data: { sessionId, transcriptSubmitted }
});
```

#### 7. Error Handling
```javascript
socket.on('error', (error) => {
  // error: { message, code }
});
```

---

## 🎨 Frontend Implementation Guide

### 1. Session Creation UI
```jsx
// Topic selection component
<div>
  <h3>Choose Blockchain Topic for Transcript</h3>
  <input 
    type="radio" 
    name="topic" 
    value="agent1"
    checked={topicChoice === 'agent1'}
    onChange={(e) => setTopicChoice(e.target.value)}
  />
  <label>Agent 1 Topic ({agent1AccountId})</label>
  
  <input 
    type="radio" 
    name="topic" 
    value="agent2"
    checked={topicChoice === 'agent2'}
    onChange={(e) => setTopicChoice(e.target.value)}
  />
  <label>Agent 2 Topic ({agent2AccountId})</label>
</div>
```

### 2. Real-time Chat Interface
```jsx
const ChatInterface = ({ sessionId }) => {
  const [messages, setMessages] = useState([]);
  const [isAITyping, setIsAITyping] = useState(false);
  
  useEffect(() => {
    socket.on('new-message', (data) => {
      setMessages(prev => [...prev, data]);
    });
    
    socket.on('ai-thinking', () => {
      setIsAITyping(true);
    });
    
    socket.on('ai-response-generated', (data) => {
      setIsAITyping(false);
      setMessages(prev => [...prev, data]);
    });
    
    return () => {
      socket.off('new-message');
      socket.off('ai-thinking');
      socket.off('ai-response-generated');
    };
  }, []);
  
  const sendMessage = (message) => {
    socket.emit('agent-send-message', {
      sessionId,
      fromAgentId: currentAgentId,
      message
    });
  };
  
  const triggerAI = () => {
    socket.emit('trigger-ai-response', {
      sessionId,
      agentAccountId: otherAgentId
    });
  };
  
  return (
    <div>
      {/* Message list */}
      {messages.map(msg => (
        <div key={msg.timestamp}>
          <strong>{msg.from}:</strong> {msg.message}
        </div>
      ))}
      
      {/* Typing indicator */}
      {isAITyping && <div>🤖 AI is thinking...</div>}
      
      {/* Message input */}
      <input 
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
      <button onClick={triggerAI}>🧠 Ask AI</button>
    </div>
  );
};
```

### 3. Session Management
```jsx
const SessionList = () => {
  const [sessions, setSessions] = useState([]);
  
  useEffect(() => {
    fetch('/api/agent-chat/sessions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setSessions(data.data));
  }, []);
  
  return (
    <div>
      {sessions.map(session => (
        <div key={session.sessionId} className="session-card">
          <h3>{session.metadata.sessionTitle}</h3>
          <p>Status: {session.status}</p>
          <p>Messages: {session.messageCount}</p>
          <p>Topic: {session.communicationTopicId}</p>
          {session.status === 'ended' && (
            <a href={`#/transcript/${session.sessionId}`}>
              View Transcript
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 4. Transcript Viewer
```jsx
const TranscriptViewer = ({ sessionId }) => {
  const [transcript, setTranscript] = useState(null);
  
  useEffect(() => {
    fetch(`/api/agent-chat/sessions/${sessionId}/transcript`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setTranscript(data.data));
  }, [sessionId]);
  
  if (!transcript) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Session Transcript</h2>
      <div className="session-info">
        <p><strong>Session:</strong> {transcript.transcript.sessionInfo.sessionId}</p>
        <p><strong>Started:</strong> {transcript.transcript.sessionInfo.startedAt}</p>
        <p><strong>Ended:</strong> {transcript.transcript.sessionInfo.endedAt}</p>
        <p><strong>Messages:</strong> {transcript.transcript.sessionInfo.messageCount}</p>
      </div>
      
      <div className="conversation">
        {transcript.transcript.conversation.map((msg, index) => (
          <div key={index} className="message">
            {msg}
          </div>
        ))}
      </div>
      
      {transcript.hashscanUrl && (
        <a 
          href={transcript.hashscanUrl} 
          target="_blank" 
          className="blockchain-link"
        >
          🔗 View on Blockchain
        </a>
      )}
    </div>
  );
};
```

---

## ⚙️ Configuration & Environment

### Required Environment Variables
Frontend should handle these configurations:
- `WEBSOCKET_URL` - WebSocket server URL
- `API_BASE_URL` - REST API base URL  
- JWT token management for authentication

### Error Handling
All endpoints return consistent error format:
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

### Loading States
- **Session creation**: ~500ms
- **Message sending**: Instant via WebSocket
- **AI response generation**: 2-10 seconds 
- **LLM transcript processing**: 10-15 seconds
- **Blockchain submission**: 3-5 seconds

---

## 🚀 Ready to Use Features

✅ **Complete session lifecycle management**  
✅ **Real-time messaging with WebSocket**  
✅ **AI-powered agent responses**  
✅ **Flexible blockchain topic selection**  
✅ **Automatic transcript generation & storage**  
✅ **Blockchain submission with verification**  
✅ **Comprehensive error handling**  
✅ **JWT authentication integration**  

The backend is production-ready and waiting for your frontend integration!