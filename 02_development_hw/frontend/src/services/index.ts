import { createHttpService } from "./http";
import type { KanbanService } from "./types";

export * from "./types";

let instance: KanbanService | null = null;

/**
 * The one entry point for every backend call.
 */
export function getService(): KanbanService {
  if (!instance) instance = createHttpService();
  return instance;
}

export function setService(s: KanbanService) {
  instance = s;
}
