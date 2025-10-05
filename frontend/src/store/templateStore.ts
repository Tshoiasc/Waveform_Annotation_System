import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import templateService, { EventTemplate, Phase } from '../services/templateService'
import { useAnnotationStore } from './annotationStore'

interface TemplateState {
  templates: EventTemplate[]
  currentTemplateId: string | null
  loading: boolean
  error: string | null

  // Actions
  fetchTemplates: (scope?: 'global' | 'private', userId?: string) => Promise<void>
  selectTemplate: (id: string) => Promise<void>
  createTemplate: (data: { name: string; isGlobal: boolean; phases: Phase[] }, userId?: string) => Promise<void>
  updateTemplate: (id: string, data: { name?: string; phases?: Phase[] }) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  applyTemplate: (templateId: string) => void
  clearError: () => void
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      currentTemplateId: null,
      loading: false,
      error: null,

      fetchTemplates: async (scope, userId) => {
        set({ loading: true, error: null })
        try {
          const templates = await templateService.getTemplates(scope, userId)
          set({ templates, loading: false })
        } catch (error) {
          console.error('Failed to fetch templates:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch templates'
          })
        }
      },

      selectTemplate: async (id) => {
        set({ loading: true, error: null })
        try {
          const template = await templateService.getTemplate(id)
          set({ currentTemplateId: id, loading: false })
          
          // Apply template to annotation store
          const annotationStore = useAnnotationStore.getState()
          annotationStore.setPhases(template.phases)
        } catch (error) {
          console.error('Failed to select template:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to select template'
          })
        }
      },

      createTemplate: async (data, userId) => {
        set({ loading: true, error: null })
        try {
          const newTemplate = await templateService.createTemplate(data, userId)
          set(state => ({
            templates: [...state.templates, newTemplate],
            currentTemplateId: newTemplate._id,
            loading: false
          }))
        } catch (error) {
          console.error('Failed to create template:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to create template'
          })
        }
      },

      updateTemplate: async (id, data) => {
        set({ loading: true, error: null })
        try {
          const updated = await templateService.updateTemplate(id, data)
          set(state => ({
            templates: state.templates.map(t => t._id === id ? updated : t),
            loading: false
          }))
        } catch (error) {
          console.error('Failed to update template:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to update template'
          })
        }
      },

      deleteTemplate: async (id) => {
        set({ loading: true, error: null })
        try {
          await templateService.deleteTemplate(id)
          set(state => ({
            templates: state.templates.filter(t => t._id !== id),
            currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId,
            loading: false
          }))
        } catch (error) {
          console.error('Failed to delete template:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to delete template'
          })
        }
      },

      applyTemplate: (templateId) => {
        const state = get()
        const template = state.templates.find(t => t._id === templateId)
        if (template) {
          const annotationStore = useAnnotationStore.getState()
          annotationStore.setPhases(template.phases)
          set({ currentTemplateId: templateId })
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'template-store',
      partialize: (state) => ({
        currentTemplateId: state.currentTemplateId
      })
    }
  )
)
