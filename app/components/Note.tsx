'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Note {
  id: string;
  createdAt: string;
  content: string;
  isInitialVisit: boolean;
}

interface NoteProps {
  note: Note;
  isLatest?: boolean;
  forceCollapse?: boolean;
}

function parseFormattedContent(content: string): { formatGuide: any, cleanContent: string } {
  const formatMatch = content.match(/^format:(.*)\n/);
  if (!formatMatch) {
    return { formatGuide: {}, cleanContent: content };
  }

  try {
    const formatGuide = JSON.parse(formatMatch[1]);
    const cleanContent = content.replace(/^format:.*\n/, '');
    return { formatGuide, cleanContent };
  } catch (e) {
    console.error('Error parsing format guide:', e);
    return { formatGuide: {}, cleanContent: content };
  }
}

function applyStoredFormatting(content: string, formatGuide: any): string {
  return content.split('\n').map(line => {
    // Check if this line matches any of our stored headings
    for (const [text, level] of Object.entries(formatGuide)) {
      if (line.trim() === text.trim()) {
        return `${'#'.repeat(level as number)} ${line}`;
      }
    }
    return line;
  }).join('\n');
}

export default function Note({ note, isLatest = false, forceCollapse = false }: NoteProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const sections = useMemo(() => {
    try {
      const content = note.content;
      const { formatGuide, cleanContent } = parseFormattedContent(content);
      const formattedContent = applyStoredFormatting(cleanContent, formatGuide);
      return JSON.parse(formattedContent) as Record<string, string>;
    } catch {
      return { content: note.content };
    }
  }, [note.content]);

  useEffect(() => {
    setEditableContent(sections);
  }, [sections]);

  useEffect(() => {
    if (!isLatest) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isLatest, forceCollapse]);

  // Fetch summary when note is not latest and not expanded
  useEffect(() => {
    const fetchSummary = async () => {
      if (isLatest || isExpanded) return;
      
      try {
        setIsLoadingSummary(true);
        const response = await fetch('/api/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: note.content }),
        });

        if (!response.ok) throw new Error('Failed to generate summary');
        
        const data = await response.json();
        setSummary(data.summary);
      } catch (error) {
        console.error('Error fetching summary:', error);
        setSummary('Follow-up visit');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    if (!summary && !isLatest && !isExpanded) {
      fetchSummary();
    }
  }, [note.content, isLatest, isExpanded, summary]);

  const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' ' + new Date(note.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });

  const getChiefComplaint = (sections: Record<string, string>): string => {
    try {
      // Try to find the Subjective section
      const subjective = sections['SUBJECTIVE'] || sections['Subjective'];
      if (!subjective) return '';
      
      // Look for the chief complaint line
      const lines = subjective.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes('chief complaint:')) {
          // Extract everything after "Chief Complaint:" and before the next section
          const complaint = line.split('Chief Complaint:')[1]?.trim();
          if (complaint) {
            // Remove any parentheses and their contents
            return complaint.replace(/\(.*?\)/g, '').trim();
          }
        }
      }
      return '';
    } catch {
      return '';
    }
  };

  const generateVisitSummary = (sections: Record<string, string>): string => {
    try {
      let summary = '';
      
      // Extract symptom reports from History of Present Illness
      const subjective = sections['SUBJECTIVE'] || sections['Subjective'];
      if (subjective) {
        const lines = subjective.split('\n');
        for (const line of lines) {
          // Look for key symptom indicators
          if (line.toLowerCase().includes('reports') || 
              line.toLowerCase().includes('complains') ||
              line.toLowerCase().includes('states') ||
              line.toLowerCase().includes('experiencing')) {
            summary = line.trim();
            break;
          }
        }
      }

      // Extract medication changes from Assessment and Plan
      const assessment = sections['ASSESSMENT AND PLAN'] || sections['Assessment and Plan'];
      if (assessment) {
        const lines = assessment.split('\n');
        let medicationChange = '';
        
        // Look for medication changes in the plan
        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('trazodone') || 
              lowerLine.includes('doxepin') ||
              lowerLine.includes('medication') ||
              lowerLine.includes('prescribed') ||
              lowerLine.includes('mg')) {
            medicationChange = line.trim();
            break;
          }
        }
        
        if (medicationChange) {
          if (summary) summary += '. ';
          summary += medicationChange;
        }
      }

      return summary || 'Follow-up visit';
    } catch {
      return 'Follow-up visit';
    }
  };

  const handleContentChange = (section: string, value: string) => {
    setEditableContent(prev => ({
      ...prev,
      [section]: value
    }));
  };

  const renderSection = (title: string, content: string) => {
    if (!content) return null;

    return (
      <div key={title} className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {title}
        </h2>
        {isEditing ? (
          <textarea
            value={editableContent[title] || ''}
            onChange={(e) => handleContentChange(title, e.target.value)}
            className="w-full min-h-[200px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {String(content).split('\n').map((paragraph: string, i: number) => {
              // Check if the paragraph is a subsection heading
              if (paragraph.startsWith('###')) {
                return (
                  <h3 key={i} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-4">
                    {paragraph.replace('###', '').trim()}
                  </h3>
                );
              }
              // Check if the paragraph is a bullet point
              if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('•')) {
                return (
                  <div key={i} className="flex items-start space-x-2 mb-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <p className="text-gray-700 dark:text-gray-300 flex-1">{paragraph.replace(/^[-•]/, '').trim()}</p>
                  </div>
                );
              }
              // Regular paragraph
              return (
                <p key={i} className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                  {paragraph}
                </p>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow transition-all duration-200 ${
      isLatest || isExpanded ? 'p-8' : 'p-4'
    }`}>
      {/* Header */}
      <div className={`flex items-start justify-between ${!isLatest && 'cursor-pointer'}`}
        onClick={() => !isLatest && setIsExpanded(!isExpanded)}>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold dark:text-white">
              {note.isInitialVisit ? 'Initial Evaluation' : 'Follow Up'}
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              note.isInitialVisit
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {formattedDate}
            </span>
          </div>
          {!isLatest && !isExpanded && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
              {isLoadingSummary ? 'Loading summary...' : summary}
            </p>
          )}
        </div>
        {!isLatest && (
          <button
            className="ml-4 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
          >
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        )}
      </div>

      {/* Content */}
      {(isLatest || isExpanded) && (
        <div className="mt-8">
          {/* Edit Toggle */}
          {isLatest && (
            <div className="mb-6">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isEditing ? 'Save Changes' : 'Edit Note'}
              </button>
            </div>
          )}

          {/* Note Sections */}
          {Object.entries(sections).map(([title, content]) => renderSection(title, content))}
        </div>
      )}
    </div>
  );
} 