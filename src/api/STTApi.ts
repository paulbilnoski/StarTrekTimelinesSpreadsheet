/*
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { NetworkFetch } from './NetworkFetch';
import { DexieCache, QuestsTable, EquipmentTable, ImmortalsDB, ConfigTable, WikiImageTable } from './Cache';
import { IChallengeSuccess } from './MissionCrewSuccess';
import { buildCrewData, calculateBuffConfig, BuffStat } from '../components/crew/CrewTools';
import { MinimalComplement } from './MinimalComplement';
import { mergeDeep } from './ObjectMerge';
import { ImageProvider, ImageCache } from '../components/images/ImageProvider';
import { ServerImageProvider } from '../components/images/ServerImageProvider';
import { FileImageCache } from '../components/images/FileImageCache';
import { ImageProviderChain, WikiImageProvider } from '../components/images/WikiImageTools';
import { AssetImageProvider } from '../components/images/AssetImageProvider';
import { NeededEquipmentClass, EquipNeedFilter, UnparsedEquipment, EquipNeed } from './EquipmentTools';
import Dexie from 'dexie';
import CONFIG from './CONFIG';
import Moment from 'moment';
import { PlayerDTO, ItemArchetypeDTO, PlatformConfigDTO, CrewAvatarDTO, ServerConfigDTO, ShipSchematicDTO,
	CrewData, ShipDTO, MissionData, CrewDTO, SkillDTO, FleetSquadDTO, FleetMemberDTO, FleetStarbaseRoomDTO,
	ItemData, PlayerResponseDTO, PlayerShuttleAdventureDTO, DatacoreCrewDTO, PlayerInspectDTO,
	EventLeaderboardDTO, BorrowedCrewDTO, ImageDataDTO } from './DTO';
// #!if ENV === 'electron'
import fs from 'fs';
import { getAppPath } from '../utils/pal';
// #!endif

export class STTApiClass {
	private _accessToken: string | undefined;
	// Change this to use mock data - JSON data from previously captured responses, edited as necessary to coerce particular behavior
	private _usemock: boolean = false;
	private mockPath: string = '~/DatacorePADD/mock/';//getAppPath() + '/mock/'; // NOTE: needs trailing path separator
	private _net: NetworkFetch;
	private _playerData?: PlayerResponseDTO;
	private _starbaseData: {
		starbase_rooms: FleetStarbaseRoomDTO[];
		core?: {
			acceleration_cost: number;
			acceleration_rate: number;
			donation_limit: number;
			donation_reset_cost: { amount: number; currency: number; };
			donations_today: number;
			fleet_items: any[];
			id: number;
			reclamator_rooms: string[];
			symbol: string;
		}
	};
	private _fleetMemberInfo: {
		members: FleetMemberDTO[];
		squads: FleetSquadDTO[];
	};
	private _cache: DexieCache;
	private _buffConfig: { [index: string]: BuffStat };
	private _neededEquipment: NeededEquipmentClass;

	public platformConfig?: { config: PlatformConfigDTO; };
	public crewAvatars: CrewAvatarDTO[];
	public serverConfig?: { config: ServerConfigDTO; };;
	public shipSchematics: ShipSchematicDTO[];
	public fleetData?: {
		chatchannels: {[key:string]: string};
		created: number;
		cursize: number;
		description: string;
		enrollment: string;
		id: number;
		maxsize: number;
		motd: string;
		name: string;
		nicon_index: number;
		nleader_login: number;
		nleader_player_dbid: number;
		nmin_level: number;
		nstarbase_level: number;
		rlevel: number;
		sinsignia: string;
		slabel: string;
	};
	public roster: CrewData[];
	public items: ItemData[];
	public ships: ShipDTO[];
	public missions: MissionData[];
	public missionSuccess!: IChallengeSuccess[];
	public minimalComplement?: MinimalComplement;
	public imageProvider!: ImageProvider;
	private imageUrlCache : {[path: string]:string};
	// map lookup should be faster than array search lookup
	private imageUrlCachePending : {[path: string]: boolean};

	public inWebMode: boolean;
	public allcrew!: CrewData[];
	public datacore!: DatacoreCrewDTO[];
	public borrowableCrew!: BorrowedCrewDTO[];

	public serverAddress: string = 'http://localhost/';
	private datacoreAddress: string = 'https://datacore.app/structured/botcrew.json';

	// Used with Moment when adding an offset. Does not need to be used when
	// doing a fresh request for data such as for gauntlet or voyage status
	public lastSync: Moment.Moment = Moment();
	public lastSyncVoyage: Moment.Moment = Moment();
	public lastSyncGauntlet: Moment.Moment = Moment();

	constructor() {
		this.refreshEverything(true);
		this._net = new NetworkFetch();
		this._neededEquipment = new NeededEquipmentClass();

		// TODO: Dexie uses IndexedDB, so doesn't work in plain node.js without polyfill - should the caching be an interface?
		this._cache = new DexieCache('sttcache');

		this.inWebMode = false;
		this._buffConfig = {};
		this.allcrew = [];
		this.imageUrlCache = {};
		this.imageUrlCachePending = {};
	}

	setWebMode(webMode: boolean, keepServerAddress: boolean) {
		this.inWebMode = webMode;

		if (this.inWebMode) {
			// In web mode, we don't hardcode the server, but simply load from the domain root
			if (!keepServerAddress) {
				this.serverAddress = '/';

				//TODO: get datacore to load for web app
				// #!if ENV === 'electron'
				//addr = "file:/?/DatacorePADD/src/utils/" + 'allcrew.json';
				// #!else
				//addr = this.serverAddress + 'allcrew.json';
				// #!endif

				//this.datacoreAddress = '/botcrew.json';
			}

			this._net.setProxy(this.serverAddress + 'proxy');
			this.imageProvider = new ServerImageProvider(this.serverAddress);
		}
		else {
			let cache : ImageCache = new FileImageCache();
			this.imageProvider = new ImageProviderChain(cache, new AssetImageProvider(cache), new WikiImageProvider(cache));
		}
	}

	async refreshEverything(logout: boolean) {
		this.crewAvatars = [];
		this.serverConfig = undefined;
		this._playerData = undefined;
		this.platformConfig = undefined;
		this.shipSchematics = [];
		this._starbaseData = { starbase_rooms: [], core: undefined };
		this.fleetData = undefined;
		this._fleetMemberInfo = { members: [], squads: [] };
		this.roster = [];
		this.borrowableCrew = [];
		this.items = [];
		this.ships = [];
		this.missions = [];
		this.missionSuccess = [];
		this.minimalComplement = undefined;

		if (logout) {
			this._accessToken = undefined;

			if (this._cache) {
				await this._cache.config
					.where('key')
					.equals('autoLogin')
					.delete();
				await this._cache.config
					.where('key')
					.equals('accessToken')
					.delete();
			}
		}
	}

	get networkHelper(): NetworkFetch {
		return this._net;
	}

	get quests(): Dexie.Table<QuestsTable, number> {
		return this._cache.quests;
	}

	get equipmentCache(): Dexie.Table<EquipmentTable, string> {
		return this._cache.equipment;
	}

	get immortals(): Dexie.Table<ImmortalsDB, string> {
		return this._cache.immortals;
	}

	get wikiImages(): Dexie.Table<WikiImageTable, string> {
		return this._cache.wikiImages;
	}

	get config(): Dexie.Table<ConfigTable, string> {
		return this._cache.config;
	}

	get loggedIn(): boolean {
		return this._accessToken != null;
	}

	get mockData(): boolean {
		return this._usemock;
	}

	get playerData(): PlayerDTO {
		return this._playerData!.player!;
	}

	get itemArchetypeCache(): { archetypes: ItemArchetypeDTO[]; } {
		return this._playerData!.item_archetype_cache;
	}

	get fleetMembers(): FleetMemberDTO[] {
		return this._fleetMemberInfo.members;
	}

	get fleetSquads(): FleetSquadDTO[] {
		return this._fleetMemberInfo.squads;
	}

	get starbaseRooms(): FleetStarbaseRoomDTO[] {
		return this._starbaseData.starbase_rooms;
	}

	get starbaseDonationsRemaining(): number {
		if (!this._starbaseData.core) {
			return 0;
		}
		return this._starbaseData.core.donation_limit - this._starbaseData.core.donations_today;
	}

	getTraitName(trait: string): string {
		return this.platformConfig!.config.trait_names[trait] ? this.platformConfig!.config.trait_names[trait] : trait;
	}

	getShipTraitName(trait: string): string {
		return this.platformConfig!.config.ship_trait_names[trait] ? this.platformConfig!.config.ship_trait_names[trait] : trait;
	}

	getCrewAvatarById(avatarId: number): CrewAvatarDTO | undefined {
		return this.crewAvatars.find(avatar => avatar.id === avatarId);
	}

	getCrewAvatarBySymbol(symbol: string): CrewAvatarDTO | undefined {
		return this.crewAvatars.find(avatar => avatar.symbol === symbol);
	}

	async login(username: string, password: string, autoLogin: boolean): Promise<any> {
		let data = await this._net.post_proxy(CONFIG.URL_PLATFORM + 'oauth2/token', {
			username: username,
			password: password,
			client_id: CONFIG.CLIENT_ID,
			grant_type: 'password'
		});

		if (data.error_description) {
			throw new Error(data.error_description);
		} else if (data.access_token) {
			return this._loginWithAccessToken(data.access_token, autoLogin);
		} else {
			throw new Error('Invalid data for login!');
		}
	}

	async loginWithCachedAccessToken(): Promise<boolean> {
		// if (this._usemock) {
		// 	console.log('Using mock data!');
		// 	return true;
		// }
		let entry = await this._cache.config
			.where('key')
			.equals('autoLogin')
			.first();
		//if (true) return false;
		if (entry && entry.value === true) {
			entry = await this._cache.config
				.where('key')
				.equals('accessToken')
				.first();
			if (entry && entry.value) {
				this._accessToken = entry.value;
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	private async _loginWithAccessToken(access_token: string, autoLogin: boolean): Promise<void> {
		this._accessToken = access_token;

		/*await*/ this._cache.config.put({
			key: 'autoLogin',
			value: autoLogin
		});

		if (autoLogin) {
			/*await*/ this._cache.config.put({
				key: 'accessToken',
				value: access_token
			});
		}
	}

	async loginWithFacebook(facebookAccessToken: string, facebookUserId: string, autoLogin: boolean): Promise<any> {
		let data = await this._net.post_proxy(CONFIG.URL_PLATFORM + 'oauth2/token', {
			'third_party.third_party': 'facebook',
			'third_party.access_token': facebookAccessToken,
			'third_party.uid': facebookUserId,
			client_id: CONFIG.CLIENT_ID,
			grant_type: 'third_party'
		});

		if (data.error_description) {
			throw new Error(data.error_description);
		} else if (data.access_token) {
			return this._loginWithAccessToken(data.access_token, autoLogin);
		} else {
			throw new Error('Invalid data for login!');
		}
	}

	getMockData(url: string): any {
		// #!if ENV === 'electron'
		const path = this.mockPath;

		if (!fs.existsSync(path)) {
			console.log("Cannot mock; no files found");
		}
		else {
			const dirEntries: string[] = fs.readdirSync(path);
			const fn = url.replace(/\//g, '.') + '.json';
			if (dirEntries.includes(fn)) {
				try {
					const fileData = fs.readFileSync(path + fn, { encoding: 'utf8' });
					console.log('loaded mock for '+url);
					return JSON.parse(fileData);
				}
				catch (err) {
					console.log(err);
				}
			}
			else {
				console.log('no mock found for '+url);
			}
		}
		// #!endif
		return undefined;
	}

	async executeGetRequest(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}
		if (this._usemock) {
			const rv = this.getMockData(resourceUrl);
			if (rv) {
				return rv;
			}
		}

		return this._net.get_proxy(
			CONFIG.URL_SERVER + resourceUrl,
			Object.assign({ client_api: CONFIG.CLIENT_API_VERSION, access_token: this._accessToken }, qs)
		);
	}

	async executeGetRequestRaw(resourceUrl: string, absoluteUrl: string, qs: any = {}, json: boolean): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}
		if (this._usemock) {
			const rv = this.getMockData(resourceUrl);
			if (rv) {
				return rv;
			}
		}

		return this._net.get_proxy(absoluteUrl, qs, json);
	}

	async executeGetRequestWithUpdates(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}
		if (this._usemock) {
			const rv = this.getMockData(resourceUrl);
			if (rv) {
				this.applyUpdates(rv);
				return rv;
			}
		}

		return this._net
			.get_proxy(
				CONFIG.URL_SERVER + resourceUrl,
				Object.assign({ client_api: CONFIG.CLIENT_API_VERSION, access_token: this._accessToken }, qs)
			)
			.then((data: any) => this.applyUpdates(data));
	}

	async executePostRequest(resourceUrl: string, qs: any): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}
		if (this._usemock) {
			const rv = this.getMockData(resourceUrl);
			if (rv) {
				return rv;
			}
		}

		return this._net.post_proxy(
			CONFIG.URL_SERVER + resourceUrl,
			Object.assign({ client_api: CONFIG.CLIENT_API_VERSION }, qs),
			this._accessToken
		);
	}

	async executePostRequestWithUpdates(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}
		if (this._usemock) {
			const rv = this.getMockData(resourceUrl);
			if (rv) {
				this.applyUpdates(rv);
				return rv;
			}
		}

		return this._net
			.post_proxy(CONFIG.URL_SERVER + resourceUrl, Object.assign({ client_api: CONFIG.CLIENT_API_VERSION }, qs), this._accessToken)
			.then((data: any) => this.applyUpdates(data));
	}

	async loadServerConfig(): Promise<void> {
		let data = await this.executeGetRequest('config', {
			platform: 'WebGLPlayer',
			device_type: 'Desktop',
			client_version: CONFIG.CLIENT_VERSION,
			platform_folder: CONFIG.CLIENT_PLATFORM
		});

		// Get asset bundle version from new location
		const url = `${CONFIG.URL_CDN}${data.config.server_environment.environment}/${CONFIG.CLIENT_PLATFORM}_${CONFIG.CLIENT_VERSION}.txt`;
		let bundle_version = await this.executeGetRequestRaw('asset_bundle_version.txt', url, null, false);
		data.config.asset_bundle_version = bundle_version;

		this.serverConfig = data;
	}

	async loadCrewArchetypes(): Promise<void> {
		let data = await this.executeGetRequest('character/get_avatar_crew_archetypes');
		if (data.crew_avatars) {
			this.crewAvatars = data.crew_avatars as CrewAvatarDTO[];
		} else {
			throw new Error('Invalid data for crew avatars!');
		}
	}

	async loadPlatformConfig(): Promise<void> {
		let data = await this.executeGetRequest('config/platform');
		this.platformConfig = data;
	}

	async loadPlayerData(): Promise<void> {
		let data : PlayerResponseDTO = await this.executeGetRequest('player');
		if (data.player) {
			this._playerData = data;

			this.lastSync = Moment();

			// After loading player data, we can calculate the buff config for collections and starbase
			this._buffConfig = calculateBuffConfig();
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async resyncPlayerCurrencyData(): Promise<void> {
		// this code reloads minimal stuff to update the player information and merge things back in
		let data = await this.executeGetRequest('player/resync_currency');
		if (data.player) {
			this._playerData!.player = mergeDeep(this._playerData!.player, data.player);
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async resyncInventory(): Promise<void> {
		await this.executeGetRequestWithUpdates('player/resync_inventory');
	}

	async loadShipSchematics(): Promise<void> {
		let data = await this.executeGetRequest('ship_schematic');
		if (data.schematics) {
			this.shipSchematics = data.schematics;
		} else {
			throw new Error('Invalid data for ship schematics!');
		}
	}

	async loadFrozenCrewData(symbol: string): Promise<CrewDTO> {
		let data = await this.executePostRequest('stasis_vault/immortal_restore_info', { symbol: symbol });
		if (data.crew) {
			return data.crew as CrewDTO;
		} else {
			throw new Error('Invalid data for frozen crew!');
		}
	}

	// async sellCrew(id: number): Promise<any> {
	// 	return this.executePostRequestWithUpdates('crew/sell', { id: id });
	// }

	async sellManyCrew(ids: number[]): Promise<any> {
		return this.executePostRequestWithUpdates('crew/sell_many', { ids: ids });
	}

	async warpQuest(id: number, mastery_level: number, factor: number): Promise<any> {
		let data = await this.executeGetRequest('quest/warp', { id, mastery_level, factor });
		if (data) {
			return this.applyUpdates(data);
		} else {
			throw new Error('Invalid data for quest warp!');
		}
	}

	async loadFleetMemberInfo(guildId: string | number): Promise<void> {
		let data = await this.executePostRequest('fleet/complete_member_info', { guild_id: guildId });
		if (data) {
			this._fleetMemberInfo = data;
		} else {
			throw new Error('Invalid data for fleet member info!');
		}
	}

	async loadFleetData(guildId: string | number): Promise<void> {
		let data = await this.executeGetRequest('fleet/' + guildId);
		if (data.fleet) {
			this.fleetData = data.fleet;
		} else {
			throw new Error('Invalid data for fleet!');
		}
	}

	async loadStarbaseData(guildId: string | number): Promise<void> {
		let data = await this.executeGetRequest('starbase/get');
		if (data) {
			if (Array.isArray(data) && data[0] && data[0].character) {
				if (data[0].character.starbase_rooms) {
					this._starbaseData.starbase_rooms = data[0].character.starbase_rooms;
				}
				if (Array.isArray(data[0].character.starbase) && data[0].character.starbase[0]) {
					this._starbaseData.core = data[0].character.starbase[0];
				}
			}
		} else {
			throw new Error('Invalid data for starbase!');
		}
	}

	async inspectPlayer(playerId: string | number): Promise<PlayerInspectDTO> {
		let data = await this.executeGetRequest('player/inspect/' + playerId);
		if (data.player) {
			return data.player as PlayerInspectDTO;
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async loadEventLeaderboard(eventInstanceId: number, topCount: number, top: boolean = true): Promise<EventLeaderboardDTO> {
		let data = await this.executeGetRequest('event/leaderboard', {
			instance_id: eventInstanceId,
			max: topCount,
			type: top ? 'top' : 'centered'
		})
		return data as EventLeaderboardDTO;
	}

	async loadEventBorrowableCrew(): Promise<void> {
		this.borrowableCrew = [];
		let data = await this.executeGetRequest('crew/borrowable_crew');
		if (data.borrowable_crew) {
			this.borrowableCrew = data.borrowable_crew as BorrowedCrewDTO[];
		} else {
			console.log(new Error('Failed loading data returned for borrowable crew'));
		}
	}

	// getGithubReleases(): Promise<any> {
	// 	return this._net.get(CONFIG.URL_GITHUBRELEASES, {});
	// }

	async loadDatacore(): Promise<void> {
		this.datacore = [];
		try {
			this.datacore = await this._net.get_proxy(this.datacoreAddress, undefined);
		} catch (e) {
			console.log('Failed loading data from datacore.app' + e);
		}
	}

	async refreshRoster(): Promise<void> {
		// TODO: need to reload icon urls as well
		this.roster = await buildCrewData(this._playerData!.player!.character);
	}

	async applyUpdates(data: any): Promise<any[]> {
		if (!data) {
			return [];
		}

		if (Array.isArray(data)) {
			let ephemerals: any[] = [];
			for (let val of data) {
				let e = await this.applyUpdates(val);
				ephemerals = ephemerals.concat(e);
			}

			return ephemerals;
		} else {
			if (!data.action) {
				console.log(`Not sure what message this is; should we be updating something: '${data}'`);
				return [data];
			}

			if (data.action === 'update') {
				if (data.player) {
					this._playerData!.player = mergeDeep(this._playerData!.player, data.player);
				}

				if (data.character) {
					this._playerData!.player!.character = mergeDeep(this._playerData!.player!.character, data.character);
					this.itemRecount();
					await this.refreshRoster();
				}

				if (data.event) {
					if(this._playerData!.player!.character.events && this._playerData!.player!.character.events.length === 1) {
						this._playerData!.player!.character.events[0] = mergeDeep(this._playerData!.player!.character.events[0], data.event);
					}
				}

				if (data.shuttle) {
					this._playerData!.player!.character.shuttle_adventures.forEach((adv: PlayerShuttleAdventureDTO) => {
						if (adv.shuttles[0].id === data.shuttle.id) {
							adv.shuttles[0] = mergeDeep(adv.shuttles[0], data.shuttle, ['slots','rewards']);
						}
					});
				}

				if (data.item_archetype_cache) {
					//TODO
				}
			} else if (data.action === 'delete') {
				// TODO
				// For example, data.character.items, array with objects with just the id property in them

				if (data.character) {
					let pc :any = this._playerData!.player!.character; // remove type info to allow object indexing
					for (let prop in data.character) {
						if (Array.isArray(data.character[prop]) && Array.isArray(pc[prop])) {
							for (let item of data.character[prop]) {
								pc[prop] = pc[prop].filter((itm: any) => itm.id !== item.id);
							}
						}
					}
					this.itemRecount();
				} else if (
					data.event &&
					data.event.content.gather_pools &&
					data.event.content.gather_pools.length === 1 &&
					data.event.content.gather_pools[0].adventures &&
					data.event.content.gather_pools[0].adventures.length === 1
				) {
					this._playerData!.player!.character.events[0].content.gather_pools[0].adventures = this._playerData!.player!.character.events[0].content.gather_pools[0].adventures.filter(
						(itm) => itm.id !== data.event.content.gather_pools[0].adventures[0].id
					);
				} else {
					console.warn('Delete not applied; data is most likely stale; user should refresh');
				}
			} else if (data.action === 'ephemeral') {
				return [data];
			} else {
				console.log(`Unknown data action '${data.action}' not applied. Data is most likely stale; user should refresh`);
			}

			return [];
		}
	}

	/// Takes the raw stats from a crew and applies the current player buff config (useful for imported crew)
	applyBuffConfig(crew: CrewDTO): void {
		const getMultiplier = (skill: string, stat: string) => {
			return this._buffConfig[`${skill}_${stat}`].multiplier + this._buffConfig[`${skill}_${stat}`].percent_increase;
		};

		for (let skill in crew.base_skills) {
			let cs: any = crew.skills;
			let css: SkillDTO = cs[skill];
			let cb: any = crew.base_skills;
			let cbs: SkillDTO = cb[skill];

			if (!cbs) {
				continue;
			}

			css.core = Math.round(cbs.core * getMultiplier(skill, 'core'));
			css.range_min = Math.round(cbs.range_min * getMultiplier(skill, 'range_min'));
			css.range_max = Math.round(cbs.range_max * getMultiplier(skill, 'range_max'));
		}
	}

	getNeededEquipment(filters: EquipNeedFilter, limitCrew: number[]): EquipNeed[] {
		return this._neededEquipment.filterNeededEquipment(filters, limitCrew);
	}

	getNeededEquipmentFromList(unparsedEquipment: UnparsedEquipment[]): EquipNeed[] {
		return this._neededEquipment.filterNeededEquipmentFromList(unparsedEquipment);
	}

	getEquipmentManager() : NeededEquipmentClass {
		return this._neededEquipment;
	}

	itemRecount() : void {
		// for (let itemDTO of this._playerData!.player!.character.items) {
		// 	let item = this.items.find(id => id.id === itemDTO.id);
		// 	if (item) {
		// 		item.quantity = itemDTO.quantity;
		// 	}
		// }

		// If item is still here, update quantity; otherwise remove the item data
		for (let item of [...this.items]) {
			let dto = this._playerData!.player!.character.items.find(id => id.id === item.id);
			if (dto && item.quantity !== dto.quantity) {
				item.quantity = dto.quantity;
			}
			else if (!dto) {
				this.items = this.items.filter(itemData => itemData.id !== item.id);
			}
		}
	}

	private imageCacheState() {
		return Object.keys(this.imageUrlCache).sort().join(' ');
	}

	private imgLoad(path: string | undefined, delayed: (url: string) => void) : string | undefined {
		if (!path) {
			return undefined;
		}
		let url = this.imageUrlCache[path];
		if (url) {
			delete this.imageUrlCachePending[path];
			return url;
		}

		if (this.imageUrlCachePending[path]) {
			//console.log('skipping request for ' + path);
			return undefined;
		}

		this.imageUrlCachePending[path] = true;

		this.imageProvider.getImageUrl(path, '')
			.then(found => {
				if (found.url) {
					this.imageUrlCache[path] = found.url;
					delete this.imageUrlCachePending[path];
					delayed(found.url);
				}
			});

		return undefined;
	}

	/**
	 * Load the image URL for the given DTO. If the URL is available (alrady cached) it
	 * is returned, otherwise the update function will be called when it is loaded and
	 * this function can be called again to provide the URL.
	 */
	imgUrl(dto: ImageDataDTO | undefined, cacheUpdate?: (cacheState: string) => void) : string {
		if (!dto) {
			return '';
		}
		const cached = this.imgLoad(dto?.file, url => {
			if (cacheUpdate) {
				cacheUpdate(this.imageCacheState());
			}
		});
		return cached ?? '';
	}
}
