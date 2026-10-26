/** Built-in site content shared by the website and the API (the API uses it to avoid repeating topics). */

/**
 * A paragraph, a heading or a bullet list. Text may use **bold** and [links](/explore/...) — internal links help the
 * city pages rank.
 */
export type Block = string | { h: string } | { ul: string[] };

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  emoji: string;
  tone: 'pink' | 'lime' | 'sky' | 'sunny' | 'lavender';
  body: Block[];
}

export const POSTS: Post[] = [
  {
    slug: 'rent-a-friend-in-india',
    title: 'Rent a friend in India: what it is, and how to do it safely',
    excerpt: 'Paying someone to keep you company sounds strange — until you need a gym partner, a city guide or someone to go to a show with. Here’s how it works, platonically and safely.',
    date: '2026-10-27',
    emoji: '🤝',
    tone: 'lavender',
    body: [
      '“Rent a friend” started as an idea from Japan and the US, and it’s now something people search for in India too. The phrase sounds odd, but the need behind it is simple: sometimes you want company for a specific thing — a movie, a gym session, a walk around a new city — and there’s nobody free to go with.',
      { h: 'What it actually means' },
      'Renting a friend means paying someone for their **time and company for an activity** — like hiring a local guide, but for everyday plans. It is **not dating**, not a romantic arrangement, and never anything sexual. On Companio, that’s a hard rule: any romantic or sexual solicitation gets an account banned.',
      { h: 'Who uses it' },
      { ul: ['**People new to a city** who want someone to show them around and help them settle in.', '**Solo travellers** who’d like a local to explore with.', '**People building a habit** — a gym partner or a running buddy makes it stick.', '**Anyone with a plan and no one to go with** — a comedy show, a festival, a food walk, an event plus-one.', '**Older people** who’d enjoy company for a walk, a chat or an errand.'] },
      { h: 'What it looks like in practice' },
      'You pick an activity and a city, see verified hosts with their photos, reviews and hourly rates, and request a meetup at a time that suits you both. For example, a [coffee chat in Delhi](/explore/coffee-chat/delhi), a [shopping buddy in Jaipur](/explore/shopping-buddy/jaipur) or a [movie buddy in Mumbai](/explore/movie-buddy/mumbai).',
      { h: 'How much it costs' },
      'Hosts set their own hourly rate — on Companio, most charge a few hundred rupees an hour — plus a small connection fee and GST. You see the full breakdown before you pay, and the money stays in escrow until the meetup actually happens.',
      { h: 'How to do it safely' },
      { ul: ['**Only meet verified people.** Every Companio host passes a government ID check and a live selfie.', '**Meet in public places** — cafés, malls, parks in daylight, busy markets. Never a home or hotel room.', '**Never pay outside the platform.** Anyone asking for money directly is a red flag.', '**Share your live location** with a trusted contact during the meetup, and use SOS if anything feels wrong.', '**Keep it about the activity.** If someone pushes for anything romantic or private, leave and report them.'] },
      'Read the full [safety checklist for meeting someone new](/blog/meeting-someone-from-the-internet-safely), or [how we keep every meetup safe](/safety).',
      { h: 'Is it weird?' },
      'Less than it sounds. People already pay for tour guides, personal trainers and tutors — this is the same idea for everyday company. And for a lot of people, one good meetup is the push they needed to start going out more.',
      'Ready to try it? [Explore verified hosts near you](/explore).',
    ],
  },
  {
    slug: 'things-to-do-in-jaipur-with-a-local',
    title: 'Things to do in Jaipur with a local (beyond the tourist trail)',
    excerpt: 'Bazaars, forts at sunset, rooftop cafés and day trips — Jaipur is better with someone who knows it.',
    date: '2026-10-27',
    emoji: '🏰',
    tone: 'sunny',
    body: [
      'Jaipur is one of the easiest cities in India to fall in love with — and one of the easiest to do badly. Go with someone who lives there and you skip the overpriced shops, find the good food, and see the forts at the right time of day.',
      { h: '1. Shop the old-city bazaars properly' },
      'Johari Bazaar for jewellery, Bapu Bazaar for textiles and juttis, Chandpole and Tripolia for everything else. A local knows what things should cost and which shops are worth your time. A [shopping buddy in Jaipur](/explore/shopping-buddy/jaipur) pays for themselves quickly here.',
      { h: '2. Catch the sunset at Nahargarh' },
      'Nahargarh Fort sits above the city, and the view at sunset is the best in Jaipur. Go in the late afternoon, walk the walls, and stay for the lights coming on below.',
      { h: '3. Do Amer Fort early' },
      'Amer is spectacular and very busy. Arrive when it opens and you’ll have the courtyards almost to yourself for the first hour.',
      { h: '4. Find a rooftop café with a view' },
      'Some cafés around the old city look straight at the forts and Hawa Mahal; C-Scheme and Malviya Nagar have the newer café scene. A [coffee chat in Jaipur](/explore/coffee-chat/jaipur) is a relaxed way to meet someone local.',
      { h: '5. Spend an evening at Jawahar Kala Kendra' },
      'JKK hosts exhibitions, theatre, music and craft events — a good way to see the city’s creative side, especially in the winter season.',
      { h: '6. Take a day or weekend trip' },
      'Pushkar is an easy weekend, Ranthambore is great for a safari, and Udaipur or Jaisalmer make a longer trip. A [travel buddy from Jaipur](/explore/travel-buddy/jaipur) makes the planning (and the road) more fun.',
      { h: '7. Play, talk shop, or just hang out' },
      'Jaipur has a growing gaming-café scene in Malviya Nagar and Vaishali Nagar — find a [gaming partner](/explore/gaming-partner/jaipur) — and plenty of co-working cafés if you’d like a [career chat](/explore/career-chat/jaipur) with someone in your field.',
      { h: 'When to go' },
      'October to March is ideal. In summer, plan for early mornings and evenings, and keep afternoons indoors.',
      'Every Companio host is ID-verified, meetups happen in public places, and your payment stays in escrow until you meet. [Read how safety works](/safety).',
    ],
  },
  {
    slug: 'new-to-patna-first-week-guide',
    title: 'New to Patna? Your first-week guide',
    excerpt: 'Where to live, how to get around, what to eat and how to meet people in your first week in Patna.',
    date: '2026-10-27',
    emoji: '🏙️',
    tone: 'sky',
    body: [
      'Moving to Patna for a job, college or coaching? The city is growing fast, and with a little help the first week can go from confusing to comfortable. Here’s a simple plan.',
      { h: 'Day 1–2: get your bearings' },
      'Most newcomers live or work around **Boring Road**, **Kankarbagh**, **Patliputra**, **Rajendra Nagar** or **Bailey Road**. Learn the main roads first — Fraser Road, Boring Road, Bailey Road and Ashok Rajpath — and you’ll find your way around most of the city. Autos and e-rickshaws are everywhere; app cabs work well for longer trips.',
      { h: 'Day 3: sort out daily life' },
      'Find your nearest market, a reliable grocery shop and a place to eat every day. **Hathwa Market** and **New Market** cover most everyday shopping, and **P&M Mall** has the big stores and a multiplex.',
      { h: 'Day 4: see the city' },
      { ul: ['**Bihar Museum** — modern, beautiful and genuinely interesting.', '**Golghar** — climb it for a view over the city and the Ganga.', '**Gandhi Maidan** — the heart of Patna, best in the early morning.', '**Eco Park (Rajdhani Vatika)** — green, calm and good for a walk.', '**The Ganga riverfront (Patna Marine Drive)** — lively in the evenings.'] },
      { h: 'Day 5: eat like a local' },
      'Litti chokha, sattu drinks, malpua and the evening street food along Boring Road are the place to start. Ask a local where *they* go — the best stalls rarely have signs.',
      { h: 'Day 6–7: meet people' },
      'The first week is often the loneliest. A [settle-in buddy in Patna](/explore/settle-in-buddy/patna) can show you around and answer the questions you don’t want to ask your landlord. Or keep it simple: a [coffee chat](/explore/coffee-chat/patna), a [movie](/explore/movie-buddy/patna), or a [photo walk](/explore/photo-walk/patna) along the riverfront.',
      { h: 'A few practical tips' },
      { ul: ['Winters (November–February) are pleasant; summers are hot — plan outings for evenings.', 'Keep some cash for autos and small shops, even though UPI works almost everywhere.', 'Share your live location with someone when you’re out late in a new area.'] },
      'Every host on Companio is ID-verified, meetups happen in public places, and payment stays in escrow until you meet. [Here’s how safety works](/safety).',
    ],
  },
  {
    slug: 'things-to-do-alone-in-delhi',
    title: 'Things to do alone in Delhi (and when to bring a buddy)',
    excerpt: 'Gardens, food lanes, markets and monuments — the best solo plans in Delhi, and the ones that are better with company.',
    date: '2026-10-27',
    emoji: '🕌',
    tone: 'pink',
    body: [
      'Delhi rewards people who go out and explore — and a lot of it is perfectly enjoyable alone. Here are the best solo plans, plus the ones that are more fun with someone.',
      { h: 'Great on your own' },
      { ul: ['**Lodhi Garden at sunrise** — walkers, joggers, old tombs and birdsong.', '**Sunder Nursery** — beautifully restored gardens next to Humayun’s Tomb.', '**Humayun’s Tomb and Mehrauli Archaeological Park** — quiet history, best in the morning.', '**Lodhi Art District** — street murals across Lodhi Colony, ideal for a slow walk with a camera.', '**A long coffee in Khan Market or Shahpur Jat** — with a book or a journal.'] },
      { h: 'Better with a buddy' },
      { ul: ['**Old Delhi food walk** — Chandni Chowk, Paranthe Wali Gali and the lanes near Jama Masjid. More people means more dishes. Try a [food walk buddy](/explore/food-walk/delhi).', '**Shopping at Sarojini or Janpath** — a second opinion and someone who can bargain helps. Find a [shopping buddy](/explore/shopping-buddy/delhi).', '**Festivals** — Durga Puja in CR Park, Diwali melas, Holi gatherings. Big crowds are easier (and more fun) with someone. See [festival buddies](/explore/festival-buddy/delhi).', '**A day trip to Agra or a weekend in Rishikesh** — share the planning with a [travel buddy](/explore/travel-buddy/delhi).', '**Gym or morning runs** — a partner keeps you consistent. Read [how to find a gym partner in Delhi](/blog/find-a-gym-partner-in-delhi).'] },
      { h: 'Evenings' },
      'Connaught Place, Hauz Khas and Khan Market are lively after 6 pm, with cafés and walks around the market. If you’d like company, a [walk & talk](/explore/walk-and-talk/delhi) or a [coffee chat](/explore/coffee-chat/delhi) is a low-pressure way to meet someone.',
      { h: 'Getting around' },
      'The Delhi Metro reaches almost all of these places, and the first coach of every train is reserved for women. Avoid peak rush hours if you can, and share your live location when you’re out late.',
      { h: 'Weather matters' },
      'October to March is the best season for being outdoors. From May to July, go early or late and keep the afternoons indoors. On high-pollution days in winter, choose museums and cafés over parks.',
      'If you’d like company for any of these, every Companio host is ID-verified, meetups happen in public places, and your payment stays in escrow until you meet. [Explore hosts in Delhi](/explore/city-guide/delhi).',
    ],
  },
  {
    slug: 'things-to-do-alone-in-bengaluru',
    title: 'Things to do alone in Bengaluru (and how to find company for them)',
    excerpt: 'From sunrise at Nandi Hills to comedy nights in Indiranagar — what to do in Bengaluru on your own, and when it’s nicer with someone.',
    date: '2026-10-27',
    emoji: '🌳',
    tone: 'lime',
    body: [
      'Bengaluru is full of people who moved here for a job or a course and are still building their circle. If you’re one of them, the good news is that this city is easy to enjoy alone — and even easier with someone who wants to do the same thing.',
      'Here are the plans that work best, roughly in order of how easy they are to do on your own.',
      { h: '1. Walk Cubbon Park or Lalbagh in the morning' },
      'Cubbon Park and Lalbagh are at their best before 9 am: cool air, runners, families and old trees. It’s a calm way to start a weekend and a good place to just think. Cubbon Park also has the **State Central Library** if you want a quiet hour with a book afterwards.',
      { h: '2. Catch the sunrise at Nandi Hills' },
      'Nandi Hills is about 60 km from the city, and the sunrise above the clouds is worth the early alarm. It’s a classic plan to do with someone — sharing the drive (and staying awake) is easier with two. A [travel buddy in Bengaluru](/explore/travel-buddy/bengaluru) is a good way to make it happen.',
      { h: '3. Eat your way through VV Puram food street' },
      'VV Puram near Basavanagudi comes alive in the evening with dosas, holige, bajjis and sweets. Food streets are more fun with someone — you can try twice as many things.',
      { h: '4. Go to a comedy show' },
      'Bengaluru has one of India’s busiest comedy scenes, with shows most nights in Indiranagar, Koramangala and around MG Road. Going alone is completely normal — but laughing with someone is better. A [comedy & shows buddy](/explore/comedy-and-shows/bengaluru) can make it a regular plan.',
      { h: '5. Get a gym or sports routine going' },
      'The hardest part of a fitness habit is showing up. Weekend runs in Cubbon Park or around Ulsoor Lake, turf football in HSR Layout and badminton courts across the city all get easier with a partner who expects you. See [gym partners in Bengaluru](/explore/gym-partner/bengaluru) or [sports partners](/explore/sports-partner/bengaluru).',
      { h: '6. Explore the old markets' },
      'KR Market early in the morning is a riot of flowers and colour, and Commercial Street and Chickpet are where locals actually shop. A [local city guide](/explore/city-guide/bengaluru) can show you around — and tell you which area to live in if you’re still deciding.',
      { h: '7. Day trip to Mysuru' },
      'Mysuru is an easy train ride away: the palace, Chamundi Hills and some of the best dosas in Karnataka. Further out, Coorg and Chikkamagaluru are perfect for a weekend of coffee estates and quiet.',
      { h: 'Doing it with someone, safely' },
      'If you’d like company for any of these, Companio lets you meet a **verified local host** for a specific activity — strictly platonic, in public places. Every host passes an ID and live-selfie check, payment stays in escrow until the meetup actually happens, and you can share your live location and use SOS during every meetup. [Read how we keep meetups safe](/safety).',
      'Start small: one coffee, one walk, one show. Bengaluru gets a lot friendlier once you have someone to say “let’s go” to.',
    ],
  },
  {
    slug: 'find-a-gym-partner-in-delhi',
    title: 'How to find a gym partner in Delhi (and actually keep going)',
    excerpt: 'Why a workout partner works, where people train in Delhi, and how to find someone reliable — without awkwardness.',
    date: '2026-10-27',
    emoji: '🏋️',
    tone: 'sky',
    body: [
      'Most people don’t quit the gym because the workout is too hard — they quit because it’s too easy to skip. A gym partner fixes that: when someone is waiting for you at 7 am, you go.',
      { h: 'Why a workout partner helps' },
      { ul: ['**You show up more often** — skipping means letting someone down.', '**You push a little harder** — a spotter makes heavier lifts safer, and a running partner keeps the pace honest.', '**It’s more fun** — the session becomes the social part of your day, not a chore.'] },
      { h: 'Where people train in Delhi' },
      'Indoors, most partners simply join the same gym. Outdoors, Delhi has great spaces for running and bodyweight training — **Lodhi Garden**, **Nehru Park**, the paths of **Sunder Nursery** and the lawns around **India Gate** are busy with walkers and runners every morning.',
      'Timing matters in Delhi. From October to March, mornings are perfect for outdoor sessions. From May to July, train early, late, or indoors — and drink more water than you think you need. During high-pollution weeks in winter, move workouts indoors.',
      { h: 'Where to find a gym partner' },
      { ul: ['**Ask at your gym** — trainers often know members with similar timings and goals.', '**Join a run club** — many meet on weekend mornings in the big parks.', '**Use Companio** — book a verified [gym partner in Delhi](/explore/gym-partner/delhi) for a session, see if you click, and make it a routine.'] },
      { h: 'How to pick the right partner' },
      { ul: ['**Same timing** — a partner who can only make evenings won’t help a morning habit.', '**Similar goals** — strength, running, weight loss or general fitness.', '**Reliability over expertise** — someone who turns up beats someone who knows everything.'] },
      { h: 'Make the first session easy' },
      'Agree on the place, time and plan beforehand. Keep the first session short and simple — a run in the park or a standard gym routine — so you can focus on whether you work well together.',
      'If you meet through Companio, every host is ID-verified, meetups are in public places, and you can share your live location during the session. [Here’s how safety works](/safety).',
      { h: 'The bottom line' },
      'Consistency beats intensity. Find one reliable person, pick fixed days, and protect those slots like meetings. Three months from now, you’ll be glad you did.',
    ],
  },
  {
    slug: 'meeting-someone-from-the-internet-safely',
    title: 'Is it safe to meet someone from the internet? A practical checklist',
    excerpt: 'A simple before, during and after checklist for meeting someone new — for an activity, a hobby or a city walk.',
    date: '2026-10-27',
    emoji: '🛡️',
    tone: 'sunny',
    body: [
      'Meeting people online for an activity — a walk, a gym session, a city tour — is normal now. Most meetings go perfectly fine, and a few simple habits make them even safer. Here’s the checklist we recommend, whether you use Companio or not.',
      { h: 'Before you meet' },
      { ul: ['**Check they’re verified.** On Companio, every host passes a government ID check and a live selfie before they can be booked.', '**Read their profile and reviews.** Look for real photos, a clear description and feedback from past meetups.', '**Keep chats on the platform.** Don’t move to personal numbers or social media until you’re comfortable.', '**Never pay outside the app.** Payments on Companio sit in escrow until the meetup happens — anyone asking for money directly is a red flag.', '**Tell a friend your plan** — who, where and when.'] },
      { h: 'Choosing the place' },
      { ul: ['**Public and busy:** cafés, malls, parks in daylight, popular markets.', '**Easy to leave:** near a metro station or main road.', '**Not a home or a hotel room** — for any first meeting, ever.'] },
      { h: 'During the meetup' },
      { ul: ['**Share your live location** with a trusted contact. On Companio, you can do this from the meetup screen.', '**Know your exit.** Arrange your own transport and keep your phone charged.', '**Trust your gut.** If anything feels off, leave — you don’t owe anyone an explanation.', '**Use SOS if you need it.** Companio’s SOS reaches our safety team immediately.'] },
      { h: 'Red flags to watch for' },
      { ul: ['Pressure to change the place or go somewhere private.', 'Requests for money, loans or payments outside the platform.', 'Romantic or sexual messages on a platonic platform.', 'Refusing to meet in public, or pushing for personal details early.'] },
      'On Companio, any of these gets an account reported and reviewed — and sexual or romantic solicitation gets it banned. Report it from the profile or chat.',
      { h: 'After the meetup' },
      'Leave an honest review — it helps the next person decide. If something went wrong, report it; our team reviews every report.',
      { h: 'How Companio is built for this' },
      'We designed Companio around these habits: verified hosts, public meetups, a start code you share in person so the meetup only starts when you’re both there, escrow payments, live location sharing and SOS. [Read the full safety guide](/safety), or [find a verified host near you](/explore).',
    ],
  },
  {
    slug: 'moving-to-mumbai-alone',
    title: 'Moving to Mumbai alone: your first-month guide',
    excerpt: 'Getting around, choosing an area, and building a social life in your first weeks in Mumbai.',
    date: '2026-10-27',
    emoji: '🌊',
    tone: 'pink',
    body: [
      'Mumbai is exciting, fast and a little overwhelming at first. The first month is about three things: learning to get around, settling into a neighbourhood, and finding a few people to do things with. Here’s a simple plan.',
      { h: 'Week 1: learn to get around' },
      'The local trains are Mumbai’s lifeline. Learn the three lines — Western, Central and Harbour — and avoid peak hours (roughly 8–11 am and 6–9 pm) while you’re new. Use a smart card or the UTS app for tickets. The Metro lines are growing and are a calmer option for some routes.',
      { h: 'Week 2: get to know your neighbourhood' },
      'Every area has its own rhythm. Bandra and Khar are lively and social, Andheri is central for work, Powai is greener and quieter, and South Mumbai (Colaba, Fort) is full of history. Walk your area, find a café you like, a grocery shop, and a place to eat alone comfortably.',
      { h: 'Week 3: find your people' },
      'This is where most people get stuck — work fills the week, and weekends go quiet. Pick one or two activities and do them regularly:',
      { ul: ['**Evening walks** on Marine Drive, Carter Road or Bandstand — see [walk & talk in Mumbai](/explore/walk-and-talk/mumbai).', '**Coffee** in Bandra, Kala Ghoda or Lower Parel — see [coffee chats in Mumbai](/explore/coffee-chat/mumbai).', '**Comedy shows** in Khar, Bandra and Andheri — see [comedy & shows in Mumbai](/explore/comedy-and-shows/mumbai).', '**Movies** at the multiplexes in Lower Parel or Andheri — see [movie buddies in Mumbai](/explore/movie-buddy/mumbai).'] },
      { h: 'Week 4: build a routine' },
      'Friendships come from repetition. The same gym, the same Sunday walk, the same café — familiar faces become friends. Say yes to invitations, even small ones.',
      { h: 'Monsoon tips' },
      'From June to September, carry an umbrella and a spare pair of slippers, check train updates before you leave, and keep a backup indoor plan for every outing.',
      { h: 'Don’t do it all alone' },
      'If you’d like company while you settle in, Companio connects you with **verified local hosts** for platonic activities — a city walk, coffee, a show. Every host is ID-checked, meetups are in public places, and payment stays in escrow until you meet. [Find someone in Mumbai](/explore/coffee-chat/mumbai), or read [how we keep meetups safe](/safety).',
    ],
  },
  {
    slug: 'new-city-no-friends',
    title: 'New city, no friends? A 7-day plan to feel at home',
    excerpt: 'Moved for college or work? Here’s how to go from knowing nobody to having plans every weekend.',
    date: '2026-08-18',
    emoji: '🏙️',
    tone: 'sky',
    body: [
      'Moving to a new city is exciting for about 48 hours — then the loneliness hits. The good news: building a social life is a skill, and it’s faster than you think.',
      'Day 1–2: explore on foot. Meet a local city guide for two hours and ask them for their personal list of cafés, markets and weekend spots. You’ll get a year of recommendations in an afternoon.',
      'Day 3–4: pick one recurring activity — a gym, a run club, a board-game café. Consistency beats intensity. A gym partner makes you actually show up.',
      'Day 5–7: say yes. Events, open mics, community meetups. Bringing a plus-one makes walking into a room of strangers way less scary.',
    ],
  },
  {
    slug: 'safety-first-meetups',
    title: 'How we keep every meetup safe',
    excerpt: 'ID checks, start codes, escrow, live location and SOS — what happens behind the scenes.',
    date: '2026-07-30',
    emoji: '🛡️',
    tone: 'lime',
    body: [
      'Safety isn’t a feature for us, it’s the product. Every host goes through government ID verification and a live-selfie liveness check before they’re listed.',
      'When you send a request, your money goes into escrow. The host only gets paid after the session happens — and the session only starts when you share your 4-digit start code in person.',
      'During a meetup you can share your live location with a trusted contact, and the SOS button alerts our safety team instantly with your location.',
      'Chats automatically hide phone numbers, UPI IDs and links so nobody gets pushed into unsafe off-platform deals.',
    ],
  },
  {
    slug: 'become-a-companion-guide',
    title: 'Earning as a host: the honest guide',
    excerpt: 'How pricing, payouts and reviews work — set your own rate and hours, and get paid to your UPI after each meetup.',
    date: '2026-07-02',
    emoji: '💸',
    tone: 'pink',
    body: [
      'Being a host is a flexible way to earn doing things you already love: exploring your city, working out, watching movies, or just having a great conversation.',
      'You set your hourly rate and weekly availability. Companio keeps a small commission; the rest lands in your wallet after each session and you can withdraw to UPI anytime.',
      'Top hosts respond fast, keep their availability updated, and write a profile that shows their personality. Reviews do the rest.',
      'And remember: everything is platonic and in public places. That’s what makes members feel safe to meet up again and again.',
    ],
  },
];

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

/** A blog post stored in the database (admin-written or AI-drafted). */
export interface BlogPostDto extends Post {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  source: 'AI' | 'ADMIN';
  model: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A city's landing-page text stored in the database (overrides the built-in guide). */
export interface CityGuideDto extends CityGuide {
  city: string;
  status: 'DRAFT' | 'PUBLISHED';
  source: 'AI' | 'ADMIN';
  updatedAt: string;
}
