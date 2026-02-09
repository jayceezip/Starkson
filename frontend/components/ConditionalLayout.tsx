'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

// Routes that should not show the sidebar
const NO_SIDEBAR_ROUTES = ['/login', '/register']

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if current route should not have sidebar
  const currentPath = pathname || ''
  const isNoSidebarRoute = NO_SIDEBAR_ROUTES.includes(currentPath)
  
  // Only show sidebar if:
  // 1. Component is mounted (client-side)
  // 2. Not on a no-sidebar route
  const showSidebar = mounted && !isNoSidebarRoute

  // Always render children immediately - don't block them
  // Only conditionally add sidebar wrapper
  if (showSidebar) {
    return (
      <>
        <Sidebar />
        <div className="lg:ml-64 min-h-screen">
          {children}
        </div>
      </>
    )
  }

  // No sidebar for login/register pages or during SSR
  // Render children directly without any wrapper that might interfere
  return <>{children}</>
}
