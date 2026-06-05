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
    boxShadow: isDragging ? '0 8px 32px rgba(94, 92, 230, 0.2)' : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      className={`flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/5 mb-1 shadow-sm transition-all duration-200 ${isDragging ? 'scale-105 shadow-lg bg-[#112131] border-[#5e5ce6]/40 z-10' : 'hover:bg-white/10'}`}
      {...attributes}
      {...listeners}
      style={style}
    >
      <div>
        <div className="font-semibold text-sm text-white flex items-center gap-2">
          <span className="cursor-grab select-none text-white/40 hover:text-white">&#9776;</span>
          <span className="text-[#a3b8cc]">{index + 1}.</span> {stop.name}
        </div>
        <div className="text-[10px] text-[#a3b8cc]/60 font-mono mt-0.5">Lat: {stop.latitude}, Lng: {stop.longitude}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={onDelete}
          className="h-7 px-3 bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg text-xs"
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
