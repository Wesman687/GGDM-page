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

// API functions
export const apiService = {
  // GitHub/Dockmasters
  async getDockmasters(): Promise<DockmasterEntry[]> {
    const response = await api.get('/api/github/dockmasters')
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
  }
}
