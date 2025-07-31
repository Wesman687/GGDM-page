import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get the user's token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    
    if (!token) {
      console.log('No token found')
      return res.status(401).json({ error: 'Not authenticated', details: 'No token found' })
    }

    if (!token.accessToken) {
      console.log('No access token in JWT token')
      return res.status(401).json({ error: 'Not authenticated', details: 'No Discord access token' })
    }

    const ggGuildId = process.env.NEXT_PUBLIC_GG_GUILD_ID
    if (!ggGuildId) {
      console.error('GG Guild ID not configured')
      return res.status(500).json({ error: 'Server configuration error', details: 'GG Guild ID not set' })
    }

    console.log('Checking GG membership for user:', {
      discordId: token.discordId,
      username: token.username,
      ggGuildId
    })

    // Get user's Discord guilds with retry and timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

    let response
    try {
      response = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'User-Agent': 'DM-Portal/1.0'
        },
        signal: controller.signal
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error('Discord API request timed out')
        return res.status(408).json({ 
          error: 'Request timeout', 
          details: 'Discord API took too long to respond' 
        })
      }
      throw fetchError
    }
    clearTimeout(timeoutId)

    console.log('Discord API response status:', response.status)

    if (response.status === 401) {
      console.log('Discord access token is invalid or expired')
      return res.status(401).json({ 
        error: 'Discord token expired', 
        details: 'Please sign out and sign back in' 
      })
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      console.log('Discord API rate limited, retry after:', retryAfter)
      return res.status(429).json({ 
        error: 'Rate limited', 
        details: `Discord API rate limit hit. Try again in ${retryAfter || 'a few'} seconds` 
      })
    }

    if (!response.ok) {
      console.error('Discord API error:', response.status, response.statusText)
      return res.status(503).json({ 
        error: 'Discord API unavailable', 
        details: `Discord returned ${response.status}: ${response.statusText}` 
      })
    }

    const guilds = await response.json()
    console.log('User guilds count:', guilds.length)
    console.log('User guilds:', guilds.map((g: any) => ({ id: g.id, name: g.name })))

    // Check if user is member of GG Discord server
    const isGGMember = guilds.some((guild: any) => guild.id === ggGuildId)

    console.log('Is GG Member:', isGGMember)
    console.log('Looking for guild ID:', ggGuildId)
    console.log('User guild IDs:', guilds.map((g: any) => g.id))

    return res.status(200).json({
      isGGMember,
      discordId: token.discordId,
      username: token.username,
      discriminator: token.discriminator,
      timestamp: new Date().toISOString(),
      debug: {
        ggGuildId,
        userGuilds: guilds.map((g: any) => ({ id: g.id, name: g.name })),
        guildCount: guilds.length
      }
    })

  } catch (error: any) {
    console.error('GG membership check error:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message || 'Unknown error occurred' 
    })
  }
}
