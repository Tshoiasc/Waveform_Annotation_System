import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface Phase {
  id: string
  name: string
  color: string
  shortcut: string
  order: number
}

export interface EventTemplate {
  _id: string
  name: string
  isGlobal: boolean
  createdBy: string | null
  phases: Phase[]
  createdAt: string
  updatedAt: string
}

const templateService = {
  async getTemplates(scope?: 'global' | 'private', userId?: string): Promise<EventTemplate[]> {
    const params = new URLSearchParams()
    if (scope) params.append('scope', scope)
    if (userId) params.append('userId', userId)
    
    const response = await axios.get(`${API_BASE_URL}/api/templates?${params}`)
    return response.data
  },

  async getTemplate(id: string): Promise<EventTemplate> {
    const response = await axios.get(`${API_BASE_URL}/api/templates/${id}`)
    return response.data
  },

  async createTemplate(data: {
    name: string
    isGlobal: boolean
    phases: Phase[]
  }, userId?: string): Promise<EventTemplate> {
    const params = userId ? `?userId=${userId}` : ''
    const response = await axios.post(`${API_BASE_URL}/api/templates${params}`, data)
    return response.data
  },

  async updateTemplate(id: string, data: {
    name?: string
    phases?: Phase[]
  }): Promise<EventTemplate> {
    const response = await axios.put(`${API_BASE_URL}/api/templates/${id}`, data)
    return response.data
  },

  async deleteTemplate(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/templates/${id}`)
  }
}

export default templateService
