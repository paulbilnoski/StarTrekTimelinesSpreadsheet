import React from 'react';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { getTheme } from '@uifabric/styling';
import { isMobile } from 'react-device-detect';

// #!if ENV === 'electron'
import Logger from './logger';
// #!endif

import STTApi, { CONFIG, formatTimeSeconds, formatCrewStatsVoy, download, getCrewDetailsLink, RarityStars } from '../../api';
import {
	GauntletRoundOdds, GauntletData,
	loadGauntlet, gauntletCrewSelection, gauntletRoundOdds, payToGetNewOpponents,
	payToReviveCrew, playContest, enterGauntlet, Match
} from './GauntletTools';
import { GauntletDTO, GauntletCrewDTO, GauntletContestDTO, GauntletContestLootDTO, CrewData } from '../../api/DTO';
import { CircularLabel } from '../../utils/CircularLabel';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { CrewImageData } from '../images/ImageProvider';
import ReactTable, { SortingRule, Column } from 'react-table';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { SkillCell } from '../crew/SkillCell';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

// Shows a single Crew entry with gauntlet details (debuffs, etc.)
const GauntletCrew = (props: {
	crew: GauntletCrewDTO;
	showStats: boolean;
	reviveCost: { currency: number; amount: number };
	revive: (save: boolean) => void;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	//let curr = CONFIG.CURRENCIES[props.reviveCost.currency];
	const avatar = STTApi.getCrewAvatarBySymbol(props.crew.archetype_symbol);

	return <div className="ui compact segments" style={{ textAlign: 'center', margin: '8px' }}>
		<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark,
			backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}
		>{avatar ? avatar.name : ''}</h5>
		<div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '0' }}>
			<div style={{ position: 'relative', display: 'inline-block' }}>
				<img src={STTApi.imgUrl(avatar?.portrait, imageCacheUpdated)} className={props.crew.disabled ? 'image-disabled' : ''} height={100} />
				<div style={{ position: 'absolute', right: '0', top: '0' }}>
					<CircularLabel percent={props.crew.crit_chance} />
				</div>
			</div>
		</div>
		<div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}>
			{props.crew.disabled ? "Disabled" : (props.crew.debuff / 4) + ' battles'}
		</div>
		{props.showStats && <div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}>
			{props.crew.skills.map((skill) =>
				<span className='gauntletCrew-statline' key={skill.skill}>
					<img src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> {CONFIG.SKILLS[skill.skill]} ({skill.min} - {skill.max})
				</span>
			)}
		</div>}
		{/* #!if allowPush == true */}
		{(props.crew.debuff > 0 || props.crew.disabled) &&
		<div className="ui bottom attached primary button" onClick={() => props.revive(props.crew.disabled)}>
			{props.crew.disabled ? <>Revive (<span style={{ display: 'inline-block' }}>
				<img src={CONFIG.SPRITES[CONFIG.CURRENCIES.premium_purchasable.icon].url} height={20} />
			</span> {props.reviveCost.amount} dil)</> : <>Restore (<span style={{ display: 'inline-block' }}>
				<img src={CONFIG.SPRITES[CONFIG.CURRENCIES.premium_purchasable.icon].url} height={20} />
			</span> {props.reviveCost.amount} dil)</>}
		</div>
		}
		{/* #!endif */}
	</div>;
};

