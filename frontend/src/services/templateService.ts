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
  async getTemplates(scope?: 'global' | 'private', userId?: string): Promise<EventTemplate[]> {
    const params = new URLSearchParams()
    if (scope) params.append('scope', scope)
    if (userId) params.append('userId', userId)

    const query = params.toString()
    const response = await apiClient.get(query ? `${BASE_URL}?${query}` : BASE_URL)
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
    data: { name: string; isGlobal: boolean; phases: Phase[] },
    userId?: string
  ): Promise<EventTemplate> {
    const params = userId ? `?userId=${userId}` : ''
    const response = await apiClient.post(`${BASE_URL}${params}`, data)
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
