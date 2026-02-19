# Mission Control Design Spec

Reference screenshots are in this folder (01-06). This describes what each page should look like.

## Sidebar Navigation (update sidebar.tsx)
The sidebar needs these nav items (matching reference):
- Tasks (kanban icon)
- Content (document icon) 
- Approvals (check-circle icon)
- Council (users icon)
- **Calendar** (calendar icon) ← NEW PAGE
- Projects (folder icon)
- **Memory** (brain icon) ← NEW PAGE  
- Docs (file-text icon)
- People (user icon)
- **Office** (building icon) ← NEW PAGE (stretch goal)
- **Team** (users icon) ← NEW PAGE

## Page 1: Tasks (upgrade existing /dashboard/projects/[id])
Reference: 01-tasks-kanban.png

### Stats Bar at Top
- "0 this week" | "3 in progress" | "25 total" | "40% Completion"
- Inline, left-aligned, mono font for numbers

### Filters Row
- "+ New task" button (green/primary)
- Filter pills: "Alex", "Henry" (agent filter)
- "All projects" dropdown

### Kanban Columns
- Recurring | Backlog | In Progress | Review | Done
- Each column: colored header dot, count badge, + button
- Task cards: title, description preview, colored tags, timestamp
- Tags color-coded by type (YouTube=red, ClawdBot=purple, Agent=blue, etc.)

## Page 2: Content Pipeline (new page /dashboard/content)
Reference: 02-content-pipeline.png

### Pipeline Stats Row
- Column counts at top: Ideas (0), Scripting (0), Thumbnail (1), Filming (0), Editing (0)
- Each with colored label matching column

### Dual Kanban
- Top row: column headers with colored labels + "+" buttons  
- Bottom row: cards in each column
- Card style: title, description, platform tags (YouTube, X), action buttons

## Page 3: Calendar / Scheduled Tasks (new page /dashboard/calendar)
Reference: 03-calendar.png

### Header
- "Scheduled Tasks" title + "Here's automated routines" subtitle
- Week/Today toggle buttons (top right)

### Always Running Section
- Green "always running" pills showing persistent tasks
- e.g., "mission.control.check • Every 30 min"

### Weekly Calendar Grid
- 7 columns (Sun-Sat), rows for time slots
- Color-coded task blocks:
  - Purple: "ai security research" 
  - Red/coral: "morning brief"
  - Teal: "newsletter research" (Wed only)
  - Yellow: "competitor youtube scan"
  - Green: "competitor youtube scan" variant
- Tasks show name + time range

### Next Up Section (below calendar)
- List view of upcoming scheduled tasks
- Color-coded labels matching calendar
- Timestamps showing next run time

## Page 4: Memory / Journal (new page /dashboard/memory)
Reference: 04-memory-journal.png

### Left Sidebar (within page)
- Search bar at top
- "Long-Term Memory" section with update count + timestamp
- "Daily Journals" section with date-grouped entries
- Expandable month sections (February 2026, January 2026)
- Click date to load that journal

### Main Content Area
- Journal header: "Journal: 2026-02-17" + date + word count
- Tags: "daily", "journal"
- Timeline entries with timestamps:
  - Each entry: "05:37 AM — Architecture Discussion: Subagents Decision"
  - Bold title, body text with details
  - Color-coded category dots
  - Collapsible sections for long entries
- Entry types: Decision (blue), Issue (red), Plan (green), Note (gray)

## Page 5: Team (new page /dashboard/team)  
Reference: 05-team.png

### Header
- "Meet the Team" centered title
- "8 AI agents, each with a real role and a real personality"
- Description text about the team

### Chief Agent (hero card)
- Large card at top for primary agent
- Name, role, personality description
- Skill tags: "Architecture", "Tasks", "Delegation"
- "Edit" button

### Agent Hierarchy Visualization
- "INPUT TASKS" → "OUTPUT ACTION" flow indicator
- Arrow/connection lines between chief and sub-agents

### Agent Grid (2x3 or similar)
- Cards for each agent: Scout, Quill, Pixel, Echo, Codex
- Each card: emoji avatar, name, role title
- Description of capabilities
- Colored skill tags (different color per agent theme)
- Token/cost counter

## Page 6: The Office (stretch goal - /dashboard/office)
Reference: 06-office.png

### Status Bar
- "Working" / "Chatting" / "Walking" / "Idle" status indicators with colored dots
- Demo Controls toggle

### Action Buttons
- "All Working", "Gather", "Run Meeting", "Watercooler" buttons

### Pixel Art Office Grid
- Checkered floor background
- Desk sprites with monitors
- Agent sprites (color-coded) at their stations
- Conference table in center
- Plants/decorations
- Speech bubble showing current task: "Build Council — S..."

### Live Activity Feed (right panel)
- Real-time activity log
- "Last updated: X" timestamp

## Design System Notes
- Near-black background (#191a1a approx)
- Cards: slightly elevated dark surface
- Accent colors per entity type
- Very subtle borders (1px, low opacity)
- Monospace for data/timestamps
- Sans-serif (Inter) for body text
- Generous padding and spacing
- Hover effects: subtle glow/lift