// Owned crew vs opponent crew 1-on-1 matchup
const GauntletMatch = (props: {
	gauntlet: GauntletDTO;
	match: Match;
	consecutive_wins: number;
	doSpin: (sp: boolean) => void;
	onNewData: (data: GauntletData, logPath: string | undefined, match: Match) => void;
}) => {
	const [, imageCacheUpdated] = React.useState<string>('');
	const fleetmate = STTApi.fleetMembers.find(fm => fm.pid === props.match.opponent.player_id);
	const oppCrew = STTApi.crewAvatars.find(avatar => avatar.symbol === props.match.opponent.archetype_symbol);
	const crewOdd = STTApi.crewAvatars.find(avatar => avatar.symbol === props.match.crewOdd.archetype_symbol);

	//TODO: 320px hardcoded below!
	let containerStyle = {
		padding: '3px',
		backgroundColor: getTheme().palette.themeLighter,
		display: 'grid',
		gridTemplateColumns: '100px auto 12px auto 100px',
		gridTemplateRows: '14px 46px 50px 32px',
		gridTemplateAreas: `
		"pcrewname pcrewname . ocrewname ocrewname"
		"pcrewimage stats stats stats ocrewimage"
		"pcrewimage chance chance chance ocrewimage"
		"pcrewimage button button button ocrewimage"`};


	return <div className="ui compact segments" style={{ margin: 'unset' }}>
		<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark, backgroundColor: getTheme().palette.themeLighter, textAlign: 'center', padding: '2px' }}>
			vs {props.match.opponent.name} (rank {props.match.opponent.rank})
		</h5>
		<div style={containerStyle} className="ui attached segment">
			<span style={{ gridArea: 'pcrewname', justifySelf: 'center' }}>{crewOdd ? crewOdd.short_name : ''}</span>
			<div style={{ gridArea: 'pcrewimage', position: 'relative' }}>
				<img src={STTApi.imgUrl(crewOdd?.full_body, imageCacheUpdated)} height={128} />
				<CircularLabel percent={props.match.crewOdd.crit_chance} />
			</div>

			<div style={{ gridArea: 'stats' }}>
				<table style={{ width: '100%' }}>
					<tbody>
						<tr>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.crewOdd.min[0]}-{props.match.crewOdd.max[0]}</td>
							<td style={{ textAlign: 'center' }}><img src={CONFIG.SPRITES['icon_' + props.gauntlet.contest_data.primary_skill].url} height={18} /></td>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.opponent.min[0]}-{props.match.opponent.max[0]}</td>
						</tr>
						<tr>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.crewOdd.min[1]}-{props.match.crewOdd.max[1]}</td>
							<td style={{ textAlign: 'center' }}><img src={CONFIG.SPRITES['icon_' + props.gauntlet.contest_data.secondary_skill].url} height={18} /></td>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.opponent.min[1]}-{props.match.opponent.max[1]}</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div style={{ gridArea: 'chance', justifySelf: 'center', alignSelf: 'center' }}>
				<p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px', paddingTop: '18px', lineHeight: '1.5em' }}><b>{props.match.chance}%</b> chance</p>
				<p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '4px', lineHeight: '1.2em' }}><b>{props.match.opponent.value}</b> points</p>
			</div>

			<div style={{ gridArea: 'button', justifySelf: 'center', alignSelf: 'center' }}>
			</div>

			<div style={{ gridArea: 'ocrewimage', position: 'relative' }}>
				<img src={STTApi.imgUrl(oppCrew?.full_body, imageCacheUpdated)} height={128} />
				<CircularLabel percent={props.match.opponent.crit_chance} />
			</div>

			<span style={{ gridArea: 'ocrewname', justifySelf: 'center' }}>{oppCrew ? oppCrew.short_name : "<unknown>"}</span>
		</div>
		{/* #!if allowPush == true */}
		<div className="ui bottom attached primary button" style={fleetmate ? { backgroundColor: 'red' } : {}}
			onClick={playMatch}>Engage {fleetmate ? ' Fleetmate' : ''}!</div>
		{/* #!endif */}
	</div>;

	function playMatch() {
		props.doSpin(true);
		playContest(props.gauntlet, props.match, props.consecutive_wins).
			then((data) => {
				props.doSpin(false);
				let logPath = undefined;

				// #!if ENV === 'electron'
				logPath = Logger.logGauntletEntry(data, props.match, props.consecutive_wins);
				// #!endif

				props.onNewData(data, logPath, props.match);
			});
	}
}

const GauntletStat = (props:{
	value: number | string,
	label: string,
	classAdd?: string
}) => {
	return <div className={`${props.classAdd ? props.classAdd : ''} ui tiny statistic`}>
		<div className="value" style={{ color: props.classAdd || 'unset' }}>{props.value}</div>
		<div className="label" style={{ color: 'unset' }}>{props.label}</div>
	</div>;
}

export interface GauntletHelperProps {
	onCommandItemsUpdate: (items: ICommandBarItemProps[]) => void;
}

interface GauntletHelperState {
	gauntlet?: GauntletDTO;
	roundOdds?: GauntletRoundOdds;
	lastResult?: GauntletContestDTO;
	lastMatch?: Match;
	startsIn?: string;
	lastErrorMessage?: string;
	rewards?: {loot: GauntletContestLootDTO[]};
	logPath?: string;
	showSpinner: boolean;
	showLoading: boolean;
	showStats: boolean;
	showCrewSelect: boolean;
	windowWidth: number;
	windowHeight: number;
	bestFirst?: boolean;
}

export class GauntletHelper extends React.Component<GauntletHelperProps, GauntletHelperState> {
	constructor(props: GauntletHelperProps) {
		super(props);

		this.state = {
			gauntlet: undefined,
			lastResult: undefined,
			lastErrorMessage: undefined,
			rewards: undefined,
			logPath: undefined,
			showSpinner: true,
			showLoading: false,
			showStats: false,
			showCrewSelect: false,
			windowWidth: 0,
			windowHeight: 0
		};

		this._reloadGauntletData = this._reloadGauntletData.bind(this);
		this._gauntletDataRecieved = this._gauntletDataRecieved.bind(this);
		this._payForNewOpponents = this._payForNewOpponents.bind(this);
		this._payToReviveCrew = this._payToReviveCrew.bind(this);
		this._exportLog = this._exportLog.bind(this);
		this._reloadGauntletData(false);
		this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
	}

