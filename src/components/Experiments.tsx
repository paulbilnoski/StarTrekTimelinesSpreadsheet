import React from 'react';

import { Button, Item, Image, List, Accordion, Icon, AccordionTitleProps } from 'semantic-ui-react';

import { ItemDisplay } from './ItemDisplay';

import STTApi from '../api';
import { EventDTO, EventGatherPoolAdventureDTO } from '../api/STTApi';

function parseAdventure(adventure: any, crew_bonuses: { [crew_symbol: string]: number } ) : any[] {
	let demands : any[] = [];
	adventure.demands.forEach((demand:any) => {
		let e = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === demand.archetype_id);
		if (!e) {
			return;
		}

		let skills = e.recipe.jackpot.skills;

		let calcSlot : any = {
			bestCrew: getRosterWithBonuses(crew_bonuses)
		};

		if (skills.length === 1) {
			// AND or single
			calcSlot.skills = skills[0].split(',');
			if (calcSlot.skills.length === 1) {
				calcSlot.type = 'SINGLE';
				calcSlot.bestCrew.forEach((c: any) => {
					c.total = c[calcSlot.skills[0]];
				});
			} else {
				calcSlot.type = 'AND';
				calcSlot.bestCrew.forEach((c: any) => {
					c.total = Math.floor((c[calcSlot.skills[0]] + c[calcSlot.skills[1]]) / 2);
				});
			}
		} else {
			// OR
			calcSlot.type = 'OR';
			calcSlot.skills = skills;
			calcSlot.bestCrew.forEach((c: any) => {
				c.total = Math.max(c[calcSlot.skills[0]], c[calcSlot.skills[1]]);
			});
		}

		let seen = new Set();
		calcSlot.bestCrew = calcSlot.bestCrew.filter((c: any) => c.total > 0).filter((c: any) => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
		calcSlot.bestCrew.sort((a:any, b:any) => a.total - b.total);
		calcSlot.bestCrew = calcSlot.bestCrew.reverse();

		calcSlot.bestCrew.forEach((c: any) => {
			c.crew = STTApi.roster.find(cr => cr.id === c.crew_id);
			c.text = `${c.crew.name} (${c.total})`;
			c.value = c.crew.symbol;
			c.image = c.crew.iconUrl;
		});

		const calcChance = (skillValue: number) => {
			let midpointOffset = skillValue / STTApi.serverConfig!.config.craft_config.specialist_challenge_rating;

			let val = Math.floor(
				100 /
					(1 +
						Math.exp(
							-STTApi.serverConfig!.config.craft_config.specialist_chance_formula.steepness *
								(midpointOffset - STTApi.serverConfig!.config.craft_config.specialist_chance_formula.midpoint)
						))
			);

			return Math.min(val, STTApi.serverConfig!.config.craft_config.specialist_maximum_success_chance);
		};

		let bestCrewChance = calcChance(calcSlot.bestCrew[0].total);

		if (e.recipe.jackpot.trait_bonuses) {
			for (let trait in e.recipe.jackpot.trait_bonuses) {
				if (calcSlot.bestCrew[0].crew.rawTraits.includes(trait)) {
					bestCrewChance += e.recipe.jackpot.trait_bonuses[trait];
				}
			}
		}

		bestCrewChance = Math.floor(Math.min(bestCrewChance, 1) * 100);

		let itemDemands = [];
		for (let rd of e.recipe.demands) {
			let item = STTApi.playerData.character.items.find(item => item.archetype_id === rd.archetype_id);
			itemDemands.push({
				rd,
				item
			});
		}

		let have = STTApi.playerData.character.items.find(item => item.archetype_id === e!.id);

		let craftCost = 0;
		if (e.type === 3) {
			craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_component[e.rarity].amount;
		} else if (e.type === 2) {
			craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_equipment[e.rarity].amount;
		} else {
			console.warn('Equipment of unknown type', e);
		}

		demands.push({
			equipment: e,
			bestCrewChance,
			calcSlot,
			craftCost,
			have: have ? have.quantity : 0,
			itemDemands
		});
	});

	return demands;
}

