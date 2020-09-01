import STTApi from "./index";
import CONFIG from "./CONFIG";
import { buildCrewData, buildCrewDataAllFromDatacore } from '../components/crew/CrewTools';
import { matchShips } from './ShipTools';
import { loadMissionData } from './MissionTools';
import { loadFullTree, fixupAllCrewIds, buildItemData } from './EquipmentTools';
import { refreshAllFactions, loadFactionStore } from '../components/factions/FactionTools';
import { calculateMissionCrewSuccess, calculateMinimalComplementAsync } from './MissionCrewSuccess';
import { PotentialRewardDTO, RewardDTO } from "./DTO";

export async function loginSequence(onProgress: (description: string, subDesc?: string) => void) {
	let mainResources = [
		{
			loader: STTApi.loadCrewArchetypes.bind(STTApi),
			description: 'crew information'
		},
		{
			loader: STTApi.loadServerConfig.bind(STTApi),
			description: 'server configuration'
		},
		{
			loader: STTApi.loadPlatformConfig.bind(STTApi),
			description: 'platform configuration'
		},
		{
			loader: STTApi.loadShipSchematics.bind(STTApi),
			description: 'ship information'
		},
		{
			loader: STTApi.loadDatacore.bind(STTApi),
			description: 'datacore'
		},
		{
			loader: STTApi.loadEventBorrowableCrew.bind(STTApi),
			description: 'borrowable crew'
		},
		{
			loader: STTApi.loadPlayerData.bind(STTApi),
			description: 'player data'
		}
	];

	let fleetResources = [
		{
			loader: STTApi.loadFleetMemberInfo.bind(STTApi),
			description: 'fleet members'
		},
		{
			loader: STTApi.loadFleetData.bind(STTApi),
			description: 'fleet data'
		},
		{
			loader: STTApi.loadStarbaseData.bind(STTApi),
			description: 'starbase data'
		}
	];


	onProgress('Loading Main Resources...');
	let mainPromises: Array<Promise<void>> = mainResources.map(res => {
		console.log(` - Processing ${res.description}`);
		return res.loader();
	});
	await Promise.all(mainPromises);

	if (STTApi.playerData.fleet && STTApi.playerData.fleet.id != 0) {
		onProgress('Loading Fleet Resources...');
		let fleetPromises: Array<Promise<void>> = fleetResources.map(res => {
			console.log(` - Processing ${res.description}`);
			return res.loader(STTApi.playerData.fleet.id);
		});
		await Promise.all(fleetPromises);
	}

	onProgress('Loading Missions and Quests...');
	// Filter out missions in a bad state
	STTApi.playerData.character.accepted_missions = STTApi.playerData.character.accepted_missions
		.filter(mission => mission.main_story);
	let ms = [...STTApi.playerData.character.cadet_schedule.missions,
			  ...STTApi.playerData.character.accepted_missions];
	let missions = await loadMissionData(ms, STTApi.playerData.character.dispute_histories);
	STTApi.missions = missions;

	onProgress('Analyzing Crew...');
	STTApi.roster = await buildCrewData(STTApi.playerData.character);

	onProgress('Calculating Mission Success', 'Stats for Crew...');
	STTApi.missionSuccess = calculateMissionCrewSuccess();
	calculateMinimalComplementAsync();

	const updateProgress = async (label: string, key: string, promise: Promise<void>) => {
		if (!key) {
			onProgress(label);
		} else {
			onProgress(label, `(${key})`);
		}
		await promise.catch((error: any) => { /*console.warn(error);*/ });
	};

	onProgress('Loading Crew Images...');
	// This will cache crew images without notifying or blocking the UI. Since the entire crew is needed
	// on certain pages (crew page, voyage select, gauntlet select, shuttles), lazy loading individual
	// crew takes a big hit the first time.
	// Load the entire roster first (including frozen crew) in case 'allcrew' didn't load
	STTApi.roster.forEach(c => {
		STTApi.imgUrl(c.portrait, undefined);
		STTApi.imgUrl(c.icon, undefined);
		STTApi.imgUrl(c.full_body, undefined);
	});
	STTApi.allcrew.forEach(c => {
		STTApi.imgUrl(c.portrait, undefined);
		STTApi.imgUrl(c.icon, undefined);
		STTApi.imgUrl(c.full_body, undefined);
	});

	onProgress('Loading Ships...');
	STTApi.ships = await matchShips(STTApi.playerData.character.ships);
	STTApi.ships.forEach(s => {
		STTApi.imgUrl(s.icon, undefined);
	})

	onProgress('Loading Faction Rewards...');
	await refreshAllFactions();

	onProgress('Loading Equipment and Components...');
	// Don't pre-cache items; they load quickly and aren't in full table listings
	// STTApi.itemArchetypeCache.archetypes.forEach(item => {
	// 	STTApi.imgUrl(item.icon, undefined);
	// })
	STTApi.items = buildItemData(STTApi.playerData.character.items);

	onProgress('Loading Faction and Faction Store Images...');
	for (let faction of STTApi.playerData.character.factions) {
		await updateProgress('', '', loadFactionStore(faction));
	}

	onProgress('Compiling Crew Data...');
	try {
		STTApi.allcrew = buildCrewDataAllFromDatacore(STTApi.datacore ?? []);
	}
	catch (e) {
		console.error(e);
		STTApi.allcrew = [];
	}

	onProgress('Loading Equipment...');
	if (STTApi.inWebMode) {
		// In web mode we already augmented the itemarchetypes with whatever we had cached, just try to fix stuff up here
		fixupAllCrewIds();
	} else {
		await loadFullTree(onProgress, false);
	}

	onProgress('Loading Sprites...');
	for (let sprite in CONFIG.SPRITES) {
		CONFIG.SPRITES[sprite].url = STTApi.imageProvider.getSpriteCached(CONFIG.SPRITES[sprite].asset, sprite);
		if (CONFIG.SPRITES[sprite].url === '') {
			await updateProgress('', sprite,
				STTApi.imageProvider.getSprite(CONFIG.SPRITES[sprite].asset, sprite, sprite)
					.then(found => { CONFIG.SPRITES[found.id].url = found.url; }));
		}
	}
}
