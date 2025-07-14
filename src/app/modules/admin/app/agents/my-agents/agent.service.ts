import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { UserService } from 'app/core/user/user.service';
import { Observable, throwError, switchMap, take, catchError, map, forkJoin, of } from 'rxjs';
import { environment } from 'environments/environment';
import { Agent, AgentProfile, WalletCreationResponse, DIDIssuanceResponse, VCCreationResponse, VCIssuancePayload, AgentListItem } from './agent.interfaces';
import { AgentStatus, AgentVcIssueStatus, AgentType, AgentCategory } from './agent.enums'; // Assuming these enums are available
import { User } from 'app/core/user/user.types';
import { AccountBalanceResponse } from 'app/core/user/user.interfaces';

@Injectable({ providedIn: 'root' })
export class AgentService {
    private _httpClient = inject(HttpClient);
    private _userService = inject(UserService);
    private _apiBaseUrl = environment.apiBaseUrl;

    private _fetchAgentAccountBalance(accountId: string): Observable<number | null> {
        if (!accountId) {
            return of(null);
        }
        return this._httpClient.get<AccountBalanceResponse>(`${this._apiBaseUrl}balance/${accountId}?isHbar=true`, { withCredentials: true }).pipe(
            map(response => response?.balances?.[0]?.balance || null),
            catchError((err) => {
                console.warn(`[AgentService] _fetchAgentAccountBalance: Could not fetch HBAR balance for account ${accountId}.`, err);
                return of(null);
            }),
        );
    }

    // Helper to create a default AgentProfile structure
    private _createDefaultAgentProfile(accountId: string, basicAgentInfo?: Partial<Agent>): AgentProfile {
        // IMPORTANT: Replace these enum placeholders with actual valid members from your enums
        // e.g., AgentCategory.OTHER, AgentStatus.UNKNOWN, etc.
        return {
            agentAccountId: accountId,
            agentName: 'no profile found',
            purpose: basicAgentInfo?.purpose || 'N/A',
            status: AgentStatus.OFFLINE, // Replace with actual enum member e.g. AgentStatus.UNKNOWN
            vcIssueStatus: AgentVcIssueStatus.PENDING, // Replace e.g. AgentVcIssueStatus.UNKNOWN or NONE
            agentType: AgentType.OTHER, // Replace e.g. AgentType.OTHER
            agentCategory: AgentCategory.AUTOMATION, // Replace e.g. AgentCategory.OTHER
            agentDid: 'N/A',
            agentOwnerDID: 'N/A',
            agentDescription: 'No detailed profile available.',
            url: '',
            capability: [],
            inboundTopicId: '',
            outboundTopicId: '',
            communicationTopicId: '',
            registryTopicSeq: null,
        };
    }

    /**
     * Get agents for the authenticated user, enrich them with full profiles and balances.
     * Returns AgentListItem which combines AgentProfile with account balance.
     */
    getAgents(): Observable<AgentListItem[]> {
        return this._userService.user$.pipe(
            take(1),
            switchMap((user: User) => {
                if (!user || !user.username) {
                    console.error('[AgentService] User username is not available to fetch agents.');
                    return throwError(() => 'User username not available for API path');
                }
                const owner = user.username;
                return this._httpClient.get<Agent[]>(`${this._apiBaseUrl}wallets/${owner}/agents`, { withCredentials: true });
            }),
            switchMap((basicAgents: Agent[]) => {
                if (!basicAgents || basicAgents.length === 0) {
                    return of([]);
                }
                const agentDetailObservables = basicAgents.map(basicAgent => {
                    const accountId = basicAgent.account.id;
                    if (!accountId) {
                        // Should ideally not happen if basicAgent structure is consistent
                        console.warn('[AgentService] Agent missing account ID:', basicAgent);
                        const defaultProfile = this._createDefaultAgentProfile('N/A', basicAgent);
                        return of({
                            ...defaultProfile,
                            account: { id: 'N/A', balance: null }
                        } as AgentListItem);
                    }

                    return forkJoin({
                        profile: this.getAgentProfileById(accountId, basicAgent), // Pass basicAgent for fallback purpose
                        balance: this._fetchAgentAccountBalance(accountId)
                    }).pipe(
                        map(({ profile, balance }) => {
                            // profile is guaranteed to be AgentProfile (either real or default)
                            return {
                                ...profile,
                                account: {
                                    id: profile.agentAccountId, // from profile
                                    balance: balance
                                }
                            } as AgentListItem;
                        }),
                        catchError((err) => {
                            // Fallback if forkJoin fails for an individual agent
                            console.error(`[AgentService] Error processing agent ${accountId} details:`, err);
                            const defaultProfile = this._createDefaultAgentProfile(accountId, basicAgent);
                            return of({
                                ...defaultProfile,
                                account: { id: accountId, balance: null }
                            } as AgentListItem);
                        })
                    );
                });
                return forkJoin(agentDetailObservables);
            }),
            catchError(err => {
                console.error('[AgentService] Error fetching or processing agents with profiles and balances:', err);
                return throwError(() => err); // Or return of([]) to gracefully handle in component
            })
        );
    }

