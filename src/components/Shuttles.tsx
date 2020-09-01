import React from 'react';
import { Dropdown as SuiDropdown, Item, Image, Label, Form, Checkbox, List } from 'semantic-ui-react';

import STTApi, { CONFIG, formatTimeSeconds, CrewSkills, RarityStars, bonusCrewForCurrentEvent } from '../api';
import { CrewData, PlayerShuttleDTO, EventDTO,
	EVENT_TYPES, SHUTTLE_STATE_NAMES, SHUTTLE_STATE_NAME_UNKNOWN, SHUTTLE_STATE_OPENED,
	PlayerShuttleAdventureDTO, SHUTTLE_STATE_INPROGRESS, ItemDTO, ItemData } from '../api/DTO';
import { Dropdown } from 'react-bootstrap';
import { ShuttleSelection, ShuttleCalc, CrewItem, CrewChoice,
	getBonusedRoster, computeCrew, cid, ShuttleCalcSlot, shuttleStart, computeChance, skillBonus
} from '../api/ShuttleTools';
import { ItemDisplay } from '../utils/ItemDisplay';
import { BonusCrew } from './events/EventTools';

export const Shuttles = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	const [, forceUpdate] = React.useState();
	const [, imageCacheUpdated] = React.useState<string>('');
	const [userChoices, setUserChoices] = React.useState<ShuttleSelection[]>([]);
	const [selections, setSelections] = React.useState<ShuttleSelection[]>([]);
	const [selType, setSelType] = React.useState<string | undefined>();
	const [computingEstimate, setComputingEstimate] = React.useState<boolean>(false);
	const [useBonuses, setUseBonuses] = React.useState<boolean>(false);
	const [useBonuses45, setUseBonuses45] = React.useState<boolean>(false);

	let event : EventDTO | undefined = undefined;
	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content.content_type === EVENT_TYPES.SHUTTLES
	) {
		event = STTApi.playerData.character.events[0];
	}

	let eventCrew : BonusCrew | undefined = undefined;
	// If this event is not undefined, then it is a shuttle event; so we WANT to use bonus crew,
	// so leave them undefined. We want to avoid using them for galaxy events.
	if (!event) {
		eventCrew = bonusCrewForCurrentEvent(false);
	}
	const [currentSelectedItems, setCurrentSelectedItems] = React.useState(eventCrew ? eventCrew.crewIds : []);

	React.useEffect(() => {
		selectCrew('first');
	}, [userChoices, currentSelectedItems, useBonuses, useBonuses45]);

	interface CrewEntry {
		key: number;
		value: number;
		image: { avatar: boolean; src: string | undefined; };
		text: string;
	}

	let crewList: CrewEntry[] = [];
	STTApi.roster.forEach(crew => {
		if (crew.status.frozen <= 0) {
			crewList.push({
				key: crew.crew_id || crew.id,
				value: crew.crew_id || crew.id,
				image: { avatar: true, src: STTApi.imgUrl(crew.portrait, imageCacheUpdated) },
				text: crew.name
			});
		}
	});
	crewList.sort((a, b) => (a.text < b.text) ? -1 : ((a.text > b.text) ? 1 : 0));

	let borrowable = STTApi.playerData.character.crew_borrows ?? [];
	if (borrowable.length === 0) {
		// These are synchronized, but don't have "active*" fields
		borrowable = STTApi.borrowableCrew ?? [];
	}
	if (!event?.content.shuttles?.[0].allow_borrow) {
		borrowable = [];
	}

	const activeShuttleAdventures = STTApi.playerData.character.shuttle_adventures;

	const canUserSelect = selections.filter(sel => sel.calc.shuttle.state === SHUTTLE_STATE_OPENED).length > 0;

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div style={{ padding: '10px' }}>
				{event && <div>
					<h2>Current event: {event.name}</h2>
					{props.onTabSwitch &&
						<span>Click to see bonus crew and other event details: <Label as='a' onClick={() =>
							props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
					</span>}
					{borrowable.length > 0 && <List horizontal>
						{borrowable.map(cb => <List.Item key={cb.symbol}>
								<Image avatar src={STTApi.imgUrl(cb.icon, imageCacheUpdated)} />
								<List.Content>
									<List.Header>{cb.name} <RarityStars max={cb.max_rarity} value={cb.rarity} asSpan={true} /></List.Header>
								</List.Content>
							</List.Item>
						)}
					</List>}
				</div>}
				<h3>Active shuttles</h3>
				{(!activeShuttleAdventures || activeShuttleAdventures.length == 0) && <div>
					You have no active shuttles. Open some shuttle missions in the game client
				</div>}
				{canUserSelect && <div>
					<Form.Button primary onClick={() => selectCrew('best')} disabled={false}>
						Calculate best crew selection
						{computingEstimate && <i className='spinner loading icon' style={{marginLeft:'5px'}}/>}
					</Form.Button>
					<Form.Field
						control={Checkbox}
						label='Use shuttle skill bonuses'
						checked={useBonuses}
						onChange={(e: any, { checked }: any) => setUseBonuses(checked)}
					/>
					<Form.Field
						control={Checkbox}
						disabled={!useBonuses}
						label='Use 4* and 5* shuttle skill bonuses'
						checked={useBonuses45}
						onChange={(e: any, { checked }: any) => setUseBonuses45(checked)}
					/>
					{selType && <>Current selection: <b>{selType}</b></>}
					<Form.Field
						control={SuiDropdown}
						clearable
						fluid
						multiple
						search
						selection
						options={crewList}
						placeholder='Select or search for crew'
						label={
							"Crew you don't want to consider for shuttles" +
							(event?.name ? ` (preselected crew which gives bonus in the event ${event.name})` : '')
						}
						value={currentSelectedItems}
						onChange={(e: any, { value }: any) => setCurrentSelectedItems(value)}
					/>
				</div>}
				<Item.Group divided>{selections.sort((a, b) => a.calc.shuttle.expires_in - b.calc.shuttle.expires_in).map(sel =>
					<ShuttleItem
						key={sel.calc.shuttle.id}
						selection={sel}
						chooseSlot={chooseSlot}
						chooseBonus={chooseBonus}
						challengeRating={sel.calc.challenge_rating}
						refresh={() => forceUpdate({})}
						resetSelections={resetSelections}
						options={{useBonuses: useBonuses, useBonuses45: useBonuses45}}
					/>)}
				</Item.Group>
			</div>
		</div>
	);

	async function selectCrew(fillStrategy: string) {
		setComputingEstimate(true);
		const bonusedRoster = getBonusedRoster(event?.content.shuttles?.[0].crew_bonuses ?? {},
			event?.content.shuttles?.[0].allow_borrow ?? false,
			currentSelectedItems);
		const shuttleCalcs: ShuttleCalc[] = buildSlotCalculator(bonusedRoster, event, activeShuttleAdventures);
		if (fillStrategy === 'best') {
			setSelType("Best")
			//FIXME: need a better way to fork this to background
			setTimeout(async () => {
				let sels = await computeCrew(bonusedRoster, shuttleCalcs, userChoices, { useBonuses, useBonuses45 })
				//let sels = await computeCrewFirst(bonusedRoster, shuttleCalcs, userChoices, fillStrategy);
				setSelections(sels);
				setComputingEstimate(false);
			}, 10)
		} else {
			setSelType("First Available")
			let sels = await computeCrewFirst(bonusedRoster, shuttleCalcs, userChoices, fillStrategy);
			setSelections(sels);
			setComputingEstimate(false);
		}
	}

	// Naive computation of best crew - take the first unused option for each shuttle slot ordered by skill value
	async function computeCrewFirst(bonusedRoster: CrewItem[], shuttleCalcs: ShuttleCalc[], userChoices: ShuttleSelection[], fillStrategy: string): Promise<ShuttleSelection[]> {
		let sels: ShuttleSelection[] = [];

		let usedCrew: Set<number> = new Set<number>();

		// First, mark active (on shuttles or voyages) and user-selected crew as "used"
		bonusedRoster.filter(c => c.crew.active_id).forEach(ac => usedCrew.add(cid(ac.crew)));
		shuttleCalcs.forEach(calc => {
			let userChosen = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id)?.chosen ?? [];
			userChosen.forEach(uc => {
				const c = uc.item;
				if (c) {
					let crid = cid(c.crew)
					if (crid) {
						usedCrew.add(crid);
					}
				}
			});
		});

		// Now fill up empty slots
		shuttleCalcs.forEach(calc => {
			let chosen: CrewChoice[] = [];
			const userSel = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id);
			let userChosen = userSel?.chosen ?? [];
			let bonus = userSel?.bonus?.userSelect ? userSel.bonus : undefined;
			calc.slots.forEach((scs, i) => {
				let userChoice = userChosen.find(uc => uc.slotIndex === i);
				if (calc.shuttle.state !== SHUTTLE_STATE_OPENED) {
					// Ignore used crew and find them in the roster
					let item = bonusedRoster.filter(c => c.crew.active_id === calc.shuttle.id && c.crew.active_index === i).shift();
					chosen.push({
						slotIndex: i,
						item
					});
				}
				else if (userChoice?.item) {
					chosen.push(userChoice);
				}
				else {
					let item: CrewItem | undefined = undefined;

					if (fillStrategy === 'first') {
						// Grab the first unused crew by score
						item = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew))).shift();
						if (item) {
							usedCrew.add(cid(item.crew))
						}
					}

					chosen.push({
						slotIndex: i,
						item
					});
				}
			});

			sels.push({
				calc,
				chosen,
				bonus,
			});
		})

		return sels;
	}

	function chooseSlot(calc: ShuttleCalc, calcSlot: ShuttleCalcSlot, value: number) {
		let sel = calcSlot.bestCrew.find(c => cid(c.crew) === value);

		let newChoices = [ ...userChoices ];
		// Remove the selected crew from wherever it is
		newChoices.forEach(ss => {
			let uchs = ss.chosen;
			ss.chosen = uchs.filter(uc => uc.item !== undefined && cid(uc.item.crew) !== value);
		})
		let ssThisShuttle = newChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id);
		if (!ssThisShuttle) {
			ssThisShuttle = {
				calc,
				chosen: []
			};
			newChoices.push(ssThisShuttle);
		}
		let chsThisShuttle = ssThisShuttle.chosen;
		let chOldThisSlot = chsThisShuttle.find(c => c.slotIndex === calcSlot.slotIndex);
		if (chOldThisSlot) {
			chOldThisSlot.item = sel;
		}
		else {
			chsThisShuttle.push({
				slotIndex: calcSlot.slotIndex,
				item: sel,
				userSelect: true
			});
		}
		setUserChoices(newChoices);
	}

	function chooseBonus(calc: ShuttleCalc, value: ItemData | undefined) {
		let newChoices = [...userChoices];
		let ssThisShuttle = newChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id);
		if (!value) {
			if (!ssThisShuttle) {
				return;
			}
			ssThisShuttle.bonus = undefined;
		}
		else {
			if (!ssThisShuttle) {
				ssThisShuttle = {
					calc,
					chosen: [],
				};
				newChoices.push(ssThisShuttle);
			}
			ssThisShuttle.bonus = {
				item: value,
				userSelect: true,
			};
		}
		setUserChoices(newChoices);
	}

	function resetSelections(calc: ShuttleCalc) {
		let newUserChoices = userChoices.filter(c => c.calc.shuttle.id !== calc.shuttle.id);
		setUserChoices(newUserChoices);
	}
}

