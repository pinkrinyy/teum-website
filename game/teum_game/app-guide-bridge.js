/* =========================================================
   틈 앱 화면(app_2/app_3 iframe) 안에서 도는 미션 가이드 엔진.
   - 앱 화면 구성(마크업/스타일)은 전혀 건드리지 않는다. 화면 위에 position:fixed
     하이라이트 테두리 하나만 얹고, 클릭은 캡처 단계에서 걸러낸다.
   - 부모(index.html / app-tablet.js)가 postMessage로 "이 대상을
     눌러라 / 이 대상을 보여줘라 / 이 동작을 해라"를 보내면 실행하고 결과를 돌려준다.
   - 각 앱은 TeumGuide.register(targets, actions)로 자기 화면의 대상/자동입력 동작만 등록한다.

   부모 -> 앱  { source:'teum-parent', type:'guide', id, mode:'click'|'show', target, action, after, skipIf }
               { source:'teum-parent', type:'guide-action', id, action, value }
               { source:'teum-parent', type:'guide-hold' }               하이라이트 끄고 잠금만 유지
               { source:'teum-parent', type:'guide-off' }
               { source:'teum-parent', type:'press-guide' }              Enter·말풍선 클릭 = 지금 단계 진행
   앱 -> 부모  { source:'teum-guide', type:'guide-rect', rect }      하이라이트 대상 위치(앱 좌표)
               { source:'teum-guide', type:'guide-ready', id }       show 단계 내용 표시 완료
               { source:'teum-guide', type:'guide-done', id }        click 단계 완료
               { source:'teum-guide', type:'guide-blocked' }         엉뚱한 곳을 누름
               { source:'teum-guide', type:'guide-next', id }        show 단계에서 하이라이트 범위를 누름 = [다음]
               { source:'teum-guide', type:'action-done', id }
               { source:'teum-guide', type:'guide-enter' }           잠금 중 앱 안에서 Enter
   ========================================================= */
