/**
 * This file lists the data transfer objects used to communicate with the STT server.
 */

export interface CrewAvatarDTO {
	id: number;
	symbol: string;
	name: string;
	short_name: string;
	max_rarity: number;
	traits: string[];
	traits_hidden: string[];
	skills: string[];
	default_avatar: boolean;
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
	portrait: ImageDataDTO;
	hide_from_cryo: boolean;
}

export interface ImageDataDTO {
	file: string;
}

export interface SkillDTO {
	core: number;
	range_min: number;
	range_max: number;
}

export interface CrewActionChargePhaseDTO {
	charge_time: number;
	ability_amount?: number;
	bonus_amount?: number;
	duration?: number;
	cooldown?: number;
}

export interface CrewActionDTO {
	ability?: {
		amount: number;
		condition: number;
		type: number;
	};
	bonus_amount: number;
	bonus_type: number;
	charge_phases?: CrewActionChargePhaseDTO[];
	cooldown: number;
	crew: number;
	duration: number;
	icon: ImageDataDTO;
	initial_cooldown: number;
	limit?: number;
	name: string;
	penalty?: {
		type: number;
		amount: number;
	};
	special: boolean;
	symbol: string;
}

export interface CrewDTO {
	action: CrewActionDTO;
	active_id?: number;
	active_index: number;
	active_status: number;
	archetype_id: number;
	base_skills: { [sk: string]: SkillDTO; };
	cap_achiever: {
		date: number;
		name: string;
	};

	cross_fuse_targets: any;
	default_avatar: boolean;
	equipment: number[][];
	equipment_rank: number;
	equipment_slots: {
		level: number;
		archetype: number;
	}[];
	expires_in?: number;
	favorite: boolean;
	flavor: string;
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
	id: number;
	in_buy_back_state: boolean;
	level: number;
	max_equipment_rank: number;
	max_level: number;
	max_rarity: number;
	max_xp: number;
	name: string;
	passive_id: any;
	passive_index: number;
	passive_status: number;
	portrait: ImageDataDTO;
	rarity: number;
	ship_battle: {
		accuracy: number;
		crit_bonus: number;
		crit_chance: number;
		evasion: number;
	};
	short_name: string;
	skills: { [sk: string]: SkillDTO; };
	symbol: string;
	traits: string[];
	traits_hidden: string[];
	voice_over: any;
	xp: number;
	xp_for_current_level: number;
	xp_for_next_level: number;

	// These properties are added by the app
	//TODO: where is this needed?
	/** @deprecated */
	archetypes?: any;
}

// Used internally by the app; not a DTO
export interface SkillData {
	core: number;
	min: number;
	max: number;
	voy: number;

	// index operator to use strings for keys
	[sk:string] : number;
}

export interface CrewEquipmentSlotData {
	archetype: number;
	level: number;
	// TODO type info
	symbol: any;
	have: boolean;
}

// Used internally by the app; not a DTO
export interface CrewData {
	active_id?: number;
	active_index: number;
	active_status: number;
	action: CrewActionDTO;
	archetypes?: any[];
	/** @deprecated - migrate to using status.buyback */
	buyback: boolean;
	/** Frozen crew have crew_id random plus 2 billion (to not overflow 32bit int) */
	crew_id: number;
	equipment_slots: CrewEquipmentSlotData[];
	/** @deprecated - migrate to using status.expires_in */
	expires_in?: number;
	favorite: boolean;
	flavor: string;
	//TODO: allow multiples in voyage crew computation when enabled
	/** @deprecated - migrate to using status.frozen */
	frozen: number;
	status: {
		// Is this crew in the active roster
		active: boolean;
		// How many this crew represents which are all frozen
		frozen: number;
		// Is this crew in the buyback roster
		buyback: boolean;
		expires_in?: number;
		// Is this from 'allcrew' or local
		external: boolean;
		fe: boolean;
	}
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
	/** @deprecated moved to avatar_id */
	id: number;
	avatar_id: number;
	/** @deprecated - migrate to using status.external */
	isExternal: boolean;
	level: number;

	/** note: this is not 100; this represents the max trainable level according to the current equipment */
	max_level: number;
	max_rarity: number;
	name: string;
	portrait: ImageDataDTO;
	rarity: number;
	rawTraits: string[];
	ship_battle: {
		accuracy: number;
		crit_bonus: number;
		crit_chance: number;
		evasion: number;
	};
	short_name: string;
	//TODO: fix test against symbol when there could be multiple (frozen too)
	symbol: string;
	traits: string;

	usage_value: number;
	voyage_score: number;
	gauntlet_score: number;
	skills: { [sk: string]: SkillData; };

	/** each index is a skill name, e.g. 'command_skill' */
	// shuttle_skill_pairs: { [sk_pri: string]: { [sk_sec: string] : number }; };

	datacore?: DatacoreCrewDTO;
}

