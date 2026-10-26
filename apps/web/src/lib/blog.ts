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
