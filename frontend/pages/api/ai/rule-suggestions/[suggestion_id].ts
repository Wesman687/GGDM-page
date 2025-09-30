import { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req
  const { suggestion_id } = query
  
  try {
    const url = new URL(`${BACKEND_URL}/api/scripts/ai/rule-suggestions/${suggestion_id}`)
    
    // Forward query parameters (excluding suggestion_id)
    Object.keys(query).forEach(key => {
      if (key !== 'suggestion_id') {
        url.searchParams.append(key, query[key] as string)
      }
    })
    
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })
    
    const data = await response.json()
    
    res.status(response.status).json(data)
  } catch (error) {
    console.error('API proxy error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
