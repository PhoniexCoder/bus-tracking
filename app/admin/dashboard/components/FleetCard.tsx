// Displays a single bus card with all info, stops, and actions


import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bus, MapPin, Clock, Edit, Save, X, Trash2 } from "lucide-react";
import { StopsList } from "./StopsList";
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
        const firestoreService = new FirestoreService(user.uid);
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
    <Card className="shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 bg-white overflow-hidden">
      {/* Status Bar */}
      <div className={`h-2 ${overview.status.ol === 1 ? 'bg-green-500' : 'bg-red-500'}`}></div>
      
      <CardHeader className="pb-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${overview.status.ol === 1 ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Bus className={`h-6 w-6 ${overview.status.ol === 1 ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">
                {busData?.plateNumber || 'N/A'}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-0.5">
                Device: {overview.status.id || "Unknown"}
              </CardDescription>
            </div>
          </div>
          
          {/* Status Badge, Edit and Delete Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditClick}
              className="h-8 w-8 p-0 hover:bg-blue-50"
              title="Edit bus info"
            >
              <Edit className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteBus && onDeleteBus(overview.status.id)}
              className="h-8 w-8 p-0 hover:bg-red-50"
              title="Delete bus"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
            <Badge 
              variant={overview.status.ol === 1 ? "default" : "secondary"} 
              className={`text-xs ${overview.status.ol === 1 ? 'bg-green-600' : 'bg-gray-500'}`}
            >
              {overview.status.ol === 1 ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>

        {/* Info Tags */}
        <div className="flex flex-wrap gap-2">
          {overview.assignment?.routeId && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
              Route: {overview.assignment.routeId}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Location Info */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 break-words">{overview.address}</p>
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
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Add New Stop</p>
          <div className="space-y-2">
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Stop name"
              value={newStop?.name || ""}
              onChange={e => setNewStop({ ...newStop, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Latitude"
                value={newStop?.latitude || ""}
                onChange={e => setNewStop({ ...newStop, latitude: e.target.value })}
              />
              <input
                type="number"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Longitude"
                value={newStop?.longitude || ""}
                onChange={e => setNewStop({ ...newStop, longitude: e.target.value })}
              />
            </div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={() => {
                if (newStop && newStop.name && newStop.latitude && newStop.longitude) {
                  addStopToBus(newStop);
                }
              }}
              disabled={!newStop?.name || !newStop?.latitude || !newStop?.longitude}
            >
              Add Stop
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Edit Bus Modal */}
    <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-900">Edit Bus Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-semibold text-gray-700">
              Bus ID
            </label>
            <input
              type="text"
              value={editingBus.busId}
              disabled
              className="col-span-3 border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-semibold text-gray-700">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editingBus.plateNumber}
              onChange={(e) => setEditingBus({ ...editingBus, plateNumber: e.target.value })}
              className="col-span-3 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"
              placeholder="Enter plate number"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-semibold text-gray-700">
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={editingBus.capacity}
              onChange={(e) => setEditingBus({ ...editingBus, capacity: e.target.value })}
              className="col-span-3 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"
              placeholder="Enter capacity"
              min="1"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-semibold text-gray-700">
              Model
            </label>
            <input
              type="text"
              value={editingBus.model}
              onChange={(e) => setEditingBus({ ...editingBus, model: e.target.value })}
              className="col-span-3 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"
              placeholder="Enter model"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-semibold text-gray-700">
              Year
            </label>
            <input
              type="number"
              value={editingBus.year}
              onChange={(e) => setEditingBus({ ...editingBus, year: e.target.value })}
              className="col-span-3 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"
              placeholder="Enter year"
              min="1900"
              max="2100"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <label className="text-right text-sm font-semibold text-gray-700 pt-2">
              Notes
            </label>
            <textarea
              value={editingBus.notes}
              onChange={(e) => setEditingBus({ ...editingBus, notes: e.target.value })}
              className="col-span-3 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 min-h-[80px]"
              placeholder="Enter any notes about this bus"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="gap-2">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSaveBus}
            disabled={saving || !editingBus.busId || !editingBus.plateNumber}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
