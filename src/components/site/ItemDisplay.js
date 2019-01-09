import React from 'react'

import STTTools from './api';
import { CONFIG } from '../../api';

export class ItemDisplay extends React.Component {
    render() {
        let borderWidth = Math.ceil(this.props.size / 34);
        let starSize = Math.floor(this.props.size / 6);
        let bottomStar = Math.floor(this.props.size / 23);
        let borderRadius = Math.floor(this.props.size / 7);
        let borderColor = CONFIG.RARITIES[this.props.maxRarity].color;

        let star_reward = STTTools.assetProvider.getSpriteCached('atlas_stt_icons', 'star_reward');
        let star_reward_inactive = STTTools.assetProvider.getSpriteCached('atlas_stt_icons', 'star_reward_inactive');

        let rarity = [];
        if (!this.props.hideRarity) {
            for (let i = 0; i < this.props.rarity; i++) {
                rarity.push(<img key={i} src={star_reward} style={{ width: starSize + 'px' }} />);
            }
            for (let i = this.props.rarity; i < this.props.maxRarity; i++) {
                rarity.push(<img key={i} src={star_reward_inactive} style={{ width: starSize + 'px' }} />);
            }
        }

        let divStyle = this.props.style || {};
        divStyle.position = 'relative';
        divStyle.display = 'inline-block';
        divStyle.width = this.props.size + 'px';
        divStyle.height = this.props.size + 'px';

        return <div style={divStyle}>
            <img src={this.props.src} style={{ borderStyle: 'solid', borderRadius: borderRadius + 'px', borderWidth: borderWidth + 'px', borderColor: borderColor, width: (this.props.size - 2 * borderWidth) + 'px', height: (this.props.size - 2 * borderWidth) + 'px' }} />
            {!this.props.hideRarity && <div style={{ position: 'absolute', width: this.props.size + 'px', bottom: bottomStar + 'px', left: '50%', transform: 'translate(-50%, 0)', textAlign: 'center'}}>{rarity}</div>}
        </div>;
    }
}