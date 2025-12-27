# /examples/ui

Full-featured web UI example with React and Vite.

<!-- SYNC: When files in this directory change, update this document. -->

## Purpose

Complete web application demonstrating all trustworthy UI components and features, suitable as a reference implementation for production applications.

## File Structure

| Directory/File | Role | Purpose |
|----------------|------|---------|
| `src/App.tsx` | Entry | Main React application |
| `src/api/` | Integration | API client for backend communication |
| `src/utils/` | Support | Utility functions |
| `server.ts` | Backend | Development backend server |
| `index.html` | Entry | HTML entry point |
| `vite.config.ts` | Config | Vite build configuration |
| `package.json` | Config | Dependencies and scripts |
| `data/` | Storage | Local SQLite database |
| `README.md` | Docs | Setup and usage guide |

## Key Features Demonstrated

- Complete UI component integration
- All 30 trustworthiness principles
- Real-time event streaming
- Session persistence
- Interactive and auto execution modes
- Todo list visualization
- Token usage monitoring
- Stop/pause/resume control
- Undo/redo functionality
- Version history

## Running

```bash
# Backend server
cp env.template .env
# Edit .env with API keys
pnpm install
pnpm server

# Frontend (in another terminal)
pnpm dev
```

Visit `http://localhost:5173` to see the UI.

