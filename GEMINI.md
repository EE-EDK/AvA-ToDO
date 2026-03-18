# Gemini CLI Project Mandates - Ava-TODO-Checklist

## General Principles
- **Data-Driven Architecture:** The `index.html` is a skeleton. All content is defined in `src/tasks.json`.
- **Mobile-First Core:** Every feature must be designed for a phone screen first. Use `clamp()` and touch-friendly layouts.
- **Dynamic State:** All changes to categories, tasks, and completion must be tracked dynamically in memory and persisted to `localStorage`.

## Technical Rules
- **JSON Structure:** Maintain a clean, nested JSON structure for categories and tasks.
- **DOM Injection:** Use modern, safe DOM injection methods to prevent XSS (e.g., `textContent` and `createElement`).
- **CSS Responsiveness:** Never use fixed pixel widths for layout. Use `max-width`, `flex`, and `grid`.
- **Accessibility:** Ensure dynamic content remains accessible through proper ARIA updates and focus management.

## Workflow Rules
- **Configuration over Code:** Prefer changing JSON over changing JavaScript or HTML for content updates.
- **State Merging:** Implement a robust strategy for merging default JSON with user modifications.
- **Asset Management:** Any new icons or images go in `docs/`.
- **Documentation:** All new features must be documented in the `reference/` folder.
