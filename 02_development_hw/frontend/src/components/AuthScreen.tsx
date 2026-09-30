import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getService } from "@/services";

export function AuthScreen() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@kanban.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const api = getService();
      if (mode === "login") await api.login({ email, password });
      else await api.register({ name, email, password });
      await qc.resetQueries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Mini<span className="text-primary">Kanban</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Create, organize, assign, and move tasks.</p>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "No account? Register" : "Have an account? Log in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo accounts: demo@, alex@, sam@kanban.dev · password demo1234
        </p>
      </div>
    </main>
  );
}
