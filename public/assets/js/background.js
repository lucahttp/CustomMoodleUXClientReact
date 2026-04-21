// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SYNC_GOOGLE_SLIDES") {
        console.log("[Background] Iniciando Sync Google Slides para:", request.url);
        
        // 1. Create a new background tab
        chrome.tabs.create({ url: request.url, active: false }, async (tab) => {
            const tabId = tab.id;
            let extractedSlides = [];
            
            // Wait for the slide text extractor to signal it's done via another message
            const extractorListener = (msg, evSender, internalSendResponse) => {
                if (evSender.tab && evSender.tab.id === tabId) {
                    if (msg.type === "SLIDES_EXTRACTED") {
                         extractedSlides = msg.data;
                         console.log(`[Background] Extracted ${extractedSlides.length} slides!`);
                         // Return results to the original React Moodle tab
                         sendResponse({ success: true, slides: extractedSlides });
                         
                         // Clean up
                         chrome.tabs.remove(tabId);
                         chrome.runtime.onMessage.removeListener(extractorListener);
                    } else if (msg.type === "SLIDES_ERROR") {
                         sendResponse({ success: false, error: msg.error });
                         chrome.tabs.remove(tabId);
                         chrome.runtime.onMessage.removeListener(extractorListener);
                    }
                }
            };
            
            chrome.runtime.onMessage.addListener(extractorListener);

            // Wait a few seconds for the document to fully load in the hidden tab
            setTimeout(() => {
                // Send the kick-off trigger to the content script
                chrome.tabs.sendMessage(tabId, { type: "getText" });
            }, 5000);
        });

        // Indicate async response
        return true; 
    }
});
