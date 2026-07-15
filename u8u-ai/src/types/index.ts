import type { Agent, Lead, Message } from '@prisma/client';

export interface AgentContext {
  agent: Agent;
  lead?: Lead | null;
  conversationHistory: Message[];
  channel: 'chat' | 'email' | 'voice';
  sessionId?: string;
}

export interface AgentResponse {
  message: string;
  shouldQualify?: boolean;
  shouldBookMeeting?: boolean;
  shouldEscalate?: boolean;
  toolCalls?: ToolCall[];
  leadUpdates?: Partial<Lead>;
  quickActions?: QuickAction[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface QuickAction {
  id: string;
  label: string;
  action: string;
}

export interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalConversations: number;
  meetingsBooked: number;
}

export type { Agent, Lead, Message } from '@prisma/client';