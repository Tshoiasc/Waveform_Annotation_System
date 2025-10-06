import type { AnnotationPhase } from './waveform'

export interface TemplatePhase extends AnnotationPhase {
  shortcut?: string
  order: number
}

export interface EventTemplate {
  id: string
  name: string
  isGlobal: boolean
  createdBy: string | null
  phases: TemplatePhase[]
  createdAt: string
  updatedAt: string
}

export interface TemplatePayload {
  name: string
  phases: TemplatePhase[]
}
