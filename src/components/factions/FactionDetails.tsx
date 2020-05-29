import React from 'react';
import { Popup } from 'semantic-ui-react';

import STTApi, { refreshAllFactions } from '../../api';

import { FactionDisplay } from './FactionDisplay';

export const FactionDetails = () => {
	const [showSpinner, setShowSpinner] = React.useState(true);
	const [factionUrls, setFactionUrls] = React.useState<{[key: string]: string}>({});
	const stringId = (id: number) => `faction${id}`;

	refreshAllFactions().then(() => {
		setShowSpinner(false);
	});

	STTApi.playerData.character.factions.forEach(faction => {
		STTApi.imageProvider.getImageUrl(faction.reputation_item_icon.file, faction.id)
			.then(found => {
				if (found.url) {
					factionUrls[stringId(faction.id)] = found.url;
					setFactionUrls(factionUrls);
				}
			})
			.catch(error => {
				console.warn(error);
			});
	});

	if (showSpinner) {
		return (
			<div className='centeredVerticalAndHorizontal'>
				<div className='ui massive centered text active inline loader'>Loading factions...</div>
			</div>
		);
	}

	const refs = STTApi.playerData.character.factions.reduce((acc: any, faction) => {
		acc[stringId(faction.id)] = React.createRef();
		return acc;
	}, {} as React.RefObject<HTMLSpanElement>[]);

	const handleClick = (id: number) => refs[stringId(id)].current.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
		}
	);

	const galleryItems: JSX.Element[] = [];
	const detailItems: JSX.Element[] = [];
	STTApi.playerData.character.factions.forEach(faction => {
		galleryItems.push(
			<div key={faction.id} onClick={() => handleClick(faction.id)}>
				<Popup
					trigger={<img src={factionUrls[stringId(faction.id)]} />}
					content={faction.name}
					position='bottom center'
				/>
			</div>
		);
		detailItems.push(
			<span ref={refs[stringId(faction.id)]} key={faction.name}>
				<FactionDisplay faction={faction} />
			</span>
		);
	});

	return (
		<div className='faction-page'>
			<div className='faction-header'>
				<h1>Factions</h1>
				<div className='faction-gallery'>
					{galleryItems}
				</div>
				<hr/>
			</div>
			<div className='faction-content'>
				{detailItems}
			</div>
		</div>
	);
}
