import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService } from '../agent.service'; // Corrected path
import { AgentProfile } from '../agent.interfaces'; // Corrected path
import { Subject } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { environment } from 'environments/environment'; // Import environment
import { ToTitleCasePipe } from './to-title-case.pipe'; // Import the pipe

@Component({
    selector: 'app-agent-profile-page',
    templateUrl: './agent-profile-page.component.html',
    styleUrls: ['./agent-profile-page.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        ToTitleCasePipe // Add the pipe to imports
    ]
})
export class AgentProfilePageComponent implements OnInit, OnDestroy {
    profileData: AgentProfile | null = null;
    isLoading: boolean = true;
    errorMessage: string | null = null;
    hashScanBaseUrl = environment.hashScanBaseUrl; // Add hashScanBaseUrl property
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    private _activatedRoute = inject(ActivatedRoute);
    private _agentService = inject(AgentService);
    private _router = inject(Router);
    private _cdr = inject(ChangeDetectorRef); // Injected ChangeDetectorRef

    constructor() { }

    ngOnInit(): void {
        const agentAccountId = this._activatedRoute.snapshot.paramMap.get('agentAccountId');

        if (!agentAccountId) {
            this.errorMessage = 'Agent Account ID is missing from the URL.';
            this.isLoading = false;
            this._cdr.markForCheck(); // Mark for check
            return;
        }

        this.isLoading = true;
        this._cdr.markForCheck(); // Mark for check after initial isLoading set

        this._agentService.getAgentProfileById(agentAccountId).pipe( // Assuming getAgentProfile is the correct method in AgentService for fetching by account ID
            takeUntil(this._unsubscribeAll),
            catchError(err => {
                this.errorMessage = 'Failed to load agent profile. Please try again later.';
                console.error('Error fetching agent profile:', err);
                this.profileData = null;
                this._cdr.markForCheck(); // Mark for check
                return []; // Return empty observable to complete the stream
            }),
            finalize(() => {
                this.isLoading = false;
                this._cdr.markForCheck(); // Mark for check
            })
        ).subscribe(profile => {
            if (profile) {
                this.profileData = profile;
            } else if (!this.errorMessage) { // Only set 'not found' if no other error occurred
                 this.errorMessage = 'Agent profile not found.';
            }
            this._cdr.markForCheck(); // Mark for check
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    goBack(): void {
        this._router.navigate(['../..'], { relativeTo: this._activatedRoute }); // Navigate back to my-agents list
    }
}
