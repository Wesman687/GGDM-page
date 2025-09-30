import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { Save, History, RefreshCw, AlertTriangle } from 'lucide-react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import MarkdownEditor from '@/components/MarkdownEditor'

export default function AIRulesPage() {
  const { user, isAdmin } = useAuth()
  const [rules, setRules] = useState('')
  const [originalRules, setOriginalRules] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load rules on component mount
  useEffect(() => {
    console.log('Component mounted, isAdmin:', isAdmin, 'user:', user)
    if (isAdmin && user?.discordId) {
      console.log('Loading rules for admin user:', user.discordId)
      loadRules()
      loadHistory()
    } else {
      console.log('Not loading rules - isAdmin:', isAdmin, 'user:', user)
    }
  }, [isAdmin, user])

  // Check for changes
  useEffect(() => {
    setHasChanges(rules !== originalRules)
  }, [rules, originalRules])

  const loadRules = async () => {
    if (!user?.discordId) return
    
    setLoading(true)
    try {
      console.log('Loading AI rules for user:', user.discordId)
      const response = await apiService.getAIRules(user.discordId)
      console.log('AI rules response:', response)
      
      if (response.rules) {
        setRules(response.rules)
        setOriginalRules(response.rules)
        toast.success('AI rules loaded successfully')
      } else {
        toast.error('No rules content received')
      }
    } catch (error: any) {
      console.error('Failed to load AI rules:', error)
      toast.error(`Failed to load AI rules: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    if (!user?.discordId) return
    
    try {
      const response = await apiService.getAIRulesHistory(user.discordId)
      setHistory(response.history)
    } catch (error: any) {
      console.error('Failed to load rules history:', error)
    }
  }

  const saveRules = async () => {
    if (!user?.discordId || !rules.trim()) {
      toast.error('Rules cannot be empty')
      return
    }

    setSaving(true)
    try {
      await apiService.updateAIRules(rules, user.discordId)
      setOriginalRules(rules)
      setHasChanges(false)
      toast.success('AI rules updated successfully!')
      await loadHistory() // Refresh history
    } catch (error: any) {
      console.error('Failed to update AI rules:', error)
      toast.error('Failed to update AI rules')
    } finally {
      setSaving(false)
    }
  }

  const restoreFromHistory = async (backupPath: string) => {
    if (!user?.discordId) return
    
    try {
      // This would require a restore endpoint - for now, just show the path
      toast.success(`Backup available at: ${backupPath}`)
    } catch (error: any) {
      console.error('Failed to restore from history:', error)
      toast.error('Failed to restore from history')
    }
  }

  if (!isAdmin) {
    return (
      <GGMemberGuard>
        <Layout title="AI Rules Management">
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Access Denied
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>You must be an administrator to manage AI rules.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  return (
    <GGMemberGuard>
      <Layout title="AI Rules Management">
        <div className="max-w-6xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Rules Management</h1>
              <p className="text-gray-600 mt-2">
                Manage the rules that guide the AI assistant when creating and editing scripts.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <History size={16} />
                {showHistory ? 'Hide' : 'Show'} History
              </button>
              <button
                onClick={loadRules}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* History Panel */}
          {showHistory && (
            <div className="mb-6 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Rules History</h3>
              {history.length === 0 ? (
                <p className="text-gray-500">No backup history available.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((backup, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="font-medium text-gray-900">{backup.filename}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(backup.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreFromHistory(backup.path)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rules Editor */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">AI Rules</h3>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <span className="text-sm text-orange-600 font-medium">
                      Unsaved changes
                    </span>
                  )}
                  <button
                    onClick={saveRules}
                    disabled={!hasChanges || saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Rules
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={24} className="animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading rules...</span>
                </div>
              ) : rules ? (
                <MarkdownEditor
                  value={rules}
                  onChange={setRules}
                  height={600}
                  placeholder="Enter AI rules in Markdown format..."
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No rules loaded. Click Refresh to try again.</p>
                  <div className="space-x-4">
                    <button
                      onClick={loadRules}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Load Rules
                    </button>
                    <button
                      onClick={() => {
                        console.log('Debug info:', { isAdmin, user, discordId: user?.discordId })
                        toast.success(`Debug: isAdmin=${isAdmin}, user=${user?.username}, discordId=${user?.discordId}`)
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Debug Info
                    </button>
                  <button
                    onClick={() => {
                      const sampleRule = `# Test Rule Added ${new Date().toLocaleString()}

This is a test rule to verify the editing functionality works.

## Test Section
- Test bullet point 1
- Test bullet point 2

\`\`\`razor
// Test code block
if findtype "test" backpack as item
    // Test code
endif
\`\`\`
`
                      setRules(sampleRule)
                      toast.success('Sample rule added for testing')
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Add Sample Rule
                  </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>Important:</strong> Changes to AI rules will affect how the AI assistant creates and edits scripts.
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Rules are automatically backed up before each update</li>
                  <li>Use Markdown formatting for better readability</li>
                  <li>Test rule changes with the AI assistant before deploying</li>
                  <li>Consider the impact on existing script generation patterns</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
