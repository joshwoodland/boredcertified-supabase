import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INITIAL_EVALUATION_TEMPLATE, FOLLOW_UP_VISIT_TEMPLATE } from "./soapTemplates";

/**
 * Builds a structured array of messages for OpenAI API requests
 * using a more clinically focused approach with separate messages
 * for previous notes and current transcript.
 *
 * @param params Configuration parameters
 * @returns Array of messages for OpenAI chat completion
 */
export const buildOpenAIMessages = ({
  previousSoapNote,
  currentTranscript,
  soapTemplate,
  patientName,
  isInitialEvaluation = false
}: {
  previousSoapNote?: string;
  currentTranscript: string;
  soapTemplate: string; // User preferences from settings
  patientName: string;
  isInitialEvaluation?: boolean;
}): ChatCompletionMessageParam[] => {
  console.log('======= BUILDING STRUCTURED MESSAGES =======');
  console.log(`Previous note provided: ${!!previousSoapNote}`);
  console.log(`Current transcript length: ${currentTranscript.length} chars`);
  console.log(`Visit type: ${isInitialEvaluation ? 'Initial Evaluation' : 'Follow-up Visit'}`);

  // Select the appropriate hardcoded template based on visit type
  const hardcodedTemplate = isInitialEvaluation
    ? INITIAL_EVALUATION_TEMPLATE
    : FOLLOW_UP_VISIT_TEMPLATE;

  // Create system message with clinical focus
  const systemMessage = {
    role: "system" as const,
    content: `You are an expert AI medical scribe specializing in psychiatry. You will receive two types of input:
1. The SOAP note from the patient's **previous visit** for clinical context
2. The **transcript from the current visit**, which should be used to generate today's SOAP note

Use the previous note only for background understanding. Do **not** copy or reuse information unless it was re-discussed or confirmed today.

Prioritize clarity, medical accuracy, and professional language. If new diagnoses or medications are discussed today, add them with the label "**added today**".

IMPORTANT: The patient's name is "${patientName}". Always use this exact name throughout the note, regardless of any other names mentioned in the transcript.

FORMATTING INSTRUCTIONS:
- Use clean section headers like "Subjective", "Objective", "Assessment", "Plan" without any prefixes
- Do NOT use "S-", "O-", "A-", "P-" prefixes before section headers
- Use proper markdown formatting with ## for main sections
- Keep section headers simple and consistent

Follow this format strictly:

${hardcodedTemplate}

Additional provider preferences:
${soapTemplate}`
  };

  // Create the messages array
  const messages: ChatCompletionMessageParam[] = [systemMessage];

  // Add previous SOAP note if provided
  if (previousSoapNote) {
    messages.push({
      role: "user" as const,
      content: `Here is the SOAP note from the **previous visit**, to give you clinical context for today's session:\n\n${previousSoapNote}`
    });
  }

  // Add current transcript
  messages.push({
    role: "user" as const,
    content: `Here is the **transcript from the current visit**. Use this to generate the SOAP note for today:\n\n${currentTranscript}`
  });

  // Log message structure for debugging
  console.log('Message structure:');
  messages.forEach((msg, index) => {
    const content = typeof msg.content === 'string'
      ? msg.content.substring(0, 50) + '...'
      : '[Complex content structure]';
    console.log(`[${index}] ${msg.role}: ${content}`);
  });
  console.log('======= END OF STRUCTURED MESSAGES =======');

  return messages;
};
