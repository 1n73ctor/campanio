export const metadata = { title: 'Offline' };
export default function Offline() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl">📡</p>
      <h1 className="text-3xl font-extrabold">You’re offline</h1>
      <p className="text-ink-soft">Reconnect to browse hosts and manage meetups. In an emergency, call 112.</p>
    </div>
  );
}
