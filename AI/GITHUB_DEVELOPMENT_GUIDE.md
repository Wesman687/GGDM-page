# GitHub Development Guide

## Overview

This guide covers the GitHub setup, development workflow, and deployment strategy for the DM Portal project. The project uses a development-focused branching strategy to ensure safe development while maintaining production stability.

## Repository Structure

### GitHub Repository
- **Repository**: `https://github.com/Wesman687/GGDM-page`
- **Owner**: Wesman687
- **Current Branch**: `dev` (development branch)
- **Production Branch**: `main` (for production deployments)

### Local Development Setup
- **Local Path**: `C:\Code\GG-DM-editor\dm-portal`
- **Git Remote**: `origin` → `https://github.com/Wesman687/GGDM-page.git`
- **Current Branch**: `dev`
- **Tracking**: `origin/dev`

## Development Workflow

### Branch Strategy

#### Current Setup
```
main (production)
  ↑
dev (development) ← You are here
```

#### Branch Purposes
- **`dev`**: Active development branch where all new features and changes are made
- **`main`**: Production-ready code that is deployed to live environments
- **Feature Branches**: Optional - for larger features (can be created from `dev`)

### Development Process

#### 1. Daily Development Workflow
```bash
# Start your development session
git status                    # Check current status
git pull origin dev          # Get latest changes from GitHub

# Make your changes
# ... edit files ...

# Save your work
git add .                    # Stage all changes
git commit -m "Description of changes"
git push origin dev          # Push to GitHub dev branch
```

#### 2. Feature Development
```bash
# For larger features, create feature branches
git checkout -b feature/new-feature-name
# ... develop feature ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature-name

# Merge back to dev when complete
git checkout dev
git merge feature/new-feature-name
git push origin dev
```

#### 3. Production Deployment
```bash
# When ready for production
git checkout main
git merge dev                # Merge dev into main
git push origin main         # Deploy to production

# Tag the release (optional)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Security and Environment Management

### Environment Files
The project uses multiple environment files that are properly excluded from version control:

#### Root Level
- `.env` - **EXCLUDED** (contains sensitive API keys)
- `.gitignore` - Includes comprehensive exclusions

#### Backend Environment
- `backend/.env` - **EXCLUDED** (backend API keys)
- `backend/.env.example` - **INCLUDED** (template for setup)

#### Frontend Environment
- `frontend/.env.local` - **EXCLUDED** (frontend API keys)
- `frontend/.env.example` - **INCLUDED** (template for setup)

### Protected Files
The `.gitignore` file ensures these sensitive files are never committed:
```gitignore
# Environment variables and secrets
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# API Keys and sensitive data
*.key
*.pem
secrets/
```

### Environment Variables Required

#### Backend (.env)
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# Database Configuration
AI_DB_DSN=sqlite:///./ai_service.db

# Discord Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=LeoPiro
GITHUB_REPO_NAME=GG_Dms

# Admin Configuration
SUPER_ADMIN_IDS=your_discord_id,other_admin_id
```

#### Frontend (.env.local)
```bash
# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Discord Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# GG Discord Server
NEXT_PUBLIC_GG_GUILD_ID=your_gg_discord_server_id

# Admin IDs
NEXT_PUBLIC_ADMIN_IDS=admin1_discord_id,admin2_discord_id

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:7000
```

## Project Status and Content

### Current Repository Status
- **Total Files**: 149 files
- **Total Lines**: 37,512 lines of code
- **Last Commit**: Initial commit with comprehensive DM Portal features
- **Branch**: `dev` (safe for development)

### Major Components Included

#### AI System
- **AI Agent System**: Comprehensive Razor scripting assistant
- **RAG System**: Retrieval-Augmented Generation with FAISS
- **Self-Learning System**: User feedback integration
- **Rule Management**: Admin-controlled AI behavior rules

#### Script Management
- **Script Database**: SQLite with comprehensive script storage
- **Rating System**: Interactive user ratings and reviews
- **Search System**: Manual and AI-powered search
- **Admin Workflow**: Approval and management system

#### Portal Features
- **Dockmaster Suggestions**: GitHub-integrated suggestion system
- **Discord Authentication**: OAuth2 integration with GG server
- **Admin Panel**: Comprehensive admin management interface
- **Training Data Collection**: Advanced AI learning system

## Development Best Practices

### Code Organization
- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Python
- **Database**: SQLite with FAISS for vector search
- **AI Integration**: Consolidated into main backend (simplified architecture)

### Commit Guidelines
```bash
# Good commit messages
git commit -m "Add user rating system to script cards"
git commit -m "Fix AI response timeout handling"
git commit -m "Update admin panel with new analytics"

# Avoid vague messages
git commit -m "fix stuff"
git commit -m "updates"
```

