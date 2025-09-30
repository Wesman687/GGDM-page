import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken: string | null
    user: {
      id: string
      name: string
      email: string
      image: string
      discordId: string | null
      username: string | null
      discriminator: string | null
      avatar: string | null
    }
  }

  interface User {
    discordId: string | null
    username: string | null
    discriminator: string | null
    avatar: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string | null
    refreshToken: string | null
    expiresAt: number | null
    discordId: string | null
    username: string | null
    discriminator: string | null
    avatar: string | null
  }
}
