'use client';

import { ClassLocation } from '@/lib/studentsearch/types';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ClassCardProps {
  classItem: ClassLocation;
  onNavigate: (buildingName: string) => void;
  language: 'en' | 'es';
  translations: {
    navigate: string;
  };
}

export function ClassCard({ classItem, onNavigate, language, translations }: ClassCardProps) {
  const className = language === 'en' ? classItem.className : classItem.classNameEs;
  const days = language === 'en' ? classItem.days : classItem.daysEs;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold mb-2">{className}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-gray-500" />
              <span className="text-gray-700">
                {classItem.building} - {language === 'en' ? 'Room' : 'Sala'} {classItem.room}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-gray-500" />
              <span className="text-gray-700">{classItem.time}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-gray-500" />
              <span className="text-gray-700">{days}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onNavigate(classItem.building)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          {translations.navigate}
        </button>
      </div>
    </Card>
  );
}
