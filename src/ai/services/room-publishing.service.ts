import { google } from '@ai-sdk/google';
import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import {
	buildBuildingSelectionPrompt,
	buildImageSuggestionPrompt,
	buildRoomPublishingExtractionPrompt,
} from '../prompts/room-publishing.prompts';
import { ChatSession } from '../types/chat.types';
import {
	BuildingCandidate,
	RoomPublishingAction,
	RoomPublishingDraft,
	RoomPublishingExecutionPlan,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
	RoomPublishingStatus,
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
	getAllMissingFields,
	getNextMandatoryQuestion,
	markExecutionReadiness,
	markSqlReadiness,
	selectBuildingCandidate,
} from '../utils/room-publishing-flow';

export interface RoomPublishingStepResult {
	stage: RoomPublishingStage;
	status: RoomPublishingStatus;
	prompt: string;
	draft: RoomPublishingDraft;
	missingField?: RoomPublishingFieldRequirement | null;
	actions?: RoomPublishingAction[];
	executionPlan?: RoomPublishingExecutionPlan | null;
	roomId?: string; // ID của phòng đã tạo (nếu status = CREATED)
	error?: string; // Lỗi nếu status = CREATION_FAILED
}

@Injectable()
export class RoomPublishingService {
	private readonly logger = new Logger(RoomPublishingService.name);
	private readonly AI_CONFIG = {
		model: 'gemini-2.0-flash',
		temperature: 0.1,
		maxTokens: 2000, // Tăng để hỗ trợ description HTML dài
	};
	constructor(private readonly prisma: PrismaService) {}

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

	async handleUserMessage(
		session: ChatSession,
		userMessage: string,
		images?: string[],
		buildingId?: string,
	): Promise<RoomPublishingStepResult> {
		const draft = this.ensureDraft(session);
		// Nếu có buildingId từ frontend (có thể là UUID hoặc slug), lookup để lấy UUID thực sự
		if (buildingId) {
			try {
				// Thử tìm building bằng ID hoặc slug
				const building = await this.prisma.building.findFirst({
					where: {
						OR: [{ id: buildingId }, { slug: buildingId }],
					},
					select: { id: true },
				});
				if (building) {
					draft.building.id = building.id;
					draft.building.isExisting = true;
					this.logger.debug(
						`Building found: ${building.id} (from ${buildingId}), skipping building selection`,
					);
				} else {
					this.logger.warn(`Building not found: ${buildingId}, will create new building`);
					draft.building.isExisting = false;
					draft.building.id = undefined;
				}
			} catch (error) {
				this.logger.error(`Error looking up building ${buildingId}:`, error);
				draft.building.isExisting = false;
				draft.building.id = undefined;
			}
		} else {
			// Nếu không có buildingId, mặc định sẽ tạo building mới
			draft.building.isExisting = false;
			draft.building.id = undefined;
		}
		if (images && images.length > 0) {
			draft.room.images = images.map((path, index) => ({
				path,
				alt: `Room image ${index + 1}`,
				isPrimary: index === 0,
				sortOrder: index,
			}));
		}
		// Parse tất cả thông tin từ message ngay lập tức
		const actions = await this.applyAnswer(draft, userMessage, session.userId);
		// Áp dụng defaults và cập nhật stage
		applyRoomDefaults(draft.room);
		determineNextStage(draft);
		markSqlReadiness(draft);
		markExecutionReadiness(draft);
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
		return this.composeStepResult(session, draft, []);
	}

