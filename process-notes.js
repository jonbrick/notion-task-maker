const { Client } = require("@notionhq/client");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { execSync } = require("child_process");
require("dotenv").config();

// Add a DEBUG flag at the top of the file
const DEBUG = process.env.DEBUG === "true" || false;

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
    console.log("🔍 Looking for notes titled #Work or #Personal\n");

    // Find both #Work and #Personal notes
    const allNotes = await findTaskNotes();

    if (allNotes.length === 0) {
      console.log(
        "❌ No notes found with #Work or #Personal. Nothing to process!"
      );
      return;
    }

    console.log(`📝 Found ${allNotes.length} note(s) to process`);

    let totalTasksProcessed = 0;

    // Process each note
    for (const note of allNotes) {
      const noteType = note.name.toLowerCase().includes("work")
        ? "work"
        : "personal";
      console.log(
        `\n📋 Processing ${
          noteType === "work" ? "💼 Work" : "🌱 Personal"
        } note: "${note.name}"`
      );

      // Get the full note content
      const noteContent = await getNoteContent(note.id);

      // Extract all non-empty lines as tasks
      const tasks = extractTasks(noteContent, note.name);

      if (tasks.length === 0) {
        console.log("   No tasks found in this note");
        continue;
      }

      console.log(`   Found ${tasks.length} task(s)`);

      // Process tasks based on type
      for (const task of tasks) {
        if (noteType === "work") {
          task.category = "💼 Work";
          console.log(`   💼 "${task.text}" → Work`);
        } else {
          // Use AI to classify personal tasks
          task.category = await classifyPersonalTask(task.text);
          console.log(`   🤖 "${task.text}" → ${task.category}`);
        }
      }

      // Create Notion entries
      console.log(`\n📤 Creating ${tasks.length} Notion task(s)...`);
      await createNotionTasks(tasks);

      totalTasksProcessed += tasks.length;

      // Clean up the note by removing processed tasks
      console.log(`\n🧹 Cleaning up note...`);
      await cleanupNote(note.id, note.name, tasks, noteContent);
    }

    console.log(`\n🎉 Successfully processed ${totalTasksProcessed} task(s)!`);
  } catch (error) {
    console.error("❌ Error in Apple Notes processing:", error);
  }
}

async function findTaskNotes() {
  console.log("🔍 Scanning Apple Notes...");

  // Use JSON format for cleaner parsing
  const script = `
    set taskNotes to {}
    
    tell application "Notes"
      repeat with theNote in notes
        set noteName to name of theNote as string
        set lowerName to do shell script "echo " & quoted form of noteName & " | tr '[:upper:]' '[:lower:]'"
        
        if lowerName is "#work" or lowerName is "#personal" then
          set noteId to id of theNote as string
          -- Use JSON format for clean parsing
          set noteJSON to "{\\"id\\": \\"" & noteId & "\\", \\"name\\": \\"" & noteName & "\\"}"
          copy noteJSON to end of taskNotes
        end if
      end repeat
    end tell
    
    -- Return as JSON array
    return "[" & my joinList(taskNotes, ", ") & "]"
    
    on joinList(theList, theDelimiter)
      set AppleScript's text item delimiters to theDelimiter
      set theResult to theList as string
      set AppleScript's text item delimiters to ""
      return theResult
    end joinList
  `;

  try {
    const result = execSync(
      `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10,
      }
    ).trim();

    if (DEBUG) {
      console.log("\n🐛 Debug - AppleScript result:");
      console.log(result);
      console.log("");
    }

    // Parse JSON result
    const notes = JSON.parse(result);

    console.log(`✅ Found ${notes.length} task note(s):`);
    notes.forEach((note) => console.log(`   - ${note.name}`));

    return notes;
  } catch (error) {
    console.error(`❌ Error finding notes:`, error.message);
    if (DEBUG) {
      console.error("🐛 Debug - Full error:", error);
    }
    return [];
  }
}

async function getNoteContent(noteId) {
  const script = `
    tell application "Notes"
      set theNote to note id "${noteId}"
      return plaintext of theNote as string
    end tell
  `;

  try {
    const content = execSync(
      `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10,
      }
    );
    return content;
  } catch (error) {
    console.error(`❌ Error getting note content: ${error.message}`);
    return "";
  }
}