function getRosterWithBonuses(crew_bonuses: { [crew_symbol: string]: number }) {
	// TODO: share some of this code with Shuttles
	let sortedRoster : any[] = [];
	STTApi.roster.forEach(crew => {
		if (crew.buyback || crew.frozen > 0 || crew.active_id) {
			return;
		}

		let bonus = 1;
		if (crew_bonuses[crew.symbol]) {
			bonus = crew_bonuses[crew.symbol];
		}

		sortedRoster.push({
			crew_id: crew.id,
			command_skill: crew.command_skill.core * bonus,
			science_skill: crew.science_skill.core * bonus,
			security_skill: crew.security_skill.core * bonus,
			engineering_skill: crew.engineering_skill.core * bonus,
			diplomacy_skill: crew.diplomacy_skill.core * bonus,
			medicine_skill: crew.medicine_skill.core * bonus,
			total: 0
		});
	});

	return sortedRoster;
}

interface GalaxyAdventureDemandProps {
	onUpdate : () => void;
	demand: any;
}

const GalaxyAdventureDemand = (props: GalaxyAdventureDemandProps) => {
	function _craft(equipmentId: any, crewId: any, recipeValidHash: any) {
		STTApi.executePostRequestWithUpdates('item/craft', { id: equipmentId, crew_buff_id: crewId, recipe_valid: recipeValidHash }).then(
			buyData => {
				props.onUpdate();
			}
		);
	}

	let demand = props.demand;
	let canCraft = !demand.itemDemands.some((id: any) => !id.item);

	return (
		<Item>
			<Item.Image size='tiny' src={demand.equipment.iconUrl} />
			<Item.Content>
				<Item.Header>
					{demand.equipment.name} (have {demand.have})
				</Item.Header>
				<Item.Description>
					<p>
						{demand.itemDemands
							.map((id: any) => `${id.item ? id.item.name : 'NEED'} x ${id.rd.count} (have ${id.item ? id.item.quantity : 0})`)
							.join(', ')}
					</p>
					<p>
						Best crew: {demand.calcSlot.bestCrew[0].crew.name} ({demand.bestCrewChance}%)
					</p>
				</Item.Description>
				<Item.Extra>
					<Button
						floated='right'
						disabled={!canCraft}
						onClick={() =>
							_craft(demand.equipment.id, demand.calcSlot.bestCrew[0].crew.crew_id, demand.equipment.recipe.validity_hash)
						}
						content={`Craft (${demand.craftCost} credits)`}
					/>
				</Item.Extra>
			</Item.Content>
		</Item>
	);
}

interface GalaxyAdventureProps {
	adventure: EventGatherPoolAdventureDTO;
	crew_bonuses: {[ crew_symbol: string] : number };
}

const GalaxyAdventure = (props: GalaxyAdventureProps) => {
	let adventure_name = '';
	let adventure_demands = [];

	const [, updateState] = React.useState();
	const forceUpdate = React.useCallback(() => updateState({}), []);

	if (!props.adventure.golden_octopus) {
		adventure_name = props.adventure.name,
		adventure_demands = parseAdventure(props.adventure, props.crew_bonuses)
	}

	function _completeAdventure() {
		let activeEvent = STTApi.playerData.character.events[0];

		let pool = activeEvent.content.gather_pools[0].id;
		let event_instance_id = activeEvent.instance_id;
		let phase = activeEvent.opened_phase;
		let adventure = activeEvent.content.gather_pools[0].adventures[0].id;

		STTApi.executePostRequestWithUpdates('gather/complete', {
			event_instance_id: 134,
			phase: 0,
			pool: 142,
			adventure: 807
		});
	}

	if (props.adventure.golden_octopus) {
		return <p>VP adventure TODO</p>;
	}

	return (
		<div style={{ padding: '10px' }}>
			<h4>{adventure_name}</h4>
			<Item.Group divided>
				{adventure_demands.map(demand => (
					<GalaxyAdventureDemand
						key={demand.equipment.name}
						demand={demand}
						onUpdate={() => forceUpdate() }
					/>
				))}
			</Item.Group>
		</div>
	);
}

