import { 
    ChangeDetectionStrategy, 
    Component, 
    ViewEncapsulation, 
    OnInit, 
    OnDestroy, 
    inject, 
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
    AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, Observable, combineLatest, BehaviorSubject, throwError } from 'rxjs';
import { takeUntil, map, switchMap, tap, startWith, take, shareReplay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AgentChatService } from '../../agent-chat.service';
import { AgentService } from '../../agent.service';
import { WebSocketService } from '../../websocket.service';
import { 
    ChatSession, 
    ChatMessage, 
    ChatRoomUIState,
    WebSocketNewMessageResponse,
    WebSocketAIResponseGeneratedResponse
} from '../../agent-chat.interfaces';
import { AgentListItem } from '../../agent.interfaces';

@Component({
    selector: 'chat-room',
    standalone: true,
    templateUrl: './chat-room.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatBadgeModule,
        MatTooltipModule
    ]
})
export class ChatRoomComponent implements OnInit, OnDestroy, AfterViewChecked {
    @ViewChild('messagesContainer') messagesContainer!: ElementRef;

    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _formBuilder = inject(FormBuilder);
    private _agentChatService = inject(AgentChatService);
    private _agentService = inject(AgentService);
    private _webSocketService = inject(WebSocketService);
    private _snackBar = inject(MatSnackBar);
    private _cdr = inject(ChangeDetectorRef);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    sessionId: string = '';
    session$: Observable<ChatSession | null>;
    session: ChatSession | null = null; // Store current session
    messages$ = new BehaviorSubject<ChatMessage[]>([]);
    agents$: Observable<AgentListItem[]>;
    messageForm: FormGroup;

    // Getter for debugging (removed verbose logging to prevent spam)
    get currentMessages(): ChatMessage[] {
        return this.messages$.value;
    }
    
    uiState: ChatRoomUIState = {
        isConnected: false,
        isAITyping: false,
        typingAgentId: undefined,
        connectionError: undefined,
        lastActivity: undefined
    };

    isLoading = true;
    error: string | null = null;
    private shouldScrollToBottom = false;
    private webSocketListenersSetup = false;
    isEndingSession = false; // Track session deletion progress
    
    // Throttling to prevent session call spam
    private lastSessionLoadTime = 0;
    private readonly SESSION_LOAD_THROTTLE = 1000; // 1 second minimum between session loads

    // Transcript modal properties
    showTranscriptModal = false;
    isLoadingTranscript = false;
    transcriptError: string | null = null;
    transcriptData: any = null;

    constructor() {
        this.messageForm = this._formBuilder.group({
            message: ['']
        });

        // Cache agents observable to prevent multiple API calls
        this.agents$ = this._agentService.getAgents().pipe(shareReplay(1));
        // Session loading moved to ngOnInit to prevent loops
    }

    ngOnInit(): void {
        // Load session from route params ONCE
        this.loadSessionFromRoute();

        this.setupWebSocketListeners();
        this.connectToWebSocket();

        // Subscribe to messages changes for UI updates (removed verbose logging)
        this.messages$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(messages => {
            // Messages updated - UI will automatically reflect changes
        });
    }

