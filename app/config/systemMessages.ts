import { systemMessage as initialVisitPrompt } from './initialVisitPrompt';
import { systemMessage as followUpVisitPrompt } from './followUpVisitPrompt';

export default {
  initialVisit: initialVisitPrompt.content,
  followUpVisit: followUpVisitPrompt.content
}