export interface BorrowedCrewDTO {
	action?: CrewActionDTO;
	active_id?: number;
	active_index?: number;
	active_status?: number;
	archetype_id: number;
	equipment: number[][];
	equipment_rank: number;
	equipment_slots: {
		level: number;
		archetype: number;
	}[];
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
	id: number;
	level: number;
	max_equipment_rank: number;
	max_level: number;
	max_rarity: number;
	name: string;
	portrait: ImageDataDTO;
	rarity: number;
	ship_battle: {
		accuracy?: number;
		crit_bonus?: number;
		crit_chance?: number;
		evasion?: number;
	};
	short_name: string;
	skills: { [sk: string]: SkillDTO; };
	symbol: string;
	traits: string[];
	traits_hidden: string[];
	voice_over: any;
}

export interface GauntletDTO {
	bracket_id: string;
	consecutive_wins: number;
	contest_data: {
		featured_skill: string;
		primary_skill: string;
		secondary_skill: string;
		traits: string[];
		selected_crew: GauntletCrewDTO[];

		contest_rewards: any[];
		ranked_rewards: any[];
		crit_chance_per_trait: number;
	};

	gauntlet_id: number;
	jackpot_crew: string;
	opponents: GauntletOpponentDTO[];

	rank: number;
	score: number;
	seconds_to_end: number;
	seconds_to_join?: number; // only if gauntlet has not started
	seconds_to_next_crew_refresh: number;
	seconds_to_next_opponent_refresh: number;
	/** 'NONE' | 'STARTED' | 'UNSTARTED' | 'ENDED_WITH_REWARDS' */
	state: string;
	refresh_cost: { currency: number; amount: number };
	revive_and_save_cost: { currency: number; amount: number };
	revive_cost: { currency: number; amount: number };
}

export interface GauntletCrewDTO {
	archetype_symbol: string;
	crew_id: number;
	crit_chance: number;
	debuff: number;
	disabled: boolean;
	level: number;
	max_rarity: number;
	rarity: any; // huh? came in as boolean
	selected: boolean;
	skills: { min: number; max: number; skill: string }[];
}

export interface GauntletOpponentDTO {
	crew_contest_data: { crew: GauntletCrewDTO[]; };
	icon: ImageDataDTO;
	level: number;
	name: string;
	player_id: number;
	rank: number;
	value: number;
}

export interface GauntletContestDTO {
	player_rolls: number[];
	player_crit_rolls: boolean[];
	opponent_rolls: number[];
	opponent_crit_rolls: boolean[];
	opponent_score: number;
	opponent_value: number;
	value: number;
	win: boolean;
	action: string;
	loot_box_rarity: number;
}

export interface GauntletContestLootDTO {
	flavor: string;
	full_body?: ImageDataDTO;
	full_name: string;
	icon: ImageDataDTO;
	id: number;
	instance: { bucket: string; id: number; };
	name: string;
	portrait?: ImageDataDTO;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
}

export interface VoyageUpdateInProgressDTO {
	hp: number;
	id: number;
	seconds_since_last_dilemma: number;
	state: string;
	time_to_next_event: number;
	voyage_duration: number;
}

export interface VoyageUpdateRecalledDTO {
	hp: number;
	id: number;
	recall_time_left: number;
	speedup_cost: {
		amount: number;
		currency: number;
	}
	state: string;
	voyage_duration: number;
}

export type VoyageUpdateDTO = VoyageUpdateInProgressDTO & VoyageUpdateRecalledDTO;

export const VOYAGE_ENCOUNTER_TYPES: string[] = ['flavor', 'reward', 'reward_found', 'hazard', 'hp_change', 'dilemma'];
export interface VoyageNarrativeDTO {
	index: number;
	text: string;
	encounter_type: string; // one of VOYAGE_ENCOUNTER_TYPES
	event_time: number
	crew?: string[];
	skill_check?: { skill: string; passed: boolean; };
	rewards?: { loot: RewardDTO[] };
}

export interface RewardDTO {
	action?: CrewActionDTO;
	bonuses?: { [key: number]: number };
	flavor: string;
	full_body?: ImageDataDTO;
	full_name: string;
	hash_key?: string;
	icon: ImageDataDTO;
	id: number;
	item_type?: number; // defined if type == 2
	name: string;
	portrait?: ImageDataDTO;
	quantity: number;
	rarity: number;
	skills?: { [skill: string]: SkillDTO; };
	symbol: string; // 'energy' (chrons), 'honor' (honor), 'nonpremium' (merits), 'season_points' (accolades), 'premium' (dilithium)
	traits?: string[];
	/** See CONFIG.REWARDS_ITEM_TYPE */
	type: number;
}

