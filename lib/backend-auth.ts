/**
 * Backend API Authentication Service
 * Handles JWT token management for FastAPI backend
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Default backend credentials (for server-side API calls)
const BACKEND_USERNAME = process.env.BACKEND_API_USERNAME || 'admin';
const BACKEND_PASSWORD = process.env.BACKEND_API_PASSWORD || 'admin123';

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    username: string;
    role: string;
    email: string;
  };
}

class BackendAuthService {
  private static instance: BackendAuthService;
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  private constructor() {}

  static getInstance(): BackendAuthService {
    if (!BackendAuthService.instance) {
      BackendAuthService.instance = new BackendAuthService();
    }
    return BackendAuthService.instance;
  }

  /**
   * Login to backend and get JWT token
   */
  async login(username?: string, password?: string): Promise<string> {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username || BACKEND_USERNAME,
          password: password || BACKEND_PASSWORD,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data: LoginResponse = await response.json();
      this.token = data.access_token;
      
      // JWT tokens expire in 30 minutes by default
      // Store expiry time (current time + 25 minutes for safety margin)
      this.tokenExpiry = Date.now() + 25 * 60 * 1000;

      return this.token;
    } catch (error) {
      console.error('Backend authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get current token, refreshing if expired
   */
  async getToken(): Promise<string> {
    // If no token or token expired, login again
    if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      console.log('Token expired or missing, logging in...');
      await this.login();
    }

    return this.token!;
  }

  /**
   * Make authenticated request to backend API
   */
  async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    return fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });
  }

  /**
   * Clear stored token (logout)
   */
  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
  }
}

// Export singleton instance
export const backendAuth = BackendAuthService.getInstance();

/**
 * Helper function for authenticated backend API calls
 */
export async function fetchBackendAPI(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return backendAuth.fetch(endpoint, options);
}

/**
 * Helper to get authenticated fetch headers
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await backendAuth.getToken();
  return {
    'Authorization': `Bearer ${token}`,
  };
}
