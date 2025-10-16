import { Module } from '@nestjs/common';
import { ElasticsearchCustomModule } from '../../elasticsearch/elasticsearch.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ListingElasticsearchHelper } from './listing-elasticsearch.helper';

@Module({
	imports: [PrismaModule, ElasticsearchCustomModule],
	controllers: [ListingController],
	providers: [ListingService, ListingElasticsearchHelper],
	exports: [ListingService],
})
export class ListingModule {}
