# Aero
CMS based on [Node](https://github.com/joyent/node), [Express](https://github.com/strongloop/express), [Jade](https://github.com/jadejs/jade) and [Stylus](https://github.com/LearnBoost/stylus). The goals are:

* [Page Speed](https://developers.google.com/speed/pagespeed/insights/) rank of 100/100
* Low latency (minimize HTTP requests)
* Load full website only once (use AJAX updates with permalink/SEO support)

Traditional CMS generate lots of HTTP requests, leading to very slow loading times in high latency environments like mobile networks. Even if you simply access a site in Amsterdam from Japan every single HTTP request that doesn't load parallely adds a lot of loading time to your website.

Aero based websites are fast because they inline a lot of the resources that would usually call for a chained HTTP request. If you have 300 ms / 0.3 secs latency and your website has 3 non-parallel HTTP requests, then you are wasting almost a full second of loading time.

You can install aero via npm:

	npm install aero --save

Now you can load the module:

	var aero = require("aero");

And start it with a configuration file:

	aero.start("config.json");

That's all you need for your index.js file. Create a configuration file (TODO: document this step) and run it using

	node index.js

__This project is in very early alpha stage__ and doesn't have any documentation (it's pretty much a WFM / Works For Myself at the moment). If you feel hardcore and want to reverse-engineer some stuff, feel free to look at the [source code of my aero based website](https://github.com/blitzprog/blitzprog.org).

## Design Decisions
* Static pages are served directly from memory so there is no FS lookup on a GET request.
* Pages and their contents are stored in the file system instead of a database: This allows us to use git for the page contents. Web developers can use their favourite text editor (e.g. Atom or Sublime). If your website or app is served from multiple servers all you need to do is call _git pull_ when a change happens. SFTP works as well if you prefer a faster workflow using a single server.

## Crash Course
* A page is the most basic element of Aero, e.g. __/__ is the front page and __/blog__ is a different page.
* Every Aero based website needs a
	* config file (in JSON format)
	* directory for pages
	* one sub-directory per page that contains at least a .jade file with the same name
* TODO: Lots of documentation missing, work in progress...