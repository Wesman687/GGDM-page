import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { api } from '../../lib/api'
import { toast } from 'react-hot-toast'

interface ScriptStats {
  total: number
  approved: number
  pending: number
}

interface UpdateResult {
  message: string
  added: number
  updated: number
  total_processed: number
}

const AdminScriptsPage: React.FC = () => {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<ScriptStats | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/')
      return
    }
    
    fetchStats()
  }, [session, status, router])

  const fetchStats = async () => {
    try {
      const response = await api.get('/scripts/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      toast.error('Failed to fetch script statistics')
    }
  }

  const handleBulkUpdate = async () => {
    setIsUpdating(true)
    try {
      const response = await api.post('/scripts/bulk-update', {
        scripts_data: [] // This would be populated with your scraper data
      })
      
      const result: UpdateResult = response.data
      toast.success(`Updated ${result.updated} scripts, added ${result.added} new scripts`)
      setLastUpdate(new Date().toLocaleString())
      fetchStats()
    } catch (error) {
      console.error('Bulk update failed:', error)
      toast.error('Bulk update failed')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReindexAI = async () => {
    setIsReindexing(true)
    try {
      const response = await api.post('/scripts/reindex-ai')
      toast.success('AI reindexing started successfully')
    } catch (error) {
      console.error('AI reindexing failed:', error)
      toast.error('AI reindexing failed')
    } finally {
      setIsReindexing(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUpdating(true)
    try {
      const fileContent = await file.text()
      const scriptsData = fileContent.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))

      const response = await api.post('/scripts/bulk-update', {
        scripts_data: scriptsData
      })
      
      const result: UpdateResult = response.data
      toast.success(`Updated ${result.updated} scripts, added ${result.added} new scripts`)
      setLastUpdate(new Date().toLocaleString())
      fetchStats()
    } catch (error) {
      console.error('File upload failed:', error)
      toast.error('File upload failed')
    } finally {
      setIsUpdating(false)
    }
  }

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session) {
    return <div>Access denied</div>
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Script Management</h1>
        
        {/* Statistics */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Script Statistics</h2>
          {stats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-gray-600">Total Scripts</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-gray-600">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-gray-600">Pending</div>
              </div>
            </div>
          ) : (
            <div>Loading statistics...</div>
          )}
        </div>

        {/* Update Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Script Updates</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload JSONL File
              </label>
              <input
                type="file"
                accept=".jsonl,.json"
                onChange={handleFileUpload}
                disabled={isUpdating}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleBulkUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Bulk Update'}
              </button>
              
              <button
                onClick={handleReindexAI}
                disabled={isReindexing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isReindexing ? 'Reindexing...' : 'Reindex AI'}
              </button>
            </div>
            
            {lastUpdate && (
              <div className="text-sm text-gray-600">
                Last update: {lastUpdate}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>JSONL Format:</strong> Each line should be a JSON object with the following fields:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>title</code> - Script title</li>
              <li><code>author</code> - Script author</li>
              <li><code>category</code> - Script category</li>
              <li><code>tags</code> - Array of tags</li>
              <li><code>description</code> - Script description</li>
              <li><code>code</code> - Script code content</li>
              <li><code>url</code> - Original script URL</li>
            </ul>
            <p><strong>Automated Scraping:</strong> Use the scheduled scraper for regular updates:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>python scheduled_scraper.py manual [file_path]</code> - Manual update</li>
              <li><code>python scheduled_scraper.py schedule daily</code> - Daily automated scraping</li>
              <li><code>python scheduled_scraper.py once</code> - Run once immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AdminScriptsPage
