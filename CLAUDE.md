# Ava-TODO-Checklist Development Guide

## Project Overview
A dynamic, mobile-first checklist application. The UI is a shell that renders content from a JSON data source, allowing for full customization of categories and tasks.

## Tech Stack
- **HTML5:** Semantic shell for dynamic rendering.
- **CSS3:** Mobile-first, responsive design using `clamp()`, Flexbox, and Grid. Located in `src/style.css`.
- **JavaScript:** ES6+ modules. Handles JSON data fetching, dynamic DOM construction, and state persistence. Located in `src/app.js`.
- **Data:** `src/tasks.json` defines the default structure and content.

## Project Structure
- `index.html`: Main shell.
- `src/`: Core logic and data.
  - `app.js`: UI Rendering & State logic.
  - `style.css`: Responsive styles.
  - `tasks.json`: Default categories and tasks.
- `docs/`: Assets.
- `reference/`: Documentation.

## Core Mandates: Mobile-First
- **Touch Targets:** Minimum 44x44px for all interactive elements.
- **Responsive Scaling:** Use relative units (`rem`, `%`, `vw`, `vh`) and `clamp()` for typography.
- **Viewport:** Rigorous testing on small screens (320px width) is mandatory.

## Development Workflow
- **Data Migration:** Any content changes should be made in `src/tasks.json`, not `index.html`.
- **Persistence:** User changes (checks, additions) are synced to `localStorage`.