    private loadSessionFromRoute(): void {
        this._route.params.pipe(
            take(1), // CRITICAL: Only take the first emission to prevent loops
            takeUntil(this._unsubscribeAll)
        ).subscribe(params => {
            const sessionId = params['sessionId'];

            // Critical validation for sessionId
            if (!sessionId || sessionId.trim() === '') {
                console.error('[ChatRoomComponent] No valid sessionId found in route params');
                this.error = 'Session ID not found in route. Please navigate from the rooms list.';
                this.isLoading = false;
                this._cdr.markForCheck();
                return;
            }

            // Additional UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId)) {
                console.error('[ChatRoomComponent] Invalid sessionId format:', sessionId);
                this.error = 'Invalid session ID format. Please navigate from the rooms list.';
                this.isLoading = false;
                this._cdr.markForCheck();
                return;
            }

            this.sessionId = sessionId;
            console.log('[ChatRoomComponent] SessionId validated and set (ONCE):', this.sessionId);

            // Create session observable and initialize component
            this.session$ = this._agentChatService.getSessionById(this.sessionId);
            this.initializeComponent();
        });
    }

    ngOnDestroy(): void {
        this._webSocketService.disconnect();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    ngAfterViewChecked(): void {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }

    private initializeComponent(): void {
        const now = Date.now();
        
        // Throttle initialization to prevent spam
        if (now - this.lastSessionLoadTime < this.SESSION_LOAD_THROTTLE) {
            console.log('[ChatRoomComponent] Throttling initialization, too soon since last call');
            return;
        }
        
        // Prevent multiple initializations
        if (this.isLoading === false && this.messages$.value.length > 0) {
            console.log('[ChatRoomComponent] Component already initialized, skipping');
            return;
        }

        console.log('[ChatRoomComponent] Initializing component for session:', this.sessionId);
        this.lastSessionLoadTime = now;

        // Validate sessionId before proceeding
        if (!this.sessionId || this.sessionId.trim() === '') {
            console.error('[ChatRoomComponent] Cannot initialize: sessionId is empty or undefined');
            this.error = 'No session ID available. Please navigate from the rooms list.';
            this.isLoading = false;
            this._cdr.markForCheck();
            return;
        }

        // Validate session$ exists
        if (!this.session$) {
            console.error('[ChatRoomComponent] Cannot initialize: session$ is not defined');
            this.error = 'Session not loaded. Please try again.';
            this.isLoading = false;
            this._cdr.markForCheck();
            return;
        }

        // Load session and messages with throttling
        combineLatest([
            this.session$,
            this._agentChatService.getMessages(this.sessionId)
        ]).pipe(
            take(1), // CRITICAL: Only take the first emission to prevent loops
            debounceTime(100), // Additional debouncing
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: ([session, messages]) => {
                console.log('[ChatRoomComponent] Loaded session and', messages.length, 'messages');

                this.session = session; // Store the session
                this.messages$.next(messages);
                this.isLoading = false;
                this.shouldScrollToBottom = true;
                this._cdr.markForCheck();
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error loading data:', error);
                console.error('[ChatRoomComponent] Error details:', {
                    sessionId: this.sessionId,
                    error: error
                });
                this.isLoading = false;
                this.error = error.message || 'Failed to load chat room. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    private setupWebSocketListeners(): void {
        // Prevent multiple listener setups
        if (this.webSocketListenersSetup) {
            console.log('[ChatRoomComponent] WebSocket listeners already setup, skipping');
            return;
        }
        this.webSocketListenersSetup = true;

        // Connection status
        this._webSocketService.isConnected$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(isConnected => {
            this.uiState.isConnected = isConnected;
            this._cdr.markForCheck();
        });

        // Connection errors
        this._webSocketService.connectionError$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(error => {
            this.uiState.connectionError = error || undefined;
            if (error) {
                this._snackBar.open(`Connection error: ${error}`, 'Close', {
                    duration: 5000,
                    panelClass: ['error-snackbar']
                });
            }
            this._cdr.markForCheck();
        });

        // Enhanced error handling based on API documentation
        this._webSocketService.error$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(error => {
            if (error) {
                let errorMessage = 'An error occurred';
                switch (error.code) {
                    case 'JOIN_ERROR':
                        errorMessage = 'Failed to join chat session';
                        break;
                    case 'MESSAGE_ERROR':
                        errorMessage = 'Failed to send message';
                        break;
                    case 'AI_TRIGGER_ERROR':
                        errorMessage = 'AI response generation failed';
                        break;
                    case 'HISTORY_ERROR':
                        errorMessage = 'Failed to load conversation history';
                        break;
                    default:
                        errorMessage = error.message || 'Unknown error occurred';
                }

                this._snackBar.open(errorMessage, 'Close', {
                    duration: 5000,
                    panelClass: ['error-snackbar']
                });
            }
        });

        // Enhanced error handling based on API documentation
        this._webSocketService.error$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(error => {
            if (error) {
                let errorMessage = 'An error occurred';
                switch (error.code) {
                    case 'JOIN_ERROR':
                        errorMessage = 'Failed to join chat session';
                        break;
                    case 'MESSAGE_ERROR':
                        errorMessage = 'Failed to send message';
                        break;
                    case 'AI_TRIGGER_ERROR':
                        errorMessage = 'AI response generation failed';
                        break;
                    case 'HISTORY_ERROR':
                        errorMessage = 'Failed to load conversation history';
                        break;
                    default:
                        errorMessage = error.message || 'Unknown error occurred';
                }

                this._snackBar.open(errorMessage, 'Close', {
                    duration: 5000,
                    panelClass: ['error-snackbar']
                });
            }
        });

        // New messages
        this._webSocketService.newMessage$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(messageData => {
            this.addNewMessage(messageData);
            // Clear session cache to ensure fresh data on next load
            this._agentChatService.clearSessionCache(this.sessionId);
        });

        // AI responses
        this._webSocketService.aiResponseGenerated$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(responseData => {
            this.addNewMessage(responseData);
            this.uiState.isAITyping = false;
            this.uiState.typingAgentId = undefined;
            // Clear session cache to ensure fresh data on next load
            this._agentChatService.clearSessionCache(this.sessionId);
            this._cdr.markForCheck();
        });

        // AI thinking status
        this._webSocketService.aiThinking$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(thinkingData => {
            this.uiState.isAITyping = true;
            this.uiState.typingAgentId = thinkingData.agentId;
            this._cdr.markForCheck();
        });

        // AI skip
        this._webSocketService.aiSkip$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(skipData => {
            this.uiState.isAITyping = false;
            this.uiState.typingAgentId = undefined;
            this._snackBar.open(`AI skipped response: ${skipData.reason}`, 'Close', {
                duration: 3000
            });
            this._cdr.markForCheck();
        });

        // Session ended
        this._webSocketService.sessionEnded$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this._snackBar.open('Session has ended', 'Close', {
                duration: 5000
            });
            // Clear session cache since session has ended
            this._agentChatService.clearSessionCache(this.sessionId);
            // Optionally navigate back to rooms list
        });

        // Conversation history loading removed - user will click blockchain link instead

        this._webSocketService.messageSentOnBehalf$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(data => {
            if (data) {
                console.log('[ChatRoomComponent] Message sent on behalf confirmed:', data);
                this._snackBar.open('Message sent successfully!', 'Close', { duration: 2000 });
            }
        });

        this._webSocketService.messageStream$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(message => {
            if (message) {
                console.log('[ChatRoomComponent] Streaming message received:', message);
                // Add individual streamed message to UI
                const currentMessages = this.messages$.value;
                this.messages$.next([...currentMessages, {
                    _id: message.index?.toString() || Date.now().toString(),
                    sessionId: this.sessionId,
                    fromAgentId: message.from,
                    message: message.message,
                    timestamp: message.timestamp,
                    metadata: message.metadata
                }]);
                this.shouldScrollToBottom = true;
                // Clear session cache for streaming messages
                this._agentChatService.clearSessionCache(this.sessionId);
                this._cdr.markForCheck();
            }
        });

        this._webSocketService.agentJoined$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(data => {
            if (data) {
                console.log('[ChatRoomComponent] Agent joined session:', data);
                this._snackBar.open(`Agent ${data.agentId} joined the session`, 'Close', { duration: 3000 });
            }
        });
    }

    private connectToWebSocket(): void {
        this._webSocketService.connect();
        
        // Wait for connection then join session
        this._webSocketService.isConnected$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(isConnected => {
            if (isConnected && this.sessionId && this.session) {
                // Use cached session instead of observable to prevent loops
                console.log('[ChatRoomComponent] Joining session with cached session data');
                this._webSocketService.joinSession({
                    sessionId: this.sessionId,
                    agentAccountId: this.session.agent1AccountId
                });
            }
        });
    }

    private addNewMessage(messageData: WebSocketNewMessageResponse | WebSocketAIResponseGeneratedResponse): void {
        const currentMessages = this.messages$.value;
        const newMessage: ChatMessage = {
            _id: Date.now().toString(), // Temporary ID
            sessionId: this.sessionId,
            fromAgentId: messageData.from,
            message: messageData.message,
            timestamp: messageData.timestamp,
            metadata: messageData.metadata
        };

        const updatedMessages = [...currentMessages, newMessage];
        this.messages$.next(updatedMessages);

        this.shouldScrollToBottom = true;
        this.uiState.lastActivity = new Date().toISOString();
        
        // Clear session cache whenever a new message is added
        this._agentChatService.clearSessionCache(this.sessionId);
        this._cdr.markForCheck();
    }

    private scrollToBottom(): void {
        try {
            if (this.messagesContainer) {
                this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
            }
        } catch (err) {
            console.error('Error scrolling to bottom:', err);
        }
    }

    /**
     * Send a message on behalf of Agent1 (user input)
     * Uses the new backend method that prevents spam and auto-triggers AI response
     */
    sendMessage(): void {
        const messageText = this.messageForm.get('message')?.value?.trim();
        if (!messageText || !this.uiState.isConnected) {
            return;
        }

        // Validate sessionId before sending message
        if (!this.sessionId || this.sessionId.trim() === '') {
            console.error('[ChatRoomComponent] Cannot send message: sessionId is empty');
            this._snackBar.open('Cannot send message: No session ID available', 'Close', { duration: 3000 });
            return;
        }

        // Use stored session instead of observable to prevent loops
        if (this.session) {
            // Use the new enhanced method that sends on behalf of Agent1 and auto-triggers Agent2 AI
            this._webSocketService.sendUserMessageOnBehalf(
                this.sessionId,
                this.session.agent1AccountId, // User is typing on behalf of Agent1
                messageText,
                true // Auto-trigger Agent2 AI response
            );

            this.messageForm.get('message')?.setValue('');
            this.uiState.lastActivity = new Date().toISOString();
            
            // Clear session cache after sending message to ensure fresh data
            this._agentChatService.clearSessionCache(this.sessionId);
        } else {
            console.error('[ChatRoomComponent] Cannot send message: session not loaded');
            this._snackBar.open('Session not loaded. Please wait or refresh.', 'Close', { duration: 3000 });
        }
    }

    /**
     * Trigger AI response
     */
    triggerAIResponse(agentId: string): void {
        if (!this.uiState.isConnected) {
            this._snackBar.open('Not connected to chat server', 'Close', { duration: 3000 });
            return;
        }

        // Validate sessionId before triggering AI response
        if (!this.sessionId || this.sessionId.trim() === '') {
            console.error('[ChatRoomComponent] Cannot trigger AI response: sessionId is empty');
            this._snackBar.open('Cannot trigger AI response: No session ID available', 'Close', { duration: 3000 });
            return;
        }

        this._webSocketService.triggerAIResponse({
            sessionId: this.sessionId,
            agentAccountId: agentId
        });
    }

    /**
     * Trigger AI response for current session
     */
    triggerAIForCurrentSession(): void {
        // Use cached session instead of observable to prevent loops
        if (this.session) {
            this.triggerAIResponse(this.session.agent2AccountId);
        } else {
            console.warn('[ChatRoomComponent] No session available for AI trigger');
        }
    }



    /**
     * Get agent name by account ID
     */
    getAgentName(accountId: string): Observable<string> {
        return combineLatest([this.agents$, this.session$]).pipe(
            map(([agents, session]) => {
                if (!session) return accountId;

                // Show "You" for agent1, "AI Agent" for agent2
                if (accountId === session.agent1AccountId) {
                    const agent = agents.find(a => a.agentAccountId === accountId);
                    return agent ? `You (${agent.agentName})` : 'You';
                } else if (accountId === session.agent2AccountId) {
                    const agent = agents.find(a => a.agentAccountId === accountId);
                    return agent ? `AI Agent (${agent.agentName})` : 'AI Agent';
                } else {
                    // Fallback for other agents
                    const agent = agents.find(a => a.agentAccountId === accountId);
                    return agent?.agentName || accountId;
                }
            })
        );
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Get message alignment class
     */
    getMessageAlignment(fromAgentId: string): string {
        const currentSession = this.getCurrentSession();
        if (!currentSession) return 'justify-start';

        // Agent1 (user) messages on the right, Agent2 (AI) messages on the left
        return fromAgentId === currentSession.agent1AccountId ? 'justify-end' : 'justify-start';
    }

    /**
     * Get message bubble class
     */
    getMessageBubbleClass(fromAgentId: string): string {
        const baseClass = 'max-w-xs lg:max-w-md px-4 py-2 rounded-lg';
        const currentSession = this.getCurrentSession();
        if (!currentSession) return `${baseClass} bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white`;

        // Agent1 (user) gets blue bubbles on right, Agent2 (AI) gets gray bubbles on left
        return fromAgentId === currentSession.agent1AccountId
            ? `${baseClass} bg-blue-500 text-white`
            : `${baseClass} bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white`;
    }

    /**
     * Get current session synchronously
     */
    private getCurrentSession(): ChatSession | null {
        // Use cached session instead of observable to prevent API calls
        return this.session;
    }



    /**
     * Retry initialization after an error
     */
    retryInitialization(): void {
        console.log('[ChatRoomComponent] Retrying initialization for session:', this.sessionId);

        // Reset error state
        this.error = null;
        this.isLoading = true;
        this._cdr.markForCheck();

        // Retry initialization
        this.initializeComponent();
    }

    /**
     * Test the new user message functionality
     */
    testUserMessage(): void {
        if (this.session && this.uiState.isConnected) {
            // Send a test message on behalf of Agent1 that will trigger Agent2 AI response
            this._webSocketService.sendUserMessageOnBehalf(
                this.sessionId,
                this.session.agent1AccountId,
                "I want to plan a trip to Japan. Can you help me with recommendations?",
                true // Auto-trigger Agent2 AI response
            );

            this._snackBar.open('Test message sent! Agent2 should respond automatically.', 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            this._snackBar.open('Not connected or session not loaded', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
        }
    }

    /**
     * View transcript by calling the API
     */
    viewTranscript(): void {
        if (!this.sessionId) {
            this._snackBar.open('No session ID available', 'Close', { duration: 3000 });
            return;
        }

        // Show modal and start loading
        this.showTranscriptModal = true;
        this.loadTranscript();
    }

    /**
     * Load transcript data
     */
    loadTranscript(): void {
        this.isLoadingTranscript = true;
        this.transcriptError = null;
        this.transcriptData = null;
        this._cdr.markForCheck();

        console.log('[ChatRoomComponent] Fetching transcript for session:', this.sessionId);

        // First check transcript status
        this._agentChatService.getTranscriptStatus(this.sessionId).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (status) => {
                console.log('[ChatRoomComponent] Transcript status:', status);

                if (status.storedInDatabase) {
                    //  Transcript exists, fetch it
                    this.fetchStoredTranscript();
                } else {
                    // No transcript yet
                    this.isLoadingTranscript = false;
                    this.transcriptError = `Transcript not available yet. Messages: ${status.messageCount}. You can generate one using the button below.`;
                    this._cdr.markForCheck();
                }
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error fetching transcript status:', error);
                this.isLoadingTranscript = false;
                this.transcriptError = 'Error checking transcript status. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    /**
     * Fetch the stored transcript
     */
    private fetchStoredTranscript(): void {
        this._agentChatService.getStoredTranscript(this.sessionId).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (transcriptData) => {
                console.log('[ChatRoomComponent] Transcript data received:', transcriptData);

                this.isLoadingTranscript = false;
                this.transcriptData = transcriptData;
                this.transcriptError = null;
                this._cdr.markForCheck();
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error fetching transcript:', error);
                this.isLoadingTranscript = false;
                this.transcriptError = 'Error fetching transcript. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    /**
     * Generate a new transcript
     */
    generateTranscript(): void {
        this.isLoadingTranscript = true;
        this.transcriptError = null;
        this._cdr.markForCheck();

        this._agentChatService.generateTranscript(this.sessionId).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (response) => {
                console.log('[ChatRoomComponent] Transcript generation response:', response);

                // Wait a moment then try to fetch the transcript
                setTimeout(() => {
                    this.fetchStoredTranscript();
                }, 2000);
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error generating transcript:', error);
                this.isLoadingTranscript = false;
                this.transcriptError = 'Error generating transcript. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    /**
     * Close the transcript modal
     */
    closeTranscriptModal(): void {
        this.showTranscriptModal = false;
        this.isLoadingTranscript = false;
        this.transcriptError = null;
        this.transcriptData = null;
        this._cdr.markForCheck();
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString();
    }

    /**
     * Test streaming messages functionality
     */
    testStreamMessages(): void {
        if (!this.sessionId) {
            this._snackBar.open('No session ID available', 'Close', { duration: 3000 });
            return;
        }

        console.log('[ChatRoomComponent] Testing message streaming for session:', this.sessionId);

        // Clear current messages to see streaming effect
        this.messages$.next([]);

        // Start streaming messages from the beginning
        this._webSocketService.streamConversationMessages(this.sessionId, 0, 5);

        this._snackBar.open('Streaming messages... Watch them appear one by one!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
        });
    }

    /**
     * End/Delete the current session when user clicks "X"
     */
    endSession(): void {
        if (!this.sessionId) {
            this._snackBar.open('No session ID available', 'Close', { duration: 3000 });
            return;
        }

        // Confirm with user before ending session
        const confirmMessage = 'Are you sure you want to end this conversation? This action cannot be undone.';
        if (!confirm(confirmMessage)) {
            return;
        }

        console.log('[ChatRoomComponent] Ending session:', this.sessionId);

        // Set loading state
        this.isEndingSession = true;
        this._cdr.markForCheck();

        // Show loading message
        const loadingSnackBar = this._snackBar.open('Ending conversation...', '', {
            duration: 0, // Keep open until we dismiss it
            panelClass: ['info-snackbar']
        });

        // Call the DELETE API endpoint
        this._agentChatService.deleteSession(this.sessionId).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (response) => {
                console.log('[ChatRoomComponent] Session ended successfully:', response);

                // Clear both session and sessions caches
                this._agentChatService.clearSessionCache(this.sessionId);
                this._agentChatService.clearSessionsCache();

                // Dismiss loading snackbar
                loadingSnackBar.dismiss();

                // Reset state
                this.isEndingSession = false;
                this._cdr.markForCheck();

                // Show success message
                this._snackBar.open('Conversation ended successfully!', 'Close', {
                    duration: 3000,
                    panelClass: ['success-snackbar']
                });

                // Disconnect WebSocket
                this._webSocketService.disconnect();

                // Navigate back to rooms list after a short delay
                setTimeout(() => {
                    this._router.navigate(['/my-agents/rooms']);
                }, 1500);
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error ending session:', error);

                // Dismiss loading snackbar
                loadingSnackBar.dismiss();

                // Reset state
                this.isEndingSession = false;
                this._cdr.markForCheck();

                // Enhanced error message based on status
                let errorMessage = 'Failed to end conversation';
                let actionMessage = 'Please try again';
                
                if (error.status === 0) {
                    errorMessage = 'Network connection error';
                    actionMessage = 'Check your internet connection or try again later. The API server may be temporarily unavailable.';
                } else if (error.status === 404) {
                    errorMessage = 'Session not found or already ended';
                    actionMessage = 'You can safely navigate back to the rooms list.';
                } else if (error.status === 403) {
                    errorMessage = 'You do not have permission to end this session';
                } else if (error.status >= 500) {
                    errorMessage = 'Server error occurred';
                    actionMessage = 'The server is experiencing issues. Please try again in a few moments.';
                } else if (error.message) {
                    errorMessage = `Error: ${error.message}`;
                }

                // Show detailed error message
                this._snackBar.open(`${errorMessage}. ${actionMessage}`, 'Close', {
                    duration: 8000,
                    panelClass: ['error-snackbar']
                });

                // For status 0 errors, provide additional guidance
                if (error.status === 0) {
                    console.log('[ChatRoomComponent] Network error detected. Possible causes:');
                    console.log('1. CORS configuration - server may not allow DELETE requests');
                    console.log('2. API server is down or unreachable');
                    console.log('3. Authentication tokens expired');
                    console.log('4. Network connectivity issues');
                }
            }
        });
    }

    /**
     * Track by function for message list
     */
    trackByMessageId(_index: number, message: ChatMessage): string {
        return message._id;
    }

    /**
     * Navigate back to rooms list
     */
    goBack(): void {
        console.log('[ChatRoomComponent] Navigating back to rooms list');
        // Navigate to the rooms list - use absolute path to ensure correct navigation
        this._router.navigate(['/my-agents/rooms']);
    }

    /**
     * Add a test message for debugging
     */
    addTestMessage(): void {
        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            console.warn('[ChatRoomComponent] No session available for test message');
            return;
        }

        const testMessage: ChatMessage = {
            _id: `test-${Date.now()}`,
            sessionId: this.sessionId,
            fromAgentId: currentSession.agent1AccountId, // Use actual agent1 ID
            message: `Test message from Agent1 at ${new Date().toLocaleTimeString()}`,
            timestamp: new Date().toISOString(),
            metadata: {
                aiModel: 'test-model',
                processingTime: 100
            }
        };

        console.log('[ChatRoomComponent] Adding test message as agent1:', testMessage);
        const currentMessages = this.messages$.value;
        this.messages$.next([...currentMessages, testMessage]);
        this._cdr.markForCheck();
    }

    /**
     * Add a test message from agent2 for debugging
     */
    addTestMessageAgent2(): void {
        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            console.warn('[ChatRoomComponent] No session available for test message');
            return;
        }

        const testMessage: ChatMessage = {
            _id: `test-agent2-${Date.now()}`,
            sessionId: this.sessionId,
            fromAgentId: currentSession.agent2AccountId, // Use actual agent2 ID
            message: `Test response from Agent2 at ${new Date().toLocaleTimeString()}`,
            timestamp: new Date().toISOString(),
            metadata: {
                aiModel: 'gpt-4',
                processingTime: 250
            }
        };

        console.log('[ChatRoomComponent] Adding test message as agent2:', testMessage);
        const currentMessages = this.messages$.value;
        this.messages$.next([...currentMessages, testMessage]);
        this._cdr.markForCheck();
    }

    /**
     * Manually load messages from API for testing
     */
    loadMessagesFromAPI(): void {
        console.log('[ChatRoomComponent] Manually loading messages from API for session:', this.sessionId);

        // Validate sessionId before making API call
        if (!this.sessionId || this.sessionId.trim() === '') {
            const errorMsg = 'No session ID available for loading messages';
            console.error('[ChatRoomComponent]', errorMsg);
            this._snackBar.open(errorMsg, 'Close', { duration: 5000 });
            return;
        }

        this._agentChatService.getMessages(this.sessionId).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (messages) => {
                console.log('[ChatRoomComponent] API returned messages:', messages);
                this.messages$.next(messages);
                this._cdr.markForCheck();

                this._snackBar.open(`Loaded ${messages.length} messages from API`, 'Close', {
                    duration: 3000
                });
            },
            error: (error) => {
                console.error('[ChatRoomComponent] Error loading messages from API:', error);
                this._snackBar.open(`Error loading messages: ${error.message || 'Unknown error'}`, 'Close', {
                    duration: 5000
                });
            }
        });
    }
}
