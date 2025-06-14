const { Client } = require("@notionhq/client");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { execSync } = require("child_process");
require("dotenv").config();

// Configuration - using environment variables
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize clients
const notion = new Client({ auth: NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Database ID - using environment variable
const TASKS_DATABASE_ID = process.env.TASKS_DATABASE_ID;

// Load context file (optional - will work without it)
let CONTEXT = "";
try {
  CONTEXT = fs.readFileSync("./context.md", "utf8");
  console.log("📖 Loaded context file");
} catch (error) {
  console.log(
    "📝 No context file found - create context.md to add classification context"
  );
}

// Task categories configuration
const TASK_CATEGORIES = [
  "🏃‍♂️ Physical Health",
  "💼 Work",
  "🌱 Personal",
  "🍻 Interpersonal",
  "❤️ Mental Health",
  "🏠 Home",
];

async function processAppleNotesToNotion() {
  try {
    console.log("🚀 Starting Apple Notes to Notion task automation...");
    console.log(
      "🔍 Looking for notes with #Tasks in title (case-insensitive)\n"
    );

    // Step 1: Find notes with #Tasks in title
    const notesWithTasks = await findTaskNotes();

    if (notesWithTasks.length === 0) {
      console.log("✅ No notes found with #Tasks. Nothing to process!");
      return;
    }

    console.log(`📝 Found ${notesWithTasks.length} note(s) with #Tasks`);

    // Step 2: Process each note
    let totalTasksProcessed = 0;

    for (const noteInfo of notesWithTasks) {
      console.log(`\n📋 Processing note: "${noteInfo.name}"`);

      // Get the full note content
      const noteContent = await getNoteContent(noteInfo.id);

      // Debug: Show the raw content
      console.log("\n📄 Note content:");
      console.log("---START---");
      console.log(noteContent);
      console.log("---END---\n");

      // Extract tasks by hashtag
      const tasks = extractTasksByHashtag(noteContent);

      if (tasks.length === 0) {
        console.log("   No tasks found in this note");
        continue;
      }

      console.log(`   Found ${tasks.length} task(s)`);

      // Step 3: Classify tasks
      for (const task of tasks) {
        if (task.hashtag.toLowerCase() === "#work") {
          task.category = "💼 Work";
          console.log(`   💼 "${task.text}" → Work (auto-assigned)`);
        } else if (task.hashtag.toLowerCase() === "#personal") {
          task.category = await classifyTask(task.text);
          console.log(`   🤖 "${task.text}" → ${task.category}`);
        }
      }

      // Step 4: Create Notion entries
      console.log(`\n📤 Creating ${tasks.length} Notion task(s)...`);
      await createNotionTasks(tasks);

      totalTasksProcessed += tasks.length;

      // Step 5: Remove #Tasks from note title
      console.log(`\n🧹 Removing #Tasks from note title...`);
      await removeTasksHashtag(noteInfo.id);
    }

    console.log(`\n🎉 Successfully processed ${totalTasksProcessed} task(s)!`);
  } catch (error) {
    console.error("❌ Error in Apple Notes processing:", error);
  }
}

async function findTaskNotes() {
  console.log("🔍 Scanning Apple Notes for #Tasks titles...");

  // AppleScript to find notes with #Tasks (case-insensitive)
  const script = `
    set noteList to {}
    tell application "Notes"
      repeat with theNote in notes
        set noteName to name of theNote as string
        -- Case-insensitive check for #Tasks
        if noteName contains "#tasks" or noteName contains "#Tasks" or noteName contains "#TASKS" then
          set noteId to id of theNote as string
          set end of noteList to noteId & "|||" & noteName
        end if
      end repeat
    end tell
    return noteList as string
  `;

  try {
    const result = execSync(
      `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      }
    ).trim();

    if (!result) return [];

    // Parse the results
    const notes = result.split(", ").map((entry) => {
      const [id, name] = entry.split("|||");
      return { id, name };
    });

    console.log(`✅ Found ${notes.length} note(s) with #Tasks`);
    return notes;
  } catch (error) {
    console.error("❌ Error finding notes:", error.message);
    return [];
  }
}

async function getNoteContent(noteId) {
  const script = `
    tell application "Notes"
      set theNote to note id "${noteId}"
      return body of theNote as string
    end tell
  `;

  try {
    const content = execSync(
      `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      }
    );
    return content;
  } catch (error) {
    console.error(`❌ Error getting note content: ${error.message}`);
    return "";
  }
}

function extractTasksByHashtag(noteContent) {
  const lines = noteContent.split("\n");
  const tasks = [];
  let currentHashtag = null;

  // Regex patterns
  const hashtagRegex = /^#(work|personal)$/i;
  const bulletRegex = /^\s*[•\-\*]|\d+\.\s/;

  console.log(`   📝 Parsing ${lines.length} lines...`);

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line is a hashtag (case-insensitive)
    const hashtagMatch = trimmedLine.match(hashtagRegex);
    if (hashtagMatch) {
      currentHashtag = `#${hashtagMatch[1]}`;
      console.log(`   #️⃣ Found hashtag: ${currentHashtag}`);
      continue;
    }

    // Check if this line is a bullet point
    if (bulletRegex.test(trimmedLine) && currentHashtag) {
      // Remove bullet point marker and clean up text
      const cleanText = trimmedLine
        .replace(/^\s*[•\-\*]/, "") // Remove •, -, * bullets
        .replace(/^\s*\d+\.\s/, "") // Remove numbered bullets
        .trim();

      // Only add non-empty tasks
      if (cleanText.length > 0) {
        tasks.push({
          text: cleanText,
          hashtag: currentHashtag,
        });
        console.log(`   ✓ Found task: "${cleanText}" under ${currentHashtag}`);
      } else {
        console.log(`   ○ Skipped empty bullet under ${currentHashtag}`);
      }
    }
  }

  return tasks;
}

async function classifyTask(taskText) {
  // Build prompt with optional context
  let prompt = "";

  if (CONTEXT) {
    prompt += `CONTEXT FOR BETTER CLASSIFICATION:
${CONTEXT}

---

`;
  }

  prompt += `Classify this personal task into exactly ONE of these categories:

CATEGORIES:
- 🏃‍♂️ Physical Health
- 🌱 Personal
- 🍻 Interpersonal  
- ❤️ Mental Health
- 🏠 Home

TASK: "${taskText}"

Return ONLY the category with emoji, nothing else.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 20,
      messages: [{ role: "user", content: prompt }],
    });

    const classification = message.content[0].text.trim();

    // Validate classification
    const validCategories = TASK_CATEGORIES.filter((cat) => cat !== "💼 Work");
    if (validCategories.includes(classification)) {
      return classification;
    } else {
      console.log(
        `   ⚠️  Unclear classification "${classification}", defaulting to Personal`
      );
      return "🌱 Personal";
    }
  } catch (error) {
    console.error(`   ❌ Classification error: ${error.message}`);
    return "🌱 Personal";
  }
}

async function createNotionTasks(tasks) {
  const today = new Date().toISOString().split("T")[0];

  for (const task of tasks) {
    try {
      await notion.pages.create({
        parent: { database_id: TASKS_DATABASE_ID },
        properties: {
          Task: {
            title: [
              {
                text: {
                  content: task.text,
                },
              },
            ],
          },
          "Due Date": {
            date: {
              start: today,
            },
          },
          Type: {
            select: {
              name: task.category,
            },
          },
          Status: {
            status: {
              name: "🔴 To Do",
            },
          },
        },
      });

      console.log(`   ✅ Created: "${task.text}"`);
    } catch (error) {
      console.error(
        `   ❌ Failed to create task "${task.text}":`,
        error.message
      );
    }
  }
}

async function removeTasksHashtag(noteId) {
  const script = `
    tell application "Notes"
      set theNote to note id "${noteId}"
      set oldName to name of theNote as string
      set newName to oldName
      
      -- Remove all case variations of #Tasks
      set searchTerms to {"#Tasks", "#tasks", "#TASKS"}
      repeat with searchTerm in searchTerms
        if oldName contains searchTerm then
          set AppleScript's text item delimiters to searchTerm
          set textItems to text items of newName
          set AppleScript's text item delimiters to ""
          set newName to textItems as string
        end if
      end repeat
      
      -- Trim any extra spaces
      set newName to newName as string
      repeat while newName starts with " "
        set newName to text 2 thru -1 of newName
      end repeat
      repeat while newName ends with " "
        set newName to text 1 thru -2 of newName
      end repeat
      
      set name of theNote to newName
      return "Updated: " & oldName & " -> " & newName
    end tell
  `;

  try {
    const result = execSync(
      `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      {
        encoding: "utf8",
      }
    ).trim();
    console.log(`   ✅ ${result}`);
  } catch (error) {
    console.error(`   ❌ Error removing hashtag: ${error.message}`);
  }
}

// Run the script
processAppleNotesToNotion();
