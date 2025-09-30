# AI Rules System Guide

## Overview

The AI Rules System is a comprehensive framework that controls how the AI assistant behaves when generating Razor scripts. These rules ensure consistent, high-quality output that follows GG Script conventions and best practices. The system allows administrators to manage rules through a web interface with automatic versioning and backup capabilities.

## What Are AI Rules?

AI Rules are structured guidelines that instruct the AI assistant on:
- **Razor Syntax Requirements**: Proper syntax without parentheses, correct control structures
- **Best Practices**: Code organization, error handling, performance optimization
- **Common Patterns**: Standard approaches for common scripting tasks
- **Anti-Patterns**: What to avoid (serial numbers, infinite loops, etc.)
- **GG Script Conventions**: Specific patterns preferred by the GG community

## How AI Rules Work

### 1. Rule Application Process

When a user asks the AI a question:

1. **Query Processing**: User's question is analyzed
2. **Context Retrieval**: RAG system finds relevant scripts and documentation
3. **Rule Loading**: Current AI rules are loaded from `backend/ai/rules/RULES.md`
4. **Prompt Construction**: Rules are integrated into the AI prompt
5. **Response Generation**: AI generates response following the rules
6. **Code Validation**: Generated code is validated against rules

### 2. Rule Integration in Prompts

The AI receives rules in this format:
```
Follow these rules strictly:

[RULES CONTENT FROM RULES.md]

User Question: [USER'S QUESTION]

Relevant materials (including existing scripts and documentation):
[RETRIEVED CONTEXT]

IMPORTANT INSTRUCTIONS:
- If you find relevant existing scripts in the materials above, analyze them and consider adapting their patterns
- Look for scripts that solve similar problems and use their approaches as inspiration
- If you're unsure about a specific implementation, reference the existing scripts for guidance
- Always follow the patterns and best practices shown in the existing scripts
- If multiple scripts show different approaches, choose the most appropriate one for the user's needs

Respond with:
1) A concise explanation (<=8 lines) mentioning if you found relevant existing scripts to reference
2) A code block with final Razor code that incorporates best practices from existing scripts
3) A short checklist of caveats
```

## Current Rules Structure

### Core Principles
- **Clear, Minimal Code**: Prefer simple, readable solutions
- **Proper Error Handling**: Always check if items exist before using them
- **Efficient Resource Usage**: Minimize server calls and optimize loops
- **User-Friendly Interfaces**: Make scripts easy to understand and modify

### Critical Requirements
- **Gump Interactions**: Always add `waitforgump` after `gumpresponse`
- **Ignore Management**: Use `@clearignore` before ignore-heavy scans
- **Proper Waiting**: Add `wait` commands in long loops (200-650ms)
- **Error Recovery**: Handle missing items gracefully

### Code Structure Guidelines
- **Consistent Formatting**: Use proper indentation and spacing
- **Logical Flow**: Organize code in logical sections
- **Comment Requirements**: Add header comments with purpose and requirements
- **Variable Naming**: Use descriptive variable names

### Performance Guidelines
- **Minimize Server Calls**: Reduce unnecessary `findtype` operations
- **Efficient Loops**: Use appropriate loop structures
- **Resource Cleanup**: Clean up variables and lists when done
- **Timing Considerations**: Add appropriate delays

## Managing AI Rules

### Admin Interface

#### Accessing the Rules Editor
1. Navigate to **Admin Panel** → **AI Rules Management**
2. The rules editor loads the current rules from `backend/ai/rules/RULES.md`
3. Rules are displayed in a markdown text editor

#### Editing Rules
1. **Modify Rules**: Edit the rules content in the text editor
2. **Save Changes**: Click "Save Rules" button
3. **Automatic Backup**: System creates timestamped backup before saving
4. **Immediate Effect**: New rules apply to all future AI responses

#### Rule History
1. **View History**: Access rule history through the admin interface
2. **Restore Versions**: Restore previous rule versions if needed
3. **Compare Changes**: See what changed between versions

### File-Based Management

#### Rules File Location
- **Primary File**: `backend/ai/rules/RULES.md`
- **Backup Files**: `backend/ai/rules/RULES_backup_YYYYMMDD_HHMMSS.md`
- **Format**: Markdown format for easy editing

#### Manual Editing
```bash
# Edit rules directly
nano backend/ai/rules/RULES.md

# View backup files
ls backend/ai/rules/RULES_backup_*.md

# Restore from backup
cp backend/ai/rules/RULES_backup_20250101_120000.md backend/ai/rules/RULES.md
```

## Rule Categories and Examples

### 1. Syntax Rules

#### Correct Razor Syntax
```markdown
### Control Structures (NO PARENTHESES!)
```razor
// CORRECT Razor syntax:
if findtype "fishing pole" backpack as pole
  useitem pole
endif

while findtype "fish" backpack as fish
  useitem fish
  wait 1000
endwhile

// INCORRECT (C-style syntax):
if (findtype("fishing pole", backpack)) {  // WRONG!
  useitem(pole);
}
```
```

