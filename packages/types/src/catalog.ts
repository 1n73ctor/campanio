/** Activity categories. Slugs are used in SEO URLs: /explore/<category>/<city>. */
export interface Category {
  slug: string;
  name: string;
  emoji: string;
  /** short phrase used in SEO headings, e.g. "gym partner" */
  noun: string;
  blurb: string;
  color: 'pink' | 'lime' | 'lavender' | 'sky' | 'sunny' | 'tangerine' | 'mint';
}

export const CATEGORIES: Category[] = [
  { slug: 'gym-partner', name: 'Gym Partner', emoji: '🏋️', noun: 'gym partner', blurb: 'Spot, motivate, and actually show up for leg day.', color: 'lime' },
  { slug: 'movie-buddy', name: 'Movie Buddy', emoji: '🍿', noun: 'movie buddy', blurb: 'First-day-first-show without going solo.', color: 'pink' },
  { slug: 'city-guide', name: 'City Guide', emoji: '🗺️', noun: 'local city guide', blurb: 'Hidden cafés, old bazaars, and the best chaat in town.', color: 'sunny' },
  { slug: 'study-buddy', name: 'Study Buddy', emoji: '📚', noun: 'study buddy', blurb: 'Co-working and focus sessions that keep you accountable.', color: 'sky' },
  { slug: 'shopping-buddy', name: 'Shopping Buddy', emoji: '🛍️', noun: 'shopping buddy', blurb: 'Honest opinions on the fit, the colour, and the price.', color: 'lavender' },
  { slug: 'event-plus-one', name: 'Event Plus-One', emoji: '🎉', noun: 'event plus-one', blurb: 'Weddings, concerts, and networking — with a friendly face.', color: 'tangerine' },
  { slug: 'coffee-chat', name: 'Coffee Chat', emoji: '☕', noun: 'coffee chat partner', blurb: 'Good conversation over a flat white. That\'s it.', color: 'mint' },
  { slug: 'travel-buddy', name: 'Travel Buddy', emoji: '🧳', noun: 'travel buddy', blurb: 'Day trips and weekend getaways with a verified local.', color: 'sky' },
  { slug: 'gaming-partner', name: 'Gaming Partner', emoji: '🎮', noun: 'gaming partner', blurb: 'Arcades, board-game cafés, and LAN nights.', color: 'lavender' },
  { slug: 'walk-and-talk', name: 'Walk & Talk', emoji: '🚶', noun: 'walking partner', blurb: 'Morning walks, park jogs, and sunset strolls.', color: 'lime' },
];

export interface City {
  slug: string;
  name: string;
  state: string;
}

export const CITIES: City[] = [
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
  { slug: 'delhi', name: 'Delhi', state: 'Delhi' },
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { slug: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' },
  { slug: 'pune', name: 'Pune', state: 'Maharashtra' },
  { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
  { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal' },
  { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
  { slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh' },
];

export const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Gujarati', 'Punjabi', 'Rajasthani'];

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);

export const MIN_AGE = 18;
export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 8;
