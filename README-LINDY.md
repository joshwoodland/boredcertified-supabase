# Lindy-like Medical Assistant

A web application that integrates with OpenAI's API to provide Lindy-like medical assistant functionality for psychiatric evaluations.

## Features

- **System Message Presets**:
  - Initial Evaluation preset
  - Follow-Up Visit preset
  
- **Visit Type Selection**:
  - Choose between "Initial Evaluation" or "Follow-Up Visit"
  
- **Model Selection**:
  - GPT-4o
  - GPT-4o-mini
  - o1 (Claude 3 Opus)
  
- **AI Response Generation**:
  - Submit patient transcripts
  - Get AI-generated analysis in SOAP format
  
- **Settings Panel**:
  - Customize system messages for each visit type

## Setup

1. Make sure you have Node.js and npm installed

2. Add your OpenAI API key to the `.env` file in the project root:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Run the development server:
   ```
   npm run dev
   ```

5. Access the application:
   - Main application: http://localhost:3000/lindy
   - Test version: http://localhost:3000/test-lindy

## Project Structure

- `app/components/OpenAIChat.tsx` - Main chat component
- `app/components/LindySettings.tsx` - Settings modal component
- `app/api/openai/route.ts` - Secure API endpoint for OpenAI
- `app/test-lindy/page.tsx` - Simplified test page
- `app/lindy/page.tsx` - Main application page
- `app/config/` - System message configurations

## Usage Instructions

1. **Access the application** at `/test-lindy` or `/lindy`

2. **Choose visit type** from the dropdown:
   - Initial Evaluation - For first-time patient visits
   - Follow-Up Visit - For returning patients

3. **Select the AI model** to use:
   - GPT-4o - Latest model with best quality
   - GPT-4o-mini - Faster, more economical option
   - o1 - Claude 3 Opus for alternative outputs

4. **Enter patient transcript** in the text area

5. **Click "Generate Analysis"** to submit and get AI response

6. **Configure system messages** (optional):
   - Click "Show Settings" to access preset configurations
   - Modify the template messages as needed
   - Changes are stored in browser for future use

## Security Considerations

- API key is stored as an environment variable
- All API calls are made server-side for security
- No client-side exposure of your OpenAI API key

## Customization

You can customize the system messages by:

1. Clicking "Show Settings" button
2. Editing the templates in the text areas
3. Making sure to maintain proper formatting guidelines for best results

## Troubleshooting

- **API Key Issues**: Ensure your OpenAI API key is correctly set in the `.env` file
- **Model Errors**: Verify you have access to the selected model in your OpenAI account
- **Rate Limiting**: If you experience rate limiting, try using a different model or waiting before retry

## License

This project is for demo purposes and not licensed for production use. 