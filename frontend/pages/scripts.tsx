import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import ScriptsSearchBar from '@/components/ScriptsSearchBar'
import ScriptCard from '@/components/ScriptCard'
import AIBotInterface from '@/components/AIBotInterface'
import CreateScriptModal from '@/components/CreateScriptModal'
import { Script, ScriptSearchFilters, AIBotResponse, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { useRouter } from 'next/router'
import { Plus, Bot, Filter, Grid, List, Star, Package } from 'lucide-react'

export default function ScriptsPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [scripts, setScripts] = useState<Script[]>([])
  const [featuredScripts, setFeaturedScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(false)
  const [aiResponse, setAIResponse] = useState<AIBotResponse | null>(null)
  const [showAIBot, setShowAIBot] = useState(false)
  const [aiQuery, setAIQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [activeSection, setActiveSection] = useState<'all' | 'featured'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load scripts on component mount
  useEffect(() => {
    loadScripts()
  }, [])

  const loadScripts = async (filters?: ScriptSearchFilters) => {
    setLoading(true)
    try {
      const scriptsData = await apiService.getScripts(filters)
      setScripts(scriptsData)
      
      // Also load featured scripts
      const featuredData = await apiService.getFeaturedScripts()
      setFeaturedScripts(featuredData)
    } catch (error: any) {
      console.error('Failed to load scripts:', error)
      toast.error('Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (filters: ScriptSearchFilters) => {
    loadScripts(filters)
  }

  const handleAISearch = async (query: string) => {
    if (!user?.discordId) return

    setAIQuery(query)
    setShowAIBot(true)
  }

  const handleViewScript = (script: Script) => {
    // Navigate to script detail page
    window.location.href = `/scripts/${script.id}`
  }

  const handleEditScript = (script: Script) => {
    // Navigate to edit page
    window.location.href = `/scripts/${script.id}/edit`
  }

  const handleDeleteScript = async (script: Script) => {
    if (!user?.discordId || !isAdmin) return

    if (confirm(`Are you sure you want to delete "${script.title}"?`)) {
      try {
        await apiService.deleteScript(script.id, user.discordId, isAdmin)
        toast.success('Script deleted successfully')
        loadScripts() // Reload scripts
      } catch (error: any) {
        toast.error('Failed to delete script')
      }
    }
  }

  const handleCreateScript = () => {
    setShowCreateModal(true)
  }

  const handleCreateSuccess = () => {
    loadScripts() // Reload scripts after successful creation
  }

  const handleToggleFeatured = async (script: Script) => {
    if (!user?.discordId || !isAdmin) return

    try {
      await apiService.toggleFeaturedScript(script.id, user.discordId, true)
      toast.success(`Script ${script.is_featured ? 'removed from' : 'added to'} featured scripts!`)
      // Reload both regular and featured scripts
      loadScripts()
    } catch (error: any) {
      console.error('Failed to toggle featured status:', error)
      console.error('Error details:', error.response?.data || error.message)
      toast.error(`Failed to update featured status: ${error.response?.data?.detail || error.message}`)
    }
  }

  return (
    <GGMemberGuard>
      <Layout title="">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Scripts</h1>
              <p className="text-gray-600 mt-1">
                Browse, search, and manage GG scripts, Jasown scripts, and AI-generated scripts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/items')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Package size={16} />
                Manage Items
              </button>
              <button
                onClick={() => setShowAIBot(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Bot size={16} />
                AI Assistant
              </button>
              <button
                onClick={handleCreateScript}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Upload Script
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <ScriptsSearchBar
            onSearch={handleSearch}
            onAISearch={handleAISearch}
            loading={loading}
          />


          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Section Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <button
                  onClick={() => setActiveSection('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    activeSection === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Scripts
                </button>
                <button
                  onClick={() => setActiveSection('featured')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    activeSection === 'featured'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Star size={14} className="inline mr-1" />
                  Featured Only
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">View:</span>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${
                    viewMode === 'list'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                {activeSection === 'featured' ? featuredScripts.length : scripts.length} script{(activeSection === 'featured' ? featuredScripts.length : scripts.length) !== 1 ? 's' : ''} found
                {activeSection === 'featured' && ' (featured only)'}
              </div>
            </div>

          </div>

          {/* Scripts Grid/List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (activeSection === 'featured' ? featuredScripts : scripts).length === 0 ? (
            <div className="text-center py-12">
              <Bot size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeSection === 'featured' ? 'No featured scripts' : 'No scripts found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {activeSection === 'featured' 
                  ? 'No scripts have been marked as featured yet.' 
                  : 'Try adjusting your search criteria or upload a new script'
                }
              </p>
              {activeSection !== 'featured' && (
                <button
                  onClick={handleCreateScript}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  Upload Your First Script
                </button>
              )}
            </div>
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {(activeSection === 'featured' ? featuredScripts : scripts).map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onView={handleViewScript}
                  onEdit={handleEditScript}
                  onDelete={isAdmin ? handleDeleteScript : undefined}
                  onToggleFeatured={isAdmin ? handleToggleFeatured : undefined}
                  showActions={true}
                />
              ))}
            </div>
          )}

          {/* AI Bot Interface */}
          <AIBotInterface
            isOpen={showAIBot}
            onClose={() => setShowAIBot(false)}
            initialQuery={aiQuery}
          />

          {/* Create Script Modal */}
          <CreateScriptModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        </div>
      </Layout>
    </GGMemberGuard>
  )
}
