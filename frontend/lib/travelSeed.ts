export interface SeedOpportunity {
  id: string;
  title: string;
  location: string;
  costEstimate: number;
  tags: string[];
  tripType: string;
  imageUrl: string;
}

export const TRAVEL_OPPORTUNITY_SEED: SeedOpportunity[] = [
  {
    id: 'sea',
    title: 'Seattle client workshop',
    location: 'Seattle, WA',
    costEstimate: 1850,
    tags: ['client visit', 'policy: ok'],
    tripType: 'business',
    imageUrl:
      'https://images.unsplash.com/photo-1502175353178-a9a75c5f43ad?w=800&q=80',
  },
  {
    id: 'chi',
    title: 'Chicago leadership forum',
    location: 'Chicago, IL',
    costEstimate: 1420,
    tags: ['conference', 'team'],
    tripType: 'conference',
    imageUrl: 'https://images.unsplash.com/photo-1494522358652-f30e61a603d5?w=800&q=80',
  },
  {
    id: 'aus',
    title: 'Austin onsite discovery',
    location: 'Austin, TX',
    costEstimate: 980,
    tags: ['business', 'budget friendly'],
    tripType: 'business',
    imageUrl: 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=800&q=80',
  },
  {
    id: 'nyc',
    title: 'NYC broker meetings',
    location: 'New York, NY',
    costEstimate: 2200,
    tags: ['client visit', 'high demand'],
    tripType: 'business',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
  },
  {
    id: 'den',
    title: 'Denver renewal summit',
    location: 'Denver, CO',
    costEstimate: 1250,
    tags: ['conference'],
    tripType: 'conference',
    imageUrl: 'https://images.unsplash.com/photo-1583212292454-1fe62296026b?w=800&q=80',
  },
];
