$(function() {
  // 画面サイズを常に4:3にする
  $(window).bind('load orientationchange resize', function() {
    scale = Math.min(
      window.innerWidth / document.body.clientWidth,
      window.innerHeight / document.body.clientHeight
    )
    offest_left = ((document.body.clientWidth * scale) - document.body.clientWidth) / 2 / scale;
    offest_top = ((document.body.clientHeight * scale) - document.body.clientHeight) / 2 / scale;
    // for FireFox
    $('body').css('-moz-transform', 'scale(' + scale + ') translate(' + offest_left + 'px, ' + offest_top + 'px)');
    // for Opera
    $('body').css('-o-transform', 'scale(' + scale + ') translate(' + offest_left + 'px, ' + offest_top + 'px)');
    // for IE or WebKit
    $('body').css('zoom', scale);
  });
});
