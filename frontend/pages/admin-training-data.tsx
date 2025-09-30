import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { BarChart3, TrendingUp, Users, Code, Star, Download, Eye, Filter } from 'lucide-react'

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

export default function AdminTrainingDataPage() {
  const { user, isAdmin } = useAuth()
  const [analytics, setAnalytics] = useState<TrainingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportData, setExportData] = useState<TrainingDataExport | null>(null)
  const [showExportData, setShowExportData] = useState(false)
  const [dateRange, setDateRange] = useState('30') // days

  useEffect(() => {
    if (isAdmin) {
      loadAnalytics()
    }
  }, [isAdmin, dateRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ai/training-analytics?days=${dateRange}&user_id=${user?.discordId}&is_admin=true`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        toast.error('Failed to load training analytics')
      }
    } catch (error) {
      toast.error('Failed to load training analytics')
    } finally {
      setLoading(false)
    }
  }

  const exportTrainingData = async () => {
    try {
      setExportLoading(true)
      const response = await fetch(`/api/ai/export-training-data?user_id=${user?.discordId}&is_admin=true`)
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

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getQualityBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100'
    if (score >= 0.6) return 'bg-yellow-100'
    return 'bg-red-100'
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Training Data Analytics</h1>
              <p className="text-gray-600 mt-2">Monitor AI performance and training data quality</p>
            </div>
            
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

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Loading analytics...</p>
            </div>
          ) : analytics ? (
            <div className="space-y-8">
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

              {/* Quality Trends */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Code Quality Trends</h3>
                </div>
                <div className="p-6">
                  {analytics.quality_trends.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.quality_trends.slice(0, 10).map(([date, quality], index) => (
                        <div key={date} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{date}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${getQualityBgColor(quality)}`}
                                style={{ width: `${quality * 100}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-medium ${getQualityColor(quality)}`}>
                              {(quality * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No quality trend data available</p>
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
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Analytics Data</h3>
              <p className="mt-2 text-gray-600">
                No training data available for the selected time period.
              </p>
            </div>
          )}
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
