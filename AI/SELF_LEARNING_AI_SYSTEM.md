# Self-Learning AI System Documentation

## Overview

The Self-Learning AI System is an enhanced feature that allows users to interactively edit AI-generated code and submit rule suggestions, making the AI system continuously improve based on user feedback and corrections.

## Features

### 1. Interactive Code Editing
- **Inline Code Editor**: Users can edit AI-generated code directly in the chat interface
- **Real-time Editing**: Edit code with syntax highlighting and proper formatting
- **Save/Cancel Options**: Users can save their edits or cancel changes

### 2. Intelligent Rule Suggestions
- **Automatic Detection**: System automatically detects common issues in code
- **Rule Generation**: Generates specific rule suggestions based on code changes
- **Smart Learning**: Identifies patterns like:
  - Serial number usage instead of item names
  - Missing `waitforgump` after `gumpresponse`
  - Improper `findtype` usage
  - Missing `@clearignore` before scans

### 3. Admin Review System
- **Rule Suggestion Management**: Admins can review, approve, or reject rule suggestions
- **Automatic Rule Integration**: Approved rules are automatically added to the AI rules file
- **Backup System**: Automatic backups created before rule changes

## User Interface

### For Users
1. **Edit Button**: Click "Edit" on any AI-generated code block
2. **Code Editor**: Modify the code in the provided textarea
3. **Save Changes**: Click "Save" to submit the edited code
4. **Rule Suggestions**: Review and submit suggested rule improvements
5. **Feedback**: System learns from your corrections

### For Admins
1. **Rule Suggestions Page**: Navigate to Admin Panel → AI Rules Management → Rule Suggestions
2. **Review Interface**: See all pending rule suggestions with context
3. **Approve/Reject**: Make decisions on rule suggestions with optional notes
4. **Automatic Integration**: Approved rules are added to the AI system

## Technical Implementation

### Frontend Components

#### AIBotInterface.tsx Enhancements
```typescript
interface AIMessage {
  // ... existing fields
  isEditing?: boolean
  editedCode?: string
  suggestedRules?: string[]
}
```

**Key Features:**
- Inline code editor with syntax highlighting
- Rule suggestion generation and display
- Enhanced feedback submission system

#### Admin Interface
- **admin-rule-suggestions.tsx**: Complete admin interface for managing rule suggestions
- Status filtering (pending, approved, rejected)
- Admin notes and review system

### Backend Implementation

#### Database Schema
```sql
CREATE TABLE rule_suggestions (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    suggestion TEXT NOT NULL,
    status VARCHAR DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### API Endpoints
- `POST /api/ai/rule-suggestions` - Submit rule suggestions
- `GET /api/ai/rule-suggestions` - Get rule suggestions (with filtering)
- `PUT /api/ai/rule-suggestions/{id}` - Update rule suggestion status

### Rule Learning Algorithm

#### Code Analysis
The system analyzes code changes to generate rule suggestions:

```typescript
const generateRuleSuggestions = (originalCode: string, editedCode: string) => {
  const suggestions: string[] = []
  
  // Detect serial number usage
  if (originalCode.includes('0x') && !editedCode.includes('0x')) {
    suggestions.push('NEVER use serial numbers in findtype - use item names or graphic IDs instead')
  }
  
  // Detect proper item name usage
  if (editedCode.includes('findtype') && editedCode.includes('"')) {
    suggestions.push('Good use of item names in findtype commands')
  }
  
  // Detect missing waitforgump
  if (editedCode.includes('waitforgump') && !originalCode.includes('waitforgump')) {
    suggestions.push('Always add waitforgump after gumpresponse commands')
  }
  
  return { ruleSuggestions: suggestions }
}
```

## Usage Examples

### Example 1: Fixing Serial Number Usage

**Original AI Code:**
```razor
if findtype 0x0E7D backpack as pole
    dclick pole
endif
```

**User Edits to:**
```razor
if findtype "fishing pole" backpack as pole
    dclick pole
endif
```

**Generated Rule Suggestion:**
- "NEVER use serial numbers in findtype - use item names or graphic IDs instead"

### Example 2: Adding Missing Gump Handling

**Original AI Code:**
```razor
gumpresponse 1
// Missing waitforgump
```

**User Edits to:**
```razor
gumpresponse 1
waitforgump
```

**Generated Rule Suggestion:**
- "Always add waitforgump after gumpresponse commands"

## Benefits

### For Users
1. **Immediate Corrections**: Fix AI code on the spot
2. **Learning System**: AI improves based on your corrections
3. **Better Results**: Future AI responses will be more accurate
4. **Community Contribution**: Help improve the system for everyone

### For Admins
1. **Quality Control**: Review and approve rule improvements
2. **System Evolution**: AI rules evolve based on real usage
3. **Automated Integration**: Approved rules are automatically added
4. **Backup Safety**: All changes are backed up before implementation

### For the System
1. **Continuous Learning**: AI gets smarter with each interaction
2. **Pattern Recognition**: Identifies common issues and improvements
3. **Community-Driven**: Rules evolve based on community needs
4. **Self-Improvement**: System becomes more accurate over time

## Migration and Setup

### Database Migration
Run the migration script to create the rule_suggestions table:
```bash
cd backend
python migrate_rule_suggestions.py
```

### Admin Access
- Navigate to Admin Panel → AI Rules Management → Rule Suggestions
- Review pending suggestions
- Approve or reject with notes

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Use ML to better predict rule improvements
2. **Pattern Analysis**: Analyze multiple corrections to identify broader patterns
3. **Community Voting**: Allow community to vote on rule suggestions
4. **Automatic Rule Testing**: Test new rules before approval
5. **Performance Metrics**: Track improvement in AI response quality

### Advanced Learning
1. **Context-Aware Rules**: Rules that adapt based on script type
2. **User-Specific Learning**: Personalize AI responses based on user preferences
3. **Historical Analysis**: Learn from historical corrections and patterns
4. **Cross-Reference Learning**: Learn from similar scripts and corrections

## Best Practices

### For Users
1. **Be Specific**: When editing code, make clear, purposeful changes
2. **Explain Changes**: Use the feedback system to explain why changes were made
3. **Submit Suggestions**: Don't just edit code - submit rule suggestions too
4. **Test Changes**: Verify your edits work before submitting

### For Admins
1. **Review Thoroughly**: Carefully review all rule suggestions
2. **Add Notes**: Provide clear feedback when approving or rejecting
3. **Monitor Impact**: Watch for improvements in AI response quality
4. **Backup Regularly**: Ensure rule backups are maintained

## Troubleshooting

### Common Issues
1. **Edit Button Not Appearing**: Ensure you're logged in and viewing AI responses
2. **Rule Suggestions Not Generated**: Check that code changes are significant enough
3. **Admin Access Denied**: Verify admin privileges are properly configured
4. **Migration Errors**: Ensure database permissions are correct

### Support
For technical issues or questions about the self-learning system:
1. Check this documentation
2. Review server logs for errors
3. Contact system administrators
4. Submit feedback through the system

The Self-Learning AI System represents a significant advancement in making AI assistance more interactive, accurate, and community-driven. By allowing users to directly improve the system through their corrections and suggestions, we create a continuously evolving AI that better serves the UO Outlands scripting community.
