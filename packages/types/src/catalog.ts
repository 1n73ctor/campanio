/** Activity categories. Slugs are used in SEO URLs: /explore/<category>/<city>. */
export interface Category {
  slug: string;
  name: string;
  emoji: string;
  /** short phrase used in SEO headings, e.g. "gym partner" */
  noun: string;
  blurb: string;
  color: 'pink' | 'lime' | 'lavender' | 'sky' | 'sunny' | 'tangerine' | 'mint';
  /** shown on the home page and pre-rendered for every featured city at build; the rest render on first visit */
  featured?: boolean;
}

export const CATEGORIES: Category[] = [
  { slug: 'gym-partner', name: 'Gym Partner', emoji: '🏋️', noun: 'gym partner', blurb: 'Spot, motivate, and actually show up for leg day.', color: 'lime', featured: true },
  { slug: 'movie-buddy', name: 'Movie Buddy', emoji: '🍿', noun: 'movie buddy', blurb: 'First-day-first-show without going solo.', color: 'pink', featured: true },
  { slug: 'city-guide', name: 'City Guide', emoji: '🗺️', noun: 'local city guide', blurb: 'Hidden cafés, old bazaars, and the best chaat in town.', color: 'sunny', featured: true },
  { slug: 'study-buddy', name: 'Study Buddy', emoji: '📚', noun: 'study buddy', blurb: 'Co-working and focus sessions that keep you accountable.', color: 'sky' },
  { slug: 'shopping-buddy', name: 'Shopping Buddy', emoji: '🛍️', noun: 'shopping buddy', blurb: 'Honest opinions on the fit, the colour, and the price.', color: 'lavender', featured: true },
  { slug: 'event-plus-one', name: 'Event Plus-One', emoji: '🎉', noun: 'event plus-one', blurb: 'Weddings, concerts, and networking — with a friendly face.', color: 'tangerine', featured: true },
  { slug: 'coffee-chat', name: 'Coffee Chat', emoji: '☕', noun: 'coffee chat partner', blurb: 'Good conversation over a flat white. That\'s it.', color: 'mint', featured: true },
  { slug: 'travel-buddy', name: 'Travel Buddy', emoji: '🧳', noun: 'travel buddy', blurb: 'Day trips and weekend getaways with a verified local.', color: 'sky', featured: true },
  { slug: 'gaming-partner', name: 'Gaming Partner', emoji: '🎮', noun: 'gaming partner', blurb: 'Arcades, board-game cafés, and LAN nights.', color: 'lavender' },
  { slug: 'walk-and-talk', name: 'Walk & Talk', emoji: '🚶', noun: 'walking partner', blurb: 'Morning walks, park jogs, and sunset strolls.', color: 'lime' },
  { slug: 'food-walk', name: 'Food Walk', emoji: '🍛', noun: 'food walk buddy', blurb: 'Street-food trails, thali hunts and late-night dessert runs.', color: 'tangerine', featured: true },
  { slug: 'festival-buddy', name: 'Festival Buddy', emoji: '🪔', noun: 'festival buddy', blurb: 'Garba nights, Holi, Durga Puja pandals and Diwali melas.', color: 'sunny', featured: true },
  { slug: 'sports-partner', name: 'Sports Partner', emoji: '🏸', noun: 'sports partner', blurb: 'Badminton, cricket nets, football or pickleball — someone who plays.', color: 'mint' },
  { slug: 'heritage-walk', name: 'Heritage & Museums', emoji: '🏛️', noun: 'heritage walk host', blurb: 'Forts, museums, galleries and old-city walks.', color: 'sunny' },
  { slug: 'photo-walk', name: 'Photo Walk', emoji: '📸', noun: 'photo walk partner', blurb: 'Photogenic spots — and someone to take great pictures of you.', color: 'pink' },
  { slug: 'comedy-and-shows', name: 'Comedy & Shows', emoji: '🎭', noun: 'comedy show buddy', blurb: 'Stand-up nights, plays and open mics — laugh with company.', color: 'lavender' },
  { slug: 'language-exchange', name: 'Language Exchange', emoji: '🗣️', noun: 'language exchange partner', blurb: 'Practise English, Hindi or a new language over chai.', color: 'sky' },
  { slug: 'career-chat', name: 'Career Chat', emoji: '💼', noun: 'career chat partner', blurb: 'Jobs, college and interview tips from someone who’s been there.', color: 'mint' },
  { slug: 'settle-in-buddy', name: 'New in Town', emoji: '🏙️', noun: 'settle-in buddy', blurb: 'Markets, metro, SIM cards and the best local spots when you’ve just moved.', color: 'tangerine' },
  { slug: 'senior-company', name: 'Senior Company', emoji: '👵', noun: 'host for seniors', blurb: 'Warm, patient company for parents and grandparents — walks, temples, chats.', color: 'pink' },
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

  // more cities and popular travel spots (added Oct 2026)
  { slug: 'greater-noida', name: 'Greater Noida', state: 'Uttar Pradesh' },
  { slug: 'mathura', name: 'Mathura', state: 'Uttar Pradesh' },
  { slug: 'vrindavan', name: 'Vrindavan', state: 'Uttar Pradesh' },
  { slug: 'ayodhya', name: 'Ayodhya', state: 'Uttar Pradesh' },
  { slug: 'jhansi', name: 'Jhansi', state: 'Uttar Pradesh' },
  { slug: 'saharanpur', name: 'Saharanpur', state: 'Uttar Pradesh' },
  { slug: 'muzaffarnagar', name: 'Muzaffarnagar', state: 'Uttar Pradesh' },
  { slug: 'firozabad', name: 'Firozabad', state: 'Uttar Pradesh' },
  { slug: 'pimpri-chinchwad', name: 'Pimpri-Chinchwad', state: 'Maharashtra', aliases: ['PCMC'] },
  { slug: 'kalyan-dombivli', name: 'Kalyan-Dombivli', state: 'Maharashtra', aliases: ['Kalyan', 'Dombivli'] },
  { slug: 'vasai-virar', name: 'Vasai-Virar', state: 'Maharashtra', aliases: ['Vasai', 'Virar'] },
  { slug: 'amravati-mh', name: 'Amravati', state: 'Maharashtra' },
  { slug: 'akola', name: 'Akola', state: 'Maharashtra' },
  { slug: 'nanded', name: 'Nanded', state: 'Maharashtra' },
  { slug: 'latur', name: 'Latur', state: 'Maharashtra' },
  { slug: 'sangli', name: 'Sangli', state: 'Maharashtra' },
  { slug: 'satara', name: 'Satara', state: 'Maharashtra' },
  { slug: 'jalgaon', name: 'Jalgaon', state: 'Maharashtra' },
  { slug: 'ahmednagar', name: 'Ahmednagar', state: 'Maharashtra', aliases: ['Ahilyanagar'] },
  { slug: 'lonavala', name: 'Lonavala', state: 'Maharashtra', aliases: ['Khandala'] },
  { slug: 'mahabaleshwar', name: 'Mahabaleshwar', state: 'Maharashtra' },
  { slug: 'alibag', name: 'Alibag', state: 'Maharashtra' },
  { slug: 'udupi', name: 'Udupi', state: 'Karnataka' },
  { slug: 'manipal', name: 'Manipal', state: 'Karnataka' },
  { slug: 'davanagere', name: 'Davanagere', state: 'Karnataka' },
  { slug: 'shivamogga', name: 'Shivamogga', state: 'Karnataka', aliases: ['Shimoga'] },
  { slug: 'kalaburagi', name: 'Kalaburagi', state: 'Karnataka', aliases: ['Gulbarga'] },
  { slug: 'ballari', name: 'Ballari', state: 'Karnataka', aliases: ['Bellary'] },
  { slug: 'hampi', name: 'Hampi', state: 'Karnataka' },
  { slug: 'gokarna', name: 'Gokarna', state: 'Karnataka' },
  { slug: 'coorg', name: 'Coorg', state: 'Karnataka', aliases: ['Madikeri', 'Kodagu'] },
  { slug: 'chikkamagaluru', name: 'Chikkamagaluru', state: 'Karnataka', aliases: ['Chikmagalur'] },
  { slug: 'tiruppur', name: 'Tiruppur', state: 'Tamil Nadu' },
  { slug: 'erode', name: 'Erode', state: 'Tamil Nadu' },
  { slug: 'thanjavur', name: 'Thanjavur', state: 'Tamil Nadu', aliases: ['Tanjore'] },
  { slug: 'hosur', name: 'Hosur', state: 'Tamil Nadu' },
  { slug: 'ooty', name: 'Ooty', state: 'Tamil Nadu', aliases: ['Udhagamandalam'] },
  { slug: 'kodaikanal', name: 'Kodaikanal', state: 'Tamil Nadu' },
  { slug: 'kanyakumari', name: 'Kanyakumari', state: 'Tamil Nadu' },
  { slug: 'rameswaram', name: 'Rameswaram', state: 'Tamil Nadu' },
  { slug: 'kollam', name: 'Kollam', state: 'Kerala' },
  { slug: 'kannur', name: 'Kannur', state: 'Kerala' },
  { slug: 'kottayam', name: 'Kottayam', state: 'Kerala' },
  { slug: 'alappuzha', name: 'Alappuzha', state: 'Kerala', aliases: ['Alleppey'] },
  { slug: 'palakkad', name: 'Palakkad', state: 'Kerala' },
  { slug: 'munnar', name: 'Munnar', state: 'Kerala' },
  { slug: 'varkala', name: 'Varkala', state: 'Kerala' },
  { slug: 'rajahmundry', name: 'Rajahmundry', state: 'Andhra Pradesh', aliases: ['Rajamahendravaram'] },
  { slug: 'kakinada', name: 'Kakinada', state: 'Andhra Pradesh' },
  { slug: 'kurnool', name: 'Kurnool', state: 'Andhra Pradesh' },
  { slug: 'anantapur', name: 'Anantapur', state: 'Andhra Pradesh' },
  { slug: 'secunderabad', name: 'Secunderabad', state: 'Telangana' },
  { slug: 'nizamabad', name: 'Nizamabad', state: 'Telangana' },
  { slug: 'karimnagar', name: 'Karimnagar', state: 'Telangana' },
  { slug: 'khammam', name: 'Khammam', state: 'Telangana' },
  { slug: 'junagadh', name: 'Junagadh', state: 'Gujarat' },
  { slug: 'anand', name: 'Anand', state: 'Gujarat' },
  { slug: 'bharuch', name: 'Bharuch', state: 'Gujarat' },
  { slug: 'vapi', name: 'Vapi', state: 'Gujarat' },
  { slug: 'gandhidham', name: 'Gandhidham', state: 'Gujarat' },
  { slug: 'alwar', name: 'Alwar', state: 'Rajasthan' },
  { slug: 'bhilwara', name: 'Bhilwara', state: 'Rajasthan' },
  { slug: 'sikar', name: 'Sikar', state: 'Rajasthan' },
  { slug: 'mount-abu', name: 'Mount Abu', state: 'Rajasthan' },
  { slug: 'jaisalmer', name: 'Jaisalmer', state: 'Rajasthan' },
  { slug: 'pushkar', name: 'Pushkar', state: 'Rajasthan' },
  { slug: 'hisar', name: 'Hisar', state: 'Haryana' },
  { slug: 'rohtak', name: 'Rohtak', state: 'Haryana' },
  { slug: 'karnal', name: 'Karnal', state: 'Haryana' },
  { slug: 'sonipat', name: 'Sonipat', state: 'Haryana' },
  { slug: 'ambala', name: 'Ambala', state: 'Haryana' },
  { slug: 'bathinda', name: 'Bathinda', state: 'Punjab' },
  { slug: 'kasol', name: 'Kasol', state: 'Himachal Pradesh' },
  { slug: 'dalhousie', name: 'Dalhousie', state: 'Himachal Pradesh' },
  { slug: 'kasauli', name: 'Kasauli', state: 'Himachal Pradesh' },
  { slug: 'bir', name: 'Bir', state: 'Himachal Pradesh', aliases: ['Bir Billing'] },
  { slug: 'gulmarg', name: 'Gulmarg', state: 'Jammu and Kashmir' },
  { slug: 'pahalgam', name: 'Pahalgam', state: 'Jammu and Kashmir' },
  { slug: 'howrah', name: 'Howrah', state: 'West Bengal' },
  { slug: 'kharagpur', name: 'Kharagpur', state: 'West Bengal' },
  { slug: 'darjeeling', name: 'Darjeeling', state: 'West Bengal' },
  { slug: 'bhagalpur', name: 'Bhagalpur', state: 'Bihar' },
  { slug: 'darbhanga', name: 'Darbhanga', state: 'Bihar' },
  { slug: 'bodh-gaya', name: 'Bodh Gaya', state: 'Bihar' },
  { slug: 'bokaro', name: 'Bokaro', state: 'Jharkhand' },
  { slug: 'puri', name: 'Puri', state: 'Odisha' },
  { slug: 'sambalpur', name: 'Sambalpur', state: 'Odisha' },
  { slug: 'nainital', name: 'Nainital', state: 'Uttarakhand' },
  { slug: 'mussoorie', name: 'Mussoorie', state: 'Uttarakhand' },
  { slug: 'haldwani', name: 'Haldwani', state: 'Uttarakhand' },
  { slug: 'roorkee', name: 'Roorkee', state: 'Uttarakhand' },
  { slug: 'sagar', name: 'Sagar', state: 'Madhya Pradesh' },
  { slug: 'ratlam', name: 'Ratlam', state: 'Madhya Pradesh' },
  { slug: 'khajuraho', name: 'Khajuraho', state: 'Madhya Pradesh' },
  { slug: 'durg', name: 'Durg', state: 'Chhattisgarh' },
  { slug: 'korba', name: 'Korba', state: 'Chhattisgarh' },
  { slug: 'silchar', name: 'Silchar', state: 'Assam' },
  { slug: 'jorhat', name: 'Jorhat', state: 'Assam' },
  { slug: 'port-blair', name: 'Port Blair', state: 'Andaman and Nicobar Islands', aliases: ['Sri Vijaya Puram'] },
  { slug: 'daman', name: 'Daman', state: 'Dadra and Nagar Haveli and Daman and Diu' },
  { slug: 'silvassa', name: 'Silvassa', state: 'Dadra and Nagar Haveli and Daman and Diu' },
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

export const FEATURED_CATEGORIES = CATEGORIES.filter((c) => c.featured);
export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);

