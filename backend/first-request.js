#!/usr/bin/env node
/**
 * ============================================================================
 * LEARNING EXERCISE: MAKE YOUR FIRST GEMINI API REQUEST IN NODE.JS
 * ============================================================================
 * 
 * This script demonstrates:
 * 1. How API Authentication works using an API key
 * 2. How to initialize the GoogleGenerativeAI client
 * 3. How roles (system, user, model) are defined
 * 4. How the request structure is formatted
 * 5. How the response structure is unpacked (candidates, parts, finishReason)
 * 6. How token usage and API costs are calculated
 * 
 * HOW TO RUN:
 *   Option A (via .env file):
 *     1. Add GEMINI_API_KEY=your_key in backend/.env
 *     2. node first-request.js
 * 
 *   Option B (via command line):
 *     GEMINI_API_KEY=your_key node first-request.js
 * ============================================================================
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  console.log('='.repeat(70));
  console.log(' STEP 1: API AUTHENTICATION & SETUP');
  console.log('='.repeat(70));

  // 1. Retrieve the API Key
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('\n❌ ERROR: GEMINI_API_KEY is not defined!');
    console.log('\nTo get a FREE API Key:');
    console.log('1. Go to https://aistudio.google.com/');
    console.log('2. Click "Get API key"');
    console.log('3. Copy your key and add it to backend/.env:');
    console.log('   GEMINI_API_KEY=AIzaSy...');
    console.log('\nOr run:');
    console.log('   GEMINI_API_KEY="your_api_key_here" node first-request.js\n');
    process.exit(1);
  }

  // Mask the key for safe logging (e.g. AIzaSy...xYz1)
  const maskedKey = apiKey.slice(0, 7) + '...' + apiKey.slice(-4);
  console.log(`✓ API Key detected: ${maskedKey}`);
  console.log('✓ Initializing GoogleGenerativeAI client...');

  // Initialize the SDK with your API key
  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('\n' + '='.repeat(70));
  console.log(' STEP 2: EXPLORING ROLES & REQUEST STRUCTURE');
  console.log('='.repeat(70));

  /**
   * ROLES IN GEMINI:
   * 1. system:
   *    Passed via `systemInstruction` in getGenerativeModel.
   *    Controls overall behavior, tone, style, and guardrails.
   * 
   * 2. user:
   *    Passed in `contents` with { role: "user", parts: [{ text: "..." }] }.
   *    The prompt given by the human.
   * 
   * 3. model:
   *    Gemini's equivalent of "assistant".
   *    Represents previous AI responses in multi-turn conversation.
   */
  let activeModelName = 'gemini-2.5-flash';
  const systemPrompt = 'You are a friendly computer science mentor who explains concepts with simple analogies.';
  const userPrompt = 'Explain what an API is in 2 concise sentences using a restaurant analogy.';

  console.log('\n[System Instruction (Persona)]:\n ', systemPrompt);
  console.log('\n[User Prompt]:\n ', userPrompt);

  console.log('\n' + '='.repeat(70));
  console.log(' STEP 3: DISPATCHING THE API REQUEST');
  console.log('='.repeat(70));
  console.log(`Sending request to model "${activeModelName}"... Please wait.`);

  const startTime = Date.now();
  let response;

  try {
    const model = genAI.getGenerativeModel({
      model: activeModelName,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
    });
    response = await result.response;
  } catch (err) {
    if (err.message && (err.message.includes('503') || err.message.includes('high demand'))) {
      console.log('⚡ Model "gemini-flash-latest" is busy (503). Retrying with "gemini-2.5-flash"...');
      activeModelName = 'gemini-2.5-flash';
      const fallbackModel = genAI.getGenerativeModel({
        model: activeModelName,
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      });
      const result = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
      });
      response = await result.response;
    } else {
      throw err;
    }
  }
  const duration = Date.now() - startTime;

  console.log(`✓ Response received in ${duration}ms!`);

  console.log('\n' + '='.repeat(70));
  console.log(' STEP 4: UNDERSTANDING THE RESPONSE STRUCTURE');
  console.log('='.repeat(70));

  // The generated text
  const responseText = response.text();
  console.log('\n[Generated Text from Model (Assistant Role)]:');
  console.log('--------------------------------------------------');
  console.log(responseText.trim());
  console.log('--------------------------------------------------');

  // Examining Candidates
  const candidate = response.candidates && response.candidates[0];
  console.log('\n[Response Candidate Details]:');
  console.log(`- Finish Reason: ${candidate?.finishReason} (e.g. STOP = completed naturally)`);
  console.log(`- Role: ${candidate?.content?.role} (Gemini uses "model")`);
  console.log(`- Total Parts: ${candidate?.content?.parts?.length || 1}`);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 First API request completed successfully!');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  if (err.status) console.error('Status code:', err.status);
});
