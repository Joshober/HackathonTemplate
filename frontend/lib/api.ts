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

export type ObjectiveLevel = 'strategic' | 'functional' | 'tactical';
export type ObjectiveTimeline = 'annual' | 'quarterly';

export type WorkflowState = 'draft' | 'submitted' | 'under_review' | 'approved' | 'active' | 'completed' | 'archived';

export interface Objective {
  _id?: string;
  title: string;
  description?: string;
  ownerId?: string;
  level: ObjectiveLevel;
  timeline: ObjectiveTimeline;
  fiscalYear: number;
  quarter?: string;
  parentObjectiveId?: string | null;
  division?: string;
  workflowState?: WorkflowState;
  workflowHistory?: Array<{
    state: string;
    userId: string;
    timestamp: string;
    reason?: string;
    comment?: string;
  }>;
  permissions?: {
    viewOnly?: string[];
    editKeyResults?: string[];
    editObjective?: string[];
    fullControl?: string[];
  };
  riskFlag?: boolean;
  milestones?: Array<{
    title: string;
    date: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  dependencies?: Array<{
    objectiveId: string;
    type: 'upstream' | 'downstream' | 'blocks' | 'depends_on' | 'related';
    impact: 'high' | 'medium' | 'low';
    progress: number;
    isAtRisk: boolean;
    linkedAt?: string;
    linkedBy?: string;
  }>;
  files?: Array<{
    fileId: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    uploadedBy: string;
    uploadedAt: string;
    associatedWith: 'objective' | 'key_result';
    keyResultId?: string;
  }>;
  pinnedFields?: {
    theme?: string;
    roadmap?: string;
    customerSegments?: string;
    value?: string;
    documents?: string;
    overallNecessity?: string;
    deliveryProgress?: number;
  };
  lastModified?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ObjectiveTree extends Objective {
  children: ObjectiveTree[];
  keyResults: KeyResult[];
  averageScore?: number | null;
}

export interface KeyResult {
  _id?: string;
  objectiveId: string;
  title: string;
  target?: string;
  currentValue?: string;
  unit?: string;
  score?: number | null;
  ownerId?: string;
  partnerId?: string;
  expectedEoQScore?: number;
  notes?: Array<{
    text: string;
    date: string;
    userId: string;
    createdAt: string;
  }>;
  scoreHistory?: Array<{
    score: number;
    timestamp: string;
    userId: string;
    note?: string;
  }>;
  targetDate?: string;
  velocity?: number;
  lastModified?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
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

  // OKRs API
  async getObjectives(params?: { fiscalYear?: number; level?: string; division?: string; parentObjectiveId?: string | null }): Promise<Objective[]> {
    const search = new URLSearchParams();
    if (params?.fiscalYear != null) search.set('fiscalYear', String(params.fiscalYear));
    if (params?.level) search.set('level', params.level);
    if (params?.division) search.set('division', params.division);
    if (params?.parentObjectiveId !== undefined) search.set('parentObjectiveId', params.parentObjectiveId ?? '');
    const q = search.toString();
    return fetchWithAuth(`/api/objectives${q ? `?${q}` : ''}`);
  },

  async getObjective(id: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}`);
  },

  async getObjectiveTree(id: string): Promise<ObjectiveTree> {
    return fetchWithAuth(`/api/objectives/${id}/tree`);
  },

  async createObjective(obj: Partial<Objective> & { title: string; fiscalYear: number }): Promise<Objective> {
    return fetchWithAuth('/api/objectives', {
      method: 'POST',
      body: JSON.stringify(obj),
    });
  },

  async updateObjective(id: string, obj: Partial<Objective>): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(obj),
    });
  },

  async deleteObjective(id: string): Promise<void> {
    return fetchWithAuth(`/api/objectives/${id}`, { method: 'DELETE' });
  },

  async getKeyResults(objectiveId: string): Promise<KeyResult[]> {
    return fetchWithAuth(`/api/key-results?objectiveId=${encodeURIComponent(objectiveId)}`);
  },

  async getKeyResult(id: string): Promise<KeyResult> {
    return fetchWithAuth(`/api/key-results/${id}`);
  },

  async createKeyResult(kr: { objectiveId: string; title: string; target?: string; currentValue?: string; unit?: string }): Promise<KeyResult> {
    return fetchWithAuth('/api/key-results', {
      method: 'POST',
      body: JSON.stringify(kr),
    });
  },

  async updateKeyResult(id: string, kr: Partial<KeyResult>): Promise<KeyResult> {
    return fetchWithAuth(`/api/key-results/${id}`, {
      method: 'PUT',
      body: JSON.stringify(kr),
    });
  },

  async deleteKeyResult(id: string): Promise<void> {
    return fetchWithAuth(`/api/key-results/${id}`, { method: 'DELETE' });
  },

  // Workflow API
  async submitObjective(id: string, data?: { reason?: string; comment?: string }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/workflow/submit`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async approveObjective(id: string, data?: { reason?: string; comment?: string }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/workflow/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async rejectObjective(id: string, data: { reason: string; comment?: string }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/workflow/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async requestChanges(id: string, data: { reason: string; comment?: string }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/workflow/request-changes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getWorkflowHistory(id: string): Promise<any[]> {
    return fetchWithAuth(`/api/objectives/${id}/workflow/history`);
  },

  // Permissions API
  async getPermissions(id: string): Promise<{
    permissionLevel: string;
    canView: boolean;
    canEditKR: boolean;
    canEditObjective: boolean;
    canDelete: boolean;
    canChangeWorkflow: boolean;
  }> {
    return fetchWithAuth(`/api/objectives/${id}/permissions`);
  },

  async updatePermissions(id: string, permissions: any): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    });
  },

  // Audit API
  async getObjectiveAudit(id: string): Promise<any[]> {
    return fetchWithAuth(`/api/objectives/${id}/audit`);
  },

  async getKeyResultAudit(id: string): Promise<any[]> {
    return fetchWithAuth(`/api/key-results/${id}/audit`);
  },

  // Real-time API
  async getObjectiveUpdates(id: string, since?: string): Promise<{
    hasUpdates: boolean;
    lastModified: string;
    objectiveUpdates: any;
    keyResultUpdates: any[];
  }> {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return fetchWithAuth(`/api/objectives/${id}/updates${params}`);
  },

  // Dependencies API
  async getDependencies(id: string): Promise<{ upstream: any[]; downstream: any[] }> {
    return fetchWithAuth(`/api/objectives/${id}/dependencies`);
  },

  async addDependency(id: string, data: {
    objectiveId: string;
    type?: string;
    impact?: string;
    progress?: number;
    isAtRisk?: boolean;
  }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/dependencies`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDependency(id: string, depId: string, data: {
    progress?: number;
    isAtRisk?: boolean;
    impact?: string;
    type?: string;
  }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/dependencies/${depId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async removeDependency(id: string, depId: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/dependencies/${depId}`, {
      method: 'DELETE',
    });
  },

  async searchObjectives(params: {
    q?: string;
    department?: string;
    level?: string;
    fiscalYear?: number;
  }): Promise<Objective[]> {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.department) search.set('department', params.department);
    if (params.level) search.set('level', params.level);
    if (params.fiscalYear) search.set('fiscalYear', String(params.fiscalYear));
    const q = search.toString();
    return fetchWithAuth(`/api/objectives/search${q ? `?${q}` : ''}`);
  },