	private composePrompt(
		draft: RoomPublishingDraft,
		missingField: RoomPublishingFieldRequirement | null,
		allMissingFields?: RoomPublishingFieldRequirement[],
	): string {
		// Nếu đã có execution plan (đủ thông tin), KHÔNG HỎI GÌ CẢ
		const executionPlan = buildExecutionPlan(draft);
		if (executionPlan) {
			// Chỉ gợi ý hình ảnh nhẹ nhàng nếu chưa có
			if (draft.room.images.length === 0) {
				return `Tuyệt vời! Mình đã có đủ thông tin để tạo phòng trọ cho bạn. Bạn có muốn thêm hình ảnh phòng không? (Không bắt buộc, có thể bỏ qua)`;
			}
			return `Hoàn tất! Mình sẽ tạo phòng trọ cho bạn ngay.`;
		}

		// Xử lý building selection nếu có
		if (missingField?.key === 'building.selection') {
			const selectionPrompt = buildBuildingSelectionPrompt(draft.building.candidates ?? []);
			return draft.building.selectionMessage
				? `${draft.building.selectionMessage}\n${selectionPrompt}`
				: selectionPrompt;
		}

		// CHỈ hỏi những field thật sự cần thiết: giá cả, vị trí (chỉ khi không có buildingId)
		const essentialFields = (allMissingFields || []).filter((field) => {
			if (
				field.key === 'room.pricing.basePriceMonthly' ||
				field.key === 'building.location' // Chỉ hỏi location nếu không có buildingId
			) {
				switch (field.key) {
					case 'building.location':
						return !draft.building.id && (!draft.building.districtId || !draft.building.provinceId);
					case 'room.pricing.basePriceMonthly':
						return !draft.room.pricing.basePriceMonthly;
					default:
						return true;
				}
			}
			return false;
		});

		// Nếu thiếu thông tin, hỏi TẤT CẢ trong 1 lần duy nhất (câu hỏi đầu tiên về thông tin phòng trọ)
		if (essentialFields.length > 0) {
			const missingInfo: string[] = [];
			if (essentialFields.some((f) => f.key === 'building.location')) {
				missingInfo.push('địa điểm (quận/huyện và tỉnh/thành)');
			}
			if (essentialFields.some((f) => f.key === 'room.pricing.basePriceMonthly')) {
				missingInfo.push('giá thuê mỗi tháng');
			}

			return `Mình cần thêm ${missingInfo.join(' và ')} để hoàn tất đăng phòng cho bạn.\n\nBạn có thể trả lời đơn giản như:\n- "Gò Vấp Hồ Chí Minh, 2 triệu"\n- "Quận 1 TP.HCM, phòng 2.5 triệu"\n- "2 triệu, ở Gò Vấp"`;
		}

		// Nếu không thiếu field bắt buộc nhưng chưa có execution plan, có thể đang chờ action results
		// Không hỏi gì, để action results xử lý
		return `Đang xử lý thông tin...`;
	}

	private async applyAnswer(
		draft: RoomPublishingDraft,
		userMessage: string,
		userId?: string,
	): Promise<RoomPublishingAction[]> {
		const actions: RoomPublishingAction[] = [];
		const trimmed = userMessage.trim();

		// Parse field đang pending trước
		this.parsePendingField(draft, trimmed, userId, actions);

		// Sau đó dùng LLM để parse tất cả thông tin còn lại
		await this.tryParseAllFields(draft, trimmed, userId, actions);

		return actions;
	}

	private parsePendingField(
		draft: RoomPublishingDraft,
		message: string,
		userId?: string,
		actions: RoomPublishingAction[] = [],
	): void {
		if (!draft.pendingConfirmation) {
			return;
		}
		const trimmed = message.trim();
		let parsed = false;
		switch (draft.pendingConfirmation) {
			case 'building.name':
				if (trimmed) {
					draft.building.name = trimmed;
					draft.building.isExisting = undefined;
					draft.building.id = undefined;
					parsed = true;
					if (userId) {
						actions.push({
							type: 'LIST_OWNER_BUILDINGS',
							sql: buildOwnerBuildingLookupSql(userId, trimmed),
							description: `Lookup existing buildings for "${trimmed}"`,
						});
					}
				}
				break;
			case 'building.location': {
				if (this.shouldSkipLocationLookup(draft, trimmed)) {
					parsed = true;
					break;
				}
				if (trimmed) {
					draft.building.locationHint = trimmed;
					const locationInstruction = buildLocationLookupInstruction(trimmed);
					actions.push({
						type: 'LOOKUP_LOCATION',
						sql: locationInstruction.sql,
						description: `Resolve location for "${trimmed}"`,
						cacheKey: locationInstruction.cacheKey,
					});
					parsed = true;
				}
				break;
			}
			case 'building.selection':
				if (this.handleBuildingSelectionInput(draft, trimmed)) {
					parsed = true;
				} else {
					draft.building.selectionMessage = 'Mình chưa hiểu lựa chọn của bạn, bạn thử lại nhé.';
				}
				break;
			case 'room.name':
				if (trimmed) {
					draft.room.name = trimmed;
					parsed = true;
				}
				break;
			case 'room.roomType':
				if (trimmed) {
					draft.room.roomType = this.normalizeRoomType(trimmed);
					parsed = true;
				}
				break;
			case 'room.totalRooms': {
				const totalRooms = this.parseInteger(trimmed);
				if (totalRooms) {
					draft.room.totalRooms = totalRooms;
					parsed = true;
				}
				break;
			}
			case 'room.pricing.basePriceMonthly': {
				const basePrice = this.parseInteger(trimmed);
				if (basePrice) {
					draft.room.pricing.basePriceMonthly = basePrice;
					parsed = true;
				}
				break;
			}
			case 'room.pricing.depositAmount': {
				const deposit = this.parseInteger(trimmed);
				if (deposit) {
					draft.room.pricing.depositAmount = deposit;
					parsed = true;
				}
				break;
			}
			default:
				break;
		}
		// Clear pending confirmation nếu đã parse thành công
		if (parsed && draft.pendingConfirmation !== 'building.selection') {
			draft.pendingConfirmation = undefined;
		}
	}

