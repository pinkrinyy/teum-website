(function(){
  /* ---- 유형별 진행도: 헤더 유형 탭으로 다른 유형에 갔다가 돌아오면 끝낸 미션은 그대로 이어서 한다 ----
     유형을 떠날 때(kitchen:mission-reset - 다른 초기화 리스너보다 먼저 받아야 해서 맨 위에 둔다) 끝낸 미션을 적어 두고,
     돌아오면 게임 시작(kitchen:game-start) 때 그대로 되살린다(restoreProgress). [다시하기]·[다른 코드 입력]은 지운다.
     ponytail: 미션 단위로만 기억 - 미션 도중(앱이 열린 동안)엔 유형 탭이 잠겨 있어 중간 상태는 생기지 않는다 */
  var progressByType = {};
  window.addEventListener('kitchen:mission-reset', function(){
    if(!kitchenScene.classList.contains('game-started')) return; // 시작 대사를 아직 안 봤으면 저장할 게 없다
    var p = activeMateType === 'S' ? { fridge:!!fridgeResolved, laundry:!!laundryResolved }
          : activeMateType === 'A' ? { m1:!!eunminMission1Done, m2:!!eunminMission2Done, 
                                       mateLiving:mate.room === 'livingroom' || !!mate.leaving || !!mate.goingLiving }
          : activeMateType === 'H' ? { tv:!!emotionChatDone, ag:!!emotionEndingDone, fb:!!emotionFbDone } : null; // 메이트가 있던(가던) 방
    if(!p) return;
    p.room = currentRoom; p.pos = { x:playerPos.x, y:playerPos.y }; // 하던 곳(방·자리)에서 이어서 하도록
    var sp = currentPlayerSprites(); // 보던 방향도 (front/back/left/right)
    p.facing = Object.keys(sp).filter(function(k){ return sp[k] === playerFacingSrc; })[0] || null;
    progressByType[activeMateType] = p;
  });
  window.addEventListener('teum:clear-progress', function(){ progressByType = {}; clearedTypes = {}; });

  "use strict";

  /* =========================================================
     0. 기본 설정값 (1536 x 1024 원본 캔버스 기준 좌표)
     ========================================================= */
  var SCENE_W = 2046, SCENE_H = 1686; // kitchen_bg22.png 원본 캔버스 크기 (배경을 kitchen_bg2.png에서 교체하면서
  // 가로만 좌우 여백이 잘려나간 크롭본으로 바뀜 - 세로 크기(1686)는 그대로라 세로 좌표는 영향 없음)

  // 두 번째 미션(다용도실)에서는 배경이 통째로 바뀌면서 원본 캔버스 크기/비율도 달라지므로,
  // 지금 어느 방을 보고 있는지를 기억해둔다('kitchen' | 'utility'). SCENE_W/H는 방을 바꿀 때
  // switchToUtilityRoom()/switchToKitchenRoom()에서 그때그때 다시 대입한다.
  var currentRoom = 'kitchen';
  // 한방판: 유형마다 방 하나만 쓴다 - 금전형 다용도실 / 규칙형 부엌 / 감정형 거실. 다른 방에 있던 미션 물건은 그 방으로 옮겼다.
  // inRoom(방) = 지금 그 방에 있는가. 이 유형이 원래 쓰던 방(TYPE_ROOMS)이면 '한 방'에 모였으므로 참이다
  var ONE_ROOM = { S:'utility', A:'eunminkitchen', H:'livingroom' };
  var TYPE_ROOMS = { S:['kitchen', 'utility', 'livingroom'], A:['eunminkitchen', 'livingroom'], H:['livingroom'] };
  function inRoom(name){
    return currentRoom === name || (currentRoom === ONE_ROOM[activeMateType] && (TYPE_ROOMS[activeMateType] || []).indexOf(name) >= 0);
  }

  // 배경을 kitchen_bg2.png(2528x1686) → kitchen_bg22.png(2046x1686)로 교체하면서
  // 좌우 여백만 잘라낸 크롭본으로 바뀌었다(세로 크기는 동일, 그림 자체 확대/축소는 없음).
  // 아래 기본 좌표들은 전부 그 크롭 비율(가로 2528/2046배 축소 + 잘려나간 왼쪽 242px만큼 이동)에
  // 맞춰 미리 환산해둔 값이라, 배경 교체 전과 같은 자리에 보이도록 다시 설정할 필요가 없다.
  // 좌표 기본값은 tuner-defaults.js (좌표 수정 도구와 함께 쓴다). 부엌 = DEFAULTS, 방별 기본값은 그 안의 utility·eunminKitchen·livingroom
  var DEFAULTS = window.TEUM_TUNER_DEFAULTS;

  // 좌표 = tuner-defaults.js 기본값 위에 tuner-state.js(좌표 수정 도구로 만든 파일)를 덮은 값 - 어느 컴퓨터에서 열어도 같다.
  // 좌표 수정 도구는 좌표수정도구.html (게임에는 튜너·편집기가 없다)
  var state = window.TEUM_buildTunerState(window.TEUM_TUNER_STATE);
  function cloneJSON(v){ return JSON.parse(JSON.stringify(v)); }

  /* =========================================================
     1. 게임 뷰 / 씬 크기 맞추기 (16:9 컨테이너 안에 3:2 원본 비율 유지)
     ========================================================= */
  var kitchenGameView = document.getElementById('kitchenGameView');
  var kitchenScene = document.getElementById('kitchenScene');

  function fitScene(){
    // 박스(room-stage) 크기는 항상 고정(부엌 비율)이고, 배경 이미지는
    // object-fit:cover로 박스를 가로/세로 꽉 채우면서 비율은 유지한 채 위아래(또는 좌우)를
    // 잘라내는 방식이므로, kitchenScene은 그냥 항상 박스 크기와 정확히 같게 맞춘다.
    // getBoundingClientRect는 transform까지 반영된 크기라, 폰 여닫을 때 집 크기 변환(app-tablet.js setDrawerOpen) 도중엔
    // 예전 크기를 돌려줘서 그림이 애니메이션 내내 예전 크기로 있다가 끝날 때 덜컥 바뀌었다 → transform과 상관없는 배치 크기를 쓴다
    var cs = getComputedStyle(kitchenGameView);
    var w = parseFloat(cs.width) || 0, h = parseFloat(cs.height) || 0; // 숨겨져 있으면 'auto' → 0 (예전과 같게)
    kitchenScene.style.width = w + 'px';
    kitchenScene.style.height = h + 'px';
    kitchenScene.style.setProperty('--scale', (w / SCENE_W).toFixed(4));
  }

  window.addEventListener('resize', fitScene);
  if(window.ResizeObserver){
    new ResizeObserver(fitScene).observe(kitchenGameView);
  }
  fitScene();

  /* =========================================================
     2. 오브젝트 렌더링 (테이블 / 냉장고 아이콘 / 가이드)
     ========================================================= */
  var kitchenTableImg = document.getElementById('kitchenTableImg');
  var kitchenFridgeImg = document.getElementById('kitchenFridgeImg');
  var kitchenLaundryImg = document.getElementById('kitchenLaundryImg');
  var kitchenLaundryBasketImg = document.getElementById('kitchenLaundryBasketImg');
  var kitchenLaundryClothesImg = document.getElementById('kitchenLaundryClothesImg');
  var kitchenDiningTableImg = document.getElementById('kitchenDiningTableImg');
  var kitchenFridgeIcon = document.getElementById('kitchenFridgeIcon');
  var kitchenLaundryIcon = document.getElementById('kitchenLaundryIcon');
  var kitchenSinkIcon = document.getElementById('kitchenSinkIcon');
  var kitchenBinsIcon = document.getElementById('kitchenBinsIcon');
  var kitchenBubbleIcon = document.getElementById('kitchenBubbleIcon');
  var kitchenPaperIcon = document.getElementById('kitchenPaperIcon');
  var kitchenANotice = document.getElementById('kitchenANotice'); // 고지서 그림 - 정산 미션을 끝낼 때까지만 보인다
  var kitchenDialogue = document.getElementById('kitchenDialogue');
  var kitchenDialogueName = document.getElementById('kitchenDialogueName');
  var kitchenDialogueText = document.getElementById('kitchenDialogueText');
  var kitchenDialoguePortrait = document.getElementById('kitchenDialoguePortrait');
  var kitchenDialogueEmojiPortrait = document.getElementById('kitchenDialogueEmojiPortrait');
  var kitchenDialogueBox = document.getElementById('kitchenDialogueBox');
  var kitchenDialogueChoices = document.getElementById('kitchenDialogueChoices');
  var kitchenDialogueNextArrow = document.getElementById('kitchenDialogueNextArrow');
  // 강은지 엔딩의 갈림길 대화에서 선택지가 떠 있는 동안 true - 화면 클릭/Enter로
  // 건너뛰지 못하게 막는 용도(dismissKitchenDialogue/keydown 핸들러에서 참고).
  var kitchenDialogueChoiceMode = false;

  // ---------- 미션1 완료 폭죽 효과 + 대화창 (아이소메트릭 화면 위) ----------
  var kitchenCelebrate = document.getElementById('kitchenCelebrate');
  // 미션 성공 폭죽: 화면 전체(게임 영역 밖까지) 위에 크게 터진다 - 양쪽 아래에서 색종이 대포 + 위에서 색종이 비.
  // 조각은 매번 새로 만들고 애니메이션이 끝나면 지운다. ponytail: 개수 160개 고정, 느린 PC면 COUNT를 줄이면 됨
  // 축하 폭죽: 아래 양쪽 대포에서 솟구치는 조각 + 위에서 흩뿌려지는 조각.
  // 예전엔 조각마다 '꼭대기까지 → 바닥까지' 두 구간 애니메이션이라 구간이 바뀌는 높이에서 조각들이 한꺼번에 느려져
  // 위아래로 층이 나뉘어 보였다 → 종이 조각처럼 계산한다: 솟을 땐 중력으로 느려지고, 떨어질 땐 공기 저항으로
  // 조각마다 다른 느린 속도에 맞춰지며 좌우로 하늘거리고 뒤집힌다. 화면 아래쪽으로 갈수록 서서히 사라진다.
  function celebrateBurst(){
    var COLORS = ['#71D369', '#FF9696', '#FFD166', '#7FA3FF', '#FF6F91', '#8B7FFF', '#5FB17C', '#FFFFFF'];
    var layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(layer);
    var W = window.innerWidth, H = window.innerHeight, COUNT = 160, parts = [];
    var rnd = function(a, b){ return a + Math.random() * (b - a); };
    for(var i = 0; i < COUNT; i++){
      var el = document.createElement('span'), size = rnd(8, 18), round = Math.random() < 0.3;
      el.style.cssText = 'position:absolute;left:0;top:0;width:' + size + 'px;height:' + (round ? size : size * 1.6) + 'px;border-radius:' + (round ? '50%' : '2px') + ';background:' + COLORS[i % COLORS.length] + ';will-change:transform,opacity;opacity:0';
      layer.appendChild(el);
      var kind = i % 3, q = { el:el, fall:H * rnd(0.22, 0.42), // 떨어지는 속도(px/초) - 조각마다 달라 층이 생기지 않는다
        sway:rnd(10, 34), swayHz:rnd(0.6, 1.4), phase:rnd(0, 6.3), spin:rnd(-540, 540), flipHz:rnd(0.8, 2.2), t:0 };
      if(kind < 2){ // 0: 왼쪽 아래 대포, 1: 오른쪽 아래 대포 - 위로 솟았다가 떨어진다
        var dir = kind === 0 ? 1 : -1;
        q.x = kind === 0 ? -10 : W + 10; q.y = H + 10;
        q.vx = dir * W * rnd(0.25, 0.75); q.vy = -H * rnd(1.4, 1.95); q.delay = rnd(0, 0.25);
      } else { // 2: 위에서 흩뿌려지는 조각 - 시작 높이·때를 흩어 한 줄로 내려오지 않게
        q.x = rnd(0, W); q.y = -rnd(20, H * 0.25); q.vx = rnd(-40, 40); q.vy = q.fall * rnd(0.5, 1); q.delay = rnd(0.25, 0.9);
      }
      parts.push(q);
    }
    var G = H * 2.2, last = performance.now(), start = last;
    (function step(now){
      var dt = Math.min(0.05, (now - last) / 1000), alive = 0; last = now;
      parts.forEach(function(q){
        if(q.done) return;
        if((now - start) / 1000 < q.delay){ alive++; return; }
        q.t += dt;
        if(q.vy < q.fall) q.vy = Math.min(q.fall, q.vy + G * dt);      // 솟구칠 땐 중력으로 느려지다가
        else q.vy += (q.fall - q.vy) * Math.min(1, dt / 0.35);         // 떨어질 땐 공기 저항으로 제 속도에 맞춰진다
        q.vx *= Math.exp(-1.6 * dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        var sx = Math.sin(q.t * q.swayHz * 6.283 + q.phase) * q.sway;   // 좌우로 하늘하늘
        var flip = Math.cos(q.t * q.flipHz * 6.283 + q.phase);           // 종이가 뒤집히는 느낌
        var fade = Math.min(1, Math.max(0, (H * 1.02 - q.y) / (H * 0.4)), Math.max(0, (5.5 - q.t) / 1.2)); // 아래 40%에서 서서히, 오래되면 마저
        q.el.style.opacity = fade;
        q.el.style.transform = 'translate3d(' + (q.x + sx) + 'px,' + q.y + 'px,0) rotate(' + (q.spin * q.t) + 'deg) scaleY(' + (0.35 + 0.65 * Math.abs(flip)) + ')';
        if(fade <= 0 && q.vy > 0){ q.done = true; q.el.remove(); } else alive++;
      });
      if(alive) requestAnimationFrame(step); else layer.remove();
    })(start);
  }
  function showKitchenCelebrate(){
    // 다시 보여줄 때마다(리셋 후 재플레이 등) 폭죽 애니메이션이 처음부터 재생되도록
    // 클래스를 껐다 켜서 강제로 리플로우를 발생시킨다.
    kitchenCelebrate.classList.remove('show');
    void kitchenCelebrate.offsetWidth;
    kitchenCelebrate.classList.add('show'); celebrateBurst();
    // 미션1은 여기 도달한 시점에 이미 완전히 끝난 것이므로, 대화창을 다 읽고 닫을 때까지
    // 기다리지 않고 폭죽과 동시에 바로 냉장고를 가득 찬 이미지로 바꾼다(신호를 늦게 보내면
    // 사용자가 "완료했는데 왜 아직도 그대로지?"로 느낄 수 있어서, 완료 순간 즉시 반영).
    // fridgeMissionDone 플래그는 메인 앱 쪽 변수라 여기서 직접 못 바꾸므로 이벤트로 알려준다.
    window.dispatchEvent(new CustomEvent('kitchen:mission1-complete'));
    window.dispatchEvent(new CustomEvent('kitchen:fridge-resolved'));
    kitchenCelebrate.classList.remove('show');
    eunjiComplete('fridge');
  }
  // 메인 앱(폰 화면) 쪽에서 [정기 반찬 단체 구독권] 신청이 완료되면 이 이벤트를 보낸다
  // (같은 문서 안이 아니라 다른 <script> 블록이라 커스텀 이벤트로만 통신 가능하다).
  window.addEventListener('kitchen:show-celebrate', showKitchenCelebrate);

  // ---------- 미션2(세탁물) 완료 폭죽 효과 + 대화창 - 미션1과 동일한 연출을 재사용한다 ----------
  function showLaundryCelebrate(){
    celebrateBurst();
    eunjiComplete('laundry');
  }
  window.addEventListener('kitchen:show-laundry-celebrate', showLaundryCelebrate);

  // ---------- 미션2(마지막 미션) 완료 후 게임 종료 연출 ----------
  var gameEndingOverlay = document.getElementById('gameEndingOverlay');
  var endingSteps = Array.prototype.slice.call(document.querySelectorAll('.ending-step'));
  var endingDots = Array.prototype.slice.call(document.querySelectorAll('.ending-dot'));
  var endingNextBtn = document.getElementById('endingNextBtn');
  var endingRestartBtn = document.getElementById('endingRestartBtn');
  var endingFeedbackForm = document.getElementById('endingFeedbackForm');
  var endingThanks = document.getElementById('endingThanks');
  var endingStarButtons = Array.prototype.slice.call(document.querySelectorAll('.ending-star'));
  var endingFeedbackText = document.getElementById('endingFeedbackText');
  var currentEndingStep = 0; // 0,1,2 (3단계)
  var endingStarValue = 0; // 질문 두 개 별점을 모두 골라야 제출 가능 (둘 다 고르면 1, 아니면 0)
  var endingStarValues = {}; // 별점 줄 id → 고른 값
  var endingSubmitted = false;
  // 설문 답을 받을 구글 Apps Script 웹 앱 주소 (설문_구글시트_연결방법.txt 참고). 비워 두면 보내지 않는다.
  var SURVEY_URL = '';

  function showEndingStep(idx){
    currentEndingStep = idx;
    endingSteps.forEach(function(step, i){ step.classList.toggle('active', i === idx); });
    endingDots.forEach(function(dot, i){ dot.classList.toggle('active', i === idx); });
    // 평가 팝업 하나만 남은 뒤로는 endingSteps.length가 1이므로, 항상 마지막 단계로
    // 취급해서 바로 "의견 제출하기"가 보이게 한다(이전에는 3단계 중 마지막만 다르게 표시).
    endingNextBtn.textContent = (idx === endingSteps.length - 1) ? '의견 제출하기' : '다음';
    endingNextBtn.disabled = !endingStarValue; // 별점(1~5)을 하나 골라야 [의견 제출하기]가 눌린다
  }

  endingStarButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      var row = btn.parentNode, val = parseInt(btn.getAttribute('data-value'), 10) || 0;
      endingStarValues[row.id] = val;
      Array.prototype.forEach.call(row.querySelectorAll('.ending-star'), function(b){
        var v = parseInt(b.getAttribute('data-value'), 10) || 0;
        b.classList.toggle('active', v <= val);
      });
      endingStarValue = (endingStarValues.endingStarRow && endingStarValues.endingStarRow2) ? 1 : 0;
      endingNextBtn.disabled = !endingStarValue;
    });
  });

  endingNextBtn.addEventListener('click', function(){
    if(!endingStarValue) return;
    if(currentEndingStep < endingSteps.length - 1){
      showEndingStep(currentEndingStep + 1);
      return;
    }
    // 마지막 단계(피드백 설문)에서 누르면 제출 처리 - 답은 이 PC 브라우저에 쌓고(인터넷 없어도 됨, 설문결과.html에서 보기·내려받기·삭제),
    // SURVEY_URL이 있으면 구글 스프레드시트로도 보낸다(설문_구글시트_연결방법.txt). 응답을 기다리지 않고 바로 감사 화면으로.
    var answer = {
      time: new Date().toISOString(), code: window.teumCode || '',
      type: { S:'금전형', A:'규칙형', H:'감정형' }[activeMateType] || activeMateType,
      gender: visitorGender === 'male' ? '남' : '여',
      q1: endingStarValues.endingStarRow, q2: endingStarValues.endingStarRow2,
      comment: endingFeedbackText.value.trim()
    };
    try { // ponytail: 브라우저 저장소(localStorage) - 크롬 '인터넷 사용 기록 삭제'로 쿠키·사이트 데이터를 지우면 같이 지워진다
      var saved = JSON.parse(localStorage.getItem('teumSurvey') || '[]');
      saved.push(answer);
      localStorage.setItem('teumSurvey', JSON.stringify(saved));
    } catch(err){}
    if(SURVEY_URL) fetch(SURVEY_URL, { method:'POST', mode:'no-cors', keepalive:true, body: JSON.stringify(answer) }).catch(function(){});
    if(clearedTypes[activeMateType]) clearedTypes[activeMateType].submitted = true;
    showEndingThanks();
  });
  // 후기 제출 뒤 감사 화면 + 다른 유형 버튼 (클리어한 유형으로 돌아왔을 때도 그대로 다시 보여 준다)
  function showEndingThanks(){
    endingSubmitted = true;
    endingFeedbackForm.style.display = 'none';
    endingThanks.style.display = 'block';
    endingThanks.closest('.ending-card').classList.add('thanks'); // 시작 화면 도형 배경
    endingNextBtn.style.display = 'none';
    endingRestartBtn.style.display = 'block';
    // 다른 유형 이어서 하기: 이름·성별·합의 상태는 그대로, 헤더 유형 탭을 누른 것과 같다 (switchMateType). 지금 유형은 뺀다.
    // 순서: 아직 안 해 본 유형 → 하다 만 유형 → 끝까지 해 본 유형, 같은 무리 안에선 금전 → 규칙 → 감정
    var TYPES = { S:'금전형', A:'규칙형', H:'감정형' }, box = document.getElementById('endingOtherTypes');
    var played = function(t){ // 0 안 해 봄, 1 하다 맘, 2 끝까지 함
      if(clearedTypes[t]) return 2;
      var pr = progressByType[t] || {};
      return ['fridge', 'laundry', 'm1', 'm2', 'tv', 'fb'].some(function(k){ return pr[k]; }) ? 1 : 0;
    };
    box.innerHTML = '';
    Object.keys(TYPES).filter(function(t){ return t !== activeMateType; })
      .sort(function(a, b){ return played(a) - played(b) || 'SAH'.indexOf(a) - 'SAH'.indexOf(b); })
      .forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ending-next clay-point';
      b.textContent = TYPES[t] + ' 메이트와 ' + (played(t) === 2 ? '플레이 완료' : '플레이하기');
      b.disabled = played(t) === 2; // 이미 끝낸 유형은 다시 들어가지 않게 눌리지 않는다
      b.addEventListener('click', function(){
        gameEndingOverlay.classList.remove('show');
        var tab = document.querySelector('.mate-tab[data-type="' + t + '"]');
        if(tab) tab.click();
      });
      // 버튼 위에 그 유형 메이트 그림: 평소엔 인사(hi), 버튼에 마우스를 올리면 기쁨(happy)
      var n = { S:1, A:2, H:3 }[t], base = 'object/mate' + n + '/mate_' + (visitorGender === 'male' ? 'men' : 'women') + '_' + n + '_';
      var item = document.createElement('div'), img = new Image();
      item.className = 'ending-other-item';
      img.src = base + (b.disabled ? 'happy.png' : 'hi.png'); img.alt = ''; img.draggable = false; // 끝낸 유형은 처음부터 기쁨
      new Image().src = base + 'happy.png'; // 미리 받아 둬서 처음 호버할 때 깜빡이지 않게
      // 호버하면 그림 위에 메이트마다 다른 인사 말풍선
      var say = document.createElement('span');
      say.className = 'ending-other-say';
      say.textContent = { S:'만나서 반가워요!\n함께 합리적인 생활을 해봐요!', A:'나 잘 부탁해요!\n저희만의 규칙을 만들어요!', H:'반가워요!\n마음 편히 지내요!' }[t];
      b.addEventListener('mouseenter', function(){ img.src = base + 'happy.png'; item.classList.add('hover'); });
      b.addEventListener('mouseleave', function(){ img.src = base + 'hi.png'; item.classList.remove('hover'); });
      item.appendChild(say); item.appendChild(img); item.appendChild(b);
      box.appendChild(item);
    });
    box.style.display = box.children.length ? 'flex' : 'none'; // 버튼 2개를 한 줄에 나란히 (CSS #endingOtherTypes)
    // 세 유형을 모두 끝냈으면: 다른 유형 버튼 대신 나와 메이트 셋이 감사 인사
    var allClear = Object.keys(TYPES).every(function(t){ return clearedTypes[t]; });
    document.getElementById('endingAllClear').style.display = allClear ? 'block' : 'none';
    if(!allClear) return;
    endingThanks.style.display = 'none';
    box.style.display = 'none';
    var g = visitorGender === 'male' ? 'men' : 'women', male = visitorGender === 'male';
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    var cast = [
      { cls:'me', name:me, src: male ? 'object/charater1_man/cha1_man_happy.png' : 'object/character1/cha1_happy.png', say:'함께해서 즐거웠어요!' },
      { name: male ? '강지혁' : '강은지', src:'object/mate1/mate_' + g + '_1_happy.png', say:'알뜰하게 같이 살아 줘서 고마워요!' },
      { name: male ? '서민호' : '서은민', src:'object/mate2/mate_' + g + '_2_happy.png', say:'규칙 잘 지켜 줘서 고마워요!' },
      { name: male ? '김석홍' : '김정희', src:'object/mate3/mate_' + g + '_3_happy.png', say:'마음 나눠 줘서 고마워요!' }
    ];
    document.getElementById('endingAllClearCast').innerHTML = cast.map(function(c, i){
      return '<div class="allclear-member ' + (c.cls || '') + '" style="--d:' + (0.15 + i * 0.25) + 's">' +
             '<span class="allclear-say">' + c.say + '</span><img src="' + c.src + '" alt="" draggable="false">' +
             '<span class="allclear-name">' + c.name.replace(/[<>&]/g, '') + '</span></div>';
    }).join('');
    celebrateBurst();
    startAllClearFireworks();
  }
  // 모든 유형 감사 화면 뒤(카드 뒤 어두운 배경)에서 불꽃놀이가 계속 터진다 - 평가 창이 닫히거나 감사 화면이 아니면 스스로 멈춘다
  var fireworksOn = false;
  function startAllClearFireworks(){
    if(fireworksOn || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    fireworksOn = true;
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d'), allClearEl = document.getElementById('endingAllClear');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    gameEndingOverlay.insertBefore(cv, gameEndingOverlay.firstChild); // 카드보다 앞에 넣어 카드 뒤에 그려진다
    var COLORS = ['#71D369', '#FF9696', '#FFD166', '#7FA3FF', '#FF6F91', '#8B7FFF', '#FFFFFF'];
    var rnd = function(a, b){ return a + Math.random() * (b - a); };
    var parts = [], last = performance.now(), nextBoom = last + 200;
    function boom(){
      var x = cv.width * rnd(0.12, 0.88), y = cv.height * rnd(0.12, 0.5), c = COLORS[Math.floor(Math.random() * COLORS.length)], n = 56, sp = rnd(160, 280);
      for(var i = 0; i < n; i++){
        var a = Math.PI * 2 * i / n + rnd(-0.05, 0.05), v = sp * rnd(0.6, 1);
        parts.push({ x:x, y:y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:1, c:c });
      }
    }
    (function step(now){
      if(!gameEndingOverlay.classList.contains('show') || allClearEl.style.display === 'none'){ cv.remove(); fireworksOn = false; return; }
      if(cv.width !== cv.clientWidth || cv.height !== cv.clientHeight){ cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if(now >= nextBoom){ boom(); if(Math.random() < 0.35) boom(); nextBoom = now + rnd(450, 950); }
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(function(p){ return (p.life -= dt * 0.75) > 0; });
      parts.forEach(function(p){
        p.vx *= 0.97; p.vy = p.vy * 0.97 + 140 * dt; // 퍼지며 느려지고 살짝 떨어진다
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = p.life; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(step);
    })(last);
  }

  endingRestartBtn.addEventListener('click', function(){
    // 유형 테스트로 돌아간다: 게임을 감싼 페이지들(teum_game/index.html → game/index.html)에 모두 알리면 game/index.html이 받아 테스트를 다시 연다
    if(window.top === window){ location.href = '../index.html'; return; } // 게임만 따로 열었을 때
    for(var w = window; w !== w.top; ){ w = w.parent; try { w.postMessage({teum: 'typeRetry'}, '*'); } catch(e){} }
  });

  // 엔딩까지 마친 유형: 다른 유형을 하다가 그 유형으로 돌아오면 새로 시작하지 않고 엔딩 장면을 그대로 보여 준다.
  // [처음으로]를 누르면 새 관람객이므로 지운다. ponytail: 이 페이지를 연 동안만 기억 (새로고침하면 처음부터)
  var clearedTypes = {}; // { S:{ submitted:bool }, A:{...} }
  // 유형 탭(다른 유형 버튼)으로 들어오면 환영 대화 없이 kitchen:game-start가 바로 온다 - 다른 시작 처리(핀·말풍선 등)보다 먼저 받아서
  // 이미 엔딩까지 마친 유형이면 시작을 막고 엔딩 장면으로 둔다 (이 리스너가 다른 game-start 리스너보다 먼저 등록돼 있어야 함)
  window.addEventListener('kitchen:game-start', function(e){
    if(clearedTypes[activeMateType]){ e.stopImmediatePropagation(); restoreClearedEnding(); return; }
    var p = progressByType[activeMateType];
    if(!p) return;
    e.stopImmediatePropagation(); // 이미 본 시작 대사·말풍선은 건너뛴다
    restoreProgress(p);
  });
  // 끝낸 미션을 그 결과 그대로 되살린다 (축하 대화·폭죽 없이)
  // 되살릴 땐 끝낸 상태로 바로 보이게 - 빨래 바구니가 떨어지는 등 완료 연출(transition)을 잠깐 끈다
  function skipRestoreAnim(){
    kitchenScene.classList.add('kitchen-restoring');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ kitchenScene.classList.remove('kitchen-restoring'); }); });
  }
  function restoreProgress(p){
    skipRestoreAnim();
    if(activeMateType === 'S'){
      if(p.fridge){
        fridgeChecked = false; fridgeResolved = true;
        kitchenScene.classList.add('fridge-done');
        kitchenFridgeImg.src = FRIDGE_FULL_SRC; setFridgeRevisit(true);
        kitchenFridgeIcon.style.display = 'none'; // 끝낸 미션 핀은 숨김
        window.dispatchEvent(new CustomEvent('kitchen:mission1-complete')); // 앱 쪽 냉장고 미션 완료 표시
        mateInLiving = true; placeMate();
      }
      if(p.laundry){
        laundryChecked = true; kitchenLaundryIcon.style.display = 'none'; // 끝낸 빨래 핀이 다시 뜨지 않게 (냉장고와 같이)
        window.dispatchEvent(new CustomEvent('kitchen:laundry-resolved')); // 빨래 완료 상태(그림·앱 쪽 표시)
      }
    } else if(activeMateType === 'A'){
      if(p.m1){
        eunminMission1Done = true;
        kitchenSinkIcon.style.display = 'none'; kitchenBinsIcon.style.display = 'none';
        if(currentRoom === 'eunminkitchen') kitchenBgImg.src = roomSrc('eunminKitchen');
        renderEunminMess();
        if(p.mateLiving !== false) mateLeaveRoom(); // 메이트는 거실에 (정산을 먼저 끝냈으면 부엌에 남아 이야기하기를 기다리던 그대로)
      }
      if(p.m2){ eunminMission2Done = true; eunminPaperChecked = true; kitchenPaperIcon.style.display = kitchenANotice.style.display = 'none'; }
    } else if(activeMateType === 'H'){
      if(p.tv) setEmotionChatDone(true); // 미션1(채팅으로 안건 등록)
      if(p.ag){ emotionEndingDone = true; setEmotionTvDone(true); } // 미션2(안건 확인 - TV·전등 끔)
      if(p.fb) emotionFbDone = true;
      setEmotionFbReady(true); // 미션3(피드백) 핀도 처음부터 띄워 둔다 - 채팅~안건 확인 사이에 누르면 한마디만 (이미 끝냈으면 setEmotionFbReady가 숨긴다)
    }
    // 있던 방·자리로 (방 바꾸는 함수가 시작 자리를 정하므로 그다음에 자리를 덮어쓴다)
    var toRoom = { kitchen:switchToKitchenRoom, utility:switchToUtilityRoom, livingroom:switchToLivingroomRoom,
                   eunminkitchen:function(){ switchToEunminKitchenRoom(); } }[p.room];
    if(toRoom && p.room !== currentRoom) toRoom();
    if(p.pos){ playerPos = { x:p.pos.x, y:p.pos.y }; setPlayerStyle(); }
    var sp = currentPlayerSprites(); // 방을 바꾸는 함수가 정면을 보게 하므로 그다음에 보던 방향으로
    if(p.facing && sp[p.facing]){ playerFacingSrc = sp[p.facing]; kitchenPlayerSprite.src = sp[p.facing]; }
    kitchenScene.classList.add('game-started'); // 핀·미션 카드
    agendaBegin(); // 두 미션을 마친 채 돌아왔으면 새 안건 알림부터 다시
  }
  // [개발용 - 완성 후 이 블록 통째로 삭제] 게임 화면에서 Ctrl+Shift+S: 지금 유형의 미션 1·2를 끝낸 상태로 거실에 두고
  // 세 번째 '새 안건 확인하기'(메이트 알림)부터 하게 한다. 유형을 오갈 때 진행도를 되살리는 restoreProgress를 그대로 쓴다.
  // (코드 입력 화면의 같은 단축키는 app-tablet.js - 게임 화면이 떠 있으면 그쪽은 아무것도 안 한다)
  // 게임에 들어오자마자 시작 안내·환영 인사 도중에 눌러도 된다 - 둘 다 본 걸로 치고 닫는다
  document.addEventListener('keydown', function(e){
    if(!(e.ctrlKey && e.shiftKey && e.code === 'KeyS') || !document.getElementById('cohabitView').classList.contains('show') ||
       !document.getElementById('cohabit-game-container').classList.contains('kitchen-active')) return;
    e.preventDefault();
    if(clearedTypes[activeMateType] || document.body.classList.contains('app-drawer-open')) return; // 앱 미션 도중·엔딩 뒤엔 안 함
    if(kitchenDialogue.classList.contains('show')){
      if(kitchenDialogueOnDone || kitchenDialogueChoiceMode) return; // 뒤에 이어질 일이 있는 미션 대화는 끊지 않는다 (환영 인사는 이어지는 게 없음)
      closeKitchenDialogue();
    }
    startCoachSeen = true; welcomeSeen[activeMateType] = true;
    if(coachAbort) coachAbort();
    var p = { S:{ fridge:true, laundry:true }, A:{ m1:true, m2:true, mateLiving:true }, H:{ tv:true, ag:true } }[activeMateType];
    if(!p) return;
    p.room = ONE_ROOM[activeMateType] || 'livingroom'; // 한방판: 그 유형의 방에 그대로
    // 아직 게임 시작 전(환영 인사가 뜨기 전 0.8초)이면 진행도로 넣어 두고 곧 올 kitchen:game-start가 되살린다
    if(!kitchenScene.classList.contains('game-started')){ progressByType[activeMateType] = p; return; }
    restoreProgress(p);
  });
  function restoreClearedEnding(){
    skipRestoreAnim();
    // 미션을 모두 마친 상태(완료율 100%)로 두고, 끝낼 때 나오는 그라데이션 축하 화면('함께 맞춰 간 첫날')만 보여 준다
    // (리뷰·감사 팝업은 처음 끝냈을 때 한 번만 - 헤더 유형 탭·다시하기·다른 코드 입력은 그대로 누를 수 있다)
    if(activeMateType === 'S'){
      fridgeChecked = laundryChecked = fridgeResolved = laundryResolved = eunjiEndingDone = true;
      kitchenScene.classList.add('fridge-done', 'laundry-done', 'kitchen-laundry-resolved');
    } else if(activeMateType === 'A'){
      eunminMission1Done = eunminMission2Done = true;
      eunminEndingDone = true; // 세 번째 미션(새 안건 확인하기)까지 완료 - 안 하면 카드가 67%로 보였다
      if(currentRoom === 'eunminkitchen') kitchenBgImg.src = roomSrc('eunminKitchen');
      renderEunminMess();
    } else if(activeMateType === 'H'){
      setEmotionTvDone(true); setEmotionChatDone(true); emotionFbDone = true; emotionEndingDone = true; setEmotionFbReady(false);
    }
    // 끝난 미션 핀은 숨긴다 (축하 화면 뒤로 흐릿하게 비쳤다)
    [kitchenFridgeIcon, kitchenLaundryIcon, kitchenSinkIcon, kitchenBinsIcon, kitchenPaperIcon, kitchenANotice].forEach(function(el){ if(el) el.style.display = 'none'; });
    kitchenScene.classList.add('game-started'); // 미션 카드(100%)를 보이게
    dayEndOverlay.classList.add('show');
  }
  function startGameEnding(){
    if(!clearedTypes[activeMateType]) clearedTypes[activeMateType] = { submitted:false };
    // 관계 에필로그/앱 홍보 단계가 빠지고 평가 팝업만 남아서, 더 이상 방문자/메이트 이름을
    // 엔딩 화면에 채워 넣을 필요가 없다.
    showEndingStep(0);
    // 평가 창이 0.4초에 걸쳐 나타나는 동안 뒤의 '함께 맞춰 간 첫날' 글자가 비쳐 창 글자와 겹쳤다
    // → 글자를 먼저 지우고(.25초, 배경은 그대로) 그 뒤에 평가 창을 띄운다
    dayEndOverlay.classList.add('quiet');
    dayEndTimers.push(setTimeout(function(){ gameEndingOverlay.classList.add('show'); }, 300));
  }

  // '처음으로' 리셋 시 게임 종료 오버레이도 함께 원상복구한다(다시 플레이할 때 이전
  // 피드백/별점/진행 단계가 남아있지 않도록).
  window.addEventListener('kitchen:mission-reset', function(){
    gameEndingOverlay.classList.remove('show');
    endingSubmitted = false;
    endingStarValue = 0;
    endingStarValues = {};
    endingStarButtons.forEach(function(b){ b.classList.remove('active'); });
    endingFeedbackText.value = '';
    endingFeedbackForm.style.display = '';
    endingThanks.style.display = 'none';
    endingThanks.closest('.ending-card').classList.remove('thanks');
    endingNextBtn.style.display = '';
    endingRestartBtn.style.display = 'none';
    document.getElementById('endingOtherTypes').style.display='none';
    document.getElementById('endingAllClear').style.display = 'none';
    showEndingStep(0);
  });

  function renderTable(){
    kitchenTableImg.style.top = state.table.top + '%';
    kitchenTableImg.style.left = state.table.left + '%';
    kitchenTableImg.style.width = state.table.width + '%';
    kitchenTableImg.style.height = 'auto';
  }
  // 닫힘 그림도 열림과 같은 캔버스라 위치·크기 하나(state.fridgeEmpty)를 쓴다
  function renderFridge(){ renderFridgeEmpty(); }
  // 문 열린(텅 빈) 냉장고 이미지는 닫힌 냉장고와 원본 이미지 비율이 달라서
  // 별도의 위치·크기 값(state.fridgeEmpty)을 가진다. 🧊(열림) 튜너로 직접 조절 가능.
  // 한방판: 다용도실에선 다용도실 좌표(state.utility.fridge·fridgeIcon·fridgePoint)를 쓴다
  function fridgeAt(){ return currentRoom === 'utility' ? state.utility.fridge : state.fridgeEmpty; }
  function renderFridgeEmpty(){
    var fa = fridgeAt();
    kitchenFridgeImg.style.top = fa.top + '%';
    kitchenFridgeImg.style.left = fa.left + '%';
    kitchenFridgeImg.style.width = fa.width + '%';
    kitchenFridgeImg.style.height = 'auto';
  }
  // 지금 화면에 보여야 할 냉장고 상태(닫힘/열림-텅빔/열림-가득참)에 맞는 위치를 적용한다.
  // (튜너에서 다른 값을 조절해도 현재 미션 진행 상태에 맞는 이미지 위치가 유지되도록)
  // 텅 빈 냉장고와 가득 찬 냉장고(refrigerator_full.png)는 구도가 같아서 위치값도 공유한다.
  function renderFridgeCurrent(){
    if(fridgeChecked || fridgeResolved) renderFridgeEmpty(); else renderFridge();
  }
  function renderFridgeIcon(){
    var fi = currentRoom === 'utility' ? state.utility.fridgeIcon : state.kitchenFridgeIcon;
    kitchenFridgeIcon.style.top = fi.top + '%';
    kitchenFridgeIcon.style.left = fi.left + '%';
    kitchenFridgeIcon.style.setProperty('--icon-scale', fi.size / 100);
  }
  // 다용도실 전용 오브젝트(빨래더미). CSS에서 다용도실 화면일 때만 보이게 처리되므로,
  function renderLaundry(){
    kitchenLaundryImg.style.top = state.utility.laundry.top + '%';
    kitchenLaundryImg.style.left = state.utility.laundry.left + '%';
    kitchenLaundryImg.style.width = state.utility.laundry.width + '%';
    kitchenLaundryImg.style.height = 'auto';
  }
  // 세탁물 상태이상 알림 아이콘 - 냉장고 알림 아이콘과 완전히 같은 방식(❗ 튜너로 조절)
  function renderLaundryIcon(){
    kitchenLaundryIcon.style.top = state.utility.laundryIcon.top + '%';
    kitchenLaundryIcon.style.left = state.utility.laundryIcon.left + '%';
    kitchenLaundryIcon.style.setProperty('--icon-scale', state.utility.laundryIcon.size / 100);
  }
  // 세탁 완료 후 나타나는 빨래 바구니 / 개킨 옷더미 - 빨래더미와 완전히 같은 방식(🧺✅/👕 튜너로 조절).
  // 보이는지 여부는 CSS(kitchenScene의 kitchen-laundry-resolved 클래스)가 담당하므로,
  // 여기서는 위치·크기만 신경 쓴다.
  // object/laundry/ 세 장(laundry_not 빨래더미 / laundry_finish 빈 바구니 / laundry 개킨 빨래)은 같은 캔버스(768x808).
  // 빈 바구니는 빨래더미와 같은 자리(🧺 튜너), 개킨 빨래는 따로 조절(👕 튜너 / 좌표수정도구.html 빨래 탭).
  // ponytail: 바구니(🧺✅) 튜너 값은 이제 안 씀
  function renderLaundryBasket(){
    var p = state.utility.laundry;
    kitchenLaundryBasketImg.style.top = p.top + '%';
    kitchenLaundryBasketImg.style.left = p.left + '%';
    kitchenLaundryBasketImg.style.width = p.width + '%';
    kitchenLaundryBasketImg.style.height = 'auto';
  }
  function renderLaundryClothes(){
    var p = state.utility.laundryClothes;
    kitchenLaundryClothesImg.style.top = p.top + '%';
    kitchenLaundryClothesImg.style.left = p.left + '%';
    kitchenLaundryClothesImg.style.width = p.width + '%';
    kitchenLaundryClothesImg.style.height = 'auto';
  }
  // 서은민(A) 전용 오브젝트: 밥먹는 식탁 - 서은민 부엌 화면일 때만 CSS로 보임
  // 설거지 더미·쓰레기: 자기 미션(설거지 규칙 / 분리수거)을 마치면 치워진다. 미션 전에만 눌린다(누르면 싱크대·쓰레기통 핀과 같음)
  var kitchenDishWashImg = document.getElementById('kitchenDishWashImg');
  var kitchenTrashImg = document.getElementById('kitchenTrashImg');
  var eunminMessDone = { dish:false, recycle:false };
  function renderEunminMess(){
    [[kitchenDishWashImg, state.eunminKitchen.dishWash, 'dish', 'dishWash'], [kitchenTrashImg, state.eunminKitchen.trash, 'recycle', 'trash']].forEach(function(o){
      o[0].style.top = o[1].top + '%';
      o[0].style.left = o[1].left + '%';
      o[0].style.width = o[1].width + '%';
      o[0].style.height = 'auto';
      var gone = eunminMission1Done || eunminMessDone[o[2]];
      o[0].style.visibility = gone ? 'hidden' : '';
      o[0].style.pointerEvents = !gone && !eunminTaskBusy ? 'auto' : 'none';
    });
  }
  function renderDiningTable(){
    kitchenDiningTableImg.style.top = state.eunminKitchen.diningTable.top + '%';
    kitchenDiningTableImg.style.left = state.eunminKitchen.diningTable.left + '%';
    kitchenDiningTableImg.style.width = state.eunminKitchen.diningTable.width + '%';
    kitchenDiningTableImg.style.height = 'auto';
  }
  function renderSinkIcon(){
    kitchenSinkIcon.style.top = state.eunminKitchen.sinkIcon.top + '%';
    kitchenSinkIcon.style.left = state.eunminKitchen.sinkIcon.left + '%';
    kitchenSinkIcon.style.setProperty('--icon-scale', state.eunminKitchen.sinkIcon.size / 100);
  }
  function renderBinsIcon(){
    kitchenBinsIcon.style.top = state.eunminKitchen.binsIcon.top + '%';
    kitchenBinsIcon.style.left = state.eunminKitchen.binsIcon.left + '%';
    kitchenBinsIcon.style.setProperty('--icon-scale', state.eunminKitchen.binsIcon.size / 100);
  }
  // 서은민 메이트 머리 위 말풍선 - 위치는 메이트를 따라가므로(mateRender) 여기서는 크기만 반영한다.
  function renderBubbleIcon(){
    kitchenBubbleIcon.style.setProperty('--icon-scale', state.eunminKitchen.bubbleIcon.size / 100);
  }
  // 서은민(A) 미션2 전용: 거실 식탁 위 정산 종이 상태이상 아이콘
  // 한방판: 규칙형 고지서·핀·서는 자리는 부엌 식탁 위(state.eunminKitchen), 감정형 피드백 핀은 거실 책상 위(state.livingroom)
  function paperPos(){ return currentRoom === 'eunminkitchen' ? state.eunminKitchen.paperIcon : state.livingroom.paperIcon; }
  function paperStand(){ return currentRoom === 'eunminkitchen' ? state.eunminKitchen.paperPoint : LIVING_DESK_SIDE; }
  function renderANotice(){
    var n = state.eunminKitchen.notice;
    if(currentRoom !== 'eunminkitchen'){ kitchenANotice.style.left = kitchenANotice.style.top = kitchenANotice.style.width = ''; return; }
    kitchenANotice.style.left = n.left + '%'; kitchenANotice.style.top = n.top + '%'; kitchenANotice.style.width = n.width + '%';
  }
  function renderPaperIcon(){
    if(!kitchenPaperIcon) return;
    renderANotice();
    // 핀 끝이 고지서 그림(.kitchen-a-notice) 윗변에 닿게 위로 (핀 높이 112.5/1686의 절반쯤) - 감정형 피드백 핀은 같은 paperIcon 값을 그대로 쓰므로 여기서만 뺀다
    var pp = paperPos();
    kitchenPaperIcon.style.top = (pp.top - 3.1) + '%';
    kitchenPaperIcon.style.left = pp.left + '%';
    kitchenPaperIcon.style.setProperty('--icon-scale', pp.size / 100);
  }
  // 지금 어느 방을 보고 있는지에 맞는 충돌 다각형 저장소를 돌려준다.
  // (부엌/다용도실/서은민 부엌/거실 콜라이더는 전부 완전히 분리된 별도 객체 -
  //  isBlocked()가 이 함수를 통해서만 접근한다.)
  function activeColliderStore(){
    if(currentRoom === 'utility') return state.utility.colliders;
    if(currentRoom === 'eunminkitchen') return state.eunminKitchen.colliders;
    if(currentRoom === 'livingroom') return state.livingroom.colliders;
    return state.colliders;
  }
  renderTable();
  renderFridge();
  renderFridgeIcon();
  renderLaundry();
  renderLaundryIcon();
  renderLaundryBasket();
  renderLaundryClothes();

  /* =========================================================
     3. 플레이어 캐릭터 - 클릭 이동 + Y-sorting
     ========================================================= */
  var kitchenPlayer = document.getElementById('kitchenPlayer');
  var kitchenPlayerSprite = document.getElementById('kitchenPlayerSprite');
  var kitchenPlayerBubble = document.getElementById('kitchenPlayerBubble');
  var playerPos = { x: state.playerStart.left, y: state.playerStart.top }; // % 단위
  var playerTarget = null;
  var playerSpeed = 32; // % / sec (kitchenScene 대각선 기준 체감 속도)
  var rafId = null;
  var lastTime = null;
  var pendingArriveCallback = null;

  /* ---- 이동 방향에 따라 캐릭터 이미지(character1) 자체를 바꿔주는 4방향 스프라이트 ----
     예전에는 좌우 반전(scaleX)으로 왼쪽/오른쪽을 흉내냈지만, 이제 방향별 원본 그림이
     따로 있으므로 반전 대신 실제 이미지를 갈아끼운다.
     2단계(성별 선택)에서 고른 성별에 따라 character1(여성)/charater1_man(남성) 중
     쓸 세트를 고른다 - 기본 스크립트(코드입력~성별선택 담당)가 게임 시작 시점에
     'kitchen:set-gender' 이벤트로 알려준다. */
  var PLAYER_SPRITES = {
    female:{
      front:'object/character1/cha_front.png',
      back: 'object/character1/cha1_back.png',
      left: 'object/character1/cha1_left.png',
      right:'object/character1/cha1_right.png'
    },
    male:{
      front:'object/charater1_man/cha1_man_front.png',
      back: 'object/charater1_man/cha1_man_back.png',
      left: 'object/charater1_man/cha1_man_left.png',
      right:'object/charater1_man/cha1_man_right.png'
    }
  };
  // 여성/남성 4방향 스프라이트 8장을 미리 디코딩해둔다. 안 그러면 성별 선택 직후
  // 게임 시작 화면으로 넘어가는 순간(kitchen:set-gender) 처음 보여줄 이미지(특히 남성 쪽)가
  // 아직 로드되지 않은 상태라, 브라우저가 그때서야 받아오면서 잠깐 버벅이거나 빈 화면으로
  // 보였다가 뒤늦게 나타나는 현상이 있었다(냉장고 열림/닫힘 이미지 미리 로딩과 같은 이유·해결책).
  var spritePreloadKeep = [];
  Object.keys(PLAYER_SPRITES).forEach(function(gender){
    var set = PLAYER_SPRITES[gender];
    Object.keys(set).forEach(function(dir){
      var preloadImg = new Image();
      preloadImg.src = set[dir];
      // 받기만 하면 첫 방향 전환 때 해독하느라 멈칫한다 → 미리 해독하고, 버려지지 않게 잡아 둔다
      if(preloadImg.decode) preloadImg.decode().catch(function(){});
      spritePreloadKeep.push(preloadImg);
    });
  });
  // 대화창 전용 성별별 표정 일러스트(속상함/기쁨) - 냉장고/세탁물 문제를 발견했을 때는
  // sad, 공동 구독을 완료했을 때는 happy를 보여준다.
  var DIALOGUE_PORTRAITS = {
    female:{ sad:'object/character1/cha1_sad.png', happy:'object/character1/cha1_happy.png' },
    male:{ sad:'object/charater1_man/cha1_man_sad.png', happy:'object/charater1_man/cha1_man_happy.png' }
  };
  Object.keys(DIALOGUE_PORTRAITS).forEach(function(gender){
    var set = DIALOGUE_PORTRAITS[gender];
    Object.keys(set).forEach(function(mood){
      var preloadImg = new Image();
      preloadImg.src = set[mood];
      if(preloadImg.decode) preloadImg.decode().catch(function(){});
      spritePreloadKeep.push(preloadImg);
    });
  });
  var visitorGender = 'female'; // 기본값 - 게임 시작 전에는 항상 여성 스프라이트가 기본 표시
  function currentPlayerSprites(){
    return PLAYER_SPRITES[visitorGender] || PLAYER_SPRITES.female;
  }
  var playerFacingSrc = currentPlayerSprites().front;
  function updatePlayerFacing(dx, dy){
    var sprites = currentPlayerSprites();
    var nextSrc;
    // 더 크게 움직이는 축을 기준으로 좌우/상하 중 하나만 선택 (대각선 이동 시 자연스럽게 우선순위 부여)
    if(Math.abs(dx) > Math.abs(dy)){
      nextSrc = dx < 0 ? sprites.left : sprites.right;
    } else if(dy !== 0){
      nextSrc = dy < 0 ? sprites.back : sprites.front;
    } else {
      return;
    }
    if(nextSrc !== playerFacingSrc){
      playerFacingSrc = nextSrc;
      kitchenPlayerSprite.src = nextSrc;
    }
  }
  // 게임 시작 시점에 2단계에서 고른 성별을 전달받아 캐릭터 그림 세트를 바꾼다.
  window.addEventListener('kitchen:set-gender', function(e){
    visitorGender = (e.detail && e.detail.gender === 'male') ? 'male' : 'female';
    var sprites = currentPlayerSprites();
    playerFacingSrc = sprites.front;
    kitchenPlayerSprite.src = sprites.front;
    kitchenDialoguePortrait.src = (DIALOGUE_PORTRAITS[visitorGender] || DIALOGUE_PORTRAITS.female).sad;
  });
  // "처음으로" 리셋 시 다음 판은 다시 성별 선택부터 시작하므로, 캐릭터 그림도
  // 기본값(여성)으로 되돌려둔다 - 곧이어 게임을 다시 시작하면 kitchen:set-gender가
  // 다시 정확한 값으로 갱신해준다.
  window.addEventListener('kitchen:mission-reset', function(){
    visitorGender = 'female';
    var sprites = currentPlayerSprites();
    playerFacingSrc = sprites.front;
    kitchenPlayerSprite.src = sprites.front;
    kitchenDialoguePortrait.src = DIALOGUE_PORTRAITS.female.sad;
  });

  function setPlayerStyle(){
    kitchenPlayer.style.left = playerPos.x + '%';
    kitchenPlayer.style.top = playerPos.y + '%';
    // 말풍선이 .kitchenPlayer의 형제 요소로 분리됐으므로, 캐릭터가 움직일 때마다
    // 같은 좌표로 따라가도록 직접 맞춰준다.
    kitchenPlayerBubble.style.left = playerPos.x + '%';
    kitchenPlayerBubble.style.top = playerPos.y + '%';
    updateDepthSort();
  }

  /* ---- 캐릭터 머리 위 말풍선: 안내 팝업이 닫히자마자 바로 대사가 뜬다 ---- */
  var hungerBubbleArmTimer = null;
  var hungerBubbleHideTimer = null;
  var HUNGER_BUBBLE_DURATION = 5000; // 말풍선이 몇 ms 동안 떠 있을지

  // bubble을 넘기면 그 말풍선(예: 메이트 머리 위)에 띄운다. 한 번에 하나만 떠 있게 다른 쪽은 내린다
  var kitchenMateBubble = document.getElementById('kitchenMateBubble');
  function showPlayerBubble(text, duration, bubble){
    bubble = bubble || kitchenPlayerBubble;
    (bubble === kitchenPlayerBubble ? kitchenMateBubble : kitchenPlayerBubble).classList.remove('show');
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(hungerBubbleHideTimer);
    hungerBubbleHideTimer = setTimeout(function(){
      bubble.classList.remove('show');
    }, duration);
  }

  function armHungerBubbleTimer(){
    // 예전에는 온보딩이 끝난 뒤 4초 딜레이를 두고 떴는데, 안내 팝업이 사라지자마자
    // 바로 뜨도록 딜레이를 없앴다. 냉장고/배고픔 대사는 강은지(S) 스토리 전용이라,
    // 서은민(A)일 때는 그녀의 미션(가사 규칙)에 맞는 다른 대사를 보여준다.
    clearTimeout(hungerBubbleArmTimer);
    // 예전엔 여기서 메이트가 집 상황을 늘어놓으며 할 일을 정해 줬다(냉장고 봐줄래요? 등) → 일을 떠맡기는 느낌이라 뺐다.
    // 무엇을 할지는 시작 안내(showStartCoach)와 '오늘의 미션'·힌트가 알려 준다
  }

  function disarmHungerBubbleTimer(){
    clearTimeout(hungerBubbleArmTimer);
    clearTimeout(hungerBubbleHideTimer);
    kitchenPlayerBubble.classList.remove('show');
    kitchenMateBubble.classList.remove('show');
  }

  // 온보딩(사용법 안내)이 끝나 실제로 게임이 시작되는 시점은 다른 <script> IIFE(위쪽,
  // 로그인/온보딩 담당)에서 관리하므로, 커스텀 이벤트로 신호를 받는다.
  window.addEventListener('kitchen:game-start', armHungerBubbleTimer);
  window.addEventListener('kitchen:game-start', function(){ kitchenScene.classList.add('game-started'); }); // 미션 핀 보이기
  window.addEventListener('kitchen:mission-reset', function(){ kitchenScene.classList.remove('game-started'); });

  // 게임 첫 화면: 메이트 환영 대화 (예전 안내 팝업 문구를 메이트 말투로). 부엌이 없는 유형(감정형)은 바로 시작.
  // 인사 그림은 메이트 성별대로(사용자와 같은 성별): 강은지 = mate_women_1_hi, 강지혁 = mate_men_1_hi.
  // 메이트 대화창 표정 (모든 유형 공통): hi = 처음 인사·일상 이야기, worry = 문제가 생겼거나 남아 있을 때, happy = 기쁠 때
  function matePortraitSrc(mood){
    var n = { S:1, A:2, H:3 }[activeMateType] || 1; // 금전형 mate1, 규칙형 mate2, 감정형 mate3 (김정희/김석홍)
    return 'object/mate' + n + '/mate_' + (visitorGender === 'male' ? 'men' : 'women') + '_' + n + '_' + (mood || 'hi') + '.png';
  }
  function welcomePortraitSrc(){ return matePortraitSrc('hi'); }
  // 메이트 대사: 줄은 글 그대로(기본 표정 mood) 또는 ['worry'|'happy'|'hi', 글]. 표정이 바뀌는 줄에서 대화창을 이어 띄운다
  function mateSpeak(name, lines, onDone, mood){
    var groups = [];
    lines.forEach(function(l){
      var m = Array.isArray(l) ? l[0] : (mood || 'hi'), t = Array.isArray(l) ? l[1] : l, g = groups[groups.length - 1];
      if(g && g.m === m) g.t.push(t); else groups.push({ m:m, t:[t] });
    });
    (function next(i){
      if(i >= groups.length){ if(onDone) onDone(); return; }
      showKitchenDialogue(name, groups[i].t, function(){ next(i + 1); }, 'happy', { portraitSrc: matePortraitSrc(groups[i].m) });
    })(0);
  }
  window.addEventListener('kitchen:welcome', function(e){
    if(clearedTypes[activeMateType]){ restoreClearedEnding(); return; } // 이미 엔딩까지 마친 유형이면 엔딩 장면으로
    var start = function(){ window.dispatchEvent(new CustomEvent('kitchen:game-start')); };
    if(!document.getElementById('cohabit-game-container').classList.contains('kitchen-active')){ start(); return; }
    // 하던 유형으로 돌아왔으면 기다리지 않고 바로 되살린다 - 0.8초 뒤에 하면 화면이 미션 전 모습으로 나타났다가 바뀌었다(깜빡임)
    if(progressByType[activeMateType]){ start(); return; }
    setTimeout(function(){ // 게임 화면이 서서히 나타난 뒤에
      // 첫 인사는 집에 들어온 방식에 따라: taker = 내가 임차인(메이트 집에 들어옴), giver = 내가 임대인(메이트를 들임), newhome = 같이 새집을 구함
      var GREETING = {
        taker: '저희 집에 오신 걸 환영해요! 앞으로 잘 부탁드려요.',
        giver: '저를 집에 들여 주셔서 고마워요! 앞으로 잘 부탁드려요.',
        newhome: '우리가 함께 구한 새집에 온 걸 환영해요! 여기서 잘 지내봐요.'
      };
      var mateNm = (e.detail && e.detail.name) || '메이트', portrait = { portraitSrc: welcomePortraitSrc() };
      // ① 게임 시작과 함께 시작 안내(오늘의 미션·힌트·이동·핀·메이트 → '즐거운 틈새살이를 시작해봐요!')
      // → ② 메이트가 합의서 유형(집에 들어온 방식)에 맞춰 환영해 준다
      start();
      showStartCoach(function(){
        if(welcomeSeen[activeMateType]) return; // 환영 인사는 그 유형에 처음 들어갔을 때만 (헤더로 유형을 오가도 다시 안 나옴)
        welcomeSeen[activeMateType] = true;
        showKitchenDialogue(mateNm, [
          GREETING[e.detail && e.detail.role] || GREETING.newhome,
          '같이 살다 보면 생각지 못한 크고 작은 일들이 생기기 마련이죠.',
          '그럴 땐 틈과 함께 하나씩 맞춰가요!'
        ], null, null, portrait);
      });
    }, 800);
  });

  /* ---- 게임 시작 안내: 게임이 시작되면 바로, 오늘의 미션·힌트·이동·핀·메이트를 차례로 짚어 준다 ----
     메이트가 할 일을 정해 주는 대신 이 안내와 힌트가 다음 할 일을 알려 준다. 안내 중엔 장면 클릭을 막는다 */
  var coachEl = null, coachAbort = null;
  // 한 관람객에게 한 번만 - 끝까지 본 뒤엔 다시하기·다른 유형에서도 건너뛰고 바로 환영 인사. '다른 코드 입력'(새 관람객)이면 다시 보여 준다
  var startCoachSeen = false;
  var welcomeSeen = {}; // 유형별 환영 인사를 봤는지 (S/A/H) - 시작 안내와 같이 새 관람객이면 초기화
  function showStartCoach(onDone){
    if(startCoachSeen){ if(onDone) onDone(); return; }
    if(coachEl) return;
    var visible = function(el){ if(!el) return false; var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.3; };
    var firstPin = function(){ return Array.prototype.slice.call(kitchenScene.querySelectorAll('img[src*="alert_pin"]')).filter(visible)[0]; };
    var mateSprite = function(){ return [document.getElementById('kitchenMateSprite'), document.getElementById('kitchenSeoMateSprite')].filter(visible)[0]; };
    var playerSprite = function(){ return document.getElementById('kitchenPlayerSprite'); };
    var steps = [
      { el:function(){ return document.getElementById('missionCard'); }, chip:'오늘의 미션', text:'오늘 해결할\n일이에요.\n미션을 마치면 체크되고\n완료율이 올라가요.' },
      { el:function(){ return document.getElementById('missionHint'); }, chip:'힌트', text:'무엇부터 할지 모르겠다면\n힌트를 보세요.\n지금 해 볼 일을 알려줘요.' },
      { el:playerSprite, chip:'이동', text:'바닥을 누르면\n그 자리로 걸어가요.\n가고 싶은 곳을 눌러\n집 안을 돌아다녀 보세요.' },
      { el:firstPin, chip:'미션 시작', text:'빨간 <b>!</b> 핀을 누르면\n그 자리로 걸어가\n미션이 시작돼요.' },
      { el:mateSprite, chip:'메이트', text:'메이트를 누르면 언제든\n이야기를 나눌 수 있어요.' },
      { center:true, chip:'시작', text:'그럼 즐거운 틈새살이를\n시작해봐요!' } // 대상 없이 화면 가운데
    ];
    coachEl = document.createElement('div');
    coachEl.className = 'start-coach';
    coachEl.innerHTML = '<div class="sc-spot"></div><div class="sc-card"><div class="sc-head"><span class="sc-chip"></span><span class="sc-step"></span></div>' +
                        '<p class="sc-text"></p><button type="button" class="sc-next"></button></div>';
    document.body.appendChild(coachEl);
    var spot = coachEl.querySelector('.sc-spot'), card = coachEl.querySelector('.sc-card'), idx = -1, list = [];
    function place(){
      var t = list[idx], pad = 8;
      spot.classList.toggle('center', !t.el);
      if(!t.el){ // 마무리 인사: 화면만 어둡게 하고 가운데에
        spot.style.left = (innerWidth / 2) + 'px'; spot.style.top = (innerHeight / 2) + 'px'; spot.style.width = spot.style.height = '0px';
        card.style.left = (innerWidth - card.offsetWidth) / 2 + 'px'; card.style.top = (innerHeight - card.offsetHeight) / 2 + 'px';
        return;
      }
      var r = t.el.getBoundingClientRect();
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
      spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      var cw = card.offsetWidth, ch = card.offsetHeight, gap = 18;
      var left = r.right + pad + gap; if(left + cw > innerWidth - 12) left = r.left - pad - gap - cw; // 오른쪽에 자리가 없으면 왼쪽
      var top = Math.min(Math.max(r.top + r.height / 2 - ch / 2, 12), innerHeight - ch - 12);
      card.style.left = Math.max(12, left) + 'px'; card.style.top = top + 'px';
    }
    function next(){
      idx++;
      if(idx >= list.length){ finish(); return; }
      coachEl.querySelector('.sc-chip').textContent = list[idx].chip;
      coachEl.querySelector('.sc-step').textContent = (idx + 1) + ' / ' + list.length;
      var tx = coachEl.querySelector('.sc-text'); // 줄바꿈은 공통 규칙(teumWrap) - 문구의 \n은 '여기서 바꾸면 좋다'는 자리
      tx.innerHTML = window.teumWrap(list[idx].text, true); window.teumBalance(tx);
      coachEl.querySelector('.sc-next').textContent = idx === list.length - 1 ? '시작하기' : '다음 ▶';
      place();
    }
    function finish(reset){
      document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize);
      if(coachEl){ coachEl.remove(); coachEl = null; }
      coachAbort = null;
      if(!reset){ startCoachSeen = true; if(onDone) onDone(); } // 중간에 끊긴(다시하기 등) 안내는 본 걸로 치지 않는다
    }
    // Enter/스페이스로도 넘긴다. 대화를 Enter로 빨리 넘기던 손이 안내까지 건너뛰지 않게, 안내가 뜨고 0.5초 동안은 키를 받기만 한다
    var keyReady = false;
    function onKey(e){
      if(e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation();
      if(keyReady) next();
    }
    function onResize(){ if(idx >= 0 && idx < list.length) place(); }
    coachAbort = function(){ finish(true); }; // 개발용 Ctrl+Shift+S가 안내를 바로 닫을 때
    coachEl.querySelector('.sc-next').addEventListener('click', next);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('kitchen:mission-reset', function(){ if(coachEl) finish(true); }, { once:true }); // 다시하기 등으로 끊기면 환영 인사 없이 닫는다
    // 미션 카드가 펼쳐지고(0.3초) 핀·말풍선이 자리 잡은 뒤에 보이는 것만 골라 시작
    setTimeout(function(){
      if(!coachEl) return;
      // 핀·메이트는 보이는 것만 고른다(없으면 그 단계는 뺀다). 미션 카드·힌트는 아직 나타나는 중일 수 있어 있기만 하면 둔다
      list = steps.map(function(s){ return { el:s.center ? null : s.el(), center:s.center, chip:s.chip, text:s.text }; }).filter(function(s){ return s.center || !!s.el; });
      coachEl.classList.add('show');
      next();
      setTimeout(function(){ keyReady = true; }, 500);
    }, 900);
  }

  /* ---- 메이트 NPC: 금전형 부엌에서만 보이고, 정해둔 자리(MATE_POS)에 가만히 서 있다 ----
     가구 앞/뒤 가림은 플레이어와 같은 바닥선 규칙(furnitureDepthZ) */
  var kitchenMate = document.getElementById('kitchenMate');
  var kitchenMateSprite = document.getElementById('kitchenMateSprite');
  // 메이트 자리: 처음엔 부엌, 미션1(반찬 구독) 축하 대화가 끝나면 거실로 옮겨 간다 (mateInLiving)
  var MATE_POS_KITCHEN = { x:36.5, y:64.5 }; // 부엌 바닥 % (냉장고 문 열리는 범위 바로 오른쪽, 조리대 앞 - 뒤가 조리대라 캐릭터가 메이트 뒤로 못 지나감)
  var MATE_POS_LIVING = { x:24, y:59 };  // 거실 소파 바로 앞 - 감정형 메이트 거실 자리(SEO_MATE_POS_EMOTION)와 같은 곳
  var mateInLiving = false;
  var MATE_POS_UTILITY = { x:40.5, y:64.5 }; // 한방판 금전형 방(부엌 그림 kitchen_bg22) - 조리대 앞 (원래 부엌 자리 36.5에서 사용자 요청으로 오른쪽으로)
  function matePos(){ return currentRoom === 'utility' ? MATE_POS_UTILITY : mateInLiving ? MATE_POS_LIVING : MATE_POS_KITCHEN; }
  function placeMate(){
    var g = visitorGender === 'male' ? 'men' : 'women'; // 메이트는 사용자와 같은 성별 (강은지 / 강지혁)
    var p = matePos();
    kitchenMateSprite.src = 'object/mate1/mate_' + g + '_1_front.png';
    kitchenMate.style.left = p.x + '%';
    kitchenMate.style.top = p.y + '%';
    kitchenMate.style.zIndex = furnitureDepthZ(p.x, p.y); // 캐릭터와 같은 바닥선 규칙
    kitchenMateBubble.style.left = p.x + '%';
    kitchenMateBubble.style.top = p.y + '%';
  }
  // 금전형에서 메이트가 지금 있는 방(부엌 또는 거실)일 때만 보이게
  // ponytail: 매 프레임(rAF) 돌던 걸 0.1초마다로 - 메이트는 걸어 나갈 때(mateLeaveAnim이 따로 그림)만 움직여서 이 정도면 충분하고, CPU를 덜 쓴다
  (function syncMateVisible(){
    var here = activeMateType === 'S' && inRoom(mateInLiving ? 'livingroom' : 'kitchen');
    kitchenMate.style.display = here ? '' : 'none';
    // 앞뒤 가림도 매번 다시 - 냉장고 문이 열리면 그림 모양이 바뀌어 옆에 선 메이트를 가린다
    // 식탁 뒤(9)면 8로 - 나(식탁 뒤 9)보다 항상 아래. 식탁 앞(11)이면 11, 나는 12
    if(here && !mateLeaveAnim){ var mp = matePos(), mz = furnitureDepthZ(mp.x, mp.y); kitchenMate.style.zIndex = mz === 9 ? 8 : mz; }
    if(activeMateType === 'S'){
      kitchenBubbleIcon.classList.toggle('mate-on', here && !mateLeaveAnim);
      var bubblePos = matePos();
      kitchenBubbleIcon.style.left = bubblePos.x + '%';
      kitchenBubbleIcon.style.top = bubblePos.y + '%';
    }
    if(!here && activeMateType === 'S') kitchenMateBubble.classList.remove('show'); // 다른 방으로 가면 메이트 말풍선도 내린다 (규칙형 메이트 말풍선은 건드리지 않게 금전형만)
    setTimeout(syncMateVisible, 100);
  })();
  placeMate();
  window.addEventListener('kitchen:set-gender', placeMate);

  var mateLeaveAnim = null, mateLeaveTimer = null; // ponytail: 한방판에선 메이트가 방을 나가지 않아 늘 null (예전 걸어 나가기 흔적 - 검사하는 곳들이 남아 있음)
  window.addEventListener('kitchen:mission-reset', function(){
    clearTimeout(mateLeaveTimer);
    if(mateLeaveAnim){ mateLeaveAnim.cancel(); mateLeaveAnim = null; }
    kitchenMate.classList.remove('kitchen-is-walking');
    mateInLiving = false; placeMate();
  });

  // 메이트 누르기 → 옆으로 걸어가 말을 걸고(내 대사), 메이트가 지금 진행 상황에 맞춰 다음 미션으로 이끈다
  // 서는 자리 = 메이트 왼쪽 아래 (부엌·거실 공통 간격)
  // 말을 걸면 나와 메이트가 서로를 본다 (위치 기준으로 방향을 정한다 - 예전엔 나는 오른쪽 고정, 메이트는 정면이라 마주 보지 않았다)
  // 말 걸 때 서는 자리는 메이트 자리마다 고정 - 매번 같은 자리에서 서로 옆으로 마주 본다 (도착 위치로 방향을 정하면 앞·뒤로 바뀌었다)
  // 그림 폭이 장면 가로 약 8.5%라 9% 떨어지면 둘이 겹치지 않는다. 같은 높이(dy 0)가 바닥에 없으면 조금 앞으로 (모든 유형 공통)
  var MATE_TALK_OFFSET = {
    'S:kitchen':[-9, 0], 'S:livingroom':[-9.2, 4.3], 'S:utility':[-9, 0],      // 금전형 - 메이트 왼쪽 (거실은 감정형과 같은 자리라 같은 간격)
    'A:eunminkitchen':[9, 5], 'A:livingroom':[-9.2, 4.3], // 규칙형 - 부엌은 왼쪽이 식탁이라 오른쪽
    'H:livingroom':[-9.2, 4.3]                            // 감정형 - 소파·테이블 사이라 왼쪽 조금 앞
  };
  function mateTalkStand(mx, my){
    var o = MATE_TALK_OFFSET[activeMateType + ':' + currentRoom] || [-9, 0];
    return { x:mx + o[0], y:my + o[1], side:o[0] < 0 ? -1 : 1 }; // side: 메이트 기준 내가 선 쪽
  }
  function faceMateEachOther(){
    var p = matePos(), side = mateTalkStand(p.x, p.y).side;
    updatePlayerFacing(-side, 0);
    kitchenMateSprite.src = 'object/mate1/mate_' + (visitorGender === 'male' ? 'men' : 'women') + '_1_' + (side < 0 ? 'left' : 'right') + '.png';
  }
  function mateTalkPoint(){ var p = matePos(); return mateTalkStand(p.x, p.y); }
  function mateTalkLines(mateName){
    // 순서 상관없이: 진행 중인 미션 → 하나만 끝난 상태 → 아무것도 안 함 → 둘 다 끝(맨 아래)
    if(fridgeChecked && !fridgeResolved) return {
      me: '냉장고가 텅 비어 있더라고요…',
      mate: [['worry', '맞아요, 저도 요즘 장 볼 틈이 없었어요. 미안해요.'], ['happy', '반찬가게 정기 구독은 둘이 나눠 내면 더 싸다더라고요.\n신청해 주시면 비용은 반씩 낼게요!']] };
    if(laundryChecked && !laundryResolved) return {
      me: '빨래가 잔뜩 쌓여 있더라고요…',
      mate: [['worry', '저도 신경 쓰였어요. 둘이 하기엔 양이 많더라고요.'], ['happy', '세탁소 단체권으로 맡기면 훨씬 편할 것 같아요.\n신청해 주시면 비용은 제가 반 낼게요!']] };
    if(laundryResolved && !fridgeResolved) return {
      me: '세탁 구독 신청했어요!',
      mate: [['happy', '고마워요! 제 몫은 바로 보낼게요.'], ['happy', '저는 신발장 정리하던 참이었어요.']] };
    if(fridgeResolved && !laundryResolved) return {
      me: '반찬 구독 신청했어요!',
      mate: [['happy', '고마워요! 제 몫은 바로 보낼게요.'], ['happy', '저는 창문 좀 닦고 있었어요.']] };
    if(!fridgeResolved && !laundryResolved) return {
      me: mateCallName() + ', 뭐 하고 계세요?',
      mate: ['저녁 뭐 먹을까 고민하고 있었어요.', '냉장고에 먹을 게 있으려나…'], mood:'worry' };
    return {
      me: mateCallName() + ', 오늘 고마웠어요.',
      mate: ['저야말로요! 같이 사니까 훨씬 든든하네요.', '앞으로도 틈 앱으로 하나씩 맞춰가요!'], mood:'happy' };
  }
  // 미션 대사는 그 상황에서 처음 말 걸 때 한 번만 - 같은 상황에서 또 말 걸면 일상 대화를 돌아가며 보여 준다 (모든 유형 공통)
  // 상황이 바뀌면(미션 하나 끝냄 등) 대사도 바뀌므로 그 대사로 '봤는지'를 기억한다. 다시하기·처음으로면 지운다
  var talkSeen = {}, dailyTalkIdx = {};
  function withDailyTalk(t){
    var key = activeMateType + '|' + t.me + '|' + t.mate[0];
    if(!talkSeen[key]){ talkSeen[key] = true; return t; }
    var list = dailyTalkLines(), i = dailyTalkIdx[activeMateType] || 0;
    dailyTalkIdx[activeMateType] = i + 1;
    return list[i % list.length];
  }
  window.addEventListener('kitchen:mission-reset', function(){ talkSeen = {}; dailyTalkIdx = {}; });
  function dailyTalkLines(){
    var c = mateCallName();
    if(activeMateType === 'S') return [ // 강은지/강지혁 - 알뜰한 메이트
      { me:'오늘 저녁은 뭐 먹을까요?', mate:['음… 냉장고에 있는 걸로 간단히 해 먹어요.', '밖에서 사 먹으면 생각보다 금방 나가더라고요.'] },
      { me:c + ', 요즘 바빠요?', mate:['조금요. 그래도 집에 오면 마음이 편해요.', '같이 사니까 혼자일 때보다 덜 쓸쓸하네요.'] },
      { me:'이번 주말에 뭐 해요?', mate:['산책도 할 겸 동네 시장 구경 가려고요.', '시간 되면 같이 가요!'] },
      { me:'날씨가 많이 쌀쌀해졌네요.', mate:['그러게요. 난방은 아껴 쓰고 담요 하나씩 꺼내 둘까요?'] }
    ];
    if(activeMateType === 'A') return [ // 서은민/서민호 - 규칙을 중요하게 여기는 메이트
      { me:'오늘 하루 어땠어요?', mate:['평소랑 비슷했어요.', '정해 둔 대로 하니까 하루가 깔끔하게 지나가네요.'] },
      { me:c + ', 뭐 보고 있어요?', mate:['이번 주 가사 분담표요.', '미리 봐 두면 깜빡하는 일이 줄더라고요.'] },
      { me:'주말에 대청소 같이 할래요?', mate:['좋아요! 구역을 나눠서 하면 금방 끝날 거예요.'] },
      { me:'요즘 잘 지내요?', mate:['네, 덕분에요.', '서로 지킬 걸 정해 두니까 마음이 편해요.'] }
    ];
    return [ // 감정형 김정희/김석홍 - 마음을 살피는 메이트
      { me:c + ', 차 한잔 하실래요?', mate:['좋지요. 따뜻한 차 마시면서 이야기하면 마음이 풀리더라고요.'] },
      { me:'오늘 하루 어떠셨어요?', mate:['저는 괜찮았어요. 그쪽은 어땠어요?', '힘든 일 있으면 언제든 얘기해요.'] },
      { me:'창밖 날씨가 좋네요.', mate:['그러게요. 산책이라도 다녀올까요?'] },
      { me:c + ', 뭐 하고 계세요?', mate:['그냥 잠깐 쉬고 있었어요.', '같이 사니까 집이 한결 따뜻하게 느껴지네요.'] }
    ];
  }
  kitchenMateSprite.style.pointerEvents = 'auto';
  kitchenMateSprite.style.cursor = 'var(--cur-hand)';
  kitchenMate.addEventListener('click', function(e){
    if(mateLeaveAnim) return; // 거실로 걸어 나가는 중
    if(kitchenDialogue.classList.contains('show')) return; // 대화 중이면 화면 클릭처럼 다음 줄로 (장면 클릭 처리에 맡김)
    e.stopPropagation(); // 메이트 자리로 걸어가는 일반 이동은 막는다
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    var mateName = (document.getElementById('cohabitMateName').textContent || '메이트').trim();
    var tp = mateTalkPoint();
    moveTo(tp.x, tp.y, function(){
      faceMateEachOther();
      var t = withDailyTalk(mateTalkLines(mateName));
      showKitchenDialogue(me, [t.me], function(){
        mateSpeak(mateName, t.mate, placeMate, t.mood); // 대화가 끝나면 메이트는 다시 정면
      }, 'happy');
    });
  });
  // '처음으로' 버튼으로 리셋되면(kitchen:mission-reset과 함께 발생) 대기 중이거나 떠 있는
  // 말풍선을 정리해서, 다음 판이 시작되기 전에 엉뚱하게 뜨지 않게 한다.
  window.addEventListener('kitchen:mission-reset', disarmHungerBubbleTimer);

  // 상판 있는 가구(WALK_DEPTH)에서 그림 안 위치(0~1)가 상판 앞쪽 테두리보다 아래 = 가구 몸통(옆면·다리·의자)
  // 꺾은선 L(e0,e1) → F(e2,e3) → R(e4,e5)
  // 상판 뒤쪽 테두리(L → 뒤 꼭짓점 → R)보다 band(그림 높이 비율) 이내로 아래면 '식탁 바로 뒤' 바닥. 뒤 꼭짓점 = L + R - F
  function nearFurnitureBack(name, px, py, band){
    var e = WALK_DEPTH[name];
    if(!e) return false;
    var bx = e[0] + e[4] - e[2], by = e[1] + e[5] - e[3];
    var ex = Math.max(e[0], Math.min(e[4], px));
    var ey = ex <= bx ? e[1] + (by - e[1]) * (ex - e[0]) / (bx - e[0]) : by + (e[5] - by) * (ex - bx) / (e[4] - bx);
    return py <= ey + band;
  }
  function inFurnitureBody(name, px, py){
    var e = WALK_DEPTH[name];
    if(!e) return false;
    var ex = Math.max(e[0], Math.min(e[4], px));
    var ey = ex <= e[2] ? e[1] + (e[3] - e[1]) * (ex - e[0]) / (e[2] - e[0]) : e[3] + (e[5] - e[3]) * (ex - e[2]) / (e[4] - e[2]);
    return py >= ey;
  }
  // 캐릭터를 그릴 높이(z-index): 보이는 가구 그림마다 '바닥선'(그 세로줄에서 그림의 가장 아래)과 발을 비교해
  // 발이 바닥선보다 위(안쪽)면 그 가구 뒤 → 가구 밑으로, 아니면 가구 앞 → 위로. 비스듬한 식탁도 세로줄마다 맞게 나뉜다
  // (예전 가로 기준선 state.sortY 하나로는 식탁 뒤인데 앞으로 그려져 식탁을 뚫고 가는 것처럼 보였다)
  function furnitureDepthZ(x, y){
    if(!walkOverlayImgs) return 11; // 첫 배치(placeMate)가 가구 목록 준비보다 먼저 불릴 때
    var sr = kitchenScene.getBoundingClientRect(), behindZ = null;
    var px = sr.left + sr.width * x / 100, py = sr.top + sr.height * y / 100;
    for(var k = 0; k < walkOverlayImgs.length; k++){
      var img = walkOverlayImgs[k], m = walkMaskOf(img);
      if(!m || !m.base) continue;
      var r = img.getBoundingClientRect();
      if(!r.width || px < r.left || px >= r.right) continue;
      var cs = getComputedStyle(img);
      if(cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue;
      var rx = (px - r.left) / r.width, ry = (py - r.top) / r.height, e = WALK_DEPTH[walkMaskName(img)];
      if(e){
        // 식탁·밥상 = 바닥에 놓인 직사각형 상자. 상판 테두리 L→F(왼쪽 앞면 방향), F→R(오른쪽 앞면 방향)과
        // 앞 모서리 아래 바닥점 Ff로 바닥 위치를 (a, b)로 풀어서, 어느 한쪽 앞면보다 바깥(a > 0 또는 b < 0)이면 앞, 아니면 뒤.
        // (세로줄마다 보던 방식은 식탁 양 끝에서 들쭉날쭉해 걸을 때 앞뒤가 깜빡였다)
        var W_ = r.width, H_ = r.height;
        var d1x = (e[2] - e[0]) * W_, d1y = (e[3] - e[1]) * H_, d2x = (e[4] - e[2]) * W_, d2y = (e[5] - e[3]) * H_;
        var ffy = m.base[Math.min(m.w - 1, Math.floor(e[2] * m.w))] * H_, ffx = e[2] * W_; // 앞 모서리 아래 바닥
        var qx = rx * W_ - ffx, qy = ry * H_ - ffy, det = d1x * d2y - d1y * d2x;
        var a = (qx * d2y - qy * d2x) / det, bb = (d1x * qy - d1y * qx) / det;
        if(a > 0 || bb < 0) continue; // 앞면 바깥 = 가구 앞
      } else {
        var b = m.base[Math.min(m.w - 1, Math.floor(rx * m.w))];
        if(b < 0 || ry >= b) continue; // 이 세로줄엔 그림이 없거나, 발이 가구 앞
      }
      var z = parseInt(cs.zIndex, 10) || 0;
      if(behindZ === null || z < behindZ) behindZ = z;
    }
    return behindZ !== null ? behindZ - 1 : 11;
  }
  // 가구 무시 칸(편집기에서 가구 위를 '걸을 수 있음'으로 칠한 곳)에 서 있을 때: 식탁·밥상은 상판 앞쪽 테두리 아래(옆면·의자 쪽)면 앞,
  // 위(상판 쪽)면 뒤. 냉장고·빨래는 뒤. 그 밖은 바닥선 규칙
  function playerDepthZ(x, y){
    if(!WALK_MASKS) return (y < state.sortY ? 9 : 11);
    var bg = walkMaskOf(document.getElementById('kitchenBgImg'));
    var f = bg && maskAt(bg, x / 100, y / 100, bg.force) ? furnitureAt(x, y) : null;
    if(f && !WALK_DEPTH[walkMaskName(f.img)]) return f.z - 1; // 냉장고·빨래 위를 칠한 칸 = 그 뒤. 식탁은 아래 상자 규칙
    return furnitureDepthZ(x, y);
  }
  function updateDepthSort(){
    var z = playerDepthZ(playerPos.x, playerPos.y); // 걷는 동안에도 매 순간 지금 발 위치로
    // 나는 항상 메이트보다 위에 그린다 (메이트 z는 가구 기준 높이보다 1 낮게 둔다 - syncMateVisible)
    var seoEl = document.getElementById('kitchenSeoMate'); // 규칙형 메이트 (변수는 아래쪽에서 만들어져 처음 그릴 땐 아직 없다)
    if(z === 11 && (kitchenMate.style.display !== 'none' || (seoEl && seoEl.classList.contains('show')))) z = 12;
    // 아바타가 메이트 그림과 겹치면 항상 메이트보다 위에 그린다 (메이트 아래로 깔리지 않게 - 금전형·규칙형 공통)
    var pr = kitchenPlayerSprite.getBoundingClientRect();
    [[kitchenMate, kitchenMate.style.display !== 'none'], [seoEl, seoEl && seoEl.classList.contains('show')]].forEach(function(mm){
      if(!mm[1]) return;
      var r = mm[0].querySelector('img').getBoundingClientRect(), mz = parseInt(getComputedStyle(mm[0]).zIndex, 10) || 0;
      if(r.width && pr.right > r.left && pr.left < r.right && pr.bottom > r.top && pr.top < r.bottom && z <= mz) z = mz + 1;
    });
    kitchenPlayer.style.zIndex = z;
    // 미션 핀(z 20)과 겹치는 동안엔 그 핀을 아바타 바로 아래로 내려서 아바타가 핀 위로 지나가게 한다
    // (아바타를 20 위로 올리면 뒤에 있어야 할 가구보다도 앞에 그려지므로 핀 쪽을 내린다)
    (MISSION_PINS || []).forEach(function(pin){ // 처음 배치가 이 목록보다 먼저 불릴 수 있다
      var r = pin.getBoundingClientRect();
      var over = r.width && pr.right > r.left && pr.left < r.right && pr.bottom > r.top && pr.top < r.bottom;
      pin.style.zIndex = over ? Math.max(0, z - 1) : '';
    });
  }
  // 감정형 TV·피드백 핀(.kitchen-tv-icon)도 - 빠져 있어서 감정형에선 핀이 아바타를 가렸다
  // 메이트 머리 위 '…' 말풍선 버튼(.kitchen-bubble-icon)도 핀과 같은 규칙 - 규칙형에서만 아바타 위로 덮였다
  var MISSION_PINS = Array.prototype.slice.call(document.querySelectorAll('.kitchen-fridge-icon, .kitchen-laundry-icon, .kitchen-sink-icon, .kitchen-bins-icon, .kitchen-paper-icon, .kitchen-tv-icon, .kitchen-bubble-icon'));
  // 아바타가 서 있는 동안 핀이 새로 나타나거나(미션 끝 → 다음 핀) 메이트 머리 위 핀이 따라 움직여도 가리지 않게, 걷지 않을 때도 계속 맞춘다
  setInterval(updateDepthSort, 200);

  function clampToScene(x, y){
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(4, Math.min(97, y))
    };
  }

  /* ---- 충돌 판정: 캐릭터의 "발끝 중심점"(playerPos, 사각형이 아닌 점 하나)이
     가구의 바닥 접지면 다각형 안에 들어가는지로 판정한다. ---- */
  // 표준 Ray Casting 알고리즘 - 볼록/오목 다각형 모두 지원.
  function pointInPolygon(x, y, points){
    var inside = false;
    for(var i = 0, j = points.length - 1; i < points.length; j = i++){
      var xi = points[i].x, yi = points[i].y;
      var xj = points[j].x, yj = points[j].y;
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if(intersect) inside = !inside;
    }
    return inside;
  }
  function isBlocked(x, y){
    // 테이블은 다각형 바닥 접지면만 막고, 그 위(테이블 상판)는 Y-sort(가려짐)로만 표현한다.
    // 냉장고/싱크대/선반도 전부 바닥 접지면 다각형만 막아서, 통로는 막지 않으면서
    // 서랍이나 조리대는 뚫고 지나가지 못하게 한다. 다용도실에서는 세탁기/선반/빨래더미가
    // 같은 방식으로 막는다 - 어느 쪽이든 activeColliderStore()가 지금 방에 맞는 걸 돌려준다.
    var colliders = activeColliderStore();
    for(var key in colliders){
      if(!colliders.hasOwnProperty(key) || key === 'floor') continue;
      var pts = colliders[key] && colliders[key].points;
      if(pts && pts.length >= 3 && pointInPolygon(x, y, pts)) return true;
    }
    // 이동 가능 영역(floor)이 지정된 방이면 그 바깥은 전부 막는다.
    var floor = colliders.floor && colliders.floor.points;
    if(floor && floor.length >= 3 && !pointInPolygon(x, y, floor)) return true;
    return false;
  }
  // (fromX,fromY)에서 목표 방향(dx,dy, 남은 총 거리 dist)으로 이번 프레임에 최대 moveStep만큼
  // 이동을 시도하되, 충돌영역에 막히면 뚫지 않고 가능한 축으로만 "제 속도로" 미끄러지듯 이동시킨다.
  // (막힌 축의 거리에 비례해서 속도가 줄어들지 않도록 축별로 moveStep을 그대로 사용)
  function resolveMove(fromX, fromY, dx, dy, dist, moveStep){
    var dirX = dist > 0 ? dx / dist : 0;
    var dirY = dist > 0 ? dy / dist : 0;
    var toX = fromX + dirX * moveStep;
    var toY = fromY + dirY * moveStep;
    // 안전장치: 만약 캐릭터가 이미(예: 예전 저장값 등으로) 충돌영역 '안'에 들어가 있다면
    // 절대 움직이지 못하게 막지 않고 자유롭게 빠져나올 수 있게 해준다.
    if(isBlocked(fromX, fromY)){
      return { x:toX, y:toY };
    }
    if(!isBlocked(toX, toY)){
      return { x:toX, y:toY };
    }
    // 대각선 이동이 막히면 x축, y축 각각 "이번 프레임 최대 이동거리" 그대로 슬라이드 시도
    var stepX = Math.sign(dx) * Math.min(moveStep, Math.abs(dx));
    var stepY = Math.sign(dy) * Math.min(moveStep, Math.abs(dy));
    var slideX = fromX + stepX;
    var slideY = fromY + stepY;
    if(dx !== 0 && !isBlocked(slideX, fromY)){
      return { x:slideX, y:fromY };
    }
    if(dy !== 0 && !isBlocked(fromX, slideY)){
      return { x:fromX, y:slideY };
    }
    return { x:fromX, y:fromY };
  }

  var playerPath = [];

  // 이동 가능 영역 데이터는 walk-masks.js (좌표 수정 도구와 함께 쓴다)
  var WALK_MASKS = window.TEUM_WALK.masks, WALK_AREA = window.TEUM_WALK.area, WALK_DEPTH = window.TEUM_WALK.depth;
  Object.keys(WALK_MASKS).forEach(function(k){ // 칸마다 1비트 → 바이트 배열 (좌표수정도구.html 이동 가능 영역 탭이 고친다)
    var m = WALK_MASKS[k], dec = function(str){ return Uint8Array.from(atob(str), function(c){ return c.charCodeAt(0); }); };
    m.orig = dec(m.b); // 파일에 있는 값 ('처음 값으로')
    m.bits = m.orig.slice();
    // f = 가구 무시 칸: 편집기에서 '걸을 수 있음'으로 칠한 곳은 가구 그림이 있어도 걸을 수 있다 (방 그림만 가짐)
    m.forceOrig = m.f ? dec(m.f) : new Uint8Array(m.orig.length);
    m.force = m.forceOrig.slice();
    // x = 직접 '걸을 수 없음'으로 칠한 칸 - 판정엔 안 쓰고(이미 b가 꺼져 있음) 편집기에서 빨강으로 보여 주는 표시용
    m.blockOrig = m.x ? dec(m.x) : new Uint8Array(m.orig.length);
    m.block = m.blockOrig.slice();
    // base = 칸(세로줄)마다 그림의 가장 아래 위치(0~1, 그림 없으면 -1) = 가구가 바닥에 닿는 앞쪽 선 (가구 그림 앞뒤 판정용)
    m.base = new Float32Array(m.w).fill(-1);
    for(var by = m.h - 1; by >= 0; by--) for(var bx = 0; bx < m.w; bx++){
      var bi = by * m.w + bx;
      if(m.base[bx] < 0 && ((m.bits[bi >> 3] >> (bi & 7)) & 1)) m.base[bx] = (by + 1) / m.h;
    }
  });
  Object.keys(state.walkMasks || {}).forEach(function(key){
    var m=WALK_MASKS[key],v=state.walkMasks[key];if(!m || v.w!==m.w || v.h!==m.h) return;
    ['b','f','x'].forEach(function(k){if(!v[k])return;try{var a=Uint8Array.from(atob(v[k]),function(c){return c.charCodeAt(0);});if(a.length===m.bits.length)m[k==='b'?'bits':k==='f'?'force':'block'].set(a);}catch(e){}});
  });
  function maskAt(m, fx, fy, bits){ // fx, fy = 그림 안 위치 0~1, bits = 볼 층 (기본 m.bits)
    if(fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return 0;
    var i = Math.floor(fy * m.h) * m.w + Math.floor(fx * m.w);
    return ((bits || m.bits)[i >> 3] >> (i & 7)) & 1;
  }
  var ROOM_ALIAS = {}; // 유형별로 바꾼 방 그림 이름 → 기본 그림 이름 (아래 roomSrc 쪽에서 채운다)
  function walkMaskName(img){
    // 파일 이름만 본다. 빌드하면 'assets/table-BN3Ycpy6.png'처럼 해시가 붙으므로 떼고 찾는다
    var name = decodeURIComponent(img.getAttribute('src') || '').split('/').pop();
    name = ROOM_ALIAS[name] || name;
    return WALK_MASKS[name] ? name : name.replace(/-[\w-]{8}(\.png)$/, '$1');
  }
  function walkMaskOf(img){ return WALK_MASKS[walkMaskName(img)]; }
  var walkOverlayImgs = kitchenScene.querySelectorAll('img[class*="kitchen-layer-"]:not(.kitchen-layer-bg)');
  // (x, y)%에 그림이 있는(불투명) 보이는 가구 중 가장 낮은 z-index, 없으면 null
  // - 막기 판정과, 가구 무시 칸에서 캐릭터를 그 가구 밑으로 그리는 데(updateDepthSort) 같이 쓴다
  function furnitureAt(x, y){ // { z, img, px, py } - 가장 낮은 z의 가구
    var sr = kitchenScene.getBoundingClientRect(), z = null, hit = null;
    var px = sr.left + sr.width * x / 100, py = sr.top + sr.height * y / 100;
    for(var k = 0; k < walkOverlayImgs.length; k++){
      var img = walkOverlayImgs[k], m = walkMaskOf(img);
      if(!m) continue;
      var r = img.getBoundingClientRect();
      if(!r.width || px < r.left || px >= r.right || py < r.top || py >= r.bottom) continue;
      var cs = getComputedStyle(img);
      if(cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue; // 안 보이는 가구는 막지 않는다
      if(maskAt(m, (px - r.left) / r.width, (py - r.top) / r.height)){
        var iz = parseInt(cs.zIndex, 10) || 0;
        if(z === null || iz < z){ z = iz; hit = { z:iz, img:img, px:(px - r.left) / r.width, py:(py - r.top) / r.height }; }
      }
    }
    return hit;
  }
  /* ---- 길찾기 이동: 클릭한 곳까지 막힌 곳을 돌아가는 길을 미리 계산해 그 길을 따라 걷는다 ----
     - 걸을 수 있는 칸 지도(buildWalkGrid): 방 마스크(WALK_MASKS) + 지금 보이는 가구 그림. 칸 = 방 마스크 칸(가로 0.5%)
     - A* 로 길을 찾고, 직선으로 이어도 안 막히는 중간 점은 건너뛰어(줄 당기기) 꺾임을 줄인다
     - 목표가 막혀 있거나 못 가는 곳이면 거기서 가장 가까운 갈 수 있는 곳까지 간다 → 어디 걸려 멈추는 일이 없다
     - 캐릭터가 이미 막힌 칸에 서 있으면(가구가 옮겨진 경우 등) 가장 가까운 갈 수 있는 칸으로 먼저 빠져나온다 */
  function buildWalkGrid(){
    var bg = walkMaskOf(document.getElementById('kitchenBgImg'));
    var W = bg ? bg.w : 200, H = bg ? bg.h : 165, g = new Uint8Array(W * H);
    var sr = kitchenScene.getBoundingClientRect(), ovs = [];
    for(var k = 0; k < walkOverlayImgs.length; k++){ // 보이는 가구 그림 위치를 한 번만 읽어 둔다
      var img = walkOverlayImgs[k], m = walkMaskOf(img);
      if(!m) continue;
      var r = img.getBoundingClientRect(), cs = getComputedStyle(img);
      if(!r.width || cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue;
      ovs.push({ m:m, name:walkMaskName(img), l:(r.left - sr.left) / sr.width, t:(r.top - sr.top) / sr.height, w:r.width / sr.width, h:r.height / sr.height });
    }
    for(var y = 0; y < H; y++) for(var x = 0; x < W; x++){
      var fx = (x + 0.5) / W, fy = (y + 0.5) / H, i = y * W + x;
      if(bg && !maskAt(bg, fx, fy)) continue;
      if(isBlocked(fx*100,fy*100)) continue;
      var forced = bg && maskAt(bg, fx, fy, bg.force); // 직접 '걸을 수 있음'으로 칠한 곳은 가구가 있어도 걸을 수 있음
      var hit = false, body = false, underTop = false, behind = false;
      for(var o = 0; o < ovs.length; o++){
        var v = ovs[o];
        if(fx < v.l || fx >= v.l + v.w || fy < v.t || fy >= v.t + v.h) continue;
        var rx = (fx - v.l) / v.w, ry = (fy - v.t) / v.h;
        if(maskAt(v.m, rx, ry)){
          hit = true;
          if(inFurnitureBody(v.name, rx, ry)) body = true;
          else if(WALK_DEPTH[v.name]){
            underTop = true; // 식탁 상판 아래(식탁 뒤 바닥) - 칠하지 않아도 걸을 수 있음(가려짐)
            if(nearFurnitureBack(v.name, rx, ry, 0.05 / v.h)) behind = true; // 뒤 테두리에서 화면 높이 5% 이내 = 식탁 바로 뒤
          }
        }
      }
      // 3 = 식탁 바로 뒤 - 거의 보통 바닥처럼 지나감(가려짐). 2 = 식탁 밑 깊은 곳 - 지나갈 수는 있지만 돌아가는 길을 먼저 고른다.
      // 식탁 몸통은 칠해도 막음
      g[i] = !hit ? 1 : body ? 0 : behind ? 3 : (forced || underTop) ? 2 : 0;
    }
    // 메이트도 가구와 똑같이: 메이트 그림이 있는(불투명) 자리는 못 감 → 메이트를 뚫거나 뒤로 지나가지 못한다
    // 금전형(kitchenMate)·규칙형(kitchenSeoMate) 같은 규칙. 메이트가 걸어 나가는 중엔 자기 길을 막지 않게 뺀다
    [[kitchenMateSprite, kitchenMate.style.display !== 'none' && !mateLeaveAnim],
     [document.getElementById('kitchenSeoMateSprite'), document.getElementById('kitchenSeoMate').classList.contains('show') && !(mate && mate.leaving)]].forEach(function(bl){
    var ms = bl[0], mm = walkMaskOf(ms);
    if(bl[1]){ // 발밑 바닥(타원)도 가구 바닥처럼 막는다 - 그림 마스크는 다리 쪽이 가늘어 발치를 가로질러 지나갔다
      var fr = ms.getBoundingClientRect(), fxm = (fr.left + fr.width / 2 - sr.left) / sr.width, fym = (fr.bottom - sr.top) / sr.height;
      var RX = 0.035, RY = 0.03; // 발 중심 기준 가로 3.5%·세로 3% (말 걸 때 서는 자리 = 옆 7%는 밖)
      for(var ey = 0; ey < H; ey++) for(var ex = 0; ex < W; ex++){
        var dx3 = ((ex + 0.5) / W - fxm) / RX, dy3 = ((ey + 0.5) / H - fym) / RY;
        if(dx3 * dx3 + dy3 * dy3 <= 1) g[ey * W + ex] = 0;
      }
    }
    if(mm && bl[1]){
      var mr = ms.getBoundingClientRect();
      var ml = (mr.left - sr.left) / sr.width, mt = (mr.top - sr.top) / sr.height, mw = mr.width / sr.width, mh = mr.height / sr.height;
      for(var my = 0; my < H; my++) for(var mx = 0; mx < W; mx++){
        var fx2 = (mx + 0.5) / W, fy2 = (my + 0.5) / H;
        if(fx2 >= ml && fx2 < ml + mw && fy2 >= mt && fy2 < mt + mh && maskAt(mm, (fx2 - ml) / mw, (fy2 - mt) / mh)) g[my * W + mx] = 0;
      }
    }
    });
    return { g:g, W:W, H:H };
  }
  function findWalkPath(sx, sy, tx, ty){ // % 좌표 → 지나갈 점들(%) [마지막 = 도착점]
    var G = buildWalkGrid(), g = G.g, W = G.W, H = G.H;
    var toCell = function(x, y){ return Math.min(H - 1, Math.max(0, Math.floor(y / 100 * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(x / 100 * W))); };
    var center = function(i){ return { x:(i % W + 0.5) / W * 100, y:(Math.floor(i / W) + 0.5) / H * 100 }; };
    var nearestOpen = function(i){ // 가장 가까운 갈 수 있는 칸 (없으면 -1)
      if(g[i]) return i;
      var cx = i % W, cy = Math.floor(i / W);
      for(var rad = 1; rad < Math.max(W, H); rad++){
        var best = -1, bd = Infinity;
        for(var y = cy - rad; y <= cy + rad; y++) for(var x = cx - rad; x <= cx + rad; x++){
          if(x < 0 || y < 0 || x >= W || y >= H || (Math.abs(x - cx) !== rad && Math.abs(y - cy) !== rad)) continue;
          var j = y * W + x, d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if(g[j] && d < bd){ bd = d; best = j; }
        }
        if(best >= 0) return best;
      }
      return -1;
    };
    var pre = [];
    var s = toCell(sx, sy);
    if(!g[s]){ s = nearestOpen(s); if(s < 0) return []; pre.push(center(s)); } // 막힌 칸에 서 있으면 먼저 빠져나옴
    var t = toCell(tx, ty), tOpen = g[t] > 0;
    var tcx = t % W, tcy = Math.floor(t / W);
    var hOf = function(i){ var dx = Math.abs(i % W - tcx), dy = Math.abs(Math.floor(i / W) - tcy); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
    // 막힌 곳에서 몇 칸 떨어졌는지(최대 CLEAR칸) - 가구에 바짝 붙어 돌지 않게 가까울수록 비싸게.
    // 바짝 붙어 돌면 몸이 가구에 반쯤 걸친 채로 가림 앞뒤가 바뀌어 튀어 보였다
    var CLEAR = 8, near = new Uint8Array(W * H).fill(CLEAR), qq = [];
    for(var qi = 0; qi < W * H; qi++) if(!g[qi]){ near[qi] = 0; qq.push(qi); }
    for(var qh = 0; qh < qq.length; qh++){
      var qc = qq[qh], qx = qc % W, qy = (qc / W) | 0, nd = near[qc] + 1;
      if(nd >= CLEAR) continue;
      if(qx > 0 && near[qc - 1] > nd){ near[qc - 1] = nd; qq.push(qc - 1); }
      if(qx < W - 1 && near[qc + 1] > nd){ near[qc + 1] = nd; qq.push(qc + 1); }
      if(qy > 0 && near[qc - W] > nd){ near[qc - W] = nd; qq.push(qc - W); }
      if(qy < H - 1 && near[qc + W] > nd){ near[qc + W] = nd; qq.push(qc + W); }
    }
    // A* (이진 힙). 목표에 못 가면 목표에 가장 가까웠던 칸을 도착점으로
    var gs = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
    var heap = [], hf = [];
    var push = function(i, f){ heap.push(i); hf.push(f); var c = heap.length - 1; while(c > 0){ var p = (c - 1) >> 1; if(hf[p] <= hf[c]) break; var a = heap[p]; heap[p] = heap[c]; heap[c] = a; var b = hf[p]; hf[p] = hf[c]; hf[c] = b; c = p; } };
    var pop = function(){ var top = heap[0], li = heap.pop(), lf = hf.pop(); if(heap.length){ heap[0] = li; hf[0] = lf; var c = 0; for(;;){ var l = 2 * c + 1, r = l + 1, m = c; if(l < heap.length && hf[l] < hf[m]) m = l; if(r < heap.length && hf[r] < hf[m]) m = r; if(m === c) break; var a = heap[m]; heap[m] = heap[c]; heap[c] = a; var b = hf[m]; hf[m] = hf[c]; hf[c] = b; c = m; } } return top; };
    gs[s] = 0; push(s, hOf(s));
    var best = s, bestH = hOf(s), goal = -1;
    while(heap.length){
      var cur = pop();
      if(closed[cur]) continue;
      closed[cur] = 1;
      if(cur === t){ goal = t; break; }
      var ch = hOf(cur);
      if(ch < bestH){ bestH = ch; best = cur; }
      var x0 = cur % W, y0 = Math.floor(cur / W);
      for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){
        if(!dx && !dy) continue;
        var nx = x0 + dx, ny = y0 + dy;
        if(nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var n = ny * W + nx;
        if(!g[n] || closed[n]) continue;
        if(dx && dy && (!g[y0 * W + nx] || !g[ny * W + x0])) continue; // 모서리 끼고 대각선으로 빠져나가지 않게
        // 가구 밑 칸은 비싸게 → 식탁을 가로지르지 않고 돌아간다 (그 칸이 목적지일 때만 들어감)
        var ng = gs[cur] + (dx && dy ? 1.4142 : 1) * (g[n] === 2 ? 6 : g[n] === 3 ? 1.3 : 1) * (1 + 1.5 * (CLEAR - near[n]) / CLEAR);
        if(ng < gs[n]){ gs[n] = ng; from[n] = cur; push(n, ng + hOf(n)); }
      }
    }
    var end = goal >= 0 ? goal : best, cells = [];
    for(var c = end; c >= 0; c = from[c]) cells.push(c);
    cells.reverse();
    // 줄 당기기: 직선으로 이어도 갈 수 있는 칸만 지나면 중간 점 생략
    var clear = function(a, b){
      var under = g[a] >= 2 || g[b] >= 2; // 가구 뒤·밑 칸은 양 끝 중 하나가 그 칸일 때만 직선으로 가로지름
      var minNear = Math.min(near[a], near[b], 4); // 지름길이 양 끝보다 가구에 더 바짝 붙지 않게
      var ok = function(i){ return (g[i] === 1 || (under && g[i] >= 2)) && near[i] >= minNear; };
      var ax = a % W + 0.5, ay = Math.floor(a / W) + 0.5, bx = b % W + 0.5, by = Math.floor(b / W) + 0.5;
      var n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2);
      for(var k = 1; k < n; k++){
        var px = ax + (bx - ax) * k / n, py = ay + (by - ay) * k / n;
        // 선이 지나는 칸과 그 양옆을 같이 봐서 가구 모서리를 스치지 않게
        if(!ok(Math.floor(py) * W + Math.floor(px)) || !ok(Math.floor(py + 0.3) * W + Math.floor(px + 0.3)) || !ok(Math.floor(py - 0.3) * W + Math.floor(px - 0.3))) return false;
      }
      return true;
    };
    var pts = pre.slice(), anchor = 0;
    for(var q = 1; q < cells.length; q++){
      if(q === cells.length - 1 || !clear(cells[anchor], cells[q + 1])){ pts.push(center(cells[q])); anchor = q; }
    }
    // 목표 칸까지 갔으면 정확히 클릭한 점에서 멈춤
    if(goal >= 0 && tOpen){ if(pts.length) pts[pts.length - 1] = { x:tx, y:ty }; else pts.push({ x:tx, y:ty }); }
    else if(!pts.length && cells.length) pts.push(center(cells[cells.length - 1]));
    return pts;
  }

  playerPath = []; // remaining waypoints
  function moveTo(xPercent, yPercent, onArrive){
    // 걸어가던 길을 바닥 클릭 등으로 바꾸면 기다리던 쪽에 취소를 알린다 - 안 그러면 TV·싱크대·메이트가 '진행 중'으로 잠긴 채 남아 엔딩까지 못 갔다
    if(pendingArriveCallback && pendingArriveCallback !== onArrive && typeof pendingArriveCallback.onCancel === 'function'){
      var cancelled = pendingArriveCallback; pendingArriveCallback = null; cancelled.onCancel();
    }
    var c = clampToScene(xPercent, yPercent);
    playerPath = findWalkPath(playerPos.x, playerPos.y, c.x, c.y);
    if(!playerPath.length){stopWalking(); if(onArrive && onArrive.onCancel) onArrive.onCancel(); return;} // 갈 길이 없으면 취소로 알린다 (안 그러면 기다리던 쪽이 잠긴 채로 남는다)
    playerTarget = playerPath[playerPath.length - 1] || { x:playerPos.x, y:playerPos.y };
    updateDepthSort();
    pendingArriveCallback = onArrive || null;
    kitchenPlayer.classList.add('kitchen-is-walking');
    if(rafId === null){
      lastTime = null;
      rafId = requestAnimationFrame(step);
    }
  }

  var SCENE_ASPECT = 2046 / 1686; // 가로 %와 세로 %의 실제 길이 비 - 어느 방향이든 같은 속도로 보이게
  function lookAheadPoint(len){ // 남은 길을 따라 len만큼 앞의 점
    var px = playerPos.x, py = playerPos.y;
    for(var k = 0; k < playerPath.length; k++){
      var q = playerPath[k], d = Math.hypot((q.x - px) * SCENE_ASPECT, q.y - py);
      if(d >= len) return { x:px + (q.x - px) * len / d, y:py + (q.y - py) * len / d };
      len -= d; px = q.x; py = q.y;
    }
    return { x:px, y:py };
  }
  function step(ts){
    if(lastTime === null) lastTime = ts;
    var dt = Math.min(0.05, (ts - lastTime) / 1000); // 탭이 멈췄다 돌아와도 한 번에 순간이동하지 않게
    lastTime = ts;

    if(playerTarget){
      var budget = playerSpeed * dt;
      while(budget > 0 && playerPath.length){
        var wp = playerPath[0], dx = wp.x - playerPos.x, dy = wp.y - playerPos.y;
        var dist = Math.hypot(dx * SCENE_ASPECT, dy);
        var look = lookAheadPoint(4); // 바로 다음 꺾임점이 아니라 길을 따라 4% 앞을 보고 방향을 정한다
        if(dist > 0.001) updatePlayerFacing(look.x - playerPos.x, look.y - playerPos.y);
        if(dist <= budget){ playerPos.x = wp.x; playerPos.y = wp.y; playerPath.shift(); budget -= dist; }
        else { playerPos.x += dx / dist * budget; playerPos.y += dy / dist * budget; budget = 0; }
      }
      if(!playerPath.length){
        playerTarget = null;
        kitchenPlayer.classList.remove('kitchen-is-walking');
        setPlayerStyle();
        var cb = pendingArriveCallback;
        pendingArriveCallback = null;
        rafId = null;
        if(cb) cb();
        return; // 도착 -> 루프 종료 (다음 moveTo가 다시 시작시킴)
      }
      setPlayerStyle();
    }
    rafId = requestAnimationFrame(step);
  }

  // 집 그림이 있는 곳인지 (WALK_AREA = 방 그림의 불투명 영역, scripts/walk_masks.py가 뽑음)
  var houseAreaCache = {};
  function inHouseImage(x, y){
    var key = walkMaskName(document.getElementById('kitchenBgImg')), a = WALK_AREA[key], m = WALK_MASKS[key];
    if(!a || !m) return true;
    var bits = houseAreaCache[key] || (houseAreaCache[key] = Uint8Array.from(atob(a), function(c){ return c.charCodeAt(0); }));
    return !!maskAt(m, x / 100, y / 100, bits);
  }
  // 커서: 물건 위에서 바꾼 손가락을 바닥으로 나오면 되돌린다
  kitchenScene.addEventListener('mousemove', function(e){
    if(e.target !== kitchenScene && !e.target.classList.contains('kitchen-layer-bg')) return;
    kitchenScene.style.cursor = ''; // 어디서나 같은 초록 화살표 (teum-cursor.css) - 예전엔 집 위 십자·바깥 기본 화살표로 구역마다 바뀌었다
  });


  // 초기 위치 배치
  setPlayerStyle();

  /* ---- 맵 클릭 이동 ---- */
  // 게임 시작(kitchen:game-start → .game-started) 전엔 장면을 눌러도 아무것도 안 한다 - 화면이 나타나 시작 안내가 뜨기 전
  // 0.8초 사이에 빨리 누르면 아바타가 먼저 걸어 다녔다. 캡처 단계라 핀·메이트 클릭보다도 먼저 막는다 (대화 넘기기는 그대로)
  kitchenScene.addEventListener('click', function(e){
    if(kitchenScene.classList.contains('game-started') || kitchenDialogue.classList.contains('show')) return;
    e.stopPropagation(); e.preventDefault();
  }, true);
  kitchenScene.addEventListener('click', function(e){
    if(kitchenDialogue.classList.contains('show')){
      // 대화창이 떠 있는 동안은 화면 어디를 클릭해도 이동 대신 대화창을 닫는다(쯔꾸르 게임 방식).
      // 단, 선택지가 떠 있는 동안(kitchenDialogueChoiceMode)은 버튼을 직접 눌러야만 진행되게
      // 막는다 - 화면 클릭으로 선택을 건너뛸 수 없어야 하므로.
      if(kitchenDialogueChoiceMode) return;
      dismissKitchenDialogue();
      return;
    }
    if(e.target.closest('.kitchen-fridge-icon')) return; // 아이콘 클릭은 별도 처리
    var rect = kitchenScene.getBoundingClientRect();
    var xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    var yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    if(!inHouseImage(xPercent, yPercent)) return;
    moveTo(xPercent, yPercent);
  });

  /* =========================================================
     4. 냉장고 상태이상 인터랙션 — 팝업 대신 냉장고 이미지 자체를
     "텅 빈 냉장고"로 교체해서 상태를 보여준다.
     ========================================================= */
  // object/fridge/의 그림(닫힘·중간·텅 빔·가득)은 같은 캔버스(517x636)에 그려져 있어서
  // 위치·크기 값 하나(state.fridgeEmpty)를 같이 쓴다 → 바뀔 때 크기가 튀지 않는다.
  var FRIDGE_FULL_SRC = 'object/fridge/fridge_nomal.png'; // 기본값(닫힌 냉장고) - 이름은 FULL이지만 "미션 시작 전" 기본 이미지라는 뜻
  var FRIDGE_HALF_SRC = 'object/fridge/fridge_not1.png'; // 문이 반쯤 열린 중간 장면 (여는 애니메이션용)
  var FRIDGE_EMPTY_SRC = 'object/fridge/fridge_not2.png'; // 문 연 텅 빈 냉장고 (미션 진행 중)
  // 미션1(공동 구독)이 완전히 끝나면 보여줄, 문이 열린 채로 음식이 가득 찬 냉장고.
  // refrigerator_empty.png와 완전히 같은 구도/비율(문 열림 크롭)이라 위치·크기 값도
  // state.fridgeEmpty를 그대로 재사용한다 - renderFridgeCurrent() 참고.
  var FRIDGE_STOCKED_SRC = 'object/fridge/fridge_full2.png';
  var FRIDGE_STOCKED_HALF_SRC = 'object/fridge/fridge_full1.png'; // 음식 찬 채로 문이 반쯤 열린 중간 장면
  var fridgeChecked = false;
  var fridgeResolved = false; // 미션1이 완전히 끝나서 냉장고가 음식으로 채워진 상태인지

  // 닫힌 냉장고 <-> 열린 냉장고 이미지는 원본 비율(가로세로 비)이 서로 다르다.
  // kitchenFridgeImg는 width만 %로 지정하고 height는 지정하지 않기 때문에, src를
  // 바꾸는 순간 새 이미지가 아직 디코딩되지 않은 상태라면 브라우저가 옳은 비율을
  // 몰라서 잠깐 이상한 크기로 보였다가, 로드가 끝나면 다시 올바른 크기로 튀는
  // "크기가 두 번 바뀌는" 현상이 생길 수 있다. 세 이미지를 미리 디코딩해두면
  // 실제로 문을 여는 시점/미션이 끝나는 시점에는 이미 로드가 끝나 있어서 한 번에
  // 정확한 크기로 표시된다.
  [FRIDGE_FULL_SRC, FRIDGE_HALF_SRC, FRIDGE_EMPTY_SRC, FRIDGE_STOCKED_HALF_SRC, FRIDGE_STOCKED_SRC].forEach(function(src){
    var preloadImg = new Image();
    preloadImg.src = src;
    // 붙잡아 두지 않으면 미리 받은 그림이 버려질 수 있고, 해독까지 해 둬야 문 여는 중간 장면이 늦게 붙지 않는다 (캐릭터 그림과 같은 방식)
    if(preloadImg.decode) preloadImg.decode().catch(function(){});
    spritePreloadKeep.push(preloadImg);
  });

  /* ---- 냉장고 확인 대화창 (쯔꾸르 게임풍 다이얼로그) ----
     냉장고 문을 열자마자 바로 미션(구독권 안내)이 뜨면 어색하므로,
     그 사이에 강은지 메이트가 짧게 몇 마디 하는 대화창을 끼워 넣는다.
     여러 줄(text 배열)을 넘기면 클릭/Enter/Space 할 때마다 한 줄씩 넘어가고,
     마지막 줄까지 다 넘긴 뒤 창이 닫히는 시점에 콜백이 실행된다.
     Esc는 대화 중간이라도 바로 닫고 콜백을 실행한다(건너뛰기). */
  var kitchenDialogueLines = [];
  var kitchenDialogueOnDone = null;
  // 대화 한 줄(lines 배열의 원소 하나)에 여러 문장이 마침표/느낌표/물음표/말줄임표(..)로
  // 이어붙어 있는 경우, 그냥 textContent로 넣으면 브라우저가 상자 너비에 맞춰 아무
  // 지점에서나 줄바꿈을 해버려 문장 중간에서 끊기는 문제가 있었다. 문장이 몇 개든
  // 자동으로 몇 줄에 나눠 담을지 추측하는 대신, 대사 문자열 안에 명시적으로 넣어둔
  // 줄바꿈(\n) 지점을 그대로 <br>로 바꿔서 보여준다 - 줄바꿈 위치를 대사마다 직접
  // 정할 수 있도록 하기 위함. \n이 하나도 없으면 문장이 여러 개여도 줄바꿈 없이
  // 한 줄로 그대로 보여준다.
  function escapeDialogueHtml(str){
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  // 대사 줄바꿈: 손으로 넣은 \n은 무시하고, , . ! ? … 뒤를 끊는 기준으로 덩어리(inline-block)를 만든다.
  // 덩어리 사이에서만 줄이 바뀌고(너무 긴 덩어리만 안에서 단어 단위로), text-wrap:balance로 두 줄 길이를 고르게 맞춘다.
  function formatDialogueHtml(text){
    var flat = String(text).replace(/\s*\n\s*/g, ' ').trim();
    var segs = flat.match(/[^,.!?…~]+[,.!?…~]*\s*/g) || [flat];
    return segs.map(function(seg){ return '<span class="dlg-seg">' + escapeDialogueHtml(seg.trim()) + '</span>'; }).join(' ');
  }
  // 대사 속 메이트 호칭: 성을 뗀 이름 + 님 (은지님 / 지혁님) - '이랑'·'하고'처럼 받침 있는 조사를 붙여 쓴다
  function mateCallName(){ var n = (document.getElementById('cohabitMateName').textContent || '').trim(); return n.length > 2 ? n.slice(1) + '님' : (n || '메이트') + '님'; }
  // mood: 'sad'(문제를 발견했을 때, 기본값) | 'happy'(미션을 완료했을 때) - 성별에 맞는
  // 표정 일러스트(DIALOGUE_PORTRAITS)를 골라 대화창 초상화로 보여준다.
  // opts.emoji를 넘기면 관람객 사진 대신 이모지 초상화로 보여준다(강은지가 직접 말하는
  // 대화 전용 - 메이트 사진 에셋이 없어서 이모지로 대신한다).
  // 초상화 그림을 바꿀 때 새 그림이 아직 안 받아졌으면, 그 사이 이전 그림(아바타)이 보이지 않게 숨겨 두었다가 다 받아지면 보인다
  function setDialoguePortrait(src){
    if(kitchenDialoguePortrait.getAttribute('src') === src) return;
    kitchenDialoguePortrait.style.visibility = 'hidden';
    kitchenDialoguePortrait.onload = kitchenDialoguePortrait.onerror = function(){ kitchenDialoguePortrait.style.visibility = ''; };
    kitchenDialoguePortrait.src = src;
    if(kitchenDialoguePortrait.complete) kitchenDialoguePortrait.style.visibility = '';
  }
  function showKitchenDialogue(name, lines, onDone, mood, opts){
    stopWalking(); // 대화 중엔 아바타를 세운다 - 예전엔 금전형만 세워서 규칙·감정형에선 대화창이 떠도 계속 걸어갔다
    disarmHungerBubbleTimer(); // 대화창이 뜨면 머리 위 말풍선은 서서히(0.3초) 사라지고, 이어질 말풍선도 취소
    // 앱(핸드폰 iframe)을 누른 뒤엔 키보드 포커스가 iframe에 남아 Enter/Space/Esc가 대화창에 안 온다 → 포커스를 게임으로 되돌린다
    if(document.activeElement && document.activeElement.tagName === 'IFRAME') document.activeElement.blur();
    kitchenDialogueName.textContent = name;
    kitchenDialogueLines = Array.isArray(lines) ? lines.slice() : [lines];
    kitchenDialogueText.innerHTML = formatDialogueHtml(kitchenDialogueLines[0] || '');
    kitchenDialogueOnDone = onDone || null;
    if(opts && opts.emoji){
      kitchenDialoguePortrait.style.display = 'none';
      kitchenDialogueEmojiPortrait.textContent = opts.emoji;
      kitchenDialogueEmojiPortrait.style.display = 'flex';
    } else if(opts && opts.portraitSrc){
      // 메이트 전용 사진 에셋이 있을 때(예: 강은지의 kang_happy.png) - 관람객 성별/기분
      // 기반 자동 선택 대신 지정된 이미지를 그대로 보여준다.
      kitchenDialogueEmojiPortrait.style.display = 'none';
      kitchenDialoguePortrait.style.display = '';
      setDialoguePortrait(opts.portraitSrc);
    } else {
      kitchenDialogueEmojiPortrait.style.display = 'none';
      kitchenDialoguePortrait.style.display = '';
      var portraits = DIALOGUE_PORTRAITS[visitorGender] || DIALOGUE_PORTRAITS.female;
      setDialoguePortrait((mood === 'happy') ? portraits.happy : portraits.sad);
    }
    hideDialogueChoices(); // 혹시 이전 대화의 선택지가 남아있다면 새 대화 시작 시 치운다
    kitchenDialogue.classList.add('show');
    // 한 페이지 최대 2줄: 실제 대화창에 넣어 보며 페이지를 다시 짠다 (보여야 잴 수 있어 show 뒤에)
    kitchenDialogueLines = packDialogueLines(kitchenDialogueLines);
    kitchenDialogueText.innerHTML = formatDialogueHtml(kitchenDialogueLines[0] || '');
  }
  // 대화 페이지 짜기: ① 2줄을 넘는 대사는 문장부호(. , ? ! … ~) 지점에서 나눠 페이지마다 2줄 이내로,
  // ② 이어지는 대사는 합쳐도 2줄 안이면 한 페이지로 합쳐 클릭 수를 줄인다. 줄 수는 지금 대화창 폭으로 잰다.
  function dialogueLineCount(){
    var tops = {}, n = 0, r = document.createRange();
    r.selectNodeContents(kitchenDialogueText);
    Array.prototype.forEach.call(r.getClientRects(), function(rc){
      if(rc.width < 1) return;
      var k = Math.round(rc.top / 6);
      if(!tops[k] && !tops[k - 1] && !tops[k + 1]){ tops[k] = 1; n++; }
    });
    return n;
  }
  function packDialogueLines(lines){
    if(!kitchenDialogueText.offsetWidth) return lines;
    var fits = function(t){ kitchenDialogueText.innerHTML = formatDialogueHtml(t); return dialogueLineCount() <= 2; };
    var pages = [];
    lines.forEach(function(line){
      if(fits(line)){ pages.push(line); return; }
      var segs = (String(line).replace(/\s*\n\s*/g, ' ').trim().match(/[^,.!?…~]+[,.!?…~]*\s*/g) || [line]).reduce(function(a, g){
        if(a.length && g.trim().length <= 5) a[a.length - 1] += g; else a.push(g); // '우리.'처럼 짧은 조각만 남은 페이지가 생기지 않게
        return a;
      }, []), cur = '';
      segs.forEach(function(g){
        var t = cur ? cur + ' ' + g.trim() : g.trim();
        if(!cur || fits(t)) cur = t; else { pages.push(cur); cur = g.trim(); }
      });
      if(cur) pages.push(cur);
    });
    var out = [];
    pages.forEach(function(pg){
      var last = out[out.length - 1];
      if(last != null && fits(last.replace(/\s*\n\s*/g, ' ') + ' ' + pg)) out[out.length - 1] = last.replace(/\s*\n\s*/g, ' ') + ' ' + pg;
      else out.push(pg);
    });
    return out;
  }
  function closeKitchenDialogue(){
    kitchenDialogue.classList.remove('show');
    kitchenDialogueLines = [];
    hideDialogueChoices();
    var cb = kitchenDialogueOnDone;
    kitchenDialogueOnDone = null;
    if(cb) cb();
  }
  function dismissKitchenDialogue(){
    if(!kitchenDialogue.classList.contains('show') || kitchenDialogueChoiceMode) return;
    kitchenDialogueLines.shift();
    if(kitchenDialogueLines.length > 0){
      kitchenDialogueText.innerHTML = formatDialogueHtml(kitchenDialogueLines[0]);
      return; // 아직 남은 줄이 있으면 대화창은 유지한 채 다음 줄만 보여준다
    }
    closeKitchenDialogue();
  }
  function hideDialogueChoices(){
    kitchenDialogueChoiceMode = false;
    kitchenDialogueChoices.classList.remove('show');
    kitchenDialogueChoices.innerHTML = '';
    kitchenDialogueNextArrow.style.display = '';
    kitchenDialogueBox.classList.remove('has-choices');
  }
  document.addEventListener('keydown', function(e){
    if(!kitchenDialogue.classList.contains('show') || kitchenDialogueChoiceMode) return;
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      dismissKitchenDialogue(); // 다음 줄로 진행, 마지막 줄이면 닫기
    } else if(e.key === 'Escape'){
      e.preventDefault();
      closeKitchenDialogue(); // 대화 중이라도 바로 건너뛰고 닫기
    }
  });

  // 대화창이 떠 있으면 게임 화면(왼쪽) 어디를 눌러도 다음 줄로 - 대화창·집 그림 위만이 아니라 빈 배경·미션 카드·핀 위도.
  // 가장 먼저(캡처 단계) 받아서 다른 클릭 처리(걷기·핀·가구)는 막는다. 선택지가 떠 있을 땐 버튼을 눌러야 함
  document.addEventListener('click', function(e){
    if(!kitchenDialogue.classList.contains('show') || kitchenDialogueChoiceMode) return;
    if(!e.target.closest || !e.target.closest('.cohabit-left')) return;
    e.stopPropagation(); e.preventDefault();
    dismissKitchenDialogue();
  }, true);

  // 문 열린(텅 빈) 냉장고 이미지 위치는 state.fridgeEmpty 값을 그대로 사용한다.
  // (🧊(열림) 튜너에서 직접 위치·크기를 설정/조정할 수 있음 - renderFridgeEmpty() 참고)
  // 냉장고 문 애니메이션: 그림을 한 장씩 바로 넘긴다 (겹쳐 바꾸면 문이 두 겹으로 보여서 페이드 없이).
  // 프레임 목록에 null을 넣으면 그 자리에서 FRIDGE_HOLD_MS만큼 멈춘다.
  var FRIDGE_OPEN_FRAME_MS = 100;
  var FRIDGE_HOLD_MS = 350;
  var fridgeOpenTimer = null;
  function playFridgeFrames(frames){
    clearTimeout(fridgeOpenTimer);
    renderFridgeEmpty();
    (function next(i){
      if(i >= frames.length) return;
      if(frames[i]) kitchenFridgeImg.src = frames[i];
      fridgeOpenTimer = setTimeout(function(){ next(i + 1); }, frames[i] ? FRIDGE_OPEN_FRAME_MS : FRIDGE_HOLD_MS);
    })(0);
  }
  // 문 열기(텅 빔): 닫힘 → 반쯤 → 활짝
  function setFridgeImage(){
    playFridgeFrames([FRIDGE_HALF_SRC, FRIDGE_EMPTY_SRC]);
  }

  // 냉장고를 열 때 서는 자리 - 냉장고 오른쪽 아래, 식탁 앞쪽 바닥 (열린 문 아래쪽만 살짝 가린다).
  // ponytail: 고정 좌표(부엌 % 기준). 충돌 다각형을 크게 바꾸면 같이 옮길 것.
  var FRIDGE_SIDE_POINT = { left:29, top:83 };
  function fridgeSide(){ return currentRoom === 'utility' ? state.utility.fridgePoint : FRIDGE_SIDE_POINT; }
  kitchenFridgeIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(fridgeChecked) return;
    clearTimeout(hungerBubbleArmTimer); // 냉장고로 걸어가는 중에 '냉장고를 확인해보자'가 새로 뜨지 않게
    // 냉장고 오른쪽 아래로 걸어가서 냉장고 쪽(왼쪽)을 보고 연다
    var fs = fridgeSide();
    moveTo(fs.left, fs.top, function(){
      updatePlayerFacing(-1, 0);
      fridgeChecked = true;
      setFridgeImage();
      kitchenFridgeIcon.style.display = 'none';
      // 이 대화창은 강은지(메이트)가 아니라 방을 돌아다니는 character1, 즉 사용자가
      // 입력한 이름의 관람객 아바타가 하는 혼잣말이므로 이름표도 사용자 이름으로 표시한다.
      // (#cohabitVisitorName은 온보딩 시작 시 입력한 이름으로 채워지는 헤더 표시명)
      var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      // 문을 열자마자 바로 미션(구독권 안내)이 뜨면 어색하므로,
      // 짧게 두 마디 하는 대화창을 먼저 보여주고, 대화가 다 끝난 뒤에 신호를 보낸다.
      showKitchenDialogue(visitorDisplayName, [
        '냉장고가 텅 비었네… 매번 장 보기도 귀찮은데, 어떻게 하지?',
        "'틈' 앱에 반찬 구독 기능이 있던데, 신청하고 비용은 " + mateCallName() + "이랑 나눠 볼까?"
      ], function(){
        // 냉장고가 비어있는 걸 확인했다는 신호를 메인 앱(틈 앱)에 전달해서
        // [정기 반찬 구독권] 안내 투어를 시작시킨다.
        window.dispatchEvent(new CustomEvent('kitchen:fridge-checked'));
      }, 'sad');
    });
  });

  // 공동 구독이 시작되면(메인 앱 팝업 확인) 냉장고가 음식이 가득 찬 모습(fridge_full2.png)으로 바뀐다.
  // 모든 냉장고 그림이 같은 캔버스라 위치는 그대로(state.fridgeEmpty), 이미지만 바뀐다.
  window.addEventListener('kitchen:fridge-resolved', function(){
    fridgeChecked = false;
    fridgeResolved = true;
    // 문을 닫았다가(텅 빔 반쯤 → 닫힘) 잠깐 멈춘 뒤, 음식이 찬 채로 다시 연다(가득 반쯤 → 활짝)
    playFridgeFrames([FRIDGE_HALF_SRC, FRIDGE_FULL_SRC, null, FRIDGE_STOCKED_HALF_SRC, FRIDGE_STOCKED_SRC]);
  });
  // 미션1 축하 대화창을 닫으면 음식 찬 냉장고 문을 닫는다 (가득 활짝 → 가득 반쯤 → 닫힘)
  window.addEventListener('kitchen:mission1-dialogue-done', function(){
    if(fridgeResolved) playFridgeFrames([FRIDGE_STOCKED_HALF_SRC, FRIDGE_FULL_SRC]);
    setFridgeRevisit(true);
  });

  // 미션1을 마친 뒤엔 냉장고를 누를 수 있다: 옆으로 걸어가 음식 찬 냉장고를 열고 → 한마디 → 닫는다
  function setFridgeRevisit(on){
    kitchenFridgeImg.style.pointerEvents = on ? 'auto' : '';
    kitchenFridgeImg.style.cursor = on ? 'var(--cur-hand)' : '';
  }
  kitchenFridgeImg.addEventListener('click', function(e){
    if(kitchenDialogue.classList.contains('show')) return; // 대화 중이면 장면 클릭(다음 줄)으로 처리
    // 미션 전: 냉장고 자체를 눌러도 미션 핀을 누른 것과 같다
    if(!fridgeChecked && !fridgeResolved){
      if(!kitchenScene.classList.contains('game-started')) return;
      e.stopPropagation();
      kitchenFridgeIcon.click();
      return;
    }
    if(!fridgeResolved || kitchenFridgeImg.style.pointerEvents !== 'auto') return;
    e.stopPropagation(); // 냉장고 그림 자리로 걸어가는 일반 이동은 막는다
    var fs = fridgeSide();
    moveTo(fs.left, fs.top, function(){
      updatePlayerFacing(-1, 0);
      playFridgeFrames([FRIDGE_STOCKED_HALF_SRC, FRIDGE_STOCKED_SRC]);
      var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      setTimeout(function(){
        showKitchenDialogue(me, ['반찬이 채워져 있으니 든든하다.'], function(){
          playFridgeFrames([FRIDGE_STOCKED_HALF_SRC, FRIDGE_FULL_SRC]);
        }, 'happy');
      }, FRIDGE_OPEN_FRAME_MS * 2 + 150); // 문이 다 열린 뒤에
    });
  });
  window.addEventListener('kitchen:mission-reset', function(){ setFridgeRevisit(false); });
  // "처음부터 다시" 등으로 전체 시나리오가 리셋되면 냉장고 상태도 함께 되돌린다.
  window.addEventListener('kitchen:mission-reset', function(){
    fridgeChecked = false;
    fridgeResolved = false;
    clearTimeout(fridgeOpenTimer);
    kitchenFridgeImg.src = FRIDGE_FULL_SRC;
    renderFridge();
    kitchenFridgeIcon.style.display = '';
    // 대화창이 떠 있는 도중에 리셋된 경우, 화면에 그대로 남지 않도록 함께 닫는다
    // (콜백은 실행하지 않음 - 리셋된 상태에서 미션 신호를 다시 쏘면 안 되므로 강제로 감춘다).
    kitchenDialogueLines = [];
    kitchenDialogueOnDone = null;
    kitchenDialogue.classList.remove('show');
    // 축하 팝업이 떠 있는 도중에 리셋된 경우도 함께 닫는다.
    kitchenCelebrate.classList.remove('show');
  });

  /* =========================================================
     4-1. 두 번째 미션 — 다용도실로 이동
     미션1(냉장고 반찬 구독)이 완전히 끝나면 화면 오른쪽 하단에 다용도실로
     가는 버튼이 나타난다. 누르면 캐릭터가 다용도실 쪽 바닥 지점까지 걸어가고,
     도착하면 화면이 잠깐 어두워졌다 밝아지면서 배경이 다용도실로 바뀐다.
     ========================================================= */
  // 방 배경: 기본 그림 + 유형별로 바꾼 그림(room-images.js TEUM_ROOMS). roomSrc(방)이 지금 유형의 그림을 준다
  var ROOM_BASE = { kitchen:'object/kitchen_bg22.png', utility:'object/kitchen_bg22.png', /* 한방판: 금전형 방 = 부엌 그림 (다용도실 그림은 지움) */
                    eunminKitchen:'object/clean_kichen_bg.png', living:'object/living_room.png' };
  var ROOM_TYPES = window.TEUM_ROOMS || {};
  function roomSrc(room){
    var t = ROOM_TYPES[activeMateType] || {};
    return encodeURI(t[room] || ROOM_BASE[room]); // 파일명 공백 → %20
  }
  // 바꾼 그림도 걸을 수 있는 영역은 기본 그림 것을 쓴다 (walkMaskName이 파일명을 기본 그림 이름으로 바꿔 찾는다)
  Object.keys(ROOM_TYPES).forEach(function(type){
    Object.keys(ROOM_TYPES[type] || {}).forEach(function(room){
      var f = ROOM_TYPES[type][room];
      var n = f && f.split('/').pop();
      if(n && ROOM_BASE[room] && !WALK_MASKS[n]) ROOM_ALIAS[n] = ROOM_BASE[room].split('/').pop(); // 자기 영역이 있는 그림(예: 금전형 kitchen_bg22)은 그대로
    });
  });
  var KITCHEN_SCENE_SIZE = { w: SCENE_W, h: SCENE_H };   // 부엌 배경 원본 크기(위에서 이미 선언된 값)
  var UTILITY_SCENE_SIZE = { w: 2046, h: 1686 };          // 캐릭터 크기 기준 = 방 그림 비율 2046x1686 (예전 2064x2039는 옛 그림 값이라 다용도실에서만 캐릭터가 1% 작았다). 그림을 2배 크기로 뽑아도 이 값은 그대로
  var UTILITY_PLAYER_START = { top: 94, left: 50 };       // 금전형 방에 들어갔을 때 캐릭터가 서 있을 좌표 - 한방판: 부엌 그림이라 원래 부엌 시작 자리(앞쪽 가운데)

  var kitchenRoomFade = document.getElementById('kitchenRoomFade');
  var kitchenRoomStage = document.getElementById('kitchenRoomStage');

  document.body.setAttribute('data-kitchen-room', currentRoom); // 초기값(부엌) - CSS에서 방별 표시에 사용

  // 화면 네모 박스(.room-stage) 크기·비율은 방이 바뀌어도 항상 부엌 박스 크기(2046:1686)
  // 그대로 고정한다 (CSS 기본값 그대로 - 여기서 바꾸지 않는다). 대신 fitScene()이 지금 방의
  // 실제 배경 비율에 맞춰 kitchenScene(진짜 콘텐츠 영역)만 그 박스 안에 원본 비율 그대로
  // 채워 넣는다 - 그림이 늘어나지 않고, 부엌 박스보다 비율이 다른 방은 남는 자리가 여백으로 남는다.
  function applyRoomAspectRatio(){
    fitScene();
  }

  function switchToUtilityRoom(){
    currentRoom = 'utility';
    SCENE_W = UTILITY_SCENE_SIZE.w;
    SCENE_H = UTILITY_SCENE_SIZE.h;
    kitchenBgImg.src = roomSrc('utility');
    kitchenBgImg.alt = '다용도실 배경';
    kitchenScene.classList.add('kitchen-scene-utility');
    kitchenScene.classList.remove('kitchen-scene-livingroom');
    kitchenScene.classList.remove('kitchen-scene-eunmin'); // 규칙형 부엌에서 유형 탭으로 바로 오면 설거지·쓰레기가 따라왔다
    renderFridge(); renderFridgeIcon(); // 한방판: 냉장고도 다용도실에
    renderBubbleIcon(); // 메이트 머리 위 '…' 버튼 크기를 세 유형 같게
    applyRoomAspectRatio();
    playerPos = { x: UTILITY_PLAYER_START.left, y: UTILITY_PLAYER_START.top };
    setPlayerStyle();
    updatePlayerFacing(0, 1); // 방에 들어서면 정면을 본다 (예전엔 직전 방에서 보던 방향 그대로라 유형마다 달랐다)
    renderLaundry();
    renderLaundryIcon();
    renderLaundryBasket();
    renderLaundryClothes();
    document.body.setAttribute('data-kitchen-room', 'utility');
    // 폰 화면(틈 앱)도 처음 화면으로 되돌린다 - fridgeMissionDone은 이 스크립트 쪽에서
    // 직접 못 만지는 메인 앱 변수라서 이벤트로만 알려줄 수 있다.
    window.dispatchEvent(new CustomEvent('kitchen:room-changed-utility'));
  }

  function switchToKitchenRoom(){
    currentRoom = 'kitchen';
    SCENE_W = KITCHEN_SCENE_SIZE.w;
    SCENE_H = KITCHEN_SCENE_SIZE.h;
    kitchenBgImg.src = roomSrc('kitchen');
    kitchenBgImg.alt = '부엌 배경';
    kitchenScene.classList.remove('kitchen-scene-utility');
    // 강은지(S) 엔딩 때문에 거실(kitchen-scene-livingroom)까지 갔다가 "처음으로"로
    // 되돌아올 수 있게 되면서, 여기서도 다른 switchToXRoom()들처럼 다른 방 클래스를
    // 전부 떼어내야 한다 - 안 그러면 거실 전용 아이콘(강은지 말풍선 등)이 부엌 화면에
    // 그대로 남아 보이는 문제가 생긴다.
    kitchenScene.classList.remove('kitchen-scene-livingroom');
    kitchenScene.classList.remove('kitchen-scene-eunmin');
    applyRoomAspectRatio();
    // 다용도실에 있다가 부엌으로 돌아올 때(주로 "처음으로" 리셋 후 다시 시작할 때)
    // 캐릭터 좌표를 다용도실 좌표 그대로 들고 오면 하단 모서리~식탁 앞이라는 정해진
    // 시작 위치에서 벗어나 보인다. switchToUtilityRoom()이 UTILITY_PLAYER_START로
    // 맞춰주는 것과 대칭으로, 여기서도 항상 부엌 기본 시작 위치로 되돌린다.
    playerPos = { x: state.playerStart.left, y: state.playerStart.top };
    setPlayerStyle();
    updatePlayerFacing(0, 1); // 방에 들어서면 정면을 본다 (예전엔 직전 방에서 보던 방향 그대로라 유형마다 달랐다)
    renderBubbleIcon(); // 메이트 머리 위 말풍선 크기를 규칙형과 같게 (안 하면 금전형만 기본 크기라 작게 보였다)
    document.body.setAttribute('data-kitchen-room', 'kitchen');
  }

  // 걷던 것을 멈춘다
  function stopWalking(){
    // 걷던 도중 끊긴 이동에 정리할 일이 있으면(예: 메이트에게 말 걸러 가던 중) 알려준다
    if(pendingArriveCallback && typeof pendingArriveCallback.onCancel === 'function') pendingArriveCallback.onCancel();
    playerTarget = null; playerPath = []; pendingArriveCallback = null;
    kitchenPlayer.classList.remove('kitchen-is-walking');
  }
  // 냉장고 미션을 마쳐야 다용도실 세탁물 알림이 보인다 (CSS .fridge-done)
  window.addEventListener('kitchen:fridge-resolved', function(){ kitchenScene.classList.add('fridge-done'); });
  window.addEventListener('kitchen:mission-reset', function(){ kitchenScene.classList.remove('fridge-done'); });

  // "처음부터 다시"로 전체 시나리오가 리셋되면 다용도실에 있었더라도 부엌 화면으로 되돌린다.
  window.addEventListener('kitchen:mission-reset', function(){
    kitchenRoomFade.classList.remove('show');
    kitchenScene.style.opacity = '1'; // 방 전환 중에 리셋돼도 집이 흐린 채로 남지 않게
    if(currentRoom !== 'kitchen') switchToKitchenRoom();
  });

  /* =========================================================
     4-1-A. 서은민(A) 메이트 전용 부엌/거실
     - 강은지(S)의 냉장고/세탁물 미션과 완전히 분리된 별도 상태 흐름.
     - 미션1(가사·매너 규칙)과 미션2(틈새살림 정산)는 전부 태블릿(app_2/app_3) 안에서
       진행되므로, 부엌/거실 화면 자체에는 클릭으로 시작하는 미니게임 트리거가 없다 -
       배경(더러운 부엌 → 깨끗한 부엌, 고지서가 놓인 거실)은 순전히 상황을 보여주는
       무대일 뿐이고, 실제 진행은 첫 번째 <script> 블록의 teum-app2/teum-app3
       message 리스너가 담당한다.
     ========================================================= */
  // 미션 전 설거지 더미·쓰레기는 따로 얹는 그림(kitchenDishWashImg·kitchenTrashImg)이라 배경은 처음부터 깨끗한 부엌
  // (예전 dirty_kichen_bg.png = 깨끗한 배경 + 이 두 그림. 그림을 옮기면 배경에 그려진 것이 남아 보여서 바꿨다)
  // 방 배경(2046x1686)을 처음 바꿀 때 그림 해독 때문에 화면이 잠깐 멈춘다(느린 PC에서 0.2~0.3초) → 미리 읽고 해독해 둔다.
  // 배열에 잡아 둬야 해독된 그림이 버려지지 않는다
  var roomBgList = Object.keys(ROOM_BASE).map(function(r){ return encodeURI(ROOM_BASE[r]); });
  Object.keys(ROOM_TYPES).forEach(function(t){ Object.keys(ROOM_TYPES[t] || {}).forEach(function(r){ if(ROOM_TYPES[t][r]) roomBgList.push(encodeURI(ROOM_TYPES[t][r])); }); });
  var roomBgPreload = roomBgList.map(function(src){
    var im = new Image(); im.src = src; if(im.decode) im.decode().catch(function(){}); return im;
  });
  var EUNMIN_KITCHEN_PLAYER_START = { top: 92, left: 50 };  // 서은민 부엌에 들어갔을 때 캐릭터가 서 있을 좌표
  var LIVINGROOM_PLAYER_START = { top: 85, left: 38 };      // 거실에 들어갔을 때 캐릭터가 서 있을 좌표 - 식탁 가운데(고지서 핀) 앞을 가리지 않게 왼쪽(금전형 메이트는 오른쪽에 섬)

  var activeMateType = 'S'; // 'S' | 'A' | 'H' - kitchen:set-mate-type 이벤트로 갱신됨
  var eunminMission1Done = false;
  var eunminMission2Done = false;
  // 미션 2개를 다 마치면 금전형처럼 세 번째 미션 '메이트와 이야기하기'가 생긴다 (메이트 머리 위 핀 → 대화 → 마무리)
  var eunminEndingDone = false;

  // fromLivingroom: 거실에서 부엌으로 돌아온 경우 - 부엌 쪽 문(거실 이동 지점) 앞에서 시작한다.
  function switchToEunminKitchenRoom(fromLivingroom){
    currentRoom = 'eunminkitchen';
    SCENE_W = KITCHEN_SCENE_SIZE.w;
    SCENE_H = KITCHEN_SCENE_SIZE.h;
    kitchenBgImg.src = roomSrc('eunminKitchen');
    kitchenBgImg.alt = '서은민 부엌 배경';
    kitchenScene.classList.remove('kitchen-scene-utility');
    kitchenScene.classList.remove('kitchen-scene-livingroom');
    kitchenScene.classList.add('kitchen-scene-eunmin');
    renderPaperIcon(); // 한방판: 생활비 고지서도 부엌 식탁 위에
    applyRoomAspectRatio();
    playerPos = (fromLivingroom === true)
      ? { x: state.eunminKitchen.livingroomPoint.left, y: state.eunminKitchen.livingroomPoint.top }
      : { x: EUNMIN_KITCHEN_PLAYER_START.left, y: EUNMIN_KITCHEN_PLAYER_START.top };
    setPlayerStyle();
    updatePlayerFacing(0, 1); // 방에 들어서면 정면을 본다 (예전엔 직전 방에서 보던 방향 그대로라 유형마다 달랐다)
    renderDiningTable();
    renderEunminMess();
    renderSinkIcon();
    renderBinsIcon();
    renderBubbleIcon();
    document.body.setAttribute('data-kitchen-room', 'eunminkitchen');
  }

  function switchToLivingroomRoom(){
    currentRoom = 'livingroom';
    SCENE_W = KITCHEN_SCENE_SIZE.w;
    SCENE_H = KITCHEN_SCENE_SIZE.h;
    kitchenBgImg.src = roomSrc('living');
    kitchenBgImg.alt = '거실 배경';
    kitchenScene.classList.remove('kitchen-scene-utility');
    kitchenScene.classList.remove('kitchen-scene-eunmin');
    kitchenScene.classList.add('kitchen-scene-livingroom');
    renderBubbleIcon(); // 메이트 머리 위 '…' 버튼 크기를 세 유형 같게
    applyRoomAspectRatio();
    playerPos = { x: LIVINGROOM_PLAYER_START.left, y: LIVINGROOM_PLAYER_START.top };
    setPlayerStyle();
    updatePlayerFacing(0, 1); // 방에 들어서면 정면을 본다 (예전엔 직전 방에서 보던 방향 그대로라 유형마다 달랐다)
    renderPaperIcon();
    document.body.setAttribute('data-kitchen-room', 'livingroom');
    // 거실로 넘어오면 태블릿 앱 화면도 [틈새살림](정산) 화면으로 바꿔준다. appShowScreen은
    // 다른 <script> 블록(태블릿 쪽)에 있어서 여기서 직접 호출할 수 없으므로 이벤트로 알린다.
    // 이 화면 전환은 서은민(A)의 정산 미션 전용이라, 강은지(S) 엔딩 때는 건드리지 않는다
    // (S는 태블릿에 틈새살림 화면 자체를 쓰지 않으므로).
    if(activeMateType === 'A'){
      window.dispatchEvent(new CustomEvent('kitchen:room-changed-livingroom'));
    }
  }


  window.addEventListener('kitchen:laundry-resolved', function(){ kitchenScene.classList.add('laundry-done'); });
  window.addEventListener('kitchen:mission-reset', function(){ kitchenScene.classList.remove('laundry-done'); });


  // 메인 앱(첫 번째 <script> 블록)이 코드 확인 직후 알려주는 지금 메이트 타입에 맞춰
  // 부엌 배경/미니게임 상태를 준비한다 (S: 기존 부엌, A: 서은민 전용 부엌).
  window.addEventListener('kitchen:set-mate-type', function(e){
    activeMateType = (e.detail && e.detail.type) || 'S';
    // 거실 화면에서 메이트 타입에 따라 다른 아이콘(강은지 엔딩용 말 걸기 vs 서은민 정산
    // 종이)만 보이도록 CSS 스코프용 클래스를 붙여둔다 (CSS 쪽 kitchen-mode-s 참고).
    kitchenScene.classList.toggle('kitchen-mode-s', activeMateType === 'S');
    kitchenScene.classList.toggle('kitchen-mode-a', activeMateType === 'A');
    kitchenScene.classList.toggle('kitchen-mode-h', activeMateType === 'H');
    if(activeMateType === 'H'){
      switchToLivingroomRoom(); // 감정형(김정희/김석홍): 거실에서 시작 (메이트는 규칙형 메이트 코드로 거실에 세운다)
    } else if(activeMateType === 'A'){
      eunminMission1Done = false;
      eunminMission2Done = false;
      eunminEndingDone = false;
      switchToEunminKitchenRoom();
    } else {
      switchToUtilityRoom(); // 한방판: 금전형은 다용도실 하나 (냉장고도 여기)
    }
  });

  /* ---------- 서은민 미션1: 싱크대(설거지)/쓰레기통(분리수거) 상태이상 클릭 ----------
     싱크대를 누르면 [설거지 규칙 추가] 미션, 쓰레기통을 누르면 [분리수거 체크] 미션이 시작된다.
     캐릭터가 걸어가서 짧은 혼잣말을 한 뒤 신호(kitchen:eunmin-task-start)를 보내면 태블릿 쪽
     (app-tablet.js)이 앱 가이드를 진행한다. 먼저 고른 미션이 끝나면 태블릿 쪽이 다른 미션을
     이어서 시작하면서 kitchen:eunmin-task-begin을 보내준다(남은 아이콘을 숨기기 위함). 둘 다
     끝나면 kitchen:eunmin-mission1-complete로 폭죽 + 깨끗한 부엌 연출이 나온다. */
  var eunminTaskBusy = false; // 한 미션이 진행 중이면 다른 아이콘 클릭은 무시
  var EUNMIN_TASK_LINES = {
    dish: [
      '그릇이 잔뜩 쌓였네… 설거지는 누가 언제 하면 좋을까?',
      "'틈' 앱에서 설거지 담당 규칙을 정해 볼까?"
    ],
    recycle: [
      '분리수거 통이 꽉 찼네… 이번 주에는 내 담당이었지?',
      '분리수거를 마치고 틈 앱에 완료 체크해서 메이트에게도 알려줄까?'
    ]
  };
  function eunminTaskIcon(task){ return task === 'dish' ? kitchenSinkIcon : kitchenBinsIcon; }
  // 핀(아이콘)이 있는 쪽을 본다 - 아이콘 left/top(%)과 내 발끝 위치로 방향을 정한다
  function faceToward(el){
    var x = parseFloat(el.style.left), y = parseFloat(el.style.top);
    if(isFinite(x) && isFinite(y)) updatePlayerFacing((x - playerPos.x) * SCENE_ASPECT, y - playerPos.y);
  }
  function startEunminTask(task, pointLeft, pointTop){
    if(eunminTaskBusy || eunminMission1Done) return;
    if(kitchenDialogue.classList.contains('show')) return;
    eunminTaskBusy = true;
    renderEunminMess(); // 미션이 시작되면 그림도 더는 눌리지 않게
    var arrive = function(){
      faceToward(eunminTaskIcon(task)); // 싱크대/쓰레기통 쪽을 본다
      eunminTaskIcon(task).style.display = 'none';
      var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      showKitchenDialogue(visitorDisplayName, EUNMIN_TASK_LINES[task], function(){
        window.dispatchEvent(new CustomEvent('kitchen:eunmin-task-start', { detail:{ task:task } }));
      }, 'sad');
    };
    arrive.onCancel = function(){ eunminTaskBusy = false; renderEunminMess(); }; // 걸어가는 중 다른 곳을 누르면 다시 누를 수 있게 (감정형 TV와 같음)
    moveTo(pointLeft, pointTop, arrive);
  }
  kitchenSinkIcon.addEventListener('click', function(e){
    e.stopPropagation();
    startEunminTask('dish', state.eunminKitchen.sinkPoint.left, state.eunminKitchen.sinkPoint.top);
  });
  kitchenBinsIcon.addEventListener('click', function(e){
    e.stopPropagation();
    startEunminTask('recycle', state.eunminKitchen.binsPoint.left, state.eunminKitchen.binsPoint.top);
  });
  // 금전형 냉장고·빨래더미처럼 설거지 더미·쓰레기 그림을 눌러도 싱크대·쓰레기통 핀을 누른 것과 같다.
  // 그림이 있는(불투명) 곳만 - 투명한 곳은 보통 클릭(그 자리로 걷기). file://에선 그림 픽셀을 못 읽어서 모양을 미리 뽑아 둔다
  // (scripts/walk_masks.py와 같은 형식, 96칸. 그림을 바꾸면 다시 뽑을 것)
  var MESS_CLICK_MASKS = {
    'dish wash.png':{w:96,h:56,b:"AAAAAAAAAAMAAAAAAAAAAAAAAAcAfgAAAAAAAAAAAA8A/w8AAAAAAAAAAA6A/z8AAAAAAAAAABzw/38AAAAAAAAAADz8//8AAAAAAAAAAHj///8AAAAAAAAAAPD///8BAAAAAAAAAPj///8BAAAAAAAAAP7///8HAAAAAAAAAP7///8fAAAAAAAAAP7///8/AAAAAAAAAP7/////AAAAAAAAAP7/////AAAAAAAA4P//////AAAAAAAA/P////9/AAAAAAAA/v////9/AAAAAAAA//////9/AAAAAACA//////9/AAAAAACA//////9/AAAAAACA//////9/AAAAAACA//////9/AAAAAACA//////9/AAAAAACA//////9/AAAAAACA//////8fAAAAAACA//////8HAAAeAACA//////8BAAA/AACA/////z8AAAB/AACA/////w8AAAD+AAAA/////wMAAgD/AQAA/v9/fAAAB8D/HwAA+P9/AAAADuD//38AAPh/AAAAHuD///9gAPh/AAAAHOD///9hDPh/AAAAOOD///83DvA/AAAAcOD///8/B8AfAAAAcOD/////AwAAAAAA4P//////AQAAAAAA+P//////AwAAAAAA/v//////DwAAAAAA////////BwAAAAAA////////AQAAAAAA//////9/AAAAAAAA//////8PAAAAAAAA//////8DAAAAAAAA/v////8AAAAAAAAA/P///x8AAAAAAAAA8P///wcAAAAAAAAAwP///wEAAAAAAAAAAP//PwAAAAAAAAAAAPz/DwAAAAAAAAAAAPD/AwAAAAAAAAAAAMD/AAAAAAAAAAAAAIAfAAAAAAAAAAAAAAACAAAAAAAAAAAA"},
    'trash.png':{w:96,h:68,b:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACABwAAAAAAAAAAAADADwAAAAAAAAAAAADADwAAAAAAAAAAAADADwAAAAAAAAAAAADgDwAAAAAAAAAAAADwBwAAAAAAAAAAAAD8DwAAAAAAAAAAAAP/HwAAAAAAAAAAwO//PwcAAAAAAAAA4P///w8AAAAAAAAA4P///w8AAAAAAAAA4P///x8AAAAAAAAA8P///z8AAAAAAAAA8P////8AAAAAAAAA8P////8DAAAAAAAA8P////8PAAAAAAAA8P////8fAAAAAAAA+P////8/AAAAAAAA/v//////AwAAAAAA////////DwAAAAAA/P//////PwAAAAAA8P//////fwAAAAAAwP///////wEAAAAAAP///////z8AAAAAAPz//////38AAAAAAPD//////38AAAAAAMD///////8AAAAAAAD///////8DAwAAAAD8//////+PBwAAAADw//////+/DwAAAADA////////PwAAAAAA////////fwAAAAAA/P///////wAAAAAA8P///////wEAAAAAwP///////wEAAAAAAP///////wMAAAAAAPz//////48HAAAAAPD///////8HAAAAAMD///////8HAAAAAAD///////8HAAAAAAD8//////8HAAAAAADw//////8DAAAAAADA//////8DAAAAAAAA//////8DAAAAAAAA/P////8DAAAAAAAA8P////8DAAAAAAAAwP////8DAAAAAAAAAP////8AAAAAAAAAAPz//z8AAAAAAAAAAPD//w8AAAAAAAAAAMD//wcAAAAAAAAAAAD//wEAAAAAAAAAAAD8fwAAAAAAAAAAAADwHwAAAAAAAAAAAACADwAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}
  };
  function onMessPixel(img, e){
    var m = MESS_CLICK_MASKS[decodeURIComponent(img.getAttribute('src') || '').split('/').pop()];
    if(!m) return true;
    if(!m.bits) m.bits = Uint8Array.from(atob(m.b), function(c){ return c.charCodeAt(0); });
    var r = img.getBoundingClientRect();
    return !!maskAt(m, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  [[kitchenDishWashImg, kitchenSinkIcon], [kitchenTrashImg, kitchenBinsIcon]].forEach(function(p){
    p[0].addEventListener('mousemove', function(e){ p[0].style.cursor = onMessPixel(p[0], e) ? 'var(--cur-hand)' : ''; });
    p[0].addEventListener('click', function(e){
      if(kitchenDialogue.classList.contains('show')) return; // 대화 중이면 장면 클릭(다음 줄)으로
      if(!onMessPixel(p[0], e)) return; // 투명한 곳 = 그 자리로 걷기
      if(!kitchenScene.classList.contains('game-started') || eunminTaskBusy || eunminMission1Done) return;
      e.stopPropagation();
      p[1].click();
    });
  });
  // 끝낸 미션 자리를 다시 누르면 (금전형 냉장고·빨래처럼) 그 앞으로 걸어가 한마디 - 깨끗해진 싱크대·쓰레기통, 정산을 끝낸 식탁 위 종이
  // 미션 전 식탁 위 종이 그림을 누르면 고지서 핀과 같다 (설거지 더미·쓰레기 그림처럼)
  var EUNMIN_REVISIT = {
    dish:{ line:'설거지 담당을 정해 두니 싱크대가 깔끔하네.', point:function(){ return state.eunminKitchen.sinkPoint; }, icon:function(){ return kitchenSinkIcon; } },
    recycle:{ line:'분리수거 당번도 정해 두니 마음이 편하다.', point:function(){ return state.eunminKitchen.binsPoint; }, icon:function(){ return kitchenBinsIcon; } },
    paper:{ line:'이번 달 정산은 끝!', point:function(){ return paperStand(); }, icon:function(){ return kitchenPaperIcon; } }
  };
  function onPaperArea(e){ // 식탁 위 종이 자리 (종이 핀 바로 아래)
    var sr = kitchenScene.getBoundingClientRect(), ic = paperPos();
    var x = (e.clientX - sr.left) / sr.width * 100, y = (e.clientY - sr.top) / sr.height * 100;
    return Math.abs(x - ic.left) <= 4.5 && y >= ic.top - 2 && y <= ic.top + 10;
  }
  function eunminObjectTarget(e){
    // 감정형: 책상 위 종이 자리를 눌러도 미션2(피드백) 핀과 같다
    if(activeMateType === 'H'){
      if(currentRoom !== 'livingroom' || !kitchenScene.classList.contains('game-started') || emotionFbBusy || kitchenDialogue.classList.contains('show')
         || document.body.classList.contains('app-drawer-open') || !onPaperArea(e)) return null;
      return emotionFbDone ? 'fbRevisit' : kitchenScene.classList.contains('fb-ready') ? 'fbStart' : null; // 끝낸 뒤엔 다시 누르면 한마디
    }
    if(activeMateType !== 'A' || !kitchenScene.classList.contains('game-started') || kitchenDialogue.classList.contains('show') || document.body.classList.contains('app-drawer-open')) return null;
    var inRect = function(el){ var r = el.getBoundingClientRect(); return r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    if(currentRoom === 'eunminkitchen' && eunminMission1Done){ if(inRect(kitchenDishWashImg)) return 'dish'; if(inRect(kitchenTrashImg)) return 'recycle'; }
    if(inRoom('livingroom') && onPaperArea(e)){
      if(eunminMission2Done) return 'paper';
      if(!eunminPaperChecked) return 'paperStart';
    }
    return null;
  }
  kitchenScene.addEventListener('click', function(e){ // 장면 클릭(그 자리로 걷기)보다 먼저 받는다
    var t = eunminObjectTarget(e);
    if(!t) return;
    e.stopPropagation();
    if(t === 'paperStart'){ kitchenPaperIcon.click(); return; }
    if(t === 'fbStart'){ document.getElementById('kitchenFbIcon').click(); return; }
    if(t === 'fbRevisit'){ revisitSay(LIVING_DESK_SIDE, '피드백을 주고받고 나니 한결 편해졌다.', document.getElementById('kitchenFbIcon')); return; }
    var o = EUNMIN_REVISIT[t], pt = o.point(), me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    moveTo(pt.left, pt.top, function(){ faceToward(o.icon()); showKitchenDialogue(me, [o.line], null, 'happy'); });
  }, true);
  kitchenScene.addEventListener('mousemove', function(e){ if(eunminObjectTarget(e)) kitchenScene.style.cursor = 'var(--cur-hand)'; });

  // 태블릿에서 설거지 규칙 / 분리수거 미션을 하나 마칠 때마다 그 그림을 치운다
  window.addEventListener('kitchen:eunmin-task-done', function(e){
    var task = e.detail && e.detail.task;
    if(task){ eunminMessDone[task] = true; renderEunminMess(); }
  });
  // 첫 미션이 끝나고 태블릿이 다음 미션을 이어서 시작하면, 그 미션의 아이콘도 숨긴다.
  // [좋아요, 이어서 할게요]로 다음 미션(설거지 ↔ 분리수거)이 시작되면 아바타가 그 자리(싱크대/쓰레기통 앞)로 걸어가 그쪽을 본다
  // - 앱이 열려 있는 동안에도 왼쪽 부엌에서 지금 두 가지를 이어서 하고 있다는 게 보이게
  window.addEventListener('kitchen:eunmin-task-begin', function(e){
    var task = e.detail && e.detail.task;
    if(!task) return;
    var icon = eunminTaskIcon(task);
    icon.style.display = 'none';
    if(activeMateType !== 'A' || currentRoom !== 'eunminkitchen') return;
    var pt = task === 'dish' ? state.eunminKitchen.sinkPoint : state.eunminKitchen.binsPoint;
    var ready = e.detail.ready || function(){};
    e.detail.wait = true; // 앱 안내는 도착할 때까지 기다린다 (app-tablet.js runEunminTask)
    var arrive = function(){ faceToward(icon); setTimeout(ready, 250); };
    arrive.onCancel = ready; // 길이 없거나 끊겨도 안내가 멈춘 채 남지 않게
    moveTo(pt.left, pt.top, arrive);
  });

  // ---------- 메이트 머리 위 말풍선 버튼 ----------
  // 미션 진행과 무관하게 메이트를 따라다니며 항상 떠 있다 - 누르면 메이트가 그 자리에 멈추고,
  // 관람객이 옆으로 걸어가서 서은민(여성 관람객 기준)/서민호(남성 관람객 기준)의 인사를 듣는다
  // (mateGreet, 아래 4-1-B 섹션). 다른 대화창이 이미 떠 있을 때는 무시한다(안 그러면 진행 중이던
  // 미션 대화의 onDone 콜백이 덮어써져서 미션 진행이 끊길 수 있다).
  kitchenBubbleIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(kitchenDialogue.classList.contains('show')) return;
    if(document.body.classList.contains('app-drawer-open')) return;
    if(activeMateType === 'S'){ kitchenMate.click(); return; }
    mateGreet();
  });

  // 태블릿 쪽(첫 번째 <script> 블록)에서 미션1의 두 하위 미션(가사 규칙 등록 + 분리수거
  // 체크)이 모두 끝나면 이 이벤트가 온다 - 폭죽 + 배경 전환 + 대화창으로 축하 연출을 보여준다.
  function showEunminMission1Celebrate(){
    kitchenCelebrate.classList.remove('show');
    void kitchenCelebrate.offsetWidth;
    kitchenCelebrate.classList.add('show'); celebrateBurst();
    eunminMission1Done = true;
    if(currentRoom === 'eunminkitchen'){
      kitchenBgImg.src = roomSrc('eunminKitchen');
    }
    renderEunminMess();
    var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    showKitchenDialogue(visitorDisplayName, [
      '설거지·분리수거 규칙 정하기 끝! 이제 덜 쌓이겠지?'
    ], function(){
      kitchenCelebrate.classList.remove('show');
      eunminReact('m1', function(){ window.dispatchEvent(new CustomEvent('kitchen:eunmin-mission1-dialogue-done')); });
    }, 'happy');
  }
  window.addEventListener('kitchen:eunmin-mission1-complete', showEunminMission1Celebrate);
  // 금전형과 같은 틀: 첫 미션을 마쳤을 때만 메이트가 남은 미션을 한 번 귀띔하고 자기 일 하러 간다 (매번 대답하지 않는다)
  function eunminReact(kind, after){
    var hint = (eunminMission1Done && eunminMission2Done) ? ''
             : kind === 'm1' ? '식탁 위에 생활비 고지서도 와 있더라고요.\n그럼 저는 다른 일 하고 있을게요!'
             : '싱크대랑 분리수거 통도 꽉 차 있더라고요.\n그럼 저는 다른 일 하고 있을게요!';
    if(hint && mateVisible() && !mate.leaving) mateSpeak(mateDisplayName(), [['happy', hint]], after);
    else after();
  }

  // 미션1(설거지·분리수거)과 미션2(식탁 고지서 정산)는 순서 상관없이 - 둘 다 끝나면 세 번째 미션(새 안건)으로.
  // 축하 대화창을 다 읽고 닫은 뒤: 정산이 남았으면 고지서를 보라는 말풍선.
  window.addEventListener('kitchen:eunmin-mission1-dialogue-done', function(){
    if(eunminMission2Done) agendaBegin(); // 세 번째 미션은 메이트가 올린 새 안건 (남은 미션은 메이트가 방금 귀띔했다)
  });

  // app_3(틈새살림)에서 정산 요청을 보내면(teum-app3 message) 이 이벤트가 온다 -
  // 강은지의 마지막 미션(세탁물)과 마찬가지로 게임 종료 연출로 이어간다.
  window.addEventListener('kitchen:eunmin-mission2-done', function(){
    if(eunminMission2Done) return;
    eunminMission2Done = true;
    kitchenANotice.style.display = 'none'; // 정산을 끝내면 고지서 그림도 치운다
    celebrateBurst(); // 금전형 미션 완료처럼 축하 폭죽
    var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    showKitchenDialogue(visitorDisplayName, [
      '이번 달 생활비 정산 끝! 나눠 내니까 부담이 덜하다.'
    ], function(){
      eunminReact('m2', function(){ if(eunminMission1Done) agendaBegin(); });
    }, 'happy');
  });

  // 규칙형 마지막 미션 마무리 - 금전형(finishEunjiEnding)과 같은 틀: 폭죽 → 메이트와 하루 정리 대사 → 저녁 '첫날 완료' → 평가 창
  // (예전엔 마지막 혼잣말 뒤 바로 평가 창이 떠서 금전형과 끝맺음이 달랐다)
  function finishEunminDay(){
    celebrateBurst();
    dayEndTimers.push(setTimeout(function(){
      var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      if(mateVisible()){ // 금전형 마무리처럼 서로 마주 본다
        var ddx = playerPos.x - mate.x, ddy = playerPos.y - mate.y;
        mateFace(Math.abs(ddx) > Math.abs(ddy) ? (ddx < 0 ? 'left' : 'right') : (ddy < 0 ? 'back' : 'front'));
        updatePlayerFacing(-ddx, -ddy);
      }
      mateSpeak(mateDisplayName(), ['오늘 하루, 하나씩 맞춰가서 정말 좋았어요.'], function(){
        showKitchenDialogue(me, ['저도요! 앞으로도 잘 부탁해요.'], showDayEnd, 'happy');
      }, 'happy');
    }, 2000));
  }

  /* ---------- 서은민 미션2 트리거: 거실 식탁 위 정산 종이 상태이상 클릭 ----------
     싱크대/쓰레기통 미션1과 같은 구조 - 클릭하면 캐릭터가 식탁 앞으로 걸어가서 짧은
     혼잣말 대화창이 뜨고, 대화가 끝나면 태블릿 화면이 [틈새살림] 화면인지 다시 확인해주면서
     (거실 진입 시 이미 자동으로 전환되지만, 종이를 눌렀을 때도 확실히 그 화면에 있도록) 금액
     정산 안내 투어를 시작한다. */
  var eunminPaperChecked = false;
  /* ---------- 감정형 TV 미션: 전기세 줄이기 ----------
     TV 핀 → TV 앞으로 걸어가 혼잣말 → 앱(app_4) 안건 → 메시지 → AI 물어보기 (app-tablet.js emotionTvSteps)
     → 끝나면(kitchen:emotion-tv-done) 폭죽, 켜 둔 TV 화면·전등 불빛이 꺼지고 원래 거실 그림으로 */
  var kitchenTvIcon = document.getElementById('kitchenTvIcon');
  // 아바타가 미션 핀·책상을 몸으로 가리지 않게 서는 자리 (아바타 ≈ 폭 9.7% · 키 33%, 핀 ≈ 4.2% · 6.6%로 계산)
  // ponytail: 좌표수정도구의 '종이 도착 지점'(paperPoint 74/50 = 책상 정면, 핀을 가림) 대신 고정값 - 바꾸려면 여기 숫자만
  var LIVING_DESK_SIDE = { left:41, top:81 }; // 거실 시작 자리(38/85)에서 조금만 움직여 책상(고지서·피드백 핀) 쪽 옆을 본다 - 규칙형 정산·감정형 피드백
  var LIVING_TV_SIDE = { left:67.5, top:57 }; // TV 오른쪽 - 예전 58/56은 머리가 TV 핀 아래에 겹쳤다
  // 미션1 = 채팅에서 전기값 이야기 → 안건 등록(emotionChatDone, TV 핀이 사라지고 TV는 켜진 채) /
  // 미션2 = 그 안건에 메이트 댓글 → AI 물어보기로 예전 약속 찾기 → 끝나면 TV·전등이 꺼지고(emotionTvDone = tv-off) 미션3 피드백 핀
  var emotionTvDone = false, emotionTvBusy = false, emotionChatDone = false;
  var emotionEndingDone = false; // 두 번째 미션(전기세 안건 확인하기) 완료 - 감정형 순서: 채팅 → 안건 확인 → 피드백
  function setEmotionTvDone(on){ emotionTvDone = on; kitchenScene.classList.toggle('tv-off', on); }
  function setEmotionChatDone(on){ emotionChatDone = on; kitchenScene.classList.toggle('tv-asked', on); }
  kitchenTvIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(emotionTvBusy || emotionChatDone || kitchenDialogue.classList.contains('show') || document.body.classList.contains('app-drawer-open')) return;
    emotionTvBusy = true;
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    var arrive = function(){
      faceToward(kitchenTvIcon);
      showKitchenDialogue(me, ['아무도 안 보는데 TV랑 전등이 계속 켜져 있네…', '그러고 보니 ' + mateCallName() + '께 채팅이 와 있었지. 확인해볼까?'], function(){
        window.dispatchEvent(new CustomEvent('kitchen:emotion-tv-start'));
      }, 'sad');
    };
    arrive.onCancel = function(){ emotionTvBusy = false; }; // 걸어가는 중 다른 곳을 누르면 다시 누를 수 있게
    moveTo(LIVING_TV_SIDE.left, LIVING_TV_SIDE.top, arrive);
  });
  // TV 화면 그림을 눌러도 핀을 누른 것과 같다 (설거지 더미·쓰레기 그림처럼). 대화 중이면 장면 클릭(다음 줄)으로 둔다
  document.getElementById('kitchenTvImg').addEventListener('click', function(e){
    if(kitchenDialogue.classList.contains('show')) return;
    e.stopPropagation();
    if(emotionTvDone){ revisitSay(LIVING_TV_SIDE, '안 볼 땐 꺼 두기로 했지.', kitchenTvIcon); return; } // 끝낸 뒤 다시 누르면 한마디
    if(emotionChatDone){ revisitSay(LIVING_TV_SIDE, '안건에 올려 뒀으니 댓글을 기다려 보자.', kitchenTvIcon); return; }
    kitchenTvIcon.click();
  });
  window.addEventListener('kitchen:emotion-tv-done', function(){ // 미션1(채팅 → 안건 등록) 끝
    emotionTvBusy = false;
    setEmotionChatDone(true);
    kitchenCelebrate.classList.remove('show'); void kitchenCelebrate.offsetWidth;
    kitchenCelebrate.classList.add('show'); celebrateBurst();
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    showKitchenDialogue(me, ['전기세 안건 올리기 끝! 댓글을 기다려 보자.'], function(){
      kitchenCelebrate.classList.remove('show');
      // 감정형은 순서대로: 미션1 채팅 → 미션2 안건(메이트 댓글 알림) → 미션3 피드백
      if(mateVisible()) mateSay(['제 생각은 안건에 댓글로 남겨둘게요.\n그럼 저는 다른 일 하고 있을게요!'], agendaBegin); else agendaBegin();
    }, 'happy');
  });

  /* ---------- 감정형 미션3: 피드백 주고받기 ----------
     한 달 함께 지내며 생긴 고마움·조심스러운 부탁을 얼굴 보고 꺼내기 어려워 오해가 쌓일 수 있는 상황.
     거실 책상(식탁) 위 핀 → 책상 앞으로 가 혼잣말 → 앱(app_3) 상호 피드백 작성 → 상대 피드백 확인. 세 번째(마지막) 미션 - 안건 확인(미션2)을 마치면 핀이 뜬다
     (app-tablet.js emotionFbSteps) → 끝나면(kitchen:emotion-fb-done) 폭죽 + 메이트 반응 */
  var kitchenFbIcon = document.getElementById('kitchenFbIcon');
  var emotionFbReady = false, emotionFbDone = false, emotionFbBusy = false;
  function setEmotionFbReady(on){
    emotionFbReady = on;
    kitchenScene.classList.toggle('fb-ready', on && !emotionFbDone);
    // 핀 = 책상 위 (규칙형 고지서 핀과 같은 자리 - 튜너 paperIcon)
    kitchenFbIcon.style.left = state.livingroom.paperIcon.left + '%';
    kitchenFbIcon.style.top = state.livingroom.paperIcon.top + '%';
  }
  window.addEventListener('kitchen:game-start', function(){ if(activeMateType === 'H') setEmotionFbReady(true); }); // TV 핀과 함께 처음부터 - 채팅 전이나 안건 확인 뒤에 시작 (채팅~안건 확인 사이만 막음)
  kitchenFbIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(!emotionFbReady || emotionFbBusy || emotionFbDone || kitchenDialogue.classList.contains('show') || document.body.classList.contains('app-drawer-open')) return;
    if(emotionChatDone && !emotionEndingDone){ // 피드백은 채팅 전에도 할 수 있지만, 안건을 올렸으면 확인까지 이어서
      revisitSay(LIVING_DESK_SIDE, '피드백은 전기세 안건부터 확인하고 써야겠다.', kitchenFbIcon);
      return;
    }
    emotionFbBusy = true;
    var arrive = function(){ faceToward(kitchenFbIcon); startEmotionFb(); };
    arrive.onCancel = function(){ emotionFbBusy = false; }; // 걸어가는 중 다른 곳을 누르면 다시 누를 수 있게
    moveTo(LIVING_DESK_SIDE.left, LIVING_DESK_SIDE.top, arrive);
  });
  function startEmotionFb(){
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    showKitchenDialogue(me, [
      '한 달 동안 ' + mateCallName() + '께 고마운 게 참 많았는데, 막상 얼굴 보고 말하려니 쑥스럽네…',
      '조심스럽게 부탁하고 싶은 것도 있고… 틈 피드백으로 가볍게 마음을 전해볼까?'
    ], function(){
      window.dispatchEvent(new CustomEvent('kitchen:emotion-fb-start'));
    }, 'sad');
  }
  window.addEventListener('kitchen:emotion-fb-done', function(){
    emotionFbDone = true; emotionFbBusy = false;
    setEmotionFbReady(false);
    kitchenCelebrate.classList.remove('show'); void kitchenCelebrate.offsetWidth;
    kitchenCelebrate.classList.add('show'); celebrateBurst();
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    showKitchenDialogue(me, ['피드백 주고받기 끝! 마음을 전하고 나니 한결 가볍다.', '주방 정리는 나도 더 신경 써야겠다.'], function(){
      kitchenCelebrate.classList.remove('show');
      // 피드백은 안건보다 먼저 할 수도 있다 - 안건까지 끝났을 때만 하루 마무리
      var next = emotionEndingDone ? finishEunminDay : function(){};
      if(mateVisible()) mateSay(['피드백 잘 받았어요. 늦게 TV 볼 땐 소리를 줄일게요!', '이렇게 서로 마음을 나누니 참 좋네요. 앞으로도 편하게 이야기해요.'], next); else next();
    }, 'happy');
  });
  ['kitchen:set-mate-type', 'kitchen:mission-reset'].forEach(function(ev){
    window.addEventListener(ev, function(){ emotionTvBusy = emotionFbBusy = false; setEmotionTvDone(false); setEmotionChatDone(false); emotionFbDone = false; setEmotionFbReady(false); emotionEndingDone = false; });
  });
  kitchenPaperIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(eunminPaperChecked || eunminMission2Done || !inRoom('livingroom')) return;
    var ps = paperStand();
    moveTo(ps.left, ps.top, function(){ // 고지서를 가리지 않게 책상 옆 (LIVING_DESK_SIDE)
      // 식탁 위 고지서 쪽을 옆으로 본다 - 핀은 그림보다 높이 떠 있어 핀 쪽을 보면 뒷모습이 됐다
      var nt = state.eunminKitchen.notice;
      if(currentRoom === 'eunminkitchen') updatePlayerFacing(nt.left + nt.width / 2 - playerPos.x, 0); else faceToward(kitchenPaperIcon);
      eunminPaperChecked = true;
      kitchenPaperIcon.style.display = 'none'; // 고지서 그림은 정산을 끝낼 때까지 둔다(읽는 동안 보이게)
      var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      showKitchenDialogue(visitorDisplayName, [
        '이번 달 생활비 고지서가 왔네… 같이 쓴 비용은 어떻게 나누면 좋을까?',
        '틈 앱에서 나눌 금액을 확인하고 메이트에게 정산 요청을 보내볼까?'
      ], function(){
        // appShowScreen은 다른 <script> 블록(태블릿 쪽)에 있어서 여기서 직접 호출할 수
        // 없으므로 이벤트로 알린다 - 거실 진입 때와 마찬가지로 확실히 [틈새살림] 화면에 있게 하고,
        // 이어서 금액 정산 안내 투어를 시작한다.
        window.dispatchEvent(new CustomEvent('kitchen:eunmin-paper-checked'));
      }, 'sad');
    });
  });


  /* =========================================================
     4-1-B. 메이트 자유 이동 (서은민 A 전용)
     - 메이트는 부엌(eunminkitchen)과 거실(livingroom) 중 한 곳에 "논리적으로" 있다.
       관람객이 보고 있는 방에 있으면 화면에 보이면서 천천히 걸어다니고(관람객의 약 1/3 속도),
       자리마다 5초 미만으로 잠깐 멈춘다. 가끔 문(부엌: 거실 이동 지점 / 거실: 오른쪽 문)으로
       걸어 나가 다른 방으로 가고, 잠시 뒤 다시 문으로 들어온다.
     - 충돌 판정에는 메이트를 넣지 않고 클릭도 받지 않아서 관람객 아바타의 이동을 방해하지 않는다.
       메이트 자신은 가구 충돌 다각형(isBlocked)을 피해서 걷는다.
     - 관람객이 여성이면 서은민(object/seo/seo_*), 남성이면 서민호(seoman_*) 스프라이트를 쓴다.
     ========================================================= */
  var kitchenSeoMate = document.getElementById('kitchenSeoMate');
  var kitchenSeoMateSprite = document.getElementById('kitchenSeoMateSprite');
  // 서은민(A) 메이트 이미지는 매칭 화면 전신 이미지와 같은 object/mate2/ 것을 쓴다 (여성 관람객 → 서은민 mate_women_2_*,
  // 남성 관람객 → 서민호 seoman_*). hi는 말풍선을 눌렀을 때 인사 대화창 초상화.
  var MATE_SPRITES = {
    female:{
      front:'object/mate2/mate_women_2_front.png', back:'object/mate2/mate_women_2_back.png',
      left:'object/mate2/mate_women_2_left.png', right:'object/mate2/mate_women_2_right.png',
      hi:'object/mate2/mate_women_2_hi.png', happy:'object/mate2/mate_women_2_happy.png', worry:'object/mate2/mate_women_2_worry.png'
    },
    male:{
      front:'object/mate2/mate_men_2_front.png', back:'object/mate2/mate_men_2_back.png',
      left:'object/mate2/mate_men_2_left.png', right:'object/mate2/mate_men_2_right.png',
      hi:'object/mate2/mate_men_2_hi.png', happy:'object/mate2/mate_men_2_happy.png', worry:'object/mate2/mate_men_2_worry.png'
    }
  };
  // 감정형(H) 김정희/김석홍 - 규칙형 메이트와 같은 동작, 그림만 object/mate3/
  var MATE3_SPRITES = {};
  ['female', 'male'].forEach(function(g){
    MATE3_SPRITES[g] = {};
    Object.keys(MATE_SPRITES[g]).forEach(function(d){ MATE3_SPRITES[g][d] = MATE_SPRITES[g][d].replace(/mate2\/mate_(wo)?men_2_/, 'mate3/mate_$1men_3_'); });
  });
  // 메이트 1~3(금전·규칙·감정형) 걷기·표정 그림을 성별 모두 미리 받아 해독해 둔다 - 예전엔 mate1은 아예 안 받아 둬서
  // 대화창에 아바타가 뜬 채로 있다가 메이트 얼굴이 늦게 바뀌거나 걷는 그림이 늦게 붙었다
  [1, 2, 3].forEach(function(n){ ['women', 'men'].forEach(function(g){ ['front', 'back', 'left', 'right', 'hi', 'happy', 'worry'].forEach(function(d){
    var im = new Image(); im.src = 'object/mate' + n + '/mate_' + g + '_' + n + '_' + d + '.png';
    if(im.decode) im.decode().catch(function(){}); spritePreloadKeep.push(im);
  }); }); });
  // 대화창에 표시할 메이트 이름 - 상단 바에 이미 성별에 맞게(서은민/서민호) 들어가 있다.
  function mateDisplayName(){
    return (document.getElementById('cohabitMateName').textContent || '').trim() || '서은민';
  }
  var MATE_SPEED = 8;                  // % / sec - 관람객(32)의 1/4, 천천히 걷는 속도
  var MATE_IDLE_MS = [1200, 4600];     // 한 자리에서 멈춰 있는 시간 (5초 미만)
  var MATE_AWAY_MS = [6000, 11000];    // 다른 방에 가 있는(화면에 안 보이는) 시간
  var MATE_LEAVE_CHANCE = 0.25;        // 멈췄다가 다음 행동으로 방을 옮길 확률
  // 방마다 메이트가 들를 만한 바닥 지점(배경 이미지 기준 %). 매번 ±3% 흔들어서 고르고,
  // 가구 충돌 다각형 안이면 다시 고른다.
  var MATE_ROOMS = {
    eunminkitchen:{
      spots:[ {x:20,y:76}, {x:30,y:86}, {x:45,y:90}, {x:62,y:86}, {x:70,y:79}, {x:69,y:70}, {x:52,y:84} ],
      door:function(){ return { x:state.eunminKitchen.livingroomPoint.left, y:state.eunminKitchen.livingroomPoint.top }; }
    },
    livingroom:{
      spots:[ {x:72,y:64}, {x:55,y:80}, {x:40,y:85}, {x:65,y:78}, {x:78,y:72}, {x:68,y:56}, {x:22,y:70} ],
      door:function(){ return { x:88, y:67 }; }  // 오른쪽 벽 문 앞 매트
    }
  };
  var MATE_OTHER_ROOM = { eunminkitchen:'livingroom', livingroom:'eunminkitchen' };
  var mate = { active:false, room:'eunminkitchen', x:50, y:85, target:null, leaving:false,
               timer:null, raf:null, last:null, facing:'', hold:false };

  function mateRand(range){ return range[0] + Math.random() * (range[1] - range[0]); }
  function mateSprites(){ var s = activeMateType === 'H' ? MATE3_SPRITES : MATE_SPRITES; return s[visitorGender] || s.female; }
  function mateVisible(){ return mate.active && mate.room === currentRoom; }
  // 규칙형도 금전형처럼 고정 NPC - 미션1을 마치고 거실로 걸어 나갈 때(leaving)만 움직인다
  function mateMovable(){ return mate.active && mate.leaving && !mate.hold; }
  var SEO_MATE_POS_KITCHEN = { x:56, y:54.5 }; // 부엌 - 조리대 안쪽 모서리 앞(가운데 쪽, 10-18 요청). 조리대에 붙여 세워야 식탁 뒤 통로가 안 막힌다 (메이트 그림 자리는 못 지나감 - 55/59처럼 앞으로 나오면 쓰레기통 쪽으로 못 감). 예전 y65는 식탁과의 통로를 막아 싱크대↔쓰레기통을 식탁 뒤로 빙 돌아갔다
  var SEO_MATE_POS_LIVING = { x:24, y:59 };  // 거실 - 감정형 메이트 거실 자리(SEO_MATE_POS_EMOTION)와 같은 곳
  var SEO_MATE_POS_EMOTION = { x:24, y:59 }; // 감정형 거실 - 소파 바로 앞(뒤가 소파라 캐릭터가 메이트 뒤로 못 지나감)
  function mateSchedule(fn, ms){ clearTimeout(mate.timer); mate.timer = setTimeout(fn, ms); }
  function mateStopWalking(){
    if(mate.raf){ cancelAnimationFrame(mate.raf); mate.raf = null; }
    mate.target = null;
    kitchenSeoMate.classList.remove('kitchen-is-walking');
  }
  function mateFace(dir){
    var src = mateSprites()[dir];
    if(src && kitchenSeoMateSprite.getAttribute('src') !== src) kitchenSeoMateSprite.src = src;
    mate.facing = dir;
  }
  // 관람객 아바타와 같은 테이블 기준선(sortY) 규칙 + 서로의 앞뒤(발끝 Y)까지 반영한다.
  function mateDepth(){
    if(!mate || !mate.active) return;  // 초기 setPlayerStyle()은 메이트 준비 전에 호출된다
    // 금전형 메이트와 같은 규칙: 가구 기준 높이(식탁 뒤 9 → 8, 앞 11)로 두고 아바타(12)는 항상 메이트 위에 그린다
    var z = furnitureDepthZ(mate.x, mate.y);
    kitchenSeoMate.style.zIndex = z === 9 ? 8 : z;
  }
  function mateRender(){
    kitchenSeoMate.style.left = mate.x + '%';
    kitchenSeoMate.style.top = mate.y + '%';
    kitchenSeoMate.classList.toggle('show', mateVisible());
    // 머리 위 말풍선 버튼도 같은 발끝 좌표로 따라간다 (CSS가 스프라이트 높이만큼 위로 올림)
    if(activeMateType !== 'S') kitchenBubbleIcon.style.left = mate.x + '%';
    if(activeMateType !== 'S') kitchenBubbleIcon.style.top = mate.y + '%';
    if(activeMateType !== 'S') kitchenBubbleIcon.classList.toggle('mate-on', mateVisible());
    mateDepth();
  }
  // 현재 위치에서 목표까지 직선으로 가구에 걸리지 않고 갈 수 있는지(1.5% 간격으로 검사)
  function mateClearPath(p){
    var dx = p.x - mate.x, dy = p.y - mate.y;
    var n = Math.ceil(Math.sqrt(dx * dx + dy * dy) / 1.5);
    for(var i = 1; i <= n; i++){
      if(isBlocked(mate.x + dx * i / n, mate.y + dy * i / n)) return false;
    }
    return true;
  }
  function matePickSpot(room){
    var spots = MATE_ROOMS[room].spots;
    var fallback = null;
    for(var i = 0; i < 20; i++){
      var b = spots[Math.floor(Math.random() * spots.length)];
      var p = { x:b.x + (Math.random() * 6 - 3), y:b.y + (Math.random() * 6 - 3) };
      if(room !== currentRoom) return p;
      // 지금 바로 옆 자리는 피해서 실제로 걸어가는 모습이 보이게 한다
      if(Math.abs(p.x - mate.x) + Math.abs(p.y - mate.y) < 8 || isBlocked(p.x, p.y)) continue;
      // 가구를 돌아가지 않아도 되는(직선 경로가 비어 있는) 자리를 우선 고른다
      if(mateClearPath(p)) return p;
      if(!fallback) fallback = p;
    }
    return fallback || { x:spots[0].x, y:spots[0].y };
  }

  function mateIdle(){
    if(!mateMovable()) return;
    mateFace('front');
    mateSchedule(mateDecide, mateRand(MATE_IDLE_MS));
  }
  function mateDecide(){
    if(!mateMovable()) return;
    if(Math.random() < MATE_LEAVE_CHANCE){
      mate.leaving = true;
      mateWalk(MATE_ROOMS[mate.room].door());
    } else {
      mateWalk(matePickSpot(mate.room));
    }
  }
  function mateWalk(pt){
    mate.target = { x:pt.x, y:pt.y };
    kitchenSeoMate.classList.add('kitchen-is-walking');
    if(!mate.raf){ mate.last = null; mate.raf = requestAnimationFrame(mateStep); }
  }
  function mateStep(ts){
    mate.raf = null;
    if(!mate.target || !mateMovable()){ mateStopWalking(); return; }
    if(mate.last === null) mate.last = ts;
    var dt = Math.min(0.1, (ts - mate.last) / 1000);  // 탭이 잠깐 가려졌다 돌아와도 순간이동하지 않게
    mate.last = ts;
    var dx = mate.target.x - mate.x, dy = mate.target.y - mate.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var moveStep = MATE_SPEED * dt;
    var arrived = dist <= Math.max(moveStep, 0.15);
    if(arrived){
      mate.x = mate.target.x; mate.y = mate.target.y;
    } else {
      if(Math.abs(dx) > Math.abs(dy)) mateFace(dx < 0 ? 'left' : 'right');
      else mateFace(dy < 0 ? 'back' : 'front');
      var r = resolveMove(mate.x, mate.y, dx, dy, dist, moveStep);
      var stuck = moveStep > 0.01 && Math.abs(r.x - mate.x) < 0.0001 && Math.abs(r.y - mate.y) < 0.0001;
      mate.x = r.x; mate.y = r.y;
      if(stuck) arrived = true;  // 가구에 막히면 그 자리에서 멈춘다
    }
    mateRender();
    if(arrived){
      mateStopWalking();
      if(mate.leaving) mateLeaveRoom(); else mateIdle();
      return;
    }
    mate.raf = requestAnimationFrame(mateStep);
  }
  // 문까지 걸어간 뒤 사라져서 다른 방으로 간다.
  function mateLeaveRoom(){
    if(ONE_ROOM[activeMateType]){ mate.leaving = false; mate.goingLiving = false; return; } // 한방판: 거실로 가지 않는다
    mate.leaving = false;
    mate.goingLiving = false;
    mate.room = 'livingroom';
    mate.x = SEO_MATE_POS_LIVING.x; mate.y = SEO_MATE_POS_LIVING.y;
    mateFace('front');
    mateRender();  // 지금 보고 있는 방이 아니므로 서서히 사라지고, 거실에선 그 자리에 서 있다
  }
  var seoLeaveRaf = null;
  function seoLeaveCancel(){ if(seoLeaveRaf){ cancelAnimationFrame(seoLeaveRaf); seoLeaveRaf = null; } kitchenSeoMate.style.opacity = ''; kitchenSeoMate.style.transition = ''; kitchenSeoMate.classList.remove('kitchen-is-walking'); }
  // 다른 방(화면 밖)에 있던 메이트가 시간이 지나 반대쪽 방으로 넘어간다.
  function mateOffscreenTick(){
    if(!mate.active || mateVisible()) return;
    mateEnterRoom(MATE_OTHER_ROOM[mate.room]);
  }
  function mateEnterRoom(room){
    mate.room = room;
    if(room === currentRoom){
      var door = MATE_ROOMS[room].door();
      mate.x = door.x; mate.y = door.y;
      mateRender();  // 문 앞에서 서서히 나타나서
      mateWalk(matePickSpot(room));  // 안쪽으로 걸어 들어온다
    } else {
      mateRender();
      mateSchedule(mateOffscreenTick, mateRand(MATE_AWAY_MS));
    }
  }
  // 관람객이 방을 옮겼을 때: 메이트가 그 방에 있었다면 어딘가에 서 있는 채로 보여주고,
  // 아니면 숨긴 채 잠시 뒤 문으로 들어오게 한다.
  function mateOnRoomChanged(){
    if(!mate.active) return;
    var wasLeaving = mate.leaving;
    clearTimeout(mate.timer);
    mateStopWalking();
    mate.leaving = false;
    // 방이 바뀔 땐 서서히 사라지기(.45초) 없이 바로 숨기고/보인다 - 안 그러면 이전 방의 메이트가 새 방 화면에 잔상으로 남았다
    kitchenSeoMate.style.transition = 'none';
    if(wasLeaving || mate.goingLiving){ seoLeaveCancel(); kitchenSeoMate.style.transition = 'none'; kitchenMateBubble.classList.remove('show'); mateLeaveRoom(); } // 거실로 걸어 나가던 중에 방을 옮기면 바로 거실 자리로 (작별 말풍선은 두고 간다)
    else { mate.hold = false; mateRender(); }
    void kitchenSeoMate.offsetWidth;
    kitchenSeoMate.style.transition = '';
  }

  // 말풍선 버튼을 누르면: 메이트는 그 자리에 멈춰 관람객 쪽을 보고, 관람객이 옆으로 걸어가면
  // 인사 대화창이 뜬다. 대화가 끝나면 메이트는 다시 돌아다닌다.
  function mateGreet(){
    if(!mateVisible() || mate.hold) return;
    mate.hold = true;
    mate.leaving = false;
    clearTimeout(mate.timer);
    mateStopWalking();
    var st = mateTalkStand(mate.x, mate.y); // 금전형과 같은 고정 자리 (MATE_TALK_OFFSET)
    var arrive = function(){
      mateFace(st.side < 0 ? 'left' : 'right');
      updatePlayerFacing(-st.side, 0); // 나도 메이트를 본다
      var release = function(){ mate.hold = false; mateFace('front'); };
      // 금전형과 같은 방식: 내가 한마디 → 메이트가 지금 진행 상황에 맞춰 다음 할 일로 이끈다
      var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      var t = withDailyTalk(seoMateTalkLines());
      showKitchenDialogue(me, [t.me], function(){ mateSpeak(mateDisplayName(), t.mate, release, t.mood); }, 'happy');
    };
    // 걸어가는 도중에 관람객이 다른 곳을 눌러 이동이 바뀌면, 메이트가 멈춘 채 굳지 않도록 풀어준다
    arrive.onCancel = function(){ mate.hold = false; mateIdle(); };
    moveTo(st.x, st.y, arrive);
  }
  // 금전형처럼 메이트 그림을 눌러도 대화 (머리 위 말풍선 버튼과 같은 동작)
  kitchenSeoMateSprite.style.pointerEvents = 'auto';
  kitchenSeoMateSprite.style.cursor = 'var(--cur-hand)';
  kitchenSeoMateSprite.addEventListener('click', function(e){
    if(kitchenDialogue.classList.contains('show')) return; // 대화 중이면 화면 클릭처럼 다음 줄로
    e.stopPropagation(); // 메이트 자리로 걸어가는 일반 이동은 막는다
    if(document.body.classList.contains('app-drawer-open')) return;
    mateGreet();
  });
  function mateSay(lines, onDone){ mateSpeak(mateDisplayName(), lines, onDone, 'happy'); } // 미션을 마친 뒤 반응 = 기쁨
  /* ---------- 메이트(서은민/서민호) 클릭 대사 - 진행 상황별 (금전형 mateTalkLines와 같은 형식) ----------
     미션(앱) 진행 중엔 서랍이 열려 룸이 잠기므로 메이트를 누를 수 없다 - 그래서 '진행 중' 상태는 없다. */
  function seoMateTalkLines(){
    if(activeMateType === 'H'){ // 감정형 - 순서대로: 미션1 채팅(전기세 안건 올리기) → 미션2 안건 확인 → 미션3 피드백
      if(emotionFbDone && emotionEndingDone) return {
        me: mateCallName() + ', 오늘 고마웠어요.',
        mate: ['저야말로요! 이렇게 마음을 나누니 집이 더 편안해졌어요.', '앞으로도 틈으로 서로 이야기하며 지내요.'], mood:'happy' };
      if(emotionEndingDone) return {
        me: '안 볼 땐 TV랑 전등 끄기로 해요!',
        mate: ['좋아요, 저도 신경 쓸게요.', '그러고 보니 같이 산 지 벌써 한 달이네요.\n서로 하고 싶었던 얘기가 있으면 편하게 해 줘요.'], mood:'happy' };
      if(emotionChatDone) return {
        me: mateCallName() + ', 전기세 안건 올려 뒀어요!',
        mate: ['고마워요. 제 생각도 안건에 댓글로 남겨둘게요.', '저는 빨래 개던 중이었어요.'], mood:'happy' };
      return {
        me: mateCallName() + ', 뭐 하고 계세요?',
        mate: ['전기세 고지서를 보고 있었어요.', '이번 달 전기세가 생각보다 많이 나와서 걱정이에요…\n채팅으로 얘기 좀 남겨 뒀어요.'], mood:'worry' };
    }
    if(!eunminMission1Done && !eunminMission2Done) return {
      me: mateCallName() + ', 뭐 하고 계세요?',
      mate: ['마침 설거지하려던 참이었어요.', '그런데 매번 누가 할지 애매하더라고요.\n규칙을 정해 두면 좋을 것 같아요.'], mood:'worry' };
    if(eunminMission1Done && !eunminMission2Done) return {
      me: '집안일 규칙 정해서 등록해뒀어요!',
      mate: [['happy', '규칙 봤어요! 저도 오늘부터 바로 지킬게요.'], ['happy', '저는 베란다 정리하던 중이었어요.']] };
    if(eunminMission2Done && !eunminMission1Done) return {
      me: '생활비 정산 요청 보냈어요!',
      mate: [['happy', '정산 요청 확인했어요. 제 몫은 바로 보낼게요!'], ['worry', '부엌 설거지는 오늘은 제가 할게요.\n앞으로 누가 언제 할지도 정해 두면 좋겠어요.']] };
    return {
      me: mateCallName() + ', 오늘 고마웠어요.',
      mate: ['저야말로요! 정해둔 대로 지키니까 마음이 편하네요.', '앞으로도 틈 앱으로 하나씩 맞춰가요!'], mood:'happy' };
  }
  function mateStart(){
    mate.active = true;
    mate.hold = false;
    mate.room = activeMateType === 'H' ? 'livingroom' : 'eunminkitchen'; // 감정형은 거실에만 있다
    var p = activeMateType === 'H' ? SEO_MATE_POS_EMOTION : SEO_MATE_POS_KITCHEN;
    mate.x = p.x; mate.y = p.y;
    mateFace('front');
    mateRender();
    mateIdle();
  }
  function mateStop(){
    seoLeaveCancel();
    mate.goingLiving = false;
    mate.active = false;
    mate.hold = false;
    mate.leaving = false;
    clearTimeout(mate.timer);
    mateStopWalking();
    kitchenSeoMate.classList.remove('show');
    kitchenBubbleIcon.classList.remove('mate-on');
  }
  // 방이 바뀌면 switchTo*Room()들이 body[data-kitchen-room]을 갱신하므로 그걸 지켜본다.
  new MutationObserver(function(){ mateOnRoomChanged(); })
    .observe(document.body, { attributes:true, attributeFilter:['data-kitchen-room'] });
  window.addEventListener('kitchen:set-mate-type', function(e){
    if(e.detail && (e.detail.type === 'A' || e.detail.type === 'H')) mateStart(); else mateStop();
  });
  window.addEventListener('kitchen:set-gender', function(){ mateFace(mate.facing || 'front'); });
  window.addEventListener('kitchen:mission-reset', mateStop);

  // "처음부터 다시"로 전체 시나리오가 리셋되면 서은민 부엌/거실 상태도 함께 되돌린다.
  window.addEventListener('kitchen:mission-reset', function(){
    eunminMission1Done = false;
    eunminMission2Done = false;
    eunminEndingDone = false;
    eunminTaskBusy = false;
    eunminMessDone = { dish:false, recycle:false };
    eunminPaperChecked = false;
    kitchenSinkIcon.style.display = '';
    kitchenBinsIcon.style.display = '';
    kitchenPaperIcon.style.display = kitchenANotice.style.display = '';
    if(activeMateType === 'A') switchToEunminKitchenRoom();
  });

  /* =========================================================
     4-2. 세 번째 미션 — 다용도실 세탁물 공동 구독
     냉장고 미션(4번)과 완전히 같은 구조: 세탁물 더미의 상태이상 아이콘을 클릭하면
     캐릭터가 걸어가서 짧은 혼잣말 대화창이 뜨고, 대화가 끝나면 신호(kitchen:laundry-checked)를
     보내 첫 번째 <script> 블록이 앱 화면에서 [생활빨래 정기권] -> [생활빨래 단체권]
     순서로 안내 투어를 시작한다.
     ========================================================= */
  var laundryChecked = false;
  var laundryResolved = false;

  // 빨래더미 자체를 눌러도 세탁물 핀을 누른 것과 같다 (냉장고 미션을 마친 뒤에만 - CSS로 눌림 여부 제어)
  // 끝낸 미션 물건을 다시 누르면 한마디 (규칙형 EUNMIN_REVISIT·금전형 냉장고·빨래(laundryRevisitTarget)와 같은 틀) - 감정형 TV·책상이 쓴다
  function revisitSay(pt, line, faceEl){
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    moveTo(pt.left, pt.top, function(){ if(faceEl) faceToward(faceEl); showKitchenDialogue(me, [line], null, 'happy'); });
  }
  kitchenLaundryImg.addEventListener('click', function(e){
    if(kitchenDialogue.classList.contains('show') || laundryChecked) return;
    e.stopPropagation();
    kitchenLaundryIcon.click();
  });
  kitchenLaundryIcon.addEventListener('click', function(e){
    e.stopPropagation();
    if(laundryChecked) return;
    moveTo(state.utility.laundryPoint.left, state.utility.laundryPoint.top, function(){
      faceLaundry();
      laundryChecked = true;
      kitchenLaundryIcon.style.display = 'none';
      // 냉장고 미션 때와 마찬가지로, 이 대화창은 메이트가 아니라 관람객 아바타(사용자 이름)의 혼잣말이다.
      var visitorDisplayName = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      showKitchenDialogue(visitorDisplayName, [
        '요즘 계속 밤늦게 들어오다 보니 빨래가 이만큼 쌓였네…',
        '밤에 세탁기를 돌리면 시끄러울까 봐 돌리기도 힘들고, 집안일할 시간도 없어.',
        '세탁 구독권을 신청하고 비용은 ' + mateCallName() + '이랑 나눠 볼까?'
      ], function(){
        // 세탁물을 확인했다는 신호를 메인 앱(틈 앱) 쪽에 전달해서
        // [생활빨래 정기권] 안내 투어를 시작시킨다.
        window.dispatchEvent(new CustomEvent('kitchen:laundry-checked'));
      }, 'sad');
    });
  });

  // 도착 지점이 어디든 빨래 더미(바구니) 쪽을 본다 - 그림 가운데보다 조금 아래(바구니 몸통, 캔버스 768x808)
  function faceLaundry(){
    var l = state.utility.laundry;
    updatePlayerFacing((l.left + l.width / 2 - playerPos.x) * SCENE_ASPECT, l.top + l.width * SCENE_ASPECT * 808 / 768 * 0.6 - playerPos.y);
  }

  // 메인 앱(폰 화면) 쪽에서 [생활빨래 단체권] 공동 구독 신청이 완료되면(kitchen:laundry-resolved)
  // 지저분한 빨래더미 대신 빨래 바구니 + 개킨 옷더미로 바꾼다 (냉장고가 다시 채워지는 것과 같은 연출).
  window.addEventListener('kitchen:laundry-resolved', function(){
    laundryResolved = true;
    kitchenScene.classList.add('kitchen-laundry-resolved');
  });

  // "처음부터 다시" 등으로 전체 시나리오가 리셋되면 세탁물 상태도 함께 되돌린다.
  window.addEventListener('kitchen:mission-reset', function(){
    laundryChecked = false;
    laundryResolved = false;
    kitchenLaundryIcon.style.display = '';
    kitchenScene.classList.remove('kitchen-laundry-resolved');
    eunjiEndingActive = false;
    eunjiEndingDone = false;
  });

  // 세탁물 미션을 마친 뒤 빨래감(바구니·개킨 옷)을 누르면, 냉장고처럼 다가가서 혼잣말을 한다.
  // 한방판: 금전형 방이 부엌 그림(세탁기 없음)이라 세탁 맡긴 이야기도 빨래감을 누르면 같이 한다
  function laundryRevisitTarget(e){
    if(!laundryResolved || currentRoom !== 'utility' || kitchenDialogue.classList.contains('show')) return null;
    var hit = function(img){
      var m = walkMaskOf(img), r = img.getBoundingClientRect();
      return m && r.width && e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom &&
        maskAt(m, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    return hit(kitchenLaundryBasketImg) || hit(kitchenLaundryClothesImg) ? 'clothes' : null;
  }
  kitchenScene.addEventListener('click', function(e){ // 장면 클릭(그 자리로 걷기)보다 먼저 받는다
    if(!laundryRevisitTarget(e)) return;
    e.stopPropagation();
    var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
    var p = state.utility.laundryPoint; // 빨래감 바로 앞 자리
    moveTo(p.left, p.top, function(){
      faceLaundry();
      showKitchenDialogue(me, ['세탁을 맡기니 빨래 걱정이 없네.'], null, 'happy');
    });
  }, true);
  kitchenScene.addEventListener('mousemove', function(e){
    if(laundryRevisitTarget(e)) kitchenScene.style.cursor = 'var(--cur-hand)';
  });


  /* =========================================================
     4-3. 금전형 마지막 미션 상태 (안건 댓글 확인 → 하루 마무리, finishEunjiEnding)
     ========================================================= */
  var eunjiEndingActive = false;
  var eunjiEndingDone = false;

  /* ---- 오늘의 미션 카드: 유형별 미션 목록과 완료 여부 (금전형·규칙형만, 게임 시작 후) ----
     ponytail: 0.4초마다 상태를 읽어 바뀌었을 때만 다시 그린다 - 미션 완료 지점마다 호출을 심는 대신 */
  var missionCard = document.getElementById('missionCard');
  var missionCardKey = '';
  function missionItems(){
    if(activeMateType === 'S') return [
      { label:'냉장고 채우기', done: fridgeResolved },
      { label:'빨래 정리하기', done: laundryResolved },
      { label:'안건 댓글 확인하기', done: eunjiEndingDone }
    ];
    if(activeMateType === 'A') return [
      { label:'집안일 규칙 정하기', done: eunminMission1Done },
      { label:'생활비 정산하기', done: eunminMission2Done },
      { label:'새 규칙 투표하기', done: eunminEndingDone }
    ];
    if(activeMateType === 'H') return [
      { label:'전기세 안건 올리기', done: emotionChatDone },
      { label:'전기세 안건 확인하기', done: emotionEndingDone },
      { label:'피드백 주고받기', done: emotionFbDone }
    ];
    return null;
  }
  function missionHintText(){
    var inApp = document.getElementById('cohabitLeftDim').classList.contains('lock'); // 오른쪽 앱으로 미션 진행 중
    var room = currentRoom;
    if(activeMateType === 'S'){
      // 냉장고·빨래는 순서 상관없이: 앱 중이면 지금 하는 쪽, 아니면 지금 방에서 할 수 있는 쪽 → 남은 쪽이 있는 방
      if(inApp && fridgeChecked && !fridgeResolved) return '앱에서 반찬가게를 찾아보자!';
      if(inApp && laundryChecked && !laundryResolved) return '앱에서 세탁소를 찾아보자!';
      if(!fridgeResolved && !laundryResolved) return '냉장고나 빨래 더미를 확인해보자!';
      if(inRoom('kitchen') && !fridgeResolved) return '냉장고를 확인해보자!';
      if(inRoom('utility') && !laundryResolved) return '빨래 더미를 확인해보자!';
      if(!fridgeResolved) return '냉장고를 확인해보자!'; // 한방판: 방이 하나라 '…로 가보자'는 안 씀
      if(!laundryResolved) return '빨래 더미를 확인해보자!';
      if(!eunjiEndingDone) return agendaHint(inApp);
      return '오늘의 미션을 모두 마쳤어요!';
    }
    if(activeMateType === 'A'){
      // 금전·감정형처럼 순서 상관없이 (예전엔 규칙 → 정산 순서를 가정해서, 정산을 먼저 하면 거실에서 '부엌으로 가보자!',
      // 정산 앱 중에 '집안일 규칙을 정해보자!'가 떴다)
      if(inApp && agendaPhase === 2) return agendaHint(inApp);
      if(inApp) return (eunminPaperChecked && !eunminMission2Done) ? '앱에서 생활비를 정산해보자!' : '앱에서 집안일 규칙을 정해보자!';
      if(!eunminMission1Done && !eunminMission2Done) return '싱크대·쓰레기통이나 식탁 위 고지서를 확인해보자!';
      if(!eunminMission1Done && inRoom('eunminkitchen')) return '싱크대와 쓰레기통을 확인해보자!';
      if(!eunminMission2Done && inRoom('livingroom')) return '식탁 위 고지서를 확인해보자!';
      if(!eunminMission1Done) return '싱크대와 쓰레기통을 확인해보자!';
      if(!eunminMission2Done) return '식탁 위 고지서를 확인해보자!';
      if(!eunminEndingDone) return agendaHint(inApp);
      return '오늘의 미션을 모두 마쳤어요!';
    }
    if(activeMateType === 'H'){
      if(inApp && agendaPhase === 2) return agendaHint(inApp);
      if(inApp) return emotionFbBusy ? '앱에서 피드백을 주고받아보자!' : '앱에서 메이트와 채팅해보자!';
      if(!emotionChatDone) return emotionFbDone ? '켜져 있는 TV를 확인해보자!' : '켜져 있는 TV나 책상 위를 확인해보자!';
      if(!emotionEndingDone) return agendaHint(inApp);
      if(!emotionFbDone) return '책상 위를 확인해보자!';
      return '오늘의 미션을 모두 마쳤어요!';
    }
    return '';
  }
  var missionHint = document.getElementById('missionHint'), missionHintEl = document.getElementById('missionHintText');
  setInterval(function(){
    var t = missionCard.classList.contains('show') ? missionHintText() : '';
    if(missionHintEl.dataset.text !== t){ missionHintEl.dataset.text = t; missionHintEl.innerHTML = window.teumWrap(t); window.teumBalance(missionHintEl); }
    missionHint.classList.toggle('has', !!t);
  }, 400);

  var missionCardOpenTimer = null;
  function renderMissionCard(){
    var items = kitchenScene.classList.contains('game-started') ? missionItems() : null;
    var key = items ? activeMateType + items.map(function(i){ return (i.done ? 1 : 0) + (i.hidden ? 'h' : ''); }).join('') : '';
    if(key === missionCardKey) return;
    missionCardKey = key;
    // 세 미션을 다 끝내면 더 말을 걸 수 없으니 메이트 머리 위 '…' 버튼을 숨긴다 (game.html .all-missions-done)
    kitchenScene.classList.toggle('all-missions-done', !!items && items.every(function(i){ return i.done; }));
    // v.8 금전형과 같은 모션: 접힌 카드가 나타난 뒤(.show) 0.3초 뒤 펼친다(.open)
    missionCard.classList.toggle('show', !!items);
    clearTimeout(missionCardOpenTimer);
    if(!items){ missionCard.classList.remove('open'); return; }
    if(!missionCard.classList.contains('open')) missionCardOpenTimer = setTimeout(function(){ missionCard.classList.add('open'); }, 300);
    // 끝낸 미션은 위로, 남은 미션은 아래로 (같은 쪽끼리는 원래 순서 - sort는 안정 정렬)
    document.getElementById('missionCardList').innerHTML = items.filter(function(i){return !i.hidden;}).sort(function(a, b){ return b.done - a.done; }).map(function(i){
      return '<li' + (i.done ? ' class="done"' : '') + '>' + i.label + '</li>';
    }).join('');
    var done = items.filter(function(i){ return i.done; }).length, rate = Math.round(done / items.length * 100);
    document.getElementById('missionCardRate').textContent = rate + '%';
    document.getElementById('missionCardBar').style.width = rate + '%';
  }
  setInterval(renderMissionCard, 400);
  // 유형이 바뀌거나 게임이 (다시) 시작되는 순간엔 기다리지 않고 바로 다시 그린다 - 0.4초 주기만 기다리면 유형 탭으로 바꾼 뒤
  // 화면이 다 나타난 다음에야 이전 유형 카드가 새 카드로 뚝 바뀌었다
  window.addEventListener('kitchen:set-mate-type', renderMissionCard);
  new MutationObserver(renderMissionCard).observe(kitchenScene, { attributes:true, attributeFilter:['class'] });

  // 강은지(S)는 관람객이 남성을 선택했을 때 이름이 강지혁으로 바뀐다(첫 번째 <script>
  // 블록의 CHARACTERS/표시 로직과 같은 규칙 - 여기서는 이미 추적 중인 visitorGender로 판단).
  function eunjiDisplayName(){
    return (visitorGender === 'male') ? '강지혁' : '강은지';
  }

  // 마지막 미션 마무리: ① 폭죽 + 미션 카드가 100%로 차는 걸 잠깐 보여 주고 ② 하루를 정리하는 대사를 주고받은 뒤
  // ③ 게임 화면이 저녁 빛으로 물들며 '틈새살이 첫날 완료' → 평가 창. (예전엔 마지막 대사 뒤 바로 평가 창이 떠서 급작스러웠다)
  var dayEndOverlay = document.getElementById('dayEndOverlay'), dayEndTimers = [];
  function finishEunjiEnding(){
    eunjiEndingActive = false;
    eunjiEndingDone = true; // 미션 카드가 0.4초 안에 체크·100%로 바뀐다
    celebrateBurst();
    dayEndTimers.push(setTimeout(function(){
      var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      mateSpeak(eunjiDisplayName(), ['오늘 하루, 하나씩 맞춰가서 정말 좋았어요.'], function(){
        showKitchenDialogue(me, ['저도요! 앞으로도 잘 부탁해요.'], showDayEnd, 'happy');
      }, 'happy');
    }, 2000));
  }
  function showDayEnd(){
    dayEndOverlay.classList.add('show');
    dayEndTimers.push(setTimeout(startGameEnding, 1700)); // 저녁 빛(1.2초)이 다 나타나고 문구를 잠깐 본 뒤 - 4.2초 → 2.6초 → 1.7초로 줄임
  }
  /* ---- 세 번째 미션: 메이트가 올린 새 안건 (세 유형 공통 - 예전 '메이트와 이야기하기' 선택지 대화를 대신한다) ----
     두 미션을 마치면 게임 화면 오른쪽 위에 틈 안건 알림 + 메이트 메시지 알림 → 누르면 폰(app_4)에서 안건 가이드
     (app-tablet.js agendaSteps) → kitchen:agenda-done → 유형별 마무리(폭죽 → 하루 정리 대사 → '함께 맞춰 간 첫날' → 평가 창)
     agendaPhase: 0 아직 / 1 알림이 와 있음 / 2 앱에서 안건 진행 중 */
  var agendaPhase = 0, agendaTimers = [];
  var agendaNoti = document.createElement('div');
  agendaNoti.className = 'agenda-noti'; agendaNoti.hidden = true;
  agendaNoti.setAttribute('role', 'status'); agendaNoti.setAttribute('aria-live', 'polite');
  document.querySelector('.cohabit-body').appendChild(agendaNoti);
  // 틈 앱 아이콘 (흰 둥근 사각형 안 초록 클로버 - 알림 시안)
  var TEUM_ICON = '<svg viewBox="47 46.5 35 35" aria-hidden="true"><path d="M77.7842 50.1913C74.0661 46.4617 68.0274 46.4526 64.2934 50.1596C60.5595 46.4549 54.5207 46.464 50.8026 50.1913C47.0982 53.9074 47.0687 59.888 50.7051 63.6448C47.0687 67.4016 47.0959 73.3844 50.8026 77.0982C54.5207 80.8279 60.5595 80.8369 64.2934 77.1299C68.0274 80.8347 74.0661 80.8256 77.7842 77.0982C81.4887 73.3822 81.5182 67.4016 77.8818 63.6448C81.5182 59.888 81.491 53.9051 77.7842 50.1913Z" fill="#537954"/><path d="M67.9069 67.2535C69.9029 65.2611 69.9029 62.0307 67.9069 60.0383C65.911 58.0458 62.6749 58.0458 60.679 60.0383C58.683 62.0307 58.683 65.2611 60.679 67.2535C62.6749 69.2459 65.911 69.2459 67.9069 67.2535Z" fill="#A6C673"/></svg>';
  var NOTI_CHEVRON = '<svg viewBox="0 0 16 9.5" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.651 0.342C15.186-0.114 14.431-0.114 13.966 0.342L8 6.183L2.034 0.342C1.569-0.114 0.814-0.114 0.349 0.342C-0.116 0.797-0.116 1.536 0.349 1.992L7.157 8.658C7.623 9.114 8.377 9.114 8.843 8.658L15.651 1.992C16.116 1.536 16.116 0.797 15.651 0.342Z" fill="#A1A1A1"/></svg>';
  function agendaDue(){
    return activeMateType === 'S' ? fridgeResolved && laundryResolved && !eunjiEndingDone
         : activeMateType === 'A' ? eunminMission1Done && eunminMission2Done && !eunminEndingDone
         : activeMateType === 'H' ? emotionChatDone && !emotionEndingDone : false; // 감정형은 채팅(미션1) 뒤 바로 두 번째 미션
  }
  function agendaHint(inApp){
    if(activeMateType === 'A') return inApp ? '앱에서 새 규칙에 투표해보자!' : '알림을 눌러 새 규칙에 투표해보자!'; // 규칙형은 메이트가 올린 새 규칙 투표
    var what = '안건 댓글을'; // 금전형·감정형 모두 내가 올린 안건에 메이트가 댓글
    return inApp ? '앱에서 ' + what + ' 확인해보자!' : '알림을 눌러 ' + what + ' 확인해보자!';
  }
  // 알림 시안: 틈 아이콘 | 틈 · 시각 / 굵은 한 줄 (펼치면 아래 설명) | 펼침 화살표. 카드를 누르면 앱, 화살표는 펼치기·접기
  function agendaNotiCard(title, text, open){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'agenda-noti-card pulse' + (open ? ' open' : '');
    b.innerHTML = '<span class="agenda-noti-icon">' + TEUM_ICON + '</span><span class="agenda-noti-body">'
      + '<span class="agenda-noti-head"><b>틈</b><time></time></span><strong class="agenda-noti-title"></strong>'
      + '<span class="agenda-noti-text"></span></span><span class="agenda-noti-fold" role="button" aria-label="알림 펼치기">' + NOTI_CHEVRON + '</span>';
    b.querySelector('time').textContent = new Date().toLocaleTimeString('ko-KR', { hour:'numeric', minute:'2-digit' });
    b.querySelector('.agenda-noti-title').textContent = title;
    var t = b.querySelector('.agenda-noti-text');
    t.innerHTML = window.teumWrap(text); // 줄바꿈 공통 규칙 (기호 뒤에서 먼저 바꾸고 줄 길이는 고르게)
    setTimeout(function(){ window.teumBalance(t); }, 0); // 화면에 붙은 뒤에 잰다
    b.querySelector('.agenda-noti-fold').addEventListener('click', function(e){ e.stopPropagation(); b.classList.toggle('open'); window.teumBalance(t); });
    b.addEventListener('click', function(e){ e.stopPropagation(); agendaOpenApp(); });
    return b;
  }
  var AGENDA_NOTI_DELAY = 300; // 두 미션을 마치고 대화가 끝난 뒤 새 안건 알림까지 (세 유형 공통, 예전 1.2초)
  function agendaBegin(){
    if(agendaPhase || !agendaDue()) return;
    agendaPhase = 1;
    var mate = (document.getElementById('cohabitMateName').textContent || '메이트').trim();
    var comment = window.TEUM_agendaComment ? window.TEUM_agendaComment(activeMateType) : ''; // 앱 안 메이트 댓글과 같은 문장
    if(activeMateType === 'S' || activeMateType === 'H'){ // 금전형·감정형: 내가 올린 안건(구독권·전기세)에 메이트가 댓글 - 알림 하나 (app-tablet.js AGENDA_CONTENT)
      agendaTimers.push(setTimeout(function(){
        agendaNoti.replaceChildren(agendaNotiCard(mate + '님이 내 안건에 댓글을 남겼어요!', comment, true));
        agendaNoti.hidden = false;
      }, AGENDA_NOTI_DELAY));
      return;
    }
    var vote = activeMateType === 'A'; // 규칙형: 메이트가 새 규칙(외부인 초대) 투표를 올림 (app-tablet.js AGENDA_CONTENT.A)
    agendaTimers.push(setTimeout(function(){
      agendaNoti.replaceChildren(vote ? agendaNotiCard('새로운 투표가 올라왔어요!', mate + '님이 \'외부인 초대 규칙\' 투표를 올렸어요.')
                                      : agendaNotiCard('새로운 안건이 등록됐어요!', mate + '님이 올린 안건을 눌러서 확인해보세요.'));
      agendaNoti.hidden = false;
    }, AGENDA_NOTI_DELAY));
    agendaTimers.push(setTimeout(function(){
      agendaNoti.appendChild(agendaNotiCard(mate + '님이 ' + (vote ? '투표' : '안건') + '에 댓글을 남겼어요!', comment, true));
    }, AGENDA_NOTI_DELAY + 500));
  }
  function agendaClose(){
    agendaTimers.forEach(clearTimeout); agendaTimers = [];
    agendaNoti.hidden = true;
    agendaNoti.replaceChildren();
  }
  function agendaOpenApp(){
    if(agendaPhase !== 1 || kitchenDialogue.classList.contains('show') || coachEl || document.body.classList.contains('app-drawer-open')) return;
    agendaPhase = 2;
    agendaClose();
    stopWalking();
    window.dispatchEvent(new CustomEvent('kitchen:agenda-open'));
  }
  window.addEventListener('kitchen:agenda-done', function(){
    if(agendaPhase !== 2) return;
    agendaPhase = 0;
    if(activeMateType === 'S') finishEunjiEnding();
    else if(activeMateType === 'A'){ eunminEndingDone = true; finishEunminDay(); }
    else { // 감정형: AI가 찾아 준 예전 약속대로 TV·전등을 끈다
      emotionEndingDone = true;
      setEmotionTvDone(true);
      if(!emotionFbDone) celebrateBurst(); // 다른 미션처럼 끝내면 폭죽 (마지막 미션이면 finishEunminDay가 터뜨린다)
      var me = (document.getElementById('cohabitVisitorName').textContent || '나').trim() || '나';
      showKitchenDialogue(me, ['맞다, 그때 약속했었지! 안 보는 TV랑 전등은 끄고 콘센트도 뽑아 두자.'], function(){
        if(emotionFbDone){ finishEunminDay(); return; } // 피드백을 먼저 했으면 이게 마지막 미션
        setEmotionFbReady(true); // 세 번째 미션 - 책상 위 피드백 핀 (처음부터 떠 있지만 이제 눌러서 시작)
        showPlayerBubble('전하고 싶은 마음, 피드백으로 써볼까?', HUNGER_BUBBLE_DURATION);
      }, 'happy');
    }
  });
  ['kitchen:mission-reset', 'kitchen:set-mate-type'].forEach(function(ev){
    window.addEventListener(ev, function(){ agendaPhase = 0; agendaClose(); });
  });
  // 헤더 유형 탭은 기본 상태에서만 누를 수 있다 (app-tablet.js switchMateType이 읽는다) - 대화창·시작 안내·미션 오브젝트로 가는 중·
  // 엔딩 대화부터 평가 창이 뜨기 전까지는 막는다. 끊기면 대화 뒤에 이어질 미션(이야기하기 등)이 사라져 엔딩까지 못 갔다
  window.TEUM_gameBusy = function(){
    var ending = (eunjiEndingDone || eunminEndingDone || (emotionFbDone && emotionEndingDone)) && !clearedTypes[activeMateType]; // 감정형은 피드백·안건 확인 순서가 자유라 둘 다 끝나야
    return kitchenDialogue.classList.contains('show') || !!coachEl || eunjiEndingActive || ending ||
      (eunminTaskBusy && !eunminMission1Done) || emotionTvBusy || emotionFbBusy;
  };
  window.addEventListener('kitchen:mission-reset', function(){
    dayEndTimers.forEach(clearTimeout); dayEndTimers = [];
    dayEndOverlay.classList.remove('show', 'quiet');
  });

  // Completion chat remains part of the design variant; S movement uses the shared fixed NPC.
  var eunji = {epoch:0,timer:null,hold:false};
  function eunjiReset(){eunji.epoch++;clearTimeout(eunji.timer);eunji.hold=false;}
  function eunjiAllDone(){return fridgeResolved && laundryResolved;}
  function eunjiInvite(){ agendaBegin(); } // 마지막 미션 → 메이트가 올린 새 안건 알림
  // 미션을 마치면: 내 혼잣말 한마디 → 첫 미션일 때만 메이트가 남은 미션을 한 번 귀띔하고 자기 일 하러 간다
  // (메이트에게 매번 보고하고 메이트가 매번 대답하던 것은 뺐다 - 이야기는 메이트 '…'를 눌렀을 때만)
  function eunjiComplete(kind){
    if(activeMateType!=='S') return;
    eunji.hold=true;stopWalking();
    var epoch=eunji.epoch;
    var visitor=(document.getElementById('cohabitVisitorName').textContent||'나').trim();
    var hint=eunjiAllDone()?'':kind==='fridge'?'세탁물도 많이 쌓여 있더라고요.\n그럼 저는 다른 일 하고 있을게요!':'냉장고도 텅 비어 있더라고요.\n그럼 저는 다른 일 하고 있을게요!';
    function finish(){
      if(epoch!==eunji.epoch) return;
      eunji.hold=false;
      if(kind==='fridge') window.dispatchEvent(new CustomEvent('kitchen:mission1-dialogue-done'));
      if(eunjiAllDone()) eunjiInvite(); // 세 번째 미션(새 안건 알림) - 규칙형·감정형처럼 말풍선 없이
    }
    clearTimeout(eunji.timer);
    // The drawer takes 450ms to close; read the result after the phone leaves.
    eunji.timer=setTimeout(function(){
      if(epoch!==eunji.epoch || activeMateType!=='S') return;
      var line=kind==='fridge'?'반찬 구독 신청 끝! 이제 냉장고가 든든하겠다.':'세탁 구독 신청 끝! 빨래 걱정은 덜었다.';
      showKitchenDialogue(visitor,[line],function(){
        if(hint) mateSpeak(eunjiDisplayName(),[['happy',hint]],finish); else finish();
      },'happy');
    },500);
  }
  window.addEventListener('kitchen:mission-reset',eunjiReset);
  window.addEventListener('kitchen:set-mate-type',eunjiReset);
})();
