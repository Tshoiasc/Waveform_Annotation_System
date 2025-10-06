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
import { PermissionGate } from './PermissionGate'
import { useAnnotationStore } from '../store/annotationStore'
import { useTemplateStore } from '../store/templateStore'
import { useAuthStore } from '../store/authStore'
import { normalizeAnnotationPhases } from '../utils/phaseUtils'
import type { AnnotationPhase } from '../types/waveform'
import type { Phase } from '../services/templateService'

const SHORTCUT_POOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

function assignSequentialShortcuts(phases: AnnotationPhase[]): AnnotationPhase[] {
  if (phases.length > SHORTCUT_POOL.length) {
    throw new Error('阶段数量超过快捷键上限（9个），请删减后再保存')
  }

  return phases.map((phase, index) => ({
    ...phase,
    shortcut: SHORTCUT_POOL[index],
  }))
}

interface TemplateConfigModalProps {
  open: boolean
  onClose: () => void
}

export default function TemplateConfigModal({ open, onClose }: TemplateConfigModalProps) {
  const { phases, reorderPhases } = useAnnotationStore()
  const { templates, currentTemplateId, fetchTemplates, createTemplate, updateTemplate, loading } = useTemplateStore()
  const canViewTemplates = useAuthStore((state) => state.hasPermission('templates.view'))
  const canCreateTemplate = useAuthStore((state) => state.hasPermission('templates.create'))
  const canUpdateTemplate = useAuthStore((state) => state.hasPermission('templates.update'))
  
  const [localPhases, setLocalPhases] = useState<AnnotationPhase[]>(phases)
  const [editingPhase, setEditingPhase] = useState<AnnotationPhase | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
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
    try {
      setLocalPhases(assignSequentialShortcuts(phases))
    } catch (error) {
      const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
      alert(message)
      setLocalPhases(phases)
    }
    setSelectedTemplateId(currentTemplateId ?? null)
  }, [open, phases, currentTemplateId])

  useEffect(() => {
    if (open && canViewTemplates) {
      fetchTemplates()
    }
  }, [open, canViewTemplates, fetchTemplates])

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateName('')
      try {
        setLocalPhases(assignSequentialShortcuts(phases))
      } catch (error) {
        const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
        alert(message)
        setLocalPhases(phases)
      }
      return
    }

    const template = templates.find(t => t._id === selectedTemplateId)
    if (template) {
      setTemplateName(template.name)
      try {
        setLocalPhases(assignSequentialShortcuts(template.phases.map(phase => ({
          id: phase.id,
          name: phase.name,
          color: phase.color,
          shortcut: phase.shortcut,
          order: phase.order,
        }))))
      } catch (error) {
        const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
        alert(message)
        setLocalPhases(template.phases.map(phase => ({
          id: phase.id,
          name: phase.name,
          color: phase.color,
          shortcut: phase.shortcut,
          order: phase.order,
        })))
      }
    }
  }, [selectedTemplateId, templates, phases])

  useEffect(() => {
    if (!canUpdateTemplate) {
      setActiveId(null)
    }
  }, [canUpdateTemplate])

  const handleDragStart = (event: DragStartEvent) => {
    if (!canUpdateTemplate) return
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canUpdateTemplate) {
      setActiveId(null)
      return
    }

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
          setLocalPhases((prev) => {
            try {
              return assignSequentialShortcuts([...prev, newPhase])
            } catch (error) {
              const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
              alert(message)
              return prev
            }
          })
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

        try {
          return assignSequentialShortcuts(arrayMove(prev, oldIndex, newIndex))
        } catch (error) {
          const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
          alert(message)
          return prev
        }
      })
    }
  }

  const handleEditPhase = (phase: AnnotationPhase) => {
    if (!canUpdateTemplate) return
    setEditingPhase(phase)
  }

  const handleSavePhaseEdit = (updates: Partial<AnnotationPhase>) => {
    if (!editingPhase || !canUpdateTemplate) return
    setLocalPhases((prev) => {
      const next = prev.map(p =>
        p.id === editingPhase.id ? { ...p, ...updates } : p
      )
      try {
        return assignSequentialShortcuts(next)
      } catch (error) {
        const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
        alert(message)
        return prev
      }
    })
    setEditingPhase(null)
  }

  const handleDeletePhase = (id: string) => {
    if (!canUpdateTemplate) return
    setLocalPhases((prev) => {
      const filtered = prev.filter(p => p.id !== id)
      try {
        return assignSequentialShortcuts(filtered)
      } catch (error) {
        const message = error instanceof Error ? error.message : '阶段数量超过快捷键上限'
        alert(message)
        return prev
      }
    })
  }

  const buildTemplatePhases = (phasesToBuild: AnnotationPhase[]) => {
    const sequential = assignSequentialShortcuts(phasesToBuild.map((phase) => ({ ...phase })))
    const normalized = normalizeAnnotationPhases(sequential.map((phase, index) => ({
      ...phase,
      order: index,
    })))

    const payload: Phase[] = normalized.map(phase => ({
      id: phase.id,
      name: phase.name,
      color: phase.color,
      shortcut: phase.shortcut!,
      order: phase.order ?? 0,
    }))

    return { normalized, payload }
  }

  const hasPhasesChanged = (templatePhases: Phase[], nextPhases: Phase[]) => {
    if (templatePhases.length !== nextPhases.length) return true
    return templatePhases.some((phase, index) => {
      const target = nextPhases[index]
      if (!target) return true
      return (
        phase.id !== target.id ||
        phase.name !== target.name ||
        phase.shortcut !== target.shortcut ||
        phase.order !== target.order ||
        phase.color.toUpperCase() !== target.color.toUpperCase()
      )
    })
  }

  const handleSaveTemplate = async () => {
    if (!canCreateTemplate) {
      alert('暂无创建模板权限')
      return
    }

    const trimmedName = templateName.trim()
    if (!trimmedName) {
      alert('请输入模板名称')
      return
    }

    try {
      const { normalized, payload } = buildTemplatePhases(localPhases)
      const created = await createTemplate({
        name: trimmedName,
        phases: payload
      })
      setLocalPhases(normalized)
      setSelectedTemplateId(created._id)
      setTemplateName(created.name)
      alert('模板已保存为新模板')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存模板失败'
      alert(message)
    }
  }

  const handleApply = async () => {
    let normalizedPhases = localPhases
    try {
      const { normalized, payload } = buildTemplatePhases(localPhases)
      normalizedPhases = normalized

      if (selectedTemplateId) {
        const template = templates.find(t => t._id === selectedTemplateId)
        if (!template) {
          alert('未找到对应的模板，请重新选择后再试')
          return
        }
        const trimmedName = templateName.trim()
        const nameChanged = template ? trimmedName && trimmedName !== template.name : true
        const phasesChanged = hasPhasesChanged(template.phases, payload)

        if ((nameChanged || phasesChanged) && !canUpdateTemplate) {
          alert('暂无模板更新权限，无法保存修改')
          return
        }

        if ((nameChanged || phasesChanged) && canUpdateTemplate) {
          if (!trimmedName) {
            alert('模板名称不能为空')
            return
          }
          try {
            const updatePayload: { name?: string; phases?: Phase[] } = {}
            if (nameChanged) {
              updatePayload.name = trimmedName
            }
            if (phasesChanged) {
              updatePayload.phases = payload
            }

            await updateTemplate(selectedTemplateId, updatePayload)
            setLocalPhases(normalized)
            alert('模板已更新')
          } catch (error) {
            const message = error instanceof Error ? error.message : '模板更新失败'
            alert(message)
            return
          }
        }
      } else if (!selectedTemplateId) {
        alert('请选择要编辑的模板或另存为新模板')
        return
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '阶段配置不合法'
      alert(message)
      return
    }

    reorderPhases(normalizedPhases)
    if (selectedTemplateId) {
      useTemplateStore.setState({ currentTemplateId: selectedTemplateId })
    }
    onClose()
  }

  const handleLoadTemplate = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId(null)
      return
    }
    setSelectedTemplateId(templateId)
  }

  if (!open) return null

  const noPermissionFallback = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 text-center space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">暂无模板查看权限</h2>
        <p className="text-sm text-gray-500">请联系管理员为您分配模板查看权限后再试。</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          关闭
        </button>
      </div>
    </div>
  )

  return (
    <PermissionGate permission="templates.view" fallback={noPermissionFallback}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">⚙️ 事件序列配置器</h2>
            <p className="text-sm text-gray-500 mt-1">配置事件阶段顺序和属性</p>
          </div>

          {/* Template selector */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <label className="text-sm font-medium text-gray-700">加载全局模板:</label>
              <select
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={selectedTemplateId ?? ''}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                disabled={templates.length === 0}
              >
                <option value="">选择模板...</option>
                {templates.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">模板统一为全局配置</span>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <DndContext
              sensors={canUpdateTemplate ? sensors : []}
              collisionDetection={collisionDetectionStrategy}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <PhaseLibrary disabled={!canUpdateTemplate} />
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
                      disabled={!canUpdateTemplate}
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
                disabled={!!selectedTemplateId && !canUpdateTemplate}
              />
              <PermissionGate
                permission="templates.create"
                fallback={
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed"
                  >
                    无创建权限
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={loading}
                >
                  另存为新模板
                </button>
              </PermissionGate>
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
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                disabled={loading}
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
    </PermissionGate>
  )
}
