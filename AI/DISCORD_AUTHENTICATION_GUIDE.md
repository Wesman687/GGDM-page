# Discord Authentication System Guide

## Overview

The DM Portal uses Discord OAuth2 authentication to verify user identity and GG Discord server membership. This system ensures only verified GG members can submit suggestions and access certain features while providing a seamless authentication experience.

## Architecture

### Authentication Flow
```
User → Frontend (NextAuth) → Discord OAuth → Backend Verification → Database
```

### Components
1. **Frontend Authentication**: NextAuth.js with Discord provider
2. **Backend Verification**: Discord API calls to verify guild membership
3. **Error Handling**: Comprehensive retry logic and user-friendly error messages
4. **Rate Limiting**: Built-in Discord API rate limit handling

## Frontend Authentication

### 1. NextAuth Configuration

**File**: `frontend/pages/api/auth/[...nextauth].ts`

```typescript
export default NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds', // Required for guild membership verification
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store Discord tokens and profile info
      if (account && profile) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at * 1000
        token.discordId = profile.id
        token.username = profile.username
        token.discordriminator = profile.discriminator
        token.avatar = profile.avatar
      }
      
      // Auto-refresh expired tokens
      if (token.expiresAt && Date.now() > token.expiresAt && token.refreshToken) {
        // Refresh logic here
      }
      
      return token
    },
    async session({ session, token }) {
      // Pass Discord info to client
      session.accessToken = token.accessToken
      session.user.discordId = token.discordId
      session.user.username = token.username
      session.user.discordriminator = token.discordriminator
      session.user.avatar = token.avatar
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})
```

### 2. Authentication Context

**File**: `frontend/lib/auth.tsx`

The `AuthProvider` manages authentication state and GG membership verification:

```typescript
interface AuthContextType {
  isAuthenticated: boolean
  isGGMember: boolean
  isAdmin: boolean
  user: any
  loading: boolean
  error: string | null
  retryCount: number
  checkGGMembership: () => Promise<void>
}
```

#### Key Features:
- **Caching**: 5-minute cache for membership checks
- **Auto-retry**: Exponential backoff with up to 5 retry attempts
- **Error Handling**: Specific error messages for different failure types
- **Loading States**: Proper loading indicators during verification

#### Error Types Handled:
- `ECONNABORTED`: Request timeout
- `503`: Discord API unavailable
- `401`: Authentication expired
- `429`: Rate limited by Discord
- Generic errors with fallback messages

### 3. Authentication Components

#### DiscordAuth Component
**File**: `frontend/components/DiscordAuth.tsx`

Simple sign-in/sign-out button with loading states:
```typescript
export default function DiscordAuth() {
  const { isAuthenticated, isGGMember, user, loading } = useAuth()
  
  if (!isAuthenticated) {
    return (
      <button onClick={() => signIn('discord', { callbackUrl: window.location.href })}>
        Sign in with Discord
      </button>
    )
  }
  
  // Show user info and sign out button
}
```

#### GGMemberGuard Component
**File**: `frontend/components/GGMemberGuard.tsx`

Protects routes requiring GG membership:
```typescript
export default function GGMemberGuard({ children, fallback }) {
  const { isAuthenticated, isGGMember, loading, error, retryCount } = useAuth()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!isAuthenticated) {
    return <AuthenticationRequired />
  }
  
  if (!isGGMember) {
    return <GGMembershipRequired error={error} retryCount={retryCount} />
  }
  
  return <>{children}</>
}
```

### 4. Sign-in Page

**File**: `frontend/pages/auth/signin.tsx`

Professional sign-in page with:
- Provider loading states
- Error handling for missing configuration
- Fallback authentication attempts
- Clear explanation of why Discord is required

## Backend Authentication

### 1. Discord Membership Verification

**File**: `frontend/pages/api/verify-gg-member.ts`