	updateWindowDimensions() {
		//this.setState({ windowWidth: window.innerWidth, windowHeight: window.innerHeight });
	}

	componentDidMount() {
		this._updateCommandItems();

		//this.updateWindowDimensions();
		//window.addEventListener('resize', this.updateWindowDimensions);
	}

	componentWillUnmount() {
		//window.removeEventListener('resize', this.updateWindowDimensions);
	}

	_updateCommandItems() {
		if (this.props.onCommandItemsUpdate) {
			let commandItems: ICommandBarItemProps[] = [];
			if (this.state.logPath) {
				commandItems.push({
					key: 'exportCsv',
					name: 'Export log...',
					iconProps: { iconName: 'ExcelDocument' },
					onClick: (evt:any) => this._exportLog()
				});
			}

			commandItems.push({
				key: 'switchGauntletDisplay',
				name: this.state.showCrewSelect ? 'Switch to Gauntlet' : 'Switch to Crew Select',
				iconProps: { iconName: 'Switch' },
				onClick: () => {
					this.setState({showCrewSelect: !this.state.showCrewSelect}, () => this._updateCommandItems());
				}
			});

			commandItems.push({
				key: 'settings',
				text: 'Settings',
				iconProps: { iconName: 'Equalizer' },
				subMenuProps: {
					items: [{
						key: 'bestFirst',
						text: 'Best match first',
						canCheck: true,
						isChecked: this.state.bestFirst,
						onClick: () => {
							let isChecked = !this.state.bestFirst;
							this.setState({
								bestFirst: isChecked
							}, () => { this._updateCommandItems(); });
						}
					},{
						key: 'showStats',
						text: 'Show crew stats in top row',
						canCheck: true,
						isChecked: this.state.showStats,
						onClick: () => {
							this.setState({ showStats: !this.state.showStats }, () => { this._updateCommandItems(); });
						}
					}]
				}
			});

			this.props.onCommandItemsUpdate(commandItems);
		}
	}

	_reloadGauntletData(spin = true) {
		if (spin) {
			this.setState({showLoading: true});
		}
		loadGauntlet().then(data => {
			if (spin) {
				this.setState({ showLoading: false });
			}
			this._gauntletDataRecieved({ gauntlet: data });
		});
	}

	_payForNewOpponents() {
		if (!this.state.gauntlet) {
			return;
		}
		this.setState({ showLoading: true });
		payToGetNewOpponents().then((data) => {
			this.setState({ showLoading: false });
			if (data.gauntlet) {
				this._gauntletDataRecieved({gauntlet: data.gauntlet});
			} else if (data.message) {
				this.setState({
					lastErrorMessage: data.message
				});
			}
		});
	}

	_payToReviveCrew(crew_id: number, save: boolean) : void {
		if (!this.state.gauntlet) {
			return;
		}
		payToReviveCrew(crew_id, save).then((data) => this._gauntletDataRecieved({gauntlet:data}));
	}

	_gauntletDataRecieved(data: GauntletData, logPath : string | undefined = undefined, match : Match | undefined = undefined) {
		if (!data.gauntlet) {
			return;
		}

		if (data.gauntlet.state == 'NONE') {
			this.setState({
				gauntlet: data.gauntlet,
				lastErrorMessage: undefined,
				lastResult: undefined,
				startsIn: formatTimeSeconds(data.gauntlet.seconds_to_join),
			});
		}
		else if (data.gauntlet.state == 'STARTED') {
			// TODO: make this a configuration option (lower value will make gauntlet refresh faster, but percentage will be less accurate)
			let simulatedRounds = 20000;
			var result = gauntletRoundOdds(data.gauntlet, simulatedRounds);
			this.setState({
				gauntlet: data.gauntlet,
				roundOdds: result
			});

			// Promise.all(iconPromises).then(() => this.forceUpdate());
		}
		// else if (data.gauntlet.state == 'UNSTARTED') {
		// 	// You joined a gauntled and are waiting for opponents
		// }
		// else if (data.gauntlet.state == 'ENDED_WITH_REWARDS') {
		// 	// The gauntlet ended and you got some rewards
		// }
		else {
			this.setState({
				gauntlet: data.gauntlet
			});
		}

		if (data.lastResult) {
			this.setState({
				lastResult: data.lastResult,
				lastMatch: match,
				rewards: data.rewards
			});
		}

		// #!if ENV === 'electron'
		if (!logPath && data.gauntlet) {
			logPath = Logger.hasGauntletLog(data.gauntlet.gauntlet_id);
		}
		// #!endif

		this.setState({ logPath: logPath, showSpinner: false }, () => { this._updateCommandItems(); });
	}

