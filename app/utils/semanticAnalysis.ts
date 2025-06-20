import { 
  DEFAULT_CHECKLIST_TOPIC_MAPPING, 
  INITIAL_EVALUATION_TOPIC_MAPPING,
  CONFIDENCE_THRESHOLD,
  POINTS_PER_TOPIC_HIT,
  MAX_POINTS,
  getTopicWeight
} from '../config/topicMappings';

export interface TopicHit {
  checklistItemId: string;
  confidence: number;
  topicText: string;
  points: number;
  weight: number;
}

export interface SemanticAnalysisResult {
  itemPoints: Record<string, number>;
  topicHits: TopicHit[];
  totalTopicsFound: number;
  analysisMethod: 'semantic' | 'fallback' | 'hybrid';
}

export function analyzeTopicsForChecklist(
  topics: Array<{ topic: string; confidence_score: number }>,
  checklistType: 'default' | 'initial-evaluation' | 'follow-up',
  currentPoints: Record<string, number> = {}
): SemanticAnalysisResult {
  
  const mapping: Record<string, string> = checklistType === 'initial-evaluation' 
    ? INITIAL_EVALUATION_TOPIC_MAPPING 
    : DEFAULT_CHECKLIST_TOPIC_MAPPING;
  
  const newPoints = { ...currentPoints };
  const topicHits: TopicHit[] = [];
  let totalTopicsFound = 0;

  console.log(`[SEMANTIC ANALYSIS] Processing ${topics.length} topics for ${checklistType} checklist`);

  topics.forEach(({ topic, confidence_score }) => {
    console.log(`[SEMANTIC ANALYSIS] Evaluating topic: "${topic}" with confidence ${confidence_score}`);
    
    // Only process topics above confidence threshold
    if (confidence_score >= CONFIDENCE_THRESHOLD) {
      const checklistItemId = mapping[topic];
      
      if (checklistItemId) {
        // Get topic weight and calculate weighted points
        const weight = getTopicWeight(topic);
        const basePoints = POINTS_PER_TOPIC_HIT * weight;
        
        // Add points for this topic hit
        const currentItemPoints = newPoints[checklistItemId] || 0;
        const pointsToAdd = Math.round(basePoints);
        const newItemPoints = Math.min(MAX_POINTS, currentItemPoints + pointsToAdd);
        
        newPoints[checklistItemId] = newItemPoints;
        totalTopicsFound++;
        
        topicHits.push({
          checklistItemId,
          confidence: confidence_score,
          topicText: topic,
          points: pointsToAdd,
          weight
        });
        
        console.log(`[SEMANTIC ANALYSIS] ✓ Topic "${topic}" (conf: ${confidence_score}, weight: ${weight}) → ${checklistItemId} (+${pointsToAdd} points = ${newItemPoints} total)`);
      } else {
        console.log(`[SEMANTIC ANALYSIS] ⚠ Topic "${topic}" not mapped to any checklist item`);
      }
    } else {
      console.log(`[SEMANTIC ANALYSIS] ✗ Topic "${topic}" below confidence threshold (${confidence_score} < ${CONFIDENCE_THRESHOLD})`);
    }
  });

  console.log(`[SEMANTIC ANALYSIS] Summary: ${totalTopicsFound} topics processed, ${topicHits.length} hits recorded`);

  return {
    itemPoints: newPoints,
    topicHits,
    totalTopicsFound,
    analysisMethod: 'semantic'
  };
}

