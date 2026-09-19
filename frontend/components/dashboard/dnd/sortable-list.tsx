"use client"
import type { ReactNode } from "react"
import type { DragEndEvent } from "@dnd-kit/core"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DragHandle } from "./drag-handle"

interface SortableRowProps {
  id: string
  children: (handle: ReactNode) => ReactNode
}

function SortableRow({ id, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const handle = (
    <button
      {...listeners}
      {...attributes}
      className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] transition-opacity"
      aria-label="drag to reorder"
      type="button"
    >
      <DragHandle />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group"
    >
      {children(handle)}
    </div>
  )
}

interface SortableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (next: T[]) => void
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function onDragEnd(e: DragEndEvent) {
    const over = e.over
    if (!over || e.active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === e.active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    onReorder(arrayMove(items, oldIdx, newIdx))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-[var(--rule-default)]">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