function extractTasks(noteContent, noteTitle) {
  if (DEBUG) {
    console.log("\n   📄 Note content:");
    console.log("   ---START---");
    console.log(noteContent);
    console.log("   ---END---\n");
  }

  // Split by newlines and process each line
  const lines = noteContent.split("\n");
  const tasks = [];

  console.log(`   📝 Processing ${lines.length} lines...`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Only skip if line is truly empty (no text at all)
    if (line.trim().length === 0) {
      if (DEBUG) console.log(`   Line ${i}: [empty line]`);
      continue;
    }

    // Skip if it's just the note title
    if (line.trim().toLowerCase() === noteTitle.toLowerCase()) {
      if (DEBUG) console.log(`   Line ${i}: "${line}" → Skipped (note title)`);
      continue;
    }

    // Skip comment lines (starting with //)
    if (line.trim().startsWith("//")) {
      if (DEBUG) console.log(`   Line ${i}: "${line}" → Skipped (comment)`);
      continue;
    }

    // Skip the special Apple Notes character
    if (line.trim() === "￼" || line.charCodeAt(0) === 65532) {
      if (DEBUG) console.log(`   Line ${i}: [special character] → Skipped`);
      continue;
    }

    // Everything else is a task!
    tasks.push({ text: line.trim() });
    if (DEBUG) {
      console.log(`   Line ${i}: "${line}" → Added as task`);
    } else if (i < 5) {
      // Show first few tasks in normal mode
      console.log(`   ✓ "${line.trim()}"`);
    }
  }

  console.log(`\n   📊 Total tasks found: ${tasks.length}`);
  return tasks;
}

async function classifyPersonalTask(taskText) {
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
- 🏃‍♂️ Physical Health (exercise, workout, gym, running, sports, fitness)
- 🌱 Personal (reading, learning, hobbies, personal projects)
- 🍻 Interpersonal (social, friends, family, relationships)
- ❤️ Mental Health (meditation, therapy, self-care, relaxation)
- 🏠 Home (cleaning, laundry, organizing, household tasks)

TASK: "${taskText}"

Respond with ONLY the exact category text including the emoji. For example: "🏃‍♂️ Physical Health" not just "🏃‍♂️"`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 30,
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

async function cleanupNote(noteId, noteName, processedTasks, originalContent) {
  // Create a set of processed task texts for easy lookup
  const processedTexts = new Set(processedTasks.map((task) => task.text));

  // Determine the note type from the note NAME (not content!)
  const noteType = noteName.toLowerCase().includes("work")
    ? "#Work"
    : "#Personal";

  // Split content into lines and filter
  const lines = originalContent.split("\n");
  const cleanedLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip the special Apple Notes character
    if (trimmedLine === "￼" || line.charCodeAt(0) === 65532) {
      continue;
    }

    // Skip processed tasks and the original title (we'll add it back)
    if (
      processedTexts.has(trimmedLine) ||
      trimmedLine.toLowerCase() === "#work" ||
      trimmedLine.toLowerCase() === "#personal"
    ) {
      continue;
    }

    // Keep everything else (comments, empty lines, etc.)
    cleanedLines.push(line);
  }

  // Build HTML: Start with H1 title, then add all the cleaned lines
  let htmlContent = `<h1>${noteType}</h1>`;

  // Add each line as a div (or br for empty lines)
  for (const line of cleanedLines) {
    if (line.trim() === "") {
      htmlContent += "<br>";
    } else {
      htmlContent += `<div>${line}</div>`;
    }
  }

  // Update the note BODY with title + remaining content
  const script = `
    tell application "Notes"
      set theNote to note id "${noteId}"
      set body of theNote to "${htmlContent.replace(/"/g, '\\"')}"
      return "Cleaned"
    end tell
  `;

  try {
    await execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
      encoding: "utf8",
    });
    console.log(
      `   ✅ Removed ${processedTasks.length} processed task(s) from note`
    );
  } catch (error) {
    console.error(`   ❌ Error cleaning note: ${error.message}`);
    if (DEBUG) {
      console.error("Script that failed:", script);
    }
  }
}

// Run the script
processAppleNotesToNotion();
