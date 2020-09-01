import React from 'react';

import STTApi, { CONFIG, RarityStars } from '../../api';
import { CrewData } from '../../api/DTO';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { ButtonGroup, Button, ToggleButton } from 'react-bootstrap';
import ReactTable, { Column } from 'react-table';

interface RankMeta {
	title: string;
	valueTitle: string;
	compareFn: (a:CrewData, b:CrewData) => number;
	valueFn: (c:CrewData) => number;
	valueText?: (c:CrewData) => string;
	showRarity?: boolean;
}

export const CrewTopPage = (props: {
	onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}) => {
	//TODO: allow 'all crew' toggle
	const [showFrozen, setShowFrozen] = React.useState<boolean>(false);
	const [displayMode, setDisplayMode] = React.useState<string>('Base');
	const [crewData, setCrewData] = React.useState<CrewData[]>([]);
	const [displayCount, setDisplayCount] = React.useState<number>(10);

	React.useEffect(() => {
		setCrewData(loadCrewData());
	}, [showFrozen]);

	React.useEffect(() => {
		_updateCommandItems();
	}, [showFrozen]);

	const displayModes = ['Base', 'Base Rank', 'Gauntlet', 'Gauntlet Rank'];//, 'Shuttle Pair'];

	//TODO: based on current display mode, get meta for the tables to show
	let rankMeta : RankMeta[] = [];
	if (displayMode === displayModes[0]) {
		Object.keys(CONFIG.SKILLS).forEach(sk => {
			rankMeta.push({
				title: CONFIG.SKILLS[sk],
				valueTitle: 'Value',
				// Base skill rank is DESC, so get b-a
				compareFn: (a,b) => (b.skills[sk]?.core ?? 0) - (a.skills[sk]?.core ?? 0),
				valueFn: (c) => c.skills[sk]?.core ?? 0,
				valueText: (c) => {
					let v = c.skills[sk]?.core ?? 0;
					if (c.rarity === c.max_rarity) {
						return '' + v;
					}
					const max = STTApi.allcrew.find(ac => ac.symbol === c.symbol);
					if (!max) {
						return '' + v;
					}
					return v + ' (' + (max.skills[sk]?.core ?? 0) + ')';
				},
				showRarity: true,
			});
		});
	}
	else if (displayMode === displayModes[1]) {
		Object.keys(CONFIG.SKILLS).forEach(skA => {
			const skA_short = CONFIG.SKILLS_SHORT[skA];
			rankMeta.push({
				title: skA_short,
				valueTitle: 'Rank',
				// gauntlet 'rank' is ASC, so get a-b
				compareFn: (a, b) => (a.datacore?.ranks['B_' + skA_short] ?? 10000) - (b.datacore?.ranks['B_' + skA_short] ?? 10000),
				valueFn: (c) => c.datacore?.ranks['B_' + skA_short] ?? 0,
				showRarity: true,
			});
		});
	}
	else if (displayMode === displayModes[2]) {
		Object.keys(CONFIG.SKILLS).forEach(skA => {
			const skA_short = CONFIG.SKILLS_SHORT[skA];
			Object.keys(CONFIG.SKILLS).forEach(skB => {
				if (skB === skA) return;
				const skB_short = CONFIG.SKILLS_SHORT[skB];
				if (rankMeta.find(rm => rm.title === skB_short + '-' + skA_short)) return;
				rankMeta.push({
					title: skA_short + '-' + skB_short,
					valueTitle: 'Value',
					// gauntlet 'value' is DESC, so get a-b
					compareFn: (a, b) => ((b.skills[skA]?.max ?? 0) + (b.skills[skB]?.max ?? 0)) - ((a.skills[skA]?.max ?? 0) + (a.skills[skB]?.max ?? 0)),
					valueFn: (c) => ((c.skills[skA]?.max ?? 0) + (c.skills[skB]?.max ?? 0))
				});
			});
		});
	}
	else if (displayMode === displayModes[3]) {
		Object.keys(CONFIG.SKILLS).forEach(skA => {
			const skA_short = CONFIG.SKILLS_SHORT[skA];
			Object.keys(CONFIG.SKILLS).forEach(skB => {
				if (skB === skA) return;
				const skB_short = CONFIG.SKILLS_SHORT[skB];
				rankMeta.push({
					title: skA_short + '-' + skB_short,
					valueTitle: 'Rank',
					// gauntlet 'rank' is ASC, so get a-b
					compareFn: (a, b) => (a.datacore?.ranks['G_' + skA_short + '_' + skB_short] ?? 10000) - (b.datacore?.ranks['G_' + skA_short + '_' + skB_short] ?? 10000),
					valueFn: (c) => c.datacore?.ranks['G_' + skA_short + '_' + skB_short] ?? 0
				});
			});
		});
	}

	return <div>
		<div className="mx-auto" style={{ display: 'block', width: '450px' }}>
			<ButtonGroup toggle>
				{
					displayModes.map(dm =>
						<ToggleButton key={dm} type="radio" value={dm} checked={displayMode === dm}
							onClick={() => setDisplayMode(dm)}>{dm}</ToggleButton>
					)
				}
			</ButtonGroup>
		</div>
		<CrewTopList
			data={crewData}
			count={displayCount}
			meta={rankMeta} />
	</div>;

	function loadCrewData() : CrewData[] {
		let crewData = STTApi.roster;

		crewData = crewData.filter(crew => !crew.status.buyback);

		if (!showFrozen) {
			crewData = crewData.filter(crew => crew.status.frozen <= 0);
		}

		return crewData;
	}

	function _updateCommandItems() {
		if (props.onCommandItemsUpdate) {
			props.onCommandItemsUpdate([
				{
					key: 'settings',
					text: 'Settings',
					iconProps: { iconName: 'Equalizer' },
					subMenuProps: {
						items: [{
							key: 'showFrozen',
							text: 'Show frozen crew',
							canCheck: true,
							isChecked: showFrozen,
							onClick: () => {
								let isChecked = !showFrozen;
								setShowFrozen(isChecked);
								setCrewData(loadCrewData());
							}
						}]
					}
				}
			]);
		}
	}
}

