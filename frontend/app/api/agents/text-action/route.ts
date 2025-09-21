import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');

    if (!token) {
      return NextResponse.json(
        { error: 'No authorization token' },
        { status: 401 }
      );
    }

    // 创建一个AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时（GPT-4需要更长时间）

    try {
      const response = await fetch('http://localhost:8080/api/agents/text-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: errorText || `HTTP ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - AI processing taking too long' },
          { status: 504 }
        );
      }

      throw error;
    }

  } catch (error: any) {
    console.error('Text action API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}