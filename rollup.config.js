import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';
import { join } from "path"
import fs from "fs"

import { config } from 'dotenv';
import replace from '@rollup/plugin-replace';

import { path as _dirname } from "app-root-path"

const production = !process.env.ROLLUP_WATCH;


const comander = (extention, { input, output }) => {

	let bundledir = join(output, extention.output.file)


	console.log("yeeet", input, bundledir)

	let e = {
		input,
		output: {
			file: bundledir,
			format: 'iife',
			sourcemap: false,
		},
		plugins: [


			replace({
				// stringify the object       
				process: JSON.stringify({
					env: {
						SITEKEY:config().parsed.SITEKEY // attached the .env config
					}
				})
			}),
			svelte({
				preprocess: sveltePreprocess(),
				emitCss: false,

				compilerOptions: {
					// enable run-time checks when not in production
					dev: !production
				}
			}),

			resolve({
				browser: true,
				dedupe: ['svelte']
			}),
			commonjs(),
			typescript({
				sourceMap: !production,
				inlineSources: !production
			}),

			// If we're building for production (npm run build
			// instead of npm run dev), minify
			production && terser()


		],
		watch: {
			clearScreen: true
		}
	}
	if (typeof extention.special_options == typeof {})
		e = {
			...e
			, ...extention.special_options
		}
	return e

};



var path = require('path')

async function fromDir(startPath, filter) {
	let alldirs = [];
	//console.log('Starting from dir '+startPath+'/');

	if (!fs.existsSync(startPath)) {
		console.log("no dir ", startPath);
		return;
	}

	var files = fs.readdirSync(startPath);
	for (var i = 0; i < files.length; i++) {
		var filename = path.join(startPath, files[i]);
		var stat = fs.lstatSync(filename);
		if (stat.isDirectory()) {
			alldirs = [...alldirs, ...(await fromDir(filename, filter))]; //recurse
		}
		else if (filename.indexOf(filter) >= 0) {
			alldirs.push(filename);
		};
	};
	return alldirs
};



const extens = JSON.parse(fs.readFileSync(join(_dirname, './config/settings.json'), { encoding: "utf-8" }))


const forEachSync = async function (that, cb) {
	for (let i = 0; i < that.length; i++) {
		await cb(that[i], i)
	}
}

const executer = (async () => {
	var arr = [];

	await forEachSync(extens.plugins, async (exten) => {
		let file = "main.ts";
		(await fromDir(join(_dirname, extens.front_end_div_dir, exten.maindir), file)).forEach(input => {
			let enddir = join(_dirname, extens.front_end_div_dir)
			let subdir = join(input).split(file).join``.split(enddir).join``
			let subbie = {
				input,
				output: join(extens.front_end_out_dir, subdir)
			}
			arr.push(comander(exten, subbie));
		})
	}
	);

	return arr;
})();


export default executer;