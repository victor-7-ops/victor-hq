// Tech Radar Data — Demo/example entries
// These are replaced by your agents' real-time tech update feeds

export interface TechSignal {
  id: string;
  date: string;
  category: "ai-models" | "agent-orchestration" | "frontend-tooling" | "knowledge-graphs" | "dev-tools" | "security";
  title: string;
  summary: string;
  source: string;
  url: string;
  relevance: number;
  tags: string[];
}

// Example entries — your agents will populate this with real data
export const techSignals: TechSignal[] = [];

export default techSignals;