export interface VoyageDTO {
	completed_at: any; // was null; probably a string
	created_at: string;
	crew_slots: {
		crew: CrewDTO;
		name: string;
		skill: string;
		symbol: string;
		trait: string;
	}[];
	description: string; // seems to be unused
	dilemma?: {
		icon: string;
		id: number;
		intro: string;
		resolutions: {
			locked: boolean;
			loot: string[];
			option: string;
			outro: string;
			outro_crew: any[];
			skill: string;
		}[];
		rewards?: {
			loot: RewardDTO[];
		}
		state: string;
		symbol: string;
		title: string;
	};
	first_leave: boolean;
	granted_rewards: any; // was null
	hp: number;
	icon: string;
	id: number;
	log_index: number;
	max_hp: number;
	name: string; // seems to be unused
	next_interaction?: string;
	pending_rewards: { loot: RewardDTO[] };
	recalled_at: string;
	recall_time_left?: number;
	seconds_between_dilemmas: number;
	seconds_since_last_dilemma: number;
	seconds_til_death?: number;
	seed: number;
	ship_id: number;
	ship_name: string;
	ship_trait: string;
	skill_aggregates: { [sk: string]: { skill: string; core: number; range_min: number; range_max: number; } };
	skills: { primary_skill: string; secondary_skill: string; };
	speedup_cost?: { currency: number; amount: number; };
	state: string;
	time_to_next_event: number;
	time_till_next_interaction?: number;
	voyage_duration: number;
}

export interface VoyageDescriptionDTO {
	crew_slots: {
		name: string;
		skill: string;
		symbol: string;
		trait: string;
	}[];
	description: string;
	icon: string; // unused?
	id: number; // unused?
	name: string; // unused?
	potential_rewards: any[];
	ship_trait: string;
	skills: { primary_skill: string; secondary_skill: string; };
	symbol: string; // unused?
}

export interface VoyageExportData {
	id: number;
	skills: { primary_skill: string; secondary_skill: string; };
	antimatter: number;
	slots: {
		name: string;
		skill: string;
		symbol: string;
		trait: string;
	}[];
	skillAggregates: SkillAggregate[];
	stats: {
		skillChecks: {
			times: number[];
			average: number;
		};
		rewards: {
			times: number[];
			average: number;
		};
	};
	narrative: VoyageNarrativeDTO[];
	/** Used in data analytics, not export */
	totalTimeSec?: number;
}

export interface SkillAggregate {
	skill: string;
	core: number;
	min: number;
	max: number;
	score: number;
	attempts: number;
	passed: number;
	passedPercent: number;
	attemptsPercent: number;
}

export interface PlayerResponseDTO {
	player?: PlayerDTO;
	item_archetype_cache: {
		archetypes: ItemArchetypeDTO[];
		id: number;
	};
};

export interface PlayerDTO {
	character: PlayerCharacterDTO;
	chats: any;
	commerce: any;
	community_links: any;
	currency_exchanges: any;
	dbid: number;
	display_name: string;
	entitlements: any;
	environment: { [key:string] : any };
	// environment.video_ad_campaign_limit: {
	//    master_limit: { chance: number; period_minutes: number; }
	//    stt_cadet_warp: { chance: number; period_minutes: number; }
	// }
	fleet: FleetDTO;
	fleet_invite: any;
	honor: number;
	id: number;
	lang: string;
	locale: string;
	mailbox: any;
	money: number;
	motd: any;
	npe_complete: boolean;
	premium_earnable: number;
	premium_purchasable: number;
	replicator_limit: number;
	replicator_uses_today: number;
	shuttle_rental_tokens: number;
	squad: { id: number; rank: string; };
	timezone: string;
	vip_level: number;
	vip_points: number;
}

export interface AcceptedMissionsDTO {
	accepted: boolean;
	description: string;
	episode: number;
	episode_portrait: ImageDataDTO;
	episode_title: string;
	exclude_from_timeline?: boolean;
	id: number;
	main_story: boolean;
	marker: number[];
	marker_icon: ImageDataDTO;
	quests: MissionQuestDTO[];
	stars_earned: number;
	state: number;
	symbol: string;
	total_stars: number;
}