const ShuttleItem = (props: {
	selection: ShuttleSelection;
	challengeRating: number;
	chooseSlot: (calc: ShuttleCalc, calcSlot: ShuttleCalcSlot, value: number) => void;
	chooseBonus: (calc: ShuttleCalc, value: ItemData | undefined) => void;
	resetSelections: (calc: ShuttleCalc) => void;
	refresh: () => void;
	options?: {
		useBonuses?: boolean;
		useBonuses45?: boolean;
	};
}) => {
	const shuttle = props.selection.calc.shuttle;
	let faction = STTApi.playerData.character.factions.find(faction => faction.id === shuttle.faction_id);
	const chosenItems = props.selection.chosen.map(ch => ch.item);
	const chance = props.selection.calc.chance(chosenItems, props.selection.bonus?.item);
	const chosenCrew = chosenItems.filter(ch => ch !== undefined).map(ch => ch!.crew);
	let canStart = true;
	if (shuttle.state !== SHUTTLE_STATE_OPENED) {
		canStart = false;
	}
	if (chosenCrew.length < props.selection.calc.slots.length) {
		canStart = false;
	}

	return (
		<Item key={shuttle.id}>
			<Item.Image size='small' src={STTApi.imgUrl(faction?.icon, props.refresh)} style={{ 'backgroundColor': '#aaa' }} />

			<Item.Content verticalAlign='middle'>
				<Item.Header>
					{shuttle.name} {shuttle.is_rental ? ' (rental)' : ''}
				</Item.Header>
				<Item.Description>
					<p>{shuttle.description}</p>
					<p>Faction: {faction!.name}</p>
					<p>{shuttle.state === SHUTTLE_STATE_INPROGRESS ? 'Completes' : 'Expires'} in {formatTimeSeconds(shuttle.expires_in)}</p>
					{props.selection.calc.slots.map((calcSlot, idx) => {
						return <ShuttleSeatSelector
							key={idx}
							calcSlot={calcSlot}
							chooseSlot={props.chooseSlot}
							shuttle={shuttle}
							selection={props.selection}
						/>;
					})}
					<ShuttleBonusSelector
						selection={props.selection}
						chooseBonus={props.chooseBonus}
						options={props.options}
					/>
					<div>
						Chance:{' '}{chance}{shuttle.state !== SHUTTLE_STATE_OPENED && '+'}{' '}%
					</div>
					{shuttle.state === SHUTTLE_STATE_OPENED &&
						props.selection.chosen.map(cs => cs.userSelect ?? false).reduce((p, c) => p || c, false)
						&&
						<Label as='a' onClick={() => props.resetSelections(props.selection.calc)}>Reset Selections</Label>
					}
				</Item.Description>
				<Item.Extra>
					State: {SHUTTLE_STATE_NAMES[shuttle.state] || SHUTTLE_STATE_NAME_UNKNOWN}
					{/* #!if allowPush == true */}
					{canStart && <Form.Button floated='right' onClick={start} content='Send Shuttle' />}
					{/* #!endif */}
				</Item.Extra>
			</Item.Content>
		</Item>
	);

	function start() {
		shuttleStart(shuttle, chosenCrew, props.selection.bonus?.item.id, chance, false)
			.then(() => {
				props.refresh();
			})
			.catch(err => {
				console.log(err);
				//setError(err.message);
			});
	}
}

