import React from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  title: string
  message: string
  action?: {
    text: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    text: string
    href: string
  }
  icon?: string
}

export function ErrorPage({ 
  title, 
  message, 
  action, 
  secondaryAction, 
  icon = '⚠️' 
}: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center text-6xl">
            {icon}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {title}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {message}
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          {action && (
            <button
              onClick={action.onClick}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                action.variant === 'secondary'
                  ? 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {action.text}
            </button>
          )}
          
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {secondaryAction.text}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function AuthenticationError() {
  return (
    <ErrorPage
      title="Authentication Required"
      message="You need to sign in with Discord to access this feature. This helps us verify that you're a GG member and track suggestion authorship."
      action={{
        text: "Sign in with Discord",
        onClick: () => window.location.href = '/auth/signin'
      }}
      icon="🔒"
    />
  )
}

export function MembershipError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <ErrorPage
      title="GG Membership Required"
      message="You must be a member of the GG Discord server to access this feature. Please join our Discord server and try again."
      action={{
        text: loading ? "Checking..." : "Retry Membership Check",
        onClick: onRetry,
        variant: 'primary'
      }}
      secondaryAction={{
        text: "Join GG Discord Server",
        href: "https://discord.gg/gg" // Replace with actual Discord invite
      }}
      icon="❌"
    />
  )
}

export function RateLimitError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <ErrorPage
      title="Please Wait"
      message="We're experiencing high traffic. Please wait a moment before trying again."
      action={{
        text: loading ? "Checking..." : "Try Again",
        onClick: onRetry,
        variant: 'primary'
      }}
      secondaryAction={{
        text: "Go to Home",
        href: "/"
      }}
      icon="⏳"
    />
  )
}

export function NetworkError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <ErrorPage
      title="Connection Problem"
      message="We're having trouble connecting to our servers. Please check your internet connection and try again."
      action={{
        text: loading ? "Retrying..." : "Try Again",
        onClick: onRetry,
        variant: 'primary'
      }}
      secondaryAction={{
        text: "Refresh Page",
        href: "#"
      }}
      icon="🌐"
    />
  )
}

export function SessionExpiredError() {
  return (
    <ErrorPage
      title="Session Expired"
      message="Your authentication session has expired. Please sign in again to continue."
      action={{
        text: "Sign In Again",
        onClick: () => window.location.href = '/auth/signin'
      }}
      secondaryAction={{
        text: "Go to Home",
        href: "/"
      }}
      icon="⏰"
    />
  )
}

export function ServiceUnavailableError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <ErrorPage
      title="Service Temporarily Unavailable"
      message="Our authentication service is temporarily down. Please try again in a few moments."
      action={{
        text: loading ? "Checking..." : "Try Again",
        onClick: onRetry,
        variant: 'primary'
      }}
      secondaryAction={{
        text: "Go to Home",
        href: "/"
      }}
      icon="🔧"
    />
  )
}
