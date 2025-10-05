import axios from 'axios'

// 创建Axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 后续可添加JWT token
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // 全局错误处理
    if (error.response) {
      const { status, data } = error.response

      // 401未授权
      if (status === 401) {
        console.error('Unauthorized access')
        // 后续可添加登出逻辑
      }

      // 404资源不存在
      if (status === 404) {
        console.error('Resource not found:', data.detail)
      }

      // 500服务器错误
      if (status === 500) {
        console.error('Server error:', data.detail)
      }
    } else if (error.request) {
      console.error('Network error:', error.message)
    }

    return Promise.reject(error)
  }
)

export default api
