"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const openai_1 = __importDefault(require("openai"));
const prisma = new client_1.PrismaClient();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
async function generateSummary(content) {
    const summaryPrompt = {
        model: 'gpt-3.5-turbo',
        messages: [
            {
                role: 'system',
                content: 'You are a medical note summarizer. Create a one-line summary (max 100 characters) of the key points from this medical note. Focus on the main diagnosis, treatment, or changes.',
            },
            {
                role: 'user',
                content,
            },
        ],
        temperature: 0.3,
        max_tokens: 100,
    };
    const completion = await openai.chat.completions.create(summaryPrompt);
    return completion.choices[0]?.message?.content || 'Visit summary not available';
}
async function main() {
    try {
        // Get all notes that don't have a summary or have an empty summary
        const notes = await prisma.note.findMany({
            where: {
                OR: [
                    { summary: null },
                    { summary: '' }
                ]
            }
        });
        console.log(`Found ${notes.length} notes without summaries`);
        // Process notes in sequence to avoid rate limits
        for (const note of notes) {
            try {
                console.log(`Processing note ${note.id}...`);
                const summary = await generateSummary(note.content);
                await prisma.note.update({
                    where: { id: note.id },
                    data: {
                        summary: summary
                    }
                });
                console.log(`✓ Generated summary for note ${note.id}`);
                // Add a small delay to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                console.error(`Failed to process note ${note.id}:`, error);
            }
        }
        console.log('Finished generating summaries');
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the script
main();
