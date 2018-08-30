import React from 'react';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';

import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

import { download } from '../utils/pal';

import { parse as json2csv } from 'json2csv';

export class NeededEquipment extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			neededEquipment: [],
			cadetableItems: undefined,
			filters: {
				onlyFavorite: false,
				onlyNeeded: false,
				onlyFaction: false,
				cadetable: false
			}
		};
	}

	_getFilteredCrew(filters) {
		// filter out `crew.buyback` by default
		const crew = STTApi.roster.filter(({ buyback }) => buyback === false);

		// ideally we would iterate thru all filters - for now, maunally looking for onlyFavorite
		const filteredCrew = [].concat((!filters.onlyFavorite) ? crew : crew.filter(({ favorite }) => favorite === filters.onlyFavorite));

		return filteredCrew;
	}

	_getCadetableItems(){
		if(this.state.cadetableItems == undefined){
			const cadetableItems = new Map();		
			//Advanced Cadet Challenges offer the same rewards as Standard ones, so filter them to avoid duplicates
			let cadetMissions = STTApi.missions.filter(mission => mission.quests.filter(quest => quest.cadet).length > 0).filter(mission => mission.episode_title.indexOf("Adv") === -1);
			cadetMissions.forEach(cadetMission => {			
				cadetMission.quests.forEach(quest => {
					quest.mastery_levels.forEach(masteryLevel => {
						masteryLevel.rewards.filter(r => r.type === 0).forEach(reward => {
							reward.potential_rewards.forEach(item => {
								let info = {
									name: quest.name + " (" + cadetMission.episode_title + ")",
									mastery: masteryLevel.id
								};
								
								if(cadetableItems.has(item.id)){
									cadetableItems.get(item.id).push(info);
								} else {
									cadetableItems.set(item.id,[info]);
								}
							})					
						})									
					})				
				})
			});	
			this.state.cadetableItems = cadetableItems;	
		}
		return this.state.cadetableItems;
	}

	_getNeededEquipment(filteredCrew, filters) {
		let unparsedEquipment = [];
		let cadetableItems = this._getCadetableItems();
		for (let crew of filteredCrew) {

			crew.equipment_slots.forEach((equipment) => {
				if (!equipment.have) {
					unparsedEquipment.push({ archetype: equipment.archetype, need: 1 });
				}
			});
		}

		let mapUnowned = {};
		while (unparsedEquipment.length > 0) {
			let eq = unparsedEquipment.pop();
			let equipment = STTApi.itemArchetypeCache.archetypes.find(e => e.id === eq.archetype);

			if (equipment.recipe && equipment.recipe.demands && (equipment.recipe.demands.length > 0)) {
				// Let's add all children in the recipe, so that we can parse them on the next loop iteration
				equipment.recipe.demands.forEach((item) => unparsedEquipment.push({ archetype: item.archetype_id, need: item.count * eq.need }));
			} else if (equipment.item_sources && (equipment.item_sources.length > 0) || cadetableItems.has(equipment.id)) {
				let found = mapUnowned[eq.archetype];
				if (found) {
					found.needed += eq.need;
				} else {					
					let have = STTApi.playerData.character.items.find(item => item.archetype_id === eq.archetype);
					let isDisputeMissionObtainable = equipment.item_sources.filter(e => e.type === 0).length > 0;
					let isShipBattleObtainable = equipment.item_sources.filter(e => e.type === 2).length > 0;
					let isFactionObtainable = equipment.item_sources.filter(e => e.type === 1).length > 0;
					let isCadetable = cadetableItems.has(equipment.id);				
										
					mapUnowned[eq.archetype] = { 
						equipment, 
						needed: eq.need, 
						have: have ? have.quantity : 0, 
						isDisputeMissionObtainable: isDisputeMissionObtainable,  
						isShipBattleObtainable: isShipBattleObtainable,
						isFactionObtainable: isFactionObtainable,
						isCadetable: isCadetable
					};
				}
			} else {
				console.error(`This equipment has no recipe and no sources: '${equipment.name}'`);
			}
		}

		// Sort the map by "needed" descending
		let arr = Object.values(mapUnowned);
		arr.sort((a, b) => b.needed - a.needed);

		if (filters.onlyNeeded) {
			arr = arr.filter((entry) => entry.have < entry.needed);
		}

		if (filters.onlyFaction) {
			arr = arr.filter((entry) => !entry.isDisputeMissionObtainable && !entry.isShipBattleObtainable && entry.isFactionObtainable);
		}

		if (filters.cadetable) {
			arr = arr.filter((entry) => entry.isCadetable);
		}

		return arr;
	}

	_filterNeededEquipment(filters) {
		const filteredCrew = this._getFilteredCrew(filters);
		const neededEquipment = this._getNeededEquipment(filteredCrew, filters);

		return this.setState({
			neededEquipment: neededEquipment
		});
    }
    
    _toggleFilter(name) {
        const newFilters = Object.assign({}, this.state.filters);
		newFilters[name] = !newFilters[name];
		this.setState({
			filters: newFilters
        }, () => { this._updateCommandItems(); });

		return this._filterNeededEquipment(newFilters);
    }

	renderSources(equipment) {
		let disputeMissions = equipment.item_sources.filter(e => e.type === 0);
		let shipBattles = equipment.item_sources.filter(e => e.type === 2);
		let factions = equipment.item_sources.filter(e => e.type === 1);
		let cadetableItems = this._getCadetableItems();

		let res = [];

		if (disputeMissions.length > 0) {
			res.push(<div key={'disputeMissions'}>
				<b>Missions: </b>
				{disputeMissions.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade}/5, {(entry.energy_quotient * 100).toFixed(2)}%)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (shipBattles.length > 0) {
			res.push(<div key={'shipBattles'}>
				<b>Ship battles: </b>
				{shipBattles.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade}/5, {(entry.energy_quotient * 100).toFixed(2)}%)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if(cadetableItems.has(equipment.id)){
			res.push(<div key={'cadet'}>
				<b>Cadet missions: </b>
				{cadetableItems.get(equipment.id).map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span></span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (factions.length > 0) {
			res.push(<p key={'factions'}>
				<b>Faction missions: </b>
				{factions.map((entry, idx) =>
					`${entry.name} (${entry.chance_grade}/5, ${(entry.energy_quotient * 100).toFixed(2)}%)`
				).join(', ')}
			</p>)
		}		

		return <div>{res}</div>;
    }
    
    componentDidMount() {
        this._updateCommandItems();
        this._filterNeededEquipment(this.state.filters);
    }

    _updateCommandItems() {
        if (this.props.onCommandItemsUpdate) {
            this.props.onCommandItemsUpdate([
                {
                    key: 'settings',
                    text: 'Settings',
                    iconProps: { iconName: 'Equalizer' },
                    subMenuProps: {
                        items: [{
                            key: 'onlyFavorite',
                            text: 'Show only for favorite crew',
                            canCheck: true,
                            isChecked: this.state.filters.onlyFavorite,
                            onClick: () => { this._toggleFilter('onlyFavorite'); }
                        },
                        {
                            key: 'onlyNeeded',
                            text: 'Show only insufficient equipment',
                            canCheck: true,
                            isChecked: this.state.filters.onlyNeeded,
                            onClick: () => { this._toggleFilter('onlyNeeded'); }
                        },
                        {
                            key: 'onlyFaction',
                            text: 'Show items obtainable through faction missions only',
                            canCheck: true,
                            isChecked: this.state.filters.onlyFaction,
                            onClick: () => { this._toggleFilter('onlyFaction'); }
                        },
                        {
                            key: 'cadetable',
                            text: 'Show items obtainable through cadet missions only',
                            canCheck: true,
                            isChecked: this.state.filters.cadetable,
                            onClick: () => { this._toggleFilter('cadetable'); }
                        }]
                    }
                },
                {
                    key: 'exportCsv',
                    name: 'Export CSV...',
                    iconProps: { iconName: 'ExcelDocument' },
                    onClick: () => { this._exportCSV(); }
                }
            ]);
        }
    }

	render() {
		if (this.state.neededEquipment) {
			return (<div className='tab-panel' data-is-scrollable='true'>
				<p>Equipment required to fill all open slots for all crew currently in your roster.</p>
				<br />
				{this.state.neededEquipment.map((entry, idx) =>
					<div key={idx} style={{ display: 'grid', gridTemplateColumns: '128px auto', gridTemplateAreas: `'icon name' 'icon details'` }}>
						<div style={{ gridArea: 'icon' }}><ItemDisplay src={entry.equipment.iconUrl} size={128} maxRarity={entry.equipment.rarity} rarity={entry.equipment.rarity} /></div>
						<h4 style={{ gridArea: 'name', alignSelf: 'start', margin: '0' }}>{`${entry.equipment.name} (need ${entry.needed}, have ${entry.have})`}</h4>
						<div style={{ gridArea: 'details', alignSelf: 'start' }}>
							{this.renderSources(entry.equipment)}
						</div>
					</div>
				)}
			</div>);
		}
		else {
			return <span />;
		}
	}

	_exportCSV() {
		let fields = ['equipment.name', 'equipment.rarity', 'needed', 'have',
			{
				label: 'Missions',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 0).map((mission) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			},
			{
				label: 'Ship battles',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 2).map((mission) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			},
			{
				label: 'Faction missions',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 1).map((mission) => `${mission.name} (${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			}];

		let csv = json2csv(this.state.neededEquipment, { fields });

		let today = new Date();
		download('Equipment-' + (today.getUTCMonth() + 1) + '-' + (today.getUTCDate()) + '.csv', csv, 'Export needed equipment', 'Export');
	}
}