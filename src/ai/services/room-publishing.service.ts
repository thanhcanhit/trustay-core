import { google } from '@ai-sdk/google';
import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { BuildingsService } from '../../api/buildings/buildings.service';
import { AddressService } from '../../api/provinces/address/address.service';
import { ReferenceService } from '../../api/reference/reference.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
	buildBuildingSelectionPrompt,
	buildConversationalResponsePrompt,
	buildImageSuggestionPrompt,
	buildRoomPublishingExtractionPrompt,
	parseAIJsonResult,
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
	mapBuildingCandidates,
	normalizeLocationText,
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
	roomSlug?: string; // Slug của phòng đã tạo (nếu status = CREATED)
	roomPath?: string; // Path để navigate tới phòng (nếu status = CREATED)
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
	constructor(
		private readonly prisma: PrismaService,
		private readonly buildingsService: BuildingsService,
		private readonly addressService: AddressService,
		private readonly referenceService: ReferenceService,
	) {}

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
		const startTime = Date.now();
		this.logger.log(`[ROOM_PUBLISH] Handling user message`, {
			userMessage: userMessage.substring(0, 100),
			messageLength: userMessage.length,
			hasImages: !!(images && images.length > 0),
			imagesCount: images?.length || 0,
			buildingId,
			sessionId: session.sessionId,
			userId: session.userId,
		});

		const draft = this.ensureDraft(session);
		// Nếu có buildingId từ frontend (có thể là UUID hoặc slug), lookup để lấy UUID thực sự và địa chỉ
		if (buildingId) {
			try {
				// Thử tìm building bằng ID hoặc slug, lấy cả thông tin địa chỉ
				const building = await this.prisma.building.findFirst({
					where: {
						OR: [{ id: buildingId }, { slug: buildingId }],
					},
					select: {
						id: true,
						name: true,
						addressLine1: true,
						addressLine2: true,
						wardId: true,
						districtId: true,
						provinceId: true,
						country: true,
					},
				});
				if (building) {
					draft.building.id = building.id;
					draft.building.name = building.name;
					draft.building.isExisting = true;
					// Lấy địa chỉ từ building
					draft.building.addressLine1 = building.addressLine1;
					draft.building.wardId = building.wardId || undefined;
					draft.building.districtId = building.districtId || undefined;
					draft.building.provinceId = building.provinceId || undefined;
					draft.building.country = building.country || 'Vietnam';
					// Set locationHint từ addressLine1 hoặc name để hiển thị
					draft.building.locationHint = building.addressLine1 || building.name || undefined;
					this.logger.debug(
						`Building found: ${building.id} (from ${buildingId}), address loaded: districtId=${building.districtId}, provinceId=${building.provinceId}`,
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
		this.logger.debug(`[ROOM_PUBLISH] Starting field extraction and parsing`);
		const actions = await this.applyAnswer(draft, userMessage, session.userId);
		this.logger.debug(`[ROOM_PUBLISH] Field extraction completed`, {
			actionsCount: actions.length,
			actionTypes: actions.map((a) => a.type),
		});

		// Áp dụng defaults và cập nhật stage
		applyRoomDefaults(draft.room);
		determineNextStage(draft);
		markSqlReadiness(draft);
		markExecutionReadiness(draft);

		this.logger.debug(`[ROOM_PUBLISH] Composing step result`);
		const result = await this.composeStepResult(
			session,
			draft,
			actions,
			userMessage,
			session.userId,
		);

		const totalDuration = Date.now() - startTime;
		this.logger.log(`[ROOM_PUBLISH] User message handling completed`, {
			totalDuration: `${totalDuration}ms`,
			status: result.status,
			stage: result.stage,
			hasExecutionPlan: !!result.executionPlan,
			hasActions: !!(result.actions && result.actions.length > 0),
		});

		return result;
	}

	async applyActionResult(
		session: ChatSession,
		action: RoomPublishingAction,
		rows: Array<Record<string, unknown>>,
	): Promise<RoomPublishingStepResult> {
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
		return this.composeStepResult(session, draft, [], undefined, session.userId);
	}

	private composePrompt(
		draft: RoomPublishingDraft,
		missingField: RoomPublishingFieldRequirement | null,
		allMissingFields?: RoomPublishingFieldRequirement[],
		hasPendingActions: boolean = false,
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

		// Nếu đang có actions pending (đang lookup location, list buildings), thông báo rõ ràng
		if (hasPendingActions) {
			if (draft.lastActions?.some((a) => a.type === 'LOOKUP_LOCATION')) {
				return `Đang tìm kiếm thông tin địa điểm...`;
			}
			if (draft.lastActions?.some((a) => a.type === 'LIST_OWNER_BUILDINGS')) {
				return `Đang tìm kiếm tòa nhà của bạn...`;
			}
			return `Đang xử lý thông tin...`;
		}

		// Xử lý trường hợp location lookup failed nhưng vẫn có locationHint
		if (
			draft.building.locationLookupFailed &&
			draft.building.locationHint &&
			!draft.building.districtId &&
			!draft.building.provinceId
		) {
			// Lookup failed nhưng có text → cho phép tiếp tục với text, không hỏi lại
			this.logger.debug(
				`[PROMPT_GEN] Location lookup failed but has locationHint - allowing continuation with text`,
			);
			// Không hỏi lại location, chỉ hỏi các thông tin còn thiếu khác
		}

		// Fallback: Nếu không có missing fields và không có execution plan, có thể đang trong quá trình xử lý
		// Note: Conversational response sẽ được generate bởi generateConversationalResponseAsync
		return `Đang xử lý thông tin phòng trọ của bạn...`;
	}

	/**
	 * Generate conversational response using LLM (AI-Native approach)
	 * Replaces hardcoded if-else logic with intelligent conversation generation
	 */
	private async generateConversationalResponseAsync(
		draft: RoomPublishingDraft,
		userMessage: string,
		allMissingFields: RoomPublishingFieldRequirement[],
		userId?: string,
	): Promise<string | null> {
		const startTime = Date.now();
		this.logger.debug(`[CONVERSATION_GEN] Starting AI conversational response generation`, {
			userMessage: userMessage.substring(0, 100),
			missingFieldsCount: allMissingFields.length,
			missingFields: allMissingFields.map((f) => f.key),
			userId,
		});

		try {
			// Lấy tên người dùng
			let userName: string | undefined;
			if (userId) {
				try {
					const user = await this.prisma.user.findUnique({
						where: { id: userId },
						select: { firstName: true, lastName: true },
					});
					if (user) {
						userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
						this.logger.debug(`[CONVERSATION_GEN] Fetched user name: ${userName}`);
					}
				} catch (error) {
					this.logger.warn(
						'[CONVERSATION_GEN] Failed to fetch user name for conversational response',
						error,
					);
				}
			}

			const conversationalPrompt = buildConversationalResponsePrompt({
				userMessage,
				currentDraft: {
					building: {
						name: draft.building.name,
						locationHint: draft.building.locationHint,
						districtId: draft.building.districtId,
						provinceId: draft.building.provinceId,
						locationLookupFailed: draft.building.locationLookupFailed,
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
				missingFields: allMissingFields.map((f) => ({
					key: f.key,
					label: f.label,
					description: f.description,
				})),
				userName,
			});

			this.logger.debug(`[CONVERSATION_GEN] Calling LLM for conversational response`, {
				model: this.AI_CONFIG.model,
				temperature: 0.7,
				maxTokens: 500,
			});

			const llmStartTime = Date.now();
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: conversationalPrompt,
				temperature: 0.7, // Slightly higher temperature for more natural conversation
				maxOutputTokens: 500, // Shorter response for conversation
			});
			const llmDuration = Date.now() - llmStartTime;

			const response = text.trim();
			const totalDuration = Date.now() - startTime;

			this.logger.log(`[CONVERSATION_GEN] Successfully generated conversational response`, {
				duration: `${totalDuration}ms`,
				llmDuration: `${llmDuration}ms`,
				responseLength: response.length,
				responsePreview: response.substring(0, 150),
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.warn(
				`[CONVERSATION_GEN] Failed to generate conversational response, falling back to default`,
				{
					error: error instanceof Error ? error.message : String(error),
					duration: `${duration}ms`,
				},
			);
			return null;
		}
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
							params: {
								userId,
								keyword: trimmed,
							},
							description: `Lookup existing buildings for "${trimmed}"`,
						});
					}
				}
				break;
			case 'building.location': {
				// QUAN TRỌNG: Chỉ lookup khi KHÔNG có buildingId (nếu có buildingId thì đã có địa chỉ rồi)
				if (draft.building.id) {
					// Đã có buildingId → không cần lookup, chỉ lưu locationHint để hiển thị
					if (trimmed) {
						draft.building.locationHint = trimmed;
						parsed = true;
					}
					break;
				}
				if (this.shouldSkipLocationLookup(draft, trimmed)) {
					parsed = true;
					break;
				}
				if (trimmed) {
					// Chuẩn hóa địa chỉ trước khi lookup (Q9 -> Quận 9, HCM -> Hồ Chí Minh)
					const normalizedLocation = normalizeLocationText(trimmed);
					draft.building.locationHint = normalizedLocation;
					this.logger.debug(`[LOCATION] Normalized location`, {
						original: trimmed,
						normalized: normalizedLocation,
						hasBuildingId: !!draft.building.id,
					});
					actions.push({
						type: 'LOOKUP_LOCATION',
						params: {
							locationQuery: normalizedLocation, // Dùng text đã chuẩn hóa để lookup
						},
						description: `Resolve location for "${normalizedLocation}"`,
						cacheKey: normalizeText(normalizedLocation),
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
		const startTime = Date.now();
		this.logger.debug(`[EXTRACTION] Starting field extraction from user message`, {
			messageLength: message.length,
			messagePreview: message.substring(0, 100),
		});

		try {
			const missingFields = getAllMissingFields(draft);
			if (missingFields.length === 0) {
				this.logger.debug(`[EXTRACTION] No missing fields, skipping extraction`);
				return;
			}

			this.logger.debug(`[EXTRACTION] Missing fields detected`, {
				count: missingFields.length,
				fields: missingFields.map((f) => f.key),
			});

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

			// Query system reference data để AI chỉ sử dụng các giá trị có sẵn
			let systemCostTypes: Array<{
				id: string;
				name: string;
				category: string;
				defaultUnit?: string;
			}> = [];
			let systemAmenities: Array<{
				id: string;
				name: string;
				category: string;
				description?: string;
			}> = [];
			let systemRules: Array<{ id: string; name: string; category: string; description?: string }> =
				[];

			try {
				const [costTypes, amenities, rules] = await Promise.all([
					this.referenceService.getSystemCostTypesByCategory(),
					this.referenceService.getSystemAmenitiesByCategory(),
					this.referenceService.getSystemRoomRulesByCategory(),
				]);

				systemCostTypes = costTypes.map((ct) => ({
					id: ct.id,
					name: ct.name,
					category: ct.category,
					defaultUnit: ct.defaultUnit || undefined,
				}));

				systemAmenities = amenities.map((a) => ({
					id: a.id,
					name: a.name,
					category: a.category,
					description: a.description || undefined,
				}));

				systemRules = rules.map((r) => ({
					id: r.id,
					name: r.name,
					category: r.category,
					description: r.description || undefined,
				}));

				this.logger.debug(
					`Loaded ${systemCostTypes.length} cost types, ${systemAmenities.length} amenities, ${systemRules.length} rules for AI extraction`,
				);
			} catch (error) {
				this.logger.warn('Failed to fetch system reference data', error);
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
				systemCostTypes,
				systemAmenities,
				systemRules,
			});

			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: extractionPrompt,
				temperature: this.AI_CONFIG.temperature,
				maxOutputTokens: this.AI_CONFIG.maxTokens,
			});

			// Parse JSON response using safe helper function
			const parsedResult = parseAIJsonResult(text);
			if (!parsedResult) {
				this.logger.warn('Failed to parse JSON from LLM response', { text });
				return;
			}

			const extracted = parsedResult as {
				building?: {
					name?: string | null;
					location?: string | null;
				};
				room?: {
					name?: string | null;
					roomType?: string | null;
					totalRooms?: number | null;
					areaSqm?: number | null;
					maxOccupancy?: number | null;
					floorNumber?: number | null;
					description?: string | null;
					pricing?: {
						basePriceMonthly?: number | null;
						depositAmount?: number | null;
						depositMonths?: number | null;
						utilityIncluded?: boolean | null;
						utilityCostMonthly?: number | null;
						minimumStayMonths?: number | null;
						maximumStayMonths?: number | null;
						priceNegotiable?: boolean | null;
					};
					costs?: Array<{
						systemCostTypeId?: string;
						costType?: string;
						value?: number;
						unit?: string;
						billingCycle?: string;
						includedInRent?: boolean | null;
						isOptional?: boolean | null;
						notes?: string | null;
					}>;
					amenities?: Array<{
						systemAmenityId?: string;
						customValue?: string | null;
						notes?: string | null;
					}>;
					rules?: Array<{
						systemRuleId?: string;
						customValue?: string | null;
						isEnforced?: boolean | null;
						notes?: string | null;
					}>;
				};
			};

			// Merge extracted với draft hiện tại - giữ nguyên giá trị cũ nếu extracted không có
			// LLM có thể không trả về tất cả fields, nên ta chỉ cập nhật những gì có trong extracted

			// Apply extracted building information
			this.logger.debug(`[EXTRACTION] Applying extracted data to draft`);
			if (extracted.building) {
				// Cập nhật tên tòa nhà nếu có trong extracted (kể cả khi đã có trong draft)
				if (extracted.building.name !== null && extracted.building.name !== undefined) {
					const wasNew = !draft.building.name;
					draft.building.name = extracted.building.name;
					if (userId && wasNew) {
						actions.push({
							type: 'LIST_OWNER_BUILDINGS',
							params: {
								userId,
								keyword: extracted.building.name,
							},
							description: `Lookup existing buildings for "${extracted.building.name}"`,
						});
					}
				}
				// Cập nhật location nếu có trong extracted và chưa được resolve
				// QUAN TRỌNG: Chỉ lookup khi KHÔNG có buildingId (nếu có buildingId thì đã có địa chỉ rồi)
				if (
					extracted.building.location !== null &&
					extracted.building.location !== undefined &&
					!draft.building.id && // Chỉ lookup khi không có buildingId
					!draft.building.districtId &&
					!draft.building.provinceId
				) {
					if (!this.shouldSkipLocationLookup(draft, extracted.building.location)) {
						// Chuẩn hóa địa chỉ trước khi lookup (Q9 -> Quận 9, HCM -> Hồ Chí Minh)
						const normalizedLocation = normalizeLocationText(extracted.building.location);
						draft.building.locationHint = normalizedLocation;
						this.logger.debug(`[LOCATION] Normalized location from extraction`, {
							original: extracted.building.location,
							normalized: normalizedLocation,
							hasBuildingId: !!draft.building.id,
						});
						actions.push({
							type: 'LOOKUP_LOCATION',
							params: {
								locationQuery: normalizedLocation, // Dùng text đã chuẩn hóa để lookup
							},
							description: `Resolve location for "${normalizedLocation}"`,
							cacheKey: normalizeText(normalizedLocation),
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
				// Loại phòng: Ưu tiên extracted, nếu không có thì mặc định boarding_house
				if (extracted.room.roomType !== null && extracted.room.roomType !== undefined) {
					draft.room.roomType = this.normalizeRoomType(extracted.room.roomType);
				} else if (!draft.room.roomType) {
					draft.room.roomType = 'boarding_house';
				}
				// Số lượng phòng: Ưu tiên extracted, nếu không có thì mặc định 1
				if (extracted.room.totalRooms !== null && extracted.room.totalRooms !== undefined) {
					draft.room.totalRooms = Math.max(1, Math.min(100, extracted.room.totalRooms)); // Validate range 1-100
				} else if (!draft.room.totalRooms) {
					draft.room.totalRooms = 1;
				}
				// Diện tích phòng: Ưu tiên extracted
				if (extracted.room.areaSqm !== null && extracted.room.areaSqm !== undefined) {
					draft.room.areaSqm = Math.max(1, Math.min(1000, extracted.room.areaSqm)); // Validate range 1-1000
				}
				// Số người ở tối đa: Ưu tiên extracted
				if (extracted.room.maxOccupancy !== null && extracted.room.maxOccupancy !== undefined) {
					draft.room.maxOccupancy = Math.max(1, Math.min(10, extracted.room.maxOccupancy)); // Validate range 1-10
				}
				// Số tầng: Ưu tiên extracted
				if (extracted.room.floorNumber !== null && extracted.room.floorNumber !== undefined) {
					draft.room.floorNumber = Math.max(0, Math.min(50, extracted.room.floorNumber)); // Validate range 0-50
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
						// Normalize giá: nếu giá < 1000, có thể là đơn vị triệu, nhân với 1,000,000
						let normalizedPrice = extracted.room.pricing.basePriceMonthly;
						if (normalizedPrice > 0 && normalizedPrice < 1000) {
							// Có thể là đơn vị triệu (ví dụ: 5 triệu = 5)
							normalizedPrice = normalizedPrice * 1000000;
							this.logger.debug(
								`Normalized basePriceMonthly from ${extracted.room.pricing.basePriceMonthly} to ${normalizedPrice} (assumed unit: triệu)`,
							);
						}
						draft.room.pricing.basePriceMonthly = Math.max(0, normalizedPrice);
					}
					if (
						extracted.room.pricing.depositAmount !== null &&
						extracted.room.pricing.depositAmount !== undefined
					) {
						// Normalize giá: nếu giá < 1000, có thể là đơn vị triệu, nhân với 1,000,000
						let normalizedDeposit = extracted.room.pricing.depositAmount;
						if (normalizedDeposit > 0 && normalizedDeposit < 1000) {
							// Có thể là đơn vị triệu (ví dụ: 5 triệu = 5)
							normalizedDeposit = normalizedDeposit * 1000000;
							this.logger.debug(
								`Normalized depositAmount from ${extracted.room.pricing.depositAmount} to ${normalizedDeposit} (assumed unit: triệu)`,
							);
						}
						draft.room.pricing.depositAmount = Math.max(0, normalizedDeposit);
					}
					if (
						extracted.room.pricing.depositMonths !== null &&
						extracted.room.pricing.depositMonths !== undefined
					) {
						draft.room.pricing.depositMonths = Math.max(
							1,
							Math.min(12, extracted.room.pricing.depositMonths),
						);
					}
					if (
						extracted.room.pricing.utilityIncluded !== null &&
						extracted.room.pricing.utilityIncluded !== undefined
					) {
						draft.room.pricing.utilityIncluded = extracted.room.pricing.utilityIncluded;
					}
					if (
						extracted.room.pricing.utilityCostMonthly !== null &&
						extracted.room.pricing.utilityCostMonthly !== undefined
					) {
						draft.room.pricing.utilityCostMonthly = Math.max(
							0,
							extracted.room.pricing.utilityCostMonthly,
						);
					}
					if (
						extracted.room.pricing.minimumStayMonths !== null &&
						extracted.room.pricing.minimumStayMonths !== undefined
					) {
						draft.room.pricing.minimumStayMonths = Math.max(
							1,
							Math.min(60, extracted.room.pricing.minimumStayMonths),
						);
					}
					if (
						extracted.room.pricing.maximumStayMonths !== null &&
						extracted.room.pricing.maximumStayMonths !== undefined
					) {
						draft.room.pricing.maximumStayMonths = Math.max(
							1,
							Math.min(60, extracted.room.pricing.maximumStayMonths),
						);
					}
					if (
						extracted.room.pricing.priceNegotiable !== null &&
						extracted.room.pricing.priceNegotiable !== undefined
					) {
						draft.room.pricing.priceNegotiable = extracted.room.pricing.priceNegotiable;
					}
				}
				// Xử lý costs với validation và mapping thông minh
				if (extracted.room.costs && systemCostTypes.length > 0) {
					for (const cost of extracted.room.costs) {
						if (!cost.value || cost.value <= 0) {
							this.logger.warn(`Invalid cost value: ${cost.value}, skipping cost`);
							continue;
						}

						let matchedSystemCostType:
							| { id: string; name: string; category: string; defaultUnit?: string }
							| undefined;

						// Trường hợp 1: AI đã trả về systemCostTypeId hợp lệ
						if (cost.systemCostTypeId) {
							matchedSystemCostType = systemCostTypes.find((ct) => ct.id === cost.systemCostTypeId);
							if (!matchedSystemCostType) {
								this.logger.warn(
									`Invalid systemCostTypeId from AI: ${cost.systemCostTypeId}, attempting fallback mapping`,
								);
							}
						}

						// Trường hợp 2: Fallback - Tìm kiếm thông minh dựa trên costType hoặc keywords
						if (!matchedSystemCostType && cost.costType) {
							const normalizedCostType = cost.costType.toLowerCase();
							// Tìm kiếm theo keywords phổ biến
							const keywords: Record<string, string[]> = {
								điện: ['điện', 'electricity', 'electric'],
								nước: ['nước', 'water'],
								internet: ['internet', 'wifi', 'mạng', 'network'],
								xe: ['xe', 'parking', 'gửi xe', 'park'],
								rác: ['rác', 'waste', 'garbage', 'trash'],
								an_ninh: ['an ninh', 'security', 'bảo vệ'],
								dịch_vụ: ['dịch vụ', 'service', 'phí dịch vụ'],
							};

							// Tìm keyword match
							for (const [_key, searchTerms] of Object.entries(keywords)) {
								if (searchTerms.some((term) => normalizedCostType.includes(term))) {
									// Tìm cost type có name chứa keyword
									matchedSystemCostType = systemCostTypes.find((ct) => {
										const ctName = ct.name.toLowerCase();
										return searchTerms.some((term) => ctName.includes(term));
									});
									if (matchedSystemCostType) {
										this.logger.debug(
											`Matched cost type "${cost.costType}" to system cost type "${matchedSystemCostType.name}" (${matchedSystemCostType.id})`,
										);
										break;
									}
								}
							}

							// Nếu vẫn chưa tìm thấy, thử tìm kiếm trực tiếp trong name
							if (!matchedSystemCostType) {
								matchedSystemCostType = systemCostTypes.find(
									(ct) =>
										ct.name.toLowerCase().includes(normalizedCostType) ||
										normalizedCostType.includes(ct.name.toLowerCase()),
								);
							}
						}

						// Nếu tìm thấy system cost type, thêm vào draft
						if (matchedSystemCostType) {
							const existingCost = draft.room.costs.find(
								(c) => c.systemCostTypeId === matchedSystemCostType!.id,
							);

							// Xác định costType và unit dựa trên tên cost type
							// QUAN TRỌNG: Điện luôn là metered, nước luôn là per_unit (KHÔNG BAO GIỜ fixed)
							const costName = matchedSystemCostType.name.toLowerCase();
							let finalCostType: string;
							let finalUnit: string;

							if (costName.includes('điện') || costName.includes('electricity')) {
								// Điện: LUÔN là metered (theo đồng hồ/số điện), KHÔNG BAO GIỜ fixed
								finalCostType = 'metered';
								finalUnit = 'per_kwh';
								this.logger.debug(
									`Cost type "${costName}" identified as ELECTRICITY → FORCED costType=metered, unit=per_kwh (ignoring LLM costType=${cost.costType})`,
								);
							} else if (costName.includes('nước') || costName.includes('water')) {
								// Nước: LUÔN là per_unit (theo đầu người), KHÔNG BAO GIỜ fixed
								finalCostType = 'per_unit';
								finalUnit = 'per_person';
								this.logger.debug(
									`Cost type "${costName}" identified as WATER → FORCED costType=per_unit, unit=per_person (ignoring LLM costType=${cost.costType})`,
								);
							} else {
								// Các cost types khác (internet, gửi xe, rác, etc.): thường là fixed
								// Cho phép LLM override cho các cost types này
								finalCostType = cost.costType || 'fixed';
								finalUnit = cost.unit || matchedSystemCostType.defaultUnit || 'per_month';
								this.logger.debug(
									`Cost type "${costName}" identified as OTHER → costType=${finalCostType}, unit=${finalUnit}`,
								);
							}

							if (!existingCost) {
								draft.room.costs.push({
									systemCostTypeId: matchedSystemCostType.id,
									value: cost.value,
									costType: finalCostType as any,
									unit: finalUnit,
									billingCycle: (cost.billingCycle as any) || 'MONTHLY',
									includedInRent: false,
									isOptional: false,
								});
								this.logger.debug(
									`Added cost: ${matchedSystemCostType.name} (${matchedSystemCostType.id}) = ${cost.value} VNĐ, type=${finalCostType}, unit=${finalUnit}`,
								);
							} else {
								// Cập nhật giá trị nếu đã có
								existingCost.value = cost.value;
								// Đảm bảo costType và unit đúng cho điện/nước
								existingCost.costType = finalCostType as any;
								existingCost.unit = finalUnit;
								this.logger.debug(
									`Updated cost: ${matchedSystemCostType.name} (${matchedSystemCostType.id}) = ${cost.value} VNĐ, type=${finalCostType}, unit=${finalUnit}`,
								);
							}
						} else {
							this.logger.warn(
								`Could not find matching system cost type for cost: ${JSON.stringify(cost)}, skipping`,
							);
						}
					}
				} else if (
					extracted.room.costs &&
					extracted.room.costs.length > 0 &&
					systemCostTypes.length === 0
				) {
					this.logger.warn('Cannot process costs: no system cost types available');
				}
				// Xử lý amenities nếu có
				if (extracted.room.amenities && Array.isArray(extracted.room.amenities)) {
					for (const amenity of extracted.room.amenities) {
						if (amenity.systemAmenityId) {
							const existingAmenity = draft.room.amenities?.find(
								(a) => a.systemAmenityId === amenity.systemAmenityId,
							);
							if (!existingAmenity) {
								if (!draft.room.amenities) {
									draft.room.amenities = [];
								}
								draft.room.amenities.push({
									systemAmenityId: amenity.systemAmenityId,
									customValue: amenity.customValue || undefined,
									notes: amenity.notes || undefined,
								});
							}
						}
					}
				}
				// Xử lý rules nếu có
				if (extracted.room.rules && Array.isArray(extracted.room.rules)) {
					for (const rule of extracted.room.rules) {
						if (rule.systemRuleId) {
							const existingRule = draft.room.rules?.find(
								(r) => r.systemRuleId === rule.systemRuleId,
							);
							if (!existingRule) {
								if (!draft.room.rules) {
									draft.room.rules = [];
								}
								draft.room.rules.push({
									systemRuleId: rule.systemRuleId,
									customValue: rule.customValue || undefined,
									isEnforced:
										rule.isEnforced !== null && rule.isEnforced !== undefined
											? rule.isEnforced
											: true,
									notes: rule.notes || undefined,
								});
							}
						}
					}
				}
			}

			const totalDuration = Date.now() - startTime;
			this.logger.log(`[EXTRACTION] Field extraction completed successfully`, {
				totalDuration: `${totalDuration}ms`,
				extractedFields: {
					building: extracted.building ? Object.keys(extracted.building).length : 0,
					room: extracted.room ? Object.keys(extracted.room).length : 0,
					costs: extracted.room?.costs?.length || 0,
					amenities: extracted.room?.amenities?.length || 0,
					rules: extracted.room?.rules?.length || 0,
				},
			});
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.warn(`[EXTRACTION] Failed to parse fields using LLM`, {
				error: error instanceof Error ? error.message : String(error),
				duration: `${duration}ms`,
			});
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

	private async composeStepResult(
		session: ChatSession,
		draft: RoomPublishingDraft,
		actions: RoomPublishingAction[] = [],
		userMessage?: string,
		userId?: string,
	): Promise<RoomPublishingStepResult> {
		applyRoomDefaults(draft.room);
		markSqlReadiness(draft);
		markExecutionReadiness(draft);
		draft.stage = determineNextStage(draft);
		const missingField = getNextMandatoryQuestion(draft);
		const allMissingFields = getAllMissingFields(draft);
		const hasPendingActions = actions.length > 0;
		const executionPlan = buildExecutionPlan(draft);

		// Filter missing fields: Nếu đã có locationHint (text) dù chưa có districtId/provinceId (ID),
		// thì KHÔNG hỏi lại location (đang được xử lý để map text -> ID)
		// QUAN TRỌNG: Đây là chốt chặn để tránh vòng lặp vô tận
		const hasLocationLookupPending = actions.some((a) => a.type === 'LOOKUP_LOCATION');
		const hasLocationHint = !!(draft.building.locationHint || draft.building.name);
		const locationHintText = draft.building.locationHint || draft.building.name || '';
		const hasLocationResolved = !!(draft.building.districtId && draft.building.provinceId);
		const locationLookupFailed = draft.building.locationLookupFailed === true;
		const filteredMissingFields = allMissingFields.filter((f) => {
			// Nếu hệ thống báo thiếu Location, nhưng trong draft đã có text "Quận..." -> Bỏ qua, không hỏi nữa
			if (f.key === 'building.location' && hasLocationHint && locationHintText.length > 3) {
				// Đã có locationHint (text) → đang được xử lý để map sang ID, không hỏi lại
				// TRỪ KHI lookup đã fail → cần hỏi user xác nhận lại hoặc cho phép tạo với text
				if (locationLookupFailed && !hasLocationResolved) {
					// Lookup đã fail, nhưng vẫn có locationHint → có thể cho phép tạo với text hoặc hỏi xác nhận
					this.logger.debug(
						`[PROMPT_GEN] Location lookup failed but has locationHint - will allow creation with text or ask confirmation`,
					);
					// Không filter out → sẽ hỏi user xác nhận hoặc cho phép tiếp tục
					return true;
				}
				this.logger.debug(
					`[PROMPT_GEN] Filtering out location field - already has locationHint: "${locationHintText.substring(0, 50)}"`,
				);
				return false;
			}
			// Nếu hệ thống báo thiếu Giá, nhưng draft đã có số > 0 -> Bỏ qua
			if (
				f.key === 'room.pricing.basePriceMonthly' &&
				draft.room.pricing.basePriceMonthly &&
				draft.room.pricing.basePriceMonthly > 0
			) {
				this.logger.debug(
					`[PROMPT_GEN] Filtering out price field - already has basePriceMonthly: ${draft.room.pricing.basePriceMonthly}`,
				);
				return false;
			}
			return true;
		});

		// Generate prompt: Use AI-Native conversational response if we have user message and missing fields
		// QUAN TRỌNG: Nếu location lookup failed, vẫn dùng AI để đưa ra giải pháp hợp lý
		let prompt: string;
		const shouldUseAI =
			userMessage &&
			(filteredMissingFields.length > 0 || locationLookupFailed) && // Cho phép AI xử lý khi lookup failed
			!executionPlan &&
			!hasPendingActions &&
			missingField?.key !== 'building.selection';

		this.logger.debug(`[PROMPT_GEN] Determining prompt generation strategy`, {
			shouldUseAI,
			hasUserMessage: !!userMessage,
			missingFieldsCount: allMissingFields.length,
			filteredMissingFieldsCount: filteredMissingFields.length,
			hasExecutionPlan: !!executionPlan,
			hasPendingActions,
			hasLocationLookupPending,
			hasLocationHint,
			hasLocationResolved,
			locationLookupFailed,
			missingFieldKey: missingField?.key,
		});

		if (shouldUseAI) {
			// Use LLM to generate natural conversational response
			this.logger.debug(`[PROMPT_GEN] Using AI-Native conversational response generation`);
			// Nếu location lookup failed, vẫn truyền missingFields gốc để AI biết context đầy đủ
			const fieldsForAI = locationLookupFailed
				? allMissingFields // Cho AI biết đầy đủ context khi lookup failed
				: filteredMissingFields;
			const aiResponse = await this.generateConversationalResponseAsync(
				draft,
				userMessage,
				fieldsForAI,
				userId,
			);
			if (aiResponse) {
				prompt = aiResponse;
				this.logger.debug(`[PROMPT_GEN] Using AI-generated prompt`, {
					promptLength: prompt.length,
					promptPreview: prompt.substring(0, 100),
				});
			} else {
				// Fallback to default prompt if AI generation fails
				this.logger.warn(`[PROMPT_GEN] AI generation failed, falling back to default prompt`);
				prompt = this.composePrompt(draft, missingField, filteredMissingFields, hasPendingActions);
			}
		} else {
			// Use default prompt for special cases (execution plan, building selection, pending actions)
			this.logger.debug(`[PROMPT_GEN] Using default prompt (special case)`);
			prompt = this.composePrompt(draft, missingField, filteredMissingFields, hasPendingActions);
		}

		draft.pendingConfirmation = missingField?.key;
		draft.lastActions = actions;
		session.context = { activeFlow: 'room-publishing', roomPublishing: draft };

		// Xác định status rõ ràng:
		// 1. Nếu có execution plan -> READY_TO_CREATE
		// 2. Nếu có actions pending -> NEED_MORE_INFO (đang chờ xử lý)
		// 3. Nếu có missing fields -> NEED_MORE_INFO (cần thêm thông tin)
		// 4. Nếu không có gì -> NEED_MORE_INFO (fallback)
		const status = executionPlan
			? RoomPublishingStatus.READY_TO_CREATE
			: RoomPublishingStatus.NEED_MORE_INFO;

		const result: RoomPublishingStepResult = {
			stage: draft.stage,
			status,
			prompt,
			draft,
			missingField,
			actions: actions.length > 0 ? actions : undefined,
			executionPlan: executionPlan || undefined,
		};

		this.logger.log(`[STEP_RESULT] Composed step result`, {
			stage: result.stage,
			status: result.status,
			promptLength: result.prompt.length,
			promptPreview: result.prompt.substring(0, 100),
			hasMissingField: !!result.missingField,
			missingFieldKey: result.missingField?.key,
			hasActions: !!(result.actions && result.actions.length > 0),
			actionsCount: result.actions?.length || 0,
			hasExecutionPlan: !!result.executionPlan,
		});

		return result;
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
			// LOOKUP_LOCATION failed - không tìm được ID
			draft.building.locationResolved = undefined;
			this.logger.warn(
				`[LOCATION_LOOKUP] Failed to resolve location for "${action.params?.locationQuery || 'unknown'}"`,
				{
					locationHint: draft.building.locationHint,
					actionType: action.type,
				},
			);
			// Lưu flag để biết lookup đã fail (để có thể hỏi user xác nhận lại hoặc cho phép tạo với text)
			draft.building.locationLookupFailed = true;
			return;
		}
		// LOOKUP_LOCATION success
		const resolved = resolveLocationFromRow(rows[0]);
		draft.building.districtId = resolved.districtId ?? draft.building.districtId;
		draft.building.provinceId = resolved.provinceId ?? draft.building.provinceId;
		draft.building.wardId = resolved.wardId ?? draft.building.wardId;
		draft.building.locationResolved = resolved;
		draft.building.locationCacheKey = action.cacheKey;
		draft.building.locationLookupFailed = false;
		this.logger.debug(`[LOCATION_LOOKUP] Successfully resolved location`, {
			districtId: resolved.districtId,
			provinceId: resolved.provinceId,
			locationHint: draft.building.locationHint,
		});
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