const GalaxyEvent = () => {
	let [activeIndex, setActiveIndex ] = React.useState(-1);

	let crew_bonuses = [];
	let eventEquip = [];
	let farmList : any[] = [];
	let currEvent : EventDTO | undefined = undefined;

	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content &&
		STTApi.playerData.character.events[0].content.content_type === 'gather' &&
		STTApi.playerData.character.events[0].content.gather_pools
	) {
		currEvent = STTApi.playerData.character.events[0]

		for (let cb in STTApi.playerData.character.events[0].content.crew_bonuses) {
			let avatar = STTApi.getCrewAvatarBySymbol(cb);
			if (!avatar) {
				continue;
			}

			crew_bonuses.push({
				avatar,
				bonus: STTApi.playerData.character.events[0].content.crew_bonuses[cb],
				iconUrl: STTApi.imageProvider.getCrewCached(avatar, false)
			});
		}

		for (let e of STTApi.itemArchetypeCache.archetypes) {
			if (e.recipe && e.recipe.jackpot && e.recipe.jackpot.trait_bonuses) {
				let itemDemands = [];
				for (let rd of e.recipe.demands) {
					let item = STTApi.playerData.character.items.find(item => item.archetype_id === rd.archetype_id);
					let arc = STTApi.itemArchetypeCache.archetypes.find(a => a.id === rd.archetype_id);

					itemDemands.push({
						rd,
						item,
						item_name: item ? item.name : arc ? arc.name : '',
						item_quantity: item ? item.quantity : 0
					});
				}

				let have = STTApi.playerData.character.items.find(item => item.archetype_id === e.id);

				eventEquip.push({
					equip: e,
					have,
					itemDemands
				});
			}
		}

		let farmingList = new Map();
		eventEquip.forEach(e =>
			e.itemDemands.forEach(id => {
				if (farmingList.has(id.rd.archetype_id)) {
					farmingList.set(id.rd.archetype_id, farmingList.get(id.rd.archetype_id) + id.rd.count);
				} else {
					farmingList.set(id.rd.archetype_id, id.rd.count);
				}
			})
		);

		farmingList.forEach((v, k) => {
			farmList.push({
				equipment: STTApi.itemArchetypeCache.archetypes.find(a => a.id === k),
				count: v
			});
		});

		// TODO: compare with future galaxy events
		let toSave = farmList.map(fl => ({ equipment_id: fl.equipment.id, equipment_symbol: fl.equipment.symbol, count: fl.count }));
		console.log(toSave);

		// this.state = { event: STTApi.playerData.character.events[0], crew_bonuses, activeIndex: -1, eventEquip, farmList };
	// } else {
	// 	this.state = { event: undefined };
	}

	function _handleClick(titleProps: AccordionTitleProps) {
		const { index } = titleProps;
		//const { activeIndex } = this.state;
		const newIndex = activeIndex === index ? -1 : index as number;

		//this.setState({ activeIndex: newIndex });
		setActiveIndex(newIndex);
	}

	if (!currEvent) {
		return <p>Not in a galaxy event!</p>;
	}

	let adventures = currEvent.content.gather_pools[0].adventures;

	// const { activeIndex, farmList, eventEquip } = this.state;
	return (
		<div>
			<h3>Galaxy event: {currEvent.name}</h3>

			<Accordion>
				<Accordion.Title active={activeIndex === 0} index={0} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Farming list for Galaxy event
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 0}>
					{farmList.map(item => (
						<div key={item.equipment.id} style={{ display: 'contents' }}>
							<ItemDisplay
								style={{ display: 'inline-block' }}
								src={item.equipment.iconUrl}
								size={24}
								maxRarity={item.equipment.rarity}
								rarity={item.equipment.rarity}
							/>{' '}
							{item.equipment.name} x {item.count}
						</div>
					))}
				</Accordion.Content>
				<Accordion.Title active={activeIndex === 1} index={1} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Event equipment requirements
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 1}>
					{eventEquip.map(e => (
						<div key={e.equip.id}>
							<h3>
								{e.equip.name} (have {e.have ? e.have.quantity : 0})
							</h3>
							<p>{e.itemDemands.map(id => `${id.item_name} x ${id.rd.count} (have ${id.item_quantity})`).join(', ')}</p>
						</div>
					))}
				</Accordion.Content>
				<Accordion.Title active={activeIndex === 2} index={2} onClick={(e, titleProps) => _handleClick(titleProps)}>
					<Icon name='dropdown' />
					Crew bonuses
				</Accordion.Title>
				<Accordion.Content active={activeIndex === 2}>
					<List horizontal>
						{crew_bonuses.map(cb => (
							<List.Item key={cb.avatar.symbol}>
								<Image avatar src={cb.iconUrl} />
								<List.Content>
									<List.Header>{cb.avatar.name}</List.Header>
									Bonus level {cb.bonus}x
								</List.Content>
							</List.Item>
						))}
					</List>
				</Accordion.Content>
			</Accordion>

			<h4>Active adventures in the pool</h4>
			{adventures.map((adventure) => (
				<GalaxyAdventure key={adventure.name} adventure={adventure} crew_bonuses={currEvent!.content.crew_bonuses!} />
			))}
		</div>
	);
}

export const Experiments = () => {
	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<h2>This page contains unfinished experiments, for developer testing; you probably don't want to invoke any buttons here :)</h2>

			<GalaxyEvent />
		</div>
	);
}
