export interface Building {
  id: string;
  name: string;
  nameEs: string;
  code: string;
  coordinates: { lat: number; lng: number };
  hours: {
    weekday: string;
    weekend: string;
  };
  hoursEs: {
    weekday: string;
    weekend: string;
  };
  type: 'academic' | 'administrative' | 'dining' | 'library' | 'recreation';
  description: string;
  descriptionEs: string;
}

export interface ClassLocation {
  id: string;
  className: string;
  classNameEs: string;
  building: string;
  room: string;
  time: string;
  days: string;
  daysEs: string;
}

export type Language = 'en' | 'es';
