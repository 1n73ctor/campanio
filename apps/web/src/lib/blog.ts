export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  emoji: string;
  tone: 'pink' | 'lime' | 'sky' | 'sunny' | 'lavender';
  body: string[];
}

export const POSTS: Post[] = [
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
    excerpt: 'How pricing, payouts and reviews work — and how top hosts earn ₹30k+ a month part-time.',
    date: '2026-07-02',
    emoji: '💸',
    tone: 'pink',
    body: [
      'Being a host is a flexible way to earn doing things you already love: exploring your city, working out, watching movies, or just having a great conversation.',
      'You set your hourly rate and weekly availability. Companio keeps a small commission; the rest lands in your wallet after each session and you can withdraw to UPI anytime.',
      'Top hosts respond fast, keep their availability updated, and write a profile that shows their personality. Reviews do the rest.',
      'And remember: everything is platonic and in public places. That’s what makes members feel safe meetup again and again.',
    ],
  },
];
