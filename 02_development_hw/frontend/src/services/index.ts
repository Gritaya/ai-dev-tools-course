import { browserStore, createMockService } from "./mock";
import type { KanbanService } from "./types";

export * from "./types";

let instance: KanbanService | null = null;

/**
 * The one entry point for every backend call. Swap the mock for a real
 * HTTP implementation of KanbanService here without touching the UI.
 */
export function getService(): KanbanService {
  if (!instance) instance = createMockService({ store: browserStore(), latencyMs: 120, seed: true });
  return instance;
}

export function setService(s: KanbanService) {
  instance = s;
}
