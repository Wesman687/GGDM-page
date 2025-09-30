# Admin Script Management Guide

## Overview

The Admin Script Management system provides comprehensive tools for administrators to manage scripts, oversee AI interactions, and maintain the quality of the script database. This system ensures that only high-quality, properly categorized scripts are available to users.

## Admin Panel Access

### Authentication
- **Admin Status**: Users must have `is_admin=true` in their Discord profile
- **Access Control**: All admin endpoints require `is_admin=true` parameter
- **Session Management**: Admin status is maintained through Discord authentication

### Navigation
- **Main Admin Panel**: `/admin` - Overview and navigation
- **Script Management**: `/admin-scripts` - Script administration tools
- **AI Rules Management**: `/admin-ai-rules` - AI behavior configuration

## Script Management Features

### 1. Featured Scripts System

#### Purpose
Featured scripts are highlighted scripts that appear prominently in the script listing and are prioritized in search results.

#### Management
- **Toggle Featured Status**: Click the star icon on any script card
- **Featured Tab**: Users can filter to see only featured scripts
- **Priority Display**: Featured scripts appear first in listings
- **Admin Control**: Only admins can modify featured status

#### API Endpoints
```http
POST /api/scripts/admin/{script_id}/toggle-featured
Parameters:
- user_id: Discord ID of admin
- is_admin: true
```

#### Database Schema
```sql
ALTER TABLE scripts_cache ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
```

### 2. Script Approval Workflow

#### Current Status
Scripts are automatically approved when submitted by users, but the system tracks:
- **Submission Time**: When the script was created
- **Author Information**: Discord username of submitter
- **Content Validation**: Basic validation on submission

#### Future Enhancement
Consider implementing a pending approval system where:
1. User submits script
2. Script enters "pending" status
3. Admin reviews and approves/rejects
4. Approved scripts become visible to users

### 3. AI Interaction Reviews

#### Purpose
When the AI generates code for users, these interactions are logged for admin review to ensure quality and learn from successful patterns.

#### Review Process
1. **AI Generates Code**: User asks question, AI creates response
2. **Automatic Logging**: Interaction is logged with "pending" status
3. **Admin Review**: Admin reviews generated code
4. **Actions Available**:
   - **Approve**: Code becomes available for future AI reference
   - **Modify**: Edit the code and approve modified version
   - **Reject**: Mark as rejected with reason
   - **Create Script**: Convert to a standalone script

#### Database Schema
```sql
CREATE TABLE ai_interaction_reviews (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR,
    user_id VARCHAR,
    interaction_type VARCHAR,
    original_query TEXT,
    ai_response TEXT,
    generated_code TEXT,
    status VARCHAR DEFAULT 'pending',
    admin_notes TEXT,
    admin_modified_code TEXT,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```http
