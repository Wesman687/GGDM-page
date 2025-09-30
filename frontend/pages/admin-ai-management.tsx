import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import MarkdownEditor from '@/components/MarkdownEditor'
import { 
  Settings, 
  Lightbulb, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Code, 
  Star, 
  Download, 
  Eye, 
  Filter,
  CheckCircle,
  XCircle,
  Bot,
  Save,
  Edit,
  Trash2
} from 'lucide-react'

interface TrainingAnalytics {
  total_interactions: number
  average_user_rating: number
  approval_rate: number
  correction_patterns: Record<string, number>
  quality_trends: Array<[string, number]>
  last_updated: string
}

interface TrainingDataExport {
  export_timestamp: string
  total_interactions: number
  total_patterns: number
  total_behaviors: number
  interactions: any[]
  correction_patterns: any[]
  behavior_patterns: any[]
}

interface RuleSuggestion {
  id: string
  session_id: string
  user_id: string
  suggestion: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export default function AIManagementPage() {
  const { user, isAdmin } = useAuth()
  const [activeSection, setActiveSection] = useState<'rules' | 'suggestions' | 'training'>('rules')
  
  // Rules management state
  const [rules, setRules] = useState('')
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesSaving, setRulesSaving] = useState(false)
  
  // Rule suggestions state
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [editingSuggestion, setEditingSuggestion] = useState<RuleSuggestion | null>(null)
  const [suggestionFormData, setSuggestionFormData] = useState({
    status: 'pending' as 'pending' | 'approved' | 'rejected',
    admin_notes: ''
  })
  