const ShuttleSeatSelector = (props:{
	calcSlot: ShuttleCalcSlot;
	chooseSlot: (calc: ShuttleCalc, calcSlot: ShuttleCalcSlot, value: number) => void;
	shuttle: PlayerShuttleDTO;
	selection: ShuttleSelection;
}) => {
	const isEditable = props.shuttle.state === SHUTTLE_STATE_OPENED;
	let options = props.calcSlot.bestCrew;
	// Filter active crew for shuttles with open slots
	if (isEditable) {
		// Look in the base roster to find active status; if a shuttle gets sent, the calculator does not
		// reload crew from the catalog and the current entries are stale according to active_id
		options = options.filter(c => !c.crew.active_id && !STTApi.roster.find(rc => rc.crew_id === cid(c.crew))?.active_id);
	}

	let sel = props.selection.chosen.find(cc => cc.slotIndex === props.calcSlot.slotIndex);
	let crew = sel?.item?.crew;
	let selectedContent = undefined;
	if (crew) {
		// content is styled in options but not in chosen[]
		selectedContent = options.find(opt => cid(opt.crew) === cid(crew!))?.content;
	}
	// style the option for current selection differently if it is a user selection
	if (sel?.userSelect || !isEditable) {
		selectedContent = <span style={{fontWeight:'bold'}}>{selectedContent}</span>
	}

	const styleDiv = { border: '1px black solid', padding: '1em', lineHeight: '1em', borderRadius: '.25em' };
	const styleDropdown = { border: '1px black solid', padding: '1em', lineHeight: '1em', borderRadius: '.25em', display: 'inline-block' };

	return <div>
		<b>{props.calcSlot.skillText}</b>
		{!isEditable && <div style={styleDiv}>{selectedContent ?? ''}</div>}
		{isEditable &&
			<Dropdown key='outline-light' onSelect={(key:string) => {
				props.chooseSlot(props.selection.calc, props.calcSlot, Number(key))
			}}>
				<Dropdown.Toggle
					as="span"
					id="dropdown-basic"
					style={styleDropdown}>
					{selectedContent ?? ''}
				</Dropdown.Toggle>

				<Dropdown.Menu style={{ overflowY: 'scroll', height:'200px' }}>
					{options.map(opt => <Dropdown.Item key={opt.value} eventKey={String(opt.value)}>{opt.content}</Dropdown.Item>)}
				</Dropdown.Menu>
			</Dropdown>
		}
	</div>
}