#### Common Commands
```markdown
### Common Razor Commands
```razor
// Item operations
findtype "item name" container as variable
useitem variable
drop variable
move variable container

// Movement
walk direction
run direction
stop

// Targeting
target "target name"
waitfortarget 5000
target self

// Gumps
gumpresponse 0x12345678 1
waitforgump 0x12345678

// Waits and delays
wait 1000
waitforgump 0x12345678
waitfortarget 5000

// Variables
@setvar! variableName value
@getvar! variableName
@clearvars
```
```

### 2. Best Practice Rules

#### Error Handling
```markdown
- Don't assume items exist; guard with `if findtype ... as var`
- Always check if containers exist before accessing them
- Use `insysmsg` to verify container operations when relevant
```

#### Performance Rules
```markdown
- Long loops require sleeps (`wait 200–650`) to avoid client lockups
- Use `@clearignore` before ignore-heavy scans; pair with `@ignore` consistently
- Minimize server calls by caching frequently used items
```

#### Code Organization
```markdown
- Add a comment header with purpose, inputs, and pre-reqs
- Close control structures: `endif`, `endwhile`
- Never hardcode user-specific IDs unless provided; use @setvar! and comments
```

### 3. Anti-Pattern Rules

#### What to Avoid
```markdown
- NEVER use serial numbers in findtype - use item names or graphic IDs instead
- NEVER create infinite loops without proper waits
- NEVER assume items exist without checking first
- NEVER hardcode user-specific values
```

## API Endpoints

### Get Current Rules
```http
GET /api/scripts/admin/ai-rules
Query Parameters:
- user_id: Discord ID of admin
- is_admin: true

Response:
{
  "rules": "# Razor Scripting Rules\n\n## Razor Syntax Reference...",
  "version": "rules-v1.0",
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### Update Rules
```http
PUT /api/scripts/admin/ai-rules
Content-Type: application/json

{
  "rules": "# Updated Razor Scripting Rules\n\n..."
}

Query Parameters:
- user_id: Discord ID of admin
- is_admin: true

