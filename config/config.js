module.exports = {
	siteName: "Untitled",
	pagesPath: "./pages",
	stylesPath: "./styles",
	scriptsPath: "./scripts",
	layoutPath: "./layout.jade",
	scripts: [],
	styles: [],
	static: [],
	fonts: [],
	pages: [],
	port: 80,
	ssl: {
		cert: undefined,
		key: undefined,
		ca: undefined,
		port: 443
	},
	browser: {
		cache: {
			duration: 30 * 24 * 60 * 60 * 1000
		}
	}
};