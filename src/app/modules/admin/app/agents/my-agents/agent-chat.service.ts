import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError, catchError, map, shareReplay, tap } from 'rxjs';
import {
    ChatSession,
    ChatMessage,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionListResponse,
    MessageListResponse,
    TranscriptStatus,
    TranscriptData
} from './agent-chat.interfaces';

@Injectable({
    providedIn: 'root'
})
export class AgentChatService {
    private _httpClient = inject(HttpClient);
    private readonly _apiBaseUrl = 'https://smartapi.trustchainlabs.com/api/agent-chat';

    // Cache for sessions data
    private _sessionsCache$: Observable<SessionListResponse> | null = null;
    
    // Cache for individual session calls to prevent spam
    private _sessionCache = new Map<string, Observable<ChatSession>>();
    private _sessionCacheTimestamp = new Map<string, number>();
    private readonly SESSION_CACHE_DURATION = 30 * 1000; // 30 seconds cache for individual sessions

    constructor() {}

    /**
     * Create a new chat session between two agents
     */
    createSession(request: CreateSessionRequest): Observable<CreateSessionResponse> {
        return this._httpClient.post<CreateSessionResponse>(
            `${this._apiBaseUrl}/sessions`,
            request,
            { withCredentials: true }
        ).pipe(
            catchError(err => {
                console.error('[AgentChatService] Error creating session:', err);
                return throwError(() => err);
            })
        );
    }

    /**
     * Get user's chat sessions with caching
     */
    getSessions(status?: 'active' | 'ended'): Observable<SessionListResponse> {
        // For now, don't cache filtered requests, only cache all sessions
        if (status) {
            const params = { status };
            return this._httpClient.get<SessionListResponse>(
                `${this._apiBaseUrl}/sessions`,
                {
                    params,
                    withCredentials: true
                }
            ).pipe(
                catchError(err => {
                    console.error('[AgentChatService] Error fetching sessions:', err);
                    return throwError(() => err);
                })
            );
        }

        // Cache all sessions request
        if (this._sessionsCache$) {
            return this._sessionsCache$;
        }

        this._sessionsCache$ = this._httpClient.get<SessionListResponse>(
            `${this._apiBaseUrl}/sessions`,
            { withCredentials: true }
        ).pipe(
            shareReplay(1),
            catchError(err => {
                console.error('[AgentChatService] Error fetching sessions:', err);
                // Clear cache on error
                this._sessionsCache$ = null;
                return throwError(() => err);
            })
        );

        return this._sessionsCache$;
    }

    /**
     * Clear the sessions cache (useful when sessions are updated)
     */
    clearSessionsCache(): void {
        this._sessionsCache$ = null;
    }

    /**
     * Clear individual session cache
     */
    clearSessionCache(sessionId?: string): void {
        if (sessionId) {
            console.log(`[AgentChatService] Clearing cache for session ${sessionId}`);
            this._sessionCache.delete(sessionId);
            this._sessionCacheTimestamp.delete(sessionId);
        } else {
            console.log('[AgentChatService] Clearing all session caches');
            this._sessionCache.clear();
            this._sessionCacheTimestamp.clear();
        }
    }

    /**
     * Get a specific session by ID with aggressive caching to prevent spam
     */
    getSessionById(sessionId: string): Observable<ChatSession> {
        // Critical validation to prevent malformed URLs
        if (!sessionId || sessionId.trim() === '') {
            const error = new Error('Session ID is required and cannot be empty');
            console.error('[AgentChatService] Session ID validation failed for getSessionById:', { sessionId });
            return throwError(() => error);
        }

        // Additional UUID validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sessionId)) {
            const error = new Error(`Invalid session ID format: ${sessionId}`);
            console.error('[AgentChatService] Session ID format validation failed for getSessionById:', { sessionId });
            return throwError(() => error);
        }

        const now = Date.now();
        const cacheTimestamp = this._sessionCacheTimestamp.get(sessionId);
        
