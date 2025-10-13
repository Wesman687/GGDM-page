import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface DockmasterEntry {
  zone_id: string
  x: number
  y: number
  map: number
  enabled: boolean
}

export interface SuggestionCreate {
  action: 'add' | 'remove'
  zone_id: string
  x?: number
  y?: number
  map?: number
  enabled?: boolean
  reason: string
  submitter_name?: string
  submitter_discord?: string
}

export interface Suggestion extends SuggestionCreate {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  reviewed_by?: string
  admin_notes?: string
  pr_url?: string
  pr_number?: number
  pr_error?: string
  pr_retry_count?: number
}

export interface Admin {
  discord_id: string
  username: string
  added_by: string
  added_at: string
  is_active: boolean
}

export interface AdminCreate {
  discord_id: string
  username: string
}

// Scripts-related types
export interface ScriptCreate {
  title: string
  author: string
  language: 'razor' | 'python'
  tags: string[]
  description?: string
  code: string
  exe_download_url?: string
  parent_script_id?: string
  is_companion?: boolean
  execution_order?: number
}

export interface ScriptUpdate {
  title?: string
  author?: string
  language?: 'razor' | 'python'
  tags?: string[]
  description?: string
  code?: string
  exe_download_url?: string
  parent_script_id?: string
  is_companion?: boolean
  execution_order?: number
}

export interface Script {
  id: string
  title: string
  author: string
  category: string
  language: string
  tags: string[]
  description?: string
  code_preview?: string
  full_code?: string
  full_code_url?: string
  exe_download_url?: string
  rating_average: number
  rating_count: number
  view_count: number
  download_count: number
  is_approved: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
  created_by?: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  message?: string
  parent_script_id?: string
  is_companion?: boolean
  execution_order?: number
}

export interface ScriptRatingCreate {
  rating: number
  review?: string
}

export interface ScriptRating {
  id: string
  script_id: string
  user_id: string
  rating: number
  review?: string
  weight: number
  is_jasown_rating: boolean
  created_at: string
}

export interface ScriptSearchFilters {
  category?: string[]
  tags?: string[]
  author?: string
  rating_min?: number
  search_query?: string
  is_approved?: boolean
}

export interface ScriptTag {
  id: number
  tag_name: string
  tag_color: string
  tag_category: string
  is_active: boolean
  created_at: string
}

export interface ScriptTagCreate {
  tag_name: string
  tag_color?: string
  tag_category?: string
}

export interface AIBotRequest {
  question: string
  session_id: string
  k?: number
  rules_version?: string
}

export interface AIBotResponse {
  answer: string
  code?: string
  citations: Array<{ title: string; url: string }>
  rules_version: string
  model_version: string
  context_used?: any[]
}

export interface AIFeedbackSubmit {
  id: string
  question: string
  context_used?: any[]
  assistant_output: any
  human_feedback: any
  rules_version: string
  model_version: string
  rating?: number
}

export interface AIInteractionReview {
  id: string
  session_id: string
  user_id: string
  interaction_type: string
  original_query: string
  ai_response: string
  generated_code?: string
  status?: 'approved' | 'rejected' | 'modified'
  admin_notes?: string
  admin_modified_code?: string
  created_at?: string
}

export interface RuleSuggestionSubmit {
  suggestion: string
  sessionId: string
  userId: string
}

export interface AIInteractionReviewUpdate {
  status: 'approved' | 'rejected' | 'modified'
  admin_notes?: string
  admin_modified_code?: string
}

