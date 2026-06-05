// Displays a single bus card with all info, stops, and actions


import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bus, MapPin, Clock, Edit, Save, X, Trash2 } from "lucide-react";
import { StopsList } from "./StopsList";
import { StopPickerMap } from "@/components/stop-picker-map";
import { FirestoreService } from "@/lib/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function FleetCard({
  overview,
  stops,
  newStop,
  setNewStop,
  deleteStopFromBus,
  addStopToBus,
  estimateTimeToStop,
  sensors,
  user,
  onUpdateBus,
  onDeleteBus,
  busData
}: any) {

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState({
    busId: '',
    plateNumber: '',
    capacity: '',
    model: '',
    year: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleEditClick = async () => {
    // Find the bus data from Firestore
    const deviceId = overview.status.id;
    
    // Fetch current bus data from Firestore if user is available
    if (user) {
      try {
        const firestoreService = new FirestoreService(user.sub);
        const allBuses = await firestoreService.getAllBuses();
        const busData = allBuses.find(b => b.busId === deviceId);
        
        if (busData) {
          setEditingBus({
            busId: deviceId,
            plateNumber: busData.plateNumber || '',
            capacity: busData.capacity?.toString() || '50',
            model: busData.model || '',
            year: busData.year?.toString() || new Date().getFullYear().toString(),
            notes: busData.notes || '',
          });
        } else {
          // No existing data, use defaults
          setEditingBus({
            busId: deviceId,
            plateNumber: overview.plate_number || '',
            capacity: '50',
            model: '',
            year: new Date().getFullYear().toString(),
            notes: '',
          });
        }
      } catch (error) {
        console.error('Error fetching bus data:', error);
        // Fallback to defaults
        setEditingBus({
          busId: deviceId,
          plateNumber: overview.plate_number || '',
          capacity: '50',
          model: '',
          year: new Date().getFullYear().toString(),
          notes: '',
        });
      }
    }
    
    setEditModalOpen(true);
  };

  const handleSaveBus = async () => {
    if (!editingBus.busId || !editingBus.plateNumber) {
      alert('Bus ID and Plate Number are required');
      return;
    }

    setSaving(true);
    try {
      if (onUpdateBus) {
        await onUpdateBus(editingBus);
      }
      setEditModalOpen(false);
      alert('Bus information updated successfully!');
    } catch (error) {
      console.error('Error updating bus:', error);
      alert('Failed to update bus information');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Card className="glass-panel hover:border-[#5e5ce6]/40 transition-all duration-300 relative overflow-hidden rounded-2xl border-white/5 shadow-2xl">
      {/* Glow status bar */}
      <div className={`h-1.5 w-full transition-colors ${overview.status.ol === 1 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`}></div>
      
      <CardHeader className="pb-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${overview.status.ol === 1 ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
              <Bus className={`h-6 w-6 ${overview.status.ol === 1 ? 'text-green-400' : 'text-[#a3b8cc]/50'}`} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                {busData?.plateNumber || 'N/A'}
              </CardTitle>
              <CardDescription className="text-xs text-[#a3b8cc]/50 mt-0.5 font-mono">
                Hardware ID: {overview.status.id || "Unknown"}
              </CardDescription>
            </div>
          </div>
          
          {/* Status Badge, Edit and Delete Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditClick}
              className="h-8 w-8 p-0 text-[#a3b8cc] hover:bg-white/5 hover:text-white rounded-lg"
              title="Edit bus info"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteBus && onDeleteBus(overview.status.id)}
              className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg"
              title="Delete bus"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Badge 
              variant={overview.status.ol === 1 ? "default" : "secondary"} 
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${overview.status.ol === 1 ? 'bg-green-500 text-white' : 'bg-white/10 text-[#a3b8cc]/60'}`}
            >
              {overview.status.ol === 1 ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </div>
        </div>

        {/* Info Tags */}
        <div className="flex flex-wrap gap-2">
          {overview.assignment?.routeId && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#bf5af2]/10 text-[#bf5af2] border border-[#bf5af2]/20">
              Route: {overview.assignment.routeId}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Location Info */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-[#a3b8cc] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#d4e4fb]/80 break-words font-medium">{overview.address || "Coordinates unavailable"}</p>
            </div>
          </div>
        </div>
        
        {/* Stops List */}
        <div>
          <StopsList
            stops={stops}
            overview={overview}
            deleteStopFromBus={deleteStopFromBus}
            estimateTimeToStop={estimateTimeToStop}
            sensors={sensors}
            busId={overview.status.vid}
          />
        </div>

        {/* Add Stop Section */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <p className="text-xs font-semibold text-white uppercase tracking-wider">Add New Stop</p>
          <div className="space-y-2">
            <input
              type="text"
              className="w-full bg-[#0d1c2d] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#a3b8cc]/30 focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
              placeholder="Stop label"
              value={newStop?.name || ""}
              onChange={e => setNewStop({ ...newStop, name: e.target.value })}
            />
            <StopPickerMap
              lat={newStop?.latitude || ""}
              lng={newStop?.longitude || ""}
              onLocationSelect={(lat, lng, address) =>
                setNewStop({
                  name: newStop?.name || address || "",
                  latitude: lat.toString(),
                  longitude: lng.toString(),
                })
              }
              busPosition={
                overview.status?.mlat && overview.status?.mlng
                  ? { lat: parseFloat(overview.status.mlat), lng: parseFloat(overview.status.mlng) }
                  : undefined
              }
              busLabel={overview.plate_number || "Bus"}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                className="bg-[#0d1c2d] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#a3b8cc]/30 focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
                placeholder="Latitude"
                value={newStop?.latitude || ""}
                onChange={e => setNewStop({ ...newStop, latitude: e.target.value })}
              />
              <input
                type="number"
                step="any"
                className="bg-[#0d1c2d] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#a3b8cc]/30 focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
                placeholder="Longitude"
                value={newStop?.longitude || ""}
                onChange={e => setNewStop({ ...newStop, longitude: e.target.value })}
              />
            </div>
            <button
              className="w-full bg-[#5e5ce6] hover:bg-[#4d4ad5] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed neon-bloom-indigo"
              onClick={() => {
                if (newStop && newStop.name && newStop.latitude && newStop.longitude) {
                  addStopToBus(newStop);
                }
              }}
              disabled={!newStop?.name || !newStop?.latitude || !newStop?.longitude}
            >
              Add Stop Point
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Edit Bus Modal */}
    <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
      <DialogContent className="sm:max-w-[500px] glass-panel-heavy border-white/10 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Edit Bus Registry</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider">
              Bus ID
            </label>
            <input
              type="text"
              value={editingBus.busId}
              disabled
              className="col-span-3 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-sm text-[#a3b8cc]/70 cursor-not-allowed font-mono"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editingBus.plateNumber}
              onChange={(e) => setEditingBus({ ...editingBus, plateNumber: e.target.value })}
              className="col-span-3 bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
              placeholder="Enter plate number"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider">
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={editingBus.capacity}
              onChange={(e) => setEditingBus({ ...editingBus, capacity: e.target.value })}
              className="col-span-3 bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
              placeholder="Enter capacity"
              min="1"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider">
              Model
            </label>
            <input
              type="text"
              value={editingBus.model}
              onChange={(e) => setEditingBus({ ...editingBus, model: e.target.value })}
              className="col-span-3 bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
              placeholder="Enter model name"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider">
              Year
            </label>
            <input
              type="number"
              value={editingBus.year}
              onChange={(e) => setEditingBus({ ...editingBus, year: e.target.value })}
              className="col-span-3 bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all"
              placeholder="Enter fabrication year"
              min="1900"
              max="2100"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <label className="text-right text-xs font-semibold text-[#a3b8cc] uppercase tracking-wider pt-2">
              Notes
            </label>
            <textarea
              value={editingBus.notes}
              onChange={(e) => setEditingBus({ ...editingBus, notes: e.target.value })}
              className="col-span-3 bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all min-h-[80px]"
              placeholder="Add technical notes"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSaveBus}
            disabled={saving || !editingBus.busId || !editingBus.plateNumber}
            className="bg-[#5e5ce6] hover:bg-[#4d4ad5] text-white gap-2 rounded-xl font-semibold neon-bloom-indigo"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