	render() {
		if (this.state.showSpinner) {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui massive centered text active inline loader">Loading gauntlet details...</div>
			</div>;
		}

		if (this.state.gauntlet && (this.state.gauntlet.state == 'NONE' || this.state.showCrewSelect)) {
			return <GauntletSelectCrew
				gauntlet={this.state.gauntlet}
				startsIn={this.state.startsIn}
				gauntletLoaded={this._gauntletDataRecieved}
			/>;
		}
		if (this.state.gauntlet && (this.state.gauntlet.state == 'ENDED_WITH_REWARDS')) {
			return <div>
				<h3>Gauntlet ended, your final rank was <b>{this.state.gauntlet.rank}</b>. Use game client to claim rewards.</h3>
				<p>Note: you won't see the rewards here, you'll go straight to crew selection. Claim rewards in the game client to see them!</p>
			</div>;
		}
		if (this.state.gauntlet && (this.state.gauntlet.state == 'UNSTARTED')) {
			return <div>
				<h3>Gauntlet has not yet started. Try again soon.</h3>
			</div>;
		}

		if (this.state.gauntlet && ((this.state.gauntlet.state == 'STARTED') && this.state.roundOdds)) {
			let playerCrew, opponentCrew, playerRoll = 0, opponentRoll = 0, playerRollMsg = [], opponentRollMsg = [];
			let playerCritPct = 0, opponentCritPct = 0;

			if (this.state.lastResult && this.state.lastMatch) {
				let crewAva = STTApi.getCrewAvatarBySymbol(this.state.lastMatch.crewOdd.archetype_symbol);
				playerCrew = crewAva ? crewAva.name : undefined;
				let oppAva = STTApi.getCrewAvatarBySymbol(this.state.lastMatch.opponent.archetype_symbol);
				opponentCrew = oppAva ? oppAva.name : undefined;

				playerRoll = this.state.lastResult.player_rolls.reduce((sum: number, value: number) => sum + value, 0);
				opponentRoll = this.state.lastResult.opponent_rolls.reduce((sum: number, value: number) => sum + value, 0);
				playerCritPct = this.state.lastResult.player_crit_rolls.reduce((sum: number, value: boolean) => sum + (value ? 1 : 0), 0) / 6;
				opponentCritPct = this.state.lastResult.opponent_crit_rolls.reduce((sum: number, value: boolean) => sum + (value ? 1 : 0), 0) / 6;
				playerCritPct = Math.floor(playerCritPct * 100);
				opponentCritPct = Math.floor(opponentCritPct * 100);

				for (let i = 0; i < 6; i++) {
					playerRollMsg.push(`${this.state.lastResult.player_rolls[i]}${this.state.lastResult.player_crit_rolls[i] ? '*' : ''}`);
					opponentRollMsg.push(`${this.state.lastResult.opponent_rolls[i]}${this.state.lastResult.opponent_crit_rolls[i] ? '*' : ''}`);
				}
			}

			let matches = this.state.roundOdds.matches;
			let sortCrit = (match:Match) => match.chance;
			if (this.state.bestFirst) {
				sortCrit = (match:Match) => (match.chance > 0) ? (match.chance + match.opponent.value / 4.5) : 0;
			}
			matches.sort((a, b) => sortCrit(b) - sortCrit(a));

			let consecutiveWins = this.state.roundOdds.consecutive_wins;

			const gaunt = this.state.gauntlet;
			const rewards = this.state.rewards;

			const containerStyleLast = {
				padding: '3px',
				backgroundColor: getTheme().palette.themeLighter,
				display: 'grid',
				gridTemplateColumns: '100px auto auto 100px',
				gridTemplateRows: '2em 13em',
				gridTemplateAreas: `
					"pcrewname pcrewname ocrewname ocrewname"
					"pcrewimage stats stats ocrewimage"`};

			const stEm = { textAlign: 'center', verticalAlign: 'middle', fontSize: '1.2rem', fontWeight: 700, lineHeight: '1.2em' };
			const stNorm = { textAlign: 'center', verticalAlign: 'middle' };
			const stLoad = this.state.showLoading ? { fontStyle: 'italic'} : {}

			const crewAvatar = STTApi.crewAvatars.find(a => a.symbol === this.state.lastMatch?.crewOdd.archetype_symbol);
			const oppAvatar = STTApi.crewAvatars.find(a => a.symbol === this.state.lastMatch?.opponent.archetype_symbol);

			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<span className='quest-mastery'>Featured skill is <img src={CONFIG.SPRITES['icon_' + this.state.gauntlet.contest_data.featured_skill].url} height={18}
					/> {CONFIG.SKILLS[this.state.gauntlet.contest_data.featured_skill]}; Featured traits are {
						this.state.gauntlet.contest_data.traits.map((trait:string) => STTApi.getTraitName(trait)).join(", ")}</span>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }} >
						{this.state.gauntlet.contest_data.selected_crew.map((crew) => <GauntletCrew
							showStats={this.state.showStats}
							key={crew.crew_id}
							crew={crew}
							revive={(save) => this._payToReviveCrew(crew.crew_id, save)}
							reviveCost={gaunt.revive_cost}
							/>)}
					</div>

