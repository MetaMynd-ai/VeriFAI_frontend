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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, Observable, combineLatest, forkJoin } from 'rxjs';
import { takeUntil, map, finalize, startWith, shareReplay } from 'rxjs/operators';
import { AgentChatService } from '../../agent-chat.service';
import { AgentService } from '../../agent.service';
import { AgentSelectionItem, CreateSessionRequest } from '../../agent-chat.interfaces';
import { AgentProfile } from '../../agent.interfaces';

// Agent verification interfaces
interface AgentVerificationStatus {
    agentAccountId: string;
    agentName: string;
    isVerifying: boolean;
    isVerified: boolean;
    hasAgentDid: boolean;
    hasAgentOwnerDid: boolean;
    error: string | null;
}

interface VerificationStep {
    message: string;
    isComplete: boolean;
    isAnimating: boolean;
}

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
        MatSnackBarModule,
        MatTooltipModule
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

    // Agent verification state
    isVerifying = false;
    verificationComplete = false;
    verificationSuccessful = false;
    agentVerificationStatuses: AgentVerificationStatus[] = [];
    verificationSteps: VerificationStep[] = [];
    showVerificationModal = false;

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
     * Create the chat room (now with verification step)
     */
    createRoom(): void {
        if (this.roomForm.invalid) {
            this.markFormGroupTouched();
            return;
        }

        // Start agent verification process
        this.startAgentVerification();
    }

    /**
     * Start the agent verification process
     */
    private startAgentVerification(): void {
        const formValue = this.roomForm.value;
        const agent1Id = formValue.agent1;
        const agent2Id = formValue.agent2;

        // Initialize verification state
        this.isVerifying = true;
        this.verificationComplete = false;
        this.verificationSuccessful = false;
        this.showVerificationModal = true;
        this.error = null;

        // Initialize agent verification statuses
        this.agentVerificationStatuses = [
            {
                agentAccountId: agent1Id,
                agentName: this.getAgentName(agent1Id),
                isVerifying: true,
                isVerified: false,
                hasAgentDid: false,
                hasAgentOwnerDid: false,
                error: null
            },
            {
                agentAccountId: agent2Id,
                agentName: this.getAgentName(agent2Id),
                isVerifying: true,
                isVerified: false,
                hasAgentDid: false,
                hasAgentOwnerDid: false,
                error: null
            }
        ];

        // Initialize verification steps
        this.verificationSteps = [
            { message: 'Verifying agents...', isComplete: false, isAnimating: true },
            { message: 'Agent DID verification', isComplete: false, isAnimating: false },
            { message: 'Agent Owner DID verification', isComplete: false, isAnimating: false },
            { message: 'Ready to create room', isComplete: false, isAnimating: false }
        ];

        this._cdr.markForCheck();

        // Start verification for both agents
        this.verifyAgents([agent1Id, agent2Id]);
    }

    /**
     * Verify multiple agents
     */
    private verifyAgents(agentIds: string[]): void {
        const verificationObservables = agentIds.map(agentId =>
            this._agentService.getAgentProfileById(agentId).pipe(
                map(profile => ({ agentId, profile }))
            )
        );

        forkJoin(verificationObservables).pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (results) => {
                this.processVerificationResults(results);
            },
            error: (error) => {
                console.error('[RoomCreationComponent] Error during agent verification:', error);
                this.handleVerificationError('Failed to verify agents. Please try again.');
            }
        });
    }

    /**
     * Process verification results
     */
    private processVerificationResults(results: { agentId: string; profile: AgentProfile }[]): void {
        let allAgentsVerified = true;

        // Update verification status for each agent
        results.forEach(({ agentId, profile }) => {
            const statusIndex = this.agentVerificationStatuses.findIndex(s => s.agentAccountId === agentId);
            if (statusIndex !== -1) {
                const status = this.agentVerificationStatuses[statusIndex];

                // Check if agentDid and agentOwnerDID exist and are not empty
                status.hasAgentDid = !!(profile.agentDid && profile.agentDid.trim());
                status.hasAgentOwnerDid = !!(profile.agentOwnerDID && profile.agentOwnerDID.trim());
                status.isVerified = status.hasAgentDid && status.hasAgentOwnerDid;
                status.isVerifying = false;

                if (!status.isVerified) {
                    allAgentsVerified = false;
                    const missingFields = [];
                    if (!status.hasAgentDid) missingFields.push('Agent DID');
                    if (!status.hasAgentOwnerDid) missingFields.push('Agent Owner DID');
                    status.error = `Missing: ${missingFields.join(', ')}`;
                }
            }
        });

        // Update verification steps with animation
        this.updateVerificationSteps(allAgentsVerified);

        if (allAgentsVerified) {
            // All agents verified, show completion and wait for user to proceed
            this.verificationSuccessful = true;
            setTimeout(() => {
                this.isVerifying = false;
                this.verificationComplete = true;
                this._cdr.markForCheck();
            }, 1500); // Delay to show completion animation
        } else {
            // Some agents failed verification
            this.handleVerificationError('Agent verification failed. Please ensure all agents have valid DIDs.');
        }

        this._cdr.markForCheck();
    }

    /**
     * Update verification steps with animations
     */
    private updateVerificationSteps(allVerified: boolean): void {
        // Step 1: Verifying agents (complete)
        this.verificationSteps[0].isComplete = true;
        this.verificationSteps[0].isAnimating = false;

        setTimeout(() => {
            // Step 2: Agent DID verification
            this.verificationSteps[1].isAnimating = true;
            this._cdr.markForCheck();

            setTimeout(() => {
                this.verificationSteps[1].isComplete = allVerified;
                this.verificationSteps[1].isAnimating = false;

                if (allVerified) {
                    // Step 3: Agent Owner DID verification
                    this.verificationSteps[2].isAnimating = true;
                    this._cdr.markForCheck();

                    setTimeout(() => {
                        this.verificationSteps[2].isComplete = true;
                        this.verificationSteps[2].isAnimating = false;

                        // Step 4: Ready to create room
                        this.verificationSteps[3].isAnimating = true;
                        this._cdr.markForCheck();

                        setTimeout(() => {
                            this.verificationSteps[3].isComplete = true;
                            this.verificationSteps[3].isAnimating = false;
                            this._cdr.markForCheck();
                        }, 1000);
                    }, 1000);
                }
                this._cdr.markForCheck();
            }, 1000);
        }, 800);
    }

    /**
     * Handle verification errors
     */
    private handleVerificationError(errorMessage: string): void {
        this.isVerifying = false;
        this.error = errorMessage;
        this._cdr.markForCheck();
    }

    /**
     * Proceed to actual room creation after successful verification
     */
    proceedToRoomCreation(): void {
        this.showVerificationModal = false;
        this.isCreating = true;
        this.isVerifying = false;
        this.verificationComplete = true;

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
     * Close verification modal and reset state
     */
    closeVerificationModal(): void {
        this.showVerificationModal = false;
        this.isVerifying = false;
        this.verificationComplete = false;
        this.verificationSuccessful = false;
        this.agentVerificationStatuses = [];
        this.verificationSteps = [];
        this._cdr.markForCheck();
    }

    /**
     * Retry verification process
     */
    retryVerification(): void {
        this.startAgentVerification();
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
    trackByAgentId(_: number, agent: AgentSelectionItem): string {
        return agent.accountId;
    }
}
