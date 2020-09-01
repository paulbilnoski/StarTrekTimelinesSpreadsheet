import STTApi from "../../api/index";
import CONFIG from "../../api/CONFIG";
import { CrewAvatarDTO, CrewData, CrewDTO, PlayerCharacterDTO, SkillData, CrewActionDTO, CrewEquipmentSlotData, DatacoreCrewDTO } from '../../api/DTO'

export interface BuffStat {
	multiplier: number;
	percent_increase: number;
};

export function calculateBuffConfig(): { [index: string]: BuffStat } {
	const skills = Object.keys(CONFIG.SKILLS);
	const buffs = ['core', 'range_min', 'range_max'];

	const buffConfig: { [index: string]: BuffStat } = {};

	for(let skill of skills) {
		for(let buff of buffs) {
			buffConfig[`${skill}_${buff}`] = {
				multiplier: 1,
				percent_increase: 0
			};
		}
	}

	for(let buff of STTApi.playerData.character.crew_collection_buffs.concat(STTApi.playerData.character.starbase_buffs)) {
		if (buffConfig[buff.stat]) {
			if (buff.operator === 'percent_increase') {
				buffConfig[buff.stat].percent_increase += buff.value;
			} else if (buff.operator === "multiplier") {
				buffConfig[buff.stat].multiplier = buff.value;
			} else {
				console.warn(`Unknown buff operator '${buff.operator }' for '${buff.stat}'.`);
			}
		}
	}

	return buffConfig;
}

/**
 * This is the place where a crew DTO is converted to a CrewData and per-crew computations and caching are performed
 */
function crewToRoster(dto: CrewDTO) : CrewData {
	let voyage_score = 0;
	let gauntlet_score = 0;
	let skillData : {[sk: string] : SkillData } = {};
	for (let skill in CONFIG.SKILLS) {
		let sdto = dto.skills[skill];
		if (!sdto) {
			sdto = {
				core: 0,
				range_min: 0,
				range_max: 0
			};
		}
		let profAvg = (sdto.range_max + sdto.range_min) / 2;
		let sd: SkillData = {
			core: sdto.core,
			min: sdto.range_min,
			max: sdto.range_max,
			voy: sdto.core + profAvg
		};
		skillData[skill] = sd;
		voyage_score += skillData[skill].voy || 0;
		gauntlet_score += profAvg;
	}

	let equipment_slots : CrewEquipmentSlotData[] = (dto.equipment_slots ?? []) as CrewEquipmentSlotData[];

	equipment_slots.forEach((equipment) => {
		equipment.have = false;
	});

	(dto.equipment ?? []).forEach(equipment => {
		equipment_slots.filter(es => es.archetype === equipment[1]).forEach(es => es.have = true);
	});

	let traitSet : Set<string> = new Set();
	dto.traits.forEach(t => traitSet.add(t));
	dto.traits_hidden.forEach(th => traitSet.add(th));
	let ts : string[] = [];
	traitSet.forEach(t => ts.push(t))

	let traits = ts.map((trait) => STTApi.getTraitName(trait)).join();
	let rawTraits = ts;

	// Replace "nonhuman" with "alien" to make the search easier
	let nh = rawTraits.indexOf('nonhuman');
	if (nh > -1) {
		rawTraits.splice(nh, 1, 'alien');
	}

	// Add datacore "big book" details
	let datacore = STTApi.datacore.find(c => c.symbol === dto.symbol);

	return {
		id: dto.archetype_id,
		avatar_id: dto.archetype_id,
		crew_id: dto.id,
		symbol: dto.symbol,
		name: dto.name,
		short_name: dto.short_name,
		portrait: dto.portrait,
		full_body: dto.full_body,
		icon: dto.icon,

		buyback: dto.in_buy_back_state,
		frozen: 0,
		isExternal: false,
		expires_in: dto.expires_in,
		status: {
			frozen: 0,
			buyback: dto.in_buy_back_state,
			expires_in: dto.expires_in,
			active: !dto.in_buy_back_state,
			external: false,
			fe: equipment_slots.length > 0 && equipment_slots.every(eq => eq.have)
		},

		rarity: dto.rarity,
		max_rarity: dto.max_rarity,
		level: dto.level,
		max_level: dto.max_level,
		favorite: dto.favorite,
		flavor: dto.flavor,
		active_id: dto.active_id,
		active_index: dto.active_index,
		active_status: dto.active_status,
		action: dto.action,
		ship_battle: dto.ship_battle,

		traits,
		rawTraits,
		equipment_slots,
		skills: skillData,

		voyage_score,
		gauntlet_score,
		usage_value: 0,
		datacore
	};
}

function createFakeCrewId() : number {
	let val = Math.random() * 100_000 + 2_000_000_000;
	return Math.round(val);
}

export function buildCrewDataAllFromDatacore(allcrew: DatacoreCrewDTO[]) : CrewData[] {
	const mapped = allcrew.map(dc => {
		let crew : CrewDTO = {
			archetype_id: dc.archetype_id,
			base_skills: dc.base_skills,
			favorite: false,
			full_body: { file: dc.imageUrlPortrait },
			icon: { file: dc.imageUrlPortrait },
			level: 100,
			max_level: 100,
			max_rarity: dc.max_rarity,
			name: dc.name,
			portrait: { file: dc.imageUrlPortrait },
			rarity: dc.max_rarity,
			short_name: dc.short_name,
			skills: dc.base_skills,
			symbol: dc.symbol,
			traits: dc.traits_named,
			traits_hidden: dc.traits_hidden
		} as CrewDTO;

		return crew;
	});

	let crewdata = buildCrewDataAll(mapped);
	crewdata.forEach(c => c.status.external = true);
	return crewdata;
}

