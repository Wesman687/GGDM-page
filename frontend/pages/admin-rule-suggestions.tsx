import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { Check, X, Eye, Clock, User, MessageSquare } from 'lucide-react'

interface RuleSuggestion {
  id: string
  session_id: string
  user_id: string
  suggestion: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
}

export default function AdminRuleSuggestionsPage() {
  const { user, isAdmin } = useAuth()
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('pending')
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (isAdmin) {
      loadRuleSuggestions()
    }
  }, [isAdmin, selectedStatus])

  const loadRuleSuggestions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ai/rule-suggestions?status=${selectedStatus}&user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      } else {
        toast.error('Failed to load rule suggestions')
      }
    } catch (error) {
      toast.error('Failed to load rule suggestions')
    } finally {
      setLoading(false)
    }
  }

  const updateSuggestion = async (suggestionId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`/api/ai/rule-suggestions/${suggestionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes
        }),
      })

      if (response.ok) {
        toast.success(`Rule suggestion ${status}!`)
        setEditingSuggestion(null)
        setAdminNotes('')
        loadRuleSuggestions()
      } else {
        toast.error('Failed to update rule suggestion')
      }
    } catch (error) {
      toast.error('Failed to update rule suggestion')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check size={16} />
      case 'rejected':
        return <X size={16} />
      default:
        return <Clock size={16} />
    }
  }

  if (!isAdmin) {
    return (
      <GGMemberGuard>
        <Layout>
          <div className="max-w-4xl mx-auto py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
              <p className="text-gray-600">You need admin privileges to access this page.</p>
            </div>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  return (
    <GGMemberGuard>
      <Layout>
        <div className="max-w-6xl mx-auto py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rule Suggestions</h1>
              <p className="text-gray-600 mt-2">Review and manage AI rule suggestions from users</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStatus('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setSelectedStatus('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setSelectedStatus('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Loading rule suggestions...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No suggestions found</h3>
              <p className="mt-2 text-gray-600">
                No rule suggestions found for status: {selectedStatus}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(suggestion.status)}`}>
                        {getStatusIcon(suggestion.status)}
                        {suggestion.status}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <User size={14} />
                        {suggestion.user_id}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock size={14} />
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {suggestion.status === 'pending' && (
                      <button
                        onClick={() => setEditingSuggestion(editingSuggestion === suggestion.id ? null : suggestion.id)}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        <Eye size={14} />
                        {editingSuggestion === suggestion.id ? 'Hide' : 'Review'}
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Suggested Rule:</h3>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                      {suggestion.suggestion}
                    </p>
                  </div>

                  {suggestion.admin_notes && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Admin Notes:</h3>
                      <p className="text-gray-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
                        {suggestion.admin_notes}
                      </p>
                    </div>
                  )}

                  {editingSuggestion === suggestion.id && (
                    <div className="border-t pt-4 mt-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin Notes (Optional)
                        </label>
                        <textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Add notes about this rule suggestion..."
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateSuggestion(suggestion.id, 'approved')}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check size={16} />
                          Approve Rule
                        </button>
                        <button
                          onClick={() => updateSuggestion(suggestion.id, 'rejected')}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <X size={16} />
                          Reject Rule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
