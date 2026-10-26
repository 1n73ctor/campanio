'use client';

import { useRef, useState } from 'react';

/**
 * Host photos in a grid the host can reorder: drag a photo (mouse, or press-and-drag on a phone) or use the ◀ ▶
 * arrows. `onOrder` is called once a move is finished. The profile picture is marked; others can be made it.
 */
export function PhotoOrder({
  photos,
  profileUrl,
  busy,
  onOrder,
  onRemove,
  onMakeProfile,
  children,
}: {
  photos: string[];
  profileUrl: string | null | undefined;
  busy: boolean;
  onOrder: (next: string[]) => void;
  onRemove: (index: number) => void;
  onMakeProfile: (index: number) => void;
  /** e.g. the "add photo" tile, shown after the photos */
  children?: React.ReactNode;
}) {
  const [live, setLive] = useState<string[] | null>(null); // order while dragging
  const [dragging, setDragging] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const shown = live ?? photos;

  const move = (list: string[], from: number, to: number) => {
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
  };

  const startDrag = (e: React.PointerEvent, url: string) => {
    if (busy || photos.length < 2) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(url);
    setLive(photos);
  };
  const dragMove = (e: React.PointerEvent) => {
    if (!dragging || !live) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo]');
    const target = over?.dataset.photo;
    if (!target || target === dragging) return;
    setLive(move(live, live.indexOf(dragging), live.indexOf(target)));
  };
  const endDrag = () => {
    if (!dragging) return;
    const next = live;
    setDragging(null);
    setLive(null);
    if (next && next.some((u, i) => u !== photos[i])) onOrder(next);
  };

  return (
    <div ref={grid} className="grid grid-cols-3 gap-3 sm:grid-cols-6" onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {shown.map((p, i) => {
        const isProfile = p === profileUrl;
        return (
          <div key={p} data-photo={p} className={`relative select-none ${dragging === p ? 'z-10 scale-105 opacity-80' : ''} transition-transform`}>
            <img
              src={p}
              alt={`Photo ${i + 1}`}
              draggable={false}
              onPointerDown={(e) => startDrag(e, p)}
              className={`aspect-square w-full cursor-grab touch-none rounded-chunky border-3 object-cover active:cursor-grabbing ${isProfile ? 'border-pink ring-2 ring-pink' : 'border-ink'}`}
            />
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-ink/75 px-1.5 text-[11px] font-bold text-white">{i + 1}</span>
            <button
              type="button"
              aria-label="Remove photo"
              disabled={busy}
              className="absolute -right-2 -top-2 h-7 w-7 rounded-full border-2 border-ink bg-white font-bold"
              onClick={() => onRemove(photos.indexOf(p))}
            >
              ×
            </button>
            <button
              type="button"
              aria-label="Move left"
              disabled={busy || i === 0}
              onClick={() => onOrder(move(photos, i, i - 1))}
              className="absolute bottom-9 left-1.5 h-7 w-7 rounded-full border-2 border-ink bg-white text-xs font-bold shadow-sm disabled:hidden"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Move right"
              disabled={busy || i === shown.length - 1}
              onClick={() => onOrder(move(photos, i, i + 1))}
              className="absolute bottom-9 right-1.5 h-7 w-7 rounded-full border-2 border-ink bg-white text-xs font-bold shadow-sm disabled:hidden"
            >
              ▶
            </button>
            <div className="mt-1.5 text-center">
              {isProfile ? (
                <span className="text-xs font-extrabold text-pink-deep">★ Profile photo</span>
              ) : (
                <button type="button" disabled={busy} onClick={() => onMakeProfile(photos.indexOf(p))} className="text-xs font-bold underline">
                  Use as profile
                </button>
              )}
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
}
