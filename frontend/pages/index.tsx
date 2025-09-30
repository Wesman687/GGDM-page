import React from 'react'
import Layout from '@/components/Layout'
import DMList from '@/components/DMList'

export default function Home() {
  return (
    <Layout title="Current Dockmasters">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                📍 Live from GitHub Repository
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                This list shows the current Dockmasters from the GitHub repository in real-time.
                You can suggest additions or removals using the suggestion form.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800">
                🎮 In-Game DockMaster Utility
              </h3>
              <p className="mt-1 text-sm text-green-700">
                Download our utility to automatically place these Dockmasters on your in-game map. 
                Make sure you run this regularly to stay up-to-date with the latest DockMaster locations!
              </p>
              <div className="mt-3">
                <a
                  href="https://github.com/Wesman687/GGDM/releases/download/v2.01/dm.exe"
                  download
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Download DockMaster Utility (v2.01)
                </a>
              </div>
            </div>
          </div>
        </div>

        <DMList />

        <div className="text-center">
          <a
            href="/suggest"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            ✨ Suggest a Change
          </a>
        </div>
      </div>
    </Layout>
  )
}
