import { AgentStatus, AgentVcIssueStatus, AgentType, AgentCategory, AgentCapability } from './agent.enums';

export interface AgentUIState {
  data: Agent;
  isExpanded?: boolean;
  details?: AgentProfile;
  loading?: boolean;
}


export interface AgentBalance {
    balance: number;
    tokens: any[]; // Define more specifically if token structure is known
}

export interface AgentProfile {
    status: AgentStatus;
    vcIssueStatus: AgentVcIssueStatus;
    agentType: AgentType;
    agentCategory: AgentCategory;
    agentAccountId: string;
    agentName: string;
    agentDid: string;
    agentOwnerDID: string;
    agentDescription: string;
    purpose: string;
    url: string;
    capability: AgentCapability[];
    inboundTopicId: string;
    outboundTopicId: string;
    communicationTopicId: string;
    registryTopicSeq: string | null;
}

export interface Agent {
  _id: string;
  agentName?: string;
  purpose?: string;
  owner: string;
  type: string;
  account: {
    id: string;
    balance: number | null;
  };
  transactions: any[]; // You can define a more specific type if the structure of transactions is known
  __v: number;
}

// Interfaces for the new agent creation flow
export interface WalletCreationResponse {
    wallet: {
        owner: string;
        type: string;
        account: {
            id: string;
            balance: number | null;
        };
        transactions: any[];
        _id: string;
        __v: number;
    };
    did: any; // null or object, adjust as needed
}

export interface DIDIssuanceResponse {
    owner: string;
    did_id: string;
    credentials: any[];
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
}

export interface VCIssuancePayload {
    base64metadata: string;
}

export interface VCCreationResponse {
    owner: string;
    issuer: string;
    file_id: string;
    file_index: number;
    serial_number: string;
    iv: string;
    internal_status: string;
    chain_status: string;
    expiration_date: string; // ISO date string
}

// Define AgentListItem (or ensure it's imported if defined in agent.interfaces.ts)
export interface AgentListItem extends AgentProfile {
  account: {
    id: string;
    balance: number | null;
  };
}
