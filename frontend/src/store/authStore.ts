import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '../services/api'

interface UserRole {
  name: string
  display_name: string
  permissions: string[]
}

interface User {
  id: string
  username: string
  role: UserRole
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (
    username: string,
    password: string,
    email?: string,
    fullName?: string
  ) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      async login(username, password) {
        const response = await apiClient.post('/api/auth/login', { username, password })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail ?? '登录失败')
        }
        const data = await response.json()

        set({
          user: data.user,
          token: data.access_token,
          isAuthenticated: true
        })
      },
      async register(username, password, email, fullName) {
        const response = await apiClient.post('/api/auth/register', {
          username,
          password,
          email,
          full_name: fullName,
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail ?? '注册失败')
        }
        await get().login(username, password)
      },
      logout() {
        set({ user: null, token: null, isAuthenticated: false })
      },
      hasPermission(permission) {
        const user = get().user
        return user?.role.permissions.includes(permission) ?? false
      }
    }),
    {
      name: 'auth-storage'
    }
  )
)
