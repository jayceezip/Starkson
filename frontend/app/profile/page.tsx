'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, setStoredAuth } from '@/lib/auth'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!user) {
      router.push('/login')
      return
    }
  }, [user, router, mounted])

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/reset-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      
      setSuccess('Password reset successfully!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setShowResetPassword(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left Side - Profile Icon */}
              <div className="md:w-1/3 bg-gray-100 p-8 flex flex-col items-center justify-center border-r border-gray-200">
                <div className="w-48 h-48 bg-gray-300 rounded-lg flex items-center justify-center mb-6 shadow-inner">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-32 w-32 text-gray-500" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">{user.name}</h2>
                <p className="text-gray-500 text-sm">ID: {user.id}</p>
              </div>

              {/* Right Side - Profile Information */}
              <div className="md:w-2/3 p-8">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-6 border-b-2 border-gray-300 pb-2">About</h2>
                  </div>

                  {/* Role Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Role</h3>
                    <div className="flex items-center">
                      <span className="text-base text-gray-800">{formatRole(user.role)}</span>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'security_officer' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'it_support' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {user.role.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Email Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Email</h3>
                    <p className="text-base text-gray-800">{user.email}</p>
                  </div>

                  {/* Password Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Password</h3>
                    <div className="flex items-center">
                      <p className="text-base text-gray-800 font-mono">••••••••</p>
                      <span className="ml-3 text-xs text-gray-500">(Hidden for security)</span>
                    </div>
                  </div>

                  {/* Reset Password Button */}
                  <div className="pt-4">
                    <button
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-900 transition-colors"
                    >
                      {showResetPassword ? 'Cancel' : 'Reset Password'}
                    </button>
                  </div>

                  {/* Reset Password Form */}
                  {showResetPassword && (
                    <div className="mt-4 p-6 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Current Password</label>
                          <input
                            type="password"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required
                            placeholder="Enter current password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">New Password</label>
                          <input
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required
                            placeholder="Enter new password (min 6 characters)"
                            minLength={6}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                          <input
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required
                            placeholder="Re-enter new password"
                            minLength={6}
                          />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        {success && <p className="text-green-500 text-sm">{success}</p>}
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
