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
import { Router, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';

@Component({
    selector: 'auth-sign-up',
    templateUrl: './sign-up.component.html',
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
export class AuthSignUpComponent implements OnInit {
    @ViewChild('signUpNgForm') signUpNgForm: NgForm;

    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signUpForm: UntypedFormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
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
        this.signUpForm = this._formBuilder.group({
            fullName: ['', Validators.required], // Added for tags
            username: ['', Validators.required], // Kept for username API field
            email: ['', [Validators.required, Validators.email]],
            password: ['', Validators.required],
            // company: [''], // Removed as per API
            // agreements: ['', Validators.requiredTrue], // Removed as it's not sent to API
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign up
     */
    signUp(): void {
        // Do nothing if the form is invalid
        if (this.signUpForm.invalid) {
            return;
        }

        // Disable the form
        this.signUpForm.disable();

        // Hide the alert
        this.showAlert = false;

        // Prepare the payload
        const payload = {
            username: this.signUpForm.get('username').value,
            email: this.signUpForm.get('email').value,
            password: this.signUpForm.get('password').value,
            tags: {
                key: 'name',
                value: this.signUpForm.get('fullName').value
            }
        };

        // Sign up
        this._authService.signUp(payload).subscribe(
            (response) => {
                // Re-enable the form
                this.signUpForm.enable();

                // Reset the form
                this.signUpNgForm.resetForm();

                // Set the success alert
                this.alert = {
                    type: 'success',
                    message: 'User created successfully! You can now sign in with your credentials.',
                };
                this.showAlert = true;

                // Navigate to the sign-in page after a short delay
                setTimeout(() => {
                   this._router.navigateByUrl('/sign-in');
                }, 5000); // 5-second delay
            },
            (errorResponse) => { // Changed parameter name for clarity
                // Re-enable the form
                this.signUpForm.enable();

                // Reset the form
                this.signUpNgForm.resetForm();

                // Set the alert based on error
                // Assuming errorResponse.error.message or similar path to an error message from backend
                const errorMessage = errorResponse?.error?.message || 'Something went wrong, please try again.';
                this.alert = {
                    type: 'error',
                    message: errorMessage,
                };

                // Show the alert
                this.showAlert = true;
            }
        );
    }
}
