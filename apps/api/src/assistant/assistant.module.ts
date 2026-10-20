import { Module } from '@nestjs/common';
import { AdminAssistantController, AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({ controllers: [AssistantController, AdminAssistantController], providers: [AssistantService] })
export class AssistantModule {}
