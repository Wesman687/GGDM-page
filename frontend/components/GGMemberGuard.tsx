import React from 'react'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

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
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        <div className="ml-2 text-gray-600">
          <span>Verifying GG membership...</span>
          {retryCount > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Attempt {retryCount + 1}/5
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-2xl">🔒</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Discord Authentication Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                You need to sign in with Discord to submit Dockmaster suggestions.
                This helps us verify that you're a GG member and track suggestion authorship.
              </p>
            </div>
            <div className="mt-4">
              <Link
                href="/auth/signin"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign in with Discord
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isGGMember) {
    return fallback || (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-2xl">❌</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              GG Membership Required
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>
                You must be a member of the GG Discord server to submit suggestions.
              </p>
              
              {error && (
                <div className="mt-3 p-2 bg-red-100 rounded border border-red-300">
                  <div className="text-xs font-medium text-red-800">Technical Details:</div>
                  <div className="text-xs text-red-700 mt-1">{error}</div>
                  {retryCount > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      Failed after {retryCount} automatic retry attempts (max 5)
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-3">
                <p className="font-medium">Common solutions:</p>
                <ul className="mt-1 list-disc list-inside text-xs">
                  <li>Make sure you're logged into Discord with the correct account</li>
                  <li>Verify you're a member of the GG Discord server</li>
                  <li>Discord API can be slow - wait a moment and try again</li>
                  <li>Sign out and sign back in if the issue persists</li>
                  <li>Contact an administrator if you continue having issues</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={checkGGMembership}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Checking...
                  </>
                ) : (
                  <>🔄 Retry Membership Check</>
                )}
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                🔄 Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