  // Training data state
  const [analytics, setAnalytics] = useState<TrainingAnalytics | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportData, setExportData] = useState<TrainingDataExport | null>(null)
  const [showExportData, setShowExportData] = useState(false)
  const [dateRange, setDateRange] = useState('30')

  useEffect(() => {
    if (isAdmin) {
      loadInitialData()
    }
  }, [isAdmin])

  const loadInitialData = async () => {
    await Promise.all([
      loadRules(),
      loadSuggestions(),
      loadAnalytics()
    ])
  }

  const loadRules = async () => {
    try {
      setRulesLoading(true)
      const response = await fetch(`/api/scripts/admin/ai-rules?user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || '')
      } else {
        toast.error('Failed to load AI rules')
      }
    } catch (error) {
      toast.error('Failed to load AI rules')
    } finally {
      setRulesLoading(false)
    }
  }

  const saveRules = async () => {
    try {
      setRulesSaving(true)
      const response = await fetch(`/api/scripts/admin/ai-rules?user_id=${user?.discordId}&is_admin=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      })
      if (response.ok) {
        toast.success('AI rules saved successfully!')
      } else {
        toast.error('Failed to save AI rules')
      }
    } catch (error) {
      toast.error('Failed to save AI rules')
    } finally {
      setRulesSaving(false)
    }
  }

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true)
      const response = await fetch(`/api/scripts/ai/rule-suggestions?user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      }
    } catch (error) {
      toast.error('Failed to load rule suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const updateSuggestion = async (suggestionId: string) => {
    if (!editingSuggestion) return

    try {
      const response = await fetch(`/api/scripts/ai/rule-suggestions/${suggestionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: suggestionFormData.status,
          admin_notes: suggestionFormData.admin_notes,
          reviewed_by: user?.discordId
        })
      })

      if (response.ok) {
        toast.success('Rule suggestion updated successfully!')
        setEditingSuggestion(null)
        loadSuggestions()
      } else {
        toast.error('Failed to update rule suggestion')
      }
    } catch (error) {
      toast.error('Failed to update rule suggestion')
    }
  }

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/scripts/ai/training-analytics?days=${dateRange}&user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Failed to load training analytics:', error)
    }
  }

  const exportTrainingData = async () => {
    try {
      setExportLoading(true)
      const response = await fetch(`/api/scripts/admin/training-data/export?user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setExportData(data)
        setShowExportData(true)
        toast.success('Training data exported successfully!')
      } else {
        toast.error('Failed to export training data')
      }
    } catch (error) {
      toast.error('Failed to export training data')
    } finally {
      setExportLoading(false)
    }
  }

  const downloadExportData = () => {
    if (!exportData) return
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `training-data-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
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
        <div className="max-w-7xl mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">AI Management</h1>
            <p className="text-gray-600 mt-2">Configure AI rules, review suggestions, and analyze training data</p>
          </div>

          {/* Section Navigation */}
          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                {[
                  { key: 'rules', label: 'AI Rules', icon: Settings },
                  { key: 'suggestions', label: 'Rule Suggestions', icon: Lightbulb, count: suggestions.filter(s => s.status === 'pending').length },
                  { key: 'training', label: 'Training Data', icon: BarChart3 }
                ].map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.key}
                      onClick={() => setActiveSection(section.key as any)}
                      className={`${
                        activeSection === section.key
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                      <Icon size={16} />
                      {section.label}
                      {section.count !== undefined && section.count > 0 && (
                        <span className="ml-2 bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
                          {section.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-6 py-6">
              {/* AI Rules Section */}
              {activeSection === 'rules' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">AI Rules Configuration</h2>
                    <button
                      onClick={saveRules}
                      disabled={rulesSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      <Save size={16} />
                      {rulesSaving ? 'Saving...' : 'Save Rules'}
                    </button>
                  </div>

                  {rulesLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <p className="text-gray-600 mt-4">Loading AI rules...</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Rules (Markdown format)
                      </label>
                      <MarkdownEditor
                        value={rules}
                        onChange={setRules}
                        height={600}
                        placeholder="Enter AI rules in Markdown format..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Rule Suggestions Section */}
              {activeSection === 'suggestions' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Rule Suggestions</h2>
                    <button
                      onClick={loadSuggestions}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>

                  {suggestionsLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <p className="text-gray-600 mt-4">Loading suggestions...</p>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="text-center py-8">
                      <Lightbulb size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No rule suggestions</h3>
                      <p className="text-gray-600">User suggestions will appear here for review.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((suggestion) => (
                        <div key={suggestion.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-3">
                              <Lightbulb size={20} className="text-yellow-500" />
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(suggestion.status)}`}>
                                {suggestion.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(suggestion.created_at), 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-gray-900 font-medium">Suggestion:</p>
                            <p className="text-gray-700 mt-1">{suggestion.suggestion}</p>
                          </div>

                          {suggestion.admin_notes && (
                            <div className="mb-3">
                              <p className="text-gray-900 font-medium">Admin Notes:</p>
                              <p className="text-gray-700 mt-1">{suggestion.admin_notes}</p>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              onClick={() => setEditingSuggestion(suggestion)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit Suggestion Modal */}
                  {editingSuggestion && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Review Rule Suggestion</h3>
                          
                          <div className="mb-4">
                            <p className="text-gray-900 font-medium">Suggestion:</p>
                            <p className="text-gray-700 mt-1">{editingSuggestion.suggestion}</p>
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                              value={suggestionFormData.status}
                              onChange={(e) => setSuggestionFormData({...suggestionFormData, status: e.target.value as any})}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                            <textarea
                              value={suggestionFormData.admin_notes}
                              onChange={(e) => setSuggestionFormData({...suggestionFormData, admin_notes: e.target.value})}
                              rows={3}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                              placeholder="Add notes about this suggestion..."
                            />
                          </div>

                          <div className="flex justify-end space-x-3">
                            <button
                              onClick={() => setEditingSuggestion(null)}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateSuggestion(editingSuggestion.id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                              Save Review
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Training Data Section */}
              {activeSection === 'training' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Training Data Analytics</h2>
                    <div className="flex gap-3">
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                      </select>
                      
                      <button
                        onClick={exportTrainingData}
                        disabled={exportLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Download size={16} />
                        {exportLoading ? 'Exporting...' : 'Export Data'}
                      </button>
                    </div>
                  </div>

                  {!analytics ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-gray-600 mt-4">Loading analytics...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                          <div className="flex items-center">
                            <Users className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-600">Total Interactions</p>
                              <p className="text-2xl font-bold text-gray-900">{analytics.total_interactions}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                          <div className="flex items-center">
                            <Star className="h-8 w-8 text-yellow-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-600">Avg User Rating</p>
                              <p className="text-2xl font-bold text-gray-900">{analytics.average_user_rating}/5</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                          <div className="flex items-center">
                            <TrendingUp className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                              <p className="text-2xl font-bold text-gray-900">{analytics.approval_rate}%</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                          <div className="flex items-center">
                            <Code className="h-8 w-8 text-purple-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-600">Correction Patterns</p>
                              <p className="text-2xl font-bold text-gray-900">{Object.keys(analytics.correction_patterns).length}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Correction Patterns */}
                      <div className="bg-white rounded-lg shadow-sm border">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">Most Common Correction Patterns</h3>
                        </div>
                        <div className="p-6">
                          {Object.keys(analytics.correction_patterns).length > 0 ? (
                            <div className="space-y-4">
                              {Object.entries(analytics.correction_patterns)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 10)
                                .map(([pattern, frequency]) => (
                                <div key={pattern} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                  <div>
                                    <p className="font-medium text-gray-900">{pattern.replace('_', ' ').toUpperCase()}</p>
                                    <p className="text-sm text-gray-600">Pattern detected in user corrections</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-blue-600">{frequency}</p>
                                    <p className="text-xs text-gray-500">occurrences</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-center py-8">No correction patterns detected yet</p>
                          )}
                        </div>
                      </div>

                      {/* Export Data Preview */}
                      {showExportData && exportData && (
                        <div className="bg-white rounded-lg shadow-sm border">
                          <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-medium text-gray-900">Training Data Export</h3>
                              <button
                                onClick={downloadExportData}
                                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                <Download size={14} />
                                Download JSON
                              </button>
                            </div>
                          </div>
                          <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{exportData.total_interactions}</p>
                                <p className="text-sm text-gray-600">Interactions</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{exportData.total_patterns}</p>
                                <p className="text-sm text-gray-600">Patterns</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-purple-600">{exportData.total_behaviors}</p>
                                <p className="text-sm text-gray-600">Behaviors</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-gray-600">
                                  {new Date(exportData.export_timestamp).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-600">Export Date</p>
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600 mb-2">Export Summary:</p>
                              <p className="text-sm text-gray-800">
                                This export contains {exportData.total_interactions} AI interactions, 
                                {exportData.total_patterns} correction patterns, and {exportData.total_behaviors} behavior patterns. 
                                The data can be used for training custom AI models or analyzing user interaction patterns.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
