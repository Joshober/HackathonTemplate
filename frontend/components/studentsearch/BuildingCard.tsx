'use client';

import { Building } from '@/lib/studentsearch/types';
import { MapPin, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BuildingCardProps {
  building: Building;
  onClick: () => void;
  isSelected: boolean;
  language: 'en' | 'es';
}

export function BuildingCard({ building, onClick, isSelected, language }: BuildingCardProps) {
  const name = language === 'en' ? building.name : building.nameEs;
  const description = language === 'en' ? building.description : building.descriptionEs;
  const hours = language === 'en' ? building.hours : building.hoursEs;

  const typeColors = {
    academic: 'bg-blue-100 text-blue-700',
    administrative: 'bg-purple-100 text-purple-700',
    dining: 'bg-orange-100 text-orange-700',
    library: 'bg-green-100 text-green-700',
    recreation: 'bg-pink-100 text-pink-700'
  };

  const typeLabels = {
    en: {
      academic: 'Academic',
      administrative: 'Administrative',
      dining: 'Dining',
      library: 'Library',
      recreation: 'Recreation'
    },
    es: {
      academic: 'Académico',
      administrative: 'Administrativo',
      dining: 'Comedor',
      library: 'Biblioteca',
      recreation: 'Recreación'
    }
  };

  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{name}</h3>
            <Badge className={typeColors[building.type]}>
              {typeLabels[language][building.type]}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="size-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{building.code}</span>
            </div>
            
            <div className="flex items-start gap-2 text-sm">
              <Clock className="size-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="text-gray-700">
                <div>{hours.weekday}</div>
                <div className="text-gray-500">{hours.weekend}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
