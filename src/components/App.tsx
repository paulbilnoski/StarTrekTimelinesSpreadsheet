/*
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import '../assets/css/App.css';
import React from 'react';

import 'react-table/react-table.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// #!if ENV === 'electron'
// #!else
import { SiteHome } from './site/SiteHome';
// #!endif

import { getHello } from '../utils/langhello';

import { AppHome } from './AppHome';

import STTApi from '../api';

export const App = () => {
	let [preBoot, setPreBoot] = React.useState(true);
	// let [euUser, setEuUser] = React.useState(false);
	// let [helloLang, setHelloLang] = React.useState('Hello');
	let [anonymousUser, setAnonymousUser] = React.useState(false);

	React.useEffect(() => {
		// #!if ENV === 'electron' || ENV === 'exp'
		STTApi.setWebMode(false, false);
		// #!elseif ENV === 'webtest'
		STTApi.setWebMode(true, false);
		// #!else
		STTApi.setWebMode(true, false);
		// #!endif

		STTApi.loginWithCachedAccessToken().then(success => {
			setPreBoot(false);
			setAnonymousUser(!success);
		});

	}, []);

	// // #!if ENV === 'webtest' || ENV === 'web'
	// if (window.location.hostname !== 'eu.iampicard.com') {
	// 	fetch('https://extreme-ip-lookup.com/json')
	// 		.then(response => {
	// 			return response.json();
	// 		})
	// 		.then(ipData => {
	// 			setHelloLang(getHello(ipData.countryCode));
	// 			if (ipData.continent === 'Europe') {
	// 				setEuUser(true);
	// 			}
	// 		});
	// }
	// // #!endif

	function renderApp() {
		// #!if ENV === 'web' || ENV === 'webtest'
		if (anonymousUser) {
			return <SiteHome onAccessToken={() => setAnonymousUser(false)} />;
		}
		// #!endif

		return <AppHome onLogout={() => setAnonymousUser(true)} />;
	}

	if (preBoot) {
		return <span />;
	}

	return (
		<div>
			{/* <Portal open={euUser} onClose={() => setEuUser(false)}>
				content
			</Portal> */}
			{renderApp()}
		</div>
	);
}
