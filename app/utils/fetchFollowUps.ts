'use client';

/**
 * Represents a single item in the follow-up checklist
 */
export interface FollowUpItem {
  id: string;
  text: string;
  category: string;
  keywords: string[]; // Keywords for fuzzy matching
  points: number;     // Current points accumulated
  threshold: number;  // Points needed for "fully discussed" status
}

/**
 * Fetches structured follow-up items from the last visit note using OpenAI API
 * @param lastVisitNote - The content of the patient's last visit note
 * @returns Array of structured discussion points for the current visit
 */
export async function fetchFollowUps(lastVisitNote: string): Promise<FollowUpItem[]> {
  try {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a psychiatric medical scribe assistant. Read the following visit note and extract information that should be followed up on during the next visit.

PURPOSE: During follow-up psychiatric visits, providers need to address specific topics from the previous session. The system helps by presenting a checklist of topics that need to be discussed. As the provider and patient converse during the follow-up session, the system listens to their conversation in real-time and automatically checks off topics when they are adequately addressed, without requiring manual input from the provider.

For this automation to work effectively, each follow-up item needs a set of KEYWORDS that, when detected in the provider-patient conversation, indicate that the topic has been sufficiently discussed. These keywords should be specific enough to accurately identify when a topic is being addressed, but broad enough to catch various ways the topic might be discussed in natural conversation.

FORMAT your response exactly as follows:

Clinical Expertise:
Potential Drug Interactions:
[Analyze the list of medications in the SOAP note and identify any potential drug interactions. Format as a list including: medications involved, severity (mild, moderate, severe), and a brief note about the interaction.]

Expert Tip:
[Review the Plan section of the SOAP note and provide a forward-looking clinical suggestion in the format: "If the patient does not show improvement in these target symptoms or treatment goals, consider the following next steps..." Include potential dosage changes, alternative medication options, or therapy/diagnostic considerations if relevant. Keep to 1-2 sentences per suggestion.]

Medication Changes: 
[summary of medication changes from the last visit]
KEYWORDS: [specific medication names, dosages, words like "prescribed", "discontinued", "side effects", "how's the medication working", "any issues with", etc.]

List the Diagnoses from the last visit:
Diagnosis #1: [diagnosis text]
KEYWORDS: [diagnostic terms, symptoms, related clinical terminology, phrases a provider might use to discuss this diagnosis]

Diagnosis #2 (if any): [diagnosis text]
KEYWORDS: [diagnostic terms, symptoms, related clinical terminology]

Diagnosis #3 (if any): [diagnosis text]
KEYWORDS: [diagnostic terms, symptoms, related clinical terminology]

Diagnosis #4 (if any): [diagnosis text]
KEYWORDS: [diagnostic terms, symptoms, related clinical terminology]

Sleep: 
[summary of sleep information from the last visit]
KEYWORDS: [sleep-related terms, symptoms, improvements, issues, phrases like "how are you sleeping", "any trouble falling asleep"]

Exercise: 
[summary of exercise information from the last visit]
KEYWORDS: [exercise-related terms, activities, frequency words, phrases like "been able to exercise", "physical activity"]

Appetite and Diet: 
[summary of appetite/diet information from the last visit]
KEYWORDS: [diet-related terms, appetite descriptors, weight terms, phrases like "how's your appetite", "any changes in eating"]

Substance Use: 
[summary of substance use information from the last visit]
KEYWORDS: [substance names, usage patterns, abstinence terms, phrases like "still using", "cut back on"]

List any important information that was discussed in the last visit that is not already included in the points above (sleep, exercise, appetite/diet, substance use). List UP TO 3 points:

Important Point #1: [important information point]
KEYWORDS: [specific terms related to this point, ways a provider might ask about this topic]

Important Point #2 (if any): [important information point]
KEYWORDS: [specific terms related to this point]

Important Point #3 (if any): [important information point]  
KEYWORDS: [specific terms related to this point]

Note: The KEYWORDS you provide will be used by the system to automatically detect when these topics are discussed in the provider-patient conversation. They will not be shown to users but will serve as triggers to mark topics as addressed during the session.`
          },
          {
            role: "user",
            content: lastVisitNote
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error("Failed to fetch follow-up items");
    }

    const data = await response.json();
    const content = data.content || "";
    
    // Parse the structured content
    const items: FollowUpItem[] = [];
    const sections = [
      { key: 'medications', title: 'Medication Changes:', emoji: '💊' },
      { key: 'diagnoses', title: 'List the Diagnoses from the last visit:', emoji: '🏥' },
      { key: 'sleep', title: 'Sleep:', emoji: '😴' },
      { key: 'exercise', title: 'Exercise:', emoji: '🏃‍♂️' },
      { key: 'diet', title: 'Appetite and Diet:', emoji: '🍽️' },
      { key: 'substances', title: 'Substance Use:', emoji: '🍷' },
      { key: 'important', title: 'List any important information', emoji: 'ℹ️' }
    ];
    
/**
 * Helper function to extract keywords from text based on category
 * Enhanced to include word variations, common synonyms, and better filtering
 */
function extractKeywords(text: string, category: string): string[] {
  let keywords: string[] = [];
  
  // Add the category name itself as a keyword for category-level matching
  keywords.push(category.toLowerCase());
  
  // Common word variations mapping (stems/lemmas to include different forms)
  const wordVariations: Record<string, string[]> = {
    'medication': ['med', 'meds', 'medicate', 'medicating', 'medicated'],
    'exercise': ['exercising', 'exercised', 'exercises', 'workout', 'working out', 'worked out'],
    'sleep': ['sleeping', 'slept', 'sleeps'],
    'eat': ['eating', 'ate', 'eats'],
    'drink': ['drinking', 'drank', 'drinks'],
    'anxiety': ['anxious', 'anxiety disorder', 'gad', 'panic', 'worried', 'worrying'],
    'depression': ['depressed', 'depressive', 'major depressive disorder', 'mdd'],
    'substance': ['substances', 'drug', 'drugs'],
    'appetite': ['hungry', 'hunger', 'fullness', 'satiety'],
    'physical': ['physically', 'fitness'],
    'fatigue': ['fatigued', 'exhausted', 'exhaustion', 'tired', 'tiredness'],
    'weight': ['weights', 'weighing', 'weighed', 'pounds', 'lbs', 'kg'],
    'insomnia': ['insomniac', 'trouble sleeping', 'difficulty sleeping', 'can\'t sleep', 'hard to sleep']
  };
  
  if (category === 'medications') {
    // Extract medication names - look for capitalized words that might be medication names
    const medRegex = /\b[A-Z][a-z]+\b/g;
    const possibleMeds = text.match(medRegex) || [];
    keywords.push(...possibleMeds.map(med => med.toLowerCase()));
    
    // Add common medication-related terms and their variations
    const medTerms = ['medication', 'prescription', 'dose', 'dosage', 'mg', 'pill', 'tablet', 'capsule', 'refill'];
    keywords.push(...medTerms);
    
    // Add variations for medication terms
    medTerms.forEach(term => {
      if (wordVariations[term]) {
        keywords.push(...wordVariations[term]);
      }
    });
    
    // Add common psychiatric medications by class
    const commonMeds = [
      // SSRIs
      'prozac', 'fluoxetine', 'zoloft', 'sertraline', 'lexapro', 'escitalopram', 'celexa', 'citalopram', 'paxil', 'paroxetine',
      // SNRIs
      'effexor', 'venlafaxine', 'cymbalta', 'duloxetine', 'pristiq', 'desvenlafaxine',
      // Antipsychotics
      'abilify', 'aripiprazole', 'risperdal', 'risperidone', 'seroquel', 'quetiapine', 'zyprexa', 'olanzapine',
      'latuda', 'lurasidone', 'geodon', 'ziprasidone', 'haldol', 'haloperidol',
      // Mood stabilizers
      'lithium', 'depakote', 'valproate', 'lamictal', 'lamotrigine', 'tegretol', 'carbamazepine',
      // Anxiolytics
      'xanax', 'alprazolam', 'klonopin', 'clonazepam', 'ativan', 'lorazepam', 'valium', 'diazepam',
      // Stimulants
      'adderall', 'amphetamine', 'ritalin', 'methylphenidate', 'concerta', 'vyvanse', 'lisdexamfetamine',
      // Sleep aids
      'ambien', 'zolpidem', 'lunesta', 'eszopiclone', 'trazodone', 'remeron', 'mirtazapine'
    ];
    keywords.push(...commonMeds);
  }
  else if (category === 'diagnoses') {
    // For diagnoses, extract shorthand versions and key terms with enhanced mappings
    const diagnosisMap: Record<string, string[]> = {
      'anxiety': ['anxious', 'anxiety disorder', 'generalized anxiety', 'gad', 'panic disorder', 'panic attack', 'social anxiety'],
      'depression': ['depressed', 'depressive', 'major depressive disorder', 'mdd', 'mood disorder', 'low mood', 'feeling down'],
      'adhd': ['attention deficit', 'hyperactive', 'hyperactivity', 'inattentive', 'inattention', 'attention deficit hyperactivity disorder'],
      'bipolar': ['bipolar disorder', 'manic', 'mania', 'hypomania', 'bipolar i', 'bipolar ii', 'mood cycling'],
      'schizophrenia': ['schizo', 'schizoaffective', 'psychosis', 'psychotic', 'delusion', 'hallucination'],
      'ocd': ['obsessive compulsive', 'obsession', 'compulsion', 'intrusive thoughts'],
      'ptsd': ['post traumatic', 'trauma', 'traumatic', 'flashback', 'nightmares related to trauma'],
      'eating disorder': ['anorexia', 'bulimia', 'binge eating', 'purging', 'restrictive eating'],
      'insomnia': ['sleep disorder', 'difficulty falling asleep', 'early awakening', 'sleep disturbance'],
      'substance use disorder': ['sud', 'addiction', 'substance abuse', 'chemical dependency'],
      'personality disorder': ['borderline', 'bpd', 'narcissistic', 'npd', 'avoidant', 'dependent']
    };
    
    // Check text for each diagnosis and add all related terms
    Object.entries(diagnosisMap).forEach(([key, variants]) => {
      if (text.toLowerCase().includes(key) || 
          variants.some(variant => text.toLowerCase().includes(variant))) {
        // Add the key term and all its variants
        keywords.push(key);
        keywords.push(...variants);
      }
    });
    
    // Extract any ICD codes
    const icdRegex = /[A-Z][0-9]{2}\.[0-9]/g;
    const icdCodes = text.match(icdRegex) || [];
    keywords.push(...icdCodes);
  } 
  else if (category === 'sleep') {
    const sleepTerms = [
      'sleep', 'insomnia', 'fatigue', 'tired', 'rest', 'rested', 'restful', 
      'nightmare', 'dream', 'nap', 'doze', 'waking up', 'middle of the night', 
      'early awakening', 'sleeping', 'slept', 'sleeps', 'rem', 'deep sleep',
      'sleep quality', 'bedtime', 'morning', 'night', 'drowsy', 'sedated',
      'sleep schedule', 'hours of sleep', 'sleep pattern'
    ];
    keywords.push(...sleepTerms);
    
    // Add variants
    sleepTerms.forEach(term => {
      if (wordVariations[term]) {
        keywords.push(...wordVariations[term]);
      }
    });
  }
  else if (category === 'exercise') {
    const exerciseTerms = [
      'exercise', 'physical', 'activity', 'workout', 'walk', 'run', 'gym', 
      'jog', 'swimming', 'cycle', 'bicycle', 'bike', 'strength', 'cardio', 
      'training', 'fitness', 'stretching', 'yoga', 'pilates', 'sports',
      'active', 'sedentary', 'movement', 'exertion', 'working out', 'exercising'
    ];
    keywords.push(...exerciseTerms);
    
    // Add variants
    exerciseTerms.forEach(term => {
      if (wordVariations[term]) {
        keywords.push(...wordVariations[term]);
      }
    });
  }
  else if (category === 'diet') {
    const dietTerms = [
      'diet', 'appetite', 'eat', 'food', 'meal', 'nutrition', 'weight',
      'hungry', 'hunger', 'full', 'snack', 'breakfast', 'lunch', 'dinner',
      'calorie', 'portion', 'eating habit', 'cooking', 'groceries',
      'protein', 'carbohydrate', 'fat', 'sugar', 'nutritious', 'junk food',
      'fast food', 'dining out', 'restaurant', 'water', 'hydration'
    ];
    keywords.push(...dietTerms);
    
    // Add variants
    dietTerms.forEach(term => {
      if (wordVariations[term]) {
        keywords.push(...wordVariations[term]);
      }
    });
  }
  else if (category === 'substances') {
    const substanceTerms = [
      'substance', 'alcohol', 'drink', 'beer', 'wine', 'liquor', 'spirit',
      'drug', 'cannabis', 'marijuana', 'weed', 'pot', 'thc', 'cbd',
      'caffeine', 'coffee', 'tea', 'energy drink', 'soda', 'nicotine', 'tobacco',
      'smoking', 'cigarette', 'vape', 'e-cigarette', 'juul', 'cigar',
      'opioid', 'stimulant', 'cocaine', 'methamphetamine', 'heroin',
      'benzodiazepine', 'narcotic', 'recreational drug', 'sober', 'abstinent',
      'recovery', 'relapse', 'using', 'consumption', 'intoxication'
    ];
    keywords.push(...substanceTerms);
    
    // Add variants
    substanceTerms.forEach(term => {
      if (wordVariations[term]) {
        keywords.push(...wordVariations[term]);
      }
    });
  }
  else if (category === 'important') {
    // For important points, extract significant nouns and verbs
    // Split into words, remove common stop words, and focus on meaningful terms
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'and', 'that', 'this', 'with', 'from', 'have', 'they', 
                      'will', 'for', 'not', 'are', 'was', 'were', 'been', 'being',
                      'has', 'had', 'does', 'did', 'doing', 'would', 'should', 'could',
                      'about', 'there', 'their', 'they', 'them', 'these', 'those',
                      'patient', 'reports', 'reported', 'denies', 'states', 'stated'];
    
    const significantWords = words.filter(word => 
      word.length > 3 && 
      !stopWords.includes(word)
    );
    keywords.push(...significantWords);
    
    // Extract noun phrases (2-3 word combinations)
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      if (!stopWords.includes(words[i]) && !stopWords.includes(words[i+1])) {
        phrases.push(`${words[i]} ${words[i+1]}`);
      }
      
      if (i < words.length - 2 && !stopWords.includes(words[i]) && 
          !stopWords.includes(words[i+1]) && !stopWords.includes(words[i+2])) {
        phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
      }
    }
    keywords.push(...phrases);
  }
  
  // Filter out very common words that may cause false positives
  const commonWordsToFilter = ['the', 'and', 'that', 'patient', 'reports', 'reported', 
                              'denies', 'states', 'continues', 'continued', 'still',
                              'during', 'without', 'with', 'session', 'visit'];
  
  keywords = keywords.filter(keyword => 
    !commonWordsToFilter.includes(keyword) && keyword.length > 1
  );
  
  // Remove duplicates and return
  return [...new Set(keywords)];
}

    /**
     * Calculate threshold based on category and keyword count
     */
    function calculateThreshold(category: string, keywordCount: number): number {
      // Base thresholds by category - increased to require more thorough discussion
      const baseThresholds: Record<string, number> = {
        'medications': 10,   // Medications need thorough discussion
        'diagnoses': 8,      // Diagnoses are important clinical discussions
        'sleep': 6,          // Sleep is a standard check-in topic
        'exercise': 6,       // Exercise is a standard check-in topic
        'diet': 6,           // Diet is a standard check-in topic
        'substances': 8,     // Substance use warrants careful discussion
        'important': 6       // Important points vary in complexity
      };
      
      // Adjust based on keyword count (more keywords = potentially higher threshold)
      // Also ensure a minimum diversity requirement of 3-4 keywords
      const minKeywordCount = Math.min(keywordCount, 3); // Require at least 3 unique keywords
      const diversityFactor = Math.max(0.8, Math.min(1.4, minKeywordCount / 3));
      
      // Also scale based on total keyword count, but with less impact
      const keywordFactor = Math.max(0.9, Math.min(1.1, keywordCount / 8));
      
      // Combine both factors
      const combinedFactor = (diversityFactor + keywordFactor) / 2;
      
      return Math.round(baseThresholds[category] * combinedFactor);
    }

    /**
     * Helper function to extract AI-provided keywords from text
     */
    function extractAIKeywords(text: string): string[] {
      // Look for the KEYWORDS: section
      const keywordsMatch = text.match(/KEYWORDS:\s*\[(.*?)\]/s);
      if (keywordsMatch && keywordsMatch[1]) {
        // Parse the keywords from the bracketed list
        const keywordsText = keywordsMatch[1].trim();
        // Split by commas, but handle special cases where commas might be inside quoted phrases
        const keywordList = keywordsText
          .split(/,\s*/)
          .map(k => k.trim().replace(/^["']|["']$/g, '')) // Remove quotes
          .filter(k => k.length > 0);
        
        return keywordList;
      }
      return [];
    }

    /**
     * Extract only the content from text, removing KEYWORDS section
     */
    function extractContentWithoutKeywords(text: string): string {
      // Remove the KEYWORDS section if present using a more robust regex
      // This handles cases with or without brackets, and with any whitespace variations
      return text.replace(/\s*KEYWORDS:.*?(\n|$)/s, '').trim();
    }

    // Process Clinical Expertise section
    const clinicalExpertiseMatch = content.match(/Clinical Expertise:(.*?)(?=Medication Changes:|$)/s);
    if (clinicalExpertiseMatch && clinicalExpertiseMatch[1].trim()) {
      const expertiseContent = clinicalExpertiseMatch[1].trim();
      
      // Extract the two subsections
      const drugInteractionsMatch = expertiseContent.match(/Potential Drug Interactions:(.*?)(?=Expert Tip:|$)/s);
      const expertTipMatch = expertiseContent.match(/Expert Tip:(.*?)$/s);
      
      // Build the text content combining both sections if available
      let fullText = '';
      
      if (drugInteractionsMatch && drugInteractionsMatch[1].trim()) {
        fullText += 'Potential Drug Interactions:\n' + drugInteractionsMatch[1].trim();
      }
      
      if (expertTipMatch && expertTipMatch[1].trim()) {
        if (fullText) fullText += '\n\n';
        fullText += 'Expert Tip:\n' + expertTipMatch[1].trim();
      }
      
      if (fullText) {
        // For Clinical Expertise, we don't need keywords since it doesn't use color change
        // We'll use empty keywords array and a very high threshold so it never changes color
        items.push({
          id: 'clinical-expertise',
          text: fullText,
          category: 'clinical-expertise',
          keywords: [],
          points: 0,
          threshold: 999 // Very high threshold so it never turns green
        });
      }
    }

    // Process medications section
    const medicationMatch = content.match(/Medication Changes:(.*?)(?=List the Diagnoses|$)/s);
    if (medicationMatch && medicationMatch[1].trim()) {
      const medicationText = medicationMatch[1].trim();
      
      // Extract AI-provided keywords if available
      const aiKeywords = extractAIKeywords(medicationText);
      
      // Get clean content without the keywords section
      // Apply multiple passes to ensure all keyword references are removed
      let cleanText = extractContentWithoutKeywords(medicationText);
      // Additional cleanup to catch any remaining "KEYWORDS:" text 
      cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
      
      // Fall back to our extraction method if no AI keywords provided
      const keywords = aiKeywords.length > 0 
        ? aiKeywords 
        : extractKeywords(cleanText, 'medications');
      
      items.push({
        id: `medications`,
        text: cleanText,
        category: 'medications',
        keywords: keywords,
        points: 0,
        threshold: calculateThreshold('medications', keywords.length)
      });
    }

    // Process diagnoses section (extract each individual diagnosis)
    const diagnosesMatch = content.match(/List the Diagnoses from the last visit:(.*?)(?=Sleep:|$)/s);
    if (diagnosesMatch && diagnosesMatch[1].trim()) {
      const diagnosesContent = diagnosesMatch[1].trim();
      const diagnoses = diagnosesContent.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.startsWith('Diagnosis #') && line.includes(':'));
      
      diagnoses.forEach((diagnosis: string, index: number) => {
        // Need to look for multi-line diagnosis entries that might include KEYWORDS on the next line
        const diagnosisText = diagnosis.substring(diagnosis.indexOf(':') + 1).trim();
        
        if (diagnosisText) {
          // Try to find keywords for this specific diagnosis by looking at surrounding context
          const diagnosisNumber = index + 1;
          const diagnosisRegex = new RegExp(`Diagnosis #${diagnosisNumber}:.*?(?=Diagnosis #${diagnosisNumber + 1}:|Sleep:|$)`, 's');
          const fullDiagnosisMatch = diagnosesContent.match(diagnosisRegex);
          
          // Extract AI-provided keywords if available in the expanded context
          const aiKeywords = fullDiagnosisMatch 
            ? extractAIKeywords(fullDiagnosisMatch[0]) 
            : [];
          
          // Clean text without keywords section
          // Apply multiple passes to ensure all keyword references are removed
          let cleanText = extractContentWithoutKeywords(diagnosisText);
          // Additional cleanup to catch any remaining "KEYWORDS:" text 
          cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
          
          // Fall back to our extraction method if no AI keywords provided
          const keywords = aiKeywords.length > 0 
            ? aiKeywords 
            : extractKeywords(cleanText, 'diagnoses');
          
          items.push({
            id: `diagnosis-${index + 1}`,
            text: cleanText,
            category: 'diagnoses',
            keywords: keywords,
            points: 0,
            threshold: calculateThreshold('diagnoses', keywords.length)
          });
        }
      });
    }

    // Process sleep section
    const sleepMatch = content.match(/Sleep:(.*?)(?=Exercise:|$)/s);
    if (sleepMatch && sleepMatch[1].trim()) {
      const sleepText = sleepMatch[1].trim();
      
      // Extract AI-provided keywords if available
      const aiKeywords = extractAIKeywords(sleepText);
      
      // Get clean content without the keywords section
      // Apply multiple passes to ensure all keyword references are removed
      let cleanText = extractContentWithoutKeywords(sleepText);
      // Additional cleanup to catch any remaining "KEYWORDS:" text 
      cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
      
      // Fall back to our extraction method if no AI keywords provided
      const keywords = aiKeywords.length > 0 
        ? aiKeywords 
        : extractKeywords(cleanText, 'sleep');
      
      items.push({
        id: 'sleep',
        text: cleanText,
        category: 'sleep',
        keywords: keywords,
        points: 0,
        threshold: calculateThreshold('sleep', keywords.length)
      });
    }

    // Process exercise section
    const exerciseMatch = content.match(/Exercise:(.*?)(?=Appetite and Diet:|$)/s);
    if (exerciseMatch && exerciseMatch[1].trim()) {
      const exerciseText = exerciseMatch[1].trim();
      
      // Extract AI-provided keywords if available
      const aiKeywords = extractAIKeywords(exerciseText);
      
      // Get clean content without the keywords section
      // Apply multiple passes to ensure all keyword references are removed
      let cleanText = extractContentWithoutKeywords(exerciseText);
      // Additional cleanup to catch any remaining "KEYWORDS:" text 
      cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
      
      // Fall back to our extraction method if no AI keywords provided
      const keywords = aiKeywords.length > 0 
        ? aiKeywords 
        : extractKeywords(cleanText, 'exercise');
      
      items.push({
        id: 'exercise',
        text: cleanText,
        category: 'exercise',
        keywords: keywords,
        points: 0,
        threshold: calculateThreshold('exercise', keywords.length)
      });
    }

    // Process appetite/diet section
    const dietMatch = content.match(/Appetite and Diet:(.*?)(?=Substance Use:|$)/s);
    if (dietMatch && dietMatch[1].trim()) {
      const dietText = dietMatch[1].trim();
      
      // Extract AI-provided keywords if available
      const aiKeywords = extractAIKeywords(dietText);
      
      // Get clean content without the keywords section
      // Apply multiple passes to ensure all keyword references are removed
      let cleanText = extractContentWithoutKeywords(dietText);
      // Additional cleanup to catch any remaining "KEYWORDS:" text 
      cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
      
      // Fall back to our extraction method if no AI keywords provided
      const keywords = aiKeywords.length > 0 
        ? aiKeywords 
        : extractKeywords(cleanText, 'diet');
      
      items.push({
        id: 'diet',
        text: cleanText,
        category: 'diet',
        keywords: keywords,
        points: 0,
        threshold: calculateThreshold('diet', keywords.length)
      });
    }

    // Process substance use section
    const substanceMatch = content.match(/Substance Use:(.*?)(?=List any important information|$)/s);
    if (substanceMatch && substanceMatch[1].trim()) {
      const substanceText = substanceMatch[1].trim();
      
      // Extract AI-provided keywords if available
      const aiKeywords = extractAIKeywords(substanceText);
      
      // Get clean content without the keywords section
      // Apply multiple passes to ensure all keyword references are removed
      let cleanText = extractContentWithoutKeywords(substanceText);
      // Additional cleanup to catch any remaining "KEYWORDS:" text 
      cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
      
      // Fall back to our extraction method if no AI keywords provided
      const keywords = aiKeywords.length > 0 
        ? aiKeywords 
        : extractKeywords(cleanText, 'substances');
      
      items.push({
        id: 'substances',
        text: cleanText,
        category: 'substances',
        keywords: keywords,
        points: 0,
        threshold: calculateThreshold('substances', keywords.length)
      });
    }

    // Process important points section
    const importantMatch = content.match(/List any important information.*?:(.*?)$/s);
    if (importantMatch && importantMatch[1].trim()) {
      const pointsContent = importantMatch[1].trim();
      const points = pointsContent.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.startsWith('Important Point #') && line.includes(':'));
      
      points.forEach((point: string, index: number) => {
        const pointText = point.substring(point.indexOf(':') + 1).trim();
        
        if (pointText) {
          // Try to find keywords for this specific point by looking at surrounding context
          const pointNumber = index + 1;
          const pointRegex = new RegExp(`Important Point #${pointNumber}:.*?(?=Important Point #${pointNumber + 1}:|$)`, 's');
          const fullPointMatch = pointsContent.match(pointRegex);
          
          // Extract AI-provided keywords if available in the expanded context
          const aiKeywords = fullPointMatch 
            ? extractAIKeywords(fullPointMatch[0]) 
            : [];
          
          // Clean text without keywords section
          // Apply multiple passes to ensure all keyword references are removed
          let cleanText = extractContentWithoutKeywords(pointText);
          // Additional cleanup to catch any remaining "KEYWORDS:" text 
          cleanText = cleanText.replace(/KEYWORDS:.*?(\n|$)/g, '').trim();
          
          // Fall back to our extraction method if no AI keywords provided
          const keywords = aiKeywords.length > 0 
            ? aiKeywords 
            : extractKeywords(cleanText, 'important');
          
          items.push({
            id: `important-${index + 1}`,
            text: cleanText,
            category: 'important',
            keywords: keywords,
            points: 0,
            threshold: calculateThreshold('important', keywords.length)
          });
        }
      });
    }
    
    return items;
  } catch (error) {
    console.error("Error fetching follow-up items:", error);
    return [];
  }
}

/**
 * Get emoji for a follow-up item category
 */
export function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'clinical-expertise': return '🧠';
    case 'medications': return '💊';
    case 'diagnoses': return '🏥';
    case 'sleep': return '😴';
    case 'exercise': return '🏃‍♂️';
    case 'diet': return '🍽️';
    case 'substances': return '🍷';
    case 'important': return 'ℹ️';
    default: return '•';
  }
}

/**
 * Get friendly name for a follow-up item category
 */
export function getCategoryName(category: string): string {
  switch (category) {
    case 'clinical-expertise': return 'Clinical Expertise';
    case 'medications': return 'Medication Changes';
    case 'diagnoses': return 'Diagnoses';
    case 'sleep': return 'Sleep';
    case 'exercise': return 'Exercise';
    case 'diet': return 'Appetite and Diet';
    case 'substances': return 'Substance Use';
    case 'important': return 'Important Points';
    default: return category;
  }
}
