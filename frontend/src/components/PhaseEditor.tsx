import { useState } from 'react'
import type { AnnotationPhase } from '../types/waveform'

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1', '#14B8A6', '#A855F7',
  '#F43F5E', '#0EA5E9', '#22C55E', '#FACC15'
]

interface PhaseEditorProps {
  phase: AnnotationPhase
  onSave: (updates: Partial<AnnotationPhase>) => void
  onCancel: () => void
}

export default function PhaseEditor({ phase, onSave, onCancel }: PhaseEditorProps) {
  const [name, setName] = useState(phase.name)
  const [color, setColor] = useState(phase.color)

  const handleSave = () => {
    if (!name.trim()) {
      alert('阶段名称不能为空')
      return
    }
    onSave({ name: name.trim(), color })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">编辑阶段</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              阶段名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如: Baseline"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              颜色
            </label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={"w-8 h-8 rounded-full transition-transform " + (
                    color === presetColor ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: presetColor }}
                  aria-label={"Select color " + presetColor}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              预览
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
              <span
                className="inline-block w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-gray-900">{name || '未命名阶段'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
