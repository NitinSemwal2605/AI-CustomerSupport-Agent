/**
 * Gemini API Pricing Calculator
 * Rates per 1,000,000 tokens (Standard Google AI Studio Pay-as-you-go pricing)
 * Reference: https://ai.google.dev/pricing
 */

const PRICING_TIERS = {
  'gemini-flash-latest': {
    name: 'Gemini Flash Latest (Fast & Low Cost)',
    inputRatePerMillion: 0.075,
    outputRatePerMillion: 0.30,
    freeTierAvailable: true,
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash (Fastest & Cost-Efficient)',
    inputRatePerMillion: 0.075,  // $0.075 per 1M tokens
    outputRatePerMillion: 0.30,  // $0.30 per 1M tokens
    freeTierAvailable: true,
  },
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash (General Purpose Lightweight)',
    inputRatePerMillion: 0.075,
    outputRatePerMillion: 0.30,
    freeTierAvailable: true,
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro (Complex Reasoning)',
    inputRatePerMillion: 1.25,   // $1.25 per 1M tokens (prompts <= 128k)
    outputRatePerMillion: 5.00,   // $5.00 per 1M tokens
    freeTierAvailable: true,
  },
  'gemini-2.0-flash-exp': {
    name: 'Gemini 2.0 Flash (Experimental)',
    inputRatePerMillion: 0.075,
    outputRatePerMillion: 0.30,
    freeTierAvailable: true,
  }
};

/**
 * Calculate token cost in USD
 * @param {string} modelName 
 * @param {number} promptTokens (User + System prompt tokens)
 * @param {number} candidatesTokens (Model generated response tokens)
 * @returns {object} Detailed cost calculation
 */
function calculateCost(modelName = 'gemini-2.5-flash', promptTokens = 0, candidatesTokens = 0) {
  // Normalize model name
  const modelKey = Object.keys(PRICING_TIERS).find(k => modelName.includes(k)) || 'gemini-1.5-flash';
  const tier = PRICING_TIERS[modelKey];

  const inputCost = (promptTokens / 1_000_000) * tier.inputRatePerMillion;
  const outputCost = (candidatesTokens / 1_000_000) * tier.outputRatePerMillion;
  const totalCost = inputCost + outputCost;

  return {
    model: tier.name,
    promptTokens,
    candidatesTokens,
    totalTokens: promptTokens + candidatesTokens,
    inputCostUSD: inputCost,
    outputCostUSD: outputCost,
    totalCostUSD: totalCost,
    formatted: {
      totalCostString: `$${totalCost.toFixed(7)}`,
      inputCostString: `$${inputCost.toFixed(7)}`,
      outputCostString: `$${outputCost.toFixed(7)}`,
      costPerThousandTurns: `$${(totalCost * 1000).toFixed(4)}`
    },
    rates: {
      inputPerMillion: `$${tier.inputRatePerMillion}`,
      outputPerMillion: `$${tier.outputRatePerMillion}`
    }
  };
}

module.exports = {
  PRICING_TIERS,
  calculateCost
};
