# 🚀 Gemini API Practice Lab: Node.js + React.js

A full-stack learning application built with **Node.js (Express)** on the backend and **React.js (Vite)** on the frontend, featuring a clean **ChatGPT-inspired light-mode UI**.

Designed to teach and practice the core fundamentals of building AI-powered applications with the **Google Gemini API**:
1. **API Authentication**: Secure key management in Node.js
2. **First API Request**: Minimal standalone Node.js script & live web interface
3. **Request & Response Structure**: Complete JSON schema breakdown
4. **Roles**: Exploring `system`, `user`, and `model` (assistant) roles
5. **Tokens & Costs**: Real-time token tracking and exact USD billing calculations

---

## 📁 Project Structure

```
gemini-node-react/
├── backend/
│   ├── first-request.js      # Standalone practice script for your first request
│   ├── server.js             # Express API server with CORS and error handling
│   ├── geminiService.js      # Gemini SDK integration & payload formatter
│   ├── geminiPricing.js      # Token usage and USD cost calculator
│   ├── package.json          # Express & @google/generative-ai dependencies
│   ├── .env.example          # Template for GEMINI_API_KEY
│   └── .env                  # Your local environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FormattedText.jsx     # Markdown & copyable code blocks
│   │   │   ├── InspectorModal.jsx    # Raw request/response & cost telemetry
│   │   │   ├── SettingsModal.jsx     # Dynamic API key & parameter tuner
│   │   │   └── LearningLabModal.jsx  # Interactive in-app learning guide
│   │   ├── App.jsx           # ChatGPT-style light-themed layout
│   │   ├── index.css         # Clean, minimalist light-mode aesthetic
│   │   └── main.jsx          # React DOM entry
│   ├── index.html
│   ├── package.json
│   └── vite.config.js        # API proxy to backend
├── package.json              # Root project scripts
└── README.md
```

---

## ⚡ Quick Start

### 1. Get a Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** and copy your key.

### 2. Configure Backend Environment
Open `gemini-node-react/backend/.env` and insert your key:
```bash
GEMINI_API_KEY=AIzaSyYourGeneratedKeyHere
PORT=5000
```
*(Note: You can also enter the API key directly in the web UI settings!)*

### 3. Practice: Run Your First Node.js API Request
We included a self-contained learning script with rich terminal output:
```bash
cd backend
node first-request.js
```
This tests your API authentication, prints the request payload, receives the model response, and displays token counts with pricing calculations.

### 4. Start the Full-Stack Application

**Start the Backend Server (Terminal 1):**
```bash
cd backend
npm start
# Server runs on http://localhost:5000
```

**Start the React Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
# Vite runs on http://localhost:5173
```

Open your browser to: **`http://localhost:5173`**

---

## 📚 Core Learning Concepts

### 1. API Authentication
* **How it works:** The Google Gemini API authenticates requests via an API key passed either as an HTTP header (`x-goog-api-key`) or through the official SDK:
  ```javascript
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  ```
* **Best Practice:** Keep keys in server-side environment variables (`.env`). Never bundle API keys inside client-side React code.

### 2. Request & Response Structure
* **Request JSON:**
  ```json
  {
    "model": "gemini-1.5-flash",
    "systemInstruction": {
      "role": "system",
      "parts": [{ "text": "You are a senior JavaScript mentor." }]
    },
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 2048
    },
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "Explain what a closure is." }]
      }
    ]
  }
  ```
* **Response JSON:**
  ```json
  {
    "candidates": [
      {
        "content": {
          "role": "model",
          "parts": [{ "text": "A closure is..." }]
        },
        "finishReason": "STOP"
      }
    ],
    "usageMetadata": {
      "promptTokenCount": 24,
      "candidatesTokenCount": 85,
      "totalTokenCount": 109
    }
  }
  ```

### 3. System, User, and Assistant/Model Roles
* **`system` (`systemInstruction`)**: Sets the model's persona, rules, constraints, and tone before user input is processed.
* **`user`**: The human prompt submitted in the conversation.
* **`model`**: The Gemini equivalent of the "assistant" role. Previous model responses in multi-turn chat history must use `role: "model"` so the model remembers past interactions.

### 4. Token Usage & API Cost Calculations
* **What is a Token?** A token is roughly 4 characters or ~0.75 English words.
* **Gemini 1.5 & 2.5 Flash Pricing (Pay-As-You-Go):**
  * **Input Tokens (Prompt + System):** $0.075 per 1,000,000 tokens ($0.000000075 / token)
  * **Output Tokens (Candidates):** $0.30 per 1,000,000 tokens ($0.00000030 / token)
* **Formula:**
  $$\text{Total Cost} = \left(\frac{\text{PromptTokens}}{1,000,000} \times 0.075\right) + \left(\frac{\text{OutputTokens}}{1,000,000} \times 0.30\right)$$
* In our application, every assistant message displays an interactive **"Inspector & Cost"** button that shows the exact calculation.

---

## 🎨 UI Highlights
* **Clean ChatGPT Aesthetic:** Subtle borders, rounded bubbles, crisp typography, and off-white background.
* **Live Inspector:** Click any message's telemetry pill to see the raw request/response JSON.
* **Persona Presets:** Easily switch between personas (Helpful Assistant, Senior JS Architect, Socratic Tutor, Strict JSON Formatter).
* **Live Token & Cost Tally:** Cumulative counter tracking session spending.
