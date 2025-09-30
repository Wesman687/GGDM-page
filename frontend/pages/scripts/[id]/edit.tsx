import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import { Script, ScriptUpdate, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, X } from 'lucide-react'

export default function ScriptEditPage() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin } = useAuth()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    code: '',
    tags: [] as string[],
    language: 'razor' as 'razor' | 'python'
  })

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadScript(id)
    }
  }, [id])

  const loadScript = async (scriptId: string) => {
    setLoading(true)
    setError(null)
    try {
      const scriptData = await apiService.getScript(scriptId)
      setScript(scriptData)
      
      // Check if user can edit this script
      const canEdit = isAdmin || scriptData.created_by === user?.discordId
      if (!canEdit) {
        setError('You do not have permission to edit this script')
        return
      }
      
      // Populate form with existing data
      setFormData({
        title: scriptData.title,
        author: scriptData.author,
        description: scriptData.description || '',
        code: scriptData.full_code || scriptData.code_preview || '',
        tags: scriptData.tags || [],
        language: scriptData.language as 'razor' | 'python'
      })
    } catch (error: any) {
      console.error('Failed to load script:', error)
      setError('Failed to load script')
      toast.error('Failed to load script')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    if (!user?.discordId || !script) return

    if (!formData.title.trim() || !formData.code.trim()) {
      toast.error('Title and code are required')
      return
    }

    setSaving(true)
    try {
      const updateData: ScriptUpdate = {
        title: formData.title,
        author: formData.author,
        description: formData.description,
        code: formData.code,
        tags: formData.tags,
        language: formData.language
      }

      await apiService.updateScript(script.id, updateData, user.discordId, isAdmin)
      toast.success('Script updated successfully!')
      router.push(`/scripts/${script.id}`)
    } catch (error: any) {
      console.error('Failed to update script:', error)
      toast.error('Failed to update script. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push(`/scripts/${id}`)
  }

  if (loading) {
    return (
      <GGMemberGuard>
        <Layout title="Edit Script">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading script...</div>
            </div>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  if (error || !script) {
    return (
      <GGMemberGuard>
        <Layout title="Edit Script">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-red-600">{error || 'Script not found'}</div>
            </div>
          </div>
        </Layout>
      </GGMemberGuard>
    )
  }

  return (
    <GGMemberGuard>
      <Layout title="Edit Script">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Script</span>
              </button>
              <h1 className="text-2xl font-bold">Edit Script</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter script title"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Author *
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter author name"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="razor">Razor</option>
                    <option value="python">Python</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => handleInputChange('tags', e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="fishing, automation, healing"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what this script does..."
                  />
                </div>
              </div>
            </div>

            {/* Code Section */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code *
              </label>
              <textarea
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Enter your script code here..."
              />
            </div>

            {/* Info */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Only the script creator and admins can edit scripts. 
                Changes will be saved immediately and visible to all users.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
