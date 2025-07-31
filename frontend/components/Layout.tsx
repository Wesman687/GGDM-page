import React from 'react'
import Link from 'next/link'
import DiscordAuth from './DiscordAuth'
import { useAuth } from '@/lib/auth'

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

export default function Layout({ children, title = 'Dockmaster Portal' }: LayoutProps) {
  const { isAdmin } = useAuth()
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                🚢 Dockmaster Portal
              </h1>
            </div>
            <div className="flex items-center space-x-8">
              <nav className="flex space-x-8">
                <Link href="/" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  View Dockmasters
                </Link>
                <Link href="/suggest" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Make Suggestion
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                    Admin Panel
                  </Link>
                )}
              </nav>
              <DiscordAuth />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              {title}
            </h2>
          </div>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Dockmaster Suggestion Portal - Manage your GG Dockmasters efficiently
          </p>
        </div>
      </footer>
    </div>
  )
}
