'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAPIPage() {
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testTextAction = async () => {
    setLoading(true);
    setStatus('Testing...');
    setResult(null);

    try {
      // 获取token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const requestData = {
        agentId: 'bd8ab76c-d886-46ab-8545-e325cc938b6c',
        text: 'This is a test text for improvement',
        actionType: 'improve',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      };

      console.log('Sending request:', requestData);
      console.log('Token:', token.substring(0, 20) + '...');

      const response = await fetch('/api/agents/text-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      setResult(data);
      setStatus(`Success! Status: ${response.status}`);
    } catch (error: any) {
      console.error('Test failed:', error);
      setStatus(`Error: ${error.message}`);
      setResult({ error: error.message, stack: error.stack });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Text Action API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={testTextAction}
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Text Action API'}
          </Button>

          {status && (
            <div className="p-4 border rounded">
              <h3 className="font-semibold mb-2">Status:</h3>
              <p className={status.includes('Error') ? 'text-red-500' : 'text-green-500'}>
                {status}
              </p>
            </div>
          )}

          {result && (
            <div className="p-4 border rounded">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>Check browser console for detailed logs</p>
            <p>Agent ID: bd8ab76c-d886-46ab-8545-e325cc938b6c</p>
            <p>Endpoint: /api/agents/text-action</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}