const ShuttleBonusSelector = (props:{
	selection: ShuttleSelection;
	chooseBonus: (calc: ShuttleCalc, value: ItemData | undefined) => void;
	options?: {
		useBonuses?: boolean;
		useBonuses45?: boolean;
	};
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	let availableBonuses: ItemData[] = [];
	if (props.options?.useBonuses) {
		availableBonuses = STTApi.items.filter(item => item.type === 4);
		if (!props.options.useBonuses45) {
			availableBonuses = availableBonuses.filter(item => item.rarity < 4);
		}
	}

	const isEditable = availableBonuses.length > 0 && props.selection.calc.shuttle.state === SHUTTLE_STATE_OPENED;
	let missingBonus = <>None</>;
	// Bonuses are not included in the DTO coming from the server for shuttles
	if (props.selection.calc.shuttle.state !== SHUTTLE_STATE_OPENED) {
		missingBonus = <> Unknown</>;
	}

	let selectedContent = missingBonus;
	if (props.selection.bonus?.item) {
		selectedContent = <><ItemDisplay
			item={props.selection.bonus.item}
			size={50}
			rarity={props.selection.bonus.item.rarity}
			maxRarity={props.selection.bonus.item.rarity}
			src={STTApi.imgUrl(props.selection.bonus.item.icon, imageCacheUpdated)} />
			{props.selection.bonus.item.name}{' '}
			<RarityStars max={props.selection.bonus.item.rarity} value={props.selection.bonus.item.rarity} asSpan={true} />
		</>;
	}
	// style the option for current selection differently if it is a user selection
	if (props.selection.bonus?.userSelect || !isEditable) {
		selectedContent = <span style={{ fontWeight: 'bold' }}>{selectedContent}</span>
	}

	const styleDiv = { border: '1px black solid', padding: '1em', lineHeight: '1em', borderRadius: '.25em' };
	const styleDropdown = { border: '1px black solid', padding: '1em', lineHeight: '1em', borderRadius: '.25em', display: 'inline-block' };

	return <div>
		Bonus:
		{!isEditable && selectedContent}
		{isEditable &&
			<Dropdown key='outline-light' onSelect={(key: string) => {
				const b = availableBonuses.find(item => item.id === Number(key))
				props.chooseBonus(props.selection.calc, b);
			}}>
				<Dropdown.Toggle
					as="span"
					id="dropdown-basic"
					style={styleDropdown}>
					{selectedContent}
				</Dropdown.Toggle>

				<Dropdown.Menu style={{ overflowY: 'scroll', height: '200px' }}>
					<Dropdown.Item key={0} eventKey={"0"}>
						{missingBonus}
					</Dropdown.Item>
					{availableBonuses.map(item =>
						<Dropdown.Item key={item.id} eventKey={String(item.id)}>
							<ItemDisplay
							size={50}
							item={item}
							rarity={item.rarity}
							maxRarity={item.rarity}
							src={STTApi.imgUrl(item.icon, imageCacheUpdated)} />{item.name}{' '}<RarityStars max={item.rarity} value={item.rarity} asSpan={true}/>
						</Dropdown.Item>)}
				</Dropdown.Menu>
			</Dropdown>
		}
	</div>;
}

function buildSlotCalculator(bonusedRoster: CrewItem[], event: EventDTO | undefined, activeShuttleAdventures: PlayerShuttleAdventureDTO[]): ShuttleCalc[] {
	let calcs: ShuttleCalc[] = [];

	activeShuttleAdventures.forEach(adventure => {
		let shuttle = adventure.shuttles[0];

		let slots: ShuttleCalcSlot[] = [];
		let calc: ShuttleCalc = {
			challenge_rating: adventure.challenge_rating,
			shuttle: adventure.shuttles[0],
			chance: (crew: (CrewItem | undefined)[], bonus: ItemDTO | undefined) => {
				let skillSum = 0;
				for (let i = 0; i < slots.length; ++i) {
					const ci = crew[i];
					if (ci) {
						skillSum += slots[i].crewValue(ci, bonus);
					}
				}
				return computeChance(adventure.challenge_rating, adventure.shuttles[0].slots.length, skillSum);
			},
			slots
		}
		calcs.push(calc);

		function updateBest(c: ShuttleCalc, cs: ShuttleCalcSlot) {
			// for best crew, doesn't really matter if they don't have the skill, so just include everyone
			cs.bestCrew = bonusedRoster.map(r => { return { ...r, total: cs.crewValue(r, undefined) }; }).sort((a, b) => b.total - a.total);
			cs.bestCrew.forEach((c) => {
				const isShared = (c.crew as any).crew_id === undefined;
				c.text = `${c.crew.name} (${c.total})`;
				if (isShared) {
					c.content = <span>{c.crew.name}{isShared ? ' - shared' : ''} <CrewSkills crew={c.crew as CrewData} useIcon={true} addScore={c.total} hideProf={true} /></span>;
				}
				else {
					c.content = <span>{c.crew.name} <CrewSkills crew={c.crew as CrewData} useIcon={true} addScore={c.total} hideProf={true} /></span>;
				}
				c.value = cid(c.crew);
				c.image = STTApi.imgUrl(c.crew.portrait, undefined); //TODO: will have to pass some context through to get this to refresh on load
			});
		}

		// NOTE: this assumes there are at most 2 skills in each slot
		shuttle.slots.forEach((slot, idx) => {
			if (slot.skills.length === 1) {
				// AND or single
				const sks = slot.skills[0].split(',');
				if (sks.length === 1) {
					const cs: ShuttleCalcSlot = {
						slotIndex: idx,
						skillText: CONFIG.SKILLS[sks[0]],
						crewValue: (crew: CrewItem, bonus: ItemDTO | undefined) => {
							const val = crew.skills[sks[0]] + skillBonus(bonus, sks[0]);
							return val;
						},
						bestCrew: []
					};
					calc.slots.push(cs);
					updateBest(calc, cs);
				} else {
					const cs: ShuttleCalcSlot = {
						slotIndex: idx,
						skillText: CONFIG.SKILLS[sks[0]] + " AND " + CONFIG.SKILLS[sks[1]],
						crewValue: (crew: CrewItem, bonus: ItemDTO | undefined) => {
							let a1 = crew.skills[sks[0]] + skillBonus(bonus, sks[0]);
							let a2 = crew.skills[sks[1]] + skillBonus(bonus, sks[1]);
							return Math.floor(
								Math.max(a1, a2) +
								(Math.min(a1, a2) * STTApi.serverConfig!.config.shuttle_adventures.secondary_skill_percentage)
							);
						},
						bestCrew: []
					};
					calc.slots.push(cs);
					updateBest(calc, cs);
				}
			} else {
				const cs = {
					slotIndex: idx,
					skillText: CONFIG.SKILLS[slot.skills[0]] + " OR " + CONFIG.SKILLS[slot.skills[1]],
					crewValue: (crew: CrewItem, bonus: ItemDTO | undefined) => {
						let a1 = crew.skills[slot.skills[0]] + skillBonus(bonus, slot.skills[0]);
						let a2 = crew.skills[slot.skills[1]] + skillBonus(bonus, slot.skills[1]);
						return Math.max(a1, a2);
					},
					bestCrew: []
				};

				calc.slots.push(cs);
				updateBest(calc, cs);
			}
		});
	});
	return calcs;
}
