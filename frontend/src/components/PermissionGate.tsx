import { useAuthStore } from '../store/authStore'

interface PermissionGateProps {
  permission: string
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission(permission))

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