export interface PlayerCharacterDTO {
	accepted_missions: AcceptedMissionsDTO[];
	active_conflict: any; // null
	boost_windows: any[];
	cadet_schedule: {
		current: number;
		day: number;
		ends_in: number;
		missions: MissionCadetScheduleDTO[];
		next: number;
		next_starts_in: number;
		schedule: {day: number; mission: number }[];
	};
	cadet_tickets: any;
	can_purchase_crew_limit_increase: boolean;
	can_purchase_shuttle_bay: boolean;
	crew: CrewDTO[];
	crew_avatar?: CrewAvatarDTO;
	crew_borrows: BorrowedCrewDTO[];
	crew_collection_buffs: {
		name: string,
		short_name: string,
		flavor: string,
		icon: ImageDataDTO,
		operator: string, // "percent_increase",
		value: number,
		stat: string, // skill key, e.g. "science_skill_core",
		source: string, // "crew_collection",
		symbol: string
	}[];
	crew_limit: number;
	crew_limit_increase_per_purchase: number;
	crew_shares: any[];
	cryo_collections: CryoCollectionDTO[];
	current_ship_id: number;
	daily_activities: {
		id: number,
		name: string,
		description: string,
		icon:
		{
			file: string,
			atlas_info: string, //"atlas_stt_icons_info"
		},
		area: string,
		weight: number,
		category: number,
		lifetime?: number, // 1= achievements; 0=daily mission; undefined=chron boost, daily reward
		rewards?: RewardDTO[], // empty array if claimed
		goal?: number,
		min_level?: number,
		rarity?: number,
		progress?: number,
		status?: string // goal status, "Top 1" for gauntlet, "1 / 3" for scans
	}[];
	daily_rewards_state: {
		seconds_until_next_reward: number,
		today_reward_day_index: number,
		season_points_per_day: number,
		quantum_per_day: number,
		reward_days:
		[
			{
				id: number,
				double_at_vip: number,
				symbol: string,
				rewards: any[]
			}
		]
	};
	destination: any;
	display_name: string;
	dispute_histories: MissionDisputeHistoryDTO[];
	disputes: any[];
	event_tickets: any;
	events: EventDTO[];
	factions: FactionDTO[];
	/** Fleet Daily Targets */
	fleet_activities: {
		id: number,
		name: string,
		description: string,
		icon:
		{
			file: string,
			atlas_info: string,//"atlas_stt_icons_info"
		},
		area: string,
		category: string,
		total_points: number,
		current_points: number,
		milestones: {
			goal: number,
			rewards: RewardDTO[],
			claimed: boolean,
			claimable: boolean
		}[],
		claims_available_count: number
	}[]; // size = 4
	freestanding_quests: any[];
	gauntlets?: GauntletDTO[]; // Does not come with initial fetch, but gauntlet update is within character
	honor_reward_by_rarity: number[]; // [25,50,100,200,550 ]
	id: number;
	item_limit: number;
	items: ItemDTO[];
	level: number;
	location: { place: string; setup: string; system: string; x: number; y: number; };
	location_channel_prefix: string;
	max_level: number;
	navmap: {
		places: {
			client_asset: any;
			display_name?: string;
			id: number;
			symbol: string;
			system: string;
			visibled?: boolean;
		}[];
		systems: {
			active?: boolean;
			decorator?: number;
			default_place: string;
			display_name?: string;
			faction?: string;
			id: number;
			scale?: number;
			star?: number;
			symbol: string;
			x: number;
			y: number;
		}[];
	};
	next_crew_limit_increase_cost: { currency: number; amount: number; };
	next_daily_activity_reset: number;
	next_fleet_activity_reset: number;
	next_shuttle_bay_cost: any;
	next_starbase_donation_reset: number;
	open_packs: any[];
	pvp_divisions: any[];
	pvp_tickets: any;
	pvp_timer: any;
	replay_energy_max: number;
	replay_energy_overflow: number;
	replay_energy_rate: number;
	reroll_descriptions: {
		id: number,
		jackpot: number,
		crew_required: number
	}[];
	scan_speedups_today: number;
	/** "Campaign" data */
	seasons: {
		id: number,
		symbol: string,
		title: string,
		description: string,
		exclusive_crew: any[],
		tiers: any[],
		points_per_tier: number,
		tier_dilithium_cost: number,
		start_at: number,
		end_at: number,
		premium_tier_offer_store_symbol: string, // "seasons",
		premium_tier_entitlement_symbol: string, // "game_feature",
		premium_tier_entitlement_specialization: string, // "season_premium_rewards.rebirth_season",
		opened: boolean,
		points: number,
		redeemed_points: number,
		redeemed_premium: number,
		acknowledged: boolean,
		concluded: boolean
	};
	seconds_from_last_boost_claim: number;
	seconds_from_replay_energy_basis: number;
	seconds_to_scan_cooldown: number;
	ships: ShipDTO[];
	shuttle_adventures: PlayerShuttleAdventureDTO[];
	shuttle_bays: number;
	starbase_buffs: {
		name: string,
		short_name: string,
		flavor: string,
		icon: ImageDataDTO,
		operator: string, // "multiplier",
		value: number,
		stat: string, // skill key, e.g. "science_skill_core",
		source: string, // "starbase",
		symbol: string
	}[];
	stimpack?: {
		crew_xp_multiplier: number;
		ends_in: number;
		energy_discount: number; // as a whole number, like '25' to mean '25%'
		nonpremium_currency_multiplier: number;
	};
	stored_immortals: { id: number; quantity: number; }[];
	tng_the_game_level: number;
	tutorials: any[];
	using_default_name: boolean;
	video_ad_chroniton_boost_reward: any;
	voyage: VoyageDTO[];
	voyage_descriptions: VoyageDescriptionDTO[];
	voyage_summaries: any;
	xp: number;
	xp_for_current_level: number;
	xp_for_next_level: number;
}

export interface PlayerInspectDTO {
	character: {
		/** Crew in current ship displayed to others in the game */
		crew: any[];
		/** Same as PlayerDTO crew_avatar */
		crew_avatar: any;
		current_ship: any;
		display_name: string;
		id: number;
		level: number;
		location: any;
		using_default_name: boolean;
	};
	dbid: number;
	display_name: string;
	fleet: FleetDTO;
	fleet_eligible: boolean;
	friend_status: any;
	online_status: { online: boolean; lastSeen: number; }
}

export interface FleetMemberDTO {
	crew_avatar?: CrewAvatarDTO;
	daily_activity: number;
	dbid: number;
	display_name: string;
	event_rank: number;
	last_active: number;
	level: number;
	pid: number;
	rank: string;
	squad_id: string;
	squad_rank: string;
	starbase_activity: number;
	uid: number;
}

