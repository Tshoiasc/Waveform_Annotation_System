import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AnnotationPhase } from '../types/waveform'

interface SortablePhaseItemProps {
  phase: AnnotationPhase
  index: number
  onEdit: (phase: AnnotationPhase) => void
  onDelete: (id: string) => void
}

function SortablePhaseItem({ phase, index, onEdit, onDelete }: SortablePhaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: phase.id,
    data: { type: 'sequence-phase', phase }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 rounded-md border border-gray-200 bg-white shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold text-sm cursor-grab hover:bg-gray-200"
      >
        {index + 1}
      </div>

      <span
        className="inline-block w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: phase.color }}
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{phase.name}</div>
        <div className="text-xs text-gray-500">快捷键: {index + 1}</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(phase)}
          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => onDelete(phase.id)}
          className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
        >
          删除
        </button>
      </div>
    </div>
  )
}

interface PhaseSequenceProps {
  phases: AnnotationPhase[]
  onEdit: (phase: AnnotationPhase) => void
  onDelete: (id: string) => void
}

export default function PhaseSequence({ phases, onEdit, onDelete }: PhaseSequenceProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'phase-sequence-droppable'
  })

  if (phases.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">当前序列</h3>
        <div
          ref={setNodeRef}
          className={`flex items-center justify-center h-40 border-2 border-dashed rounded-md transition-colors ${
            isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-500">从左侧拖拽阶段到此处</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        当前序列 ({phases.length} 个阶段)
      </h3>
      <p className="text-xs text-gray-500">拖动调整顺序，快捷键自动分配</p>

      <div ref={setNodeRef} className="space-y-2">
        {phases.map((phase, index) => (
          <SortablePhaseItem
            key={phase.id}
            phase={phase}
            index={index}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
