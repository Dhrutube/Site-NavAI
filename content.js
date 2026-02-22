// content.js
function scrapePageElements() {
    const elements = [];
  
    // Scrape all anchor links
    document.querySelectorAll("a[href]").forEach((el) => {
      const text = el.innerText.trim();
      const href = el.href;
      if (text && href) {
        elements.push({ type: "link", text, href });
      }
    });
  
    // Scrape buttons
    document.querySelectorAll("button, input[type='submit'], input[type='button']").forEach((el) => {
      const text = (el.innerText || el.value || "").trim();
      if (text) {
        elements.push({ type: "button", text, id: el.id || "", className: el.className || "" });
      }
    });
  
    // Scrape headings and nav items for context
    document.querySelectorAll("h1, h2, h3, nav a, [role='navigation'] a").forEach((el) => {
      const text = el.innerText.trim();
      const href = el.href || "";
      if (text) {
        elements.push({ type: "heading/nav", text, href });
      }
    });
  
    return elements;
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape") {
      const elements = scrapePageElements();
      sendResponse({ elements, pageTitle: document.title, pageUrl: window.location.href });
    }
    return true; // Keep channel open for async
  });
  