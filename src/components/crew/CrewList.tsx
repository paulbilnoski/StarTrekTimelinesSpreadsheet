import React from 'react';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { IconButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';

import ReactTable, { SortingRule, Column } from 'react-table';
import { isMobile } from 'react-device-detect';

import { SkillCell } from './SkillCell';
import { ActiveCrewDialog } from './ActiveCrewDialog';
import { ItemDisplay } from '../../utils/ItemDisplay';

import STTApi, { CONFIG, RarityStars, getCrewDetailsLink } from '../../api';
import { CrewData, ItemArchetypeDTO, CrewActionChargePhaseDTO } from '../../api/DTO';
import { ReplicatorDialog } from '../replicator/ReplicatorDialog';

export const CrewList = (props: {
	data: CrewData[];
	sortColumn?: string;
	selectedIds?: Set<number>;
	filterText?: string;
	displayMode?: string;
	onSelectionChange?: (sel: Set<number>) => void;
	groupRarity?: boolean;
	showBuyback?: boolean;
	compactMode?: boolean;
	duplicatelist?: boolean;
	embedded?: boolean;
}) => {
	const [sorted, setSorted] = React.useState([{ id: props.sortColumn || 'max_rarity', desc: false }] as SortingRule[]);
	const [selection, setSelection] = React.useState(props.selectedIds ? props.selectedIds : new Set<number>());
	const [active, setActive] = React.useState({} as { activeId?: number; name?: string; });
	const [replicatorTarget, setReplicatorTarget] = React.useState(undefined as ItemArchetypeDTO | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	const items = props.data;

	function _onSelectionChange(id:number, isChecked:boolean | undefined) {
		if (isChecked) {
			selection.add(id);
		} else {
			selection.delete(id);
		}
		if (props.onSelectionChange) {
			props.onSelectionChange(selection);
		}

		setSelection(selection);
	}

	function _isSelected(id:number) {
		return selection && selection.has(id);
	}

	function _onRenderCompactCard(item:CrewData) {
		return <div className="ui items">
			<div className="item">
				<img src={STTApi.imgUrl(item.full_body, imageCacheUpdated)} height={180} />
				<div className="content" style={{ padding: '12px' }}>
					<div className="header">{item.name}</div>
					<div className="meta">{item.flavor}</div>
					<div className="description">Traits: {item.traits.replace(new RegExp(',', 'g'), ', ')}</div>
					<span style={{ fontSize: '0.8rem' }}>id: {item.id}, symbol:{item.symbol}</span>
				</div>
			</div>
		</div>;
	}

	function _onRenderExpandedCard(item: CrewData) {
		let equipment : {e?: ItemArchetypeDTO, have?: boolean }[] = [];
		item.equipment_slots.forEach(es => {
			equipment.push(
				{
					e: STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === es.archetype),
					have: es.have
				}
			);
		});

		let eqTable;
		if (equipment && equipment.length > 0) {
			eqTable = (<div>
				<h4 className="ui header">Equipment</h4>
				<table><tbody>
					<tr>
						{
							equipment.map((eq, ix) => {
								if (eq.e) {
									return (<td key={eq.e.name + ix}>
										<ItemDisplay src={STTApi.imgUrl(eq?.e?.icon, imageCacheUpdated)}
											size={100} maxRarity={eq.e.rarity} rarity={eq.e.rarity}
											onClick={() => setReplicatorTarget(eq.e)} />
										<span style={{ fontSize: '0.8rem', color: eq.have ? "" : "red" }}>{eq.e.name}</span>
									</td>);
								}
								else {
									return <td></td>;
								}
							})
						}
					</tr></tbody>
				</table>
			</div>);
		}
		const collectionTrait = STTApi.playerData.character.cryo_collections.filter(c => item.rawTraits.some(t => c.traits.includes(t)));
		const collectionMember = STTApi.playerData.character.cryo_collections.filter(c => c.extra_crew.includes(item.avatar_id));

		return (
			<div style={{ padding: '10px' }}>
				{(collectionTrait.length > 0 || collectionMember.length > 0) &&
					<div>
						<h4 className="ui header">Collections</h4>
						{collectionTrait.map((c, i, all) => <div>{c.name} - {c.traits.map(t => STTApi.getTraitName(t)).join()}</div>)}
						{collectionMember.map((c, i, all) => <div>{c.name}</div>)}
					</div>
				}
				{eqTable}
				{item.action && item.ship_battle && <span>
				<h4 className="ui header">Ship abilitiy '{item.action.name}'</h4>
				<Label>Accuracy +{item.ship_battle.accuracy}  Crit Bonus +{item.ship_battle.crit_bonus}  Crit Rating +{item.ship_battle.crit_chance}  Evasion +{item.ship_battle.evasion}</Label>
				<Label>Increase {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.bonus_type]} by {item.action.bonus_amount}</Label>
				{item.action.penalty && <Label>Decrease {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.penalty.type]} by {item.action.penalty.amount}</Label>}

				{item.action.ability && <Label>Ability: {CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE[item.action.ability.type].replace('%VAL%', '' + item.action.ability.amount)} {(item.action.ability.condition > 0) && <span>Trigger: {CONFIG.CREW_SHIP_BATTLE_TRIGGER[item.action.ability.condition]}</span>}</Label>}
				<Label>Duration: {item.action.duration}s  Cooldown: {item.action.cooldown}s  Initial Cooldown: {item.action.initial_cooldown}s  </Label>
				{item.action.limit && <Label>Limit: {item.action.limit} uses per battle</Label>}

				{renderChargePhases(item.action.charge_phases)}
				</span>}
			</div>
		);
	}

	function renderChargePhases(charge_phases?: CrewActionChargePhaseDTO[]) {
		if (!charge_phases) {
			return <span />;
		} else {
			let phases :any[] = [];
			charge_phases.forEach((cp: CrewActionChargePhaseDTO, idx:number) => {
				let phaseDescription = `Charge time: ${cp.charge_time}s`;

				if (cp.ability_amount) {
					phaseDescription += `  Ability amount: ${cp.ability_amount}`;
				}

				if (cp.bonus_amount) {
					phaseDescription += `  Bonus amount: ${cp.bonus_amount}`;
				}

				if (cp.duration) {
					phaseDescription += `  Duration: ${cp.duration}s`;
				}

				if (cp.cooldown) {
					phaseDescription += `  Cooldown: ${cp.cooldown}s`;
				}

				phases.push(<Label key={idx}>{phaseDescription}</Label>);
			});

			return (<div>
				<h4 className="ui header">Charge phases</h4>
				<div>
					{phases}
				</div>
			</div>);
		}
	}

	let pivotBy : string[] = [];

	if (props.groupRarity) {
		pivotBy = ['max_rarity'];
	}

	let columns = _getColumns(props.duplicatelist, props.showBuyback, props.compactMode, pivotBy.length > 0);

	let filtered = items;
	if (props.filterText) {
		filtered = filtered.filter(i => _filterCrew(i, props.filterText!.toLowerCase()))
	}

	return (
		<div className={props.embedded ? 'embedded-crew-grid' : 'data-grid'} data-is-scrollable='true'>
			<ReactTable
				data={filtered}
				columns={columns}
				defaultPageSize={(filtered.length <= 50) ? filtered.length : 50}
				pageSize={(filtered.length <= 50) ? filtered.length : 50}
				sorted={sorted}
				onSortedChange={setSorted}
				showPagination={(filtered.length > 50)}
				showPageSizeOptions={false}
				className='-striped -highlight'
				style={(!props.embedded && (filtered.length > 50)) ? { height: 'calc(100vh - 92px - 34px)' } : {}}
				pivotBy={pivotBy}
				getTrProps={(s:any, r:any) => {
					const originalRowData: CrewData = r && r.original;
					return {
						style: {
							opacity: (originalRowData && originalRowData.status.external) ? '0.5' : 'inherit',
							backgroundColor: (originalRowData && originalRowData.status.expires_in) ? 'pink' : 'inherit',
						}
					};
				}}
				getTdProps={(s: any, r: any) => {
					return props.compactMode ? { style: { padding: "2px 3px" } } : {};
				}}
			/>
			<ActiveCrewDialog activeId={active.activeId} name={active.name} />
			<ReplicatorDialog targetArchetype={replicatorTarget}
				onReplicate={() => setReplicatorTarget(undefined)}
				onClose={() => setReplicatorTarget(undefined)} />
		</div>
	);

	function _getColumns(duplicatelist?: boolean, showBuyBack?: boolean, compactMode?: boolean, pivotRarity?: boolean) {
		let _columns : Column<CrewData>[] = [];

		if (duplicatelist) {
			_columns.push({
				id: 'airlock',
				Header: 'Airlock',
				minWidth: 100,
				maxWidth: 100,
				resizable: false,
				style: { marginTop: 15 },
				Cell: (cell) => {
					let crew:CrewData = cell.original;

					if (crew.crew_id)
						return (<div><Checkbox label='Airlock'
							checked={_isSelected(crew.crew_id)}
							onChange={(ev, isChecked) => _onSelectionChange(crew.crew_id, isChecked)} />
							{(crew.buyback && crew.expires_in === null) &&
							<TooltipHost content={`${crew.short_name} is stuck in the airlock. You need to contact DB support to release them!`} calloutProps={{ gapSpace: 0 }}>
							<p style={{color:'red'}}>ERROR!</p>
						</TooltipHost>}
							</div>);
					else
						return <span />;
				}
			});
		}

		if (pivotRarity) {
			_columns.push({
				id: 'max_rarity',
				Header: 'Rarity',
				accessor: (obj) => CONFIG.RARITIES[obj.max_rarity].name,
				minWidth: 150,
				maxWidth: 150,
				resizable: false,
				Cell: (cell) => <span />
			});
		}

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: compactMode ? 28 : 60,
			maxWidth: compactMode ? 28 : 60,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={STTApi.imgUrl((cell.original as CrewData).portrait, imageCacheUpdated)} width={compactMode ? 22 : 50} height={compactMode ? 22 : 50} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
			Aggregated: (row) => <span />
		});

		if (!isMobile) {
			_columns.push({
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <a href={getCrewDetailsLink(cell.original)} target='_blank'>{cell.original.short_name}</a>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
			Cell: (cell) => {
					if (cell && cell.original) {
						return <HoverCard id="nameHoverCard" key={cell.original.crew_id}
							expandingCardProps={{
								compactCardHeight: 180,
								expandedCardHeight: 420,
								renderData: cell.original,
								onRenderExpandedCard: _onRenderExpandedCard,
								onRenderCompactCard: _onRenderCompactCard,
								styles: { root: { width: '520px' } }
							}}
							instantOpenOnClick={true}>
							<span>{cell.original.name}</span>
						</HoverCard>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				aggregate: (vals) => vals.reduce((a:any, b:any) => a + b, 0) / vals.length,
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				// Sort all by max fusion level, then fractional part by current fusion level
				accessor: (obj) => obj.max_rarity + (obj.rarity / obj.max_rarity),
				minWidth: 75,
				maxWidth: 85,
				resizable: false,
				Cell: (cell) => {
					if (cell && cell.original) {
						return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});

		if (!isMobile) {
			_columns.push({
				id: 'favorite',
				Header: () => <Icon iconName='FavoriteStar' />,
				minWidth: 30,
				maxWidth: 30,
				style: { textAlign: 'center' },
				resizable: false,
				accessor: 'favorite',
				Cell: (cell) => {
					if (cell && cell.original && cell.value) {
						return <TooltipHost content={`You marked ${cell.original.short_name} as favorite in the game`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='FavoriteStar' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				aggregate: (vals) => vals.map((v:any) => v ? 1 : 0).reduce((a:any, b:any) => a + b, 0),
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			});
		}

		// TODO: add global setting / toggle for turning off buy-back crew
		if (!duplicatelist && showBuyBack) {
			_columns.push({
				id: 'buyback',
				Header: () => <Icon iconName='EmptyRecycleBin' />,
				minWidth: 30,
				maxWidth: 30,
				style: { textAlign: 'center' },
				resizable: false,
				accessor: 'buyback',
				Cell: (cell) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`This copy of ${cell.original.short_name} was dismissed and is available for buyback for a limited time`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='EmptyRecycleBin' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});
		}

		if (!isMobile) {
			_columns.push({
				id: 'active_id',
				Header: () => 'V/S',
				minWidth: 30,
				maxWidth: 30,
				style: { textAlign: 'center' },
				resizable: false,
				accessor: 'active_id',
				Cell: (cell) => {
					if (cell && cell.original && cell.original.active_id) {
						let isShuttle = false;
						STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
							if (shuttle.shuttles[0].id === cell.original.active_id) {
								isShuttle = true;
							}
						});
						return <TooltipHost content={ isShuttle ? 'Active on Shuttle' : 'Active on Voyage'} calloutProps={{ gapSpace: 0 }}>
							<a href='javascript:;' onClick={() => setActive({ activeId: cell.original.active_id, name: cell.original.name })}>{
								isShuttle ? 'S' : 'V'
							}</a>
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				aggregate: (vals) => vals.map((v:any) => v ? 1 : 0).reduce((a:any, b:any) => a + b, 0),
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			});
		}

		// Compute an average aggregate, only including nonzero values
		let aggAvg = (vals: any) => {
			let nonzeros = vals.reduce((a: any, b: any) => a + ((b || 0) > 0 ? 1 : 0), 0);
			return vals.reduce((a: any, b: any) => (a || 0) + (b || 0), 0) / nonzeros;
		}

		let colsCore : Column<CrewData>[] = [];
		for (let sk in CONFIG.SKILLS_SHORT) {
			let head = CONFIG.SKILLS_SHORT[sk];
			colsCore.push({
				id: sk,
				Header: head,
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (crew) => crew.skills[sk].core,
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} compactMode={compactMode} /> : <span />,
				aggregate: aggAvg,
				Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
			});
		}
		colsCore.sort((a,b) => (a.Header as string).localeCompare(b.Header as string));
		let colsProf: Column<CrewData>[] = [];
		for (let sk in CONFIG.SKILLS_SHORT) {
			let head = CONFIG.SKILLS_SHORT[sk];
			colsProf.push({
				id: sk+'_prof',
				Header: head+'+',
				minWidth: 70,
				maxWidth: 100,
				resizable: true,
				accessor: (crew) => crew.skills[sk].max,
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} compactMode={compactMode} proficiency={true} /> : <span />,
				aggregate: aggAvg,
				Aggregated: (row) => <span>{Math.floor(row.value)} (avg max)</span>
			});
		}
		colsProf.sort((a, b) => (a.Header as string).localeCompare(b.Header as string));
		let colsVoy: Column<CrewData>[] = [];
		for (let sk in CONFIG.SKILLS_SHORT) {
			let head = CONFIG.SKILLS_SHORT[sk];
			colsVoy.push({
				id: sk + '_voy',
				Header: head + '++',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (crew) => crew.skills[sk].voy,
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} compactMode={compactMode} combined={true} /> : <span />,
				aggregate: aggAvg,
				Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
			});
		}
		colsVoy.sort((a, b) => (a.Header as string).localeCompare(b.Header as string));

		if (!props.displayMode || props.displayMode === 'Base') {
			_columns.push(...colsCore);
		}
		if (!props.displayMode || props.displayMode === 'Gauntlet') {
			_columns.push(...colsProf);
		}
		if (!props.displayMode || props.displayMode === 'Voyage') {
			_columns.push(...colsVoy);
		}

		_columns.push(
			{
				id: 'usage_value',
				Header: 'Value',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: 'usage_value',
				Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.usage_value}</div> : <span />,
				aggregate: (vals) => vals.reduce((a: any, b: any) => (a || 0) + (b || 0), 0) / vals.length,
				Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
			},
			{
				id: 'bigbook_tier',
				Header: 'BBoB',
				minWidth: 30,
				maxWidth: 35,
				resizable: false,
				Cell: (cell) => cell.original ? <span style={{ color: cell.original.datacore?.in_portal ? "inherit" : "red" }}>{cell.original.datacore?.bigbook_tier ?? ''}</span> : <span />,
				accessor: (c) => c.datacore?.bigbook_tier ? c.datacore.bigbook_tier : 0,
				Aggregated: row => <span />
			}
		);

		if (!props.displayMode || props.displayMode === 'Voyage') {
			_columns.push(
				{
					id: 'voyage_score',
					Header: 'V Score',
					minWidth: 50,
					maxWidth: 70,
					resizable: true,
					accessor: 'voyage_score',
					Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.voyage_score}</div> : <span />,
					aggregate: aggAvg,
					Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
				},
				{
					id: 'voyage_rank',
					Header: 'V Rank',
					minWidth: 50,
					maxWidth: 70,
					resizable: true,
					accessor: (c) => c.datacore?.ranks.voyRank ?? 0,
					Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.datacore?.ranks.voyRank ?? ''}</div> : <span />,
					aggregate: aggAvg,
					Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
				}
			);
		}
		if (!props.displayMode || props.displayMode === 'Gauntlet') {
			_columns.push(
				{
					id: 'gauntlet_score',
					Header: 'G Score',
					minWidth: 50,
					maxWidth: 70,
					resizable: true,
					accessor: 'gauntlet_score',
					Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.gauntlet_score}</div> : <span />,
					aggregate: aggAvg,
					Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
				},
				{
					id: 'gauntlet_rank',
					Header: 'G Rank',
					minWidth: 50,
					maxWidth: 70,
					resizable: true,
					accessor: (c) => c.datacore?.ranks.gauntletRank ?? 0,
					Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.datacore?.ranks.gauntletRank ?? ''}</div> : <span />,
					aggregate: aggAvg,
					Aggregated: (row) => <span>{Math.floor(row.value)} (avg)</span>
				}
			);
		}
		_columns.push(
			{
				id: 'traits',
				Header: 'Traits',
				minWidth: 140,
				resizable: true,
				accessor: 'traits',
				Cell: (cell) => cell.original ? <div style={compactMode ? { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } : { whiteSpace: 'normal', height: '50px' }}>{cell.original.traits.replace(/,/g, ', ')}</div> : <span />,
				aggregate: (vals) => 0,
				Aggregated: (row) => <span />
			});

		return _columns;
	}

	function _filterCrew(crew:CrewData, searchString:string) {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				if (text.trim().length == 0) return false;
				// search the name first
				if (crew.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}
				if (crew.short_name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (crew.traits.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the raw traits
				if (crew.rawTraits.find(trait => trait.toLowerCase().indexOf(text) > -1)) {
					return true;
				}

				return false;
			});
		});
	}
}
