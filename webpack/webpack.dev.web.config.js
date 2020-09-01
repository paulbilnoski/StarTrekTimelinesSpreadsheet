const path = require('path');
const merge = require('webpack-merge');
const WebpackCdnPlugin = require('webpack-cdn-plugin');
const baseConfig = require('./webpack.base.config.js');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

// Config directories
const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_DIR = path.resolve(__dirname, '../dist');

module.exports = merge(baseConfig('webtest', true), {
	plugins: [
		new FaviconsWebpackPlugin({
			logo: SRC_DIR + '/assets/logo.png',
			prefix: 'img/',
			emitStats: false,
			persistentCache: true,
			inject: true,
			background: '#393737',
			title: 'Datacore PADD',
			icons: {
				android: true,
				appleIcon: true,
				appleStartup: true,
				coast: false,
				favicons: true,
				firefox: true,
				opengraph: false,
				twitter: false,
				yandex: false,
				windows: true
			}
		}),
		new WebpackCdnPlugin({
			modules: [
				{ name: 'xlsx-populate', var: 'XlsxPopulate', path: 'browser/xlsx-populate.js' },
				{ name: 'react', var: 'React', path: `umd/react.production.min.js` },
				{ name: 'react-dom', var: 'ReactDOM', path: `umd/react-dom.production.min.js` }
			],
			publicPath: '/node_modules'
		})
	],
	devServer: {
		contentBase: OUTPUT_DIR
	}
});
