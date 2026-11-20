# AI Customer Support Agent

A full-stack, enterprise-grade AI Customer Support Agent and Applied AI learning laboratory. Built with **Node.js (Express)**, **Prisma ORM**, and **PostgreSQL** on the backend, and **React.js (Vite)** on the frontend.

This repository serves as a practical, production-oriented project for implementing end-to-end Applied AI concepts—scaling from core Gemini LLM integrations and telemetry up through Retrieval-Augmented Generation (RAG), vector databases, function calling, and autonomous support workflows.

---

## Applied AI Architecture & Roadmap

### Phase 1: LLM Foundations & Production Infrastructure (Completed)
- **API Integration**: Direct Google Gemini API communication via `@google/generative-ai`.
- **System Instructions & Roles**: Support agent personas with strict role boundaries (`system`, `user`, `model`).
- **Telemetry & Cost Tracking**: Exact prompt and completion token accounting with real-time USD billing calculations.
- **Relational Data & Auth**: User authentication, password hashing with bcrypt, JWT session management, and PostgreSQL persistence through Prisma ORM.

### Phase 2: Retrieval-Augmented Generation (RAG) (In Progress / Next)
- **Knowledge Base Ingestion**: Markdown, PDF, and FAQ document parsing for customer support domains.
- **Semantic Chunking**: Context-preserving sliding window chunking with metadata tagging.
- **Vector Embeddings**: Generating embeddings using Google text-embedding models.
- **Vector Database**: Semantic similarity search and cosine distance ranking to inject grounded domain knowledge into customer prompts.

### Phase 3: Function Calling & Tool Use (Roadmap)
- **Support Operations**: Live tools for ticket status lookup, order tracking, and refund eligibility verification.
- **Structured Outputs**: Enforcing JSON schema validation on tool arguments and responses.

### Phase 4: Autonomous Support Workflows (Roadmap)
- **Conversation State & Long-Term Memory**: Multi-turn history summarization and customer profile persistence.
- **Guardrails & Escalation**: Sentiment analysis, safety filters, and automated escalation to human support tiers.

---

## Project Structure

```
AI-CustomerSupport-Agent/
├── backend/
│   ├── src/
│   │   ├── config/           # Database & environment variables
│   │   │   ├── env.js
│   │   │   └── db.js
│   │   ├── controllers/      # HTTP request & response handlers
│   │   │   ├── authController.js
│   │   │   └── chatController.js
│   │   ├── services/         # Decoupled business & AI logic
│   │   │   ├── authService.js
│   │   │   └── geminiService.js
│   │   ├── middlewares/      # JWT auth, error & 404 handlers
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorHandler.js
│   │   │   └── notFoundHandler.js
│   │   ├── routes/           # Modular Express route definitions
│   │   │   ├── authRoutes.js
│   │   │   ├── chatRoutes.js
│   │   │   └── index.js
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server listener
│   ├── prisma/
│   │   └── schema.prisma     # Prisma data models (PostgreSQL User schema)
│   ├── first-request.js      # Standalone practice script for your first request
│   ├── package.json          # Express, @prisma/client & @google/generative-ai
│   ├── .env.example          # Template for GEMINI_API_KEY & DATABASE_URL
│   └── .env                  # Local environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx         # User registration & login modal
│   │   │   ├── FormattedText.jsx     # Markdown & copyable code blocks
│   │   │   ├── InspectorModal.jsx    # Raw request/response & cost telemetry
│   │   │   └── SettingsModal.jsx     # Dynamic API key & parameter tuner
│   │   ├── App.jsx           # Customer Support Agent interface
│   │   ├── index.css         # Minimalist theme styles (light & dark mode)
│   │   └── main.jsx          # React DOM entry
│   ├── index.html
│   ├── package.json
│   └── vite.config.js        # API proxy to backend
├── package.json              # Root orchestration scripts
├── start-dev.js              # One-command development runner (DB + Server + Frontend)
└── README.md
```

---

## Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (local instance or cloud database such as Supabase / Neon)
- Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Configure Backend Environment
Copy the example environment file in `backend`:
```bash
cp backend/.env.example backend/.env
```

Configure `backend/.env`:
```bash
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=5000

# JWT Authentication Secret
JWT_SECRET=your_jwt_secret_key_here

# PostgreSQL Database Connection URL for Prisma
DATABASE_URL="postgresql://user:password@localhost:5432/closedai_db?schema=public"
```

### 3. Sync Database Schema
Push the Prisma schema to your PostgreSQL database:
```bash
npm run db:push
```

### 4. Start the Application
Run both backend and frontend with the root development script:
```bash
npm run dev
```
Alternatively, run each service separately:
- **Backend:** `cd backend && npm start` (runs on `http://localhost:5000`)
- **Frontend:** `cd frontend && npm run dev` (runs on `http://localhost:5173`)

Open your browser to: **`http://localhost:5173`**

---

## Core Technical Concepts

### 1. Gemini API Authentication & Model Selection
- Authentication is handled securely on the server via `process.env.GEMINI_API_KEY`.
- Supports dynamic client-level keys through request headers (`x-gemini-api-key`) for testing and sandboxing.
- Direct model selection (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-flash-latest`) with custom temperature and max token configurations.

### 2. User Authentication (Prisma ORM + PostgreSQL)
- **Database Schema**: Managed in `backend/prisma/schema.prisma` with UUID primary keys and unique constraints.
- **Security**: Passwords hashed using `bcryptjs` with salt rounds. Sessions managed via signed JWT tokens.
- **Endpoints**:
  - `POST /api/auth/register`: Create user account and return JWT.
  - `POST /api/auth/login`: Authenticate credentials against PostgreSQL and return JWT.
  - `GET /api/auth/me`: Validate JWT token and retrieve current user context.

### 3. Conversation Persistence & Chat Management
- **Relational History**: Automatically persists user conversations and assistant messages with grounding sources and telemetry to PostgreSQL.
- **Chat Management**:
  - `GET /api/conversations`: List all conversations for the authenticated user, ordered by latest activity.
  - `GET /api/conversations/:id`: Retrieve complete chat history for a specific conversation thread.
  - `PATCH /api/conversations/:id`: Rename conversation title.
  - `DELETE /api/conversations/:id`: Delete conversation and cascaded messages.
- **Interactive Sidebar UI**: Allows users to switch between past chats, trigger inline renames with save/cancel controls, and delete conversations.

### 4. Request & Response Telemetry
- Every exchange captures complete round-trip JSON payloads:
  - System instructions
  - Generation configuration (`temperature`, `maxOutputTokens`)
  - Full conversation history (`contents` array with `user` and `model` roles)
  - Finish reason (`STOP`, `MAX_TOKENS`, etc.)
  - Token counts (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`)
  - Roundtrip latency in milliseconds

### 5. Interactive Telemetry Inspector
- Embedded modal allowing users and engineers to inspect raw JSON payloads, model metadata, and token usage directly inside the UI.

---

## Database Management Scripts
- `npm run db:push`: Synchronize Prisma schema with PostgreSQL without generating SQL migrations.
- `npm run db:generate`: Regenerate Prisma Client.
- `npm run db:studio`: Launch Prisma Studio web GUI to browse and edit database records.
