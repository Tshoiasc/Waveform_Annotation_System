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

interface DraggablePhaseItemProps {
  phase: PhaseItem
  disabled?: boolean
}

function DraggablePhaseItem({ phase, disabled = false }: DraggablePhaseItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${phase.id}`,
    data: { type: 'library-phase', phase },
    disabled
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-white transition-shadow ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab hover:shadow-md'
      }`}
    >
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ backgroundColor: phase.color }}
      />
      <span className="text-sm font-medium text-gray-700">{phase.name}</span>
    </div>
  )
}

interface PhaseLibraryProps {
  disabled?: boolean
}

export default function PhaseLibrary({ disabled = false }: PhaseLibraryProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">阶段库</h3>
      <p className="text-xs text-gray-500">
        {disabled ? '暂无阶段拖拽权限，请联系管理员。' : '拖拽阶段到右侧序列中'}
      </p>
      
      <div className="grid grid-cols-2 gap-2">
        {PREDEFINED_PHASES.map((phase) => (
          <DraggablePhaseItem key={phase.id} phase={phase} disabled={disabled} />
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border border-dashed rounded-md transition-colors ${
          disabled
            ? 'text-gray-400 border-gray-200 cursor-not-allowed'
            : 'text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
        }`}
      >
        + 新建自定义阶段
      </button>
    </div>
  )
}
