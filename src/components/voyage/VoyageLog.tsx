import React from 'react';
import Moment from 'moment';
import { Button, Icon, Popup } from 'semantic-ui-react';
import ReactTable, { SortingRule, Column } from 'react-table';

import STTApi, { CONFIG, RarityStars, formatTimeSeconds, CollapsibleSection, download, CrewSkills, getItemDetailsLink } from '../../api';
import { loadVoyage, recallVoyage, resolveDilemma, VOYAGE_AM_DECAY_PER_MINUTE, voyDuration, estimateVoyageDuration, toSkillValues } from './VoyageTools';
import { CalcChoice } from './voyageCalc';
import { VoyageLogEntry } from './VoyageLogEntry';
import { VoyageNarrativeDTO, VoyageDTO, CrewData, RewardDTO, VoyageExportData } from '../../api/DTO';
import { CrewImageData } from '../images/ImageProvider';
import { VoyageSkillsReadout, Skill } from './VoyageSkillsReadout';
import { GetSpriteCssClass } from '../DarkThemeContext';

type IndexedNarrative = {
	[index: number]: VoyageNarrativeDTO[]
};
type SkillChecks = {
	[skill: string]: { att: number; passed: number; }
};

export const VoyageLog = (props:{}) => {
	const [voyage, setVoyage] = React.useState<VoyageDTO | undefined>(undefined);
	const [showSpinner, setShowSpinner] = React.useState(true);
	const [includeFlavor, setIncludeFlavor] = React.useState(false);
	// By default, sort the voyage rewards table by type and rarity to show crew first
	const [sorted, setSorted] = React.useState<SortingRule[]>([{ id: 'type', desc: false }, { id: 'rarity', desc: true }]);
	const [shipName, setShipName] = React.useState<string | undefined>(undefined);
	const [estimatedMinutesLeft, setEstimatedMinutesLeft] = React.useState<number | undefined>(undefined);
	//const [estimatedMinutesLeftRefill, setEstimatedMinutesLeftRefill] = React.useState(undefined as number | undefined);
	const [computingNativeEstimate, setComputingNativeEstimate] = React.useState<boolean>(false);
	//const computingNativeEstimateTimerRef = React.createRef<number | undefined>();
	const [voyageRewards, setVoyageRewards] = React.useState<RewardDTO[] | undefined>(undefined);
	const [voyageExport, setVoyageExport] = React.useState<VoyageExportData | undefined>(undefined);
	const [indexedNarrative, setIndexedNarrative] = React.useState<IndexedNarrative | undefined>(undefined);
	const [skillChecks, setSkillChecks] = React.useState<SkillChecks | undefined>(undefined);
	const [, imageCacheUpdated] = React.useState<string>('');

	async function recall() {
		await recallVoyage(STTApi.playerData.character.voyage[0].id);
		reloadVoyageState();
	}

	React.useEffect(() => {
		reloadVoyageState();
	}, []);
	const spriteClass = GetSpriteCssClass();

	if (showSpinner) {
		return (
			<div className='centeredVerticalAndHorizontal'>
				<div className='ui massive centered text active inline loader'>Loading voyage details...</div>
			</div>
		);
	}

	if (!voyage || !voyage.crew_slots) {
		return <div/>;
	}

	const defaultButton = (props: any) => (
		<Button {...props} style={{ width: '100%' }}>
			{props.children}
		</Button>
	);

	const rewardTableColumns = getColumns(spriteClass);

	let voyRunTime = 0;
	if (voyageExport && voyageExport.narrative) {
		voyRunTime = voyDuration(voyageExport.narrative);
	}

	return <div style={{ userSelect: 'initial' }}>
			<h1>Voyage on the {shipName}</h1>
			<hr/>
			<VoyageState
				voyage={voyage}
				estimatedMinutesLeft={estimatedMinutesLeft}
				voyRunTime={voyRunTime}
				computingNativeEstimate={computingNativeEstimate}
				recall={recall} />
			<VoyageDilemma voyage={voyage} reload={reloadVoyageState} />
			<VoyageCurrentCrewSkills
				voyage={voyage}
				skillChecks={skillChecks}
				exportNarrative={voyageExport?.narrative}
			/>

			{voyageRewards &&
				<div className='voyage-rewards'>
					<div className='ui label big group-header'>
						{'Pending rewards (' + voyageRewards.length + ')'}
					</div>
					<div>
						<ReactTable
							data={voyageRewards}
							columns={rewardTableColumns}
							sorted={sorted}
							onSortedChange={sorted => setSorted(sorted)}
							className='-striped -highlight'
							defaultPageSize={10}
							pageSize={10}
							showPagination={voyageRewards.length > 10}
							showPageSizeOptions={false}
							NextComponent={defaultButton}
							PreviousComponent={defaultButton}
						/>
					</div>
				</div>
			}
			{indexedNarrative &&
				<CollapsibleSection title={"Complete Captain's Log (" + Object.keys(indexedNarrative).length + ')'}>
				{Object.keys(indexedNarrative).map(key => {
					let v = indexedNarrative[+key];
					return <VoyageLogEntry key={key} log={v} spriteClass={spriteClass} />;
				})}
				</CollapsibleSection>
			}
			<button className='ui mini button blue'
				onClick={() => download('narrative.' + voyage.id + '.json',
					JSON.stringify(voyageExport),
					'Export voyage narrative JSON',
					'Export',
					false)}>
				Export Narrative JSON
			</button>

			<br />
		</div>;

	function getColumns(spriteClass: string) : Column<RewardDTO>[] {
		return [
			{
				id: 'icon',
				Header: '',
				minWidth: 42,
				maxWidth: 42,
				resizable: false,
				accessor: (row) => row.full_name,
				Cell: (p) => {
					const reward = p.original as RewardDTO;
					let imgUrl = '';
					if (reward.type === 1) {
						imgUrl = STTApi.imgUrl(reward.portrait, imageCacheUpdated)
					} else {
						imgUrl = STTApi.imgUrl(reward.icon, imageCacheUpdated)
					}
					return <img className={`image-fit ${spriteClass}`} src={STTApi.imgUrl((p.original as RewardDTO).icon, imageCacheUpdated)} height='32px' />;
				}
			},
			{
				id: 'quantity',
				Header: 'Quantity',
				minWidth: 50,
				maxWidth: 70,
				style: { textAlign: 'center' },
				resizable: false,
				accessor: (row) => row.quantity
			},
			{
				id: 'name',
				Header: 'Name',
				minWidth: 150,
				maxWidth: 250,
				resizable: true,
				accessor: (row) => row.full_name,
				Cell: (p) => {
					let item = p.original;
					return (
						<a href={getItemDetailsLink(item)} target='_blank'>
							{item.full_name}
						</a>
					);
				}
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				accessor: (c) => {
					if (c.type > 2) {
						return -1;
					}
					return c.rarity;
				},
				minWidth: 75,
				maxWidth: 75,
				resizable: false,
				Cell: (p) => {
					let item = p.original;
					// 3 is for honor, credits, crons
					if (item.type > 2) {
						return <span />;
					}

					return (
						<span key={item.id}>
							<RarityStars max={item.rarity ? item.rarity : 1} value={item.rarity ? item.rarity : null} colored={true} />
						</span>
					);
				}
			},
			{
				id: 'type',
				Header: 'Type',
				minWidth: 100,
				resizable: true,
				accessor: (row) => {
					if (row.item_type) {
						return row.type + '.' + row.item_type;
					}
					return row.type;
				},
				Cell: (p) => {
					let item = p.original;

					if (item.type === 1) {
						// For crew, check if it's useful or not
						let have = STTApi.roster.filter(crew => crew.symbol === item.symbol);
						if (have.length > 0) {
							if (have.some(c => c.frozen > 0)) {
								return <span>Duplicate of frozen crew (airlock-able)</span>;
							}
							if (have.some(c => c.max_rarity === c.rarity)) {
								return <span>Duplicate of fully-fused crew (airlock-able)</span>;
							}

							return <span style={{ fontWeight: 'bold' }}>NEW STAR FOR CREW!</span>;
						}
						return <span style={{ fontWeight: 'bold' }}>NEW CREW!</span>;
					}

					let typeName = CONFIG.REWARDS_ITEM_TYPE[item.item_type];
					if (typeName) {
						return typeName;
					}
					typeName = CONFIG.REWARDS_TYPE[item.type];
					if (typeName) {
						return typeName;
					}

					// fall-through case for items
					typeName = item.icon.file.replace('/items', '').split('/')[1];
					if (typeName) {
						return typeName;
					}

					// show something so we know to fix these
					if (item.item_type) {
						return item.type + '.' + item.item_type;
					}
					return item.type;
				}
			}];
	}

	async function reloadVoyageState() {
		let voyage: VoyageDTO = STTApi.playerData.character.voyage[0];
		if (voyage && voyage.id) {
			let voyageNarrative = await loadVoyage(voyage.id, false);
			let voyageExport: VoyageExportData = {
				id: voyage.id,
				skills: voyage.skills,
				antimatter: voyage.max_hp,
				skillAggregates: [],
				slots: STTApi.playerData.character.voyage_descriptions[0].crew_slots,
				stats: {
					skillChecks: {
						times: [],
						average: 0
					},
					rewards: {
						times: [],
						average: 0,
					},
				},
				narrative: voyageNarrative,
			};

			//<Checkbox checked={this.state.includeFlavor} label="Include flavor entries" onChange={(e, isChecked) => { this.setState({ includeFlavor: isChecked }); }} />
			if (!includeFlavor) {
				// Remove the "flavor" entries (useless text)
				voyageNarrative = voyageNarrative.filter(e => e.encounter_type !== 'flavor');
			}

			// compute skill check counts
			let skillChecks: SkillChecks = voyageNarrative.reduce((r, a) => {
				if (a.skill_check && a.skill_check.skill && a.encounter_type === "hazard") {
					if (!r[a.skill_check.skill])
						r[a.skill_check.skill] = { att: 0, passed: 0 };
					r[a.skill_check.skill].att++;
					if (a.skill_check.passed)
						r[a.skill_check.skill].passed++;
					voyageExport.stats.skillChecks.times.push(a.event_time);
				}
				return r;
			}, Object.create(null) as SkillChecks);

			Object.keys(CONFIG.SKILLS).forEach(sk => {
				if (!skillChecks[sk]) {
					skillChecks[sk] = { att: 0, passed: 0 };
				}
			});

			voyageNarrative.filter(e => e.encounter_type === "reward").forEach(v => {
				voyageExport.stats.rewards.times.push(v.event_time);
			});

			// at index "index", need to subtract "gap" from all times >=
			let timeGaps: { gap: number; index: number; }[] = [];

			voyageNarrative.forEach((e, i: number, ee) => {
				if (i > 1 && ee[i - 1].encounter_type === "dilemma" && e.encounter_type !== "dilemma") {
					let timelost = e.event_time - ee[i - 1].event_time;
					timeGaps.push({ gap: timelost, index: e.index })
					// find the next
				}
			});

			if (voyageExport.stats.skillChecks.times.length > 1) {
				voyageExport.stats.skillChecks.average = voyageExport.stats.skillChecks.times
					.map((v, i: number, vv) => i == 0 ? 0 : v - vv[i - 1])
					.reduce((a, b) => a + b)
					/ voyageExport.stats.skillChecks.times.length;
			}
			if (voyageExport.stats.rewards.times.length > 1) {
				voyageExport.stats.rewards.average = voyageExport.stats.rewards.times
					.map((v, i: number, vv) => i == 0 ? 0 : v - vv[i - 1])
					.reduce((a, b) => a + b)
					/ voyageExport.stats.rewards.times.length;
			}

			let attemptCount = Object.keys(skillChecks).map(k => skillChecks[k]).map(v => v.att).reduce((p, c) => p + c);
			Object.keys(skillChecks).forEach(k => {
				let agg = voyage.skill_aggregates[k];
				voyageExport.skillAggregates.push({
					skill: k,
					core: agg.core,
					min: agg.range_min,
					max: agg.range_max,
					// Compute and export the "voyage skill" values displayed in the UI
					score: agg.core + (agg.range_min + agg.range_max) / 2,
					attempts: skillChecks[k].att,
					passed: skillChecks[k].passed,
					passedPercent: skillChecks[k].passed / skillChecks[k].att,
					attemptsPercent: skillChecks[k].att / attemptCount
				});
			});

			// Group by index
			let indexedNarrative: IndexedNarrative = voyageNarrative.reduce((r, a) => {
				r[a.index] = r[a.index] ?? [];
				r[a.index].push(a);
				return r;
			}, Object.create(null) as IndexedNarrative);

			//Note: pending_rewards is not updated unless a full player data refresh occurs, so
			//      pull rewards out of the narrative instead of this structure
			let voyageRewards: RewardDTO[] = [];//voyage.pending_rewards.loot;

			voyageNarrative.filter(n => n.rewards && n.rewards.loot)
				.map(n => n.rewards!.loot)
				.reduce((all, loot) => {
					loot.forEach(r => {
						let found = all.find(item => item.id === r.id);
						if (found) {
							found.quantity += r.quantity;
						}
						else {
							all.push({ ...r });
						}
					});
					return all;
				}, voyageRewards);

			let ship_name = voyage.ship_name;
			if (!ship_name) {
				let ship = STTApi.ships.find((ship) => ship.id === voyage.ship_id);
				ship_name = ship ? ship.name : '-BUGBUG-';
			}

			setShowSpinner(false);
			setShipName(ship_name);
			setVoyage(voyage);
			setEstimatedMinutesLeft(voyage.hp / VOYAGE_AM_DECAY_PER_MINUTE);
			//setEstimatedMinutesLeftRefill(voyage.hp / VOYAGE_AM_DECAY_PER_MINUTE);
			setIndexedNarrative(indexedNarrative);
			setSkillChecks(skillChecks);
			setVoyageRewards(voyageRewards);
			setVoyageExport(voyageExport);

			// Avoid estimating if voyage is not ongoing
			if (voyage.state !== 'recalled' && voyage.state !== 'failed') {
				betterEstimate(voyage);
			}
		}
	}

	async function betterEstimate(voyage: VoyageDTO) {
		if (!voyage) {
			return;
		}
		const assigned: CalcChoice[] = voyage.crew_slots.map((s,sid) => {
			return {
				slotId: sid,
				choice: STTApi.roster.find(c => c.crew_id === s.crew.id)!
			};
		});

		setComputingNativeEstimate(true);

		// after 5s, clear the spinner regardless of completion
		setTimeout(() => {
			setComputingNativeEstimate(false);
		}, 5000);

		const vd = STTApi.playerData.character.voyage_descriptions[0];
		const svs = toSkillValues(assigned, vd);
		estimateVoyageDuration(vd.skills.primary_skill,
			vd.skills.secondary_skill,
			svs, voyage.voyage_duration / 60, voyage.hp, false, (dur) => {
				const estimate = dur - (voyage.voyage_duration / 60);
				setEstimatedMinutesLeft(estimate);
				setComputingNativeEstimate(false);
			});

			// if (!voyage || !voyage.max_hp) {
			// 	return;
			// }

			//TODO: to estimte including a single refill
			// options.remainingAntiMatter += voyage.max_hp;
			// estimateVoyageRemaining(options, (estimate) => {
			//    setEstimatedMinutesLeftRefill(estimate);
			//    setNativeEstimate(true);
			// });
	}
}

