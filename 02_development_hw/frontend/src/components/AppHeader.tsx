import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getService, type User } from "@/services";

export function AppHeader({ user }: { user: User }) {
  const qc = useQueryClient();
  return (
    <header className="flex items-center justify-between border-b bg-card/60 px-6 py-3">
      <Link to="/" className="font-display text-xl font-bold tracking-tight">
        Mini<span className="text-primary">Kanban</span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{user.name}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await getService().logout();
            await qc.resetQueries();
          }}
        >
          Log out
        </Button>
      </div>
    </header>
  );
}
