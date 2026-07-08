'use client';
import { useQuery } from '@tanstack/react-query';
import type { Agent } from '@/lib/types';
import { fetchConversation, type StoredMessage } from '@/lib/conversations';

export interface ServerConversation {
  agentId: string;
  messages: StoredMessage[];
}

/**
 * Fetches each agent's server-stored conversation history via react-query.
 * Caching/dedup is handled by react-query; the chat page merges the result
 * into its local (localStorage-backed) conversation state, which stays the
 * source of truth for in-flight SSE streaming updates.
 */
export function useServerConversations(agents: Agent[]) {
  const agentIds = agents.map((a) => a.id);

  return useQuery<ServerConversation[]>({
    queryKey: ['conversations', agentIds],
    queryFn: async () => {
      return Promise.all(
        agents.map(async (agent) => ({
          agentId: agent.id,
          messages: await fetchConversation(agent.id),
        })),
      );
    },
    enabled: agentIds.length > 0,
    staleTime: 30_000,
  });
}
