const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface Item {
  _id?: string;
  userId?: string;
  title: string;
  description: string;
  imageUrls?: string[];
  videoUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  _id?: string;
  userId?: string;
  displayName: string;
  bio: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/token`, {
      credentials: 'include', // Include cookies for session
    });
    if (response.ok) {
      const data = await response.json();
      return data.accessToken || null;
    } else {
      // 401 is expected when not logged in - return null silently
      // Don't log or throw errors for 401
      if (response.status === 401) {
        return null;
      }
      
      // Only log non-401 errors
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 500) {
        console.error('Token endpoint configuration error:', errorData);
      }
      // Don't log other errors either - just return null
    }
  } catch (error) {
    // Network errors - return null silently
    return null;
  }
  return null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = await getAccessToken();
  
  // If token fetch failed, try once more after a short delay
  if (!token) {
    await new Promise(resolve => setTimeout(resolve, 500));
    token = await getAccessToken();
  }
  
  if (!token) {
    throw new Error('Unable to get access token. Please check your authentication configuration.');
  }
  
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    const errorMessage = error.message || error.error || `HTTP error! status: ${response.status}`;
    
    throw new Error(errorMessage);
  }

  return response.json();
}

async function fetchPublic(url: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth API
  async login(): Promise<{ auth_url: string }> {
    return fetchPublic('/api/auth/login');
  },

  async loginEmailPassword(email: string, password: string): Promise<{ user: any; message: string }> {
    return fetchPublic('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string): Promise<{ user: any; message: string }> {
    return fetchPublic('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });
  },

  async logout(): Promise<{ logout_url?: string; message?: string }> {
    return fetchPublic('/api/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<any> {
    return fetchWithAuth('/api/auth/me');
  },

  async getItems(): Promise<Item[]> {
    return fetchWithAuth('/api/items');
  },

  async getItem(id: string): Promise<Item> {
    return fetchWithAuth(`/api/items/${id}`);
  },

  async createItem(item: { title: string; description: string; images?: File[]; videos?: File[] }): Promise<Item> {
    const formData = new FormData();
    formData.append('title', item.title);
    formData.append('description', item.description);
    
    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }
    
    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }
    
    return fetchWithAuth('/api/items', {
      method: 'POST',
      body: formData,
    });
  },

  async updateItem(id: string, item: { title?: string; description?: string; images?: File[]; videos?: File[]; imageUrls?: string[]; videoUrls?: string[] }): Promise<Item> {
    const formData = new FormData();
    if (item.title) formData.append('title', item.title);
    if (item.description) formData.append('description', item.description);
    
    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }
    
    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }
    
    // If no files but URLs provided, use JSON
    if (!item.images?.length && !item.videos?.length && (item.imageUrls || item.videoUrls)) {
      return fetchWithAuth(`/api/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          imageUrls: item.imageUrls,
          videoUrls: item.videoUrls,
        }),
      });
    }
    
    return fetchWithAuth(`/api/items/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },

  async deleteItem(id: string): Promise<void> {
    return fetchWithAuth(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },

  // Profile API
  async getProfile(): Promise<Profile> {
    return fetchWithAuth('/api/profiles');
  },

  async createProfile(profile: { displayName: string; bio: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    formData.append('displayName', profile.displayName);
    formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'POST',
      body: formData,
    });
  },

  async updateProfile(profile: { displayName?: string; bio?: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    if (profile.displayName) formData.append('displayName', profile.displayName);
    if (profile.bio !== undefined) formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'PUT',
      body: formData,
    });
  },

  async uploadImage(image: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', image);
    return fetchWithAuth('/api/profiles/image', {
      method: 'POST',
      body: formData,
    });
  },

  // Chat API (public endpoint, no auth required)
  async sendChatMessage(messages: Array<{ role: string; content: string }>, model?: string): Promise<{ message: string; usage?: any }> {
    return fetchPublic('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, model: model || 'openai/gpt-3.5-turbo' }),
    });
  },
};
