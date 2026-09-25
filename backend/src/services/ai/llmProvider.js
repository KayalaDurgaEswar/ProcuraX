const config = require('../../config');

class LLMProvider {
  constructor() {
    this.providerType = config.ai.provider;
    this.ollamaUrl = config.ai.ollamaBaseUrl;
    this.model = config.ai.model;
  }

  /**
   * Extracts structured procurement intent from natural language input
   */
  async extractIntent(naturalLanguagePrompt) {
    if (this.providerType === 'ollama') {
      try {
        return await this.extractIntentOllama(naturalLanguagePrompt);
      } catch (err) {
        console.warn(`[LLMProvider] Ollama unavailable (${err.message}). Falling back to rule-enhanced AI parser.`);
        return this.extractIntentFallback(naturalLanguagePrompt);
      }
    }
    return this.extractIntentFallback(naturalLanguagePrompt);
  }

  /**
   * Generates AI reasoning explanation for offer comparison and negotiation strategy
   */
  async analyzeOffersAndReason(request, offers) {
    if (this.providerType === 'ollama') {
      try {
        return await this.analyzeOffersOllama(request, offers);
      } catch (err) {
        console.warn(`[LLMProvider] Ollama reasoning fallback: ${err.message}`);
        return this.analyzeOffersFallback(request, offers);
      }
    }
    return this.analyzeOffersFallback(request, offers);
  }

  // --- OLLAMA IMPLEMENTATION ---
  async extractIntentOllama(promptText) {
    const systemPrompt = `You are an expert procurement intent extraction engine. Parse the user's natural language procurement request into JSON strictly matching this schema:
{
  "category": "laptop | server | phone | furniture | etc",
  "item": "string descriptive name",
  "quantity": number,
  "location": "city/region",
  "budgetINR": number (total budget in INR),
  "currency": "INR",
  "deliveryDeadlineDays": number,
  "requirements": {
    "ram": "string",
    "processor": "string",
    "storage": "string",
    "warranty": "string"
  },
  "constraints": ["array of explicit constraints"],
  "preferences": ["array of preferences"]
}
Return ONLY JSON without markdown fences.`;

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\nUser Request: "${promptText}"\nJSON Output:`,
        stream: false,
        options: { temperature: 0.1 }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    const cleanJsonStr = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  }

  async analyzeOffersOllama(request, offers) {
    const prompt = `Analyze these seller offers for procurement of ${request.quantity} ${request.item} with budget ₹${request.budgetPaise / 100} and delivery deadline ${request.deliveryDeadlineDays} days:
Offers: ${JSON.stringify(offers, null, 2)}

Provide a concise strategic summary detailing:
1. Best overall offer based on cost, delivery time, and compliance.
2. Recommended negotiation angle if any offer exceeds ideal pricing or delivery.
3. Key risk factors for low scoring offers.`;

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  // --- SMART FALLBACK / RULE-ENHANCED AI PARSER ---
  extractIntentFallback(promptText) {
    const text = promptText.toLowerCase();

    // Quantity extraction
    const qtyMatch = text.match(/(\d+)\s*(laptops|units|pcs|pieces|items|servers|monitors|phones|macbooks|desktops)/i) || text.match(/procure\s*(\d+)/i) || text.match(/(\d+)/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 10;

    // Budget extraction (e.g. 5,00,000 or 500000 or 5L or 5 lakh)
    let budgetINR = 500000;
    if (text.includes('₹') || text.includes('rs') || text.includes('inr') || text.includes('budget')) {
      const budgetMatch = text.match(/₹?\s*([\d,]+)/) || text.match(/budget[^\d]*([\d,]+)/i);
      if (budgetMatch) {
        const num = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(num) && num > 1000) budgetINR = num;
      }
      if (text.includes('5,00,000') || text.includes('500000') || text.includes('5 lakh')) budgetINR = 500000;
    }

    // Delivery days extraction
    const deliveryMatch = text.match(/(\d+)\s*days/i) || text.match(/within\s*(\d+)/i);
    const deliveryDeadlineDays = deliveryMatch ? parseInt(deliveryMatch[1], 10) : 7;

    // Location extraction
    let location = 'Hyderabad';
    if (text.includes('bangalore') || text.includes('bengaluru')) location = 'Bengaluru';
    else if (text.includes('mumbai')) location = 'Mumbai';
    else if (text.includes('delhi') || text.includes('gurgaon')) location = 'Delhi NCR';
    else if (text.includes('hyderabad')) location = 'Hyderabad';
    else if (text.includes('chennai')) location = 'Chennai';

    // Specs extraction
    const ramMatch = text.match(/(\d+gb)\s*ram/i) || text.match(/ram\s*(\d+gb)/i);
    const procMatch = text.match(/(i5|i7|i9|m1|m2|m3|ryzen\s*\d)/i);
    const storageMatch = text.match(/(\d+(?:gb|tb))\s*(?:ssd|storage)/i);

    // Category determination
    let category = 'laptop';
    if (text.includes('server')) category = 'server';
    else if (text.includes('monitor') || text.includes('display')) category = 'monitor';
    else if (text.includes('phone') || text.includes('mobile')) category = 'phone';

    return {
      category,
      item: `${category.charAt(0).toUpperCase() + category.slice(1)} Enterprise Batch`,
      quantity,
      location,
      budgetINR,
      currency: 'INR',
      deliveryDeadlineDays,
      requirements: {
        ram: ramMatch ? ramMatch[1].toUpperCase() : '16GB',
        processor: procMatch ? procMatch[1].toUpperCase() : 'Intel Core i7',
        storage: storageMatch ? storageMatch[1].toUpperCase() : '512GB SSD',
        warranty: '3-Year Onsite OEM Warranty'
      },
      constraints: [
        `Delivery to ${location} within ${deliveryDeadlineDays} days`,
        `Total budget not exceeding ₹${budgetINR.toLocaleString('en-IN')}`,
        `Minimum specification: ${ramMatch ? ramMatch[1].toUpperCase() : '16GB RAM'}, ${procMatch ? procMatch[1].toUpperCase() : 'i7 Processor'}`
      ],
      preferences: [
        'Tier-1 OEM preferred (Dell, HP, Lenovo, Apple)',
        'Sellers with compliance rating >= 90%',
        'Bulk discount eligible'
      ]
    };
  }

  analyzeOffersFallback(request, offers) {
    if (!offers || offers.length === 0) return 'No offers were received to analyze.';

    const sorted = [...offers].sort((a, b) => b.score - a.score);
    const topOffer = sorted[0];
    const unitPriceINR = (topOffer.totalPricePaise / 100) / request.quantity;
    const totalBudgetINR = request.budgetPaise / 100;

    return `AI Procurement Strategic Recommendation:
- Top Recommendation: ${topOffer.sellerName} (Score: ${topOffer.score}/100)
- Total Cost: ₹${(topOffer.totalPricePaise / 100).toLocaleString('en-IN')} (₹${unitPriceINR.toLocaleString('en-IN')}/unit vs budget ₹${totalBudgetINR.toLocaleString('en-IN')})
- Estimated Delivery: ${topOffer.deliveryDays} Days (Deadline: ${request.deliveryDeadlineDays} Days)
- Vendor Reputation & Compliance: ${topOffer.sellerRating}/5 Stars, ${topOffer.complianceScore}% Compliance
- Key Advantage: Best balance of competitive pricing, high compliance rating, and fast fulfillment speed.`;
  }
}

module.exports = new LLMProvider();