export interface FleetSquadDTO {
	chatchannels: { [key: string]: string };
	created: number;
	cursize: number;
	description: string;
	enrollment: string;
	event_rank: number;
	id: number;
	maxsize: number;
	motd: string;
	name: string;
	nleader_player_dbid?: string;
	rootguild: number;
	sinsignia?: string;
	slabel: string;
}

export interface FleetStarbaseRoomDTO {
	background: string;
	description: string;
	id: number;
	level: number;
	locked: boolean;
	max_level: number;
	name: string;
	recommended: boolean;
	room_type_id: number;
	short_description: string;
	symbol: string;
	upgrade_finish_in: number;
	upgrades: FleetStarbaseRoomUpgradeDTO[];
}

export interface FleetStarbaseRoomUpgradeDTO {
	buffs: FleetStarbaseRoomUpgradeBuffDTO[];
	cost: {
		item_symbol: string;
		points: number;
		quantity: number;
	}[];
	description: string;
	items: {
		flavor: string;
		icon: ImageDataDTO;
		id: number;
		item_sources: any[];
		name: string;
		rarity: number;
		symbol: string;
		type: number;
	}[];
	name: string;
	short_description: string;
	time_to_upgrade: number;
}

export interface FleetStarbaseRoomUpgradeBuffDTO {
	flavor: string;
	icon: ImageDataDTO;
	id: number;
	item_sources: any[];
	name: string;
	rarity: number;
	symbol: string;
	type: number;
}

export interface FleetDTO {
	created: number;
	cursize: number;
	enrollment: string;
	epoch_time?: number;
	id: number;
	maxsize: number;
	nicon_index: number;
	nleader_login: number;
	nleader_player_dbid: number;
	nmin_level: number;
	nstarbase_level: number;
	rank: string;
	rlevel: number;
	sinsignia: string;
	slabel: string;
}
export interface PlayerShuttleAdventureDTO {
	challenge_rating: number;
	completes_in_seconds: number;
	faction_id: number;
	id: number;
	name: string;
	shuttles: PlayerShuttleDTO[];
	symbol: string;
	token_archetype_id: any; // null
	x: number;
	y: number;
}

export interface PlayerShuttleDTO {
	description: string;
	expires_in: number;
	faction_id: number
	id: number;
	is_rental: boolean;
	name: string;
	rewards: ShuttleRewardDTO[];
	slots: {
		level: any;
		required_trait: any;
		skills: string[];
		trait_bonuses: any;
	}[];
	state: number; // see SHUTTLE_STATE
}

export const SHUTTLE_STATE_OPENED = 0;
export const SHUTTLE_STATE_INPROGRESS = 1;
export const SHUTTLE_STATE_COMPLETE = 2;
export const SHUTTLE_STATE_NAMES : {[i:number]:string} = {
	0: 'Opened',
	1: 'In progress',
	2: 'Complete',
	3: 'Expired',
};
export const SHUTTLE_STATE_NAME_UNKNOWN = 'UNKNOWN';

export interface FactionDTO {
	completed_shuttle_adventures: number;
	discovered: any; // number/bool
	event_winner_rewards: any[];
	home_system: string;
	icon: ImageDataDTO;
	id: number;
	name: string;
	representative_full_body: ImageDataDTO;
	representative_icon: ImageDataDTO;
	reputation: number;
	reputation_icon: ImageDataDTO;
	reputation_item_icon: ImageDataDTO;
	shop_layout: string;
	//These are populated when faction details are refreshed/fetched
	shuttle_mission_rewards?: (PotentialRewardDTO | RewardDTO)[];
	shuttle_token_id: number;
	shuttle_token_preview_item: any;
	//These are populated when faction store details are refreshed/fetched
	storeItems?: FactionStoreItemDTO[];
}

export interface FactionStoreItemDTO {
	cost: { amount: number; currency: string; };
	count: number;
	info: string;
	lock_prereq: any;
	locked: boolean;
	offer: {
		cost: { amount: number; currency: string; };
		currency_bundle: string;
		game_item: RewardDTO;
		obtain: any;
		purchase_avail: number;
		purchase_limit: number;
	};
	symbol: string;
	type: string;
}

export interface ShipDTO {
	accuracy: number;
	actions: any[];
	antimatter: number;
	archetype_id: number;
	attack: number;
	attacks_per_second: number;
	battle_stations: any[];
	crit_bonus: number;
	crit_chance: number;
	evasion: number;
	flavor: string;
	hull: number;
	icon: ImageDataDTO;
	id: number;
	level: number;
	max_level: number;
	model: string;
	name: string;
	rarity: number;
	schematic_gain_cost_next_level: number;
	schematic_icon: ImageDataDTO;
	schematic_id: number;
	shield_regen: number;
	shields: number;
	symbol: string;
	traits: string[];
	traits_hidden: string;

	//Added by app
	traitNames?: string;
}

export interface ShipSchematicDTO {
	cost: number;
	icon: ImageDataDTO;
	id: number;
	rarity: number;

