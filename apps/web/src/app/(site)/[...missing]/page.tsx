import { notFound } from 'next/navigation';

/**
 * The app has two root layouts (website and admin), so there's no top-level layout to render a global 404.
 * Any URL that matches nothing lands here and shows the website's not-found page, inside the website layout.
 */
export default function Missing() {
  notFound();
}