					{this.state.lastErrorMessage && <p>Error: '{this.state.lastErrorMessage}'</p>}

					<div className="ui compact segments" style={{ margin: '8px' }}>
						<div style={{display: 'flex', flexDirection: 'row'}}>
						<div className="ui attached" style={{ marginBottom: '0em', paddingBottom:'1em', width:'300px', backgroundColor: getTheme().palette.themeLighter }}>
								<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark, backgroundColor: getTheme().palette.themeLighter, textAlign: 'center', padding: '2px' }}>
									<span style={stLoad}>The gauntlet ends in {formatTimeSeconds(this.state.gauntlet.seconds_to_end)}</span>
								</h5>
								<GauntletStat label='Crew refresh' value={formatTimeSeconds(this.state.gauntlet.seconds_to_next_crew_refresh)} />
								<GauntletStat label='Your rank' value={this.state.roundOdds.rank} />
								<GauntletStat label='Consecutive wins' value={this.state.roundOdds.consecutive_wins} />
								<GauntletStat label='Merits' value={STTApi.playerData.premium_earnable} />
								{this.state.lastResult &&
									<GauntletStat label='Last round' value={((this.state.lastResult.win === true) ? 'WON' : 'LOST')} classAdd={(this.state.lastResult.win === true) ? 'green' : 'red'}/>}
							</div>
							{this.state.lastResult && this.state.lastMatch && <div className="ui attached segment"
								style={{ display: 'flex', flexFlow: 'row nowrap', backgroundColor: getTheme().palette.themeLighterAlt }}>
								<div style={containerStyleLast} className="ui attached segment">
									<span style={{ gridArea: 'pcrewname', justifySelf: 'center' }}>Your <b>{playerCrew}</b></span>
									<div style={{ gridArea: 'pcrewimage', position: 'relative' }}>
										<img src={STTApi.imgUrl(crewAvatar?.full_body, () => this.forceUpdate)} height={128} />
										<CircularLabel percent={this.state.lastMatch.crewOdd.crit_chance} />
									</div>

									<div style={{ gridArea: 'stats' }}>
										<table style={{ width: '100%' }}>
											<tbody>
												{[...Array(6).keys()].map(i =>
												{
													let stP = this.state.lastResult!.player_crit_rolls[i] ? stEm : stNorm;
													let stO = this.state.lastResult!.opponent_crit_rolls[i] ? stEm : stNorm;

													return <tr key={i}><td style={stP as any}>{this.state.lastResult!.player_rolls[i]}</td>
														<td style={stO as any}>{this.state.lastResult!.opponent_rolls[i]}</td></tr>; })
												}
												<tr><td style={ (playerRoll > opponentRoll ? stEm : stNorm) as any}>Score: {playerRoll}</td>
													<td style={ (playerRoll < opponentRoll ? stEm : stNorm) as any}>Score: {opponentRoll}</td></tr>
												<tr><td style={ stNorm as any }>Actual Crit: {playerCritPct}%</td>
													<td style={ stNorm as any }>Actual Crit: {opponentCritPct}%</td></tr>
											</tbody>
										</table>
									</div>

									<div style={{ gridArea: 'ocrewimage', position: 'relative' }}>
										<img src={STTApi.imgUrl(oppAvatar?.full_body, () => this.forceUpdate)} height={128} />
										<CircularLabel percent={this.state.lastMatch.opponent.crit_chance} />
									</div>

									<span style={{ gridArea: 'ocrewname', justifySelf: 'center' }}><i>{this.state.lastMatch.opponent.name}</i>'s <b>{opponentCrew}</b></span>
								</div>

								<div style={{ marginLeft: '15px' }}><p>Match success chance: <b>{this.state.lastMatch.chance}%</b></p>
								<p>You got <b>{this.state.lastResult.value} points</b>.</p>
									{rewards &&
										<div>
											Rewards:
											<div>
											{rewards.loot.map((loot, index) => {
												let imgUrl = '';
												if (loot.type === 1) {
													imgUrl = STTApi.imgUrl(loot.full_body, (s) => this.forceUpdate())
												} else {
													imgUrl = STTApi.imgUrl(loot.icon, (s) => this.forceUpdate())
												}
												return <span key={index} style={{ color: loot.rarity ? CONFIG.RARITIES[loot.rarity].color : '#000' }}
												><img src={imgUrl} width='50' height='50' /><br/>{loot.quantity} {(loot.rarity == null) ? '' : CONFIG.RARITIES[loot.rarity].name} {loot.full_name}
													{index < rewards.loot.length - 1 ? ', ' : ''}</span>;
											})}
											</div>
										</div>
									}
								</div>
							</div>}
						</div>
						<div className="ui two bottom attached buttons">
							{/* #!if allowPush == true */}
							<div className={'ui primary button' + ((this.state.roundOdds.matches.length > 0) ? '' : ' disabled')} onClick={this._payForNewOpponents}>
								New opponents (<span style={{ display: 'inline-block' }}>
									<img src={CONFIG.SPRITES[CONFIG.CURRENCIES.premium_earnable.icon].url} height={16} />
								</span>50 merit)
							</div>
							{/* #!endif */}
							<div className="ui button" onClick={() => this._reloadGauntletData()}>
								<i className="retweet icon"></i>
								Reload data
							</div>
						</div>
					</div>

					<br />

					<div style={{ display: 'grid', gridGap: '10px', margin: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
						{matches.map((match) =>
							<GauntletMatch key={match.crewOdd.crew_id + '_' + match.opponent.player_id}
								match={match}
								gauntlet={gaunt}
								consecutive_wins={consecutiveWins}
								doSpin={(sp) => this.setState({ showLoading: sp})}
								onNewData={this._gauntletDataRecieved} />
						)}
					</div>
				</div>
			);
		}
		else {
			return (<MessageBar messageBarType={MessageBarType.error} >Unknown state for this gauntlet! Check the app, perhaps it's waiting to join or already done.</MessageBar>);
		}
	}

	_exportLog() {
		if (!this.state.gauntlet) {
			return;
		}
		// #!if ENV === 'electron'
		let gid = this.state.gauntlet.gauntlet_id;
		Logger.exportGauntletLog(gid).then(csv => {
			download(`gauntlet_${gid}.csv`, csv, 'Export gauntlet log', 'Export');
		});
		// #!endif
	}
}

