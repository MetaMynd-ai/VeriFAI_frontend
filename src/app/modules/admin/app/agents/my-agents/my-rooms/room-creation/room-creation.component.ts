import { 
    ChangeDetectionStrategy, 
    Component, 
    ViewEncapsulation, 
    OnInit, 
    OnDestroy, 
    inject, 
    ChangeDetectorRef 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, Observable, combineLatest } from 'rxjs';
import { takeUntil, map, finalize, startWith, shareReplay } from 'rxjs/operators';
import { AgentChatService } from '../../agent-chat.service';
import { AgentService } from '../../agent.service';
import { AgentSelectionItem, CreateSessionRequest } from '../../agent-chat.interfaces';
import { AgentListItem } from '../../agent.interfaces';

@Component({
    selector: 'room-creation',
    standalone: true,
    templateUrl: './room-creation.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatRadioModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ]
})
export class RoomCreationComponent implements OnInit, OnDestroy {
    private _formBuilder = inject(FormBuilder);
    private _router = inject(Router);
    private _agentChatService = inject(AgentChatService);
    private _agentService = inject(AgentService);
    private _snackBar = inject(MatSnackBar);
    private _cdr = inject(ChangeDetectorRef);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    roomForm: FormGroup;
    availableAgents$: Observable<AgentSelectionItem[]>;
    availableAgent2Options$: Observable<AgentSelectionItem[]>;
    isLoading = false;
    isCreating = false;
    error: string | null = null;

    // Cache for agent names to avoid repeated lookups
    private agentNamesCache = new Map<string, string>();

    constructor() {
        // Initialize form
        this.roomForm = this._formBuilder.group({
            agent1: ['', Validators.required],
            agent2: ['', Validators.required],
            preferredTopicAgent: ['agent1', Validators.required]
        });

        // Transform agents to selection items with shareReplay to prevent multiple API calls
        this.availableAgents$ = this._agentService.getAgents().pipe(
            map(agents => {
                console.log('[RoomCreationComponent] Processing agents for selection');
                const filteredAgents = agents
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
                    });
                console.log(`[RoomCreationComponent] Filtered ${filteredAgents.length} agents for selection`);
                return filteredAgents;
            }),
            shareReplay(1) // Cache the transformed data
        );

        // Set up reactive agent2 options
        this.availableAgent2Options$ = combineLatest([
            this.availableAgents$,
            this.roomForm.get('agent1')!.valueChanges.pipe(startWith(this.roomForm.get('agent1')?.value))
        ]).pipe(
            map(([agents, agent1Id]) => {
                return agents.filter(agent => agent.accountId !== agent1Id);
            })
        );
    }

    ngOnInit(): void {
        this.loadAgents();
        this.setupFormValidation();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    private loadAgents(): void {
        this.isLoading = true;
        console.log('[RoomCreationComponent] Loading agents...');
        
        this.availableAgents$.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (agents) => {
                console.log(`[RoomCreationComponent] Loaded ${agents.length} agents`);
                this.isLoading = false;
                if (agents.length < 2) {
                    this.error = 'You need at least 2 agents with profiles to create a chat room.';
                } else {
                    this.error = null; // Clear any previous errors
                }
                this._cdr.markForCheck();
            },
            error: (error) => {
                console.error('[RoomCreationComponent] Error loading agents:', error);
                this.isLoading = false;
                this.error = 'Failed to load agents. Please try again.';
                this._cdr.markForCheck();
            }
        });
    }

    private setupFormValidation(): void {
        // Custom validator to ensure different agents are selected
        this.roomForm.get('agent2')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.validateAgentSelection();
        });

        this.roomForm.get('agent1')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.validateAgentSelection();
        });
    }

    private validateAgentSelection(): void {
        const agent1 = this.roomForm.get('agent1')?.value;
        const agent2 = this.roomForm.get('agent2')?.value;

        if (agent1 && agent2 && agent1 === agent2) {
            this.roomForm.get('agent2')?.setErrors({ sameAgent: true });
        } else {
            const agent2Control = this.roomForm.get('agent2');
            if (agent2Control?.errors?.['sameAgent']) {
                delete agent2Control.errors['sameAgent'];
                if (Object.keys(agent2Control.errors).length === 0) {
                    agent2Control.setErrors(null);
                }
            }
        }
    }

    /**
     * Get agent name by account ID (cached version)
     */
    getAgentName(accountId: string): string {
        return this.agentNamesCache.get(accountId) || accountId;
    }

    /**
     * Create the chat room
     */
    createRoom(): void {
        if (this.roomForm.invalid) {
            this.markFormGroupTouched();
            return;
        }

        this.isCreating = true;
        this.error = null;

        const formValue = this.roomForm.value;
        const request: CreateSessionRequest = {
            agent1AccountId: formValue.agent1,
            agent2AccountId: formValue.agent2,
            preferredTopicAgent: formValue.preferredTopicAgent
        };

        this._agentChatService.createSession(request).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => {
                this.isCreating = false;
                this._cdr.markForCheck();
            })
        ).subscribe({
            next: (response) => {
                if (response.success) {
                    // Clear sessions cache so new room appears in rooms list
                    this._agentChatService.clearSessionsCache();
                    
                    this._snackBar.open('Chat room created successfully!', 'Close', {
                        duration: 3000,
                        panelClass: ['success-snackbar']
                    });
                    
                    // Navigate to the new chat room
                    this._router.navigate(['/my-agents/rooms/chat', response.data.sessionId]);
                } else {
                    this.error = 'Failed to create chat room. Please try again.';
                }
            },
            error: (error) => {
                console.error('[RoomCreationComponent] Error creating room:', error);
                this.error = error.error?.message || 'Failed to create chat room. Please try again.';
                this._snackBar.open('Failed to create chat room', 'Close', {
                    duration: 5000,
                    panelClass: ['error-snackbar']
                });
            }
        });
    }

    /**
     * Cancel room creation and go back
     */
    cancel(): void {
        this._router.navigate(['/my-agents/rooms']);
    }

    /**
     * Mark all form fields as touched to show validation errors
     */
    private markFormGroupTouched(): void {
        Object.keys(this.roomForm.controls).forEach(key => {
            const control = this.roomForm.get(key);
            control?.markAsTouched();
        });
    }

    /**
     * Get form field error message
     */
    getFieldError(fieldName: string): string {
        const control = this.roomForm.get(fieldName);
        if (control?.errors && control.touched) {
            if (control.errors['required']) {
                return `${fieldName} is required`;
            }
            if (control.errors['sameAgent']) {
                return 'Please select a different agent';
            }
        }
        return '';
    }

    /**
     * Check if form field has error
     */
    hasFieldError(fieldName: string): boolean {
        const control = this.roomForm.get(fieldName);
        return !!(control?.errors && control.touched);
    }

    /**
     * Track by function for ngFor loops
     */
    trackByAgentId(index: number, agent: AgentSelectionItem): string {
        return agent.accountId;
    }
}
