# Scripts System Documentation

## Overview

The Scripts System is a comprehensive platform for managing, searching, and sharing Razor scripts for UO Outlands. It provides both manual script management and AI-powered script generation capabilities, with features for user submissions, admin approval workflows, and intelligent search functionality.

## System Architecture

### Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI System     │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (Consolidated)│
│   Port 3000     │    │   Port 7000     │    │   Port 7000     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   + FAISS       │
                       └─────────────────┘
```

### Key Files

#### Frontend Components
- `frontend/pages/scripts.tsx` - Main scripts page
- `frontend/pages/scripts/[id].tsx` - Script detail page with rating and comments
- `frontend/components/ScriptsSearchBar.tsx` - Search interface
- `frontend/components/CreateScriptModal.tsx` - Script upload modal
- `frontend/components/AIBotInterface.tsx` - AI chat interface
- `frontend/components/ScriptCard.tsx` - Script display cards with rating system
- `frontend/components/ScriptViewer.tsx` - Code viewer component

#### Backend Components
- `backend/routes/scripts.py` - Main scripts API endpoints
- `backend/models.py` - Pydantic data models
- `backend/database.py` - SQLAlchemy database models
- `backend/script_manager.py` - Script management utilities
- `backend/add_new_scripts.py` - Bulk script import tool

## Database Schema

### Core Tables

#### ScriptsCacheDB
```sql
CREATE TABLE scripts_cache (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    author VARCHAR NOT NULL,
    category VARCHAR NOT NULL,  -- 'gg-scripts', 'jasown-scripts', 'ai-scripts'
    language VARCHAR NOT NULL,  -- 'razor', 'python'
    tags TEXT,                 -- JSON array of tags
    description TEXT,
    code_preview TEXT,         -- First 500 chars for listing
    full_code_url VARCHAR,     -- URL to full code (AI server)
    exe_download_url VARCHAR,  -- Optional .exe download for Python
    rating_average FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR,        -- Discord ID of creator
    approved_by VARCHAR,        -- Admin Discord ID
    approved_at TIMESTAMP,
    rejection_reason TEXT
);
```

#### ScriptRatingsDB
```sql
CREATE TABLE script_ratings (
    id VARCHAR PRIMARY KEY,
    script_id VARCHAR REFERENCES scripts_cache(id),
    user_id VARCHAR NOT NULL,  -- Discord ID
    rating INTEGER NOT NULL,   -- 1-5 stars
    review TEXT,
    weight INTEGER DEFAULT 1,  -- Weight for averaging (1=user, 5=Jasown)
    is_jasown_rating BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### ScriptTagsConfigDB
```sql
CREATE TABLE script_tags_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR UNIQUE NOT NULL,
    tag_color VARCHAR DEFAULT '#3b82f6',
    tag_category VARCHAR DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Script Upload Process

### User Upload Flow

1. **Authentication Required**: User must be logged in with Discord and be a GG member
2. **Upload Form**: User fills out the CreateScriptModal with:
   - Title (required)
   - Author (auto-filled from Discord username)
   - Language (Razor or Python)
   - Tags (selected from predefined list)
   - Description (optional)
   - Code (required)
   - .exe Download URL (optional, for Python scripts)

3. **Validation**: 
   - Title and code are required
   - Tags are limited to 3 maximum
   - Code is truncated to 500 chars for preview

4. **Database Storage**:
   - Script stored with `is_approved=False`
   - `created_by` set to user's Discord ID
   - Category automatically set to 'gg-scripts'

5. **Admin Review**: Script requires admin approval before being visible

### API Endpoint

```http
POST /api/scripts/
Content-Type: application/json

{
  "title": "Script Title",
  "author": "Author Name",
  "language": "razor",
  "tags": ["fishing", "automation"],
  "description": "Script description",
  "code": "script code here",
  "exe_download_url": "https://example.com/download.exe"
}

Query Parameters:
- user_id: Discord ID of the user creating the script
```

### Special Handling

#### Jasown Scripts
- Scripts by "jasown" or "jasown scripts" automatically receive:
  - 5-star weighted rating (counts as 5 user ratings)
  - `rating_average` set to 5.0
  - `rating_count` set to 5

## Search Functionality

### Manual Search

The system provides comprehensive search capabilities through `ScriptsSearchBar.tsx`:

#### Search Modes
1. **Manual Search**: Traditional filtering and text search
2. **AI Search**: Natural language queries processed by AI

#### Manual Search Filters
- **Text Search**: Searches across title, description, code preview, author, tags, and category
- **Category Filter**: Filter by script category (GG Scripts, Jasown Scripts, AI Scripts, Python Scripts)
- **Tag Filter**: Multi-select tag filtering with smart ranking
- **Author Filter**: Filter by specific author
- **Rating Filter**: Minimum rating threshold (1-5 stars)

#### Tag System
- **Predefined Tags**: System comes with default tags (fishing, mining, healing, etc.)
- **Tag Categories**: Organized by type (activity, location, skill, general)
- **Smart Ranking**: Scripts ranked by tag matches, featured status, rating, and views
- **Tag Search**: Autocomplete tag search with keyboard navigation

### AI Search

The AI search uses RAG (Retrieval-Augmented Generation) to provide intelligent script assistance:

#### How It Works
1. **Query Processing**: User's natural language query is processed
2. **Context Retrieval**: RAG system searches for relevant information from:
   - GG Scripts (prioritized - 60% of results)
   - Other scripts and documentation (40% of results)
   - Official Outlands Razor Scripting documentation
   - Custom AI rules
3. **Response Generation**: GPT-4o-mini generates response with:
   - Explanation
   - Generated code
   - Citations to source materials
4. **Code Extraction**: Generated Razor code is extracted and linted
5. **Feedback System**: Users can approve, decline, or edit generated code

#### AI Features
- **Interactive Editing**: Users can edit AI-generated code inline
- **Rule Suggestions**: System generates rule suggestions based on code changes
- **Feedback Loop**: Approved interactions improve future responses
- **Citation System**: Shows sources used for generation

## Admin Management

### Script Approval Workflow

#### Pending Scripts
- All user-submitted scripts start as `is_approved=False`
- Admins can view pending scripts via `/api/scripts/admin/pending`
- Admin actions:
  - **Approve**: Script becomes visible to users
  - **Reject**: Script is deleted with reason

#### Featured Scripts
- Admins can toggle `is_featured` status
- Featured scripts appear first in listings
- Featured scripts have priority in search results

### Admin Endpoints

```http
# Get pending scripts
GET /api/scripts/admin/pending?user_id={discord_id}&is_admin=true

# Approve script
POST /api/scripts/admin/{script_id}/approve?user_id={discord_id}&is_admin=true

# Reject script
POST /api/scripts/admin/{script_id}/reject?reason={reason}&user_id={discord_id}&is_admin=true

# Toggle featured status
POST /api/scripts/admin/{script_id}/toggle-featured?user_id={discord_id}&is_admin=true

# Get analytics
GET /api/scripts/admin/analytics?user_id={discord_id}&is_admin=true
```

## Bulk Script Management

### Script Import System

The system supports bulk importing scripts from external sources:

#### Script Manager (`script_manager.py`)
- **Bulk Updates**: Process multiple scripts at once
- **Duplicate Detection**: Prevents duplicate scripts by URL and title
- **Auto-Approval**: Scraped scripts are auto-approved
- **Tag Management**: Automatically limits tags to 3 essential ones

#### Import Process
1. **JSONL Format**: Scripts imported from JSONL files
2. **Duplicate Checking**: Compares against existing scripts by URL and title
3. **Data Cleaning**: Ensures required fields have defaults
4. **Batch Processing**: Processes scripts in batches for efficiency

#### Usage
```bash
# Import scripts from JSONL file
python add_new_scripts.py path/to/scripts.jsonl

# Use default file
python add_new_scripts.py
```

### Scheduled Scraping

The system supports automated script scraping:

```bash
# Run once immediately
python scheduled_scraper.py once

# Set up daily scraping
python scheduled_scraper.py schedule daily

# Set up weekly scraping
python scheduled_scraper.py schedule weekly
```

## Rating System

### Interactive Rating & Comments System

The system provides a comprehensive rating and review system that allows users to rate scripts and share their feedback.

#### Rating Features
- **Interactive Star Rating**: Users can click on stars (1-5) to rate scripts
- **Real-time Updates**: Ratings update immediately after submission
- **User Comments**: Optional detailed reviews with each rating
- **Rating History**: Users can update their existing ratings
- **Visual Feedback**: Hover effects and loading states for better UX

#### Weighted Rating System

The system uses a sophisticated weighted rating system:

#### Rating Types
- **User Ratings**: Each user rating has weight = 1
- **Jasown Ratings**: System ratings have weight = 5 (counts as 5 user ratings)

#### Calculation
```python
# Weighted average calculation
total_weighted_score = sum(rating * weight for rating in ratings)
total_weight = sum(weight for rating in ratings)
rating_average = total_weighted_score / total_weight
rating_count = total_weight  # Effective rating count
```

#### Rating Display
- **Script Cards**: Shows rating stars with average and count
- **Script Detail Page**: Full rating form with comment textarea
- **Reviews Section**: Displays all ratings with user avatars and comments
- **Official Badges**: Special indicators for Jasown Scripts ratings

#### User Experience
- **Authentication Required**: Only logged-in users can rate scripts
- **One Rating Per User**: Users can update their existing rating
- **Comment Integration**: Ratings can include optional written reviews
- **Responsive Design**: Works seamlessly on all device sizes

## AI Integration

### RAG System

The AI system uses Retrieval-Augmented Generation for intelligent script assistance:

#### Data Sources
- **Scripts**: 6,444 chunks from existing Razor scripts
- **Documentation**: 71 chunks from official Outlands Razor documentation
- **Rules**: 21 chunks from custom AI rules

#### Context Formatting
The AI receives structured context:
```
=== GG SCRIPTS (PRIORITY REFERENCE) ===
--- GG Script 1: Fishing Macro (Relevance: 0.95) ---
[Script content]

=== ADDITIONAL REFERENCE MATERIALS ===
--- Documentation 1: Razor Commands (Relevance: 0.72) ---
[Documentation content]

=== ANALYSIS INSTRUCTIONS ===
1. PRIORITIZE patterns from GG Scripts above
2. Use multiple GG Script examples to understand best practices
3. Combine techniques from different GG Scripts when appropriate
4. Reference additional materials only for specific technical details
5. Ensure your script follows GG Script conventions and patterns
```

### AI Rules System

#### Rules Management
- **Location**: `backend/ai/rules/RULES.md`
- **Admin Control**: Admins can edit rules through `/admin-ai-rules` page
- **Versioning**: Automatic backups created on each update
- **Integration**: Rules are loaded and applied to every AI response

#### Current Rules Include
- Core Razor principles (clear, minimal code)
- Critical requirements (gump interactions, ignore management)
- Code structure guidelines
- Performance guidelines
- Common patterns and anti-patterns
- Best practices for testing and documentation

### Self-Learning System

The AI system includes self-learning capabilities:

#### Interactive Code Editing
- Users can edit AI-generated code directly in the chat interface
- Real-time editing with syntax highlighting
- Save/cancel options for changes

#### Rule Suggestions
- System automatically detects common issues in code
- Generates specific rule suggestions based on code changes
- Smart learning identifies patterns like:
  - Serial number usage instead of item names
  - Missing `waitforgump` after `gumpresponse`
  - Improper `findtype` usage
  - Missing `@clearignore` before scans

#### Admin Review System
- Rule suggestions require admin review
- Approved rules are automatically added to the AI rules file
- Automatic backups created before rule changes

## API Reference

### Script Endpoints

#### List Scripts
```http
GET /api/scripts/
Query Parameters:
- category: Filter by category
- tags: Comma-separated tags
- author: Filter by author
- rating_min: Minimum rating (1-5)
- search_query: Text search
- is_approved: Filter by approval status
- limit: Results per page (max 100)
- offset: Pagination offset
```

#### Get Script
```http
GET /api/scripts/{script_id}
```

#### Create Script
```http
POST /api/scripts/
Body: ScriptCreate object
Query Parameters:
- user_id: Discord ID of creator
```

#### Update Script
```http
PUT /api/scripts/{script_id}
Body: ScriptUpdate object
Query Parameters:
- user_id: Discord ID of updater
- is_admin: Whether user is admin
```

#### Delete Script
```http
DELETE /api/scripts/{script_id}
Query Parameters:
- user_id: Discord ID of deleter
- is_admin: Whether user is admin
```

### Rating Endpoints

#### Rate Script
```http
POST /api/scripts/{script_id}/rate
Body: ScriptRatingCreate object
Query Parameters:
- user_id: Discord ID of rater
```

**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent script, works perfectly!"
}
```

#### Get Script Ratings
```http
GET /api/scripts/{script_id}/ratings
Query Parameters:
- limit: Results per page (max 50)
- offset: Pagination offset
```

**Response:**
```json
[
  {
    "id": "rating-id",
    "script_id": "script-id",
    "user_id": "discord-id",
    "rating": 5,
    "review": "Great script!",
    "weight": 1,
    "is_jasown_rating": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Create Jasown Rating (Admin Only)
```http
POST /api/scripts/{script_id}/jasown-rating
Body: ScriptRatingCreate object
Query Parameters:
- user_id: Discord ID of admin
- is_admin: true
```

### AI Endpoints

#### AI Search
```http
POST /api/scripts/ai/search
Body: AIBotRequest object
Query Parameters:
- user_id: Discord ID of user
```

#### Submit AI Feedback
```http
POST /api/scripts/ai/feedback
Body: AIFeedbackSubmit object
Query Parameters:
- user_id: Discord ID of user
```

### Tag Endpoints

#### Get Tags
```http
GET /api/scripts/tags/
```

#### Create Tag (Admin)
```http
POST /api/scripts/tags/
Body: ScriptTagCreate object
Query Parameters:
- user_id: Discord ID of creator
- is_admin: Whether user is admin
```

## Security Considerations

### Authentication
- **Discord OAuth**: All users must authenticate via Discord
- **GG Membership**: Users must be GG Discord server members
- **Admin Verification**: Admin endpoints verify admin status

### Authorization
- **User Scripts**: Users can only create scripts (not edit/delete)
- **Admin Scripts**: Admins can approve, reject, edit, delete, and manage featured status
- **Rating System**: Users can rate scripts but only one rating per user per script

### Data Protection
- **Input Validation**: All inputs are validated server-side
- **SQL Injection Prevention**: Parameterized queries used throughout
- **XSS Prevention**: Content sanitization for user inputs

## Performance Optimizations

### Database Optimizations
- **Indexing**: Proper indexes on frequently queried fields
- **Pagination**: All list endpoints support pagination
- **Query Optimization**: Efficient queries with proper joins

### Search Optimizations
- **Tag Ranking**: Smart ranking algorithm for tag-based searches
- **Caching**: Frontend caches tag data and search results
- **Debouncing**: Search input debounced to prevent excessive API calls

### AI Optimizations
- **Context Limiting**: Limited context size to prevent token overflow
- **Chunk Optimization**: Optimized chunk sizes for better retrieval
- **Response Caching**: Cached responses for similar queries

## Troubleshooting

### Common Issues

#### Script Upload Issues
1. **Authentication Required**: Ensure user is logged in and is GG member
2. **Required Fields**: Title and code are required
3. **Tag Limits**: Maximum 3 tags per script
4. **Admin Approval**: Scripts require admin approval before visibility

#### Search Issues
1. **No Results**: Check if scripts are approved (`is_approved=true`)
2. **Tag Filtering**: Ensure tags exist in the system
3. **AI Search**: Verify AI service is running and accessible

#### Admin Issues
1. **Admin Access**: Verify user has admin privileges
2. **Pending Scripts**: Check `/api/scripts/admin/pending` endpoint
3. **Featured Toggle**: Ensure proper admin parameters are passed

### Debug Information

#### API Debugging
- Check server logs for detailed error messages
- Verify database connectivity
- Ensure all required environment variables are set

#### Frontend Debugging
- Check browser console for JavaScript errors
- Verify API endpoints are accessible
- Check network tab for failed requests

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Detailed usage analytics and trends
2. **Script Versioning**: Version control for script updates
3. **Collaboration Tools**: Multi-user script editing
4. **Mobile Support**: Mobile-optimized interface
5. **API Expansion**: Public API for external tools

### AI Improvements
1. **Custom Training**: Train on approved scripts
2. **Advanced Rules**: More sophisticated rule system
3. **Performance Optimization**: Faster AI responses
4. **Quality Metrics**: AI response quality tracking

## Conclusion

The Scripts System provides a comprehensive platform for managing Razor scripts with both traditional and AI-powered features. It supports user submissions, admin management, intelligent search, and continuous learning through user feedback. The system is designed to be scalable, secure, and user-friendly while maintaining high code quality standards.

The integration of AI capabilities makes it unique in the UO Outlands scripting community, providing users with intelligent assistance while learning from community feedback to continuously improve.
