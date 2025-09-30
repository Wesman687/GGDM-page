import React from 'react'
import { useAuth } from '@/lib/auth'
import { 
  AuthenticationError, 
  MembershipError, 
  RateLimitError, 
  NetworkError, 
  SessionExpiredError, 
  ServiceUnavailableError 
} from './ErrorPages'

interface GGMemberGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function GGMemberGuard({ children, fallback }: GGMemberGuardProps) {
  const { isAuthenticated, isGGMember, loading, error, retryCount, checkGGMembership } = useAuth()

  // Show content immediately if user is authenticated and verified GG member
  if (isAuthenticated && isGGMember) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Verifying Membership</h3>
          <p className="text-sm text-gray-600">
            Checking your GG Discord server membership...
            {retryCount > 0 && (
              <span className="block mt-1 text-xs text-gray-500">
                Attempt {retryCount + 1}/3
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback || <AuthenticationError />
  }

  if (!isGGMember) {
    // Determine error type and show appropriate error page
    if (error?.includes('expired') || error?.includes('session')) {
      return <SessionExpiredError />
    }
    
    if (error?.includes('Rate limited') || error?.includes('Too many requests')) {
      return <RateLimitError onRetry={checkGGMembership} loading={loading} />
    }
    
    if (error?.includes('timeout') || error?.includes('Connection')) {
      return <NetworkError onRetry={checkGGMembership} loading={loading} />
    }
    
    if (error?.includes('unavailable') || error?.includes('Service')) {
      return <ServiceUnavailableError onRetry={checkGGMembership} loading={loading} />
    }
    
    // Default to membership error for non-GG members
    return <MembershipError onRetry={checkGGMembership} loading={loading} />
  }

  return <>{children}</>
}
