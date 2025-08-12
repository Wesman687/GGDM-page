import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'

export default NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Save Discord access token and profile info
      if (account && profile) {
        const discordProfile = profile as any
        token.accessToken = account.access_token || null
        token.refreshToken = account.refresh_token || null
        token.expiresAt = account.expires_at ? account.expires_at * 1000 : null // Convert to milliseconds
        token.discordId = discordProfile.id || null
        token.username = discordProfile.username || null
        token.discriminator = discordProfile.discriminator || null
        token.avatar = discordProfile.avatar || null
        return token
      }

      // Check if token is expired and refresh if needed
      if (token.expiresAt && Date.now() > (token.expiresAt as number) && token.refreshToken) {
        try {
          const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: process.env.DISCORD_CLIENT_ID!,
              client_secret: process.env.DISCORD_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          })

          if (response.ok) {
            const refreshedTokens = await response.json()
            token.accessToken = refreshedTokens.access_token
            token.refreshToken = refreshedTokens.refresh_token || token.refreshToken
            token.expiresAt = Date.now() + refreshedTokens.expires_in * 1000
            console.log('Discord token refreshed successfully')
          } else {
            console.log('Failed to refresh Discord token, user needs to re-authenticate')
            // Clear tokens to force re-authentication
            token.accessToken = null
            token.refreshToken = null
            token.expiresAt = null
          }
        } catch (error) {
          console.error('Error refreshing Discord token:', error)
          // Clear tokens on error
          token.accessToken = null
          token.refreshToken = null
          token.expiresAt = null
        }
      }

      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken
      session.user.discordId = token.discordId
      session.user.username = token.username
      session.user.discriminator = token.discriminator
      session.user.avatar = token.avatar
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})
