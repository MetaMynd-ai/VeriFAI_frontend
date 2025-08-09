import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from 'environments/environment';
import {
    WebSocketJoinSessionEvent,
    WebSocketSendMessageEvent,
    WebSocketTriggerAIEvent,
    WebSocketEndSessionEvent,
    WebSocketGetSessionStatusEvent,
    WebSocketSessionInfoResponse,
    WebSocketNewMessageResponse,
    WebSocketAIThinkingResponse,
    WebSocketAIResponseGeneratedResponse,
    WebSocketAISkipResponse,
    WebSocketSessionStatusResponse,
    WebSocketSessionEndedResponse,
    WebSocketErrorResponse,
    ChatMessage
} from './agent-chat.interfaces';

@Injectable({
    providedIn: 'root'
})
export class WebSocketService {
    private socket: Socket | null = null;
    private readonly _isConnected = new BehaviorSubject<boolean>(false);
    private readonly _connectionError = new BehaviorSubject<string | null>(null);
    private activeConnections = 0;
    private inactivityTimer: any = null;
    private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    // Event subjects for different WebSocket events
    private readonly _sessionInfo = new Subject<WebSocketSessionInfoResponse>();
    private readonly _conversationHistory = new Subject<ChatMessage[]>();
    private readonly _newMessage = new Subject<WebSocketNewMessageResponse>();
    private readonly _aiThinking = new Subject<WebSocketAIThinkingResponse>();
    private readonly _aiResponseGenerated = new Subject<WebSocketAIResponseGeneratedResponse>();
    private readonly _aiSkip = new Subject<WebSocketAISkipResponse>();
    private readonly _sessionStatus = new Subject<WebSocketSessionStatusResponse>();
    private readonly _sessionEnded = new Subject<WebSocketSessionEndedResponse>();
    private readonly _error = new Subject<WebSocketErrorResponse>();

    // New enhanced subjects based on API documentation
    private readonly _conversationHistoryCached = new Subject<any>();
    private readonly _messageSentOnBehalf = new Subject<any>();
    private readonly _messageStream = new Subject<any>();
    private readonly _messageStreamComplete = new Subject<any>();
    private readonly _agentJoined = new Subject<any>();

    // Public observables
    public readonly isConnected$ = this._isConnected.asObservable();
    public readonly connectionError$ = this._connectionError.asObservable();
    public readonly sessionInfo$ = this._sessionInfo.asObservable();
    public readonly conversationHistory$ = this._conversationHistory.asObservable();
    public readonly newMessage$ = this._newMessage.asObservable();
    public readonly aiThinking$ = this._aiThinking.asObservable();
    public readonly aiResponseGenerated$ = this._aiResponseGenerated.asObservable();
    public readonly aiSkip$ = this._aiSkip.asObservable();
    public readonly sessionStatus$ = this._sessionStatus.asObservable();
    public readonly sessionEnded$ = this._sessionEnded.asObservable();
    public readonly error$ = this._error.asObservable();

    // New enhanced observables
    readonly conversationHistoryCached$ = this._conversationHistoryCached.asObservable();
    readonly messageSentOnBehalf$ = this._messageSentOnBehalf.asObservable();
    readonly messageStream$ = this._messageStream.asObservable();
    readonly messageStreamComplete$ = this._messageStreamComplete.asObservable();
    readonly agentJoined$ = this._agentJoined.asObservable();

    constructor() {}

    /**
     * Conditional logging - only log in development
     */
    private log(message: string, ...args: any[]): void {
        if (!environment.production) {
            console.log(message, ...args);
        }
    }

    private logError(message: string, ...args: any[]): void {
        console.error(message, ...args);
    }

    /**
     * Reset inactivity timer
     */
    private resetInactivityTimer(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        
        this.inactivityTimer = setTimeout(() => {
            this.log('[WebSocketService] Disconnecting due to inactivity');
            this.forceDisconnect();
        }, this.INACTIVITY_TIMEOUT);
    }

