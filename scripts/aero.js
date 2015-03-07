"use strict";

var aero = {
	cache: [],
	originalPath: window.location.pathname,
	stateObj: {publicURL: window.location.pathname},
	poppingState: false,
	pageHandler: function(){},
	baseTitle: "",
	titleSeparator: " - ",
	fadingEnabled: true,
	fadeSpeed: 150,
	pageURL: "/raw{url}",
	pathPrefix: "/",
	publicURLToPage: {},
	lastRequest: null,
	
	$container: null,
	$content: null,
	$navigation: null,
	$loadingAnimation: null,
	
	init: function() {
		// Cache elements
		aero.$container = $("#container");
		aero.$content = $("#content");
		aero.$navigation = $("#navigation");
		aero.$loadingAnimation = $("#loading-animation");
	
		// Ajaxify all links
		aero.ajaxifyLinks();
	
		// Mark active menu item
		aero.markActiveMenuItem(aero.originalPath);
	},
	
	// Make page
	makePage: function(name, id, publicURL) {
		publicURL = aero.pathPrefix + publicURL;
		var pageScriptPath = aero.pageURL.replaceAll("{url}", publicURL);
	
		aero.publicURLToPage[publicURL] = {
			"name": name,
			"id": id,
			"path": pageScriptPath,
			"publicURL": publicURL
		};
	},
	
	// Ajaxify links
	ajaxifyLinks: function() {
		$(".ajax").each(function() {
			$(this).removeClass("ajax");
		}).click(function(e) {
			e.preventDefault();
	
			// Scroll
			if(aero.$navigation.offset().top < 0)
				this.scrollToElement(this.$navigation);
			
			// Load page
			var $this = $(this);
			var publicURL = $this.attr("href");
			//if(publicURL != window.location.pathname)
			aero.loadURL(publicURL);
		});
	},
	
	// Scroll to element
	scrollToElement: function(element, time) {
		time = (typeof time !== "undefined") ? time : 800;
	
		this.$container.animate({
			scrollTop: aero.$container.scrollTop() + element.offset().top
		}, time);
	},
	
	// Load URL into content
	loadURL: function(publicURL) {
		var genericURL = publicURL;
		var params = "";
		
		if(publicURL.startsWith("/+")) {
			// TODO: Generic version
			genericURL = "/users";
			params = publicURL.substr(2);
		} else {
			var slashPos = publicURL.indexOf("/", 1);
	
			if(slashPos !== -1) {
				genericURL = publicURL.substr(0, slashPos);
				params = publicURL.substr(slashPos + 1);
			}
		}
	
		aero.markActiveMenuItem(publicURL);
		
		var page = aero.publicURLToPage[genericURL];
		aero.loadPage(page, publicURL, params);
	},
	
	// Remove slash prefix
	removeSlashPrefix: function(stri) {
		if(stri.indexOf("/") === 0)
			return stri.substr(1);
	
		return stri;
	},
	
	// Load URL
	loadPage: function(page, publicURL, params) {
		// Push history
		aero.pushHistory(publicURL);
	
		// Change title
		if(page.name)
			document.title = page.name;
		else
			document.title = this.baseTitle;
	
		// Cached version
		var url = page.path + "?params=" + params;
	
		if(url in aero.cache) {
			var html = aero.cache[url];
			
			// Loading animation
			aero.$loadingAnimation.stop().fadeIn(aero.fadeSpeed);
			aero.$content.stop().fadeOut(aero.fadeSpeed, function() {
				aero.$loadingAnimation.stop().fadeOut(aero.fadeSpeed);
				
				aero.$content.stop().html(html).fadeIn(aero.fadeSpeed, function() {
					// Ajaxify links
					aero.ajaxifyLinks();
	
					// DOM loaded event
					aero.fireContentLoadedEvent();
	
					// Custom callback
					aero.pageHandler(page.id);
				});
			});
	
			return;
		}
		
		// Stop old request
		if(aero.lastRequest != null) {
			aero.lastRequest.abort();
			aero.lastRequest = null;
		}
	
		// Loading animation
		aero.$loadingAnimation.fadeIn(aero.fadeSpeed);
		aero.$content.fadeOut(aero.fadeSpeed);
	
		// Load content
		aero.lastRequest = $.get(url, function(data) {
			aero.$loadingAnimation.promise().done(function() {
				aero.$loadingAnimation.fadeOut(aero.fadeSpeed);
			});
	
			aero.$content.promise().done(function() {
				aero.$content.html(data).fadeIn(aero.fadeSpeed, function() {
					// Cache the page
					aero.cache[url] = data;
		
					// Ajaxify links
					aero.ajaxifyLinks();
		
					// DOM loaded event
					aero.fireContentLoadedEvent();
		
					// Custom callback
					aero.pageHandler(page.id);
				});
			});
		});
	},
	
	// Fire content loaded event
	fireContentLoadedEvent: function() {
		var DOMContentLoadedEvent = document.createEvent("Event");
		DOMContentLoadedEvent.initEvent("DOMContentLoaded", true, true);
		window.document.dispatchEvent(DOMContentLoadedEvent);
	},
	
	// Push history
	pushHistory: function(publicURL) {
		aero.stateObj.publicURL = publicURL;
		
		if(!aero.poppingState) {
			history.pushState(aero.stateObj, "", publicURL);
		}
	},
	
	// Mark active menu item
	markActiveMenuItem: function(url) {
		if(typeof url === "undefined")
			url = window.location.pathname;
	
		var $navigationLinks = $(".navigation-link");
	
		$navigationLinks.each(function() {
			var $this = $(this);
			var href = $this.attr("href");
	
			if(href === url) {
				$this.addClass("active");
			} else {
				$this.removeClass("active");
			}
		});
	},
	
	// Navigate left
	navigateLeft: function() {
		aero.loadURL($(".active").prevOrLast(".navigation-link").attr("href"));
	},
	
	// Navigate right
	navigateRight: function() {
		aero.loadURL($(".active").nextOrFirst(".navigation-link").attr("href"));
	},
	
	/* Helper functions */
	
	// Set page handler
	setPageHandler: function(func) {
		aero.pageHandler = func;
	},
	
	// Set page URL
	setPageURL: function(newUrl) {
		aero.pageURL = newUrl;
	},
	
	// Set title
	setTitle: function(name) {
		aero.baseTitle = name;
	},
	
	// Fade speed
	setFadeSpeed: function(newFadeSpeed) {
		aero.fadeSpeed = newFadeSpeed;
	}
};