import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { catchError, map, Observable, of, switchMap, tap, throwError, take } from 'rxjs';
import { environment } from 'environments/environment';
import { ApiUser, WalletInfo, AccountBalanceResponse } from 'app/core/user/user.interfaces';
import { User } from 'app/core/user/user.types'; // Import User type

// Define the DTO for the registration payload
export interface RegisterDto {
    username: string;
    email: string;
    password: string;
    tags?: {
        key: string;
        value: string;
    };
}

// Define the expected response structure for login/refresh
export interface AuthResponse {
    user: ApiUser;
    accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _authenticated: boolean = false;
    private _httpClient = inject(HttpClient);
    private _userService = inject(UserService);
    private _apiBaseUrl = environment.apiBaseUrl;

    /**
     * Fetch user wallet account ID information
     * @param username 
     */
    private _fetchUserWalletAccountId(username: string): Observable<string | null> {
        return this._httpClient.get<WalletInfo>(`${this._apiBaseUrl}wallets/${username}`, { withCredentials: true }).pipe(
            map(walletInfo => walletInfo?.id || null),
            catchError((err) => {
                console.warn('[AuthService] _fetchUserWalletAccountId: Could not fetch wallet info to get account ID.', err);
                return of(null); // Return null if fetching fails
            }),
        );
    }

