'use client';

/**
 * ARCHIVED KEYWORD EXTRACTION LOGIC
 * 
 * This file contains the original keyword extraction logic from fetchFollowUps.ts.
 * It is preserved for reference and as a fallback if needed.
 */

/**
 * Helper function to extract keywords from text based on category
 * Enhanced to include word variations, common synonyms, and better filtering
 */
export function extractKeywords(text: string, category: string): string[] {
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
