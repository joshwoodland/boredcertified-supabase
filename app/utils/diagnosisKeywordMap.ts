'use client';

// Main diagnosis to keywords mapping from the provided JSON data
export const diagnosisKeywordMap: Record<string, string[]> = {
  "Anxiety": ["anxiety", "nervous", "worry", "panic", "restless"],
  "Depression": ["depression", "sad", "hopeless", "worthless", "tearful"],
  "OCD": ["OCD", "obsessions", "compulsions", "rituals", "checking"],
  "PTSD": ["PTSD", "trauma", "flashbacks", "nightmares", "startle"],
  "Bipolar": ["mood swings", "mania", "depression", "impulsive", "racing thoughts"],
  "Schizophrenia": ["hallucinations", "delusions", "paranoia", "disorganized", "psychosis"],
  "ADHD": ["ADHD", "focus", "hyperactive", "impulsive", "attention", "attention deficit", "inattentive"],
  "Autism": ["autism", "social", "rigid", "sensory", "repetitive"],
  "Insomnia": ["sleep", "insomnia", "awake", "fatigue", "tired"],
  "Eating": ["eating", "weight", "food", "body image", "purging"],
  "Substance": ["addiction", "substance", "cravings", "use", "withdrawal"],
  "Personality": ["unstable", "relationships", "self-image", "impulsive", "anger"],
  "Adjustment": ["stress", "life change", "coping", "transition", "adjustment"],
  "Delusion": ["delusions", "false beliefs", "paranoia", "fixed beliefs", "psychosis"],
  "Dissociation": ["dissociation", "detached", "unreal", "floating", "numb"],
  "Somatic": ["pain", "symptoms", "medical", "bodily", "concern"],
  "Gender": ["gender", "identity", "dysphoria", "assigned sex", "transition"],
  // Additional diagnoses
  "Cyclothymic": ["mood swings", "emotional ups and downs", "unstable mood", "mild mania", "mild depression"],
  "Persistent Depressive": ["dysthymia", "low mood", "hopeless", "fatigue", "poor concentration"],
  "Premenstrual": ["PMDD", "irritability", "mood swings", "bloating", "depression"],
  "Explosive": ["anger", "outbursts", "rage", "aggression", "irritability"],
  "Kleptomania": ["stealing", "impulse", "theft", "urge", "control"],
  "Pyromania": ["fire", "arson", "burning", "impulse", "dangerous"],
  "Gambling": ["gambling", "betting", "risk", "money loss", "addiction"],
  "Hoarding": ["hoarding", "clutter", "possessions", "difficulty discarding", "messy"],
  "Body Dysmorphic": ["body image", "appearance", "flaws", "mirror checking", "insecurity"],
  "Trichotillomania": ["hair pulling", "bald spots", "stress", "habit", "relief"],
  "Excoriation": ["skin picking", "scabs", "sores", "impulse", "dermatillomania"],
  "Separation Anxiety": ["separation", "clingy", "worry", "fear", "school refusal"],
  "Selective Mutism": ["mute", "anxiety", "silent", "situational", "speaking"],
  "Tic": ["tics", "involuntary", "blinking", "grunting", "repetitive"],
  "Tourette": ["tics", "vocal", "motor", "involuntary", "onset childhood"],
  "Narcolepsy": ["daytime sleepiness", "cataplexy", "REM sleep", "sleep attacks", "tired"],
  "Hypersomnolence": ["excessive sleep", "tired", "fatigue", "long naps", "groggy"],
  "Parasomnia": ["sleepwalking", "sleep talking", "confusion", "night behaviors", "disturbance"],
  "Nightmare": ["bad dreams", "nightmares", "fear", "disturbed sleep", "trauma"],
  "Sleep Terror": ["night terror", "screaming", "sudden arousal", "inconsolable", "confusion"],
  "Oppositional Defiant": ["defiant", "argue", "authority", "anger", "rules"],
  "Conduct": ["aggression", "theft", "violence", "rule-breaking", "truancy"],
  "Rumination": ["regurgitation", "chewing", "swallowing", "repetitive", "eating disorder"],
  "Pica": ["nonfood", "eating", "chalk", "dirt", "behavioral"],
  "Enuresis": ["bedwetting", "urine", "nighttime", "involuntary", "children"],
  "Encopresis": ["feces", "soiling", "incontinence", "bowel", "toilet training"],
  "Disinhibited Social": ["overly friendly", "no boundaries", "attachment", "social behavior", "neglect"],
  "Reactive Attachment": ["attachment", "withdrawn", "neglect", "bonding", "avoidant"],
  "Intellectual Disability": ["low IQ", "adaptive functioning", "developmental delay", "cognition", "learning"],
  "Language Disorder": ["speech delay", "vocabulary", "expressive", "understanding", "development"],
  "Speech Sound": ["mispronounce", "articulation", "clarity", "phonetics", "communication"],
  "Fluency": ["stuttering", "blocks", "repetition", "speech", "fluency"],
  "Pragmatic": ["social cues", "conversation", "communication", "language", "understanding"],
  "Neurocognitive Disorder, Mild": ["mild memory loss", "confusion", "attention", "thinking", "independence"],
  "Neurocognitive Disorder, Major": ["dementia", "memory", "functioning", "disorientation", "decline"],
  "Parkinson's": ["tremor", "rigidity", "slowed movement", "psychosis", "delusions"],
  "Alzheimer's": ["memory loss", "dementia", "confusion", "names", "disorientation"],
  "Huntington's": ["movement", "chorea", "inherited", "behavior", "cognitive decline"],
  "Frontotemporal": ["personality change", "disinhibition", "language", "executive function", "frontal lobe"],
  "Delirium": ["acute confusion", "inattention", "disoriented", "fluctuating", "medical"],
  "Catatonia": ["immobility", "mutism", "posturing", "stupor", "rigid"],
  "Movement Disorder": ["tremors", "rigidity", "tics", "akathisia", "side effects"],
  "Serotonin Syndrome": ["agitation", "confusion", "sweating", "clonus", "serotonin"],
  "Neuroleptic Malignant": ["fever", "rigidity", "mental status", "autonomic", "reaction"],
  "Wernicke": ["alcohol", "confusion", "memory loss", "vitamin B1", "gait"],
  "Insufficient Sleep": ["sleep deprivation", "fatigue", "cognitive impairment", "irritable", "daytime sleepiness"],
  "Jet Lag": ["time zones", "sleep cycle", "circadian", "insomnia", "travel"],
  "Shift Work": ["night shift", "fatigue", "sleep disorder", "circadian", "work schedule"]
};