    /**
     * Fetch account HBAR balance
     * @param accountId
     */
    private _fetchAccountHbarBalance(accountId: string): Observable<number | null> {
        return this._httpClient.get<AccountBalanceResponse>(`${this._apiBaseUrl}balance/${accountId}?isHbar=true`, { withCredentials: true }).pipe(
            map(response => response?.balances?.[0]?.balance || null),
            catchError((err) => {
                console.warn('[AuthService] _fetchAccountHbarBalance: Could not fetch HBAR balance.', err);
                return of(null); // Return null if fetching fails
            }),
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for access token
     */
    set accessToken(token: string) {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string {
        return localStorage.getItem('accessToken') ?? '';
    }

    // refreshToken is now an httpOnly cookie, remove localStorage accessors for it.

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Forgot password
     *
     * @param email
     */
    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post('api/auth/forgot-password', email);
    }

    /**
     * Reset password
     *
     * @param password
     */
    resetPassword(password: string): Observable<any> {
        return this._httpClient.post('api/auth/reset-password', password);
    }

    /**
     * Sign in
     *
     * @param credentials
     */
    signIn(credentials: { email_or_username: string; password: string }): Observable<AuthResponse> {
        console.log('  AuthService signIn(): Sign in credentials:', credentials);

        if (this._authenticated) {
            return throwError(() => 'User is already logged in.');
        }

        return this._httpClient.post<AuthResponse>(this._apiBaseUrl + 'auth/login', credentials, { withCredentials: true }).pipe(
            switchMap((authResponse: AuthResponse) => {
                this.accessToken = authResponse.accessToken;
                this._authenticated = true;
                const apiUser = authResponse.user;

                // Step 1: Fetch Wallet Account ID
                return this._fetchUserWalletAccountId(apiUser.username).pipe(
                    switchMap((accountId: string | null) => {
                        if (!accountId) {
                            // No account ID, proceed without balance info
                            return of({ authResponse, apiUser, accountId: null, hbarBalance: null });
                        }
                        // Step 2: Fetch HBAR Balance using the accountId
                        return this._fetchAccountHbarBalance(accountId).pipe(
                            map((hbarBalance: number | null) => {
                                return { authResponse, apiUser, accountId, hbarBalance };
                            })
                        );
                    })
                );
            }),
            map(({ authResponse, apiUser, accountId, hbarBalance }) => {
                // Determine display name
                let displayName = apiUser.username;
                if (apiUser.tags && apiUser.tags.length > 0) {
                    for (const tagString of apiUser.tags) {
                        try {
                            const tagObject = JSON.parse(tagString);
                            if (tagObject && typeof tagObject.name === 'string') {
                                displayName = tagObject.name;
                                break;
                            }
                        } catch (e) { /* console.warn('[AuthService] signIn: Could not parse tag string:', tagString, e); */ }
                    }
                }

                // Prepare user object for UserService
                const userServiceUser: User = {
                    id: apiUser._id,
                    name: displayName,
                    username: apiUser.username,
                    email: apiUser.email,
                    avatar: apiUser.avatar ?? null,
                    status: apiUser.status ?? '',
                    accountId: accountId,
                    hbarBalance: hbarBalance,
                };
                this._userService.user = userServiceUser;

                // Prepare object for localStorage
                const userForStorage = {
                    ...apiUser, // Spread ApiUser properties
                    walletAccountId: accountId, // Store accountId from wallet info
                    hbarBalance: hbarBalance,   // Store HBAR balance
                };
                localStorage.setItem('currentUser', JSON.stringify(userForStorage));
                console.log('[AuthService] signIn: User service updated, currentUser stored:', this._userService.user);
                
                return authResponse; // Return original AuthResponse to the component
            }),
            tap(authResp => { // Log after all operations for signIn
                console.log('[AuthService] signIn: Successfully processed sign-in, including wallet and balance info if available. Response to component:', authResp);
            }),
            catchError(error => {
                console.error('[AuthService] signIn: Error during sign-in process:', error);
                this.signOut();
                return throwError(() => error);
            })
        );
    }

    /**
     * Sign in using the access token (actually, refresh token)
     */
    signInUsingToken(): Observable<boolean> {
        console.log('[AuthService] signInUsingToken() called.');
        return this._httpClient
            .post<AuthResponse>(this._apiBaseUrl + 'auth/refresh', {}, { withCredentials: true })
            .pipe(
                tap((response: AuthResponse) => {
                    console.log('[AuthService] signInUsingToken(): Successfully refreshed token. Response:', response);
                }),
                switchMap((response: AuthResponse) => {
                    this.accessToken = response.accessToken;
                    this._authenticated = true;
                    const apiUser = response.user;

                    let displayName = apiUser.username; // Default to username
                    if (apiUser.tags && apiUser.tags.length > 0) {
                        for (const tagString of apiUser.tags) {
                            try {
                                const tagObject = JSON.parse(tagString);
                                if (tagObject && typeof tagObject.name === 'string') {
                                    displayName = tagObject.name;
                                    break; // Found name, no need to check other tags
                                }
                            } catch (e) {
                                // console.warn('[AuthService] signInUsingToken: Could not parse tag string:', tagString, e);
                            }
                        }
                    }

                    this._userService.user = {
                        id: apiUser._id,
                        name: displayName, // Display name
                        username: apiUser.username, // Actual username
                        email: apiUser.email,
                        avatar: apiUser.avatar ?? null,
                        status: apiUser.status ?? '',
                    };
                    return of(true);
                }),
                catchError((error) => { // Log error
                    console.error('[AuthService] signInUsingToken(): Error refreshing token:', error);
                    this.signOut(); // Sign out if token refresh fails
                    return of(false);
                })
            );
    }

    /**
     * Sign out
     */
    signOut(): Observable<any> {
        console.log('[AuthService] signOut() called.'); // Log when signOut is called
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser'); // Remove stored user object

        // refreshToken cookie is typically cleared by a call to a /logout endpoint on the server,
        // or by setting its expiry to the past. Frontend can't directly delete httpOnly cookies
        // from a different path. For now, just clearing local accessToken.
        // Consider adding a call to a server logout endpoint if it exists.
        // e.g., this._httpClient.post(this._apiBaseUrl + 'auth/logout', {}).subscribe();

        this._authenticated = false;
        this._userService.user = null; // Clear user data
        return of(true);
    }

    /**
     * Sign up
     *
     * @param registrationData
     */
    signUp(registrationData: RegisterDto): Observable<ApiUser> { // Expects ApiUser object in response
        return this._httpClient.post<ApiUser>(this._apiBaseUrl + 'auth/register', registrationData);
    }

    /**
     * Unlock session
     *
     * @param credentials
     */
    unlockSession(credentials: {
        email: string;
        password: string;
    }): Observable<any> {
        return this._httpClient.post('api/auth/unlock-session', credentials);
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean> {
        console.log('[AuthService] check() called.');

        if (this._authenticated) {
            console.log('[AuthService] check(): User is already authenticated in this session (_authenticated is true).');
            return of(true);
        }

        const storedUserString = localStorage.getItem('currentUser');
        const token = this.accessToken;

        if (storedUserString && token) {
            console.log('[AuthService] check(): Found stored user object and access token.');

            if (AuthUtils.isTokenExpired(token)) {
                console.log('[AuthService] check(): Access token is expired. Signing out.');
                this.signOut();
                return of(false);
            }

            try {
                const storedUserObject = JSON.parse(storedUserString);
                const apiUser: ApiUser = storedUserObject; // Base ApiUser properties
                console.log('[AuthService] check(): Successfully parsed stored user object:', storedUserObject);

                let displayName = apiUser.username;
                if (apiUser.tags && apiUser.tags.length > 0) {
                    for (const tagString of apiUser.tags) {
                        try {
                            const tagObject = JSON.parse(tagString);
                            if (tagObject && typeof tagObject.name === 'string') {
                                displayName = tagObject.name;
                                break;
                            }
                        } catch (e) { /* console.warn('[AuthService] check: Could not parse tag string:', tagString, e); */ }
                    }
                }

                this._userService.user = {
                    id: apiUser._id,
                    name: displayName,
                    username: apiUser.username,
                    email: apiUser.email,
                    avatar: apiUser.avatar ?? null,
                    status: apiUser.status ?? 'online',
                    accountId: storedUserObject.walletAccountId, // Get from stored object
                    hbarBalance: storedUserObject.hbarBalance,   // Get from stored object
                };
                this._authenticated = true;
                console.log('[AuthService] check(): User authenticated from stored object and valid token. User service updated:', this._userService.user);
                return of(true);
            }
            catch (error) {
                console.error('[AuthService] check(): Error parsing stored user object. Signing out.', error);
                this.signOut();
                return of(false);
            }
        }
        else {
            console.log('[AuthService] check(): No stored user object or no access token found. User is not authenticated.');
            if (storedUserString || token) {
                console.log('[AuthService] check(): Partial authentication artifacts found. Signing out for consistency.');
                this.signOut();
            }
            this._authenticated = false;
            return of(false);
        }
    }
}
