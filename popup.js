// popup.js
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Load saved API key
chrome.storage.local.get(["groqApiKey"], (res) => {
  if (res.groqApiKey) document.getElementById("api-key").value = res.groqApiKey;
});

document.getElementById("search-btn").addEventListener("click", async () => {
  const apiKey = document.getElementById("api-key").value.trim();
  const query = document.getElementById("query").value.trim();
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");

  if (!apiKey) return (statusEl.textContent = "⚠️ Please enter your Groq API key.");
  if (!query) return (statusEl.textContent = "⚠️ Please describe what you're looking for.");

  // Save API key for convenience
  chrome.storage.local.set({ groqApiKey: apiKey });

  statusEl.textContent = "⏳ Scanning page...";
  resultEl.style.display = "none";

  // Step 1: Scrape the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "scrape" }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      statusEl.textContent = "❌ Could not read page. Try refreshing.";
      return;
    }

    const { elements, pageTitle, pageUrl } = response;

    // Limit elements to avoid token overflow (top 80)
    const topElements = elements.slice(0, 80);
    const elementsText = topElements
      .map((el, i) => `[${i}] (${el.type}) "${el.text}"${el.href ? " → " + el.href : ""}`)
      .join("\n");

    const systemPrompt = `You are a helpful assistant embedded in a Chrome extension. 
The user is on a webpage and needs help finding something. 
You are given a list of page elements (links, buttons, headings) scraped from the page.
Your job: given the user's goal, identify the BEST matching element and respond with:
1. A brief explanation (1-2 sentences) of what you found
2. The direct URL (if it's a link) on its own line prefixed with "URL:"
3. If no direct link exists, describe where/how to find it on the page.
Be concise and helpful.`;

    const userMessage = `Page: "${pageTitle}" (${pageUrl})

User is looking for: "${query}"

Page elements:
${elementsText}`;

    statusEl.textContent = "🤖 Asking AI...";

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        statusEl.textContent = `❌ Groq error: ${err.error?.message || res.status}`;
        return;
      }

      const data = await res.json();
      const aiText = data.choices[0].message.content.trim();

      // Parse out URL if present
      const urlMatch = aiText.match(/URL:\s*(https?:\/\/[^\s]+)/i);
      let displayHtml = aiText.replace(/URL:\s*(https?:\/\/[^\s]+)/gi, "");

      if (urlMatch) {
        displayHtml += `<br/><br/>🔗 <a href="${urlMatch[1]}" target="_blank">Open: ${urlMatch[1]}</a>`;
      }

      resultEl.innerHTML = displayHtml;
      resultEl.style.display = "block";
      statusEl.textContent = "✅ Done!";
    } catch (e) {
      statusEl.textContent = `❌ Network error: ${e.message}`;
    }
  });
});
