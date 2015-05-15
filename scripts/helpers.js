// replaceAll
String.prototype.replaceAll = function(find, replace) {
	var str = this;
	return str.replace(new RegExp(find, 'g'), replace);
};

// startsWith
String.prototype.startsWith = function(str) {
	return this.indexOf(str) === 0;
};

// prevOrLast
jQuery.fn.prevOrLast = function(selector) {
	var prev = this.prev(selector);
	return (prev.length) ? prev : this.nextAll(selector).last();
};

// nextOrFirst
jQuery.fn.nextOrFirst = function(selector) {
	var next = this.next(selector);
	return (next.length) ? next : this.prevAll(selector).last();
};