// API functions
export const apiService = {
  // GitHub/Dockmasters
  async getDockmasters(): Promise<DockmasterEntry[]> {
    const response = await api.get('/api/dockmasters/')
    return response.data
  },

  async refreshDockmasters(): Promise<{ message: string, total_dockmasters: number, active_visible_dockmasters: number }> {
    const response = await api.post('/api/dockmasters/refresh')
    return response.data
  },

  // Suggestions
  async createSuggestion(suggestion: SuggestionCreate): Promise<Suggestion> {
    const response = await api.post('/api/suggestions/', suggestion)
    return response.data
  },

  async getSuggestions(status?: string): Promise<Suggestion[]> {
    const params = status ? { status } : {}
    const response = await api.get('/api/suggestions/', { params })
    return response.data
  },

  async getSuggestion(id: string): Promise<Suggestion> {
    const response = await api.get(`/api/suggestions/${id}`)
    return response.data
  },

  async getPendingCount(): Promise<{ pending_count: number }> {
    const response = await api.get('/api/suggestions/pending/count')
    return response.data
  },

  // Admin
  async updateSuggestion(id: string, data: { status: 'approved' | 'rejected', admin_notes?: string }): Promise<Suggestion> {
    try {
      const response = await api.put(`/api/admin/${id}`, data)
      return response.data
    } catch (error: any) {
      // Extract detailed error message if available
      const errorMessage = error.response?.data?.detail || error.message
      throw new Error(`Failed to update suggestion: ${errorMessage}`)
    }
  },

  async getAdminStats(): Promise<{
    total_suggestions: number
    pending: number
    approved: number
    rejected: number
  }> {
    const response = await api.get('/api/admin/stats')
    return response.data
  },

  async deleteSuggestion(id: string): Promise<void> {
    await api.delete(`/api/suggestions/${id}`)
  },

  async retryPR(id: string): Promise<{ pr_url: string, pr_number: number, branch_name: string }> {
    const response = await api.post(`/api/admin/${id}/retry-pr`)
    return response.data
  },

  // Admin Management
  async getAdmins(): Promise<Admin[]> {
    const response = await api.get('/api/admin/admins')
    return response.data
  },

  async addAdmin(adminData: AdminCreate, currentAdminId: string): Promise<Admin> {
    const response = await api.post('/api/admin/admins', adminData, {
      headers: {
        'X-Admin-ID': currentAdminId
      }
    })
    return response.data
  },

  async removeAdmin(discordId: string, currentAdminId: string): Promise<{ message: string }> {
    const response = await api.delete(`/api/admin/admins/${discordId}`, {
      headers: {
        'X-Admin-ID': currentAdminId
      }
    })
    return response.data
  },

  // Scripts
  async getScripts(filters?: ScriptSearchFilters): Promise<Script[]> {
    const params: any = {}
    if (filters?.category) params.category = filters.category.join(',')
    if (filters?.tags) params.tags = filters.tags.join(',')
    if (filters?.author) params.author = filters.author
    if (filters?.rating_min) params.rating_min = filters.rating_min
    if (filters?.search_query) params.search_query = filters.search_query
    if (filters?.is_approved !== undefined) params.is_approved = filters.is_approved

    const response = await api.get('/api/scripts/', { params })
    return response.data
  },

  async getFeaturedScripts(): Promise<Script[]> {
    const response = await api.get('/api/scripts/featured')
    return response.data
  },

  async getScript(id: string): Promise<Script> {
    const response = await api.get(`/api/scripts/${id}`)
    return response.data
  },

  async createScript(script: ScriptCreate, userId: string, isAdmin: boolean = false): Promise<Script> {
    const response = await api.post('/api/scripts/', script, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async updateScript(id: string, script: ScriptUpdate, userId: string, isAdmin: boolean): Promise<Script> {
    const response = await api.put(`/api/scripts/${id}`, script, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async deleteScript(id: string, userId: string, isAdmin: boolean): Promise<void> {
    await api.delete(`/api/scripts/${id}`, {
      params: { user_id: userId, is_admin: isAdmin }
    })
  },

  async getCompanionScripts(scriptId: string): Promise<Script[]> {
    const response = await api.get(`/api/scripts/${scriptId}/companions`)
    return response.data
  },

  async rateScript(id: string, rating: ScriptRatingCreate, userId: string): Promise<ScriptRating> {
    const response = await api.post(`/api/scripts/${id}/rate`, rating, {
      params: { user_id: userId }
    })
    return response.data
  },

  async getScriptRatings(id: string): Promise<ScriptRating[]> {
    const response = await api.get(`/api/scripts/${id}/ratings`)
    return response.data
  },

  // Tags
  async getTags(): Promise<ScriptTag[]> {
    const response = await api.get('/api/scripts/tags/')
    return response.data
  },

  async createTag(tag: ScriptTagCreate, userId: string, isAdmin: boolean): Promise<ScriptTag> {
    const response = await api.post('/api/scripts/tags/', tag, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async updateTag(id: number, tag: ScriptTagCreate, userId: string, isAdmin: boolean): Promise<ScriptTag> {
    const response = await api.put(`/api/scripts/tags/${id}`, tag, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async deleteTag(id: number, userId: string, isAdmin: boolean): Promise<void> {
    await api.delete(`/api/scripts/tags/${id}`, {
      params: { user_id: userId, is_admin: isAdmin }
    })
  },

  // AI Bot
  async aiSearch(request: AIBotRequest, userId: string): Promise<AIBotResponse> {
    const response = await api.post('/api/scripts/ai/search', request, {
      params: { user_id: userId }
    })
    return response.data
  },

  async submitAIFeedback(feedback: AIFeedbackSubmit, userId: string): Promise<void> {
    await api.post('/api/scripts/ai/feedback', feedback, {
      params: { user_id: userId }
    })
  },

  // Admin Scripts
  async getPendingScripts(userId: string, isAdmin: boolean): Promise<Script[]> {
    const response = await api.get('/api/scripts/admin/pending', {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async approveScript(id: string, userId: string, isAdmin: boolean): Promise<Script> {
    const response = await api.post(`/api/scripts/admin/${id}/approve`, {}, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async rejectScript(id: string, reason: string, userId: string, isAdmin: boolean): Promise<void> {
    await api.post(`/api/scripts/admin/${id}/reject`, {}, {
      params: { reason, user_id: userId, is_admin: isAdmin }
    })
  },

  async getScriptAnalytics(userId: string, isAdmin: boolean): Promise<any> {
    const response = await api.get('/api/scripts/admin/analytics', {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  // Featured Scripts
  async toggleFeaturedScript(id: string, userId: string, isAdmin: boolean): Promise<Script> {
    const response = await api.post(`/api/scripts/admin/${id}/toggle-featured`, {}, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  // AI Interaction Reviews
  async getAIReviews(status?: string, userId?: string, isAdmin?: boolean): Promise<AIInteractionReview[]> {
    const params: any = {}
    if (status) params.status = status
    if (userId) params.user_id = userId
    if (isAdmin !== undefined) params.is_admin = isAdmin

    const response = await api.get('/api/scripts/admin/ai-reviews', { params })
    return response.data
  },

  async updateAIReview(id: string, reviewData: AIInteractionReviewUpdate, userId: string, isAdmin: boolean): Promise<AIInteractionReview> {
    const response = await api.put(`/api/scripts/admin/ai-reviews/${id}`, reviewData, {
      params: { user_id: userId, is_admin: isAdmin }
    })
    return response.data
  },

  async createScriptFromAIReview(
    reviewId: string, 
    title: string, 
    author: string, 
    category: string, 
    tags: string, 
    userId: string, 
    isAdmin: boolean
  ): Promise<Script> {
    const response = await api.post(`/api/scripts/admin/ai-reviews/${reviewId}/create-script`, {}, {
      params: { 
        title, 
        author, 
        category, 
        tags, 
        user_id: userId, 
        is_admin: isAdmin 
      }
    })
    return response.data
  },

  // Rule Suggestions
  async submitRuleSuggestion(ruleData: RuleSuggestionSubmit): Promise<any> {
    const response = await api.post('/api/ai/rule-suggestions', ruleData)
    return response.data
  },

  // Rating functions
  async createJasownRating(scriptId: string, rating: number, review?: string, userDiscordId?: string): Promise<ScriptRating> {
    const response = await api.post(`/api/scripts/${scriptId}/jasown-rating`, {
      rating,
      review
    }, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  // AI Rules Management
  async getAIRules(userDiscordId?: string): Promise<{ rules: string; version: string; last_updated: string }> {
    console.log('API: Getting AI rules for user:', userDiscordId)
    const response = await api.get('/api/scripts/admin/ai-rules', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    console.log('API: AI rules response:', response.data)
    return response.data
  },

  async updateAIRules(rules: string, userDiscordId?: string): Promise<{ message: string; backup_created: string; updated_by: string; updated_at: string }> {
    console.log('API: Updating AI rules for user:', userDiscordId)
    console.log('API: Rules content length:', rules.length)
    const response = await api.put('/api/scripts/admin/ai-rules', {
      rules
    }, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    console.log('API: Update response:', response.data)
    return response.data
  },

  async getAIRulesHistory(userDiscordId?: string): Promise<{ history: Array<{ filename: string; timestamp: string; path: string }> }> {
    const response = await api.get('/api/scripts/admin/ai-rules/history', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async getPerformanceMonitoring(userDiscordId?: string): Promise<any> {
    const response = await api.get('/api/scripts/admin/performance-monitoring', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  // Uncertainty Management
  async getUncertaintyRequests(userDiscordId?: string): Promise<any> {
    const response = await api.get('/api/ai/uncertainty/pending-reviews', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async resolveUncertaintyRequest(requestId: number, resolution: any, userDiscordId?: string): Promise<any> {
    const response = await api.post(`/api/ai/uncertainty/resolve/${requestId}`, resolution, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async getUncertaintyStats(userDiscordId?: string): Promise<any> {
    const response = await api.get('/api/ai/uncertainty/stats', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  // Intent Management
  async getIntentPatterns(userDiscordId?: string): Promise<any> {
    const response = await api.get('/api/ai/intents/patterns', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async updateIntentPattern(patternId: number, pattern: any, userDiscordId?: string): Promise<any> {
    const response = await api.put(`/api/ai/intents/patterns/${patternId}`, pattern, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async createIntentPattern(pattern: any, userDiscordId?: string): Promise<any> {
    const response = await api.post('/api/ai/intents/patterns', pattern, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async deleteIntentPattern(patternId: number, userDiscordId?: string): Promise<any> {
    const response = await api.delete(`/api/ai/intents/patterns/${patternId}`, {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  },

  async getIntentAnalytics(userDiscordId?: string): Promise<any> {
    const response = await api.get('/api/ai/intents/analytics', {
      params: {
        user_id: userDiscordId,
        is_admin: true
      }
    })
    return response.data
  }
}
