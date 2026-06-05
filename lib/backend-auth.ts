export async function fetchBackendAPI(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`/api/fleet${endpoint}`, options)
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  return {}
}
