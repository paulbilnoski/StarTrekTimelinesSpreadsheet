import React from 'react';

import { Button, Segment, Header } from 'semantic-ui-react';
import { getTheme } from '@uifabric/styling';

import STTApi, { CONFIG } from '../../api';
import { FactionStoreItemDTO } from '../../api/DTO';
import { ItemDisplay } from '../../utils/ItemDisplay';
import { CrewImageData } from '../images/ImageProvider';

export const StoreItem = (props: {
	storeItem: FactionStoreItemDTO;
	onBuy: () => void;
}) => {
	let archetypes = STTApi.itemArchetypeCache.archetypes;
	let equipment = archetypes.find(e => e.id === props.storeItem.offer.game_item.id);
	let sources = undefined;
	if (equipment) {
		let isMission = equipment.item_sources.filter(e => e.type === 0).length > 0;
		let isShipBattle = equipment.item_sources.filter(e => e.type === 2).length > 0;
		// obviously it is faction obtainable since this is a faction item
		//let isFaction = equipment.item_sources.filter(e => e.type === 1).length > 0;
		//TODO: figure out cadet mission availability
		if (!isMission && !isShipBattle) {
			sources = '*';
		}
	}

	let curr = CONFIG.CURRENCIES[props.storeItem.offer.cost.currency];
	let locked = props.storeItem.locked || props.storeItem.offer.purchase_avail === 0;

	let tempUrl;
	if (props.storeItem.offer.game_item.type === 1) {
		tempUrl = STTApi.imageProvider.getCrewCached(props.storeItem.offer.game_item as CrewImageData, false);
	} else {
		tempUrl = STTApi.imageProvider.getCached(props.storeItem.offer.game_item);
	}
	const [iconUrl, setIconUrl] = React.useState(tempUrl);
	if (!tempUrl) {
		// some items don't get cached if you don't already own them, so load them now
		STTApi.imageProvider.getItemImageUrl(props.storeItem.offer.game_item, props.storeItem.offer.game_item.id)
			.then(found => {
				if (found.url) {
					setIconUrl(found.url);
				}
			});
	}

	const currentPalette = getTheme().palette;
	return (
		<div className='faction-store-item'>
			<Header
				as='h5'
				attached='top'
				style={{
					color: locked ? currentPalette.neutralTertiary : currentPalette.neutralDark,
					backgroundColor: locked ? currentPalette.neutralLighter : currentPalette.themeLighter,
				}}>
				{props.storeItem.offer.game_item.name}
			</Header>
			<Segment attached style={{ backgroundColor: locked ? currentPalette.neutralLighter : currentPalette.themeLighter }}>
				<ItemDisplay
					style={{ marginLeft: 'auto', marginRight: 'auto', opacity: locked ? '50%' : '100%' }}
					src={iconUrl}
					size={80}
					maxRarity={props.storeItem.offer.game_item.rarity}
					rarity={props.storeItem.offer.game_item.rarity}
					itemId={props.storeItem.offer.game_item.id}
					sources={sources}
				/>
			</Segment>
			<Button attached='bottom' primary disabled={locked} onClick={() => props.onBuy()}>
				<span style={{ display: 'inline-block' }}>
					<img src={CONFIG.SPRITES[curr.icon].url} height={16} />
				</span>
				{props.storeItem.offer.cost.amount} {curr.name}
			</Button>
		</div>
	);
}
