import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';

/** Shared by the website and admin root layouts. */
export const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700', '800'] });
export const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
export const fontVars = `${display.variable} ${body.variable}`;
