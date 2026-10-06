'use client';

import { useEffect, useRef, useState } from 'react';
import type { BookingDto, LocationDto } from '@companio/types';
import { Button, Callout, Card, Modal, Toggle } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { errMsg, timeAgo } from '@/lib/format';
import { useToast } from './toast';
import { TrustedContact } from './trusted-contact';

/** Live location sharing + SOS. Web needs the tab open; the native app will do this in the background. */
export function SafetyPanel({ booking }: { booking: BookingDto }) {
  const { api, user } = useAuth();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const [locs, setLocs] = useState<LocationDto[]>([]);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const last = useRef(0);
  const active = booking.status === 'ACCEPTED' || booking.status === 'IN_PROGRESS';

  useEffect(() => {
    api.bookings.locations(booking.id).then(setLocs).catch(() => {});
  }, [api, booking.id]);

  useRealtime({ 'location:update': (l: LocationDto) => l.bookingId === booking.id && setLocs((x) => [...x.filter((y) => y.userId !== l.userId), l]) }, booking.id);

  useEffect(() => {
    if (!sharing || !active) return;
    if (!('geolocation' in navigator)) {
      toast('Location is not available on this device', 'error');
      setSharing(false);
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last.current < 15_000) return; // throttle to one ping per 15s
        last.current = Date.now();
        api.bookings.shareLocation(booking.id, p.coords.latitude, p.coords.longitude).catch(() => {});
      },
      () => {
        toast('Location permission denied', 'error');
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    };
  }, [sharing, active, api, booking.id, toast]);

  const triggerSos = async () => {
    setSosBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      'geolocation' in navigator ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 }) : resolve(null),
    );
    try {
      const r = await api.bookings.sos(booking.id, { lat: pos?.coords.latitude, lng: pos?.coords.longitude });
      setGuidance(r.guidance);
      setSharing(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSosBusy(false);
    }
  };

  const otherLoc = locs.find((l) => l.userId !== user?.id);
  const shareText = otherLoc ? `https://maps.google.com/?q=${otherLoc.lat},${otherLoc.lng}` : null;

  return (
    <Card tone="sky" className="space-y-4 p-5">
      <h2 className="font-display text-lg font-extrabold">🛡️ Safety</h2>
      <TrustedContact booking={booking} />
      {active ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Share live location</p>
              <p className="text-xs text-ink-soft">Visible to the other person, our safety team and your trusted contact (if shared) during this booking. Keep this tab open.</p>
            </div>
            <Toggle checked={sharing} onChange={setSharing} label="Share live location" />
          </div>
          {otherLoc && (
            <p className="text-sm">
              📍 {booking.viewerRole === 'companion' ? booking.user.name : booking.companion.name}’s location · {timeAgo(otherLoc.updatedAt)} ·{' '}
              <a href={shareText!} target="_blank" rel="noreferrer" className="font-bold underline">
                open map
              </a>
            </p>
          )}
          <Button variant="danger" size="lg" className="w-full" onClick={() => setSosOpen(true)}>
            🚨 SOS
          </Button>
        </>
      ) : (
        <p className="text-sm text-ink-soft">Live location and SOS turn on once the meetup is confirmed.</p>
      )}
      <a href="tel:112" className="block text-center text-sm font-bold underline">
        Emergency? Call 112
      </a>

      <Modal open={sosOpen} onClose={() => { setSosOpen(false); setGuidance(null); }} title="Send SOS?">
        {guidance ? (
          <Callout tone="lime" title="Help is on the way">
            {guidance}
          </Callout>
        ) : (
          <p>This alerts the Companio safety team immediately with your location and meetup details. Use it whenever you feel unsafe — no questions asked.</p>
        )}
        <div className="flex flex-col gap-2">
          {!guidance && (
            <Button variant="danger" size="lg" loading={sosBusy} onClick={triggerSos}>
              Yes, send SOS now
            </Button>
          )}
          <a href="tel:112" className="rounded-chunky border-3 border-ink bg-white py-3 text-center font-display font-bold">
            📞 Call 112
          </a>
        </div>
      </Modal>
    </Card>
  );
}
