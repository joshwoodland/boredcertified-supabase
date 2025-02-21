import lamejs from 'lamejs';

export async function convertToMp3(audioData: Float32Array, sampleRate: number): Promise<Blob> {
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  
  // Convert Float32Array to Int16Array
  const samples = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    samples[i] = audioData[i] < 0 ? audioData[i] * 0x8000 : audioData[i] * 0x7FFF;
  }

  // Encode to MP3
  const mp3Data = [];
  const blockSize = 1152; // Multiple of 576
  for (let i = 0; i < samples.length; i += blockSize) {
    const sampleChunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  // Get the last chunk of MP3 data
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  // Combine all chunks into a single Blob
  return new Blob(mp3Data, { type: 'audio/mp3' });
} 