/** Settings keys for the companion registration fee per gender: `<key>On` (0/1) and `<key>` (₹ before GST). */
export const COMPANION_FEE_KEYS = {
  FEMALE: 'companionFeeFemale',
  MALE: 'companionFeeMale',
  NON_BINARY: 'companionFeeNonBinary',
  PREFER_NOT_TO_SAY: 'companionFeeUnspecified',
} as const;

/**
 * The registration fee a new companion of this gender pays: amount + GST on top. A missing gender counts as
 * "prefer not to say". `required: false` means no fee and no payment screen.
 */
export function companionFeeFor(s: Record<string, number>, gender: string | null | undefined) {
  const key = COMPANION_FEE_KEYS[(gender ?? 'PREFER_NOT_TO_SAY') as keyof typeof COMPANION_FEE_KEYS] ?? COMPANION_FEE_KEYS.PREFER_NOT_TO_SAY;
  const amount = Math.max(0, Math.round(s[key] ?? 0));
  const required = s[`${key}On`] === 1 && amount > 0;
  const gst = required ? Math.round((amount * (s.gstPct ?? 0)) / 100) : 0;
  return { required, amount: required ? amount : 0, gst, gstPct: s.gstPct ?? 0, total: required ? amount + gst : 0 };
}

/** Wallet credit (₹) for both the inviter and the friend when the friend's first booking completes. */
export const REFERRAL_REWARD = 100;

export const MIN_AGE = 18;
export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 8;