// Add common clinical terms and abbreviations that might be missed
export const additionalKeywords: Record<string, string[]> = {
  "Depression": ["MDD", "major depressive disorder", "major depression", "clinical depression", "unipolar depression"],
  "Bipolar": ["bipolar disorder", "bipolar I", "bipolar II", "manic depression", "bipolar affective disorder", "BAD"],
  "ADHD": ["attention deficit", "attention deficit hyperactivity disorder", "ADD", "attention deficit disorder"],
  "Anxiety": ["GAD", "generalized anxiety disorder", "panic disorder", "social anxiety", "phobia"],
  "OCD": ["obsessive-compulsive disorder", "obsessive compulsive"],
  "PTSD": ["post-traumatic stress disorder", "post traumatic", "trauma disorder"],
  "Schizophrenia": ["schizophrenic disorder", "schizoaffective", "psychotic disorder"],
  "Autism": ["autism spectrum disorder", "ASD", "asperger", "asperger's"],
  "Substance": ["substance use disorder", "SUD", "substance abuse", "substance dependence"],
  "Personality": ["personality disorder", "BPD", "borderline", "narcissistic", "NPD", "antisocial", "ASPD"]
};

// Merge additional keywords into main map
Object.entries(additionalKeywords).forEach(([diagnosis, keywords]) => {
  if (diagnosisKeywordMap[diagnosis]) {
    diagnosisKeywordMap[diagnosis] = [
      ...diagnosisKeywordMap[diagnosis],
      ...keywords
    ];
  }
});

// Reverse map for efficient lookup: keyword → diagnosis
export const keywordToDiagnosisMap = new Map<string, string>();

// Populate the reverse mapping
Object.entries(diagnosisKeywordMap).forEach(([diagnosis, keywords]) => {
  keywords.forEach(keyword => {
    keywordToDiagnosisMap.set(keyword.toLowerCase(), diagnosis);
  });
});

// Function to check if a transcript contains keywords for a specific diagnosis
export function matchesDiagnosis(transcript: string, diagnosisText: string): boolean {
  const transcriptLower = transcript.toLowerCase();
  
  // Check if the diagnosis name itself appears in the transcript
  for (const [diagnosis, keywords] of Object.entries(diagnosisKeywordMap)) {
    // Check if this diagnosis appears in the diagnosis text
    if (diagnosisText.toLowerCase().includes(diagnosis.toLowerCase()) ||
        keywords.some(k => diagnosisText.toLowerCase().includes(k.toLowerCase()))) {
      
      // Now check if any of its keywords appear in the transcript
      if (keywords.some(keyword => transcriptLower.includes(keyword.toLowerCase()))) {
        return true;
      }
      
      // Special case for diagnosis name directly in transcript
      if (transcriptLower.includes(diagnosis.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}