	private async tryParseAllFields(
		draft: RoomPublishingDraft,
		message: string,
		userId?: string,
		actions: RoomPublishingAction[] = [],
	): Promise<void> {
		try {
			const missingFields = getAllMissingFields(draft);
			if (missingFields.length === 0) {
				return;
			}

			// Lấy tên người dùng để tạo tên building nếu cần
			let userName: string | undefined;
			if (userId) {
				try {
					const user = await this.prisma.user.findUnique({
						where: { id: userId },
						select: { firstName: true, lastName: true },
					});
					if (user) {
						userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
					}
				} catch (error) {
					this.logger.warn('Failed to fetch user name', error);
				}
			}

			const extractionPrompt = buildRoomPublishingExtractionPrompt({
				userMessage: message,
				currentDraft: {
					building: {
						name: draft.building.name,
						locationHint: draft.building.locationHint,
						districtId: draft.building.districtId,
						provinceId: draft.building.provinceId,
					},
					room: {
						name: draft.room.name,
						roomType: draft.room.roomType,
						totalRooms: draft.room.totalRooms,
						pricing: {
							basePriceMonthly: draft.room.pricing.basePriceMonthly,
							depositAmount: draft.room.pricing.depositAmount,
						},
						costs: draft.room.costs.map((c) => ({
							costType: c.costType,
							value: c.value,
							unit: c.unit,
						})),
					},
				},
				missingFields: missingFields.map((f) => ({
					key: f.key,
					label: f.label,
					description: f.description,
				})),
				userName,
			});

			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: extractionPrompt,
				temperature: this.AI_CONFIG.temperature,
				maxOutputTokens: this.AI_CONFIG.maxTokens,
			});

