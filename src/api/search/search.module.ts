import { Module } from '@nestjs/common';
import { ElasticsearchCustomModule } from '../../elasticsearch/elasticsearch.module';
import { SearchController } from './search.controller';

@Module({
	imports: [ElasticsearchCustomModule],
	controllers: [SearchController],
})
export class SearchModule {}
