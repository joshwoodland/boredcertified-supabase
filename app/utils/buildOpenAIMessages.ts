import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getSoapTemplate } from "./masterSettings";

/**
 * Builds a structured array of messages for OpenAI API requests
 * using a more clinically focused approach with separate messages
 * for previous notes and current transcript.
 *
 * @param params Configuration parameters
 * @returns Array of messages for OpenAI chat completion
 */
export const buildOpenAIMessages = async ({
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
}): Promise<ChatCompletionMessageParam[]> => {
  console.log('======= BUILDING STRUCTURED MESSAGES =======');
  console.log(`Previous note provided: ${!!previousSoapNote}`);
  console.log(`Current transcript length: ${currentTranscript.length} chars`);
  console.log(`Visit type: ${isInitialEvaluation ? 'Initial Evaluation' : 'Follow-up Visit'}`);
  console.log(`Patient name: ${patientName}`);
  console.log(`User template length: ${soapTemplate.length} chars`);

  // Get the appropriate hardcoded template from master settings
  const baseTemplate = await getSoapTemplate(isInitialEvaluation);
  console.log(`Base template length: ${baseTemplate.length} chars`);

  // Combine the hardcoded base template with user preferences
  const systemMessage = `${baseTemplate}\n\n--- USER PREFERENCES ---\n${soapTemplate}`;

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemMessage
    }
  ];

  // Add previous note context if available (for follow-up visits)
  if (previousSoapNote && !isInitialEvaluation) {
    console.log(`Adding previous note context (${previousSoapNote.length} chars)`);
    messages.push({
      role: 'user',
      content: `PREVIOUS SOAP NOTE FOR CONTEXT:\n\n${previousSoapNote}\n\n---END OF PREVIOUS NOTE---`
    });
  }

  // Add the current transcript
  messages.push({
    role: 'user',
    content: `CURRENT VISIT TRANSCRIPT FOR ${patientName}:\n\n${currentTranscript}`
  });

  console.log(`Total messages created: ${messages.length}`);
  console.log('======= END MESSAGE BUILDING =======');

  return messages;
};
