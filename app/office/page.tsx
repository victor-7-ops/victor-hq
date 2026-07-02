"use client";

import { useState } from "react";
import { useAgents, useGateway } from "@/hooks/useAgentData";
import { OfficeFloor } from "@/components/office/OfficeFloor";
import AgentDetail from "@/components/fleet/AgentDetail";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";

export default function OfficePage() {
  const { data, isLoading, error } = useAgents();
  const { data: gateway } = useGateway();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-lg border border-rose-700/40 bg-rose-500/10 p-4 text-rose-300">
          Failed to load agent data.
        </div>
      </div>
    );
  }

  const selectedAgent = data.agents.find((a) => a.id === selectedAgentId) ?? null;

  return (
    <div className="flex min-h-screen bg-slate-950">
      <div className="flex-1">
        <OfficeFloor
          agents={data.agents}
          onAgentClick={(agentId) => setSelectedAgentId(agentId)}
        />
      </div>
      {selectedAgent && (
        <div className="w-96 shrink-0 border-l border-slate-800">
          <AgentDetail agent={selectedAgent} gateway={gateway} />
        </div>
      )}
    </div>
  );
}
