// When document is ready
$(document).ready(function() {
	
});

aero.init();

// Pop state: Forward and backward buttons
$(window).bind('popstate', function(e) {
	aero.poppingState = true;
	
	if(e.originalEvent.state) {
		stateObj = e.originalEvent.state;
		aero.loadURL(aero.stateObj.publicURL);
	} else if(stateObj.publicURL != aero.originalPath) {
		aero.loadURL(aero.originalPath);
	}
	
	aero.poppingState = false;
});

// When everything is fully loaded
$(window).load(function() {
	if(aero.originalPath in aero.publicURLToPage) {
		var page = aero.publicURLToPage[aero.originalPath];
        aero.pageHandler(page.id);
	}
});