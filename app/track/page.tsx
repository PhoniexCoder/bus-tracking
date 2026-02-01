"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FirestoreService } from '@/lib/firestore';
import { Bus, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

function TrackPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState('');

    useEffect(() => {
        const resolveBus = async () => {
            const admNo = searchParams.get('adm_no');

            if (!admNo) {
                setError('Missing Admission Number (adm_no) in URL');
                return;
            }

            try {
                setStatus('Fetching Student & Bus Details...');
                // 1. Call ERP API (Now returns deviceId directly)
                const erpRes = await fetch(`/api/erp/student?adm_no=${admNo}`);
                const data = await erpRes.json();

                if (!erpRes.ok) {
                    throw new Error(data.error || 'Failed to fetch student data');
                }

                const { name, bus_no, deviceId } = data;

                if (deviceId) {
                    setStatus(`Found ${name}. Tracking Bus ${bus_no}...`);
                    // 2. Redirect immediately using the resolved ID
                    router.push(`/parent/dashboard?busId=${deviceId}&studentName=${encodeURIComponent(name)}`);
                } else {
                    setError(`Bus "${bus_no}" is not linked to any GPS device. Please contact admin.`);
                }

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'An unexpected error occurred');
            }
        };

        resolveBus();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md border-red-200 bg-red-50">
                    <CardContent className="pt-6 text-center text-red-700">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                        <h2 className="text-lg font-bold mb-2">Tracking Error</h2>
                        <p>{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <Bus className="w-16 h-16 text-blue-400 relative z-10" />
                </div>
                <div className="flex items-center gap-3 text-xl font-medium text-blue-100">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {status}
                </div>
            </div>
        </div>
    );
}

export default function TrackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
        }>
            <TrackPageContent />
        </Suspense>
    );
}
