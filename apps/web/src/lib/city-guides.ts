/**
 * Hand-written local text for city landing pages (SEO): a short city intro, local FAQs, and where people usually meet
 * for each activity. Only well-known public places. Pages without an entry fall back to the generic template.
 */
export interface CityGuide {
  intro: string[];
  faqs: { q: string; a: string }[];
  /** activity slug → where people usually meet for it in this city */
  spots: Record<string, string>;
}

export const CITY_GUIDES: Record<string, CityGuide> = {
  delhi: {
    intro: [
      'Delhi is big, busy and full of things to do — which is exactly why it can feel lonely when you don’t have someone to do them with. Most meetups here happen in South and Central Delhi, where cafés, parks and markets sit close to the metro.',
      'Mornings and evenings are the sweet spot: parks like Lodhi Garden fill up with walkers before 9 am, and markets like Khan Market and Hauz Khas come alive after 6 pm. From May to July, plan indoor meetups or early starts — the afternoon heat is no joke.',
    ],
    faqs: [
      {
        q: 'Which areas of Delhi are best for a first meetup?',
        a: 'Pick somewhere public and easy to reach by metro: Connaught Place (Rajiv Chowk), Khan Market, Hauz Khas, Select Citywalk in Saket, or Lodhi Garden in daylight. Busy, well-lit spots make the first meeting comfortable for both of you.',
      },
      {
        q: 'Is the Delhi Metro a good way to get to meetups?',
        a: 'Usually, yes — it reaches most popular meetup areas, and the first coach on every train is reserved for women. Share your live location from the meetup screen if you’re travelling late.',
      },
    ],
    spots: {
      'gym-partner':
        'Gym partners in Delhi often meet at a shared gym, or train outdoors — morning runs and bodyweight sessions in Lodhi Garden, Nehru Park or the Sunder Nursery paths are popular, especially from October to March when the weather is kind.',
      'shopping-buddy':
        'For shopping, people head to Sarojini Nagar and Janpath for bargains, Lajpat Nagar for ethnic wear, Khan Market for boutiques, and Select Citywalk or DLF Promenade when they want malls and air-conditioning. A second opinion (and someone who knows how to bargain) helps a lot.',
      'coffee-chat':
        'Coffee chats usually happen around Khan Market, Hauz Khas Village, Connaught Place and Shahpur Jat — plenty of cafés where you can sit for an hour without being rushed.',
      'walk-and-talk':
        'For a walk and a conversation, Lodhi Garden, Sunder Nursery, Nehru Park and the lawns around India Gate are the classics. Go early morning or around sunset.',
      'food-walk':
        'Food walks in Delhi mean Old Delhi — Chandni Chowk, Paranthe Wali Gali and the lanes around Jama Masjid — plus Majnu ka Tilla for Tibetan food, Amar Colony for street snacks and Bengali Market for chaat.',
      'movie-buddy':
        'Movie buddies meet at multiplexes in Select Citywalk (Saket), DLF Promenade (Vasant Kunj) or around Connaught Place, often with a coffee or a meal before or after.',
      'city-guide':
        'A local guide can take you through Humayun’s Tomb, Qutub Minar, Old Delhi, Connaught Place and Dilli Haat — and, more usefully, tell you which neighbourhoods suit you if you’ve just moved here.',
      'gaming-partner':
        'Gaming partners meet at gaming cafés and arcades in malls, or at board-game cafés around Hauz Khas and Saket for something more social.',
      'travel-buddy':
        'Popular trips with a travel buddy from Delhi: a day in Agra, a weekend in Rishikesh, Jaipur by train, or a quick break in Neemrana. Plan the route together and share your live location while travelling.',
      'photo-walk':
        'For photo walks, Chandni Chowk, Humayun’s Tomb, Sunder Nursery, Mehrauli Archaeological Park and Lodhi Art District (the murals around Lodhi Colony) are favourites — go early for soft light and fewer crowds.',
      'festival-buddy':
        'Delhi has a festival for every season: Durga Puja pandals in Chittaranjan Park, Diwali melas and Dilli Haat’s craft fairs, and Holi gatherings. Going with a buddy makes big crowds easier and more fun.',
    },
  },

  bengaluru: {
    intro: [
      'Bengaluru is a city of newcomers — lots of people here moved for work or college and are still building their circle. That makes it one of the easiest cities to meet someone for an activity.',
      'Indiranagar, Koramangala, HSR Layout and the MG Road–Church Street area are where most plans happen. The weather is mild most of the year, so outdoor plans work well; just keep an umbrella handy from June to October, and plan around traffic.',
    ],
    faqs: [
      {
        q: 'Where do people usually meet in Bengaluru?',
        a: 'Indiranagar (100 Feet Road and 12th Main), Koramangala, Church Street and MG Road, Cubbon Park and Lalbagh in daylight, and malls like Phoenix Marketcity, Orion Mall and UB City. Choose somewhere near the metro to avoid traffic.',
      },
      {
        q: 'What’s a good weekend plan with a buddy in Bengaluru?',
        a: 'An early Nandi Hills sunrise, a Cubbon Park walk, brunch in Indiranagar, or a day trip to Mysuru by train. Pick one and keep it relaxed.',
      },
    ],
    spots: {
      'gym-partner':
        'Gym partners in Bengaluru train together at a shared gym or outdoors — Cubbon Park and Lalbagh are full of runners every morning, and many people do weekend runs around Ulsoor Lake.',
      'movie-buddy':
        'Movie buddies meet at Orion Mall, Phoenix Marketcity, Forum (Koramangala) or the PVR at UB City — easy to pair with dinner.',
      'city-guide':
        'A city guide can show you Cubbon Park, Lalbagh, Bangalore Palace, VV Puram food street and the old markets around KR Market — and help you figure out which area to live in.',
      'shopping-buddy':
        'Shopping buddies head to Commercial Street and Chickpet for bargains, Brigade Road and Indiranagar for fashion, and Phoenix Marketcity or Orion Mall for malls.',
      'travel-buddy':
        'Easy trips with a travel buddy from Bengaluru: Nandi Hills at sunrise, Mysuru by train, a weekend in Coorg or Chikkamagaluru, or Hampi for history.',
      'study-buddy':
        'Study buddies meet at the State Central Library in Cubbon Park, quiet cafés in Jayanagar and Indiranagar, and co-working spaces in Koramangala and HSR Layout.',
      'comedy-and-shows':
        'Bengaluru has a busy comedy and live-music scene — most shows happen at venues in Indiranagar, Koramangala and around MG Road. Book tickets together and grab food after.',
      'sports-partner':
        'Sports partners play on football and cricket turfs in Koramangala, HSR Layout and Whitefield, badminton courts across the city, or join weekend runs in Cubbon Park.',
      'photo-walk':
        'Photo walks: Cubbon Park’s trees, Lalbagh’s glasshouse, the colours of KR Market early in the morning, and the street art around Church Street.',
      'career-chat':
        'Career chats usually happen over coffee in Koramangala, HSR Layout or Indiranagar — the heart of the startup scene, with plenty of quiet cafés and co-working spaces.',
    },
  },

  mumbai: {
    intro: [
      'Mumbai moves fast, and it’s easy to spend months here commuting and working without really getting out. Having someone to go with makes it easier to actually enjoy the city.',
      'Bandra, Lower Parel, Colaba and Juhu are the easiest places to meet — well connected by local trains and full of cafés and sea-facing spots. During the monsoon (June to September), check the weather and keep a backup plan indoors.',
    ],
    faqs: [
      {
        q: 'Where should I meet someone for the first time in Mumbai?',
        a: 'Busy, public spots near a station: Bandra (Carter Road, Hill Road), Lower Parel’s malls, Colaba Causeway, or Marine Drive in the evening. Share your live location from the meetup screen.',
      },
      {
        q: 'Is Mumbai good for evening plans?',
        a: 'Yes — Marine Drive, Bandstand and Carter Road are lively in the evenings, and cafés in Bandra and Lower Parel stay open late.',
      },
    ],
    spots: {
      'movie-buddy':
        'Movie buddies meet at multiplexes in Lower Parel, Andheri and Bandra — or catch something at the iconic single screens in South Mumbai.',
      'shopping-buddy':
        'Shopping buddies go to Linking Road and Hill Road in Bandra, Colaba Causeway for street shopping, Crawford Market for everything else, and Palladium or Phoenix in Lower Parel for malls.',
      'coffee-chat':
        'Coffee chats happen in Bandra’s cafés, around Kala Ghoda in South Mumbai, in Lower Parel, and in Juhu — easy to reach by train.',
      'walk-and-talk':
        'For a walk and a talk: Marine Drive at sunset, Carter Road and Bandstand in Bandra, Juhu beach, or the lanes of Kala Ghoda and Fort.',
      'comedy-and-shows':
        'Mumbai is India’s comedy capital — shows run every week at venues in Khar, Bandra, Andheri and Lower Parel. Book together and make an evening of it.',
    },
  },

  jaipur: {
    intro: [
      'Jaipur mixes old-city bazaars and forts with a growing café scene, which makes it a great place to explore with someone — whether you live here or are visiting.',
      'Most meetups happen around C-Scheme, MI Road, Malviya Nagar and Vaishali Nagar. October to March is the best time to be out and about; in summer, plan for mornings, evenings or indoors.',
    ],
    faqs: [
      {
        q: 'Where do people meet in Jaipur?',
        a: 'Cafés in C-Scheme and Malviya Nagar, MI Road, World Trade Park and the malls in Malviya Nagar, Jawahar Kala Kendra for culture, and Central Park for a walk.',
      },
      {
        q: 'What should I see in Jaipur with a local?',
        a: 'Hawa Mahal and the old-city bazaars, Amer Fort, Nahargarh at sunset, and Jawahar Kala Kendra — a local host can help you skip the tourist traps.',
      },
    ],
    spots: {
      'shopping-buddy':
        'Shopping in Jaipur means Johari Bazaar for jewellery, Bapu Bazaar for textiles and juttis, Chandpole and Tripolia for everything else, and World Trade Park for malls. A buddy who knows fair prices is gold here.',
      'gaming-partner':
        'Gaming partners meet at gaming cafés in Malviya Nagar and Vaishali Nagar, or at the arcades in the city’s malls.',
      'travel-buddy':
        'Trips with a travel buddy from Jaipur: Amer and Nahargarh, a weekend in Pushkar or Ranthambore, or a longer trip to Udaipur or Jaisalmer.',
      'coffee-chat':
        'Coffee chats happen in C-Scheme, Malviya Nagar and around MI Road — and some cafés in the old city have rooftop views of the forts.',
      'career-chat':
        'Career chats usually happen over coffee in C-Scheme or Malviya Nagar, or at co-working spaces across the city.',
    },
  },

  patna: {
    intro: [
      'Patna is growing fast, with new cafés, malls and a lively riverfront — and plenty of students and young professionals looking for company to enjoy it with.',
      'Boring Road, Fraser Road and Bailey Road are where most plans happen. Winter evenings (November to February) are the best time to be out; summers are hot, so plan for evenings or indoors.',
    ],
    faqs: [
      {
        q: 'Where can I meet someone in Patna?',
        a: 'Cafés on Boring Road and Fraser Road, P&M Mall, the Ganga riverfront (Patna Marine Drive) in the evening, Eco Park (Rajdhani Vatika), and Bihar Museum.',
      },
      {
        q: 'What should a newcomer see in Patna?',
        a: 'Bihar Museum, Golghar, Gandhi Maidan, Eco Park and the Ganga riverfront — and a local can show you the best litti chokha in town.',
      },
    ],
    spots: {
      'movie-buddy': 'Movie buddies meet at the multiplexes in P&M Mall and on Boring Road and Fraser Road, usually with a snack or dinner nearby.',
      'shopping-buddy': 'Shopping buddies head to P&M Mall, Boring Road and Fraser Road, and the markets around Hathwa Market and New Market for everyday shopping.',
      'coffee-chat': 'Coffee chats happen in the cafés along Boring Road, Fraser Road and Bailey Road — relaxed spots for a long conversation.',
      'photo-walk': 'Photo walks: Golghar’s view over the city, the Ganga riverfront at sunset, Bihar Museum, and Gandhi Maidan in the early morning.',
      'settle-in-buddy':
        'New to Patna? A settle-in buddy can help you get to know the areas (Boring Road, Kankarbagh, Patliputra), find good food and shops, and figure out getting around.',
    },
  },
};
