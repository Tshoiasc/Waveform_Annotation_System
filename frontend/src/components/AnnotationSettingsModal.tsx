import { useMemo } from 'react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAnnotationStore } from '../store/annotationStore'

interface AnnotationSettingsModalProps {
  onClose: () => void
}

function SortablePhaseItem({ id }: { id: string }) {
  const phase = useAnnotationStore((state) => state.phases.find((item) => item.id === id))
  const updatePhase = useAnnotationStore((state) => state.updatePhase)
  const removePhase = useAnnotationStore((state) => state.removePhase)
  const phasesLength = useAnnotationStore((state) => state.phases.length)

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (!phase) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <button
        className="cursor-grab text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
        type="button"
        aria-label="拖动排序"
      >
        ☰
      </button>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={phase.color}
          onChange={(event) => updatePhase(id, { color: event.target.value })}
          className="h-8 w-8 cursor-pointer rounded-md border border-gray-200"
        />
        <input
          type="text"
          value={phase.name}
          onChange={(event) => updatePhase(id, { name: event.target.value })}
          className="w-40 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="阶段名称"
        />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => removePhase(id)}
        disabled={phasesLength <= 1}
        className="text-xs text-red-500 hover:text-red-600 disabled:text-gray-300"
      >
        删除
      </button>
    </div>
  )
}

export default function AnnotationSettingsModal({ onClose }: AnnotationSettingsModalProps) {
  const phases = useAnnotationStore((state) => state.phases)
  const reorderPhases = useAnnotationStore((state) => state.reorderPhases)
  const addPhase = useAnnotationStore((state) => state.addPhase)
  const resetPhasesToDefault = useAnnotationStore((state) => state.resetPhasesToDefault)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // 降低激活距离以提升拖拽响应速度，同时保持与点击操作的区分
        distance: 3,
      },
    })
  )

  const phaseIds = useMemo(() => phases.map((phase) => phase.id), [phases])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">标注阶段设置</h2>
            <p className="text-xs text-gray-500">拖动调整阶段顺序，设置名称与颜色。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto px-5 py-4 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return
              const oldIndex = phaseIds.indexOf(active.id as string)
              const newIndex = phaseIds.indexOf(over.id as string)
              if (oldIndex === -1 || newIndex === -1) return
              const reordered = arrayMove(phases, oldIndex, newIndex)
              reorderPhases(reordered)
            }}
          >
            <SortableContext items={phaseIds} strategy={verticalListSortingStrategy}>
              {phaseIds.map((id) => (
                <SortablePhaseItem key={id} id={id} />
              ))}
            </SortableContext>
          </DndContext>

          {phases.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              请添加至少一个阶段。
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => addPhase({})}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              新增阶段
            </button>
            <button
              type="button"
              onClick={resetPhasesToDefault}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              恢复默认顺序
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
