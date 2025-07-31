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
