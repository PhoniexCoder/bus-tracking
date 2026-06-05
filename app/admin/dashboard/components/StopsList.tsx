// StopsList.tsx
// Renders the list of stops for a bus, with drag-and-drop and ETA


import React from "react";
import DraggableStop from "./DraggableStop";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

export function StopsList({
  stops,
  overview,
  deleteStopFromBus,
  estimateTimeToStop,
  sensors,
  busId // Add busId prop
}: any) {
  // Handler to update order in parent (if needed, can be passed as prop)
  // For now, just render the stops list with drag-and-drop and ETA
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}>
      <SortableContext items={stops.map((_: any, idx: number) => idx.toString())} strategy={verticalListSortingStrategy}>
        <ul className="mb-2 space-y-2">
          {stops.length === 0 && <li className="text-sm text-[#a3b8cc]/40 italic py-2 text-center">No stops configured</li>}
          {stops.map((stop: any, i: number) => (
            <div className="flex items-center justify-between gap-2" key={i}>
              <DraggableStop
                id={i.toString()}
                stop={stop}
                index={i}
                onDelete={() => deleteStopFromBus(i)}
              />
              {overview.status.mlat && overview.status.mlng && (
                <span className="text-xs text-[#0a84ff] font-semibold whitespace-nowrap ml-2 bg-[#0a84ff]/10 px-2 py-1 rounded-md border border-[#0a84ff]/20">
                  ETA: {estimateTimeToStop(
                    parseFloat(overview.status.mlat),
                    parseFloat(overview.status.mlng),
                    Number(stop.latitude),
                    Number(stop.longitude)
                  )} min
                </span>
              )}
            </div>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