(function(){
  var targets = {}, actions = {};
  var locked = false;      // 가이드 진행 중이면 대상 외 클릭/입력을 막는다
  var allowEl = null;      // 지금 눌러도 되는 요소 (click 단계일 때만)
  var ringEl = null;       // 지금 하이라이트 중인 요소
  var bypass = false;      // 엔진이 직접 일으키는 클릭(자동 설정)은 잠금을 통과시킨다
  var ring = null, lastRect = '', rafId = 0, stepToken = 0;
  var RING_EDGE = 13;      // 테두리 상자가 화면 가장자리에서 떨어질 최소 거리 = 숨쉬기 최대 빛(12px) + 1
  var showId = null;       // 내용 표시가 끝난 show 단계 id - 이때 하이라이트 범위를 누르면 [다음]과 같다

  window.TeumGuide = {
    register: function(t, a){
      Object.keys(t || {}).forEach(function(k){ targets[k] = t[k]; });
      Object.keys(a || {}).forEach(function(k){ actions[k] = a[k]; });
    },
    // 자동 설정용: 잠금을 통과하는 클릭
    click: function(el){ if(!el) return; bypass = true; try{ el.click(); } finally { bypass = false; } },
    // 자동 입력용: 타자 치듯 한 글자씩 넣고 input 이벤트를 보낸다
    type: function(el, text, cps){
      return new Promise(function(resolve){
        if(!el){ resolve(); return; }
        var isField = ('value' in el);
        var i = 0;
        if(isField) el.value = ''; else el.textContent = '';
        (function tick(){
          i++;
          var v = text.slice(0, i);
          if(isField) el.value = v; else el.textContent = v;
          el.dispatchEvent(new Event('input', { bubbles:true }));
          if(i < text.length) setTimeout(tick, cps || 65); else resolve();
        })();
      });
    },
    wait: function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); },
    scrollTo: scrollIntoViewInside
  };

  function post(type, extra){
    var msg = { source:'teum-guide', type:type };
    if(extra) Object.keys(extra).forEach(function(k){ msg[k] = extra[k]; });
    try{ window.parent.postMessage(msg, '*'); }catch(e){}
  }

  /* ---------- 하이라이트 테두리 ---------- */
  function ensureRing(){
    if(ring) return ring;
    var style = document.createElement('style');
    style.textContent =
      // 테두리·빛이 앱 화면 밖으로 나가 잘리며 깜빡이지 않게: 빛은 테두리에서 최대 12px까지만 (RING_EDGE와 짝)
      '.teum-guide-ring{position:fixed;z-index:2147483000;pointer-events:none;border-radius:14px;box-sizing:border-box;' +
      'border:3px solid #71D369;box-shadow:0 0 0 4px rgba(113,211,105,.28),0 0 10px rgba(113,211,105,.45);' +
      'opacity:0;transition:opacity .2s ease;animation:teumGuidePulse 1.4s ease-in-out infinite;}' +
      '.teum-guide-ring.show{opacity:1;}' +
      '.teum-guide-ring.nudge{animation:teumGuideNudge .45s ease 2;}' +
      '@keyframes teumGuidePulse{0%,100%{box-shadow:0 0 0 4px rgba(113,211,105,.28),0 0 10px rgba(113,211,105,.45);}' +
      '50%{box-shadow:0 0 0 7px rgba(113,211,105,.2),0 0 12px rgba(113,211,105,.7);}}' +
      // 엉뚱한 곳을 눌렀을 때: 예전엔 테두리를 1.08배 키워 넓은 테두리가 화면 밖으로 나갔다 돌아왔다 → 크기 대신 빛을 번쩍
      '@keyframes teumGuideNudge{0%,100%{border-color:#71D369;}50%{border-color:#3E9A3A;box-shadow:0 0 0 7px rgba(113,211,105,.5),0 0 12px rgba(113,211,105,.8);}}';
    document.head.appendChild(style);
    ring = document.createElement('div');
    ring.className = 'teum-guide-ring';
    document.body.appendChild(ring);
    return ring;
  }
  function trackLoop(){
    rafId = 0;
    if(!ringEl || !ringEl.isConnected){ hideRing(); return; }
    var r = ringEl.getBoundingClientRect();
    var pad = 8, E = RING_EDGE; // border-box라 테두리 두께(3)까지 포함 - 예전(안쪽 여백 5 + 테두리 3)과 같은 크기
    // 대상이 화면 가장자리에 붙어 있거나 화면보다 크면 테두리를 화면 안쪽(E)까지만 - 빛까지 화면 안에 들어온다
    var L = Math.max(E, r.left - pad), T = Math.max(E, r.top - pad);
    var R = Math.min(innerWidth - E, r.right + pad), B = Math.min(innerHeight - E, r.bottom + pad);
    ring.style.left = L + 'px';
    ring.style.top = T + 'px';
    ring.style.width = Math.max(0, R - L) + 'px';
    ring.style.height = Math.max(0, B - T) + 'px';
    var key = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    if(key !== lastRect){
      lastRect = key;
      post('guide-rect', { rect:{ top:r.top, left:r.left, width:r.width, height:r.height } });
    }
    rafId = requestAnimationFrame(trackLoop);
  }
  function showRing(el, mode){
    ensureRing();
    ringEl = el; lastRect = '';
    ring.classList.toggle('show-mode', mode === 'show');
    ring.classList.add('show');
    if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
    trackLoop(); // 위치를 즉시 한 번 보고하고, 이후로는 매 프레임 따라간다
    // 부드러운 스크롤이 끝난 뒤 위치도 확실히 다시 보고한다(rAF가 멈춰 있는 경우 대비)
    [250, 600].forEach(function(ms){
      setTimeout(function(){
        if(ringEl !== el) return;
        if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
        lastRect = '';
        trackLoop();
      }, ms);
    });
  }
  function hideRing(){
    ringEl = null;
    document.documentElement.classList.remove('teum-hand');
    if(ring) ring.classList.remove('show');
    if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
  }
  function nudge(){
    if(!ring || !ringEl) return;
    ring.classList.remove('nudge'); void ring.offsetWidth; ring.classList.add('nudge');
  }

  /* 가장 가까운 스크롤 컨테이너 안에서만 대상이 보이게 스크롤한다
     (scrollIntoView는 iframe 밖 부모 문서까지 스크롤해버릴 수 있어서 쓰지 않는다). */
  function scrollIntoViewInside(el){
    var p = el && el.parentElement;
    while(p && p !== document.body){
      var oy = getComputedStyle(p).overflowY;
      if((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight){
        var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
        var margin = 90;
        if(er.top < pr.top + margin || er.bottom > pr.bottom - margin){
          var delta = (er.top + er.height / 2) - (pr.top + pr.height / 2);
          p.scrollTo({ top: p.scrollTop + delta, behavior:'smooth' });
        }
        return;
      }
      p = p.parentElement;
    }
  }

  /* ---------- 잠금: 대상 외 클릭/포커스/키 입력 차단 ----------
     스크롤(휠/터치 드래그)은 막지 않는다 - 내용을 읽을 수 있어야 하므로. */
  function inRing(e){ // 눌린 곳이 지금 보이는 테두리 상자 안인지
    if(!ring || !ringEl || !ring.classList.contains('show')) return false;
    var r = ring.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  // 커서 (teum-cursor.css): 게임 폰 안에서 열리면 앱 커서는 모두 초록 화살표, 지금 누르면 넘어가는 테두리 안만 초록 손가락
  if(window.parent !== window) document.documentElement.classList.add('teum-app');
  document.addEventListener('mousemove', function(e){
    var on = !!ring && !!ringEl && (allowEl === ringEl || showId !== null) && inRing(e);
    document.documentElement.classList.toggle('teum-hand', on);
  }, true);
  function isAllowed(t){ return bypass || !locked || (allowEl && allowEl.contains(t)); }
  // 가이드 중엔 글자를 엔진이 대신 친다(TeumGuide.type) - 입력칸에 포커스가 가면 폰에서 키보드가 올라온다
  function isTextField(t){
    return !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' ||
      (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/.test(t.type)));
  }
  ['click', 'mousedown', 'dblclick'].forEach(function(type){
    document.addEventListener(type, function(e){
      if(type === 'mousedown' && locked && isTextField(e.target)) e.preventDefault();   // 눌러도 되는 제목 칸도 포커스는 안 가게 (클릭은 그대로)
      if(isAllowed(e.target)) return;
      // click 단계: 테두리 안이면 버튼 바깥(여백)을 눌러도 그 버튼을 누른 것과 같다 - 버튼만 누르기엔 범위가 좁았다
      if(allowEl && ringEl === allowEl && inRing(e)){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if(type === 'click') TeumGuide.click(allowEl);
        return;
      }
      // show 단계의 하이라이트 범위: 앱 원래 동작(입력칸 포커스 등)은 막고 다음 단계로 넘긴다
      if(showId !== null && ringEl && (ringEl.contains(e.target) || inRing(e))){ // 테두리 안 어디든
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if(type === 'click'){ var id = showId; showId = null; post('guide-next', { id:id }); }
        return;
      }
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if(type === 'click'){ nudge(); post('guide-blocked'); }
    }, true);
  });
  document.addEventListener('focusin', function(e){
    // 추천 칩이 코드로 주는 focus() 같은 것도 가이드 중이면 바로 푼다
    if(locked && isTextField(e.target)){ e.target.blur(); return; }
    if(isAllowed(e.target)) return;
    if(e.target && e.target.blur) e.target.blur();
  }, true);
  ['keydown', 'beforeinput', 'paste', 'drop'].forEach(function(type){
    document.addEventListener(type, function(e){
      if(bypass || !locked) return;
      e.preventDefault(); e.stopPropagation();
      // 가이드 중 Enter = 게임 화면에서 Enter와 같다 (부모가 지금 단계를 진행 - press-guide로 다시 온다)
      if(type === 'keydown' && e.key === 'Enter' && !e.isComposing && !e.repeat) post('guide-enter');
    }, true);
  });

  /* ---------- 대상 찾기: 화면 전환 직후일 수 있어 잠깐 기다려본다 ---------- */
  function resolveTarget(name){
    return new Promise(function(resolve){
      var tries = 0;
      (function look(){
        var fn = targets[name];
        var el = fn ? fn() : null;
        var visible = el && el.isConnected && el.getClientRects().length > 0;
        if(visible || tries++ > 30){ resolve(visible ? el : null); return; }
        setTimeout(look, 60);
      })();
    });
  }
  function runAction(name, value){
    var fn = actions[name];
    if(!fn) return Promise.resolve();
    try{ return Promise.resolve(fn(value)); }catch(e){ return Promise.resolve(); }
  }

  /* ---------- 부모 명령 처리 ---------- */
  window.addEventListener('message', function(e){
    var d = e.data;
    if(!d || d.source !== 'teum-parent') return;
    // 부모가 Enter·말풍선 클릭을 받으면: 누르기 단계는 그 버튼을, 보여주기 단계는 [다음]을 누른 것과 같다
    if(d.type === 'press-guide'){
      if(allowEl && ringEl === allowEl) TeumGuide.click(allowEl);
      else if(showId !== null){ var sid = showId; showId = null; post('guide-next', { id:sid }); }
      return;
    }
    if(/^guide/.test(d.type)) showId = null;

    if(d.type === 'guide-off'){
      stepToken++;
      locked = false; allowEl = null; hideRing();
      return;
    }
    if(d.type === 'guide-hold'){
      // 미션 사이 안내 중: 하이라이트는 끄고 잠금만 유지
      stepToken++;
      locked = true; allowEl = null; hideRing();
      return;
    }
    if(d.type === 'guide-action'){
      locked = true; allowEl = null;
      runAction(d.action, d.value).then(function(){ post('action-done', { id:d.id }); });
      return;
    }
    if(d.type !== 'guide') return;

    var token = ++stepToken;
    locked = true; allowEl = null; hideRing();
    var pre = d.mode === 'show' && d.action ? runAction(d.action, d.value) : Promise.resolve();

    resolveTarget(d.target).then(function(el){
      if(token !== stepToken) return;
      // click 단계인데 이미 그 상태라면(예: 가사 탭이 이미 선택됨) 바로 넘어간다
      if(el && d.mode === 'click' && d.skipIf === 'active' && el.classList.contains('active')){
        post('guide-done', { id:d.id, skipped:true });
        return;
      }
      if(el){ scrollIntoViewInside(el); showRing(el, d.mode); }

      if(d.mode === 'click'){
        allowEl = el;
        if(!el){ post('guide-done', { id:d.id, missing:true }); return; }
        var onClick = function(){
          el.removeEventListener('click', onClick, true);
          if(token !== stepToken) return;
          allowEl = null;
          // 앱 원래 동작(화면 열기/체크 등)이 먼저 끝나도록 한 틱 뒤에 이어서 진행
          setTimeout(function(){
            if(token !== stepToken) return;
            runAction(d.after, d.afterValue).then(function(){
              if(token !== stepToken) return;
              hideRing();
              post('guide-done', { id:d.id });
            });
          }, 30);
        };
        el.addEventListener('click', onClick, true);
      } else {
        pre.then(function(){
          if(token !== stepToken) return;
          // 자동 설정된 내용이 다시 그려졌을 수 있으니 대상을 한 번 더 찾아 테두리를 맞춘다
          resolveTarget(d.target).then(function(el2){
            if(token !== stepToken) return;
            if(el2){ scrollIntoViewInside(el2); showRing(el2, 'show'); }
            showId = d.id;
            post('guide-ready', { id:d.id });
          });
        });
      }
    });
  });
})();
