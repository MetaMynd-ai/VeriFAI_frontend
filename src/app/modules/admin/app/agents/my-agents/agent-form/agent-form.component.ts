import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core'; // Add ViewChild
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field'; // For cdkTextareaAutosize
import { MatIconModule } from '@angular/material/icon';
import { MatStepper, MatStepperModule, StepperOrientation } from '@angular/material/stepper'; // Import StepperOrientation & MatStepper
import { AgentService } from 'app/modules/admin/app/agents/my-agents/agent.service';
// Ensure VCCreationResponse is imported if it's distinct from a general VC response
import { Agent, AgentProfile, WalletCreationResponse, DIDIssuanceResponse, VCCreationResponse, VCIssuancePayload, AgentListItem } from 'app/modules/admin/app/agents/my-agents/agent.interfaces'; // Added AgentListItem
import { AgentCategory, AgentType, AgentCapability, AgentStatus, AgentVcIssueStatus } from 'app/modules/admin/app/agents/my-agents/agent.enums'; // Added AgentStatus, AgentVcIssueStatus
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { switchMap, catchError, tap, delay, retry, takeUntil, finalize } from 'rxjs/operators'; // MODIFIED: Removed map
import { of, throwError, Subject, Subscription } from 'rxjs'; // Add Subject, Subscription
// MODIFIED: Removed BreakpointObserver, Breakpoints, BreakpointState
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; // Import MatDialog
import { SuccessDialogComponent } from './success-dialog/success-dialog.component'; // Import SuccessDialogComponent

@Component({
  selector: 'app-agent-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    TextFieldModule,
    MatIconModule, // Add MatIconModule here
    MatStepperModule, // Add MatStepperModule here
    MatProgressBarModule,
    MatDialogModule // Add MatDialogModule for dialogs
  ],
  templateUrl: './agent-form.component.html',
  styleUrls: ['./agent-form.component.scss'] // Add styleUrls property
})
export class AgentFormComponent implements OnInit, OnDestroy { // Implement OnDestroy
  @ViewChild('stepper') private stepper: MatStepper;
  agentForm: FormGroup;
  isEditMode = false;
  agentId: string | null = null;
  capabilitiesList = Object.values(AgentCapability); // Use enum for capabilities
  agentTypes = Object.values(AgentType); // Use enum for types
  agentCategories = Object.values(AgentCategory); // Use enum for categories

  // Expose Math to the template
  public readonly Math = Math;

  // Stepper and API call state
  currentStep = 0;
  walletAccountId: string | null = null;
  agentDID: string | null = null;
  profileResponse: AgentProfile | null = null;
  vcCreationResponse: VCCreationResponse | null = null; // Added

  isLoadingWallet = false;
  isLoadingDid = false;
  isLoadingProfile = false;
  isLoadingVc = false;
  isLoadingFinalize = false; // Added for finalize step

  errorWallet: string | null = null;
  errorDid: string | null = null;
  errorProfile: string | null = null;
  errorVc: string | null = null;
  errorFinalize: string | null = null; // Added for finalize step

