import { Injectable } from '@nestjs/common';
import {
	buildBuildingSelectionPrompt,
	buildImageSuggestionPrompt,
	buildMissingFieldPrompt,
	buildStageIntroPrompt,
	buildUtilitySuggestionPrompt,
} from '../prompts/room-publishing.prompts';
import { ChatSession } from '../types/chat.types';
import {
	BuildingCandidate,
	RoomPublishingAction,
	RoomPublishingDraft,
	RoomPublishingExecutionPlan,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';
import {
	buildLocationLookupInstruction,
	buildOwnerBuildingLookupSql,
	mapBuildingCandidates,
	normalizeText,
	resolveLocationFromRow,
} from '../utils/room-location.utils';
import {
	applyRoomDefaults,
	buildExecutionPlan,
	createEmptyRoomPublishingDraft,
	determineNextStage,
	getNextMandatoryQuestion,
	markExecutionReadiness,
	markSqlReadiness,
	selectBuildingCandidate,
} from '../utils/room-publishing-flow';

export interface RoomPublishingStepResult {
	stage: RoomPublishingStage;
	prompt: string;
	draft: RoomPublishingDraft;
	missingField?: RoomPublishingFieldRequirement | null;
	actions?: RoomPublishingAction[];
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
		if (!session.context.roomPublishing.userId && session.userId) {
			session.context.roomPublishing.userId = session.userId;
		}
		return session.context.roomPublishing!;
	}

	handleUserMessage(session: ChatSession, userMessage: string): RoomPublishingStepResult {
		const draft = this.ensureDraft(session);
		const actions = this.applyAnswer(draft, userMessage, session.userId);
		return this.composeStepResult(session, draft, actions);
	}

	applyActionResult(
		session: ChatSession,
		action: RoomPublishingAction,
		rows: Array<Record<string, unknown>>,
	): RoomPublishingStepResult {
		const draft = this.ensureDraft(session);
		switch (action.type) {
			case 'LOOKUP_LOCATION':
				this.applyLocationResults(draft, rows, action);
				break;
			case 'LIST_OWNER_BUILDINGS':
				this.applyBuildingCandidates(draft, rows);
				break;
			default:
				break;
		}
		return this.composeStepResult(session, draft);
	}

	private composePrompt(
		draft: RoomPublishingDraft,
		missingField: RoomPublishingFieldRequirement | null,
	): string {
		if (missingField?.key === 'building.selection') {
			const selectionPrompt = buildBuildingSelectionPrompt(draft.building.candidates ?? []);
			return draft.building.selectionMessage
				? `${draft.building.selectionMessage}\n${selectionPrompt}`
				: selectionPrompt;
		}
		if (missingField) {
			return buildMissingFieldPrompt(missingField);
		}
		if (draft.stage === 'enrich-room') {
			return `${buildUtilitySuggestionPrompt()} Nếu có hình ảnh, bạn gửi giúp mình luôn nhé.`;
		}
		if (draft.stage === 'finalize-room') {
			return `${buildStageIntroPrompt(draft.stage)} Có cần mình rà soát lại trước khi gửi đi không?`;
		}
		return buildStageIntroPrompt(draft.stage);
	}

	private applyAnswer(
		draft: RoomPublishingDraft,
		userMessage: string,
		userId?: string,
	): RoomPublishingAction[] {
		const actions: RoomPublishingAction[] = [];
		if (!draft.pendingConfirmation) {
			return actions;
		}
		const trimmed = userMessage.trim();
		switch (draft.pendingConfirmation) {
			case 'building.name':
				draft.building.name = trimmed;
				draft.building.isExisting = undefined;
				draft.building.id = undefined;
				if (userId) {
					actions.push({
						type: 'LIST_OWNER_BUILDINGS',
						sql: buildOwnerBuildingLookupSql(userId, trimmed),
						description: `Lookup existing buildings for "${trimmed}"`,
					});
				}
				break;
			case 'building.location': {
				if (this.shouldSkipLocationLookup(draft, trimmed)) {
					break;
				}
				draft.building.locationHint = trimmed;
				const locationInstruction = buildLocationLookupInstruction(trimmed);
				actions.push({
					type: 'LOOKUP_LOCATION',
					sql: locationInstruction.sql,
					description: `Resolve location for "${trimmed}"`,
					cacheKey: locationInstruction.cacheKey,
				});
				break;
			}
			case 'building.selection':
				if (!this.handleBuildingSelectionInput(draft, trimmed)) {
					draft.building.selectionMessage = 'Mình chưa hiểu lựa chọn của bạn, bạn thử lại nhé.';
				}
				break;
			case 'room.name':
				draft.room.name = trimmed;
				break;
			case 'room.roomType':
				draft.room.roomType = this.normalizeRoomType(trimmed);
				break;
			case 'room.totalRooms':
				draft.room.totalRooms = this.parseInteger(trimmed);
				break;
			case 'room.pricing.basePriceMonthly':
				draft.room.pricing.basePriceMonthly = this.parseInteger(trimmed);
				break;
			case 'room.pricing.depositAmount':
				draft.room.pricing.depositAmount = this.parseInteger(trimmed);
				break;
			default:
				break;
		}
		return actions;
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

	private composeStepResult(
		session: ChatSession,
		draft: RoomPublishingDraft,
		actions: RoomPublishingAction[] = [],
	): RoomPublishingStepResult {
		applyRoomDefaults(draft.room);
		markSqlReadiness(draft);
		markExecutionReadiness(draft);
		draft.stage = determineNextStage(draft);
		const missingField = getNextMandatoryQuestion(draft);
		const prompt = this.composePrompt(draft, missingField);
		draft.pendingConfirmation = missingField?.key;
		draft.lastActions = actions;
		session.context = { activeFlow: 'room-publishing', roomPublishing: draft };
		return {
			stage: draft.stage,
			prompt,
			draft,
			missingField,
			actions,
			executionPlan: buildExecutionPlan(draft),
		};
	}

	private shouldSkipLocationLookup(draft: RoomPublishingDraft, locationInput: string): boolean {
		const normalized = normalizeText(locationInput);
		return Boolean(
			normalized &&
				draft.building.locationCacheKey !== undefined &&
				draft.building.locationCacheKey === normalized,
		);
	}

	private handleBuildingSelectionInput(draft: RoomPublishingDraft, input: string): boolean {
		const cleaned = input.toLowerCase();
		if (this.isCreateNewBuildingInput(cleaned)) {
			draft.building.candidates = undefined;
			draft.building.id = undefined;
			draft.building.isExisting = false;
			return true;
		}
		if (!draft.building.candidates || draft.building.candidates.length === 0) {
			return false;
		}
		const candidate = this.pickBuildingCandidate(draft.building.candidates, cleaned);
		if (!candidate) {
			return false;
		}
		selectBuildingCandidate(draft, candidate);
		return true;
	}

	private isCreateNewBuildingInput(value: string): boolean {
		return ['moi', 'mới', 'new', 'create', 'tao', 'tạo'].some((keyword) => value.includes(keyword));
	}

	private pickBuildingCandidate(
		candidates: BuildingCandidate[],
		input: string,
	): BuildingCandidate | undefined {
		const index = Number.parseInt(input.replace(/[^0-9]/g, ''), 10);
		if (!Number.isNaN(index) && index >= 1 && index <= candidates.length) {
			return candidates[index - 1];
		}
		return candidates.find(
			(candidate) =>
				candidate.id === input ||
				(candidate.slug && candidate.slug.toLowerCase() === input) ||
				candidate.name.toLowerCase() === input,
		);
	}

	private applyLocationResults(
		draft: RoomPublishingDraft,
		rows: Array<Record<string, unknown>>,
		action: RoomPublishingAction,
	): void {
		if (!rows.length) {
			draft.building.locationResolved = undefined;
			return;
		}
		const resolved = resolveLocationFromRow(rows[0]);
		draft.building.districtId = resolved.districtId ?? draft.building.districtId;
		draft.building.provinceId = resolved.provinceId ?? draft.building.provinceId;
		draft.building.wardId = resolved.wardId ?? draft.building.wardId;
		draft.building.locationResolved = resolved;
		draft.building.locationCacheKey = action.cacheKey;
	}

	private applyBuildingCandidates(
		draft: RoomPublishingDraft,
		rows: Array<Record<string, unknown>>,
	): void {
		const candidates = mapBuildingCandidates(rows);
		if (candidates.length === 1 && (candidates[0].matchScore ?? 0) >= 0.9) {
			selectBuildingCandidate(draft, candidates[0]);
			return;
		}
		draft.building.candidates = candidates;
		draft.building.selectionMessage =
			candidates.length === 0
				? 'Chưa tìm thấy tòa nhà nào trùng khớp, bạn có thể tạo tòa mới.'
				: undefined;
	}

	buildEnrichmentPrompts(): { utilities: string; images: string } {
		return {
			utilities: buildUtilitySuggestionPrompt(),
			images: buildImageSuggestionPrompt(),
		};
	}
}
