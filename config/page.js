"use strict";

String.prototype.capitalize = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
};

module.exports = function(pageName) {
	return {
		title: pageName.capitalize(),
		url: pageName,
		id: pageName,
		visible: true,
		static: true
	};
};