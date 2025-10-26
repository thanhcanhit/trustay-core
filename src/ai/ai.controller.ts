import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { Text2SqlDto } from './dto/text2sql.dto';

@Controller('ai')
export class AiController {
	constructor(private readonly aiService: AiService) {}

	@Post('text2sql')
	async generateSql(@Body() dto: Text2SqlDto) {
		try {
			return await this.aiService.generateAndExecuteSql(dto.query);
		} catch (error) {
			return {
				error: 'Failed to generate or execute SQL',
				message: error.message,
				query: dto.query,
			};
		}
	}
}