  // Files API
  async uploadFile(objectiveId: string, file: File, data?: {
    associatedWith?: 'objective' | 'key_result';
    keyResultId?: string;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (data?.associatedWith) formData.append('associatedWith', data.associatedWith);
    if (data?.keyResultId) formData.append('keyResultId', data.keyResultId);
    return fetchWithAuth(`/api/objectives/${objectiveId}/files`, {
      method: 'POST',
      body: formData,
    });
  },

  async listFiles(objectiveId: string): Promise<any[]> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/files`);
  },

  async getFileMetadata(fileId: string): Promise<any> {
    return fetchWithAuth(`/api/files/${fileId}`);
  },

  async downloadFile(fileId: string): Promise<{ downloadUrl: string; filename: string }> {
    return fetchWithAuth(`/api/files/${fileId}/download`);
  },

  async getFilePreview(fileId: string): Promise<{ previewUrl: string }> {
    return fetchWithAuth(`/api/files/${fileId}/preview`);
  },

  async deleteFile(fileId: string): Promise<void> {
    return fetchWithAuth(`/api/files/${fileId}`, { method: 'DELETE' });
  },

  // Pinned Fields API
  async updatePinnedFields(id: string, fields: {
    theme?: string;
    roadmap?: string;
    customerSegments?: string;
    value?: string;
    documents?: string;
    overallNecessity?: string;
    deliveryProgress?: number;
  }): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${id}/pinned-fields`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
  },
};
