// DraggableStop.tsx
// Displays a single draggable stop item for the stops list

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";

export default function DraggableStop({ stop, index, id, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
    cursor: 'grab',
    zIndex: isDragging ? 100 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      className={`flex items-center justify-between bg-gray-50 rounded px-3 py-2 border border-gray-200 mb-1 shadow-sm transition-all duration-200 ${isDragging ? 'scale-105 shadow-lg bg-blue-50 z-10' : ''}`}
      {...attributes}
      {...listeners}
      style={style}
    >
      <div>
        <div className="font-semibold text-base text-gray-900 flex items-center gap-2">
          <span className="cursor-grab select-none text-gray-400">&#9776;</span>
          <span>{index + 1}.</span> {stop.name}
        </div>
        <div className="text-xs text-gray-500">Lat: {stop.latitude}, Lng: {stop.longitude}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}
