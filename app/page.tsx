'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // User is authenticated, redirect to attendance
          router.push('/dashboard/attendance')
        } else {
          // User is not authenticated, redirect to login
          router.push('/auth/login')
        }
      } catch (error) {
        // If there's an error checking auth, redirect to login
        router.push('/auth/login')
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-4">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <h1 className="text-2xl font-bold text-slate-900">QCC Electronic Attendance</h1>
        <p className="text-slate-600">{isChecking ? 'Checking authentication...' : 'Redirecting...'}</p>
      </div>
    </div>
  )
}
