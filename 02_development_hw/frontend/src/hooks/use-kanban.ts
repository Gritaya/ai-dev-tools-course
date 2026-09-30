import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getService } from "@/services";

export const qk = {
  me: ["me"] as const,
  boards: ["boards"] as const,
  board: (id: string) => ["board", id] as const,
};

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => getService().getCurrentUser() });
}

/** Mutation helper: runs a service call, toasts errors, refetches given keys. */
export function useAction<A>(fn: (a: A) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}