This API endpoint verifies GG Discord server membership:

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get JWT token from NextAuth
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  
  if (!token?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  
  // Call Discord API with timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  
  try {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'User-Agent': 'DM-Portal/1.0'
      },
      signal: controller.signal
    })
    
    // Handle Discord API responses
    if (response.status === 401) {
      return res.status(401).json({ error: 'Discord token expired' })
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      return res.status(429).json({ 
        error: 'Rate limited', 
        details: `Try again in ${retryAfter || 'a few'} seconds` 
      })
    }
    
    const guilds = await response.json()
    const isGGMember = guilds.some(guild => guild.id === process.env.NEXT_PUBLIC_GG_GUILD_ID)
    
    return res.json({
      isGGMember,
      discordId: token.discordId,
      username: token.username,
      timestamp: new Date().toISOString(),
      debug: {
        ggGuildId: process.env.NEXT_PUBLIC_GG_GUILD_ID,
        userGuilds: guilds.map(g => ({ id: g.id, name: g.name })),
        guildCount: guilds.length
      }
    })
  } catch (error) {
    // Handle errors
  }
}
```

### 2. Backend User Verification

**File**: `backend/routes/scripts.py`

Backend endpoints require Discord user ID as query parameter:

```python
@router.post("/", response_model=Script)
async def create_script(
    script_data: ScriptCreate,
    user_id: str = Query(..., description="Discord ID of the user creating the script"),
    db: Session = Depends(get_db)
):
    # Script creation logic
    # user_id is used for tracking authorship
```

### 3. Admin Verification

**File**: `backend/routes/admin.py`

Admin endpoints verify admin status:

```python
def is_super_admin(discord_id: str) -> bool:
    """Check if a Discord ID is a super admin"""
    super_admin_ids = os.getenv("SUPER_ADMIN_IDS", "").split(",")
    return discord_id in super_admin_ids

@router.post("/admins", response_model=Admin)
async def add_admin(admin_data: AdminCreate, current_admin_id: str, db: Session = Depends(get_db)):
    """Add a new admin (super admins only)"""
    if not is_super_admin(current_admin_id):
        raise HTTPException(status_code=403, detail="Only super admins can add new admins")
```

## Error Handling and Rate Limiting

### 1. Frontend Error Handling

The authentication system handles multiple error scenarios:

#### Timeout Errors
```typescript
if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
  setError('Request timed out. The Discord API might be slow. Please try again.')
}
```

#### Rate Limiting
```typescript
if (error.response?.status === 429) {
  setError('Rate limited by Discord. Please wait a few seconds and try again.')
}
```

#### Authentication Expired
```typescript
if (error.response?.status === 401) {
  setError('Authentication expired. Please sign out and sign back in.')
}
```

### 2. Backend Error Handling

#### Discord API Rate Limiting
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  return res.status(429).json({ 
    error: 'Rate limited', 
    details: `Discord API rate limit hit. Try again in ${retryAfter || 'a few'} seconds` 
  })
}
```

#### Request Timeouts
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

try {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    signal: controller.signal
  })
} catch (fetchError) {
  if (fetchError.name === 'AbortError') {
    return res.status(408).json({ 
      error: 'Request timeout', 
      details: 'Discord API took too long to respond' 
    })
  }
}
```

### 3. Retry Logic

#### Frontend Auto-retry
```typescript
useEffect(() => {
  if (error && retryCount < 5 && session) {
    const retryDelay = Math.min(1000 * Math.pow(1.5, retryCount), 8000)
    const timer = setTimeout(() => {
      checkGGMembership(true)
    }, retryDelay)
    return () => clearTimeout(timer)
  }
}, [error, retryCount, session, checkGGMembership])
```

#### Token Refresh
```typescript
if (token.expiresAt && Date.now() > token.expiresAt && token.refreshToken) {
  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })
    
    if (response.ok) {
      const refreshedTokens = await response.json()
      token.accessToken = refreshedTokens.access_token
      token.refreshToken = refreshedTokens.refresh_token || token.refreshToken
      token.expiresAt = Date.now() + refreshedTokens.expires_in * 1000
    }
  } catch (error) {
    // Clear tokens to force re-authentication
    token.accessToken = null
    token.refreshToken = null
    token.expiresAt = null
  }
}
```

## Environment Configuration

### Required Environment Variables

#### Frontend (.env.local)
```bash
# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# GG Discord Server
NEXT_PUBLIC_GG_GUILD_ID=your_gg_discord_server_id

