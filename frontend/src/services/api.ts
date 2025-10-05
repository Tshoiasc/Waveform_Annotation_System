import { useAuthStore } from '../store/authStore'

class APIClient {
  async request(url: string, options: RequestInit = {}) {
    const token = useAuthStore.getState().token

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (response.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      throw new Error('认证已过期，请重新登录')
    }

    return response
  }

  async get(url: string, options: RequestInit = {}) {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url: string, data?: unknown, options: RequestInit = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async put(url: string, data?: unknown, options: RequestInit = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async patch(url: string, data?: unknown, options: RequestInit = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async delete(url: string, options: RequestInit = {}) {
    return this.request(url, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new APIClient()