const VoyageCurrentCrewSkills = (props: {
	voyage: VoyageDTO;
	skillChecks?: SkillChecks;
	exportNarrative?: VoyageNarrativeDTO[];
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	let firstFailures : {[sk:string]: number} = {};
	if (props.exportNarrative) {
		const hazards = props.exportNarrative.filter(n => n.encounter_type === 'hazard' && n.skill_check?.skill);
		Object.keys(props.voyage.skill_aggregates).map(sk => {
			let ff = hazards.find(n => n.skill_check?.skill === sk && n.skill_check?.passed == false);
			if (ff) {
				firstFailures[sk] = ff.index;
			}
		});
	}

	const spriteClass = GetSpriteCssClass();
	const successOutput = (sk: Skill) => {
		let isPri = sk.skill === props.voyage.skills.primary_skill;
		let isSec = sk.skill === props.voyage.skills.secondary_skill;
		return (
			<span>
				<Popup
					trigger={
						<span style={isPri ? { color: CONFIG.RARITIES[5].color } : isSec ? { color: CONFIG.RARITIES[1].color } : {}}>
							<Icon name='thumbs up' />
							{isPri ? '(Pri)' : isSec ? '(Sec)' : ''}
						</span>
					}
					content={`${isPri ? 'Primary s' : isSec ? 'Secondary s' : 'S'}kill checks passed`}
				/>
				<br/>
				{props.skillChecks && props.skillChecks![sk.skill].passed + ' of ' + props.skillChecks![sk.skill].att}
			</span>
		)
	};
	const failOutput = (sk: Skill) => {
		const sv = sk.core + (sk.range_min + sk.range_max) / 2;
		const failSeconds = (sv * 0.045 + 34) * 60;

		const ff = firstFailures[sk.skill] ?? -1;
		return <span>First Failure<br/><i>Expected @ {formatTimeSeconds(failSeconds)}</i>
			{ ff > 0 && <><br/>Actual @ {formatTimeSeconds(ff * 20)}</>}
		</span>;
	};
	return <div>
		<div className='voyage-crew'>
			<div className='vc-complement'>
				<div className='ui label big group-header'>Crew Complement</div>
				{
					// map by voyage description slots because they are sorted
					STTApi.playerData.character.voyage_descriptions[0].crew_slots.map((dslot) => {
						const slot = props.voyage.crew_slots.find(s => s.symbol === dslot.symbol)!;
						const crew = STTApi.roster.find(c => c.crew_id === slot.crew.id)!;
						return (
							<div className='vc-position' key={slot.symbol}>
								<div className='vcp-skill'>
									<img
										className={`image-fit ${spriteClass}`}
										src={CONFIG.SPRITES['icon_' + slot.skill].url}
									/>
								</div>
								<div className='vcp-name'>{slot.name}</div>
								<div className='vcp-pic'>
									<Popup flowing
										trigger={<img className='image-fit' src={STTApi.imgUrl(crew.portrait, imageCacheUpdated)} />}
										content={<CrewSkills crew={crew} useIcon={false} asVoyScore={true} addVoyTotal={true} />}
									/>
								</div>
								<div className='vcp-crewname'>{crew.name}</div>
							</div>
						);
					})
				}
			</div>
			<VoyageSkillsReadout
				skill_aggregates={props.voyage.skill_aggregates}
				success_readout={successOutput}
				failure_readout={failOutput}
			/>
		</div>
	</div>;
}

const VoyageState = (props: {
	voyage?: VoyageDTO;
	estimatedMinutesLeft?: number;
	computingNativeEstimate: boolean;
	voyRunTime: number;
	recall: () => void;
}) => {
	const [estTime, setEstTime] = React.useState<number>(0)
	if (!props.voyage) {
		return <div className='voyage-stats'></div>;
	}
	if (props.voyage.state === 'recalled') {
		let svs : {[sk:string]:number} = {};
		props.voyage.crew_slots
			.map(s => STTApi.roster.find(c => c.crew_id === s.crew.id)!)
			.filter(o => o !== undefined)
			.forEach(c => Object.keys(c.skills).forEach(sk => {
				if (!svs[sk]) { svs[sk] = 0; }
				svs[sk] += c.skills[sk].voy;
			}));

		estimateVoyageDuration(props.voyage.skills.primary_skill, props.voyage.skills.secondary_skill, svs, 0, props.voyage.max_hp, false, (minutesLeft) => {
			setEstTime(minutesLeft);
		});

		return <div className='voyage-stats'>
			{ estTime > 0 &&
				<VoyageStat label="Estimated Length" value={formatTimeSeconds(estTime * 60)} />
			}
			<VoyageStat label="Voyage Length" value={formatTimeSeconds(props.voyRunTime)} />
			<VoyageStat label="Time With Recall" value={formatTimeSeconds(props.voyage.voyage_duration)} />
			<VoyageStat label="Recall Time Left" value={formatTimeSeconds(props.voyage.recall_time_left ?? 0)} />
			{(props.voyage.recall_time_left ?? 0) > 0 &&
				<VoyageStat label="Recall End" value={Moment().add(props.voyage.recall_time_left, 's').format('h:mma')} />
			}
		</div>;
	} else if (props.voyage.state === 'failed') {
		return (
			<p className="voyage-failed">
				Voyage has run out of antimatter after {formatTimeSeconds(props.voyage.voyage_duration)} and it's waiting to be abandoned or
				replenished.
			</p>
		);
	} else {
		if (props.voyage.seconds_between_dilemmas === undefined ||
			props.voyage.seconds_since_last_dilemma === undefined ||
			props.estimatedMinutesLeft === undefined) {
			return <div className='voyage-stats'></div>;
		}
		// This chance was computed to support an older voyage estimator. The current one has a firm lower-bound.
		// const getDilemmaChance = (estimatedMinutesLeft: number) => {
		// 	let minEstimate = (estimatedMinutesLeft * 0.75 - 1) * 60;
		// 	let maxEstimate = estimatedMinutesLeft * 60;

		// 	if (props.voyage!.seconds_between_dilemmas === undefined || props.voyage!.seconds_since_last_dilemma === undefined) {
		// 		return '0';
		// 	}

		// 	let chanceDilemma = (100 * (props.voyage!.seconds_between_dilemmas - props.voyage!.seconds_since_last_dilemma - minEstimate))
		// 		/ (maxEstimate - minEstimate);

		// 	return (100 - Math.min(Math.max(chanceDilemma, 0), 100)).toFixed();
		// };

		const estRecallDurationSec = 0.4 * (props.voyage.voyage_duration + (props.estimatedMinutesLeft * 60));
		const recallNowDurationSec = 0.4 * (props.voyage.voyage_duration);

		//const srcDil = STTApi.imgUrl({ file: 'images/icons/dilemma_icon' });

		return (
			<div className='voyage-stats'>
				<div className='overview'>
					<VoyageStat label="Voyage Length" value={formatTimeSeconds(props.voyage.voyage_duration)} />
					<VoyageStat label="Antimatter" value={props.voyage.hp + ' / ' + props.voyage.max_hp} />
				</div>
				<div className='dilemma'>
					{/* TODO: get this div to look better <div>
						<img src={srcDil} height="30" />
					</div> */}
					<VoyageStat label="Dilemma In" value={formatTimeSeconds(props.voyage.seconds_between_dilemmas - props.voyage.seconds_since_last_dilemma)} />
					<VoyageStat label="Dilemma At" value={Moment().add(props.voyage.seconds_between_dilemmas - props.voyage.seconds_since_last_dilemma, 's').format('h:mma')} />
					{/* <VoyageStat label="Dilemma Reach Chance" value={getDilemmaChance(props.estimatedMinutesLeft) + '%'} /> */}
				</div>
				<div className='times'>
					<VoyageStat label="Est Length" value={formatTimeSeconds(props.voyage.voyage_duration + props.estimatedMinutesLeft * 60)} />
					<VoyageStat label="Est End In" value={formatTimeSeconds(props.estimatedMinutesLeft * 60)} />
					<VoyageStat label="Est End At" value={Moment().add(props.estimatedMinutesLeft, 'm').format('h:mma')} />
					<VoyageStat label="Est Recall Time" value={formatTimeSeconds(estRecallDurationSec)} />
					<VoyageStat label="Est Recall End" value={Moment().add(props.estimatedMinutesLeft, 'm').add(estRecallDurationSec, 's').format('h:mma')} />
					{props.computingNativeEstimate && <i className='spinner loading icon' />}
				</div>
				<div className='recall'>
					<VoyageStat label="Recall Time Now" value={formatTimeSeconds(recallNowDurationSec)} />
					<VoyageStat label="Recall End" value={Moment().add(recallNowDurationSec, 's').format('h:mma')} />
					{/* #!if allowPush == true */}
					<div className="ui statistic">
						<button className='ui button' onClick={() => props.recall()}>
							<i className='icon undo' />
							Recall now
						</button>
					</div>
					{/* #!endif */}
				</div>
			</div>
		);
	}
}

const VoyageStat = (props: {
	value: number | string,
	label: string,
	classAdd?: string
}) => {
	return <div className={`${props.classAdd ? props.classAdd : ''} ui tiny statistic`}>
		<div className="label" style={{ color: 'unset' }}>{props.label}</div>
		<div className="value" style={{ color: props.classAdd || 'unset' }}>{props.value}</div>
	</div>;
}


const VoyageDilemma = (props: {
	voyage?: VoyageDTO;
	reload: () => void;
}) => {
	async function chooseDilemma(voyageId: number, dilemmaId: number, index: number) {
		let allowChoose = false;
		// #!if allowPush == true
		allowChoose = true;
		// #!endif

		if (index < 0 || !allowChoose) {
			return;
		}
		await resolveDilemma(voyageId, dilemmaId, index);

		// Remove the dilemma that was just resolved
		STTApi.playerData.character.voyage[0].dilemma = undefined;

		props.reload();
	}

	if (!props.voyage) {
		return <div />;
	}
	let voy = props.voyage;

	if (voy.dilemma && voy.dilemma.id && voy.dilemma.resolutions) {
		return (
			<div className='voyage-dilemma'>
				<h2 key={0} className='ui top attached header'>
					Dilemma - <span dangerouslySetInnerHTML={{ __html: voy.dilemma.title }} />
				</h2>
				<div key={1} className='ui center aligned inverted attached segment'>
					<div>
						<span dangerouslySetInnerHTML={{ __html: voy.dilemma.intro }} />
					</div>
					<div className='ui middle aligned selection list inverted'>
						{voy.dilemma.resolutions.map((resolution, index) => {
							if (resolution.locked) {
								return (
									<div className='item' key={index}>
										<div className='content'>
											<div className='header'>
												LOCKED - <span dangerouslySetInnerHTML={{ __html: resolution.option }} />
											</div>
										</div>
									</div>
								);
							} else {
								return (
									<div
										className='item'
										key={index}
										onClick={() => chooseDilemma(voy.id, voy.dilemma!.id, index)}>
										<img src={CONFIG.SPRITES['icon_' + resolution.skill].url} height={18} />
										<div className='content'>
											<div className='header'>
												<span dangerouslySetInnerHTML={{ __html: resolution.option }} />
											</div>
										</div>
									</div>
								);
							}
						})}
					</div>
				</div>
			</div>
		);
	} else {
		return <span />;
	}
}