const GauntletSelectCrew = (props: {
	gauntlet: GauntletDTO;
	startsIn?: string;
	gauntletLoaded: (data: { gauntlet: GauntletDTO}) => void;
}) => {
	const [crewSelection, setCrewSelection] = React.useState<number[] | undefined>();
	const [calculating, setCalculating] = React.useState<boolean>(false);
	const [includeFrozen, setIncludeFrozen] = React.useState<boolean>(false);
	// Recommendation calculation settings
	const [featuredSkillBonus, setFeaturedSkillBonus] = React.useState<number>(10);
	const [critBonusDivider, setCritBonusDivider] = React.useState<number>(3);
	const [, imageCacheUpdated] = React.useState<string>('');

	const renderBestCrew = () => {
		if (!crewSelection) {
			return <span />;
		}

		let crewSpans: any[] = [];
		crewSelection.forEach(id => {
			let crew = STTApi.roster.find(crew => (crew.crew_id === id) || (crew.id === id));
			if (!crew) {
				return;
			}

			let crewSpan = <Persona
				key={crew.crew_id}
				imageUrl={STTApi.imgUrl(crew.portrait, imageCacheUpdated)}
				text={crew.name}
				secondaryText={crew.short_name}
				tertiaryText={formatCrewStatsVoy(crew)} //FIXME: only need to show proficiencies, not voy scores
				size={PersonaSize.large}
				presence={(crew.frozen === 0) ? PersonaPresence.online : PersonaPresence.away} />

			crewSpans.push(crewSpan);
		});

		return (<div style={{paddingLeft: '5px' }}>
			<h3>Best crew</h3>
			{calculating && <div className="ui medium centered text active inline loader">Still calculating...</div>}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{crewSpans}
			</div>
		</div>);
	}

	const _calculateSelection = () => {
		if (!props.gauntlet) {
			return;
		}
		setCalculating(true);
		var result = gauntletCrewSelection(props.gauntlet, STTApi.roster, (100 + featuredSkillBonus) / 100, critBonusDivider, 5 /*preSortCount*/, includeFrozen);
		setCrewSelection(result.recommendations);
		setCalculating(false);
	}

	const _startGauntlet = () => {
		if (props.gauntlet && props.gauntlet.gauntlet_id && crewSelection) {

			let crew_ids: number[] = [];
			crewSelection.forEach(id => {
				let crew = STTApi.roster.find(crew => (crew.crew_id === id));
				if (!crew) {
					console.error(`Crew ${id} not found; are you trying to start a gauntlet with frozen crew?`);
					return;
				}

				crew_ids.push(crew.crew_id);
			});

			if (crew_ids.length === 5) {
				enterGauntlet(props.gauntlet.gauntlet_id, crew_ids).then((data) => props.gauntletLoaded({ gauntlet: data }));
			}
		}
	}

	const isActive = props.gauntlet.state !== 'NONE';
	const fs = props.gauntlet.contest_data.featured_skill;

	return (
		<div><Label>
			{!isActive && <>Next gauntlet starts in {props.startsIn}.</>}
			{isActive && <>Gauntlet is active.</>}
			</Label>
			{props.gauntlet.contest_data.featured_skill &&
				<span className='quest-mastery'>Featured skill: <img src={CONFIG.SPRITES['icon_' + fs].url} height={18} /> {CONFIG.SKILLS[fs]}</span>
			}
			<Label>Featured traits: {props.gauntlet.contest_data.traits && props.gauntlet.contest_data.traits.map(t => STTApi.getTraitName(t)).join(', ')}</Label>

			{renderBestCrew()}

			<div className="container" style={{ maxWidth: '600px', margin: '10px 0 10px 0', paddingLeft: '5px' }}>
				<div className="row">
					<div className="col"><h4>Algorithm settings</h4></div>
				</div>

				<div className="row">
					<div className="col">
						<SpinButton value={String(featuredSkillBonus)} label='Featured skill bonus:' min={0} max={100} step={1}
							onIncrement={(value) => { setFeaturedSkillBonus(+value + 1); }}
							onDecrement={(value) => { setFeaturedSkillBonus(+value - 1); }}
							onValidate={(value: string) => {
								if (isNaN(+value)) {
									setFeaturedSkillBonus(10);
									return '10';
								}

								return value;
							}}
						/>
					</div>
					<div className="col">
						The higher this number, the more bias applied towards the featured skill during crew selection
							</div>
				</div>

				<div className="row">
					<div className="col">
						<SpinButton value={String(critBonusDivider)} label='Crit bonus divider:' min={0.1} max={100} step={0.1}
							onIncrement={(value) => { setCritBonusDivider(+value + 0.1); }}
							onDecrement={(value) => { setCritBonusDivider(+value - 0.1); }}
							onValidate={(value: string) => {
								if (isNaN(+value)) {
									setCritBonusDivider(3);
									return '3';
								}

								return value;
							}}
						/>
					</div>
					<div className="col">
						The lower this number, the more bias applied towards crew with higher crit bonus rating during selection
					</div>
				</div>

				<div className="row">
					<div className="col">
						<Checkbox checked={includeFrozen} label="Include frozen crew"
							onChange={(e, isChecked) => { setIncludeFrozen(isChecked || false ); }}
						/>
					</div>
				</div>
			</div>

			<br />

			<div style={{ display: 'grid', gridGap: '5px', width: 'fit-content', gridTemplateColumns: 'max-content max-content' }}>
				<div className={"ui primary button" + (calculating ? ' disabled' : '')} onClick={_calculateSelection}>Calculate best crew selection</div>
				{/* #!if allowPush == true */}
				<div className={"ui primary button" + ((!crewSelection || isActive) ? ' disabled' : '')} onClick={_startGauntlet}>Start gauntlet with recommendations</div>
				{/* #!endif */}
			</div>

			<GauntletCrewBonusTable gauntlet={props.gauntlet} />
		</div>
	);
}

