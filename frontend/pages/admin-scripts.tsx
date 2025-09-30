import React, { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { Script, AIInteractionReview, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { 
  CheckCircle, 
  XCircle, 
  Star, 
  StarOff, 
  Eye, 
  Edit, 
  Trash2, 
  Bot, 
  Code,
  Filter,
  Search
} from 'lucide-react'

export default function AdminScriptsPage() {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'featured' | 'ai-reviews' | 'analytics'>('pending')
  const [pendingScripts, setPendingScripts] = useState<Script[]>([])
  const [approvedScripts, setApprovedScripts] = useState<Script[]>([])
  const [featuredScripts, setFeaturedScripts] = useState<Script[]>([])
  const [aiReviews, setAIReviews] = useState<AIInteractionReview[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    featured: 0,
    ai_reviews_pending: 0
  })
  const [analytics, setAnalytics] = useState<any>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set())
  const [editingReview, setEditingReview] = useState<AIInteractionReview | null>(null)
  const [reviewFormData, setReviewFormData] = useState({
    status: 'approved' as 'approved' | 'rejected' | 'modified',
    admin_notes: '',
    admin_modified_code: ''
  })

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin, activeTab])

  const loadData = async () => {
    if (!user?.discordId) return

    setLoading(true)
    try {
      // Load pending scripts
      const pendingData = await apiService.getPendingScripts(user.discordId, true)
      setPendingScripts(pendingData)

      // Load approved scripts (only GG scripts, not Jasown)
      const approvedData = await apiService.getScripts({ is_approved: true })
      setApprovedScripts(approvedData.filter(s => s.category === 'gg-scripts'))

      // Load featured scripts (only GG scripts, not Jasown)
      const featuredData = await apiService.getScripts({ is_approved: true })
      setFeaturedScripts(featuredData.filter(s => s.is_featured && s.category === 'gg-scripts'))

      // Load AI reviews
      const reviewsData = await apiService.getAIReviews(undefined, user.discordId, true)
      setAIReviews(reviewsData)

      // Load analytics
      const analyticsData = await apiService.getScriptAnalytics(user.discordId, true)
      setStats({
        ...analyticsData.scripts,
        approved: approvedData.length,
        ai_reviews_pending: reviewsData.length
      })
      setAnalytics(analyticsData)
      
      // Load performance monitoring
      try {
        const performanceData = await apiService.getPerformanceMonitoring(user.discordId)
        setPerformance(performanceData)
      } catch (error) {
        console.error('Failed to load performance data:', error)
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveScript = async (scriptId: string) => {
    if (!user?.discordId) return

    setProcessingActions(prev => new Set(prev).add(scriptId))
    try {
      await apiService.approveScript(scriptId, user.discordId, true)
      toast.success('Script approved successfully!')
      loadData()
    } catch (error) {
      console.error('Failed to approve script:', error)
      toast.error('Failed to approve script')
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(scriptId)
        return newSet
      })
    }
  }

  const handleRejectScript = async (scriptId: string) => {
    if (!user?.discordId) return

    const reason = prompt('Reason for rejection:')
    if (!reason) return

    setProcessingActions(prev => new Set(prev).add(scriptId))
    try {
      await apiService.rejectScript(scriptId, reason, user.discordId, true)
      toast.success('Script rejected successfully!')
      loadData()
    } catch (error) {
      console.error('Failed to reject script:', error)
      toast.error('Failed to reject script')
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(scriptId)
        return newSet
      })
    }
  }

  const handleToggleFeatured = async (scriptId: string) => {
    if (!user?.discordId) return

    setProcessingActions(prev => new Set(prev).add(scriptId))
    try {
      await apiService.toggleFeaturedScript(scriptId, user.discordId, true)
      toast.success('Featured status updated!')
      loadData()
    } catch (error) {
      console.error('Failed to toggle featured status:', error)
      toast.error('Failed to update featured status')
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(scriptId)
        return newSet
      })
    }
  }

  const handleEditReview = (review: AIInteractionReview) => {
    setEditingReview(review)
    setReviewFormData({
      status: review.status as 'approved' | 'rejected' | 'modified',
      admin_notes: review.admin_notes || '',
      admin_modified_code: review.admin_modified_code || review.generated_code || ''
    })
  }

  const handleSaveReview = async () => {
    if (!editingReview || !user?.discordId) return

    setProcessingActions(prev => new Set(prev).add(editingReview.id))
    try {
      await apiService.updateAIReview(editingReview.id, reviewFormData, user.discordId, true)
      toast.success('AI review updated successfully!')
      setEditingReview(null)
      loadData()
    } catch (error) {
      console.error('Failed to update AI review:', error)
      toast.error('Failed to update AI review')
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(editingReview.id)
        return newSet
      })
    }
  }

  const handleCreateScriptFromReview = async (review: AIInteractionReview) => {
    if (!user?.discordId) return

    const title = prompt('Script title:')
    if (!title) return

    const author = prompt('Script author:')
    if (!author) return

    const category = prompt('Script category (gg-scripts/jasown-scripts/ai-scripts):')
    if (!category) return

    const tags = prompt('Tags (comma-separated):') || ''

    setProcessingActions(prev => new Set(prev).add(review.id))
    try {
      await apiService.createScriptFromAIReview(
        review.id, 
        title, 
        author, 
        category, 
        tags, 
        user.discordId, 
        true
      )
      toast.success('Script created from AI review successfully!')
      loadData()
    } catch (error) {
      console.error('Failed to create script from review:', error)
      toast.error('Failed to create script from review')
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(review.id)
        return newSet
      })
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
      case 'modified':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isAdmin) {
    return (
      <Layout title="Admin Scripts">
        <div className="text-center py-12">
          <XCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Admin Scripts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Script Administration</h1>
            <p className="text-gray-600 mt-1">
              Manage script approvals, featured scripts, and AI interaction reviews
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Code size={24} className="text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Scripts</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Eye size={24} className="text-yellow-500" />
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
                  <CheckCircle size={24} className="text-green-500" />
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
                  <Star size={24} className="text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Featured</dt>
                    <dd className="text-lg font-medium text-purple-600">{stats.featured}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Bot size={24} className="text-indigo-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">AI Reviews</dt>
                    <dd className="text-lg font-medium text-indigo-600">{stats.ai_reviews_pending}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'pending', label: 'Pending Scripts', count: stats.pending },
                { key: 'approved', label: 'Approved Scripts', count: stats.approved },
                { key: 'featured', label: 'Featured Scripts', count: stats.featured },
                { key: 'ai-reviews', label: 'AI Reviews', count: stats.ai_reviews_pending },
                { key: 'analytics', label: 'Analytics' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          <div className="px-6 py-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            ) : (
              <>
                {/* Pending Scripts Tab */}
                {activeTab === 'pending' && (
                  <div className="space-y-4">
                    {pendingScripts.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle size={48} className="mx-auto text-green-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending scripts</h3>
                        <p className="text-gray-600">All scripts have been reviewed!</p>
                      </div>
                    ) : (
                      pendingScripts.map((script) => (
                        <div key={script.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="text-lg font-medium text-gray-900 mb-2">{script.title}</h4>
                              <p className="text-gray-600 mb-2">by {script.author}</p>
                              <p className="text-sm text-gray-500 mb-3">{script.description}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>Category: {script.category}</span>
                                <span>Tags: {script.tags.join(', ')}</span>
                                <span>Created: {format(new Date(script.created_at), 'PPp')}</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleApproveScript(script.id)}
                                disabled={processingActions.has(script.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingActions.has(script.id) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle size={16} className="mr-1" />
                                    Approve
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleRejectScript(script.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <XCircle size={16} className="mr-1" />
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Approved Scripts Tab */}
                {activeTab === 'approved' && (
                  <div className="space-y-4">
                    {approvedScripts.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No approved scripts</h3>
                        <p className="text-gray-600">No scripts have been approved yet.</p>
                      </div>
                    ) : (
                      approvedScripts.map((script) => (
                        <div key={script.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-lg font-medium text-gray-900">{script.title}</h4>
                                {script.is_featured && (
                                  <Star size={16} className="text-yellow-500" />
                                )}
                              </div>
                              <p className="text-gray-600 mb-2">by {script.author}</p>
                              <p className="text-sm text-gray-500 mb-3">{script.description}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>Category: {script.category}</span>
                                <span>Tags: {script.tags.join(', ')}</span>
                                <span>Created: {format(new Date(script.created_at), 'PPp')}</span>
                                <span>Approved: {script.approved_at ? format(new Date(script.approved_at), 'PPp') : 'Unknown'}</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleToggleFeatured(script.id)}
                                disabled={processingActions.has(script.id)}
                                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md ${
                                  script.is_featured 
                                    ? 'text-white bg-yellow-600 hover:bg-yellow-700' 
                                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {processingActions.has(script.id) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <Star size={16} className="mr-1" />
                                    {script.is_featured ? 'Unfeature' : 'Feature'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Featured Scripts Tab */}
                {activeTab === 'featured' && (
                  <div className="space-y-4">
                    {featuredScripts.length === 0 ? (
                      <div className="text-center py-8">
                        <Star size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No featured scripts</h3>
                        <p className="text-gray-600">Mark scripts as featured to highlight them!</p>
                      </div>
                    ) : (
                      featuredScripts.map((script) => (
                        <div key={script.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Star size={20} className="text-yellow-500" />
                                <h4 className="text-lg font-medium text-gray-900">{script.title}</h4>
                              </div>
                              <p className="text-gray-600 mb-2">by {script.author}</p>
                              <p className="text-sm text-gray-500 mb-3">{script.description}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>Category: {script.category}</span>
                                <span>Tags: {script.tags.join(', ')}</span>
                                <span>Rating: {script.rating_average.toFixed(1)} ({script.rating_count} reviews)</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleToggleFeatured(script.id)}
                                disabled={processingActions.has(script.id)}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingActions.has(script.id) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <StarOff size={16} className="mr-1" />
                                    Remove Featured
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* AI Reviews Tab */}
                {activeTab === 'ai-reviews' && (
                  <div className="space-y-4">
                    {aiReviews.length === 0 ? (
                      <div className="text-center py-8">
                        <Bot size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No AI reviews</h3>
                        <p className="text-gray-600">AI interactions will appear here for review.</p>
                      </div>
                    ) : (
                      aiReviews.map((review) => (
                        <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <Bot size={20} className="text-indigo-500" />
                                <h4 className="text-lg font-medium text-gray-900">
                                  AI Interaction Review
                                </h4>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(review.status || 'pending')}`}>
                                  {review.status || 'pending'}
                                </span>
                              </div>
                              <p className="text-gray-700 mb-3">{review.original_query}</p>
                              {review.generated_code && (
                                <div className="bg-gray-50 rounded-md p-3 mb-3">
                                  <h5 className="text-sm font-medium text-gray-900 mb-2">Generated Code:</h5>
                                  <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                                    {review.generated_code}
                                  </pre>
                                </div>
                              )}
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>Type: {review.interaction_type}</span>
                                <span>User: {review.user_id}</span>
                                <span>Created: {review.created_at ? format(new Date(review.created_at), 'PPp') : 'Unknown'}</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleEditReview(review)}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                <Edit size={16} className="mr-1" />
                                Review
                              </button>
                              {review.status === 'approved' && (
                                <button
                                  onClick={() => handleCreateScriptFromReview(review)}
                                  disabled={processingActions.has(review.id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingActions.has(review.id) ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                                      Creating...
                                    </>
                                  ) : (
                                    <>
                                      <Code size={16} className="mr-1" />
                                      Create Script
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edit Review Modal */}
        {editingReview && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Review AI Interaction
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Original Query</label>
                    <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700">
                      {editingReview.original_query}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Response</label>
                    <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700">
                      {editingReview.ai_response}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={reviewFormData.status}
                      onChange={(e) => setReviewFormData({...reviewFormData, status: e.target.value as any})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="modified">Modified</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                    <textarea
                      value={reviewFormData.admin_notes}
                      onChange={(e) => setReviewFormData({...reviewFormData, admin_notes: e.target.value})}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Add notes about this AI interaction..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Modified Code (if applicable)</label>
                    <textarea
                      value={reviewFormData.admin_modified_code}
                      onChange={(e) => setReviewFormData({...reviewFormData, admin_modified_code: e.target.value})}
                      rows={10}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                      placeholder="Enter modified code here..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingReview(null)}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveReview}
                    disabled={processingActions.has(editingReview.id)}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingActions.has(editingReview.id) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Review'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center">
                          <Code className="h-8 w-8 text-blue-600" />
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Scripts</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics?.scripts?.total || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center">
                          <Star className="h-8 w-8 text-yellow-600" />
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Featured Scripts</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics?.scripts?.featured || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center">
                          <Bot className="h-8 w-8 text-purple-600" />
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">AI Interactions</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics?.ai_interactions || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics?.scripts?.recent_scripts || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Authors */}
                    {analytics?.top_authors && analytics.top_authors.length > 0 && (
                      <div className="bg-white rounded-lg shadow-sm border">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">Top Authors</h3>
                        </div>
                        <div className="p-6">
                          <div className="space-y-4">
                            {analytics.top_authors.slice(0, 10).map((author: any, index: number) => (
                              <div key={author.author} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-medium text-gray-900">{author.author}</p>
                                  <p className="text-sm text-gray-600">
                                    Last activity: {author.last_activity ? format(new Date(author.last_activity), 'MMM dd, yyyy') : 'Unknown'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-blue-600">{author.script_count}</p>
                                  <p className="text-xs text-gray-500">scripts</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Most Active Users */}
                    {analytics?.most_active_users && analytics.most_active_users.length > 0 && (
                      <div className="bg-white rounded-lg shadow-sm border">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">Most Active Users</h3>
                        </div>
                        <div className="p-6">
                          <div className="space-y-4">
                            {analytics.most_active_users.slice(0, 10).map((user: any, index: number) => (
                              <div key={user.user_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-medium text-gray-900">{user.username || `User ${user.user_id.slice(0, 8)}...`}</p>
                                  <p className="text-sm text-gray-600">
                                    Last activity: {user.last_activity ? format(new Date(user.last_activity), 'MMM dd, yyyy') : 'Unknown'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-green-600">{user.interaction_count}</p>
                                  <p className="text-xs text-gray-500">interactions</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Performance Monitoring */}
                    {performance && (
                      <div className="bg-white rounded-lg shadow-sm border">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">System Performance</h3>
                        </div>
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                              <p className="text-sm text-gray-600">Database Performance</p>
                              <p className={`text-2xl font-bold ${performance.database_performance.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                                {performance.database_performance.query_time_ms}ms
                              </p>
                              <p className="text-xs text-gray-500">{performance.database_performance.status}</p>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-sm text-gray-600">AI Service Health</p>
                              <p className={`text-2xl font-bold ${performance.ai_service_health.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                                {performance.ai_service_health.response_time_ms}ms
                              </p>
                              <p className="text-xs text-gray-500">{performance.ai_service_health.status}</p>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-sm text-gray-600">Error Rate</p>
                              <p className={`text-2xl font-bold ${performance.activity_metrics.error_rate_percent < 5 ? 'text-green-600' : 'text-red-600'}`}>
                                {performance.activity_metrics.error_rate_percent}%
                              </p>
                              <p className="text-xs text-gray-500">last hour</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rating Distribution */}
                    {analytics?.rating_distribution && analytics.rating_distribution.length > 0 && (
                      <div className="bg-white rounded-lg shadow-sm border">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">Rating Distribution</h3>
                        </div>
                        <div className="p-6">
                          <div className="space-y-3">
                            {analytics.rating_distribution.map((rating: any) => (
                              <div key={rating.rating} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        size={16}
                                        className={i < rating.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                                      />
                                    ))}
                                  </div>
                                  <span className="ml-2 text-sm text-gray-600">{rating.rating} stars</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-gray-900">{rating.count}</p>
                                  <p className="text-xs text-gray-500">ratings</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
      </div>
    </Layout>
  )
}