	//HACK: using fields of ship DTO, but some fields are not provided by the schematic version
	ship: ShipDTO;
	// {
	// 	accuracy: number;
	// 	actions: any[];
	// 	antimatter: number;
	// 	archetype_id: number;
	// 	attack: number;
	// 	attacks_per_second: number;
	// 	crit_bonus: number;
	// 	crit_chance: number;
	// 	evasion: number;
	// 	flavor: string;
	// 	hull: number;
	// 	icon: ImageDataDTO;
	// 	max_level: number;
	// 	name: string;
	// 	rarity: number;
	// 	shield_regen: number;
	// 	shields: number;
	// 	symbol: string;
	// 	traits: string[];
	// 	traits_hidden: string;
	// };
}

export interface ItemArchetypeDemandDTO {
	archetype_id: number;
	count: number;
}

export interface ItemArchetypeDTO {
	bonuses?: { [key: number]: number };
	flavor: string;
	icon: ImageDataDTO;
	id: number;
	item_sources: ItemArchetypeSourceDTO[];
	name: string;
	rarity: number;
	recipe?: {
		demands: ItemArchetypeDemandDTO[];
		validity_hash: any;
		jackpot?: {
			reward: RewardDTO[];
			skills: string[]; // array of comma-separated entries
			trait_bonuses: {[trait:string]:number};
		};
	};
	short_name?: string;
	symbol: string;
	type: number;
}

export interface ItemArchetypeSourceDTO {
	challenge_difficulty?: number;
	challenge_id?: number;
	challenge_skill?: string;
	chance_grade: number;
	dispute?: number;
	energy_quotient: number;
	id: number;
	mastery: number;
	mission: number;
	name: string;
	place: string;
	/** See CONFIG.ITEM_ARCHETYPE_SOURCE_TYPE */
	type: number;
}

export interface ItemDTO {
	archetype_id: number;
	expires_in: any; // null
	flavor: string;
	icon: ImageDataDTO;
	id: number;
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	/** See CONFIG.REWARDS_ITEM_TYPE */
	type: number;

	// These fields are found on shuttle/craft bonus items

	/** skill_id is from serverConfig.config.stats_config.stat_desc_by_id */
	bonuses?: {[skill_id:string] : number};
	cr_modifier?: number; // 0
	crafting_bonuses?: { [key: number]: number };
	reward_modifier?: number; // 0
	time_modifier?: number;
}

// Used internaly by the app; not a DTO
export interface ItemData extends ItemDTO {
	cadetable?: string;
	factions: string[];
	//typeName?: string;

	sources: ItemDataSource[]
}

export interface ItemDataSource {
   mission?: MissionData;
   quest?: MissionQuestDTO;
   questMastery?: MissionQuestMasteryLevelDTO;
   cost?: number; // chrons
   chance: number;
   quotient: number;
   title: string;
   /** 'faction' | 'dispute' | 'ship' | 'cadet' */
   type: string;
}

export interface CryoCollectionDTO {
	claimable_milestone_index: number;
	description: string;
	extra_crew: number[];
	id: number;
	image: string;
	milestone: { rewards: any[]; goal: number; buffs: any[]; };
	name: string;
	progress: number;
	traits: string[];
	type_id: number;
}

export interface PlatformConfigDTO {
	crew_exp_trainings: any[];
	faction_config: {
		reputation_buckets: {
			name: string;
			upper_bound?: number;
			status: string;
		}[];
	};
	honorable_citations: any[];
	id: number;
	platform: any;
	replicator_config: {
		currency_costs: { amount: number; currency: number; }[];
		fuel_blacklist: number[];
		fuel_costs: { item_type: number; rarity: number; fuel: number; }[];
		fuel_values: { item_type: number; rarity: number; fuel: number; }[];
		target_blacklist: number[];
	};
	ship_trait_names: { [trait: string]: string };
	trait_names: { [trait: string]: string };
	vip: any;
}

