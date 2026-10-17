import { Module } from '@nestjs/common';
import { AdminChatsController, ChatsController, ChatsPublicController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  controllers: [ChatsPublicController, ChatsController, AdminChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
