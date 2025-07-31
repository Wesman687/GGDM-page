import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'

interface AuthContextType {
  isAuthenticated: boolean
  isGGMember: boolean
  isAdmin: boolean
  user: any
  loading: boolean
  error: string | null
  retryCount: number
  checkGGMembership: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isGGMember, setIsGGMember] = useState(false)
  const [loading, setLoading] = useState(false) // Start false, only set true when actually checking
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastCheckTime, setLastCheckTime] = useState<number>(0)
  const [hasInitialCheck, setHasInitialCheck] = useState(false)

  // Cache membership check for 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000

  const checkAdminStatus = (discordId: string): boolean => {
    const adminIds = process.env.NEXT_PUBLIC_ADMIN_IDS?.split(',') || []
    return adminIds.includes(discordId)
  }

  const checkGGMembership = useCallback(async (skipCache = false) => {
    if (!session) {
      setIsGGMember(false)
      setLoading(false)
      setError(null)
      setHasInitialCheck(true)
      return
    }

    // Check cache first
    const now = Date.now()
    if (!skipCache && lastCheckTime && (now - lastCheckTime) < CACHE_DURATION && hasInitialCheck) {
      return // Don't even show loading if cached
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await axios.get('/api/verify-gg-member', {
        timeout: 8000, // Reduced timeout
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      setIsGGMember(response.data.isGGMember)
      setLastCheckTime(now)
      setRetryCount(0) // Reset retry count on success
      setHasInitialCheck(true)
      
      if (!response.data.isGGMember) {
        const debugInfo = response.data.debug || {}
        setError(`Not a GG member. Guild ID: ${debugInfo.ggGuildId}, User guilds: ${debugInfo.guildCount}, Timestamp: ${response.data.timestamp}`)
      }
    } catch (error: any) {
      console.error('Error checking GG membership:', error)
      setIsGGMember(false)
      setRetryCount(prev => prev + 1)
      setHasInitialCheck(true)
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setError('Request timed out. The Discord API might be slow. Please try again.')
      } else if (error.response?.status === 503) {
        setError('Discord API is temporarily unavailable. Please try again in a moment.')
      } else if (error.response?.status === 401) {
        setError('Authentication expired. Please sign out and sign back in.')
      } else if (error.response?.status === 429) {
        setError('Rate limited by Discord. Please wait a few seconds and try again.')
      } else {
        const details = error.response?.data?.details || error.message
        setError(`Failed to verify membership: ${details}`)
      }
    } finally {
      setLoading(false)
    }
  }, [session, lastCheckTime, retryCount, hasInitialCheck])

  // Auto-retry with exponential backoff
  useEffect(() => {
    if (error && retryCount < 5 && session) { // Increased retry count to 5
      const retryDelay = Math.min(1000 * Math.pow(1.5, retryCount), 8000) // Gentler backoff, max 8 seconds
      console.log(`Auto-retrying membership check in ${retryDelay}ms (attempt ${retryCount + 1}/5)`)
      
      const timer = setTimeout(() => {
        checkGGMembership(true)
      }, retryDelay)

      return () => clearTimeout(timer)
    }
  }, [error, retryCount, session, checkGGMembership])

  useEffect(() => {
    if (status === 'loading') {
      return // Don't set loading state for NextAuth loading
    }

    if (status === 'unauthenticated') {
      setIsGGMember(false)
      setLoading(false)
      setError(null)
      setHasInitialCheck(true)
      return
    }

    if (session && !hasInitialCheck) {
      checkGGMembership()
    }
  }, [session, status, checkGGMembership, hasInitialCheck])

  const value = {
    isAuthenticated: !!session,
    isGGMember,
    isAdmin: session?.user?.discordId ? checkAdminStatus(session.user.discordId) : false,
    user: session?.user,
    loading: loading && status !== 'loading', // Don't show loading for NextAuth loading
    error,
    retryCount,
    checkGGMembership: () => checkGGMembership(true), // Always skip cache on manual retry
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
