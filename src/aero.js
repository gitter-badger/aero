// Modules
let path = require("path");
let watch = require("node-watch");
let zlib = require("zlib");

// Functions
let getFile = require("./functions/getFile");
let loadFavIcon = require("./functions/loadFavIcon");
let loadPages = require("./functions/loadPages");
let launchServer = require("./functions/launchServer");

// Classes
let Page = require("./classes/Page");
let Layout = require("./classes/Layout");
let Server = require("./classes/Server");
let LiveReload = require("./classes/LiveReload");
let EventEmitter = require("./classes/EventEmitter");

// Aero
let aero = {
	events: new EventEmitter(),
	pages: new Map(),
	server: new Server(),

	// run
	run: function(configPath) {
		configPath = configPath || "package.json";

		// Register event listeners
		this.registerEventListeners();

		// Load default aero configuration
		let defaultConfig = require("../default/config");

		// Load aero config from package.json
		getFile(configPath, defaultConfig, function(json) {
			aero.package = JSON.parse(json);

			// Set config to the data in the "aero" field
			aero.config = aero.package.aero;

			// Let the world know that we're ready
			aero.events.emit("initialized", aero);

			// Watch for page modifications
			watch(aero.config.path.pages, function(filePath) {
				let relativeFilePath = path.relative(aero.config.path.pages, filePath);
				let pageId = path.dirname(relativeFilePath);

				aero.events.emit("page modified", pageId);
			});

			// Watch for layout modifications
			watch(aero.config.path.layout, function() {
				aero.events.emit("layout modified");
			});
		});
	},

	// registerEventListeners
	registerEventListeners: function() {
		this.events.on("initialized", function() {
			loadFavIcon(aero.config.favIcon, function(imageData) {
				aero.server.favIconData = imageData;
			});

			// Layout
			aero.layout = new Layout(aero.config.path.layout);

			// Live reload
			aero.liveReload = new LiveReload(aero.config.liveReloadPort);

			// Pages
			loadPages(aero.config.path.pages, aero.loadPage);

			// Launch the server
			launchServer(aero);
		});

		// Page modifications
		this.events.on("page modified", function(pageId) {
			aero.loadPage(pageId);
		});

		// Layout modifications
		this.events.on("layout modified", function() {
			aero.layout = new Layout(aero.config.path.layout);

			for(let page of aero.pages.values()) {
				if(!page.controller || page.controller.render) {
					aero.events.emit("page loaded", page);
				}
			}
		});

		// Page loaded
		this.events.on("page loaded", function(page) {
			// Register page
			aero.pages.set(page.id, page);

			// Register a raw route
			if(page.controller) {
				aero.server.raw[page.url] = page.controller.get.bind(page.controller);
			} else {
				aero.server.raw[page.url] = function(request, response) {
					response.end(page.code);
				};
			}

			const gzipThreshold = 1024;
			let useGzip = true;
			let js = aero.liveReload.script;
			let renderLayoutTemplate = aero.layout.renderTemplate;
			let headers = {
				"Content-Type": "text/html"
			};

			// Routing
			if(page.controller && page.controller.render) {
				let renderPageTemplate = page.renderTemplate;
				let renderPage = page.controller.render;

				// Syntax error while compiling the template?
				// Then let's send over a live reload script until it's fixed
				if(!renderPageTemplate) {
					aero.get(page.url, function(request, response) {
						response.end("<script>" + aero.liveReload.script + "</script>");
					});
					return;
				}

				if(aero.layout.controller) {
					let renderLayout = aero.layout.controller.render.bind(aero.layout.controller);

					// Dynamic layout + Dynamic page
					aero.get(page.url, function(request, response) {
						response.writeHead(200, headers);

						renderLayout(request, function(layoutControllerParams) {
							renderPage(request, function(params) {
								let code = renderPageTemplate(params);

								if(layoutControllerParams) {
									layoutControllerParams.content = code;
									layoutControllerParams.js = js;

									response.end(renderLayoutTemplate(layoutControllerParams));
								} else {
									response.end(renderLayoutTemplate({
										content: code,
										js: js
									}));
								}
							});
						});
					});
				} else {
					// Static layout + Dynamic page
					aero.get(page.url, function(request, response) {
						response.writeHead(200, headers);

						renderPage(request, function(params) {
							response.end(renderLayoutTemplate({
								content: renderPageTemplate(params),
								js: js
							}));
						});
					});
				}
			} else {
				if(page.controller) {
					// Completely user-controlled dynamic page (e.g. API calls)
					aero.get(page.url, page.controller.get.bind(page.controller));
				} else if(aero.layout.controller) {
					let renderLayout = aero.layout.controller.render.bind(aero.layout.controller);

					// Dynamic layout + Static page
					aero.get(page.url, function(request, response) {
						response.writeHead(200, headers);

						renderLayout(request, function(layoutControllerParams) {
							layoutControllerParams.content = page.code;
							layoutControllerParams.js = js;

							response.end(renderLayoutTemplate(layoutControllerParams));
						});
					});
				} else {
					// Static layout + Static page
					let staticPageCode = renderLayoutTemplate({
						content: page.code,
						js: js
					});

					if(useGzip && staticPageCode.length >= gzipThreshold) {
						headers["Content-Encoding"] = "gzip";

						zlib.gzip(staticPageCode, {
							level: zlib.Z_BEST_COMPRESSION
						}, function(error, gzippedCode) {
							aero.get(page.url, function(request, response) {
								response.writeHead(200, headers);
								response.end(gzippedCode);
							});
						});
					} else {
						aero.get(page.url, function(request, response) {
							response.writeHead(200, headers);
							response.end(staticPageCode);
						});
					}
				}
			}

			// Live reload
			aero.liveReload.server.broadcast(page.id);
		});
	},

	// loadPage
	loadPage: function(pageId) {
		return new Page(pageId, path.join(aero.config.path.pages, pageId), function(page) {
			aero.events.emit("page loaded", page);
		});
	},

	// get
	get: function(url, route) {
		aero.server.routes[url] = route;
	}
};

module.exports = aero;