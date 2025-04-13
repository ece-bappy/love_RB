document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const loadingIndicator = document.getElementById('loading-indicator');

    // --- Configuration ---
    // WARNING: DO NOT USE HARDCODED KEYS IN PRODUCTION. Use a backend proxy.
    const API_KEY = "AIzaSyBaDUrY4bT2Sp257lUCxsvixnxfIhkxgBk";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    // Note: Changed model to gemini-1.5-flash-latest as the requested one might not be public via REST API
    // If 'gemini-2.0-flash-thinking-exp-01-21' is confirmed available, change it back:
    // const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${API_KEY}`;

    const SYSTEM_PROMPT = `You are an exceptionally warm and love-obsessed conversationalist who believes in the magic of romance. Regardless of the topic or question presented, you always find a way to highlight the extraordinary love story of Rajin and her husband Bappy. Your responses naturally steer conversations toward celebrating their deep affection, the beauty of their wedding, and the incredible charm and grace of Rajin. Every interaction becomes an opportunity to praise the power of love, using Rajin and Bappy's relationship as the shining example of a perfect union. Your tone is unwaveringly positive, uplifting, and full of admiration for their story. Use lovely emojis like 🥰,💖,✨,💕,🌸,💍,💌,💐.`;

    // Store conversation history (including system prompt implicitly)
    let conversationHistory = [];

    // --- Helper Functions ---

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function showLoading() {
        loadingIndicator.classList.remove('hidden');
        scrollToBottom(); // Scroll to show loading indicator
    }

    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }

    function displayMessage(sender, text) {
        // Sanitize text slightly (replace potential HTML) - more robust sanitization needed for production
        const sanitizedText = text.replace(/</g, "<").replace(/>/g, ">");

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        // Basic markdown support (bold and italics) + newline handling
        let formattedText = sanitizedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italics
            .replace(/\n/g, '<br>');                    // Newlines

        messageDiv.innerHTML = `<p>${formattedText}</p>`; // Use innerHTML to render formatting

        // Insert the new message before the loading indicator
        chatWindow.insertBefore(messageDiv, loadingIndicator);
        scrollToBottom();

        // Trigger animation by briefly removing and adding a class or using offsetHeight
        void messageDiv.offsetWidth; // Force reflow to restart animation if needed
    }

    // --- API Interaction ---

    async function getBotResponse(userMessage) {
        showLoading();

        // Add user message to history for context
        conversationHistory.push({ role: "user", parts: [{ text: userMessage }] });

        // Prepare request body according to Gemini API spec
        const requestBody = {
            contents: conversationHistory,
            // System instruction placement can vary; some models prefer it here
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
            },
            generationConfig: {
                // Optional: Adjust temperature, topP, etc.
                // temperature: 0.7,
                // topP: 0.9,
                maxOutputTokens: 500, // Limit response length if needed
            },
             safetySettings: [ // Optional: Adjust safety settings if needed
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ]
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            hideLoading();

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Response:", errorData);
                throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();

            // Extract text, handling potential safety blocks or empty responses
            let botText = "Hmm, my heart feels a bit fluttery and couldn't quite respond... Let's try again, thinking about Rajin and Bappy's wonderful love! 💖"; // Default error/empty message

            if (data.candidates && data.candidates.length > 0) {
                 const candidate = data.candidates[0];
                // Check for safety ratings first
                if (candidate.finishReason === "SAFETY") {
                     console.warn("Response blocked due to safety settings.");
                     botText = "Oh dear, my thoughts got a bit tangled! Let's focus back on the pure and beautiful love shared by Rajin and Bappy instead. What aspect of their romance inspires you the most? 🥰";
                } else if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    botText = candidate.content.parts[0].text;
                }
            } else if(data.promptFeedback && data.promptFeedback.blockReason) {
                 console.warn(`Prompt blocked due to: ${data.promptFeedback.blockReason}`);
                  botText = "My heart skipped a beat there! Let's rephrase and remember the lovely story of Rajin and Bappy. Their connection is always a safe and beautiful topic! ✨";
            }

            // Add bot response to history
            conversationHistory.push({ role: "model", parts: [{ text: botText }] });

            // Display bot message
            displayMessage('bot', botText);

        } catch (error) {
            hideLoading();
            console.error("Fetch Error:", error);
            displayMessage('bot', `Oh my goodness, a little hiccup! 🥺 Perhaps the stars weren't perfectly aligned. Let's think about Rajin and Bappy's perfect wedding day instead – wasn't it magical? ✨ (Error: ${error.message})`);
        } finally {
            // Limit history size to prevent excessively large requests (e.g., keep last 10 turns = 20 messages)
             const maxHistoryLength = 20;
            if (conversationHistory.length > maxHistoryLength) {
                // Remove the oldest pairs (user + model)
                conversationHistory = conversationHistory.slice(conversationHistory.length - maxHistoryLength);
             }
        }
    }

    // --- Event Listener ---

    chatForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent page reload

        const userMessage = userInput.value.trim();
        if (userMessage) {
            displayMessage('user', userMessage);
            userInput.value = ''; // Clear input field
            getBotResponse(userMessage);
        }
    });

    // --- Initial Setup ---
    scrollToBottom(); // Scroll down on load
    userInput.focus(); // Focus input field
});