// Topic mappings for different checklist types
export const DEFAULT_CHECKLIST_TOPIC_MAPPING: Record<string, string> = {
  'Depression': 'depression-scale',
  'Anxiety': 'anxiety-scale', 
  'Sleep Disorders': 'sleep',
  'Physical Exercise': 'exercise',
  'Diet': 'diet',
  'Social Support': 'socialization',
  'Recreational Activities': 'hobbies',
  'Mood Disorders': 'mood-stability',
  'Insomnia': 'sleep',
  'Fitness': 'exercise',
  'Nutrition': 'diet',
  'Mental Health': 'depression-scale', // Fallback mapping
  'Emotional Wellbeing': 'mood-stability'
};

export const INITIAL_EVALUATION_TOPIC_MAPPING: Record<string, string> = {
  'Chief Complaint': 'presenting-problem',
  'Medical History': 'history-present-illness',
  'Psychiatric History': 'psychiatric-history',
  'Family History': 'family-history',
  'Social History': 'social-history',
  'Substance Use': 'substance-use',
  'Medications': 'medications',
  'Allergies': 'allergies',
  'Mental Status': 'mental-status',
  'Risk Assessment': 'risk-assessment',
  'Functional Assessment': 'functional-assessment',
  'Drug Use': 'substance-use',
  'Alcohol': 'substance-use',
  'Prescription Drugs': 'medications',
  'Side Effects': 'allergies'
};

// Custom topics for Deepgram - comprehensive medical terminology
export const CUSTOM_TOPICS = [
  // Mental Health Conditions
  'Depression', 'Anxiety', 'Mood Disorders', 'Bipolar Disorder',
  'Sleep Disorders', 'Insomnia', 'PTSD', 'OCD', 'Panic Disorder',
  'Social Anxiety', 'General Anxiety', 'Major Depression',
  
  // Medical Assessment Areas
  'Medical History', 'Psychiatric History', 'Family History', 
  'Social History', 'Substance Use', 'Medications', 'Allergies',
  'Drug Use', 'Alcohol', 'Prescription Drugs', 'Side Effects',
  
  // Clinical Assessment
  'Chief Complaint', 'Mental Status', 'Risk Assessment', 
  'Functional Assessment', 'Suicidal Ideation', 'Self Harm',
  'Cognitive Function', 'Memory Problems',
  
  // Lifestyle and Wellness
  'Physical Exercise', 'Diet', 'Social Support', 
  'Recreational Activities', 'Work Stress', 'Fitness',
  'Nutrition', 'Social Isolation', 'Family Support',
  
  // Treatment and Care
  'Therapy', 'Counseling', 'Treatment Plan', 'Follow Up',
  'Medication Management', 'Dosage', 'Treatment Response'
];

// Configuration constants
export const CONFIDENCE_THRESHOLD = 0.85;
export const POINTS_PER_TOPIC_HIT = 20;
export const MAX_POINTS = 100;
export const FALLBACK_CONFIDENCE_THRESHOLD = 0.75; // Lower threshold for fallback scenarios

// Topic priority weights - some topics are more important than others
export const TOPIC_WEIGHTS: Record<string, number> = {
  'Risk Assessment': 1.5,
  'Suicidal Ideation': 1.5,
  'Self Harm': 1.5,
  'Medications': 1.3,
  'Allergies': 1.3,
  'Substance Use': 1.2,
  'Chief Complaint': 1.2
};

export function getTopicWeight(topic: string): number {
  return TOPIC_WEIGHTS[topic] || 1.0;
} 