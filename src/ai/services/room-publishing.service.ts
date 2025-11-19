import { Injectable } from '@nestjs/common';
import {
	buildImageSuggestionPrompt,
	buildMissingFieldPrompt,
	buildStageIntroPrompt,
	buildUtilitySuggestionPrompt,
} from '../prompts/room-publishing.prompts';
import { ChatSession } from '../types/chat.types';
import {
	RoomPublishingDraft,
	RoomPublishingExecutionPlan,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';
import { buildLocationLookupInstruction } from '../utils/room-location.utils';
import {
	applyRoomDefaults,
	buildExecutionPlan,
	createEmptyRoomPublishingDraft,
	determineNextStage,
	getNextMandatoryQuestion,
	markExecutionReadiness,
	markSqlReadiness,
} from '../utils/room-publishing-flow';

export interface RoomPublishingStepResult {
	stage: RoomPublishingStage;
	prompt: string;
	draft: RoomPublishingDraft;
	missingField?: RoomPublishingFieldRequirement | null;
	sqlInstruction?: string;
	executionPlan?: RoomPublishingExecutionPlan | null;
}

@Injectable()
export class RoomPublishingService {
	ensureDraft(session: ChatSession): RoomPublishingDraft {
		if (!session.context) {
			session.context = {
				activeFlow: 'room-publishing',
				roomPublishing: createEmptyRoomPublishingDraft(session.userId),
			};
			return session.context.roomPublishing!;
		}
		if (!session.context.roomPublishing) {
			session.context.roomPublishing = createEmptyRoomPublishingDraft(session.userId);
		}
		return session.context.roomPublishing!;
	}

	handleUserMessage(session: ChatSession, userMessage: string): RoomPublishingStepResult {
		const draft = this.ensureDraft(session);
		const sqlInstruction = this.applyAnswer(draft, userMessage);
		applyRoomDefaults(draft.room);
		markSqlReadiness(draft);
		markExecutionReadiness(draft);
		draft.stage = determineNextStage(draft);
		const missingField = getNextMandatoryQuestion(draft);
		const prompt = this.composePrompt(draft.stage, missingField);
		draft.pendingConfirmation = missingField?.key;
		session.context = { activeFlow: 'room-publishing', roomPublishing: draft };
		return {
			stage: draft.stage,
			prompt,
			draft,
			missingField,
			sqlInstruction: sqlInstruction?.trim(),
			executionPlan: buildExecutionPlan(draft),
		};
	}

	private composePrompt(
		stage: RoomPublishingStage,
		missingField: RoomPublishingFieldRequirement | null,
	): string {
		if (missingField) {
			return buildMissingFieldPrompt(missingField);
		}
		if (stage === 'enrich-room') {
			return `${buildUtilitySuggestionPrompt()} Nếu có hình ảnh, bạn gửi giúp mình luôn nhé.`;
		}
		if (stage === 'finalize-room') {
			return `${buildStageIntroPrompt(stage)} Có cần mình rà soát lại trước khi gửi đi không?`;
		}
		return buildStageIntroPrompt(stage);
	}

	private applyAnswer(draft: RoomPublishingDraft, userMessage: string): string | undefined {
		if (!draft.pendingConfirmation) {
			return undefined;
		}
		const trimmed = userMessage.trim();
		switch (draft.pendingConfirmation) {
			case 'building.name':
				draft.building.name = trimmed;
				return undefined;
			case 'building.location':
				draft.building.locationHint = trimmed;
				return buildLocationLookupInstruction(trimmed).sql;
			case 'room.name':
				draft.room.name = trimmed;
				return undefined;
			case 'room.roomType':
				draft.room.roomType = this.normalizeRoomType(trimmed);
				return undefined;
			case 'room.totalRooms':
				draft.room.totalRooms = this.parseInteger(trimmed);
				return undefined;
			case 'room.pricing.basePriceMonthly':
				draft.room.pricing.basePriceMonthly = this.parseInteger(trimmed);
				return undefined;
			case 'room.pricing.depositAmount':
				draft.room.pricing.depositAmount = this.parseInteger(trimmed);
				return undefined;
			default:
				return undefined;
		}
	}

	private normalizeRoomType(value: string): any {
		const normalized = value.toLowerCase().replace(/\s+/g, '_');
		return normalized as any;
	}

	private parseInteger(value: string): number | undefined {
		const digits = value.replace(/[^0-9]/g, '');
		if (!digits) {
			return undefined;
		}
		return Number.parseInt(digits, 10);
	}

	buildEnrichmentPrompts(): { utilities: string; images: string } {
		return {
			utilities: buildUtilitySuggestionPrompt(),
			images: buildImageSuggestionPrompt(),
		};
	}
}
