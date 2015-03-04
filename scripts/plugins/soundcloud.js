// Soundcloud
$(".soundcloud-track").each(function() {
    var $this = $(this);
    var trackURL = $this.attr("data-track-url");

    $.getJSON("https://api.soundcloud.com/resolve.json?url=https://soundcloud.com/" + trackURL + "&client_id=1244575aff0a98380289472fc718c020", function(data) {
        $this.html("<div class='media-box-title track-title'>" + data.title + "</div>");

        if(data.artwork_url) {
            var imageURL = data.artwork_url.replace("large", "t500x500");
            $this.css("background-image", "url(" + imageURL + ")");
        } else {
            $this.css("background-image", "url(/images/icons/soundcloud-large.png)");
        }
    });
});