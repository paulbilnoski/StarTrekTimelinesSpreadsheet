import React from 'react';
import { Fabric } from 'office-ui-fabric-react/lib/Fabric';
import { CommandBar, ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { TooltipHost, TooltipDelay, DirectionalHint } from 'office-ui-fabric-react/lib/Tooltip';
import { initializeIcons } from 'office-ui-fabric-react/lib/Icons';
import { History, createBrowserHistory } from 'history';
import { ColorClassNames, ITheme } from '@uifabric/styling';

// #!if ENV === 'electron' || ENV === 'exp'
import { LoginDialog } from './LoginDialog';
// #!endif

import { ShipList } from './ShipList';
import { ItemPage } from './ItemPage';
import { CrewPage } from './crew/CrewPage';
import { CrewShipPage } from './crew/CrewShipPage';
import { CrewTopPage } from './crew/CrewTopPage';
import { GauntletHelper } from './gauntlet/GauntletHelper';
import { MissionExplorer } from './missions/MissionExplorer';
import { AboutAndHelp } from './AboutAndHelp';
import { HomePage } from './HomePage';
import { FleetDetails } from './FleetDetails';
import { VoyagePage } from './voyage/VoyagePage';
import { NeededEquipment } from './NeededEquipment';
import { CrewDuplicates } from './crew/CrewDuplicates';
import { IncompleteMissions } from './IncompleteMissions';
import { CryoCollections } from './CryoCollections';
import { FactionDetails } from './factions/FactionDetails';
import { Shuttles } from './Shuttles';
import { EventHelperPage } from './events/EventHelperPage';
import { Experiments } from './Experiments';
import { ModalNotification } from './ModalNotification';
import { loadUITheme } from './Styles';
import { DarkThemeProvider } from './DarkThemeContext';

import STTApi from '../api';
import { loginSequence } from '../api';
// import { createIssue } from '../utils/githubUtils';
import { openShellExternal, getAppVersion } from '../utils/pal';


// #!if ENV === 'electron'
// import { rcompare } from 'semver';
// #!endif

export interface AppHomeProps {
	onLogout: () => void;
}

interface AppHomeState {
	showSpinner: boolean,
	dataLoaded: boolean,
	showLoginDialog: boolean,
	captainName: string,
	spinnerLabel: string,
	spinnerSublabel?: string,
	hideErrorDialog: boolean,
	hideBootMessage: boolean,
	showBootMessage: boolean,
	errorMessage: any,
	updateUrl?: string,
	theme?: any,
	motd?: { show: boolean; contents: string; title: string },
	darkTheme: boolean,
	extraCommandItems?: ICommandBarItemProps[],
	currentTab?: string
}

export class AppHome extends React.Component<AppHomeProps, AppHomeState> {
	history: History<any>;

	constructor(props: AppHomeProps) {
		super(props);

		this.history = createBrowserHistory();
		this.history.listen(location => {
			this._switchTab(location.hash.substr(1));
		});

		this._onAccessToken = this._onAccessToken.bind(this);
		this._onLogout = this._onLogout.bind(this);
		this._onRefresh = this._onRefresh.bind(this);
		this._onDataFinished = this._onDataFinished.bind(this);
		this._onDataError = this._onDataError.bind(this);
		this._playerResync = this._playerResync.bind(this);
		this._onSwitchTheme = this._onSwitchTheme.bind(this);
		this._onDismissBootMessage = this._onDismissBootMessage.bind(this);

		this._getNavItems = this._getNavItems.bind(this);
		this._getNavOverflowItems = this._getNavOverflowItems.bind(this);
		this._getNavFarItems = this._getNavFarItems.bind(this);
		this._switchTab = this._switchTab.bind(this);
		this.renderItem = this.renderItem.bind(this);

		initializeIcons(/* optional base url */);

		let theme = this._onSwitchTheme(false, false);

		this.state = {
			showSpinner: false,
			dataLoaded: false,
			showLoginDialog: false,
			captainName: 'Welcome!',
			spinnerLabel: 'Loading...',
			spinnerSublabel: '',
			hideErrorDialog: true,
			hideBootMessage: true,
			showBootMessage: false,
			errorMessage: '',
			updateUrl: undefined,
			theme: theme,
			motd: undefined,
			darkTheme: false
		};

		STTApi.config.where('key').equals('ui.darkThemeMode').first().then((entry) => {
			this.setState({ darkTheme: entry && entry.value }, () => {
				this._onSwitchTheme(true);
			});
		});

		STTApi.loginWithCachedAccessToken().then((success) => {
			if (success) {
				this.setState({ showSpinner: true, showLoginDialog: false });
				this._onAccessToken();
			}
			else {
				this.setState({ showLoginDialog: true });
				this.props.onLogout();
			}
		});
	}

	_onSwitchTheme(shouldForceUpdate: boolean, darkTheme?: false) : ITheme {
		let finalTheme = loadUITheme(darkTheme !== undefined ? darkTheme : this.state.darkTheme);

		const root : any = document.querySelector('.App-content');
		if (root) {
			root.style.backgroundColor = finalTheme.semanticColors.bodyBackground;
			root.style.color = finalTheme.semanticColors.bodyText;
		}

		document.body.style.backgroundColor = finalTheme.semanticColors.bodyBackground;
		document.body.style.color = finalTheme.semanticColors.bodyText;

		if (shouldForceUpdate) {
			this.setState({ theme: finalTheme });
			STTApi.config.put({ key: 'ui.darkThemeMode', value: this.state.darkTheme });
			(window as any).setThemeCss(this.state.darkTheme); //HACK: how to access setThemeCss?
			this.forceUpdate();
		}
		return finalTheme;
	}

	_onDismissBootMessage() {
		STTApi.config.put({ key: 'ui.showBootMessage' + getAppVersion(), value: this.state.showBootMessage });

		this.setState({ hideBootMessage: true });
	}

	componentDidMount() {
		// this.intervalPlayerResync = setInterval(this._playerResync, 5 * 60 * 1000);
		this._switchTab('HomePage');
	}

	componentWillUnmount() {
		// clearInterval(this.intervalPlayerResync);
	}

	_playerResync() {
		// Every 5 minutes, refresh the player currency data (the number of merits, chronitons, etc.)
		if (this.state.dataLoaded) {
			STTApi.resyncPlayerCurrencyData();
		}
	}

	render() {
		if (this.state.showSpinner) {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui massive text active centered inline loader">{this.state.spinnerLabel}<br/>{this.state.spinnerSublabel ?? ''}</div>
			</div>;
		}

		return (
			<DarkThemeProvider value={this.state.darkTheme}>
			<Fabric style={{ color: this.state.theme.semanticColors.bodyText, backgroundColor: this.state.theme.semanticColors.bodyBackground }} className='App'>
				<div style={{ display: 'flex', flexFlow: 'column', height: '100%', padding: '3px' }}>
					<div style={{ flex: '1 1 auto' }}>
						{this.state.dataLoaded && <CommandBar items={this._getNavItems()} overflowItems={this._getNavOverflowItems()} farItems={this.state.extraCommandItems} />}
					</div>
					<div style={{ flex: '0 1 auto' }}>
						{this.renderItem()}
					</div>
				</div>

				<Dialog
					hidden={this.state.hideErrorDialog}
					dialogContentProps={{
						type: DialogType.normal,
						title: 'An error occured while loading data!',
						subText: 'Try restarting the application; if the error persists, please log a bug. Details: ' + this.state.errorMessage
					}}
					modalProps={{ isBlocking: true }}
				>
					<DialogFooter>
						{/* <PrimaryButton onClick={() => { createIssue(false, this.state.errorMessage); }} text='Create bug report' /> */}
						<DefaultButton onClick={() => { this._onLogout(); }} text='Cancel' />
					</DialogFooter>
				</Dialog>

				<Dialog
					hidden={this.state.hideBootMessage}
					onDismiss={() => { this._onDismissBootMessage(); }}
					dialogContentProps={{
						type: DialogType.normal,
						title: 'Please read me',
						subText: 'Star Trek Timelines is not designed to be accessed on multiple clients simultaneously!'
					}}
					modalProps={{ isBlocking: true }}
				>
					<div>
						<p>In order to avoid synchronization issues, please only have <b>one active client at a time</b> (this includes the
							game on any platform and/or the tool). Close / shut down all other clients, or restart them upon making changes somewhere else.</p>
						<p><i>Note:</i> If you're only using the tool to look at stats (and are ok with potentially out of date info), and
							don't use any active sync features (such as interacting with Gauntlet or Voyage), you can keep it running alongside the game.</p>
						<p><b>Note:</b> If you have the app open at the same time as a ship battle (or skirmish battle) and it reaches out to the server, your
							current ship battle state may be invalidated!</p>

						<Checkbox checked={!this.state.showBootMessage} label="Don't show again"
							onChange={(e, isChecked) => { this.setState({ showBootMessage: !isChecked }); }}
						/>

						<br />
					</div>
					<DialogFooter>
						<DefaultButton onClick={() => { this._onDismissBootMessage(); }} text='Ok' />
					</DialogFooter>
				</Dialog>

				{/* #!if ENV === 'electron' || ENV === 'exp' */}
				{this.state.showLoginDialog && <LoginDialog onAccessToken={this._onAccessToken} />}
				{/* #!endif */}

				<ModalNotification ref='modalNotification' />
			</Fabric>
			</DarkThemeProvider>
		);
	}

	renderItem() {
		if (!this.state.dataLoaded) {
			return <span />;
		}

		let commandItemsUpdater = (extraItems: ICommandBarItemProps[]) => {
			this.setState({
				extraCommandItems: this._getNavFarItems(extraItems)
			});
		};

		switch (this.state.currentTab) {
			case 'Crew':
				return <CrewPage onCommandItemsUpdate={commandItemsUpdater} />;

			case 'CrewTop':
				return <CrewTopPage onCommandItemsUpdate={commandItemsUpdater} />;

			case 'CrewShip':
				return <CrewShipPage onCommandItemsUpdate={commandItemsUpdater} />;

			case 'Items':
				return <ItemPage onCommandItemsUpdate={commandItemsUpdater} />;

			case 'Ships':
				return <ShipList />;

			case 'Missions':
				return <MissionExplorer onCommandItemsUpdate={commandItemsUpdater} />;

			case 'Voyage':
				return <VoyagePage onCommandItemsUpdate={commandItemsUpdater} />;

			case 'Gauntlet':
				return <GauntletHelper onCommandItemsUpdate={commandItemsUpdater} />;

			case 'Fleet':
				return <FleetDetails />;

			case 'About':
				return <AboutAndHelp />;

			case 'HomePage':
				return <HomePage
					onLogout={this._onLogout}
					onRefresh={this._onRefresh}
					onTabSwitch={this._switchTab} />;

			case 'NeededEquipment':
				return <NeededEquipment onCommandItemsUpdate={commandItemsUpdater} />;

			case 'CrewDuplicates':
				return <CrewDuplicates onCommandItemsUpdate={commandItemsUpdater} />;

			case 'IncompleteMissions':
				return <IncompleteMissions />;

			case 'CryoCollections':
				return <CryoCollections onCommandItemsUpdate={commandItemsUpdater} />;

			case 'FactionDetails':
				return <FactionDetails />;

			case 'Events':
				return <EventHelperPage onTabSwitch={this._switchTab} />;

			case 'Shuttles':
				return <Shuttles onTabSwitch={this._switchTab} />;

			case 'Experiments':
				return <Experiments />;

			default:
				return <span>Error! Unknown tab selected.</span>;
		}
	}

	_tabMenuItem(tab: ICommandBarItemProps): ICommandBarItemProps {
		return {
			key: tab.key,
			name: tab.name || tab.key,
			iconProps: { iconName: tab.itemIcon },
			iconOnly: tab.iconOnly,
			disabled: tab.disabled,
			onClick: () => {
				this._switchTab(tab.key);
			}
		}
	}

	_switchTab(newTab: string) {
		if (this.state.currentTab === newTab) {
			// From the history listener, nothing to do here
			return;
		}

		this.setState({
			currentTab: newTab,
			extraCommandItems: this._getNavFarItems()
		}, () => {
			if (this.history.location.hash.substr(1) !== newTab) {
				this.history.push({ hash: newTab });
			}
		});
	}

	_getNavFarItems(extraItems?: ICommandBarItemProps[]) {
		let staticItems = [
			{
				key: 'SwitchTheme',
				name: 'Switch theme',
				iconProps: { iconName: 'Light' },
				iconOnly: true,
				onClick: () => {
					this.setState({ darkTheme: !this.state.darkTheme }, () => this._onSwitchTheme(true));
				}
			},
			{
				key: 'FeedbackHelp',
				name: 'Feedback and help',
				iconProps: { iconName: 'Help' },
				iconOnly: true,
				subMenuProps: {
					items: [this._tabMenuItem({ key: 'About', name: 'Help and About', itemIcon: 'Help', iconOnly: true }),
					// {
					// 	key: 'ReportBug',
					// 	name: 'Report bug...',
					// 	iconProps: { iconName: 'Bug' },
					// 	onClick: () => {
					// 		createIssue(false);
					// 	}
					// },
					// {
					// 	key: 'SendFeedback',
					// 	name: 'Feature request...',
					// 	iconProps: { iconName: 'Comment' },
					// 	onClick: () => {
					// 		createIssue(true);
					// 	}
					// },
					// {
					// 	key: 'EmailMe',
					// 	name: 'info@iampicard.com',
					// 	iconProps: { iconName: 'Mail' },
					// 	onClick: () => {
					// 		openShellExternal("mailto:info@iampicard.com");
					// 	}
					// }
				]}
			}
		];

		return extraItems ? extraItems.concat(staticItems) : staticItems;
	}

	renderCaptainName() {
		return <div style={{ height: '100%' }}>
			<div style={{ cursor: 'pointer', display: 'flex', height: '100%', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }} onClick={() => this._switchTab('HomePage')}>
				<Image src={STTApi.imgUrl(STTApi.playerData.character.crew_avatar?.portrait, () => this.forceUpdate())} height={32} style={{ display: 'inline-block' }} />
				<span style={{ padding: '5px' }}>{this.state.captainName}</span>
			</div>
		</div>;
	}

	renderMotd() {
		if (this.state.motd && this.state.motd.show) {
			return <div style={{ cursor: 'pointer', display: 'flex', padding: '5px', height: '100%', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }}>
				<TooltipHost calloutProps={{ gapSpace: 20 }} delay={TooltipDelay.zero} directionalHint={DirectionalHint.bottomCenter}
					tooltipProps={{
						onRenderContent: () => {
							return (<div dangerouslySetInnerHTML={{ __html: this.state.motd!.contents }} />);
						}
					}} >
					<span className={ColorClassNames.orangeLighter} dangerouslySetInnerHTML={{ __html: this.state.motd.title }} />
				</TooltipHost>
			</div>;
		} else {
			return <span />;
		}
	}

	_getNavOverflowItems() : ICommandBarItemProps[] {
		return [
			this._tabMenuItem({ key: 'Fleet', itemIcon: 'WindDirection' }),
			this._tabMenuItem({ key: 'FactionDetails', name: 'Factions', itemIcon: 'Teamwork' }),
			this._tabMenuItem({ key: 'Shuttles', name: 'Shuttles', itemIcon: 'Sections' }),
			this._tabMenuItem({ key: 'CryoCollections', name: 'Cryo collections', itemIcon: 'CheckList' }),
			this._tabMenuItem({ key: 'CrewTop', name: 'Top Crew', itemIcon: 'Teamwork' }),
			this._tabMenuItem({ key: 'CrewShip', name: 'Crew Ship Abilities', itemIcon: 'Teamwork' }),
			this._tabMenuItem({ key: 'Experiments', name: 'Experiments', itemIcon: 'TestAutoSolid', disabled: true })];
	}

	_getNavItems() {
		let navItems : ICommandBarItemProps[] = [];

		navItems.push({
			key: 'custom',
			text: 'Captain name',
			onRender: () => { return this.renderCaptainName(); }
		});

		if (this.state.motd) {
			navItems.push({
				key: 'customMotd',
				text: 'Motd',
				onRender: () => { return this.renderMotd(); }
			});
		}

		if (this.state.updateUrl) {
			navItems.push({
				key: 'Update',
				name: 'New version available!',
				iconProps: { iconName: 'FlameSolid', styles: { root: { color: 'red' } } },
				iconOnly: true,
				onClick: () => { openShellExternal(this.state.updateUrl!); }
			});
		}

		navItems = navItems.concat([
			this._tabMenuItem({ key: 'Crew', itemIcon: 'Teamwork' }),
			this._tabMenuItem({ key: 'Voyage', itemIcon: 'Rocket' }),
			this._tabMenuItem({ key: 'Gauntlet', itemIcon: 'ConnectContacts' }),
			this._tabMenuItem({ key: 'Events', itemIcon: 'Sections' }),
			this._tabMenuItem({ key: 'Items', itemIcon: 'Boards' }),
			this._tabMenuItem({ key: 'Ships', itemIcon: 'Airplane' }),
			{
				key: 'tools',
				text: 'Tools and recommendations',
				iconProps: { iconName: 'TestUserSolid' },
				subMenuProps: {
					items: [this._tabMenuItem({ key: 'Missions', itemIcon: 'Trophy' }),
					{
						key: 'NeededEquipment',
						name: 'Needed Equipment',
						iconProps: { iconName: 'WaitlistConfirm' },
						onClick: () => {
							this._switchTab('NeededEquipment');
						}
					},
					{
						key: 'CrewDuplicates',
						name: 'Duplicate crew',
						iconProps: { iconName: 'MergeDuplicate' },
						onClick: () => {
							this._switchTab('CrewDuplicates');
						}
					},
					{
						key: 'IncompleteMissions',
						name: 'Incomplete missions',
						iconProps: { iconName: 'Backlog' },
						onClick: () => {
							this._switchTab('IncompleteMissions');
						}
					}]
				}
			},
		]);

		return navItems;
	}

	_onAccessToken() {
		this.setState({ showSpinner: true, showLoginDialog: false });

		loginSequence((progressLabel, progressSublabel) => {
			if (progressLabel && progressLabel.length > 0) {
				if (progressSublabel) {
					console.log(`Progress message: '${progressLabel}' | '${progressSublabel}'`);
				}
				else {
					console.log(`Progress message: ${progressLabel}`);
				}
				this.setState({ spinnerLabel: progressLabel, spinnerSublabel: progressSublabel });
			}
		}).then(this._onDataFinished)
			.catch((err) => {
				this._onDataError(err);
			});
	}

	_onLogout() {
		this.setState({ darkTheme: false }, () => { this._onSwitchTheme(true); });

		STTApi.refreshEverything(true);
		this.setState({ showLoginDialog: true, hideErrorDialog: true, dataLoaded: false, captainName: '', spinnerLabel: 'Loading...', spinnerSublabel: '' });

		this.props.onLogout();
	}

	_onRefresh() {
		STTApi.refreshEverything(false);
		this.setState({ dataLoaded: false, spinnerLabel: 'Refreshing...', spinnerSublabel: undefined });
		this._onAccessToken();
	}

	_onDataError(reason: any) {
		this.setState({ showSpinner: false, errorMessage: reason, hideErrorDialog: false });
	}

	async _onDataFinished() {
		let shouldShowBootMessage = false;
		// #!if ENV === 'electron'
		// This resets with every new version, in case the message is updated or folks forget
		let entry = await STTApi.config.where('key').equals('ui.showBootMessage' + getAppVersion()).first();
		shouldShowBootMessage = !entry || entry.value;
		// #!else
		// TODO: This ifdef should be the same on web, but Safari crashes and burns with dexie indexeddb transactions (potentially Promise-related)
		shouldShowBootMessage = false;
		// #!endif
		this.setState({
			showSpinner: false,
			captainName: STTApi.playerData.character.display_name,
			hideBootMessage: !shouldShowBootMessage,
			showBootMessage: shouldShowBootMessage,
			dataLoaded: true
		});

		// #!if ENV === 'electron'
		// let data = await STTApi.getGithubReleases();
		// let versions = data.map((release) => release.tag_name.replace('v', ''));
		// let maxVersion = versions.sort(rcompare)[0];

		// if (maxVersion != getAppVersion()) {
		// 	var n = new Notification('STT Tool - Update available!', { body: 'A new release of the Star Trek Tool (' + data[0].tag_name + ' ' + data[0].name + ') has been made available. Please check the About tab for download instructions!' });
		// 	this.setState({
		// 		updateUrl: data[0].html_url
		// 	});
		// }
		// #!endif

		// STTApi.networkHelper.get(STTApi.serverAddress + 'motd/get', { webApp: STTApi.inWebMode, dbid: STTApi.playerData.dbid, id: STTApi.playerData.character.id, captainName: STTApi.playerData.character.display_name, version: getAppVersion() }).then((data) => {
		// 	this.setState({ motd: data });
		// });

		// STTApi.networkHelper.get(STTApi.serverAddress + 'motd/notif', { webApp: STTApi.inWebMode }).then((data) => {
		// 	if (data && data.show) {
		// 		this.refs.modalNotification.show(data.title, data.contents);
		// 	}
		// });
	}
}
