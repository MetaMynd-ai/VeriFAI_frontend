import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
    FormsModule,
    NgForm,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        RouterLink,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
    ],
})
export class AuthSignInComponent implements OnInit {
    @ViewChild('signInNgForm') signInNgForm: NgForm;

    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _router: Router
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Create the form
        this.signInForm = this._formBuilder.group({
            email_or_username: [ // Changed 'email' to 'email_or_username'
                'inam@ai.com',
                // Consider if Validators.email is still appropriate or if it should be more general e.g. Validators.required only
                [Validators.required], 
            ],
            password: ['abc123', Validators.required],
            rememberMe: [''],
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in
     */

    logshowAlert(): void {
        console.log('[SignInComponent] ');
    }
    signIn(event?: MouseEvent): void { 
      
        if (event) {
            event.preventDefault(); // Prevent default form submission
            event.stopPropagation(); // Stop event propagation
        }

        console.log('[SignInComponent] signIn() called.');
       
        // Return if the form is invalid
        if (this.signInForm.invalid) {
            console.log('[SignInComponent] Form is invalid:', this.signInForm.errors);
            return;
        }

        console.log('[SignInComponent] Form is valid. Proceeding with sign-in.');
       
        // Disable the form
        this.signInForm.disable();
        console.log('[SignInComponent] Form disabled.');

        // Hide the alert
        this.showAlert = false;

        // Prepare the payload, ensuring 'email_or_username' is used
        const credentials = {
            email_or_username: this.signInForm.value.email_or_username, // Ensure this matches the form control name
            password: this.signInForm.value.password
        };

        console.log('[SignInComponent] Calling AuthService.signIn with credentials:', credentials);
        // Sign in
        this._authService.signIn(credentials).subscribe(
            (authResponse) => { // Changed to authResponse to log it
                console.log('[SignInComponent] AuthService.signIn successful. Response:', authResponse);
                // return; // Set the redirect url.
                // The '/signed-in-redirect' is a dummy url to catch the request and redirect the user
                // to the correct page after a successful sign in. This way, that url can be set via
                // routing file and we don't have to touch here.
                const redirectURL =
                    this._activatedRoute.snapshot.queryParamMap.get(
                        'redirectURL'
                    ) || '/signed-in-redirect';
                console.log('[SignInComponent] Redirecting to:', redirectURL);
                // Navigate to the redirect url
                this._router.navigateByUrl(redirectURL);
            },
            (error) => { 
                // Changed parameter name to error for clarity
                console.error('[SignInComponent] AuthService.signIn failed. Error:', error);
              
                // Re-enable the form
                this.signInForm.enable();
                console.log('[SignInComponent] Form re-enabled after error.');

                // Reset the form
                if (this.signInNgForm) {
                    this.signInNgForm.resetForm();
                    console.log('[SignInComponent] Form reset after error.');
                } else {
                    console.warn('[SignInComponent] signInNgForm is not available to reset.');
                }

                // Set the alert
                // Attempt to get a more specific error message
                const message = error?.error?.message || error?.message || 'Wrong email or password. Please try again.';
                this.alert = {
                    type: 'error',
                    message: message,
                };
                console.log('[SignInComponent] Alert set to:', this.alert);

                // Show the alert
                this.showAlert = true;
            }
        );
    }
}
