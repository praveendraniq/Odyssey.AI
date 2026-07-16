import { randomUUID } from 'node:crypto';

export type SpecialistAgentId =
  | 'voice-preference'
  | 'travel-inventory'
  | 'itinerary-route'
  | 'live-operations'
  | 'commerce'
  | 'travel-dna';

export type AgentRunStatus = 'running' | 'completed' | 'failed';

export interface AgentDefinition {
  id: 'journey-coordinator' | SpecialistAgentId;
  name: string;
  role: string;
  tools: string[];
}

export interface AgentStep {
  id: string;
  agentId: SpecialistAgentId;
  agentName: string;
  task: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  outputSummary?: string;
  error?: string;
}

export interface AgentRun {
  id: string;
  intent: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt?: string;
  steps: AgentStep[];
}

export const coordinatorAgent: AgentDefinition = {
  id: 'journey-coordinator',
  name: 'Journey Orchestrator',
  role: 'Breaks a travel goal into specialist tasks, coordinates dependencies, and merges the results.',
  tools: ['Task routing', 'Shared trip context', 'Decision trace'],
};

export const specialistAgents: AgentDefinition[] = [
  {
    id: 'voice-preference',
    name: 'Voice & Preference Agent',
    role: 'Turns a natural conversation into a structured trip brief and group preferences.',
    tools: ['Vocal Bridge', 'Intent extraction', 'Conflict resolution'],
  },
  {
    id: 'travel-inventory',
    name: 'Travel Inventory Agent',
    role: 'Searches, normalizes, and ranks flight and hotel inventory.',
    tools: ['Sabre flights', 'Sabre hotels', 'Offer ranking'],
  },
  {
    id: 'itinerary-route',
    name: 'Itinerary & Route Agent',
    role: 'Builds the daily sequence around geography, timing, and opening windows.',
    tools: ['Route optimizer', 'Time windows', 'Transit buffers'],
  },
  {
    id: 'live-operations',
    name: 'Live Operations Agent',
    role: 'Understands delays, weather, closures, and fatigue before requesting a route patch.',
    tools: ['Disruption analysis', 'Weather impact', 'Change explanation'],
  },
  {
    id: 'commerce',
    name: 'Commerce Agent',
    role: 'Keeps the trip budget current, prepares split payments, and reads receipts.',
    tools: ['PayPal', 'Landing AI receipt OCR', 'Budget ledger'],
  },
  {
    id: 'travel-dna',
    name: 'Travel DNA Agent',
    role: 'Learns group behavior and carries preferences into the next decision.',
    tools: ['Preference scoring', 'Group model', 'Personalization'],
  },
];

class SpecialistAgent {
  constructor(readonly definition: AgentDefinition & { id: SpecialistAgentId }) {}

  execute<T>(operation: () => Promise<T> | T): Promise<T> {
    return Promise.resolve().then(operation);
  }
}

class AgentRunContext {
  private finished = false;

  constructor(
    private readonly coordinator: JourneyAgentCoordinator,
    private readonly run: AgentRun,
  ) {}

  async delegate<T>(
    agentId: SpecialistAgentId,
    task: string,
    operation: () => Promise<T> | T,
    summarize?: (result: T) => string,
  ): Promise<T> {
    const agent = this.coordinator.getSpecialist(agentId);
    const start = Date.now();
    const step: AgentStep = {
      id: `task_${randomUUID().slice(0, 8)}`,
      agentId,
      agentName: agent.definition.name,
      task,
      status: 'running',
      startedAt: new Date(start).toISOString(),
    };
    this.run.steps.push(step);

    try {
      const result = await agent.execute(operation);
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.durationMs = Date.now() - start;
      step.outputSummary = summarize?.(result);
      return result;
    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      step.durationMs = Date.now() - start;
      step.error = error instanceof Error ? error.message : 'Specialist task failed';
      this.finish('failed');
      throw error;
    }
  }

  complete(): AgentRun {
    return this.finish('completed');
  }

  private finish(status: Exclude<AgentRunStatus, 'running'>): AgentRun {
    if (!this.finished) {
      this.finished = true;
      this.run.status = status;
      this.run.completedAt = new Date().toISOString();
      this.coordinator.record(this.run);
    }
    return structuredClone(this.run);
  }
}

/**
 * Lightweight, deterministic multi-agent runtime for the MVP. The coordinator
 * delegates real service/store operations to tool-backed specialist objects and
 * records every handoff. Specialist implementations can later swap in model
 * calls without changing route contracts or the Agent Activity UI.
 */
export class JourneyAgentCoordinator {
  private readonly specialists = new Map<SpecialistAgentId, SpecialistAgent>();
  private readonly recentRuns: AgentRun[] = [];

  constructor() {
    for (const definition of specialistAgents) {
      const specialistDefinition = definition as AgentDefinition & { id: SpecialistAgentId };
      this.specialists.set(specialistDefinition.id, new SpecialistAgent(specialistDefinition));
    }
  }

  start(intent: string): AgentRunContext {
    return new AgentRunContext(this, {
      id: `run_${randomUUID().slice(0, 8)}`,
      intent,
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: [],
    });
  }

  getSpecialist(agentId: SpecialistAgentId): SpecialistAgent {
    const agent = this.specialists.get(agentId);
    if (!agent) throw new Error(`Unknown JourneyOS agent: ${agentId}`);
    return agent;
  }

  record(run: AgentRun) {
    this.recentRuns.unshift(run);
    this.recentRuns.splice(12);
  }

  snapshot() {
    return {
      totalAgents: 1 + specialistAgents.length,
      coordinator: coordinatorAgent,
      specialists: specialistAgents,
      recentRuns: structuredClone(this.recentRuns),
    };
  }
}
