import React, { useState } from 'react'
import { Star, Eye, Download, Calendar, User, Tag, Bot, Award } from 'lucide-react'
import { Script, ScriptRatingCreate, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

interface ScriptCardProps {
  script: Script
  onView: (script: Script) => void
  onEdit?: (script: Script) => void
  onDelete?: (script: Script) => void
  onToggleFeatured?: (script: Script) => void
  showActions?: boolean
}

const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  onView,
  onEdit,
  onDelete,
  onToggleFeatured,
  showActions = true
}) => {
  const { user, isAdmin } = useAuth()
  const [isRating, setIsRating] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)

  const categoryColors = {
    'gg-scripts': 'bg-blue-100 text-blue-800',
    'jasown-scripts': 'bg-green-100 text-green-800',
    'ai-scripts': 'bg-purple-100 text-purple-800'
  }

  const categoryLabels = {
    'gg-scripts': 'GG Scripts',
    'jasown-scripts': 'Jasown Scripts',
    'ai-scripts': 'AI Scripts'
  }

  const handleRating = async (rating: number) => {
    if (!user?.discordId || isRating) return

    setIsRating(true)
    try {
      const ratingData: ScriptRatingCreate = {
        rating,
        review: ''
      }
      await apiService.rateScript(script.id, ratingData, user.discordId)
      setUserRating(rating)
      toast.success('Rating submitted!')
    } catch (error: any) {
      toast.error('Failed to submit rating')
    } finally {
      setIsRating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => interactive && handleRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            disabled={!interactive || isRating}
            className={`${
              interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            } transition-transform`}
          >
            <Star
              size={16}
              className={`${
                star <= (hoverRating || rating)
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                {script.title}
              </h3>
              {script.is_featured && (
                <Award size={16} className="text-yellow-500" />
              )}
              {script.category === 'ai-scripts' && (
                <Bot size={16} className="text-purple-600" />
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <User size={14} />
                {script.author}
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(script.created_at)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              categoryColors[script.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-800'
            }`}>
              {categoryLabels[script.category as keyof typeof categoryLabels] || script.category}
            </span>
            {!script.is_approved && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Description */}
        {script.description && (
          <p className="text-gray-700 text-sm mb-3 line-clamp-2">
            {script.description}
          </p>
        )}

        {/* Code Preview - Removed from list view */}

        {/* Tags */}
        {script.tags && script.tags.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {script.tags.slice(0, 5).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {script.tags.length > 5 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  +{script.tags.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
            {script.language === 'python' ? '🐍 Python' : '🔧 Razor'}
          </span>
          <div className="flex items-center gap-1">
            <Eye size={14} />
            {script.view_count} views
          </div>
          <div className="flex items-center gap-1">
            <Download size={14} />
            {script.download_count} downloads
          </div>
        </div>

        {/* Current Rating Display */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          {renderStars(script.rating_average)}
          <span className="text-xs text-gray-500">
            {script.rating_average > 0 
              ? `${script.rating_average.toFixed(1)} (${script.rating_count} ${script.rating_count === 1 ? 'rating' : 'ratings'})`
              : 'No ratings yet'
            }
          </span>
        </div>

        {/* Rating Section */}
        {user && (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700 mb-3">Rate this script:</p>
            <div className="mb-4">
              {renderStars(userRating || script.rating_average, true)}
            </div>
            <div>
              <textarea
                placeholder="Add a comment (optional)..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => onView(script)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Script
              </button>
              {script.exe_download_url && (
                <a
                  href={script.exe_download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download size={14} className="inline mr-1" />
                  Download .exe
                </a>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Featured Toggle Button (Admin Only) */}
              {isAdmin && onToggleFeatured && script.is_approved && (
                <button
                  onClick={() => onToggleFeatured(script)}
                  className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                    script.is_featured
                      ? 'text-yellow-700 bg-yellow-100 border-yellow-300 hover:bg-yellow-200'
                      : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={script.is_featured ? 'Remove from featured' : 'Mark as featured'}
                >
                  {script.is_featured ? (
                    <>
                      <Award size={14} className="inline mr-1" />
                      Featured
                    </>
                  ) : (
                    <>
                      <Star size={14} className="inline mr-1" />
                      Feature
                    </>
                  )}
                </button>
              )}
              
              {/* Edit/Delete Buttons */}
              {(isAdmin || script.created_by === user?.discordId) && (
                <>
                  {onEdit && (isAdmin || script.created_by === user?.discordId) && (
                    <button
                      onClick={() => onEdit(script)}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (isAdmin || script.created_by === user?.discordId) && (
                    <button
                      onClick={() => onDelete(script)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ScriptCard
