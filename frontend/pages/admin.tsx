import React, { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { Suggestion, apiService, Admin, AdminCreate } from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useAuth } from '@/lib/auth'

export default function AdminPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [stats, setStats] = useState({
    total_suggestions: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showAdminManagement, setShowAdminManagement] = useState(false)
  const [newAdminData, setNewAdminData] = useState<AdminCreate>({ discord_id: '', username: '' })
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null)
  const [processingApprovals, setProcessingApprovals] = useState<Set<string>>(new Set())
  const [approvingAll, setApprovingAll] = useState(false)
  const [editFormData, setEditFormData] = useState({
    zone_id: '',
    x: 0,
    y: 0,
    map: 7,
    enabled: true,
    reason: ''
  })
  const { user } = useAuth()

  // Check if current user is super admin
  const superAdminIds = process.env.NEXT_PUBLIC_ADMIN_IDS?.split(',') || []
  const isSuperAdmin = user?.discordId && superAdminIds.includes(user.discordId)

  useEffect(() => {
    loadData()
    if (isSuperAdmin) {
      loadAdmins()
    }
  }, [filter, isSuperAdmin])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load suggestions
      const filterStatus = filter === 'all' ? undefined : filter
      const suggestionsData = await apiService.getSuggestions(filterStatus)
      setSuggestions(suggestionsData)
      
      // Load stats
      const statsData = await apiService.getAdminStats()
      setStats(statsData)
      
    } catch (error) {
      console.error('Failed to load admin data:', error)
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionAction = async (id: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    try {
      setProcessingApprovals(prev => new Set(prev).add(id))
      
      await apiService.updateSuggestion(id, { status, admin_notes: adminNotes })
      toast.success(`Suggestion ${status} successfully!`)
      
      // If approved, show additional message about PR creation
      if (status === 'approved') {
        toast.success('Creating GitHub Pull Request...', { duration: 5000 })
      }
      
      // Reload data after a short delay to allow PR creation to complete
      setTimeout(() => {
        loadData()
        setProcessingApprovals(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      }, 2000)
    } catch (error: any) {
      console.error(`Failed to ${status} suggestion:`, error)
      const errorMessage = error.message || `Failed to ${status} suggestion`
      toast.error(errorMessage, { duration: 10000 })
      setProcessingApprovals(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const handleRetryPR = async (id: string) => {
    try {
      const result = await apiService.retryPR(id)
      toast.success(`GitHub PR created successfully! PR #${result.pr_number}`)
      loadData() // Reload to update the UI
    } catch (error) {
      console.error('Failed to retry PR:', error)
      toast.error('Failed to create GitHub PR. Please try again.')
    }
  }

  const handleApproveAll = async () => {
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
    if (pendingSuggestions.length === 0) {
      toast.error('No pending suggestions to approve')
      return
    }

    try {
      setApprovingAll(true)
      toast.success(`Approving ${pendingSuggestions.length} suggestions...`, { duration: 3000 })

      // Process all approvals in parallel
      const approvalPromises = pendingSuggestions.map(suggestion => 
        apiService.updateSuggestion(suggestion.id, { status: 'approved', admin_notes: 'Bulk approval' })
      )

      await Promise.all(approvalPromises)
      
      toast.success(`Successfully approved ${pendingSuggestions.length} suggestions!`)
      toast.success('Creating GitHub Pull Requests...', { duration: 5000 })
      
      // Reload data after a delay to allow PR creation to complete
      setTimeout(loadData, 3000)
    } catch (error: any) {
      console.error('Failed to approve all suggestions:', error)
      toast.error('Failed to approve all suggestions. Some may have been processed.')
      loadData() // Reload to see which ones succeeded
    } finally {
      setApprovingAll(false)
    }
  }

  const handleEditSuggestion = (suggestion: Suggestion) => {
    setEditingSuggestion(suggestion)
    setEditFormData({
      zone_id: suggestion.zone_id,
      x: suggestion.x || 0,
      y: suggestion.y || 0,
      map: suggestion.map || 7,
      enabled: suggestion.enabled ?? true,
      reason: suggestion.reason
    })
  }

  const handleSaveEdit = async () => {
    if (!editingSuggestion) return

    try {
      // First update the suggestion data via a different endpoint that supports editing
      // For now, we'll need to add this to the API service
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000'}/api/suggestions/${editingSuggestion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: editFormData.zone_id,
          x: editFormData.x,
          y: editFormData.y,
          map: editFormData.map,
          enabled: editFormData.enabled,
          reason: editFormData.reason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update suggestion')
      }
      
      toast.success('Suggestion updated successfully!')
      setEditingSuggestion(null)
      loadData()
    } catch (error) {
      console.error('Failed to update suggestion:', error)
      toast.error('Failed to update suggestion')
    }
  }

  const loadAdmins = async () => {
    try {
      const adminsData = await apiService.getAdmins()
      setAdmins(adminsData)
    } catch (error) {
      console.error('Failed to load admins:', error)
      toast.error('Failed to load admins')
    }
  }

  const handleAddAdmin = async () => {
    if (!user?.discordId) {
      toast.error('User not authenticated')
      return
    }

    try {
      await apiService.addAdmin(newAdminData, user.discordId)
      toast.success('Admin added successfully!')
      setNewAdminData({ discord_id: '', username: '' })
      loadAdmins()
    } catch (error) {
      console.error('Failed to add admin:', error)
      toast.error('Failed to add admin')
    }
  }

  const handleRemoveAdmin = async (discordId: string) => {
    if (!confirm('Are you sure you want to remove this admin?')) return
    if (!user?.discordId) {
      toast.error('User not authenticated')
      return
    }

    try {
      await apiService.removeAdmin(discordId, user.discordId)
      toast.success('Admin removed successfully!')
      loadAdmins()
    } catch (error) {
      console.error('Failed to remove admin:', error)
      toast.error('Failed to remove admin')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getActionIcon = (action: string) => {
    return action === 'add' ? '➕' : '➖'
  }

  return (
    <Layout title="Admin Panel">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Suggestions</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total_suggestions}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                    <dd className="text-lg font-medium text-yellow-600">{stats.pending}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                    <dd className="text-lg font-medium text-green-600">{stats.approved}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">❌</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                    <dd className="text-lg font-medium text-red-600">{stats.rejected}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'all', label: 'All Suggestions', count: stats.total_suggestions },
                { key: 'pending', label: 'Pending', count: stats.pending },
                { key: 'approved', label: 'Approved', count: stats.approved },
                { key: 'rejected', label: 'Rejected', count: stats.rejected }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`${
                    filter === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          {/* Action Buttons */}
          {filter === 'pending' && stats.pending > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approvingAll ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Approving All ({stats.pending})...
                  </>
                ) : (
                  <>
                    ✅ Approve All ({stats.pending})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Suggestions List */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-gray-600">Loading suggestions...</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-gray-500">No suggestions found for this filter.</span>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg">{getActionIcon(suggestion.action)}</span>
                          <h4 className="text-lg font-medium text-gray-900">
                            {suggestion.action === 'add' ? 'Add' : 'Remove'} Dockmaster {suggestion.zone_id}
                          </h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(suggestion.status)}`}>
                            {suggestion.status}
                          </span>
                        </div>

                        <p className="text-gray-700 mb-3">{suggestion.reason}</p>

                        {suggestion.action === 'add' && (
                          <div className="text-sm text-gray-500 mb-2">
                            <strong>Coordinates:</strong> X={suggestion.x}, Y={suggestion.y}, Map={suggestion.map}, 
                            Enabled={suggestion.enabled ? 'Yes' : 'No'}
                          </div>
                        )}

                        <div className="text-sm text-gray-500 space-y-1">
                          <div><strong>Submitted:</strong> {format(new Date(suggestion.created_at), 'PPpp')}</div>
                          {suggestion.submitter_name && (
                            <div><strong>By:</strong> {suggestion.submitter_name}</div>
                          )}
                          {suggestion.submitter_discord && (
                            <div><strong>Discord:</strong> {suggestion.submitter_discord}</div>
                          )}
                          {suggestion.reviewed_at && (
                            <div><strong>Reviewed:</strong> {format(new Date(suggestion.reviewed_at), 'PPpp')}</div>
                          )}
                          {suggestion.admin_notes && (
                            <div><strong>Admin Notes:</strong> {suggestion.admin_notes}</div>
                          )}
                          
                          {/* GitHub PR Status for approved suggestions */}
                          {suggestion.status === 'approved' && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border-l-4 border-blue-400">
                              <div className="text-sm font-medium text-gray-900">GitHub PR Status</div>
                              {suggestion.pr_url ? (
                                <div className="text-sm text-green-600">
                                  ✅ <a href={suggestion.pr_url} target="_blank" rel="noopener noreferrer" className="underline">
                                    PR #{suggestion.pr_number} created successfully
                                  </a>
                                </div>
                              ) : suggestion.pr_error ? (
                                <div className="space-y-2">
                                  <div className="text-sm text-red-600">
                                    ❌ PR creation failed {suggestion.pr_retry_count ? `(${suggestion.pr_retry_count} attempts)` : ''}
                                  </div>
                                  <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                                    {suggestion.pr_error}
                                  </div>
                                  <button
                                    onClick={() => handleRetryPR(suggestion.id)}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                  >
                                    🔄 Retry PR Creation
                                  </button>
                                </div>
                              ) : (
                                <div className="text-sm text-yellow-600">
                                  ⏳ PR creation in progress...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {suggestion.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEditSuggestion(suggestion)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt('Optional admin notes:')
                              handleSuggestionAction(suggestion.id, 'approved', notes || undefined)
                            }}
                            disabled={processingApprovals.has(suggestion.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingApprovals.has(suggestion.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                                Processing...
                              </>
                            ) : (
                              '✅ Approve'
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt('Reason for rejection (required):')
                              if (notes) {
                                handleSuggestionAction(suggestion.id, 'rejected', notes)
                              }
                            }}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Super Admin Management */}
        {isSuperAdmin && (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Admin Management</h3>
                <button
                  onClick={() => setShowAdminManagement(!showAdminManagement)}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  {showAdminManagement ? 'Hide' : 'Manage Admins'}
                </button>
              </div>
            </div>

            {showAdminManagement && (
              <div className="px-6 py-4 space-y-4">
                {/* Add New Admin */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Add New Admin</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Discord ID"
                      value={newAdminData.discord_id}
                      onChange={(e) => setNewAdminData({...newAdminData, discord_id: e.target.value})}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Username"
                      value={newAdminData.username}
                      onChange={(e) => setNewAdminData({...newAdminData, username: e.target.value})}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAddAdmin}
                      disabled={!newAdminData.discord_id || !newAdminData.username}
                      className="inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Admin
                    </button>
                  </div>
                </div>

                {/* Current Admins */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Current Admins</h4>
                  {admins.length === 0 ? (
                    <p className="text-gray-500 text-sm">No admins found.</p>
                  ) : (
                    <div className="space-y-2">
                      {admins.map((admin) => (
                        <div key={admin.discord_id} className="flex justify-between items-center p-2 border border-gray-100 rounded">
                          <div>
                            <span className="font-medium">{admin.username}</span>
                            <span className="text-gray-500 text-sm ml-2">({admin.discord_id})</span>
                            <div className="text-xs text-gray-400">
                              Added by {admin.added_by} on {format(new Date(admin.added_at), 'PPp')}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveAdmin(admin.discord_id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Suggestion Modal */}
        {editingSuggestion && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Edit Suggestion: {editingSuggestion.zone_id}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Zone ID</label>
                    <input
                      type="text"
                      value={editFormData.zone_id}
                      onChange={(e) => setEditFormData({...editFormData, zone_id: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  {editingSuggestion.action === 'add' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">X Coordinate</label>
                          <input
                            type="number"
                            value={editFormData.x}
                            onChange={(e) => setEditFormData({...editFormData, x: parseInt(e.target.value) || 0})}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Y Coordinate</label>
                          <input
                            type="number"
                            value={editFormData.y}
                            onChange={(e) => setEditFormData({...editFormData, y: parseInt(e.target.value) || 0})}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Map</label>
                          <input
                            type="number"
                            value={editFormData.map}
                            onChange={(e) => setEditFormData({...editFormData, map: parseInt(e.target.value) || 7})}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Enabled</label>
                          <select
                            value={editFormData.enabled.toString()}
                            onChange={(e) => setEditFormData({...editFormData, enabled: e.target.value === 'true'})}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea
                      value={editFormData.reason}
                      onChange={(e) => setEditFormData({...editFormData, reason: e.target.value})}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingSuggestion(null)}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
