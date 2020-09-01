import React from 'react';
import ReactTable, { SortingRule } from 'react-table';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { ProgressIndicator } from 'office-ui-fabric-react/lib/ProgressIndicator';

import { ItemDisplay } from '../../utils/ItemDisplay';
import UserStore from '../Styles';

import STTApi, { CONFIG, RarityStars } from '../../api';
import { ItemData, ItemArchetypeDTO } from '../../api/DTO';
import { ReplicatorFuel, computeExtraSchematics, computeExtraItems,
	replicatorCurrencyCost, replicatorFuelCost, canReplicate,
	replicatorFuelValue, canUseAsFuel, replicate } from './ReplicatorTools';

type FuelTankItem = {
	name: string;
	quantity: number;
	id: number;
	type: number;
	rarity: number;
	item: ItemData;
};

export const ReplicatorDialog = (props:{
	targetArchetype?: ItemArchetypeDTO;
	onReplicate?: () => void;
	onClose?: () => void;
}) => {
	const [showDialog, setShowDialog] = React.useState(false);
	const [fuelconfig, setFuelConfig] = React.useState('extraSchematics');
	const [fuellist, setFuelList] = React.useState([] as ItemData[]);
	const [fuelPageSize, setFuelPageSize] = React.useState<number>(10);
	const [fueltank, setFuelTank] = React.useState([] as FuelTankItem[]);
	const [fuelTankValue, setFuelTankValue] = React.useState(0);
	const [fuelCost, setFuelCost] = React.useState(1000);
	const [canBeReplicated, setCanBeReplicated] = React.useState(false);
	const [currencyCost, setCurrencyCost] = React.useState(undefined as number | undefined);
	const [targetArchetype, setTargetArchetype] = React.useState(props.targetArchetype);
	const [sortedAvailable, setSortedAvailable] = React.useState([{ id: 'name', desc: false }] as SortingRule[]);
	const [errorMessage, setErrorMessage] = React.useState(undefined as string | undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	// Call when props change
	React.useEffect(() => {
		show();
	}, [props.targetArchetype]);

	function show() {
		if (!props.targetArchetype) {
			return;
		}
		// Go ahead and show the dialog so it can display the error message
		setShowDialog(true);
		setTargetArchetype(props.targetArchetype);
		if (STTApi.playerData.replicator_uses_today >= STTApi.playerData.replicator_limit) {
			setCanBeReplicated(false);
			setErrorMessage('You have used your '+STTApi.playerData.replicator_limit+' replicator uses today');
			return;
		}

		let canRep = canReplicate(props.targetArchetype.id);
		if (!canRep) {
			setCanBeReplicated(false);
			console.log("Can not be replicated " + props.targetArchetype.name);
			return;
		}
		let fuelCost = replicatorFuelCost(props.targetArchetype.type, props.targetArchetype.rarity);
		if (!fuelCost) {
			setCanBeReplicated(false);
			console.log("Can not be replicated (no fuel cost) " + props.targetArchetype.name);
			return;
		}

		setCanBeReplicated(true);
		let currencyCost = replicatorCurrencyCost(props.targetArchetype.id, props.targetArchetype.rarity);

		setFuelCost(fuelCost);
		setCurrencyCost(currencyCost);

		if (props.targetArchetype.type !== 2 && props.targetArchetype.type !== 3 && props.targetArchetype.type !== 9) {
			setErrorMessage('Item might not replicate, type is ' + CONFIG.REWARDS_ITEM_TYPE[props.targetArchetype.type]);
		}

		reloadItems(fuelconfig);
	}

	function closeDialog() {
		setShowDialog(false);
		setErrorMessage(undefined);
		setFuelTankValue(0);
		setFuelTank([]);
		setTargetArchetype(undefined);

		if (props.onClose) {
			props.onClose();
		}
	}

	function reloadItems(fuelConfig: string) {
		if (fuelConfig === 'everything') {
			setFuelList(STTApi.items);
		} else if (fuelConfig === 'extraSchematics') {
			setFuelList(computeExtraSchematics());
		} else if (fuelConfig === 'extraItems') {
			setFuelList(computeExtraItems());
		} else if (fuelConfig === 'trainers') {
			setFuelList(STTApi.items.filter(item => item.type === 7));
		} else if (fuelConfig === 'rations') {
			setFuelList(STTApi.items.filter(item => item.type === 9));
		} else {
			setFuelList([]);
		}
	}

	function removeFromTank(fuel: FuelTankItem) {
		let currentTank = fueltank;
		currentTank.splice(currentTank.indexOf(fuel), 1);

		let fuelValue = fuelTankValue - replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;

		setFuelTank(currentTank);
		setFuelTankValue(fuelValue);
	}

	// Add the item to the tank and return the remaining needed fuel cost
	function tankAdd(item: ItemData, amount: string | number | undefined) : {remainingCost:number; added:number;} {
		let neededFuelCost = fuelCost - fuelTankValue;

		if (neededFuelCost <= 0 || !canUseAsFuel(item.id)) {
			return {remainingCost:neededFuelCost, added:0};
		}

		if (amount === undefined) {
			amount = item.quantity;
		}
		if (typeof amount === 'string') {
			amount = parseInt(amount, 10);

			// unparseable or blank, use max available
			if (Number.isNaN(amount)) {
				amount = item.quantity;
			}
		}

		if (amount <= 0 || item.quantity <= 0) {
			return { remainingCost: neededFuelCost, added: 0 };
		}

		let currentTank = fueltank;
		let fuelValue = replicatorFuelValue(item.type, item.rarity);
		let neededQuantity = Math.ceil(neededFuelCost / fuelValue);

		if (amount > neededQuantity) {
			amount = neededQuantity;
		}

		let found = currentTank.find(fti => fti.id === item.id);
		// Add requested amount
		if (found) {
			found.quantity += amount;
			if (found.quantity > item.quantity) {
				found.quantity = item.quantity;
			}
		}
		else {
			currentTank.push({
				name: item.name,
				quantity: amount,
				// Not for display
				id: item.id,
				type: item.type,
				rarity: item.rarity,
				item
			});
		}

		// Calculate value
		let tankTotal = 0;
		for (let fuel of currentTank) {
			tankTotal += replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;
		}

		setFuelTank(currentTank);
		setFuelTankValue(tankTotal);

		return {
			remainingCost: neededFuelCost - (fuelValue * amount),
			added: amount
		}
	}

	function autoFill() {
		for (let item of fuellist) {
			let {remainingCost, added } = tankAdd(item, undefined);
			if (remainingCost <= 0) {
				break;
			}
		}
	}

	async function doReplicate() {
		let fuel : ReplicatorFuel[] = [];
		for (let item of fueltank) {
			fuel.push({
				archetype_id: item.item.archetype_id,
				quantity: item.quantity
			});
		}

		try {
			await replicate(targetArchetype!.id, fuel);

			closeDialog();
			if (props.onReplicate) {
				props.onReplicate();
			}
		} catch (err) {
			console.error(err);
			setErrorMessage(err.message ? err.message : err);
		}
	}

	if (!showDialog || !targetArchetype) {
		return <span />;
	}

	let currentTheme = UserStore.get('theme');
	const MAX_PAGE_SIZE = fuelPageSize;

	return <Dialog
		hidden={!showDialog}
		onDismiss={closeDialog}
		dialogContentProps={{
			type: DialogType.normal,
			title: `Replicate one ${CONFIG.RARITIES[targetArchetype!.rarity].name} ${targetArchetype!.name}`
		}}
		modalProps={{
			containerClassName: 'replicatordialogMainOverride',
			isBlocking: true
		}}>
		<div
			style={{
				minWidth: '800px',
				color: currentTheme.semanticColors.bodyText,
				backgroundColor: currentTheme.semanticColors.bodyBackground
			}}>
			{!canBeReplicated &&
				<div style={{ color: 'red' }}>
					<b>This item cannot be replicated!</b>
				</div>
			}
			{errorMessage &&
				<div style={{ color: 'red' }}>
					<b>Failed to replicate: {errorMessage}</b>
				</div>
			}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '9fr 7fr',
					gridGap: '6px',
					gridTemplateAreas: `'fuelconfig fueltank' 'fuellist fueltank' 'fuellist details'`
				}}>
				<div style={{ gridArea: 'fuelconfig', display: 'grid', gridTemplateColumns: '2fr 1fr' }}>
					<Dropdown
						selectedKey={fuelconfig}
						onChange={(evt, item) => {
							setFuelConfig(item!.key as string);
							reloadItems(item!.key as string);
						}}
						placeholder='What kind of items?'
						options={[
							{ key: 'extraSchematics', text: 'Unneeded ship schematics' },
							{ key: 'extraItems', text: 'Potentially unneeded items' },
							{ key: 'trainers', text: 'Crew Experience Training' },
							{ key: 'rations', text: 'Replicator Ration' },
							{ key: 'everything', text: 'All items' }
						]}
					/>
					<DefaultButton onClick={() => autoFill()} text='Auto fill >' />
				</div>
				<div style={{ gridArea: 'fuellist' }}>
					<ReactTable
						data={fuellist}
						columns={[
							{
								id: 'icon',
								Header: '',
								minWidth: 50,
								maxWidth: 50,
								resizable: false,
								sortable: false,
								accessor: 'name',
								Cell: p => <ItemDisplay src={STTApi.imgUrl((p.original as ItemData).icon, imageCacheUpdated)} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
							},
							{
								id: 'name',
								Header: 'Name',
								minWidth: 90,
								maxWidth: 180,
								resizable: true,
								sortable: true,
								accessor: 'name'
							},
							{
								id: 'rarity',
								Header: 'Rarity',
								minWidth: 30,
								maxWidth: 40,
								resizable: true,
								sortable: true,
								accessor: 'rarity',
								// Cell: (cell) => {
								// 	let item = cell.original;
								// 	return <RarityStars min={1} max={item.rarity} value={item.rarity ? item.rarity : null} />;
								// }
							},
							{
								id: 'quantity',
								Header: 'Quantity',
								accessor: 'quantity',
								minWidth: 50,
								maxWidth: 80,
								resizable: true,
								sortable: true,
								Cell: row => {
									let quant = row.original.quantity;
									let found = fueltank.find(item => item.id === row.original.id);
									if (found) {
										return found.quantity + ' / ' + quant;
									}
									return quant;
								}
							},
							{
								id: 'burncount',
								Header: 'Use as fuel',
								minWidth: 120,
								maxWidth: 140,
								sortable: false,
								resizable: true,
								Cell: row => {
									let ref = React.createRef<HTMLInputElement>();
									return <div className='ui action input' style={{ width: '100px' }}>
										<input type='text' placeholder='Count...' ref={ref} />
										<button className='ui icon button'
											onClick={() => tankAdd(row.original, ref.current!.value)}
											disabled={!canBeReplicated}
											>
											<i className='angle double right icon' />
										</button>
									</div>;
								}
							}
						]}
						sorted={sortedAvailable}
						onSortedChange={sorted => setSortedAvailable(sorted)}
						showPageSizeOptions={true}
						onPageSizeChange={(sz, pg) => setFuelPageSize(sz)}
						defaultPageSize={fuellist.length <= MAX_PAGE_SIZE ? fuellist.length : MAX_PAGE_SIZE}
						pageSize={fuellist.length <= MAX_PAGE_SIZE ? fuellist.length : MAX_PAGE_SIZE}
						showPagination={fuellist.length > MAX_PAGE_SIZE}
						className='-striped -highlight'
						style={{ height: '45vh' }}
					/>
				</div>
				<div style={{ gridArea: 'fueltank' }}>
					<ReactTable
						data={fueltank}
						columns={[
							{
								id: 'icon',
								Header: '',
								minWidth: 50,
								maxWidth: 50,
								resizable: false,
								sortable: false,
								accessor: 'name',
								Cell: p => <ItemDisplay src={STTApi.imgUrl((p.original as FuelTankItem).item.icon, imageCacheUpdated)} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
							},
							{
								id: 'name',
								Header: 'Name',
								minWidth: 90,
								maxWidth: 180,
								resizable: true,
								accessor: 'name'
							},
							{
								id: 'quantity',
								Header: 'Burn quantity',
								minWidth: 40,
								maxWidth: 60,
								resizable: true,
								accessor: 'quantity'
							},
							{
								id: 'remove',
								Header: 'Remove',
								minWidth: 50,
								maxWidth: 50,
								sortable: false,
								resizable: true,
								Cell: row => (
									<button className='ui icon button' onClick={() => removeFromTank(row.original)}>
										<i className='icon close' />
									</button>
								)
							}
						]}
						showPagination={false}
						showPageSizeOptions={false}
						className='-striped -highlight'
						style={{ height: '40vh' }}
					/>
					<ProgressIndicator
						description={`Fuel: ${fuelTankValue} of ${fuelCost}`}
						percentComplete={(fuelTankValue / fuelCost)}
						barHeight={4}
					/>
				</div>
				<div style={{ gridArea: 'details' }}>
					<p>Cost: {currencyCost} credits</p>
				</div>
			</div>
		</div>

		<DialogFooter>
			{/* #!if allowPush == true */}
			<PrimaryButton
				onClick={doReplicate}
				text='Replicate'
				disabled={!canBeReplicated || fuelTankValue < fuelCost}
			/>
			{/* #!endif */}
			<DefaultButton onClick={closeDialog} text='Cancel' />
		</DialogFooter>
	</Dialog>
}
