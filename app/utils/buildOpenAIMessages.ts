import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getInitialEvaluationTemplate, getFollowUpVisitTemplate } from "./soapTemplates";

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
  providerName,
  supervisor,
  isInitialEvaluation = false
}: {
  previousSoapNote?: string;
  currentTranscript: string;
  soapTemplate: string; // Additional preferences from settings (appended to hardcoded templates)
  patientName: string;
  providerName: string;
  supervisor?: string | null;
  isInitialEvaluation?: boolean;
}): ChatCompletionMessageParam[] => {
  console.log('======= BUILDING STRUCTURED MESSAGES =======');
  console.log(`Previous note provided: ${!!previousSoapNote}`);
  console.log(`Current transcript length: ${currentTranscript.length} chars`);
  console.log(`Visit type: ${isInitialEvaluation ? 'Initial Evaluation' : 'Follow-up Visit'}`);
  console.log(`Provider name: ${providerName}`);
  console.log(`Supervisor: ${supervisor || 'None'}`);
  console.log(`Additional preferences length: ${soapTemplate?.length || 0} chars`);

  // Append ", PMHNP" to provider name if it doesn't already contain it
  const formattedProviderName = providerName.includes('PMHNP') 
    ? providerName 
    : `${providerName}, PMHNP`;

  // Select the appropriate hardcoded template based on visit type, provider name, and supervisor
  const hardcodedTemplate = isInitialEvaluation
    ? getInitialEvaluationTemplate(formattedProviderName, supervisor)
    : getFollowUpVisitTemplate(formattedProviderName, supervisor);
    
  console.log(`Using hardcoded template: ${isInitialEvaluation ? 'Initial Evaluation' : 'Follow-up Visit'} (${hardcodedTemplate.length} chars)`);
  console.log(`Additional preferences: ${soapTemplate ? 'Yes' : 'None'}`);

  // Create system message with clinical focus
  const systemMessage = {
    role: "system" as const,
    content: `You are an expert AI medical scribe specializing in psychiatry. You will receive two types of input:
1. The SOAP note from the patient's **previous visit** for clinical context
2. The **transcript from the current visit**, which should be used to generate today's SOAP note

Use the previous note only for background understanding. Do **not** copy or reuse information unless it was re-discussed or confirmed today.

Prioritize clarity, medical accuracy, and professional language. If new diagnoses or medications are discussed today, add them with the label "**added today**".

IMPORTANT: The patient's name is "${patientName}". Always use this exact name throughout the note, regardless of any other names mentioned in the transcript.

**CRITICAL FORMATTING RULES: 
1. NEVER break lines before colons - Always format as "Label: Content" on the same line, not "Label\\n: Content"
2. For telehealth details, write "**Mode of Communication**: Content" NOT "**Mode of Communication**\\n: Content" 
3. Keep all label-colon combinations on single lines without line breaks**

Follow this format strictly:

${hardcodedTemplate}

${soapTemplate ? `\n\nADDITIONAL PROVIDER PREFERENCES:\n${soapTemplate}` : ''}`
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
