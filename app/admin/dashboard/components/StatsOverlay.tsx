
import { Activity, Bus, MapPin, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsOverlayProps {
    totalBuses: number;
    onlineBuses: number;
    activeRoutes: number;
    alerts?: number;
}

export function StatsOverlay({ totalBuses, onlineBuses, activeRoutes, alerts }: StatsOverlayProps) {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-4xl px-4 pointer-events-none">
            <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-700/50 text-slate-100 shadow-2xl p-2 rounded-full flex items-center justify-between pointer-events-auto mx-auto ring-1 ring-white/10">

                <div className="flex items-center gap-22 px-6">
                    {/* Metric: Total Fleet */}
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2 rounded-full ring-1 ring-blue-500/20">
                            <Bus className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Fleet</span>
                            <span className="text-lg font-bold font-mono text-white leading-none mt-0.5">{totalBuses}</span>
                        </div>
                    </div>

                    {/* Metric: Online */}
                    <div className="flex items-center gap-3 transition-colors duration-200 hover:bg-white rounded-lg px-2 py-1 group">
                        <div className={`p-2 rounded-full ring-1 group-hover:bg-slate-100 ${onlineBuses > 0 ? 'bg-green-500/10 ring-green-500/20' : 'bg-slate-700/50 ring-slate-600'}`}>
                            <Activity className={`w-4 h-4 group-hover:text-black ${onlineBuses > 0 ? 'text-green-400' : 'text-slate-500'}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none group-hover:text-black">Online</span>
                            <span className={`text-lg font-bold font-mono leading-none mt-0.5 group-hover:text-black ${onlineBuses > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                {onlineBuses}
                            </span>
                        </div>
                    </div>

                    {/* Metric: Routes */}
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-500/10 p-2 rounded-full ring-1 ring-purple-500/20">
                            <MapPin className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Routes</span>
                            <span className="text-lg font-bold font-mono text-white leading-none mt-0.5">{activeRoutes}</span>
                        </div>
                    </div>
                </div>

                {/* Metric: Alerts (Conditionally shown) */}
                {alerts && alerts > 0 ? (
                    <div className="flex items-center gap-3 px-4 border-l border-slate-700/50 ml-4">
                        <div className="bg-red-500/10 p-2 rounded-full ring-1 ring-red-500/20 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider leading-none">Alerts</span>
                            <span className="text-lg font-bold font-mono text-red-400 leading-none mt-0.5">{alerts}</span>
                        </div>
                    </div>
                ) : null}

            </Card>
        </div>
    );
}
