import { Module } from '@nestjs/common';
import { TenderController } from './tender.controller';
import { TenderService } from './tender.service';

@Module({ controllers: [TenderController], providers: [TenderService] })
export class TenderModule {}
