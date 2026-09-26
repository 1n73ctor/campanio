import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import type { JwtPayload } from '../common/auth';
import { BookingsService } from '../bookings/bookings.service';
import { RealtimeService } from './realtime.service';

interface SocketData {
  userId: string;
  role: string;
}

/**
 * Socket.IO gateway (namespace /rt). Rooms: user:<id>, booking:<id>, admins.
 * For multiple API instances add @socket.io/redis-adapter pointing at Redis.
 */
@WebSocketGateway({ namespace: '/rt', cors: { origin: config.corsOrigins, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private log = new Logger('Realtime');

  constructor(
    private rt: RealtimeService,
    private jwt: JwtService,
    private prisma: PrismaService,
    private bookings: BookingsService,
  ) {}

  afterInit(server: Server) {
    this.rt.server = server;
  }

  async handleConnection(socket: Socket) {
    try {
      const token = (socket.handshake.auth?.token as string | undefined) ?? '';
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'ACTIVE') throw new Error('inactive');
      (socket.data as SocketData) = { userId: user.id, role: user.role };
      await socket.join(`user:${user.id}`);
      if (user.role === 'ADMIN') await socket.join('admins');
    } catch {
      socket.emit('error', { message: 'unauthorized' });
      socket.disconnect(true);
    }
  }

  private viewer(socket: Socket) {
    const d = socket.data as SocketData;
    return { id: d.userId, role: d.role };
  }

  @SubscribeMessage('booking:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { bookingId: string }) {
    try {
      await this.bookings.load(body.bookingId, this.viewer(socket));
      await socket.join(`booking:${body.bookingId}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage('booking:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { bookingId: string }) {
    await socket.leave(`booking:${body.bookingId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  typing(@ConnectedSocket() socket: Socket, @MessageBody() body: { bookingId: string }) {
    if (socket.rooms.has(`booking:${body.bookingId}`)) {
      socket.to(`booking:${body.bookingId}`).emit('chat:typing', { bookingId: body.bookingId, userId: this.viewer(socket).id });
    }
  }
}
