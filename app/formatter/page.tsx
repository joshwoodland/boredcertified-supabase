import SoapNoteFormatter from '../components/SoapNoteFormatter';

export const metadata = {
  title: 'SOAP Note Formatter - Lindy Medical',
  description: 'Format markdown SOAP notes into clean, formatted text or HTML',
};

export default function FormatterPage() {
  return (
    <main className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">SOAP Note Formatter</h1>
      <p className="mb-6 max-w-3xl">
        This tool converts markdown-style SOAP notes into clean, formatted text that's 
        ready to paste into an EMR or share with colleagues. Try entering your own note 
        or use the example provided.
      </p>
      
      <SoapNoteFormatter />
      
      <div className="mt-8 pt-6 border-t max-w-3xl">
        <h2 className="text-xl font-semibold mb-4">About This Tool</h2>
        <p className="mb-4">
          The formatter was designed to clean up raw LLM output from the SOAP note generation 
          feature in this application. It removes markdown symbols while preserving the 
          document structure, making your notes look professional and standardized.
        </p>
        <p className="mb-4">
          The formatter handles:
        </p>
        <ul className="list-disc ml-6 mb-4 space-y-1">
          <li>Headings (converting <code>###</code> to bold text)</li>
          <li>Subsection titles (keeping them bold)</li>
          <li>Bullet points (converting to proper HTML lists)</li>
          <li>Paragraph spacing</li>
        </ul>
        <p>
          You can choose between HTML output (for rich text applications), plain text (for simple text editors),
          or view the raw markdown.
        </p>
      </div>
    </main>
  );
} 