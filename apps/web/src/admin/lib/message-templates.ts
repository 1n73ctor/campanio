/** Ready-made admin messages. Everything stays editable after picking one; links are pages on our own site. */
export interface MessageTemplate {
  label: string;
  title: string;
  body: string;
  link: string;
}

/** For one person (Users → a user → Send a message). */
export const USER_TEMPLATES: MessageTemplate[] = [
  { label: 'Profile photo', title: 'Please update your profile photo', body: 'Hi! A clear face photo helps people trust you. Please upload one from your Account page.', link: '/account' },
  { label: 'Add email', title: 'Add your email address', body: 'Hi! Please add your email on your Account page so we can send you meetup receipts and important updates.', link: '/account' },
  { label: 'Verification', title: 'Your verification needs attention', body: 'Hi! Please check your ID verification and re-submit if anything is unclear. Use good light and make sure your face is clearly visible in the selfie.', link: '/companion/kyc' },
  { label: 'Complete host profile', title: 'Finish your host profile', body: 'Hi! Add a few photos, a short “About you” and your weekly availability so members can find you and send meetup requests.', link: '/companion/dashboard' },
  { label: 'Set availability', title: 'Add your available hours', body: 'Hi! Members can only send requests for times you’re available. Set your weekly hours from your host dashboard.', link: '/companion/dashboard' },
  { label: 'Payout sent', title: 'Your payout is on its way 🏦', body: 'Hi! We’ve sent your payout to your UPI ID. It usually arrives within a few hours. Thanks for hosting with Companio!', link: '/wallet' },
  { label: 'Invite to host', title: 'You’d make a great host', body: 'Hi! Love coffee chats, city walks or the gym? Become a host on Companio — set your own rate and hours, and earn from the things you already enjoy.', link: '/become-a-companion' },
  { label: 'Warning', title: 'A reminder about our guidelines', body: 'Hi! We received a concern about a recent meetup. Please keep every meetup platonic, in public places, and all payments on Companio. Repeated issues can lead to suspension.', link: '/community-guidelines' },
  { label: 'Final warning', title: 'Final warning', body: 'Hi. This is a final warning about breaking our community guidelines. Any further report will lead to your account being suspended.', link: '/community-guidelines' },
];

/** For many people at once (Broadcast). */
export const BROADCAST_TEMPLATES: MessageTemplate[] = [
  { label: 'New activities', title: 'New things to do on Companio ✨', body: 'Hi! You can now find hosts for food walks, festivals, photo walks, comedy shows, language exchange and more. Take a look!', link: '/explore' },
  { label: 'Weekend plans', title: 'Plans for the weekend? 🎉', body: 'Hi! Hosts near you have time this weekend — coffee chats, city walks, movies and more. Send a request and make a plan.', link: '/explore' },
  { label: 'Festival', title: 'Festival season is here 🪔', body: 'Hi! Celebrate with company — find a festival buddy for Garba nights, pandal hopping or Diwali melas near you.', link: '/explore/festival-buddy' },
  { label: 'Safety reminder', title: 'Your safety comes first 🛡️', body: 'A quick reminder: always meet in busy public places, keep chat and payment on Companio, share your live location with someone you trust, and use SOS if you ever feel unsafe.', link: '/safety' },
  { label: 'Recruit hosts', title: 'Earn by being good company 💸', body: 'Hi! Become a host on Companio — set your own rate and hours, keep 85% of your rate and withdraw to UPI. Strictly platonic, ID verification required.', link: '/become-a-companion' },
  { label: 'Hosts: set availability', title: 'Hosts: update your availability', body: 'Hi! Members are looking for plans this week. Make sure your weekly hours are up to date so they can send you requests.', link: '/companion/dashboard' },
  { label: 'Add email', title: 'Add your email address', body: 'Hi! Please add your email on your Account page so we can send you meetup receipts and important updates.', link: '/account' },
  { label: 'Maintenance', title: 'Short maintenance tonight', body: 'Hi! Companio will be briefly unavailable tonight for maintenance. Your meetups, wallet and messages are safe — thanks for your patience.', link: '' },
];
