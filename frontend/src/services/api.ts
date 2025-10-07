import { useAuthStore } from '../store/authStore'

// 基础 API 前缀：
// - 生产环境推荐留空，配合 Nginx 将 /api 反代到 backend
// - 如需直接访问后端 IP/域名，可在构建时设置 VITE_API_BASE_URL，例如：
//   VITE_API_BASE_URL=http://your-backend:8000
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || ''

class APIClient {
  async request(url: string, options: RequestInit = {}) {
    const token = useAuthStore.getState().token

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }

    // 超时控制：允许通过 options.timeout 指定（毫秒），默认 45s
    const providedSignal = (options as any).signal as AbortSignal | undefined
    const timeoutMs = (options as any).timeout ?? 45000
    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const finalSignal: AbortSignal | undefined = (() => {
      if (providedSignal) return providedSignal
      controller = new AbortController()
      timeoutId = setTimeout(() => controller?.abort(), timeoutMs)
      return controller.signal
    })()

    let response: Response
    try {
      response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
        signal: finalSignal,
      })
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    // 仅在已有登录态（存在 token）时拦截 401 并重定向到登录页
    // 对于登录/注册接口的 401，由各自调用方处理并展示提示
    if (response.status === 401 && token) {
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