const GauntletCrewBonusTable = (props: {
	gauntlet: GauntletDTO;
}) => {
	const [sorted, setSorted] = React.useState([{ id: 'bonus', desc: true },{id: 'gauntlet_score', desc: true}] as SortingRule[]);
	const [filterText, setFilterText] = React.useState('');
	const [, imageCacheUpdated] = React.useState<string>('');

	const columns = getColumns();
	const bonusValues = [0, 25, 45, 65];

	let items: CrewData[] = []; // array of CrewData with additional 'bonus' field
	STTApi.roster.forEach(crew => {

		const bonuses = crew.rawTraits.filter(t => props.gauntlet.contest_data.traits.includes(t)).length;
		let bonus = bonusValues[bonuses] ?? 0;

		let bonusCrew = {
			...crew,
			// additional properties not in CrewData
			bonus
		};

		items.push(bonusCrew);
	});

	let bonusCrewCount = items.length;

	//if (!props.onlyBonusCrew)
	{
		let allCrew = STTApi.roster.filter(c => !c.buyback);
		allCrew.forEach(owned => {
			let found = items.find(c => c.id === owned.id);
			if (!found) {
				items.push(owned);
			}
		});
	}

	if (filterText) {
		items = items.filter(i => filterCrew(i, filterText!.toLowerCase()))
	}

	function getColumns(showBuyBack?: boolean) {
		let _columns: Column<CrewData>[] = [];
		let compactMode = true;

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: compactMode ? 28 : 60,
			maxWidth: compactMode ? 28 : 60,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={STTApi.imgUrl((cell.original as CrewData).portrait, imageCacheUpdated)} width={compactMode ? 22 : 50} height={compactMode ? 22 : 50} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
		});

		if (!isMobile) {
			_columns.push({
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <a href={getCrewDetailsLink(cell.original)} target='_blank'>{cell.original.short_name}</a>;
					} else {
						return <span />;
					}
				},
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				style: { 'textAlign': 'center' }
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				// Sort all by max fusion level, then fractional part by current fusion level
				accessor: (obj) => obj.max_rarity + (obj.rarity / obj.max_rarity),
				minWidth: 75,
				maxWidth: 85,
				resizable: false,
				Cell: (cell) => {
					if (cell && cell.original) {
						return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
					} else {
						return <span />;
					}
				},
			});

		if (!isMobile) {
			_columns.push({
				id: 'favorite',
				Header: () => <Icon iconName='FavoriteStar' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'favorite',
				Cell: (cell) => {
					if (cell && cell.original && cell.value) {
						return <Icon iconName='FavoriteStar' />;
					} else {
						return <span />;
					}
				},
			});
		}

		let colsProf: Column<CrewData>[] = [];
		for (let sk in CONFIG.SKILLS_SHORT) {
			let head = CONFIG.SKILLS_SHORT[sk];
			colsProf.push({
				id: sk,
				Header: head,
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (crew) => crew.skills[sk].max,
				Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} proficiency={true} compactMode={compactMode} /> : <span />,
			});
		}
		colsProf.sort((a, b) => (a.Header as string).localeCompare(b.Header as string));

		_columns.push(
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell: any) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
			});
		_columns.push({
			id: 'bonus',
			Header: 'Crit Bonus',
			minWidth: 50,
			maxWidth: 70,
			resizable: true,
			accessor: 'bonus',
			style: { 'textAlign': 'center' },
			Cell: cell => <span>{cell.value ? cell.value + '%' : ''}</span>
		});
		_columns.push(
			{
				id: 'active_id',
				Header: () => <Icon iconName='Balloons' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'active_id',
				Cell: (cell) => {
					if (cell && cell.original && cell.original.active_id) {
						let isShuttle = false;
						STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
							if (shuttle.shuttles[0].id === cell.original.active_id) {
								isShuttle = true;
							}
						});
						return isShuttle ? 'S' : 'V';
					} else {
						return <span />;
					}
				},
			},
			...colsProf,
			{
				id: 'gauntlet_score',
				Header: 'G Score',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: 'gauntlet_score',
				Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.gauntlet_score}</div> : <span />,
			},
			{
				id: 'gauntlet_rank',
				Header: 'G Rank',
				minWidth: 50,
				maxWidth: 70,
				resizable: true,
				accessor: (c) => c.datacore?.ranks.gauntletRank ?? 0,
				Cell: (cell) => cell.original ? <div className='skill-stats-div'>{cell.original.datacore?.ranks.gauntletRank ?? ''}</div> : <span />,
			},
			{
				id: 'traits',
				Header: 'Traits',
				minWidth: 140,
				resizable: true,
				accessor: 'traits',
				Cell: (cell) => cell.original ? <div style={compactMode ? { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } : { whiteSpace: 'normal', height: '50px' }}>{cell.original.traits.replace(/,/g, ', ')}</div> : <span />,
			});

		return _columns;
	}

	function filterCrew(crew: CrewData, searchString: string) {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				if (text.trim().length == 0) return false;
				// search the name first
				if (crew.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (crew.traits.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the raw traits
				if (crew.rawTraits.find(trait => trait.toLowerCase().indexOf(text) > -1)) {
					return true;
				}

				if ((crew as any).bonus) {
					return ((crew as any).bonus == text);
				}

				return false;
			});
		});
	}

	return (<div style={{ marginTop: '15px' }}>
		<SearchBox placeholder='Search by name or trait...'
			onChange={(ev, newValue) => setFilterText(newValue ?? '')}
			onSearch={(newValue) => setFilterText(newValue)}
		/>
		<div className='data-grid' data-is-scrollable='true'>
			<ReactTable
				data={items}
				columns={columns}
				defaultPageSize={(items.length <= 50) ? items.length : 50}
				pageSize={(items.length <= 50) ? items.length : 50}
				sorted={sorted}
				onSortedChange={sorted => setSorted(sorted)}
				showPagination={(items.length > 50)}
				showPageSizeOptions={false}
				className="-striped -highlight"
				style={(items.length > 50) ? { height: 'calc(100vh - 200px)' } : {}}
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
	</div>
	);
};
