const builder = require("electron-builder");
const Platform = builder.Platform;
const path = require('path');
const os = require('os');

const rootPath = path.join('./');
const outPath = path.join(rootPath, 'builds');

if (os.platform() === 'win32') {
	builder.build({
		targets: Platform.WINDOWS.createTarget(),
		prepackaged: path.join(outPath, 'DatacorePADD-win32-x64'),
		config: {
			win: {
				target: ['nsis', '7z'],
				icon: path.join(rootPath, 'src/assets/icons/ATFleet.ico')
			}
		}
	}).catch((error) => {
		console.error(error);
	});
}
else {
	builder.build({
		targets: Platform.MAC.createTarget(),
		prepackaged: path.join(outPath, 'DatacorePADD-darwin-x64/DatacorePADD.app'),
		config: {
			mac: {
				identity: null,
				icon: path.join(rootPath, 'src/assets/icons/ATFleet.icns')
			}
		}
	}).catch((error) => {
		console.error(error);
	});
}