import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface PhaseItem {
  id: string
  name: string
  color: string
}

const PREDEFINED_PHASES: PhaseItem[] = [
  { id: 'baseline', name: 'Baseline', color: '#38bdf8' },
  { id: 'approach', name: 'Approach', color: '#a855f7' },
  { id: 'impact', name: 'Impact', color: '#f97316' },
  { id: 'ringdown', name: 'Ringdown', color: '#facc15' },
]

function DraggablePhaseItem({ phase }: { phase: PhaseItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${phase.id}`,
    data: { type: 'library-phase', phase }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-white cursor-grab hover:shadow-md transition-shadow"
    >
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ backgroundColor: phase.color }}
      />
      <span className="text-sm font-medium text-gray-700">{phase.name}</span>
    </div>
  )
}

export default function PhaseLibrary() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">阶段库</h3>
      <p className="text-xs text-gray-500">拖拽阶段到右侧序列中</p>
      
      <div className="grid grid-cols-2 gap-2">
        {PREDEFINED_PHASES.map((phase) => (
          <DraggablePhaseItem key={phase.id} phase={phase} />
        ))}
      </div>

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-md hover:border-gray-400 hover:text-gray-800 transition-colors"
      >
        + 新建自定义阶段
      </button>
    </div>
  )
}
