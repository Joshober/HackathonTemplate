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
  const [zoom, setZoom] = useState(16);

  const centerOnUser = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setZoom(17);
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* Google Maps Embed */}
      <iframe
        ref={mapRef}
        className="w-full h-full"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyB0_AoPu9Y85sNWyGCJ_5b3LVqq6hNUxB0&q=${mapCenter.lat},${mapCenter.lng}&zoom=${zoom}&maptype=roadmap`}
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

      {/* Center on user button */}
      {userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-24 right-4 bg-white rounded-full p-3 shadow-lg hover:bg-gray-50 transition-colors"
        >
          <Navigation className="size-5 text-blue-600" />
          <span className="sr-only">{translations.centerMap}</span>
        </button>
      )}

      {/* Building markers simulation - in production would be actual map markers */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-start gap-2">
          <MapPin className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{translations.yourLocation}</p>
            {userLocation && (
              <p className="text-gray-600 text-xs mt-1">
                {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
