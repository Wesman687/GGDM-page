import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import ScriptViewer from '@/components/ScriptViewer'
import CompanionScriptsSection from '@/components/CompanionScriptsSection'
import { Script, ScriptRatingCreate, ScriptRating, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, ExternalLink, Star, Eye, Calendar, User, Tag, Copy } from 'lucide-react'

export default function ScriptDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin } = useAuth()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRating, setUserRating] = useState<number>(0)
  const [userReview, setUserReview] = useState<string>('')
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [ratings, setRatings] = useState<ScriptRating[]>([])
  const [loadingRatings, setLoadingRatings] = useState(false)

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadScript(id)
      loadRatings(id)
    }
  }, [id])

  const loadScript = async (scriptId: string) => {
    setLoading(true)
    setError(null)
    try {
      const scriptData = await apiService.getScript(scriptId)
      setScript(scriptData)
    } catch (error: any) {
      console.error('Failed to load script:', error)
      setError('Script not found')
      toast.error('Failed to load script')
    } finally {
      setLoading(false)
    }
  }

  const loadRatings = async (scriptId: string) => {
    setLoadingRatings(true)
    try {
      const ratingsData = await apiService.getScriptRatings(scriptId)
      setRatings(ratingsData)
    } catch (error: any) {
      console.error('Failed to load ratings:', error)
    } finally {
      setLoadingRatings(false)
    }
  }

  const handleRateScript = async () => {
    if (!user?.discordId || !id || typeof id !== 'string' || userRating === 0) {
      toast.error('Please select a rating')
      return
    }

    setRatingLoading(true)
    try {
      const ratingData: ScriptRatingCreate = {
        rating: userRating,
        review: userReview.trim() || undefined
      }

      await apiService.rateScript(id, ratingData, user.discordId)
      toast.success('Rating submitted successfully!')
      
      // Reload script and ratings to get updated data
      await loadScript(id)
      await loadRatings(id)
      
      // Reset form
      setUserRating(0)
      setUserReview('')
      setShowRatingForm(false)
    } catch (error: any) {
      console.error('Failed to rate script:', error)
      toast.error('Failed to submit rating')
    } finally {
      setRatingLoading(false)
    }
  }

  const handleDownload = () => {
    if (!script) return
    
    const blob = new Blob([script.code_preview || ''], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${script.title}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Script downloaded!')
  }

  const handleCopyToClipboard = async () => {
    if (!script) return
    
    try {
      await navigator.clipboard.writeText(script.code_preview || '')
      toast.success('Script copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy script')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const cleanCodeFromDatabase = (code: string): string => {
    let cleaned = code
    
    // Remove ALL embedded color codes with a comprehensive approach
    // This will catch all variations of embedded color codes
    
    // Pattern 1: Remove "color: #XXXXXX"> patterns anywhere
    cleaned = cleaned.replace(/"color: #[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 2: Remove @#XXXXXX"> patterns anywhere
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 3: Remove #XXXXXX"> patterns anywhere
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 4: Remove complex sequences like @#XXXXXX">"color: #XXXXXX">
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">"color: #[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 5: Remove any remaining color patterns with quotes
    cleaned = cleaned.replace(/"[^"]*color:[^"]*">/g, '')
    
    // Pattern 6: Remove any hex color codes followed by ">
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 7: Remove any @ followed by hex color codes and ">
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 8: Remove standalone hex color codes followed by ">
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
    
    // Pattern 9: Remove any remaining color-related patterns
    cleaned = cleaned.replace(/color:\s*#[0-9a-fA-F]{6}/g, '')
    
    // Pattern 10: Remove any remaining hex color codes
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}/g, '')
    
    // Pattern 11: Remove any remaining @ followed by hex color codes
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}/g, '')
    
    // Pattern 12: Remove any remaining "color: patterns
    cleaned = cleaned.replace(/"color:/g, '')
    
    // Pattern 13: Remove any remaining "> patterns
    cleaned = cleaned.replace(/">/g, '')
    
    // Pattern 14: Remove any remaining @ patterns that might be color codes
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}/g, '')
    
    // Final cleanup - remove any remaining color-related patterns
    cleaned = cleaned.replace(/color:\s*#[0-9a-fA-F]{6}/g, '')
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}/g, '')
    
    return cleaned.trim()
  }

  const renderStars = (rating: number, interactive: boolean = false, onStarClick?: (star: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            className={`${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-500 transition-colors' : ''}`}
            onClick={interactive && onStarClick ? () => onStarClick(star) : undefined}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-600 ml-2">
            {rating.toFixed(1)} ({script?.rating_count} reviews)
          </span>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <GGMemberGuard>
        <Layout title="Loading Script...">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading script...</p>
            </div>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  if (error || !script) {
    return (
      <GGMemberGuard>
        <Layout title="Script Not Found">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Script Not Found</h1>
            <p className="text-gray-600 mb-6">The script you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => router.push('/scripts')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Scripts
            </button>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  return (
    <GGMemberGuard>
      <Layout title={script.title}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/scripts')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Scripts
            </button>
          </div>

          {/* Script Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{script.title}</h1>
                <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <User size={16} />
                    {script.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={16} />
                    {formatDate(script.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={16} />
                    {script.view_count} views
                  </div>
                  <div className="flex items-center gap-1">
                    <Download size={16} />
                    {script.download_count} downloads
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  script.category === 'gg-scripts' ? 'bg-blue-100 text-blue-800' :
                  script.category === 'jasown-scripts' ? 'bg-green-100 text-green-800' :
                  script.category === 'ai-scripts' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {script.category === 'gg-scripts' ? 'GG Scripts' :
                   script.category === 'jasown-scripts' ? 'Jasown Scripts' :
                   script.category === 'ai-scripts' ? 'AI Scripts' :
                   script.category}
                </span>
                {!script.is_approved && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    Pending Approval
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {script.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 leading-relaxed">{script.description}</p>
              </div>
            )}

            {/* Tags */}
            {script.tags && script.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {script.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rating */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rating</h3>
              {renderStars(script.rating_average)}
              
              {/* User Rating Section */}
              {user?.discordId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Rate this Script</h4>
                  
                  {!showRatingForm ? (
                    <button
                      onClick={() => setShowRatingForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      <Star size={16} />
                      Rate Script
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Your Rating
                        </label>
                        {renderStars(userRating, true, setUserRating)}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Your Review (Optional)
                        </label>
                        <textarea
                          value={userReview}
                          onChange={(e) => setUserReview(e.target.value)}
                          placeholder="Share your thoughts about this script..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleRateScript}
                          disabled={ratingLoading || userRating === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Star size={16} />
                          {ratingLoading ? 'Submitting...' : 'Submit Rating'}
                        </button>
                        <button
                          onClick={() => {
                            setShowRatingForm(false)
                            setUserRating(0)
                            setUserReview('')
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Copy size={16} />
                Copy Script
              </button>
              
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Download Script
              </button>
              
            </div>
          </div>

          {/* Companion Scripts */}
          {!script.is_companion && (
            <CompanionScriptsSection 
              mainScriptId={script.id}
              mainScriptTitle={script.title}
              canAddCompanion={isAdmin || script.created_by === user?.discordId}
            />
          )}

          {/* Code Display */}
          {script.code_preview && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Script Code</h3>
              <ScriptViewer
                code={script.code_preview}
                language="razorscript"
                title={script.title}
                maxHeight="600px"
                showLineNumbers={true}
              />
            </div>
          )}

          {/* Comments/Ratings Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviews & Comments</h3>
            
            {loadingRatings ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading reviews...</p>
              </div>
            ) : ratings.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No reviews yet. Be the first to rate this script!</p>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => (
                  <div key={rating.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {rating.user_id.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {rating.is_jasown_rating ? 'Jasown Scripts' : `User ${rating.user_id.slice(-4)}`}
                          </p>
                          <div className="flex items-center gap-2">
                            {renderStars(rating.rating)}
                            <span className="text-sm text-gray-500">
                              {new Date(rating.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {rating.is_jasown_rating && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Official
                        </span>
                      )}
                    </div>
                    {rating.review && (
                      <p className="text-gray-700 mt-2 pl-11">{rating.review}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
