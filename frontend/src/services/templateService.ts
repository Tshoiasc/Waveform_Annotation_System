import { apiClient } from './api'

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

const BASE_URL = '/api/templates'

const templateService = {
  async getTemplates(): Promise<EventTemplate[]> {
    const response = await apiClient.get(BASE_URL)
    if (!response.ok) {
      throw new Error('获取模板列表失败')
    }
    return (await response.json()) as EventTemplate[]
  },

  async getTemplate(id: string): Promise<EventTemplate> {
    const response = await apiClient.get(`${BASE_URL}/${id}`)
    if (!response.ok) {
      throw new Error('获取模板详情失败')
    }
    return (await response.json()) as EventTemplate
  },

  async createTemplate(
    data: { name: string; phases: Phase[] }
  ): Promise<EventTemplate> {
    const response = await apiClient.post(BASE_URL, data)
    if (!response.ok) {
      throw new Error('创建模板失败')
    }
    return (await response.json()) as EventTemplate
  },

  async updateTemplate(id: string, data: { name?: string; phases?: Phase[] }): Promise<EventTemplate> {
    const response = await apiClient.put(`${BASE_URL}/${id}`, data)
    if (!response.ok) {
      throw new Error('更新模板失败')
    }
    return (await response.json()) as EventTemplate
  },

  async deleteTemplate(id: string): Promise<void> {
    const response = await apiClient.delete(`${BASE_URL}/${id}`)
    if (!response.ok) {
      throw new Error('删除模板失败')
    }
  }
}

export default templateService
