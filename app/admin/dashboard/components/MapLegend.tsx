
import React from 'react';
import { Card } from "@/components/ui/card";

export function MapLegend() {
    return (
        <div className="absolute bottom-6 left-6 z-20">
            <Card className="bg-slate-900/80 backdrop-blur-md border-slate-700 p-3 shadow-xl">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Map Legend</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 hover:bg-white hover:text-black rounded px-2 py-1 transition-colors duration-200">
                        <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                        <span className="text-xs text-slate-200 hover:text-black">Online Bus</span>
                    </div>
                    <div className="flex items-center gap-2 hover:bg-white hover:text-black rounded px-2 py-1 transition-colors duration-200">
                        <span className="w-3 h-3 rounded-full bg-slate-500 text-black"></span>
                        <span className="text-xs text-slate-400 hover:text-black">Offline Bus</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 border border-red-900"></span>
                        <span className="text-xs text-slate-200">Stop (Pending)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 border border-green-900"></span>
                        <span className="text-xs text-slate-200">Stop (Passed)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-1 bg-blue-500 rounded-full"></span>
                        <span className="text-xs text-slate-200">Active Route</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
