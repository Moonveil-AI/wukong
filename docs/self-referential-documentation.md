# Fractal Documentation Standard

A self-referential documentation pattern for AI-assisted development and maintainable codebases.

---

## Core Principle

Documentation follows a **fractal structure**: the same pattern repeats at every level (project → directory → file), with each level referencing and maintaining its children and parent.

---

## Level 1: Project Root

The root `README.md` or main documentation file must:

1. **Declare the update contract**: Any change to functionality, architecture, or conventions requires updating the relevant subdirectory documentation before the work is considered complete.

2. **Provide project-wide context**: High-level architecture, key directories, and their relationships.

**Example header for root README:**

```markdown
<!-- SYNC CONTRACT: When project structure changes, update this file and affected directory docs. -->
```

---

## Level 2: Directory Documentation

Every directory contains a brief `README.md` (or `_index.md`) with:

1. **Architecture summary** (≤3 lines): What this directory is responsible for.

2. **File manifest**: A table or list of each file with:
   - **Name**: The filename
   - **Role**: Its position/importance in this module
   - **Purpose**: What it does (one line)

3. **Self-reference directive**:

```markdown
<!-- SYNC: When files in this directory change, update this document. -->
```

**Example:**

```markdown
# /src/auth

Authentication and authorization module.

<!-- SYNC: When files in this directory change, update this document. -->

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Entry | Exports public auth API |
| `strategies.ts` | Core | Authentication strategy implementations |
| `middleware.ts` | Integration | Express/Hono middleware adapters |
| `types.ts` | Support | Type definitions for auth module |
```

---

## Level 3: File Header Comments

Every source file begins with a structured comment block:

```typescript
/**
 * @file strategies.ts
 * @input Uses `types.ts` for AuthConfig, depends on external JWT library
 * @output Exports authenticate(), validateToken(), refreshSession()
 * @position Core authentication logic; consumed by middleware.ts
 * 
 * SYNC: When this file changes, update this header and /src/auth/README.md
 */
```

### The Three Dimensions

| Field | Question Answered |
|-------|-------------------|
| **@input** | What does this file depend on? (internal modules, external packages) |
| **@output** | What does this file provide? (exports, side effects) |
| **@position** | Where does this file sit in the system? (its role and consumers) |

---

## The Update Protocol

When you modify code:

1. **Update the file's header comment** — Ensure @input, @output, @position are accurate
2. **Update the directory's README** — Reflect any new files, removed files, or changed responsibilities
3. **Update parent documentation if needed** — If the change affects project-level architecture

This creates a **bidirectional sync**: files point up to their directory docs, directory docs point up to the root, and all levels point down to their children.

---

## Why This Works

### For AI-Assisted Development

- AI agents can read any directory's README and immediately understand context
- The structured headers provide semantic anchors for code navigation
- Self-reference directives remind AI to maintain documentation consistency

### For Human Developers

- Onboarding becomes faster: start at root, drill down as needed
- Code review includes documentation review naturally
- Technical debt in documentation becomes visible

### The Fractal Nature

```
Project README
├── declares update contract
├── lists directories with purposes
│
└── Directory README
    ├── declares update contract  
    ├── lists files with purposes
    │
    └── File Header
        ├── declares update contract
        └── describes input/output/position
```

Each level mirrors the others. This is **polyphony** (multiple voices in harmony) and **self-reference** (each part describes itself and its relationship to the whole).

---

## Quick Reference

### File Header Template

```typescript
/**
 * @file {filename}
 * @input {dependencies}
 * @output {exports}
 * @position {role in system}
 * 
 * SYNC: When modified, update this header and directory README.
 */
```

### Directory README Template

```markdown
# /{path}

{One-line description of this directory's purpose}

<!-- SYNC: When files change, update this document. -->

| File | Role | Purpose |
|------|------|---------|
| ... | ... | ... |
```

### Root README Reminder

```markdown
<!-- SYNC CONTRACT: Architecture changes require documentation updates. -->
```

---

## Adoption Strategy

1. **Start with new directories** — Apply the pattern to new code first
2. **Document on touch** — When modifying a file, add the header if missing
3. **Review includes docs** — Make documentation updates part of PR review
4. **Automate reminders** — Consider lint rules or pre-commit hooks

---

*This pattern turns documentation from an afterthought into an integral part of the codebase structure itself.*

