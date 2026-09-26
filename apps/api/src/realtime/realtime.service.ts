import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Thin wrapper so any service can push realtime events without depending on the gateway. */
@Injectable()
export class RealtimeService {
  server: Server | null = null;

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
  toBooking(bookingId: string, event: string, data: unknown) {
    this.server?.to(`booking:${bookingId}`).emit(event, data);
  }
  toAdmins(event: string, data: unknown) {
    this.server?.to('admins').emit(event, data);
  }
}
