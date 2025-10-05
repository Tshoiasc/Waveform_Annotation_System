import type { AnnotationPhase } from '../types/waveform'

export type PhaseLike = Omit<AnnotationPhase, 'order'> & { order?: number }

const SHORTCUT_POOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

function isValidShortcut(shortcut: string | null | undefined): shortcut is string {
  if (!shortcut) return false
  const trimmed = shortcut.trim()
  if (trimmed.length !== 1) return false
  return SHORTCUT_POOL.includes(trimmed as (typeof SHORTCUT_POOL)[number])
}

function normalizeColor(color: string): string {
  const value = color.trim()
  return value.toUpperCase()
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ensurePhaseIds<T extends PhaseLike>(phases: T[]): T[] {
  return phases.map((phase) => {
    if (!phase.id) {
      return {
        ...phase,
        id: `phase-${generateId()}`,
      }
    }
    return phase
  })
}

export function normalizePhases<T extends PhaseLike>(phases: T[]): T[] {
  const ensured = ensurePhaseIds(phases)
  const sorted = [...ensured].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : ensured.indexOf(a)
    const orderB = typeof b.order === 'number' ? b.order : ensured.indexOf(b)
    return orderA - orderB
  })

  const used = new Set<string>()
  const normalized = sorted.map((phase, index) => {
    const shortcut = isValidShortcut(phase.shortcut) ? phase.shortcut!.trim() : undefined
    const next: T = {
      ...phase,
      order: index,
      color: normalizeColor(phase.color),
      shortcut: undefined,
    }

    if (shortcut && !used.has(shortcut)) {
      next.shortcut = shortcut
      used.add(shortcut)
    }

    return next
  })

  for (const phase of normalized) {
    if (!phase.shortcut) {
      const available = SHORTCUT_POOL.find((key) => !used.has(key))
      if (available) {
        phase.shortcut = available
        used.add(available)
      }
    }
  }

  return normalized
}

export function normalizeAnnotationPhases(phases: PhaseLike[]): AnnotationPhase[] {
  return normalizePhases(phases).map((phase) => ({
    id: phase.id,
    name: phase.name,
    color: phase.color,
    shortcut: phase.shortcut ?? undefined,
    order: phase.order,
  }))
}
