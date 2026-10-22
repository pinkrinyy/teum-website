/* 문장 줄바꿈 공통 규칙 (대화창 formatDialogueHtml과 같은 방식):
   문장부호(. , ? ! … ~) 뒤와 글 속 줄바꿈(\n, <br>) 자리에서 덩어리로 나눈다 - \n은 '여기서 바꾸면 좋다'는 자리라
   칸이 넓어 한 줄에 들어가면 이어 붙고, 좁으면 그 자리에서 먼저 바뀐다(예전엔 \n을 펴 버려 '이번 ⏎ 주'처럼 엉뚱하게 잘렸다). 덩어리(.tw-seg)는 한 묶음이라
   줄은 덩어리 사이(기호 뒤)에서 먼저 바뀌고, 덩어리가 칸보다 길 때만 그 안에서 단어 단위로 바뀐다(keep-all).
   줄 길이는 CSS text-wrap:balance로 고르게 - 좁은 칸에서 한 단어만 남는 줄이 생기지 않게. <b> 같은 태그 안에서는 자르지 않는다. */
window.teumWrap = function(src, isHtml){
  var s = String(src == null ? '' : src);
  if(!isHtml) s = s.replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; });
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/\s*\n\s*/g, '\u0001').replace(/^\u0001+|\u0001+$/g, '').trim(); // \u0001 = 덩어리 경계(아래)
  // 짧은 묶음은 그 사이에서 줄을 바꾸지 않는다(띄어쓰기를 붙는 공백으로): [버튼 이름](안쪽 12자 이하 - 말풍선 한 줄 15자 안에 '[정기 반찬 단체 구독권]을'까지 들어간다)·'따옴표 말'(10자 이하),
  // 뒤 말을 꾸미는 짧은 말 + 다음 단어(이번 주·안 쓰는·미리 보기·지난 대화·한 달). 긴 버튼 이름은 칸보다 길 수 있어 그대로 둔다
  var NB = '\u00a0';
  s = s.replace(/<[^>]+>|[^<]+/g, function(tok){
    if(tok.charAt(0) === '<') return tok;
    return tok.replace(/\[[^\[\]]{1,12}\]|'[^']{1,10}'|‘[^’]{1,10}’/g, function(m){ return m.replace(/ /g, NB); })
              .replace(/(^|[\s\u00a0\u0001(\['‘])(이번|지난|다음|미리|안|잘|못|더|새|매|각|몇|한|모든|바로) (?=\S)/g, '$1$2' + NB);
  });
  // 괄호와 붙어 있는 글자는 떼지 않는다: '[정기 반찬 단체 구독권]을'이 ']' 뒤에서 '을'만 다음 줄로 넘어가던 것 (태그를 사이에 둬도)
  s = s.replace(/([\]\)』」’”])((?:<[^>]+>)*)(?=[^\s<,.!?…~])/g, '$1\u2060$2')
       .replace(/([^\s>])((?:<[^>]+>)*)([\[\(『「‘“])/g, '$1$2\u2060$3')
       .replace(/([^\s])·/g, '$1\u2060·'); // 가운뎃점(·)은 줄 맨 앞에 오지 않게 (앞 글자에 붙임)
  var segs = [], cur = '', depth = 0;
  (s.match(/<[^>]+>|[^<]+/g) || []).forEach(function(tok){
    if(tok.charAt(0) === '<'){ depth += tok.charAt(1) === '/' ? -1 : (/\/>$/.test(tok) ? 0 : 1); cur += tok; return; }
    var parts = tok.split(/([,.!?…~]+(?:\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)*(?:\s+|(?=\u0001))|\u0001)/u); // 기호 뒤 이모지(🎉)는 앞 문장에 붙인다
    parts.forEach(function(part, i){
      if(i % 2 === 1 && depth > 0){ cur += part.replace(/\u0001/g, ' '); return; } // 태그(<b>) 안에선 자르지 않는다
      cur += part.replace(/\u0001/g, '');
      if(i % 2 === 1 && cur.trim()){ segs.push(cur.trim()); cur = ''; }
    });
  });
  if(cur.trim()) segs.push(cur.trim());
  return '<span class="tw">' + segs.map(function(g){ return '<span class="tw-seg">' + g + '</span>'; }).join(' ') + '</span>';
};
/* 여러 줄이 된 덩어리는 줄 수를 그대로 둔 채 가장 좁은 폭으로 줄여 줄 길이를 고르게 한다
   (브라우저 text-wrap:balance가 '내가 낼 ⏎ 금액은 390,905원이에요.'처럼 고르지 않게 나누는 경우가 있어서) */
window.teumBalance = function(root){
  if(!root) return;
  var run = function(){
    Array.prototype.forEach.call(root.querySelectorAll('.tw-seg'), function(seg){
      seg.style.maxWidth = '';
      var lh = parseFloat(getComputedStyle(seg).lineHeight) || 20, h = seg.offsetHeight, w = seg.offsetWidth;
      if(!w || h < lh * 1.5) return; // 한 줄이면 그대로
      var lo = w * 0.4, hi = w;
      // 줄일 때 붙여 둔 묶음([버튼 이름]을 등)이 칸보다 길어지면 글자 중간에서 잘렸다 → 재는 동안엔 단어 중간 줄바꿈을 끄고,
      // 무언가 칸 밖으로 삐져나오면(scrollWidth) 너무 좁은 것으로 본다
      seg.style.overflowWrap = 'normal';
      for(var i = 0; i < 9; i++){
        var mid = (lo + hi) / 2;
        seg.style.maxWidth = mid + 'px';
        if(seg.offsetHeight > h || seg.scrollWidth > seg.clientWidth) lo = mid; else hi = mid;
      }
      seg.style.maxWidth = (Math.ceil(hi) + 2) + 'px'; // 딱 맞는 폭이면 1px 미만 차이로 묶음 중간에서 잘려서 2px 여유
      seg.style.overflowWrap = '';
    });
  };
  requestAnimationFrame(run);
  setTimeout(run, 350); // 말풍선이 나타나는 애니메이션(크기 변화)이 끝난 뒤 한 번 더
};
(function(){
  var CHARACTERS = {
    S:{
      emoji:'🐿️', name:'강은지', maleName:'강지혁', type:'26세 · 금전형 메이트',
      desc:'매일 왕복 출퇴근길에 지쳐가는 26세 사회초년생이에요. 자취를 꿈꾸지만 비싼 집값과 생활비가 부담스럽고, 마음 맞는 친구와 함께 살자니 괜히 사이가 서먹해질까 봐 망설이고 있어요. 회사 근처에 자리 잡은 분의 집에 합류해 비용 부담은 덜고, 감정 소모 없이 서로의 사생활을 존중해 줄 메이트를 찾고 있어요.'
    },
    A:{
      emoji:'💼', name:'서은민', maleName:'서민호', type:'32세 · 규칙형 메이트',
      desc:'5년차 직장인으로 안정적인 생활을 꾸려온 32세예요. 경제적으로 여유가 없는 편은 아니지만, 혼자 사는 사람을 노린 범죄 뉴스를 볼 때마다, 또 아플 때 곁에 아무도 없다는 사실에 밀려오는 고립감 때문에 마음 한구석이 늘 불안해요. 단순히 공간만 나누는 사이가 아니라, 위급한 순간엔 서로 믿고 의지할 수 있고 평소에도 다정하게 안부를 물어봐 줄 든든한 메이트를 찾고 있어요.'
    },
    H:{
      emoji:'☕', name:'김정희', maleName:'김석홍', type:'68세 · 감정형 메이트',
      desc:'따뜻한 동네 카페를 운영하는 자영업자예요. 자녀들은 모두 독립했고, 남편과는 사별한 뒤 혼자 지내고 있어요. 조용한 집에 들어설 때마다 밀려오는 적막함 대신, 서로의 독립적인 삶은 존중하면서도 다정하게 안부를 나눌 메이트를 기다리고 있어요.'
    }
  };
  // 코드 = 메이트 유형 + mate-test 6번 답(어떤 공간에서 시작할지) → 열 합의서(자동 시연판)
  //   giver: 지금 내 집에 메이트를 들임(임대인) / newhome: 새 집을 같이 찾음 / taker: 준비된 집에 합류(임차인)
  // mate-test(틈 화면/mate-test)의 CODES 표와 반드시 같이 바꿀 것.
  var GIVER = 'agreement/agreement_together_auto_giver.html';
  var NEWHOME = 'agreement/agreement_newhome_auto.html';
  var TAKER = 'agreement/agreement_together_auto_taker.html';
  // 코드표: 유형(금전 S / 규칙 A / 감정 H) × 합의서(합류=내가 임차인 / 들임=내가 임대인 / 찾음=같이 새집)
  //            합류      들임      찾음
  //  금전 S    7391      7392      7393
  //  규칙 A    2647      2648      2649
  //  감정 H    9522      9521      9520
  //  개발용    0001/0002/0003(합류)  0011/0022/0033(들임)  0111/0222/0333(찾음) - 끝자리=유형, 자릿수 개수=합의서
  // 실제 코드는 mate-test(틈 화면/mate-test/index.html)의 CODES와 같이 바꿀 것.
  var CODES = {
    '7391':{ type:'S', agreement:TAKER }, '7392':{ type:'S', agreement:GIVER }, '7393':{ type:'S', agreement:NEWHOME },
    '2647':{ type:'A', agreement:TAKER }, '2648':{ type:'A', agreement:GIVER }, '2649':{ type:'A', agreement:NEWHOME },
    '9522':{ type:'H', agreement:TAKER }, '9521':{ type:'H', agreement:GIVER }, '9520':{ type:'H', agreement:NEWHOME },
    // 개발 편의용 코드 (완성 후 지워도 됨)
    '0001':{ type:'S', agreement:TAKER }, '0011':{ type:'S', agreement:GIVER }, '0111':{ type:'S', agreement:NEWHOME },
    '0002':{ type:'A', agreement:TAKER }, '0022':{ type:'A', agreement:GIVER }, '0222':{ type:'A', agreement:NEWHOME },
    '0003':{ type:'H', agreement:TAKER }, '0033':{ type:'H', agreement:GIVER }, '0333':{ type:'H', agreement:NEWHOME }
  };
  // 금전형(S) 메이트 소개 - 합의서(6번 답)에 맞춰 3줄 안팎으로. 없는 유형은 CHARACTERS의 desc 그대로.
  var MATE_DESC_BY_AGREEMENT = { S:{} };
  MATE_DESC_BY_AGREEMENT.S[GIVER] = '매일 왕복 출퇴근길에 지친 26세 사회초년생이에요. 회사 근처 당신의 집에 합류해 비용 부담은 덜고, 서로의 사생활은 존중하고 싶어요.';
  MATE_DESC_BY_AGREEMENT.S[NEWHOME] = '비싼 집값이 부담스러운 26세 사회초년생이에요. 함께 새 집을 구해 비용은 반씩 나누고, 서로의 사생활은 존중하고 싶어요.';
  MATE_DESC_BY_AGREEMENT.S[TAKER] = '회사 근처에 집을 구해 둔 26세 사회초년생이에요. 혼자 감당하기 버거운 월세와 생활비를 나누며, 서로의 사생활은 존중하고 싶어요.';
  // 규칙형(A) 서은민/서민호 소개 - 금전형과 같은 형식
  MATE_DESC_BY_AGREEMENT.A = {};
  MATE_DESC_BY_AGREEMENT.A[GIVER] = '안정적인 생활을 꾸려온 32세 5년차 직장인이에요. 혼자 사는 불안함을 덜고 싶어 당신의 집에 합류해, 서로 믿고 의지하며 생활 규칙도 함께 지켜가고 싶어요.';
  MATE_DESC_BY_AGREEMENT.A[NEWHOME] = '안정적인 생활을 꾸려온 32세 5년차 직장인이에요. 함께 새 집을 구해 서로 믿고 의지하며, 집안일과 생활 규칙은 함께 정해 지켜가고 싶어요.';
  MATE_DESC_BY_AGREEMENT.A[TAKER] = '회사 근처 집에서 혼자 지내 온 32세 5년차 직장인이에요. 혼자 사는 불안함을 덜고, 서로 믿고 의지하며 생활 규칙도 함께 지켜갈 메이트를 찾고 있어요.';
  // 감정형(H) 김정희/김석홍 소개 - 같은 형식
  MATE_DESC_BY_AGREEMENT.H = {};
  MATE_DESC_BY_AGREEMENT.H[GIVER] = '동네에서 작은 카페를 운영하는 68세예요. 혼자 지내는 적막함을 덜고 싶어 당신의 집에 합류해, 서로의 생활은 존중하며 다정한 안부를 나누고 싶어요.';
  MATE_DESC_BY_AGREEMENT.H[NEWHOME] = '동네에서 작은 카페를 운영하는 68세예요. 함께 새 집을 구해 서로의 독립적인 삶은 존중하면서도, 다정하게 안부를 나누며 지내고 싶어요.';
  MATE_DESC_BY_AGREEMENT.H[TAKER] = '동네에서 작은 카페를 운영하는 68세예요. 자녀들이 독립한 뒤 집이 적적했는데, 함께 지내며 서로의 생활은 존중하고 따뜻한 안부를 나누고 싶어요.';
  // 매칭 화면·합의서를 거쳐 게임으로 들어가는 유형과 그 메이트 전신 그림 (사용자와 같은 성별) - 세 유형 모두
  var MATE_FULL_IMG = {
    S:{ female:'object/profile/mate1_woman.png', male:'object/profile/mate1_man.png' },
    A:{ female:'object/profile/mate2_woman.png', male:'object/profile/mate2_man.png' },
    H:{ female:'object/profile/mate3_woman.png', male:'object/profile/mate3_man.png' }
  };
  function isMatchType(type){ return !!MATE_FULL_IMG[type]; }
  var currentMateName = '';
  var currentMateType = '';

  var boxes = [
    document.getElementById('otp0'),
    document.getElementById('otp1'),
    document.getElementById('otp2'),
    document.getElementById('otp3')
  ];
  var otpRow = document.getElementById('otpRow');
  var errorMsg = document.getElementById('errorMsg');
  var codePanel = document.getElementById('codePanel');
  var genderNamePanel = document.getElementById('genderNamePanel');
  var revealPanel = document.getElementById('revealPanel');
  var visitorNameInput = document.getElementById('visitorName');
  var nameGenderNextBtn = document.getElementById('nameGenderNextBtn');
  var startCohabitBtn = document.getElementById('startCohabitBtn');
  var stageWrap = document.getElementById('stageWrap');
  var cohabitView = document.getElementById('cohabitView');
  var cohabitLeftDim = document.getElementById('cohabitLeftDim');
  var pendingMateType = ''; // 코드 확인 직후 ~ 프로필 소개 전까지 임시로 들고 있는 메이트 타입
  var selectedGender = null; // 'female' | 'male' | null(미선택) - 현재는 시각 자산이 성별별로
                              // 구분돼 있지 않아 캐릭터 그림에는 반영되지 않고, 프로필 값으로만 쓰인다.
  var genderButtons = Array.prototype.slice.call(document.querySelectorAll('.gender-btn'));

  boxes.forEach(function(box, i){
    box.addEventListener('input', function(){
      box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
      errorMsg.classList.remove('show');
      if(box.value && i < boxes.length - 1){
        boxes[i + 1].focus();
      }
    });
    box.addEventListener('keydown', function(e){
      if(e.key === 'Backspace' && !box.value && i > 0){
        boxes[i - 1].focus();
      }
    });
  });

  // 터치 기기(폰·태블릿)는 자동 포커스를 하지 않는다 - 누르지도 않았는데 키보드가 올라와 화면을 덮는다. 칸을 누르면 그때 뜬다
  var AUTO_FOCUS = !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if(AUTO_FOCUS) boxes[0].focus();

  function checkCode(){
    var entered = boxes.map(function(b){ return b.value; }).join('');
    if(entered.length < 4){
      showError();
      return;
    }
    var matched = CODES[entered] && CODES[entered].type;
    if(!matched){
      showError();
      return;
    }
    // 코드가 맞아도 메이트 프로필은 아직 보여주지 않는다 - 성별/이름 입력을 먼저 받고,
    // 그 다음 화면에서 프로필을 공개한다 (revealCharacter는 그때 호출).
    pendingMateType = matched;
    window.teumCode = entered; // 설문 기록에 남긴다 (0으로 시작하면 테스트용 코드 - 설문결과.html에서 골라 지울 수 있게)
    AGREEMENT_SRC = CODES[entered].agreement;
    codePanel.classList.add('hide');
    genderNamePanel.classList.add('show');
    if(AUTO_FOCUS) visitorNameInput.focus();
  }

  function showError(){
    errorMsg.classList.add('show');
    otpRow.classList.remove('shake');
    void otpRow.offsetWidth;
    otpRow.classList.add('shake');
  }

  function revealCharacter(type){
    var c = CHARACTERS[type];
    // 관람객이 남성을 선택하면 메이트 이름도 남성 이름(maleName)으로 바꿔서 보여준다
    // (강은지→강지혁, 서은민→서민호, 김정희→김석홍).
    var displayName = (selectedGender === 'male') ? c.maleName : c.name;
    document.getElementById('revealEmoji').textContent = c.emoji;
    document.getElementById('revealName').textContent = displayName;
    document.getElementById('revealType').textContent = c.type;
    var agreementDesc = MATE_DESC_BY_AGREEMENT[type] && MATE_DESC_BY_AGREEMENT[type][AGREEMENT_SRC];
    if(agreementDesc){
      // "저는 강지혁이에요. / 강은지예요." 로 시작해서 "잘 부탁드려요." 로 끝낸다 (받침 유무로 이에요/예요)
      var hasBatchim = (displayName.charCodeAt(displayName.length - 1) - 0xAC00) % 28 > 0;
      agreementDesc = '저는 ' + displayName + (hasBatchim ? '이에요. ' : '예요. ') + agreementDesc + ' 잘 부탁드려요.';
    }
    // 줄바꿈은 , . 같은 기호 뒤에서 나도록 기호 단위 덩어리(inline-block)로 넣는다 -
    // 한 줄에 다 안 들어가는 덩어리만 다음 줄로 넘어가고, 너무 긴 덩어리는 안에서 단어 단위로 접힌다.
    var revealDescEl = document.getElementById('revealDesc');
    revealDescEl.textContent = '';
    ((agreementDesc || c.desc).match(/[^.,!?]+[.,!?]*\s*/g) || []).forEach(function(seg){
      var span = document.createElement('span');
      span.className = 'desc-seg';
      span.textContent = seg;
      revealDescEl.appendChild(span);
      revealDescEl.appendChild(document.createTextNode(' '));
    });
    document.getElementById('cohabitMateName').textContent = displayName;
    document.getElementById('mateAvatarBadge').textContent = c.emoji;
    document.getElementById('mateAvatarName').textContent = displayName;
    currentMateName = displayName;
    currentMateType = type;
    // 금전형·규칙형(isMatchType): 메이트 프로필 화면 우측에 성별에 맞는 메이트 전신을 띄운다 (내 캐릭터 미리보기와 같은 연출)
    var isMatch = isMatchType(type);
    var matePreview = document.getElementById('matePreview');
    matePreview.classList.toggle('right', isMatch);
    // '다음'을 누르면 이 화면에서 합의서부터 쓴다 (게임 화면은 서명 후)
    startCohabitBtn.textContent = isMatch ? '다음 →' : '동거 시작하기 →';
    // 가운데: 나 ♥ 메이트 정보 카드
    document.getElementById('revealPanel').classList.toggle('is-match', isMatch);
    var myName = visitorNameInput.value.trim();
    document.getElementById('resMeBadge').textContent = myName.charAt(0);
    document.getElementById('resMeName').textContent = myName;
    document.getElementById('resMateBadge').textContent = c.emoji;
    document.getElementById('resMateName').textContent = displayName;
    // 왼쪽에는 내 캐릭터(성별 선택 화면과 같은 그림)
    document.getElementById('myPreview').classList.toggle('left', isMatch);
    if(isMatch){
      document.getElementById('myPreviewImg').src = (selectedGender === 'male') ? 'object/profile/avata_man.png' : 'object/profile/avata_woman.png';
      document.getElementById('matePreviewImg').src = MATE_FULL_IMG[type][selectedGender === 'male' ? 'male' : 'female'];
    }
    // 아이소메트릭 미니게임은 강은지(S)의 냉장고/세탁물 미션과 서은민(A)의 가사규칙/정산
    // 미션 둘 다에서 쓰인다 - 나머지 메이트(H)는 아직 미니게임이 없다.
    document.getElementById('cohabit-game-container').classList.toggle('kitchen-active', type === 'S' || type === 'A' || type === 'H');
    // 아이소메트릭 스크립트(다른 <script> 블록)에게 지금 메이트 타입을 알려준다 -
    // 부엌 배경(강은지 부엌 vs 서은민 부엌)과 미션 세트를 그에 맞게 전환하기 위함.
    window.dispatchEvent(new CustomEvent('kitchen:set-mate-type', { detail:{ type: type } }));
    // 서은민(A)은 태블릿 홈 화면이 강은지와 완전히 다르다(냉장고 정산 카드 대신
    // [우리 규칙]/[틈새살림] 두 화면으로 바로 들어가는 메뉴) - 여기서 미리 전환해둔다.
    var isEunmin = (type === 'A');
    var appHomeDefaultEl = document.getElementById('appHomeDefault');
    var appHomeEunminEl = document.getElementById('appHomeEunmin');
    if(appHomeDefaultEl) appHomeDefaultEl.style.display = isEunmin ? 'none' : '';
    if(appHomeEunminEl) appHomeEunminEl.style.display = isEunmin ? '' : 'none';
    // 강은지(S)·서은민(A)은 서랍 레이아웃(큰 룸 + 미션 때만 나오는 폰)을 쓴다. 김정희(H)는 기존 분할 화면.
    setDrawerLayout(type === 'S' || type === 'A' || type === 'H');
  }

  document.getElementById('otpForm').addEventListener('submit', function(e){
    e.preventDefault();
    checkCode();
  });

  /* ---------- 2단계: 성별 선택 / 이름 입력 ---------- */
  function updateNameGenderNextBtn(){
    var hasName = visitorNameInput.value.trim().length > 0;
    nameGenderNextBtn.disabled = !(hasName && selectedGender);
  }
  genderButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      genderButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      selectedGender = btn.getAttribute('data-gender');
      // 모든 유형 공통: 여성은 cha_front를 좌측, 남성은 cha1_man_front를 우측에 띄운다
      var preview = document.getElementById('genderPreview');
      preview.className = 'gender-preview';
      void preview.offsetWidth; // 성별을 바꿔 누를 때도 등장 애니메이션을 다시 재생
      var isMale = (selectedGender === 'male');
      document.getElementById('genderPreviewImg').src = isMale ? 'object/profile/avata_man.png' : 'object/profile/avata_woman.png';
      preview.classList.add(isMale ? 'right' : 'left');
      updateNameGenderNextBtn();
    });
  });
  visitorNameInput.addEventListener('input', function(){
    // 이름에는 띄어쓰기를 받지 않는다 (붙여넣기 포함)
    if(/\s/.test(visitorNameInput.value)) visitorNameInput.value = visitorNameInput.value.replace(/\s/g, '');
    updateNameGenderNextBtn();
  });
  visitorNameInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !nameGenderNextBtn.disabled){
      nameGenderNextBtn.click();
    }
  });

  nameGenderNextBtn.addEventListener('click', function(){
    var name = visitorNameInput.value.trim();
    if(!name || !selectedGender) return;
    // 이름/성별을 다 받았으니, 이제 3단계(메이트 프로필 소개)로 넘어가면서
    // 아까 코드로 확인해둔 메이트의 프로필을 공개한다.
    genderNamePanel.classList.remove('show');
    revealCharacter(pendingMateType);
    if(!isMatchType(pendingMateType)){
      revealPanel.classList.add('show');
      return;
    }
    // 금전형·규칙형: 같은 화면에서 나 ♥ 메이트 연결 로딩을 먼저 보여주고,
    // 끝나면 그 줄을 그대로 위로 올리며(FLIP) 아래에 정보를 띄운다.
    revealPanel.classList.add('loading', 'show');
    prepStageAgreement(); // 합의서는 코드로 이미 정해졌고 이름도 받았으니 매칭 로딩 동안 미리 그려 둔다
    matchingTimer = setTimeout(function(){
      var pair = revealPanel.querySelector('.match-result');
      var before = pair.getBoundingClientRect().top;
      revealPanel.classList.remove('loading');
      var after = pair.getBoundingClientRect().top;
      pair.animate([{ transform:'translateY(' + (before - after) + 'px)' }, { transform:'none' }],
                   { duration:1000, easing:'cubic-bezier(.45,0,.25,1)' });
    }, 2400);
  });
  var matchingTimer = null;

  /* ---------- 3단계: 메이트 프로필 소개 -> 동거(게임) 시작 ---------- */
  // 금전형 전신 그림(각 1~2MB, 세로 2926px)을 미리 받아 디코딩해 둔다 - 성별 선택/매칭 화면에서
  // 처음 뜰 때 그림이 늦게 붙거나 애니메이션이 끊기는 것 방지
  var profilePreloadKeep = [];
  ['object/profile/avata_woman.png', 'object/profile/avata_man.png',
   'object/profile/mate1_woman.png', 'object/profile/mate1_man.png',
   'object/profile/mate2_woman.png', 'object/profile/mate2_man.png',
   'object/profile/mate3_woman.png', 'object/profile/mate3_man.png'].forEach(function(src){
    var im = new Image(); im.src = src;
    if(im.decode) im.decode().catch(function(){});
    profilePreloadKeep.push(im); // 붙잡아 두지 않으면 해독한 그림이 버려질 수 있다
  });
  var stageAgreementFrame = document.getElementById('stageAgreementFrame');
  function fitStageAgreement(){
    var scale = Math.min(1, (window.innerHeight - 80) / 930); // 폰 테두리 포함 450x930
    var box = document.getElementById('stageAgreement');
    box.style.width = (450 * scale) + 'px';
    box.style.height = (930 * scale) + 'px';
    document.getElementById('stageAgreementWrap').style.setProperty('--agree-w', (450 * scale) + 'px');
    document.getElementById('stagePhone').style.zoom = scale; // transform:scale은 합의서 글자가 뿌옇게 보여서 zoom (fitAlleyFrame 참고)
    // 말풍선 높이는 합의서 상자가 아니라 양옆 캐릭터 그림에 맞춘다 - 캐릭터는 화면 가로에 따라 따로 작아지고 내려가서,
    // 상자 기준이면 좁은 화면에서 말풍선만 머리 위 한참 높이 떴다.
    // 말풍선 아래 끝을 머리 꼭대기에서 그림 높이의 2.5%만 걸치게 - 예전엔 위 끝을 고정 px로 둬서 작은 화면일수록 머리를 많이 가렸다
    var pv = document.getElementById('myPreview'), wrap = document.getElementById('stageAgreementWrap');
    if(pv.offsetHeight){
      var charTop = window.innerHeight - pv.offsetHeight * 85 / 140; // .gender-preview: 높이 140u, bottom -55u
      var r = wrap.getBoundingClientRect();
      var bubbleBottom = Math.max(charTop + pv.offsetHeight * 0.025, r.top + 100); // 말풍선이 화면 위로 잘려 나가지 않게
      wrap.style.setProperty('--talk-bottom', (r.bottom - bubbleBottom) + 'px');
    }
  }
  window.addEventListener('resize', function(){ if(revealPanel.classList.contains('agreeing')) fitStageAgreement(); });

  startCohabitBtn.addEventListener('click', function(){
    if(!visitorNameInput.value.trim()) return;
    if(!isMatchType(currentMateType)){ enterCohabit(true); return; }
    // 금전형(S): 게임 화면으로 가기 전에 이 화면에서 6번 답에 맞는 합의서를 띄운다.
    // 서명이 끝나면(agreement-signed 메시지) enterCohabit(false)로 바로 게임 메인 화면으로 간다.
    // 합의서를 다 불러온 뒤에 폰을 올린다 - 같이 시작하면 폰이 빈 흰 화면으로 올라오다가 중간에 내용이 툭 나타났다
    // 보통은 매칭 로딩 동안 미리 불러와 그려 둔 걸(prepStageAgreement) 바로 올린다. 아직이거나 이름이 바뀌었으면 불러온 뒤에
    var show = function(){
      revealPanel.classList.add('agreeing');
      fitStageAgreement();
      stageAgreementFrame.contentWindow.postMessage({ source:'teum-parent', type:'agreement-start' }, '*'); // 시연 시작 (?wait=1)
      // 임대인(GIVER)·새집은 내가 작성, 임차인(TAKER)은 메이트(임대인)가 써 둔 걸 나는 확인만 한다
      // 첫 말풍선은 폰이 다 올라온 뒤(0.7초)에 - 그 전에 합의서가 신호를 보내 다른 말풍선이 뜨면 say()가 이 예약을 취소한다
      say(null);
      sayTimer = setTimeout(function(){
        say('mate', AGREEMENT_SRC === TAKER ? '합의서를 작성해 뒀어요! 틈새살이를 시작하기 전에 꼭 확인해야 해요!' : '그럼 틈새살이를 시작하기 전에 합의서를 작성해봐요!');
      }, 700);
    };
    // 받던 합의서는 버리지 않고(예전엔 다 안 받아졌으면 처음부터 다시 받았다) 글이 다 들어오는 대로 바로 올린다
    if(stageAgreementWaiting || revealPanel.classList.contains('agreeing')) return; // 두 번 눌러도 한 번만
    if(stageAgreementFrame.getAttribute('src') !== stageAgreementUrl()) prepStageAgreement();
    stageAgreementWaiting = true;
    (function wait(){
      if(stageAgreementFrame.getAttribute('src') !== stageAgreementUrl()){ stageAgreementWaiting = false; return; } // 기다리다 다른 코드로 돌아갔으면 그만
      if(!stageAgreementLoaded()){ requestAnimationFrame(wait); return; }
      stageAgreementWaiting = false;
      show();
    })();
  });
  // 합의서를 미리 불러와 화면 바로 아래(밖)에 실제 크기로 그려 둔다(CSS agree-prep) - 폰이 올라오는 첫 프레임에
  // 합의서를 처음 그리는 일이 몰려 0.05~0.08초 멈칫했다. ?wait=1이라 합의서 시연은 폰을 올릴 때(agreement-start) 시작한다
  var stageAgreementWaiting = false;
  // 합의서 글(DOM)까지 들어왔으면 준비된 걸로 본다 - 그림·글꼴까지 다 받길(load) 기다리면 게임 그림 미리 받기와 겹쳐 수십 초 걸리기도 했다
  // 파일로 직접 열면(file://) 크롬이 합의서 안을 못 보게 막아서, 그때는 예전처럼 다 받아질 때(load)까지 기다린다
  var stageAgreementDone = '';
  function stageAgreementLoaded(){
    if(stageAgreementDone === stageAgreementUrl()) return true;
    try{
      var d = stageAgreementFrame.contentDocument;
      return !!d && d.readyState !== 'loading' && d.location.href.indexOf(stageAgreementUrl()) >= 0;
    }catch(e){ return false; }
  }
  function stageAgreementUrl(){
    return AGREEMENT_SRC + '?name=' + encodeURIComponent(visitorNameInput.value.trim()) + '&mate=' + encodeURIComponent(currentMateName) + '&wait=1';
  }
  function prepStageAgreement(){
    stageAgreementDone = '';
    stageAgreementFrame.onload = function(){ stageAgreementDone = stageAgreementFrame.getAttribute('src'); };
    stageAgreementFrame.src = stageAgreementUrl();
    revealPanel.classList.add('agree-prep');
    fitStageAgreement();
  }

  // 합의서 진행 말풍선 - 한 번에 하나만(대화처럼), 합의서가 보내는 progress 단계에 맞춰 바뀐다
  var ROLE_LINE = {};
  ROLE_LINE[TAKER] = '제가 들어가는 입장이니까 임차인 역할로 확인을 하면 되는군요.';
  ROLE_LINE[GIVER] = '제가 집을 빌려주는 입장이니까 임대인 역할로 작성을 하면 되는군요.';
  ROLE_LINE[NEWHOME] = '같이 새 집을 구하는 입장이니까 보증금을 반씩 나누면 되는군요.';
  var sayTimer = null;
  // 합의서 화면 말풍선은 최대 2줄: 3줄 이상이면 화면 안에서 말풍선 폭을 넓히고(최대 560px), 그래도 넘치면 글자를 조금 줄인다(16→13px)
  function fitTalkTwoLines(el){
    el.style.maxWidth = ''; el.style.fontSize = '';
    var tw = el.querySelector('.tw'); if(!tw) return;
    var lines = function(){ var lh = parseFloat(getComputedStyle(tw).lineHeight) || 21; return Math.round(tw.offsetHeight / lh); };
    var onScreen = function(){ var r = el.getBoundingClientRect(); return r.left >= 8 && r.right <= window.innerWidth - 8; };
    if(lines() <= 2) return;
    for(var w = el.offsetWidth + 20; w <= 560 && lines() > 2; w += 20){
      el.style.maxWidth = w + 'px';
      if(!onScreen()){ el.style.maxWidth = (w - 20) + 'px'; break; }
    }
    for(var f = 15; f >= 13 && lines() > 2; f--) el.style.fontSize = f + 'px';
  }
  function say(who, text){
    clearTimeout(sayTimer); // 예약된 다음 말풍선은 새 말풍선이 뜨면 취소
    var me = document.getElementById('talkMe'), mate = document.getElementById('talkMate');
    if(!who){ me.classList.remove('show'); mate.classList.remove('show'); return; }
    ((who === 'me') ? mate : me).classList.remove('show');
    var el = (who === 'me') ? me : mate;
    if(el.dataset.text === text && el.classList.contains('show')) return; // 같은 말이 이미 떠 있으면 그대로
    el.dataset.text = text;
    el.innerHTML = window.teumWrap(text);
    el.classList.remove('show');
    void el.offsetWidth; // 같은 쪽 말풍선이 연달아 떠도 팝 애니메이션 다시 재생
    el.classList.add('show');
    fitTalkTwoLines(el);
    window.teumBalance(el);
  }

  function enterCohabit(withAgreement){
    var name = visitorNameInput.value.trim();
    document.getElementById('cohabitVisitorName').textContent = name;
    document.getElementById('visitorAvatarName').textContent = name;
    document.getElementById('visitorAvatarBadge').textContent = name.charAt(0);
    stageWrap.classList.add('hide');
    cohabitView.classList.add('show');
    document.body.classList.add('cohabit-active');
    // 2단계에서 고른 성별에 맞는 관람객 캐릭터 그림(character1/character1_man)을
    // 쓰도록 부엌 미니게임 스크립트(다른 <script> 블록)에 알려준다.
    window.dispatchEvent(new CustomEvent('kitchen:set-gender', { detail:{ gender: selectedGender } }));
    // 실제로 이동할 메인 화면(골목생활/홈)은 합의서 서명이 끝난 뒤에 보여줄 것이므로
    // 일단 기억만 해두고, 화면은 먼저 합의서 서명 화면(agreement)을 띄운다. 게임 설명
    // 팝업(온보딩)도 서명이 끝난 뒤 'teum-agreement' 메시지를 받으면 그때 띄운다
    // (아래 message 리스너 참고).
    // 서은민(A)은 [우리 집] 카드 메뉴 화면 없이, 게임을 시작하면 바로 [우리 규칙] 화면부터 보여준다.
    pendingMainScreen = currentMateType === 'S' ? 'alley' : (currentMateType === 'A' ? 'rules' : 'home');
    syncHouseOnly(); // 금전형은 집만 보이는 상태로 시작
    syncMateTabs();
    if(withAgreement){
      appShowScreen('agreement');
      resetAgreementFrame();
    }
    // 부엌 게임 컨테이너가 방금 화면에 나타났으므로(숨김->표시) 아이소메트릭 씬 크기를
    // 다시 계산하도록 알려준다 (kitchen_script.js가 window resize를 구독하고 있음).
    window.dispatchEvent(new Event('resize'));
  }

  /* ---------- 게임 시작 전 사용법 안내 팝업 ---------- */
  var onboardingOverlay = document.getElementById('onboardingOverlay');
  var onboardingSteps = Array.prototype.slice.call(document.querySelectorAll('.onboarding-step'));
  var onboardingDots = Array.prototype.slice.call(document.querySelectorAll('.onboarding-dot'));
  var onboardingNextBtn = document.getElementById('onboardingNextBtn');
  var onboardingSkipBtn = document.getElementById('onboardingSkipBtn');
  var onboardingStepIndex = 0;

  function showOnboardingStep(index){
    onboardingStepIndex = index;
    onboardingSteps.forEach(function(step, i){
      step.classList.toggle('active', i === index);
    });
    onboardingDots.forEach(function(dot, i){
      dot.classList.toggle('active', i === index);
    });
    var isLastStep = index === onboardingSteps.length - 1;
    onboardingNextBtn.textContent = isLastStep ? '틈새살이 시작하기 👆' : '다음 →';
  }

  function closeOnboarding(){
    onboardingOverlay.classList.remove('show');
  }

  onboardingNextBtn.addEventListener('click', function(){
    if(onboardingStepIndex < onboardingSteps.length - 1){
      showOnboardingStep(onboardingStepIndex + 1);
    } else {
      closeOnboarding();
      // 온보딩을 다 보고 실제로 게임이 시작된 시점 - 부엌 스크립트(다른 IIFE)에서 이 이벤트를
      // 구독해서 "게임 시작 10초 뒤 배고픔 말풍선" 타이머를 건다.
      window.dispatchEvent(new CustomEvent('kitchen:game-start'));
    }
  });

  onboardingSkipBtn.addEventListener('click', function(){
    closeOnboarding();
    window.dispatchEvent(new CustomEvent('kitchen:game-start')); // 온보딩을 건너뛰고 바로 게임이 시작된 시점
  });

  /* ---------- 틈새살림: 금액 정산 ---------- */
  var appHome = document.getElementById('appHome');
  var appSettle = document.getElementById('appSettle');
  var appReport = document.getElementById('appReport');
  var appAlley = document.getElementById('appAlley');
  var appAlleyDetail = document.getElementById('appAlleyDetail');
  var appAgreement = document.getElementById('appAgreement');
  var appRules = document.getElementById('appRules');
  var appLiving = document.getElementById('appLiving');
  var appEmotion = document.getElementById('appEmotion');
  var appBackBtn = document.getElementById('appBackBtn');
  var appFlushBackBtn = document.getElementById('appFlushBackBtn');
  var settleHero = document.getElementById('settleHero');
  var addPhotoBtn = document.getElementById('addPhotoBtn');
  var addManualBtn = document.getElementById('addManualBtn');
  var submitSettleBtn = document.getElementById('submitSettleBtn');
  var appPopup = document.getElementById('appPopup');
  var popupCloseBtn = document.getElementById('popupCloseBtn');
  var popupTitle = document.getElementById('popupTitle');
  var popupSub = document.getElementById('popupSub');
  var popupIcon = document.getElementById('popupIcon');
  var appNotification = document.getElementById('appNotification');
  var appBell = document.getElementById('appBell');
  var notiSendBtn = document.getElementById('notiSendBtn');
  var billAdded = false;
  var settled = false;

  var BILL_DATA = {
    headline: '728,630',
    changeText: '지난달보다 전체 금액이 21% 늘었어요.',
    categories: [
      { pctId:'pctWater', amtId:'amtWater', pct:'3.40%', amount:'26,590' },
      { pctId:'pctElec', amtId:'amtElec', pct:'6.83%', amount:'53,400' },
      { pctId:'pctHeat', amtId:'amtHeat', pct:'3.95%', amount:'30,910' },
      { pctId:'pctMgmt', amtId:'amtMgmt', pct:'7.67%', amount:'60,000' },
      { pctId:'pctRent', amtId:'amtRent', pct:'78.14%', amount:'610,910' }
    ],
    total:'781,810', split:'390,905'
  };
  var SEGBAR_FILLED = '<span style="width:55%; background:#4f9e6c;"></span>'+
    '<span style="width:15%; background:#bcdcc2;"></span>'+
    '<span style="width:15%; background:#f6b8c2;"></span>'+
    '<span style="width:10%; background:#ef8c86;"></span>'+
    '<span style="width:5%; background:#e3e8e4;"></span>';
  var SEGBAR_EMPTY = '<span style="width:100%; background:#e3e8e4;"></span>';

  // 'rules'(우리 규칙)도 최상위 화면으로 등록해둔다 - 서은민(A)은 [우리 집] 메뉴 없이
  // [우리 규칙]이 곧 시작 화면이므로, [틈새살림](living)에서 뒤로가기를 누르면 (예전처럼
  // 사라진 [우리 집]이 아니라) [우리 규칙]으로 돌아오도록 하기 위함이다.
  var TOP_LEVEL_SCREENS = ['home', 'alley', 'agreement', 'rules'];
  var TAB_OF_SCREEN = { home:'home', notification:'home', settle:'home', report:'home', alley:'alley', 'alley-detail':'alley' };
  var BACK_OVERRIDE = { 'alley-detail':'alley' };
  var currentAppScreen = 'home';
  var lastTabScreen = 'home';

  function appShowScreen(name){
    appHome.classList.toggle('active', name === 'home');
    appNotification.classList.toggle('active', name === 'notification');
    appSettle.classList.toggle('active', name === 'settle');
    appReport.classList.toggle('active', name === 'report');
    appAlley.classList.toggle('active', name === 'alley');
    appAlleyDetail.classList.toggle('active', name === 'alley-detail');
    appAgreement.classList.toggle('active', name === 'agreement');
    appRules.classList.toggle('active', name === 'rules');
    appLiving.classList.toggle('active', name === 'living');
    appEmotion.classList.toggle('active', name === 'emotion');
    var isFlushScreen = (name === 'alley' || name === 'agreement' || name === 'rules' || name === 'living' || name === 'emotion');
    if(appMock){ appMock.classList.toggle('app-mock--flush', isFlushScreen); }
    if(isFlushScreen && typeof fitAlleyFrame === 'function'){ fitAlleyFrame(); }
    appBackBtn.style.visibility = TOP_LEVEL_SCREENS.indexOf(name) === -1 ? 'visible' : 'hidden';
    // [우리 집] 카드 메뉴 화면이 없어져서 [우리 규칙]/[틈새살림]이 각자 게임 시작/거실 이동
    // 즉시 바로 보여지는 시작 화면이 됐고, 되돌아갈 상위 화면이 더 이상 없으므로 이 전용
    // 뒤로가기 버튼은 항상 숨긴다(과거에는 rules/living일 때만 보여줬었다).
    if(appFlushBackBtn){ appFlushBackBtn.classList.toggle('show', false); }
    // 합의서 화면일 때만 왼쪽 아이소메트릭 룸을 어둡게 눌러줘서 합의서 쪽을 강조한다.
    if(cohabitLeftDim){ cohabitLeftDim.classList.toggle('show', name === 'agreement'); }
    document.querySelectorAll('.app-bottom-nav .nav-item[data-screen]').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-screen') === TAB_OF_SCREEN[name]);
    });
    if(TOP_LEVEL_SCREENS.indexOf(name) !== -1){ lastTabScreen = name; }
    currentAppScreen = name;
    updateRoomLock();
  }

  /* 아이소메트릭 룸 잠금 덮개(#cohabitLeftDim): 앱 서랍이 열려 있거나(앱 미션) 앱 안에서 합의서를
     쓰는 동안은 룸을 터치할 수 없게 덮는다. 서랍이 열려 있을 땐 룸이 보이도록 옅게(.light).
     미션 중엔 헤더의 유형 탭(금전/규칙/감정)도 잠근다. */
  function updateRoomLock(){
    if(!cohabitLeftDim) return;
    var agreement = currentAppScreen === 'agreement' && document.body.classList.contains('cohabit-active');
    var drawerOpen = document.body.classList.contains('app-drawer-open');
    var locked = agreement || drawerOpen || !!fridgeMissionActive || !!laundryMissionActive;
    cohabitLeftDim.classList.toggle('show', locked);
    cohabitLeftDim.classList.toggle('lock', locked);
    cohabitLeftDim.classList.toggle('light', locked && drawerOpen && !agreement);
    var tabs = document.getElementById('mateTabs');
    if(tabs) tabs.classList.toggle('locked', locked && !agreement);
  }

  function updateHeroState(filled){
    document.getElementById('heroEmptyState').style.display = filled ? 'none' : '';
    document.getElementById('heroFilledState').style.display = filled ? '' : 'none';
  }

  function populateBillData(){
    document.getElementById('settleHeadlineAmount').textContent = BILL_DATA.headline;
    document.getElementById('settleSubText').textContent = BILL_DATA.changeText;
    BILL_DATA.categories.forEach(function(c){
      document.getElementById(c.pctId).textContent = c.pct;
      document.getElementById(c.amtId).textContent = c.amount;
    });
    document.getElementById('segBar').innerHTML = SEGBAR_FILLED;
    document.getElementById('sumTotal').textContent = BILL_DATA.total + '원';
    document.getElementById('sumSplit').textContent = '- ' + BILL_DATA.split + '원';
    document.getElementById('sumMine').textContent = BILL_DATA.split + '원';
    addPhotoBtn.classList.add('filled');
    addManualBtn.classList.add('filled');
    submitSettleBtn.disabled = false;
    billAdded = true;
    updateHeroState(true);
  }

  function resetBillData(){
    document.getElementById('settleHeadlineAmount').textContent = '0';
    document.getElementById('settleSubText').textContent = '고지서를 등록하면 지난달과 비교해드려요.';
    BILL_DATA.categories.forEach(function(c){
      document.getElementById(c.pctId).textContent = '-';
      document.getElementById(c.amtId).textContent = '0';
    });
    document.getElementById('segBar').innerHTML = SEGBAR_EMPTY;
    document.getElementById('sumTotal').textContent = '0원';
    document.getElementById('sumSplit').textContent = '- 0원';
    document.getElementById('sumMine').textContent = '0원';
    addPhotoBtn.classList.remove('filled');
    addManualBtn.classList.remove('filled');
    submitSettleBtn.disabled = true;
    billAdded = false;
    settled = false;
    updateHeroState(false);
  }

  settleHero.addEventListener('click', function(){
    appShowScreen(settled ? 'report' : 'settle');
    if(guideActive && guideStep === 0){
      showGuideStep(settled ? 2 : 1);
    }
  });
  appBackBtn.addEventListener('click', function(){
    appShowScreen(BACK_OVERRIDE[currentAppScreen] || lastTabScreen);
  });
  if(appFlushBackBtn){
    appFlushBackBtn.addEventListener('click', function(){
      appShowScreen(BACK_OVERRIDE[currentAppScreen] || lastTabScreen);
    });
  }

  /* ---------- 하단 탭 전환 (골목 생활 ↔ 틈새살림 등) ---------- */
  document.querySelectorAll('.app-bottom-nav .nav-item[data-screen]').forEach(function(item){
    item.addEventListener('click', function(){
      appShowScreen(item.getAttribute('data-screen'));
    });
  });

  /* ---------- 골목 생활: 바텀시트 드래그/탭 ---------- */
  function setupAlleySheet(sheetEl, handleEl, onChange){
    var expanded = false;
    function setExpanded(v){
      if(expanded === v) return;
      expanded = v;
      sheetEl.classList.toggle('expanded', v);
      if(onChange) onChange(v);
    }
    handleEl.addEventListener('click', function(){ setExpanded(!expanded); });

    var dragStartY = null;
    handleEl.addEventListener('pointerdown', function(e){
      dragStartY = e.clientY;
      try{ handleEl.setPointerCapture(e.pointerId); }catch(err){}
    });
    handleEl.addEventListener('pointermove', function(e){
      if(dragStartY === null) return;
      var dy = e.clientY - dragStartY;
      if(dy < -16 && !expanded){ setExpanded(true); dragStartY = null; }
      else if(dy > 16 && expanded){ setExpanded(false); dragStartY = null; }
    });
    handleEl.addEventListener('pointerup', function(){ dragStartY = null; });
    handleEl.addEventListener('pointercancel', function(){ dragStartY = null; });

    return { setExpanded:setExpanded, isExpanded:function(){ return expanded; } };
  }

  // 골목생활 화면은 이제 app_1(iframe)이 지도 드래그/시트 드래그/카테고리 필터/상세화면
  // 전환을 전부 자체적으로 처리하므로, 예전에 여기 있던 setupAlleySheet 호출과 카테고리
  // 필터, 상세 진입, 설명 더보기 관련 코드는 더 이상 필요 없어 제거했다.
  // (미션 진행에 필요한 최소한의 연결은 아래 'FRIDGE_MISSION' 섹션의 message 리스너 참고)

  addPhotoBtn.addEventListener('click', populateBillData);
  addManualBtn.addEventListener('click', populateBillData);

  // 팝업이 "정산 완료"용인지 "알림 발송"용인지 구분해서, 확인 버튼을 눌렀을 때
  // 어느 쪽 후속 동작(report 화면 전환 vs 아무 화면 전환 없음)을 할지 결정한다.
  // 가이드 투어가 꺼져 있어도(예: 튜토리얼 없이 그냥 앱을 쓰는 경우) 정산 완료 자체는
  // 항상 report 화면으로 넘어가야 하므로, 이 분기를 guideActive/mission2Active와는
  // 별개로 둔다 — 투어 진행 여부는 그 아래에서 "추가로" 확인만 한다.
  var popupContext = null;

  submitSettleBtn.addEventListener('click', function(){
    if(submitSettleBtn.disabled) return;
    popupContext = 'settle';
    popupTitle.innerHTML = '말하기 껄끄러운 정산,<br/>틈이 대신 다정하게 전달했어요!';
    popupSub.textContent = '[' + currentMateName + ' 님이 정산 금액을 확인하고 송금을 완료했습니다]';
    appPopup.classList.add('show');
  });

  popupCloseBtn.addEventListener('click', function(){
    appPopup.classList.remove('show');
    if(popupContext === 'settle'){
      settled = true;
      appShowScreen('report');
      if(guideActive && guideStep === 1){
        showGuideStep(2);
      }
    } else if(popupContext === 'notify'){
      if(mission2Active && mission2Step === 1){
        endMission2Tour();
        missionStage = 4;
      }
    }
    // (미션1 완료 축하는 더 이상 이 폰 화면 팝업을 쓰지 않고, 아이소메트릭 쪽
    // 폭죽 효과 + 캐릭터 대화창으로 대체했다 - 아래 kitchen_script.js의
    // 'kitchen:show-celebrate'/showKitchenCelebrate 참고)
    popupIcon.textContent = '💌';
    popupContext = null;
  });

  /* ---------- 캐릭터 말풍선 → 미션 가이드 투어 ---------- */
  /* missionStage: 0=미션1 대기 1=미션1 진행중 2=미션2 대기 3=미션2 진행중 4=모두 완료 */
  var missionStage = 0;

  /* 미션 1 순서: ① 금액 정산 카드 → ② 사진 촬영으로 고지서 등록하기 버튼 → ③ 지출 화면 도달 */
  var guideSpotlight = document.getElementById('guideSpotlight');
  var guideTooltip = document.getElementById('guideTooltip');
  var guideTooltipStep = document.getElementById('guideTooltipStep');
  var guideTooltipText = document.getElementById('guideTooltipText');
  var guideTooltipClose = document.getElementById('guideTooltipClose');
  var guideActive = false;
  var guideStep = 0;
  var GUIDE_STEPS = [
    { label:'① 금액 정산', text:'카드를 눌러 이번 달 지출 정산을 시작해보세요.' },
    { label:'② 고지서 등록', text:'사진 촬영으로 고지서를 등록하면 지출 내역이 자동으로 채워져요.' },
    { label:'③ 지출 화면 도달', text:'지출 화면에 도착했어요! 이번 달 내역을 확인해보세요.' }
  ];

  function positionGuide(target, opts){
    // target은 보통 DOM 엘리먼트지만, app_1/app_2(iframe) 안의 버튼처럼 직접 getBoundingClientRect()를
    // 호출할 수 없는 경우에는 {top,left,width,height}만 있는 일반 객체를 그대로 넘겨받기도 한다.
    var rect = (target && typeof target.getBoundingClientRect === 'function') ? target.getBoundingClientRect() : target;
    // rect가 DOMRect가 아니라 위의 일반 객체({top,left,width,height}만 있음)일 때는 .bottom이
    // 없어서(undefined) 아래 계산에서 NaN이 나올 수 있었다. NaN + 'px'는 잘못된 CSS 값이라
    // style.top 대입이 무시되고, 그 결과 툴팁이 "이전에 마지막으로 성공했던 위치"(대개 자리를
    // 잡기 전 임시로 보여줬던 폰 목업 전체 감싸기 위치, 화면 한참 아래쪽)에 계속 멈춰 있는
    // 버그가 있었다. rect.bottom이 없으면 top+height로 직접 계산해서 항상 유효한 값을 쓴다.
    var rectBottom = (typeof rect.bottom === 'number') ? rect.bottom : rect.top + rect.height;
    var pad = 8;
    guideSpotlight.style.top = (rect.top - pad) + 'px';
    guideSpotlight.style.left = (rect.left - pad) + 'px';
    guideSpotlight.style.width = (rect.width + pad * 2) + 'px';
    guideSpotlight.style.height = (rect.height + pad * 2) + 'px';

    opts = opts || {};
    var tooltipWidth = 230;
    // 안내 문구 길이에 따라 툴팁 높이가 달라지므로(두 문장짜리 안내는 더 길어진다),
    // 고정값 대신 실제 렌더링된 높이를 측정해서 겹침 없이 배치한다.
    // (opacity:0 상태에서도 레이아웃은 계산되므로 offsetHeight로 정확히 잴 수 있다.)
    var tooltipHeightEstimate = guideTooltip.offsetHeight || 110;
    var tooltipTop;
    if(opts.above){
      // 버튼 바로 위에 뜨도록 우선 시도하고, 화면 위쪽 여백이 모자랄 때만 아래로 내린다.
      tooltipTop = rect.top - 14 - tooltipHeightEstimate;
      if(tooltipTop < 12){
        tooltipTop = rectBottom + 14;
      }
    } else {
      tooltipTop = rectBottom + 14;
      if(tooltipTop + tooltipHeightEstimate > window.innerHeight){
        tooltipTop = Math.max(12, rect.top - 14 - tooltipHeightEstimate);
      }
    }
    // 위/아래 어느 쪽으로도 화면 안에 다 들어가지 않는 경우(대상이 화면 세로 길이에 비해
    // 너무 아래/위에 있는 등)에도 툴팁 자체는 항상 화면 안에서 보이도록 마지막에 한 번 더 clamp한다.
    tooltipTop = Math.min(Math.max(12, tooltipTop), window.innerHeight - tooltipHeightEstimate - 12);
    var tooltipLeft = Math.min(
      Math.max(12, rect.left + rect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - 12
    );
    guideTooltip.style.top = tooltipTop + 'px';
    guideTooltip.style.left = tooltipLeft + 'px';
  }

  function showGuideStep(step){
    guideStep = step;
    var info = GUIDE_STEPS[step];
    guideTooltipStep.textContent = info.label;
    guideTooltipText.textContent = info.text;

    var target = step === 0 ? settleHero : (step === 1 ? addPhotoBtn : appReport);
    positionGuide(target);

    guideSpotlight.classList.add('show');
    guideTooltip.classList.add('show');

    if(step === 2){
      setTimeout(function(){
        endGuideTour();
        // 미션 1 완료 -> 미션 2가 대기 상태가 됐다는 걸 새 말풍선으로 알린다.
        missionStage = 2;
        window.dispatchEvent(new CustomEvent('teum:bubble-show'));
      }, 2800);
    }
  }

  function endGuideTour(){
    guideActive = false;
    guideSpotlight.classList.remove('show');
    guideTooltip.classList.remove('show');
  }

  /* 미션 2 순서: ① 알림 버튼 -> ② 반짝이는 알림 발송 버튼 */
  var mission2Active = false;
  var mission2Step = 0;
  var MISSION2_STEPS = [
    { label:'① 알림 확인', text:'🔔 알림 버튼을 눌러 새 소식을 확인해보세요.' },
    { label:'② 알림 발송', text:'반짝이는 버튼을 눌러 이번 주 가사 분담 알림을 보내보세요.' }
  ];

  function showMission2Step(step){
    mission2Step = step;
    var info = MISSION2_STEPS[step];
    guideTooltipStep.textContent = info.label;
    guideTooltipText.textContent = info.text;

    var target = step === 0 ? appBell : notiSendBtn;
    positionGuide(target);

    guideSpotlight.classList.add('show');
    guideTooltip.classList.add('show');
  }

  function endMission2Tour(){
    mission2Active = false;
    guideSpotlight.classList.remove('show');
    guideTooltip.classList.remove('show');
  }

  function startGuideTour(){
    if(missionStage === 0){
      missionStage = 1;
      window.dispatchEvent(new CustomEvent('teum:bubble-hide'));
      guideActive = true;
      appShowScreen('home');
      // appShowScreen()은 클래스 토글이라 동기적으로 바로 레이아웃에 반영되므로,
      // rAF로 한 프레임 미루면 오히려 그 사이에 사용자가 다음 단계를 먼저 클릭했을 때
      // guideStep이 0으로 되돌아가는 경쟁 상태가 생긴다. 그래서 바로 동기 호출한다.
      showGuideStep(0);
    } else if(missionStage === 2){
      missionStage = 3;
      window.dispatchEvent(new CustomEvent('teum:bubble-hide'));
      mission2Active = true;
      appShowScreen('home');
      showMission2Step(0);
    }
    // missionStage가 1/3(미션 진행중)이거나 4(완료)면 말풍선 자체가 숨겨져 있어
    // 이 시점에 도달하지 않는다.
  }

  appBell.addEventListener('click', function(){
    appShowScreen('notification');
    if(mission2Active && mission2Step === 0){
      showMission2Step(1);
    }
  });

  notiSendBtn.addEventListener('click', function(){
    popupContext = 'notify';
    popupTitle.innerHTML = '직접 말하기 껄끄러운 약속,<br/>틈이 대신 다정하게 전달했어요!';
    popupSub.textContent = '[' + currentMateName + ' 님에게 이번 주 가사 당번 알림이 발송되었습니다]';
    appPopup.classList.add('show');
  });

  /* =========================================================
     [관람객의 인터랙션] 미션 1: 동네 반찬가게 공동 구독
     ① 부엌의 냉장고(상태이상 아이콘)를 클릭 → 텅 빈 냉장고 확인(kitchen_script.js가 처리)
     ② 냉장고 확인 후, 폰 화면(app_1 iframe)에서 [정기 반찬 구독권] 카드를 누르도록 안내
     ③ 상세 페이지 하단의 [정기 반찬 단체 구독권]을 눌러 공동 구독 신청
     ④ 아이소메트릭(부엌) 화면 위에 폭죽 효과 + 관람객 캐릭터 대화창으로
        "공동 구매 덕분에 비용도 절약하고 든든하게 밥을 챙겨 먹을 수 있게 됐어!" 표시
        (kitchen_script.js의 showKitchenCelebrate)
     (기존 missionStage/guideActive/mission2Active 흐름과는 독립적으로 동작한다 — 부엌
     미니게임은 캐릭터 말풍선이 아니라 냉장고 클릭으로 시작되는 별도의 미션이기 때문)

     골목생활 화면이 app_1(iframe)으로 바뀌면서, 카드/구독권 클릭은 이제 부모 문서가
     직접 감지할 수 없다 - 대신 app_1이 postMessage로 알려주는 신호(message 리스너, 아래)를
     받아서 진행한다. 스포트라이트도 app_1에게 "지금 강조할 버튼이 어디 있는지" 물어봐서
     (request-rect/rect-report) 받은 좌표로 그 버튼 하나만 정확히 감싼다.
     ========================================================= */
  var appMock = document.querySelector('.app-mock');
  // flush 화면(app_1/app_2/app_3/합의서 - iframe이 폰 목업 전체를 꽉 채우는 통짜 화면)에서는
  // iframe 내부 문서가 스스로 스크롤을 처리하므로, 이 바깥의 .app-content가 따로 스크롤될
  // 이유가 없다. 그런데 iframe 안 입력 칸(예: 가사 규칙 제목/내용)에 포커스가 갈 때 크롬이
  // "포커스된 요소를 보이게" 하려고 iframe 경계를 넘어 이 부모 스크롤 컨테이너까지 함께
  // 움직여버리는 경우가 있다 - 그 결과 이 스크롤이 리셋되지 않은 채 남아, 화면 위쪽 내용
  // (예: 분리수거 상세 화면의 닫기 버튼)이 화면 밖으로 잘려 보이지 않고 안내 팝업도 엉뚱한
  // 위치를 가리키는 버그가 있었다. flush 화면에서는 이 스크롤이 생기자마자 0으로 되돌려서
  // 애초에 스크롤된 적이 없던 것처럼 만든다.
  var appContentEl = document.querySelector('.app-content');
  if(appContentEl){
    appContentEl.addEventListener('scroll', function(){
      if(appMock && appMock.classList.contains('app-mock--flush') && appContentEl.scrollTop !== 0){
        appContentEl.scrollTop = 0;
      }
    });
  }
  var appAlleyFrame = document.getElementById('appAlleyFrame');
  var appAgreementFrame = document.getElementById('appAgreementFrame');
  var appRulesFrame = document.getElementById('appRulesFrame');
  var appLivingFrame = document.getElementById('appLivingFrame');
  var appEmotionFrame = document.getElementById('appEmotionFrame');
  // 코드 확인(checkCode) 때 6번 답에 맞는 합의서로 바뀐다
  var AGREEMENT_SRC = 'agreement/agreement_newhome_auto.html';
  // 동거 시작하기를 누르면 일단 합의서 서명 화면부터 보여주고, 서명이 끝난 뒤에야
  // 실제로 이동할 메인 화면(골목생활/홈)을 여기에 잠깐 기억해둔다.
  var pendingMainScreen = 'alley';
  // 재시작을 포함해서 매 회차 항상 처음(작성 안내 화면)부터 서명하도록, 동거를 시작할
  // 때마다 합의서 iframe을 강제로 다시 불러온다(같은 src를 그대로 대입하면 브라우저가
  // 재로딩을 건너뛸 수 있어서, 한 번 about:blank로 비웠다가 다시 채운다).
  function resetAgreementFrame(){
    if(!appAgreementFrame) return;
    // 합의서 화면의 '본인' 서명란 이름을, 관람객이 2단계에서 입력한 이름으로 채워주기
    // 위해 쿼리스트링으로 전달한다(같은 파일이라도 iframe은 postMessage 없이 시작
    // 시점 값을 바로 알 방법이 없어 URL 파라미터가 제일 간단하다).
    var visitorName = (visitorNameInput.value || '').trim();
    var src = AGREEMENT_SRC + '?name=' + encodeURIComponent(visitorName) + '&mate=' + encodeURIComponent(currentMateName);
    appAgreementFrame.src = 'about:blank';
    setTimeout(function(){ appAgreementFrame.src = src; }, 0);
  }

  /* app_1과 합의서(agreement_newhome_auto.html)는 둘 다 412x892 원본 크기를 그대로
     유지한 채로 그려지므로, 폰 목업(.app-mock)이 실제 화면에서 차지하는 크기에 맞춰
     두 iframe을 함께 transform:scale로 축소해준다(어차피 동시에 보이지 않으므로 둘 다
     계산해도 무해하다). 목업 크기가 반응형(min(300px, 92%))이라 화면 크기가 바뀔 때마다
     다시 계산해야 한다. */
  function fitAlleyFrame(){
    if(!appMock) return;
    var w = appMock.getBoundingClientRect().width;
    if(w <= 0) return;
    var scale = w / 412;
    // transform:scale로 줄이면 크롬이 412px로 그린 그림을 통째로 축소해 글자가 뿌옇게 보였다(특히 화면 배율 150%).
    // zoom은 줄어든 크기에서 직접 다시 그려 선명하다. 앱 안 좌표(412 기준)는 그대로라 위치 계산(rect-report)도 같다.
    // 앱 화면(iframe) 자체를 폰 화면과 같은 둥글기로 깎는다 - zoom이 둥글기도 같이 줄이므로 앱 좌표로 나눠 둔다.
    // 앱 안 .app-wrapper(30px)는 이보다 작아 늘 가려지고, 폰 틀이 움직이는 동안(서랍 애니메이션)에도 iframe이 제 모양으로 잘린다
    var radius = parseFloat(getComputedStyle(appMock).borderTopLeftRadius) || 0;
    [appAlleyFrame, appAgreementFrame, appRulesFrame, appLivingFrame, appEmotionFrame].forEach(function(f){
      if(!f) return;
      f.style.zoom = scale;
      f.style.borderRadius = (radius / scale) + 'px';
    });
  }
  window.addEventListener('resize', fitAlleyFrame);
  fitAlleyFrame();

  var fridgeMissionActive = false;
  var fridgeMissionStep = 0;
  var fridgeMissionDone = false;

  // 세 번째 미션 — 다용도실 세탁물 공동 구독(구조는 위 냉장고 미션과 완전히 동일하고
  // mission 이름표만 다르게 붙여서 request-rect/rect-report에서 서로 구분한다).
  var laundryMissionActive = false;
  var laundryMissionStep = 0;
  var laundryMissionDone = false;

  // app_1(iframe) 안 버튼의 실제 위치는 부모 문서가 직접 잴 수 없으므로, iframe에게
  // "지금 몇 번째 단계 버튼이 어디 있는지" 물어보고(request-rect), iframe이 자기 문서
  // 기준 좌표로 답해주면(rect-report, message 리스너 참고) 그 좌표에 iframe의 실제
  // 화면상 위치·축소 비율(scale)을 곱해서 더해 페이지 기준 좌표로 바꾼 뒤 스포트라이트를
  // 그 버튼 하나에만 씌운다. mission을 함께 실어보내 반찬/세탁 미션 중 어느 쪽 투어인지
  // iframe이 구분할 수 있게 한다(생략하면 기존 반찬 미션으로 처리됨).
  function requestAlleyRect(step, target, mission){
    if(!appAlleyFrame || !appAlleyFrame.contentWindow) return;
    appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'request-rect', step:step, target:target, mission:mission }, '*');
  }

  function positionGuideFromIframeRect(rect){
    if(!appAlleyFrame) return;
    var frameBox = appAlleyFrame.getBoundingClientRect(); // 화면에 실제로 그려지는(스케일 적용된) iframe 위치/크기
    var scale = frameBox.width / 412;
    positionGuide({
      top: frameBox.top + rect.top * scale,
      left: frameBox.left + rect.left * scale,
      width: rect.width * scale,
      height: rect.height * scale
    }, { above: true }); // 냉장고/세탁물 미션 가이드는 항상 버튼 바로 위에 뜨도록 한다
  }

  // 냉장고(미션1)/세탁물(미션2) 안내 가이드는 진행을 강제하는 투어라, 중간에 임의로
  // 닫아버릴 수 없도록 말풍선의 닫기(X) 버튼을 숨긴다 (다른 일반 가이드 투어에는 영향 없음).
  // 미션1은 안내 가이드(어둡게+강조+설명 말풍선) 없이 앱만 펼친다 - 단계 번호만 기억
  function showFridgeMissionStep(step){
    fridgeMissionStep = step;
    showAlleyGuide('fridge', step);
  }

  /* ---------- 강은지(S) 앱 미션 안내 말풍선 ----------
     서은민과 같은 폰 왼쪽 말풍선(#appGuideBubble, eg* 함수)을 쓴다. 눌러야 할 카드만 눌리게 막고
     반짝이게 하고 상세 화면을 자동으로 올려주는 건 app_1(팀원 버전)이 직접 하므로, 여기서는 단계
     설명만 띄우고 말풍선 높이를 app_1이 알려주는 버튼 위치(rect-report)에 맞춘다.
     app_1은 단계가 바뀌면 바텀 시트를 올리고 단체권 카드까지 천천히 스크롤하는데, 그동안 말풍선이
     같이 움직이면 어색하므로 → 애니메이션이 끝날 때까지 숨겨두고, 버튼 위치가 0.6초 동안 그대로면
     그 자리에 나타나서 더는 따라 움직이지 않는다. */
  // 규칙형과 같은 틀: 화면마다 보여주기(점선 테두리 + [다음] 또는 테두리 범위 클릭)로 먼저 설명하고 누르기(실선)로 넘어간다.
  // target = app_1이 테두리를 그리고 위치를 알려줄 대상 이름 (app_1 index.html의 MISSION_TARGETS)
  // wait = 그 단계 직전 app_1 애니메이션(시트 올리기·스크롤)이 끝날 때까지 말풍선을 띄우지 않는 최소 시간
  // 가이드 문구 형식 (모든 앱 미션 공통): 두세 줄. 첫 단계에 앱 화면 소개("[화면]은 ~ 기능이에요"),
  // 보여주기 = 기능 + 그게 무엇을 해 주는지 한마디, 누르기 = "[버튼]을 눌러 ~해보세요", 누르는 것은 대괄호, 자동으로 고른 값은 '값'.
  // {m} = 메이트 이름+님 (revealAlleyGuide에서 채운다)
  var ALLEY_GUIDE = {
    fridge: { label:'반찬 함께 구독하기', mission:'fridge', steps:[
      { kind:'show', target:'map',
        text:'<b>[골목 생활]</b>은 우리 동네 가게를\n지도에서 한눈에 찾는 기능이에요.' },
      { kind:'show', target:'chips',
        text:'<b>[종류 버튼]</b>을 누르면\n원하는 종류의 가게만 골라 볼 수 있어요.' },
      { kind:'click', target:'card', // 반찬가게는 지도 핀 (app_1 PULSE.fridge.card) - 세탁소는 목록 카드
        text:'지도에서 <b>[반찬가게]</b> 핀을 눌러\n가게 정보를 열어보세요.' },
      { kind:'show', target:'tickets', wait:3100,
        text:'<b>정기 구독권</b>은 정해진 날마다\n반찬을 받아 장 볼 필요가 없어요.' },
      { kind:'show', target:'group',
        text:'<b>단체 구독권</b>은 메이트와 비용을\n나눠 내서 혼자보다 저렴해요.' },
      { kind:'show', target:'reviews',
        text:'<b>별점과 후기</b>로 이웃들의 평가를 보고\n가게를 미리 확인할 수 있어요.' },
      { kind:'click', target:'group',
        text:'{m}과 함께 신청해요.\n<b>[정기 반찬 단체 구독권]</b>을\n눌러보세요.' }
    ]},
    // 세탁은 반찬에서 골목 생활 기능(지도·종류 버튼·구독권·단체권·후기)을 이미 다 본 뒤라, 같은 설명을 되풀이하지 않고
    // 세탁만의 점(수거·배송 → 밤에 세탁기를 안 돌려도 됨)만 짚고 바로 신청한다
    laundry: { label:'세탁 함께 구독하기', mission:'laundry', steps:[
      { kind:'show', target:'list', wait:1800,
        text:'이번엔 지도 대신 <b>[목록]</b>으로\n가게를 차례로 보며 세탁소를 찾아볼게요.' },
      { kind:'click', target:'card',
        text:'<b>[세탁소]</b> 카드를 눌러\n이용할 수 있는 구독권을 확인해보세요.' },
      { kind:'show', target:'tickets', wait:3100,
        text:'<b>생활빨래 정기권</b>은 빨래를 수거해\n세탁 후 배송해 줘서 밤늦게\n세탁기를 안 돌려도 돼요.' },
      { kind:'click', target:'group',
        text:'<b>[생활빨래 단체권]</b>을 눌러\n이번에도 {m}과\n비용을 나눠 신청해요.' }
    ]}
  };
  function alleyStep(){ return alleyGuide && ALLEY_GUIDE[alleyGuide.key].steps[alleyGuide.step]; }
  // 금전형 마지막 단계 - 규칙형 정산 알림(noti 단계)과 같은 틀: 단체 구독을 신청하면 메이트에게 알림을 보냈다는 배너를 띄우고,
  // 가이드가 그 배너를 짚어 준 뒤 [완료]를 누르면 배너를 올리고 미션을 마친다(finish)
  var alleyNotiFinish = null;
  function showAlleyNoti(kind, finish){
    var m = mateName(), g = ALLEY_GUIDE[kind], n = g.steps.length + 1;
    showTopNotification(m + '님에게 함께 구독 신청 알림을 보냈어요!', kind === 'fridge'
      ? '정기 반찬 단체 구독권을 같이 신청했어요.\n비용은 반씩 나누고 2주마다 반찬을 받아요.'
      : '생활빨래 단체권을 같이 신청했어요.\n수거부터 배송까지, 비용은 반씩 나눠요.', true);
    eg.pointEl = appTopToast;
    appTopToast.classList.add('guided');
    egShowBubble(g.label, n + ' / ' + n, m + '님에게 <b>함께 구독 신청 알림</b>이\n바로 전송됐어요.\n' + m + '님도 앱에서 확인하고\n같이 이용할 수 있어요.', true);
    appGuideNext.textContent = '완료';
    appGuideNext.classList.add('show');
    alleyNotiFinish = finish;
  }
  var alleyGuide = null;      // { key:'fridge'|'laundry', step, shown, ... }
  var alleyRectTimer = null;
  // 버튼 위치가 이만큼 그대로면 애니메이션(스크롤)이 끝난 것으로 본다. 예전 0.6초(0.2초마다 확인)는 화면이 안 움직이는
  // 단계에서도 그만큼 늦어 규칙형보다 한 박자 늦게 나왔다 → 0.1초마다 확인, 0.15초 그대로면 띄운다
  var ALLEY_STABLE_MS = 150;
  var ALLEY_MAX_WAIT_MS = 6000; // 그래도 안 멈추면 이 시간 뒤엔 그냥 띄운다
  function showAlleyGuide(key, step){
    var st = ALLEY_GUIDE[key].steps[step];
    alleyGuide = { key:key, step:step, shown:false, last:null, stableSince:0, startedAt:Date.now(), minDelay:st.wait || 0 };
    eg.active = true; eg.frame = appAlleyFrame; eg.rect = null; eg.steps = []; eg.onFinish = null;
    appGuideNext.classList.remove('show');
    // 규칙형처럼 말풍선은 띄운 채 글만 바꾼다 - 시트를 크게 올리는 단계(wait)만 애니메이션이 끝날 때까지 숨겨둔다
    if(st.wait) appGuideBubble.classList.remove('show');
    clearInterval(alleyRectTimer);
    // 앱에 지금 단계를 알린다 - 보여주기면 대상에 점선 테두리(누르기 잠금), 누르기면 대상만 빛나며 눌린다
    if(appAlleyFrame && appAlleyFrame.contentWindow) appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'guide-phase', phase:st.kind, target:st.target }, '*');
    var mission = ALLEY_GUIDE[key].mission;
    var ask = function(){
      if(!alleyGuide) return;
      if(!alleyGuide.shown && Date.now() - alleyGuide.startedAt > ALLEY_MAX_WAIT_MS) revealAlleyGuide();
      requestAlleyRect(step, st.target, mission); // 띄운 뒤에도 계속 물어 스크롤되는 대상을 말풍선이 따라간다 (규칙형과 같게)
    };
    ask();
    alleyRectTimer = setInterval(ask, 100);
  }
  // 위치가 멈췄으면(또는 너무 오래 걸리면) 그 자리에 말풍선을 띄운다 - 위치는 미끄러지지 않고 바로 잡는다
  function revealAlleyGuide(){
    if(!alleyGuide || alleyGuide.shown) return;
    alleyGuide.shown = true;
    var g = ALLEY_GUIDE[alleyGuide.key];
    appGuideBubble.style.transition = 'opacity .25s ease, transform .25s ease, visibility 0s';
    egShowBubble(g.label, (alleyGuide.step + 1) + ' / ' + (g.steps.length + 1), g.steps[alleyGuide.step].text.replace(/\{m\}/g, mateName() + '님'), true);
    appGuideNext.textContent = '다음 ▶';
    appGuideNext.classList.toggle('show', alleyStep().kind === 'show');
    egPositionBubble();
    setTimeout(function(){ appGuideBubble.style.transition = ''; }, 300);
  }
  // 보여주기 단계의 [다음] (또는 테두리 범위 클릭) → 다음 단계
  function alleyNext(){
    if(!alleyGuide || !alleyGuide.shown || alleyStep().kind !== 'show' || !appGuideNext.classList.contains('show')) return;
    if(alleyGuide.key === 'fridge') showFridgeMissionStep(alleyGuide.step + 1); else showLaundryMissionStep(alleyGuide.step + 1);
  }
  function hideAlleyGuide(){
    if(!alleyGuide) return;
    alleyGuide = null;
    clearInterval(alleyRectTimer);
    eg.active = false; eg.frame = null; eg.rect = null;
    hideGuideBubbleNow();
  }
  // 미션이 끝나 폰(서랍)이 닫힐 때 말풍선이 0.25초 동안 서서히 사라지면 폰보다 늦게 남아 폰 밖에 떠 보인다 → 즉시 숨긴다
  function hideGuideBubbleNow(){
    appGuideNext.classList.remove('show');
    appGuideBubble.style.transition = 'none';
    appGuideBubble.classList.remove('show');
    void appGuideBubble.offsetWidth;
    appGuideBubble.style.transition = '';
  }

  // 금전형(S)은 미션 중에만 오른쪽 앱을 펼치고, 그 외엔 집만 가운데에 둔다.
  // 접고 펼치는 애니메이션이 끝나면 resize를 보내 게임 화면·앱·가이드 위치를 다시 계산하게 한다.
  // 미션 중(냉장고·세탁물·규칙형 미션1·2)엔 게임 화면 잠금
  // 미션 중(냉장고·세탁물·서은민 앱 미션 = 서랍이 열려 있는 동안)엔 게임 화면과 헤더 유형 탭을 잠근다
  function missionInProgress(){ return fridgeMissionActive || laundryMissionActive || document.body.classList.contains('app-drawer-open'); }
  function syncGameLock(){ updateRoomLock(); }
  function syncHouseOnly(){
    // 강은지(S)는 미션 중에만 서랍(폰)을 연다 - 팀원 버전의 house-only 접기 대신 서랍 레이아웃을 쓴다
    if(currentMateType === 'S') setDrawerOpen(fridgeMissionActive || laundryMissionActive || agendaRunning);
    syncGameLock();
    // 미션이 바뀔 때마다 앱에 알려 지금 미션 카드만 열리게 한다 (냉장고 = 반찬가게만, 세탁물 = 세탁소만)
    if(appAlleyFrame && appAlleyFrame.contentWindow){
      appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'mission', mission: fridgeMissionActive ? 'fridge' : (laundryMissionActive ? 'laundry' : null) }, '*');
    }
  }
  document.querySelector('.cohabit-right').addEventListener('transitionend', function(e){
    if(e.propertyName === 'flex-grow') window.dispatchEvent(new Event('resize'));
  });

  function endFridgeMissionTour(){
    fridgeMissionActive = false;
    if(alleyGuide && alleyGuide.key === 'fridge') hideAlleyGuide();
    syncHouseOnly();
    guideSpotlight.classList.remove('show');
    guideTooltip.classList.remove('show');
    guideTooltipClose.style.display = '';
  }

  // 세탁물 미션도 미션1처럼 안내 가이드 없이 앱만 펼친다 - 눌러야 할 카드는 앱이 빛나게 강조(app_1 updatePulse)
  function showLaundryMissionStep(step){
    laundryMissionStep = step;
    showAlleyGuide('laundry', step);
  }

  function endLaundryMissionTour(){
    laundryMissionActive = false;
    if(alleyGuide && alleyGuide.key === 'laundry') hideAlleyGuide();
    syncHouseOnly();
    guideSpotlight.classList.remove('show');
    guideTooltip.classList.remove('show');
    guideTooltipClose.style.display = '';
  }

  // 부엌 미니게임(kitchen_script.js)이 "냉장고 내부를 확인했다"고 알려오면 투어 시작
  window.addEventListener('kitchen:fridge-checked', function(){
    if(fridgeMissionActive || fridgeMissionDone) return;
    // 관람객이 상태 이상을 누르기 전에 틈 앱을 미리 둘러보다가 상세 페이지를 열어둔 채로
    // 남아있을 수 있으므로, 투어를 시작하기 전에 항상 골목생활 목록 처음 화면으로 되돌린다
    // (안내 팝업이 엉뚱한 화면에서 뜨는 문제 방지 - 다용도실 이동 때와 같은 reset-view 사용).
    if(appAlleyFrame && appAlleyFrame.contentWindow){
      appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'reset-view' }, '*');
    }
    fridgeMissionActive = true;
    syncHouseOnly();
    appShowScreen('alley');
    showFridgeMissionStep(0);
  });

  // 아이소메트릭(부엌) 쪽 축하 팝업의 "확인" 버튼을 누르면(kitchen_script.js에서 발생)
  // 미션1을 최종적으로 완료 처리한다 - fridgeMissionDone은 이 스크립트 쪽 변수라서
  // 직접 못 만지는 kitchen_script.js는 이벤트로만 알려줄 수 있다.
  window.addEventListener('kitchen:mission1-complete', function(){
    fridgeMissionDone = true;
  });

  // 다용도실 미니게임(kitchen_script.js)이 "세탁물 더미를 확인했다"고 알려오면 투어 시작
  window.addEventListener('kitchen:laundry-checked', function(){
    if(laundryMissionActive || laundryMissionDone) return;
    // 냉장고 미션과 마찬가지로, 상태 이상을 누르기 전에 미리 둘러본 상태(상세 페이지가
    // 열려있는 등)를 처음 화면으로 되돌린 뒤에 투어를 시작한다.
    if(appAlleyFrame && appAlleyFrame.contentWindow){
      appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'reset-view' }, '*');
    }
    laundryMissionActive = true;
    syncHouseOnly();
    appShowScreen('alley');
    showLaundryMissionStep(0);
  });

  // 다용도실로 이동하면 폰 화면(틈 앱)을 [골목 생활] 처음 화면으로 되돌린다 - 다음 미션(빨래)을
  // 바로 이어서 진행하기 좋도록. 미션1(반찬 구독)을 끝내고 넘어올 때 골목생활 화면이 이전
  // 상세 페이지에 그대로 멈춰 있으면, 그 화면 안에서 [생활빨래 정기권] 카드 위치를 잴 수
  // 없어서(상세 페이지에 가려 화면에 없으므로) 미션2 스포트라이트가 엉뚱한 자리(0,0)에 뜨는
  // 문제도 함께 있었다 - 화면을 초기화하면 자연히 해결된다.
  window.addEventListener('kitchen:room-changed-utility', function(){
    appShowScreen('alley');
    if(appAlleyFrame && appAlleyFrame.contentWindow){
      appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'reset-view' }, '*');
    }
  });

  // app_1(iframe) 안에서 일어나는 클릭은 postMessage로 전달받는다 (app_1/index.html의
  // notifyParent() 참고). e.data.source로 우리가 보낸 메시지인지 먼저 확인한다.
  window.addEventListener('message', function(e){
    var data = e.data;
    if(!data || data.source !== 'teum-app1' || !appAlleyFrame) return;
    if(e.source !== appAlleyFrame.contentWindow) return;
    // 단체권을 눌러 미션이 끝나면 키보드 초점을 앱에서 게임으로 되돌린다 - 안 그러면 Enter로 축하 대화를 못 넘김
    if(data.type === 'group-subscribe' || data.type === 'laundry-group-subscribe'){ appAlleyFrame.blur(); window.focus(); }

    if(data.type === 'detail-opened'){
      // ① [정기 반찬 구독권] 카드를 눌러 상세 화면으로 들어감 -> ②단계 안내로 전환
      if(fridgeMissionActive && alleyGuide && alleyGuide.key === 'fridge' && alleyStep().target === 'card' && data.cat === 'restaurant'){
        showFridgeMissionStep(fridgeMissionStep + 1);
      }
      // ① [생활빨래 정기권] 카드를 눌러 상세 화면으로 들어감 -> ②단계 안내로 전환
      if(laundryMissionActive && alleyGuide && alleyGuide.key === 'laundry' && alleyStep().target === 'card' && data.cat === 'laundry'){
        showLaundryMissionStep(laundryMissionStep + 1);
      }
    } else if(data.type === 'group-subscribe'){
      // ② [정기 반찬 단체 구독권]을 눌러 공동 구독 신청 완료 → 메이트에게 가는 알림을 짚어 준 뒤([완료]) 부엌 쪽 축하로
      if(fridgeMissionDone || alleyNotiFinish) return;
      showAlleyNoti('fridge', function(){
        endFridgeMissionTour();
        window.dispatchEvent(new CustomEvent('kitchen:show-celebrate'));
      });
    } else if(data.type === 'laundry-group-subscribe'){
      // ② [생활빨래 단체권]을 눌러 공동 구독 신청 완료 - 투어를 마치고 세탁물 미션을 완료 처리한다.
      // 미션1과 마찬가지로, 폭죽 효과 + 캐릭터 대화창으로 축하 연출을 보여준다
      // (kitchen_script.js의 showLaundryCelebrate 참고).
      if(laundryMissionDone || alleyNotiFinish) return;
      showAlleyNoti('laundry', function(){
        endLaundryMissionTour();
        laundryMissionDone = true;
        window.dispatchEvent(new CustomEvent('kitchen:laundry-resolved'));
        window.dispatchEvent(new CustomEvent('kitchen:show-laundry-celebrate'));
      });
    } else if(data.type === 'guide-enter'){
      guidePress();
    } else if(data.type === 'show-next'){
      alleyNext(); // 보여주기 단계에서 테두리 범위를 눌러도 [다음]과 같다
    } else if(data.type === 'rect-report'){
      // 강은지 안내 말풍선 높이를 지금 단계 버튼에 맞춘다
      if(alleyGuide && alleyGuide.shown && data.rect && data.step === alleyGuide.step && (data.mission || 'fridge') === ALLEY_GUIDE[alleyGuide.key].mission){
        eg.rect = data.rect; egPositionBubble(); // 띄운 뒤엔 대상 위치를 따라간다
      } else if(alleyGuide && !alleyGuide.shown && data.rect && data.step === alleyGuide.step && (data.mission || 'fridge') === ALLEY_GUIDE[alleyGuide.key].mission){
        eg.rect = data.rect;
        var now = Date.now();
        var key = [data.rect.top, data.rect.left, data.rect.width, data.rect.height].map(Math.round).join(',');
        if(!alleyGuide.minDelay){ revealAlleyGuide(); } // 큰 애니메이션이 없는 단계는 바로 (규칙형처럼)
        else if(key !== alleyGuide.last){ alleyGuide.last = key; alleyGuide.stableSince = now; }
        else if(now - alleyGuide.stableSince >= ALLEY_STABLE_MS && now - alleyGuide.startedAt >= alleyGuide.minDelay){
          revealAlleyGuide();
        }
      }
      // 안내 중인 단계와 일치하는 응답만 반영 (다른 단계로 이미 넘어갔는데 늦게 도착한
      // 응답이 화면을 엉뚱하게 감싸는 걸 방지) - mission으로 반찬/세탁 투어를 구분한다.
      if(data.mission === 'laundry'){
        if(laundryMissionActive && data.step === laundryMissionStep && data.rect){
          positionGuideFromIframeRect(data.rect);
        }
      } else if(fridgeMissionActive && data.step === fridgeMissionStep && data.rect){
        positionGuideFromIframeRect(data.rect);
      }
    }
  });

  // 합의서 화면(agreement_newhome_auto.html)에서 서명(3/3의 '합의 완료' 버튼)이 끝나면
  // 보내주는 신호. 이걸 받아야 비로소 실제 동거 메인 화면(골목생활/홈)으로 넘어가고
  // 게임 설명 팝업(온보딩)을 띄운다 - startCohabitBtn 클릭 시점에는 아직 서명 전이므로
  // 미뤄뒀던 부분.
  window.addEventListener('message', function(e){
    var data = e.data;
    if(!data || data.source !== 'teum-agreement' || !appAgreementFrame) return;
    var fromStage = (e.source === stageAgreementFrame.contentWindow); // 금전형: 매칭 화면에서 쓴 합의서
    if(!fromStage && e.source !== appAgreementFrame.contentWindow) return;

    if(fromStage && data.type === 'progress'){
      if(data.step === 'role'){
        say('me', ROLE_LINE[AGREEMENT_SRC]);
        // 새집: 내 말에 메이트가 2.5초 뒤 이어서 답한다
        if(AGREEMENT_SRC === NEWHOME) sayTimer = setTimeout(function(){ say('mate', '필요한 건 서로 조율하면서 맞춰봐요.'); }, 2500);
      }
      // 임대인(나): 내 말풍선을 2/3 방 사진까지 유지하고, 거기서 메이트(임차인)가 답한다
      if(data.step === 'photos' && AGREEMENT_SRC === GIVER){
        say('mate', '작성해주시면 확인하고 서명해둘게요.');
      }
      // 서명 직전엔 내가 말한다. 임차인(TAKER)은 편집 없이 보기만 하므로 '작성했어요'가 아니라 '확인했어요'
      // 서명을 그리면 → '서명 완료'를, 서명칸에 들어가면 → '합의 완료' 버튼을 누르라고 안내
      if(data.step === 'inked') say('mate', "서명을 다 했으면\n'서명 완료'를 눌러주세요!");
      if(data.step === 'signed') say('mate', "이제 합의 완료 버튼을 눌러서\n틈새살이를 시작해봐요!");
      if(data.step === 'sign') say('me', AGREEMENT_SRC === TAKER ? '합의서 내용 확인 다 했어요! 이제 서명만 하면 됩니다!' : '합의서 모두 작성했어요. 이제 서명만 하면 됩니다!');
      return;
    }
    if(data.type === 'agreement-signed'){
      if(fromStage){
        say(null);
        stageWrap.classList.add('fading-out');
        setTimeout(function(){
          enterCohabit(false);
          cohabitView.classList.add('fade-in');
          stageWrap.classList.remove('fading-out');
          revealPanel.classList.remove('agreeing', 'agree-prep');
          stageAgreementFrame.src = 'about:blank';
          showMainAfterAgreement();
        }, 700);
        return;
      }
      showMainAfterAgreement();
    }
  });

  var agreementSigned = false; // 유형 탭으로 옮겨갈 때 합의서를 다시 쓸지 결정
  function showMainAfterAgreement(skipOnboarding){
    agreementSigned = true;
    appShowScreen(pendingMainScreen);
    // 골목생활로 넘어가는 경우, 항상 지도+목록 맨 위(메인 화면)로 고정해서 보여준다.
    if(pendingMainScreen === 'alley' && appAlleyFrame && appAlleyFrame.contentWindow){
      appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'reset-view' }, '*');
    }
    if(skipOnboarding){ window.dispatchEvent(new CustomEvent('kitchen:game-start')); return; }
    // 예전 '환영합니다!' 안내 팝업(onboardingOverlay) 대신 메이트가 대화창으로 맞이한다 (부엌 스크립트의 kitchen:welcome).
    // 대화를 다 넘기면 kitchen:game-start가 나가 게임이 시작된다.
    window.dispatchEvent(new CustomEvent('kitchen:welcome', { detail:{ name: currentMateName,
      role: AGREEMENT_SRC === TAKER ? 'taker' : (AGREEMENT_SRC === GIVER ? 'giver' : 'newhome') } }));
  }

  /* ---------- 서은민(A) 전용 태블릿 홈 메뉴 ---------- */
  var eunminRulesCard = document.getElementById('eunminRulesCard');
  var eunminLivingCard = document.getElementById('eunminLivingCard');
  if(eunminRulesCard){ eunminRulesCard.addEventListener('click', function(){ appShowScreen('rules'); }); }
  if(eunminLivingCard){ eunminLivingCard.addEventListener('click', function(){ appShowScreen('living'); }); }

  /* ---------- 강은지(S)·서은민(A) 서랍 레이아웃 ----------
     룸을 크게 가운데 두고, 틈 앱(폰 목업)은 평소엔 화면 밖에 완전히 숨겨둔다
     (CSS: body.layout-drawer / .app-drawer-open). 관람객이 직접 여닫는 버튼은 없고,
     앱 미션이 시작될 때만 자동으로 밀려 나오면서 룸을 왼쪽으로 함께 밀고, 미션이 끝나면
     다시 들어간다. (팀원 버전의 강은지 'house-only' 접기 방식을 이 서랍으로 대체했다) */
  var cohabitRight = document.getElementById('cohabitRight');

  function isDrawerLayout(){ return document.body.classList.contains('layout-drawer'); }
  function setDrawerLayout(on){
    document.body.classList.toggle('layout-drawer', !!on);
    if(!on) document.body.classList.remove('app-drawer-open');
    updateRoomLock();
    fitAlleyFrame(); // 레이아웃마다 폰 크기·둥글기가 달라서 앱 화면 크기·둥글기를 다시 맞춘다
  }
  // 폰이 열리고 닫힐 때 집 화면이 옆으로 밀리며 살짝 작아진다. 배치는 한 번에 바꾸고(새 자리·크기),
  // 예전 자리에서 새 자리로 가는 모습은 transform으로만 보여 준다(FLIP) - 매 프레임 다시 배치하지 않아 가볍다
  var roomStage = document.getElementById('kitchenRoomStage');
  function setDrawerOpen(open){
    if(!isDrawerLayout()) return;
    if(!open && typeof hideGuideBubbleNow === 'function') hideGuideBubbleNow(); // 폰이 닫힐 땐 말풍선이 남아 폰 밖에 떠 보이지 않게
    var changed = document.body.classList.contains('app-drawer-open') !== !!open;
    var from = changed && roomStage ? roomStage.getBoundingClientRect() : null;
    document.body.classList.toggle('app-drawer-open', !!open);
    if(from && from.width){
      roomStage.style.transition = 'none';
      roomStage.style.transform = '';
      var to = roomStage.getBoundingClientRect();
      if(to.width){
        roomStage.style.transformOrigin = '50% 50%';
        roomStage.style.transform = 'translate(' + ((from.left + from.width / 2) - (to.left + to.width / 2)) + 'px,' +
          ((from.top + from.height / 2) - (to.top + to.height / 2)) + 'px) scale(' + (from.width / to.width) + ')';
        roomStage.getBoundingClientRect(); // 시작 모습을 확정한 뒤에 움직인다
        roomStage.style.transition = 'transform .55s cubic-bezier(.33,0,.2,1)'; // 폰 서랍(game.html --drawer-ease)과 같은 곡선·시간
        roomStage.style.transform = '';
      }
    }
    updateRoomLock();
  }
  if(cohabitRight){
    // 서랍이 다 열리거나 닫힌 뒤, 안내 스포트라이트가 바뀐 폰 위치를 다시 잡도록 알려준다
    cohabitRight.addEventListener('transitionend', function(e){
      if(e.target === cohabitRight && e.propertyName === 'transform'){
        window.dispatchEvent(new Event('resize'));
      }
    });
  }
  window.addEventListener('kitchen:eunmin-mission1-complete', function(){ setDrawerOpen(false); });
  window.addEventListener('kitchen:eunmin-mission2-done', function(){ setDrawerOpen(false); });

  /* ---------- 상단 푸시 알림 (Figma 알림 배너) ----------
     폰 화면 위에서 내려와 ① 앱 이름·시각 → ② 제목 → ③ 본문까지 펼쳐졌다가 접히며 올라간다. */
  var appTopToast = document.getElementById('appTopToast');
  var appTopToastTimers = [];
  // hold: 가이드가 알림을 설명하는 동안엔 펼친 채로 두고, 가이드가 hideTopNotification()으로 올린다
  function showTopNotification(title, body, hold){
    if(!appTopToast) return;
    appTopToastTimers.forEach(clearTimeout);
    document.getElementById('appTopToastTime').textContent = '오후 9:30'; // 앱 화면 상태바 시각과 같게
    document.getElementById('appTopToastTitle').textContent = title;
    document.getElementById('appTopToastBody').textContent = body || '';
    // Figma 배너는 화면 폭 517 기준 - 폰 화면 폭에 맞춰 통째로 줄인다
    appTopToast.style.zoom = appTopToast.parentNode.clientWidth / 517;
    appTopToast.classList.remove('titled', 'open');
    appTopToast.classList.add('show');
    var at = function(ms, fn){ appTopToastTimers.push(setTimeout(fn, ms)); };
    at(500, function(){ appTopToast.classList.add('titled'); });
    if(body) at(1300, function(){ appTopToast.classList.add('open'); });
    if(!hold) at(5600, hideTopNotification);
  }
  function hideTopNotification(){
    appTopToastTimers.forEach(clearTimeout);
    appTopToast.classList.remove('open');
    appTopToastTimers = [setTimeout(function(){ appTopToast.classList.remove('show', 'titled'); }, 400)];
  }
  // 배너가 펼쳐지며 높이가 바뀌면 가리키는 말풍선 높이도 따라간다
  if(appTopToast) appTopToast.addEventListener('transitionend', function(){ if(eg.pointEl === appTopToast) egPositionBubble(); });

  /* =========================================================
     서은민(A) 미션 가이드 (틈 앱 화면 = app_2 우리 규칙 / app_3 틈새살림)
     - 가이드 판단(하이라이트·클릭 잠금·자동입력)은 각 앱 iframe 안의 app-guide-bridge.js가
       직접 처리한다. 여기서는 "지금 몇 번째 단계, 무엇을 하라"는 대본만 내려보내고,
       폰 왼쪽 말풍선(#appGuideBubble)에 설명을 띄운다.
     - 미션 진행 중에는 지금 눌러야 할 버튼 하나만 눌린다(나머지 클릭/입력은 앱 안에서 차단).
     - 자동 입력/설정 단계(show)는 내용을 다 보여준 뒤 [다음]을 눌러야 넘어간다.
     - 부엌 싱크대(설거지) → 규칙 추가 미션, 쓰레기통(분리수거) → 체크 미션. 먼저 누른 쪽을
       끝내면 안내 말풍선으로 다른 미션을 소개하고 이어서 진행한다. 둘 다 끝나면
       kitchen:eunmin-mission1-complete(폭죽 + 깨끗한 부엌)로 넘어간다.
     ========================================================= */
  var appGuideCol = document.getElementById('appGuideCol');
  var appGuideBubble = document.getElementById('appGuideBubble');
  var appGuideChip = document.getElementById('appGuideChip');
  var appGuideProgress = document.getElementById('appGuideProgress');
  var appGuideText = document.getElementById('appGuideText');
  var appGuideNext = document.getElementById('appGuideNext');

  var eg = { active:false, frame:null, label:'', steps:[], idx:-1, id:0, rect:null, onFinish:null, pointEl:null };

  function egSend(msg){
    if(!eg.frame || !eg.frame.contentWindow) return;
    msg.source = 'teum-parent';
    eg.frame.contentWindow.postMessage(msg, '*');
  }
  function egCountable(s){ return s.kind === 'click' || s.kind === 'show' || s.kind === 'noti'; }
  function egProgressText(){
    var total = eg.steps.filter(egCountable).length;
    var n = eg.steps.slice(0, eg.idx + 1).filter(egCountable).length;
    return total > 1 ? (n + ' / ' + total) : '';
  }
  function egShowBubble(chip, progress, html, hasArrow){
    appGuideChip.textContent = chip;
    appGuideProgress.textContent = progress;
    appGuideText.innerHTML = window.teumWrap(html, true);
    window.teumBalance(appGuideText);
    appGuideBubble.classList.toggle('no-arrow', !hasArrow);
    appGuideBubble.classList.add('show');
    egPositionBubble();
  }
  // 말풍선을 대상 버튼 높이에 맞춘다(대상이 없으면 폰 가운데). 화살표는 대상 높이를 가리킨다.
  function egPositionBubble(){
    if(!appGuideCol || !appGuideBubble.classList.contains('show')) return;
    var col = appGuideCol.getBoundingClientRect();
    var h = appGuideBubble.offsetHeight;
    var cy = col.height / 2;
    if(eg.pointEl){ // 앱 밖(부모 화면)의 대상 - 상단 알림 배너
      var pr = eg.pointEl.getBoundingClientRect();
      cy = pr.top + pr.height / 2 - col.top;
    } else if(eg.rect && eg.frame){
      var fb = eg.frame.getBoundingClientRect();
      var scale = fb.width / 412;
      cy = fb.top + (eg.rect.top + eg.rect.height / 2) * scale - col.top;
    }
    var top = Math.min(Math.max(cy - h / 2, 8), Math.max(8, col.height - h - 8));
    appGuideBubble.style.top = top + 'px';
    appGuideBubble.style.setProperty('--arrow-y', Math.min(Math.max(cy - top, 20), h - 20) + 'px');
  }
  function egStart(frame, label, steps, onFinish){
    eg.active = true;
    eg.frame = frame;
    eg.label = label;
    eg.steps = steps;
    eg.idx = -1;
    eg.onFinish = onFinish;
    egNext();
  }
  function egNext(){
    eg.idx++;
    eg.id++;
    eg.rect = null;
    if(eg.pointEl){ eg.pointEl.classList.remove('guided'); eg.pointEl = null; }
    appGuideNext.classList.remove('show');
    var s = eg.steps[eg.idx];
    if(!s){
      var done = eg.onFinish; eg.onFinish = null;
      if(done) done();
      return;
    }
    if(s.kind === 'action'){
      egSend({ type:'guide-action', id:eg.id, action:s.action, value:s.value });
      return;
    }
    if(s.kind === 'note'){
      // 미션 사이 안내 - 앱 하이라이트는 끄되 잠금은 유지한다
      egSend({ type:'guide-hold' });
      egShowBubble(s.chip || eg.label, '', s.text, false);
      appGuideNext.textContent = s.nextLabel || '다음 ▶';
      appGuideNext.classList.add('show');
      egPositionBubble();
      return;
    }
    if(s.kind === 'noti'){
      // 상단 알림 배너를 가리킨다 - 앱 하이라이트는 끄고 잠금만 유지, 배너는 [다음]을 누를 때까지 펼쳐 둔다
      egSend({ type:'guide-hold' });
      eg.pointEl = appTopToast;
      appTopToast.classList.add('guided');
      egShowBubble(eg.label, egProgressText(), s.text, true);
      appGuideNext.textContent = '다음 ▶';
      appGuideNext.classList.add('show');
      return;
    }
    egShowBubble(eg.label, egProgressText(), s.text, true);
    // 미션의 마지막 단계(뒤에 누르기·보여주기 단계가 더 없음)면 버튼은 '완료'
    appGuideNext.textContent = eg.steps.slice(eg.idx + 1).some(egCountable) ? '다음 ▶' : '완료';
    egSend({ type:'guide', id:eg.id, mode:s.kind, target:s.target, action:s.action, value:s.value,
             after:s.after, afterValue:s.afterValue, skipIf:s.skipIf });
  }
  function egStop(){
    if(eg.frame) egSend({ type:'guide-off' });
    eg.active = false;
    eg.frame = null;
    eg.onFinish = null;
    eg.rect = null;
    if(eg.pointEl){ eg.pointEl.classList.remove('guided'); eg.pointEl = null; }
    hideGuideBubbleNow();
  }
  // 금전형 보여주기 단계의 [다음] → 단체권 누르기 단계
  appGuideNext.addEventListener('click', function(){
    alleyNext();
  });
  // 금전형 마지막 알림 단계(showAlleyNoti)의 [완료]
  appGuideNext.addEventListener('click', function(){
    if(!alleyNotiFinish) return;
    var f = alleyNotiFinish; alleyNotiFinish = null;
    appTopToast.classList.remove('guided'); eg.pointEl = null;
    hideTopNotification();
    f();
  });
  appGuideNext.addEventListener('click', function(){
    var s = eg.steps[eg.idx];
    if(!eg.active || !s || !appGuideNext.classList.contains('show')) return;
    if(s.kind === 'noti') hideTopNotification(); // 알림 설명을 마치면 배너를 접어 올린다
    if(s.kind === 'show' || s.kind === 'note' || s.kind === 'noti') egNext();
  });
  window.addEventListener('message', function(e){
    var d = e.data;
    if(!d || d.source !== 'teum-guide' || !eg.active || !eg.frame) return;
    if(e.source !== eg.frame.contentWindow) return;
    var s = eg.steps[eg.idx];
    if(d.type === 'guide-rect'){ eg.rect = d.rect; egPositionBubble(); return; }
    if(d.type === 'guide-enter'){ guidePress(); return; }
    if(d.type === 'guide-blocked'){
      appGuideBubble.classList.remove('shake'); void appGuideBubble.offsetWidth; appGuideBubble.classList.add('shake');
      return;
    }
    if(d.id !== eg.id || !s) return;
    if(d.type === 'guide-ready' && s.kind === 'show'){
      appGuideNext.classList.add('show');
      egPositionBubble();
    } else if(d.type === 'guide-next' && s.kind === 'show' && appGuideNext.classList.contains('show')){
      egNext(); // 하이라이트 범위를 눌러도 [다음]과 같다
    } else if(d.type === 'guide-done' && s.kind === 'click'){
      if(d.skipped){
        // 이미 그 상태라 건너뛴 단계는 진행도(n / 전체)에서도 빼준다
        eg.steps = eg.steps.slice(0, eg.idx).concat(eg.steps.slice(eg.idx + 1));
        eg.idx--;
      } else if(s.onDone){
        s.onDone();
      }
      egNext();
    } else if(d.type === 'action-done' && s.kind === 'action'){
      egNext();
    }
  });

  // 앱 미션 가이드도 대화창처럼: Enter(게임·앱 어디서든)나 말풍선을 누르면 지금 단계를 진행한다
  // 보여주기·안내·알림 단계 = [다음]/[완료], 누르기 단계 = 테두리 친 버튼을 누른 것과 같다
  function guidePress(){
    if(!appGuideBubble.classList.contains('show')) return;
    if(appGuideNext.classList.contains('show')){ appGuideNext.click(); return; }
    if(alleyGuide){
      if(alleyGuide.shown && alleyStep().kind === 'click' && appAlleyFrame && appAlleyFrame.contentWindow)
        appAlleyFrame.contentWindow.postMessage({ source:'teum-parent', type:'press-guide' }, '*');
      return;
    }
    var s = eg.active && eg.steps[eg.idx];
    if(s && s.kind === 'click') egSend({ type:'press-guide' });
  }
  appGuideBubble.addEventListener('click', function(e){
    if(!appGuideNext.contains(e.target)) guidePress(); // [다음] 버튼은 자기 클릭으로 처리
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' || e.isComposing || e.repeat || e.defaultPrevented || !appGuideBubble.classList.contains('show')) return; // defaultPrevented = 대화창이 이미 이 Enter를 썼다
    if(document.querySelector('#kitchenDialogue.show')) return; // 대화창이 떠 있으면 대화가 먼저
    var t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault(); // [다음]에 초점이 있어도 두 번 눌리지 않게
    guidePress();
  });

  function mateName(){ return currentMateName || '메이트'; }

  /* ---------- 미션1 대본: 설거지 규칙 추가 / 분리수거 체크 ---------- */
  var DISH_RULE_TEXT = '밥을 먹은 사람이 30분 안에 바로 설거지하기';
  // 첫 단계([가사] 탭)에 [우리 규칙] 소개 - 두 번째 미션에선 이미 가사 탭이라 건너뛰지만 첫 미션에서 이미 봤다
  var RULES_INTRO = '<b>[우리 규칙]</b>에서는 집안일 규칙과\n담당을 정해요. <b>[가사]</b> 탭을 눌러보세요.';
  function dishSteps(){
    return [
      { kind:'action', action:'reset-view' },
      { kind:'action', action:'set-mate', value:mateName() }, // 앱 속 '서은민'을 지금 메이트 이름으로 (서민호)
      { kind:'click', target:'choreTab', skipIf:'active', text:RULES_INTRO },
      { kind:'click', target:'fab',
        text:'<b>[+]</b> 버튼을 눌러\n새 집안일 규칙을 만들어보세요.' },
      { kind:'click', target:'title', after:'type-title', afterValue:'설거지',
        text:'<b>[제목 칸]</b>을 눌러\n규칙 이름을 적어보세요.' },
      { kind:'show', target:'title',
        text:'제목 <b>\'설거지\'</b>에 맞는 아이콘이\n자동으로 붙어 한눈에 알아볼 수 있어요.' },
      { kind:'show', target:'who', action:'pick-who', value:'나',
        text:'<b>담당자</b>는 <b>\'나\'</b>로 정했어요.\n누가 맡을지 정해 두면 서로 미루지 않아요.' },
      { kind:'show', target:'cycle', action:'pick-cycle',
        text:'<b>담당 주기</b>로 얼마나 자주 할지\n정해요. <b>\'1일마다\'</b>로 정했어요.' },
      { kind:'click', target:'aiChip', // 제목이 '설거지'라 첫 칩 = DISH_RULE_TEXT (app_2 SUGGEST.chore['설거지'])
        text:'<b>[AI 규칙 추천]</b>으로 규칙 내용을\n추천받고, 고쳐서 쓸 수도 있어요.\n추천 문구를 눌러보세요.' },
      { kind:'show', target:'content',
        text:'<b>규칙 내용</b>에 지킬 방법이 채워졌어요.\n<b>\'' + DISH_RULE_TEXT + '\'</b>' },
      { kind:'click', target:'submit',
        text:'<b>[등록하기]</b>를 눌러\n규칙을 저장해보세요.' },
      { kind:'show', target:'dishCard',
        text:'규칙이 등록됐어요.\n' + mateName() + '님 앱에도 똑같이 보여서\n함께 확인할 수 있어요.' }
    ];
  }
  function recycleSteps(){
    return [
      { kind:'action', action:'reset-view' },
      { kind:'action', action:'set-mate', value:mateName() },
      { kind:'action', action:'uncheck-recycle' },
      { kind:'click', target:'choreTab', skipIf:'active', text:RULES_INTRO },
      { kind:'show', target:'recycleCard',
        text:'카드에서 담당자를 확인해요.\n<b>[분리 수거]</b>는 이번 주 <b>\'나\'</b> 담당이에요.' },
      { kind:'click', target:'recycleChk',
        text:'다 했으면 <b>[체크]</b> 버튼을 눌러\n완료 표시를 해보세요.' },
      { kind:'show', target:'rate',
        text:'<b>완료율</b>로 나와 메이트가 집안일을\n얼마나 했는지 한눈에 봐요.' }
    ];
  }
  var EUNMIN_TASK_LABEL = { dish:'설거지 규칙 만들기', recycle:'분리수거 체크하기' };
  var EUNMIN_TASK_NEXT_TEXT = {
    dish:'이어서 <b>분리수거</b>를 체크해볼게요.',
    recycle:'이어서 <b>설거지 규칙</b>을 만들어볼게요.'
  };
  var EUNMIN_OTHER_TASK = { dish:'recycle', recycle:'dish' };
  var eunminTasksDone = { dish:false, recycle:false };
  var eunminTaskRunning = null;

  function runEunminTask(task){
    eunminTaskRunning = task;
    egStart(appRulesFrame, EUNMIN_TASK_LABEL[task], task === 'dish' ? dishSteps() : recycleSteps(), function(){
      eunminTasksDone[task] = true;
      window.dispatchEvent(new CustomEvent('kitchen:eunmin-task-done', { detail:{ task:task } })); // 부엌의 설거지 더미/쓰레기를 치운다
      var other = EUNMIN_OTHER_TASK[task];
      if(!eunminTasksDone[other]){
        egStart(appRulesFrame, '다음 미션', [{ kind:'note', text:EUNMIN_TASK_NEXT_TEXT[task], nextLabel:'좋아요, 이어서 할게요 ▶' }], function(){
          // 게임 쪽에서 아바타가 다음 미션 자리(싱크대/쓰레기통)로 걸어가는 동안엔 안내를 숨기고(앱 잠금은 유지) 도착하면 이어서 시작한다.
          // 게임이 걸어가지 않으면(wait를 안 켜면) 바로 시작
          hideGuideBubbleNow();
          egSend({ type:'guide-hold' });
          var d = { task:other, wait:false, ready:function(){ if(d.started) return; d.started = true; runEunminTask(other); } };
          window.dispatchEvent(new CustomEvent('kitchen:eunmin-task-begin', { detail:d }));
          if(!d.wait) d.ready();
        });
      } else {
        eunminTaskRunning = null;
        egStop();
        window.dispatchEvent(new CustomEvent('kitchen:eunmin-mission1-complete'));
      }
    });
  }

  // 아이소메트릭 부엌에서 싱크대(dish)/쓰레기통(recycle) 상태이상을 확인하면 시작한다.
  window.addEventListener('kitchen:eunmin-task-start', function(e){
    var task = e.detail && e.detail.task;
    if(!task || eunminTaskRunning || eunminTasksDone[task]) return;
    appShowScreen('rules');
    setDrawerOpen(true);
    runEunminTask(task);
  });

  // 거실로 넘어가면 태블릿 화면을 [틈새살림]으로 바꿔둔다(서랍은 종이를 눌러야 열린다).
  window.addEventListener('kitchen:room-changed-livingroom', function(){
    appShowScreen('living');
  });

  /* ---------- 미션2 대본: 금액 정산 요청 ---------- */
  var eunminMission2Notified = false;
  function eunminMission2Steps(){
    var m = mateName();
    return [
    { kind:'action', action:'reset-view' },
    { kind:'click', target:'pay',
      text:'<b>[틈새살림]</b>에서는 생활비를\n함께 관리해요. <b>[금액 정산]</b> 카드를 눌러보세요.' },
    { kind:'show', target:'items',
      text:'등록한 고지서와 지출이\n<b>항목별</b>로 자동 정리돼요.' },
    { kind:'show', target:'total',
      text:'전체 금액을 메이트와 나눠\n내가 낼 금액 <b>\'390,905원\'</b>이 계산됐어요.' },
    { kind:'click', target:'cta',
      text:'메이트에게 정산을 요청해요.\n아래 <b>[정산 진행하기]</b>를\n눌러보세요.' }, // 버튼 이름 '이번 달 금액 정산 진행하기'는 말풍선 한 줄보다 길어 줄여 부른다
    { kind:'noti',
      text:m + '님께 <b>정산 요청 알림</b>을 보냈어요.\n' + m + '님도 정산일과 금액을\n바로 확인할 수 있어요.' },
    { kind:'show', target:'edit',
      text:'금액이 틀리면 <b>[수정하기]</b>로\n직접 고칠 수 있어요.' },
    { kind:'show', target:'sect1',
      text:'<b>지출 분석</b>으로 지난달과 비교해\n어디에 더 썼는지 확인해요.' },
    { kind:'show', target:'sect2',
      text:'<b>구독 점검</b>으로 안 쓰는 구독을 찾아\n고정 지출을 줄여요.' }
    ];
  }
  var eunminMission2Guiding = false;
  function eunminMission2Complete(){
    if(eunminMission2Notified) return;
    eunminMission2Notified = true;
    window.dispatchEvent(new CustomEvent('kitchen:eunmin-mission2-done'));
  }
  window.addEventListener('kitchen:eunmin-paper-checked', function(){
    appShowScreen('living');
    setDrawerOpen(true);
    if(eunminMission2Notified || eg.active) return;
    eunminMission2Guiding = true;
    // 정산 버튼을 누른 뒤 아래 분석까지 다 소개하고 나서 미션2를 완료한다
    egStart(appLivingFrame, '금액 정산 요청하기', eunminMission2Steps(), function(){
      eunminMission2Guiding = false;
      egStop();
      eunminMission2Complete();
    });
  });

  // app_3에서 [이번 달 금액 정산 진행하기]를 누르면 오는 신호 - 알림을 띄우고 미션2를 완료한다.
  // 배너는 내 폰에 뜨는 '보냈어요' 확인 알림 (메이트가 받는 알림처럼 보이지 않게). 금전형 showAlleyNoti도 같다
  window.addEventListener('message', function(e){
    var data = e.data;
    if(!data || data.source !== 'teum-app3' || !appLivingFrame) return;
    if(e.source !== appLivingFrame.contentWindow) return;
    if(data.type === 'settle-requested'){
      // 메이트에게 정산 요청을 보냈다는 알림 배너 (Figma 알림 배너 모양)
      showTopNotification(mateName() + '님에게 정산 요청 알림을 보냈어요!', '정산일은 4월 28일이에요. ' + mateName() + '님이 금액을 확인하고\n앱에서 바로 납부할 수 있어요.',
                          eunminMission2Guiding && eg.active); // 가이드 중이면 알림 설명 단계(noti)가 끝날 때까지 펼쳐 둔다
      if(!(eunminMission2Guiding && eg.active)) eunminMission2Complete(); // 가이드 중이면 분석 소개가 끝난 뒤 완료
    }
  });

  /* ---------- 감정형(H) 미션1 대본: 채팅에서 메이트와 전기값 이야기 → [안건 등록] (app_4) ----------
     (예전 미션1 '전기세 안건 확인 → AI 물어보기'는 미션3으로 옮겼다 - AGENDA_CONTENT.H) */
  function emotionTvSteps(){
    var m = mateName();
    return [
      { kind:'action', action:'reset-view' },
      { kind:'action', action:'set-mate', value:{ name:m, face:'../object/mate3/mate_' + (selectedGender === 'male' ? 'men' : 'women') + '_3_hi.png' } },
      { kind:'action', action:'open-chats' },
      { kind:'click', target:'chatMate',
        text:'<b>[채팅]</b>에 ' + m + '님이 보낸\n메시지가 와 있어요.' },
      { kind:'show', target:'chatMsgs', action:'chat-in',
        text:m + '님이 <b>채팅</b>을 보냈어요.\n어려운 얘기도 채팅으로\n편하게 나눠요.' },
      { kind:'show', target:'chatField', action:'chat-type',
        text:'<b>답장</b>을 적었어요.\n고쳐서 보내도 돼요.' },
      { kind:'click', target:'chatSend',
        text:'<b>[보내기]</b>를 눌러\n' + m + '님에게 답해보세요.' },
      { kind:'show', target:'chatMsgs', action:'chat-in',
        text:m + '님이 <b>전기값</b> 얘기를\n꺼냈어요.' },
      { kind:'show', target:'chatField', action:'chat-type',
        text:'궁금한 걸 물어봐요.\n고쳐서 보내도 돼요.' },
      { kind:'click', target:'chatSend',
        text:'<b>[보내기]</b>를 눌러보세요.' },
      { kind:'show', target:'chatMsgs', action:'chat-in',
        text:'같이 정할 일이 생겼네요.\n대화로 끝내지 말고\n<b>안건</b>으로 남겨봐요.' },
      { kind:'click', target:'chatPlus',
        text:'정할 일은 <b>안건</b>으로 올려요.\n<b>[+]</b> 버튼을 눌러보세요.' },
      { kind:'click', target:'chatAgenda',
        text:'<b>[안건 등록]</b>을 누르면\n이 대화가 안건으로 올라가요.' },
      { kind:'show', target:'chatSys',
        text:'<b>안건</b>이 등록됐어요!\n홈 화면 [안건]에서\n함께 의견을 모을 수 있어요.' }
    ];
  }
  var emotionTvDone = false;
  window.addEventListener('kitchen:emotion-tv-start', function(){
    if(eg.active || emotionTvDone) return;
    appShowScreen('emotion');
    setDrawerOpen(true);
    egStart(appEmotionFrame, '전기세 안건 올리기', emotionTvSteps(), function(){
      emotionTvDone = true;
      egStop();
      setDrawerOpen(false);
      window.dispatchEvent(new CustomEvent('kitchen:emotion-tv-done'));
    });
  });

  /* ---------- 세 유형 공통 세 번째 미션: 메이트가 올린 새 안건 (app_4) ----------
     두 미션을 마치면 게임 화면 오른쪽 위에 메이트 알림이 오고(gpt-kitchen-game.js agenda*), 누르면 kitchen:agenda-open.
     (금전형은 내가 올린 구독권 안건에 메이트가 댓글) 안건 열기 → 글 읽기 → [+] → [AI 물어보기] → 제안 읽기 → 답장 작성 → [보내기] → 메이트 답글. 끝나면 kitchen:agenda-done */
  // 줄바꿈: 가이드 말풍선 한 줄은 15자 안팎(\n = 바꾸면 좋은 자리, teumWrap), 앱 글은 문장 끝에서 먼저 바뀐다(app_4 wrapSeg).
  // '주 1회'처럼 떨어지면 안 되는 말은 붙는 공백(\u00a0)으로 묶는다
  var AGENDA_CONTENT = {
    S: { // 금전형 - 내가 올린 구독권 안건에 메이트가 댓글 (오늘 같이 신청한 반찬 단체 구독권)
      label: '안건 댓글 확인하기', mine: true, kind: '구독권',
      agenda: '오늘 같이 신청한 반찬 구독권이에요! 2주마다 반찬을 받으면 장보기랑 배달이 확 줄 것 같아요.',
      plan: { thumb:'images/thumb-sukja-banchan.png', shop:'숙자네 반찬가게', nm:'정기 반찬 단체 구독권', price:'연 65,000원',
              desc:['2주마다 원하는 반찬 2가지를 받아요', '2인 단체 구독이라 비용은 반씩 나눠요'], join:'구독 참여하기' },
      comment: '같이 신청하긴 했는데, 반찬 구독이 우리한테 정말 유용할까요? 받아 놓고 남길까 봐 조금 걱정돼요.',
      answer: function(me, mate){
        return '두 분의 지출을 살펴보니,\n이번 달 배달비가 크게 늘었어요!\n'   // AI 답변은 한 글자씩 적혀 문장 덩어리를 못 쓰니 한 줄 20자 안팎으로 끊어 둔다
             + '반찬 구독으로 배달을 주\u00a01회로 줄이면\n구독료보다 더 아낄 수 있어요.\n'
             + '2주마다 2가지만 받으니 남길 걱정도 적어요.';
      },
      reply: '배달비가 꽤 나갔더라고요! 반찬 받으면 배달은 주\u00a01회로 줄여봐요.',
      aiNote: '틈이 지출을 살펴보고\n반찬 구독이 <b>유용한지</b> 알려줬어요.',
      mateReply: '좋아요! 그럼 구독 덕분에 오히려 아끼겠네요.'
    },
    A: { // 규칙형 - 메이트가 새 규칙(외부인 초대)을 정하려고 올린 투표에 참여
      label: '새 규칙 투표하기', kind: '투표', title: '외부인 초대 규칙',
      agenda: '가끔 친구가 놀러 올 때가 있는데, 외부인 초대 규칙이 없어서 서로 불편할 수 있을 것 같아요. 새 규칙으로 정하려고 투표 올려요! 편하게 골라주세요.',
      comment: '저는 하루 전에 미리 알려주면 좋겠어요. 다른 의견도 환영이에요!',
      poll: { title:'외부인 초대 규칙', options:[
        { label:'최소 1일 전 메이트에게 미리 알리기', votes:1 },
        { label:'외부인 초대 금지', votes:0 },
        { label:'외부인 초대 아무때나 상관없음', votes:1 } ] },
      reply: '하루 전에 미리 알리는 걸로 정해요! 저도 꼭 지킬게요.',
      replyNote: '결과대로 <b>답장</b>을 적었어요.\n고쳐서 보내도 돼요.',
      mateReply: '좋아요! 우리 규칙에 바로 추가해둘게요.',
      doneNote: '투표로 정한 규칙은\n함께 지키기 좋아요.'
    },
    H: { // 감정형 - 미션1에서 채팅으로 올린 전기세 안건에 메이트가 댓글 → AI 물어보기로 예전 약속 찾기 (예전 미션1 흐름)
      label: '전기세 안건 확인하기', mine: true, memo: true,
      agenda: '이번 달 전기세가 5만 원이 넘게 나왔어요. 어떻게 줄이면 좋을지 의견을 모아봐요!',
      comment: 'TV를 안 볼 때는 꼭 꺼 두면 좋겠어요.',
      answer: function(){
        return '두 분의 대화를 살펴보니,\n한 달 전에도 전기세 얘기를 했어요!\n'
             + '그때 쓰지 않는 가전은 전원을 끄고\n콘센트를 뽑아 두자고 약속하셨어요.';
      }
    }
  };
  // 게임 화면 알림(gpt-kitchen-game.js agendaBegin)도 앱 안 메이트 댓글과 같은 문장을 쓰게 여기서 꺼내 준다
  window.TEUM_agendaComment = function(type){ return AGENDA_CONTENT[type] ? AGENDA_CONTENT[type].comment : ''; };
  function agendaSteps(type){
    var c = AGENDA_CONTENT[type], m = mateName(), me = visitorNameInput.value.trim() || '나';
    var n = { S:1, A:2, H:3 }[type], g = selectedGender === 'male' ? 'men' : 'women';
    var agenda = { agenda:c.agenda, comment:c.comment, answer:c.answer ? c.answer(me, m) : '', kind:c.kind, poll:c.poll };
    if(c.mine){ // 내가 올린 글 - 글쓴이는 나, 분류·구독권 카드를 붙인다
      agenda.kind = c.kind; agenda.plan = c.plan;
      agenda.author = { name:me, face: g === 'men' ? '../object/charater1_man/cha1_man_profile.png' : '../object/character1/cha1_profile.png' };
    }
    if(c.memo) return [ // 감정형: 내가 채팅에서 올린 전기세 안건 → 메이트 댓글 → 내 메시지 → AI 물어보기로 예전 약속 찾기
      { kind:'action', action:'reset-view' },
      { kind:'action', action:'set-mate', value:{ name:m, face:'../object/mate' + n + '/mate_' + g + '_' + n + '_hi.png' } },
      { kind:'action', action:'set-agenda', value:agenda },
      { kind:'click', target:'notice',
        text:'<b>[안건]</b>에 채팅에서 올린\n전기세 안건이 있어요.' },
      { kind:'show', target:'post',
        text:'안건에서는 의견을\n한곳에 모을 수 있어요.' },
      { kind:'show', target:'comment',
        text:m + '님이 <b>댓글</b>로\n의견을 남겼어요.' },
      { kind:'show', target:'field', action:'type-msg',
        text:'<b>메시지</b>로 생각을 적었어요.\n고쳐서 보내도 돼요.' },
      { kind:'click', target:'send',
        text:'<b>[보내기]</b>를 눌러\n의견을 올려보세요.' },
      { kind:'click', target:'plus',
        text:'틈의 도움을 받아봐요.\n<b>[+]</b> 버튼을 눌러보세요.' },
      { kind:'click', target:'ai',
        text:'<b>[AI 물어보기]</b>를 누르면\n지난 대화에서 찾아줘요.' },
      { kind:'show', target:'aiAnswer', action:'wait-ai',
        text:'AI가 지난 대화에서\n<b>약속</b>을 찾아줬어요.\n안 쓸 땐 끄고 콘센트 뽑기!' }
    ];
    var open = c.poll
      ? [{ kind:'click', target:'notice',
           text:'<b>[안건]</b>에 ' + m + '님이 올린\n새 규칙 <b>투표</b>가 와 있어요.' },
         { kind:'show', target:'post',
           text:'새 규칙을 정하려고\n' + m + '님이 <b>투표</b>를 올렸어요.' },
         { kind:'click', target:'pollOpt',
           text:'마음에 드는 방법을 골라요.\n첫 번째 항목을 눌러보세요.' },
         { kind:'click', target:'pollGo',
           text:'<b>[투표하기]</b>를 눌러\n투표해보세요.' },
         { kind:'show', target:'poll',
           text:'투표 결과가 바로 보여요.\n<b>미리 알리기</b>가 가장 많아요.' }]
      : c.mine
      ? [{ kind:'click', target:'notice',
           text:'<b>[안건]</b>에 내가 올린\n구독권 글이 있어요.' },
         { kind:'show', target:'post',
           text:'오늘 신청한 <b>구독권</b>을\n안건으로 올렸어요.' },
         { kind:'show', target:'comment',
           text:m + '님이 <b>댓글</b>을 남겼어요.\n반찬 구독이 정말\n유용할지 궁금하대요.' }]
      : [{ kind:'click', target:'notice',
           text:'<b>[안건]</b>에 ' + m + '님이 올린\n새 안건이 와 있어요.' },
         { kind:'show', target:'post',
           text:'<b>\'' + c.title + '\'</b> 안건이에요.\n' + c.noteShow }];
    return [
      { kind:'action', action:'reset-view' },
      { kind:'action', action:'set-mate', value:{ name:m, face:'../object/mate' + n + '/mate_' + g + '_' + n + '_hi.png' } },
      { kind:'action', action:'set-agenda', value:agenda }
    ].concat(open, c.poll ? [] : [
      { kind:'click', target:'plus',
        text:'틈의 도움을 받아봐요.\n<b>[+]</b> 버튼을 눌러보세요.' },
      { kind:'click', target:'ai',
        text:'<b>[AI 물어보기]</b>를 누르면\n틈이 방법을 제안해줘요.' },
      { kind:'show', target:'aiAnswer', action:'wait-ai',
        text:c.aiNote || '틈이 두 사람 모두 편할\n<b>방법</b>을 제안해줬어요.' }
    ], [
      { kind:'show', target:'field', action:'type-msg', value:c.reply,
        text:c.replyNote || '제안대로 <b>답장</b>을 적었어요.\n고쳐서 보내도 돼요.' },
      { kind:'click', target:'send',
        text:'<b>[보내기]</b>를 눌러\n' + m + '님에게 답해보세요.' },
      { kind:'show', target:'mateReply', action:'mate-reply', value:c.mateReply,
        text:m + '님도 좋다고 답했어요!\n' + (c.doneNote || '안건으로 이야기하면\n마음 상하지 않고 함께 정할 수 있어요.') }
    ]);
  }
  var agendaRunning = false;
  window.addEventListener('kitchen:agenda-open', function(){
    if(eg.active || agendaRunning || !AGENDA_CONTENT[currentMateType]) return;
    agendaRunning = true;
    appShowScreen('emotion');
    setDrawerOpen(true);
    egStart(appEmotionFrame, AGENDA_CONTENT[currentMateType].label || '새 안건 확인하기', agendaSteps(currentMateType), function(){
      agendaRunning = false;
      egStop();
      setDrawerOpen(false);
      window.dispatchEvent(new CustomEvent('kitchen:agenda-done'));
    });
  });
  window.addEventListener('kitchen:mission-reset', function(){ agendaRunning = false; });

  /* ---------- 감정형(H) 미션2 대본: 상호 피드백 작성 → 상대 피드백 확인 (app_3) ----------
     한 달 동안의 고마움·조심스러운 부탁을 얼굴 보고 꺼내기 어려울 때, 피드백으로 가볍게 전한다 */
  var EMOTION_FB_ASK = '다만 밤늦게는 TV 소리를 조금만 줄여주시면 저도 더 편히 쉴 수 있을 것 같아요!';
  function emotionFbSteps(){
    var m = mateName(), me = visitorNameInput.value.trim() || '나';
    return [
      { kind:'action', action:'reset-fb' },
      { kind:'action', action:'set-names', value:{ mate:m, me:me, face:'../object/mate3/mate_' + (selectedGender === 'male' ? 'men' : 'women') + '_3_hi.png' } },
      { kind:'click', target:'fbBtn',
        text:'<b>[상호 피드백]</b>으로 한 달의 마음을\n전해요. <b>[피드백 작성하기]</b>를 눌러보세요.' },
      { kind:'show', target:'moods', action:'pick-mood',
        text:'<b>표정</b>으로 이번 달 생활이 어땠는지\n표현해요. <b>\'최고예요\'</b>를 골랐어요.' },
      { kind:'show', target:'good', action:'pick-good',
        text:'<b>좋았던 점</b>을 체크하면\n메이트에게 고마움이 전해져요.' },
      { kind:'show', target:'rule', action:'pick-rule',
        text:'<b>규칙 평가</b>로 규칙이 지켜졌는지\n알려요. <b>\'잘 지켜졌어요\'</b>를 골랐어요.' },
      { kind:'click', target:'fbNext',
        text:'<b>[다음으로 이동하기]</b>를 눌러보세요.' },
      { kind:'click', target:'chip',
        text:'하고 싶은 말이 잘 떠오르지 않으면\n<b>[추천 문구]</b>를 눌러보세요.' },
      { kind:'show', target:'msg', action:'append-msg', value:EMOTION_FB_ASK,
        text:'고마움과 함께 <b>조심스러운 부탁</b>을\n전하면 덜 어색해요.' },
      { kind:'click', target:'fbNext',
        text:'<b>[다음으로 이동하기]</b>를 눌러보세요.' },
      { kind:'show', target:'sum',
        text:'보내기 전에 <b>미리 보기</b>로\n전할 내용을 한 번 더 확인해요.' },
      { kind:'click', target:'fbNext',
        text:'<b>[완료하기]</b>를 눌러\n피드백을 보내보세요.' },
      { kind:'click', target:'fbBtn',
        text:m + '님도 보냈어요.\n<b>[상대 피드백 보기]</b>를 눌러보세요.' },
      { kind:'show', target:'peerGood',
        text:m + '님이 고른 <b>나의 좋은 점</b>이에요.\n서로 고마운 점을 알 수 있어요.' },
      { kind:'show', target:'peerMsg',
        text:'<b>' + m + '님의 메시지</b>도 왔어요.\n마음을 나누면 오해가 쌓이지 않아요.' }
    ];
  }
  var emotionFbDone = false;
  window.addEventListener('kitchen:emotion-fb-start', function(){
    if(eg.active || emotionFbDone) return;
    appShowScreen('living');
    setDrawerOpen(true);
    egStart(appLivingFrame, '피드백 주고받기', emotionFbSteps(), function(){
      emotionFbDone = true;
      egStop();
      setDrawerOpen(false);
      window.dispatchEvent(new CustomEvent('kitchen:emotion-fb-done'));
    });
  });

  function resetEunminGuide(){
    emotionTvDone = false;
    emotionFbDone = false;
    egStop();
    eunminTasksDone = { dish:false, recycle:false };
    eunminTaskRunning = null;
    eunminMission2Notified = false;
  }

  window.addEventListener('teum:guide-open', startGuideTour);
  guideTooltipClose.addEventListener('click', function(){
    if(mission2Active){ endMission2Tour(); }
    else if(fridgeMissionActive){ endFridgeMissionTour(); }
    else if(laundryMissionActive){ endLaundryMissionTour(); }
    else { endGuideTour(); }
  });
  window.addEventListener('resize', function(){
    if(guideActive){
      positionGuide(guideStep === 0 ? settleHero : (guideStep === 1 ? addPhotoBtn : appReport));
    } else if(mission2Active){
      positionGuide(mission2Step === 0 ? appBell : notiSendBtn);
    }
    if(eg.active) egPositionBubble();
  });

  function resetAll(){
    boxes.forEach(function(b){ b.value = ''; });
    errorMsg.classList.remove('show');
    genderNamePanel.classList.remove('show');
    clearTimeout(matchingTimer);
    revealPanel.classList.remove('show', 'loading', 'agreeing', 'agree-prep');
    say(null);
    stageAgreementFrame.src = 'about:blank';
    visitorNameInput.value = '';
    genderButtons.forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('genderPreview').className = 'gender-preview';
    selectedGender = null;
    pendingMateType = '';
    nameGenderNextBtn.disabled = true;
    stageWrap.classList.remove('hide');
    cohabitView.classList.remove('show', 'fade-in');
    document.body.classList.remove('cohabit-active');
    closeOnboarding();
    endGuideTour();
    endMission2Tour();
    endFridgeMissionTour();
    fridgeMissionDone = false;
    endLaundryMissionTour();
    laundryMissionDone = false;
    hideAlleyGuide();
    resetEunminGuide();
    if(appTopToast){ appTopToastTimers.forEach(clearTimeout); appTopToast.classList.remove('show', 'titled', 'open', 'guided'); }
    alleyNotiFinish = null;
    var appHomeDefaultEl = document.getElementById('appHomeDefault');
    var appHomeEunminEl = document.getElementById('appHomeEunmin');
    if(appHomeDefaultEl) appHomeDefaultEl.style.display = '';
    if(appHomeEunminEl) appHomeEunminEl.style.display = 'none';
    document.getElementById('cohabit-game-container').classList.remove('kitchen-active');
    setDrawerLayout(false);
    window.dispatchEvent(new CustomEvent('kitchen:mission-reset'));
    missionStage = 0;
    popupContext = null;
    popupIcon.textContent = '💌';
    window.dispatchEvent(new CustomEvent('teum:bubble-show'));
    resetBillData();
    appShowScreen('home');
    agreementSigned = false;
    if(AUTO_FOCUS) boxes[0].focus();
  }

  // 게임 화면 헤더의 유형 탭(금전/규칙/감정): 이름·성별·합의서 상태는 그대로 두고 해당 유형으로 옮긴다.
  // 그 유형에서 끝낸 미션은 그대로 이어서 한다(부엌 스크립트의 progressByType).
  // 헤더는 그대로 두고 아래 게임 화면(방·미션 카드·폰)만 서서히 감췄다가(0.35초) 바꾼 뒤 서서히 띄운다(0.5초).
  // 예전엔 화면과 미션 카드가 한순간에 바뀌어 뚝 끊기는 느낌이었다
  var cohabitBodyEl = document.querySelector('.cohabit-body');
  var switchingType = false;
  function switchMateType(type){
    if(switchingType || type === currentMateType || missionInProgress() || (window.TEUM_gameBusy && window.TEUM_gameBusy())) return; // 기본 상태에서만 (미션·대화창·시작 안내·엔딩 마무리 중엔 막음)
    switchingType = true;
    Array.prototype.forEach.call(document.querySelectorAll('.mate-tab'), function(tab){ // 누른 탭은 바로 켠다
      tab.classList.toggle('active', tab.getAttribute('data-type') === type);
    });
    cohabitBodyEl.classList.remove('type-in');
    cohabitBodyEl.classList.add('type-out');
    setTimeout(function(){
      var name = visitorNameInput.value, gender = selectedGender, signed = agreementSigned;
      resetAll();
      visitorNameInput.value = name;
      selectedGender = gender;
      pendingMateType = type;
      codePanel.classList.add('hide'); // resetAll이 코드 입력 화면을 다시 켜 둔다 - 안 숨기면 코드 화면 배경(꽃)이 헤더를 덮었다
      revealCharacter(type);
      enterCohabit(!signed);
      if(signed) showMainAfterAgreement(false); // 유형을 바꿀 때마다 메이트 환영 대화부터 (다른 유형에서 읽었어도)
      cohabitBodyEl.classList.remove('type-out');
      void cohabitBodyEl.offsetWidth;
      cohabitBodyEl.classList.add('type-in');
      switchingType = false;
    }, 350);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.mate-tab'), function(tab){
    tab.addEventListener('click', function(){ switchMateType(tab.getAttribute('data-type')); });
  });
  // 헤더 유형 탭을 못 누르는 동안엔 흐리게 (updateRoomLock의 locked와 따로 - 그쪽은 앱 미션 때만 갱신된다)
  // ponytail: 0.2초마다 상태를 읽어 맞춘다 - 대화창·안내가 뜨고 닫히는 곳마다 호출을 심는 대신
  setInterval(function(){
    var tabs = document.getElementById('mateTabs');
    if(tabs) tabs.classList.toggle('busy', !!(window.TEUM_gameBusy && window.TEUM_gameBusy()));
  }, 200);
  function syncMateTabs(){
    Array.prototype.forEach.call(document.querySelectorAll('.mate-tab'), function(tab){
      tab.classList.toggle('active', tab.getAttribute('data-type') === currentMateType);
    });
  }

  // [다시하기]: 이름·성별·합의는 그대로, 모든 유형의 진행도를 지우고 지금 유형을 환영 대화부터 처음부터 다시
  // 처음 게임에 들어올 때처럼: 지금 화면을 서서히 감추고(0.6초) → 안 보이는 동안 처음 상태로 되돌린 뒤 → 게임을 서서히 띄운다(1.2초, cohabitFadeIn).
  // 예전엔 화면이 보이는 채로 방·캐릭터·핀이 한꺼번에 제자리로 튀어서 깜빡이는 것처럼 보였다
  var restarting = false;
  document.getElementById('cohabitRestartBtn').addEventListener('click', function(){
    if(restarting) return; // 미션·대화 중에도 누를 수 있음 (resetAll이 미션·폰·엔딩 상태를 다 지운다)
    restarting = true;
    var type = currentMateType, name = visitorNameInput.value, gender = selectedGender, signed = agreementSigned;
    cohabitView.classList.remove('fade-in');
    cohabitView.classList.add('fading-out');
    setTimeout(function(){
      resetAll();
      window.dispatchEvent(new CustomEvent('teum:clear-progress'));
      visitorNameInput.value = name;
      selectedGender = gender;
      pendingMateType = type;
      codePanel.classList.add('hide'); // 유형 탭과 같은 이유
      revealCharacter(type);
      enterCohabit(!signed);
      cohabitView.classList.remove('fading-out');
      void cohabitView.offsetWidth; // 페이드인 애니메이션을 처음부터 다시
      cohabitView.classList.add('fade-in');
      if(signed) showMainAfterAgreement(false);
      restarting = false;
    }, 600);
  });
  // 빨래 미션 완료 표시 - 유형을 오가며 진행도를 되살릴 때도 이 이벤트로 받는다
  window.addEventListener('kitchen:laundry-resolved', function(){ laundryMissionDone = true; });
  // 게임 화면 안 그림·글자를 실수로 끌어도 브라우저 기본 끌어 놓기(복사 화면)가 뜨지 않게 (튜너 드래그는 마우스 이벤트라 영향 없음)
  cohabitView.addEventListener('dragstart', function(e){ e.preventDefault(); });

  // [개발용 - 완성 후 이 블록 통째로 삭제] 코드 확인 뒤 Ctrl+Shift+S: 성별/이름·매칭·합의서를 건너뛰고 바로 게임.
  // (F키는 크롬·노트북이 가로챈다. e.code라 한글 입력 상태에서도 된다)
  // 이름을 안 썼으면 '테스트', 성별을 안 골랐으면 여성으로 들어간다.
  document.addEventListener('keydown', function(e){
    if(!(e.ctrlKey && e.shiftKey && e.code === 'KeyS') || !pendingMateType || cohabitView.classList.contains('show') || stageWrap.classList.contains('fading-out')) return;
    e.preventDefault();
    if(!visitorNameInput.value.trim()) visitorNameInput.value = '테스트';
    if(!selectedGender) selectedGender = 'female';
    revealCharacter(pendingMateType);
    // 이하 합의 완료(agreement-signed) 때와 같은 진입: 화면 0.7초 페이드아웃 → 게임 페이드인
    say(null);
    stageWrap.classList.add('fading-out');
    setTimeout(function(){
      enterCohabit(false);
      cohabitView.classList.add('fade-in');
      stageWrap.classList.remove('fading-out');
      revealPanel.classList.remove('agreeing', 'agree-prep');
      stageAgreementFrame.src = 'about:blank';
      showMainAfterAgreement();
    }, 700);
  });
})();
