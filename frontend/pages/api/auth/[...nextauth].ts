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
        token.discordId = discordProfile.id || null
        token.username = discordProfile.username || null
        token.discriminator = discordProfile.discriminator || null
        token.avatar = discordProfile.avatar || null
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
