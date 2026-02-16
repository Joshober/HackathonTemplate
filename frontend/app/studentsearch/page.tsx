'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Navigation2, Globe, Building2, GraduationCap } from 'lucide-react';
import { MapView } from '@/components/studentsearch/MapView';
import { BuildingCard } from '@/components/studentsearch/BuildingCard';
import { ClassCard } from '@/components/studentsearch/ClassCard';
import { buildings, mockClasses } from '@/lib/studentsearch/campusData';
import { Building, Language } from '@/lib/studentsearch/types';
import { getTranslations } from '@/lib/studentsearch/translations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';

export default function StudentSearchPage() {
  const [language, setLanguage] = useState<Language>('en');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [locationPermission, setLocationPermission] = useState<'denied' | 'granted' | 'prompt'>('prompt');
  const [locationError, setLocationError] = useState<string>('');

  const t = getTranslations(language);

  useEffect(() => {
    // Check for existing location permission
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
        // Auto-request location if already granted
        if (result.state === 'granted') {
          requestLocation();
        }
      }).catch(() => {
        // Permissions API not supported, just keep default state
      });
    }
  }, []);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationPermission('denied');
      return;
    }

    setLocationError('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationPermission('granted');
        setLocationError('');

        // Set up continuous location tracking
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            // Silently handle watch errors to avoid spam
            console.warn('Location watch error:', error.message);
          },
          { 
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          }
        );

        // Cleanup function
        return () => {
          if (watchId) {
            navigator.geolocation.clearWatch(watchId);
          }
        };
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            setLocationPermission('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        
        setLocationError(errorMessage);
        console.warn('Geolocation error:', errorMessage, error);
        
        // Use default campus center as fallback
        setUserLocation({ lat: 40.6231, lng: -93.7138 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const filteredBuildings = buildings.filter((building) => {
    const name = language === 'en' ? building.name : building.nameEs;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         building.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = buildingFilter === 'all' || building.type === buildingFilter;
    return matchesSearch && matchesFilter;
  });

  const handleNavigateToClass = (buildingName: string) => {
    const building = buildings.find(
      (b) => b.name === buildingName || b.nameEs === buildingName
    );
    if (building) {
      setSelectedBuilding(building);
    }
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'es' : 'en'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-blue-600 text-white shadow-lg">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-lg p-2">
                  <MapPin className="size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{t.title}</h1>
                  <p className="text-sm text-blue-100">{t.subtitle}</p>
                </div>
              </div>
              
              <Button
                onClick={toggleLanguage}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Globe className="size-4 mr-2" />
                {language === 'en' ? 'ES' : 'EN'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar */}
          <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col">
            {/* Location Status */}
            <div className="p-4 border-b border-gray-200">
              {locationPermission !== 'granted' ? (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 mb-2">{t.locationPermission}</p>
                  <Button
                    onClick={requestLocation}
                    size="sm"
                    className="w-full"
                  >
                    <Navigation2 className="size-4 mr-2" />
                    {t.enableLocation}
                  </Button>
                </div>
              ) : (
                <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                  <Navigation2 className="size-4 text-green-600" />
                  <span className="text-sm text-green-700">{t.locationEnabled}</span>
                </div>
              )}
              {locationError && (
                <p className="text-sm text-red-500 mt-2">{locationError}</p>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="buildings" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 m-4 mb-0">
                <TabsTrigger value="buildings" className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  {t.buildings}
                </TabsTrigger>
                <TabsTrigger value="classes" className="flex items-center gap-2">
                  <GraduationCap className="size-4" />
                  {t.myClasses}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="buildings" className="flex-1 flex flex-col overflow-hidden m-0">
                {/* Search and Filter */}
                <div className="p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder={t.search}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.filterBy} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.all}</SelectItem>
                      <SelectItem value="academic">{t.academic}</SelectItem>
                      <SelectItem value="administrative">{t.administrative}</SelectItem>
                      <SelectItem value="dining">{t.dining}</SelectItem>
                      <SelectItem value="library">{t.library}</SelectItem>
                      <SelectItem value="recreation">{t.recreation}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Buildings List */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                  {filteredBuildings.map((building) => (
                    <BuildingCard
                      key={building.id}
                      building={building}
                      onClick={() => setSelectedBuilding(building)}
                      isSelected={selectedBuilding?.id === building.id}
                      language={language}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="classes" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
                {mockClasses.map((classItem) => (
                  <ClassCard
                    key={classItem.id}
                    classItem={classItem}
                    onNavigate={handleNavigateToClass}
                    language={language}
                    translations={{ navigate: t.navigate }}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Map View */}
          <div className="flex-1 relative">
            <MapView
              selectedBuilding={selectedBuilding}
              userLocation={userLocation}
              buildings={buildings}
              onBuildingClick={setSelectedBuilding}
              translations={{
                yourLocation: t.yourLocation,
                centerMap: t.centerMap
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