export function buildCrewDataAll(allcrew: CrewDTO[]): CrewData[] {
	let rosterAll: CrewData[] = [];
	let dupeChecker = new Set<string>();
	allcrew.forEach((crew: CrewDTO) => {
		// Sometimes duplicates can sneak into our allcrew list, filter them out, but keep
		// if at a different level or rarity
		let key = crew.symbol + '.' + crew.level + '.' + crew.rarity;
		if (dupeChecker.has(key)) {
			return;
		}

		dupeChecker.add(key);

		let avatar = STTApi.getCrewAvatarBySymbol(crew.symbol);
		if (!avatar) {
			// frozen and datacore entries evolve but the cached mock data does not, so skip this error
			if (!STTApi.mockData) {
				console.error(`Could not find the crew avatar for (all crew entry) ${crew.symbol} archetype_id ${crew.archetype_id}`);
			}
			return;
		}
		STTApi.applyBuffConfig(crew);
		let rosterEntry = crewToRoster(crew);
		do {
			// external crew don't have a unique id, so supply one; sometimes they collide, so pick multiple times
			rosterEntry.crew_id = createFakeCrewId();
		} while (rosterAll.find(r => r.crew_id === rosterEntry.crew_id));
		rosterEntry.isExternal = true;
		rosterEntry.status.external = true;

		rosterEntry.archetypes = crew.archetypes;

		rosterAll.push(rosterEntry);
	});

	return rosterAll;
}

// Build CrewData[] from player.character CrewDTO[] and frozen immortal data
export async function buildCrewData(character: PlayerCharacterDTO): Promise<CrewData[]> {
	let roster: CrewData[] = [];

	// Add all the crew in the active roster
	character.crew.forEach((crew) => {
		const avatar = STTApi.getCrewAvatarById(crew.archetype_id);
		if (!avatar) {
			console.error(`Could not find the crew avatar for archetype_id ${crew.archetype_id}`);
			return;
		}

		let rosterEntry = crewToRoster(crew);
		roster.push(rosterEntry);
	});

	// Now add all the frozen crew
	if (character.stored_immortals && character.stored_immortals.length > 0) {
		// Use the cache wherever possible
		// TODO: does DB ever change the stats of crew? If yes, we may need to ocasionally clear the cache - perhaps based on record's age
		let frozenPromises: Promise<CrewData>[] = [];

		// to prevent frozen crew ids from colliding, precompute the required number and pass
		// one in to each invocation of loadFrozen
		let uids : number[] = [];
		while (uids.length < character.stored_immortals.length) {
			let uid = createFakeCrewId();
			if (!uids.includes(uid))
				uids.push(uid);
		}

		character.stored_immortals.forEach((imm) => {
			const avatar = STTApi.getCrewAvatarById(imm.id);
			if (!avatar) {
				console.error(`Could not find the crew avatar for frozen archetype_id ${imm.id}`);
				return;
			}
			//let rosterEntry = getDefaultsInner(avatar);
			//roster.push(rosterEntry);

			frozenPromises.push(loadFrozen(avatar.symbol, imm.quantity, uids.pop()!));
		});

		await Promise.all(frozenPromises).then(datas => roster.splice(roster.length, 0, ...datas));
	}

	// collects usage_value field for the given skill over the entire roster
	function collect(skillField: string, extField: string, max:number):void {
		let filtered = roster.filter(c => !c.buyback);
		if (extField) {
			filtered = filtered.filter((c) => c.skills[skillField][extField] > 0)
				.sort((a, b) => b.skills[skillField][extField] - a.skills[skillField][extField]);
		}
		else {
			filtered = filtered.filter((c: any) => c[skillField] > 0)
				.sort((a: any, b: any) => b[skillField] - a[skillField]);
		}
		for (let i = 0; i < max && i < filtered.length; ++i) {
			// allow frozen items to be exported but not count towards top-10
			let c = filtered[i];
			if (c.frozen > 0)
				++max;
			let value = c.usage_value;
			if (c.usage_value === undefined) {
				c.usage_value = 1;
			}
			else {
				c.usage_value++;
			}
		}
	}

	for (let sk in CONFIG.SKILLS) {
		collect(sk, 'core', 6);
		collect(sk, 'max', 3);
		collect(sk, 'voy', 9);
	}
	collect('voyage_score', '', 9);
	collect('gauntlet_score', '', 9);

	return roster;
}

async function loadFrozen(crewSymbol: string, frozenCount: number, uid: number): Promise<CrewData> {
	let crew : CrewDTO | undefined = undefined;
	let entry = await STTApi.immortals.where('symbol').equals(crewSymbol).first();
	if (entry) {
		//console.info('Found ' + crewSymbol + ' in the immortalized crew cache');
		STTApi.applyBuffConfig(entry.crew);
		crew = entry.crew;
	} else {
		crew = await STTApi.loadFrozenCrewData(crewSymbol);

		// We don't need to await, as this is just populating a cache and can be done whenever
		STTApi.immortals.put({
			symbol: crewSymbol,
			crew: crew
		});
	}

	let roster = crewToRoster(crew);
	// frozen crew don't have a unique id, so supply one
	roster.crew_id = uid;

	roster.frozen = frozenCount;
	roster.status.frozen = frozenCount;
	roster.status.active = false;
	roster.status.buyback = false;
	roster.level = 100;
	roster.rarity = roster.max_rarity;

	return roster;
}

export function formatCrewStatsVoy(crew: CrewData): string {
	let result = '';
	for (let skillName in CONFIG.SKILLS) {
		let skill = crew.skills[skillName];

		if (skill && skill.voy && (skill.voy > 0)) {
			result += `${CONFIG.SKILLS_SHORT[skillName]} (${Math.floor(skill.voy)}) `;
		}
	}
	return result;
}
