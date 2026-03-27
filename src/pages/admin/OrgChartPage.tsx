import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { buildTree } from "@/lib/org-chart";

type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  manager_id: string | null;
};

function initialsFromName(first: string | null, last: string | null) {
  const full = `${first ?? ""} ${last ?? ""}`.trim();
  if (!full) return "—";
  return full
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function OrgChartPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, manager_id");

      if (error) {
        console.error("OrgChart fetch error:", error);
        setEmployees([]);
        return;
      }

      setEmployees((data ?? []) as EmployeeRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  const tree = useMemo(() => buildTree(employees), [employees]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!editMode) return;

      const { active, over } = event;
      if (!over) return;

      const draggedId = String(active.id);
      const newManagerId = String(over.id);
      if (!draggedId || !newManagerId) return;
      if (draggedId === newManagerId) return;

      // Prevent cycles: disallow setting manager_id to a descendant of the dragged node.
      const childrenById = new Map<string, string[]>();
      for (const e of employees) {
        if (!e.manager_id) continue;
        const mid = String(e.manager_id);
        const cid = String(e.id);
        const arr = childrenById.get(mid) ?? [];
        arr.push(cid);
        childrenById.set(mid, arr);
      }

      const descendants = new Set<string>();
      const stack = [draggedId];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur) continue;
        const kids = childrenById.get(cur) ?? [];
        for (const k of kids) {
          if (descendants.has(k)) continue;
          descendants.add(k);
          stack.push(k);
        }
      }

      if (descendants.has(newManagerId)) return;

      await supabase.from("employees").update({ manager_id: newManagerId }).eq("id", draggedId);
      await fetchEmployees();
    },
    [editMode, employees, fetchEmployees],
  );

  const OrgNodeCard = useCallback(
    function OrgNodeCardInternal({ node, level = 0 }: { node: any; level?: number }) {
      const nodeId = String(node.id);
      const fullName = `${node.first_name ?? ""} ${node.last_name ?? ""}`.trim() || nodeId;
      const position = node.position ?? "—";

      const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        transition,
        isDragging,
      } = useDraggable({ id: nodeId, disabled: !editMode });

      const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: nodeId });

      const setNodeRef = (el: HTMLElement | null) => {
        setDraggableNodeRef(el);
        setDroppableNodeRef(el);
      };

      const style: React.CSSProperties | undefined = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            transition,
          }
        : undefined;

      return (
        <div className="flex flex-col items-center">
          <Card
            ref={setNodeRef}
            className={[
              "border-0 shadow-sm w-48 text-center",
              editMode ? "cursor-grab select-none" : "cursor-default select-none",
              editMode && isOver ? "ring-2 ring-primary" : "",
            ].join(" ")}
            style={{
              ...style,
              opacity: isDragging ? 0.4 : 1,
              animation: `fade-up 0.5s cubic-bezier(0.16,1,0.3,1) ${level * 100}ms forwards`,
            }}
            {...(editMode ? attributes : {})}
            {...(editMode ? listeners : {})}
          >
            <CardContent className="p-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary mx-auto mb-2">
                {initialsFromName(node.first_name, node.last_name)}
              </div>
              <p className="font-semibold text-sm">{fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{position}</p>
            </CardContent>
          </Card>

          {Array.isArray(node.children) && node.children.length > 0 && (
            <>
              <div className="w-px h-6 bg-border" />
              <div className="flex gap-4 relative">
                {node.children.length > 1 && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border"
                    style={{ width: `calc(100% - 12rem)` }}
                  />
                )}
                {node.children.map((child: any) => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <OrgNodeCardInternal node={child} level={level + 1} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    },
    [editMode],
  );

  const OrgNodeCardInternal = OrgNodeCard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Organization Chart</h1>
        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={() => setEditMode(v => !v)}
        >
          {editMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading organization chart…</div>
      ) : tree.length === 0 ? (
        <div className="text-muted-foreground">No employees found.</div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-8">
            <div className="min-w-[600px] flex justify-center pt-4">
              <div className="flex gap-4 relative">
                {tree.map((node: any) => (
                  <div key={node.id} className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <OrgNodeCardInternal node={node} level={0} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
}
