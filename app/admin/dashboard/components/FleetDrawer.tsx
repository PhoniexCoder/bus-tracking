
"use client";

import { useState } from "react";
import { Bus, Search, ChevronLeft, ChevronRight, X, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeviceStatus } from "@/lib/fleet-types";

interface FleetDrawerProps {
    buses: any[];
    onSelectBus: (busId: string) => void;
    onManageBus: (busId: string) => void;
    selectedBusId: string | null;
    className?: string;
}

export function FleetDrawer({ buses, onSelectBus, onManageBus, selectedBusId, className }: FleetDrawerProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

    const filteredBuses = buses.filter(bus => {
        const matchesSearch = bus.status.vid.toLowerCase().includes(search.toLowerCase()) ||
            (bus.plate_number && bus.plate_number.toLowerCase().includes(search.toLowerCase()));

        const matchesFilter = filter === 'all'
            ? true
            : filter === 'online' ? bus.status.ol === 1
                : bus.status.ol !== 1;

        return matchesSearch && matchesFilter;
    });

    return (
        <>
            {/* Toggle Button (when closed) */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="absolute left-6 top-6 z-20 bg-slate-900/90 border border-slate-700 text-white hover:bg-slate-800 shadow-xl"
                >
                    <Bus className="w-4 h-4 mr-2" /> Fleet
                </Button>
            )}

            {/* Drawer Panel */}
            <div
                className={`absolute top-4 bottom-4 left-4 w-80 z-20 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-[110%]'
                    } ${className}`}
            >
                <Card className="h-full bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-100 flex flex-col shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <Bus className="w-5 h-5 text-blue-400" />
                                Fleet Control
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Search buses..."
                                className="pl-9 bg-slate-950/50 border-slate-700 text-sm focus:border-blue-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex gap-2">
                            <Button
                                variant={filter === 'all' ? 'secondary' : 'ghost'}
                                size="sm"
                                className={`flex-1 text-xs transition-colors duration-200 ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-white hover:text-black'}`}
                                onClick={() => setFilter('all')}
                            >
                                All
                            </Button>
                            <Button
                                variant={filter === 'online' ? 'secondary' : 'ghost'}
                                size="sm"
                                className={`flex-1 text-xs transition-colors duration-200 ${filter === 'online' ? 'bg-green-900/30 text-green-400 border border-green-900/50 hover:bg-white hover:text-black' : 'text-slate-400 hover:bg-white hover:text-black'}`}
                                onClick={() => setFilter('online')}
                            >
                                Online
                            </Button>
                            <Button
                                variant={filter === 'offline' ? 'secondary' : 'ghost'}
                                size="sm"
                                className={`flex-1 text-xs transition-colors duration-200 ${filter === 'offline' ? 'bg-slate-700 text-slate-300 hover:bg-white hover:text-black' : 'text-slate-400 hover:bg-white hover:text-black'}`}
                                onClick={() => setFilter('offline')}
                            >
                                Offline
                            </Button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {filteredBuses.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 text-sm">
                                No buses found
                            </div>
                        ) : filteredBuses.map((bus) => (
                            <div
                                key={bus.status.id}
                                onClick={() => onSelectBus(bus.status.vid)}
                                className={`
                  p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-800/80
                  ${selectedBusId === bus.status.vid
                                        ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                        : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'}
                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-mono font-bold text-sm ${selectedBusId === bus.status.vid ? 'text-blue-400' : 'text-slate-200'}`}>
                                        {bus.plate_number || bus.status.vid}
                                    </span>
                                    {bus.status.ol === 1 ? (
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1.5 py-0 h-5">
                                            LIVE
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-700/50 text-slate-400 border-slate-600 text-[10px] px-1.5 py-0 h-5">
                                            OFF
                                        </Badge>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-500 hover:text-white hover:bg-slate-700"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onManageBus(bus.status.vid);
                                        }}
                                    >
                                        <Filter className="w-3 h-3" />
                                    </Button>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-slate-500">ID: {bus.status.vid}</span>
                                        {bus.status.ps && bus.status.ps !== '0' && (
                                            <span className="text-[10px] text-blue-300 font-mono">{bus.status.ps} km/h</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer (Total count) */}
                    <div className="p-3 bg-slate-900/80 border-t border-slate-800 text-xs text-center text-slate-500">
                        Showing {filteredBuses.length} of {buses.length} units
                    </div>

                </Card>
            </div>
        </>
    );
}