export const CrewTopList = (props: {
	data: CrewData[];
	meta: RankMeta[];
	count: number;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');

	const rowData: CrewData[][] = processData();
	const columns = getColumns(rowData);

	return (
		<div className={'embedded-crew-grid'} data-is-scrollable='true'>
			<ReactTable
				data={rowData}
				columns={columns}
				className="-striped -highlight"
				showPagination={false}
				style={ { height: 'calc(100vh - 92px - 34px)' } }
				getTrProps={(s: any, r: any) => {
					return {
						style: {
							opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
						}
					};
				}}
				getTdProps={(s: any, r: any) => {
					return { style: { padding: "2px 3px" } };
				}}
			/>
		</div>
	);

	function processData() {
		let rv : CrewData[][] = [];
		// First column is "index"
		for (let r=0; r < props.count; ++r) {
			rv[r] = [];
		}
		props.meta.forEach(rm => {
			props.data.sort(rm.compareFn).slice(0, props.count).forEach((c,i) => {
				rv[i].push(c);
			});
		});
		return rv;
	}

	function getColumns(rowData: CrewData[][]) {
		let _columns: Column<CrewData[]>[] = [];

		_columns.push({
			id: 'index',
			Header: '#',
			minWidth: 30,
			maxWidth: 30,
			resizable: false,
			Cell: (cell) => cell.index + 1
		});

		props.meta.forEach((rm,i) => {
			const allZero = rowData.map(r => r[i] ? rm.valueFn(r[i]) : 0).every(v => v <= 0);

			_columns.push({
				id: 'icon'+i,
				Header: '',
				minWidth: 28,
				maxWidth: 28,
				show: !allZero,
				resizable: false,
				Cell: (cell) => <Image src={STTApi.imgUrl((cell.original[i] as CrewData).portrait, imageCacheUpdated)} width={22} height={22} imageFit={ImageFit.contain} shouldStartVisible={true} />
			});

			_columns.push({
				id: 'name'+i,
				Header: rm.title,
				minWidth: 150,
				maxWidth: 250,
				show: !allZero,
				resizable: true,
				Cell: (cell) => {
					const c : CrewData = cell.original[i];
					return <span>
						{c.status.frozen > 0 ? <Icon iconName='Snowflake' /> : <span/>}
						{c.name}
						<span style={{ fontStyle: 'italic', fontSize: '-1pt' }}>
						{!c.status.fe && ' EQ'}
						{(c.level !== 100) && <> L{c.level}</>}
						</span>
						{rm.showRarity && <RarityStars asSpan={true} max={c.max_rarity} value={c.rarity} />}
					</span>;
				},
			});

			_columns.push({
				id: 'value' + i,
				Header: rm.valueTitle,
				minWidth: 40,
				maxWidth: 90,
				show: !allZero,
				resizable: true,
				Cell: (cell) => <span>{ (rm.valueText === undefined ? rm.valueFn(cell.original[i]) : rm.valueText(cell.original[i])) }</span>,
			});
		});

		return _columns;
	}
}
