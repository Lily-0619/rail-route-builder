import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePlanner } from "../state/store";
import type { StopPlan } from "../types";

function roleLabel(index: number, count: number): string {
  if (index === 0) return "出発";
  if (index === count - 1) return "到着";
  return "経由";
}

function StopCard(props: { stop: StopPlan; index: number; count: number }) {
  const { stop, index, count } = props;
  const removeStop = usePlanner((s) => s.removeStop);
  const moveStop = usePlanner((s) => s.moveStop);
  const setStay = usePlanner((s) => s.setStay);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const isIntermediate = index > 0 && index < count - 1;

  return (
    <li
      ref={setNodeRef}
      className={`stop-card${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button className="drag-handle" {...attributes} {...listeners} aria-label="ドラッグして並べ替え">
        ⠿
      </button>
      <div className="stop-main">
        <div className="stop-head">
          <span className={`role role-${index === 0 ? "start" : index === count - 1 ? "goal" : "via"}`}>
            {roleLabel(index, count)}
          </span>
          <span className="stop-name">{stop.station.name}</span>
        </div>
        <div className="stop-sub">{stop.station.secondaryText}</div>
        {isIntermediate && (
          <label className="stay-field">
            この駅で
            <input
              type="number"
              min={0}
              max={1440}
              step={5}
              value={stop.stayMinutes}
              onChange={(e) => setStay(stop.id, Number(e.target.value))}
            />
            分
          </label>
        )}
      </div>
      <div className="stop-actions">
        <button
          className="btn mini"
          disabled={index === 0}
          onClick={() => moveStop(stop.id, -1)}
          aria-label="上へ移動"
        >
          ▲
        </button>
        <button
          className="btn mini"
          disabled={index === count - 1}
          onClick={() => moveStop(stop.id, 1)}
          aria-label="下へ移動"
        >
          ▼
        </button>
        <button className="btn mini danger" onClick={() => removeStop(stop.id)} aria-label="削除">
          🗑
        </button>
      </div>
    </li>
  );
}

export default function StopList() {
  const stops = usePlanner((s) => s.stops);
  const reorderStops = usePlanner((s) => s.reorderStops);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderStops(String(active.id), String(over.id));
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">🧭 駅の並び（{stops.length}/10）</h2>
      {stops.length === 0 ? (
        <p className="hint">上の検索から駅を追加してください。</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="stop-list">
              {stops.map((stop, i) => (
                <StopCard key={stop.id} stop={stop} index={i} count={stops.length} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
