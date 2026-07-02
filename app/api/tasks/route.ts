import { NextRequest, NextResponse } from 'next/server';
import { parseAllTasks } from '@/lib/parsers/sprint-markdown';
import { getConfig } from '@/lib/db/queries';
import { getDb } from '@/lib/db/schema';
import { resolveHomePath } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    let tasks: any[] = [];

    if (config.projectRepoPath) {
      const repoPath = resolveHomePath(config.projectRepoPath);
      tasks = parseAllTasks(repoPath);
    }

    // Merge with SQLite overrides (actual table is task_overrides)
    const db = getDb();
    let overrides: any[] = [];
    try {
      overrides = db.prepare('SELECT * FROM task_overrides').all() as any[];
    } catch {
      // Table may not exist yet
    }
    const overrideMap = new Map(overrides.map((o: any) => [o.id, o]));

    for (const task of tasks) {
      const override = overrideMap.get(task.id);
      if (override) {
        if (override.status) task.status = override.status;
        if (override.priority) task.priority = override.priority;
        if (override.sprint_id) task.sprintId = override.sprint_id;
        if (override.design_status) task.designStatus = override.design_status;
        if (override.manual_notes) task.notes = override.manual_notes;
      }
    }

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), tasks: [] }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const db = getDb();
    let existing: any = null;
    try {
      existing = db.prepare('SELECT * FROM task_overrides WHERE id = ?').get(id);
    } catch {
      // Table may not exist
    }

    if (existing) {
      const fields: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        status: 'status', priority: 'priority', sprintId: 'sprint_id',
        designStatus: 'design_status', notes: 'manual_notes', title: 'title',
        description: 'description', type: 'type',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in updates) {
          fields.push(`${col} = ?`);
          values.push(updates[key]);

          // Log change to task_history
          try {
            db.prepare(`
              INSERT INTO task_history (task_id, change_json)
              VALUES (?, ?)
            `).run(id, JSON.stringify({ field: key, old: (existing as any)[col], new: updates[key] }));
          } catch {
            // task_history may not exist
          }
        }
      }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        db.prepare(`UPDATE task_overrides SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
    } else {
      // Create new override
      try {
        db.prepare(`
          INSERT INTO task_overrides (id, title, description, status, priority, type, tags_json, sprint_id, design_status, manual_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          updates.title || '',
          updates.description || '',
          updates.status || 'todo',
          updates.priority || 'medium',
          updates.type || 'feature',
          JSON.stringify(updates.tags || []),
          updates.sprintId || null,
          updates.designStatus || null,
          updates.notes || null,
        );
      } catch {
        // Table may not exist
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
