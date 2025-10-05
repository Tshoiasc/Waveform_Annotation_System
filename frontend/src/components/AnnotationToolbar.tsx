import { useMemo } from 'react'
import { useAnnotationStore } from '../store/annotationStore'

export default function AnnotationToolbar() {
  const {
    isAnnotating,
    setIsAnnotating,
    phases,
    currentPhaseIndex,
    annotationsError,
    resetCurrentFlow,
  } = useAnnotationStore((state) => ({
    isAnnotating: state.isAnnotating,
    setIsAnnotating: state.setIsAnnotating,
    phases: state.phases,
    currentPhaseIndex: state.currentPhaseIndex,
    annotationsError: state.annotationsError,
    resetCurrentFlow: state.resetCurrentFlow,
  }))

  const currentPhase = useMemo(() => phases[currentPhaseIndex] ?? phases[0], [phases, currentPhaseIndex])

  return (
    <div className="flex flex-col border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              isAnnotating
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            {isAnnotating ? 'Mode:Open' : 'Mode:Close'}
          </button>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Seq：</span>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              {phases.map((phase, idx) => {
                const isActive = idx === currentPhaseIndex && isAnnotating
                return (
                  <div
                    key={phase.id}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
                    <span className="whitespace-nowrap">{phase.name}</span>
                    {phase.shortcut && (
                      <span
                        className={`rounded border px-1 py-0.5 text-[10px] font-semibold ${
                          isActive ? 'border-white/70 bg-white/20' : 'border-gray-300 bg-gray-100 text-gray-600'
                        }`}
                      >
                        {phase.shortcut}
                      </span>
                    )}
                  </div>
                )
              })}
              {phases.length === 0 && <span className="text-xs text-gray-400">尚未配置阶段</span>}
            </div>
          </div>

          {isAnnotating && (
            <button
              onClick={resetCurrentFlow}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              重置当前事件
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 text-xs text-gray-500">
        {isAnnotating ? (
          <>
            {currentPhase ? (
              <span>
                点击波形以结束
                <span className="font-semibold" style={{ color: currentPhase.color }}>
                  {` ${currentPhase.name} `}
                </span>
                阶段，并自动进入下一阶段。
              </span>
            ) : (
              <span>请先在配置事件序列中添加阶段顺序。</span>
            )}
          </>
        ) : (
          <span>开启标注模式后，按照阶段顺序依次点击波形即可生成区间遮罩。</span>
        )}
        {annotationsError && (
          <span className="ml-2 text-red-500">{annotationsError}</span>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-2 text-[11px] text-gray-500">
        数字键1-9可快速切换阶段，Tab / Shift+Tab 循环切换，空格键在标注时推进到下一阶段。
      </div>
    </div>
  )
}
