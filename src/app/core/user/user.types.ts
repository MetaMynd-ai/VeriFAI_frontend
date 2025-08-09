import { BalanceEntry } from './user.interfaces'; // Import BalanceEntry

export interface User {
    id: string;
    name: string; // This will be the display name (from tags if available, else username)
    username: string; // This will store the actual username for API calls etc.
    email: string;
    avatar?: string;
    status?: string;
    accountId?: string; // To store the wallet ID (e.g., "0.0.6096367")
    hbarBalance?: number; // To store HBAR balance from the new endpoint
    // balance?: any[]; // Previous balance field, consider removing or repurposing if WalletInfo.balance.tokens is for other assets
}
