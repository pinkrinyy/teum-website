/* 포트폴리오 사이트(GAME 메뉴 → 유형 테스트 → '틈새살이 시작하기')에서 넘어올 때
   index.html?code=7391 처럼 코드가 붙어 오면 코드 입력칸에 채우고 바로 확인한다.
   (index.html이 주소 뒤 ?code=… 를 game.html에 그대로 넘겨준다)
   코드 없이 직접 열면 아무것도 하지 않는다. 입력칸에 포커스는 주지 않는다(모바일 키보드 규칙). */
(function(){
  var code = (new URLSearchParams(location.search).get('code') || '').replace(/\D/g, '');
  if (code.length !== 4) return;
  addEventListener('load', function(){
    for (var i = 0; i < 4; i++) { var b = document.getElementById('otp' + i); if (b) b.value = code[i]; }
    var f = document.getElementById('otpForm');
    if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', {cancelable: true}));
  });
})();

/* 사이트 안 '전체 화면'으로 볼 때 게임을 누르면 키 입력이 게임으로 온다 → ESC는 사이트(맨 바깥 창)로 알려서 작게 되돌리게 한다.
   사이트 없이 직접 열었을 땐 맨 바깥 창이 자기 자신이라 아무 일도 안 일어난다. */
addEventListener('keydown', function(e){
  if (e.key === 'Escape' && window.top !== window) { try { window.top.postMessage({teum: 'gameEsc'}, '*'); } catch (err) {} }
});
