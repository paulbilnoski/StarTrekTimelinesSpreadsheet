---
title: Privacy &amp; Security
section: overview
---

There is no server associated with the standalone version of this tool, all state stays on your device. Here's a comprehensive list of URLs that the tool accesses (all these URLs are accessed over a secure (HTTPS) connection):
- `https://thorium.disruptorbeam.com/`
	- This is the login URL for the game; your username / password or Facebook access token is sent to this URL in order to get an access_token. This URL is only accessed during login.
- `https://stt.disruptorbeam.com/`
	- This is the main Star Trek Timelines API endpoint URL, owned by ~~DisruptorBeam~~ TiltingPoint.
- `https://ptpb.pw`
	- This URL is accessed when (and only if) you use the Share dialog to share your crew stats online.
- `https://www.facebook.com/v2.8/dialog/oauth`
	- This URL is only accessed if you use the Facebook login option. It's used to obtain a facebook access token which is later sent to DB's server to get an access_token.
- `https://datacore.app/`
	- This URL is used to access the "big book" content such as subjective crew rankings and portal availability of crew

The tool never stores your username or password and it only sends it to the game's official servers for login purposes. If you check the "Stay logged in" checkbox in the login dialog, the tool will store an access_token on your local device in the IndexedDB database.

There is also an experimental web version of the tool that requires a server to proxy requests to the official game servers to avoid CORS restrictions. See the `/server` branch in the repository. If you get it working or want to improve the web client, server, or documentation, contributions are welcome.
