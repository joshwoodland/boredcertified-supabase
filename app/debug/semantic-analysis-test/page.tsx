'use client';

import React, { useState } from 'react';
import { hybridAnalysis, fallbackKeywordAnalysis, logAnalysisResults } from '../../utils/semanticAnalysis';

const SAMPLE_TOPICS = [
  { topic: 'Depression', confidence_score: 0.92 },
  { topic: 'Anxiety', confidence_score: 0.88 },
  { topic: 'Sleep Disorders', confidence_score: 0.85 },
  { topic: 'Physical Exercise', confidence_score: 0.78 }, // Below threshold
  { topic: 'Diet', confidence_score: 0.90 }
];

const SAMPLE_TRANSCRIPT = `
The patient reports feeling depressed for the past two weeks. 
They mentioned having anxiety about work and trouble sleeping at night.
They say they exercise regularly and are trying to maintain a healthy diet.
The weight of their depression has been making it hard to socialize with friends.
They used to enjoy hobbies like reading but have lost interest lately.
`;

const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'depression-scale', text: 'Depression scale (1-10 rating)', category: 'mental-health' },
  { id: 'anxiety-scale', text: 'Anxiety scale (1-10 rating)', category: 'mental-health' },
  { id: 'mood-stability', text: 'Mood stability assessment', category: 'mental-health' },
  { id: 'sleep', text: 'Sleep quality/patterns', category: 'lifestyle' },
  { id: 'exercise', text: 'Exercise habits', category: 'lifestyle' },
  { id: 'diet', text: 'Diet/nutrition', category: 'lifestyle' },
  { id: 'socialization', text: 'Socialization levels', category: 'lifestyle' },
  { id: 'hobbies', text: 'Hobbies/activities', category: 'lifestyle' }
];

const ITEM_KEYWORDS: Record<string, string[]> = {
  'depression-scale': ['depression', 'depressed', 'sad', 'hopeless', 'worthless', 'down', 'blue', 'melancholy'],
  'anxiety-scale': ['anxiety', 'anxious', 'worried', 'nervous', 'panic', 'fear', 'stress', 'tense'],
  'mood-stability': ['mood', 'emotions', 'emotional', 'stable', 'unstable', 'ups and downs', 'mood swings'],
  'sleep': ['sleep', 'sleeping', 'insomnia', 'tired', 'fatigue', 'rest', 'bed', 'wake up', 'dreams'],
  'exercise': ['exercise', 'workout', 'gym', 'running', 'walking', 'physical activity', 'sports', 'fitness'],
  'diet': ['diet', 'eating', 'food', 'nutrition', 'appetite', 'meals', 'hungry', 'weight'],
  'socialization': ['social', 'friends', 'family', 'people', 'isolation', 'lonely', 'relationships', 'support'],
  'hobbies': ['hobbies', 'activities', 'interests', 'fun', 'enjoyment', 'leisure', 'recreation', 'passion']
};

export default function SemanticAnalysisTest() {
  const [hybridResults, setHybridResults] = useState<any>(null);
  const [keywordResults, setKeywordResults] = useState<any>(null);
  const [customTranscript, setCustomTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [customTopics, setCustomTopics] = useState(JSON.stringify(SAMPLE_TOPICS, null, 2));

  const runHybridAnalysis = () => {
    console.log('=== RUNNING HYBRID ANALYSIS ===');
    try {
      const topics = JSON.parse(customTopics);
      const result = hybridAnalysis(
        topics,
        customTranscript,
        ITEM_KEYWORDS,
        DEFAULT_CHECKLIST_ITEMS,
        'default'
      );
      setHybridResults(result);
      logAnalysisResults(result, 'Test - Hybrid');
    } catch (error) {
      console.error('Error running hybrid analysis:', error);
      alert('Error parsing topics JSON. Please check the format.');
    }
  };

  const runKeywordAnalysis = () => {
    console.log('=== RUNNING KEYWORD-ONLY ANALYSIS ===');
    const result = fallbackKeywordAnalysis(
      customTranscript,
      ITEM_KEYWORDS,
      DEFAULT_CHECKLIST_ITEMS
    );
    setKeywordResults(result);
    logAnalysisResults(result, 'Test - Keywords Only');
  };

  const clearResults = () => {
    setHybridResults(null);
    setKeywordResults(null);
  };

  const formatResults = (results: any): JSX.Element | null => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Analysis Summary</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Method: <span className="font-medium">{results.analysisMethod}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total topics/keywords found: <span className="font-medium">{results.totalTopicsFound}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Items with points: <span className="font-medium">
              {Object.values(results.itemPoints).filter((points: any) => points > 0).length}
            </span>
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Item Points</h4>
          <div className="space-y-2">
            {Object.entries(results.itemPoints)
              .filter(([_, points]) => (points as number) > 0)
              .sort(([_, a], [__, b]) => (b as number) - (a as number))
              .map(([itemId, points]) => (
                <div key={itemId} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{itemId}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{points as number} points</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Topic Hits</h4>
          <div className="space-y-2">
            {results.topicHits.map((hit: any, index: number) => (
              <div key={index} className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{hit.checklistItemId}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">+{hit.points} pts</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  "{hit.topicText}" (confidence: {hit.confidence}, weight: {hit.weight})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Semantic Analysis Testing
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Test Input
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Transcript
                  </label>
                  <textarea
                    value={customTranscript}
                    onChange={(e) => setCustomTranscript(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter transcript text..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Topics (JSON)
                  </label>
                  <textarea
                    value={customTopics}
                    onChange={(e) => setCustomTopics(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none font-mono text-sm"
                    placeholder="Enter topics JSON..."
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={runHybridAnalysis}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Run Hybrid Analysis
                </button>
                <button
                  onClick={runKeywordAnalysis}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Run Keyword Analysis
                </button>
                <button
                  onClick={clearResults}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Results
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {hybridResults && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Hybrid Analysis Results
                </h3>
                {formatResults(hybridResults)}
              </div>
            )}

            {keywordResults && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Keyword Analysis Results
                </h3>
                {formatResults(keywordResults)}
              </div>
            )}

            {!hybridResults && !keywordResults && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <p>Run an analysis to see results here</p>
              </div>
            )}
          </div>
        </div>

        {/* Expected Behavior Section */}
        <div className="mt-12 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Expected Test Behavior
          </h3>
          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
            <p><strong>Hybrid Analysis should:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Detect "Depression" topic (92% confidence) → depression-scale item</li>
              <li>Detect "Anxiety" topic (88% confidence) → anxiety-scale item</li>
              <li>Detect "Sleep Disorders" topic (85% confidence) → sleep item</li>
              <li>Skip "Physical Exercise" (78% confidence - below threshold)</li>
              <li>Detect "Diet" topic (90% confidence) → diet item</li>
              <li>Use keyword fallback for missed items like "exercise", "socialization", "hobbies"</li>
            </ul>
            <p><strong>Keyword Analysis should:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Find "depressed", "depression" → depression-scale</li>
              <li>Find "anxiety" → anxiety-scale</li>
              <li>Find "sleeping" → sleep</li>
              <li>Find "exercise" → exercise (note: NOT triggered by "weight" now!)</li>
              <li>Find "diet" → diet</li>
              <li>Find "friends", "socialize" → socialization</li>
              <li>Find "hobbies" → hobbies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 