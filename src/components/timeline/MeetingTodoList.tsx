import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useMeetingTodos } from "@/hooks/useMeetingTodos";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, CalendarPlus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddMeetingDialog } from "./AddMeetingDialog";

export function MeetingTodoList() {
  const { user } = useAuth();
  const { todos, isLoading, createTodo, toggleTodo, deleteTodo } = useMeetingTodos();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [convertTodo, setConvertTodo] = useState<any>(null);

  const handleAdd = () => {
    if (!title.trim() || !user) return;
    createTodo.mutate({
      title: title.trim(),
      description: description.trim(),
      created_by: user.id,
    });
    setTitle("");
    setDescription("");
    setShowForm(false);
  };

  const pendingTodos = todos.filter((t) => !t.is_completed);
  const completedTodos = todos.filter((t) => t.is_completed);

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">📋 To-Do List (Tentatif)</h3>
              <Badge variant="secondary" className="text-xs">
                {pendingTodos.length}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3.5 h-3.5" />
              Tambah
            </Button>
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-xs">Judul *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Judul meeting tentatif..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div>
                <Label className="text-xs">Deskripsi (opsional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setTitle("");
                    setDescription("");
                  }}
                >
                  Batal
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={!title.trim()}>
                  Simpan
                </Button>
              </div>
            </div>
          )}

          {/* Pending List */}
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Memuat...</p>
          ) : pendingTodos.length === 0 && !showForm ? (
            <p className="text-xs text-muted-foreground text-center py-4">Belum ada to-do tentatif</p>
          ) : (
            <div className="space-y-2">
              {pendingTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo.mutate({ id: todo.id, is_completed: true })}
                  onDelete={() => deleteTodo.mutate(todo.id)}
                  onConvert={() => setConvertTodo(todo)}
                />
              ))}
            </div>
          )}

          {/* Completed Section */}
          {completedTodos.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Selesai ({completedTodos.length})
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2">
                  {completedTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => toggleTodo.mutate({ id: todo.id, is_completed: false })}
                      onDelete={() => deleteTodo.mutate(todo.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convert to Meeting Dialog */}
      <AddMeetingDialog
        open={!!convertTodo}
        onOpenChange={(open) => {
          if (!open) setConvertTodo(null);
        }}
        defaultDate={format(new Date(), "yyyy-MM-dd")}
        defaultTitle={convertTodo?.title}
        defaultDescription={convertTodo?.description}
        onCreated={(meetingId) => {
          if (convertTodo && meetingId) {
            // Mark as converted - we don't have markConverted exposed simply, so just toggle
            toggleTodo.mutate({ id: convertTodo.id, is_completed: true });
          }
          setConvertTodo(null);
        }}
      />
    </>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
  onConvert,
}: {
  todo: any;
  onToggle: () => void;
  onDelete: () => void;
  onConvert?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-colors",
        todo.is_completed && "bg-muted/40 opacity-70",
      )}
    >
      <Checkbox checked={todo.is_completed} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={cn("text-sm font-medium", todo.is_completed && "line-through text-muted-foreground")}>
          {todo.title}
        </p>
        {todo.description && <p className="text-xs text-muted-foreground">{todo.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={todo.is_completed ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
            {todo.is_completed ? "Selesai" : "Tentatif"}
          </Badge>
          {todo.converted_meeting_id && (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">Dijadwalkan</Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(todo.created_at), "d MMM yyyy", { locale: localeId })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!todo.is_completed && onConvert && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Jadwalkan sebagai Meeting" onClick={onConvert}>
            <CalendarPlus className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
