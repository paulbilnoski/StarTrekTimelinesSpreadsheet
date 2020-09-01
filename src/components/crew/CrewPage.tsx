import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

import { CrewList } from './CrewList';

import { exportExcel } from './excelExporter';
import { exportCsv } from './csvExporter';

import STTApi, { download } from '../../api';
import { CrewData } from '../../api/DTO';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { ButtonGroup, Button, ToggleButton } from 'react-bootstrap';

export const CrewPage = (props: {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}) => {
    const [filterText, setFilterText] = React.useState<string>('');
    const [showEveryone, setShowEveryone] = React.useState<boolean>(false);
    const [showBuyback, setShowBuyback] = React.useState<boolean>(false);
    const [showCanTrain, setShowCanTrain] = React.useState<boolean>(false);
    const [groupRarity, setGroupRarity] = React.useState<boolean>(false);
    const [compactMode, setCompactMode] = React.useState<boolean>(true);
    const [displayMode, setDisplayMode] = React.useState<string>('Base');
    const [crewData, setCrewData] = React.useState<CrewData[]>([]);

    React.useEffect(() => {
        setCrewData(loadCrewData());
    }, [showEveryone, showBuyback, showCanTrain]);

    React.useEffect(() => {
        _updateCommandItems();
    }, [showEveryone, showBuyback, showCanTrain, groupRarity, compactMode]);

    const displayModes = ['Base', 'Gauntlet', 'Voyage'];
    return <div>
        <div className="mx-auto" style={{ display: 'block', width: '250px' }}>
            <ButtonGroup toggle>
                {
                    displayModes.map(dm =>
                        <ToggleButton key={dm} type="radio" value={dm} checked={displayMode === dm}
                            onClick={() => setDisplayMode(dm)}>{dm}</ToggleButton>
                    )
                }
            </ButtonGroup>
        </div>
        <SearchBox placeholder='Search by name or trait...'
            onChange={(ev, newValue) => setFilterText(newValue || '')}
            onSearch={(newValue) => setFilterText(newValue)}
        />
        <CrewList data={crewData}
            groupRarity={groupRarity}
            showBuyback={showBuyback}
            compactMode={compactMode}
            filterText={filterText}
            displayMode={displayMode} />
    </div>;

    function loadCrewData() : CrewData[] {
        let crewData = STTApi.roster;
        if (showEveryone) {
            const isFFFE = (crew: CrewData) => (crew.frozen > 0) || ((crew.rarity === crew.max_rarity) && (crew.level === 100));
            const notOwned = (crew: CrewData) => {
                let rc = STTApi.roster.find((rosterCrew) => !rosterCrew.buyback && (rosterCrew.symbol === crew.symbol));

                return !(rc) || !isFFFE(rc);
            }

            // Let's combine allcrew with roster such that FFFE crew shows up only once
            crewData = crewData.concat(STTApi.allcrew.filter(crew => notOwned(crew)));
        }

        if (!showBuyback) {
            crewData = crewData.filter(crew => !crew.buyback);
        }

        if (showCanTrain) {
            crewData = crewData.filter(crew => crew.level !== 100);
        }

        return crewData;
    }

    function _updateCommandItems() {
        if (props.onCommandItemsUpdate) {
            props.onCommandItemsUpdate([
                {
                    key: 'export',
                    text: 'Export',
                    iconProps: { iconName: 'Download' },
                    subMenuProps: {
                        items: [
                            {
                                key: 'exportExcel',
                                name: 'Export Excel...',
                                iconProps: { iconName: 'ExcelLogo' },
                                onClick: async () => {
                                    let data = await exportExcel(STTApi.items);
                                    download('My Crew.xlsx', data, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            },
                            {
                                key: 'exportCsv',
                                name: 'Export CSV...',
                                iconProps: { iconName: 'ExcelDocument' },
                                onClick: () => {
                                    let csv = exportCsv();
                                    download('My Crew.csv', csv, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            }
                        ]
                    }
                },
                {
                    key: 'settings',
                    text: 'Settings',
                    iconProps: { iconName: 'Equalizer' },
                    subMenuProps: {
                        items: [{
                            key: 'groupRarity',
                            text: 'Group by rarity',
                            canCheck: true,
                            isChecked: groupRarity,
                            onClick: () => {
                                let isChecked = !groupRarity;
                                setGroupRarity(isChecked);
                            }
                        },
                        {
                            key: 'showBuyback',
                            text: 'Show buyback (dismissed) crew',
                            canCheck: true,
                            isChecked: showBuyback,
                            onClick: () => {
                                let isChecked = !showBuyback;
                                setShowBuyback(isChecked);
                                setCrewData(loadCrewData());
                            }
                        },
                        {
                            key: 'showCanTrain',
                            text: 'Show crew that can receive training',
                            canCheck: true,
                            isChecked: showCanTrain,
                            onClick: () => {
                                let isChecked = !showCanTrain;
                                setShowCanTrain(isChecked);
                                setCrewData(loadCrewData());
                            }
                        },
                        {
                            key: 'compactMode',
                            text: 'Compact mode',
                            canCheck: true,
                            isChecked: compactMode,
                            onClick: () => {
                                let isChecked = !compactMode;
                                setCompactMode(isChecked);
                            }
                        },
                        {
                            key: 'showEveryone',
                            text: 'Show stats for all crew',
                            canCheck: true,
                            isChecked: showEveryone,
                            onClick: () => {
                                let isChecked = !showEveryone;
                                setShowEveryone(isChecked);
                                setCrewData(loadCrewData());
                            }
                        }]
                    }
                }
            ]);
        }
    }
}