export interface ServerConfigDTO {
	asset_bundle_version: string;
	asset_force_cache_clean: any; // number/bool? came as 0
	asset_server: string;
	conflict: { tired_crew_coefficient: number; untrained_skill_coefficient: number; };
	craft_config: {
		cost_by_rarity_for_component: { currency: number; amount: number; }[];
		cost_by_rarity_for_equipment: { currency: number; amount: number; }[];
		recipe_tree: {
			digest: string;
			recipes: {
				id: number;
				recipe: {
					archetype_id: number;
					count: number;
				}[];
			}[];
		};
		specialist_challenge_rating: number;
		specialist_chance_formula: any;
		specialist_failure_bonus: number;
		specialist_maximum_success_chance: number;
	};
	crew_config: { fusion_cost_by_rarity: any[] };
	custom_event_batch_batch_limit: number;
	custom_event_batch_delay_period: number;
	default_galaxy_map_position: number[];
	default_galaxy_map_zoom: number;
	features_unlock_config: any;
	flag_for_voyage_death: number;
	fusion_costs: any;
	hazard_countdown_max: number;
	hazard_countdown_min: number;
	id: number;
	min_fleet_hours_for_activity: number;
	minimal_crew_count: number;
	performance_profile: any;
	platform: any;
	pvp: any;
	scans: any;
	server_environment: any;
	ship: any;
	shuttle_adventures: {
		secondary_skill_percentage: number; // .25
		//unlisted: shuttle_speedup_formula_v2_dil_cost_1 .. cost_5 // 1, 100, 200, 400, 500
		//unlisted: shuttle_speedup_formula_v2_time_1 .. time_5 // 60, 3600, 10800, 32400, 43200
		sigmoid_midpoint: number; // .5
		sigmoid_steepness: number; // 3.5
		speedup_formula_coefficient_1: number; // -1.604e-8
		speedup_formula_coefficient_2: number; // 0.001873
		speedup_formula_coefficient_3: number; // 18
		speedup_seconds_per_currency_unit: number; // 27
	};
	stats_config: {
		stat_desc_by_id: { [skill_id: string] : {
			symbol: string; // e.g. "engineering_skill_core",
			skill: string; // e.g. "engineering_skill",
			stat: 'core' | 'range_min' | 'range_max';
		}}
	};
	tokens: { id: number; symbol: string; faction_id: number; }[];
	voyage_dying_indicator: number;
	voyages_matched_crew_trait_bonus: number;
	voyages_matched_ship_trait_bonus: number;
	voyages_seconds_per_narrative_event: number;
}

export interface MissionData {
	description: string;
	episode: number;
	episode_title: string;
	id: number;
	quests: MissionQuestDTO[];
	stars_earned: number;
	total_stars: number;
}

export interface MissionDisputeHistoryDTO {
	completed: boolean;
	episode: number;
	exclude_from_timeline?: boolean;
	faction_id: number;
	id: number;
	marker: number[]; // len=2
	mission_ids: number[];
	name: string;
	stars_earned: number;
	symbol: string;
	total_stars: number;

	//Added by app
	quests?: MissionQuestDTO[];
}

export interface MissionCadetScheduleDTO {
	description: string;
	id: number;
	image: ImageDataDTO;
	image_small: ImageDataDTO;
	portrait: ImageDataDTO;
	requirement: string;
	speaker: string;
	title: string;
}

export interface MissionQuestMasteryLevelDTO {
	energy_cost: number;
	id: number;
	jackpots: any[];
	locked: boolean;
	progress: { goal_progress: number; goals: number; };
	rewards: (PotentialRewardDTO | RewardDTO)[]; // first item is PotentialRewardDTO with type=0, second is RewardDTO
}

export interface MissionQuestChallengeDTO {
	children: number[];
	critical: {
		claimed: boolean;
		reward: RewardDTO[];
		standard_loot: PotentialRewardDTO[];
		threshold: number;
	};
	difficulty: number;
	difficulty_by_mastery: number[];
	grid_x: number;
	grid_y: number;
	id: number;
	image: ImageDataDTO;
	locks: any[];
	name: string;
	skill: string;
	trait_bonuses: { trait: string; bonuses: number[] }[];
}

export interface MissionQuestDTO {
	action: string;
	cadet?: boolean;
	challenges?: MissionQuestChallengeDTO[];
	crew_requirement?: {
		description: string;
		max_stars: number;
		min_stars: number;
		traits: string[];
	};
	description: string;
	id: number;
	locked: boolean;
	mastery_levels: MissionQuestMasteryLevelDTO[];
	material_bundle?: string;
	name: string;
	place?: string;
	quest_type: string;
	star_background?: boolean;
	symbol: string;
	timeline_icon: ImageDataDTO;
	unlock_text: string | null;
}

export interface PotentialRewardDTO {
	icon: ImageDataDTO;
	potential_rewards: RewardDTO[];
	quantity: number;
	rarity: number;
	type: number; // =0
}

// Can be used for equality comparison to EventDTO.content.content_type
export const EVENT_TYPES = {
	GATHER: 'gather',
	SHUTTLES: 'shuttles',
	SKIRMISH: 'skirmish',
	EXPEDITION: 'expedition'
}

export interface EventContentGatherDTO {
	content_type: string;//'gather';
	craft_bonus: number;
	crew_bonuses: {
		[crew_symbol: string]: number;
	};
	gather_pools: EventGatherPoolDTO[];
	refresh_cost: { amount: number; currency: number; };
	supports_boosts: boolean;
}

//NOTE: until the skirmish starts, the DTO is empty except for content_type
export interface EventContentSkirmishDTO {
	/** The current battle in the skirmish if one is in progress */
	battle_index: number;
	/** Traits granting minor bonus per battle in the skirmish */
	battle_traits: { traits: string[] }[];
	/** The "primary" event crew symbols, "dukat_breen_crew", "laforge_interfaced_crew", etc. */
	bonus_crew: string[];
	/** trait identifiers for bonus event crew: "laforge", "dukat", "weyoun", etc. */
	bonus_traits: string[];
	configs: {
		normal: any;
		elite: any;
		epic: any;
	};
	content_type: string;//'skirmish';
	currency: {
		currency: string; // 'intel'
		max: number;
		overflow: number;
		rate: number;
		seconds_from_basis: number;
	};
	current_difficulty: string;
	difficulty_lockout: any;
	event_ships: number[];
	exp_hull_repair: number;
	hull: number;
	max_hull: number;
	opponents: {
		normal: any;
		elite: any;
		epic: any;
	};
	progress: string;
	reroll_cost: number;
	reroll_info: string;
	rerolls_available: number;
	start_cost: number;
}

