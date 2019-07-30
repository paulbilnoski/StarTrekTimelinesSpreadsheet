import React from 'react';

export class SkillCell extends React.Component {
	render() {
		if (this.props.skill.core > 0) {
			let out = <span className='skill-stats'>{this.props.skill.core}</span>;
			let range = <span className='skill-stats-range'>+({this.props.skill.min} - {this.props.skill.max})</span>;
			if (this.props.combined) {
				out = <span className='skill-stats'>{this.props.skill.voy}</span>;
			}
			if (this.props.proficiency) {
				out = range;
			}
			if (this.props.compactMode) {
				return <div className='skill-stats-div'>{out}</div>;
			} else {
				return <div className='skill-stats-div'>{out}</div>;
			}
		}
		else {
			return <div className='skill-stats-div'></div>;
		}
	}
}