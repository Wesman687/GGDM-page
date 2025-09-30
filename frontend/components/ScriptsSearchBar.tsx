import React, { useState, useEffect } from 'react'
import { Search, Filter, X, Bot, User } from 'lucide-react'
import { ScriptSearchFilters, ScriptTag, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface ScriptsSearchBarProps {
  onSearch: (filters: ScriptSearchFilters) => void
  onAISearch: (query: string) => void
  loading?: boolean
}

const ScriptsSearchBar: React.FC<ScriptsSearchBarProps> = ({
  onSearch,
  onAISearch,
  loading = false
}) => {
  const { user } = useAuth()
  const [searchMode, setSearchMode] = useState<'manual' | 'ai'>('manual')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [tags, setTags] = useState<ScriptTag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [ratingMin, setRatingMin] = useState<number>(0)
  const [author, setAuthor] = useState('')
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [selectedTagIndex, setSelectedTagIndex] = useState(-1)

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'gg-scripts', label: 'GG Scripts' },
    { value: 'jasown-scripts', label: 'Jasown Scripts' },
    { value: 'ai-scripts', label: 'AI Scripts' },
    { value: 'python-scripts', label: 'Python Scripts' }
  ]

  const ratingOptions = [
    { value: 0, label: 'Any Rating' },
    { value: 1, label: '1+ Stars' },
    { value: 2, label: '2+ Stars' },
    { value: 3, label: '3+ Stars' },
    { value: 4, label: '4+ Stars' },
    { value: 5, label: '5 Stars' }
  ]

  // Load tags on component mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tagsData = await apiService.getTags()
        setTags(tagsData)
      } catch (error) {
        console.error('Failed to load tags:', error)
      }
    }
    loadTags()
  }, [])

  const handleSearch = () => {
    const filters: ScriptSearchFilters = {
      search_query: searchQuery || undefined,
      category: selectedCategory ? [selectedCategory] : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      author: author || undefined,
      rating_min: ratingMin > 0 ? ratingMin : undefined,
      is_approved: true
    }
    onSearch(filters)
  }

  // Auto-search when filters change (with debounce) - but NOT for searchQuery to prevent focus loss
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchMode === 'manual') {
        handleSearch()
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [selectedCategory, selectedTags, ratingMin, author, searchMode])

  const handleAISearch = () => {
    if (searchQuery.trim()) {
      onAISearch(searchQuery)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchMode === 'ai') {
        handleAISearch()
      } else {
        handleSearch()
      }
    }
  }

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTags([])
    setSelectedCategory('')
    setRatingMin(0)
    setAuthor('')
    // The useEffect will automatically trigger a search when these values change
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (searchQuery) count++
    if (selectedCategory) count++
    if (selectedTags.length > 0) count++
    if (ratingMin > 0) count++
    if (author) count++
    return count
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Search Mode Tabs */}
      <div className="flex mb-4">
        <button
          onClick={() => setSearchMode('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-l-lg border ${
            searchMode === 'manual'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <User size={16} />
          Manual Search
        </button>
        <button
          onClick={() => setSearchMode('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-r-lg border-t border-r border-b ${
            searchMode === 'ai'
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Bot size={16} />
          AI Search
        </button>
      </div>

      {/* Search Input */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              searchMode === 'ai' 
                ? "Ask AI: 'Create a fishing script' or 'Find scripts for dungeon farming'"
                : "Search scripts by name, description, or code..."
            }
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <button
          onClick={searchMode === 'ai' ? handleAISearch : handleSearch}
          disabled={loading || !searchQuery.trim()}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            searchMode === 'ai'
              ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
          }`}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Manual Search Filters */}
      {searchMode === 'manual' && (
        <>
          {/* Filter Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Filter size={16} />
              Advanced Filters
              {getActiveFiltersCount() > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {getActiveFiltersCount()}
                </span>
              )}
            </div>
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X size={14} />
                Clear Filters
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Rating
                </label>
                <select
                  value={ratingMin}
                  onChange={(e) => setRatingMin(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ratingOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Author Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Filter by author..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <div className="space-y-2">
                  {/* Tag Search Input */}
                  <input
                    type="text"
                    placeholder="Search tags..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={tagSearchTerm}
                    onChange={(e) => {
                      const searchTerm = e.target.value.toLowerCase()
                      setTagSearchTerm(searchTerm)
                      setSelectedTagIndex(-1)
                    }}
                    onKeyDown={(e) => {
                      if (!tagSearchTerm) return
                      
                      const filteredTags = tags.filter(tag => 
                        tag.tag_name.toLowerCase().includes(tagSearchTerm)
                      ).slice(0, 10)
                      
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSelectedTagIndex(prev => 
                          prev < filteredTags.length - 1 ? prev + 1 : prev
                        )
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedTagIndex(prev => prev > 0 ? prev - 1 : -1)
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        if (selectedTagIndex >= 0 && selectedTagIndex < filteredTags.length) {
                          const selectedTag = filteredTags[selectedTagIndex]
                          if (!selectedTags.includes(selectedTag.tag_name)) {
                            setSelectedTags([...selectedTags, selectedTag.tag_name])
                          }
                          setTagSearchTerm('')
                          setSelectedTagIndex(-1)
                        }
                      } else if (e.key === 'Escape') {
                        setTagSearchTerm('')
                        setSelectedTagIndex(-1)
                      }
                    }}
                  />
                  
                  {/* Selected Tags Display */}
                  {selectedTags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Selected tags:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTags([])}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Tag Suggestions */}
                  {tagSearchTerm && (
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {tags
                        .filter(tag => tag.tag_name.toLowerCase().includes(tagSearchTerm))
                        .slice(0, 10) // Limit to 10 suggestions
                        .map((tag, index) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (!selectedTags.includes(tag.tag_name)) {
                                setSelectedTags([...selectedTags, tag.tag_name])
                              }
                              setTagSearchTerm('')
                              setSelectedTagIndex(-1)
                            }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                              index === selectedTagIndex 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>{tag.tag_name}</span>
                            <span 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.tag_color }}
                            ></span>
                          </button>
                        ))}
                    </div>
                  )}
                  
                  {/* Popular Tags */}
                  {!tagSearchTerm && selectedTags.length === 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Popular tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {['fishing', 'mining', 'healing', 'magery', 'taming', 'stealth', 'pvp', 'dungeon', 'snippet', 'automation']
                          .map(tagName => {
                            const tag = tags.find(t => t.tag_name === tagName)
                            return tag ? (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => setSelectedTags([tag.tag_name])}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                <span 
                                  className="w-2 h-2 rounded-full mr-1"
                                  style={{ backgroundColor: tag.tag_color }}
                                ></span>
                                {tag.tag_name}
                              </button>
                            ) : null
                          })
                          .filter(Boolean)}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type to search and select tags
                </p>
              </div>
            </div>
        </>
      )}

      {/* AI Search Info */}
      {searchMode === 'ai' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Bot className="text-purple-600 mt-1" size={20} />
            <div>
              <h3 className="font-medium text-purple-900">AI-Powered Search</h3>
              <p className="text-sm text-purple-700 mt-1">
                Ask the AI to find, create, or modify scripts. Examples:
              </p>
              <ul className="text-sm text-purple-600 mt-2 space-y-1">
                <li>• "Create a fishing script for Britannia"</li>
                <li>• "Find scripts for dungeon farming"</li>
                <li>• "Show me healing scripts"</li>
                <li>• "Modify this script to work with my character"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScriptsSearchBar
