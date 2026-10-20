import { formatINR, type PlatformSettings } from '@companio/types';

/**
 * Answers that need no AI call (free): greetings and thanks, the starter questions in the chat window, and close
 * matches to answers an admin approved. Everything else goes to the model.
 */
const norm = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('a an the is are am i me my to of for in on at do does can could how what when where why who will would should please pls kya hai ka ki ke mein mujhe main and or it this that with be with about'.split(' '));
const words = (t: string) => new Set(norm(t).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));

const GREETING = /^(hi+|hello+|hey+|hii+|helo|namaste|namaskar|hola|yo|good (morning|afternoon|evening)|hi there|hello there)( riya)?$/;
const THANKS = /^(thanks?|thank you( so much| very much)?|thx|ty|ok+|okay|cool|great|got it|nice|perfect|shukriya|dhanyavad|thanks riya|ok thanks|okay thanks)$/;
const BYE = /^(bye+|goodbye|see you|tata|good night)$/;

export interface InstantContext {
  settings: PlatformSettings;
  firstName: string | null;
  knowledge: { question: string; answer: string }[];
  /** for signed-in starters, read from the database */
  coins?: () => Promise<string>;
  nextMeetup?: () => Promise<string>;
}

export async function instantAnswer(message: string, ctx: InstantContext): Promise<string | null> {
  const n = norm(message);
  const s = ctx.settings;
  const hi = ctx.firstName ? ` ${ctx.firstName}` : '';
  if (GREETING.test(n)) return `Hi${hi}! 👋 What can I help you with — meetups, safety, hosting, or your account?`;
  if (THANKS.test(n)) return 'You’re welcome! Anything else I can help with?';
  if (BYE.test(n)) return 'Bye! Have a lovely day — I’m here whenever you need me. 👋';

  switch (n) {
    case 'how does booking work':
      return `It’s simple:\n- Find a host on Explore (by city, activity, price or availability)\n- Request a meetup and pay — your money is held safely until the meetup happens\n- The host accepts (or you get a full refund if they don’t within ${s.requestExpiryHours}h)\n- Meet in a public place and share your 4-digit start code to begin\n\nAnything specific you’d like to know?`;
    case 'is it safe':
      return 'Safety comes first on Companio:\n- Every host is ID + live-selfie verified\n- Meetups happen only in public places\n- Share your live location with a trusted contact, and use one-tap SOS anytime\n- Your payment is held until the meetup happens\n- Block or report anyone, anytime\n\nIn an emergency, use SOS in the app or call 112.';
    case 'how much does it cost':
      return `Each host sets their own hourly rate (you see it on their profile). On top of that there’s a ${formatINR(s.connectionFee)} connection fee and ${s.gstPct}% GST. The exact total is always shown before you pay — no surprises.`;
    case 'how do i become a host':
      return `Tap “Become a host”, set up your profile (headline, about, rate, activities, availability), then verify your ID — usually reviewed within 24 hours. You keep ${100 - s.commissionPct}% of your hourly rate and withdraw earnings to UPI.${s.companionFeeFemaleOn || s.companionFeeMaleOn ? ' There may be a one-time registration fee, shown before you apply.' : ''}`;
    case 'how many coins do i have':
      return ctx.coins ? ctx.coins() : 'Sign in and I can check your coins for you — or see them anytime in your Wallet.';
    case 'is my booking confirmed':
      return ctx.nextMeetup ? ctx.nextMeetup() : 'Sign in and I can check your meetups — or open “My meetups” from the menu.';
  }

  // a question an admin already answered (same words, give or take)
  const q = words(message);
  if (q.size >= 2) {
    let best: { answer: string; score: number } | null = null;
    for (const k of ctx.knowledge) {
      const kw = words(k.question);
      if (!kw.size) continue;
      const common = [...q].filter((w) => kw.has(w)).length;
      const score = common / new Set([...q, ...kw]).size;
      if (score > (best?.score ?? 0)) best = { answer: k.answer, score };
    }
    if (best && best.score >= 0.75) return best.answer;
  }
  return null;
}
