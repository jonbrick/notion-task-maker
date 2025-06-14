# Apple Notes to Notion Task Automation

A simple, powerful automation tool that captures tasks from Apple Notes and creates them in Notion with AI-powered categorization. Write tasks naturally in Apple Notes, and let this script handle the organization.

## ✨ Features

- **Natural Task Capture**: Write tasks in Apple Notes without special formatting
- **AI-Powered Classification**: Automatically categorizes personal tasks using Claude AI
- **Comment Support**: Use `//` to add notes that won't become tasks
- **Auto-Cleanup**: Removes processed tasks while preserving comments and structure
- **Flexible Input**: Works with bullets (`*`, `-`) or plain text
- **Debug Mode**: Built-in debugging for troubleshooting

## 🚀 Quick Start

### Prerequisites

- macOS (for Apple Notes access)
- Node.js (v14 or higher)
- Notion account with API access
- Anthropic Claude API key

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd task-maker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your credentials:
   ```env
   NOTION_TOKEN=your_notion_integration_token
   ANTHROPIC_API_KEY=your_claude_api_key
   TASKS_DATABASE_ID=your_notion_tasks_database_id
   ```

### Notion Database Setup

Your Notion tasks database should have these properties:

- **Task** (Title) - The task description
- **Due Date** (Date) - Set to today by default
- **Type** (Select) - With these options:
  - 🏃‍♂️ Physical Health
  - 💼 Work
  - 🌱 Personal
  - 🍻 Interpersonal
  - ❤️ Mental Health
  - 🏠 Home
- **Status** (Status) - Including "🔴 To Do"

## 📝 Usage

### 1. Create Apple Notes

Create two notes in Apple Notes:

- One titled `#Work` (or `#work`, `#WORK`)
- One titled `#Personal` (or `#personal`, `#PERSONAL`)

### 2. Add Tasks

Write tasks naturally in your notes:

**#Work note:**

```
#Work
Fix bug in login flow
Review design mockups
Call client about project

// Done yesterday:
// Updated documentation
```

**#Personal note:**

```
#Personal
Workout
Buy groceries
* Call mom
- Schedule dentist appointment

// Weekend plans
Go hiking
// Remember to bring water
```

### 3. Run the Script

```bash
node process-notes.js
```

For debugging:

```bash
DEBUG=true node process-notes.js
```

### 4. Results

- Tasks are created in Notion with appropriate categories
- Work tasks → automatically categorized as "💼 Work"
- Personal tasks → AI categorized (e.g., "Workout" → "🏃‍♂️ Physical Health")
- Comments (lines starting with `//`) are preserved
- Processed tasks are removed from notes

## 🎯 Task Categories

The AI automatically categorizes personal tasks into:

- **🏃‍♂️ Physical Health**: Exercise, sports, fitness activities
- **🌱 Personal**: Reading, learning, hobbies, personal projects
- **🍻 Interpersonal**: Social activities, friends, family time
- **❤️ Mental Health**: Meditation, therapy, self-care
- **🏠 Home**: Cleaning, organizing, household tasks

## 💡 Tips & Tricks

### Comments

Use `//` to add context without creating tasks:

```
// Morning routine
Make coffee
Meditate 10 mins
// After work
Gym class at 6pm
```

### Natural Writing

No special formatting needed:

```
Call John about the proposal
* Pick up dry cleaning
- Buy birthday gift for Sarah
Schedule team lunch
```

All formats work - bullets are optional!

### Custom Context (Optional)

Create a `context.md` file to improve AI categorization:

```markdown
# Context for AI Task Classification

## People

- Sarah: My sister
- John: Project manager at work

## Places

- Gym class: Usually refers to spin class at FitLife
```

## 🔧 Configuration

### Environment Variables

- `NOTION_TOKEN`: Your Notion integration token
- `ANTHROPIC_API_KEY`: Claude API key for classification
- `TASKS_DATABASE_ID`: ID of your Notion tasks database
- `DEBUG`: Set to 'true' for verbose output

### Customization

Edit these in `process-notes.js`:

- Task categories (add/remove/modify)
- AI model (default: claude-3-haiku-20240307)
- Default task status

## 🐛 Troubleshooting

### "No notes found"

- Ensure notes are titled exactly `#Work` or `#Personal`
- Check that notes exist in the default Notes account

### Tasks not being created

- Verify your Notion database has all required properties
- Check that task types match your database options
- Run with `DEBUG=true` to see detailed output

### Cleanup issues

- Apple Notes sometimes adds special characters
- Comments should start with `//` at the beginning of the line
- The script preserves note structure and spacing

## 📚 How It Works

1. **Searches** Apple Notes for notes titled #Work or #Personal
2. **Extracts** all non-empty lines as potential tasks
3. **Filters** out comments (lines starting with //)
4. **Categorizes** tasks using AI (for personal) or defaults (for work)
5. **Creates** tasks in Notion with today's date
6. **Cleans** notes by removing processed tasks, keeping comments

## 🤝 Contributing

Feel free to open issues or submit pull requests. Some ideas for improvements:

- Support for due dates in task text
- Additional task properties
- Custom categories
- Multiple note support

## 📄 License

MIT License - Use freely and modify as needed!

---

Built with ❤️ to make task management effortless
