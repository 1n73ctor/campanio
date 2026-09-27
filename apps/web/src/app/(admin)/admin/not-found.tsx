import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-2xl font-extrabold">Page not found</p>
      <Link href="/admin" className="mt-3 inline-block font-semibold underline">
        Back to dashboard
      </Link>
    </div>
  );
}
