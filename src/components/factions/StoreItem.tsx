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
	const [, imageCacheUpdated] = React.useState<string>('');
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
	let nobuy = true
	// #!if allowPush == true
	nobuy = false
	// #!endif

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
					src={STTApi.imgUrl(props.storeItem.offer.game_item.icon, imageCacheUpdated)}
					size={80}
					maxRarity={props.storeItem.offer.game_item.rarity}
					rarity={props.storeItem.offer.game_item.rarity}
					itemId={props.storeItem.offer.game_item.id}
					sources={sources}
				/>
			</Segment>
			<Button attached='bottom' primary disabled={locked || nobuy} onClick={() => props.onBuy()}>
				<span style={{ display: 'inline-block' }}>
					<img src={CONFIG.SPRITES[curr.icon].url} height={16} />
				</span>
				{props.storeItem.offer.cost.amount} {curr.name}
			</Button>
		</div>
	);
}
