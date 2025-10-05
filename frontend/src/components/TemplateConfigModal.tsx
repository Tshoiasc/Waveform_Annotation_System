import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  type CollisionDetection,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import PhaseLibrary from './PhaseLibrary'
import PhaseSequence from './PhaseSequence'
import PhaseEditor from './PhaseEditor'
import { useAnnotationStore } from '../store/annotationStore'
import { useTemplateStore } from '../store/templateStore'
import type { AnnotationPhase } from '../types/waveform'

interface TemplateConfigModalProps {
  open: boolean
  onClose: () => void
}

export default function TemplateConfigModal({ open, onClose }: TemplateConfigModalProps) {
  const { phases, reorderPhases } = useAnnotationStore()
  const { templates, currentTemplateId, fetchTemplates, createTemplate } = useTemplateStore()
  
  const [localPhases, setLocalPhases] = useState<AnnotationPhase[]>(phases)
  const [editingPhase, setEditingPhase] = useState<AnnotationPhase | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateScope, setTemplateScope] = useState<'global' | 'private'>('global')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const activeType = args.active.data.current?.type

    if (activeType === 'library-phase') {
      const pointerCollisions = pointerWithin(args)
      if (pointerCollisions.length > 0) {
        return pointerCollisions
      }

      const intersections = rectIntersection(args)
      if (intersections.length > 0) {
        return intersections
      }

      return []
    }

    return closestCenter(args)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  useEffect(() => {
    if (!open) return
    setLocalPhases(phases)
    setSelectedTemplateId(currentTemplateId ?? null)
  }, [open, phases, currentTemplateId])

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open, fetchTemplates])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    // From library to sequence
    const activeIdAsString = active.id.toString()
    if (activeIdAsString.startsWith('library-')) {
      // 允许拖入可放置区域或区域内已有阶段上方来追加新阶段
      if (
        over.id === 'phase-sequence-droppable' ||
        localPhases.some(p => p.id === over.id)
      ) {
        const phaseData = active.data.current?.phase
        if (phaseData) {
          const newPhase: AnnotationPhase = {
            id: crypto.randomUUID(),
            name: phaseData.name,
            color: phaseData.color
          }
          setLocalPhases((prev) => [...prev, newPhase])
        }
      }
      return
    }

    // Reorder within sequence
    if (active.id !== over.id) {
      setLocalPhases((prev) => {
        const oldIndex = prev.findIndex(p => p.id === active.id)
        if (oldIndex === -1) return prev

        const newIndex =
          over.id === 'phase-sequence-droppable'
            ? prev.length - 1
            : prev.findIndex(p => p.id === over.id)

        if (newIndex === -1 || newIndex === oldIndex) {
          return prev
        }

        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleEditPhase = (phase: AnnotationPhase) => {
    setEditingPhase(phase)
  }

  const handleSavePhaseEdit = (updates: Partial<AnnotationPhase>) => {
    if (!editingPhase) return
    setLocalPhases(localPhases.map(p => 
      p.id === editingPhase.id ? { ...p, ...updates } : p
    ))
    setEditingPhase(null)
  }

  const handleDeletePhase = (id: string) => {
    setLocalPhases(localPhases.filter(p => p.id !== id))
  }

  const handleSaveAsPrivate = async () => {
    if (!templateName.trim()) {
      alert('请输入模板名称')
      return
    }

    await createTemplate({
      name: templateName,
      isGlobal: false,
      phases: localPhases.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        shortcut: String(i + 1),
        order: i
      }))
    })

    alert('模板已保存')
  }

  const handleApply = () => {
    reorderPhases(localPhases)
    useTemplateStore.setState({ currentTemplateId: selectedTemplateId })
    onClose()
  }

  const handleLoadTemplate = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId(null)
      return
    }

    const template = templates.find(t => t._id === templateId)
    if (template) {
      setLocalPhases(template.phases.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color
      })))
      setSelectedTemplateId(templateId)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">⚙️ 事件序列配置器</h2>
          <p className="text-sm text-gray-500 mt-1">配置事件阶段顺序和属性</p>
        </div>

        {/* Template selector */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">加载模板:</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={"px-3 py-1 text-sm rounded " + (templateScope === 'global' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600')}
                onClick={() => setTemplateScope('global')}
              >
                全局模板
              </button>
              <button
                type="button"
                className={"px-3 py-1 text-sm rounded " + (templateScope === 'private' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600')}
                onClick={() => setTemplateScope('private')}
              >
                我的模板
              </button>
            </div>
            <select
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={selectedTemplateId ?? ''}
              onChange={(e) => handleLoadTemplate(e.target.value)}
            >
              <option value="">选择模板...</option>
              {templates
                .filter(t => templateScope === 'global' ? t.isGlobal : !t.isGlobal)
                .map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))
              }
            </select>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <PhaseLibrary />
              </div>

              <div>
                <SortableContext
                  items={localPhases.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <PhaseSequence
                    phases={localPhases}
                    onEdit={handleEditPhase}
                    onDelete={handleDeletePhase}
                  />
                </SortableContext>
              </div>
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="px-3 py-2 bg-white border-2 border-blue-500 rounded-md shadow-lg">
                  Dragging...
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="输入模板名称..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              type="button"
              onClick={handleSaveAsPrivate}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              保存为私有模板
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              保存并应用
            </button>
          </div>
        </div>
      </div>

      {editingPhase && (
        <PhaseEditor
          phase={editingPhase}
          onSave={handleSavePhaseEdit}
          onCancel={() => setEditingPhase(null)}
        />
      )}
    </div>
  )
}
