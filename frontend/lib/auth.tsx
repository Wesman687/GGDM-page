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

// Cache membership status in localStorage for persistence
const MEMBERSHIP_CACHE_KEY = 'gg_membership_cache'
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes instead of 5

interface MembershipCache {
  isGGMember: boolean
  timestamp: number
  discordId: string
}

function getCachedMembership(discordId: string): boolean | null {
  if (typeof window === 'undefined') return null
  
  try {
    const cached = localStorage.getItem(MEMBERSHIP_CACHE_KEY)
    if (!cached) return null
    
    const data: MembershipCache = JSON.parse(cached)
    const now = Date.now()
    
    // Check if cache is valid and for the same user
    if (data.discordId === discordId && (now - data.timestamp) < CACHE_DURATION) {
      return data.isGGMember
    }
    
    // Cache expired or different user, clear it
    localStorage.removeItem(MEMBERSHIP_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function setCachedMembership(discordId: string, isGGMember: boolean) {
  if (typeof window === 'undefined') return
  
  try {
    const data: MembershipCache = {
      isGGMember,
      timestamp: Date.now(),
      discordId
    }
    localStorage.setItem(MEMBERSHIP_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore localStorage errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isGGMember, setIsGGMember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasInitialCheck, setHasInitialCheck] = useState(false)
  const [isCheckingMembership, setIsCheckingMembership] = useState(false)

  const checkAdminStatus = (discordId: string): boolean => {
    const adminIds = process.env.NEXT_PUBLIC_ADMIN_IDS?.split(',') || []
    return adminIds.includes(discordId)
  }

  const checkGGMembership = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.discordId) {
      setIsGGMember(false)
      setLoading(false)
      setError(null)
      setHasInitialCheck(true)
      return
    }

    // Check localStorage cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedMembership = getCachedMembership(session.user.discordId)
      if (cachedMembership !== null) {
        setIsGGMember(cachedMembership)
        setError(null)
        setHasInitialCheck(true)
        setLoading(false)
        return
      }
    }

    // Prevent multiple simultaneous checks
    if (isCheckingMembership) {
      return
    }

    try {
      setIsCheckingMembership(true)
      setLoading(true)
      setError(null)
      
      const response = await axios.get('/api/verify-gg-member', {
        timeout: 10000, // Increased timeout
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      const membershipStatus = response.data.isGGMember
      setIsGGMember(membershipStatus)
      setCachedMembership(session.user.discordId, membershipStatus)
      setRetryCount(0) // Reset retry count on success
      setHasInitialCheck(true)
      
      if (!membershipStatus) {
        setError('You must be a member of the GG Discord server to access this feature.')
      }
    } catch (error: any) {
      console.error('Error checking GG membership:', error)
      setIsGGMember(false)
      setRetryCount(prev => prev + 1)
      setHasInitialCheck(true)
      
      // Set user-friendly error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.')
      } else if (error.response?.status === 503) {
        setError('Service temporarily unavailable. Please try again in a moment.')
      } else if (error.response?.status === 401) {
        setError('Your session has expired. Please sign out and sign back in.')
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment before trying again.')
      } else {
        setError('Unable to verify membership. Please try again or contact support if the issue persists.')
      }
    } finally {
      setLoading(false)
      setIsCheckingMembership(false)
    }
  }, [session?.user?.discordId, isCheckingMembership])

  // Auto-retry with exponential backoff (only for network errors, not auth errors)
  useEffect(() => {
    if (error && retryCount < 3 && session && !error.includes('expired') && !error.includes('member')) {
      const retryDelay = Math.min(2000 * Math.pow(2, retryCount), 10000) // More aggressive backoff
      console.log(`Auto-retrying membership check in ${retryDelay}ms (attempt ${retryCount + 1}/3)`)
      
      const timer = setTimeout(() => {
        checkGGMembership(true)
      }, retryDelay)

      return () => clearTimeout(timer)
    }
  }, [error, retryCount, session, checkGGMembership])

  // Initialize membership check only once per session
  useEffect(() => {
    if (status === 'loading') {
      return // Don't set loading state for NextAuth loading
    }

    if (status === 'unauthenticated') {
      setIsGGMember(false)
      setLoading(false)
      setError(null)
      setHasInitialCheck(true)
      // Clear cache when user signs out
      if (typeof window !== 'undefined') {
        localStorage.removeItem(MEMBERSHIP_CACHE_KEY)
      }
      return
    }

    // Only check membership once per session, and only if we haven't checked yet
    if (session?.user?.discordId && !hasInitialCheck) {
      checkGGMembership()
    }
  }, [session?.user?.discordId, status, hasInitialCheck, checkGGMembership])

  const value = {
    isAuthenticated: !!session,
    isGGMember,
    isAdmin: session?.user?.discordId ? checkAdminStatus(session.user.discordId) : false,
    user: session?.user,
    loading: loading && status !== 'loading', // Don't show loading for NextAuth loading
    error,
    retryCount,
    checkGGMembership: () => checkGGMembership(true), // Force refresh on manual retry
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
