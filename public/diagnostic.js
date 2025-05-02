// Diagnostic script to check IndexedDB for audio recordings
async function checkAudioRecordings() {
  console.log('Running audio recordings diagnostic...');
  
  // Check if IndexedDB is available
  if (!window.indexedDB) {
    console.error('IndexedDB is not supported in this browser');
    return;
  }
  
  try {
    // Open the database
    const dbRequest = indexedDB.open('AudioRecordingsDB', 1);
    
    dbRequest.onerror = function(event) {
      console.error('Error opening database:', event);
    };
    
    dbRequest.onsuccess = function(event) {
      const db = event.target.result;
      console.log('Successfully opened database:', db.name, 'version:', db.version);
      
      // Check if the recordings store exists
      if (!db.objectStoreNames.contains('recordings')) {
        console.error('No "recordings" store found in the database');
        return;
      }
      
      // Get all recordings
      const transaction = db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const request = store.getAll();
      
      request.onsuccess = function() {
        const recordings = request.result;
        console.log(`Found ${recordings.length} recordings in IndexedDB`);
        
        if (recordings.length === 0) {
          console.log('No recordings found. This could indicate that recordings are not being saved properly.');
        } else {
          console.log('Recordings found:');
          recordings.forEach((recording, index) => {
            console.log(`Recording ${index + 1}:`);
            console.log('- ID:', recording.id);
            console.log('- Name:', recording.name);
            console.log('- Size:', recording.size, 'bytes');
            console.log('- Type:', recording.type);
            console.log('- Has blob data:', !!recording.blob);
            
            // Check if the blob is valid
            if (recording.blob) {
              console.log('- Blob type:', recording.blob.type);
              console.log('- Blob size:', recording.blob.size, 'bytes');
            }
            
            // Check if the URL is valid
            if (recording.url) {
              console.log('- URL starts with blob:', recording.url.startsWith('blob:'));
            }
          });
        }
      };
      
      request.onerror = function(event) {
        console.error('Error getting recordings:', event);
      };
    };
    
    dbRequest.onupgradeneeded = function(event) {
      console.log('Database upgrade needed - this is normal if this is the first time running the app');
      const db = event.target.result;
      
      // Create object store for recordings if it doesn't exist
      if (!db.objectStoreNames.contains('recordings')) {
        const store = db.createObjectStore('recordings', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        console.log('Created "recordings" store');
      }
    };
  } catch (error) {
    console.error('Error in diagnostic script:', error);
  }
}

// Run the diagnostic
checkAudioRecordings();

// Also check for any console errors during recording
console.log('Recent console errors:', window.consoleErrors || 'No errors tracked');
