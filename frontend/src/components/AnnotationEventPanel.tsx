import { useMemo } from 'react'
import { useAnnotationStore } from '../store/annotationStore'

export default function AnnotationEventPanel() {
  const { annotations, phases, deleteAnnotation, deleteEvent, isOwner, ensureEditableViaDraft } = useAnnotationStore(
    (state) => ({
      annotations: state.annotations,
      phases: state.phases,
      deleteAnnotation: state.deleteAnnotation,
      deleteEvent: state.deleteEvent,
      isOwner: state.isOwner,
      ensureEditableViaDraft: state.ensureEditableViaDraft,
    })
  )

  const grouped = useMemo(() => {
    const map = new Map<number, typeof annotations>()
    for (const segment of annotations) {
      const list = map.get(segment.eventIndex)
      if (list) {
        list.push(segment)
      } else {
        map.set(segment.eventIndex, [segment])
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([eventIndex, segments]) => ({
        eventIndex,
        segments: segments.sort((s1, s2) => s1.startTime - s2.startTime),
      }))
  }, [annotations])

  if (annotations.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-500 border-b border-gray-200">
        暂无标注，开启标注模式后会在此显示已创建的阶段，可快速删除或查看顺序。
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">已创建事件</span>
        <span className="text-xs text-gray-400">点击各阶段右侧“删除”即可移除，或删除整个事件。</span>
      </div>

      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
        {grouped.map(({ eventIndex, segments }) => (
          <div
            key={eventIndex}
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">事件 {eventIndex + 1}</span>
              <button
                type="button"
                onClick={async () => {
                  if (!isOwner) {
                    const ok = window.confirm('当前为他人版本，是否下载到我的草稿箱并进行编辑？')
                    if (!ok) return
                    await ensureEditableViaDraft()
                  }
                  void deleteEvent(eventIndex)
                }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                删除事件
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {segments.map((segment) => {
                const phase = phases.find((item) => item.id === segment.phaseId)
                const color = phase?.color ?? segment.color ?? '#3b82f6'
                return (
                  <div
                    key={segment.id}
                    className="flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-xs shadow-sm"
                    style={{ borderColor: color }}
                  >
                    <span
                      className="inline-flex items-center gap-1 font-medium"
                      style={{ color }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {segment.phaseName}
                    </span>
                    <span className="text-gray-500">
                      {segment.startTime.toFixed(3)}s ~ {segment.endTime.toFixed(3)}s
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isOwner) {
                          const ok = window.confirm('当前为他人版本，是否下载到我的草稿箱并进行编辑？')
                          if (!ok) return
                          await ensureEditableViaDraft()
                        }
                        void deleteAnnotation(segment.id)
                      }}
                      className="text-[11px] text-red-500 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
