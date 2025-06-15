# 🤖 Apple Notes to Notion Task Processor

Automated system that captures tasks from Apple Notes and creates them in Notion with AI-powered categorization. Write tasks naturally in Apple Notes, and let this tool organize them instantly via Spotlight!

## ✨ Features

- **🎯 Two Ways to Run**:
  - Terminal with confirmation prompt
  - Spotlight integration via Automator app
- **Natural Task Capture**: Write tasks in Apple Notes without special formatting
- **AI-Powered Classification**: Automatically categorizes personal tasks using Claude AI
- **Comment Support**: Use `//` to add notes that won't become tasks
- **Auto-Cleanup**: Removes processed tasks while preserving comments and structure
- **Flexible Input**: Works with bullets (`*`, `-`) or plain text
- **Interactive Confirmation**: See what will be processed before committing
- **Success Notifications**: Audio alerts and dialogs confirm completion

## 🚀 Quick Start

### Initial Setup

1. **Clone and install**:

   ```bash
   git clone <your-repo>
   cd notion-scripts/task-maker
   npm install
   ```

2. **Set up environment** (create `.env` file):

   ```env
   NOTION_TOKEN=your_notion_integration_token
   ANTHROPIC_API_KEY=your_claude_api_key
   TASKS_DATABASE_ID=your_notion_tasks_database_id
   ```

3. **Create context file** (optional):
   ```bash
   touch context.md
   # Add personal context for better AI categorization
   ```

## 🎮 Two Ways to Use

### 1. Terminal Mode

Run directly for interactive confirmation:

```bash
node process-notes.js
```

You'll see:

```
🚀 Starting Apple Notes to Notion task automation...
🔍 Looking for notes titled #Work or #Personal

📊 Found tasks in your notes:
   #Work: 3 task(s)
   #Personal: 2 task(s)

⚠️  These will be moved to Notion and removed from your notes.
❓ Continue? (y/n):
```

### 2. Spotlight Mode (via Automator)

Press `Cmd + Space`, type "Task", and hit Enter for the full GUI experience!

## 🤖 Automator Setup (Spotlight Integration)

Transform this into a macOS-native app accessible from anywhere!

### Creating the Automator App

1. **Open Automator** and create a new **Application**

2. **Add "Run AppleScript" action** with this code:

```applescript
on run {input, parameters}
    -- Simple intro dialog
    display dialog "🤖 Task Processor" & return & return & "This will:" & return & "• Find tasks in #Work and #Personal notes" & return & "• Move them to Notion" & return & "• Clean up your notes" & return & return & "Ready to scan your notes?" buttons {"Cancel", "Scan Notes"} default button "Scan Notes" with title "🤖 Task Processor" with icon note

    -- Return empty array to pass to shell script
    return {}
end run
```

3. **Add "Run Shell Script" action** with:

   - Shell: `/bin/zsh`
   - Pass input: **as arguments** ⚠️ IMPORTANT!
   - Code:

   ```bash
   #!/bin/zsh
   # Load your node environment
   export PATH="/Users/YOUR_USERNAME/.nvm/versions/node/vXX.XX.X/bin:$PATH"

   # Navigate to your task-maker directory
   cd /path/to/your/task-maker

   # First, run in dry-run mode to see what we'll process
   node process-notes.js --dry-run

   # Check if the dry run found any tasks
   if [ $? -ne 0 ]; then
       # No tasks found
       osascript -e 'tell application "System Events" to display dialog "📭 No tasks found!" & return & return & "Your #Work and #Personal notes are empty." buttons {"OK"} default button "OK" with title "🤖 Task Processor"'
       exit 0
   fi

   # Read the task counts
   if [ -f "/tmp/task-counts.json" ]; then
       # Parse the counts
       TOTAL_TASKS=$(cat /tmp/task-counts.json | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

       # Get counts for each note type
       WORK_COUNT=$(cat /tmp/task-counts.json | grep -o '"💼 Work":[0-9]*' | grep -o '[0-9]*' || echo "0")
       PERSONAL_COUNT=0

       # Sum up all personal categories
       for category in "🏃‍♂️ Physical Health" "🌱 Personal" "🍻 Interpersonal" "❤️ Mental Health" "🏠 Home"; do
           COUNT=$(cat /tmp/task-counts.json | grep -o "\"$category\":[0-9]*" | grep -o '[0-9]*' || echo "0")
           PERSONAL_COUNT=$((PERSONAL_COUNT + COUNT))
       done

       # Build the message
       DETAILS=""
       if [ "$WORK_COUNT" -gt 0 ]; then
           DETAILS="${DETAILS}#Work: ${WORK_COUNT} task(s)"$'\n'
       fi
       if [ "$PERSONAL_COUNT" -gt 0 ]; then
           DETAILS="${DETAILS}#Personal: ${PERSONAL_COUNT} task(s)"$'\n'
       fi

       # Remove trailing newline
       DETAILS=$(echo -n "$DETAILS")

       # Show confirmation dialog
       osascript <<EOF
       tell application "System Events"
           set dialogResult to display dialog "📊 Found tasks in your notes:" & return & return & "${DETAILS}" & return & return & "⚠️ These will be moved to Notion and removed from your notes." buttons {"Cancel", "Process Tasks"} default button "Process Tasks" with title "🤖 Task Processor" with icon note

           if button returned of dialogResult is "Cancel" then
               error number -128
           end if
       end tell
   EOF

       # Check if user cancelled
       if [ $? -eq 128 ]; then
           rm -f /tmp/task-counts.json
           exit 0
       fi

       # User confirmed - run the actual processing
       node process-notes.js --yes

       EXIT_CODE=$?

       # Clean up temp file
       rm -f /tmp/task-counts.json

       if [ $EXIT_CODE -eq 0 ]; then
           # Success dialog
           osascript -e "tell application \"System Events\" to display dialog \"✅ Success!\" & return & return & \"${TOTAL_TASKS} task(s) have been moved to Notion.\" & return & return & \"Your notes have been cleaned up.\" buttons {\"OK\"} default button \"OK\" with title \"🤖 Task Processor\""

           # Also show notification
           osascript -e "display notification \"${TOTAL_TASKS} tasks moved to Notion!\" with title \"🤖 Tasks Complete\" sound name \"Glass\""
       else
           # Error occurred
           osascript -e 'tell application "System Events" to display dialog "❌ Error processing tasks" & return & return & "Check the terminal for details." buttons {"OK"} default button "OK" with title "Task Processor"'
       fi
   else
       osascript -e 'tell application "System Events" to display dialog "❌ Error reading task counts" buttons {"OK"} default button "OK" with title "Task Processor"'
       exit 1
   fi
   ```