// Fallback keyword analysis for topics not caught by semantic analysis
export function fallbackKeywordAnalysis(
  transcript: string,
  itemKeywords: Record<string, string[]>,
  checklistItems: Array<{ id: string }>,
  currentPoints: Record<string, number> = {},
  semanticItemIds: string[] = [] // Items already processed by semantic analysis
): SemanticAnalysisResult {
  
  const newPoints = { ...currentPoints };
  const transcriptLower = transcript.toLowerCase();
  const fallbackHits: TopicHit[] = [];
  let totalKeywordsFound = 0;
  
  console.log(`[FALLBACK ANALYSIS] Processing ${checklistItems.length} items, excluding ${semanticItemIds.length} semantic hits`);
  
  checklistItems.forEach(item => {
    // Only apply fallback if no semantic points were awarded or points are very low
    const currentItemPoints = newPoints[item.id] || 0;
    const wasProcessedSemantically = semanticItemIds.includes(item.id);
    
    if (!wasProcessedSemantically || currentItemPoints < (POINTS_PER_TOPIC_HIT / 2)) {
      const keywords = itemKeywords[item.id] || [];
      let totalOccurrences = 0;
      const foundKeywords: string[] = [];
      
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = transcriptLower.match(regex);
        if (matches) {
          totalOccurrences += matches.length;
          foundKeywords.push(`${keyword}(${matches.length})`);
        }
      });
      
      if (totalOccurrences > 0) {
        const pointsToAdd = totalOccurrences * POINTS_PER_TOPIC_HIT;
        const previousPoints = wasProcessedSemantically ? currentItemPoints : 0;
        const newItemPoints = Math.min(MAX_POINTS, previousPoints + pointsToAdd);
        
        newPoints[item.id] = newItemPoints;
        totalKeywordsFound += totalOccurrences;
        
        fallbackHits.push({
          checklistItemId: item.id,
          confidence: 0.8, // Assume reasonable confidence for keyword matches
          topicText: `Keywords: ${foundKeywords.join(', ')}`,
          points: pointsToAdd,
          weight: 1.0
        });
        
        console.log(`[FALLBACK ANALYSIS] ${item.id}: ${totalOccurrences} keyword matches (+${pointsToAdd} points = ${newItemPoints} total) - ${foundKeywords.join(', ')}`);
      }
    } else {
      console.log(`[FALLBACK ANALYSIS] Skipping ${item.id} - already processed semantically with ${currentItemPoints} points`);
    }
  });
  
  console.log(`[FALLBACK ANALYSIS] Summary: ${totalKeywordsFound} keyword matches found`);
  
  return {
    itemPoints: newPoints,
    topicHits: fallbackHits,
    totalTopicsFound: totalKeywordsFound,
    analysisMethod: 'fallback'
  };
}

// Hybrid analysis - combines semantic and fallback approaches
export function hybridAnalysis(
  topics: Array<{ topic: string; confidence_score: number }>,
  transcript: string,
  itemKeywords: Record<string, string[]>,
  checklistItems: Array<{ id: string }>,
  checklistType: 'default' | 'initial-evaluation' | 'follow-up',
  currentPoints: Record<string, number> = {}
): SemanticAnalysisResult {
  
  console.log('[HYBRID ANALYSIS] Starting hybrid semantic + keyword analysis');
  
  // First, run semantic analysis
  const semanticResult = analyzeTopicsForChecklist(topics, checklistType, currentPoints);
  
  // Get list of items that were semantically processed
  const semanticItemIds = semanticResult.topicHits.map(hit => hit.checklistItemId);
  
  // Then, run fallback analysis for remaining items
  const fallbackResult = fallbackKeywordAnalysis(
    transcript,
    itemKeywords,
    checklistItems,
    semanticResult.itemPoints,
    semanticItemIds
  );
  
  // Combine results
  const combinedHits = [...semanticResult.topicHits, ...fallbackResult.topicHits];
  const totalTopicsFound = semanticResult.totalTopicsFound + fallbackResult.totalTopicsFound;
  
  console.log(`[HYBRID ANALYSIS] Complete: ${semanticResult.totalTopicsFound} semantic + ${fallbackResult.totalTopicsFound} keyword = ${totalTopicsFound} total`);
  
  return {
    itemPoints: fallbackResult.itemPoints,
    topicHits: combinedHits,
    totalTopicsFound,
    analysisMethod: 'hybrid'
  };
}

// Utility function to log analysis results
export function logAnalysisResults(result: SemanticAnalysisResult, context: string = '') {
  console.group(`[ANALYSIS RESULTS${context ? ' - ' + context : ''}]`);
  console.log(`Method: ${result.analysisMethod}`);
  console.log(`Total topics/keywords found: ${result.totalTopicsFound}`);
  console.log(`Items with points:`, Object.keys(result.itemPoints).filter(id => result.itemPoints[id] > 0).length);
  
  // Log top items by points
  const sortedItems = Object.entries(result.itemPoints)
    .filter(([_, points]) => points > 0)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 5);
    
  if (sortedItems.length > 0) {
    console.log('Top items by points:');
    sortedItems.forEach(([id, points]) => {
      console.log(`  ${id}: ${points} points`);
    });
  }
  
  console.groupEnd();
} 