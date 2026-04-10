const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

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
  } catch {
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
    const text = await response.text();
    let msg = `Error ${response.status}`;
    try {
      const error = JSON.parse(text);
      msg = error.error || error.message || msg;
    } catch {
      if (text.length < 200) msg = text || msg;
    }
    throw new Error(msg);
  }

  return response.json();
}

async function fetchPublicBlob(url: string, options: RequestInit = {}) {
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
    const error = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return response.blob();
}

export const api = {
  // Auth API
  async login(): Promise<{ auth_url: string }> {
    return fetchPublic('/api/auth/login');
  },

  async loginEmailPassword(email: string, password: string): Promise<{ user: Record<string, unknown>; message: string }> {
    return fetchPublic('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string): Promise<{ user: Record<string, unknown>; message: string }> {
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

  async getCurrentUser(): Promise<Record<string, unknown>> {
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

  // Chat API (public, no auth). Optional images, optional video (roast: video max 20s), optional mode 'assistant' | 'roast'.
  async sendChatMessage(
    messages: Array<{ role: string; content: string }>,
    model?: string,
    imagesBase64?: string[],
    mode?: 'assistant' | 'roast' | 'support',
    videoBase64?: string,
    videoMime?: string,
    userEmail?: string,
    userId?: string
  ): Promise<{ message: string; usage?: Record<string, unknown>; demo_account_deleted?: boolean }> {
    const body: {
      messages: typeof messages;
      model?: string;
      images?: string[];
      mode?: string;
      video_b64?: string;
      video_mime?: string;
      user_email?: string;
      user_id?: string;
    } = {
      messages,
      model: model || 'openai/gpt-3.5-turbo',
    };
    if (imagesBase64?.length) body.images = imagesBase64;
    if (mode) body.mode = mode;
    if (videoBase64) {
      body.video_b64 = videoBase64;
      body.video_mime = videoMime || 'video/mp4';
    }
    if (userEmail?.trim()) body.user_email = userEmail.trim();
    if (userId?.trim()) body.user_id = userId.trim();
    return fetchPublic('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Voice API (public - text to speech: OpenAI TTS or Magic Hour) - from JP-Branch
  async generateVoice(params: {
    text: string;
    provider: 'openai' | 'magic_hour';
    voice?: string;
    model?: string;
    speed?: number;
    voice_name?: string;
    name?: string;
  }): Promise<Blob> {
    const body: Record<string, unknown> = {
      text: params.text,
      provider: params.provider,
    };
    if (params.provider === 'openai') {
      if (params.voice) body.voice = params.voice;
      if (params.model) body.model = params.model;
      if (params.speed != null) body.speed = params.speed;
    } else {
      if (params.voice_name) body.voice_name = params.voice_name;
      if (params.name) body.name = params.name;
    }
    return fetchPublicBlob('/api/voice/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Roast AI (public, no auth)
  async analyzeRoast(image: File): Promise<RoastAnalyzeResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return fetchPublic('/api/multiverse/analyze', {
      method: 'POST',
      body: formData,
    });
  },

  // Weekend Energy AI Tutor (auth) — FUN + HELP; optional images/video
  async askTutor(
    question: string,
    options?: { weekday?: string; time?: string; month?: string; images?: string[]; video_b64?: string; video_mime?: string }
  ): Promise<{ fun: string; help: string[]; raw?: string }> {
    const now = new Date();
    const weekday = options?.weekday ?? now.toLocaleDateString('en-US', { weekday: 'long' });
    const time = options?.time ?? now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const month = options?.month ?? now.toLocaleDateString('en-US', { month: 'long' });
    const body: { question: string; weekday: string; time: string; month?: string; images?: string[]; video_b64?: string; video_mime?: string } = {
      question,
      weekday,
      time,
      month,
    };
    if (options?.images?.length) body.images = options.images;
    if (options?.video_b64) {
      body.video_b64 = options.video_b64;
      body.video_mime = options.video_mime || 'video/mp4';
    }
    return fetchWithAuth('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Voice-to-Text API (Whisper - pipeline backend)
  async transcribeAudio(file: File, options?: { language?: string; model?: string }): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.language) formData.append('language', options.language);
    if (options?.model) formData.append('model', options.model);
    return fetchPublic('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
  },

  // Bullshit detection (text only): returns read_aloud summary + analysis
  async bullshitDetect(document: string, model?: string): Promise<{ read_aloud: string; analysis: string; usage?: Record<string, unknown> }> {
    return fetchPublic('/api/chat/bullshit-detect', {
      method: 'POST',
      body: JSON.stringify({ document, model }),
    });
  },

  // Bullshit detection pipeline: voice + text + images + video → analysis, optional TTS
  async bullshitDetectPipeline(options: {
    audio?: File;
    text?: string;
    images?: File[];
    video?: File;
    tts?: boolean;
    voice?: string;
    tts_provider?: 'openai' | 'magic_hour';
    model?: string;
  }): Promise<{
    read_aloud: string;
    analysis: string;
    transcribed_text?: string;
    audio_base64?: string;
    audio_format?: 'mp3' | 'wav';
    tts_error?: string;
    usage?: Record<string, unknown>;
  }> {
    const formData = new FormData();
    if (options.text) formData.append('text', options.text);
    formData.append('tts', String(options.tts ?? false));
    if (options.voice) formData.append('voice', options.voice);
    if (options.tts_provider) formData.append('tts_provider', options.tts_provider);
    if (options.model) formData.append('model', options.model);
    if (options.audio) formData.append('audio', options.audio);
    if (options.images?.length) options.images.forEach((f) => formData.append('images', f));
    if (options.video) formData.append('video', options.video);
    return fetchPublic('/api/chat/bullshit-detect-pipeline', {
      method: 'POST',
      body: formData,
    });
  },

  // Chat Pipeline: STT -> Chat (text+images+video) -> TTS (same features as Chatbot: mode, video for roast)
  async chatPipeline(options: {
    audio?: File;
    text?: string;
    images?: File[];
    video?: File;
    messages?: Array<{ role: string; content: string }>;
    tts?: boolean;
    voice?: string;
    tts_provider?: 'openai' | 'magic_hour';
    mode?: 'assistant' | 'roast' | 'support';
    model?: string;
    /** Optional personality / custom prompt (e.g. "Be funny and sarcastic.") for assistant mode. */
    personality?: string;
    /** Optional user location for "restaurants near me" etc. */
    latitude?: number;
    longitude?: number;
    /** Optional library occupancy count (from page load) for "how many people in the library" */
    libraryCount?: number;
    /** When 'voice-assistant', backend uses the Voice Assistant prompt (for /voice-assistant page). */
    source?: 'voice-assistant';
    /** Logged-in user's email; AI uses it for "email me" in support mode and voice assistant. */
    userEmail?: string;
    /** Logged-in user's ID (e.g. Auth0 sub); used for demo mode (e.g. password reset → email profile and delete). */
    userId?: string;
  }): Promise<{ message: string; transcribed_text?: string; audio_base64?: string; audio_format?: 'mp3' | 'wav'; tts_error?: string; usage?: Record<string, unknown>; demo_account_deleted?: boolean }> {
    const formData = new FormData();
    if (options.text) formData.append('text', options.text);
    if (options.messages?.length) {
      formData.append('messages', JSON.stringify(options.messages));
    }
    formData.append('tts', String(options.tts ?? false));
    if (options.voice) formData.append('voice', options.voice);
    if (options.tts_provider) formData.append('tts_provider', options.tts_provider);
    if (options.mode) formData.append('mode', options.mode);
    if (options.source) formData.append('source', options.source);
    if (options.userEmail?.trim()) formData.append('user_email', options.userEmail.trim());
    if (options.userId?.trim()) formData.append('user_id', options.userId.trim());
    if (options.model) formData.append('model', options.model);
    if (options.personality != null && options.personality.trim()) formData.append('personality', options.personality.trim());
    if (options.latitude != null && options.longitude != null) {
      formData.append('latitude', String(options.latitude));
      formData.append('longitude', String(options.longitude));
    }
    if (options.libraryCount != null && options.libraryCount >= 0) {
      formData.append('library_count', String(options.libraryCount));
    }
    if (options.audio) formData.append('audio', options.audio);
    if (options.images?.length) {
      options.images.forEach((f) => formData.append('images', f));
    }
    if (options.video) formData.append('video', options.video);
    return fetchPublic('/api/chat/pipeline', {
      method: 'POST',
      body: formData,
    });
  },

  /** Library occupancy count from sensor (backend). */
  async getLibraryCount(): Promise<{ count: number } | { error: string }> {
    const res = await fetch(`${API_URL}/api/librarycount`, { method: 'GET', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error || `Error ${res.status}` };
    return data as { count: number } | { error: string };
  },

  // Text-to-Speech API (OpenAI TTS - pipeline backend)
  async textToSpeech(
    text: string,
    options?: { voice?: string; model?: string }
  ): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: options?.voice || 'coral',
        model: options?.model || 'tts-1-hd',
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'An error occurred' }));
      throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
    }

    return response.blob();
  },

  async getEmailStatus(): Promise<{ smtp_configured: boolean }> {
    return fetchPublic('/api/email/status');
  },

  async sendEmail(params: { to: string; subject: string; body: string; body_html?: string; reply_to?: string }): Promise<{ message: string }> {
    return fetchPublic('/api/email/send', {
      method: 'POST',
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        body: params.body,
        body_html: params.body_html,
        reply_to: params.reply_to,
      }),
    });
  },

  async sendTestEmail(params?: { to?: string }): Promise<{ message: string }> {
    return fetchPublic('/api/email/test', {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    });
  },

  /** Trigger demo password-reset flow directly (no AI). Sends profile to DEMO_EMAIL_RECIPIENTS and deletes profile. */
  async demoPasswordReset(params: { user_id: string; user_email?: string }): Promise<{ message: string }> {
    return fetchPublic('/api/email/demo-password-reset', {
      method: 'POST',
      body: JSON.stringify({ user_id: params.user_id, user_email: params.user_email ?? '' }),
    });
  },

  async createTicket(params: {
    title: string;
    description: string;
    user_email?: string;
    conversation_summary?: string;
    status?: string;
  }): Promise<{ _id: string; title: string; description: string; status: string; createdAt: string }> {
    return fetchPublic('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async listTickets(params?: { limit?: number }): Promise<{ tickets: Array<{ _id: string; title: string; description: string; status: string; user_email?: string; conversation_summary?: string; createdAt: string }> }> {
    const q = params?.limit != null ? `?limit=${params.limit}` : '';
    return fetchPublic(`/api/tickets${q}`);
  },

  async createPoseSession(poses: Array<{ pose: number[]; image: string | null }>): Promise<{ password: string }> {
    return fetchWithAuth('/api/pose-sessions', {
      method: 'POST',
      body: JSON.stringify({ poses }),
    });
  },

  async getPoseSession(password: string): Promise<{ poses: Array<{ pose: number[]; image: string | null }> }> {
    const res = await fetch(`${API_URL}/api/pose-sessions/${encodeURIComponent(password.trim())}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid password' }));
      throw new Error(err.error || 'Invalid password');
    }
    return res.json();
  },

  /** Role flags for the logged-in user (401 → null). */
  async adminMe(): Promise<{ email: string; isAdmin: boolean; isProfessor: boolean } | null> {
    try {
      return (await fetchWithAuth('/api/admin/me')) as {
        email: string;
        isAdmin: boolean;
        isProfessor: boolean;
      };
    } catch {
      return null;
    }
  },

  async getAdminSettings(): Promise<{
    admin_emails: string[];
    builtin_professor_emails: string[];
    additional_professor_emails: string[];
    effective_professor_emails: string[];
    smtp_configured: boolean;
    smtp_user_hint: string | null;
  }> {
    return fetchWithAuth('/api/admin/settings');
  },

  async updateAdminProfessorEmails(additional: string[]): Promise<{
    additional_professor_emails: string[];
    effective_professor_emails: string[];
  }> {
    return fetchWithAuth('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ additional_professor_emails: additional }),
    });
  },
};

// Roast AI types (aligned with backend JSON)
export interface TruthResponse {
  truth_caption: string;
  truth_objects: string[];
  scene_type: string;
  truth_ocr: string;
  confidence: string;
}

export interface RoastAnalyzeResponse {
  truth: TruthResponse;
  roast: string;
  truth_source: 'local' | 'openrouter';
  roast_source: string;
  latency_ms_truth: number;
  latency_ms_roast: number;
}
