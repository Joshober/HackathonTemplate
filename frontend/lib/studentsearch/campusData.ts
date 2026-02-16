import { Building, ClassLocation } from './types';

export const buildings: Building[] = [
  {
    id: 'higdon',
    name: 'Higdon Administration Building',
    nameEs: 'Edificio Administrativo Higdon',
    code: 'HAB',
    coordinates: { lat: 40.6231, lng: -93.7138 },
    hours: {
      weekday: 'Mon-Fri: 8:00 AM - 5:00 PM',
      weekend: 'Closed'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 8:00 AM - 5:00 PM',
      weekend: 'Cerrado'
    },
    type: 'administrative',
    description: 'Main administrative offices and student services',
    descriptionEs: 'Oficinas administrativas principales y servicios estudiantiles'
  },
  {
    id: 'shaw',
    name: 'Shaw Center',
    nameEs: 'Centro Shaw',
    code: 'SC',
    coordinates: { lat: 40.6235, lng: -93.7145 },
    hours: {
      weekday: 'Mon-Fri: 6:00 AM - 10:00 PM',
      weekend: 'Sat-Sun: 8:00 AM - 9:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 6:00 AM - 10:00 PM',
      weekend: 'Sáb-Dom: 8:00 AM - 9:00 PM'
    },
    type: 'recreation',
    description: 'Student recreation center with fitness facilities and activities',
    descriptionEs: 'Centro recreativo estudiantil con instalaciones de fitness y actividades'
  },
  {
    id: 'zimmerman',
    name: 'Frederick Madison Smith Library',
    nameEs: 'Biblioteca Frederick Madison Smith',
    code: 'FMS',
    coordinates: { lat: 40.6228, lng: -93.7142 },
    hours: {
      weekday: 'Mon-Thu: 7:30 AM - 11:00 PM',
      weekend: 'Fri-Sun: 9:00 AM - 9:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Jue: 7:30 AM - 11:00 PM',
      weekend: 'Vie-Dom: 9:00 AM - 9:00 PM'
    },
    type: 'library',
    description: 'Main library with study spaces and academic resources',
    descriptionEs: 'Biblioteca principal con espacios de estudio y recursos académicos'
  },
  {
    id: 'resch',
    name: 'Resch Science and Technology Hall',
    nameEs: 'Edificio de Ciencia y Tecnología Resch',
    code: 'RST',
    coordinates: { lat: 40.6225, lng: -93.7135 },
    hours: {
      weekday: 'Mon-Fri: 7:00 AM - 10:00 PM',
      weekend: 'Sat-Sun: 9:00 AM - 6:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 7:00 AM - 10:00 PM',
      weekend: 'Sáb-Dom: 9:00 AM - 6:00 PM'
    },
    type: 'academic',
    description: 'Science labs, computer labs, and technology classrooms',
    descriptionEs: 'Laboratorios de ciencias, laboratorios de computación y aulas de tecnología'
  },
  {
    id: 'helene',
    name: 'Helene Center for the Visual Arts',
    nameEs: 'Centro Helene para las Artes Visuales',
    code: 'HCV',
    coordinates: { lat: 40.6238, lng: -93.7140 },
    hours: {
      weekday: 'Mon-Fri: 8:00 AM - 9:00 PM',
      weekend: 'Sat-Sun: 10:00 AM - 5:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 8:00 AM - 9:00 PM',
      weekend: 'Sáb-Dom: 10:00 AM - 5:00 PM'
    },
    type: 'academic',
    description: 'Art studios, galleries, and visual arts classrooms',
    descriptionEs: 'Estudios de arte, galerías y aulas de artes visuales'
  },
  {
    id: 'commons',
    name: 'The Commons Dining Hall',
    nameEs: 'Comedor The Commons',
    code: 'COM',
    coordinates: { lat: 40.6233, lng: -93.7148 },
    hours: {
      weekday: 'Mon-Fri: 7:00 AM - 8:00 PM',
      weekend: 'Sat-Sun: 8:00 AM - 7:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 7:00 AM - 8:00 PM',
      weekend: 'Sáb-Dom: 8:00 AM - 7:00 PM'
    },
    type: 'dining',
    description: 'Main dining facility with multiple meal options',
    descriptionEs: 'Comedor principal con múltiples opciones de comida'
  },
  {
    id: 'bruce',
    name: 'Bruce Jenner Sports Complex',
    nameEs: 'Complejo Deportivo Bruce Jenner',
    code: 'BJC',
    coordinates: { lat: 40.6240, lng: -93.7132 },
    hours: {
      weekday: 'Mon-Fri: 6:00 AM - 10:00 PM',
      weekend: 'Sat-Sun: 8:00 AM - 8:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 6:00 AM - 10:00 PM',
      weekend: 'Sáb-Dom: 8:00 AM - 8:00 PM'
    },
    type: 'recreation',
    description: 'Athletic facilities including gymnasium and training rooms',
    descriptionEs: 'Instalaciones deportivas incluyendo gimnasio y salas de entrenamiento'
  },
  {
    id: 'closson',
    name: 'Closson Center',
    nameEs: 'Centro Closson',
    code: 'CC',
    coordinates: { lat: 40.6229, lng: -93.7145 },
    hours: {
      weekday: 'Mon-Fri: 7:00 AM - 11:00 PM',
      weekend: 'Sat-Sun: 9:00 AM - 11:00 PM'
    },
    hoursEs: {
      weekday: 'Lun-Vie: 7:00 AM - 11:00 PM',
      weekend: 'Sáb-Dom: 9:00 AM - 11:00 PM'
    },
    type: 'academic',
    description: 'Business and education classrooms and faculty offices',
    descriptionEs: 'Aulas de negocios y educación y oficinas de profesores'
  }
];

export const mockClasses: ClassLocation[] = [
  {
    id: '1',
    className: 'Introduction to Business',
    classNameEs: 'Introducción a los Negocios',
    building: 'Closson Center',
    room: '201',
    time: '9:00 AM - 10:15 AM',
    days: 'Mon, Wed, Fri',
    daysEs: 'Lun, Mié, Vie'
  },
  {
    id: '2',
    className: 'General Biology',
    classNameEs: 'Biología General',
    building: 'Resch Science and Technology Hall',
    room: '115',
    time: '11:00 AM - 12:50 PM',
    days: 'Tue, Thu',
    daysEs: 'Mar, Jue'
  },
  {
    id: '3',
    className: 'English Composition',
    classNameEs: 'Composición en Inglés',
    building: 'Higdon Administration Building',
    room: '305',
    time: '1:00 PM - 2:15 PM',
    days: 'Mon, Wed',
    daysEs: 'Lun, Mié'
  },
  {
    id: '4',
    className: 'Studio Art',
    classNameEs: 'Arte de Estudio',
    building: 'Helene Center for the Visual Arts',
    room: '102',
    time: '2:00 PM - 4:50 PM',
    days: 'Tue, Thu',
    daysEs: 'Mar, Jue'
  }
];