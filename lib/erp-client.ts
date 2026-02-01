export interface ErpStudent {
  studentId: string
  name: string
  class: string
  section: string
}

export interface ErpLoginResponse {
  token: string
  student: ErpStudent
}

export async function getErpStudent(studentId: string): Promise<ErpStudent | null> {
  const res = await fetch(`/api/erp/student?studentId=${encodeURIComponent(studentId)}`, {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as ErpStudent
}

export async function erpLogin(username: string, password: string): Promise<ErpLoginResponse | null> {
  const res = await fetch(`/api/erp/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as ErpLoginResponse
}