Response:
{
  "message": "AI rules updated successfully",
  "backup_created": "backend/ai/rules/RULES_backup_20240115_103000.md",
  "updated_by": "123456789",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Get Rule History
```http
GET /api/scripts/admin/ai-rules/history
Query Parameters:
- user_id: Discord ID of admin
- is_admin: true

Response:
{
  "history": [
    {
      "filename": "RULES_backup_20240115_103000.md",
      "timestamp": "2024-01-15T10:30:00Z",
      "path": "backend/ai/rules/RULES_backup_20240115_103000.md"
    }
  ]
}
```

## Rule Development Process

### 1. Identifying New Rules

#### Sources of Rule Ideas
- **User Feedback**: Common issues reported by users
- **Code Corrections**: Patterns in user edits to AI-generated code
- **Admin Reviews**: Issues found during AI interaction reviews
- **Community Input**: Suggestions from experienced scripters

#### Pattern Recognition
The system automatically identifies common correction patterns:
- Serial number usage → Item name usage
- Missing `waitforgump` after `gumpresponse`
- Improper `findtype` usage
- Missing `@clearignore` before scans

### 2. Writing Effective Rules

#### Rule Structure
```markdown
### Rule Category
- **Specific Guideline**: Clear, actionable instruction
- **Example**: Show correct implementation
- **Anti-Example**: Show what to avoid
- **Rationale**: Explain why this rule exists
```

#### Good Rule Examples
```markdown
### Gump Handling
- After any `gumpresponse` you MUST add `waitforgump` or `wft`
- Example: `gumpresponse 1` followed by `waitforgump`
- Anti-Example: `gumpresponse 1` without waiting
- Rationale: Prevents script from continuing before gump is processed
```

#### Bad Rule Examples
```markdown
# Too vague
- Make good scripts

# Too specific
- Always use exactly 1000ms waits

# No context
- Use findtype correctly
```

### 3. Testing Rules

#### Validation Process
1. **Draft Rules**: Write new rules in a test environment
2. **Test Queries**: Ask AI common questions to test rule application
3. **Review Output**: Check if AI follows new rules correctly
4. **Iterate**: Refine rules based on test results
5. **Deploy**: Add rules to production system

#### Quality Metrics
- **Rule Compliance**: How often AI follows the rules
- **User Satisfaction**: User ratings of AI responses
- **Correction Rate**: How often users need to edit AI code
- **Pattern Recognition**: Success in avoiding common mistakes

## Rule Maintenance

### Regular Review Process

#### Weekly Reviews
1. **Analyze Feedback**: Review user feedback and corrections
2. **Identify Patterns**: Look for recurring issues
3. **Update Rules**: Add or modify rules based on findings
4. **Test Changes**: Validate rule changes before deployment

#### Monthly Reviews
1. **Comprehensive Analysis**: Review all rule categories
2. **Performance Metrics**: Analyze AI response quality trends
3. **Rule Effectiveness**: Assess which rules are most/least effective
4. **Documentation Updates**: Update rule documentation

### Backup and Version Control

#### Automatic Backups
- **Every Save**: Backup created before each rule update
- **Timestamped Files**: `RULES_backup_YYYYMMDD_HHMMSS.md`
- **Retention Policy**: Keep backups for 30 days
- **Restore Capability**: Easy restoration from any backup

#### Manual Backups
```bash
# Create manual backup
cp backend/ai/rules/RULES.md backend/ai/rules/RULES_manual_backup_$(date +%Y%m%d).md

# List all backups
ls backend/ai/rules/RULES_backup_*.md

# Restore from specific backup
cp backend/ai/rules/RULES_backup_20240115_103000.md backend/ai/rules/RULES.md
```

## Troubleshooting

### Common Issues

#### Rules Not Taking Effect
1. **Check File Permissions**: Ensure rules file is readable
2. **Verify Format**: Check for markdown syntax errors
3. **Restart Service**: Restart backend if needed
4. **Check Logs**: Review server logs for errors

#### Rule Conflicts
1. **Identify Conflicting Rules**: Look for contradictory instructions
2. **Prioritize Rules**: Determine which rule takes precedence
3. **Clarify Language**: Make rules more specific
4. **Test Resolution**: Verify conflict resolution works

#### Performance Impact
1. **Rule Length**: Very long rules may slow AI responses
2. **Complexity**: Overly complex rules may confuse AI
3. **Redundancy**: Remove duplicate or redundant rules
4. **Optimization**: Streamline rule language

### Debug Information

#### Rule Loading Debug
```bash
# Check if rules file exists and is readable
ls -la backend/ai/rules/RULES.md

# View current rules content
head -20 backend/ai/rules/RULES.md

# Check file permissions
stat backend/ai/rules/RULES.md
```

#### API Debug
```bash
# Test rules endpoint
curl -X GET "http://localhost:7000/api/scripts/admin/ai-rules?user_id=YOUR_DISCORD_ID&is_admin=true"

# Check response format
curl -X GET "http://localhost:7000/api/scripts/admin/ai-rules?user_id=YOUR_DISCORD_ID&is_admin=true" | jq .
```

## Best Practices

### For Rule Writers

#### Writing Effective Rules
1. **Be Specific**: Use clear, actionable language
2. **Provide Examples**: Show both correct and incorrect usage
3. **Explain Rationale**: Help AI understand why rules exist
4. **Test Thoroughly**: Validate rules before deployment
5. **Keep Updated**: Regularly review and update rules

#### Rule Organization
1. **Categorize Rules**: Group related rules together
2. **Use Headers**: Organize with clear markdown headers
3. **Prioritize Rules**: Put most important rules first
4. **Avoid Redundancy**: Don't repeat the same rule multiple times

### For Administrators

#### Rule Management
1. **Regular Reviews**: Schedule regular rule review sessions
2. **User Feedback**: Actively seek user feedback on AI responses
3. **Performance Monitoring**: Track AI response quality metrics
4. **Backup Strategy**: Maintain multiple backup copies
5. **Change Documentation**: Document why rules were changed

#### Quality Assurance
1. **Test Before Deploy**: Always test rule changes
2. **Monitor Impact**: Watch for changes in AI behavior
3. **User Communication**: Inform users of significant rule changes
4. **Rollback Plan**: Have a plan to revert problematic changes

## Future Enhancements

### Planned Features

#### Advanced Rule Management
1. **Rule Templates**: Pre-built rule sets for different script types
2. **Conditional Rules**: Rules that apply based on context
3. **Rule Dependencies**: Rules that depend on other rules
4. **Automatic Rule Testing**: Automated testing of rule changes

#### Enhanced Analytics
1. **Rule Effectiveness Metrics**: Track which rules are most effective
2. **User Behavior Analysis**: Understand how users interact with AI
3. **Performance Optimization**: Optimize rules for better AI performance
4. **Predictive Analytics**: Predict which rules might need updates

#### Community Features
1. **Rule Suggestions**: Allow users to suggest rule improvements
2. **Community Voting**: Let community vote on rule changes
3. **Rule Discussions**: Forum for discussing rule improvements
4. **Expert Reviews**: Expert review of proposed rule changes

## Support and Resources

### Getting Help
1. **Documentation**: Review this guide and related documentation
2. **Admin Interface**: Use the built-in rule management tools
3. **Community**: Seek help from other administrators
4. **Technical Support**: Contact system administrators for technical issues

### Additional Resources
- **AI Agent Guide**: Understanding how AI uses rules
- **Admin Script Management Guide**: Overall admin system documentation
- **Scripts System Documentation**: Understanding the broader system
- **API Documentation**: Technical details of rule management endpoints

The AI Rules System is a powerful tool for ensuring consistent, high-quality AI responses. By following these guidelines and best practices, administrators can effectively manage and improve the AI assistant's performance while maintaining the high standards expected by the GG scripting community.
