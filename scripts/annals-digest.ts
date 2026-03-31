import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { Database } from 'bun:sqlite';

// ============================================================================
// Constants
// ============================================================================

const FUSION_DB_PATH = '/Users/jerin/apps/fusion/fusion.db';
const ANNALS_DIR = join(homedir(), '.openclaw', 'workspace', 'memory', 'annals');

// ============================================================================
// Types
// ============================================================================

interface FusionItem {
  id: number;
  title: string;
  link: string;
  pub_date: number;
  feed_name: string;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const dbPath = process.env.FUSION_DB_PATH || FUSION_DB_PATH;
  
  console.log(`[annals] Connecting to fusion database: ${dbPath}`);
  
  if (!existsSync(dbPath)) {
    console.error(`[annals] Error: fusion database not found at ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  try {
    // Step 1: Get "国内外大事" group id
    const groupRow = db.query(`
      SELECT id, name FROM groups WHERE name = '国内外大事'
    `).get() as { id: number; name: string } | undefined;

    if (!groupRow) {
      console.error(`[annals] Error: group "国内外大事" not found in fusion database`);
      process.exit(1);
    }

    const groupId = groupRow.id;
    console.log(`[annals] Step 1: Found group "国内外大事" with id=${groupId}`);

    // Step 2: Get all feed IDs in this group
    const feedRows = db.query(`
      SELECT id, name, link FROM feeds WHERE group_id = ?
    `).all(groupId) as Array<{ id: number; name: string; link: string }>;

    if (feedRows.length === 0) {
      console.error(`[annals] Error: no feeds found in group "国内外大事"`);
      process.exit(1);
    }

    const feedIds = feedRows.map(f => f.id);
    console.log(`[annals] Step 2: Found ${feedRows.length} feeds in group:`);
    feedRows.forEach(f => console.log(`[annals]   - ${f.name} (${f.link})`));

    // Step 3: Get items from these feeds (all items, no time filter)
    const placeholders = feedIds.map(() => '?').join(',');
    const items = db.query(`
      SELECT
        i.id,
        i.title,
        i.link,
        i.pub_date,
        f.name as feed_name
      FROM items i
      JOIN feeds f ON i.feed_id = f.id
      WHERE i.feed_id IN (${placeholders})
      ORDER BY i.pub_date DESC
    `).all(...feedIds) as FusionItem[];

    console.log(`[annals] Step 3: Found ${items.length} items from ${feedRows.length} feeds`);

    if (items.length === 0) {
      console.log(`[annals] No items found. Nothing to update.`);
      return;
    }

    // Step 4 & 5: Group by year-month and write to yyyy-MM.md files
    const monthFiles = new Map<string, FusionItem[]>();

    for (const item of items) {
      const date = new Date(item.pub_date * 1000);
      // Skip invalid dates
      if (isNaN(date.getTime())) {
        console.warn(`[annals] Skipping item with invalid date: ${item.title} (pub_date: ${item.pub_date})`);
        continue;
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;
      
      const existing = monthFiles.get(yearMonth) || [];
      existing.push(item);
      monthFiles.set(yearMonth, existing);
    }

    console.log(`[annals] Step 4 & 5: Writing items to ${monthFiles.size} monthly files`);

    // Ensure annals directory exists
    await mkdir(ANNALS_DIR, { recursive: true });

    const updatedFiles: string[] = [];

    for (const [yearMonth, monthItems] of monthFiles.entries()) {
      const filePath = join(ANNALS_DIR, `${yearMonth}.md`);
      
      // Read existing content if file exists
      let existingContent = '';
      if (existsSync(filePath)) {
        existingContent = await Bun.file(filePath).text();
      }

      // Build new content
      let newContent = existingContent;

      // Add header if file is new/empty
      if (!existingContent.includes('# 当代史记')) {
        newContent = `# 当代史记 · ${yearMonth}\n\n`;
        newContent += `**体例**：只记事实（时间/地点/人物/事件），不记原因/动机/评价。\n\n`;
        newContent += `---\n\n`;
      }

      // Track existing entries by title to avoid duplicates
      const existingTitles = new Set<string>();
      const lines = existingContent.split('\n');
      for (const line of lines) {
        const match = line.match(/^## (\d{4}-\d{2}-\d{2})/);
        if (match) {
          // This is a date header, track the entries below it
          continue;
        }
        const entryMatch = line.match(/^- (.+?)(?:\s*→|$)/);
        if (entryMatch && existingContent.includes(entryMatch[1])) {
          existingTitles.add(entryMatch[1]);
        }
      }

      // Sort items by date (newest first)
      monthItems.sort((a, b) => b.pub_date - a.pub_date);

      // Group by date
      const itemsByDate = new Map<string, FusionItem[]>();
      for (const item of monthItems) {
        const date = new Date(item.pub_date * 1000);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const existing = itemsByDate.get(dateStr) || [];
        existing.push(item);
        itemsByDate.set(dateStr, existing);
      }

      // Add entries by date
      for (const [dateStr, dateItems] of itemsByDate.entries()) {
        // Check if this date section already exists
        const dateSectionExists = existingContent.includes(`## ${dateStr}`);
        
        if (!dateSectionExists) {
          newContent += `## ${dateStr}\n\n`;
          
          for (const item of dateItems) {
            const title = item.title || 'Untitled';
            const source = item.feed_name || 'unknown';
            const link = item.link || '';
            const sourceLine = link ? ` → [${source}](${link})` : ` → ${source}`;
            newContent += `- ${title}${sourceLine}\n`;
          }
          
          newContent += '\n';
        }
      }

      // Write to file
      await writeFile(filePath, newContent);
      updatedFiles.push(filePath);
      console.log(`[annals]   Updated ${filePath} (${monthItems.length} entries)`);
    }

    console.log(`[annals] ✅ Done! Updated ${updatedFiles.length} files:`);
    for (const f of updatedFiles) {
      console.log(`[annals]   - ${f}`);
    }

  } finally {
    db.close();
  }
}

await main().catch((err) => {
  console.error(`[annals] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