4. **Update the paths**:

   - Find your node path: `which node`
   - Update the `export PATH` line with your result
   - Update the `cd` line to your task-maker directory path

5. **Save as Application**:
   - Name: "Task Processor" (or whatever you like)
   - Where: Applications folder
   - File Format: Application

### Using from Spotlight

1. Press `Cmd + Space`
2. Type "Task" (or your app name)
3. Press Enter
4. Follow the dialogs:
   - Click "Scan Notes" to start
   - Review found tasks
   - Click "Process Tasks" to confirm
5. Get success notification with sound!

### Dialog Flow

When using the Automator app, you'll see:

1. **Intro Dialog**: Explains what will happen
2. **Confirmation Dialog**: Shows task counts by note
3. **Success Dialog**: Confirms completion
4. **Notification Center**: Alert with sound

### Customizing the App Icon

Want a cool 🤖 icon for Spotlight?

1. Find a high-res robot emoji image
2. Right-click your Automator app → Get Info
3. Drag the image onto the icon in the top-left
4. Now it shows in Spotlight with your custom icon!

### How It Works

The automation flow:

1. **AppleScript** shows the intro dialog
2. **Shell script** runs `--dry-run` to analyze notes
3. **Dialog** shows what was found
4. **User confirms** → runs with `--yes` flag
5. **Success** notification with task count

## 📋 Notion Setup Requirements

### Tasks Database

Your Notion tasks database needs these properties:

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

## 📝 Usage Guide

### Setting Up Apple Notes

Create two notes in Apple Notes:

- One titled `#Work` (case-insensitive)
- One titled `#Personal` (case-insensitive)

### Writing Tasks

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
Workout at gym
Buy groceries
* Call mom
- Schedule dentist

// Weekend plans
Go hiking
// Remember to bring water
```

### Task Categories

The AI automatically categorizes personal tasks:

- **🏃‍♂️ Physical Health**: Exercise, sports, fitness
- **🌱 Personal**: Reading, learning, hobbies
- **🍻 Interpersonal**: Social activities, friends, family
- **❤️ Mental Health**: Meditation, therapy, self-care
- **🏠 Home**: Cleaning, organizing, household

Work tasks are always categorized as "💼 Work".

## 💡 Tips & Tricks

### Comments

Use `//` for notes that won't become tasks:

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
Call John about proposal
* Pick up dry cleaning
- Buy birthday gift
Schedule team lunch
```

All formats work equally well!

### Context File

Create `context.md` for better AI categorization:

```markdown
# Context for AI Task Classification

## People

- Sarah: My sister
- John: Project manager

## Places

- Gym class: Spin class at FitLife
```

## 🎯 Sample Workflows

### Morning Routine

1. Add tasks to Apple Notes throughout the day
2. Cmd+Space → "Task" → Enter
3. Review what will be processed
4. Confirm → Done in seconds!

### Quick Capture

1. Open Apple Notes
2. Add to #Work or #Personal
3. Run Task Processor when ready
4. Notes are cleaned, tasks organized

### Batch Processing

1. Accumulate tasks over days
2. Process them all at once
3. Start fresh with clean notes

## 🛡️ Security Best Practices

- **API keys**: Always in `.env` (never commit!)
- **Context file**: Personal info in `context.md` (gitignored)
- **Database IDs**: Environment variables only

## 🐛 Troubleshooting

### Automator Issues

**"command not found: node"**: Update the PATH in shell script:

```bash
which node  # Find your node path
# Update the export PATH line
```

**No tasks found**: Ensure notes are titled exactly `#Work` or `#Personal`

**Dialog not showing**: Make sure to save Automator app after changes

### Terminal Issues

**Tasks not categorizing well**: Add context to `context.md`

**Debug mode**: Set `DEBUG=true` in `.env` for verbose output

### Common Fixes

- Notes must be in the default Notes account
- Task types must match your Notion database exactly
- Comments must start with `//` at line beginning

## 💰 Cost Estimation

- **Per task**: ~$0.0001 (using Claude Haiku)
- **100 tasks**: ~$0.01
- **Daily use (10 tasks)**: ~$0.03/month

Incredibly affordable for the convenience!

## 🔄 Command-Line Flags

- `--dry-run`: Analyze without processing
- `--yes`: Skip confirmation prompt
- `DEBUG=true`: Verbose output for troubleshooting

## 🎉 Advanced Features

### Debugging

```bash
DEBUG=true node process-notes.js
```

Shows:

- Full note content
- Line-by-line processing
- AI classification details

### Automation Ideas

- Schedule with cron for daily processing
- Integrate with other automation tools
- Add keyboard shortcuts with Shortcuts app

---

**Built with**: Notion API, Claude AI, Node.js, AppleScript, macOS Automator
**Time saved**: Turn chaotic notes into organized tasks in seconds! 🚀
