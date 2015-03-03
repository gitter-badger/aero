# Aero
CMS based on Node, Express, Jade and Stylus. Goals are:

* [Page Speed](https://developers.google.com/speed/pagespeed/insights/) rank of 100/100 (less is not tolerated)
* Low latency (as few HTTP requests as possible)
* Load full website only once (use AJAX updates with permalink/SEO support)
* High performance content server

Traditional CMS generate lots of HTTP requests, leading to very slow loading times in high latency environments like mobile networks. Even if you simply access a site in Amsterdam from Japan every single HTTP request that doesn't load parallely adds a lot of loading time to your website.

Aero based websites are fast because they inline a lot of the resources that would usually call for a chained HTTP request. If you have 300 ms / 0.3 secs latency and your website has 3 non-parallel HTTP requests, then you are wasting almost a full second of loading time.

The general rule of thumb for Aero devs is: If the website doesn't load in less than 1 second, then Aero needs to be improved.