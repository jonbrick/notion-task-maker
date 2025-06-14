const { Client } = require("@notionhq/client");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const applescript = require("applescript");
require("dotenv").config();

// Configuration - using environment variables
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize clients
const notion = new Client({ auth: NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Database ID - using environment variable
const TASKS_DATABASE_ID = process.env.TASKS_DATABASE_ID;

// ⭐ CONFIGURE THIS: Note title to look for and hashtags within those notes
const NOTE_TITLE_HASHTAG = "#Tasks";
const CONTENT_HASHTAGS = ["#work", "#personal"];

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

// Task categories configuration (only for #tasks - #work is automatic)
const TASK_CATEGORIES = [
  "🏃‍♂️ Physical Health",
  "🌱 Personal",
  "🍻 Interpersonal",
  "❤️ Mental Health",
  "🏠 Home",
];

async function processAppleNotesToNotion() {
  try {
    console.log("🚀 Starting Apple Notes to Notion task automation...");
    console.log(`🔍 Looking for notes titled with: ${NOTE_TITLE_HASHTAG}`);
    console.log(`📋 Content hashtags: ${CONTENT_HASHTAGS.join(", ")}\n`);

    // Step 1: Find notes with target hashtags
    const notesWithTasks = await findNotesWithHashtags();

    if (notesWithTasks.length === 0) {
      console.log(
        "✅ No notes found with target hashtags. Nothing to process!"
      );
      return;
    }

    console.log(`📝 Found ${notesWithTasks.length} note(s) with tasks`);

    // Step 2: Extract bullet points from all notes
    const allTasks = [];

    for (const note of notesWithTasks) {
      console.log(`\n📋 Processing note: "${note.name}"`);
      const tasks = extractBulletPointsByHashtag(note.body);

      if (tasks.length > 0) {
        console.log(`   Found ${tasks.length} task(s)`);
        allTasks.push(...tasks);
      } else {
        console.log(`   No bullet points found`);
      }
    }

    if (allTasks.length === 0) {
      console.log("\n✅ No tasks extracted from notes. Nothing to upload!");
      return;
    }

    console.log(`\n🎯 Total tasks to process: ${allTasks.length}`);

    // Step 3: Classify tasks that need AI classification
    for (const task of allTasks) {
      if (task.hashtag === "#work") {
        task.category = "💼 Work";
        console.log(`💼 "${task.text}" → Work (auto-assigned)`);
      } else if (task.hashtag === "#personal") {
        // Use AI to classify #personal items
        task.category = await classifyTask(task.text);
        console.log(`🤖 "${task.text}" → ${task.category}`);
      }
    }

    // Step 4: Create Notion entries
    console.log(`\n📤 Creating ${allTasks.length} Notion task(s)...`);
    await createNotionTasks(allTasks);

    console.log(`\n🎉 Successfully processed ${allTasks.length} task(s)!`);
    console.log("📝 Note: Notes were left unchanged (v1 behavior)");
  } catch (error) {
    console.error("❌ Error in Apple Notes processing:", error);
  }
}

async function findNotesWithHashtags() {
  console.log("🔍 Scanning Apple Notes for #Tasks titles...");

  const script = `
    tell application "Notes"
      set noteList to {}
      set noteCount to 0
      repeat with theAccount in accounts
        repeat with theFolder in folders of theAccount
          repeat with theNote in notes of theFolder
            set noteName to name of theNote
            
            if noteName contains "${NOTE_TITLE_HASHTAG}" then
              set noteBody to body of theNote
              set noteCount to noteCount + 1
              set end of noteList to {name:noteName, body:noteBody}
              
              -- Safety limit to prevent memory issues
              if noteCount > 10 then
                return noteList
              end if
            end if
          end repeat
        end repeat
      end repeat
      return noteList
    end tell
  `;

  return new Promise((resolve, reject) => {
    applescript.execString(script, (err, result) => {
      if (err) {
        console.error("❌ AppleScript error:", err);
        reject(err);
      } else {
        // Convert AppleScript result to JavaScript array
        const notes = Array.isArray(result) ? result : [];
        console.log(
          `✅ Found ${notes.length} note(s) with ${NOTE_TITLE_HASHTAG} in title`
        );
        resolve(notes);
      }
    });
  });
}

function extractBulletPointsByHashtag(noteBody) {
  const lines = noteBody.split("\n");
  const bulletPoints = [];
  let currentHashtag = null;

  // Look for lines that start with bullet point markers
  const bulletRegex = /^\s*[•\-\*]|\d+\.\s/;
  const hashtagRegex = /^#(work|personal)$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line is a hashtag
    if (hashtagRegex.test(trimmedLine)) {
      currentHashtag = trimmedLine.toLowerCase();
      continue;
    }

    // Check if this line is a bullet point
    if (bulletRegex.test(trimmedLine) && currentHashtag) {
      // Remove bullet point marker and clean up text
      const cleanText = trimmedLine
        .replace(/^\s*[•\-\*]/, "") // Remove •, -, * bullets
        .replace(/^\s*\d+\.\s/, "") // Remove numbered bullets
        .trim();

      // Only add non-empty bullet points
      if (cleanText.length > 0) {
        bulletPoints.push({
          text: cleanText,
          hashtag: currentHashtag,
        });
      }
    }
  }

  return bulletPoints;
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

  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 20,
    messages: [{ role: "user", content: prompt }],
  });

  const classification = message.content[0].text.trim();

  // Validate classification is one of our expected categories
  if (TASK_CATEGORIES.includes(classification)) {
    return classification;
  } else {
    // Fallback to Personal if classification is unclear
    console.log(
      `⚠️  Unclear classification "${classification}", defaulting to Personal`
    );
    return "🌱 Personal";
  }
}

async function createNotionTasks(tasks) {
  const today = new Date().toISOString().split("T")[0]; // Today's date in YYYY-MM-DD format

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

      console.log(`✅ Created: "${task.text}"`);
    } catch (error) {
      console.error(`❌ Failed to create task "${task.text}":`, error.message);
      throw error; // Re-throw to stop processing on any failure
    }
  }
}

// Run the script
processAppleNotesToNotion();
