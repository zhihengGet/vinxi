import { createApp, resolve } from "vinxi";
import {
	BaseFileSystemRouter,
	analyzeModule,
	cleanPath,
} from "vinxi/fs-router";
import { join } from "vinxi/lib/path";
import { config } from "vinxi/plugins/config";
import solid from "vite-plugin-solid";

class SolidStartFileSystemRouter extends BaseFileSystemRouter {
	toPath(src) {
		const routePath = cleanPath(src, this.config)
			// remove the initial slash
			.slice(1)
			.replace(/index$/, "")
			.replace(/\[([^\/]+)\]/g, (_, m) => {
				if (m.length > 3 && m.startsWith("...")) {
					return `*${m.slice(3)}`;
				}
				if (m.length > 2 && m.startsWith("[") && m.endsWith("]")) {
					return `:${m.slice(1, -1)}?`;
				}
				return `:${m}`;
			});

		return routePath?.length > 0 ? `/${routePath}` : "/";
	}

	toRoute(src) {
		let path = this.toPath(src);

		const [_, exports] = analyzeModule(src);
		const hasRouteData = exports.find((e) => e.n === "routeData");
		return {
			$component: {
				src: src,
				pick: ["default", "$css"],
			},
			$$data: hasRouteData
				? {
						src: src,
						pick: ["routeData"],
				  }
				: undefined,
			path,
			filePath: src,
		};
	}
}

function solidStartFileSystemRouter(config) {
	return (router, app) =>
		new SolidStartFileSystemRouter(
			{
				dir: resolve.absolute(config.dir, router.root),
				extensions: ["tsx", "ts", "jsx", "js"],
			},
			router,
			app,
		);
}

export function defineConfig({} = {}) {
	return createApp({
		routers: [
			{
				name: "public",
				mode: "static",
				dir: "./public",
				base: "/",
			},
			{
				name: "client",
				mode: "build",
				handler: "./src/entry-client.tsx",
				routes: solidStartFileSystemRouter({
					dir: "./src/routes",
				}),
				target: "browser",
				plugins: () => [
					solid({
						ssr: true,
					}),
					config("root", {
						resolve: {
							alias: {
								"#start/root": join(process.cwd(), "src", "root.tsx"),
							},
						},
					}),
				],
				base: "/_build",
			},
			{
				name: "ssr",
				mode: "handler",
				handler: "./src/entry-server.tsx",
				routes: solidStartFileSystemRouter({
					dir: "./src/routes",
				}),
				target: "server",
				plugins: () => [
					solid({ ssr: true }),
					config("root", {
						resolve: {
							alias: {
								"#start/root": join(process.cwd(), "src", "root.tsx"),
							},
						},
					}),
				],
			},
		],
	});
}
