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
  /** Launch cities: shown on the home page, pre-rendered for SEO, and seeded with demo data. */
  featured?: boolean;
  /** Old or colloquial names people still search for. */
  aliases?: string[];
}

export const CITIES: City[] = [
  // featured launch cities (order matters: the footer shows the first six)
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan', featured: true },
  { slug: 'delhi', name: 'Delhi', state: 'Delhi', featured: true, aliases: ['New Delhi', 'NCR'] },
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', featured: true, aliases: ['Bombay'] },
  { slug: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', featured: true, aliases: ['Bangalore'] },
  { slug: 'pune', name: 'Pune', state: 'Maharashtra', featured: true, aliases: ['Poona'] },
  { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana', featured: true },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', featured: true, aliases: ['Madras'] },
  { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal', featured: true, aliases: ['Calcutta'] },
  { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', featured: true },
  { slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', featured: true },

  { slug: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', aliases: ['Vizag'] },
  { slug: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh' },
  { slug: 'guntur', name: 'Guntur', state: 'Andhra Pradesh' },
  { slug: 'nellore', name: 'Nellore', state: 'Andhra Pradesh' },
  { slug: 'tirupati', name: 'Tirupati', state: 'Andhra Pradesh' },
  { slug: 'itanagar', name: 'Itanagar', state: 'Arunachal Pradesh' },
  { slug: 'guwahati', name: 'Guwahati', state: 'Assam' },
  { slug: 'dibrugarh', name: 'Dibrugarh', state: 'Assam' },
  { slug: 'patna', name: 'Patna', state: 'Bihar' },
  { slug: 'gaya', name: 'Gaya', state: 'Bihar' },
  { slug: 'muzaffarpur', name: 'Muzaffarpur', state: 'Bihar' },
  { slug: 'raipur', name: 'Raipur', state: 'Chhattisgarh' },
  { slug: 'bhilai', name: 'Bhilai', state: 'Chhattisgarh' },
  { slug: 'bilaspur', name: 'Bilaspur', state: 'Chhattisgarh' },
  { slug: 'goa', name: 'Goa', state: 'Goa', aliases: ['Panaji', 'Panjim', 'Margao'] },
  { slug: 'surat', name: 'Surat', state: 'Gujarat' },
  { slug: 'vadodara', name: 'Vadodara', state: 'Gujarat', aliases: ['Baroda'] },
  { slug: 'rajkot', name: 'Rajkot', state: 'Gujarat' },
  { slug: 'gandhinagar', name: 'Gandhinagar', state: 'Gujarat' },
  { slug: 'bhavnagar', name: 'Bhavnagar', state: 'Gujarat' },
  { slug: 'jamnagar', name: 'Jamnagar', state: 'Gujarat' },
  { slug: 'gurugram', name: 'Gurugram', state: 'Haryana', aliases: ['Gurgaon'] },
  { slug: 'faridabad', name: 'Faridabad', state: 'Haryana' },
  { slug: 'panipat', name: 'Panipat', state: 'Haryana' },
  { slug: 'panchkula', name: 'Panchkula', state: 'Haryana' },
  { slug: 'shimla', name: 'Shimla', state: 'Himachal Pradesh', aliases: ['Simla'] },
  { slug: 'dharamshala', name: 'Dharamshala', state: 'Himachal Pradesh', aliases: ['McLeod Ganj'] },
  { slug: 'manali', name: 'Manali', state: 'Himachal Pradesh' },
  { slug: 'srinagar', name: 'Srinagar', state: 'Jammu and Kashmir' },
  { slug: 'jammu', name: 'Jammu', state: 'Jammu and Kashmir' },
  { slug: 'ranchi', name: 'Ranchi', state: 'Jharkhand' },
  { slug: 'jamshedpur', name: 'Jamshedpur', state: 'Jharkhand' },
  { slug: 'dhanbad', name: 'Dhanbad', state: 'Jharkhand' },
  { slug: 'mysuru', name: 'Mysuru', state: 'Karnataka', aliases: ['Mysore'] },
  { slug: 'mangaluru', name: 'Mangaluru', state: 'Karnataka', aliases: ['Mangalore'] },
  { slug: 'hubballi', name: 'Hubballi', state: 'Karnataka', aliases: ['Hubli', 'Dharwad'] },
  { slug: 'belagavi', name: 'Belagavi', state: 'Karnataka', aliases: ['Belgaum'] },
  { slug: 'kochi', name: 'Kochi', state: 'Kerala', aliases: ['Cochin', 'Ernakulam'] },
  { slug: 'thiruvananthapuram', name: 'Thiruvananthapuram', state: 'Kerala', aliases: ['Trivandrum'] },
  { slug: 'kozhikode', name: 'Kozhikode', state: 'Kerala', aliases: ['Calicut'] },
  { slug: 'thrissur', name: 'Thrissur', state: 'Kerala', aliases: ['Trichur'] },
  { slug: 'leh', name: 'Leh', state: 'Ladakh' },
  { slug: 'indore', name: 'Indore', state: 'Madhya Pradesh' },
  { slug: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh' },
  { slug: 'gwalior', name: 'Gwalior', state: 'Madhya Pradesh' },
  { slug: 'jabalpur', name: 'Jabalpur', state: 'Madhya Pradesh' },
  { slug: 'ujjain', name: 'Ujjain', state: 'Madhya Pradesh' },
  { slug: 'thane', name: 'Thane', state: 'Maharashtra' },
  { slug: 'navi-mumbai', name: 'Navi Mumbai', state: 'Maharashtra' },
  { slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra' },
  { slug: 'nashik', name: 'Nashik', state: 'Maharashtra' },
  { slug: 'aurangabad', name: 'Aurangabad', state: 'Maharashtra', aliases: ['Chhatrapati Sambhajinagar'] },
  { slug: 'solapur', name: 'Solapur', state: 'Maharashtra' },
  { slug: 'kolhapur', name: 'Kolhapur', state: 'Maharashtra' },
  { slug: 'imphal', name: 'Imphal', state: 'Manipur' },
  { slug: 'shillong', name: 'Shillong', state: 'Meghalaya' },
  { slug: 'aizawl', name: 'Aizawl', state: 'Mizoram' },
  { slug: 'kohima', name: 'Kohima', state: 'Nagaland' },
  { slug: 'dimapur', name: 'Dimapur', state: 'Nagaland' },
  { slug: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha' },
  { slug: 'cuttack', name: 'Cuttack', state: 'Odisha' },
  { slug: 'rourkela', name: 'Rourkela', state: 'Odisha' },
  { slug: 'puducherry', name: 'Puducherry', state: 'Puducherry', aliases: ['Pondicherry'] },
  { slug: 'ludhiana', name: 'Ludhiana', state: 'Punjab' },
  { slug: 'amritsar', name: 'Amritsar', state: 'Punjab' },
  { slug: 'jalandhar', name: 'Jalandhar', state: 'Punjab' },
  { slug: 'mohali', name: 'Mohali', state: 'Punjab', aliases: ['SAS Nagar'] },
  { slug: 'patiala', name: 'Patiala', state: 'Punjab' },
  { slug: 'jodhpur', name: 'Jodhpur', state: 'Rajasthan' },
  { slug: 'udaipur', name: 'Udaipur', state: 'Rajasthan' },
  { slug: 'kota', name: 'Kota', state: 'Rajasthan' },
  { slug: 'ajmer', name: 'Ajmer', state: 'Rajasthan' },
  { slug: 'bikaner', name: 'Bikaner', state: 'Rajasthan' },
  { slug: 'gangtok', name: 'Gangtok', state: 'Sikkim' },
  { slug: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu' },
  { slug: 'madurai', name: 'Madurai', state: 'Tamil Nadu' },
  { slug: 'tiruchirappalli', name: 'Tiruchirappalli', state: 'Tamil Nadu', aliases: ['Trichy'] },
  { slug: 'salem', name: 'Salem', state: 'Tamil Nadu' },
  { slug: 'tirunelveli', name: 'Tirunelveli', state: 'Tamil Nadu' },
  { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' },
  { slug: 'warangal', name: 'Warangal', state: 'Telangana' },
  { slug: 'agartala', name: 'Agartala', state: 'Tripura' },
  { slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh' },
  { slug: 'noida', name: 'Noida', state: 'Uttar Pradesh', aliases: ['Greater Noida'] },
  { slug: 'ghaziabad', name: 'Ghaziabad', state: 'Uttar Pradesh' },
  { slug: 'kanpur', name: 'Kanpur', state: 'Uttar Pradesh' },
  { slug: 'agra', name: 'Agra', state: 'Uttar Pradesh' },
  { slug: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', aliases: ['Banaras', 'Benares', 'Kashi'] },
  { slug: 'prayagraj', name: 'Prayagraj', state: 'Uttar Pradesh', aliases: ['Allahabad'] },
  { slug: 'meerut', name: 'Meerut', state: 'Uttar Pradesh' },
  { slug: 'bareilly', name: 'Bareilly', state: 'Uttar Pradesh' },
  { slug: 'aligarh', name: 'Aligarh', state: 'Uttar Pradesh' },
  { slug: 'moradabad', name: 'Moradabad', state: 'Uttar Pradesh' },
  { slug: 'gorakhpur', name: 'Gorakhpur', state: 'Uttar Pradesh' },
  { slug: 'dehradun', name: 'Dehradun', state: 'Uttarakhand' },
  { slug: 'haridwar', name: 'Haridwar', state: 'Uttarakhand' },
  { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
  { slug: 'siliguri', name: 'Siliguri', state: 'West Bengal' },
  { slug: 'durgapur', name: 'Durgapur', state: 'West Bengal' },
  { slug: 'asansol', name: 'Asansol', state: 'West Bengal' },
];

export const FEATURED_CITIES = CITIES.filter((c) => c.featured);

/** Shown first in city pickers before the user types. */
export const POPULAR_CITIES = ['delhi', 'mumbai', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'kolkata'].map((s) => CITIES.find((c) => c.slug === s)!);

/** Search by city name, old name (Bangalore, Gurgaon…) or state; prefix matches on the city name rank first. */
export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (c: City) => {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
    if (c.aliases?.some((a) => a.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)))) return 1;
    if (name.includes(q)) return 2;
    if (c.state.toLowerCase().includes(q)) return 3;
    return -1;
  };
  return CITIES.map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

export const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Gujarati', 'Punjabi', 'Rajasthani'];

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);

export const MIN_AGE = 18;
export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 8;
