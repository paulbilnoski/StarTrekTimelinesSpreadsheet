# Datacore PADD
A companion tool to the Star Trek Timelines mobile game to help with management, add conveniences, and provide analysis of your crew, inventory, and activities.
A part of the Datacore.app project

See the [documentation site](https://paulbilnoski.github.io/StarTrekTimelinesSpreadsheet/) for feature details

See also
* [https://datacore.app]
* [https://www.tiltingpoint.com/games/star-trek-timelines/]
* [https://stt.wiki/wiki/]
* [https://www.reddit.com/r/StarTrekTimelines/]

## Project Status
This project is a fork of the original, which is no longer available. It has been modified to not allow interaction with the servers, but only requests data from them on behalf of a player account.

## Notes

> :exclamation: **HELP WANTED** :exclamation: If you enjoy Star Trek Timelines and wish this tool could be improved, I could use your help. Send pull requests, open tickets, or offer other support as you are able. In particular, help with UI styling and documentation are welcome.

**NOTE** This tool does not automate any part of the game play with the purpose of cheating or creating an unfair advantage; its purpose is to function as a tool for management, convenience, and analysis to help players organize their crew and to add utility where the game is lacking (such as inventory management).

**DISCLAIMER** This tool is provided "as is", without warranty of any kind. Use at your own risk!
It should be understood that *Star Trek Timelines* content and materials are trademarks and copyrights of [Tilting Point, Inc.](https://www.tiltingpoint.com/) or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Tilting Point, Inc. (or the previous developer, Disruptor Beam, Inc. [more](/docs/images/DBSupport.png) )

## Install and run the tool

I recommend you install the development environment and play with the source code yourself; make improvements and submit PRs to help your fellow players. See [contribution guidelines](CONTRIBUTING.md).

However, if you're only interested in installing and running the tool, head on to the [releases](https://github.com/paulbilnoski/StarTrekTimelinesSpreadsheet/releases) page and pick a recent release to install.

## Features

See the [documentation site](https://paulbilnoski.github.io/StarTrekTimelinesSpreadsheet/) for feature details

## Development environment

### To get started:
Clone the repo and build with `node.js` v 10.

Minimal set of steps required
* `git clone https://github.com/paulbilnoski/StarTrekTimelinesSpreadsheet.git`
* `cd StarTrekTimelinesSpreadsheet`
* `npm install`
  * You may also need to `npm install electron` if you see the message `Error: Electron failed to install correctly, please delete node_modules/electron and try installing again`
* `npm run dev`

##### Development
* Run `npm run dev` to start *webpack-dev-server*. Electron will launch automatically after compilation.
  * No need to open a browser. The new window displays after the list of assets emitted and a "Compiled successfully" message.
  * If the window displays early, the app will load as a blank page. This may be due to a conflict in services running on local ports. Try changing the port used in the `main.js` to `8080` or `8081` or another unused port on your local machine.

##### Production
_You have two options, an automatic build or two manual steps_

###### One Shot
* Run `npm run package` to have webpack compile your application into `dist/bundle.js` and `dist/index.html`, and then an `electron-packager` run will be triggered for the current platform/arch, outputting to `builds/`

###### Manual
_Recommendation: Update the "postpackage" script call in `package.json` to specify parameters as you choose and use the `npm run package` command instead of running these steps manually_
* Run `npm run build` to have webpack compile and output your bundle to `dist/bundle.js`
* Then you can call `electron-packager` directly with any commands you choose

If you want to test the production build (In case you think Babili might be breaking something) after running `npm run build` you can then call `npm run prod`. This will cause electron to load off of the `dist/` build instead of looking for the *webpack-dev-server* instance. Electron will launch automatically after compilation.

## Privacy and security
There is no server associated with this tool, all state stays on your device. Here's a comprehensive list of URLs that the tool accesses (all these URLs are accessed over a secure (HTTPS) connection):
- https://thorium.disruptorbeam.com/ : this is the login URL for the game; your username / password or Facebook access token is sent to this URL in order to get an access_token. This URL is only accessed during login.
- https://stt.disruptorbeam.com/ : this is the main Star Trek Timelines API endpoint URL, owned by ~~DisruptorBeam~~ TiltingPoint.
- https://ptpb.pw : this URL is accessed when (and only if) you use the Share dialog to share your crew stats online.
- https://www.facebook.com/v2.8/dialog/oauth : this URL is only accessed if you use the Facebook login option. It's used to obtain a facebook access token which is later sent to DB's server to get an access_token.
- https://datacore.app/ : This URL is used to access the "big book" content such as subjective crew rankings and portal availability of crew

The tool never stores your username or password and it only sends it to the game's official servers for login purposes. If you check the "Stay logged in" checkbox in the login dialog, the tool will store an access_token on your local device in the IndexedDB database.
