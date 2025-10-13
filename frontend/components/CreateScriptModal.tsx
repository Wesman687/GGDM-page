import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { ScriptCreate, ScriptTag, apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { X, Save, Tag, Code, FileText, Download } from 'lucide-react'
import ItemValidationModal from './ItemValidationModal'
import axios from 'axios'

interface CreateScriptModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  parentScriptId?: string  // If provided, this is a companion script
  parentScriptTitle?: string  // For display purposes
}

export default function CreateScriptModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  parentScriptId,
  parentScriptTitle 
}: CreateScriptModalProps) {
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<ScriptTag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [selectedTagIndex, setSelectedTagIndex] = useState(-1)
  const [showItemValidation, setShowItemValidation] = useState(false)
  const [createdScriptId, setCreatedScriptId] = useState<string | null>(null)
  const [executionOrder, setExecutionOrder] = useState<number | undefined>(undefined)
  
  // Check if this is a companion script
  const isCompanion = !!parentScriptId
  
  const [formData, setFormData] = useState<ScriptCreate>({
    title: '',
    author: user?.username || '',
    language: 'razor',
    tags: [],
    description: '',
    code: '',
    exe_download_url: '',
    parent_script_id: parentScriptId,
    is_companion: isCompanion,
    execution_order: undefined
  })

  // Load tags and available scripts on component mount
  useEffect(() => {
    if (isOpen) {
      const loadTags = async () => {
        try {
          const tagsData = await apiService.getTags()
          setTags(tagsData)
        } catch (error) {
          console.error('Failed to load tags:', error)
        }
      }
      
      loadTags()
    }
  }, [isOpen])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        author: user?.username || '',
        language: 'razor',
        tags: [],
        description: '',
        code: '',
        exe_download_url: '',
        parent_script_id: parentScriptId,
        is_companion: isCompanion,
        execution_order: undefined
      })
      setSelectedTags([])
      setTagSearchTerm('')
      setSelectedTagIndex(-1)
      setExecutionOrder(undefined)
    }
  }, [isOpen, user?.username, parentScriptId, isCompanion])

  const languages = [
    { value: 'razor', label: 'Razor Enhanced', icon: '🔧' },
    { value: 'python', label: 'Python', icon: '🐍' }
  ]

  const handleInputChange = (field: keyof ScriptCreate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  /**
   * Handle form submission - validates items first, then shows validation modal
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.discordId) {
      toast.error('You must be logged in to create a script')
      return
    }

    if (!formData.title.trim() || !formData.code.trim()) {
      toast.error('Title and code are required')
      return
    }

    // Show item validation modal
    setShowItemValidation(true)
  }

  /**
   * Called after items are validated - creates the script
   */
  const handleItemValidationComplete = async () => {
    setShowItemValidation(false)
    setLoading(true)
    
    try {
      const submitData = {
        ...formData,
        author: user?.username || '', // Always use Discord username
        tags: selectedTags,
        parent_script_id: parentScriptId,
        is_companion: isCompanion,
        execution_order: executionOrder
      }
      const response = await apiService.createScript(submitData, user!.discordId, isAdmin)
      
      // Store script ID for linking items
      if (response.id) {
        setCreatedScriptId(response.id)
        
        // Link script to items
        await linkScriptToItems(response.id, submitData.title, submitData.code)
      }
      
      // Show the message from the API response
      if (response.message) {
        toast.success(response.message)
      } else {
        toast.success('Script submitted successfully! It will be reviewed by an admin.')
      }
      
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Failed to create script:', error)
      toast.error('Failed to create script. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Link created script to its referenced items
   */
  const linkScriptToItems = async (scriptId: string, title: string, code: string) => {
    try {
      await axios.post('/api/items/link-script-to-items', {
        script_id: scriptId,
        script_title: title,
        script_code: code
      })
    } catch (error) {
      console.error('Error linking script to items:', error)
      // Don't fail the whole process if linking fails
    }
  }

  /**
   * Handle canceling item validation
   */
  const handleItemValidationCancel = () => {
    setShowItemValidation(false)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Item Validation Modal */}
      {showItemValidation && (
        <ItemValidationModal
          scriptCode={formData.code}
          onComplete={handleItemValidationComplete}
          onCancel={handleItemValidationCancel}
        />
      )}

      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-4 sm:align-middle sm:max-w-5xl sm:w-full">
            <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {isCompanion ? `Add Companion Script${parentScriptTitle ? ` to ${parentScriptTitle}` : ''}` : 'Create New Script'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Script Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Script Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter script title..."
                    required
                  />
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language *
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    {languages.map(lang => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => handleInputChange('language', lang.value)}
                        className={`p-3 border rounded-md text-sm font-medium transition-colors ${
                          formData.language === lang.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{lang.icon}</span>
                          {lang.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Python .exe URL (only show for Python) */}
                {formData.language === 'python' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Download size={16} className="inline mr-1" />
                      .exe Download URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.exe_download_url || ''}
                      onChange={(e) => handleInputChange('exe_download_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/download.exe"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Provide a download link for the compiled Python executable
                    </p>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag size={16} className="inline mr-1" />
                    Tags
                  </label>
                  <div className="space-y-2">
                    {/* Tag Search Input */}
                    <input
                      type="text"
                      placeholder="Type to search tags or add new ones..."
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
                          } else if (tagSearchTerm.trim()) {
                            // Add new tag if it doesn't exist
                            const newTag = tagSearchTerm.trim()
                            if (!selectedTags.includes(newTag) && selectedTags.length < 5) {
                              setSelectedTags([...selectedTags, newTag])
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
                          <span className="text-sm text-gray-600">Selected tags ({selectedTags.length}/5):</span>
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
                                if (!selectedTags.includes(tag.tag_name) && selectedTags.length < 5) {
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
                        {/* Add new tag option */}
                        {!tags.some(tag => tag.tag_name.toLowerCase() === tagSearchTerm.toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedTags.includes(tagSearchTerm.trim()) && selectedTags.length < 5) {
                                setSelectedTags([...selectedTags, tagSearchTerm.trim()])
                              }
                              setTagSearchTerm('')
                              setSelectedTagIndex(-1)
                            }}
                            className="w-full px-3 py-2 text-left text-sm bg-green-50 text-green-700 hover:bg-green-100"
                          >
                            + Add "{tagSearchTerm.trim()}" as new tag
                          </button>
                        )}
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
                                  onClick={() => {
                                    if (!selectedTags.includes(tag.tag_name) && selectedTags.length < 5) {
                                      setSelectedTags([tag.tag_name])
                                    }
                                  }}
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
                    Type to search existing tags or add new ones. Maximum 5 tags.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-1" />
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe what this script does..."
                  />
                </div>

                {/* Companion Script Info */}
                {isCompanion && parentScriptTitle && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">
                        Companion Script for: {parentScriptTitle}
                      </h4>
                      <p className="text-xs text-blue-700">
                        This script will work together with the main script. It will be displayed alongside it.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Execution Order (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={executionOrder || ''}
                        onChange={(e) => setExecutionOrder(parseInt(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 1, 2, 3..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        If there are multiple companion scripts, use this to set the order (1 = first, 2 = second, etc.)
                      </p>
                    </div>
                  </div>
                )}

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Code size={16} className="inline mr-1" />
                    Script Code *
                  </label>
                  <textarea
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Paste your script code here..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste your complete script code. This will be reviewed by administrators.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Submit Script
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </>
  )
}