export interface EventContentShuttlesDTO {
	content_type: string;//'shuttles';

	shuttles: EventShuttleDTO[];
}

export interface EventContentExpeditionDTO {
	content_type: string;// 'expedition';
	crew_debuffs: any[];
	description: string;
	has_vote: boolean;
	mission_id: number;
	modifier_per_debuff: number;
	phase_summary?: any; // null
	portrait: { file: string; };
	rules: string;
	speaker: string;
	special_crew: string[];
};

export interface EventDTO {
	bonus_text: string;
	bonus_victory_points?: number;
	content: EventContentGatherDTO & EventContentSkirmishDTO & EventContentShuttlesDTO & EventContentExpeditionDTO
	description: string;
	featured_crew: {
		action: CrewActionDTO;
		flavor: string;
		full_body: ImageDataDTO;
		full_name: string;
		icon: ImageDataDTO;
		id: number;
		name: string;
		portrait: ImageDataDTO;
		quantity: number;
		rarity: number;
		skills: { [sk: string]: SkillDTO; };
		symbol: string;
		traits: string[];
		type: number;
	}[];
	id: number;
	instance_id: number;
	last_threshold_points?: number;
	name: string;
	next_threshold_points?: number;
	next_threshold_rewards?: any[];
	opened?: boolean;
	opened_phase?: number;
	phases: {
		goals: any[];
		id: number;
		seconds_to_end: number;
		splash_image: ImageDataDTO;
	}[];
	ranked_brackets: {
		first: number;
		last: number;
		quantity: number;
		rewards: RewardDTO[];
	}[];
	rewards_teaser: string;
	rules: string;
	seconds_to_end: number;
	seconds_to_start: number;
	shop_layout: string;
	squadron_ranked_brackets: any[];
	status: number;
	threshold_rewards: { points: number; rewards: any[]}[];
	unclaimed_threshold_rewards?: any[];
	victory_points?: number;
}

export interface EventLeaderboardEntryDTO {
	dbid: number;
	display_name: string;
	pid: number;
	avatar?: ImageDataDTO,
	level: number;
	uid: number;
	rank: number;
	score: number;
}

export interface EventLeaderboardDTO {
	action: string;//"ephemeral",
	leaderboard: EventLeaderboardEntryDTO[];
	player_rank: number;
	player_score: number;
}

export interface EventShuttleDTO {
	allow_borrow: boolean;
	crew_bonuses: { [crew_symbol: string]: number; };
	shuttle_mission_rewards: ShuttleRewardDTO[];
	token: number;
}

export interface ShuttleRewardDTO {
	flavor?: string;
	icon: ImageDataDTO;
	id?: number;
	name?: string;
	potential_rewards?: any[];
	quantity: number;
	rarity?: number;
	symbol?: string;
	type: number; // == 0 (rewards), 11 (VP), 12 (faction rep)
}

export interface EventGatherPoolAdventureDTO {
	demands: { archetype_id: number; count: number; }[];
	description: string;
	golden_octopus: boolean;
	id: number;
	name: string;
}

export interface EventGatherPoolDTO {
	adventures: EventGatherPoolAdventureDTO[];
	goal_index: number;
	golden_octopus_rewards: {
		faction_id: number;
		flavor: string;
		icon: ImageDataDTO;
		name: string;
		quantity: number;
		symbol: string;
		type: number;
	}[];
	id: number;
	rewards: {
		faction_id: number;
		flavor: string;
		icon: ImageDataDTO;
		name: string;
		quantity: number;
		symbol: string;
		type: number;
	}[];
}

export interface DatacoreCrewDTO {
	action: any;
	archetype_id: number;
	base_skills: { [skill: string]: SkillDTO; };
	bigbook_tier: number;
	collections: string[]; // collection title, not id
	craftCost: number;
	events: number;
	factionOnlyTotal: number;
	imageUrlPortrait: string;
	in_portal: boolean;
	markdownContent: string;
	max_rarity: number;
	name: string;
	ranks: {
		[key:string]: number;
		chronCostRank: number;
		voyRank: number;
		gauntletRank: number;
		// Contains base ranks as 'B_sk' (ex 'B_CMD')
		// Contains gauntlet pairing ranks as 'G_sk1_sk2' (ex 'G_CMD_DIP')
		// Contains voyage pairing ranks as 'V_sk1_sk2' (ex 'G_CMD_DIP')
		// Contains 'A' ranks as 'B_sk' (ex 'B_CMD') (not sure what these are for)
	};
	ship_battle: any;
	short_name: string;
	// max skill values by rarity
	skill_data: {
		rarity: number;
		base_skills: { [skill: string]: SkillDTO }
	}[];
	symbol: string;
	totalChronCost: number;
	traits: string[];
	traits_hidden: string[];
	traits_named: string[];
}
