import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  log(adminId: string, action: string, targetType: string, targetId: string, meta?: unknown) {
    return this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, meta: meta === undefined ? null : JSON.stringify(meta) },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
