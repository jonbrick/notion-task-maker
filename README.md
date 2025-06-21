# 🤖 Apple Notes to Notion Task Processor

This Node.js automation tool scans Apple Notes for notes titled "#Work" or "#Personal", extracts all text lines as tasks, uses Claude AI to categorize them into health/work/personal types, creates organized Notion database entries, and cleans up the original notes while preserving comments.

## ✨ Features

- **Smart Note Detection**: Automatically finds notes titled `#Work` or `#Personal` (case-insensitive)
- **AI-Powered Classification**: Uses Claude API to categorize personal tasks into Physical Health, Personal, Interpersonal, Mental Health, and Home
- **Comment Preservation**: Lines starting with `//` are kept as notes and won't become tasks
- **Interactive Confirmation**: Preview what will be processed before committing changes
- **Flexible Execution**: Run with confirmation prompts, dry-run mode, or auto-confirmation
- **Clean Processing**: Removes processed tasks while maintaining note structure and comments

## 🚀 Quick Start

### Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment** (create `.env` file):

   ```env
   NOTION_TOKEN=your_notion_integration_token
   ANTHROPIC_API_KEY=your_claude_api_key
   TASKS_DATABASE_ID=your_notion_tasks_database_id
   ```

3. **Optional context file**:
   ```bash
   touch context.md
   # Add personal context to improve AI task categorization
   ```

### Usage

**Interactive mode** (with confirmation):

```bash
node process-notes.js
```

**Dry run** (preview only):

```bash
node process-notes.js --dry-run
```

**Auto-confirm** (skip prompts):

```bash
node process-notes.js --yes
```

## 📝 How It Works

### Apple Notes Setup

Create two notes in Apple Notes:

- One titled `#Work`
- One titled `#Personal`

Add your tasks as individual lines:

```
#Work
Review design mockups
Fix login bug
Call client about project

// Meeting notes from yesterday
// Remember to follow up on proposal
```

```
#Personal
Workout at gym
Buy groceries
Call mom
Schedule dentist appointment

// Weekend plans
// Pick up dry cleaning
```

### Task Processing

1. **Extraction**: Every non-empty line becomes a task (except comments starting with `//`)
2. **Classification**:
   - Work tasks → automatically tagged as "💼 Work"
   - Personal tasks → AI classifies into appropriate categories
3. **Notion Creation**: Tasks added with today's date and "🔴 To Do" status
4. **Cleanup**: Processed tasks removed from notes, comments preserved

### Task Categories

Personal tasks are automatically categorized into:

- **🏃‍♂️ Physical Health**: Exercise, sports, fitness activities
- **🌱 Personal**: Reading, learning, hobbies, personal projects
- **🍻 Interpersonal**: Social activities, friends, family time
- **❤️ Mental Health**: Meditation, therapy, self-care
- **🏠 Home**: Cleaning, organizing, household tasks

## 🛠️ Notion Database Requirements

Your Notion tasks database needs these properties:

- **Task** (Title) - The task description
- **Due Date** (Date) - Set to today by default
- **Type** (Select) - Categories listed above
- **Status** (Status) - Including "🔴 To Do" option

## 💡 Tips

**Use comments for context**:

```
Buy birthday gift for Sarah
Call John about the proposal
// Sarah's birthday is next week
// John is the project manager
```

**Add context for better AI classification**:
Create `context.md` with personal details:

```markdown
# Context for AI Task Classification

## People

- Sarah: My sister
- John: Project manager at work

## Activities

- Spin class: My regular workout at FitLife gym
```

## 🐛 Troubleshooting

**Debug mode**:

```bash
DEBUG=true node process-notes.js
```

**Common issues**:

- Ensure notes are titled exactly `#Work` or `#Personal`
- Check that Notion database properties match requirements
- Verify API keys are correctly set in `.env`

## 🔧 Technical Details

**Dependencies**:

- `@notionhq/client` - Notion API integration
- `@anthropic-ai/sdk` - Claude AI for task classification
- `applescript` - Apple Notes access via AppleScript
- `dotenv` - Environment variable management

**Architecture**:

- AppleScript integration for secure Apple Notes access
- Claude Haiku for cost-effective task classification (~$0.0001 per task)
- Notion API for structured task management
- Node.js orchestration with error handling and confirmation flows

## 📊 Cost Estimation

- **Per task**: ~$0.0001 (using Claude Haiku)
- **Daily use (10 tasks)**: ~$0.03/month
- **Heavy use (100 tasks/month)**: ~$0.01/month

Extremely affordable for the productivity boost!

---

**Built with**: Node.js, AppleScript, Notion API, Claude AI