### File Management
- **Never commit**: `.env` files, API keys, or sensitive data
- **Always commit**: Code changes, documentation, configuration templates
- **Use .gitignore**: Comprehensive exclusions for security

## Deployment Strategy

### Development Environment
- **Local Development**: `dev` branch for active development
- **Testing**: Test features thoroughly before merging to main
- **Backup**: Regular commits to GitHub for backup

### Production Environment
- **Main Branch**: Production-ready code only
- **Deployment**: Merge from `dev` to `main` when ready
- **Tagging**: Optional version tags for releases

### Deployment Process
```bash
# 1. Ensure dev branch is stable
git checkout dev
git pull origin dev
# Test thoroughly

# 2. Merge to main for production
git checkout main
git pull origin main
git merge dev
git push origin main

# 3. Tag release (optional)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Collaboration Workflow

### Working with Others
1. **Always pull latest changes** before starting work
2. **Commit frequently** to save progress
3. **Push to dev branch** for backup and collaboration
4. **Use descriptive commit messages**
5. **Test changes** before pushing

### Code Reviews
- **Self-Review**: Check your own code before committing
- **Testing**: Verify functionality works as expected
- **Documentation**: Update relevant documentation

### Issue Management
- **GitHub Issues**: Use for bug reports and feature requests
- **Pull Requests**: For code reviews and merging
- **Labels**: Organize issues with appropriate labels

## Troubleshooting

### Common Git Issues

#### 1. Merge Conflicts
```bash
# If conflicts occur during merge
git status                    # See conflicted files
# Edit files to resolve conflicts
git add .
git commit -m "Resolve merge conflicts"
```

#### 2. Detached HEAD
```bash
# If you're in detached HEAD state
git checkout dev             # Return to dev branch
```

#### 3. Uncommitted Changes
```bash
# If you have uncommitted changes and need to switch branches
git stash                    # Save changes temporarily
git checkout other-branch
git stash pop               # Restore changes
```

#### 4. Remote Changes
```bash
# If remote has changes you don't have locally
git pull origin dev         # Pull and merge remote changes
```

### Environment Issues

#### 1. Missing Environment Variables
- Check that `.env` files exist in correct locations
- Verify all required variables are set
- Use `.env.example` files as templates

#### 2. API Key Issues
- Ensure API keys are valid and have proper permissions
- Check rate limits and quotas
- Verify keys are not expired

#### 3. Database Issues
- Ensure SQLite database files are writable
- Check database file paths in configuration
- Verify database schema is up to date

## Monitoring and Maintenance

### Regular Tasks
1. **Daily**: Commit and push changes to GitHub
2. **Weekly**: Review and merge completed features
3. **Monthly**: Plan production releases
4. **As needed**: Update dependencies and security patches

### Backup Strategy
- **GitHub**: Primary backup (automatic with pushes)
- **Local**: Keep local repository as secondary backup
- **Database**: Regular SQLite database backups
- **Environment**: Backup `.env` files separately (not in Git)

### Performance Monitoring
- **GitHub**: Monitor repository size and activity
- **Application**: Monitor application performance and errors
- **Database**: Monitor database performance and size
- **AI System**: Monitor AI response times and quality

## Security Considerations

### Repository Security
- **No Secrets in Code**: All sensitive data in `.env` files
- **Comprehensive .gitignore**: Excludes all sensitive files
- **Regular Updates**: Keep dependencies updated
- **Access Control**: Limit repository access to authorized users

### Development Security
- **Environment Isolation**: Separate dev and production environments
- **API Key Management**: Secure storage of API keys
- **Input Validation**: Validate all user inputs
- **Error Handling**: Don't expose sensitive information in errors

## Getting Help

### Documentation Resources
- **This Guide**: GitHub development workflow
- **AI Documentation**: AI system setup and usage
- **API Documentation**: Backend API endpoints
- **Frontend Documentation**: React components and pages

### Support Channels
1. **GitHub Issues**: For bug reports and feature requests
2. **Documentation**: Check relevant documentation first
3. **Code Review**: Ask for code reviews on significant changes
4. **Community**: Engage with the development community

## Future Enhancements

### Planned Improvements
1. **CI/CD Pipeline**: Automated testing and deployment
2. **Code Quality**: Automated linting and formatting
3. **Testing**: Comprehensive test suite
4. **Documentation**: Enhanced documentation and guides
5. **Monitoring**: Advanced monitoring and alerting

### Development Tools
1. **Pre-commit Hooks**: Automated code quality checks
2. **Automated Testing**: Run tests before commits
3. **Code Coverage**: Track test coverage
4. **Performance Monitoring**: Monitor application performance

This GitHub development guide ensures safe, organized development while maintaining the security and integrity of the DM Portal project. The development-focused workflow allows for rapid iteration while keeping production stable and secure.