        // Return cached session if available and not expired
        if (this._sessionCache.has(sessionId) && cacheTimestamp && (now - cacheTimestamp) < this.SESSION_CACHE_DURATION) {
            console.log(`[AgentChatService] Returning cached session for ${sessionId}`);
            return this._sessionCache.get(sessionId)!;
        }

        // Clear expired cache entry
        if (cacheTimestamp && (now - cacheTimestamp) >= this.SESSION_CACHE_DURATION) {
            console.log(`[AgentChatService] Clearing expired session cache for ${sessionId}`);
            this._sessionCache.delete(sessionId);
            this._sessionCacheTimestamp.delete(sessionId);
        }

        const url = `${this._apiBaseUrl}/sessions/${sessionId}`;
        console.log(`[AgentChatService] Making NEW API call for session: ${url}`);

        // Create new observable and cache it
        const sessionObs$ = this._httpClient.get<{ success: boolean; data: ChatSession }>(
            url,
            { withCredentials: true }
        ).pipe(
            map(response => response.data),
            shareReplay(1), // Share the result among multiple subscribers
            catchError(err => {
                console.error(`[AgentChatService] Error fetching session ${sessionId}:`, err);
                console.error(`[AgentChatService] Request URL was: ${url}`);
                // Remove from cache on error
                this._sessionCache.delete(sessionId);
                this._sessionCacheTimestamp.delete(sessionId);
                return throwError(() => err);
            })
        );

        // Cache the observable and timestamp
        this._sessionCache.set(sessionId, sessionObs$);
        this._sessionCacheTimestamp.set(sessionId, now);

