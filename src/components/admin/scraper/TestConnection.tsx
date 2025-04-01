import { useState } from 'react';
import { testScraperCredentials } from '../../../lib/scraper';

export default function TestConnection({ credentials }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleTest = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setLogs([]);

    addLog('🔄 Starting connection test...');

    try {
      await testScraperCredentials(credentials);
      setSuccess(true);
      addLog('✅ Connection test successful');
    } catch (err: any) {
      setError(err.message);
      addLog(`❌ Test failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleTest}
        disabled={isLoading}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
          isLoading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verbinding testen...
          </>
        ) : (
          'Test verbinding'
        )}
      </button>

      {/* Results */}
      {(error || success) && (
        <div className={`rounded-md p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {error ? (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${error ? 'text-red-800' : 'text-green-800'}`}>
                {error ? 'Verbinding mislukt' : 'Verbinding succesvol'}
              </h3>
              {error && (
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Logs */}
      {logs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Debug Log</h4>
          <div className="bg-gray-50 rounded-md p-4 font-mono text-sm max-h-48 overflow-y-auto space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-600">{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}