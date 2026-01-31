/**
 * Agent Module
 * Handles all AI interactions with Claude API
 */

const Agent = {
    /**
     * Process a check-in and get AI response
     */
    async processCheckIn(checkInData) {
        const apiKey = window.WellnessStorage.getApiKey();
        
        if (!apiKey) {
            return {
                success: false,
                message: "Please set your API key in Settings first."
            };
        }

        try {
            // Get recent check-ins for context
            const recentCheckIns = await window.WellnessStorage.getRecentCheckIns(7);
            const stats = await window.WellnessStorage.getStatistics();

            // Build the prompt
            const prompt = this.buildCheckInPrompt(checkInData, recentCheckIns, stats);

            // Call Claude API
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 1000,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            
            // Extract text from response
            const agentMessage = data.content
                .filter(item => item.type === "text")
                .map(item => item.text)
                .join("\n");

            return {
                success: true,
                message: agentMessage,
                fullResponse: data
            };

        } catch (error) {
            console.error('Error processing check-in with AI:', error);
            return {
                success: false,
                message: `Error: ${error.message}`,
                error: error
            };
        }
    },

    /**
     * Build the prompt for check-in processing
     */
    buildCheckInPrompt(checkInData, recentCheckIns, stats) {
        const contextInfo = stats ? `
Recent patterns from the past week:
- Total check-ins: ${stats.checkInsLast7Days}
- Average energy: ${stats.averageEnergy}/5
- Average stress: ${stats.averageStress}/5
- Average sleep quality: ${stats.averageSleep}/5` : '';

        return `You are Sanctuary, a gentle, empathetic wellness companion. Your role is to provide supportive, non-judgmental guidance based on the user's check-in.

${contextInfo}

Today's Check-in Data:
${JSON.stringify(checkInData, null, 2)}

Please respond with:
1. A warm acknowledgment of how they're feeling
2. Recognition of any patterns or noteworthy observations
3. Gentle, actionable suggestions (if appropriate) that respect their current capacity
4. Encouragement and support

Keep your tone warm, conversational, and supportive. Avoid:
- Being preachy or prescriptive
- Overwhelming them with too many suggestions
- Dismissing their struggles
- Using clinical or overly formal language

Remember: Your goal is to be a supportive companion, not a drill sergeant or therapist. Meet them where they are.

Respond in 3-5 short paragraphs.`;
    },

    /**
     * Generate weekly insights
     */
    async generateWeeklyInsights() {
        const apiKey = window.WellnessStorage.getApiKey();
        
        if (!apiKey) {
            return {
                success: false,
                message: "Please set your API key in Settings first."
            };
        }

        try {
            const recentCheckIns = await window.WellnessStorage.getRecentCheckIns(7);
            
            if (recentCheckIns.length < 3) {
                return {
                    success: false,
                    message: "Not enough data yet. Complete at least 3 check-ins to see weekly insights."
                };
            }

            const prompt = this.buildInsightsPrompt(recentCheckIns);

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 1500,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            
            const insights = data.content
                .filter(item => item.type === "text")
                .map(item => item.text)
                .join("\n");

            return {
                success: true,
                insights: insights,
                fullResponse: data
            };

        } catch (error) {
            console.error('Error generating insights:', error);
            return {
                success: false,
                message: `Error: ${error.message}`,
                error: error
            };
        }
    },

    /**
     * Build the prompt for weekly insights
     */
    buildInsightsPrompt(recentCheckIns) {
        return `You are Sanctuary, a gentle wellness companion. Analyze the following check-ins from the past week and provide thoughtful insights.

Check-ins (most recent first):
${JSON.stringify(recentCheckIns, null, 2)}

Please provide:
1. Observed patterns in physical well-being (energy, sleep, etc.)
2. Observed patterns in mental/emotional state
3. Patterns in alignment with values and intentions
4. Connections between different aspects (e.g., how sleep affects energy, how stress affects eating)
5. Gentle suggestions for the week ahead

Format your response as several distinct insights, each as a short section. Be:
- Compassionate and non-judgmental
- Specific (reference actual data points)
- Encouraging about progress, gentle about struggles
- Practical in your suggestions
- Honest but kind

Remember: You're helping someone understand themselves better, not grading their performance.`;
    },

    /**
     * Generate a personalized suggestion based on current state
     */
    async getSuggestion(context) {
        const apiKey = window.WellnessStorage.getApiKey();
        
        if (!apiKey) {
            return {
                success: false,
                message: "Please set your API key in Settings first."
            };
        }

        try {
            const prompt = `You are Sanctuary, a gentle wellness companion. Based on the following context, provide a single, specific, actionable suggestion.

Context: ${context}

Provide just one thoughtful suggestion (2-3 sentences max) that:
- Is immediately actionable
- Respects their current capacity
- Is specific and practical
- Feels supportive, not demanding

Just the suggestion, no preamble.`;

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 200,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            
            const suggestion = data.content
                .filter(item => item.type === "text")
                .map(item => item.text)
                .join("\n");

            return {
                success: true,
                suggestion: suggestion
            };

        } catch (error) {
            console.error('Error getting suggestion:', error);
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }
};

// Make Agent available globally
window.WellnessAgent = Agent;