        return sessionObs$;
    }

    /**
     * Get messages for a specific session
     */
    getSessionMessages(sessionId: string): Observable<MessageListResponse> {
        // Critical validation to prevent malformed URLs
        if (!sessionId || sessionId.trim() === '') {
            const error = new Error('Session ID is required and cannot be empty');
            console.error('[AgentChatService] Session ID validation failed:', { sessionId });
            return throwError(() => error);
        }

        // Additional UUID validation (assuming UUIDs are used)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sessionId)) {
            const error = new Error(`Invalid session ID format: ${sessionId}`);
            console.error('[AgentChatService] Session ID format validation failed:', { sessionId });
            return throwError(() => error);
        }

        const url = `${this._apiBaseUrl}/sessions/${sessionId}/messages`;
        console.log(`[AgentChatService] Fetching messages from: ${url}`);

        return this._httpClient.get<MessageListResponse>(
            url,
            { withCredentials: true }
        ).pipe(
            tap(response => {
                console.log(`[AgentChatService] Messages response for session ${sessionId}:`, response);
            }),
            catchError(err => {
                console.error(`[AgentChatService] Error fetching messages for session ${sessionId}:`, err);
                console.error(`[AgentChatService] Request URL was: ${url}`);
                return throwError(() => err);
            })
        );
    }

    /**
     * End a chat session
     */
    endSession(sessionId: string): Observable<any> {
        return this._httpClient.delete(
            `${this._apiBaseUrl}/sessions/${sessionId}`,
            { withCredentials: true }
        ).pipe(
            catchError(err => {
                console.error(`[AgentChatService] Error ending session ${sessionId}:`, err);
                return throwError(() => err);
            })
        );
    }

    /**
     * Get transcript status for a session
     */
    getTranscriptStatus(sessionId: string): Observable<TranscriptStatus> {
        return this._httpClient.get<{ success: boolean; data: TranscriptStatus }>(
            `${this._apiBaseUrl}/sessions/${sessionId}/transcript-status`,
            { withCredentials: true }
        ).pipe(
            map(response => response.data),
            catchError(err => {
                console.error(`[AgentChatService] Error fetching transcript status for session ${sessionId}:`, err);
                return throwError(() => err);
            })
        );
    }

    /**
     * Get stored transcript for a session
     */
    getStoredTranscript(sessionId: string): Observable<TranscriptData> {
        return this._httpClient.get<{ success: boolean; data: TranscriptData }>(
            `${this._apiBaseUrl}/sessions/${sessionId}/transcript`,
            { withCredentials: true }
        ).pipe(
            map(response => response.data),
            catchError(err => {
                console.error(`[AgentChatService] Error fetching transcript for session ${sessionId}:`, err);
                return throwError(() => err);
            })
        );
    }

    /**
     * Manually generate transcript for a session
     */
    generateTranscript(sessionId: string): Observable<any> {
        return this._httpClient.post(
            `${this._apiBaseUrl}/sessions/${sessionId}/generate-transcript`,
            {},
            { withCredentials: true }
        ).pipe(
            catchError(err => {
                console.error(`[AgentChatService] Error generating transcript for session ${sessionId}:`, err);
                return throwError(() => err);
            })
        );
    }

    /**
     * Delete/End a chat session
     */
    deleteSession(sessionId: string): Observable<any> {
        // Critical validation to prevent malformed URLs
        if (!sessionId || sessionId.trim() === '') {
            const error = new Error('Session ID is required and cannot be empty');
            console.error('[AgentChatService] Session ID validation failed for deleteSession:', { sessionId });
            return throwError(() => error);
        }

        // Additional UUID validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sessionId)) {
            const error = new Error(`Invalid session ID format: ${sessionId}`);
            console.error('[AgentChatService] Session ID format validation failed for deleteSession:', { sessionId });
            return throwError(() => error);
        }

        const url = `${this._apiBaseUrl}/sessions/${sessionId}`;
        console.log(`[AgentChatService] Deleting session: ${url}`);

        // Enhanced headers for better compatibility
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        return this._httpClient.delete(url, { 
            withCredentials: true,
            headers,
            observe: 'response' as const
        }).pipe(
            map(response => {
                console.log(`[AgentChatService] Session ${sessionId} deleted successfully. Status:`, response.status);
                return response.body;
            }),
            catchError(err => {
                console.error(`[AgentChatService] Error deleting session ${sessionId}:`, err);
                
                // Enhanced error logging for debugging
                if (err.status === 0) {
                    console.error('[AgentChatService] Network error - possible CORS, connectivity, or authentication issue');
                    console.error('[AgentChatService] Check if API server is running and accessible');
                    console.error('[AgentChatService] Verify CORS settings allow DELETE requests from this origin');
                }
                
                return throwError(() => err);
            })
        );
    }

    /**
     * Helper method to get active sessions only
     */
    getActiveSessions(): Observable<ChatSession[]> {
        return this.getSessions('active').pipe(
            map(response => response.data)
        );
    }

    /**
     * Helper method to get ended sessions only
     */
    getEndedSessions(): Observable<ChatSession[]> {
        return this.getSessions('ended').pipe(
            map(response => response.data)
        );
    }

    /**
     * Helper method to get all sessions
     */
    getAllSessions(): Observable<ChatSession[]> {
        return this.getSessions().pipe(
            map(response => response.data)
        );
    }

    /**
     * Helper method to get messages for a session
     */
    getMessages(sessionId: string): Observable<ChatMessage[]> {
        // Validation is handled in getSessionMessages, but add logging here too
        console.log(`[AgentChatService] getMessages called with sessionId: "${sessionId}"`);

        return this.getSessionMessages(sessionId).pipe(
            map(response => response.data)
        );
    }

    /**
     * Helper method to format session title from agent account IDs
     */
    formatSessionTitle(agent1AccountId: string, agent2AccountId: string): string {
        // Extract the last part of the account ID for display
        const agent1Display = agent1AccountId.split('.').pop() || agent1AccountId;
        const agent2Display = agent2AccountId.split('.').pop() || agent2AccountId;
        return `Agent ${agent1Display} & Agent ${agent2Display}`;
    }

    /**
     * Helper method to check if a session is active
     */
    isSessionActive(session: ChatSession): boolean {
        return session.status === 'active';
    }

    /**
     * Helper method to get the other agent ID in a session
     */
    getOtherAgentId(session: ChatSession, currentAgentId: string): string {
        return session.agent1AccountId === currentAgentId 
            ? session.agent2AccountId 
            : session.agent1AccountId;
    }
}
