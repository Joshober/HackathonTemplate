import { Language } from '../types';

export const translations = {
  en: {
    title: 'Campus Navigator',
    subtitle: 'Find your way around campus',
    buildings: 'Buildings',
    myClasses: 'My Classes',
    search: 'Search buildings...',
    yourLocation: 'Your Location',
    centerMap: 'Center on my location',
    navigate: 'Navigate',
    locationPermission: 'Enable location services to see your position on campus',
    enableLocation: 'Enable Location',
    locationEnabled: 'Location enabled',
    allBuildings: 'All Buildings',
    filterBy: 'Filter by type',
    all: 'All',
    academic: 'Academic',
    administrative: 'Administrative',
    dining: 'Dining',
    library: 'Library',
    recreation: 'Recreation',
    hours: 'Hours',
    getDirections: 'Get Directions',
    distance: 'Distance',
    noClasses: 'No classes scheduled',
    addClasses: 'Add your class schedule to see navigation options'
  },
  es: {
    title: 'Navegador del Campus',
    subtitle: 'Encuentra tu camino por el campus',
    buildings: 'Edificios',
    myClasses: 'Mis Clases',
    search: 'Buscar edificios...',
    yourLocation: 'Tu Ubicación',
    centerMap: 'Centrar en mi ubicación',
    navigate: 'Navegar',
    locationPermission: 'Habilita los servicios de ubicación para ver tu posición en el campus',
    enableLocation: 'Habilitar Ubicación',
    locationEnabled: 'Ubicación habilitada',
    allBuildings: 'Todos los Edificios',
    filterBy: 'Filtrar por tipo',
    all: 'Todos',
    academic: 'Académico',
    administrative: 'Administrativo',
    dining: 'Comedor',
    library: 'Biblioteca',
    recreation: 'Recreación',
    hours: 'Horarios',
    getDirections: 'Obtener Direcciones',
    distance: 'Distancia',
    noClasses: 'No hay clases programadas',
    addClasses: 'Agrega tu horario de clases para ver opciones de navegación'
  }
};

export function getTranslations(lang: Language) {
  return translations[lang];
}