GET /api/scripts/admin/ai-reviews
PUT /api/scripts/admin/ai-reviews/{review_id}
POST /api/scripts/admin/ai-reviews/{review_id}/create-script
```

### 4. Script Analytics

#### Available Metrics
- **Total Scripts**: Count of all scripts in database
- **Featured Scripts**: Count of featured scripts
- **AI Reviews Pending**: Count of unreviewed AI interactions
- **Recent Activity**: Scripts created in last 30 days
- **Top Authors**: Most active script contributors

#### API Endpoint
```http
GET /api/scripts/admin/analytics
Response:
{
  "total_scripts": 150,
  "featured_scripts": 12,
  "ai_reviews_pending": 5,
  "recent_scripts": 8,
  "top_authors": [...]
}
```

## AI Rules Management

### Purpose
AI Rules control how the AI assistant behaves when generating scripts. These rules ensure consistent, high-quality output that follows GG Script conventions.

### Rule Management Interface
- **Location**: `/admin-ai-rules` page
- **Editor**: Markdown text editor for rule modification
- **Version Control**: Automatic backups on each save
- **History**: View and restore previous rule versions

### Rule Categories

#### 1. Core Principles
- Clear, minimal code
- Proper error handling
- Efficient resource usage
- User-friendly interfaces

#### 2. Critical Requirements
- Gump interaction patterns
- Ignore list management
- Proper waiting mechanisms
- Error recovery procedures

#### 3. Code Structure
- Consistent formatting
- Logical flow organization
- Comment requirements
- Variable naming conventions

#### 4. Performance Guidelines
- Minimize server calls
- Efficient loop structures
- Resource cleanup
- Timing considerations

### Rule Update Process
1. **Edit Rules**: Modify rules in the admin interface
2. **Save Changes**: System creates automatic backup
3. **Immediate Effect**: New rules apply to all future AI responses
4. **Version History**: Previous versions remain available

### API Endpoints
```http
GET /api/scripts/admin/ai-rules
PUT /api/scripts/admin/ai-rules
GET /api/scripts/admin/ai-rules/history
```

## Script Quality Management

### 1. Tag Management

#### Current System
- **User Tags**: Users can select from predefined tags
- **Admin Tags**: Only admins can add new tags to the system
- **Tag Categories**: Organized by script type and functionality

#### Tag Categories
- **Combat**: PvP, PvM, defensive, offensive
- **Gathering**: Mining, lumberjacking, fishing, foraging
- **Crafting**: Blacksmithing, tailoring, carpentry, alchemy
- **Utility**: Banking, organization, automation
- **Advanced**: Complex systems, multi-script coordination

#### Adding New Tags
1. Navigate to Admin Panel
2. Access Tag Management (future feature)
3. Add new tag with description
4. Tag becomes available for all users

### 2. Rating System

#### Weighted Rating System
- **Jasown Scripts**: Automatically receive weighted rating (counts as 5 user ratings)
- **User Ratings**: Each user rating counts as 1
- **Comments**: Users can add comments with their ratings
- **Average Calculation**: Weighted average based on rating weights

#### Database Schema
```sql
ALTER TABLE script_ratings ADD COLUMN weight INTEGER DEFAULT 1;
ALTER TABLE script_ratings ADD COLUMN is_jasown_rating BOOLEAN DEFAULT FALSE;
```

#### Rating Management
- **Automatic Jasown Detection**: Scripts by "jasown" or "jasown scripts" get weighted ratings
- **User Comments**: Optional comments with ratings
- **Rating Display**: Shows count and average with weight consideration

### 3. Script Categories

#### Current Categories
- **GG Scripts**: All scripts default to this category
- **Python Scripts**: Alternative language support
- **Featured**: Highlighted scripts

#### Language Support
- **Razor**: Primary scripting language
- **Python**: Alternative with optional .exe download links
- **Language Field**: Required field in script creation

## User Management

### 1. User Roles

#### Regular Users
- Can submit scripts
- Can rate and comment on scripts
- Can use AI assistant
- Cannot modify featured status
- Cannot access admin functions

#### Admin Users
- All regular user permissions
- Can toggle featured script status
- Can review AI interactions
- Can manage AI rules
- Can view analytics
- Can approve/reject scripts (future)

### 2. User Activity Monitoring

#### Tracked Activities
- Script submissions
- AI interactions
- Rating submissions
- Feedback submissions

#### Analytics Available
- Most active users
- Script submission trends
- AI usage patterns
- Rating distribution

## Database Management

### 1. Schema Updates

#### Migration System
- **Migration Scripts**: Located in `backend/migrate_*.py`
- **Version Control**: Tracked migration history
- **Rollback Support**: Ability to revert changes

#### Recent Migrations
- Added `is_featured` and `rejection_reason` columns
- Added `exe_download_url` column
- Added `language` column
- Added `weight` and `is_jasown_rating` columns
- Created `ai_interaction_reviews` table

### 2. Data Integrity

#### Validation Rules
- **Required Fields**: Title, author, code, language
- **Format Validation**: Proper JSON for tags
- **Length Limits**: Reasonable limits on text fields
- **URL Validation**: Valid URLs for external links

#### Cleanup Procedures
- **Orphaned Records**: Remove unused data
- **Duplicate Detection**: Identify and merge duplicates
- **Data Consistency**: Ensure referential integrity

## Security Considerations

### 1. Access Control

#### Authentication
- **Discord Integration**: Uses Discord OAuth
- **Admin Verification**: Server-side admin status checking
- **Session Management**: Secure session handling

#### Authorization
- **Endpoint Protection**: All admin endpoints require admin status
- **Parameter Validation**: Server-side validation of all inputs
- **SQL Injection Prevention**: Parameterized queries

### 2. Data Protection

#### User Data
- **Discord IDs**: Stored securely
- **Script Content**: Validated and sanitized
- **Personal Information**: Minimal collection

#### System Security
- **API Rate Limiting**: Prevent abuse
- **Input Sanitization**: Clean all user inputs
- **Error Handling**: Secure error messages

## Monitoring and Maintenance

### 1. Performance Monitoring

#### Key Metrics
- **Response Times**: API endpoint performance
- **Database Performance**: Query execution times
- **AI Service Health**: AI response times and quality
- **User Activity**: Usage patterns and trends

#### Monitoring Tools
- **Health Checks**: Regular service health verification
- **Log Analysis**: Review system logs for issues
- **Performance Metrics**: Track system performance

### 2. Regular Maintenance

#### Daily Tasks
- Review pending AI interactions
- Monitor system health
- Check for new script submissions

#### Weekly Tasks
- Review analytics and trends
- Update AI rules if needed
- Clean up old data
- Performance optimization

#### Monthly Tasks
- Comprehensive system review
- Database optimization
- Security audit
- Feature planning

## Troubleshooting

### Common Issues

#### Featured Script Toggle Not Working
1. Verify admin status
2. Check API endpoint accessibility
3. Review server logs
4. Confirm database connectivity

#### AI Reviews Not Loading
1. Check AI service health
2. Verify database connection
3. Review API endpoint status
4. Check user permissions

#### Rule Updates Not Taking Effect
1. Verify rule file permissions
2. Check AI service restart
3. Confirm rule format validity
4. Review service logs

### Error Resolution

#### Database Errors
- Check connection status
- Verify schema integrity
- Review migration status
- Confirm data consistency

#### API Errors
- Verify endpoint accessibility
- Check parameter validation
- Review authentication status
- Confirm service health

## Future Enhancements

### Planned Features

#### Advanced Script Management
- **Bulk Operations**: Mass approve/reject scripts
- **Script Templates**: Pre-built script templates
- **Version Control**: Script versioning system
- **Collaboration Tools**: Multi-admin workflow

#### Enhanced Analytics
- **Detailed Metrics**: Comprehensive usage analytics
- **Trend Analysis**: Long-term usage trends
- **Performance Insights**: System performance metrics
- **User Behavior**: Detailed user activity analysis

#### AI Improvements
- **Custom Training**: Train on approved scripts
- **Advanced Rules**: More sophisticated rule system
- **Performance Optimization**: Faster AI responses
- **Quality Metrics**: AI response quality tracking

### Integration Opportunities

#### External Systems
- **Discord Bot**: Direct Discord integration
- **Webhook Support**: External system notifications
- **API Expansion**: Public API for external tools
- **Mobile Support**: Mobile admin interface

## Support and Documentation

### Resources
- **This Guide**: Comprehensive admin documentation
- **API Documentation**: Detailed endpoint documentation
- **User Guides**: End-user documentation
- **Technical Docs**: System architecture documentation

### Getting Help
1. Review this documentation
2. Check system logs
3. Contact system administrators
4. Submit issues through feedback system

The Admin Script Management system is designed to provide comprehensive control over script quality, AI behavior, and user experience while maintaining security and performance standards.
