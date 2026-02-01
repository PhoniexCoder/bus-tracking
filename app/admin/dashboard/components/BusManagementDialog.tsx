
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bus, MapPin, Save, Trash2, Plus, X } from "lucide-react";
import { StopsList } from "./StopsList";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BusManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bus: any; // BusDisplayData
    stops: any[];
    onUpdateBus: (data: any) => Promise<void>;
    onDeleteBus: (id: string) => Promise<void>;
    addStopToBus: (stop: any) => Promise<void>;
    deleteStopFromBus: (index: number) => Promise<void>;
    estimateTimeToStop: (lat: number, lng: number, sLat: number, sLng: number) => number;
}

export function BusManagementDialog({
    isOpen,
    onClose,
    bus,
    stops,
    onUpdateBus,
    onDeleteBus,
    addStopToBus,
    deleteStopFromBus,
    estimateTimeToStop,
}: BusManagementDialogProps) {
    const [activeTab, setActiveTab] = useState("route");
    const [newStop, setNewStop] = useState({ name: "", latitude: "", longitude: "" });
    const [saving, setSaving] = useState(false);

    // Local state for editing bus details
    const [editData, setEditData] = useState({
        busId: bus?.status?.vid || "",
        plateNumber: bus?.plate_number || "",
        capacity: bus?.assignment?.capacity || bus?.device_info?.capacity || "50",
        model: bus?.assignment?.model || "",
        notes: bus?.assignment?.notes || "",
    });

    // Sync state when bus changes
    React.useEffect(() => {
        if (bus) {
            setEditData({
                busId: bus.status.vid,
                plateNumber: bus.plate_number || bus.status.vid,
                capacity: bus.assignment?.capacity || "50",
                model: bus.assignment?.model || "",
                notes: bus.assignment?.notes || "",
            });
        }
    }, [bus]);

    const handleSaveDetails = async () => {
        setSaving(true);
        try {
            await onUpdateBus(editData);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleAddStop = async () => {
        if (!newStop.name || !newStop.latitude || !newStop.longitude) return;
        await addStopToBus(newStop);
        setNewStop({ name: "", latitude: "", longitude: "" });
    };

    if (!bus) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] bg-slate-900 text-slate-100 border-slate-700 h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-slate-800/50 border-b border-slate-700">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <span className="bg-blue-600/20 p-2 rounded-lg"><Bus className="w-5 h-5 text-blue-500" /></span>
                        Manage Bus: {editData.plateNumber}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-2 bg-slate-800/50 border-b border-slate-700">
                        <TabsList className="bg-transparent p-0 gap-6">
                            <TabsTrigger value="route" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 pb-2 text-slate-400 data-[state=active]:text-blue-400">
                                Route & Stops
                            </TabsTrigger>
                            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 pb-2 text-slate-400 data-[state=active]:text-blue-400">
                                Vehicle Details
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden bg-slate-950/50">
                        <TabsContent value="route" className="h-full flex flex-col m-0 p-0">
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Existing Stops List (Reusing logic but styling might need tweaks if StopsList is rigid) */}
                                {/* Note: StopsList expects 'overview' but mostly uses it for id/address. We fake it. */}
                                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
                                    <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Current Route
                                    </h3>
                                    <div className="space-y-2">
                                        {/* We might need to adapt StopsList styling or rebuild it here. 
                          For high quality, let's keep it simple here and assume StopsList works or rebuild simple list. 
                          Checking StopsList.tsx... it uses white bg. We might want to override or just accept it.
                          Actually, let's roll a custom dark-mode friendly list here for better UI.
                      */}
                                        {stops.length === 0 ? (
                                            <div className="text-center py-8 text-slate-600 border-2 border-dashed border-slate-800 rounded-lg">
                                                No stops configured. Add one below.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {stops.map((stop, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-900/50 text-blue-400 text-xs font-bold font-mono">
                                                                {idx + 1}
                                                            </span>
                                                            <div>
                                                                <p className="font-medium text-slate-200">{stop.name}</p>
                                                                <p className="text-xs text-slate-500 font-mono">{stop.latitude}, {stop.longitude}</p>
                                                            </div>
                                                        </div>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20" onClick={() => deleteStopFromBus(idx)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Add Stop Form */}
                                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                                    <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Add New Stop
                                    </h3>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Stop Name</Label>
                                            <Input
                                                className="bg-slate-950 border-slate-700"
                                                placeholder="e.g. Central Station"
                                                value={newStop.name}
                                                onChange={e => setNewStop({ ...newStop, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Latitude</Label>
                                                <Input
                                                    type="number"
                                                    className="bg-slate-950 border-slate-700"
                                                    value={newStop.latitude}
                                                    onChange={e => setNewStop({ ...newStop, latitude: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Longitude</Label>
                                                <Input
                                                    type="number"
                                                    className="bg-slate-950 border-slate-700"
                                                    value={newStop.longitude}
                                                    onChange={e => setNewStop({ ...newStop, longitude: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-500 mt-2"
                                            onClick={handleAddStop}
                                            disabled={!newStop.name || !newStop.latitude || !newStop.longitude}
                                        >
                                            Add Stop to Route
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="details" className="h-full p-6 m-0 overflow-y-auto">
                            <div className="space-y-4 max-w-md mx-auto">
                                <div className="space-y-2">
                                    <Label>Plate Number</Label>
                                    <Input
                                        className="bg-slate-950 border-slate-700"
                                        value={editData.plateNumber}
                                        onChange={e => setEditData({ ...editData, plateNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Capacity</Label>
                                    <Input
                                        type="number"
                                        className="bg-slate-950 border-slate-700"
                                        value={editData.capacity}
                                        onChange={e => setEditData({ ...editData, capacity: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <Input
                                        className="bg-slate-950 border-slate-700"
                                        value={editData.model}
                                        onChange={e => setEditData({ ...editData, model: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Input
                                        className="bg-slate-950 border-slate-700"
                                        value={editData.notes}
                                        onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                    />
                                </div>

                                <div className="pt-8 flex flex-col gap-4">
                                    <Button className="w-full bg-blue-600 hover:bg-blue-500" onClick={handleSaveDetails} disabled={saving}>
                                        {saving ? "Saving..." : "Save Changes"}
                                    </Button>
                                    <Button variant="destructive" className="w-full border-red-900 text-white hover:bg-red-800" onClick={() => onDeleteBus(editData.busId)}>
                                        Delete Bus
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
