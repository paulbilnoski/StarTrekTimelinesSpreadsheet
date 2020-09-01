import React from 'react';
import { getTheme } from '@uifabric/styling';

import { Input, Dropdown, Grid } from 'semantic-ui-react';

import { ItemDisplay } from '../utils/ItemDisplay';
import { ReplicatorDialog } from './replicator/ReplicatorDialog';
import { WarpDialog } from './WarpDialog';

import STTApi, { CONFIG, CollapsibleSection, download, getItemDetailsLink } from '../api';

import { simplejson2csv } from '../utils/simplejson2csv';
import { EquipNeedFilter, EquipNeed, getMissionCost } from '../api/EquipmentTools';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { ItemArchetypeDTO, ItemArchetypeSourceDTO } from '../api/DTO';

export const NeededEquipment = (props: {
	onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}) => {
	const [filters, setFilters] = React.useState({
		onlyNeeded: true,
		onlyFaction: false,
		cadetable: false,
		allLevels: false,
		userText: undefined
	} as EquipNeedFilter);
	const [neededEquipment, setNeededEquipment] = React.useState([] as EquipNeed[]);
	const [currentSelectedItems, setCurrentSelectedItems] = React.useState([] as number[]);
	const [replicatorTarget, setReplicatorTarget] = React.useState(undefined as ItemArchetypeDTO | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	React.useEffect(() => {
		_updateCommandItems();
		_filterNeededEquipment(filters);
	}, [filters]);

	let peopleListInit : { key: any; value: any; image: any; text: string; }[]= [];
	STTApi.allcrew.forEach(crew => {
		let have = STTApi.roster.find(c => c.symbol === crew.symbol);

		peopleListInit.push({
			key: crew.id,
			value: crew.id,
			image: { src: STTApi.imgUrl(crew.portrait, imageCacheUpdated) },
			text: `${crew.name} (${have ? 'owned' : 'unowned'} ${crew.max_rarity}*)`
		});
	});

	const [peopleList, setPeopleList] = React.useState(peopleListInit);

	const _filterNeededEquipment = (filters: EquipNeedFilter) : void => {
		const neededEquipment = STTApi.getNeededEquipment(filters, currentSelectedItems);

		setNeededEquipment(neededEquipment);
	}

	const _toggleFilter = (name:string) : void => {
		const newFilters : any = Object.assign({}, filters);
		newFilters[name] = !newFilters[name];
		setFilters(newFilters);

		_filterNeededEquipment(newFilters);
	}

	const _filterText = (filterString:string | undefined) : void => {
		if (!filterString) {
			return;
		}
		const newFilters = Object.assign({}, filters);
		newFilters.userText = filterString;
		setFilters(newFilters);

		_filterNeededEquipment(newFilters);
	}

	const _selectFavorites = () => {
		let dupeChecker = new Set(currentSelectedItems);
		STTApi.roster.filter(c => c.favorite).forEach(crew => {
            if (!dupeChecker.has(crew.id)) {
                dupeChecker.add(crew.id);
            }
		});

		setCurrentSelectedItems(Array.from(dupeChecker.values()));
	}

	const _updateCommandItems = () => {
		if (props.onCommandItemsUpdate) {
			props.onCommandItemsUpdate([
				{
					key: 'settings',
					text: 'Settings',
					iconProps: { iconName: 'Equalizer' },
					subMenuProps: {
						items: [{
							key: 'onlyFavorite',
							text: 'Show only for favorite crew',
							onClick: () => { _selectFavorites(); }
						},
						{
							key: 'onlyNeeded',
							text: 'Show only insufficient equipment',
							canCheck: true,
							isChecked: filters.onlyNeeded,
							onClick: () => { _toggleFilter('onlyNeeded'); }
						},
						{
							key: 'onlyFaction',
							text: 'Show items obtainable through faction missions only',
							canCheck: true,
							isChecked: filters.onlyFaction,
							onClick: () => { _toggleFilter('onlyFaction'); }
						},
						{
							key: 'cadetable',
							text: 'Show items obtainable through cadet missions only',
							canCheck: true,
							isChecked: filters.cadetable,
							onClick: () => { _toggleFilter('cadetable'); }
						},
						{
							key: 'allLevels',
							text: '(EXPERIMENTAL) show needs for all remaining level bands to FE',
							canCheck: true,
							isChecked: filters.allLevels,
							onClick: () => { _toggleFilter('allLevels'); }
						}]
					}
				},
				{
					key: 'exportCsv',
					name: 'Export CSV...',
					iconProps: { iconName: 'ExcelDocument' },
					onClick: () => { _exportCSV(); }
				}
			]);
		}
	}

	const _exportCSV = () => {
		let fields : {label:string, value:(v:any)=>any; }[] = [{
			label: 'Equipment name',
			value: (row) => row.equipment.name
		},
		{
			label: 'Equipment rarity',
			value: (row) => row.equipment.rarity
		},
		{
			label: 'Needed',
			value: (row) => row.needed
		},
		{
			label: 'Have',
			value: (row) => row.have
		},
		{
			label: 'Missions',
			value: (row) => row.equipment.item_sources.filter((e:any) => e.type === 0).map((mission:any) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
		},
		{
			label: 'Ship battles',
			value: (row) => row.equipment.item_sources.filter((e: any) => e.type === 2).map((mission: any) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
		},
		{
			label: 'Faction missions',
			value: (row) => row.equipment.item_sources.filter((e: any) => e.type === 1).map((mission: any) => `${mission.name} (${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
		},
		{
			label: 'Cadet misions',
			value: (row) => row.cadetSources.map((mission: any) => `${mission.quest.name} from ${mission.mission.episode_title} (${CONFIG.MASTERY_LEVELS[mission.masteryLevel].name})`).join(', ')
		}
		];
		let toexport : any[] = [];
		neededEquipment.forEach(eq => {
			Object.values(eq.counts).forEach(count => {
				toexport.push({
					name: eq.equipment.name,
					rarity: eq.equipment.rarity,
					have: eq.have,
					need: count.count,
					crew: count.crew.name,
				});
			});
			toexport.push({
				name: eq.equipment.name,
				rarity: eq.equipment.rarity,
				have: eq.have,
				need: eq.needed,
				crew: "total"
			});
		});

		// let fields2 = [
		// 	'name', 'rarity', 'have', 'need', 'crew'
		// ];

		let csv = simplejson2csv(toexport, fields);

		let today = new Date();
		download('Equipment-' + (today.getUTCMonth() + 1) + '-' + (today.getUTCDate()) + '.csv', csv, 'Export needed equipment', 'Export');
	}

	if (neededEquipment) {
		return (<div className='tab-panel-x' data-is-scrollable='true'>
			<p>Equipment required to fill all open slots for all crew currently in your roster{!filters.allLevels && <span>, for their current level band</span>}</p>
			<small>Note that partially complete recipes result in zero counts for some crew and items</small>

			{filters.allLevels && <div>
				<br />
				<p><span style={{ color: 'red', fontWeight: 'bold' }}>WARNING!</span> Equipment information for all levels is crowdsourced. It is most likely incomplete and potentially incorrect (especially if DB changed the recipe tree since the data was cached). This equipment may also not display an icon and may show erroneous source information! Use this data only as rough estimates.</p>
				<br />
			</div>}

			<Grid>
				<Grid.Column width={6}>
					<Input fluid icon='search' placeholder='Filter...' value={filters.userText} onChange={(e, {value}) => _filterText(value)} />
				</Grid.Column>
				<Grid.Column width={10}>
					<Dropdown clearable fluid multiple search selection options={peopleList}
						placeholder='Select or search crew'
						label='Show only for these crew'
						value={currentSelectedItems}
						onChange={(e, { value }) => { setCurrentSelectedItems(value as number[]); _filterText(filters.userText); }}
					/>
				</Grid.Column>
			</Grid>

			{neededEquipment.map((entry, idx) =>
				<div key={idx} className="ui raised segment" style={{ display: 'grid', gridTemplateColumns: '128px auto', gridTemplateAreas: `'icon name' 'icon details'`, padding: '8px 4px', margin: '8px', backgroundColor: getTheme().palette.themeLighter }}>
					<div style={{ gridArea: 'icon', textAlign: 'center' }}>
						<ItemDisplay src={STTApi.imgUrl(entry.equipment.icon, imageCacheUpdated)} size={128} maxRarity={entry.equipment.rarity} rarity={entry.equipment.rarity} />
						<button style={{ marginBottom: '8px' }} className="ui button" onClick={() => setReplicatorTarget(entry.equipment)}>Replicate...</button>
					</div>
					<div style={{ gridArea: 'name', alignSelf: 'start', margin: '0' }}>
						<h4><a href={getItemDetailsLink(entry.equipment)} target='_blank'>{entry.equipment.name}</a>
						{` (need ${entry.needed}, have ${entry.have})`}</h4>
					</div>
					<div style={{ gridArea: 'details', alignSelf: 'start' }}>
						<NeededEquipmentSources entry={entry} onWarp={() => _filterNeededEquipment(filters) } />
					</div>
				</div>
			)}
			<FarmList neededEquipment={neededEquipment} onWarp={() => _filterNeededEquipment(filters)} />
			<ReplicatorDialog targetArchetype={replicatorTarget}
				onReplicate={() => { setReplicatorTarget(undefined); _filterNeededEquipment(filters); } }
				onClose={() => setReplicatorTarget(undefined) } />
		</div>);
	}
	else {
		return <span />;
	}
}

export const NeededEquipmentSources = (props: {
	entry: EquipNeed,
	onWarp?: () => void;
}) => {
	const entry = props.entry;

	let equipment = entry.equipment;
	let counts = entry.counts;
	let disputeMissions = equipment.item_sources.filter(e => e.type === 0);
	let shipBattles = equipment.item_sources.filter(e => e.type === 2);
	let factions = equipment.item_sources.filter(e => e.type === 1);
	let cadetSources = entry.cadetSources;
	let factionSources = entry.factionSources;

	let res = [];

	res.push(<div key={'crew'}>
		<b>Crew: </b>
		{Array.from(counts.values()).sort((a, b) => b.count - a.count).map((entry, idx, all) =>
			<span key={idx}>{entry.crew.name} (x{entry.count}){idx == all.length - 1 ? '' : <span>,&nbsp;</span>}</span>
		)}
	</div>)

	if (disputeMissions.length > 0) {
		res.push(<div key={'disputeMissions'} style={{ lineHeight: '2.5' }}>
			<b>Missions: </b>
			{disputeMissions.map((entry, idx, all) =>
				<div className={"ui labeled button compact tiny" + ((getMissionCost(entry.id, entry.mastery) === undefined) ? " disabled" : "")}
					key={idx}
					onClick={() => warp(entry)}>
					<div className="ui button compact tiny">
						{entry.name} <span style={{ display: 'inline-block' }}><img src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={14} /></span> ({entry.chance_grade}/5)
						</div>
					<a className="ui blue label">
						{getMissionCost(entry.id, entry.mastery)} <span style={{ display: 'inline-block' }}><img src={CONFIG.SPRITES['energy_icon'].url} height={14} /></span>
					</a>
					{idx == all.length - 1 ? '' : <span>&nbsp;</span>}
				</div>
			)}
		</div>)
	}

	if (shipBattles.length > 0) {
		res.push(<div key={'shipBattles'} style={{ lineHeight: '2.5' }}>
			<b>Ship battles: </b>
			{shipBattles.map((entry, idx, all) =>
				<div className={"ui labeled button compact tiny" + ((getMissionCost(entry.id, entry.mastery) === undefined) ? " disabled" : "")}
					key={idx}
					onClick={() => warp(entry)}>
					<div className="ui button compact tiny">
						{entry.name} <span style={{ display: 'inline-block' }}><img src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={14} /></span> ({entry.chance_grade}/5)
						</div>
					<a className="ui blue label">
						{getMissionCost(entry.id, entry.mastery)} <span style={{ display: 'inline-block' }}><img src={CONFIG.SPRITES['energy_icon'].url} height={14} /></span>
					</a>
					{idx == all.length - 1 ? '' : <span>&nbsp;</span>}
				</div>
			)}
		</div>)
	}

	if (cadetSources.length > 0) {
		res.push(<div key={'cadet'}>
			<b>Cadet missions: </b>
			{cadetSources.map((entry, idx, all) =>
				<span key={idx}>{`${entry.quest.name} (${entry.mission.episode_title})`} <span style={{ display: 'inline-block' }}><img
					src={CONFIG.MASTERY_LEVELS[entry.masteryLevel].url()} height={16} /></span>
					{idx == all.length - 1 ? '' : <span>&nbsp;</span>}
				</span>
			)}
		</div>)
	}

	if (factions.length > 0) {
		res.push(<div key={'factions'}>
			<b>Faction missions: </b>
			{factions.map((entry, idx) =>
				`${entry.name} (${entry.chance_grade}/5)`
			).join(', ')}
		</div>)
	}

	if (factionSources.length > 0) {
		res.push(<div key={'factionstores'}>
			<b>Faction shops: </b>
			{factionSources.map((entry, idx) =>
				`${entry.cost_amount} ${CONFIG.CURRENCIES[entry.cost_currency].name} in the ${entry.faction.name} shop`
			).join(', ')}
		</div>)
	}

	const [warpQuestId, setWarpQuestId] = React.useState(undefined as number | undefined);
	const [warpMasteryLevel, setWarpMasteryLevel] = React.useState(undefined as number | undefined);

	function warp(entry: ItemArchetypeSourceDTO) {
		setWarpQuestId(entry.id);
		setWarpMasteryLevel(entry.mastery);
	};

	function onWarp(didWarp:boolean) {
		setWarpQuestId(undefined);
		setWarpMasteryLevel(undefined);
		if (didWarp && props.onWarp) {
			props.onWarp();
		}
	}

	return <div>
		{res}
		{/* #!if allowPush == true */}
		<WarpDialog questId={warpQuestId} masteryLevel={warpMasteryLevel} onWarped={() => onWarp(true)} onClose={() => onWarp(false)} />
		{/* #!endif */}
	</div>;
}

const FarmList = (props:{
	neededEquipment?: EquipNeed[];
	onWarp?: () => void;
}) => {
	if (!props.neededEquipment) {
		return <span />;
	}

	type MissionEquip = {
		mission: ItemArchetypeSourceDTO;
		equipment: ItemArchetypeDTO[];
	};

	let missionMap = new Map<number, MissionEquip>();
	props.neededEquipment.forEach(entry => {
		let equipment = entry.equipment;
		let missions = equipment.item_sources.filter(e => (e.type === 0) || (e.type === 2));

		missions.forEach(mission => {
			if (!getMissionCost(mission.id, mission.mastery)) {
				// Disabled missions are filtered out
				return;
			}

			let key = mission.id * (mission.mastery + 1);
			if (!missionMap.has(key)) {
				missionMap.set(key, {
					mission: mission,
					equipment: []
				});
			}

			missionMap.get(key)!.equipment.push(equipment);
		});
	});

	let entries = Array.from(missionMap.values());
	entries.sort((a, b) => a.equipment.length - b.equipment.length);

	// Minimize entries
	const obtainable = (equipment: ItemArchetypeDTO, entry: MissionEquip) => entries.some(e => (e !== entry) && e.equipment.some(eq => eq.id === equipment.id));

	// TODO: there must be a better algorithm for this, maybe one that also accounts for drop chances to break ties :)
	let reducePossible = true;
	while (reducePossible) {
		reducePossible = false;

		for (let entry of entries) {
			if (entry.equipment.every(eq => obtainable(eq, entry))) {
				entries.splice(entries.indexOf(entry), 1);
				reducePossible = true;
			}
		}
	}

	entries.reverse();

	let res = [];
	for (let val of entries) {
		let key = val.mission.id * (val.mission.mastery + 1);
		let entry = val.mission;

		res.push(<div key={key} style={{ lineHeight: '2.5' }}>
			<div className="ui labeled button compact tiny" key={key} onClick={() => warp(entry)}>
				<div className="ui button compact tiny">
					{entry.name} <span style={{ display: 'inline-block' }}><img src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={14} /></span> ({entry.chance_grade}/5)
					</div>
				<a className="ui blue label">
					{getMissionCost(entry.id, entry.mastery)} <span style={{ display: 'inline-block' }}><img src={CONFIG.SPRITES['energy_icon'].url} height={14} /></span>
				</a>
			</div>

			<div className="ui label small">
				{val.equipment.map((entry, idx, all) => <span key={idx}
					style={{ color: entry.rarity ? CONFIG.RARITIES[entry.rarity].color : '' }}>{(entry.rarity ?
						CONFIG.RARITIES[entry.rarity].name : '')} {entry.name}{idx == all.length - 1 ? '' : <span>&nbsp;&nbsp;</span>}
				</span>)}
			</div>
		</div>);
	}

	const [warpQuestId, setWarpQuestId] = React.useState(undefined as number | undefined);
	const [warpMasteryLevel, setWarpMasteryLevel] = React.useState(undefined as number | undefined);

	function warp(entry: ItemArchetypeSourceDTO) {
		setWarpQuestId(entry.id);
		setWarpMasteryLevel(entry.mastery);
	};

	function onWarp(didWarp: boolean) {
		setWarpQuestId(undefined);
		setWarpMasteryLevel(undefined);
		if (didWarp && props.onWarp) {
			props.onWarp();
		}
	}

	return <CollapsibleSection title='Farming list (WORK IN PROGRESS, NEEDS A LOT OF IMPROVEMENT)'>
		<p>This list minimizes the number of missions that can yield all filtered equipment as rewards (it <b>doesn't</b> factor in drop chances).</p>
		{res}
		{/* #!if allowPush == true */}
		<WarpDialog questId={warpQuestId} masteryLevel={warpMasteryLevel} onWarped={() => onWarp(true)} onClose={() => onWarp(false)} />
		{/* #!endif */}
	</CollapsibleSection>;
}
