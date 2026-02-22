import { NextResponse } from 'next/server';

// Proxy to backend auth token endpoint
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function GET(request: Request) {
  try {
    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}
