# Aero
CMS based on [iojs](https://iojs.org/), [Express](https://github.com/strongloop/express), [Jade](https://github.com/jadejs/jade) and [Stylus](https://github.com/LearnBoost/stylus). The goals are:

* [Page Speed](https://developers.google.com/speed/pagespeed/insights/) rank of 100/100
* Low latency (minimize HTTP requests)
* Load full website only once (use AJAX updates with permalink/SEO support)
* Auto-recompile pages when they change

## Vision

If you care about __loading speed__ you've come to the right place.

Aero's only goal is to deliver top-notch performance for your website. Traditional CMS generate lots of HTTP requests, leading to very slow loading times in high latency environments like mobile networks. Even if you simply access a site in Amsterdam from Japan every single HTTP request that doesn't load parallely adds a lot of loading time to your website.

Aero based websites are fast because they inline a lot of the resources that would usually call for a chained HTTP request. If you have 300 ms / 0.3 secs latency and your website has 3 non-parallel HTTP requests, then you are wasting almost a full second of loading time.

Additionally, resources like fonts are only loaded once because the full website is only loaded once on the first access. After that Aero utilizes AJAX updates on links that are 100% SEO friendly. Static pages are cached in the user's browser to reduce the load on your web server if the same page is accessed again.

We also care about how fast you can deploy and preview changes, in other words your productivity. Therefore you don't need to restart the server when you change a file, Aero will automatically determine the dependencies and recompile all resources.

## Usage

You can install aero via npm:

	npm install aero --save

Now you can load the module:

	let aero = require("aero");

And start it:

	aero.start();

That's all you need for your index.js file. Run it using:

	node index.js

## Hello World

Create your main file `index.js` if it doesn't exist yet:

	let aero = require("aero");
	aero.start();
	
You can also specify a config file path by passing it to `aero.start(configFile)` which defaults to `config.json`.

Create a file called `config.json` in your root directory:

	{
		"siteName": "Hello World",
		"pages": [
			"helloworld"
		],
		"port": 4000
	}

Add a main layout file `layout.jade` in your root directory:

	doctype html
	html
		head
			title= siteName
			style!= css

		body
			#content!= content
			script!= js

`siteName` is the title you set up in your config before. The variables `css`, `js` and `content` are set by Aero.

Install Aero:

	npm install aero --save

Now run it using:

	node index.js

This should automatically create the `pages/helloworld/helloworld.jade` file and start your server on port 4000. Navigate your browser to [http://localhost:4000/helloworld](http://localhost:4000/helloworld) to see the "helloworld" from your automatically created page rendered into your layout.

Aero page components are grouped by feature, not by file type like most MVC frameworks. For example the `helloworld` page can contain a `helloworld.jade`, `helloworld.styl`, `helloworld.json` and a `helloworld.js` file all in the same directory. We believe that grouping by feature eases the maintenance of any kind of project.

Now try to change the `helloworld.jade` inside your `pages` directory. Aero notices the changes and recompiles the file automatically.

## Documentation

You've barely scratched the surface of what Aero can do with the Hello World example.

	TODO: Tutorial

## Websites using Aero

* [http://blitzprog.org/](http://blitzprog.org/) ([Source](https://github.com/blitzprog/blitzprog.org))

## Status

Aero is an ambitious project that is looking for contributors. It is currently in early alpha stage and if you're interested in creating a system that is tailored for performance, get in touch!