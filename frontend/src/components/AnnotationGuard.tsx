import { ReactNode } from 'react'

import { useAuthStore } from '../store/authStore'

interface AnnotationGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * AnnotationGuard - 标注权限守卫组件
 *
 * 检查用户是否具有 annotations.annotate 权限
 * 没有权限时显示 fallback 或禁用子组件
 */
export default function AnnotationGuard({ children, fallback }: AnnotationGuardProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission('annotations.annotate'))

  if (!hasPermission) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center p-4 bg-amber-50 border border-amber-200 rounded-md">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">权限不足</h3>
          <p className="mt-1 text-sm text-gray-500">您没有标注权限，仅能查看现有标注</p>
          <p className="mt-1 text-xs text-gray-400">如需执行标注操作，请联系管理员升级您的权限</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
