# Aero
CMS based on [Node](https://github.com/joyent/node), [Express](https://github.com/strongloop/express), [Jade](https://github.com/jadejs/jade) and [Stylus](https://github.com/LearnBoost/stylus). The goals are:

* [Page Speed](https://developers.google.com/speed/pagespeed/insights/) rank of 100/100
* Low latency (minimize HTTP requests)
* Load full website only once (use AJAX updates with permalink/SEO support)

Traditional CMS generate lots of HTTP requests, leading to very slow loading times in high latency environments like mobile networks. Even if you simply access a site in Amsterdam from Japan every single HTTP request that doesn't load parallely adds a lot of loading time to your website.

Aero based websites are fast because they inline a lot of the resources that would usually call for a chained HTTP request. If you have 300 ms / 0.3 secs latency and your website has 3 non-parallel HTTP requests, then you are wasting almost a full second of loading time.

You can install aero via npm:

    npm install aero-cms --save

Now you can load the module:

    var aero = require("aero-cms");

And start it with a configuration file:

    aero.start("config.json");

That's all you need for your index.js file.
Run it using

    node index.js

__This project is in very early alpha stage__ and doesn't have any documentation (it's pretty much a WFM / Works For Myself at the moment). If you feel hardcore and want to reverse-engineer some stuff, feel free to look at the [source code of my aero based website](https://github.com/blitzprog/blitzprog.org).