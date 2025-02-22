import { systemMessage as initialVisitPrompt } from './initialVisitPrompt';
import { systemMessage as followUpVisitPrompt } from './followUpVisitPrompt';

const systemMessages = {
  initialVisit: initialVisitPrompt.content,
  followUpVisit: followUpVisitPrompt.content
};

export default systemMessages;