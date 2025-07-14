export interface ApiUser {
    _id: string;
    email: string;
    username: string;
    confirmed: boolean;
    type: string;
    role: string;
    banned: boolean;
    tags: string[]; // Changed from Array<{ key: string; value: string }>
    avatar?: string;
    status?: string;
    twoFactorAuth: {
        status: string;
        factorSid: string;
        identity: string;
        qr_code: string;
    };
    created_at: string;
    updated_at: string;
    createdAt: string;
    updatedAt: string;
    __v?: number;
}

// AuthResponse has been moved to auth.service.ts
// export interface AuthResponse {
// user: ApiUser;
// accessToken: string;
// }

export interface WalletBalance {
    tokens: any[]; // You might want to define a more specific type if you know the token structure
    links: {
        next: string | null;
    };
}

export interface WalletInfo {
    id: string; // This is the accountId, e.g., \"0.0.6096367\"
    balance: WalletBalance; // This might be for other tokens, not HBAR specific
    transactions: any[]; // Define more specific type if needed
}

export interface BalanceEntry {
    account: string;
    balance: number; // The actual HBAR balance
}

export interface AccountBalanceResponse {
    timestamp: string;
    balances: BalanceEntry[];
}
