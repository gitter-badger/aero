// Youtube
$(".youtube-video").each(function() {
    var $this = $(this);
    var videoId = $this.attr("data-youtube-id");

    $.getJSON("https://gdata.youtube.com/feeds/api/videos/" + videoId + "?v=2&alt=jsonc", function(info) {
        var videoTitle = info.data.title;

        $this.css("background-image", "url(https://img.youtube.com/vi/" + videoId + "/maxresdefault.jpg)");
        $this.html("<div class='media-box-title video-title'>" + videoTitle + "</div>");
    });
});