			// Parse JSON response
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				this.logger.warn('Failed to extract JSON from LLM response');
				return;
			}

			const extracted = JSON.parse(jsonMatch[0]) as {
				building?: {
					name?: string | null;
					location?: string | null;
				};
				room?: {
					name?: string | null;
					roomType?: string | null;
					totalRooms?: number | null;
					description?: string | null;
					pricing?: {
						basePriceMonthly?: number | null;
						depositAmount?: number | null;
					};
					costs?: Array<{
						costType?: string;
						value?: number;
						unit?: string;
						billingCycle?: string;
					}>;
				};
			};

			// Merge extracted với draft hiện tại - giữ nguyên giá trị cũ nếu extracted không có
			// LLM có thể không trả về tất cả fields, nên ta chỉ cập nhật những gì có trong extracted

			// Apply extracted building information
			if (extracted.building) {
				// Cập nhật tên tòa nhà nếu có trong extracted (kể cả khi đã có trong draft)
				if (extracted.building.name !== null && extracted.building.name !== undefined) {
					const wasNew = !draft.building.name;
					draft.building.name = extracted.building.name;
					if (userId && wasNew) {
						actions.push({
							type: 'LIST_OWNER_BUILDINGS',
							sql: buildOwnerBuildingLookupSql(userId, extracted.building.name),
							description: `Lookup existing buildings for "${extracted.building.name}"`,
						});
					}
				}
				// Cập nhật location nếu có trong extracted và chưa được resolve
				if (
					extracted.building.location !== null &&
					extracted.building.location !== undefined &&
					!draft.building.districtId &&
					!draft.building.provinceId
				) {
					if (!this.shouldSkipLocationLookup(draft, extracted.building.location)) {
						draft.building.locationHint = extracted.building.location;
						const locationInstruction = buildLocationLookupInstruction(extracted.building.location);
						actions.push({
							type: 'LOOKUP_LOCATION',
							sql: locationInstruction.sql,
							description: `Resolve location for "${extracted.building.location}"`,
							cacheKey: locationInstruction.cacheKey,
						});
					}
				}
			}

			// Apply extracted room information - Cập nhật tất cả thông tin có trong extracted
			if (extracted.room) {
				// Tên phòng: Ưu tiên extracted, nếu không có thì giữ nguyên draft (có thể đã được tự tạo)
				if (extracted.room.name !== null && extracted.room.name !== undefined) {
					draft.room.name = extracted.room.name;
				} else if (!draft.room.name) {
					// Tự tạo tên phòng nếu chưa có
					const buildingName = draft.building.name || 'ABC';
					draft.room.name = `Phòng trọ ${buildingName}`;
				}
				// Loại phòng: LUÔN là boarding_house (phòng trọ) - mặc định
				draft.room.roomType = 'boarding_house';
				// Số lượng phòng: Ưu tiên extracted, nếu không có thì mặc định 1
				if (extracted.room.totalRooms !== null && extracted.room.totalRooms !== undefined) {
					draft.room.totalRooms = extracted.room.totalRooms;
				} else if (!draft.room.totalRooms) {
					draft.room.totalRooms = 1;
				}
				// Tiền cọc: Nếu không có, mặc định = 1 tháng tiền thuê
				if (
					extracted.room.pricing?.depositAmount === null ||
					extracted.room.pricing?.depositAmount === undefined
				) {
					if (!draft.room.pricing.depositAmount && draft.room.pricing.basePriceMonthly) {
						draft.room.pricing.depositAmount = draft.room.pricing.basePriceMonthly;
					}
				}
				// Description: Ưu tiên extracted (có thể là HTML), nếu không có thì giữ nguyên draft
				if (extracted.room.description !== null && extracted.room.description !== undefined) {
					draft.room.description = extracted.room.description;
				}
				// Nếu vẫn chưa có description, sẽ được tạo bởi LLM trong lần parse tiếp theo
				if (extracted.room.pricing) {
					if (
						extracted.room.pricing.basePriceMonthly !== null &&
						extracted.room.pricing.basePriceMonthly !== undefined
					) {
						draft.room.pricing.basePriceMonthly = extracted.room.pricing.basePriceMonthly;
					}
					if (
						extracted.room.pricing.depositAmount !== null &&
						extracted.room.pricing.depositAmount !== undefined
					) {
						draft.room.pricing.depositAmount = extracted.room.pricing.depositAmount;
					}
				}
				if (extracted.room.costs) {
					for (const cost of extracted.room.costs) {
						if (cost.costType && cost.value) {
							const existingCost = draft.room.costs.find((c) => c.costType === cost.costType);
							if (!existingCost) {
								draft.room.costs.push({
									systemCostTypeId: '', // Will be set later
									value: cost.value,
									costType: cost.costType as any,
									unit: cost.unit || (cost.costType === 'ELECTRICITY' ? 'per_kwh' : 'per_person'),
									billingCycle: 'MONTHLY' as any,
								});
							} else {
								// Cập nhật giá trị nếu đã có
								existingCost.value = cost.value;
								if (cost.unit) {
									existingCost.unit = cost.unit;
								}
							}
						}
					}
				}
			}
		} catch (error) {
			this.logger.warn('Failed to parse fields using LLM', error);
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
		const allMissingFields = getAllMissingFields(draft);
		const prompt = this.composePrompt(draft, missingField, allMissingFields);
		draft.pendingConfirmation = missingField?.key;
		draft.lastActions = actions;
		session.context = { activeFlow: 'room-publishing', roomPublishing: draft };
		const executionPlan = buildExecutionPlan(draft);
		const status = executionPlan
			? RoomPublishingStatus.READY_TO_CREATE
			: RoomPublishingStatus.NEED_MORE_INFO;
		return {
			stage: draft.stage,
			status,
			prompt,
			draft,
			missingField,
			actions: actions.length > 0 ? actions : undefined,
			executionPlan: executionPlan || undefined,
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
			utilities:
				'Để phòng của bạn nổi bật hơn, bạn chia sẻ giá điện, giá nước và các tiện ích nổi bật được không?',
			images: buildImageSuggestionPrompt(),
		};
	}
}
