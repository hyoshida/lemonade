$(function() {
  // 画面サイズを常に4:3にする
  $(window).bind('load orientationchange resize', function() {
    $('html').css('zoom', Math.min(
        window.innerWidth / document.body.clientWidth,
        window.innerHeight / document.body.clientHeight
      )
    );
  });
});
