import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Priority, Task, TaskInput, User } from "@/services";

const NONE = "";

export function TaskDialog({
  open,
  onOpenChange,
  task,
  columnId,
  members,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  columnId: string;
  members: User[];
  onSave: (input: TaskInput) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(NONE);
  const [priority, setPriority] = useState(NONE);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setAssigneeId(task?.assigneeId ?? NONE);
    setPriority(task?.priority ?? NONE);
    setDueDate(task?.dueDate ?? "");
  }, [open, task]);

  const select = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form
          id="task-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onSave({
              title,
              description,
              columnId: task?.columnId ?? columnId,
              assigneeId: assigneeId || null,
              priority: (priority || null) as Priority | null,
              dueDate: dueDate || null,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-assignee">Assignee</Label>
              <select id="t-assignee" className={select} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value={NONE}>Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-priority">Priority</Label>
              <select id="t-priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value={NONE}>None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button variant="destructive" onClick={onDelete}>Delete</Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="task-form">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
