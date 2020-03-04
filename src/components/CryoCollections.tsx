import React from 'react';

import STTApi, { CONFIG } from '../api';
import { CrewAvatarDTO, CrewData, CryoCollectionDTO } from '../api/DTO';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export const CryoCollections = (props: {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}) => {
    const [showComplete, setShowComplete] = React.useState(false);
    React.useEffect(() => updateCommandItems(), []);
    React.useEffect(() => updateCommandItems(), [showComplete]);

    function updateCommandItems() {
        if (props.onCommandItemsUpdate) {
            props.onCommandItemsUpdate([{
                key: 'settings',
                text: 'Settings',
                iconProps: { iconName: 'Equalizer' },
                subMenuProps: {
                    items: [{
                        key: 'showComplete',
                        text: 'Show complete collections',
                        canCheck: true,
                        isChecked: showComplete,
                        onClick: () => setShowComplete(!showComplete)
                    }]
                }
            }]);
        }
    }

    let collections = STTApi.playerData.character.cryo_collections;

    if (!showComplete) {
        collections = collections.filter(c => c.milestone.goal !== 0);
    }

    return <div className='tab-panel' data-is-scrollable='true'>
        {collections.map(c => <CryoCollection key={c.id} collection={c} />)}
    </div>;
}

const CryoCollection = (props: {
    collection: CryoCollectionDTO;
}) => {
    const [imageUrl, setImageUrl] = React.useState<string | undefined>(props.collection.iconUrl);
    if (!imageUrl) {
        STTApi.imageProvider.getImageUrl(props.collection.image, props.collection.id).then((found) => {
            props.collection.iconUrl = found.url;
            setImageUrl(found.url);
        }).catch((error) => { console.warn(error); });
    }

    let archetypes = STTApi.crewAvatars.filter(crew =>
        (crew.traits
            .concat(crew.traits_hidden)
            .filter((trait) => props.collection.traits.includes(trait))
            .length > 0)
            || props.collection.extra_crew.includes(crew.id));
    let unowned: CrewAvatarDTO[] = [];
    let owned: CrewData[] = [];
    let ownedFrozen: CrewData[] = [];
    let allOwnedCrew: CrewData[] = STTApi.roster.filter(crew => !crew.buyback);
    archetypes.forEach(a => {
        let crew = allOwnedCrew.find((crew) => crew.id === a.id);
        if (!crew) {
            unowned.push(a);
        } else if (crew.frozen > 0) {
            ownedFrozen.push(crew);
        } else {
            owned.push(crew);
        }
    });

    let byName = (a:CrewData, b:CrewData) => {
        if (a.short_name < b.short_name) return -1;
        if (a.short_name > b.short_name) return 1;
        return 0;
    };
    owned.sort(byName);
    ownedFrozen.sort(byName);
    unowned.sort((a, b) => {
        if (a.max_rarity < b.max_rarity) { return 1; }
        if (a.max_rarity > b.max_rarity) { return -1; }
        if (a.short_name < b.short_name) return -1;
        if (a.short_name > b.short_name) return 1;
        return 0;
    });

    function htmlDecode(input: string) {
        input = input.replace(/<#([0-9A-F]{6})>/gi, '<span style="color:#$1">');
        input = input.replace(/<\/color>/g, '</span>');

        return {
            __html: input
        };
    }

    const fixFileUrl = (url:string) => {
        return url.replace(/\\/g, '/');
    }

    let isDone = props.collection.milestone.goal === 0;
    let total = owned.length + unowned.length + ownedFrozen.length;
    let unowned5 = unowned.filter(ca => ca.max_rarity == 5);
    let unowned4 = unowned.filter(ca => ca.max_rarity == 4);
    let unowned3 = unowned.filter(ca => ca.max_rarity < 4);

    return <div className="ui vertical segment" style={{
            backgroundImage: (imageUrl ? `url("${fixFileUrl(imageUrl)}")` : ''),
            backgroundPosition: 'right bottom',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '360px',
            marginTop: '20px',
            paddingRight: '360px' }} >
        <h4>{props.collection.name}</h4>
        <p dangerouslySetInnerHTML={htmlDecode(props.collection.description)} />
        <p>
            <span style={{ color:"#ECA50B" }}>Milestone Goal{isDone? "s Complete":""}:&nbsp;
            {props.collection.progress} / {isDone ? props.collection.progress : props.collection.milestone.goal} Immortalized
            </span> ({owned.length + ownedFrozen.length} / {total} total)
        </p>
        <p><b>Active Crew ({owned.length}):</b> {owned.map((crew, i) =>
                <span key={crew.id}>{crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>
                    ({crew.rarity}/{crew.max_rarity})</span>{i < owned.length-1 ? ', ':''}</span>)}</p>
        {(ownedFrozen.length > 0) && <p><b>Frozen ({ownedFrozen.length}): </b>
                {ownedFrozen.map((crew, i) =>
                <span key={crew.id}>{crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>
                    ({crew.rarity}/{crew.max_rarity})</span>{i < ownedFrozen.length - 1 ? ', ' : ''}</span>)}</p>}
        {(unowned.length > 0) && <p><b>Unowned crew (
            {unowned5.length > 0 && <span style={{ color: CONFIG.RARITIES[5].color }}>{unowned5.length}x 5* </span>}
            {unowned4.length > 0 && <span style={{ color: CONFIG.RARITIES[4].color }}>{unowned4.length}x 4* </span>}
            {unowned3.length > 0 && <span>{unowned3.length}x other</span>}): </b>
            {unowned.map((crew, i) => <span key={crew.id}>
                {crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>({crew.max_rarity})</span>
                {i < unowned.length - 1 ? ', ' : ''}</span>)}</p>}
    </div>;
}