    /**
     * Get a single agent by its ID (now returns AgentListItem)
     * @param agentId The _id of the agent to fetch (from the initial wallets/owner/agents call)
     */
    getAgentById(agentId: string): Observable<AgentListItem | null> {
        // This method might need rethinking if it's meant to find one from the full list.
        // For now, assuming it fetches all and then filters.
        return this.getAgents().pipe(
            map(agentsListItems => {
                // We need to find by an ID. AgentListItem doesn't have _id unless we add it.
                // Let's assume for now we want to find by agentAccountId if agentId is an accountId.
                // If agentId is the original basicAgent._id, this won't work directly without _id on AgentListItem.
                // For simplicity, if agentId is expected to be agentAccountId:
                return agentsListItems.find(item => item.agentAccountId === agentId) || null;
                // If agentId is the original _id, you'd need to add _id to AgentListItem
                // and modify the source of agentId or how it's used.
            }),
            catchError(err => {
                console.error(`[AgentService] Error fetching agentListItem by ID ${agentId}:`, err);
                return of(null);
            })
        );
    }

    /**
     * Get detailed agent profile by Account ID.
     * Now returns a guaranteed AgentProfile (real or default).
     * @param agentAccountId The account ID of the agent
     * @param basicAgentInfo Optional basic agent info for fallback purpose
     */
    getAgentProfileById(agentAccountId: string, basicAgentInfo?: Partial<Agent>): Observable<AgentProfile> {
        if (!agentAccountId) {
            return of(this._createDefaultAgentProfile(agentAccountId || 'N/A', basicAgentInfo));
        }
        return this._httpClient.get<AgentProfile>(`${this._apiBaseUrl}agent-profile/${agentAccountId}`, { withCredentials: true }).pipe(
            catchError((err) => {
                console.warn(`[AgentService] getAgentProfileById: Could not fetch profile for ${agentAccountId}. Status: ${err.status}. Returning default.`);
                return of(this._createDefaultAgentProfile(agentAccountId, basicAgentInfo));
            })
        );
    }

    /**
     * Create a new agent (original method, returns basic Agent)
     * @param agentData The data for the new agent
     */
    createAgent(agentData: Partial<Agent>): Observable<Agent> {
        return this._userService.user$.pipe(
            take(1),
            switchMap((user: User) => {
                if (!user || !user.username) {
                    console.error('[AgentService] User username is not available to create an agent.');
                    return throwError(() => 'User username not available for API path');
                }
                const owner = user.username;
                // This creates the basic agent wallet.
                return this._httpClient.post<Agent>(`${this._apiBaseUrl}wallets/${owner}/agents`, agentData, { withCredentials: true });
            }),
            catchError(err => {
                console.error('[AgentService] Error creating agent:', err);
                return throwError(() => err);
            })
        );
    }

    createWalletExternal(): Observable<WalletCreationResponse> {
        const url = `${this._apiBaseUrl}wallets?createDid=false`;
        const payload = { type: 'agent' };
        return this._httpClient.post<WalletCreationResponse>(url, payload, { withCredentials: true }).pipe(
            catchError(err => {
                console.error('[AgentService] Error creating wallet (external API):', err);
                return throwError(() => err);
            })
        );
    }

    issueDID(accountId: string): Observable<DIDIssuanceResponse> {
        return this._httpClient.post<DIDIssuanceResponse>(`${this._apiBaseUrl}identities/${accountId}`, {}, { withCredentials: true }).pipe(
            catchError(err => {
                console.error(`[AgentService] Error issuing DID for account ${accountId}:`, err);
                return throwError(() => err);
            })
        );
    }

    // createAgentProfile now takes full AgentProfile for consistency, though API might only need partial
    createAgentProfile(accountId: string, profileData: AgentProfile): Observable<AgentProfile> {
        return this._httpClient.post<AgentProfile>(`${this._apiBaseUrl}agent-profile?agentAccountId=${accountId}`, profileData, { withCredentials: true }).pipe(
            catchError(err => {
                console.error(`[AgentService] Error creating agent profile for account ${accountId}:`, err);
                return throwError(() => err);
            })
        );
    }

    issueVC(accountId: string, vcPayload: VCIssuancePayload): Observable<VCCreationResponse> {
        return this._httpClient.post<VCCreationResponse>(`${this._apiBaseUrl}identities/credentials/${accountId}`, vcPayload, { withCredentials: true }).pipe(
            catchError(err => {
                console.error(`[AgentService] Error issuing VC for account ${accountId}:`, err);
                return throwError(() => err);
            })
        );
    }

    updateAgent(agentId: string, agentData: Partial<Agent>): Observable<Agent> {
         return this._userService.user$.pipe(
            take(1),
            switchMap((user: User) => {
                if (!user || !user.username) {
                    console.error('[AgentService] User username is not available to update an agent.');
                    return throwError(() => 'User username not available for API path');
                }
                const owner = user.username;
                return this._httpClient.put<Agent>(`${this._apiBaseUrl}wallets/${owner}/agents/${agentId}`, agentData, { withCredentials: true });
            }),
            catchError(err => {
                console.error(`[AgentService] Error updating agent ${agentId}:`, err);
                return throwError(() => err);
            })
        );
    }
}
