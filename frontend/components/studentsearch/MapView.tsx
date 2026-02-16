'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Building } from '@/lib/studentsearch/types';

interface MapViewProps {
  selectedBuilding: Building | null;
  userLocation: { lat: number; lng: number } | null;
  buildings: Building[];
  onBuildingClick: (building: Building) => void;
  translations: {
    yourLocation: string;
    centerMap: string;
  };
}

export function MapView({ 
  selectedBuilding, 
  userLocation, 
  buildings,
  onBuildingClick,
  translations 
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.6231, lng: -93.7138 }); // Graceland University default
  const [zoom, setZoom] = useState(17);

  useEffect(() => {
    if (selectedBuilding) {
      setMapCenter(selectedBuilding.coordinates);
      setZoom(18);
    }
  }, [selectedBuilding]);

  useEffect(() => {
    // Center map on user location when available
    if (userLocation) {
      setMapCenter(userLocation);
      setZoom(18);
    }
  }, [userLocation]);

  const centerOnUser = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setZoom(18);
    }
  };

  const centerOnCampus = () => {
    setMapCenter({ lat: 40.6231, lng: -93.7138 });
    setZoom(17);
  };

  // Create markers query for all buildings
  const buildingMarkers = buildings.map(b => 
    `${b.coordinates.lat},${b.coordinates.lng}`
  ).join('|');

  const mapUrl = selectedBuilding 
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyB0_AoPu9Y85sNWyGCJ_5b3LVqq6hNUxB0&q=${selectedBuilding.coordinates.lat},${selectedBuilding.coordinates.lng}&zoom=${zoom}`
    : `https://www.google.com/maps/embed/v1/view?key=AIzaSyB0_AoPu9Y85sNWyGCJ_5b3LVqq6hNUxB0&center=${mapCenter.lat},${mapCenter.lng}&zoom=${zoom}`;

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* Google Maps Embed - Graceland University */}
      <iframe
        ref={mapRef}
        className="w-full h-full"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        src={mapUrl}
      />
      
      {/* Overlay with building markers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative w-full h-full">
          {/* User location indicator */}
          {userLocation && (
            <div 
              className="absolute pointer-events-auto"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="relative">
                <div className="absolute -inset-2 bg-blue-400 rounded-full opacity-30 animate-ping" />
                <div className="relative bg-blue-500 rounded-full p-2 shadow-lg border-2 border-white">
                  <Navigation className="size-4 text-white" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buildings List Overlay */}
      <div className="absolute bottom-24 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs max-h-64 overflow-y-auto z-10">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <MapPin className="size-4 text-red-500" />
          Campus Buildings ({buildings.length})
        </h3>
        <div className="space-y-1">
          {buildings.map((building) => (
            <button
              key={building.id}
              onClick={() => onBuildingClick(building)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors ${
                selectedBuilding?.id === building.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className={`size-3 flex-shrink-0 ${
                  selectedBuilding?.id === building.id ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{building.name}</div>
                  <div className="text-gray-500">{building.code}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Center on user button */}
      {userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-24 right-4 bg-white rounded-full p-3 shadow-lg hover:bg-gray-50 transition-colors z-10"
        >
          <Navigation className="size-5 text-blue-600" />
          <span className="sr-only">{translations.centerMap}</span>
        </button>
      )}

      {/* Center on campus button */}
      <button
        onClick={centerOnCampus}
        className="absolute bottom-8 right-4 bg-white rounded-lg px-4 py-2 shadow-lg hover:bg-gray-50 transition-colors z-10 text-sm font-medium"
      >
        Graceland University
      </button>

      {/* Selected Building Info */}
      {selectedBuilding && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
          <div className="flex items-start gap-3">
            <MapPin className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{selectedBuilding.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedBuilding.code}</p>
              <div className="mt-2 text-sm">
                <p className="text-gray-700 font-medium">Hours:</p>
                <p className="text-gray-600">{selectedBuilding.hours.weekday}</p>
                <p className="text-gray-600">{selectedBuilding.hours.weekend}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">{selectedBuilding.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Campus Info when no building selected */}
      {!selectedBuilding && userLocation && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs z-10">
          <div className="flex items-start gap-2">
            <div className="relative">
              <div className="absolute -inset-1 bg-blue-400 rounded-full opacity-30 animate-ping" />
              <Navigation className="size-5 text-blue-600 relative" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-blue-600">Your Location</p>
              <p className="text-gray-600 text-xs mt-1">
                {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
              </p>
              <p className="text-gray-500 text-xs mt-1">Live tracking enabled</p>
            </div>
          </div>
        </div>
      )}

      {!selectedBuilding && !userLocation && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs z-10">
          <div className="flex items-start gap-2">
            <MapPin className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Graceland University</p>
              <p className="text-gray-600 text-xs mt-1">Lamoni, Iowa</p>
              <p className="text-gray-500 text-xs mt-1">{buildings.length} buildings on campus</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
