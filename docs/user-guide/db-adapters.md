# Database Adapters - Beginner's Guide

> Explained in simple, everyday language 👵

---

## 📖 What Did We Build?

Imagine you're building a house (the Wukong Agent system). What we've done today is like **laying the foundation and basement** for that house.

Here's what we built:

### 1. Designed the Storage Structure 📦

We created **database tables** - think of them as different storage compartments:
- **sessions** - A drawer for conversation history
- **steps** - A filing cabinet for each action taken
- **todos** - A folder for task lists
- **knowledge_entities** - A bookshelf for your knowledge base
- Plus 5 more tables...

### 2. Built Two Storage Options 🏠

We offer **two ways to store your data**:
- **SQLite** (local file) - Like keeping boxes in your own home
- **PostgreSQL** (cloud database) - Like renting a bank vault

### 3. Created Management Tools 🔧

We built **migration tools** that automatically:
- Create all the tables you need
- Upgrade your database structure
- Check the status of your database

---

## ❓ Your Questions Answered

### Question 1: Why Do We Have SQLite?

#### 🏡 Think of It Like: Home Cooking vs. Restaurants

**SQLite = Cooking at Home**
- No internet needed
- No extra costs
- Perfect for personal use or testing
- Data lives in a single file on your computer

**PostgreSQL (Vercel) = Fine Dining**
- Needs internet connection
- Costs money (but has a free tier)
- Better for production apps and teams
- Data lives on professional cloud servers

#### 📊 Which One Should You Use?

| Scenario | Use Which? | Why? |
|----------|-----------|------|
| Learning & Testing | ✅ SQLite | Simple, free |
| Personal Project | ✅ SQLite | Good enough |
| Production App | ✅ PostgreSQL | More reliable, faster |
| Team Collaboration | ✅ PostgreSQL | Everyone can access |
| Local Development | ✅ SQLite | Zero setup |

#### 💡 Why Offer Both?

It's like transportation - you can choose **bicycle** or **car**:
- **SQLite** is like a bicycle - simple, cheap, great for short trips
- **PostgreSQL** is like a car - fast, professional, built for long hauls

We let you **pick what fits your needs**!

---

### Question 2: How Do I Set Up SQLite or Vercel Postgres?

#### 🎯 Option A: Using SQLite (Recommended for Beginners)

**Super easy - just 3 steps:**

```bash
# Step 1: Navigate to the local adapter
cd packages/adapter-local

# Step 2: Run migrations (creates your database)
pnpm migrate

# Step 3: Check if it worked
pnpm migrate:status
```

**That's it!** The database file will be automatically created at `./data/wukong.db`

You don't need to:
- ❌ Install database software
- ❌ Set up usernames and passwords
- ❌ Connect to the internet
- ❌ Pay anything

#### 🎯 Option B: Using Vercel PostgreSQL (For Production)

**Takes 5 steps:**

