// Agent Chat Interfaces based on the frontend implementation specification

export interface ChatSession {
    sessionId: string;
    agent1AccountId: string;
    agent2AccountId: string;
    status: 'active' | 'ended';
    messageCount: number;
    communicationTopicId: string;
    metadata: {
        sessionTitle: string;
        lastActivity: string;
    };
    createdAt: string;
}

export interface ChatMessage {
    _id: string;
    sessionId: string;
    fromAgentId: string;
    message: string;
    timestamp: string;
    metadata?: {
        aiModel?: string;
        aiProvider?: string;
        processingTime?: number;
        tokensUsed?: number;
    };
}

export interface CreateSessionRequest {
    agent1AccountId: string;
    agent2AccountId: string;
    preferredTopicAgent?: 'agent1' | 'agent2';
}

export interface CreateSessionResponse {
    success: boolean;
    data: {
        sessionId: string;
        websocketUrl: string;
    };
}

export interface SessionListResponse {
    success: boolean;
    data: ChatSession[];
    count: number;
}

export interface MessageListResponse {
    success: boolean;
    data: ChatMessage[];
    count: number;
}

// WebSocket Event Interfaces
export interface WebSocketJoinSessionEvent {
    sessionId: string;
    agentAccountId: string;
}

export interface WebSocketSendMessageEvent {
    sessionId: string;
    fromAgentId: string;
    message: string;
}

export interface WebSocketTriggerAIEvent {
    sessionId: string;
    agentAccountId: string;
}

export interface WebSocketEndSessionEvent {
    sessionId: string;
}

export interface WebSocketGetSessionStatusEvent {
    sessionId: string;
}

// WebSocket Response Interfaces
export interface WebSocketSessionInfoResponse {
    sessionId: string;
    otherAgentId: string;
    messageCount: number;
}

export interface WebSocketNewMessageResponse {
    from: string;
    message: string;
    timestamp: string;
    metadata?: any;
}

export interface WebSocketAIThinkingResponse {
    agentId: string;
}

export interface WebSocketAIResponseGeneratedResponse {
    from: string;
    message: string;
    timestamp: string;
    metadata?: any;
}

export interface WebSocketAISkipResponse {
    agentId: string;
    reason: string;
}

export interface WebSocketSessionStatusResponse {
    sessionId: string;
    status: string;
    messageCount: number;
    startTime: string;
    endTime?: string;
}

export interface WebSocketSessionEndedResponse {
    sessionId: string;
    transcriptSubmitted: boolean;
}

export interface WebSocketErrorResponse {
    message: string;
    code?: string;
}

// Transcript Interfaces
export interface TranscriptStatus {
    submitted: boolean;
    messageCount: number;
    submissionDate?: string;
    storedInDatabase: boolean;
    submittedToHcs: boolean;
    hcsTransactionId?: string;
    hashscanUrl?: string;
}

export interface TranscriptData {
    sessionId: string;
    messageCount: number;
    transcript: {
        sessionInfo: {
            sessionId: string;
            agent1Name: string;
            agent2Name: string;
            messageCount: number;
            startedAt: string;
            endedAt: string;
        };
        conversation: string[];
    };
    submittedToHcs: boolean;
    hashscanUrl?: string;
}

// UI State Interfaces
export interface ChatRoomUIState {
    isConnected: boolean;
    isAITyping: boolean;
    typingAgentId?: string;
    connectionError?: string;
    lastActivity?: string;
}

export interface RoomCreationUIState {
    selectedAgents: string[];
    preferredTopicAgent?: 'agent1' | 'agent2';
    isCreating: boolean;
    error?: string;
}

// Combined interfaces for UI components
export interface ChatRoomData {
    session: ChatSession;
    messages: ChatMessage[];
    uiState: ChatRoomUIState;
}

export interface AgentSelectionItem {
    accountId: string;
    agentName: string;
    isOnline: boolean;
    communicationTopicId?: string;
}
