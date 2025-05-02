import React, { useEffect, useState } from 'react';
import { checkSupabaseConnection, getSupabaseNotes, convertToPrismaFormat, supabase } from '../lib/supabase';
import { prisma, connectWithFallback } from '../lib/db';
import { FiCalendar, FiFileText, FiRefreshCw } from 'react-icons/fi';

interface Note {
  id: string;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  audioFileUrl: string | null;
  isInitialVisit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SupabasePatientNotesProps {
  patientId?: string;
  selectedNoteId?: string;
  onNoteSelect?: (note: Note) => void;
  forceCollapse?: boolean;
}

/**
 * Component that uses Supabase for patient notes with SQLite fallback capability
 */
export default function SupabasePatientNotes({ 
  patientId, 
  selectedNoteId, 
  onNoteSelect,
  forceCollapse 
}: SupabasePatientNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'sqlite'>('supabase');

  useEffect(() => {
    async function loadNotes() {
      if (!patientId) {
        setNotes([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // First try Supabase
        const isSupabaseAvailable = await checkSupabaseConnection();
        
        if (isSupabaseAvailable) {
          // Get data from Supabase
          const supabaseNotes = await getSupabaseNotes(patientId);
          
          // Convert to Prisma format
          const formattedNotes = supabaseNotes
            .map(note => convertToPrismaFormat(note, 'note'))
            .filter(note => note !== null)
            .sort((a, b) => 
              (b as Note).createdAt.getTime() - (a as Note).createdAt.getTime()
            ) as Note[];
            
          setNotes(formattedNotes);
          setDataSource('supabase');
        } else {
          // Fall back to SQLite
          const db = await connectWithFallback();
          const sqliteNotes = await db.note.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
          });
          
          setNotes(sqliteNotes as Note[]);
          setDataSource('sqlite');
        }
      } catch (err) {
        console.error('Error loading notes:', err);
        setError('Failed to load notes. Please try again.');
        
        // Attempt SQLite fallback if there was an error with Supabase
        try {
          const db = await connectWithFallback();
          const sqliteNotes = await db.note.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
          });
          
          setNotes(sqliteNotes as Note[]);
          setDataSource('sqlite');
        } catch (fallbackErr) {
          console.error('Both data sources failed:', fallbackErr);
          setError('All data sources unavailable. Please check your connection.');
        }
      } finally {
        setLoading(false);
      }
    }
    
    loadNotes();
  }, [patientId]);
  

  // Function to load notes
  const loadNotes = async () => {
    if (!patientId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // First try Supabase
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (isSupabaseAvailable) {
        // Get data from Supabase
        const supabaseNotes = await getSupabaseNotes(patientId);
        
        // Convert to Prisma format
        const formattedNotes = supabaseNotes
          .map(note => convertToPrismaFormat(note, 'note'))
          .filter(note => note !== null)
          .sort((a, b) => 
            (b as Note).createdAt.getTime() - (a as Note).createdAt.getTime()
          ) as Note[];
          
        setNotes(formattedNotes);
        setDataSource('supabase');
      } else {
        // Fall back to SQLite
        const db = await connectWithFallback();
        const sqliteNotes = await db.note.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        });
        
        setNotes(sqliteNotes as Note[]);
        setDataSource('sqlite');
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes. Please try again.');
      
      // Attempt SQLite fallback if there was an error with Supabase
      try {
        const db = await connectWithFallback();
        const sqliteNotes = await db.note.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        });
        
        setNotes(sqliteNotes as Note[]);
        setDataSource('sqlite');
      } catch (fallbackErr) {
        console.error('Both data sources failed:', fallbackErr);
        setError('All data sources unavailable. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading notes...</div>;
  if (error) return <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>;
  if (!patientId) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No patient selected</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
      {/* Source indicator with refresh button */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Data source: <span className="font-semibold">{dataSource}</span>
        </div>
        <button 
          type="button"
          onClick={() => loadNotes()}
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          title="Refresh notes"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {notes.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
            <FiFileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            No notes available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            This patient doesn't have any notes yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {notes.map(note => (
            <div 
              key={note.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                selectedNoteId === note.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
              }`}
              onClick={() => onNoteSelect && onNoteSelect(note)}
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <FiCalendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {new Date(note.createdAt).toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    note.isInitialVisit 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {note.isInitialVisit ? 'Initial Visit' : 'Follow-up'}
                  </span>
                </div>
                
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {note.summary || 'No summary available'}
                </div>
              </div>
              
              <details open={selectedNoteId === note.id} className={`${forceCollapse ? '' : 'group'}`}>
                <summary className="p-3 cursor-pointer list-none text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center">
                  <div className="flex-grow">View full note</div>
                  <div className="transform transition-transform group-open:rotate-180">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="p-4 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
                  {note.content}
                </div>
                
                {note.audioFileUrl && (
                  <div className="px-4 pb-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                      Audio Recording
                    </div>
                    <audio controls className="w-full" src={note.audioFileUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