  stepperOrientation: StepperOrientation = 'vertical'; // MODIFIED: Set to 'vertical'
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private stepTransitionDelay = 500; // ms, adjust as needed
  private agentCreationSubscription: Subscription | null = null;


  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private agentService: AgentService, // Inject AgentService
    // private _breakpointObserver: BreakpointObserver, // MODIFIED: Removed BreakpointObserver
    private _cdr: ChangeDetectorRef, // Inject ChangeDetectorRef
    private dialog: MatDialog // Inject MatDialog
  ) {
    // console.log('AgentFormComponent: Constructor called');
    this.agentForm = this.fb.group({
      agentName: ['', Validators.required],
      agentDescription: ['', Validators.required],
      agentUrl: ['', [Validators.pattern('https?://.+'), Validators.required]], // Basic URL validation
      purpose: ['', Validators.required], // If this is part of the profile, it's duplicated or needs to be mapped
      capability: [[], Validators.required], // Initialize as empty array for multi-select
      agentType: ['', Validators.required],
      agentCategory: ['', Validators.required],
    });

    // MODIFIED: Removed BreakpointObserver logic
    // this._breakpointObserver.observe([
    //   Breakpoints.XSmall,
    //   Breakpoints.Small
    // ]).pipe(
    //   takeUntil(this._unsubscribeAll),
    //   map((state: BreakpointState) => state.matches)
    // ).subscribe((isSmallScreen: boolean) => {
    //   this.stepperOrientation = isSmallScreen ? 'vertical' : 'horizontal';
    //   this._cdr.markForCheck();
    // });
  }

  ngOnInit(): void {
    console.log('AgentFormComponent: ngOnInit called');
    // Check for 'id' in route parameters for edit mode
    this.route.paramMap.subscribe(params => {
      this.agentId = params.get('id');
      if (this.agentId) {
        this.isEditMode = true;
        this.loadAgentData(this.agentId);
      } else {
        this.isEditMode = false;
       // Initialize form for creation if needed, e.g., default values
        this.agentForm.reset(); // Or set specific defaults
      }
    });
  }

  loadAgentData(id: string): void {
    this.agentService.getAgentById(id).subscribe({
      next: (agent: AgentListItem | null) => { // MODIFIED: Changed type to AgentListItem | null
        if (agent) {
          // PatchValue can accept a subset of the form's properties.
          // Ensure the names here match the form control names.
          this.agentForm.patchValue({
            agentName: agent.agentName,
            agentDescription: agent.agentDescription,
            agentUrl: agent.url,
            purpose: agent.purpose,
            capability: agent.capability,
            agentType: agent.agentType,
            agentCategory: agent.agentCategory,
          });
          // If you need to store other parts of AgentListItem (like account details) for later use:
          // this.walletAccountId = agent.account?.id; // Example
          // this.agentDID = agent.agentDid; // Example
        } else {
          console.error('Agent not found for ID:', id);
          this.router.navigate(['/my-agents']);
        }
      },
      error: (err) => {
        console.error('Error loading agent data:', err);
        // Optionally navigate back or show an error message
        this.router.navigate(['/my-agents']);
      }
    });
  }

  onSubmit(): void {
    if (this.isEditMode) {
      // Handle agent update logic
      if (this.agentForm.invalid) {
        this.agentForm.markAllAsTouched();
        return;
      }
      const agentDataFromForm = this.agentForm.getRawValue();
      // Construct the payload for update. This will depend on your update API.
      // For now, let's assume it's similar to profile creation or a specific update DTO.
      const updatePayload = {
        // map relevant fields from agentDataFromForm
      };
      if (this.agentId) {
        console.warn('Edit mode update logic needs to be implemented based on your API requirements.');
        // this.agentService.updateAgent(this.agentId, updatePayload).subscribe(...);
        this.router.navigate(['/my-agents']); // Placeholder
      } else {
        console.error('Agent ID is missing for an update.');
      }
      return;
    }

    // Create mode: Start the multi-step process
    if (this.agentForm.invalid && this.currentStep === 0) {
      this.agentForm.markAllAsTouched();
      return;
    }

    if (!this.isEditMode) {
      this.agentForm.disable({ emitEvent: false });
    }

    this.resetErrorStates();
    this.currentStep = 1; // Move to Wallet Creation step indication
    this.isLoadingWallet = true;
    this._cdr.markForCheck();

    const agentRawValue = this.agentForm.getRawValue();

    this.agentCreationSubscription = this.agentService
      .createWalletExternal() // Assuming no arguments based on previous successful edits
      .pipe(
        tap((walletResponse: WalletCreationResponse) => {
          this.isLoadingWallet = false;
          if (walletResponse && walletResponse.wallet && walletResponse.wallet.account && walletResponse.wallet.account.id) {
            this.walletAccountId = walletResponse.wallet.account.id;
          } else {
            this.errorWallet = 'Invalid response from wallet creation (missing account ID).';
            this._cdr.markForCheck();
            throw new Error('Invalid wallet response');
          }
          this.currentStep = 1; // Wallet Created (message will show)
          this._cdr.markForCheck();
          setTimeout(() => {
            this.currentStep = 2; // Move to DID Issuance step visual
            this.isLoadingDid = true; // Corrected typo here
            this.errorDid = null;
            this._cdr.markForCheck();
          }, this.stepTransitionDelay);
        }),
        catchError((error) => {
          this.isLoadingWallet = false;
          this.errorWallet = this.extractErrorMessage(error, 'Failed to create wallet');
          this.currentStep = 1;
          this._cdr.markForCheck();
          this.enableFormAndResetButton();
          return throwError(() => new Error('Wallet creation failed.'));
        }),
        switchMap(() => {
          if (!this.walletAccountId) {
            return throwError(() => new Error('Wallet Account ID is missing for DID issuance.'));
          }
          this.currentStep = 2; // Ensure UI is on DID step
          this.isLoadingDid = true;
          this.errorDid = null;
          this._cdr.markForCheck();
          // Assuming createDIDExternal is the correct service method
          return this.agentService.issueDID(this.walletAccountId);
        }),
        tap((didResponse: DIDIssuanceResponse) => { // Ensure DIDIssuanceResponse is the correct type
          this.isLoadingDid = false;
          if (didResponse && didResponse.did_id) { // Adjusted to did_id based on interface
            this.agentDID = didResponse.did_id;
          } else {
            this.errorDid = 'Invalid response from DID creation (missing DID ID).';
            this._cdr.markForCheck();
            throw new Error('Invalid DID response');
          }
          this.currentStep = 2; // DID Issued (message will show)
          this._cdr.markForCheck();
          setTimeout(() => {
            this.currentStep = 3; // Move to Profile Creation step visual
            this.isLoadingProfile = true;
            this.errorProfile = null;
            this._cdr.markForCheck();
          }, this.stepTransitionDelay);
        }),
        catchError((error) => {
          this.isLoadingDid = false;
          this.errorDid = this.extractErrorMessage(error, 'Failed to issue DID');
          this.currentStep = 2;
          this._cdr.markForCheck();
          this.enableFormAndResetButton();
          return throwError(() => new Error('DID creation failed.'));
        }),
        switchMap(() => {
          if (!this.walletAccountId || !this.agentDID) {
            return throwError(() => new Error('Wallet Account ID or DID is missing for profile creation.'));
          }
          this.currentStep = 3; // Ensure UI is on Profile step
          this.isLoadingProfile = true;
          this.errorProfile = null;
          this._cdr.markForCheck();

          const profileData: AgentProfile = { // MODIFIED: Changed from Partial<AgentProfile> to AgentProfile
            agentDid: this.agentDID,
            agentName: agentRawValue.agentName,
            agentDescription: agentRawValue.agentDescription,
            url: agentRawValue.agentUrl,
            agentType: agentRawValue.agentType,
            agentCategory: agentRawValue.agentCategory,
            capability: agentRawValue.capability,
            purpose: agentRawValue.purpose,
            agentAccountId: this.walletAccountId, // Added: ensure agentAccountId is populated
            status: AgentStatus.PENDING_WALLET, // Added: default status
            vcIssueStatus: AgentVcIssueStatus.PENDING, // Added: default VC issue status
            // These fields are typically set by the backend or later processes,
            // but required by AgentProfile. Set to null or appropriate defaults if not available.
            agentOwnerDID: '', // Assuming it might be set later or by backend
            inboundTopicId: '', // Assuming it might be set later or by backend
            outboundTopicId: '', // Assuming it might be set later or by backend
            communicationTopicId: '', // Assuming it might be set later or by backend
            registryTopicSeq: null,
          };
          // Corrected call to createAgentProfile
          return this.agentService.createAgentProfile(this.walletAccountId, profileData);
        }),
        tap((profileResponse: AgentProfile) => { // Ensure AgentProfile is the correct type
          this.isLoadingProfile = false;
          this.profileResponse = profileResponse;
          this.currentStep = 3; // Profile Created (message will show)
          this._cdr.markForCheck();
          setTimeout(() => {
            this.currentStep = 4; // Move to VC Issuance step visual
            this.isLoadingVc = true;
            this.errorVc = null;
            this._cdr.markForCheck();
          }, this.stepTransitionDelay);
        }),
        catchError((error) => {
          this.isLoadingProfile = false;
          this.errorProfile = this.extractErrorMessage(error, 'Failed to create profile');
          this.currentStep = 3;
          this._cdr.markForCheck();
          this.enableFormAndResetButton();
          return throwError(() => new Error('Profile creation failed.'));
        }),
        switchMap(() => {
          // if (!this.walletAccountId || !this.agentDID || !agentRawValue.credentialSubject) { // MODIFIED: Removed credentialSubject check
          if (!this.walletAccountId || !this.agentDID) {
            return throwError(() => new Error('Missing data for VC issuance.'));
          }
          this.currentStep = 4; // Ensure UI is on VC step
          this.isLoadingVc = true;
          this.errorVc = null;
          this._cdr.markForCheck();

          let vcPayload: VCIssuancePayload;
          try {
            // const credentialSubjectString = JSON.stringify(agentRawValue.credentialSubject); // REMOVED: credentialSubject no longer from form
            // TODO: Determine the new source for credentialSubjectString or the entire base64metadata
            const credentialSubjectString = JSON.stringify({ message: "Default VC Subject" }); // Placeholder - User needs to define this
            vcPayload = { base64metadata: btoa(credentialSubjectString) };
          } catch (e) {
            this.errorVc = 'Failed to prepare VC data (JSON stringify/btoa failed).';
            this._cdr.markForCheck();
            return throwError(() => new Error('VC data preparation failed.'));
          }

          return this.agentService.issueVC( // Assuming issueVC is the correct name
            this.walletAccountId,
            vcPayload // Pass the prepared payload
          ).pipe(
            delay(1000), // Simulate network delay for better UX
            retry(4) // Retry up to 2 additional times (3 total attempts)
          );
        }),
        tap((vcResponse: VCCreationResponse) => { // Ensure VCCreationResponse is the correct type
          this.isLoadingVc = false;
          this.vcCreationResponse = vcResponse;
          this.currentStep = 4; // VC Issued (message will show)
          this._cdr.markForCheck();
          setTimeout(() => {
            this.currentStep = 5; // Move to Finalize Agent Registration step visual
            this.isLoadingFinalize = true;
            this.errorFinalize = null;
            this._cdr.markForCheck();
            // Simulate finalization for now, replace with actual API call if needed
            setTimeout(() => {
              this.isLoadingFinalize = false;
              this.currentStep = 6; // All steps completed
              this._cdr.markForCheck();
             // this.openSuccessDialog();
            }, this.stepTransitionDelay);
          }, this.stepTransitionDelay);
        }),
        catchError((error) => {
          this.isLoadingVc = false;
          this.errorVc = this.extractErrorMessage(error, 'VC creation failed after 3 attempts');
          this.currentStep = 4;
          this._cdr.markForCheck();
          this.enableFormAndResetButton();
          return throwError(() => new Error('VC creation failed after multiple retries.'));
        }),
        takeUntil(this._unsubscribeAll)
      )
      .subscribe({
        // The final next handler is mostly for completion indication if not handled by tap
        // Errors are caught by catchError in the pipe
        error: (err) => {
          // This will catch errors from the source observable or rethrown by catchError
          // console.error('Critical error in agent creation subscription:', err.message);
          // UI should already be updated by individual catchError blocks.
          // This is a fallback.
          if (!this.isEditMode && this.agentForm.disabled) {
            this.agentForm.enable({ emitEvent: false });
          }
          this._cdr.markForCheck();
        },
        // complete: () => {
        //   // console.log('Agent creation stream completed.');
        // }
      });
  }

  private resetErrorStates(): void {
    this.errorWallet = null;
    this.errorDid = null;
    this.errorProfile = null;
    this.errorVc = null;
    this.errorFinalize = null;
  }

  private enableFormAndResetButton(): void {
    if (!this.isEditMode) {
      this.agentForm.enable({ emitEvent: false });
    }
    // Potentially reset a global loading state for a submit button if you have one outside the stepper
    this._cdr.markForCheck();
  }

  private extractErrorMessage(error: any, defaultMessage: string): string {
    if (error && error.error && typeof error.error.message === 'string') {
      return error.error.message;
    }
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    return defaultMessage;
  }


  openSuccessDialog(): void {
    const agentName = this.agentForm.getRawValue().agentName || 'The agent';
    const dialogRef = this.dialog.open(SuccessDialogComponent, {
      width: '450px', // Adjusted width
      disableClose: true,
      data: {
        title: 'Agent Creation Successful!',
        message: `${agentName} has been created successfully. You will now be redirected to the agent's details.`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
        // Always navigate to the agent list page as per the new request
        if (this.walletAccountId) {
        this.router.navigate(['/my-agents/profile', this.walletAccountId]); 
        } else {
        this.router.navigate(['/my-agents']); // Fallback if no walletAccountId
        }
        // Navigate to the agent's profile page

       // Re-enable form if needed, though typically navigation occurs
       if (!this.isEditMode) {
        this.agentForm.enable({ emitEvent: false });
      }
      this.currentStep = 0; // Reset stepper for potential new creation
      if (this.stepper) { // Add null check for stepper
        this.stepper.reset();
      }
      this._cdr.markForCheck();
    });
  }


  onCancel(): void {
    if (this.agentCreationSubscription) {
        this.agentCreationSubscription.unsubscribe();
    }
    if (!this.isEditMode && this.agentForm.disabled) {
      this.agentForm.enable({ emitEvent: false });
    }
    this.currentStep = 0;
    if (this.stepper) {
        this.stepper.reset();
    }
    this.resetErrorStates(); // Clear any error messages
    this.isLoadingWallet = false; // Reset loading states
    this.isLoadingDid = false;
    this.isLoadingProfile = false;
    this.isLoadingVc = false;
    this.isLoadingFinalize = false;

    // Reset form to initial state if not in edit mode
    if (!this.isEditMode) {
        this.agentForm.reset(); // Or specific default values
    }
    this._cdr.markForCheck();
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }
}
