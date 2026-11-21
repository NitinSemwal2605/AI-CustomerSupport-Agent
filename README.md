# AI Shopping Assistant

A full-stack, real-time **AI Shopping Assistant** built with **Node.js (Express)**, **Prisma ORM**, and **PostgreSQL** on the backend, and **React.js (Vite)** on the frontend, powered by the **Google Gemini API**.

The assistant understands customer shopping queries, suggests tailored product recommendations, performs side-by-side spec comparisons, discovers deals, and provides live verified retailer links.

---

## Key Features

1. **Gemini API Integration**: Direct integration with Google Gemini (`gemini-2.5-flash`, `gemini-3.5-flash-lite`, and `gemini-flash-latest`) via `@google/generative-ai`.
2. **System Prompts & Shopping Persona**: Specialized system instructions that guide the model to provide key specs, pros & cons, estimated price ranges, and target buyer verdicts.
3. **Product-Related Conversational Assistance**: Intelligently understands queries, clarifies ambiguous specs, contrasts products, and recommends solutions for Indian shoppers.
4. **Context Management**:
   - **Sliding Window**: Caps history to recent turns to keep responses snappy and prevent token bloat.
   - **Strict Turn Alternation**: Automatically merges consecutive same-role messages so multi-turn conversations strictly alternate between `user` and `model`.
   - **Role Mapping**: Sanitizes `assistant` to Gemini's `model` role and ensures the conversation starts with a `user` turn.
5. **Multi-Turn Conversation History & Persistence**:
   - Saves conversations and messages in PostgreSQL using Prisma ORM.
   - User account registration & login with bcrypt password hashing and JWT sessions.
   - Sidebar UI to view past shopping chats, rename threads, and delete history.
6. **Product-Related Assistance & Verified Retailer Links**:
   - Integrated with Google Search grounding to retrieve live, current product information.
   - Prioritizes trusted e-commerce platforms (Amazon, Flipkart, Myntra, Best Buy, Croma, Official Brand Stores).
   - Filters out spam, video sites, and unverified blogs.

---

## Project Structure

```
CustomerSupportAI/
├── backend/
│   ├── src/
│   │   ├── config/           # Database & environment variables
│   │   │   ├── env.js
│   │   │   └── db.js
│   │   ├── controllers/      # HTTP request & response handlers
│   │   │   ├── authController.js
│   │   │   ├── chatController.js       # Chat completion & testing
│   │   │   └── conversationController.js
│   │   ├── services/         # Business & Gemini AI logic
│   │   │   ├── authService.js
│   │   │   ├── conversationService.js  # PostgreSQL conversation persistence
│   │   │   └── geminiService.js        # Context manager & search grounding
│   │   ├── middlewares/      # JWT auth, error & 404 handlers
│   │   ├── routes/           # Express API route definitions
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server listener
│   ├── prisma/
│   │   └── schema.prisma     # Prisma data models (User, Conversation, Message)
│   ├── package.json
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx         # User registration & login modal
│   │   │   ├── FormattedText.jsx     # Markdown renderer with copyable code blocks
│   │   │   └── SettingsModal.jsx     # Dynamic API key tuner & status check
│   │   ├── App.jsx           # AI Shopping Assistant interface
│   │   ├── index.css         # Minimalist theme styles (light & dark mode)
│   │   └── main.jsx          # React DOM entry
│   ├── package.json
│   └── vite.config.js
├── package.json              # Root orchestration scripts
├── start-dev.js              # One-command development runner (DB + Server + Frontend)
└── README.md
```

---

## Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (local instance or cloud database such as Supabase / Neon)
- **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Configure Environment Variables
Ensure `backend/.env` contains your Gemini API key and PostgreSQL URL:
```bash
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=5000

# JWT Authentication Secret
JWT_SECRET=super_secure_jwt_secret_key

# PostgreSQL Connection URL
DATABASE_URL="postgresql://user:password@localhost:5432/closedai_db?schema=public"
```

### 3. Run the Entire Full-Stack App
From the project root:
```bash
npm run dev
# or
npm start
```

This single command:
1. Starts the local PostgreSQL database server (if stopped).
2. Launches the Node.js Express backend on `http://localhost:5000`.
3. Launches the Vite React frontend on `http://localhost:5173`.

---

## API Endpoints

### Shopping Chat
- `POST /api/chat`: Chat completion with Gemini and search grounding.
- `GET /api/models`: List available Gemini models with capability tags.
- `POST /api/test-key`: Test and validate a Gemini API key.

### Conversations & History
- `GET /api/conversations`: List all saved shopping chat threads for the logged-in user.
- `GET /api/conversations/:id`: Retrieve full message history for a specific thread.
- `PATCH /api/conversations/:id`: Rename conversation title.
- `DELETE /api/conversations/:id`: Delete a conversation thread and its messages.

### Authentication
- `POST /api/auth/register`: Create a new user account.
- `POST /api/auth/login`: Authenticate and receive a JWT session token.
- `GET /api/auth/me`: Validate the current session token.