    /**
     * Connect to the WebSocket server
     */
    connect(): void {
        this.activeConnections++;
        
        if (this.socket?.connected) {
            this.log('[WebSocketService] Already connected');
            return;
        }

        try {
            // Use the WebSocket URL from the API specification
            const wsUrl = 'wss://smartapi.trustchainlabs.com/agent-chat';
            
            this.socket = io(wsUrl, {
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: false,
                reconnectionAttempts: 0,
                reconnectionDelay: 1000
            });

            this.setupEventListeners();
            this.resetInactivityTimer();
            
        } catch (error) {
            this.logError('[WebSocketService] Connection error:', error);
            this._connectionError.next('Failed to connect to WebSocket server');
        }
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect(): void {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        
        // Only disconnect if no active connections
        if (this.activeConnections === 0 && this.socket) {
            this.log('[WebSocketService] Disconnecting - no active connections');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
            this._isConnected.next(false);
            this._connectionError.next(null);
        }
    }

    /**
     * Force disconnect regardless of active connections
     */
    forceDisconnect(): void {
        this.activeConnections = 0;
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        if (this.socket) {
            this.log('[WebSocketService] Force disconnecting');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
            this._isConnected.next(false);
            this._connectionError.next(null);
        }
    }

    /**
     * Setup event listeners for WebSocket events
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            this.log('[WebSocketService] Connected to server');
            this._isConnected.next(true);
            this._connectionError.next(null);
        });

        this.socket.on('disconnect', (reason) => {
            this.log('[WebSocketService] Disconnected from server:', reason);
            this._isConnected.next(false);
        });

        this.socket.on('connect_error', (error) => {
            this.logError('[WebSocketService] Connection error:', error);
            this._connectionError.next('Connection failed: ' + error.message);
            this._isConnected.next(false);
        });

        // Chat events
        this.socket.on('session-info', (data: WebSocketSessionInfoResponse) => {
            this.log('[WebSocketService] Session info received:', data);
            this._sessionInfo.next(data);
        });

        // Removed conversation-history listener - user will click blockchain link instead

        this.socket.on('new-message', (data: any) => {
            // Transform to match our interface
            const transformedData: WebSocketNewMessageResponse = {
                from: data.from || data.fromAgentId || '',
                message: data.message || '',
                timestamp: data.timestamp || new Date().toISOString(),
                metadata: data.metadata
            };

            this._newMessage.next(transformedData);
        });

        this.socket.on('ai-thinking', (data: WebSocketAIThinkingResponse) => {
            console.log('[WebSocketService] AI thinking:', data);
            this._aiThinking.next(data);
        });

        this.socket.on('ai-response-generated', (data: any) => {
            // Transform to match our interface
            const transformedData: WebSocketAIResponseGeneratedResponse = {
                from: data.from || data.fromAgentId || '',
                message: data.message || '',
                timestamp: data.timestamp || new Date().toISOString(),
                metadata: data.metadata
            };

            this._aiResponseGenerated.next(transformedData);
        });

        this.socket.on('ai-skip', (data: WebSocketAISkipResponse) => {
            console.log('[WebSocketService] AI skip:', data);
            this._aiSkip.next(data);
        });

        this.socket.on('session-status', (data: WebSocketSessionStatusResponse) => {
            console.log('[WebSocketService] Session status:', data);
            this._sessionStatus.next(data);
        });

        this.socket.on('session-ended', (data: WebSocketSessionEndedResponse) => {
            console.log('[WebSocketService] Session ended:', data);
            this._sessionEnded.next(data);
        });

        // Enhanced events from API documentation
        // Removed conversation-history-cached listener - user will use blockchain link

        this.socket.on('message-sent-on-behalf', (data: any) => {
            console.log('[WebSocketService] Message sent on behalf confirmed:', data);
            this._messageSentOnBehalf.next(data);
        });

        this.socket.on('message-stream', (message: any) => {
            console.log('[WebSocketService] Streaming message received:', message);
            this._messageStream.next(message);
        });

        this.socket.on('message-stream-complete', (data: any) => {
            console.log('[WebSocketService] Message stream complete:', data);
            this._messageStreamComplete.next(data);
        });

        this.socket.on('agent-joined', (data: any) => {
            console.log('[WebSocketService] Agent joined session:', data);
            this._agentJoined.next(data);
        });

        this.socket.on('error', (error: WebSocketErrorResponse) => {
            console.error('[WebSocketService] Server error:', error);

            // Enhanced error handling based on API documentation
            switch (error.code) {
                case 'JOIN_ERROR':
                    console.error('[WebSocketService] Failed to join session:', error.message);
                    break;
                case 'MESSAGE_ERROR':
                    console.error('[WebSocketService] Message sending failed:', error.message);
                    break;
                case 'AI_TRIGGER_ERROR':
                    console.error('[WebSocketService] AI generation failed:', error.message);
                    break;
                case 'HISTORY_ERROR':
                    console.error('[WebSocketService] History loading failed:', error.message);
                    break;
                default:
                    console.error('[WebSocketService] Unknown error:', error.message);
            }

            this._error.next(error);
        });
    }

    // Outgoing event methods
    joinSession(event: WebSocketJoinSessionEvent): void {
        if (this.socket?.connected) {
            this.log('[WebSocketService] Joining session:', event.sessionId);
            this.socket.emit('agent-join-session', event);
            this.resetInactivityTimer();
            // conversation-history will be sent automatically ONCE (no more spam!)
        } else {
            this.logError('[WebSocketService] Cannot join session - not connected');
        }
    }

    /**
     * Send message on behalf of Agent1 (user input)
     * This is perfect for user typing on behalf of Agent1
     */
    sendUserMessageOnBehalf(sessionId: string, agentId: string, message: string, triggerAI: boolean = true): void {
        if (this.socket?.connected) {
            this.log('[WebSocketService] Sending user message on behalf of agent:', agentId);
            this.socket.emit('user-send-message-on-behalf', {
                sessionId,
                agentId,
                message,
                triggerAI
            });
            this.resetInactivityTimer();
        } else {
            this.logError('[WebSocketService] Cannot send message: not connected');
        }
    }

    /**
     * Get conversation history - DISABLED
     * User should click blockchain link instead
     */
    getConversationHistory(sessionId: string, force: boolean = false): void {
        this.log('[WebSocketService] getConversationHistory disabled - use blockchain link instead');
        // Method disabled - user will click blockchain link for history
    }

    /**
     * Stream conversation messages - DISABLED
     * User should click blockchain link instead
     */
    streamConversationMessages(sessionId: string, startIndex: number = 0, batchSize: number = 10): void {
        this.log('[WebSocketService] streamConversationMessages disabled - use blockchain link instead');
        // Method disabled - user will click blockchain link for history
    }

    /**
     * Get current session status
     */
    getSessionStatus(sessionId: string): void {
        if (this.socket?.connected) {
            console.log('[WebSocketService] Getting session status for:', sessionId);
            this.socket.emit('get-session-status', { sessionId });
        } else {
            console.error('[WebSocketService] Cannot get session status: not connected');
        }
    }

    sendMessage(event: WebSocketSendMessageEvent): void {
        if (this.socket?.connected) {
            console.log('[WebSocketService] Sending message:', event);
            this.socket.emit('agent-send-message', event);
        } else {
            console.error('[WebSocketService] Cannot send message - not connected');
        }
    }

    triggerAIResponse(event: WebSocketTriggerAIEvent): void {
        if (this.socket?.connected) {
            console.log('[WebSocketService] Triggering AI response:', event);
            this.socket.emit('trigger-ai-response', event);
        } else {
            console.error('[WebSocketService] Cannot trigger AI response - not connected');
        }
    }

    endSession(event: WebSocketEndSessionEvent): void {
        if (this.socket?.connected) {
            console.log('[WebSocketService] Ending session:', event);
            this.socket.emit('end-session', event);
        } else {
            console.error('[WebSocketService] Cannot end session - not connected');
        }
    }



    /**
     * Get current connection status
     */
    get isConnected(): boolean {
        return this.socket?.connected || false;
    }
}
