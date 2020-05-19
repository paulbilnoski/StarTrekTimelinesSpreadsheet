import React from 'react';

import { Accordion } from 'semantic-ui-react';

import { ItemDisplay } from '../../utils/ItemDisplay';
import STTApi, { loadFactionStore } from '../../api';
import { FactionDTO, PotentialRewardDTO, RewardDTO, ItemArchetypeDTO, FactionStoreItemDTO } from '../../api/DTO';

import { StoreItem } from './StoreItem';

interface FactionDisplayProps {
	faction: FactionDTO;
}

export const FactionDisplay = (props:FactionDisplayProps) => {
	const [reputationIconUrl, setReputationIconUrl] = React.useState('');
	const [showSpinner, setShowSpinner] = React.useState(true);

	//TODO: this could be partially looked up from STTApi.items instead of recursively scanned here (but only for inventory items, not for those not in inventory)
	let rewardItemIds = new Set();
	const scanRewards = (potential_rewards?: (PotentialRewardDTO | RewardDTO)[]) => {
		if (!potential_rewards)
			return;
		potential_rewards.forEach((reward: any) => {
			if (reward.potential_rewards) {
				scanRewards(reward.potential_rewards);
			} else if (reward.type === 2) {
				rewardItemIds.add(reward.id);
			}
		});
	};

	scanRewards(props.faction.shuttle_mission_rewards);

	let equipment : ItemArchetypeDTO[] = [];
	rewardItemIds.forEach(itemId => {
		let eq = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === itemId);
		if (eq) {
			equipment.push(eq);
		}
	});

	STTApi.imageProvider
		.getImageUrl(props.faction.reputation_item_icon.file, props.faction.id)
		.then(found => {
			if (found.url)
				setReputationIconUrl(found.url);
		})
		.catch(error => {
			console.warn(error);
		});

	refreshStore();

	function refreshStore() {
		loadFactionStore(props.faction).then(() => {
			setShowSpinner(false);
		});
	}

	function buyItem(storeItem: FactionStoreItemDTO) : void {
		let id = storeItem.symbol + ':';
		if (storeItem.offer.game_item.hash_key) {
			id += storeItem.offer.game_item.hash_key;
		}

		setShowSpinner(true);

		STTApi.executePostRequestWithUpdates('commerce/buy_direct_offer', { id, layout: props.faction.shop_layout, e: 0 }).then(
			_buyData => refreshStore()
		);
	}

	function renderStoreItems() {
		if (showSpinner) {
			return (
				<div className='centeredVerticalAndHorizontal'>
					<div className='ui centered text active inline loader'>Loading {props.faction.name} faction store...</div>
				</div>
			);
		}

		return (
			<div className='faction-store'>
				{props.faction.storeItems && props.faction.storeItems.map((storeItem, idx) => (
					<StoreItem key={idx} storeItem={storeItem} onBuy={() => buyItem(storeItem)} />
				))}
			</div>
		);
	}

	function _getReputationName(reputation: number) {
		for (let repBucket of STTApi.platformConfig!.config.faction_config.reputation_buckets) {
			// top bucket has null upper bound
			if (repBucket.upper_bound === undefined || repBucket.upper_bound == null || reputation < repBucket.upper_bound) {
				return repBucket.name;
			}
		}

		return 'Unknown';
	}

	let token = STTApi.items.find(item => item.archetype_id === props.faction.shuttle_token_id);
	let tokens = token ? token.quantity : 0;

	return (
		<div className='faction-section'>
			<div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'icon description'`, gridGap: '10px' }}>
				<div style={{ gridArea: 'icon' }}>
					<img src={reputationIconUrl} height={90} />
				</div>
				<div style={{ gridArea: 'description' }}>
					<h4>{props.faction.name}</h4>
					<p>
						Reputation: {_getReputationName(props.faction.reputation)} ({props.faction.completed_shuttle_adventures}{' '}
						completed shuttle adventures)
					</p>
					<h4>Transmissions: {tokens}</h4>
				</div>
			</div>
			<Accordion
				defaultActiveIndex={-1}
				panels={[
					{
						key: '1',
						title: 'Potential shuttle rewards',
						content: {
							content: equipment.map((item, idx) => (
								<span style={{ display: 'contents' }} key={idx}>
									<ItemDisplay
										style={{ display: 'inline-block' }}
										src={item.iconUrl ? item.iconUrl : ''}
										size={24}
										maxRarity={item.rarity}
										rarity={item.rarity}
									/>{' '}
									{item.name}
								</span>
							))
						}
					}
				]}
			/>
			<h5>Store</h5>
			{renderStoreItems()}
			<hr/>
		</div>
	);
}
