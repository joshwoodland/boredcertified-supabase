import DeepgramTest from '@/app/components/DeepgramTest';

export const metadata = {
  title: 'Deepgram Connection Test',
  description: 'Diagnostic page for testing Deepgram API connection',
};

export default function DeepgramDebugPage() {
  return (
    <div className="container mx-auto py-8">
      <DeepgramTest />
    </div>
  );
}
