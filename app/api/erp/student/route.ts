import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admNo = searchParams.get('adm_no');

  if (!admNo) {
    return NextResponse.json({ error: 'Admission Number required' }, { status: 400 });
  }

  // Mock Data Lookup
  // In production, this would call your actual ERP API
  const mockDB: Record<string, any> = {
    '12345': { name: 'Rahul Sharma', bus_no: 'BUS-101', class: '10-A' },
    '67890': { name: 'Priya Patel', bus_no: 'Rx-05', class: '5-B' },
    '11111': { name: 'Amit Kumar', bus_no: 'Route-55', class: '8-C' },
  };

  const student = mockDB[admNo];

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Server-Side Bus Resolution
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const busesRef = adminDb.collection(`artifacts/${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}/public/data/buses`);
    const q = busesRef.where('erpId', '==', student.bus_no).limit(1);
    const snapshot = await q.get();

    let deviceId = null;
    if (!snapshot.empty) {
      deviceId = snapshot.docs[0].data().busId;
    }

    return NextResponse.json({
      ...student,
      deviceId, // Return resolved device ID
      found: !!deviceId
    });
  } catch (error) {
    console.error("Firestore Admin Error:", error);
    // Return student data anyway, let client handle missing bus
    return NextResponse.json({ ...student, deviceId: null, error: "Database error" });
  }
}