# Admin IDs (comma-separated)
NEXT_PUBLIC_ADMIN_IDS=admin1_discord_id,admin2_discord_id
```

#### Backend (.env)
```bash
# Super Admin IDs (comma-separated)
SUPER_ADMIN_IDS=super_admin1_discord_id,super_admin2_discord_id
```

## Database Schema

### Admin Table
```sql
CREATE TABLE admins (
    discord_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    added_by VARCHAR NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

### Scripts Table
```sql
CREATE TABLE scripts_cache (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    author VARCHAR NOT NULL,
    created_by VARCHAR, -- Discord ID of creator
    -- ... other fields
);
```

## Security Considerations

### 1. Token Security
- Discord access tokens are stored in JWT tokens
- Tokens are automatically refreshed when expired
- Failed refresh attempts clear tokens to force re-authentication

### 2. API Security
- All backend endpoints require Discord user ID
- Admin endpoints verify admin status
- Super admin IDs are stored in environment variables

### 3. Rate Limiting
- Built-in Discord API rate limit handling
- Frontend retry logic with exponential backoff
- 8-second timeout for Discord API calls

### 4. Error Handling
- No sensitive information exposed in error messages
- Comprehensive logging for debugging
- User-friendly error messages

## Troubleshooting

### Common Issues

#### 1. "Discord authentication is not properly configured"
**Cause**: Missing environment variables
**Solution**: Verify all required environment variables are set

#### 2. "Rate limited by Discord"
**Cause**: Too many Discord API requests
**Solution**: Wait for rate limit to reset, system will auto-retry

#### 3. "Authentication expired"
**Cause**: Discord token expired and refresh failed
**Solution**: User needs to sign out and sign back in

#### 4. "Request timed out"
**Cause**: Discord API is slow or unresponsive
**Solution**: System will auto-retry with exponential backoff

### Debug Information

The system provides debug information in API responses:
```json
{
  "isGGMember": false,
  "discordId": "123456789",
  "username": "username",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "debug": {
    "ggGuildId": "987654321",
    "userGuilds": [{"id": "111", "name": "Server 1"}],
    "guildCount": 1
  }
}
```

## Performance Optimizations

### 1. Caching
- 5-minute cache for membership checks
- Prevents unnecessary Discord API calls
- Improves user experience

### 2. Timeout Management
- 8-second timeout for Discord API calls
- Prevents hanging requests
- Graceful fallback to error handling

### 3. Retry Logic
- Exponential backoff for failed requests
- Maximum 5 retry attempts
- Prevents overwhelming Discord API

## Future Improvements

### 1. Enhanced Error Pages
- More professional error page designs
- Better user guidance for common issues
- Improved loading states

### 2. Caching Improvements
- Redis caching for membership status
- Longer cache durations for stable users
- Cache invalidation strategies

### 3. Monitoring
- Discord API usage monitoring
- Authentication success/failure rates
- Performance metrics

### 4. Security Enhancements
- JWT token encryption
- Rate limiting per user
- Audit logging for admin actions

## API Endpoints Summary

### Frontend Authentication
- `GET /api/auth/[...nextauth]` - NextAuth endpoints
- `GET /api/verify-gg-member` - Verify GG membership

### Backend Authentication
- All endpoints require `user_id` query parameter
- Admin endpoints require `is_admin=true` parameter
- Super admin verification for admin management

### Error Handling
- Comprehensive error responses with details
- Rate limit information
- Debug information for troubleshooting

This authentication system provides a robust, user-friendly way to verify Discord identity and GG membership while handling the complexities of OAuth2, rate limiting, and error scenarios gracefully.
