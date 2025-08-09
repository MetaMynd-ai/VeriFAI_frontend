import { 
    ChangeDetectionStrategy, 
    Component, 
    ViewEncapsulation, 
    OnInit, 
    OnDestroy, 
    inject, 
    ChangeDetectorRef 
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink } from '@angular/router';
import { Subject, Observable, combineLatest } from 'rxjs';
import { takeUntil, map, startWith } from 'rxjs/operators';
import { AgentChatService } from '../agent-chat.service';
import { AgentService } from '../agent.service';
import { ChatSession, AgentSelectionItem } from '../agent-chat.interfaces';
import { AgentListItem } from '../agent.interfaces';

@Component({
    selector: 'my-rooms',
    standalone: true,
    templateUrl: './my-rooms.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatBadgeModule,
        RouterLink,
        TitleCasePipe
    ]
})
export class MyRoomsComponent implements OnInit, OnDestroy {
    private _agentChatService = inject(AgentChatService);
    private _agentService = inject(AgentService);
    private _cdr = inject(ChangeDetectorRef);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    sessions$: Observable<ChatSession[]>;
    agents$: Observable<AgentListItem[]>;
    availableAgents$: Observable<AgentSelectionItem[]>;
    isLoading = true;
    error: string | null = null;

    // Cache for agent names to avoid repeated lookups
    private agentNamesCache = new Map<string, string>();

    constructor() {
        // Initialize observables
        this.sessions$ = this._agentChatService.getAllSessions();
        this.agents$ = this._agentService.getAgents();
        
        // Transform agents to selection items and cache names
        this.availableAgents$ = this.agents$.pipe(
            map(agents => agents
                .filter(agent => agent.agentName !== 'no profile found') // Only show agents with profiles
                .map(agent => {
                    // Cache agent names for later use
                    this.agentNamesCache.set(agent.agentAccountId, agent.agentName);
                    return {
                        accountId: agent.agentAccountId,
                        agentName: agent.agentName,
                        isOnline: agent.agentName !== 'no profile found',
                        communicationTopicId: agent.communicationTopicId
                    } as AgentSelectionItem;
                })
            )
        );
    }

    ngOnInit(): void {
        this.loadData();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    private loadData(): void {
        // Combine sessions and agents data
        combineLatest([
            this.sessions$,
            this.agents$
        ]).pipe(
            takeUntil(this._unsubscribeAll),
            startWith([[], []])
        ).subscribe({
            next: ([sessions, agents]) => {
                this.isLoading = false;
                this.error = null;
                this._cdr.markForCheck();
            },
            error: (error) => {
                console.error('[MyRoomsComponent] Error loading data:', error);
                this.isLoading = false;
                this.error = 'Failed to load rooms data. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    /**
     * Get agent name by account ID (cached version)
     */
    getAgentName(accountId: string): string {
        return this.agentNamesCache.get(accountId) || accountId;
    }

    /**
     * Format session title for display
     */
    formatSessionTitle(session: ChatSession): string {
        return session.metadata?.sessionTitle || 
               this._agentChatService.formatSessionTitle(session.agent1AccountId, session.agent2AccountId);
    }

    /**
     * Get session status badge class
     */
    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-500 dark:text-green-50';
            case 'ended':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-500 dark:text-gray-50';
            default:
                return 'bg-blue-100 text-blue-800 dark:bg-blue-500 dark:text-blue-50';
        }
    }

    /**
     * Get relative time string
     */
    getRelativeTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    /**
     * Refresh the rooms data
     */
    refreshRooms(): void {
        this.isLoading = true;
        this.error = null;
        this._cdr.markForCheck();
        this.loadData();
    }

    /**
     * Track by function for ngFor loops
     */
    trackBySessionId(_: number, session: ChatSession): string {
        return session.sessionId;
    }

    /**
     * Track by function for agent selection
     */
    trackByAgentId(_: number, agent: AgentSelectionItem): string {
        return agent.accountId;
    }

    /**
     * Get active sessions
     */
    getActiveSessions(sessions: ChatSession[]): ChatSession[] {
        return sessions.filter(s => s.status === 'active');
    }

    /**
     * Get ended sessions
     */
    getEndedSessions(sessions: ChatSession[]): ChatSession[] {
        return sessions.filter(s => s.status === 'ended');
    }

    /**
     * Get active sessions count
     */
    getActiveSessionsCount(sessions: ChatSession[]): number {
        return sessions.filter(s => s.status === 'active').length;
    }

    /**
     * Get ended sessions count
     */
    getEndedSessionsCount(sessions: ChatSession[]): number {
        return sessions.filter(s => s.status === 'ended').length;
    }
}
