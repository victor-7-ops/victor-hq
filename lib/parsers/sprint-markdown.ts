/**
 * Sprint & Task Markdown Parser
 * ==============================
 * Parses sprint files and backlog from the project repo.
 *
 * Expected file locations (under ops/):
 * - ops/sprints/SPRINT_001.md — Sprint definitions with YAML frontmatter
 * - ops/sprints/SPRINT_002.md — Active sprint
 * - ops/board/backlog.md      — Full backlog with YAML ticket entries
 * - ops/board/done/           — Completed ticket files
 * - ops/logs/sprint.log       — Daily sprint progress log
 *
 * Ticket YAML format:
 * - id: T-010
 *   title: Add sprint tagging...
 *   owner: orchestrator
 *   phase: Execution
 *   sprint: SPRINT_001
 *   status: done
 *   gates: fixtures
 *   notes: ...
 */

import fs from 'fs';
import path from 'path';
import type { Sprint, DevTask, SprintStatus, DevTaskStatus, Priority, TaskType } from '@/types';

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// --- Sprint Parser ---

export function parseSprintFile(filePath: string): Sprint | null {
  const content = readFileIfExists(filePath);
  if (!content) return null;

  const frontmatter = extractFrontmatter(content);
  const fileName = path.basename(filePath, '.md');
  const sprintNumberMatch = fileName.match(/(\d+)/);
  const sprintNumber = sprintNumberMatch ? parseInt(sprintNumberMatch[1], 10) : 0;

  // Parse sprint metadata from frontmatter or content
  let goal = '';
  let startDate = '';
  let endDate = '';
  let status: SprintStatus = 'upcoming';
  let owner = '';
  let name = fileName.replace(/_/g, ' ');

  if (frontmatter) {
    goal = frontmatter.goal || '';
    startDate = frontmatter.start || frontmatter.startDate || '';
    endDate = frontmatter.end || frontmatter.endDate || '';
    status = mapSprintStatus(frontmatter.status || '');
    owner = frontmatter.owner || frontmatter.owners || '';
    name = frontmatter.name || name;
  }

  // Also parse from content body if frontmatter is missing data
  if (!goal) {
    const goalMatch = content.match(/(?:goal|Goal|GOAL)[:\s]+(.+)/);
    if (goalMatch) goal = goalMatch[1].trim().replace(/^["']|["']$/g, '');
  }
  if (!startDate) {
    const dateMatch = content.match(/(\d{4}-\d{2}-\d{2})\s*(?:→|->|to)\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      startDate = dateMatch[1];
      endDate = dateMatch[2];
    }
  }
  if (!status || status === 'upcoming') {
    if (content.toLowerCase().includes('complete') || content.toLowerCase().includes('closed')) {
      status = 'completed';
    } else if (content.toLowerCase().includes('in progress') || content.toLowerCase().includes('active')) {
      status = 'active';
    }
  }
  if (!owner) {
    const ownerMatch = content.match(/(?:owner|Owner)[:\s]+(.+)/);
    if (ownerMatch) owner = ownerMatch[1].trim();
  }

  // Parse tickets from content
  const tickets = parseTicketsFromContent(content);

  return {
    id: `sprint-${sprintNumber}`,
    number: sprintNumber,
    name,
    goal,
    startDate,
    endDate,
    status,
    tasks: tickets,
    owner,
  };
}

// --- Backlog Parser ---

export function parseBacklogFile(filePath: string): DevTask[] {
  const content = readFileIfExists(filePath);
  if (!content) return [];

  return parseTicketsFromYamlList(content);
}

// --- Parse all sprints from a directory ---

export function parseAllSprints(repoPath: string): Sprint[] {
  const sprintsDir = path.join(repoPath, 'ops', 'sprints');
  const sprints: Sprint[] = [];

  try {
    const files = fs.readdirSync(sprintsDir)
      .filter(f => f.match(/sprint/i) && f.endsWith('.md') && !f.startsWith('_'));

    for (const file of files) {
      const sprint = parseSprintFile(path.join(sprintsDir, file));
      if (sprint) sprints.push(sprint);
    }
  } catch {
    // Directory not found
  }

  return sprints.sort((a, b) => a.number - b.number);
}

export function parseAllTasks(repoPath: string): DevTask[] {
  const tasks: DevTask[] = [];

  // Parse backlog
  const backlogPath = path.join(repoPath, 'ops', 'board', 'backlog.md');
  tasks.push(...parseBacklogFile(backlogPath));

  // Parse done tickets
  const doneDir = path.join(repoPath, 'ops', 'board', 'done');
  try {
    const files = fs.readdirSync(doneDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileIfExists(path.join(doneDir, file));
      if (content) {
        const frontmatter = extractFrontmatter(content);
        if (frontmatter?.id) {
          const task = yamlEntryToTask(frontmatter);
          if (!tasks.find(t => t.id === task.id)) {
            tasks.push(task);
          }
        }
      }
    }
  } catch {
    // Not found
  }

  // Parse sprint files for additional tickets
  const sprints = parseAllSprints(repoPath);
  for (const sprint of sprints) {
    for (const task of sprint.tasks) {
      if (!tasks.find(t => t.id === task.id)) {
        task.sprintId = sprint.id;
        tasks.push(task);
      } else {
        // Update sprint ID on existing task
        const existing = tasks.find(t => t.id === task.id);
        if (existing && !existing.sprintId) {
          existing.sprintId = sprint.id;
        }
      }
    }
  }

  return tasks;
}

// --- Internal parsers ---

function extractFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, any> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (kvMatch) {
      let value: any = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      result[kvMatch[1]] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseTicketsFromContent(content: string): DevTask[] {
  const tasks: DevTask[] = [];

  // Look for GitHub-flavored checkboxes
  const checkboxRegex = /- \[([ xX])\]\s+(?:\*\*)?([^*\n]+)(?:\*\*)?/g;
  let match;
  while ((match = checkboxRegex.exec(content)) !== null) {
    const isDone = match[1].toLowerCase() === 'x';
    const title = match[2].trim();
    const idMatch = title.match(/(T-\d+)/);

    tasks.push({
      id: idMatch ? idMatch[1] : `task-${tasks.length}`,
      title: title.replace(/T-\d+[:\s]*/, '').trim(),
      description: '',
      status: isDone ? 'done' : 'todo',
      priority: 'medium',
      type: 'feature',
      tags: [],
      sprintId: null,
      assignedAgent: null,
      lastCommitRef: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: null,
    });
  }

  // Also look for YAML list entries
  tasks.push(...parseTicketsFromYamlList(content));

  // Deduplicate by ID
  const seen = new Set<string>();
  return tasks.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function parseTicketsFromYamlList(content: string): DevTask[] {
  const tasks: DevTask[] = [];

  // Match YAML list items starting with "- id:"
  const ticketBlocks = content.split(/\n(?=- id:)/);

  for (const block of ticketBlocks) {
    if (!block.trim().startsWith('- id:')) continue;

    const entry: Record<string, any> = {};
    const lines = block.split('\n');

    for (const line of lines) {
      const kvMatch = line.match(/^\s*-?\s*(\w[\w-]*)\s*:\s*(.+)/);
      if (kvMatch) {
        let value: any = kvMatch[2].trim().replace(/^["']|["']$/g, '');
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        entry[kvMatch[1]] = value;
      }
    }

    if (entry.id) {
      tasks.push(yamlEntryToTask(entry));
    }
  }

  return tasks;
}

function yamlEntryToTask(entry: Record<string, any>): DevTask {
  return {
    id: entry.id || `task-${Math.random().toString(36).slice(2, 8)}`,
    title: entry.title || '',
    description: entry.description || entry.acceptance || '',
    status: mapTaskStatus(entry.status || 'todo'),
    priority: mapPriority(entry.priority || 'medium'),
    type: mapTaskType(entry.type || entry.phase || 'feature'),
    tags: parseTags(entry.tags || entry.type || ''),
    sprintId: entry.sprint ? `sprint-${entry.sprint.replace(/\D/g, '')}` : null,
    assignedAgent: entry.owner || entry.assignedAgent || null,
    lastCommitRef: entry.lastCommitRef || null,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
    dueDate: entry.dueDate || null,
    owner: entry.owner || null,
    phase: entry.phase || null,
    notes: entry.notes || null,
    acceptance: entry.acceptance || null,
    gates: entry.gates || null,
  };
}

function mapSprintStatus(s: string): SprintStatus {
  const lower = s.toLowerCase();
  if (lower.includes('complete') || lower.includes('done') || lower.includes('closed')) return 'completed';
  if (lower.includes('active') || lower.includes('in progress') || lower.includes('in_progress')) return 'active';
  return 'upcoming';
}

function mapTaskStatus(s: string): DevTaskStatus {
  const lower = s.toLowerCase().replace(/[_\s]/g, '-');
  if (lower === 'done' || lower === 'completed') return 'done';
  if (lower === 'in-progress' || lower === 'active') return 'in-progress';
  if (lower === 'blocked') return 'blocked';
  return 'todo';
}

function mapPriority(s: string): Priority {
  const lower = (s || '').toLowerCase();
  if (lower === 'critical' || lower === 'p0') return 'critical';
  if (lower === 'high' || lower === 'p1') return 'high';
  if (lower === 'low' || lower === 'p3') return 'low';
  return 'medium';
}

function mapTaskType(s: string): TaskType {
  const lower = (s || '').toLowerCase();
  if (lower.includes('bug') || lower.includes('fix')) return 'bug';
  if (lower.includes('design') || lower.includes('ux')) return 'design';
  if (lower.includes('research') || lower.includes('exploration')) return 'research';
  if (lower.includes('ops') || lower.includes('infra') || lower.includes('devops')) return 'ops';
  return 'feature';
}

function parseTags(tagsInput: string | string[]): string[] {
  if (Array.isArray(tagsInput)) return tagsInput;
  if (!tagsInput) return [];
  return tagsInput.split(/[,;]/).map(t => t.trim()).filter(Boolean);
}
