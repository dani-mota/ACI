import { AI_CONFIG } from "./config";

const FALLBACK_ACKNOWLEDGMENTS = [
  "Let me build on what you've shared.",
  "That's an interesting approach.",
  "I hear what you're saying.",
  "Good, let me continue with that in mind.",
];

/**
 * Generate a single personalized acknowledgment sentence (~200ms).
 * References something specific the candidate said without evaluating correctness.
 * Used to bridge pre-generated content with a human-feeling response.
 */
export async function generateAcknowledgment(
  candidateInput: string,
  beatType: string,
  constructs: string[],
  scenarioName?: string,
  lastAriaMessage?: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return FALLBACK_ACKNOWLEDGMENTS[Math.floor(Math.random() * FALLBACK_ACKNOWLEDGMENTS.length)];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_CONFIG.realtimeModel,
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Generate ONE sentence (max 20 words) that naturally bridges from the candidate's response to the next part of the assessment. This sentence should:
- Reference something specific the candidate said
- Feel like a natural conversational transition
- NOT evaluate correctness or quality
- NOT say "great", "good answer", "excellent", or similar praise
- NOT ask a question

Context:
Scenario: ${scenarioName ?? "workplace scenario"}
Beat type: ${beatType}
${lastAriaMessage ? `Last thing Aria said: "${lastAriaMessage.slice(0, 300)}"` : ""}
Candidate said: "${candidateInput.slice(0, 500)}"

Examples of good acknowledgments:
- "That perspective on the stakeholder dynamics is worth exploring further."
- "I can see how the timeline pressure shaped your thinking there."
- "The way you weighed those trade-offs tells me a lot."

Reply with ONLY the acknowledgment sentence, nothing else.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return FALLBACK_ACKNOWLEDGMENTS[Math.floor(Math.random() * FALLBACK_ACKNOWLEDGMENTS.length)];
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "").trim();

    // Validate: should be a single sentence, reasonable length
    if (text.length > 0 && text.length < 200) {
      return text;
    }

    return FALLBACK_ACKNOWLEDGMENTS[Math.floor(Math.random() * FALLBACK_ACKNOWLEDGMENTS.length)];
  } catch {
    return FALLBACK_ACKNOWLEDGMENTS[Math.floor(Math.random() * FALLBACK_ACKNOWLEDGMENTS.length)];
  } finally {
    clearTimeout(timeoutId);
  }
}
