import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken: string
    user: {
      id: string
      name: string
      email: string
      image: string
      discordId: string
      username: string
      discriminator: string
      avatar: string
    }
  }

  interface User {
    discordId: string
    username: string
    discriminator: string
    avatar: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string
    discordId: string
    username: string
    discriminator: string
    avatar: string
  }
}
