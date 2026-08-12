import { defineConfig } from 'vite';
import { crx } from "@crxjs/vite-plugin";
import manifest from './manifest.json';

export default defineConfig({
	plugins: [
		crx({
			manifest: manifest
		})
	],
	build: {
		modulePreload: false,
		rollupOptions: {
			input: {
				panel: '/src/index.html'
			}
		}
	},
});