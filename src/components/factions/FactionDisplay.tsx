import React from 'react';

import { Accordion } from 'semantic-ui-react';

import { ItemDisplay } from '../../utils/ItemDisplay';
import STTApi, { loadFactionStore, RarityStars } from '../../api';
import { FactionDTO, PotentialRewardDTO, RewardDTO, ItemArchetypeDTO, FactionStoreItemDTO } from '../../api/DTO';

import { StoreItem } from './StoreItem';

export const FactionDisplay = (props: {
	faction: FactionDTO;
}) => {
	const [showSpinner, setShowSpinner] = React.useState(true);
	const [, imageCacheUpdated] = React.useState<string>('');
	React.useEffect(() => refreshStore(), []);

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

	const token = STTApi.items.find(item => item.archetype_id === props.faction.shuttle_token_id);
	const tokens = token ? token.quantity : 0;
	const numRewardColumns = 4;
	const pluralize = (count: number, noun: string) => `${count} ${noun}${count !== 1 ? 's' : ''}`;
	return (
		<div className='faction-section'>
			<div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'icon description'`, gridGap: '10px' }}>
				<div style={{ gridArea: 'icon' }}>
					<img src={STTApi.imgUrl(props.faction.reputation_item_icon, imageCacheUpdated)} height={90} />
				</div>
				<div style={{ gridArea: 'description' }}>
					<h2>{props.faction.name}</h2>
					<h3>({`${_getReputationName(props.faction.reputation)} - ${pluralize(tokens, 'transmission')}`})</h3>
					<p>{pluralize(props.faction.completed_shuttle_adventures, 'completed shuttle adventure')}</p>
				</div>
			</div>
			<Accordion
				defaultActiveIndex={-1}
				className='faction-reward-list'
				panels={[
					{
						key: '1',
						title: 'Potential shuttle rewards',
						content: {
							style: {
								gridTemplateColumns: `repeat(${numRewardColumns}, 1fr)`,
								gridTemplateRows: `repeat(${Math.ceil(equipment.length / numRewardColumns)}, 1fr)`,
							},
							content: equipment
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((item, idx) => (
								<div key={idx}>
									<ItemDisplay
										style={{ display: 'inline-block' }}
										src={STTApi.imgUrl(item.icon, imageCacheUpdated)}
										size={24}
										maxRarity={item.rarity}
										rarity={item.rarity}
									/>{' '}
									{item.name}
									<RarityStars asSpan={true} max={item.rarity} value={item.rarity} />
								</div>
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

	function refreshStore() {
		loadFactionStore(props.faction).then(() => {
			setShowSpinner(false);
		});
	}

	function buyItem(storeItem: FactionStoreItemDTO) : void {
		let allowBuy = false;
		{/* #!if allowPush == true */}
		allowBuy = true;
		{/* #!endif */}
		if (!allowBuy) {
			return;
		}

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
}
