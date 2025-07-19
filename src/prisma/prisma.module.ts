import { Module } from "@nestjs/common";
import { ConfigModule } from "src/config/config.module";
import { PrismaService } from "./prisma.service";

@Module({
	providers: [PrismaService],
	imports: [ConfigModule],
	exports: [PrismaService],
})
export class PrismaModule {}
