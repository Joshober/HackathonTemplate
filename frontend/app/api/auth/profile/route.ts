import { NextResponse } from 'next/server';

// Proxy to backend auth me endpoint
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: Request) {
  try {
    // Get token from backend first
    const tokenResponse = await fetch(`${API_URL}/api/auth/token`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.accessToken;

    // Get user info from backend
    const userResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info' },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();
    return NextResponse.json(userData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}