##### Step 1: Sign Up for Vercel
- Go to https://vercel.com
- Log in with your GitHub account (it's free)

##### Step 2: Create a Database
- Open the Vercel dashboard
- Click "Storage" → "Create Database"
- Choose "Postgres"
- Select your region (pick the closest one)
- Click create

##### Step 3: Get Your Connection String
Vercel will give you these important details:
```
POSTGRES_URL=postgres://username:password@host/database
POSTGRES_PRISMA_URL=...
POSTGRES_URL_NON_POOLING=...
```

##### Step 4: Set Environment Variables
Create a `.env` file:
```bash
# In your project root, create .env
POSTGRES_URL=paste_your_connection_string_here
```

##### Step 5: Run Migrations
```bash
cd packages/adapter-vercel
pnpm migrate
pnpm migrate:status
```

#### 🔄 How Do I Switch Between Them?

**It's simple in your code:**

```typescript
// Using SQLite
import { LocalStorageAdapter } from '@wukong/adapter-local';
const storage = new LocalStorageAdapter('./data/mydb.db');

// Using PostgreSQL
import { VercelStorageAdapter } from '@wukong/adapter-vercel';
const storage = new VercelStorageAdapter({
  postgres: process.env.POSTGRES_URL
});
```

---

### Question 3: What Are These Adapters?

#### 🔌 Think of It Like: Power Plugs

Imagine you need to charge your phone:
- **China** uses flat pins
- **USA** uses two flat pins + one round
- **UK** uses three square blocks

Your phone has one charging port, but wall outlets are different everywhere. That's when you need an **adapter**!

#### 🎯 In Our System

**Wukong Agent (your phone)** only knows:
- "I want to save data"
- "I want to read data"
- "I want to search data"

**Different databases (outlets)** work differently:
- SQLite needs: `db.prepare("SELECT * FROM users").all()`
- PostgreSQL needs: `await sql\`SELECT * FROM users\``

**Adapters (converters)** do this:
- Let Wukong Agent use **one set of commands**
- Automatically translate to **different database languages**

#### 📝 Code Example

**Without Adapters (messy):**

```typescript
// When using SQLite
if (dbType === 'sqlite') {
  const db = new Database('mydb.db');
  const sessions = db.prepare('SELECT * FROM sessions').all();
}

// When using PostgreSQL
if (dbType === 'postgres') {
  const sessions = await sql`SELECT * FROM sessions`;
}

// You have to check every time! So annoying!
```

**With Adapters (clean):**

```typescript
// Same code works with any database!
const session = await storage.getSession('session-123');
const sessions = await storage.listSessions(userId);
await storage.createSession(newSession);

// The adapter handles database differences behind the scenes
```

#### 🎨 Benefits of the Adapter Pattern

1. **Unified Interface** - You only learn one API
2. **Easy Switching** - Use SQLite in dev, PostgreSQL in production
3. **Easy Extensions** - Can add MySQL, MongoDB support later
4. **Clean Code** - No messy if-else statements everywhere

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│      Wukong Agent (Your Program)        │
│   "Save data", "Read data", etc.        │
└────────────────┬────────────────────────┘
                 │
                 │ Unified API
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────────┐   ┌─────────────────┐
│ Local Adapter   │   │ Vercel Adapter  │
│   (Converter 1) │   │  (Converter 2)  │
└────────┬────────┘   └────────┬────────┘
         │                     │
         │ Translates           │ Translates
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│     SQLite      │   │   PostgreSQL    │
│  (Local file)   │   │  (Cloud DB)     │
│  data/app.db    │   │  Vercel servers │
└─────────────────┘   └─────────────────┘
```

---

## 🎓 Key Concepts

### Database Migrations

**What is it?**
- Like blueprints for renovating a house
- Records every change to your database structure

**Why do we need it?**
- Keeps everyone's database in sync when working on a team
- Updates without breaking existing data
- Allows rolling back to previous versions

**How to use it?**
```bash
pnpm migrate          # Run all pending migrations
pnpm migrate:status   # Check which migrations are complete
```

### Storage Adapters

**What is it?**
- A "translator"
- Converts unified commands into different database languages

**Why do we need it?**
- Your code doesn't depend on a specific database
- Easy to swap databases
- Code is cleaner and easier to maintain

### Schema (Database Structure)

**What is it?**
- The "blueprint" of your database
- Defines what tables exist and what fields each has

**Tables we created:**
1. **sessions** - Conversation sessions
2. **steps** - Execution steps
3. **todos** - Task lists
4. **checkpoints** - Snapshots (for undo)
5. **parallel_tool_calls** - Parallel tool execution
6. **fork_agent_tasks** - Sub-agent tasks
7. **knowledge_entities** - Knowledge entities
8. **knowledge_feedback** - Knowledge feedback
9. **schema_versions** - Version tracking

---

## 🚀 Quick Start Guide

### Recommended for Beginners: SQLite

```bash
# 1. Navigate to local adapter
cd packages/adapter-local

# 2. Create database (automatic)
pnpm migrate

# 3. You'll see success messages:
# ✓ Migration 1 completed successfully
# ✓ Migration 2 completed successfully
# ✓ Migration 3 completed successfully
# ✓ Migration 4 completed successfully
# ✓ Applied 4/4 migration(s)

# 4. Check status
pnpm migrate:status

# 5. You'll see:
# Current version: 4
# Applied migrations: 4
# Pending migrations: 0
```

**Congrats! Your database is ready!** 🎉

---

## 🔍 Frequently Asked Questions

### Q1: Can I use both databases at the same time?
**A:** Yes! Use SQLite in development, PostgreSQL in production.

### Q2: Can I transfer data from SQLite to PostgreSQL?
**A:** Yes! We'll provide export/import tools in the future.

### Q3: What if I accidentally delete my database file?
**A:** 
- SQLite: Just run `pnpm migrate` again to recreate it
- PostgreSQL: Data is in the cloud, won't be easily lost

### Q4: Do I need to learn SQL?
**A:** **Nope!** The adapters handle everything. You just call simple methods:
```typescript
await storage.getSession(id)
await storage.createSession(data)
await storage.updateSession(id, data)
```

### Q5: What if I want to use MySQL?
**A:** Just create a MySQL adapter with the same interface - that's it!

---

## 📚 Further Reading

If you want to dive deeper:

1. **SQLite Official Site**: https://www.sqlite.org
   - See how simple yet powerful it is

2. **PostgreSQL Docs**: https://www.postgresql.org
   - Learn about enterprise-grade database features

3. **Adapter Design Pattern**: 
   - Search for "adapter pattern design patterns"
   - Understand why this design works so well

---

## ✅ What's Next

Now that the database foundation is ready, here's what's coming:

1. **Task 2.1** - Build the event system (let the program "talk")
2. **Task 2.2** - Implement Vercel Adapter features
3. **Task 2.3** - Implement Local Adapter features

---

**Hope this guide helps you understand what we built!** 😊

Questions? Just ask! 👋

