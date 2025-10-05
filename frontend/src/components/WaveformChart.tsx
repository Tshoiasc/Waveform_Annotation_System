import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useWaveformStore } from '../store/waveformStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { AnnotationEvent, AnnotationPhase, AnnotationSegment } from '../types/waveform'

interface WaveformChartProps {
  width: number
  height: number
}

interface BoundarySnapshot {
  time: number
  index: number
}

interface EventLabel {
  eventIndex: number
  left: number
  width: number
  top: number
}

interface CursorValues {
  raw: number | null
  filtered: number | null
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  eventIndex: number | null
}

function applyAlpha(color: string | undefined, alpha: number) {
  if (!color) {
    return `rgba(59, 130, 246, ${alpha})`
  }

  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+)\)/, (_, values) => {
      const parts = values.split(',').map((part: string) => part.trim())
      if (parts.length < 4) {
        parts.push(alpha.toString())
      } else {
        parts[3] = alpha.toString()
      }
      return `rgba(${parts.join(', ')})`
    })
  }

  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
  }

  let hex = color.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('')
  }
  const num = parseInt(hex, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function resolveSegmentColor(segment: AnnotationSegment, phases: AnnotationPhase[]) {
  if (segment.color) return segment.color
  const phase = phases.find((item) => item.id === segment.phaseId)
  return phase?.color ?? '#3b82f6'
}

function computeEventLabels(u: uPlot, events: AnnotationEvent[]): EventLabel[] {
  const labels: EventLabel[] = []
  const bbox = u.bbox

  for (const event of events) {
    const startPos = u.valToPos(event.startTime, 'x', true)
    const endPos = u.valToPos(event.endTime, 'x', true)
    if (!Number.isFinite(startPos) || !Number.isFinite(endPos)) continue

    const rawLeft = bbox.left + Math.min(startPos, endPos)
    const rawRight = bbox.left + Math.max(startPos, endPos)
    const clampedLeft = Math.max(bbox.left, rawLeft)
    const clampedRight = Math.min(bbox.left + bbox.width, rawRight)
    const width = clampedRight - clampedLeft

    if (width < 24) continue

    labels.push({
      eventIndex: event.eventIndex,
      left: clampedLeft,
      width,
      top: bbox.top + 2,
    })
  }

  return labels
}

function areEventLabelsEqual(a: EventLabel[], b: EventLabel[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const la = a[i]
    const lb = b[i]
    if (
      la.eventIndex !== lb.eventIndex ||
      Math.abs(la.left - lb.left) > 0.5 ||
      Math.abs(la.width - lb.width) > 0.5 ||
      Math.abs(la.top - lb.top) > 0.5
    ) {
      return false
    }
  }
  return true
}

export default function WaveformChart({ width, height }: WaveformChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)

  const { waveform, currentZoom, setZoom, waveformLoading } = useWaveformStore()
  const { selectedFile, selectedTrial } = useWorkspaceStore()
  const {
    annotations,
    events,
    isAnnotating,
    handleBoundaryClick,
    phases,
    pendingBoundary,
    currentPhaseIndex,
    deleteEvent,
  } = useAnnotationStore((state) => ({
    annotations: state.annotations,
    events: state.events,
    isAnnotating: state.isAnnotating,
    handleBoundaryClick: state.handleBoundaryClick,
    phases: state.phases,
    pendingBoundary: state.pendingBoundary,
    currentPhaseIndex: state.currentPhaseIndex,
    deleteEvent: state.deleteEvent,
  }))

  const [eventLabels, setEventLabels] = useState<EventLabel[]>([])
  const [cursorValues, setCursorValues] = useState<CursorValues>({ raw: null, filtered: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, eventIndex: null })

  const annotationsRef = useRef<AnnotationSegment[]>(annotations)
  const eventsRef = useRef<AnnotationEvent[]>(events)
  const isAnnotatingRef = useRef(isAnnotating)
  const handleBoundaryClickRef = useRef(handleBoundaryClick)
  const selectedFileRef = useRef(selectedFile)
  const selectedTrialRef = useRef(selectedTrial)
  const phasesRef = useRef(phases)
  const waveformRef = useRef(waveform)
  const pendingBoundaryRef = useRef<BoundarySnapshot | null>(pendingBoundary)
  const hoverBoundaryRef = useRef<BoundarySnapshot | null>(null)
  const currentPhaseIndexRef = useRef(currentPhaseIndex)
  const deleteEventRef = useRef(deleteEvent)
  const prevAnnotationCountRef = useRef(annotations.length)

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    isAnnotatingRef.current = isAnnotating
  }, [isAnnotating])

  useEffect(() => {
    handleBoundaryClickRef.current = handleBoundaryClick
  }, [handleBoundaryClick])

  useEffect(() => {
    selectedFileRef.current = selectedFile
  }, [selectedFile])

  useEffect(() => {
    selectedTrialRef.current = selectedTrial
  }, [selectedTrial])

  useEffect(() => {
    phasesRef.current = phases
  }, [phases])

  useEffect(() => {
    waveformRef.current = waveform
  }, [waveform])

  useEffect(() => {
    deleteEventRef.current = deleteEvent
  }, [deleteEvent])

  useEffect(() => {
    pendingBoundaryRef.current = pendingBoundary
    if (!pendingBoundary) {
      hoverBoundaryRef.current = null
    }
    if (uplotRef.current) {
      uplotRef.current.redraw()
    }
  }, [pendingBoundary])

  useEffect(() => {
    currentPhaseIndexRef.current = currentPhaseIndex
  }, [currentPhaseIndex])

  useEffect(() => {
    const plot = uplotRef.current
    if (!plot || !plotRef.current) {
      if (eventLabels.length > 0) setEventLabels([])
      return
    }

    const labels = computeEventLabels(plot, eventsRef.current)
    setEventLabels((prev) => (areEventLabelsEqual(prev, labels) ? prev : labels))
  }, [annotations, events, currentZoom, width, height])

  useEffect(() => {
    const handleWindowPointerDown = (event: PointerEvent) => {
      if (!contextMenu.visible) return
      const container = containerRef.current
      if (!container) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }
      if (!container.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
      }
    }

    if (contextMenu.visible) {
      window.addEventListener('pointerdown', handleWindowPointerDown)
    }

    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown)
    }
  }, [contextMenu.visible])

  useEffect(() => {
    if (!contextMenu.visible || contextMenu.eventIndex === null) return
    const exists = eventsRef.current.some((event) => event.eventIndex === contextMenu.eventIndex)
    if (!exists) {
      setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
    }
  }, [contextMenu.visible, contextMenu.eventIndex, events])

  useEffect(() => {
    if (!plotRef.current || !waveform || !currentZoom) return

    const data: uPlot.AlignedData = [
      waveform.raw.timestamps,
      waveform.raw.values,
      waveform.filtered.values,
    ]

    const opts: uPlot.Options = {
      width,
      height,
      scales: {
        x: {
          time: false,
          range: [currentZoom.xMin, currentZoom.xMax],
        },
        y: {
          range: [currentZoom.yMin, currentZoom.yMax],
        },
      },
      axes: [
        {
          label: 'Time (s)',
          stroke: '#6b7280',
          grid: { stroke: '#e5e7eb', width: 1 },
        },
        {
          label: 'Amplitude',
          stroke: '#6b7280',
          grid: { stroke: '#e5e7eb', width: 1 },
        },
      ],
      series: [
        {},
        {
          label: 'AI 采集数据',
          stroke: 'rgba(159, 159, 159, 0.35)',
          width: 0.6,
          spanGaps: true,
        },
        {
          label: '20Hz 低通滤波',
          stroke: '#d62728',
          width: 1,
          spanGaps: true,
        },
      ],
      legend: {
        show: false,
      },
      cursor: {
        drag: {
          x: true,
          y: true,
        },
      },
      plugins: [
        {
          hooks: {
            draw: [
              (u) => {
                const ctx = u.ctx
                ctx.save()

                annotationsRef.current.forEach((segment) => {
                  const startX = u.valToPos(segment.startTime, 'x', true)
                  const endX = u.valToPos(segment.endTime, 'x', true)
                  const left = Math.min(startX, endX)
                  const widthPx = Math.max(1, Math.abs(endX - startX))
                  const color = resolveSegmentColor(segment, phasesRef.current)
                  const isDraft = segment.synced === false

                  ctx.fillStyle = applyAlpha(color, isDraft ? 0.14 : 0.22)
                  ctx.fillRect(left, u.bbox.top, widthPx, u.bbox.height)

                  ctx.strokeStyle = applyAlpha(color, isDraft ? 0.7 : 0.5)
                  ctx.lineWidth = isDraft ? 2 : 1
                  if (isDraft) {
                    ctx.setLineDash([6, 4])
                  }
                  ctx.beginPath()
                  ctx.moveTo(left, u.bbox.top)
                  ctx.lineTo(left, u.bbox.top + u.bbox.height)
                  ctx.moveTo(left + widthPx, u.bbox.top)
                  ctx.lineTo(left + widthPx, u.bbox.top + u.bbox.height)
                  ctx.stroke()
                  if (isDraft) {
                    ctx.setLineDash([])
                  }
                })

                eventsRef.current.forEach((event) => {
                  const startX = u.valToPos(event.startTime, 'x', true)
                  const endX = u.valToPos(event.endTime, 'x', true)
                  if (!Number.isFinite(startX) || !Number.isFinite(endX)) return

                  const left = Math.min(startX, endX)
                  const right = Math.max(startX, endX)
                  const bracketY = u.bbox.top + 6

                  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(left, bracketY)
                  ctx.lineTo(right, bracketY)
                  ctx.moveTo(left, bracketY)
                  ctx.lineTo(left, bracketY + 12)
                  ctx.moveTo(right, bracketY)
                  ctx.lineTo(right, bracketY + 12)
                  ctx.stroke()

                  if (right - left > 40) {
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
                    ctx.font = 'bold 15px "Segoe UI", sans-serif'
                    ctx.textAlign = 'center'
                    ctx.fillText(`事件 ${event.eventIndex + 1}`, (left + right) / 2, bracketY - 8)
                  }
                })

                ctx.restore()

                const pending = pendingBoundaryRef.current
                const hover = hoverBoundaryRef.current
                const isAnnotatingNow = isAnnotatingRef.current

                if (isAnnotatingNow && pending) {
                  const pendingX = u.valToPos(pending.time, 'x', true)
                  if (Number.isFinite(pendingX)) {
                    ctx.save()
                    ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)'
                    ctx.setLineDash([6, 6])
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(pendingX, u.bbox.top)
                    ctx.lineTo(pendingX, u.bbox.top + u.bbox.height)
                    ctx.stroke()
                    ctx.restore()
                  }
                }

                if (isAnnotatingNow && pending && hover && hover.time > pending.time) {
                  const startX = u.valToPos(pending.time, 'x', true)
                  const endX = u.valToPos(hover.time, 'x', true)
                  if (Number.isFinite(startX) && Number.isFinite(endX)) {
                    const left = Math.min(startX, endX)
                    const widthPx = Math.max(1, Math.abs(endX - startX))
                    const phase = phasesRef.current[currentPhaseIndexRef.current]
                    const color = phase?.color ?? '#3b82f6'

                    ctx.save()
                    ctx.fillStyle = applyAlpha(color, 0.16)
                    ctx.fillRect(left, u.bbox.top, widthPx, u.bbox.height)

                    ctx.strokeStyle = applyAlpha(color, 0.5)
                    ctx.lineWidth = 1
                    ctx.strokeRect(left, u.bbox.top, widthPx, u.bbox.height)
                    ctx.restore()
                  }
                }
              },
            ],
            setCursor: [
              (u) => {
                const idx = u.cursor.idx
                if (idx == null || idx < 0) {
                  setCursorValues({ raw: null, filtered: null })
                  return
                }
                const rawSeries = u.data[1] as number[] | undefined
                const filteredSeries = u.data[2] as number[] | undefined
                const raw = rawSeries && idx < rawSeries.length ? rawSeries[idx] : null
                const filtered = filteredSeries && idx < filteredSeries.length ? filteredSeries[idx] : null
                setCursorValues({ raw, filtered })
              },
            ],
          },
        },
      ],
    }

    const plot = new uPlot(opts, data, plotRef.current)
    const legendEl = plot.root.querySelector('.u-legend') as HTMLElement | null
    if (legendEl) {
      plot.root.style.position = 'relative'
      legendEl.style.position = 'absolute'
      legendEl.style.top = '12px'
      legendEl.style.right = '12px'
      legendEl.style.background = 'rgba(255, 255, 255, 0.9)'
      legendEl.style.padding = '4px 8px'
      legendEl.style.borderRadius = '4px'
      legendEl.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.08)'
      legendEl.style.pointerEvents = 'none'
    }
    uplotRef.current = plot

    setEventLabels((prev) => {
      const labels = computeEventLabels(plot, eventsRef.current)
      return areEventLabelsEqual(prev, labels) ? prev : labels
    })

    const handlePlotClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      console.debug('[waveform] plot click', { button: event.button })
      if (!isAnnotatingRef.current) {
        console.debug('[waveform] click ignored: annotate mode disabled')
        return
      }

      const currentWaveform = waveformRef.current
      const currentFile = selectedFileRef.current
      const currentTrial = selectedTrialRef.current
      if (!currentWaveform || !currentFile || !currentTrial) return

      const overRect = plot.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        console.debug('[waveform] click ignored: outside plot area', { xWithin, yWithin })
        return
      }

      const idx = Math.round(plot.posToIdx(xWithin))
      const timestamps = currentWaveform.raw.timestamps
      const clampedIdx = Math.max(0, Math.min(timestamps.length - 1, idx))
      const timestamp = timestamps[clampedIdx]
      console.debug('[waveform] submit boundary click', {
        idx,
        clampedIdx,
        timestamp,
        timeAtPointer: plot.posToVal(xWithin, 'x'),
      })

      void handleBoundaryClickRef.current({
        fileId: currentFile.fileId,
        trialIndex: currentTrial.trialIndex,
        time: timestamp,
        index: clampedIdx,
      })
    }

    const handleMouseMove = (event: MouseEvent) => {
      const currentWaveform = waveformRef.current
      if (!currentWaveform) return

      const overRect = plot.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        if (hoverBoundaryRef.current) {
          hoverBoundaryRef.current = null
          plot.redraw()
        }
        if (plot.over.style.cursor !== 'default') {
          plot.over.style.cursor = 'default'
        }
        return
      }

      const idx = Math.round(plot.posToIdx(xWithin))
      const timestamps = currentWaveform.raw.timestamps
      const clampedIdx = Math.max(0, Math.min(timestamps.length - 1, idx))
      const timestamp = timestamps[clampedIdx]

      if (pendingBoundaryRef.current && isAnnotatingRef.current) {
        const previous = hoverBoundaryRef.current
        const next = { time: timestamp, index: clampedIdx }
        const changed = !previous || previous.index !== next.index
        hoverBoundaryRef.current = next
        if (changed) {
          plot.redraw()
        }
        plot.over.style.cursor = 'crosshair'
      } else {
        hoverBoundaryRef.current = null
        plot.over.style.cursor = isAnnotatingRef.current ? 'crosshair' : 'default'
      }
    }

    const handleMouseLeave = () => {
      if (hoverBoundaryRef.current) {
        hoverBoundaryRef.current = null
        plot.redraw()
      }
      plot.over.style.cursor = 'default'
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()

      const plotInstance = uplotRef.current
      if (!plotInstance || !containerRef.current) return

      const overRect = plotInstance.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      const time = plotInstance.posToVal(xWithin, 'x')
      if (!Number.isFinite(time)) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      const target = eventsRef.current.find(
        (evt) => time >= Math.min(evt.startTime, evt.endTime) && time <= Math.max(evt.startTime, evt.endTime)
      )

      if (!target) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      const group = uplotRef.current?.root.closest('[data-event-menu-root]') as HTMLElement | null
      const containerRect = (group ?? containerRef.current).getBoundingClientRect()
      const menuWidth = 160
      const menuHeight = 64
      let menuX = event.clientX - containerRect.left
      let menuY = event.clientY - containerRect.top

      menuX = Math.min(Math.max(0, menuX), containerRect.width - menuWidth)
      menuY = Math.min(Math.max(0, menuY), containerRect.height - menuHeight)

      setContextMenu({ visible: true, x: menuX, y: menuY, eventIndex: target.eventIndex })
    }

    plot.over.addEventListener('click', handlePlotClick)
    plot.over.addEventListener('mousemove', handleMouseMove)
    plot.over.addEventListener('mouseleave', handleMouseLeave)
    plot.over.addEventListener('contextmenu', handleContextMenu)

    return () => {
      plot.over.removeEventListener('click', handlePlotClick)
      plot.over.removeEventListener('mousemove', handleMouseMove)
      plot.over.removeEventListener('mouseleave', handleMouseLeave)
      plot.over.removeEventListener('contextmenu', handleContextMenu)
      plot.destroy()
      uplotRef.current = null
    }
  }, [waveform, width, height, currentZoom])

  useEffect(() => {
    const plot = uplotRef.current
    if (!plot || !currentZoom) return

    plot.setScale('x', { min: currentZoom.xMin, max: currentZoom.xMax })
    plot.setScale('y', { min: currentZoom.yMin, max: currentZoom.yMax })
    const labels = computeEventLabels(plot, eventsRef.current)
    setEventLabels((prev) => (areEventLabelsEqual(prev, labels) ? prev : labels))
  }, [currentZoom, annotations, events])

  useEffect(() => {
    if (!currentZoom || !isAnnotatingRef.current) return

    const prevCount = prevAnnotationCountRef.current
    const currentCount = annotations.length
    prevAnnotationCountRef.current = currentCount

    if (currentCount === 0 || currentCount <= prevCount) return

    const latestSegment = annotations[annotations.length - 1]
    if (!latestSegment) return

    const widthRange = currentZoom.xMax - currentZoom.xMin
    if (widthRange <= 0) return

    const margin = widthRange * 0.25
    if (latestSegment.endTime <= currentZoom.xMax - margin) return

    const waveformData = waveformRef.current
    if (!waveformData) return

    const dataMin = waveformData.raw.timestamps[0]
    const dataMax = waveformData.raw.timestamps[waveformData.raw.timestamps.length - 1]

    const desiredMax = Math.min(latestSegment.endTime + widthRange * 0.15, dataMax)
    let desiredMin = Math.max(desiredMax - widthRange, dataMin)
    let desiredXMax = desiredMin + widthRange

    if (desiredXMax > dataMax) {
      desiredXMax = dataMax
      desiredMin = Math.max(desiredXMax - widthRange, dataMin)
    }

    setZoom({
      xMin: desiredMin,
      xMax: desiredXMax,
      yMin: currentZoom.yMin,
      yMax: currentZoom.yMax,
      timestamp: Date.now(),
    })
  }, [annotations, currentZoom, setZoom])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const plot = uplotRef.current
      if (!plot || !currentZoom) return

      const { deltaY, deltaX, shiftKey, metaKey, ctrlKey } = e
      const zoomMode: 'x' | 'y' | 'xy' = metaKey || ctrlKey ? 'x' : shiftKey ? 'y' : 'xy'

      let axisDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX
      if (axisDelta === 0 && deltaX !== 0) {
        axisDelta = deltaX
      }

      if (axisDelta === 0) return

      const plotRect = plot.over.getBoundingClientRect()
      const xWithin = e.clientX - plotRect.left
      const yWithin = e.clientY - plotRect.top

      const xValue = plot.posToVal(xWithin, 'x')
      const yValue = plot.posToVal(yWithin, 'y')

      const zoomFactor = axisDelta > 0 ? 1.1 : 0.9
      const xRange = currentZoom.xMax - currentZoom.xMin
      const yRange = currentZoom.yMax - currentZoom.yMin

      let newXMin = currentZoom.xMin
      let newXMax = currentZoom.xMax
      let newYMin = currentZoom.yMin
      let newYMax = currentZoom.yMax

      if ((zoomMode === 'x' || zoomMode === 'xy') && xRange > 0 && Number.isFinite(xValue)) {
        const leftSpan = xValue - currentZoom.xMin
        const rightSpan = currentZoom.xMax - xValue
        const newLeftSpan = leftSpan * zoomFactor
        const newRightSpan = rightSpan * zoomFactor
        newXMin = xValue - newLeftSpan
        newXMax = xValue + newRightSpan
      }

      if ((zoomMode === 'y' || zoomMode === 'xy') && yRange > 0 && Number.isFinite(yValue)) {
        const lowerSpan = yValue - currentZoom.yMin
        const upperSpan = currentZoom.yMax - yValue
        const newLowerSpan = lowerSpan * zoomFactor
        const newUpperSpan = upperSpan * zoomFactor
        newYMin = yValue - newLowerSpan
        newYMax = yValue + newUpperSpan
      }

      const waveformData = waveformRef.current
      if ((zoomMode === 'x' || zoomMode === 'xy') && waveformData) {
        const dataMin = waveformData.raw.timestamps[0]
        const dataMax = waveformData.raw.timestamps[waveformData.raw.timestamps.length - 1]
        const nextRange = newXMax - newXMin
        if (nextRange > 0 && Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
          if (newXMin < dataMin) {
            const diff = dataMin - newXMin
            newXMin = dataMin
            newXMax += diff
          }
          if (newXMax > dataMax) {
            const diff = newXMax - dataMax
            newXMax = dataMax
            newXMin -= diff
          }
          if (newXMin < dataMin) newXMin = dataMin
          if (newXMax > dataMax) newXMax = dataMax
        }
      }

      if (newXMax - newXMin < 1e-9) {
        const center = (newXMax + newXMin) / 2
        newXMin = center - 1e-9
        newXMax = center + 1e-9
      }
      if (newYMax - newYMin < 1e-9) {
        const center = (newYMax + newYMin) / 2
        newYMin = center - 1e-9
        newYMax = center + 1e-9
      }

      plot.setScale('x', { min: newXMin, max: newXMax })
      plot.setScale('y', { min: newYMin, max: newYMax })

      setZoom({
        xMin: newXMin,
        xMax: newXMax,
        yMin: newYMin,
        yMax: newYMax,
        timestamp: Date.now(),
      })
    }

    const plotEl = plotRef.current
    if (plotEl) {
      plotEl.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (plotEl) {
        plotEl.removeEventListener('wheel', handleWheel)
      }
    }
  }, [currentZoom, setZoom])

  return (
    <div ref={containerRef} data-event-menu-root className="relative w-full h-full">
      {waveformLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-sm text-gray-500">加载波形数据中...</div>
        </div>
      )}

      {!waveform && !waveformLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          请选择Trial查看波形
        </div>
      )}

      <div ref={plotRef} className="w-full h-full" />

      <div className="absolute bottom-3 right-3 rounded bg-white/90 px-3 py-2 text-xs text-slate-600 shadow border border-slate-200 min-w-[140px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />Filtered
          </span>
          <span>{cursorValues.filtered !== null ? cursorValues.filtered.toFixed(3) : '--'}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />Raw
          </span>
          <span>{cursorValues.raw !== null ? cursorValues.raw.toFixed(3) : '--'}</span>
        </div>
      </div>

      {contextMenu.visible && contextMenu.eventIndex !== null && (
        <div
          className="absolute z-20 rounded border border-slate-200 bg-white py-1 text-xs text-slate-700 shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="px-4 py-1 hover:bg-red-50 w-full text-left"
            onClick={(event) => {
              event.stopPropagation()
              if (contextMenu.eventIndex !== null) {
                deleteEventRef.current(contextMenu.eventIndex)
              }
              setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
            }}
          >
            删除事件
          </button>
          <button
            type="button"
            className="px-4 py-1 hover:bg-slate-100 w-full text-left"
            onClick={(event) => {
              event.stopPropagation()
              setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
