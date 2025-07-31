import { useEffect, useState } from 'react'
import { DockmasterEntry, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import Link from 'next/link'

const DMList = () => {
  const [dockmasters, setDockmasters] = useState<DockmasterEntry[]>([])
  const [pendingSuggestions, setPendingSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dockmasterData, pendingData] = await Promise.all([
        apiService.getDockmasters(),
        apiService.getSuggestions('pending')
      ])
      setDockmasters(dockmasterData)
      setPendingSuggestions(pendingData)
      setError(null)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data from server')
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        <span className="ml-2 text-gray-600">Loading dockmasters...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={loadData}
              className="mt-2 bg-red-100 px-2 py-1 text-sm text-red-800 rounded hover:bg-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (dockmasters.length === 0 && pendingSuggestions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
        <p className="text-gray-500">No dockmasters or pending suggestions found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {pendingSuggestions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-yellow-800 mb-4">
              ⏳ Pending Suggestions ({pendingSuggestions.length})
            </h3>
            <div className="space-y-4">
              {pendingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-white border border-yellow-200 rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-yellow-600 text-xl">
                      {suggestion.action === 'add' ? '➕' : '➖'}
                    </span>
                    <div>
                      <h4 className="text-sm font-medium text-yellow-900">
                        {suggestion.action === 'add' ? 'Add' : 'Remove'} Dockmaster {suggestion.zone_id}
                      </h4>
                      {suggestion.action === 'add' && (
                        <p className="text-sm text-yellow-800 mt-1">
                          Location: X={suggestion.x}, Y={suggestion.y}
                        </p>
                      )}
                      <p className="text-sm text-yellow-700 mt-1">{suggestion.reason || 'No reason provided'}</p>
                      <p className="text-xs text-yellow-600 mt-2">
                        Submitted by: {suggestion.submitter_name || suggestion.submitter_discord || 'Anonymous'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Current Dockmasters ({dockmasters.length})
            </h3>
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              🔄 Refresh
            </button>
          </div>

          {dockmasters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zone ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coordinates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dockmasters.map((dm) => (
                    <tr key={dm.zone_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dm.zone_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        X: {dm.x}, Y: {dm.y}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            dm.enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {dm.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Link
                            href={`/suggest?action=remove&zone_id=${dm.zone_id}`}
                            className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            🗑️ Remove
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No dockmasters found.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DMList
